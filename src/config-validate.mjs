/**
 * Fail fast on invalid config so the process does not start half-configured.
 */
export function validateConfig(config) {
  const errors = [];
  if (!Number.isFinite(config.port) || config.port < 1 || config.port > 65535) {
    errors.push('PORT must be 1-65535');
  }
  if (!Number.isFinite(config.maxBodyBytes) || config.maxBodyBytes < 1) {
    errors.push('MAX_BODY_BYTES must be a positive number');
  }
  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.code = 'INVALID_CONFIG';
    throw err;
  }
}
