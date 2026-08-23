/* ============================================================
   FIRESTORE DATA SERVICE
   Shared helper functions for reading/writing portfolio data.
   Used by both script.js (public site) and admin.js (dashboard).

   FIRESTORE COLLECTION STRUCTURE:
   portfolio/
     ├── settings/main        (section visibility toggles)
     ├── settings/status       (current status card)
     ├── settings/itlab_meta   (IT Lab master enable/disable)
   skills/          (one doc per category: {category, items[]})
   journey/         (one doc per timeline stage)
   projects/        (one doc per project)
   certificates/    (one doc per certificate)
   itlab/           (one doc per troubleshooting scenario)
   visitors/        (one doc per visitor name entry)
   activity/        (one doc per logged activity event)
   ============================================================ */

const FS = {
  SETTINGS_DOC: db.collection('portfolio').doc('settings_main'),
  STATUS_DOC: db.collection('portfolio').doc('settings_status'),
  ITLAB_META_DOC: db.collection('portfolio').doc('settings_itlab_meta'),
  SKILLS: db.collection('skills'),
  JOURNEY: db.collection('journey'),
  PROJECTS: db.collection('projects'),
  CERTS: db.collection('certificates'),
  ITLAB: db.collection('itlab'),
  VISITORS: db.collection('visitors'),
  ACTIVITY: db.collection('activity')
};

/* ---------- Generic doc-collection helpers ---------- */

/** Fetch all docs from a collection, returning array of {id, ...data} */
async function fsGetAll(collectionRef, orderField) {
  try {
    let query = collectionRef;
    if (orderField) query = query.orderBy(orderField);
    const snap = await query.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Firestore read error:', e);
    return [];
  }
}

/** Add a new doc with auto ID, returns the new id */
async function fsAdd(collectionRef, data) {
  const ref = await collectionRef.add(data);
  return ref.id;
}

/** Update/overwrite a doc by id */
async function fsSet(collectionRef, id, data) {
  await collectionRef.doc(id).set(data, { merge: true });
}

/** Delete a doc by id */
async function fsDelete(collectionRef, id) {
  await collectionRef.doc(id).delete();
}

/** Get a single settings-style doc, with fallback default if missing */
async function fsGetDoc(docRef, fallback) {
  try {
    const snap = await docRef.get();
    if (!snap.exists) return fallback;
    return { ...fallback, ...snap.data() };
  } catch (e) {
    console.error('Firestore read error:', e);
    return fallback;
  }
}

/** Set a single settings-style doc (merge) */
async function fsSetDoc(docRef, data) {
  await docRef.set(data, { merge: true });
}

/* ============================================================
   SEEDING DEFAULT DATA
   Run once (from Admin, via a "Seed Default Data" action, or
   automatically on first public load if collections are empty)
   so a brand-new Firestore project isn't blank.
   ============================================================ */

const DEFAULT_SETTINGS = {
  home: true, about: true, skills: true, education: true, journey: true,
  projects: true, certificates: true, itlab: true, resume: true, contact: true, final: true
};

const DEFAULT_STATUS = {
  role: 'Support Engineer',
  company: 'Company Name',
  focus: 'IT Support • Networking',
  description: 'Currently working in IT Support'
};

const DEFAULT_SKILLS = [
  { category: 'Frontend', items: [
    { name: 'HTML5', level: 'Working Knowledge' },
    { name: 'CSS3', level: 'Working Knowledge' },
    { name: 'JavaScript', level: 'Intermediate' }
  ]},
  { category: 'Database', items: [
    { name: 'SQL', level: 'Intermediate' },
    { name: 'MySQL', level: 'Familiar' }
  ]},
  { category: 'IT Support', items: [
    { name: 'Windows', level: 'Working Knowledge' },
    { name: 'Hardware Troubleshooting', level: 'Working Knowledge' },
    { name: 'Software Troubleshooting', level: 'Working Knowledge' }
  ]},
  { category: 'Networking', items: [
    { name: 'Networking Basics', level: 'Intermediate' },
    { name: 'TCP/IP', level: 'Intermediate' },
    { name: 'DNS', level: 'Familiar' },
    { name: 'DHCP', level: 'Familiar' },
    { name: 'CCNA', level: 'Learning' }
  ]},
  { category: 'Tools', items: [
    { name: 'Git', level: 'Working Knowledge' },
    { name: 'GitHub', level: 'Working Knowledge' },
    { name: 'VS Code', level: 'Working Knowledge' },
    { name: 'MS Excel', level: 'Familiar' }
  ]}
];

