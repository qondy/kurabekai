import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// NOTE: Firebase の Web 設定は秘匿情報ではない（Firestore ルールが実質的な防御）。
// 他の姉妹アプリと同様、実プロジェクトの設定値を直接書き込む。
const firebaseConfig = {
  apiKey: 'AIzaSyDbYAhxM5S-Is5qPEpiBVEayDjIcV8gm1w',
  authDomain: 'kurabekai.firebaseapp.com',
  projectId: 'kurabekai',
  storageBucket: 'kurabekai.firebasestorage.app',
  messagingSenderId: '302934295513',
  appId: '1:302934295513:web:2798fabdc36ea1ef7dcfc8',
};

export const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
