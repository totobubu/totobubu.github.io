// src/firebase.js
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    addDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: 'AIzaSyBdTs2law6oJFyjc105KRFh-dPkkybt1Fw',
    authDomain: 'totobubu-tracker.firebaseapp.com',
    projectId: 'totobubu-tracker',
    storageBucket: 'totobubu-tracker.firebasestorage.app',
    messagingSenderId: '453207023927',
    appId: '1:453207023927:web:fc9c59801e21ed7a667ab2',
    measurementId: 'G-YG5NYLSQL5',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export {
    auth,
    analytics,
    db,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    collection,
    addDoc,
    serverTimestamp,
};