const DEFAULT_JOURNEY = [
  { title: 'School', year: '', category: 'School', enabled: true, order: 1,
    description: 'Foundational education background.',
    detail: { summary: 'To be updated by Admin.' } },
  { title: 'College', year: '2023 – 2026', category: 'College', enabled: true, order: 2,
    description: 'BSc Computer Science, SASTRA Deemed to be University.',
    detail: { summary: 'Core CS fundamentals, web development, networking basics. Relevant subjects: Data Structures, Computer Networks, DBMS, Operating Systems.' } },
  { title: 'Professional Learning', year: '', category: 'Professional', enabled: true, order: 3,
    description: 'Self-driven learning in SQL, networking and IT fundamentals.',
    detail: { summary: 'Continuously learning SQL, Excel, Networking, CCNA, Linux and Cybersecurity fundamentals through self-study and practice.' } },
  { title: 'Projects', year: '', category: 'Projects', enabled: true, order: 4,
    description: 'Applying skills through hands-on personal projects.',
    detail: { summary: 'Built frontend and IT-support oriented projects to apply and demonstrate practical skills. See the Projects section for details.' } },
  { title: 'Current Work', year: '', category: 'Work', enabled: true, order: 5,
    description: 'Currently working in IT Support.',
    detail: { summary: 'Presently focused on IT Support and Networking responsibilities.' } },
  { title: 'Future Goal', year: '', category: 'Future', enabled: true, order: 6,
    description: 'Growing into a well-rounded IT professional.',
    detail: { summary: 'Aiming to deepen networking expertise (CCNA) and grow into a well-rounded IT professional bridging support, networking and development.' } }
];

const DEFAULT_PROJECTS = [
  { title: 'Nilan Fashion', category: 'E-commerce Website',
    description: "A modern fashion e-commerce project designed to provide a simple and user-friendly shopping experience.",
    features: ['Product catalog browsing', 'Cart & checkout flow', 'Firebase-backed data'],
    technologies: ['React', 'HTML', 'CSS', 'Firebase'],
    image: 'assets/projects/nilan-fashion.jpg',
    github: 'https://github.com/yourusername/nilan-fashion', liveDemo: '#', enabled: true },
  { title: 'IT Help Desk Troubleshooting', category: 'Interactive IT Project',
    description: "An interactive website demonstrating troubleshooting approaches for common computer and networking problems.",
    features: ['Scenario-based troubleshooting', 'Step-by-step diagnostic flow', 'Solution reveal interaction'],
    technologies: ['HTML', 'CSS', 'JavaScript'],
    image: 'assets/projects/it-helpdesk.jpg',
    github: 'https://github.com/yourusername/it-helpdesk', liveDemo: '#', enabled: true },
  { title: 'Network Monitoring Dashboard', category: 'Frontend Dashboard',
    description: "A frontend dashboard concept for displaying network devices, connectivity and system information.",
    features: ['Device status visualization', 'Connectivity overview', 'Clean dashboard UI'],
    technologies: ['HTML', 'CSS', 'JavaScript'],
    image: 'assets/projects/network-dashboard.jpg',
    github: 'https://github.com/yourusername/network-dashboard', liveDemo: '#', enabled: true }
];

