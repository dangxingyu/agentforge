/**
 * AgentForge condition expression language.
 *
 * Used for decision-node conditions, loop break-conditions, and aggregator
 * selection criteria. Expressions can reference upstream LLM-agent outputs
 * via `{{role.field}}` template syntax and combine them with comparison and
 * logical operators.
 *
 * Grammar (precedence low → high):
 *
 *   expression  := or
 *   or          := and ('||' and)*
 *   and         := not ('&&' not)*
 *   not         := '!' not | comparison
 *   comparison  := sum (('==' | '!=' | '<' | '<=' | '>' | '>=') sum)?
 *   sum         := product (('+' | '-') product)*
 *   product     := unary (('*' | '/' | '%') unary)*
 *   unary       := '-' unary | atom
 *   atom        := number | string | bool | null | ref | '(' expression ')'
 *   ref         := '{{' identifier '.' identifier '}}'
 *
 * Strings: single- or double-quoted. Booleans: `true`/`false`. Null: `null`.
 *
 * The parser is a hand-written recursive descent — small, safe (no eval),
 * and tolerant of partial input (returns errors but still tries to extract
 * an AST so downstream tooling can highlight what it can).
 */

export type Value = number | string | boolean | null;

export interface VariableRef {
  /** Original matched token, e.g. "{{grader.score}}" */
  raw: string;
  /** Agent role (left side of the dot) */
  role: string;
  /** Output field name (right side of the dot) */
  field: string;
}

export type ASTNode =
  | { kind: 'lit'; value: Value }
  | { kind: 'ref'; role: string; field: string; raw: string }
  | { kind: 'unary'; op: '-' | '!'; operand: ASTNode }
  | {
      kind: 'binary';
      op:
        | '||'
        | '&&'
        | '=='
        | '!='
        | '<'
        | '<='
        | '>'
        | '>='
        | '+'
        | '-'
        | '*'
        | '/'
        | '%';
      left: ASTNode;
      right: ASTNode;
    };

interface BaseToken {
  pos: number;
}
type Token =
  | (BaseToken & { type: 'number'; value: number })
  | (BaseToken & { type: 'string'; value: string })
  | (BaseToken & { type: 'bool'; value: boolean })
  | (BaseToken & { type: 'null' })
  | (BaseToken & { type: 'ref'; role: string; field: string; raw: string })
  | (BaseToken & { type: 'op'; value: string })
  | (BaseToken & { type: 'lparen' })
  | (BaseToken & { type: 'rparen' })
  | (BaseToken & { type: 'eof' });

export interface ParseError {
  message: string;
  /** Character offset where the error was detected. */
  pos: number;
}

// ─── Tokenizer ────────────────────────────────────────────────────────────

const MULTI_OPS = ['==', '!=', '<=', '>=', '&&', '||'];
const SINGLE_OPS = '<>+-*/%!';

function tokenize(src: string): { tokens: Token[]; errors: ParseError[] } {
  const tokens: Token[] = [];
  const errors: ParseError[] = [];
  let i = 0;

  while (i < src.length) {
    const c = src[i];

    // Whitespace
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }

    // Reference {{role.field}}
    if (c === '{' && src[i + 1] === '{') {
      const end = src.indexOf('}}', i + 2);
      if (end < 0) {
        errors.push({ message: 'Unterminated reference {{…}}', pos: i });
        i = src.length;
        continue;
      }
      const inner = src.slice(i + 2, end).trim();
      const m = inner.match(/^([A-Za-z_][\w-]*)\s*\.\s*([A-Za-z_][\w-]*)$/);
      if (!m) {
        errors.push({
          message: `Invalid reference "${inner}" — expected {{role.field}}`,
          pos: i,
        });
      } else {
        tokens.push({
          type: 'ref',
          role: m[1],
          field: m[2],
          raw: src.slice(i, end + 2),
          pos: i,
        });
      }
      i = end + 2;
      continue;
    }

    // Numbers (with optional decimal and exponent)
    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < src.length && src[j] >= '0' && src[j] <= '9') j++;
      if (src[j] === '.') {
        j++;
        while (j < src.length && src[j] >= '0' && src[j] <= '9') j++;
      }
      if (src[j] === 'e' || src[j] === 'E') {
        j++;
        if (src[j] === '+' || src[j] === '-') j++;
        while (j < src.length && src[j] >= '0' && src[j] <= '9') j++;
      }
      const numStr = src.slice(i, j);
      const num = parseFloat(numStr);
      if (Number.isNaN(num)) {
        errors.push({ message: `Invalid number "${numStr}"`, pos: i });
      } else {
        tokens.push({ type: 'number', value: num, pos: i });
      }
      i = j;
      continue;
    }

    // String literals
    if (c === '"' || c === '\'') {
      const quote = c;
      let j = i + 1;
      let str = '';
      while (j < src.length && src[j] !== quote) {
        if (src[j] === '\\' && j + 1 < src.length) {
          const next = src[j + 1];
          if (next === 'n') str += '\n';
          else if (next === 't') str += '\t';
          else str += next;
          j += 2;
        } else {
          str += src[j];
          j++;
        }
      }
      if (j >= src.length) {
        errors.push({ message: 'Unterminated string', pos: i });
        i = src.length;
        continue;
      }
      tokens.push({ type: 'string', value: str, pos: i });
      i = j + 1;
      continue;
    }

    // Identifiers — only true / false / null are recognized; bare names error
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
      let j = i;
      while (
        j < src.length &&
        ((src[j] >= 'a' && src[j] <= 'z') ||
          (src[j] >= 'A' && src[j] <= 'Z') ||
          (src[j] >= '0' && src[j] <= '9') ||
          src[j] === '_')
      )
        j++;
      const word = src.slice(i, j);
      if (word === 'true') tokens.push({ type: 'bool', value: true, pos: i });
      else if (word === 'false') tokens.push({ type: 'bool', value: false, pos: i });
      else if (word === 'null') tokens.push({ type: 'null', pos: i });
      else
        errors.push({
          message: `Unknown identifier "${word}" — bare names aren't allowed; use {{role.field}}`,
          pos: i,
        });
      i = j;
      continue;
    }

    // Multi-char operators
    const two = src.slice(i, i + 2);
    if (MULTI_OPS.includes(two)) {
      tokens.push({ type: 'op', value: two, pos: i });
      i += 2;
      continue;
    }

    // Single-char operators
    if (SINGLE_OPS.includes(c)) {
      tokens.push({ type: 'op', value: c, pos: i });
      i++;
      continue;
    }

    // Parens
    if (c === '(') {
      tokens.push({ type: 'lparen', pos: i });
      i++;
      continue;
    }
    if (c === ')') {
      tokens.push({ type: 'rparen', pos: i });
      i++;
      continue;
    }

    // Unknown character
    errors.push({ message: `Unexpected character "${c}"`, pos: i });
    i++;
  }

  tokens.push({ type: 'eof', pos: src.length });
  return { tokens, errors };
}

