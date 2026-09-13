/* =========================================================================
   ELITE ACADEMY MANAGEMENT SYSTEM — CORE SHARED MODULE (shared.js)
   -------------------------------------------------------------------------
   PROTOTYPE NOTICE:
   This module currently persists data in the browser's localStorage and
   optionally mirrors it to Firebase Realtime Database for cross-device
   sync during the prototype phase. THIS IS NOT A SECURE PRODUCTION
   ARCHITECTURE. localStorage is publicly readable/writable by anyone with
   access to the browser, and the Firebase config below is a CLIENT KEY,
   not a secret — real security must come from Firebase Realtime Database
   Rules (or a proper backend) before this system goes live with real
   student data. The production version MUST use:
     - A secure backend API
     - Real authentication (not a hardcoded demo password)
     - Server-side authorization / role checks
     - A production-grade database with proper access rules
   ========================================================================= */

/* ============================================================
   0. FIREBASE (OPTIONAL SYNC LAYER)
   ============================================================ */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCljtKMldmy8V2IIEKwnYvVjFcKp2fC33g",
  authDomain: "academy-school-16d1b.firebaseapp.com",
  databaseURL: "https://academy-school-16d1b-default-rtdb.firebaseio.com",
  projectId: "academy-school-16d1b",
  storageBucket: "academy-school-16d1b.firebasestorage.app",
  messagingSenderId: "284992101039",
  appId: "1:284992101039:web:f6a3b834a58db6a037125a"
};

let firebaseDbRef = null;

