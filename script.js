/* ============================================================
   MONAN — PORTFOLIO SCRIPT (Firebase / Firestore edition)
   All content (skills, journey, projects, certificates, IT lab,
   status, section visibility) is read live from Firestore.
   Visitor name + activity logs are WRITTEN to Firestore too,
   so Admin sees real cross-device analytics.
   ============================================================ */

/* ---------- In-memory cache (populated from Firestore on load) ---------- */
let CACHE = {
  settings: {},
  status: {},
  skills: [],
  journey: [],
  projects: [],
  certificates: [],
  itlab: [],
  itlabEnabled: true
};

/* ---------- Session-only visitor name (kept in sessionStorage, not personal data beyond name) ---------- */
const VISITOR_NAME_KEY = 'mp_visitor_name_session';

function getVisitorName() {
  return sessionStorage.getItem(VISITOR_NAME_KEY) || '';
}
function setVisitorNameSession(name) {
  sessionStorage.setItem(VISITOR_NAME_KEY, name);
}

/* ============================================================
   FIRESTORE WRITES — visitor + activity logging
   ============================================================ */
async function registerVisitor(name) {
  setVisitorNameSession(name);
  try {
    await FS.VISITORS.add({ name, firstSeen: firebase.firestore.FieldValue.serverTimestamp() });
  } catch (e) { console.error('Could not save visitor:', e); }
  logActivity('Portfolio Visit');
}

async function logActivity(activity) {
  const name = getVisitorName() || 'Anonymous';
  try {
    await FS.ACTIVITY.add({
      name,
      activity,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      clientTime: new Date().toISOString()
    });
  } catch (e) { console.error('Could not log activity:', e); }
}

/* Track each main section viewed once per session using IntersectionObserver */
const sectionActivityMap = {
  about: 'About Viewed',
  projects: 'Projects Viewed',
  certificates: 'Certificate Viewed',
  itlab: 'IT Lab Opened',
  contact: 'Contact Viewed'
};
const trackedSections = new Set();
function setupSectionTracking() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        const label = sectionActivityMap[id];
        if (label && !trackedSections.has(id)) {
          trackedSections.add(id);
          logActivity(label);
        }
      }
    });
  }, { threshold: 0.4 });

  Object.keys(sectionActivityMap).forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

/* ============================================================
   THEME (kept in localStorage — purely a UI preference, no personal data)
   ============================================================ */
function initTheme() {
  const saved = localStorage.getItem('mp_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = saved === 'dark' ? '🌙' : '☀️';
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('mp_theme', next);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = next === 'dark' ? '🌙' : '☀️';
}

/* ============================================================
   WELCOME POPUP
   ============================================================ */
function initWelcomePopup() {
  const overlay = document.getElementById('welcomeOverlay');
  const existingName = getVisitorName();

  if (existingName) {
    logActivity('Portfolio Visit');
    return;
  }

  overlay.classList.add('show');

  const input = document.getElementById('visitorNameInput');
  const enterBtn = document.getElementById('enterPortfolioBtn');
  const step1 = document.getElementById('welcomeStep1');
  const step2 = document.getElementById('welcomeStep2');
  const msg = document.getElementById('welcomeMsg');

  function submitName() {
    const name = (input.value || '').trim();
    const finalName = name || 'Guest';
    registerVisitor(finalName);
    step1.style.display = 'none';
    step2.style.display = 'block';
    msg.textContent = `Welcome, ${finalName}! 👋`;
    msg.style.display = 'block';
    setTimeout(() => overlay.classList.remove('show'), 1400);
  }

  enterBtn.addEventListener('click', submitName);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitName(); });
}

/* ============================================================
   SECTION VISIBILITY
   ============================================================ */
function applySectionVisibility() {
  const settings = CACHE.settings;
  const sectionIdMap = {
    home: 'home', about: 'about', skills: 'skills', education: 'education',
    journey: 'journey', projects: 'projects', certificates: 'certificates',
    itlab: 'itlab', resume: 'resume', contact: 'contact', final: 'finalSection'
  };
  Object.keys(sectionIdMap).forEach(key => {
    const el = document.getElementById(sectionIdMap[key]);
    const navItem = document.querySelector(`[data-nav="${key}"]`);
    const enabled = settings[key] !== false;
    if (el) el.style.display = enabled ? '' : 'none';
    if (navItem) { const li = navItem.closest('li'); if (li) li.style.display = enabled ? '' : 'none'; }
  });
}

/* ============================================================
   CURRENT STATUS CARD
   ============================================================ */
function renderStatus() {
  const status = CACHE.status;
  const roleEl = document.getElementById('statusRole');
  const focusEl = document.getElementById('statusFocus');
  const aboutFocusEl = document.getElementById('aboutCurrentFocus');
  if (roleEl) roleEl.textContent = status.role || 'Support Engineer';
  if (focusEl) focusEl.textContent = status.focus || 'IT Support • Networking';
  if (aboutFocusEl) aboutFocusEl.textContent = status.focus || 'IT Support • Networking';
}

