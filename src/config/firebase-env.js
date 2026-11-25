const env = import.meta.env ?? {};
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

export const firebaseConfigured = Object.values(config).every(
  value => typeof value === 'string' && value.trim().length > 0
);
export const firebaseConfig = Object.freeze({ ...config });
export const functionsRegion = env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1';
