/**
 * Wraps a promise with a timeout.
 * Controlled by RENDER_TIMEOUT_MS (default 10000). Set to 0 to disable.
 */
const TIMEOUT = Number(process.env.RENDER_TIMEOUT_MS ?? 10_000);

export function withTimeout(promise, label = 'render') {
  if (!TIMEOUT || TIMEOUT <= 0) return promise;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${TIMEOUT}ms`);
      err.code = 'RENDER_TIMEOUT';
      err.statusCode = 504;
      reject(err);
    }, TIMEOUT);

    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
