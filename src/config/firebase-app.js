import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { firebaseConfig, firebaseConfigured } from './firebase-env.js';
import { APP_CHECK_SITE_KEY } from './app-check.js';

export function getFirebaseApp() {
  if (!firebaseConfigured) throw new Error('firebase/not-configured');
  if (getApps().length) return getApp();
  const app = initializeApp(firebaseConfig);
  if (APP_CHECK_SITE_KEY && typeof window !== 'undefined') {
    try { initializeAppCheck(app, { provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY), isTokenAutoRefreshEnabled: true }); } catch { /* يستمر التطبيق بدون App Check */ }
  }
  return app;
}
