# Monan — Personal Portfolio Website (Firebase Edition v3)

A professional, single-page portfolio built with **HTML, CSS, and vanilla JavaScript**, backed by **Firebase Authentication + Firestore** for real admin login and live, cross-device content management, plus **Cloudinary** for image uploads.

**v3 additions:** Admin-editable profile photo, editable Contact info (Email/LinkedIn/GitHub), new Hobbies and Achievements sections (fully admin-managed), select + bulk-delete for visitor history, and the contact form's demo "message sent" box removed.

---

## 1. File Structure

```
portfolio/
├── index.html               → Public single-page portfolio
├── style.css                 → Public site styles
├── script.js                  → Public site logic (reads live data from Firestore)
│
├── admin.html                 → Admin dashboard (separate page, Firebase Auth login)
├── admin.css                  → Admin dashboard styles
├── admin.js                   → Admin dashboard logic (Firestore CRUD + Cloudinary upload)
│
├── firebase-config.js         → ⚠️ EDIT THIS: your Firebase + Cloudinary keys
├── firestore-service.js       → Shared Firestore helper functions + default seed data
├── firestore.rules            → Security rules to paste into Firebase Console
│
├── assets/
│   ├── profile.jpg             (fallback default — Admin can override via Firestore)
│   ├── Monan-Resume.pdf
│   ├── projects/                (fallback local images if not using Cloudinary)
│   └── certificates/
│
└── README.md
```

---

## 2. One-Time Setup

### Step A — Firebase Auth + Firestore
1. **Firebase Console → Authentication → Sign-in method** → enable **Email/Password**.
2. **Firebase Console → Firestore Database** → create a database if you haven't.
3. **Firebase Console → Authentication → Users → Add user** → create your admin email/password.

### Step B — Paste Your Config
Open **`firebase-config.js`**. Replace only the values inside the quotes:

```js
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

⚠️ **Do not add `import` statements or modular-SDK calls** (`getAuth()`, `getFirestore()`, `initializeApp()` without the `firebase.` prefix) to this file — it will break the whole site. The file already ends with the three lines it needs:
```js
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();
```
Leave those exactly as they are.

### Step C — Apply Firestore Security Rules
Copy the entire contents of `firestore.rules` → **Firebase Console → Firestore Database → Rules tab** → paste → **Publish**.

### Step D — Cloudinary (Optional Image Uploads)
1. Sign up at [cloudinary.com](https://cloudinary.com).
2. Copy your **Cloud name** from the dashboard.
3. **Settings → Upload tab → Upload presets → Add upload preset** → Signing Mode = **Unsigned** → save → copy the preset name.
4. Paste both into `CLOUDINARY_CONFIG` in `firebase-config.js`.

If skipped, the **☁ Upload** buttons show a reminder alert — you can always paste an image URL/path directly instead.

---

## 3. How to Run the Website

```
cd portfolio
python3 -m http.server 8080
```
Visit `http://localhost:8080`. Avoid opening via `file://` directly — some Firebase Auth features misbehave without a real server origin.

---

## 4. What's Editable From Admin (Everything)

Log into `admin.html` with your Firebase email/password. Every panel below writes directly to Firestore and updates the public site immediately:

| Panel | Controls |
|---|---|
| **Overview** | Read-only stats: visitors, project/certificate views, resume downloads, IT Lab usage |
| **Visitors** | Search, filter, select individual rows + **Delete Selected**, or **Delete All** |
| **Section Visibility** | Show/hide any of the 13 public sections (nav links hide automatically too) |
| **Profile Photo** | Paste a URL/path or **☁ Upload** via Cloudinary — updates the Hero photo live |
| **Current Status** | Role, Company, Focus, Description shown on the "Currently" card |
| **Contact Info** | Email, LinkedIn (URL + display text), GitHub (URL + display text) — updates Hero social icons and Contact section |
| **Skills** | Add/edit/delete categories and individual skill items with level tags |
| **Hobbies** | Add/edit/delete hobby cards (icon, title, description) |
| **Achievements** | Add/edit/delete achievement entries (title, date, description) |
| **Journey** | Add/edit/delete/enable timeline stages |
| **Projects** | Add/edit/delete/enable, with Cloudinary upload for images |
| **Certificates** | Add/edit/delete/enable, categorized (School/College/Professional/Work), Cloudinary upload, PDF support |
| **IT Lab** | Master on/off toggle, plus add/edit/delete/enable individual scenarios |