// ─── Parser ──────────────────────────────────────────────────────────────

class Parser {
  pos = 0;
  errors: ParseError[] = [];
  constructor(public tokens: Token[]) {}

  peek(): Token {
    return this.tokens[this.pos];
  }
  consume(): Token {
    return this.tokens[this.pos++];
  }
  isOp(...ops: string[]): boolean {
    const t = this.peek();
    return t.type === 'op' && ops.includes(t.value);
  }

  parse(): ASTNode | null {
    if (this.peek().type === 'eof') return null;
    const expr = this.parseOr();
    const t = this.peek();
    if (t.type !== 'eof') {
      this.errors.push({ message: `Unexpected token`, pos: t.pos });
    }
    return expr;
  }

  parseOr(): ASTNode {
    let left = this.parseAnd();
    while (this.isOp('||')) {
      this.consume();
      const right = this.parseAnd();
      left = { kind: 'binary', op: '||', left, right };
    }
    return left;
  }

  parseAnd(): ASTNode {
    let left = this.parseNot();
    while (this.isOp('&&')) {
      this.consume();
      const right = this.parseNot();
      left = { kind: 'binary', op: '&&', left, right };
    }
    return left;
  }

  parseNot(): ASTNode {
    if (this.isOp('!')) {
      this.consume();
      return { kind: 'unary', op: '!', operand: this.parseNot() };
    }
    return this.parseComparison();
  }

  parseComparison(): ASTNode {
    const left = this.parseSum();
    if (this.isOp('==', '!=', '<', '<=', '>', '>=')) {
      const op = (this.consume() as Extract<Token, { type: 'op' }>).value as
        | '=='
        | '!='
        | '<'
        | '<='
        | '>'
        | '>=';
      const right = this.parseSum();
      return { kind: 'binary', op, left, right };
    }
    return left;
  }

