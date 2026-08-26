/* ============================================================
   MONAN — ADMIN DASHBOARD SCRIPT (Firebase / Firestore edition v3)
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

    if (!email || !pass) { errorEl.textContent = 'Please enter both email and password.'; return; }

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
function logout() { auth.signOut(); }

/* ============================================================
   DASHBOARD INIT
   ============================================================ */
let DASH = {
  settings: {}, status: {}, profile: {}, contact: {},
  skills: [], hobbies: [], achievements: [], journey: [], projects: [],
  certificates: [], itlab: [], itlabEnabled: true, activity: []
};

async function initDashboard() {
  document.getElementById('logoutBtn').addEventListener('click', logout);

  const links = document.querySelectorAll('.sidebar-link');
  const panels = document.querySelectorAll('.panel');
  const title = document.getElementById('panelTitle');
  const titles = {
    overview: 'Overview', visitors: 'Who Visited My Portfolio', visibility: 'Portfolio Visibility',
    profile: 'Profile Photo', status: 'Current Status', contact: 'Contact Info',
    skills: 'Skills Management', hobbies: 'Hobbies Management', achievements: 'Achievements Management',
    journey: 'Journey Management', projects: 'Projects Management', certificates: 'Certificate Management',
    itlab: 'IT Troubleshooting Lab'
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
  setupVisitorBulkActions();
  document.getElementById('refreshActivityBtn').addEventListener('click', async () => {
    DASH.activity = await fsGetAll(FS.ACTIVITY);
    renderOverview();
    renderVisitorsTable();
    showToast('Refreshed');
  });
  document.getElementById('deleteAllActivityBtn').addEventListener('click', async () => {
    if (!confirm('Delete ALL visitor activity? This cannot be undone.')) return;
    const ids = DASH.activity.map(a => a.id);
    await fsDeleteMany(FS.ACTIVITY, ids);
    DASH.activity = [];
    renderOverview();
    renderVisitorsTable();
    showToast('All activity deleted');
  });

  document.getElementById('addSkillCategoryBtn').onclick = addSkillCategory;
  document.getElementById('saveSkillsBtn').onclick = saveAllSkills;
  document.getElementById('addHobbyBtn').onclick = () => openHobbyEditModal(null);
  document.getElementById('addAchievementBtn').onclick = () => openAchievementEditModal(null);
  document.getElementById('addJourneyBtn').onclick = () => openJourneyEditModal(null);
  document.getElementById('addProjectBtn').onclick = () => openProjectEditModal(null);
  document.getElementById('addCertBtn').onclick = () => openCertEditModal(null);
  document.getElementById('addScenarioBtn').onclick = () => openScenarioEditModal(null);

  document.getElementById('saveStatusBtn').addEventListener('click', saveStatus);
  document.getElementById('saveProfilePhotoBtn').addEventListener('click', saveProfilePhoto);
  document.getElementById('saveContactBtn').addEventListener('click', saveContactInfo);

  setupCloudinaryButton('profilePhotoUploadBtn', 'profilePhotoInput', 'profilePhotoPreview');
  document.getElementById('profilePhotoInput').addEventListener('input', (e) => {
    const preview = document.getElementById('profilePhotoPreview');
    if (e.target.value.trim()) { preview.src = e.target.value.trim(); preview.style.display = 'block'; }
  });

  document.getElementById('itlabMasterToggle').addEventListener('change', async (e) => {
    await fsSetDoc(FS.ITLAB_META_DOC, { enabled: e.target.checked });
    DASH.itlabEnabled = e.target.checked;
    showToast('IT Lab visibility updated');
  });
}

async function refreshAllData() {
  document.getElementById('overviewLoading').style.display = 'flex';

  const [settings, status, profile, contact, skills, hobbies, achievements, journey, projects, certificates, itlab, itlabMeta, activity] = await Promise.all([
    fsGetDoc(FS.SETTINGS_DOC, DEFAULT_SETTINGS),
    fsGetDoc(FS.STATUS_DOC, DEFAULT_STATUS),
    fsGetDoc(FS.PROFILE_DOC, DEFAULT_PROFILE),
    fsGetDoc(FS.CONTACT_DOC, DEFAULT_CONTACT),
    fsGetAll(FS.SKILLS),
    fsGetAll(FS.HOBBIES),
    fsGetAll(FS.ACHIEVEMENTS),
    fsGetAll(FS.JOURNEY, 'order'),
    fsGetAll(FS.PROJECTS),
    fsGetAll(FS.CERTS),
    fsGetAll(FS.ITLAB),
    fsGetDoc(FS.ITLAB_META_DOC, { enabled: true }),
    fsGetAll(FS.ACTIVITY)
  ]);

  DASH.settings = settings; DASH.status = status; DASH.profile = profile; DASH.contact = contact;
  DASH.skills = skills; DASH.hobbies = hobbies; DASH.achievements = achievements; DASH.journey = journey;
  DASH.projects = projects; DASH.certificates = certificates; DASH.itlab = itlab;
  DASH.itlabEnabled = itlabMeta.enabled !== false; DASH.activity = activity;

  document.getElementById('overviewLoading').style.display = 'none';

  renderOverview();
  renderVisitorsTable();
  renderVisibilityToggles();
  renderProfileForm();
  renderStatusForm();
  renderContactForm();
  renderSkillsAdmin();
  renderHobbiesAdmin();
  renderAchievementsAdmin();
  renderJourneyAdmin();
  renderProjectsAdmin();
  renderCertsAdmin();
  renderITLabAdmin();
}

/* ============================================================
   OVERVIEW
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
   VISITORS TABLE (with select + bulk delete)
   ============================================================ */
let visitorSearchTerm = '';
let visitorFilterType = 'all';
let selectedActivityIds = new Set();

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

function getFilteredActivity() {
  let list = DASH.activity.slice().sort((a, b) => {
    const ta = a.timestamp && a.timestamp.toMillis ? a.timestamp.toMillis() : new Date(a.clientTime||0).getTime();
    const tb = b.timestamp && b.timestamp.toMillis ? b.timestamp.toMillis() : new Date(b.clientTime||0).getTime();
    return tb - ta;
  });
  if (visitorSearchTerm) list = list.filter(a => (a.name||'').toLowerCase().includes(visitorSearchTerm.toLowerCase()));
  if (visitorFilterType !== 'all') list = list.filter(a => (a.activity||'').toLowerCase().includes(visitorFilterType));
  return list;
}

function renderVisitorsTable() {
  const tbody = document.getElementById('visitorTableBody');
  const list = getFilteredActivity();

  if (!list.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No visitor activity recorded yet.</td></tr>`;
    updateBulkBar();
    return;
  }

  tbody.innerHTML = list.map(a => {
    const { date, time } = formatTimestamp(a);
    const checked = selectedActivityIds.has(a.id) ? 'checked' : '';
    return `<tr>
      <td class="checkbox-col"><input type="checkbox" class="row-select" data-id="${a.id}" ${checked}></td>
      <td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.activity)}</td><td>${date}</td><td>${time}</td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.row-select').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.getAttribute('data-id');
      if (cb.checked) selectedActivityIds.add(id); else selectedActivityIds.delete(id);
      updateBulkBar();
    });
  });

  updateBulkBar();
}

