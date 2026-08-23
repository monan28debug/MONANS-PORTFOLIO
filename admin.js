/* ============================================================
   MONAN — ADMIN DASHBOARD SCRIPT (Firebase / Firestore edition)
   Real authentication via Firebase Auth.
   All content read/written directly to/from Firestore.
   Image uploads via Cloudinary unsigned upload widget (optional —
   a plain URL/path field always works as a fallback).
   ============================================================ */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function showToast(msg) {
  const toast = document.getElementById('adminToast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

/* ============================================================
   FIREBASE AUTH
   ============================================================ */
function initAuth() {
  const loginScreen = document.getElementById('loginScreen');
  const adminApp = document.getElementById('adminApp');

  auth.onAuthStateChanged((user) => {
    if (user) {
      loginScreen.style.display = 'none';
      adminApp.style.display = 'flex';
      document.getElementById('loggedInAs').textContent = `Logged in as ${user.email}`;
      initDashboard();
    } else {
      loginScreen.style.display = 'flex';
      adminApp.style.display = 'none';
    }
  });

  document.getElementById('loginBtn').addEventListener('click', attemptLogin);
  document.getElementById('loginPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptLogin(); });

  function attemptLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = '';

    if (!email || !pass) {
      errorEl.textContent = 'Please enter both email and password.';
      return;
    }

    auth.signInWithEmailAndPassword(email, pass)
      .catch((error) => {
        console.error('Login error:', error);
        errorEl.textContent = friendlyAuthError(error.code);
      });
  }

  function friendlyAuthError(code) {
    switch (code) {
      case 'auth/invalid-email': return 'That email address looks invalid.';
      case 'auth/user-not-found': return 'No admin account found with that email.';
      case 'auth/wrong-password': return 'Incorrect password.';
      case 'auth/invalid-credential': return 'Incorrect email or password.';
      case 'auth/too-many-requests': return 'Too many attempts. Please wait and try again.';
      default: return 'Login failed. Check your Firebase config and credentials.';
    }
  }
}

function logout() {
  auth.signOut();
}

/* ============================================================
   DASHBOARD INIT — sidebar nav + load all data once
   ============================================================ */
let DASH = {
  settings: {}, status: {}, skills: [], journey: [], projects: [], certificates: [], itlab: [], itlabEnabled: true,
  activity: []
};

async function initDashboard() {
  document.getElementById('logoutBtn').addEventListener('click', logout);

  const links = document.querySelectorAll('.sidebar-link');
  const panels = document.querySelectorAll('.panel');
  const title = document.getElementById('panelTitle');
  const titles = {
    overview: 'Overview', visitors: 'Who Visited My Portfolio', visibility: 'Portfolio Visibility',
    status: 'Current Status', skills: 'Skills Management', journey: 'Journey Management',
    projects: 'Projects Management', certificates: 'Certificate Management', itlab: 'IT Troubleshooting Lab'
  };

  links.forEach(link => {
    link.addEventListener('click', () => {
      const panel = link.getAttribute('data-panel');
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      panels.forEach(p => p.classList.remove('active'));
      document.getElementById('panel-' + panel).classList.add('active');
      title.textContent = titles[panel] || panel;
      document.querySelector('.admin-sidebar').classList.remove('open');
    });
  });

  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.querySelector('.admin-sidebar').classList.toggle('open');
  });

  setupEditModal();

  await refreshAllData();

  setupVisitorFilters();
  document.getElementById('refreshActivityBtn').addEventListener('click', async () => {
    DASH.activity = await fsGetAll(FS.ACTIVITY);
    renderOverview();
    renderVisitorsTable();
    showToast('Refreshed');
  });

  document.getElementById('addSkillCategoryBtn').onclick = addSkillCategory;
  document.getElementById('saveSkillsBtn').onclick = saveAllSkills;
  document.getElementById('addJourneyBtn').onclick = () => openJourneyEditModal(null);
  document.getElementById('addProjectBtn').onclick = () => openProjectEditModal(null);
  document.getElementById('addCertBtn').onclick = () => openCertEditModal(null);
  document.getElementById('addScenarioBtn').onclick = () => openScenarioEditModal(null);

  document.getElementById('saveStatusBtn').addEventListener('click', saveStatus);
  document.getElementById('itlabMasterToggle').addEventListener('change', async (e) => {
    await fsSetDoc(FS.ITLAB_META_DOC, { enabled: e.target.checked });
    DASH.itlabEnabled = e.target.checked;
    showToast('IT Lab visibility updated');
  });
}