/* ============================================================
   SKILLS RENDERING
   ============================================================ */
function renderSkills() {
  const grid = document.getElementById('skillsGrid');
  if (!grid) return;
  const skills = CACHE.skills;
  if (!skills.length) { grid.innerHTML = ''; return; }
  grid.innerHTML = skills.map(cat => `
    <div class="skill-category">
      <h4>${escapeHtml(cat.category)}</h4>
      ${(cat.items || []).map(item => `
        <div class="skill-item">
          <span>${escapeHtml(item.name)}</span>
          <span class="skill-level">${escapeHtml(item.level)}</span>
        </div>
      `).join('')}
    </div>
  `).join('');
}

/* ============================================================
   JOURNEY TIMELINE RENDERING
   ============================================================ */
function renderJourney() {
  const container = document.getElementById('journeyTimeline');
  if (!container) return;
  const journey = CACHE.journey.filter(j => j.enabled !== false);
  const certs = CACHE.certificates.filter(c => c.enabled !== false);

  container.innerHTML = journey.map((item, idx) => {
    const relatedCerts = certs.filter(c => (c.category || '').toLowerCase() === (item.category || '').toLowerCase());
    return `
    <div class="journey-item" data-idx="${idx}">
      <div class="journey-line">
        <div class="journey-dot"></div>
        <div class="journey-connector"></div>
      </div>
      <div class="journey-content">
        <div class="journey-header">
          <div>
            <h4>${escapeHtml(item.title)}</h4>
            ${item.year ? `<div class="journey-year">${escapeHtml(item.year)}</div>` : ''}
          </div>
          <span class="journey-toggle-icon">⌄</span>
        </div>
        <div class="journey-details">
          <p>${escapeHtml(item.description || '')}</p>
          ${item.detail && item.detail.summary ? `<p>${escapeHtml(item.detail.summary)}</p>` : ''}
          ${relatedCerts.length ? `
            <h5>Certificates</h5>
            <div class="mini-cert-list">
              ${relatedCerts.map(c => `
                <div class="mini-cert" data-cert-id="${c.id}">
                  ${c.image ? `<img src="${c.image}" alt="${escapeHtml(c.title)}" onerror="this.style.display='none'">` : ''}
                  <span>${escapeHtml(c.title)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
  }).join('');

  container.querySelectorAll('.journey-item').forEach(el => {
    el.querySelector('.journey-header').addEventListener('click', () => el.classList.toggle('active'));
  });

  container.querySelectorAll('.mini-cert').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const certId = el.getAttribute('data-cert-id');
      const cert = CACHE.certificates.find(c => c.id === certId);
      if (cert) openCertModal(cert);
    });
  });
}

/* ============================================================
   PROJECTS RENDERING
   ============================================================ */
function renderProjects() {
  const grid = document.getElementById('projectGrid');
  if (!grid) return;
  const projects = CACHE.projects.filter(p => p.enabled !== false);

  if (!projects.length) {
    grid.innerHTML = `<div class="empty-state">No projects to display yet.</div>`;
    return;
  }

  grid.innerHTML = projects.map(p => `
    <div class="project-card">
      <img class="project-img" src="${p.image}" alt="${escapeHtml(p.title)}" onerror="this.style.display='none'">
      <div class="project-body">
        <div class="project-category">${escapeHtml(p.category)}</div>
        <h4>${escapeHtml(p.title)}</h4>
        <p>${escapeHtml(p.description)}</p>
        <div class="project-tech">
          ${(p.technologies || []).map(t => `<span class="tech-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="project-links">
          <button class="btn btn-primary btn-small view-project-btn" data-id="${p.id}">View Project</button>
        </div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.view-project-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const proj = projects.find(p => p.id === btn.getAttribute('data-id'));
      if (proj) { openProjectModal(proj); logActivity(`Viewed Project — ${proj.title}`); }
    });
  });
}

function openProjectModal(p) {
  const inner = document.getElementById('modalInner');
  inner.innerHTML = `
    <img class="modal-img" src="${p.image}" alt="${escapeHtml(p.title)}" onerror="this.style.display='none'">
    <div class="modal-content">
      <h3>${escapeHtml(p.title)}</h3>
      <div class="modal-meta"><span>${escapeHtml(p.category)}</span></div>
      <p>${escapeHtml(p.description)}</p>
      ${p.features && p.features.length ? `
        <h5>Features</h5>
        <ul>${p.features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
      ` : ''}
      <h5>Technologies</h5>
      <div class="project-tech">${(p.technologies || []).map(t => `<span class="tech-tag">${escapeHtml(t)}</span>`).join('')}</div>
      <div class="modal-actions">
        ${p.github ? `<a href="${p.github}" target="_blank" rel="noopener" class="btn btn-outline btn-small">GitHub</a>` : ''}
        ${p.liveDemo ? `<a href="${p.liveDemo}" target="_blank" rel="noopener" class="btn btn-primary btn-small">Live Demo</a>` : ''}
      </div>
    </div>
  `;
  showModal();
}

/* ============================================================
   CERTIFICATES RENDERING + FILTERING
   ============================================================ */
let currentCertFilter = 'all';

function renderCertificates() {
  const grid = document.getElementById('certGrid');
  if (!grid) return;
  const certs = CACHE.certificates.filter(c => c.enabled !== false);
  const filtered = currentCertFilter === 'all' ? certs : certs.filter(c => (c.category || '').toLowerCase() === currentCertFilter);

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state">No certificates in this category yet. Certificates are added by Admin.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(c => `
    <div class="cert-card" data-id="${c.id}">
      <img class="cert-img" src="${c.image}" alt="${escapeHtml(c.title)}" onerror="this.style.display='none'">
      <div class="cert-body">
        <span class="cert-cat-tag">${escapeHtml(c.category)}</span>
        <h4>${escapeHtml(c.title)}</h4>
        <div class="cert-platform">${escapeHtml(c.platform)}</div>
        <div class="cert-date">${escapeHtml(c.date)}</div>
        <button class="btn btn-outline btn-small view-cert-btn" data-id="${c.id}">View Certificate</button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.view-cert-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cert = certs.find(c => c.id === btn.getAttribute('data-id'));
      if (cert) openCertModal(cert);
    });
  });
}

function openCertModal(c) {
  const isPdf = (c.image || '').toLowerCase().endsWith('.pdf');
  const inner = document.getElementById('modalInner');
  inner.innerHTML = `
    ${isPdf
      ? `<iframe src="${c.image}" style="width:100%;height:340px;border:none;" title="${escapeHtml(c.title)}"></iframe>`
      : `<img class="modal-img" src="${c.image}" alt="${escapeHtml(c.title)}" onerror="this.style.display='none'">`
    }
    <div class="modal-content">
      <h3>${escapeHtml(c.title)}</h3>
      <div class="modal-meta"><span>${escapeHtml(c.category)}</span><span>${escapeHtml(c.platform)}</span><span>${escapeHtml(c.date)}</span></div>
      <p>${escapeHtml(c.description || '')}</p>
      ${c.credentialLink ? `<div class="modal-actions"><a href="${c.credentialLink}" target="_blank" rel="noopener" class="btn btn-primary btn-small">View Credential</a></div>` : ''}
    </div>
  `;
  showModal();
  logActivity(`Certificate Viewed — ${c.title}`);
}

function setupCertFilters() {
  const filterBtns = document.querySelectorAll('#certFilters .filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCertFilter = btn.getAttribute('data-filter');
      renderCertificates();
    });
  });
}

