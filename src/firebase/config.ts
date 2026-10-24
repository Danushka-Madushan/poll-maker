import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const getEnv = (): Record<string, string | undefined> => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env as unknown as Record<string, string | undefined>;
  }
  const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env || {};
};

const env = getEnv();

/** Firebase config loaded from environment variables */
const firebaseConfig = {
  projectId:         env.VITE_FIREBASE_PROJECT_ID || 'poll-maker-nibm',
  appId:             env.VITE_FIREBASE_APP_ID || '',
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET || '',
  apiKey:            env.VITE_FIREBASE_API_KEY || '',
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
};

/** Initialize Firebase app (safe for hot-reload) */
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const db = getFirestore(app);
export default app;
