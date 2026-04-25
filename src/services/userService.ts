import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { collection, doc, setDoc, getDocs, writeBatch, query, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  isPinned?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const signIn = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
};

export const logout = async () => {
  await signOut(auth);
};

export const backupNotes = async (userId: string, notes: Note[]) => {
  const backupRef = doc(db, 'backups', userId);
  const notesCollection = collection(db, 'backups', userId, 'notes');
  
  // Firebase limits batches to 500 operations. We use 450 to be safe.
  const CHUNK_SIZE = 450;
  
  try {
    for (let i = 0; i < notes.length; i += CHUNK_SIZE) {
      const chunk = notes.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      
      if (i === 0) {
        batch.set(backupRef, { lastBackupAt: new Date().toISOString() });
      }

      chunk.forEach(note => {
        const noteRef = doc(notesCollection, note.id);
        batch.set(noteRef, { ...note, userId });
      });

      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `backups/${userId}`);
  }
};

export const restoreNotes = async (userId: string): Promise<Note[]> => {
  const notesCollection = collection(db, 'backups', userId, 'notes');
  try {
    const snapshot = await getDocs(notesCollection);
    return snapshot.docs.map(doc => doc.data() as Note);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `backups/${userId}/notes`);
    return [];
  }
};

export const getLastBackupDate = async (userId: string): Promise<string | null> => {
  const backupRef = doc(db, 'backups', userId);
  try {
    const docSnap = await getDoc(backupRef);
    if (docSnap.exists()) {
      return docSnap.data().lastBackupAt;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `backups/${userId}`);
    return null;
  }
};
