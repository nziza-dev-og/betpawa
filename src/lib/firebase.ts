import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, runTransaction, increment, collection, addDoc, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";
// import { getAnalytics } from "firebase/analytics"; // Only if you need analytics

const firebaseConfig = {
  apiKey: "AIzaSyB3g_8MU5S5YpusvqnpPMAc8nLvTXsCEwE",
  authDomain: "betting-f1b33.firebaseapp.com",
  databaseURL: "https://betting-f1b33-default-rtdb.firebaseio.com",
  projectId: "betting-f1b33",
  storageBucket: "betting-f1b33.appspot.com", // Standard format, though user provided .firebasestorage.app
  messagingSenderId: "1038380074757",
  appId: "1:1038380074757:web:7f0681e9a9d1ecebf3d96c",
  measurementId: "G-C016W1WHDF"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
// const analytics = getAnalytics(app); // Only if you need analytics

export { 
  app, 
  db, 
  auth, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  runTransaction, 
  increment, 
  collection, 
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  signInAnonymously, 
  onAuthStateChanged, 
  type User 
};
