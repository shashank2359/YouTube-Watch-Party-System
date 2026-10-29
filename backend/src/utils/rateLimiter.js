/** Sliding-window limiter: returns a function that answers "is another event allowed now?" */
export function createRateLimiter(max, windowMs) {
  let hits = [];
  return function allow() {
    const now = Date.now();
    hits = hits.filter((t) => now - t < windowMs);
    if (hits.length >= max) return false;
    hits.push(now);
    return true;
  };
}