async function refreshAllData() {
  document.getElementById('overviewLoading').style.display = 'flex';

  const [settings, status, skills, journey, projects, certificates, itlab, itlabMeta, activity] = await Promise.all([
    fsGetDoc(FS.SETTINGS_DOC, DEFAULT_SETTINGS),
    fsGetDoc(FS.STATUS_DOC, DEFAULT_STATUS),
    fsGetAll(FS.SKILLS),
    fsGetAll(FS.JOURNEY, 'order'),
    fsGetAll(FS.PROJECTS),
    fsGetAll(FS.CERTS),
    fsGetAll(FS.ITLAB),
    fsGetDoc(FS.ITLAB_META_DOC, { enabled: true }),
    fsGetAll(FS.ACTIVITY)
  ]);

  DASH.settings = settings;
  DASH.status = status;
  DASH.skills = skills;
  DASH.journey = journey;
  DASH.projects = projects;
  DASH.certificates = certificates;
  DASH.itlab = itlab;
  DASH.itlabEnabled = itlabMeta.enabled !== false;
  DASH.activity = activity;

  document.getElementById('overviewLoading').style.display = 'none';

  renderOverview();
  renderVisitorsTable();
  renderVisibilityToggles();
  renderStatusForm();
  renderSkillsAdmin();
  renderJourneyAdmin();
  renderProjectsAdmin();
  renderCertsAdmin();
  renderITLabAdmin();
}

/* ============================================================
   OVERVIEW / ANALYTICS
   ============================================================ */
function renderOverview() {
  const activity = DASH.activity;
  const uniqueVisitors = new Set(activity.map(a => a.name)).size;

  document.getElementById('statTotalVisitors').textContent = uniqueVisitors;
  document.getElementById('statProjectViews').textContent = activity.filter(a => (a.activity||'').toLowerCase().includes('project')).length;
  document.getElementById('statCertViews').textContent = activity.filter(a => (a.activity||'').toLowerCase().includes('certificate')).length;
  document.getElementById('statResumeDownloads').textContent = activity.filter(a => (a.activity||'').toLowerCase().includes('resume')).length;
  document.getElementById('statITLabUsage').textContent = activity.filter(a => (a.activity||'').toLowerCase().includes('it lab')).length;
}

/* ============================================================
   VISITORS TABLE
   ============================================================ */
let visitorSearchTerm = '';
let visitorFilterType = 'all';

function formatTimestamp(entry) {
  let d;
  if (entry.timestamp && entry.timestamp.toDate) d = entry.timestamp.toDate();
  else if (entry.clientTime) d = new Date(entry.clientTime);
  else return { date: '—', time: '—' };
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  };
}

function renderVisitorsTable() {
  const tbody = document.getElementById('visitorTableBody');
  let list = DASH.activity.slice().sort((a, b) => {
    const ta = a.timestamp && a.timestamp.toMillis ? a.timestamp.toMillis() : new Date(a.clientTime||0).getTime();
    const tb = b.timestamp && b.timestamp.toMillis ? b.timestamp.toMillis() : new Date(b.clientTime||0).getTime();
    return tb - ta;
  });

  if (visitorSearchTerm) list = list.filter(a => (a.name||'').toLowerCase().includes(visitorSearchTerm.toLowerCase()));
  if (visitorFilterType !== 'all') list = list.filter(a => (a.activity||'').toLowerCase().includes(visitorFilterType));

  if (!list.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4">No visitor activity recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(a => {
    const { date, time } = formatTimestamp(a);
    return `<tr><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.activity)}</td><td>${date}</td><td>${time}</td></tr>`;
  }).join('');
}

function setupVisitorFilters() {
  document.getElementById('visitorSearch').addEventListener('input', (e) => { visitorSearchTerm = e.target.value; renderVisitorsTable(); });
  document.getElementById('visitorFilter').addEventListener('change', (e) => { visitorFilterType = e.target.value; renderVisitorsTable(); });
}

/* ============================================================
   SECTION VISIBILITY TOGGLES
   ============================================================ */
