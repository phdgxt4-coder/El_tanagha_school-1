import { getApp, getApps, initializeApp } from 'firebase/app';
import { firebaseConfig, firebaseConfigured } from './firebase-env.js';

export function getFirebaseApp() {
  if (!firebaseConfigured) throw new Error('firebase/not-configured');
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}
