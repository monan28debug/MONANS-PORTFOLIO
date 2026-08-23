const FIREBASE_CONFIG = {
  apiKey: "AIzaSyABqEtkZaogZF4qxDH_9kphjY7GC0eEFfg",
  authDomain: "monans-portfolio.firebaseapp.com",
  projectId: "monans-portfolio",
  storageBucket: "monans-portfolio.firebasestorage.app",
  messagingSenderId: "1021350987470",
  appId: "1:1021350987470:web:3a4ce7620e2584d1f4329f",
  measurementId: "G-W9CRGNW6SN"
};

const CLOUDINARY_CONFIG = {
  cloudName: "pteupsgl",
  uploadPreset: "portfolio_upload"
};

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();