function updateBulkBar() {
  const bar = document.getElementById('bulkActionsBar');
  const count = document.getElementById('bulkSelectedCount');
  count.textContent = `${selectedActivityIds.size} selected`;
  bar.classList.toggle('show', selectedActivityIds.size > 0);

  const selectAll = document.getElementById('selectAllVisitors');
  const visibleIds = getFilteredActivity().map(a => a.id);
  selectAll.checked = visibleIds.length > 0 && visibleIds.every(id => selectedActivityIds.has(id));
}

function setupVisitorFilters() {
  document.getElementById('visitorSearch').addEventListener('input', (e) => { visitorSearchTerm = e.target.value; renderVisitorsTable(); });
  document.getElementById('visitorFilter').addEventListener('change', (e) => { visitorFilterType = e.target.value; renderVisitorsTable(); });
}

function setupVisitorBulkActions() {
  document.getElementById('selectAllVisitors').addEventListener('change', (e) => {
    const visibleIds = getFilteredActivity().map(a => a.id);
    if (e.target.checked) visibleIds.forEach(id => selectedActivityIds.add(id));
    else visibleIds.forEach(id => selectedActivityIds.delete(id));
    renderVisitorsTable();
  });

  document.getElementById('deleteSelectedBtn').addEventListener('click', async () => {
    if (!selectedActivityIds.size) return;
    if (!confirm(`Delete ${selectedActivityIds.size} selected activity record(s)?`)) return;
    const ids = Array.from(selectedActivityIds);
    await fsDeleteMany(FS.ACTIVITY, ids);
    DASH.activity = DASH.activity.filter(a => !selectedActivityIds.has(a.id));
    selectedActivityIds.clear();
    renderOverview();
    renderVisitorsTable();
    showToast('Selected activity deleted');
  });
}

