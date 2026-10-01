(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.getPostAuthRedirect = api.getPostAuthRedirect;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function getPostAuthRedirect(searchParams, fallback = '/my-account.html') {
    const next = searchParams && typeof searchParams.get === 'function' ? searchParams.get('next') : null;
    return next || fallback;
  }

  return { getPostAuthRedirect };
});
