// Bound decompressed data too, so compression cannot bypass the request limit.
export async function readProjectBody(request) {
  const encoding = request.headers.get('x-project-encoding');
  if (encoding && encoding !== 'gzip') throw Object.assign(new Error('Unsupported project encoding'), { status: 415 });
  const stream = encoding === 'gzip' ? request.body.pipeThrough(new DecompressionStream('gzip')) : request.body;
  if (!stream) throw Object.assign(new Error('Project body is required'), { status: 400 });
  const reader = stream.getReader();
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64 * 1024 * 1024) {
        void reader.cancel().catch(() => {});
        throw Object.assign(new Error('Project exceeds 64 MiB'), { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) { if (!error.status) error.status = 400; throw error; }
  finally { reader.releaseLock(); }
}
