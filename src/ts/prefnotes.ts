import {
  collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// 「好みノート」: 好き嫌いを判断して好みがわかったときに、その発見をメモして残す
export type Verdict = 'like' | 'dislike';

export interface PrefNote {
  id: string;
  verdict: Verdict;
  subject: string; // 何について（任意）
  text: string; // 好みのメモ
  createdAt: Timestamp | null;
}

export type NewPrefNote = Pick<PrefNote, 'verdict' | 'subject' | 'text'>;

export const MAX_PREF_SUBJECT = 40;
export const MAX_PREF_TEXT = 300;
export const MAX_PREF_NOTES = 300;

const safeVerdict = (v: unknown): Verdict => (v === 'dislike' ? 'dislike' : 'like');
const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function subscribePrefNotes(uid: string, callback: (notes: PrefNote[]) => void): () => void {
  const q = query(collection(db, 'users', uid, 'prefNotes'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const notes: PrefNote[] = [];
    snapshot.docs.forEach((d) => {
      const data = d.data();
      const text = clean(data.text, MAX_PREF_TEXT);
      if (!text) return;
      notes.push({
        id: d.id,
        verdict: safeVerdict(data.verdict),
        subject: clean(data.subject, MAX_PREF_SUBJECT),
        text,
        createdAt: data.createdAt ?? null,
      });
    });
    callback(notes);
  });
}

function sanitize(note: NewPrefNote): NewPrefNote {
  return {
    verdict: safeVerdict(note.verdict),
    subject: clean(note.subject, MAX_PREF_SUBJECT),
    text: clean(note.text, MAX_PREF_TEXT),
  };
}

export function addPrefNote(uid: string, note: NewPrefNote): Promise<void> {
  return addDoc(collection(db, 'users', uid, 'prefNotes'), {
    ...sanitize(note),
    createdAt: serverTimestamp(),
  }).then(() => undefined);
}

export function updatePrefNote(uid: string, id: string, note: NewPrefNote): Promise<void> {
  return updateDoc(doc(db, 'users', uid, 'prefNotes', id), {
    ...sanitize(note),
    updatedAt: serverTimestamp(),
  });
}

export function deletePrefNote(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(db, 'users', uid, 'prefNotes', id));
}
