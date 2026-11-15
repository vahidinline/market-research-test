// Quota waits do not consume the retry budget for network/server failures.
const transientStatuses = new Set([408, 500, 502, 503, 504, 522, 524]);
const sleep = async (milliseconds) => {
  // Chunk long waits to avoid the browser's setTimeout integer overflow.
  let remaining = milliseconds;
  while (remaining > 0) {
    const chunk = Math.min(remaining, 60000);
    await new Promise(resolve => setTimeout(resolve, chunk));
    remaining -= chunk;
  }
};
function quotaDelay(result, now) {
  const seconds = Number(result.data?.retryAfterSeconds);
  const header = result.res.headers.get('retry-after');
  const headerSeconds = Number(header);
  const dateDelay = header ? Date.parse(header) - now() : 0;
  const candidates = [seconds * 1000, headerSeconds * 1000, dateDelay].filter(value => Number.isFinite(value) && value > 0);
  return candidates.length ? Math.max(1000, ...candidates) : 60000;
}
export async function retryAiRequest(send, {
  wait = sleep, now = Date.now, random = Math.random, onWait = () => {}, onRetry = () => {},
} = {}) {
  const failureDelays = [2000, 5000];
  let failures = 0;
  let quotaWaits = 0;
  let requestAttempt = 0;
  while (true) {
    if (requestAttempt++) onRetry({ attempt: requestAttempt });
    let result;
    let reason;
    let delayMs;
    try {
      result = await send();
      const status = result.data?.upstreamStatus || result.res.status;
      if (result.res.ok) return result;
      if (status === 429) {
        reason = 'quota';
        quotaWaits++;
        delayMs = quotaDelay(result, now);
      } else {
        const invalidOutput = result.data?.attempts?.at(-1)?.reason === 'invalid_json_response';
        if (result.data?.retryable === false || !transientStatuses.has(status) || invalidOutput) return result;
        if (failures >= failureDelays.length) return result;
        reason = 'transient';
        delayMs = failureDelays[failures++];
      }
    } catch (error) {
      if (!error.retryable || failures >= failureDelays.length) throw error;
      reason = 'transient';
      delayMs = failureDelays[failures++];
    }
    delayMs += Math.floor(random() * 1000);
    onWait({ reason, quotaWaits, delayMs, nextAttempt: requestAttempt + 1 });
    await wait(delayMs);
  }
}
