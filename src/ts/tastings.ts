import {
  collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type Mode = 'score' | 'tournament';
export type Status = 'active' | 'done';

export interface Entry {
  id: string;
  name: string;
}

export interface Tasting {
  id: string;
  title: string;
  memo: string;
  mode: Mode;
  blind: boolean;
  revealed: boolean;
  status: Status;
  axes: string[];
  entries: Entry[];
  scores: Record<string, Record<string, number>>;
  results: Record<string, string>;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface TastingInput {
  title: string;
  memo: string;
  mode: Mode;
  blind: boolean;
  axes: string[];
  entries: Entry[];
}

// エントリーの色パレット（_variables.scss の $entry-colors と対応）
export const ENTRY_COLORS = [
  '#e2725b', '#3f7d6e', '#d9a441', '#5b7fa6',
  '#a5678e', '#7a8b3c', '#c77b4a', '#4f9d9d',
];

export function entryColor(index: number): string {
  return ENTRY_COLORS[index % ENTRY_COLORS.length];
}

export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function subscribeTastings(uid: string, callback: (list: Tasting[]) => void): () => void {
  const q = query(collection(db, 'users', uid, 'tastings'), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const list: Tasting[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title ?? '',
        memo: data.memo ?? '',
        mode: (data.mode === 'tournament' ? 'tournament' : 'score') as Mode,
        blind: data.blind === true,
        revealed: data.revealed === true,
        status: (data.status === 'done' ? 'done' : 'active') as Status,
        axes: Array.isArray(data.axes) ? data.axes : [],
        entries: Array.isArray(data.entries) ? data.entries : [],
        scores: data.scores && typeof data.scores === 'object' ? data.scores : {},
        results: data.results && typeof data.results === 'object' ? data.results : {},
        createdAt: data.createdAt ?? null,
        updatedAt: data.updatedAt ?? null,
      };
    });
    callback(list);
  });
}

export function addTasting(uid: string, input: TastingInput): Promise<string> {
  return addDoc(collection(db, 'users', uid, 'tastings'), {
    ...input,
    revealed: false,
    status: 'active',
    scores: {},
    results: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).then((ref) => ref.id);
}

export function updateTasting(
  uid: string,
  id: string,
  patch: Partial<Omit<Tasting, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<void> {
  return updateDoc(doc(db, 'users', uid, 'tastings', id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export function deleteTasting(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(db, 'users', uid, 'tastings', id));
}
