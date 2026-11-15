export async function readAiTransport(response, onHeartbeat = () => {}) {
  if (!response.headers.get('content-type')?.includes('application/x-ndjson')) return response;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let result;
  const line = (value) => {
    if (!value.trim()) return;
    const event = JSON.parse(value);
    if (event.event === 'result') result = event;
    else onHeartbeat(event.event);
  };
  try {
    while (!result) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      if (pending.length > 2000000) throw new Error('AI response exceeds transport limit');
      const lines = pending.split('\n');
      pending = lines.pop();
      lines.forEach(line);
      if (done) { line(pending); break; }
    }
    if (!result || !Number.isInteger(result.status) || result.status < 200 || result.status > 599 || !result.data) throw new Error('ارتباط قبل از دریافت نتیجه کامل تحلیل قطع شد.');
    return new Response(JSON.stringify(result.data), { status: result.status, headers: { 'content-type': 'application/json' } });
  } catch (error) {
    throw Object.assign(error, { retryable: true });
  } finally {
    // Cleanup itself can stall on a broken network stream. Never await it.
    reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
