/**
 * Maps GenerateTemplateError codes (and generic errors) to HTTP status +
 * a stable machine-readable shape.
 */
export function toHttpError(err) {
  const code = err?.code ?? 'RENDER_FAILED';
  let status = 500;

  switch (code) {
    case 'UNKNOWN_TEMPLATE':
      status = 404;
      break;
    case 'INVALID_PAYLOAD':
    case 'VALIDATION_FAILED':
    case 'MISSING_REQUIRED':
      status = 400;
      break;
    case 'RENDER_FAILED':
    case 'WRITE_FAILED':
      status = 422;
      break;
    default:
      status = err?.statusCode ?? 422;
  }

  return {
    status,
    body: {
      error: code,
      message: err?.message ?? String(err),
      details: err?.details ?? undefined,
    },
  };
}
