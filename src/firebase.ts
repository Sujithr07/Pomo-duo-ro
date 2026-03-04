import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, onDisconnect as fbOnDisconnect } from 'firebase/database';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app);

// Keep user logged in across sessions
setPersistence(auth, browserLocalPersistence).catch(() => {});

/** Set up presence tracking for a logged-in user */
export function setupPresence(uid: string) {
  const userStatusRef = ref(database, `users/${uid}/online`);
  const lastSeenRef = ref(database, `users/${uid}/lastSeen`);
  const currentRoomRef = ref(database, `users/${uid}/currentRoom`);
  const connectedRef = ref(database, '.info/connected');

  onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      set(userStatusRef, true);
      fbOnDisconnect(userStatusRef).set(false);
      fbOnDisconnect(lastSeenRef).set(Date.now());
      fbOnDisconnect(currentRoomRef).set(null);
    }
  });
}

/**
 * Register onDisconnect hooks so the user is removed from the room
 * if the browser crashes or they lose connectivity.
 */
export function setupRoomDisconnect(roomId: string, uid: string) {
  const userRoomRef = ref(database, `rooms/${roomId}/users/${uid}`);
  fbOnDisconnect(userRoomRef).remove();
}

/** Cancel room disconnect hooks (called when user explicitly leaves) */
export function cancelRoomDisconnect(roomId: string, uid: string) {
  const userRoomRef = ref(database, `rooms/${roomId}/users/${uid}`);
  fbOnDisconnect(userRoomRef).cancel();
}

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  type User,
};