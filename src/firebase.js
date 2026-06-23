// Firebase 설정 (juhyun · london)
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD0kn2NX14jCiLVjfV_2K-nhoe2lRGKKvg",
  authDomain: "london-app-fa228.firebaseapp.com",
  projectId: "london-app-fa228",
  storageBucket: "london-app-fa228.firebasestorage.app",
  messagingSenderId: "611603607599",
  appId: "1:611603607599:web:1a37be4175341507efd6da",
};

export const FIREBASE_READY = !String(firebaseConfig.apiKey).startsWith("PASTE");
export const app = FIREBASE_READY ? initializeApp(firebaseConfig) : null;
export const auth = FIREBASE_READY ? getAuth(app) : null;
export const db = FIREBASE_READY ? getFirestore(app) : null;
export const provider = FIREBASE_READY ? new GoogleAuthProvider() : null;