function renderVisibilityToggles() {
  const settings = DASH.settings;
  const container = document.getElementById('visibilityList');
  const labels = {
    home: 'Home', about: 'About', skills: 'Skills', education: 'Education',
    journey: 'Journey', projects: 'Projects', certificates: 'Certificates',
    itlab: 'IT Lab', resume: 'Resume', contact: 'Contact', final: 'Final Section'
  };

  container.innerHTML = Object.keys(labels).map(key => `
    <div class="toggle-row">
      <span>${labels[key]}</span>
      <label class="switch"><input type="checkbox" data-key="${key}" ${settings[key] !== false ? 'checked' : ''}><span class="slider"></span></label>
    </div>
  `).join('');

  container.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', async () => {
      const key = input.getAttribute('data-key');
      DASH.settings[key] = input.checked;
      await fsSetDoc(FS.SETTINGS_DOC, { [key]: input.checked });
      showToast('Visibility updated');
    });
  });
}

/* ============================================================
   CURRENT STATUS FORM
   ============================================================ */
function renderStatusForm() {
  const status = DASH.status;
  document.getElementById('statusRoleInput').value = status.role || '';
  document.getElementById('statusCompanyInput').value = status.company || '';
  document.getElementById('statusFocusInput').value = status.focus || '';
  document.getElementById('statusDescInput').value = status.description || '';
}

async function saveStatus() {
  const newStatus = {
    role: document.getElementById('statusRoleInput').value.trim(),
    company: document.getElementById('statusCompanyInput').value.trim(),
    focus: document.getElementById('statusFocusInput').value.trim(),
    description: document.getElementById('statusDescInput').value.trim()
  };
  await fsSetDoc(FS.STATUS_DOC, newStatus);
  DASH.status = newStatus;
  const confirmEl = document.getElementById('statusSaveConfirm');
  confirmEl.classList.add('show');
  setTimeout(() => confirmEl.classList.remove('show'), 1800);
  showToast('Current status saved');
}

/* ============================================================
   SKILLS ADMIN
   (Skills are stored as one Firestore doc per category)
   ============================================================ */
