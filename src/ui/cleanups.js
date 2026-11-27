// Realtime listeners opened by dashboard widgets register a stop function here.
// app.js runs them all before every route render, so nothing keeps listening after sign-out or navigation.
const stops = new Set();
export function registerCleanup(stop) {
  stops.add(stop);
  return stop;
}
export function runCleanups() {
  for (const stop of [...stops]) {
    stops.delete(stop);
    try { stop(); } catch { /* listener already closed */ }
  }
}
export function pendingCleanups() { return stops.size; }