function initFirebase(){
  // Requires firebase-app-compat.js + firebase-database-compat.js loaded via
  // <script> tags BEFORE shared.js in the HTML file. If not present, the
  // system silently falls back to localStorage-only mode.
  try{
    if(typeof firebase === 'undefined') return;
    if(!firebase.apps || !firebase.apps.length){
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    firebaseDbRef = firebase.database();
  }catch(err){
    console.warn('Firebase not available, continuing in localStorage-only mode.', err);
    firebaseDbRef = null;
  }
}

function syncToFirebase(storeKey, data){
  if(!firebaseDbRef) return;
  try{
    firebaseDbRef.ref(storeKey.replace('eliteAcademy_','')).set(data);
  }catch(err){
    console.warn('Firebase sync failed for', storeKey, err);
  }
}

initFirebase();

/* ============================================================
   1. GLOBAL DATA ARCHITECTURE
   ============================================================ */

const STORE_KEYS = {
  students:      'eliteAcademy_students',
  parents:       'eliteAcademy_parents',
  teachers:      'eliteAcademy_teachers',
  staff:         'eliteAcademy_staff',
  classes:       'eliteAcademy_classes',
  levels:        'eliteAcademy_levels',
  attendance:    'eliteAcademy_attendance',
  payments:      'eliteAcademy_payments',
  expenses:      'eliteAcademy_expenses',
  documents:     'eliteAcademy_documents',
  requests:      'eliteAcademy_requests',
  archive:       'eliteAcademy_archive',
  logs:          'eliteAcademy_logs',
  settings:      'eliteAcademy_settings',
  academicYears: 'eliteAcademy_academicYears',
  session:       'eliteAcademy_session'
};

/** Read an entire store (array) or object (for settings/session). */
function getData(storeKey){
  const raw = localStorage.getItem(storeKey);
  if(!raw) return storeKey === STORE_KEYS.settings || storeKey === STORE_KEYS.session ? null : [];
  try{ return JSON.parse(raw); }
  catch(err){ console.error('Corrupted data for', storeKey, err); return []; }
}

/** Overwrite an entire store. */
function setData(storeKey, value){
  localStorage.setItem(storeKey, JSON.stringify(value));
  syncToFirebase(storeKey, value);
  return value;
}

/** Update one record inside an array-store by id, merging fields. */
function updateData(storeKey, id, updates){
  const list = getData(storeKey);
  const idx = list.findIndex(item => item.id === id);
  if(idx === -1) return null;
  list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
  setData(storeKey, list);
  return list[idx];
}

/** Remove one record permanently (use archiveRecord for soft-delete). */
function deleteData(storeKey, id){
  const list = getData(storeKey);
  const filtered = list.filter(item => item.id !== id);
  setData(storeKey, filtered);
  return filtered;
}

/** Find one record by id inside an array-store. */
function findById(storeKey, id){
  const list = getData(storeKey);
  return list.find(item => item.id === id) || null;
}

/** Generate a unique internal record id (not the visible student card number). */
function generateId(prefix){
  return `${prefix}_${Date.now()}_${Math.floor(Math.random()*100000)}`;
}

/** Append a new record to a store, auto id + timestamps. */
function saveRecord(storeKey, record){
  const list = getData(storeKey);
  const newRecord = {
    id: record.id || generateId(storeKey.replace('eliteAcademy_','').slice(0,3)),
    ...record,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  list.unshift(newRecord);
  setData(storeKey, list);
  return newRecord;
}

/** Update wrapper (alias, kept explicit per spec naming). */
function updateRecord(storeKey, id, updates){
  return updateData(storeKey, id, updates);
}

/** Permanent delete wrapper (alias, kept explicit per spec naming). */
function deleteRecord(storeKey, id){
  return deleteData(storeKey, id);
}

/** Soft-delete: move a record's status to archived and copy into the archive store. */
function archiveRecord(storeKey, id, reason){
  const record = findById(storeKey, id);
  if(!record) return null;

  updateData(storeKey, id, { status: 'مؤرشف', archivedAt: new Date().toISOString() });

  const archiveList = getData(STORE_KEYS.archive);
  archiveList.unshift({
    id: generateId('arc'),
    sourceStore: storeKey,
    sourceId: id,
    snapshot: record,
    reason: reason || '',
    archivedAt: new Date().toISOString()
  });
  setData(STORE_KEYS.archive, archiveList);

  logAction('archive', storeKey, id, `تمت أرشفة السجل ${id}${reason ? ' — السبب: ' + reason : ''}`);
  return record;
}

/** Restore a record's status back to active (data was never destroyed). */
function restoreRecord(storeKey, id){
  const updated = updateData(storeKey, id, { status: 'نشط', restoredAt: new Date().toISOString() });
  if(updated) logAction('restore', storeKey, id, `تمت استعادة السجل ${id} من الأرشيف`);
  return updated;
}

/* ============================================================
   2. STUDENT ID SYSTEM — permanent 8-digit card number
   ============================================================ */

/**
 * Generates a unique, permanent, exactly-8-digit student card number.
 * Verifies against all existing students before assigning.
 * This number is separate from the internal database `id` field and
 * must never change once created.
 */
function generateStudentCardNumber(){
  const students = getData(STORE_KEYS.students);
  const existingNumbers = new Set(students.map(s => s.cardNumber));

  const settings = getSettings();
  let counter = (settings.lastCardNumber || 18426) + 1;
  let candidate = String(counter).padStart(8,'0');

  // Safety loop in case of manual data edits causing collisions
  while(existingNumbers.has(candidate)){
    counter += 1;
    candidate = String(counter).padStart(8,'0');
  }

  updateSettings({ lastCardNumber: counter });
  return candidate;
}

/* ============================================================
   3. REGISTRATION REQUEST SYSTEM
   ============================================================ */

function generateRequestId(){
  const settings = getSettings();
  const year = new Date().getFullYear();
  const next = (settings.lastRequestNumber || 120) + 1;
  updateSettings({ lastRequestNumber: next });
  return `REG-${year}-${String(next).padStart(6,'0')}`;
}

/** Create a new registration request from the public index.html form. */
function createRegistrationRequest(payload){
  const requestId = generateRequestId();
  const record = saveRecord(STORE_KEYS.requests, {
    regNumber: requestId,
    status: 'جديد',
    student: payload.student,
    parent: payload.parent,
    registration: payload.registration || {},
    isDemo: false
  });
  logAction('create', 'requests', record.id, `طلب تسجيل جديد: ${payload.student.firstname} ${payload.student.lastname} (${requestId})`);
  return record;
}

function updateRegistrationRequest(id, updates){
  const updated = updateRecord(STORE_KEYS.requests, id, updates);
  if(updated) logAction('update', 'requests', id, `تحديث طلب التسجيل ${updated.regNumber}`);
  return updated;
}

/**
 * Converts an accepted registration request into a full student record:
 * - preserves the original request id (linked via sourceRequestId)
 * - generates the permanent 8-digit card number
 * - links the parent (creates a parent record if none matches by phone)
 * - links level/class if provided
 * - creates an initial (empty) financial baseline
 * - writes an audit log entry
 * - marks the request as completed
 */
function convertRequestToStudent(requestId, extra){
  const request = findById(STORE_KEYS.requests, requestId);
  if(!request) return null;

  // Link or create the parent record
  let parent = getData(STORE_KEYS.parents).find(p => p.phone === request.parent.phone);
  if(!parent){
    parent = saveRecord(STORE_KEYS.parents, {
      firstname: request.parent.firstname,
      lastname: request.parent.lastname,
      relation: request.parent.relation || 'الأب',
      phone: request.parent.phone,
      phone2: request.parent.phone2 || '',
      email: request.parent.email || '',
      address: request.parent.address || '',
      job: request.parent.job || '',
      isDemo: false
    });
  }

  const cardNumber = generateStudentCardNumber();

  const student = saveRecord(STORE_KEYS.students, {
    cardNumber,
    firstname: request.student.firstname,
    lastname: request.student.lastname,
    fullAr: request.student.fullAr || '',
    fullFr: request.student.fullFr || '',
    dob: request.student.dob || '',
    pob: request.student.pob || '',
    gender: request.student.gender || '',
    nationality: request.student.nationality || 'جزائرية',
    levelId: (extra && extra.levelId) || '',
    level: request.student.level || (extra && extra.level) || '',
    classId: (extra && extra.classId) || '',
    section: (extra && extra.section) || '—',
    parentId: parent.id,
    parentName: `${parent.firstname} ${parent.lastname}`,
    parentPhone: parent.phone,
    academicYearId: (extra && extra.academicYearId) || '',
    sourceRequestId: request.id,
    status: 'نشط',
    notes: request.student.notes || '',
    isDemo: false
  });

  // Initial financial baseline (no payments yet — just a visible starting point)
  const settings = getSettings();
  if(settings.registrationFee){
    saveRecord(STORE_KEYS.payments, {
      receiptNumber: generateReceiptNumber(),
      studentId: student.id,
      studentName: `${student.firstname} ${student.lastname}`,
      cardNumber: student.cardNumber,
      amount: 0,
      reason: 'فتح ملف مالي',
      method: '—',
      date: new Date().toISOString().split('T')[0],
      isDemo: false
    });
  }

  updateRecord(STORE_KEYS.requests, request.id, { status: 'مكتمل التسجيل', convertedStudentId: student.id });

  logAction('convert', 'students', student.id,
    `تم تحويل طلب التسجيل ${request.regNumber} إلى ملف تلميذ (بطاقة ${cardNumber})`);

  return student;
}

function generateReceiptNumber(){
  const settings = getSettings();
  const next = (settings.lastReceiptNumber || 100) + 1;
  updateSettings({ lastReceiptNumber: next });
  return `RC-${new Date().getFullYear()}-${String(next).padStart(5,'0')}`;
}

/* ============================================================
   4. GLOBAL SEARCH
   ============================================================ */

/** Searches across all major entities and returns categorized results. */
function globalSearch(query){
  const q = (query || '').trim();
  const empty = { students:[], parents:[], requests:[], teachers:[], staff:[], documents:[] };
  if(!q) return empty;

  const students = getData(STORE_KEYS.students).filter(s =>
    s.cardNumber === q ||
    `${s.firstname} ${s.lastname}`.includes(q) ||
    (s.fullAr && s.fullAr.includes(q)) ||
    (s.fullFr && s.fullFr.toLowerCase().includes(q.toLowerCase())) ||
    (s.parentPhone && s.parentPhone.includes(q))
  );

  const parents = getData(STORE_KEYS.parents).filter(p =>
    `${p.firstname} ${p.lastname}`.includes(q) || (p.phone && p.phone.includes(q))
  );

  const requests = getData(STORE_KEYS.requests).filter(r =>
    r.regNumber === q || `${r.student.firstname} ${r.student.lastname}`.includes(q)
  );

  const teachers = getData(STORE_KEYS.teachers).filter(t =>
    `${t.firstname} ${t.lastname}`.includes(q)
  );

  const staff = getData(STORE_KEYS.staff).filter(s =>
    `${s.firstname} ${s.lastname}`.includes(q)
  );

  const documents = getData(STORE_KEYS.documents).filter(d =>
    d.name && d.name.includes(q)
  );

  return { students, parents, requests, teachers, staff, documents };
}

/** Convenience: redirect to students.html with a prefilled search term. */
function goToGlobalSearch(query){
  window.location.href = `students.html?search=${encodeURIComponent(query)}`;
}

/* ============================================================
   5. NAVIGATION SYSTEM
   ============================================================ */

const NAV_ITEMS = [
  { key:'dashboard',  icon:'fa-house',                 label:'الرئيسية',              href:'dashboard.html' },
  { key:'students',   icon:'fa-user-graduate',         label:'التلاميذ',              href:'students.html' },
  { key:'requests',   icon:'fa-file-lines',            label:'طلبات التسجيل',        href:'requests.html' },
  { key:'parents',    icon:'fa-people-roof',           label:'الأولياء',              href:'parents.html' },
  { key:'teachers',   icon:'fa-chalkboard-user',       label:'الأساتذة',              href:'teachers.html' },
  { key:'staff',      icon:'fa-id-badge',              label:'الموظفون',              href:'staff.html' },
  { key:'levels',     icon:'fa-layer-group',           label:'المستويات والأقسام',    href:'levels.html' },
  { key:'attendance', icon:'fa-calendar-check',        label:'الحضور والغياب',        href:'attendance.html' },
  { key:'payment',    icon:'fa-sack-dollar',           label:'المالية',               href:'payment.html' },
  { key:'documents',  icon:'fa-folder-open',           label:'الوثائق',               href:'documents.html' },
  { key:'reports',    icon:'fa-chart-simple',          label:'التقارير',              href:'reports.html' },
  { key:'archive',    icon:'fa-box-archive',           label:'الأرشيف',               href:'archive.html' },
  { key:'logs',       icon:'fa-clock-rotate-left',     label:'سجل العمليات',          href:'logs.html' },
  { key:'settings',   icon:'fa-gear',                  label:'إعدادات المؤسسة',       href:'settings.html' }
];

/** Renders the sidebar into <aside id="sidebar"> and marks the active page. */
function renderSidebar(activeKey){
  const sidebarEl = document.getElementById('sidebar');
  if(!sidebarEl) return;

  const settings = getSettings();
  const menuHtml = NAV_ITEMS.map(item => `
    <a href="${item.href}" class="${item.key === activeKey ? 'active' : ''}">
      <i class="fa-solid ${item.icon}"></i> ${item.label}
    </a>
  `).join('');

  sidebarEl.innerHTML = `
    <div class="sidebar-logo">
      <div class="logo-icon"><i class="fa-solid fa-graduation-cap"></i></div>
      <div><h3>${(settings.institutionName || 'أكاديمية النخبة').split(' ').slice(0,2).join(' ')}</h3><span>لوحة الإدارة</span></div>
    </div>
    <nav class="sidebar-menu">
      ${menuHtml}
      <a href="#" class="logout" onclick="EliteAcademy.auth.logout(); return false;">
        <i class="fa-solid fa-arrow-right-from-bracket"></i> تسجيل الخروج
      </a>
    </nav>
  `;

  setupMobileSidebarToggle();
}

function setupMobileSidebarToggle(){
  const sidebar = document.getElementById('sidebar');
  const topbar = document.querySelector('.topbar');
  if(!sidebar || !topbar) return;
  if(topbar.querySelector('.sidebar-toggle-btn')) return;

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'sidebar-toggle-btn';
  toggleBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
  topbar.insertBefore(toggleBtn, topbar.firstChild);

  let overlay = document.querySelector('.sidebar-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  const close = () => { sidebar.classList.remove('mobile-open'); overlay.classList.remove('active'); };
  const toggle = () => { sidebar.classList.toggle('mobile-open'); overlay.classList.toggle('active'); };

  toggleBtn.addEventListener('click', toggle);
  overlay.addEventListener('click', close);
  sidebar.addEventListener('click', e => { if(e.target.closest('a')) close(); });
}

/* ============================================================
   6. SESSION / LOGIN
   ============================================================ */

// PROTOTYPE-ONLY DEMO CREDENTIALS.
// In production this MUST be replaced by real backend authentication
// (hashed passwords, server-issued tokens, role checks server-side).
// This constant intentionally lives only here, inside the auth module.
const DEMO_ADMIN_CREDENTIALS = { username: 'admin', password: 'Elite@2026', role: 'director' };

function login(username, password){
  if(username === DEMO_ADMIN_CREDENTIALS.username && password === DEMO_ADMIN_CREDENTIALS.password){
    const session = {
      authenticated: true,
      role: DEMO_ADMIN_CREDENTIALS.role,
      username,
      loginTime: new Date().toISOString()
    };
    setData(STORE_KEYS.session, session);
    sessionStorage.setItem('eliteAcademy_activeSession', 'true'); // tab-level guard
    logAction('login', 'session', username, 'تسجيل دخول المدير');
    return true;
  }
  return false;
}

function logout(){
  const session = getData(STORE_KEYS.session);
  if(session) logAction('logout', 'session', session.username || 'admin', 'تسجيل خروج المدير');
  localStorage.removeItem(STORE_KEYS.session);
  sessionStorage.removeItem('eliteAcademy_activeSession');
  window.location.href = 'index.html';
}

function getSession(){
  return getData(STORE_KEYS.session);
}

/** Call at the top of every protected admin page. */
function requireAuth(){
  const session = getSession();
  if(!session || session.authenticated !== true || session.role !== 'director'){
    window.location.href = 'login.html';
  }
}

/* ============================================================
   7. AUDIT LOG
   ============================================================ */

/**
 * @param {string} action   e.g. 'create' | 'update' | 'archive' | 'restore' | 'login' | 'logout'
 * @param {string} entity   store name, e.g. 'students' | 'payments' | 'settings'
 * @param {string} entityId the affected record id (or username for session events)
 * @param {string} description human-readable Arabic description
 * @param {string} [type]   'info' | 'success' | 'warning' | 'danger'
 */
function logAction(action, entity, entityId, description, type){
  const logs = getData(STORE_KEYS.logs);
  const now = new Date();
  const session = getSession();
  logs.unshift({
    id: generateId('log'),
    action,
    entity,
    entityId,
    description,
    date: now.toLocaleDateString('ar-DZ'),
    time: now.toLocaleTimeString('ar-DZ', { hour:'2-digit', minute:'2-digit' }),
    timestamp: now.toISOString(),
    user: (session && session.username) || 'admin',
    type: type || 'info'
  });
  setData(STORE_KEYS.logs, logs);
}

/* ============================================================
   8. NOTIFICATION SYSTEM (TOASTS)
   ============================================================ */

function ensureToastContainer(){
  let container = document.getElementById('eaToastContainer');
  if(!container){
    container = document.createElement('div');
    container.id = 'eaToastContainer';
    container.style.cssText = 'position:fixed;top:20px;left:20px;z-index:5000;display:flex;flex-direction:column;gap:10px;max-width:320px;';
    document.body.appendChild(container);
  }
  return container;
}

const TOAST_COLORS = {
  success: { bg:'#eafaf0', border:'#2e9e5b', text:'#1e6b3d', icon:'fa-circle-check' },
  error:   { bg:'#fdecec', border:'#d64545', text:'#8a2323', icon:'fa-circle-xmark' },
  warning: { bg:'#fff7ea', border:'#d4a24c', text:'#8a6d1f', icon:'fa-triangle-exclamation' },
  info:    { bg:'#eaf4f6', border:'#0f4c5c', text:'#0a3540', icon:'fa-circle-info' }
};

function showToast(message, type){
  type = type || 'info';
  const c = TOAST_COLORS[type] || TOAST_COLORS.info;
  const container = ensureToastContainer();

  const toast = document.createElement('div');
  toast.style.cssText = `background:${c.bg};border:1px solid ${c.border};color:${c.text};padding:14px 16px;border-radius:10px;font-family:'Cairo',sans-serif;font-size:13px;font-weight:700;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);animation:eaToastIn .25s ease;`;
  toast.innerHTML = `<i class="fa-solid ${c.icon}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity .3s, transform .3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function showSuccess(message){ showToast(message, 'success'); }
function showError(message){ showToast(message, 'error'); }
function showWarning(message){ showToast(message, 'warning'); }
function showInfo(message){ showToast(message, 'info'); }

// Minimal keyframes injection (kept self-contained; can be moved to style.css later)
(function injectToastKeyframes(){
  if(document.getElementById('eaToastKeyframes')) return;
  const style = document.createElement('style');
  style.id = 'eaToastKeyframes';
  style.textContent = `@keyframes eaToastIn{from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);}}`;
  document.head.appendChild(style);
})();

/* ============================================================
   9. MODAL SYSTEM
   ============================================================ */

function ensureModalRoot(){
  let root = document.getElementById('eaModalRoot');
  if(!root){
    root = document.createElement('div');
    root.id = 'eaModalRoot';
    document.body.appendChild(root);
  }
  return root;
}

/** Opens a generic modal with arbitrary inner HTML. Returns the overlay element. */
function openModal(innerHtml, options){
  options = options || {};
  const root = ensureModalRoot();
  root.innerHTML = `
    <div class="modal-overlay active" id="eaActiveModal">
      <div class="success-modal" style="max-width:${options.maxWidth || '480px'};text-align:${options.align || 'right'};max-height:88vh;overflow-y:auto;">
        ${innerHtml}
      </div>
    </div>
  `;
  return document.getElementById('eaActiveModal');
}

function closeModal(){
  const root = document.getElementById('eaModalRoot');
  if(root) root.innerHTML = '';
}

/** Generic confirm dialog. onConfirm() runs if the user confirms. */
function confirmAction(message, onConfirm, options){
  options = options || {};
  openModal(`
    <div class="success-icon" style="background:rgba(214,69,69,0.12);color:var(--danger);">
      <i class="fa-solid fa-triangle-exclamation"></i>
    </div>
    <h3 style="margin-bottom:10px;text-align:center;">${options.title || 'تأكيد العملية'}</h3>
    <p style="text-align:center;color:var(--text-gray);margin-bottom:20px;">${message}</p>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-danger" id="eaConfirmYes" style="flex:1;justify-content:center;">${options.confirmLabel || 'تأكيد'}</button>
      <button class="btn" style="background:var(--bg-light);flex:1;justify-content:center;" id="eaConfirmNo">إلغاء</button>
    </div>
  `, { maxWidth:'380px', align:'center' });

  document.getElementById('eaConfirmYes').addEventListener('click', () => {
    closeModal();
    if(typeof onConfirm === 'function') onConfirm();
  });
  document.getElementById('eaConfirmNo').addEventListener('click', closeModal);
}

/* ============================================================
   10. FORM HELPERS
   ============================================================ */

function serializeForm(formEl){
  const fd = new FormData(formEl);
  const data = {};
  fd.forEach((value, key) => { data[key] = value; });
  return data;
}

function validateRequired(fields){
  // fields: { fieldName: value, ... } -> returns array of missing field names
  return Object.entries(fields).filter(([, v]) => isEmpty(v)).map(([k]) => k);
}

function isEmpty(value){
  return value === undefined || value === null || String(value).trim() === '';
}

function validatePhone(phone){
  const cleaned = (phone || '').replace(/\s/g,'');
  return /^0[5-7][0-9]{8}$/.test(cleaned);
}

function validateEmail(email){
  if(isEmpty(email)) return true; // email is often optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatDate(isoDate){
  if(!isoDate) return '—';
  const d = new Date(isoDate);
  if(isNaN(d)) return isoDate;
  return d.toLocaleDateString('ar-DZ', { year:'numeric', month:'long', day:'numeric' });
}

function formatCurrency(amount){
  const n = Number(amount || 0);
  return `${n.toLocaleString('en-US')} ${getSettings().currency || 'دج'}`;
}

function findDuplicate(storeKey, field, value, excludeId){
  return getData(storeKey).find(item => item[field] === value && item.id !== excludeId) || null;
}

/* ============================================================
   11. STATUS BADGES (shared UI helper)
   ============================================================ */

function statusBadgeClass(status){
  const map = {
    'جديد':'badge-new', 'قيد الدراسة':'badge-progress', 'تم التواصل':'badge-progress',
    'مقبول':'badge-accepted', 'مكتمل التسجيل':'badge-accepted', 'مرفوض':'badge-rejected',
    'نشط':'badge-accepted', 'مؤرشف':'badge-archived'
  };
  return map[status] || 'badge-new';
}

/* ============================================================
   12. SETTINGS
   ============================================================ */

const DEFAULT_SETTINGS = {
  institutionName: 'أكاديمية النخبة للتعليم والتكوين',
  institutionNameEn: "Elite Academy for Education & Training",
  slogan: 'نحو تعليم أفضل... نحو مستقبل أقوى',
  address: 'شارع الأمير عبد القادر، وسط المدينة، الجزائر',
  phone: '0550 00 00 00',
  email: 'contact@elite-academy.dz',
  logo: '',
  primaryColor: '#0f4c5c',
  secondaryColor: '#d4a24c',
  academicYear: '2025/2026',
  currency: 'دج',
  workingHours: 'الأحد – الخميس، 08:00 – 17:00',
  registrationFee: 5000,
  monthlyFee: 12000,
  lastCardNumber: 18426,
  lastRequestNumber: 120,
  lastReceiptNumber: 100
};

function getSettings(){
  return getData(STORE_KEYS.settings) || { ...DEFAULT_SETTINGS };
}

function updateSettings(updates){
  const current = getSettings();
  const merged = { ...current, ...updates };
  setData(STORE_KEYS.settings, merged);
  return merged;
}

/* ============================================================
   13. DEMO DATA SEEDING (isDemo: true on every seeded record)
   ============================================================ */

function seedDemoDataIfEmpty(){
  if(localStorage.getItem('eliteAcademy_seeded')) return;

  setData(STORE_KEYS.settings, { ...DEFAULT_SETTINGS });

  setData(STORE_KEYS.academicYears, [
    { id:'ay1', label:'2025/2026', isCurrent:true, isDemo:true },
    { id:'ay2', label:'2026/2027', isCurrent:false, isDemo:true },
    { id:'ay3', label:'2027/2028', isCurrent:false, isDemo:true }
  ]);

  setData(STORE_KEYS.levels, [
    {id:'lvl1', name:'تحضيري 1', stage:'تحضيري', isDemo:true}, {id:'lvl2', name:'تحضيري 2', stage:'تحضيري', isDemo:true},
    {id:'lvl3', name:'السنة الأولى ابتدائي', stage:'ابتدائي', isDemo:true}, {id:'lvl4', name:'السنة الثانية ابتدائي', stage:'ابتدائي', isDemo:true},
    {id:'lvl5', name:'السنة الثالثة ابتدائي', stage:'ابتدائي', isDemo:true}, {id:'lvl6', name:'السنة الرابعة ابتدائي', stage:'ابتدائي', isDemo:true},
    {id:'lvl7', name:'السنة الخامسة ابتدائي', stage:'ابتدائي', isDemo:true},
    {id:'lvl8', name:'الأولى متوسط', stage:'متوسط', isDemo:true}, {id:'lvl9', name:'الثانية متوسط', stage:'متوسط', isDemo:true},
    {id:'lvl10', name:'الثالثة متوسط', stage:'متوسط', isDemo:true}, {id:'lvl11', name:'الرابعة متوسط', stage:'متوسط', isDemo:true},
    {id:'lvl12', name:'الأولى ثانوي', stage:'ثانوي', isDemo:true}, {id:'lvl13', name:'الثانية ثانوي', stage:'ثانوي', isDemo:true},
    {id:'lvl14', name:'الثالثة ثانوي', stage:'ثانوي', isDemo:true},
    {id:'lvl15', name:'دروس الدعم', stage:'دعم وتكوين', isDemo:true}, {id:'lvl16', name:'دروس اللغات', stage:'دعم وتكوين', isDemo:true}
  ]);

  const sectionNames = ['4M-A','2P-A','2M-B','1S-A','5P-A','3M-B','1M-A','3P-A','4P-B','2S-A',
    '1P-A','2P-B','3M-A','4M-B','1S-B','2M-A','5P-B','3S-A'];
  setData(STORE_KEYS.classes, sectionNames.map((name,i) => ({
    id:'sec'+(i+1), name, seats:30, mainTeacherId:'', isDemo:true
  })));

  const parentsSeed = [
    {f:'يوسف',l:'بن يوسف',rel:'الأب',phone:'0551 10 20 30',addr:'الجزائر العاصمة',job:'موظف'},
    {f:'خالد',l:'قادري',rel:'الأب',phone:'0661 22 33 44',addr:'وهران',job:'تاجر'},
    {f:'سمير',l:'بن عمر',rel:'الأب',phone:'0551 11 22 33',addr:'قسنطينة',job:'مهندس'},
    {f:'فاطمة',l:'منصوري',rel:'الأم',phone:'0550 44 55 66',addr:'البليدة',job:'معلمة'},
    {f:'نادية',l:'بوعلام',rel:'الأم',phone:'0770 33 44 55',addr:'تيزي وزو',job:'ممرضة'},
    {f:'عمر',l:'مراد',rel:'الأب',phone:'0661 55 66 77',addr:'سطيف',job:'حرفي'},
    {f:'كريم',l:'شريف',rel:'الأب',phone:'0550 66 77 88',addr:'عنابة',job:'موظف'},
    {f:'أمينة',l:'قادري',rel:'الأم',phone:'0551 77 88 99',addr:'وهران',job:'محاسبة'},
    {f:'عبد الرحمان',l:'رحماني',rel:'الأب',phone:'0661 88 99 00',addr:'باتنة',job:'طبيب'},
    {f:'سعاد',l:'بن داود',rel:'الأم',phone:'0770 99 00 11',addr:'الجزائر العاصمة',job:'ربة بيت'}
  ];
  const parents = parentsSeed.map((p,i) => ({
    id:'p'+(i+1), firstname:p.f, lastname:p.l, relation:p.rel, phone:p.phone, phone2:'',
    email:'', address:p.addr, job:p.job, isDemo:true
  }));
  setData(STORE_KEYS.parents, parents);

  const studentsSeed = [
    {f:'أحمد',l:'بن يوسف',fr:'Ahmed Benyoucef',card:'00018427',dob:'2012-03-14',pob:'الجزائر',lvl:'الرابعة متوسط',sec:'4M-A',pIdx:0},
    {f:'سارة',l:'قادري',fr:'Sara Kadri',card:'00018428',dob:'2018-06-22',pob:'وهران',lvl:'السنة الثانية ابتدائي',sec:'2P-A',pIdx:1},
    {f:'ياسين',l:'بن عمر',fr:'Yacine Benomar',card:'00018429',dob:'2013-11-05',pob:'قسنطينة',lvl:'الثانية متوسط',sec:'2M-B',pIdx:2},
    {f:'مريم',l:'منصوري',fr:'Meriem Mansouri',card:'00018430',dob:'2010-01-18',pob:'البليدة',lvl:'الأولى ثانوي',sec:'1S-A',pIdx:3},
    {f:'آدم',l:'بوعلام',fr:'Adam Boualam',card:'00018431',dob:'2016-08-09',pob:'تيزي وزو',lvl:'السنة الخامسة ابتدائي',sec:'5P-A',pIdx:4},
    {f:'ليان',l:'مراد',fr:'Lyna Mourad',card:'00018432',dob:'2013-04-27',pob:'سطيف',lvl:'الثالثة متوسط',sec:'3M-B',pIdx:5},
    {f:'أنس',l:'شريف',fr:'Anes Cherif',card:'00018433',dob:'2014-02-11',pob:'عنابة',lvl:'الأولى متوسط',sec:'1M-A',pIdx:6},
    {f:'نور الهدى',l:'قادري',fr:'Nour El Houda Kadri',card:'00018434',dob:'2017-09-30',pob:'وهران',lvl:'السنة الثالثة ابتدائي',sec:'3P-A',pIdx:7},
    {f:'إلياس',l:'رحماني',fr:'Ilyes Rahmani',card:'00018435',dob:'2016-12-03',pob:'باتنة',lvl:'السنة الرابعة ابتدائي',sec:'4P-B',pIdx:8},
    {f:'ملاك',l:'بن داود',fr:'Malak Bendaoud',card:'00018436',dob:'2011-05-16',pob:'الجزائر',lvl:'الثانية ثانوي',sec:'2S-A',pIdx:9}
  ];
  const students = studentsSeed.map((s,i) => {
    const parent = parents[s.pIdx];
    return {
      id:'st'+(i+1), cardNumber:s.card, firstname:s.f, lastname:s.l, fullFr:s.fr,
      dob:s.dob, pob:s.pob, level:s.lvl, section:s.sec,
      parentId:parent.id, parentName:`${parent.firstname} ${parent.lastname}`, parentPhone:parent.phone,
      status:'نشط', registeredAt:'2025-09-0'+((i%9)+1), notes:'', isDemo:true
    };
  });
  setData(STORE_KEYS.students, students);

  setData(STORE_KEYS.requests, [
    {id:'req1', regNumber:'REG-2026-000124', status:'جديد', createdAt:'2026-09-08', student:{firstname:'ياسين',lastname:'بن عمر جديد',level:'2 متوسط'}, parent:{firstname:'سمير',lastname:'بن عمر',phone:'0551 11 22 33'}, isDemo:true},
    {id:'req2', regNumber:'REG-2026-000123', status:'قيد الدراسة', createdAt:'2026-09-08', student:{firstname:'مريم',lastname:'قادري',level:'1 ثانوي'}, parent:{firstname:'خالد',lastname:'قادري',phone:'0661 22 33 44'}, isDemo:true},
    {id:'req3', regNumber:'REG-2026-000122', status:'مقبول', createdAt:'2026-09-07', student:{firstname:'آدم',lastname:'بوعلام',level:'4 ابتدائي'}, parent:{firstname:'نادية',lastname:'بوعلام',phone:'0770 33 44 55'}, isDemo:true},
    {id:'req4', regNumber:'REG-2026-000121', status:'جديد', createdAt:'2026-09-07', student:{firstname:'سارة',lastname:'منصوري',level:'3 متوسط'}, parent:{firstname:'عبد القادر',lastname:'منصوري',phone:'0550 44 55 66'}, isDemo:true}
  ]);

  const teacherFirstNames = ['محمد','أحمد','خالد','سمير','كريم','ياسين','عمر','بلال','رياض','فارس','نبيل','طارق','أمين','حسام','وليد','فؤاد','مراد','هشام','زكرياء','إسلام','عادل','رشيد','ناصر','سفيان'];
  const teacherLastNames = ['بلحاج','زروقي','مرزوقي','بوزيد','حمداني','شريفي','بن علي','قاسمي','بوجمعة','عثماني'];
  const subjects = ['الرياضيات','اللغة العربية','اللغة الفرنسية','اللغة الإنجليزية','العلوم الطبيعية','الفيزياء','التاريخ والجغرافيا','التربية الإسلامية','الإعلام الآلي'];
  const teachers = [];
  for(let i=0;i<24;i++){
    teachers.push({
      id:'t'+(i+1), firstname:teacherFirstNames[i % teacherFirstNames.length], lastname:teacherLastNames[i % teacherLastNames.length],
      subject:subjects[i % subjects.length], phone:`05${50+i} 0${i}0 ${10+i}0 ${20+i}0`.slice(0,13),
      qualification:'ليسانس/ماستر في التربية', section:sectionNames[i % sectionNames.length],
      hireDate:'2020-09-01', contractType: i % 4 === 0 ? 'دوام جزئي' : 'دوام كامل', salary:45000+(i%5)*3000, isDemo:true
    });
  }
  setData(STORE_KEYS.teachers, teachers);

  const staffRoles = ['سكرتير','محاسب','مشرف','عامل إداري','عامل صيانة','حارس','مسؤول إداري'];
  const staffNames = [
    {f:'سعيد',l:'براهيمي'},{f:'ليلى',l:'حمدي'},{f:'فريد',l:'مالكي'},{f:'سامية',l:'دراجي'},
    {f:'حكيم',l:'بوطالب'},{f:'وردة',l:'عزوز'},{f:'جمال',l:'صالحي'},{f:'إيمان',l:'شاوش'},
    {f:'عبد الله',l:'قدور'},{f:'رانيا',l:'بلعيد'},{f:'يوسف',l:'تومي'},{f:'حنان',l:'ونيسي'}
  ];
  setData(STORE_KEYS.staff, staffNames.map((s,i) => ({
    id:'staff'+(i+1), firstname:s.f, lastname:s.l, role:staffRoles[i % staffRoles.length],
    phone:`0550 ${10+i} ${20+i} ${30+i}`, hireDate:'2021-01-10', salary:35000+(i%4)*2000, isDemo:true
  })));

  const payments = [];
  students.forEach((s,i) => {
    payments.push({
      id:generateId('pay'), receiptNumber:`RC-2026-${String(1000+i)}`, studentId:s.id, studentName:`${s.firstname} ${s.lastname}`,
      cardNumber:s.cardNumber, amount:12000, reason:'القسط الشهري', method:i%2===0?'نقدًا':'تحويل بنكي',
      date:'2026-09-0'+((i%9)+1), isDemo:true
    });
    if(i % 2 === 0){
      payments.push({
        id:generateId('pay'), receiptNumber:`RC-2026-${String(2000+i)}`, studentId:s.id, studentName:`${s.firstname} ${s.lastname}`,
        cardNumber:s.cardNumber, amount:5000, reason:'رسوم التسجيل', method:'نقدًا', date:'2026-09-01', isDemo:true
      });
    }
  });
  setData(STORE_KEYS.payments, payments);

  setData(STORE_KEYS.expenses, [
    {id:generateId('exp'), reason:'رواتب الأساتذة', amount:1080000, date:'2026-09-05', isDemo:true},
    {id:generateId('exp'), reason:'رواتب الموظفين', amount:216000, date:'2026-09-05', isDemo:true},
    {id:generateId('exp'), reason:'صيانة وتجهيزات', amount:85000, date:'2026-09-02', isDemo:true},
    {id:generateId('exp'), reason:'فواتير كهرباء وماء', amount:32000, date:'2026-09-01', isDemo:true}
  ]);

  const attendance = [];
  students.slice(0,6).forEach((s,i) => {
    attendance.push({
      id:generateId('att'), studentId:s.id, studentName:`${s.firstname} ${s.lastname}`,
      section:s.section, date:'2026-09-08', status: i%4===0 ? 'غائب' : (i%4===1 ? 'متأخر' : 'حاضر'), isDemo:true
    });
  });
  setData(STORE_KEYS.attendance, attendance);

  setData(STORE_KEYS.documents, [
    {id:generateId('doc'), studentId:students[0].id, name:'شهادة الميلاد', type:'شهادة الميلاد', status:'متوفرة', isDemo:true},
    {id:generateId('doc'), studentId:students[1].id, name:'صورة شخصية', type:'صورة شخصية', status:'ناقصة', isDemo:true}
  ]);

  setData(STORE_KEYS.archive, []);

  setData(STORE_KEYS.logs, [
    {id:generateId('log'), action:'create', entity:'students', entityId:students[0].id, description:'تم تسجيل التلميذ أحمد بن يوسف', date:'08/09/2026', time:'10:24', user:'admin', type:'success'},
    {id:generateId('log'), action:'update', entity:'students', entityId:students[1].id, description:'تم تعديل بيانات التلميذة سارة قادري', date:'08/09/2026', time:'11:10', user:'admin', type:'info'},
    {id:generateId('log'), action:'create', entity:'payments', entityId:'', description:'تم تسجيل دفعة بقيمة 12,000 دج', date:'07/09/2026', time:'09:45', user:'admin', type:'success'},
    {id:generateId('log'), action:'convert', entity:'requests', entityId:'', description:'تم قبول طلب REG-2026-000122', date:'07/09/2026', time:'14:02', user:'admin', type:'success'}
  ]);

  localStorage.setItem('eliteAcademy_seeded', 'true');
}

seedDemoDataIfEmpty();

/* ============================================================
   16. PUBLIC NAMESPACE — window.EliteAcademy
   ============================================================ */

window.EliteAcademy = {
  storage: {
    keys: STORE_KEYS,
    getData, setData, updateData, deleteData, findById, generateId,
    saveRecord, updateRecord, deleteRecord, archiveRecord, restoreRecord
  },
  students: {
    generateCardNumber: generateStudentCardNumber
  },
  requests: {
    generateRequestId, createRegistrationRequest, updateRegistrationRequest, convertRequestToStudent
  },
  finance: {
    generateReceiptNumber, formatCurrency
  },
  attendance: {
    // dedicated attendance helpers can grow here as attendance.html is rebuilt
  },
  documents: {
    // dedicated document helpers can grow here as documents.html is rebuilt
  },
  search: {
    globalSearch, goToGlobalSearch
  },
  navigation: {
    items: NAV_ITEMS, renderSidebar, setupMobileSidebarToggle
  },
  auth: {
    login, logout, getSession, requireAuth
  },
  notifications: {
    showToast, showSuccess, showError, showWarning, showInfo
  },
  modal: {
    openModal, closeModal, confirmAction
  },
  utils: {
    serializeForm, validateRequired, isEmpty, validatePhone, validateEmail,
    formatDate, formatCurrency, findDuplicate, statusBadgeClass,
    getSettings, updateSettings, logAction
  }
};