function renderSkillsAdmin() {
  const skills = DASH.skills;
  const container = document.getElementById('skillsAdminList');

  container.innerHTML = skills.map((cat) => `
    <div class="admin-item-card" data-id="${cat.id}">
      <div class="admin-item-head">
        <input type="text" class="cat-name-input" value="${escapeHtml(cat.category)}" style="background:var(--bg-secondary);border:1px solid var(--border-color);color:var(--text-primary);padding:8px 10px;border-radius:6px;font-weight:600;">
        <div class="admin-item-actions">
          <button class="btn btn-outline btn-small add-item-btn">+ Skill</button>
          <button class="btn btn-danger btn-small del-cat-btn">Delete Category</button>
        </div>
      </div>
      <div class="skill-items-edit" style="margin-top:14px;display:flex;flex-direction:column;gap:8px;">
        ${(cat.items || []).map((item, ii) => `
          <div class="admin-item-row" data-ii="${ii}">
            <input type="text" class="skill-name-input" value="${escapeHtml(item.name)}" placeholder="Skill name" style="flex:1;padding:8px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);">
            <select class="skill-level-input" style="padding:8px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);">
              ${['Learning','Familiar','Intermediate','Working Knowledge'].map(l => `<option ${item.level === l ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            <button class="btn btn-danger btn-small del-skill-btn">✕</button>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.del-cat-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const card = e.target.closest('.admin-item-card');
      const id = card.getAttribute('data-id');
      await fsDelete(FS.SKILLS, id);
      DASH.skills = DASH.skills.filter(c => c.id !== id);
      renderSkillsAdmin();
      showToast('Category deleted');
    });
  });

  container.querySelectorAll('.add-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.admin-item-card');
      const id = card.getAttribute('data-id');
      const cat = DASH.skills.find(c => c.id === id);
      cat.items.push({ name: 'New Skill', level: 'Learning' });
      renderSkillsAdmin();
    });
  });

  container.querySelectorAll('.del-skill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.admin-item-card');
      const id = card.getAttribute('data-id');
      const ii = parseInt(e.target.closest('.admin-item-row').getAttribute('data-ii'));
      const cat = DASH.skills.find(c => c.id === id);
      cat.items.splice(ii, 1);
      renderSkillsAdmin();
    });
  });
}

function addSkillCategory() {
  // Adds locally; will be persisted to Firestore on "Save All Skills"
  DASH.skills.push({ id: null, category: 'New Category', items: [] });
  renderSkillsAdmin();
}

async function saveAllSkills() {
  const container = document.getElementById('skillsAdminList');
  const cards = container.querySelectorAll('.admin-item-card');

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const id = card.getAttribute('data-id');
    const cat = DASH.skills[i];
    cat.category = card.querySelector('.cat-name-input').value.trim();
    card.querySelectorAll('.admin-item-row').forEach((row, ii) => {
      cat.items[ii].name = row.querySelector('.skill-name-input').value.trim();
      cat.items[ii].level = row.querySelector('.skill-level-input').value;
    });

    const data = { category: cat.category, items: cat.items };
    if (id === 'null' || !id) {
      const newId = await fsAdd(FS.SKILLS, data);
      cat.id = newId;
    } else {
      await fsSet(FS.SKILLS, id, data);
    }
  }

  renderSkillsAdmin();
  const confirmEl = document.getElementById('skillsSaveConfirm');
  confirmEl.classList.add('show');
  setTimeout(() => confirmEl.classList.remove('show'), 1800);
  showToast('Skills saved to Firestore');
}

/* ============================================================
   JOURNEY ADMIN
   ============================================================ */
function renderJourneyAdmin() {
  const journey = DASH.journey;
  const container = document.getElementById('journeyAdminList');

  if (!journey.length) {
    container.innerHTML = `<p class="panel-desc">No journey items yet.</p>`;
  } else {
    container.innerHTML = journey.map((item) => `
      <div class="admin-item-card">
        <div class="admin-item-head">
          <div>
            <span class="cat-badge">${escapeHtml(item.category)}</span>
            <div class="admin-item-title" style="margin-top:6px;">${escapeHtml(item.title)}</div>
            <div class="admin-item-sub">${escapeHtml(item.year || '')}</div>
          </div>
          <div class="admin-item-actions">
            <label class="switch"><input type="checkbox" class="journey-toggle" data-id="${item.id}" ${item.enabled !== false ? 'checked' : ''}><span class="slider"></span></label>
            <button class="btn btn-outline btn-small edit-journey-btn" data-id="${item.id}">Edit</button>
            <button class="btn btn-danger btn-small del-journey-btn" data-id="${item.id}">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  container.querySelectorAll('.journey-toggle').forEach(input => {
    input.addEventListener('change', async () => {
      const id = input.getAttribute('data-id');
      await fsSet(FS.JOURNEY, id, { enabled: input.checked });
      const item = DASH.journey.find(j => j.id === id);
      if (item) item.enabled = input.checked;
      showToast('Journey item updated');
    });
  });

  container.querySelectorAll('.del-journey-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!confirm('Delete this journey item?')) return;
      await fsDelete(FS.JOURNEY, id);
      DASH.journey = DASH.journey.filter(j => j.id !== id);
      renderJourneyAdmin();
      showToast('Journey item deleted');
    });
  });

  container.querySelectorAll('.edit-journey-btn').forEach(btn => {
    btn.addEventListener('click', () => openJourneyEditModal(btn.getAttribute('data-id')));
  });
}

