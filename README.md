# Monan — Personal Portfolio Website (Firebase Edition)

A professional, single-page portfolio built with **HTML, CSS, and vanilla JavaScript**, backed by **Firebase Authentication + Firestore** for real admin login and live, cross-device content management, plus **Cloudinary** for image uploads.

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
│   ├── profile.jpg
│   ├── Monan-Resume.pdf
│   ├── projects/               (fallback local images if not using Cloudinary)
│   └── certificates/
│
└── README.md
```

---

## 2. One-Time Setup — Do This Before Anything Else

### Step A — Firebase Project
You said you already have a Firebase project with Firestore + Authentication enabled. Confirm these two things are turned on:

1. **Firebase Console → Build → Authentication → Sign-in method** → enable **Email/Password**.
2. **Firebase Console → Build → Firestore Database** → create a database if you haven't (any region, start in **production mode** — we provide rules below).

### Step B — Create Your Admin Login
1. **Firebase Console → Authentication → Users tab → Add user**.
2. Enter the email + password you want to use to log into `admin.html`.
3. That's it — there's no separate "admin database record," Firebase Auth itself is the login system.

### Step C — Paste Your Config
Open **`firebase-config.js`** and replace the placeholder values with your real ones:

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

Find these at: **Firebase Console → Project Settings (gear icon) → General tab → "Your apps" → Web app → SDK setup and configuration**. If you haven't registered a Web App yet, click **"Add app" → Web (`</>`)** first.

### Step D — Apply Firestore Security Rules
1. Open `firestore.rules` in this project.
2. Copy the entire contents.
3. **Firebase Console → Firestore Database → Rules tab** → paste it in → **Publish**.

This makes portfolio content publicly readable (so visitors can see your site) while restricting all writes — and all visitor/activity data reads — to your logged-in admin account only.

### Step E — Cloudinary (Optional Image Uploads)
1. Sign up at [cloudinary.com](https://cloudinary.com) (free tier is enough).
2. Your **Cloud name** is shown at the top of the Cloudinary Console dashboard.
3. Go to **Settings (gear icon) → Upload tab → Upload presets → Add upload preset**.
4. Set **Signing Mode = Unsigned**, save, and copy the preset name.
5. Open `firebase-config.js` and fill in:
   ```js
   const CLOUDINARY_CONFIG = {
     cloudName: "your-cloud-name",
     uploadPreset: "your-unsigned-preset-name"
   };
   ```
If you skip this, the **"☁ Upload"** button in Admin will show an alert reminding you to configure it — you can always paste an image URL/path directly instead, which works with or without Cloudinary.

---

## 3. How to Run the Website

No build step required — just open `index.html` in a browser, or serve the folder locally:
```
cd portfolio
python3 -m http.server 8080
```
Then visit `http://localhost:8080`. Firebase/Firestore calls work fine from a local static server or from any real domain once deployed.

> Note: Firebase Authentication requires the page to be served over `http://localhost` or a real domain — opening `index.html`/`admin.html` directly via `file://` may block some Firebase features in certain browsers. Using a local server (as above) avoids this.

---

## 4. Logging Into Admin

1. Go to `admin.html`.
2. Enter the email/password you created in **Firebase Console → Authentication → Users**.
3. You're in. Log out anytime via the **Log Out** button — this calls Firebase's real `signOut()`, ending your session.

There is no hardcoded password anywhere in the code — authentication is fully handled by Firebase.

---

## 5. How Content Flows: Admin → Firestore → Public Site

Every piece of content — Skills, Journey stages, Projects, Certificates, IT Lab scenarios, current Status, and section Visibility toggles — lives in **Firestore**, not in the code or localStorage.

- **Admin dashboard** reads and writes directly to Firestore collections/documents.
- **Public site** (`index.html`) reads the same collections on page load and renders whatever it finds.
- Since Firestore is a real cloud database, changes you make in Admin are visible to **any visitor, on any device, anywhere** — this is the key upgrade from the earlier localStorage-only version.

**First time you open the public site:** if your Firestore project is empty (fresh project), `script.js` automatically seeds it with the same sensible defaults used previously (skill categories, the 6 journey stages, the 3 example projects, the 6 IT Lab scenarios). **Certificates are never auto-seeded** — only certificates you add via Admin appear, exactly as specified.

