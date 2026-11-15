// Abort is best-effort; the race guarantees callers stop waiting even if a
// transport or stream cleanup ignores cancellation.
export async function withDeadline(operation, timeoutMs, message) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = Object.assign(new Error(message), { retryable: true, code: 'DEADLINE_EXCEEDED' });
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  try { return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), timeout]); }
  finally { clearTimeout(timer); }
}
