/**
 * Central configuration. All env reads live here so the rest of the server
 * stays free of process.env.
 */
export const config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? '0.0.0.0',
  version: process.env.npm_package_version ?? '0.1.0',
  maxBodyBytes: Number(process.env.MAX_BODY_BYTES ?? 1_000_000),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  enableMetrics: process.env.ENABLE_METRICS !== '0',
  enableRecent: process.env.ENABLE_RECENT !== '0',
  recentLimit: Number(process.env.RECENT_LIMIT ?? 50),
};
