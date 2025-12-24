// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDGyAvudD29KVysZC85SHAl81zgZuZ9bBo",
  authDomain: "rmbbusiness-92c73.firebaseapp.com",
  projectId: "rmbbusiness-92c73",
  storageBucket: "rmbbusiness-92c73.firebasestorage.app",
  messagingSenderId: "1033450127434",
  appId: "1:1033450127434:web:c914cdebaa87da287826b3",
  measurementId: "G-YRL4KV8PYB"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
