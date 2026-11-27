import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { FavoritesState, NotificationPrefs } from './football';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Veuillez vérifier votre configuration Firebase : client hors ligne.');
    }
    return false;
  }
}

export function subscribeToAuth(cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(cred.user);
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function ensureUserProfile(user: User): Promise<void> {
  if (!user.emailVerified) return;
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    const displayName = (user.displayName || user.email || 'Supporter').slice(0, 100);
    const email = (user.email || '').slice(0, 160);
    if (!email) return;

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName,
        email,
        ...(user.photoURL ? { photoUrl: user.photoURL.slice(0, 500) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        {
          uid: user.uid,
          displayName,
          email,
          ...(user.photoURL ? { photoUrl: user.photoURL.slice(0, 500) } : {}),
          createdAt: snap.data().createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncUserPreferencesToFirestore(
  user: User,
  favorites: FavoritesState,
  notifPrefs: NotificationPrefs,
  fcmToken?: string
): Promise<void> {
  if (!user.emailVerified) return;
  await ensureUserProfile(user);
  const path = `users/${user.uid}/preferences/settings`;
  const ref = doc(db, 'users', user.uid, 'preferences', 'settings');
  try {
    const clubIds = favorites.clubs
      .map((c) => String(c.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128))
      .filter(Boolean)
      .slice(0, 50);
    const compIds = favorites.competitions
      .map((id) => String(id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128))
      .filter(Boolean)
      .slice(0, 50);

    await setDoc(
      ref,
      {
        userId: user.uid,
        favoriteClubIds: clubIds,
        favoriteCompetitionIds: compIds,
        notificationsEnabled: Boolean(notifPrefs.enabled),
        kickoffAlerts: Boolean(notifPrefs.kickoff),
        goalAlerts: Boolean(notifPrefs.goals),
        cardAlerts: Boolean(notifPrefs.redCards),
        halftimeFulltimeAlerts: Boolean(notifPrefs.halftimeFulltime),
        ...(fcmToken ? { fcmToken: fcmToken.slice(0, 512) } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadUserPreferencesFromFirestore(user: User): Promise<{
  favoriteClubIds: string[];
  favoriteCompetitionIds: string[];
  notifPrefs?: Partial<NotificationPrefs>;
} | null> {
  const path = `users/${user.uid}/preferences/settings`;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid, 'preferences', 'settings'));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      favoriteClubIds: Array.isArray(d.favoriteClubIds) ? d.favoriteClubIds : [],
      favoriteCompetitionIds: Array.isArray(d.favoriteCompetitionIds) ? d.favoriteCompetitionIds : [],
      notifPrefs: {
        enabled: typeof d.notificationsEnabled === 'boolean' ? d.notificationsEnabled : true,
        kickoff: typeof d.kickoffAlerts === 'boolean' ? d.kickoffAlerts : true,
        goals: typeof d.goalAlerts === 'boolean' ? d.goalAlerts : true,
        redCards: typeof d.cardAlerts === 'boolean' ? d.cardAlerts : true,
        halftimeFulltime: typeof d.halftimeFulltimeAlerts === 'boolean' ? d.halftimeFulltimeAlerts : true,
      },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export interface FirestoreLiveCacheMeta {
  provider: string;
  lastRealUpdateIso: string;
  matchCount?: number;
  liveCount?: number;
}

export function subscribeToLiveCacheMeta(
  onUpdate: (meta: FirestoreLiveCacheMeta | null) => void
): Unsubscribe {
  const path = 'live_cache/scoreboard';
  return onSnapshot(
    doc(db, 'live_cache', 'scoreboard'),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      const d = snap.data();
      onUpdate({
        provider: String(d.provider || 'Firebase Firestore'),
        lastRealUpdateIso: String(d.lastRealUpdateIso || ''),
        matchCount: typeof d.matchCount === 'number' ? d.matchCount : undefined,
        liveCount: typeof d.liveCount === 'number' ? d.liveCount : undefined,
      });
    },
    (error) => {
      // Do not crash app on network/transient error; log structured Firestore error info
      console.warn('Firestore live_cache listener warning:', error?.message || error);
      if (String(error?.message || '').toLowerCase().includes('permission')) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }
  );
}

export async function requestFcmWebToken(): Promise<{ token: string | null; reason?: string }> {
  try {
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    const supported = await isSupported();
    if (!supported) {
      return { token: null, reason: 'Navigateur non compatible avec Web Push FCM.' };
    }
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        return { token: null, reason: 'Permission de notification refusée.' };
      }
    }
    const messaging = getMessaging(app);
    const vapidKey = (import.meta as any)?.env?.VITE_FIREBASE_VAPID_KEY || undefined;
    const swReg =
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? await navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => undefined)
        : undefined;
    const token = await getToken(messaging, {
      ...(vapidKey ? { vapidKey } : {}),
      ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
    }).catch(() => '');
    return token
      ? { token }
      : { token: null, reason: 'Jeton FCM web non généré (clé VAPID optionnelle sur Firebase Console).' };
  } catch {
    return { token: null, reason: 'Service FCM indisponible dans cet environnement.' };
  }
}
