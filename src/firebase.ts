import { initializeApp } from 'firebase/app';
import {
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  initializeAuth,
  inMemoryPersistence,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Silence internal SDK connection retry noise in restricted environments
setLogLevel('silent');

// Clean up any stale IndexedDB auth token cache that might trigger securetoken API errors on boot
if (typeof window !== 'undefined' && 'indexedDB' in window) {
  try {
    window.indexedDB.deleteDatabase('firebaseLocalStorageDb');
  } catch {
    // Ignore if blocked
  }
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = initializeAuth(app, {
  persistence: inMemoryPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const googleProvider = new GoogleAuthProvider();

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
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.warn('Firestore operating in local fallback mode while token service propagates.');
    }
    return false;
  }
}

testConnection();