Nothing is hardcoded in the HTML anymore except the initial placeholder text shown before Firestore data loads — every field above is fully admin-controlled.

---

## 5. Visitor Tracking & Deletion

The welcome popup asks only for a name. Activity events (Portfolio Visit, About Viewed, Projects Viewed, Certificate Viewed, Resume Download, IT Lab Opened, Contact Viewed, Sent a message) are written to Firestore in real time from any visitor, any device.

In the **Visitors** panel:
- Check individual rows and click **Delete Selected**, or
- Click **Delete All** to clear the entire log.

Both actions permanently delete the records from Firestore — this cannot be undone.

---

## 6. Contact Form Behavior

The contact form still validates (name + message required) and logs a "Sent a message via Contact form" activity entry, but **no longer shows an on-page "message sent" confirmation box** — the form simply clears silently after a valid submission, per your request. (Note: this demo form does not actually deliver the message anywhere yet — it only logs the activity. To receive real messages, connect a backend email service such as Firebase Cloud Functions + a mail API, or a service like Formspree.)

---

## 7. How to Edit Files and Push Changes via GitHub

### If this is your first time pushing this project:
```bash
cd portfolio
git init
git add .
git commit -m "Initial portfolio with Firebase v3"
git branch -M main
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

### To replace/update a file (e.g. after editing in VS Code):
1. Make your edit and **save the file** in VS Code (`Ctrl+S`).
2. Open a terminal in the project folder.
3. Stage and commit your change:
   ```bash
   git add .
   git commit -m "Describe what you changed, e.g. Update profile photo"
   git push
   ```
4. If your site is connected to **Vercel**, it detects the push automatically and redeploys within ~30–60 seconds. No extra steps needed on Vercel's side.
5. Hard-refresh your live URL (`Ctrl+Shift+R`) to bypass browser caching and see the change.

### To replace a single file directly on GitHub's website (no terminal):
1. Go to your repository on github.com.
2. Click on the file you want to replace (e.g. `firebase-config.js`).
3. Click the **pencil/edit icon** (top right of the file view).
4. Make your changes directly in the browser editor.
5. Scroll down, add a short commit message, click **Commit changes**.
6. Vercel (if connected) redeploys automatically, same as above.

### To upload a new file (like a real profile photo) via GitHub's website:
1. Go to your repository → navigate into the `assets` folder.
2. Click **Add file → Upload files**.
3. Drag in your photo — if it's named `profile.jpg` and you're uploading to the same `assets` folder, GitHub will ask to replace the existing one.
4. Commit the change.

---

## 8. Security Notes

- Admin login is real, backed by Firebase Authentication — safe to deploy publicly.
- **Firestore rules are what actually enforce security** — the rules in `firestore.rules` must be published, or your data isn't properly protected regardless of what the JavaScript does.
- Firebase web API keys are meant to be public; your Firestore *rules* are the real gatekeeper.
- Cloudinary **unsigned** upload presets let anyone with the preset name upload files. Fine for a personal portfolio; switch to signed uploads later if abuse becomes a concern.

---

## 9. Deploying with GitHub + Vercel (first-time setup)

1. Push to GitHub (see Section 7).
2. [vercel.com](https://vercel.com) → **New Project** → import your repo.
3. Framework preset: **Other** (static site, no build step).
4. Deploy → you get a live URL like `your-portfolio.vercel.app`.
5. **Important:** add that domain in **Firebase Console → Authentication → Settings → Authorized domains**, or Admin login will fail on the live site even though it works locally.

---

## 10. Troubleshooting

**Login button does nothing / console shows errors:**
- Open the browser console (F12) and check the exact error text.
- `Cannot use import statement` → your `firebase-config.js` has modular-SDK code in it (see Step B above) — replace with the compat-style version shown there.
- `auth is not defined` / `db is not defined` → same root cause; fix `firebase-config.js` first, these are downstream symptoms.
- `Missing or insufficient permissions` → your Firestore rules haven't been published yet (Step C).
- After any fix: **save the file, hard-refresh the browser** (`Ctrl+Shift+R`) — browsers cache `.js` files aggressively.

**Images not showing:**
- If using Cloudinary, confirm `cloudName` and `uploadPreset` are correctly set in `firebase-config.js`, and that the preset's Signing Mode is **Unsigned**.
- If using a manual path (`assets/...`), confirm the file actually exists at that path in your deployed repo.

---

Built with HTML5, CSS3, Vanilla JavaScript, Firebase (Auth + Firestore), and Cloudinary.
