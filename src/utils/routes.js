export function createRouteHelpers(baseUrl = '/', origin = 'http://localhost') {
  const basePathname = new URL(baseUrl, origin).pathname;
  const basePath = basePathname === '/'
    ? '/'
    : `${basePathname.replace(/\/+$/u, '')}/`;

  function toUrlPath(routePath) {
    const normalizedRoute = routePath === '/' ? '' : `/${String(routePath).replace(/^\/+|\/+$/gu, '')}`;
    return basePath === '/' ? (normalizedRoute || '/') : `${basePath}${normalizedRoute.replace(/^\//u, '')}`;
  }

  function fromUrlPath(pathname) {
    if (pathname === '/' || pathname === basePath || pathname === basePath.slice(0, -1)) return '/';
    if (basePath === '/') return pathname.startsWith('/') ? pathname : `/${pathname}`;
    if (!pathname.startsWith(basePath)) return null;
    return `/${pathname.slice(basePath.length)}`;
  }

  return Object.freeze({ basePath, toUrlPath, fromUrlPath });
}
