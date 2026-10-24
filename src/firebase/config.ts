import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

/** Firebase config for project poll-maker-nibm */
const firebaseConfig = {
  projectId:         'poll-maker-nibm',
  appId:             '1:470887836901:web:43cd26ef7244fb61fb780c',
  storageBucket:     'poll-maker-nibm.firebasestorage.app',
  apiKey:            'AIzaSyB8tqirihfkxeyrpjyDqTkN4iYGdWo6Uyw',
  authDomain:        'poll-maker-nibm.firebaseapp.com',
  messagingSenderId: '470887836901',
};

/** Initialize Firebase app (safe for hot-reload) */
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const db = getFirestore(app);
export default app;