---

## 6. How to Add / Edit Content

All of this happens inside `admin.html` after logging in:

- **Current Status** panel → edit Role / Company / Focus / Description → Save.
- **Skills** panel → edit categories and skill items inline → click **Save All Skills** (skills save together, unlike other sections which save per-item).
- **Journey** panel → Add/Edit/Delete/Enable each timeline stage.
- **Projects** panel → Add/Edit/Delete/Enable each project card. Use the **☁ Upload** button next to the image field for Cloudinary, or paste any image URL/path.
- **Certificates** panel → same as Projects, plus a Category (School/College/Professional/Work) and optional Credential Link. PDFs are supported — paste the PDF URL and it will preview in an embedded viewer on the public site.
- **IT Lab** panel → master on/off toggle for the whole section, plus per-scenario Add/Edit/Delete/Enable.
- **Portfolio Visibility** panel → toggle any of the 11 public sections on/off; disabled sections and their nav links disappear from the public site immediately (next page load).

---

## 7. How Visitor Tracking Works Now (Real, Cross-Device)

When a new visitor opens the public site, the welcome popup asks only for their name (never email or other personal data). That name plus a stream of activity events (Portfolio Visit, About Viewed, Projects Viewed, Certificate Viewed, Resume Download, IT Lab Opened, Contact Viewed) are written to the `visitors` and `activity` Firestore collections.

Because this is now backed by a real cloud database (not localStorage), the **Admin Overview and Visitors panels show real activity from every visitor, on every device** — not just the admin's own browser like the earlier localStorage demo.

Per the Firestore rules, any visitor can *create* an activity/visitor record (so tracking works without requiring them to log in), but only the authenticated admin can *read or delete* that data — so it stays properly admin-only, and is never exposed on the public site.

---

## 8. Security Notes

- **Admin login is real** — backed by Firebase Authentication, not a hardcoded password in JavaScript. This is safe to deploy publicly.
- **Firestore rules matter.** The rules in `firestore.rules` are what actually enforce "only admin can edit / see visitor data" — the JavaScript code alone cannot enforce this, since browser code is always viewable by anyone. Make sure you've published these rules (Section 2, Step D) before treating the site as secure.
- **Never commit your real Firebase API keys as a security concern** — Firebase web API keys are meant to be public (they identify your project, not authenticate requests), but your Firestore *rules* are what actually protect your data. Don't skip publishing the rules file.
- **Cloudinary unsigned presets** allow anyone with the preset name to upload files to your account. This is normal for small personal projects, but if abuse becomes a concern, switch to signed uploads (requires a small server-side signing endpoint) — see Cloudinary's docs on signed uploads.

---

## 9. Deploying with GitHub + Vercel

1. Push this project to a GitHub repository:
   ```
   git init
   git add .
   git commit -m "Portfolio with Firebase integration"
   git branch -M main
   git remote add origin https://github.com/yourusername/your-repo.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo.
3. Framework preset: **"Other"** (static site, no build step).
4. Deploy. You'll get a live URL like `your-portfolio.vercel.app`.
5. **Important:** In **Firebase Console → Authentication → Settings → Authorized domains**, add your Vercel domain (e.g. `your-portfolio.vercel.app`) — Firebase Auth only works from domains you've explicitly authorized.

---

## 10. Customization Notes

- **Colors & theme:** CSS variables at the top of `style.css` (`:root` and `[data-theme="light"]`).
- **Fonts:** Poppins (headings) + Inter (body), via Google Fonts.
- **Social links:** update the `href`s on GitHub/LinkedIn/Email icons in `index.html`.
- **Resume/profile photo:** still simple static files in `assets/` — replace `assets/profile.jpg` and `assets/Monan-Resume.pdf` directly; no Firestore involved for these two.
- **Re-seeding default content:** if you ever want to reset Firestore back to the starter defaults, the easiest path is to delete the relevant collections in the Firebase Console (Firestore Database → click each collection → delete), then reload `index.html` once — it will auto re-seed Skills, Journey, Projects, and IT Lab from the built-in defaults in `firestore-service.js`.

---

Built with HTML5, CSS3, Vanilla JavaScript, Firebase (Auth + Firestore), and Cloudinary.
