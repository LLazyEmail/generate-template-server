/**
 * Readiness for load balancers and k8s.
 * Returns 200 only when the generator is initialized.
 */
export function isReady(state) {
  return Boolean(state?.generate && Array.isArray(state.catalog));
}

export function readyBody(state) {
  if (!isReady(state)) {
    return { ok: false, reason: 'catalog_not_loaded' };
  }
  return {
    ok: true,
    catalogSource: state.catalogSource,
    templateCount: state.catalog.flatMap((c) => c.ids).length,
  };
}