const DEFAULT_ITLAB = [
  { title: 'No Internet Connection', enabled: true,
    problem: 'The computer shows no internet access at all.',
    cause: 'Possible causes include a disconnected cable, disabled adapter, router issue, or ISP outage.',
    steps: ['Check physical cable / Wi-Fi connection', 'Restart the router/modem', 'Check adapter is enabled in OS settings', 'Run built-in network troubleshooter', 'Test with another device on same network'],
    solution: 'Confirm the adapter is enabled and the router is online; reconnect or restart hardware as needed. If the issue persists across devices, contact the ISP.' },
  { title: 'DNS Problem', enabled: true,
    problem: "Websites don't load by name, but IP addresses work fine.",
    cause: 'Likely a DNS server issue — misconfigured DNS, ISP DNS outage, or cached bad records.',
    steps: ['Ping a known IP address to confirm connectivity', 'Try a different DNS server (e.g. 8.8.8.8)', 'Flush local DNS cache', 'Test a different browser/device'],
    solution: 'Switch to a reliable public DNS server and flush the DNS cache; this resolves most name-resolution issues.' },
  { title: 'Computer Not Booting', enabled: true,
    problem: 'The computer does not power on or fails to boot to the OS.',
    cause: 'Could be power supply failure, loose RAM/cables, corrupted boot files, or hardware fault.',
    steps: ['Check power cable and outlet', 'Listen for beep codes / fan spin', 'Reseat RAM and cables', 'Boot into safe mode or recovery', 'Check for boot device priority in BIOS'],
    solution: 'Isolate the fault by testing power and hardware first, then move to software/boot-repair steps if hardware checks out.' },
  { title: 'Slow Computer', enabled: true,
    problem: 'The system runs noticeably slower than usual.',
    cause: 'Could be high CPU/RAM usage, disk near capacity, malware, or too many startup programs.',
    steps: ['Open Task Manager and check resource usage', 'Disable unnecessary startup programs', 'Run a malware scan', 'Free up disk space', 'Check for pending OS/driver updates'],
    solution: 'Identify the resource bottleneck via Task Manager, then clean up startup items, storage, and run a security scan.' },
  { title: 'Wi-Fi Connected But No Internet', enabled: true,
    problem: 'Wi-Fi is connected but websites are not opening.',
    cause: 'Could be an IP conflict, DNS failure, or router-to-ISP connectivity issue.',
    steps: ['Check IP configuration (ipconfig/ifconfig)', 'Ping default gateway', 'Test DNS resolution', 'Try another website', 'Flush DNS if required'],
    solution: 'Confirm you have a valid IP and can reach the gateway; if DNS fails specifically, flushing DNS or changing DNS server usually resolves it.' },
  { title: 'IP Address Problem', enabled: true,
    problem: 'Device shows an invalid or conflicting IP address (e.g. 169.254.x.x).',
    cause: 'DHCP failure, IP conflict with another device, or misconfigured static IP.',
    steps: ['Release and renew IP address', 'Check DHCP server status on router', 'Confirm no static IP conflicts', 'Restart network adapter'],
    solution: 'Releasing/renewing the IP via DHCP resolves most cases; if conflicts persist, assign addresses carefully or check the DHCP scope.' }
];

/** Seed Firestore with default content — only runs if collections are empty.
 *  Safe to call from both public site (read-only check) and Admin (explicit button). */
async function seedFirestoreIfEmpty() {
  try {
    const skillsSnap = await FS.SKILLS.limit(1).get();
    if (skillsSnap.empty) {
      for (const cat of DEFAULT_SKILLS) await FS.SKILLS.add(cat);
    }
    const journeySnap = await FS.JOURNEY.limit(1).get();
    if (journeySnap.empty) {
      for (const item of DEFAULT_JOURNEY) await FS.JOURNEY.add(item);
    }
    const projectsSnap = await FS.PROJECTS.limit(1).get();
    if (projectsSnap.empty) {
      for (const p of DEFAULT_PROJECTS) await FS.PROJECTS.add(p);
    }
    const itlabSnap = await FS.ITLAB.limit(1).get();
    if (itlabSnap.empty) {
      for (const s of DEFAULT_ITLAB) await FS.ITLAB.add(s);
    }
    const settingsSnap = await FS.SETTINGS_DOC.get();
    if (!settingsSnap.exists) await FS.SETTINGS_DOC.set(DEFAULT_SETTINGS);
    const statusSnap = await FS.STATUS_DOC.get();
    if (!statusSnap.exists) await FS.STATUS_DOC.set(DEFAULT_STATUS);
    const itlabMetaSnap = await FS.ITLAB_META_DOC.get();
    if (!itlabMetaSnap.exists) await FS.ITLAB_META_DOC.set({ enabled: true });
    // Certificates intentionally NOT seeded — only Admin-uploaded certs should appear.
  } catch (e) {
    console.error('Seeding error (check Firestore rules / config):', e);
  }
}
