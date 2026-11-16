/**
 * Sets X-Response-Time on the response when it ends.
 */
export function withResponseTime(res, start) {
  const origEnd = res.end;
  res.end = function (...args) {
    res.setHeader('x-response-time', `${Date.now() - start}ms`);
    return origEnd.apply(this, args);
  };
}
