/* ============================================================
   FIREBASE + CLOUDINARY CONFIGURATION
   ============================================================
   ⚠️ EDIT THIS FILE with your own project keys before deploying.

   WHERE TO FIND YOUR FIREBASE CONFIG:
   Firebase Console → Project Settings (gear icon) → General tab →
   "Your apps" → Web app → SDK setup and configuration → Config

   WHERE TO FIND YOUR CLOUDINARY DETAILS:
   Cloudinary Console → Dashboard → "Cloud name" (top of page)
   Cloudinary Console → Settings → Upload → Upload presets →
   Add an "Unsigned" preset → copy its name

   ⚠️ IMPORTANT: This project uses the Firebase COMPAT SDK
   (loaded via <script> tags in index.html / admin.html).
   Do NOT paste code here that uses "import" statements or
   modular functions like getAuth()/getFirestore()/initializeApp()
   without the "firebase." prefix — those belong to a different
   Firebase SDK style and will break this project.
   Only edit the values inside the quotes below. Do not add any
   other lines to this file.
   ============================================================ */

// ---------- 1. FIREBASE CONFIG (REPLACE WITH YOUR OWN) ----------
const firebaseConfig = {

  apiKey: "AIzaSyABqEtkZaogZF4qxDH_9kphjY7GC0eEFfg",

  authDomain: "monans-portfolio.firebaseapp.com",

  projectId: "monans-portfolio",

  storageBucket: "monans-portfolio.firebasestorage.app",

  messagingSenderId: "1021350987470",

  appId: "1:1021350987470:web:3a4ce7620e2584d1f4329f",
  measurementId: "G-W9CRGNW6SN"

};



// ---------- 2. CLOUDINARY CONFIG (REPLACE WITH YOUR OWN) ----------
const CLOUDINARY_CONFIG = {
  cloudName: "pteupsgl",       // e.g. "dxyzabc123"
  uploadPreset: "portfolio_upload"    // create an UNSIGNED preset in Cloudinary settings
};

/* ============================================================
   HOW TO CREATE AN UNSIGNED CLOUDINARY UPLOAD PRESET:
   1. Go to Cloudinary Console → Settings (gear icon) → Upload tab.
   2. Scroll to "Upload presets" → click "Add upload preset".
   3. Set "Signing Mode" to "Unsigned".
   4. (Optional) Set a folder name like "portfolio" to organize uploads.
   5. Save, then copy the preset name into CLOUDINARY_CONFIG.uploadPreset above.
   ============================================================ */

// ---------- DO NOT EDIT BELOW THIS LINE ----------
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();