function openJourneyEditModal(id) {
  const item = id ? DASH.journey.find(j => j.id === id) : { title: '', year: '', category: 'School', description: '', enabled: true, order: DASH.journey.length + 1, detail: { summary: '' } };

  const inner = `
    <h3>${id ? 'Edit' : 'Add'} Journey Item</h3>
    <div class="form-group"><label>Title</label><input type="text" id="jTitle" value="${escapeHtml(item.title)}"></div>
    <div class="form-row">
      <div class="form-group"><label>Year</label><input type="text" id="jYear" value="${escapeHtml(item.year || '')}"></div>
      <div class="form-group"><label>Category</label>
        <select id="jCategory">${['School','College','Professional','Projects','Work','Future'].map(c => `<option ${item.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-group"><label>Short Description</label><textarea id="jDesc" rows="2">${escapeHtml(item.description || '')}</textarea></div>
    <div class="form-group"><label>Detail Summary (shown when expanded)</label><textarea id="jSummary" rows="4">${escapeHtml(item.detail && item.detail.summary || '')}</textarea></div>
    <button class="btn btn-primary" id="saveJourneyItemBtn">Save</button>
  `;
  showEditModal(inner);

  document.getElementById('saveJourneyItemBtn').addEventListener('click', async () => {
    const updated = {
      title: document.getElementById('jTitle').value.trim() || 'Untitled',
      year: document.getElementById('jYear').value.trim(),
      category: document.getElementById('jCategory').value,
      description: document.getElementById('jDesc').value.trim(),
      enabled: item.enabled !== false,
      order: item.order || (DASH.journey.length + 1),
      detail: { summary: document.getElementById('jSummary').value.trim() }
    };

    if (id) {
      await fsSet(FS.JOURNEY, id, updated);
      Object.assign(item, updated);
    } else {
      const newId = await fsAdd(FS.JOURNEY, updated);
      DASH.journey.push({ id: newId, ...updated });
    }
    closeEditModal();
    renderJourneyAdmin();
    showToast('Journey item saved');
  });
}

/* ============================================================
   PROJECTS ADMIN
   ============================================================ */
function renderProjectsAdmin() {
  const projects = DASH.projects;
  const container = document.getElementById('projectsAdminList');

  if (!projects.length) {
    container.innerHTML = `<p class="panel-desc">No projects yet.</p>`;
  } else {
    container.innerHTML = projects.map((p) => `
      <div class="admin-item-card">
        <div class="admin-item-head">
          <div class="admin-item-row">
            <img class="proj-thumb" src="${p.image}" onerror="this.style.opacity=0.3">
            <div>
              <div class="admin-item-title">${escapeHtml(p.title)}</div>
              <div class="admin-item-sub">${escapeHtml(p.category)}</div>
            </div>
          </div>
          <div class="admin-item-actions">
            <label class="switch"><input type="checkbox" class="project-toggle" data-id="${p.id}" ${p.enabled !== false ? 'checked' : ''}><span class="slider"></span></label>
            <button class="btn btn-outline btn-small edit-project-btn" data-id="${p.id}">Edit</button>
            <button class="btn btn-danger btn-small del-project-btn" data-id="${p.id}">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  container.querySelectorAll('.project-toggle').forEach(input => {
    input.addEventListener('change', async () => {
      const id = input.getAttribute('data-id');
      await fsSet(FS.PROJECTS, id, { enabled: input.checked });
      const p = DASH.projects.find(x => x.id === id);
      if (p) p.enabled = input.checked;
      showToast('Project visibility updated');
    });
  });

  container.querySelectorAll('.del-project-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!confirm('Delete this project?')) return;
      await fsDelete(FS.PROJECTS, id);
      DASH.projects = DASH.projects.filter(p => p.id !== id);
      renderProjectsAdmin();
      showToast('Project deleted');
    });
  });

  container.querySelectorAll('.edit-project-btn').forEach(btn => {
    btn.addEventListener('click', () => openProjectEditModal(btn.getAttribute('data-id')));
  });
}