/* ============================================================
   MODAL (shared for projects + certs)
   ============================================================ */
function showModal() {
  document.getElementById('modalOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  document.body.style.overflow = '';
}
function setupModal() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => { if (e.target.id === 'modalOverlay') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}

/* ============================================================
   IT TROUBLESHOOTING LAB
   ============================================================ */
let currentScenarioId = null;

function renderITLab() {
  const itlabSection = document.getElementById('itlab');
  if (!CACHE.itlabEnabled) {
    if (itlabSection) itlabSection.style.display = 'none';
    const navItem = document.querySelector('[data-nav="itlab"]');
    if (navItem) { const li = navItem.closest('li'); if (li) li.style.display = 'none'; }
    return;
  }

  const scenarios = CACHE.itlab.filter(s => s.enabled !== false);
  const list = document.getElementById('itlabList');
  const panel = document.getElementById('itlabPanel');
  if (!list || !panel) return;

  if (!scenarios.length) {
    list.innerHTML = '';
    panel.innerHTML = `<div class="itlab-empty">No scenarios available right now.</div>`;
    return;
  }

  list.innerHTML = scenarios.map(s => `
    <button class="itlab-scenario-btn ${s.id === currentScenarioId ? 'active' : ''}" data-id="${s.id}">${escapeHtml(s.title)}</button>
  `).join('');

  if (!currentScenarioId || !scenarios.find(s => s.id === currentScenarioId)) {
    currentScenarioId = scenarios[0].id;
  }
  renderScenarioPanel(scenarios.find(s => s.id === currentScenarioId));

  list.querySelectorAll('.itlab-scenario-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentScenarioId = btn.getAttribute('data-id');
      list.querySelectorAll('.itlab-scenario-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderScenarioPanel(scenarios.find(s => s.id === currentScenarioId));
    });
  });
}

