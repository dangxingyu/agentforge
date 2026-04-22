// Client-side helper to call the AgentForge chat API
export async function* streamChat(
  messages: { role: 'user' | 'assistant'; content: string }[]
): AsyncGenerator<{ type: 'text'; text: string } | { type: 'pipeline'; pipeline: unknown } | { type: 'error'; error: string }> {
  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok || !resp.body) {
    yield { type: 'error', error: `HTTP ${resp.status}` };
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });

    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return;
      try {
        yield JSON.parse(data);
      } catch {
        // ignore
      }
    }
  }
}
