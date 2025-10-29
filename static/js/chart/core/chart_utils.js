export function debounce(fn, wait) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function intervalToMs(intervalStr) {
  const n = parseInt(intervalStr, 10);
  if (!Number.isNaN(n)) return n * 60 * 1000;
  if (intervalStr === 'D') return 24 * 60 * 60 * 1000;
  if (intervalStr === 'W') return 7 * 24 * 60 * 60 * 1000;
  if (intervalStr === 'M') return 30 * 24 * 60 * 60 * 1000;
  return 60 * 1000;
}

export function alignClientMsToIntervalBarStart(clientMs, intervalStr) {
  const tfMs = intervalToMs(intervalStr);
  return Math.floor(clientMs / tfMs) * tfMs;
}