function openProjectEditModal(id) {
  const p = id ? DASH.projects.find(x => x.id === id) : {
    title: '', category: '', description: '', features: [], technologies: [],
    image: '', github: '', liveDemo: '', enabled: true
  };

  const inner = `
    <h3>${id ? 'Edit' : 'Add'} Project</h3>
    <div class="form-group"><label>Title</label><input type="text" id="pTitle" value="${escapeHtml(p.title)}"></div>
    <div class="form-group"><label>Category</label><input type="text" id="pCategory" value="${escapeHtml(p.category)}"></div>
    <div class="form-group"><label>Description</label><textarea id="pDesc" rows="3">${escapeHtml(p.description)}</textarea></div>
    <div class="form-group"><label>Features (one per line)</label><textarea id="pFeatures" rows="3">${escapeHtml((p.features||[]).join('\n'))}</textarea></div>
    <div class="form-group"><label>Technologies (comma separated)</label><input type="text" id="pTech" value="${escapeHtml((p.technologies||[]).join(', '))}"></div>
    <div class="form-group">
      <label>Project Image</label>
      <div class="image-input-row">
        <input type="text" id="pImage" value="${escapeHtml(p.image)}" placeholder="assets/projects/example.jpg or Cloudinary URL">
        <button type="button" class="cloudinary-upload-btn" id="pImageUploadBtn">☁ Upload</button>
      </div>
      <img class="image-preview-thumb ${p.image ? 'show' : ''}" id="pImagePreview" src="${escapeHtml(p.image || '')}">
      <div class="upload-hint">Paste a URL/path, or click Upload to use Cloudinary (requires cloud name + preset in firebase-config.js).</div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>GitHub Link</label><input type="text" id="pGithub" value="${escapeHtml(p.github)}"></div>
      <div class="form-group"><label>Live Demo Link</label><input type="text" id="pDemo" value="${escapeHtml(p.liveDemo)}"></div>
    </div>
    <button class="btn btn-primary" id="saveProjectBtn">Save</button>
  `;
  showEditModal(inner);

  setupCloudinaryButton('pImageUploadBtn', 'pImage', 'pImagePreview');

  document.getElementById('saveProjectBtn').addEventListener('click', async () => {
    const updated = {
      title: document.getElementById('pTitle').value.trim() || 'Untitled Project',
      category: document.getElementById('pCategory').value.trim(),
      description: document.getElementById('pDesc').value.trim(),
      features: document.getElementById('pFeatures').value.split('\n').map(s => s.trim()).filter(Boolean),
      technologies: document.getElementById('pTech').value.split(',').map(s => s.trim()).filter(Boolean),
      image: document.getElementById('pImage').value.trim(),
      github: document.getElementById('pGithub').value.trim(),
      liveDemo: document.getElementById('pDemo').value.trim(),
      enabled: p.enabled !== false
    };

    if (id) {
      await fsSet(FS.PROJECTS, id, updated);
      Object.assign(p, updated);
    } else {
      const newId = await fsAdd(FS.PROJECTS, updated);
      DASH.projects.push({ id: newId, ...updated });
    }
    closeEditModal();
    renderProjectsAdmin();
    showToast('Project saved');
  });
}

/* ============================================================
   CERTIFICATES ADMIN
   ============================================================ */
