/* Session gate — بوابة الجلسة.
   Once an account is signed in AND active, the public brochure pages (home, subjects, news, …)
   stay out of reach until sign-out: the router sends every public route to /dashboard and the
   public menu hides (CSS keyed on html[data-session="active"]).
   The pure decisions live here so tests can cover them without a browser; app.js owns the wiring. */

/* The public brochure routes. /login/* stays reachable on purpose: pending and rejected teacher
   applicants read their status message there and sign out from it. /admin/* are account screens,
   not part of the public menu. */
const PUBLIC_PATTERN=/^\/(?:subjects|teachers|news|schedule|results|contact|privacy)(?:\/|$)/u;

export function isPublicRoute(path){
  if(typeof path!=='string'||!path.startsWith('/'))return false;
  return path==='/'||PUBLIC_PATTERN.test(path);
}

/* Only an active account locks the session. Pending, rejected, disabled or profile-less sessions
   keep the public site: they have no working dashboard, and the login page carries their status. */
export function shouldLockSession(status){
  return status?.status==='active'&&['student','teacher','parent','admin'].includes(status?.role);
}

/* Where a route request lands: anything public becomes the dashboard while the lock is on. */
export function gatedRoute(path,locked){
  return locked&&isPublicRoute(path)?'/dashboard':path;
}
