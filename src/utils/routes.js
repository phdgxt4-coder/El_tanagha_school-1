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

export function resolveAppRoute(pathname, routeHelpers, routePatterns = []) {
  const route = routeHelpers.fromUrlPath(pathname);
  if (route !== null) return route;
  return routePatterns.some(pattern => pattern.test(pathname)) ? pathname : null;
}

export function resolveAppLink(href, currentUrl, routeHelpers, routePatterns = []) {
  const current = new URL(currentUrl);
  const appRoot = new URL(routeHelpers.basePath, current.origin);
  const url = new URL(href, href.startsWith('./') ? appRoot : current);
  if (url.origin !== current.origin) return null;
  const route = resolveAppRoute(url.pathname, routeHelpers, routePatterns);
  if (route === null) return null;
  return { route, search: url.search, hash: url.hash };
}