function renderCertsAdmin() {
  const certs = DASH.certificates;
  const container = document.getElementById('certsAdminList');

  if (!certs.length) {
    container.innerHTML = `<p class="panel-desc">No certificates uploaded yet. Click "+ Add Certificate" to add one.</p>`;
  } else {
    container.innerHTML = certs.map((c) => `
      <div class="admin-item-card">
        <div class="admin-item-head">
          <div class="admin-item-row">
            <img class="cert-thumb" src="${c.image}" onerror="this.style.opacity=0.3">
            <div>
              <span class="cat-badge">${escapeHtml(c.category)}</span>
              <div class="admin-item-title" style="margin-top:4px;">${escapeHtml(c.title)}</div>
              <div class="admin-item-sub">${escapeHtml(c.platform)} • ${escapeHtml(c.date)}</div>
            </div>
          </div>
          <div class="admin-item-actions">
            <label class="switch"><input type="checkbox" class="cert-toggle" data-id="${c.id}" ${c.enabled !== false ? 'checked' : ''}><span class="slider"></span></label>
            <button class="btn btn-outline btn-small edit-cert-btn" data-id="${c.id}">Edit</button>
            <button class="btn btn-danger btn-small del-cert-btn" data-id="${c.id}">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  container.querySelectorAll('.cert-toggle').forEach(input => {
    input.addEventListener('change', async () => {
      const id = input.getAttribute('data-id');
      await fsSet(FS.CERTS, id, { enabled: input.checked });
      const c = DASH.certificates.find(x => x.id === id);
      if (c) c.enabled = input.checked;
      showToast('Certificate visibility updated');
    });
  });

  container.querySelectorAll('.del-cert-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!confirm('Delete this certificate?')) return;
      await fsDelete(FS.CERTS, id);
      DASH.certificates = DASH.certificates.filter(c => c.id !== id);
      renderCertsAdmin();
      showToast('Certificate deleted');
    });
  });

  container.querySelectorAll('.edit-cert-btn').forEach(btn => {
    btn.addEventListener('click', () => openCertEditModal(btn.getAttribute('data-id')));
  });
}

function openCertEditModal(id) {
  const c = id ? DASH.certificates.find(x => x.id === id) : {
    title: '', category: 'Professional', platform: '', date: '',
    description: '', image: '', credentialLink: '', enabled: true
  };

  const inner = `
    <h3>${id ? 'Edit' : 'Add'} Certificate</h3>
    <div class="form-group"><label>Certificate Title</label><input type="text" id="cTitle" value="${escapeHtml(c.title)}"></div>
    <div class="form-row">
      <div class="form-group"><label>Category</label>
        <select id="cCategory">${['School','College','Professional','Work'].map(cat => `<option ${c.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Date</label><input type="text" id="cDate" value="${escapeHtml(c.date)}" placeholder="e.g. Jan 2026"></div>
    </div>
    <div class="form-group"><label>Platform / Organization</label><input type="text" id="cPlatform" value="${escapeHtml(c.platform)}"></div>
    <div class="form-group"><label>Description</label><textarea id="cDesc" rows="3">${escapeHtml(c.description)}</textarea></div>
    <div class="form-group">
      <label>Certificate Image / PDF</label>
      <div class="image-input-row">
        <input type="text" id="cImage" value="${escapeHtml(c.image)}" placeholder="assets/certificates/example.jpg or Cloudinary URL">
        <button type="button" class="cloudinary-upload-btn" id="cImageUploadBtn">☁ Upload</button>
      </div>
      <img class="image-preview-thumb ${c.image ? 'show' : ''}" id="cImagePreview" src="${escapeHtml(c.image || '')}">
      <div class="upload-hint">Paste a URL/path, or click Upload to use Cloudinary. PDFs work too — paste the PDF URL directly.</div>
    </div>
    <div class="form-group"><label>Credential Link (optional)</label><input type="text" id="cLink" value="${escapeHtml(c.credentialLink)}"></div>
    <button class="btn btn-primary" id="saveCertBtn">Save</button>
  `;
  showEditModal(inner);

  setupCloudinaryButton('cImageUploadBtn', 'cImage', 'cImagePreview');

  document.getElementById('saveCertBtn').addEventListener('click', async () => {
    const updated = {
      title: document.getElementById('cTitle').value.trim() || 'Untitled Certificate',
      category: document.getElementById('cCategory').value,
      date: document.getElementById('cDate').value.trim(),
      platform: document.getElementById('cPlatform').value.trim(),
      description: document.getElementById('cDesc').value.trim(),
      image: document.getElementById('cImage').value.trim(),
      credentialLink: document.getElementById('cLink').value.trim(),
      enabled: c.enabled !== false
    };

    if (id) {
      await fsSet(FS.CERTS, id, updated);
      Object.assign(c, updated);
    } else {
      const newId = await fsAdd(FS.CERTS, updated);
      DASH.certificates.push({ id: newId, ...updated });
    }
    closeEditModal();
    renderCertsAdmin();
    showToast('Certificate saved');
  });
}

/* ============================================================
   IT LAB ADMIN
   ============================================================ */
function renderITLabAdmin() {
  const masterToggle = document.getElementById('itlabMasterToggle');
  masterToggle.checked = DASH.itlabEnabled;

  const scenarios = DASH.itlab;
  const container = document.getElementById('itlabAdminList');

  if (!scenarios.length) {
    container.innerHTML = `<p class="panel-desc">No scenarios yet.</p>`;
  } else {
    container.innerHTML = scenarios.map((s) => `
      <div class="admin-item-card">
        <div class="admin-item-head">
          <div class="admin-item-title">${escapeHtml(s.title)}</div>
          <div class="admin-item-actions">
            <label class="switch"><input type="checkbox" class="scenario-toggle" data-id="${s.id}" ${s.enabled !== false ? 'checked' : ''}><span class="slider"></span></label>
            <button class="btn btn-outline btn-small edit-scenario-btn" data-id="${s.id}">Edit</button>
            <button class="btn btn-danger btn-small del-scenario-btn" data-id="${s.id}">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  container.querySelectorAll('.scenario-toggle').forEach(input => {
    input.addEventListener('change', async () => {
      const id = input.getAttribute('data-id');
      await fsSet(FS.ITLAB, id, { enabled: input.checked });
      const s = DASH.itlab.find(x => x.id === id);
      if (s) s.enabled = input.checked;
      showToast('Scenario visibility updated');
    });
  });

  container.querySelectorAll('.del-scenario-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!confirm('Delete this scenario?')) return;
      await fsDelete(FS.ITLAB, id);
      DASH.itlab = DASH.itlab.filter(s => s.id !== id);
      renderITLabAdmin();
      showToast('Scenario deleted');
    });
  });

  container.querySelectorAll('.edit-scenario-btn').forEach(btn => {
    btn.addEventListener('click', () => openScenarioEditModal(btn.getAttribute('data-id')));
  });
}

function openScenarioEditModal(id) {
  const s = id ? DASH.itlab.find(x => x.id === id) : { title: '', problem: '', cause: '', steps: [], solution: '', enabled: true };

  const inner = `
    <h3>${id ? 'Edit' : 'Add'} Scenario</h3>
    <div class="form-group"><label>Scenario Title</label><input type="text" id="sTitle" value="${escapeHtml(s.title)}"></div>
    <div class="form-group"><label>Problem</label><textarea id="sProblem" rows="2">${escapeHtml(s.problem)}</textarea></div>
    <div class="form-group"><label>Possible Cause</label><textarea id="sCause" rows="2">${escapeHtml(s.cause)}</textarea></div>
    <div class="form-group"><label>Troubleshooting Steps (one per line)</label><textarea id="sSteps" rows="4">${escapeHtml((s.steps||[]).join('\n'))}</textarea></div>
    <div class="form-group"><label>Solution</label><textarea id="sSolution" rows="3">${escapeHtml(s.solution)}</textarea></div>
    <button class="btn btn-primary" id="saveScenarioBtn">Save</button>
  `;
  showEditModal(inner);

  document.getElementById('saveScenarioBtn').addEventListener('click', async () => {
    const updated = {
      title: document.getElementById('sTitle').value.trim() || 'Untitled Scenario',
      problem: document.getElementById('sProblem').value.trim(),
      cause: document.getElementById('sCause').value.trim(),
      steps: document.getElementById('sSteps').value.split('\n').map(x => x.trim()).filter(Boolean),
      solution: document.getElementById('sSolution').value.trim(),
      enabled: s.enabled !== false
    };

    if (id) {
      await fsSet(FS.ITLAB, id, updated);
      Object.assign(s, updated);
    } else {
      const newId = await fsAdd(FS.ITLAB, updated);
      DASH.itlab.push({ id: newId, ...updated });
    }
    closeEditModal();
    renderITLabAdmin();
    showToast('Scenario saved');
  });
}

/* ============================================================
   CLOUDINARY UPLOAD WIDGET
   Wires an "☁ Upload" button to open Cloudinary's hosted widget.
   On successful upload, fills the paired text input + preview thumb
   with the resulting secure_url.
   ============================================================ */
function setupCloudinaryButton(buttonId, inputId, previewId) {
  const btn = document.getElementById(buttonId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!btn) return;

  // live-update preview when user types/pastes a URL manually
  input.addEventListener('input', () => {
    if (input.value.trim()) {
      preview.src = input.value.trim();
      preview.classList.add('show');
    } else {
      preview.classList.remove('show');
    }
  });

  btn.addEventListener('click', () => {
    if (typeof cloudinary === 'undefined') {
      alert('Cloudinary widget script did not load (check your internet connection or ad-blocker).');
      return;
    }
    if (CLOUDINARY_CONFIG.cloudName === 'YOUR_CLOUDINARY_CLOUD_NAME') {
      alert('Please set your Cloudinary cloud name and upload preset in firebase-config.js first.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Opening…';

    const widget = cloudinary.createUploadWidget(
      {
        cloudName: CLOUDINARY_CONFIG.cloudName,
        uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
        sources: ['local', 'url', 'camera'],
        multiple: false,
        maxFileSize: 10000000, // 10MB
        clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'pdf']
      },
      (error, result) => {
        btn.disabled = false;
        btn.textContent = '☁ Upload';
        if (error) {
          console.error('Cloudinary upload error:', error);
          return;
        }
        if (result && result.event === 'success') {
          const url = result.info.secure_url;
          input.value = url;
          preview.src = url;
          preview.classList.add('show');
          showToast('Image uploaded');
        }
      }
    );
    widget.open();
  });
}

/* ============================================================
   EDIT MODAL (shared)
   ============================================================ */
function showEditModal(innerHtml) {
  document.getElementById('editModalInner').innerHTML = innerHtml;
  document.getElementById('editModalOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeEditModal() {
  document.getElementById('editModalOverlay').classList.remove('show');
  document.body.style.overflow = '';
}
function setupEditModal() {
  document.getElementById('editModalClose').addEventListener('click', closeEditModal);
  document.getElementById('editModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'editModalOverlay') closeEditModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeEditModal(); });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', initAuth);