  parseSum(): ASTNode {
    let left = this.parseProduct();
    while (this.isOp('+', '-')) {
      const op = (this.consume() as Extract<Token, { type: 'op' }>).value as '+' | '-';
      const right = this.parseProduct();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  parseProduct(): ASTNode {
    let left = this.parseUnary();
    while (this.isOp('*', '/', '%')) {
      const op = (this.consume() as Extract<Token, { type: 'op' }>).value as
        | '*'
        | '/'
        | '%';
      const right = this.parseUnary();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  parseUnary(): ASTNode {
    if (this.isOp('-')) {
      this.consume();
      return { kind: 'unary', op: '-', operand: this.parseUnary() };
    }
    return this.parseAtom();
  }

  parseAtom(): ASTNode {
    const t = this.peek();
    if (t.type === 'number') {
      this.consume();
      return { kind: 'lit', value: t.value };
    }
    if (t.type === 'string') {
      this.consume();
      return { kind: 'lit', value: t.value };
    }
    if (t.type === 'bool') {
      this.consume();
      return { kind: 'lit', value: t.value };
    }
    if (t.type === 'null') {
      this.consume();
      return { kind: 'lit', value: null };
    }
    if (t.type === 'ref') {
      this.consume();
      return { kind: 'ref', role: t.role, field: t.field, raw: t.raw };
    }
    if (t.type === 'lparen') {
      this.consume();
      const expr = this.parseOr();
      if (this.peek().type !== 'rparen') {
        this.errors.push({ message: 'Expected `)`', pos: this.peek().pos });
      } else {
        this.consume();
      }
      return expr;
    }
    this.errors.push({ message: 'Expected value', pos: t.pos });
    if (t.type !== 'eof') this.consume();
    return { kind: 'lit', value: null };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────

export interface ParseResult {
  ast: ASTNode | null;
  errors: ParseError[];
}

export function parseExpression(src: string): ParseResult {
  if (!src.trim()) return { ast: null, errors: [] };
  const { tokens, errors: tokErrors } = tokenize(src);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  return { ast, errors: [...tokErrors, ...parser.errors] };
}

/** Walk an AST and collect every variable reference. */
export function collectRefs(node: ASTNode | null): VariableRef[] {
  if (!node) return [];
  const out: VariableRef[] = [];
  const walk = (n: ASTNode) => {
    if (n.kind === 'ref') out.push({ raw: n.raw, role: n.role, field: n.field });
    else if (n.kind === 'unary') walk(n.operand);
    else if (n.kind === 'binary') {
      walk(n.left);
      walk(n.right);
    }
  };
  walk(node);
  return out;
}

/** Tolerant ref extraction by regex — works even when the expression has
 * syntax errors. Used for canvas rendering where we still want to highlight
 * the tokens we can recognize. */
export function extractRefsByRegex(src: string): VariableRef[] {
  if (!src) return [];
  const re = /\{\{\s*([A-Za-z_][\w-]*)\s*\.\s*([A-Za-z_][\w-]*)\s*\}\}/g;
  const out: VariableRef[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push({ raw: m[0], role: m[1], field: m[2] });
  }
  return out;
}

export interface ValidationResult {
  ok: boolean;
  syntaxErrors: ParseError[];
  unresolvedRefs: VariableRef[];
  refs: VariableRef[];
}

/**
 * Validate an expression: parse it, collect refs, and check each ref against
 * the given set of available `role.field` keys.
 */
export function validateExpression(
  src: string,
  availableRefs: Set<string>
): ValidationResult {
  const { ast, errors } = parseExpression(src);
  const refs = ast ? collectRefs(ast) : extractRefsByRegex(src);
  const unresolvedRefs = refs.filter(
    (r) => !availableRefs.has(`${r.role}.${r.field}`)
  );
  return {
    ok: errors.length === 0 && unresolvedRefs.length === 0 && refs.length >= 0,
    syntaxErrors: errors,
    unresolvedRefs,
    refs,
  };
}

// ─── Evaluator ───────────────────────────────────────────────────────────

export type Context = Record<string, Value>;

function truthy(v: Value): boolean {
  if (v === null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return !Number.isNaN(v) && v !== 0;
  if (typeof v === 'string') return v.length > 0;
  return Boolean(v);
}

function toNumber(v: Value): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === null) return NaN;
  const n = Number(v);
  return n;
}

function evalNode(node: ASTNode, ctx: Context): Value {
  switch (node.kind) {
    case 'lit':
      return node.value;
    case 'ref': {
      const key = `${node.role}.${node.field}`;
      return key in ctx ? (ctx[key] as Value) : null;
    }
    case 'unary': {
      const v = evalNode(node.operand, ctx);
      if (node.op === '!') return !truthy(v);
      if (node.op === '-') return -toNumber(v);
      return null;
    }
    case 'binary': {
      // Short-circuit logical ops
      if (node.op === '&&') {
        const l = evalNode(node.left, ctx);
        if (!truthy(l)) return false;
        return truthy(evalNode(node.right, ctx));
      }
      if (node.op === '||') {
        const l = evalNode(node.left, ctx);
        if (truthy(l)) return true;
        return truthy(evalNode(node.right, ctx));
      }

      const l = evalNode(node.left, ctx);
      const r = evalNode(node.right, ctx);
      switch (node.op) {
        case '==':
          return l === r;
        case '!=':
          return l !== r;
        case '<':
          return toNumber(l) < toNumber(r);
        case '<=':
          return toNumber(l) <= toNumber(r);
        case '>':
          return toNumber(l) > toNumber(r);
        case '>=':
          return toNumber(l) >= toNumber(r);
        case '+':
          if (typeof l === 'string' || typeof r === 'string')
            return String(l ?? '') + String(r ?? '');
          return toNumber(l) + toNumber(r);
        case '-':
          return toNumber(l) - toNumber(r);
        case '*':
          return toNumber(l) * toNumber(r);
        case '/':
          return toNumber(l) / toNumber(r);
        case '%':
          return toNumber(l) % toNumber(r);
      }
    }
  }
}

export interface EvaluationResult {
  value: Value;
  errors: ParseError[];
}

/**
 * Parse and evaluate an expression against a context of variable values.
 * Returns the computed value plus any syntax errors. If parsing fails, the
 * value is `null`.
 */
export function evaluateExpression(src: string, ctx: Context): EvaluationResult {
  const { ast, errors } = parseExpression(src);
  if (!ast) return { value: null, errors };
  return { value: evalNode(ast, ctx), errors };
}
