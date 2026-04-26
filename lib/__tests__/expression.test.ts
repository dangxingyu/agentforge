import { describe, it, expect } from 'vitest';
import {
  parseExpression,
  evaluateExpression,
  validateExpression,
  collectRefs,
  extractRefsByRegex,
} from '../expression';

describe('parseExpression', () => {
  it('parses a simple comparison', () => {
    const { ast, errors } = parseExpression('{{grader.score}} >= 0.8');
    expect(errors).toEqual([]);
    expect(ast?.kind).toBe('binary');
  });

  it('parses compound boolean expressions', () => {
    const { errors } = parseExpression(
      '{{a.b}} >= 0.95 && !{{a.c}} || {{a.d}} == "ok"'
    );
    expect(errors).toEqual([]);
  });

  it('rejects bare identifiers as a hint to use {{role.field}}', () => {
    const { errors } = parseExpression('score >= 0.8');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/bare names/);
  });

  it('flags unterminated references', () => {
    const { errors } = parseExpression('{{grader.score');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/Unterminated/);
  });

  it('returns null AST for empty input without errors', () => {
    const { ast, errors } = parseExpression('   ');
    expect(ast).toBeNull();
    expect(errors).toEqual([]);
  });
});

describe('evaluateExpression', () => {
  it('evaluates basic comparisons', () => {
    const r = evaluateExpression('{{g.score}} >= 0.8', { 'g.score': 0.9 });
    expect(r.value).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('short-circuits && and ||', () => {
    expect(
      evaluateExpression('false && {{a.b}}', { 'a.b': true }).value
    ).toBe(false);
    expect(
      evaluateExpression('true || {{a.b}}', { 'a.b': false }).value
    ).toBe(true);
  });

  it('handles negation and parentheses', () => {
    const r = evaluateExpression('!({{x.y}} > 5)', { 'x.y': 3 });
    expect(r.value).toBe(true);
  });

  it('treats missing refs as null/falsy', () => {
    const r = evaluateExpression('{{g.score}} >= 0.5', {});
    // null >= 0.5 → toNumber(null) = NaN → comparison is false
    expect(r.value).toBe(false);
  });

  it('handles compound real-world expressions', () => {
    const r = evaluateExpression(
      '{{r.coverage}} >= 0.95 && !{{r.contradictions}}',
      { 'r.coverage': 0.97, 'r.contradictions': false }
    );
    expect(r.value).toBe(true);
    const r2 = evaluateExpression(
      '{{r.coverage}} >= 0.95 && !{{r.contradictions}}',
      { 'r.coverage': 0.97, 'r.contradictions': true }
    );
    expect(r2.value).toBe(false);
  });

  it('does string equality for enum-like fields', () => {
    expect(
      evaluateExpression('{{g.verdict}} == "correct"', { 'g.verdict': 'correct' }).value
    ).toBe(true);
    expect(
      evaluateExpression('{{g.verdict}} == "correct"', { 'g.verdict': 'partial' }).value
    ).toBe(false);
  });

  it('does arithmetic correctly', () => {
    expect(evaluateExpression('1 + 2 * 3', {}).value).toBe(7);
    expect(evaluateExpression('(1 + 2) * 3', {}).value).toBe(9);
    expect(evaluateExpression('10 % 3', {}).value).toBe(1);
  });
});

describe('validateExpression', () => {
  it('flags unresolved refs', () => {
    const r = validateExpression('{{g.score}} >= 0.8', new Set(['g.other']));
    expect(r.ok).toBe(false);
    expect(r.unresolvedRefs).toHaveLength(1);
    expect(r.unresolvedRefs[0].field).toBe('score');
  });

  it('passes when all refs resolve', () => {
    const r = validateExpression(
      '{{g.score}} >= 0.8',
      new Set(['g.score', 'g.verdict'])
    );
    expect(r.ok).toBe(true);
    expect(r.unresolvedRefs).toEqual([]);
  });

  it('reports both syntax errors and resolved refs', () => {
    const r = validateExpression(
      '{{g.score}} >= 0.8 && bareword',
      new Set(['g.score'])
    );
    expect(r.syntaxErrors.length).toBeGreaterThan(0);
    expect(r.unresolvedRefs).toEqual([]); // refs are resolved; the issue is syntax
  });
});

describe('collectRefs / extractRefsByRegex', () => {
  it('agrees on well-formed input', () => {
    const expr = '{{a.b}} >= 0 && {{c.d}} == "x"';
    const { ast } = parseExpression(expr);
    const fromAst = collectRefs(ast).map((r) => `${r.role}.${r.field}`);
    const fromRegex = extractRefsByRegex(expr).map((r) => `${r.role}.${r.field}`);
    expect(fromAst.sort()).toEqual(fromRegex.sort());
  });

  it('regex extracts even from broken syntax', () => {
    const refs = extractRefsByRegex('{{a.b}} >= && {{c.d}}');
    expect(refs).toHaveLength(2);
  });
});
