import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

/** Firebase config loaded from environment variables */
const firebaseConfig = {
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
};

/** Initialize Firebase app (safe for hot-reload) */
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const db = getFirestore(app);
export default app;