/* ============================================================
   SECTION VISIBILITY
   ============================================================ */
function renderVisibilityToggles() {
  const settings = DASH.settings;
  const container = document.getElementById('visibilityList');
  const labels = {
    home: 'Home', about: 'About', skills: 'Skills', education: 'Education',
    journey: 'Journey', hobbies: 'Hobbies', achievements: 'Achievements',
    projects: 'Projects', certificates: 'Certificates',
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
   PROFILE PHOTO
   ============================================================ */
function renderProfileForm() {
  const input = document.getElementById('profilePhotoInput');
  const preview = document.getElementById('profilePhotoPreview');
  input.value = DASH.profile.photoUrl || '';
  if (input.value) { preview.src = input.value; preview.style.display = 'block'; }
}

async function saveProfilePhoto() {
  const url = document.getElementById('profilePhotoInput').value.trim();
  await fsSetDoc(FS.PROFILE_DOC, { photoUrl: url });
  DASH.profile.photoUrl = url;
  const confirmEl = document.getElementById('profileSaveConfirm');
  confirmEl.classList.add('show');
  setTimeout(() => confirmEl.classList.remove('show'), 1800);
  showToast('Profile photo saved');
}

/* ============================================================
   CURRENT STATUS
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
   CONTACT INFO
   ============================================================ */
function renderContactForm() {
  const c = DASH.contact;
  document.getElementById('contactEmailInput').value = c.email || '';
  document.getElementById('contactLinkedinInput').value = c.linkedin || '';
  document.getElementById('contactLinkedinDisplayInput').value = c.linkedinDisplay || '';
  document.getElementById('contactGithubInput').value = c.github || '';
  document.getElementById('contactGithubDisplayInput').value = c.githubDisplay || '';
}

async function saveContactInfo() {
  const newContact = {
    email: document.getElementById('contactEmailInput').value.trim(),
    linkedin: document.getElementById('contactLinkedinInput').value.trim(),
    linkedinDisplay: document.getElementById('contactLinkedinDisplayInput').value.trim(),
    github: document.getElementById('contactGithubInput').value.trim(),
    githubDisplay: document.getElementById('contactGithubDisplayInput').value.trim()
  };
  await fsSetDoc(FS.CONTACT_DOC, newContact);
  DASH.contact = newContact;
  const confirmEl = document.getElementById('contactSaveConfirm');
  confirmEl.classList.add('show');
  setTimeout(() => confirmEl.classList.remove('show'), 1800);
  showToast('Contact info saved');
}

/* ============================================================
   SKILLS ADMIN
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
      const id = e.target.closest('.admin-item-card').getAttribute('data-id');
      DASH.skills.find(c => c.id === id).items.push({ name: 'New Skill', level: 'Learning' });
      renderSkillsAdmin();
    });
  });
  container.querySelectorAll('.del-skill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.admin-item-card');
      const id = card.getAttribute('data-id');
      const ii = parseInt(e.target.closest('.admin-item-row').getAttribute('data-ii'));
      DASH.skills.find(c => c.id === id).items.splice(ii, 1);
      renderSkillsAdmin();
    });
  });
}

function addSkillCategory() {
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
    if (id === 'null' || !id) { cat.id = await fsAdd(FS.SKILLS, data); }
    else { await fsSet(FS.SKILLS, id, data); }
  }
  renderSkillsAdmin();
  const confirmEl = document.getElementById('skillsSaveConfirm');
  confirmEl.classList.add('show');
  setTimeout(() => confirmEl.classList.remove('show'), 1800);
  showToast('Skills saved to Firestore');
}

/* ============================================================
   HOBBIES ADMIN
   ============================================================ */
function renderHobbiesAdmin() {
  const hobbies = DASH.hobbies;
  const container = document.getElementById('hobbiesAdminList');

  if (!hobbies.length) {
    container.innerHTML = `<p class="panel-desc">No hobbies yet.</p>`;
  } else {
    container.innerHTML = hobbies.map((h) => `
      <div class="admin-item-card">
        <div class="admin-item-head">
          <div class="admin-item-row">
            <span style="font-size:1.5rem;">${escapeHtml(h.icon || '⭐')}</span>
            <div>
              <div class="admin-item-title">${escapeHtml(h.title)}</div>
              <div class="admin-item-sub">${escapeHtml(h.description || '')}</div>
            </div>
          </div>
          <div class="admin-item-actions">
            <button class="btn btn-outline btn-small edit-hobby-btn" data-id="${h.id}">Edit</button>
            <button class="btn btn-danger btn-small del-hobby-btn" data-id="${h.id}">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  container.querySelectorAll('.del-hobby-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!confirm('Delete this hobby?')) return;
      await fsDelete(FS.HOBBIES, id);
      DASH.hobbies = DASH.hobbies.filter(h => h.id !== id);
      renderHobbiesAdmin();
      showToast('Hobby deleted');
    });
  });
  container.querySelectorAll('.edit-hobby-btn').forEach(btn => {
    btn.addEventListener('click', () => openHobbyEditModal(btn.getAttribute('data-id')));
  });
}

function openHobbyEditModal(id) {
  const h = id ? DASH.hobbies.find(x => x.id === id) : { icon: '⭐', title: '', description: '' };
  const inner = `
    <h3>${id ? 'Edit' : 'Add'} Hobby</h3>
    <div class="form-group"><label>Icon (emoji)</label><input type="text" id="hIcon" value="${escapeHtml(h.icon || '')}" placeholder="e.g. 🎮"></div>
    <div class="form-group"><label>Title</label><input type="text" id="hTitle" value="${escapeHtml(h.title)}"></div>
    <div class="form-group"><label>Description</label><textarea id="hDesc" rows="3">${escapeHtml(h.description || '')}</textarea></div>
    <button class="btn btn-primary" id="saveHobbyBtn">Save</button>
  `;
  showEditModal(inner);

  document.getElementById('saveHobbyBtn').addEventListener('click', async () => {
    const updated = {
      icon: document.getElementById('hIcon').value.trim() || '⭐',
      title: document.getElementById('hTitle').value.trim() || 'Untitled',
      description: document.getElementById('hDesc').value.trim()
    };
    if (id) { await fsSet(FS.HOBBIES, id, updated); Object.assign(h, updated); }
    else { const newId = await fsAdd(FS.HOBBIES, updated); DASH.hobbies.push({ id: newId, ...updated }); }
    closeEditModal();
    renderHobbiesAdmin();
    showToast('Hobby saved');
  });
}

/* ============================================================
   ACHIEVEMENTS ADMIN
   ============================================================ */
function renderAchievementsAdmin() {
  const achievements = DASH.achievements;
  const container = document.getElementById('achievementsAdminList');

  if (!achievements.length) {
    container.innerHTML = `<p class="panel-desc">No achievements yet.</p>`;
  } else {
    container.innerHTML = achievements.map((a) => `
      <div class="admin-item-card">
        <div class="admin-item-head">
          <div>
            <div class="admin-item-title">${escapeHtml(a.title)}</div>
            <div class="admin-item-sub">${escapeHtml(a.date || '')}</div>
          </div>
          <div class="admin-item-actions">
            <button class="btn btn-outline btn-small edit-ach-btn" data-id="${a.id}">Edit</button>
            <button class="btn btn-danger btn-small del-ach-btn" data-id="${a.id}">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  container.querySelectorAll('.del-ach-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!confirm('Delete this achievement?')) return;
      await fsDelete(FS.ACHIEVEMENTS, id);
      DASH.achievements = DASH.achievements.filter(a => a.id !== id);
      renderAchievementsAdmin();
      showToast('Achievement deleted');
    });
  });
  container.querySelectorAll('.edit-ach-btn').forEach(btn => {
    btn.addEventListener('click', () => openAchievementEditModal(btn.getAttribute('data-id')));
  });
}

function openAchievementEditModal(id) {
  const a = id ? DASH.achievements.find(x => x.id === id) : { title: '', date: '', description: '' };
  const inner = `
    <h3>${id ? 'Edit' : 'Add'} Achievement</h3>
    <div class="form-group"><label>Title</label><input type="text" id="aTitle" value="${escapeHtml(a.title)}"></div>
    <div class="form-group"><label>Date</label><input type="text" id="aDate" value="${escapeHtml(a.date || '')}" placeholder="e.g. Mar 2025"></div>
    <div class="form-group"><label>Description</label><textarea id="aDesc" rows="3">${escapeHtml(a.description || '')}</textarea></div>
    <button class="btn btn-primary" id="saveAchBtn">Save</button>
  `;
  showEditModal(inner);

  document.getElementById('saveAchBtn').addEventListener('click', async () => {
    const updated = {
      title: document.getElementById('aTitle').value.trim() || 'Untitled',
      date: document.getElementById('aDate').value.trim(),
      description: document.getElementById('aDesc').value.trim()
    };
    if (id) { await fsSet(FS.ACHIEVEMENTS, id, updated); Object.assign(a, updated); }
    else { const newId = await fsAdd(FS.ACHIEVEMENTS, updated); DASH.achievements.push({ id: newId, ...updated }); }
    closeEditModal();
    renderAchievementsAdmin();
    showToast('Achievement saved');
  });
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
    if (id) { await fsSet(FS.JOURNEY, id, updated); Object.assign(item, updated); }
    else { const newId = await fsAdd(FS.JOURNEY, updated); DASH.journey.push({ id: newId, ...updated }); }
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
      <div class="upload-hint">Paste a URL/path, or click Upload to use Cloudinary.</div>
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
    if (id) { await fsSet(FS.PROJECTS, id, updated); Object.assign(p, updated); }
    else { const newId = await fsAdd(FS.PROJECTS, updated); DASH.projects.push({ id: newId, ...updated }); }
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
      <div class="upload-hint">Paste a URL/path, or click Upload to use Cloudinary. PDFs work too.</div>
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
    if (id) { await fsSet(FS.CERTS, id, updated); Object.assign(c, updated); }
    else { const newId = await fsAdd(FS.CERTS, updated); DASH.certificates.push({ id: newId, ...updated }); }
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
    if (id) { await fsSet(FS.ITLAB, id, updated); Object.assign(s, updated); }
    else { const newId = await fsAdd(FS.ITLAB, updated); DASH.itlab.push({ id: newId, ...updated }); }
    closeEditModal();
    renderITLabAdmin();
    showToast('Scenario saved');
  });
}

/* ============================================================
   CLOUDINARY UPLOAD WIDGET
   ============================================================ */
function setupCloudinaryButton(buttonId, inputId, previewId) {
  const btn = document.getElementById(buttonId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!btn) return;

  input.addEventListener('input', () => {
    if (input.value.trim()) { preview.src = input.value.trim(); preview.classList.add('show'); preview.style.display = 'block'; }
    else { preview.classList.remove('show'); }
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
        maxFileSize: 10000000,
        clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'pdf']
      },
      (error, result) => {
        btn.disabled = false;
        btn.textContent = '☁ Upload';
        if (error) { console.error('Cloudinary upload error:', error); return; }
        if (result && result.event === 'success') {
          const url = result.info.secure_url;
          input.value = url;
          preview.src = url;
          preview.classList.add('show');
          preview.style.display = 'block';
          showToast('Image uploaded');
        }
      }
    );
    widget.open();
  });
}

/* ============================================================
   EDIT MODAL
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