function renderScenarioPanel(s) {
  const panel = document.getElementById('itlabPanel');
  if (!s) { panel.innerHTML = `<div class="itlab-empty">Select a scenario.</div>`; return; }
  panel.innerHTML = `
    <h3>${escapeHtml(s.title)}</h3>
    <div class="itlab-block"><h5>Problem</h5><p>${escapeHtml(s.problem)}</p></div>
    <div class="itlab-block"><h5>Possible Cause</h5><p>${escapeHtml(s.cause)}</p></div>
    <div class="itlab-block">
      <h5>Troubleshooting Steps</h5>
      <ol>${(s.steps || []).map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
    </div>
    <button class="btn btn-outline btn-small" id="showSolutionBtn">Show Solution</button>
    <div class="itlab-solution" id="itlabSolution"><h5>Solution</h5><p>${escapeHtml(s.solution)}</p></div>
  `;
  document.getElementById('showSolutionBtn').addEventListener('click', () => {
    document.getElementById('itlabSolution').classList.toggle('show');
  });
}

/* ============================================================
   CONTACT FORM
   ============================================================ */
function setupContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('contactName').value.trim();
    const message = document.getElementById('contactMessage').value.trim();
    const errorEl = document.getElementById('formError');
    const successEl = document.getElementById('formSuccess');

    if (!name || !message) {
      errorEl.textContent = 'Please fill in both your name and message.';
      successEl.classList.remove('show');
      return;
    }
    errorEl.textContent = '';
    successEl.classList.add('show');
    form.reset();
    logActivity('Sent a message via Contact form');
  });
}

/* ============================================================
   RESUME DOWNLOAD TRACKING + HIRE ME
   ============================================================ */
function setupResumeTracking() {
  ['downloadResumeBtn', 'resumeSectionBtn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => logActivity('Resume Download'));
  });
}
function setupHireMe() {
  ['hireMeBtn', 'hireMeBtn2'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('contact').scrollIntoView({ behavior: 'smooth' }); });
  });
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function setupNav() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => { hamburger.classList.remove('open'); navLinks.classList.remove('open'); });
  });

  const sections = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav-links a');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navAnchors.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
      }
    });
  }, { rootMargin: '-40% 0px -50% 0px' });
  sections.forEach(sec => observer.observe(sec));
}

/* ============================================================
   BACK TO TOP
   ============================================================ */
function setupBackToTop() {
  const fab = document.getElementById('backToTopFab');
  const btn = document.getElementById('backToTopBtn');
  window.addEventListener('scroll', () => { fab.classList.toggle('show', window.scrollY > 500); });
  function scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  fab.addEventListener('click', scrollTop);
  if (btn) btn.addEventListener('click', scrollTop);
}

/* ============================================================
   SCROLL REVEAL
   ============================================================ */
function setupScrollReveal() {
  const items = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.12 });
  items.forEach(el => observer.observe(el));
}

/* ============================================================
   UTILITIES
   ============================================================ */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

/* ============================================================
   FIRESTORE DATA LOADING
   ============================================================ */
async function loadAllData() {
  // Seed default content into Firestore if this is a brand new project
  await seedFirestoreIfEmpty();

  const [settings, status, skills, journey, projects, certificates, itlab, itlabMeta] = await Promise.all([
    fsGetDoc(FS.SETTINGS_DOC, DEFAULT_SETTINGS),
    fsGetDoc(FS.STATUS_DOC, DEFAULT_STATUS),
    fsGetAll(FS.SKILLS),
    fsGetAll(FS.JOURNEY, 'order'),
    fsGetAll(FS.PROJECTS),
    fsGetAll(FS.CERTS),
    fsGetAll(FS.ITLAB),
    fsGetDoc(FS.ITLAB_META_DOC, { enabled: true })
  ]);

  CACHE.settings = settings;
  CACHE.status = status;
  CACHE.skills = skills;
  CACHE.journey = journey;
  CACHE.projects = projects;
  CACHE.certificates = certificates;
  CACHE.itlab = itlab;
  CACHE.itlabEnabled = itlabMeta.enabled !== false;
}

function hideLoader() {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    loader.classList.add('hide');
    setTimeout(() => loader.remove(), 500);
  }
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('footerYear').textContent = new Date().getFullYear();

  initTheme();
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  try {
    await loadAllData();
  } catch (e) {
    console.error('Failed to load Firestore data — check firebase-config.js keys and Firestore security rules.', e);
  }

  applySectionVisibility();
  renderStatus();
  renderSkills();
  renderJourney();
  renderProjects();
  renderCertificates();
  setupCertFilters();
  renderITLab();

  setupModal();
  setupContactForm();
  setupResumeTracking();
  setupHireMe();
  setupNav();
  setupBackToTop();
  setupScrollReveal();
  setupSectionTracking();

  initWelcomePopup();
  hideLoader();
});
