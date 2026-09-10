/* =========================================================
   ELITE ACADEMY - SHARED CORE
   ملاحظة: LocalStorage مناسب للـ Prototype فقط.
   النسخة الإنتاجية يجب أن تعتمد على Backend + Firebase + Authentication آمن.
   ========================================================= */

const ADMIN_CREDENTIALS = { username: 'admin', password: 'Elite@2026' };

/* ============ DB LAYER ============ */
const DB = {
  get(key){ return JSON.parse(localStorage.getItem(key) || '[]'); },
  set(key, value){ localStorage.setItem(key, JSON.stringify(value)); },
  getSettings(){
    return JSON.parse(localStorage.getItem('eliteSettings') || 'null') || {
      institutionName: 'أكاديمية النخبة للتعليم والتكوين',
      institutionNameFr: "Elite Academy d'Éducation et de Formation",
      slogan: 'نحو تعليم أفضل... نحو مستقبل أقوى',
      address: 'شارع الأمير عبد القادر، وسط المدينة، الجزائر',
      phone: '0550 00 00 00',
      email: 'contact@elite-academy.dz',
      workHours: 'الأحد – الخميس، 08:00 – 17:00',
      schoolYear: '2025/2026',
      registrationFee: 5000,
      monthlyFee: 12000,
      lastRegNumber: 124,
      lastCardNumber: 18436,
      lastReceiptNumber: 100
    };
  },
  setSettings(s){ localStorage.setItem('eliteSettings', JSON.stringify(s)); }
};

/* ============ ID / NUMBER GENERATORS ============ */
function generateRegNumber(){
  const s = DB.getSettings();
  const year = new Date().getFullYear();
  s.lastRegNumber += 1;
  DB.setSettings(s);
  return `REG-${year}-${String(s.lastRegNumber).padStart(6,'0')}`;
}

function generateCardNumber(){
  const s = DB.getSettings();
  s.lastCardNumber += 1;
  DB.setSettings(s);
  return String(s.lastCardNumber).padStart(8,'0');
}

function generateReceiptNumber(){
  const s = DB.getSettings();
  s.lastReceiptNumber += 1;
  DB.setSettings(s);
  return `RC-${new Date().getFullYear()}-${String(s.lastReceiptNumber).padStart(5,'0')}`;
}

function uid(prefix){ return `${prefix}_${Date.now()}_${Math.floor(Math.random()*1000)}`; }

/* ============ AUDIT LOG ============ */
function logAction(text){
  const logs = DB.get('eliteLogs');
  const now = new Date();
  logs.unshift({
    id: uid('log'),
    text,
    date: now.toLocaleDateString('ar-DZ'),
    time: now.toLocaleTimeString('ar-DZ', {hour:'2-digit', minute:'2-digit'}),
    timestamp: now.toISOString()
  });
  DB.set('eliteLogs', logs);
}

/* ============ STATUS BADGE HELPERS ============ */
function statusBadgeClass(status){
  const map = {
    'جديد':'badge-new', 'قيد الدراسة':'badge-progress', 'تم التواصل':'badge-progress',
    'مقبول':'badge-accepted', 'مكتمل التسجيل':'badge-accepted', 'مرفوض':'badge-rejected',
    'نشط':'badge-accepted', 'مؤرشف':'badge-archived'
  };
  return map[status] || 'badge-new';
}

/* ============ AUTH GUARD ============ */
// ضع هذا في أعلى كل صفحة إدارية (dashboard, students, payment, ...)
function requireAdminAuth(){
  if(sessionStorage.getItem('eliteAdminLoggedIn') !== 'true'){
    window.location.href = 'login.html';
  }
}
function logoutAdmin(){
  sessionStorage.removeItem('eliteAdminLoggedIn');
  window.location.href = 'index.html';
}

/* ============ SIDEBAR INJECTION ============ */
const SIDEBAR_ITEMS = [
  { icon:'fa-house', label:'الرئيسية', href:'dashboard.html', key:'dashboard' },
  { icon:'fa-user-graduate', label:'التلاميذ', href:'students.html', key:'students' },
  { icon:'fa-file-lines', label:'طلبات التسجيل', href:'requests.html', key:'requests' },
  { icon:'fa-people-roof', label:'الأولياء', href:'parents.html', key:'parents' },
  { icon:'fa-chalkboard-user', label:'الأساتذة', href:'teachers.html', key:'teachers' },
  { icon:'fa-id-badge', label:'الموظفون', href:'staff.html', key:'staff' },
  { icon:'fa-layer-group', label:'المستويات والأقسام', href:'levels.html', key:'levels' },
  { icon:'fa-calendar-check', label:'الحضور والغياب', href:'attendance.html', key:'attendance' },
  { icon:'fa-sack-dollar', label:'المالية', href:'payment.html', key:'payment' },
  { icon:'fa-folder-open', label:'الوثائق', href:'documents.html', key:'documents' },
  { icon:'fa-chart-simple', label:'التقارير', href:'reports.html', key:'reports' },
  { icon:'fa-box-archive', label:'الأرشيف', href:'archive.html', key:'archive' },
  { icon:'fa-gear', label:'إعدادات المؤسسة', href:'settings.html', key:'settings' },
  { icon:'fa-clock-rotate-left', label:'سجل العمليات', href:'logs.html', key:'logs' }
];

function renderSidebar(activeKey){
  const settings = DB.getSettings();
  const menuHtml = SIDEBAR_ITEMS.map(item => `
    <a href="${item.href}" class="${item.key === activeKey ? 'active' : ''}">
      <i class="fa-solid ${item.icon}"></i> ${item.label}
    </a>
  `).join('');

  const sidebarHtml = `
    <div class="sidebar-logo">
      <div class="logo-icon"><i class="fa-solid fa-graduation-cap"></i></div>
      <div><h3>${settings.institutionName.split(' ').slice(0,2).join(' ')}</h3><span>لوحة الإدارة</span></div>
    </div>
    <nav class="sidebar-menu">
      ${menuHtml}
      <a href="#" class="logout" onclick="logoutAdmin(); return false;">
        <i class="fa-solid fa-arrow-right-from-bracket"></i> تسجيل الخروج
      </a>
    </nav>
  `;
  const sidebarEl = document.getElementById('sidebar');
  if(sidebarEl) sidebarEl.innerHTML = sidebarHtml;
}

/* ============ TOPBAR GLOBAL SEARCH ============ */
function globalSearch(query){
  query = query.trim();
  if(!query) return { students:[], parents:[], teachers:[], staff:[], requests:[] };

  const students = DB.get('eliteStudents').filter(s =>
    s.cardNumber === query ||
    `${s.firstname} ${s.lastname}`.includes(query) ||
    (s.parentPhone && s.parentPhone.includes(query))
  );
  const requests = DB.get('eliteRegistrationRequests').filter(r =>
    r.regNumber === query ||
    `${r.student.firstname} ${r.student.lastname}`.includes(query)
  );
  const parents = DB.get('eliteParents').filter(p =>
    `${p.firstname} ${p.lastname}`.includes(query) || (p.phone && p.phone.includes(query))
  );
  const teachers = DB.get('eliteTeachers').filter(t => `${t.firstname} ${t.lastname}`.includes(query));
  const staff = DB.get('eliteStaff').filter(s => `${s.firstname} ${s.lastname}`.includes(query));

  return { students, parents, teachers, staff, requests };
}

/* ============ SEED DEMO DATA (runs once) ============ */
function seedDemoDataIfEmpty(){
  if(!localStorage.getItem('eliteSeeded')){

    // ----- LEVELS -----
    DB.set('eliteLevels', [
      {id:'lvl1', name:'تحضيري 1', stage:'تحضيري'}, {id:'lvl2', name:'تحضيري 2', stage:'تحضيري'},
      {id:'lvl3', name:'السنة الأولى ابتدائي', stage:'ابتدائي'}, {id:'lvl4', name:'السنة الثانية ابتدائي', stage:'ابتدائي'},
      {id:'lvl5', name:'السنة الثالثة ابتدائي', stage:'ابتدائي'}, {id:'lvl6', name:'السنة الرابعة ابتدائي', stage:'ابتدائي'},
      {id:'lvl7', name:'السنة الخامسة ابتدائي', stage:'ابتدائي'},
      {id:'lvl8', name:'الأولى متوسط', stage:'متوسط'}, {id:'lvl9', name:'الثانية متوسط', stage:'متوسط'},
      {id:'lvl10', name:'الثالثة متوسط', stage:'متوسط'}, {id:'lvl11', name:'الرابعة متوسط', stage:'متوسط'},
      {id:'lvl12', name:'الأولى ثانوي', stage:'ثانوي'}, {id:'lvl13', name:'الثانية ثانوي', stage:'ثانوي'},
      {id:'lvl14', name:'الثالثة ثانوي', stage:'ثانوي'}
    ]);

    // ----- SECTIONS (18 أقسام) -----
    const sectionNames = ['4M-A','2P-A','2M-B','1S-A','5P-A','3M-B','1M-A','3P-A','4P-B','2S-A',
      '1P-A','2P-B','3M-A','4M-B','1S-B','2M-A','5P-B','3S-A'];
    DB.set('eliteSections', sectionNames.map((name,i) => ({
      id:'sec'+(i+1), name, seats:30, mainTeacher:'—'
    })));

    // ----- PARENTS -----
    const parents = [
      {id:'p1', firstname:'يوسف', lastname:'بن يوسف', relation:'الأب', phone:'0551 10 20 30', phone2:'', email:'', address:'الجزائر العاصمة', job:'موظف'},
      {id:'p2', firstname:'خالد', lastname:'قادري', relation:'الأب', phone:'0661 22 33 44', phone2:'', email:'', address:'وهران', job:'تاجر'},
      {id:'p3', firstname:'سمير', lastname:'بن عمر', relation:'الأب', phone:'0551 11 22 33', phone2:'', email:'', address:'قسنطينة', job:'مهندس'},
      {id:'p4', firstname:'فاطمة', lastname:'منصوري', relation:'الأم', phone:'0550 44 55 66', phone2:'', email:'', address:'البليدة', job:'معلمة'},
      {id:'p5', firstname:'نادية', lastname:'بوعلام', relation:'الأم', phone:'0770 33 44 55', phone2:'', email:'', address:'تيزي وزو', job:'ممرضة'},
      {id:'p6', firstname:'عمر', lastname:'مراد', relation:'الأب', phone:'0661 55 66 77', phone2:'', email:'', address:'سطيف', job:'حرفي'},
      {id:'p7', firstname:'كريم', lastname:'شريف', relation:'الأب', phone:'0550 66 77 88', phone2:'', email:'', address:'عنابة', job:'موظف'},
      {id:'p8', firstname:'أمينة', lastname:'قادري', relation:'الأم', phone:'0551 77 88 99', phone2:'', email:'', address:'وهران', job:'محاسبة'},
      {id:'p9', firstname:'عبد الرحمان', lastname:'رحماني', relation:'الأب', phone:'0661 88 99 00', phone2:'', email:'', address:'باتنة', job:'طبيب'},
      {id:'p10', firstname:'سعاد', lastname:'بن داود', relation:'الأم', phone:'0770 99 00 11', phone2:'', email:'', address:'الجزائر العاصمة', job:'ربة بيت'}
    ];
    DB.set('eliteParents', parents);

    // ----- STUDENTS (10 تلاميذ) -----
    const students = [
      {id:'st1', cardNumber:'00018427', firstname:'أحمد', lastname:'بن يوسف', fullFr:'Ahmed Benyoucef', dob:'2012-03-14', pob:'الجزائر', level:'الرابعة متوسط', section:'4M-A', parentId:'p1', parentName:'يوسف بن يوسف', parentPhone:'0551 10 20 30', status:'نشط', registeredAt:'2025-09-01'},
      {id:'st2', cardNumber:'00018428', firstname:'سارة', lastname:'قادري', fullFr:'Sara Kadri', dob:'2018-06-22', pob:'وهران', level:'السنة الثانية ابتدائي', section:'2P-A', parentId:'p2', parentName:'خالد قادري', parentPhone:'0661 22 33 44', status:'نشط', registeredAt:'2025-09-01'},
      {id:'st3', cardNumber:'00018429', firstname:'ياسين', lastname:'بن عمر', fullFr:'Yacine Benomar', dob:'2013-11-05', pob:'قسنطينة', level:'الثانية متوسط', section:'2M-B', parentId:'p3', parentName:'سمير بن عمر', parentPhone:'0551 11 22 33', status:'نشط', registeredAt:'2025-09-02'},
      {id:'st4', cardNumber:'00018430', firstname:'مريم', lastname:'منصوري', fullFr:'Meriem Mansouri', dob:'2010-01-18', pob:'البليدة', level:'الأولى ثانوي', section:'1S-A', parentId:'p4', parentName:'فاطمة منصوري', parentPhone:'0550 44 55 66', status:'نشط', registeredAt:'2025-09-03'},
      {id:'st5', cardNumber:'00018431', firstname:'آدم', lastname:'بوعلام', fullFr:'Adam Boualam', dob:'2016-08-09', pob:'تيزي وزو', level:'السنة الخامسة ابتدائي', section:'5P-A', parentId:'p5', parentName:'نادية بوعلام', parentPhone:'0770 33 44 55', status:'نشط', registeredAt:'2025-09-04'},
      {id:'st6', cardNumber:'00018432', firstname:'ليان', lastname:'مراد', fullFr:'Lyna Mourad', dob:'2013-04-27', pob:'سطيف', level:'الثالثة متوسط', section:'3M-B', parentId:'p6', parentName:'عمر مراد', parentPhone:'0661 55 66 77', status:'نشط', registeredAt:'2025-09-04'},
      {id:'st7', cardNumber:'00018433', firstname:'أنس', lastname:'شريف', fullFr:'Anes Cherif', dob:'2014-02-11', pob:'عنابة', level:'الأولى متوسط', section:'1M-A', parentId:'p7', parentName:'كريم شريف', parentPhone:'0550 66 77 88', status:'نشط', registeredAt:'2025-09-05'},
      {id:'st8', cardNumber:'00018434', firstname:'نور الهدى', lastname:'قادري', fullFr:'Nour El Houda Kadri', dob:'2017-09-30', pob:'وهران', level:'السنة الثالثة ابتدائي', section:'3P-A', parentId:'p8', parentName:'أمينة قادري', parentPhone:'0551 77 88 99', status:'نشط', registeredAt:'2025-09-05'},
      {id:'st9', cardNumber:'00018435', firstname:'إلياس', lastname:'رحماني', fullFr:'Ilyes Rahmani', dob:'2016-12-03', pob:'باتنة', level:'السنة الرابعة ابتدائي', section:'4P-B', parentId:'p9', parentName:'عبد الرحمان رحماني', parentPhone:'0661 88 99 00', status:'نشط', registeredAt:'2025-09-06'},
      {id:'st10', cardNumber:'00018436', firstname:'ملاك', lastname:'بن داود', fullFr:'Malak Bendaoud', dob:'2011-05-16', pob:'الجزائر', level:'الثانية ثانوي', section:'2S-A', parentId:'p10', parentName:'سعاد بن داود', parentPhone:'0770 99 00 11', status:'نشط', registeredAt:'2025-09-06'}
    ];
    DB.set('eliteStudents', students);

    // ----- REGISTRATION REQUESTS -----
    DB.set('eliteRegistrationRequests', [
      {id:'req1', regNumber:'REG-2026-000124', status:'جديد', createdAt:'2026-09-08', student:{firstname:'ياسين',lastname:'بن عمر جديد',level:'2 متوسط'}, parent:{firstname:'سمير',lastname:'بن عمر',phone:'0551 11 22 33'}},
      {id:'req2', regNumber:'REG-2026-000123', status:'قيد الدراسة', createdAt:'2026-09-08', student:{firstname:'مريم',lastname:'قادري',level:'1 ثانوي'}, parent:{firstname:'خالد',lastname:'قادري',phone:'0661 22 33 44'}},
      {id:'req3', regNumber:'REG-2026-000122', status:'مقبول', createdAt:'2026-09-07', student:{firstname:'آدم',lastname:'بوعلام',level:'4 ابتدائي'}, parent:{firstname:'نادية',lastname:'بوعلام',phone:'0770 33 44 55'}},
      {id:'req4', regNumber:'REG-2026-000121', status:'جديد', createdAt:'2026-09-07', student:{firstname:'سارة',lastname:'منصوري',level:'3 متوسط'}, parent:{firstname:'عبد القادر',lastname:'منصوري',phone:'0550 44 55 66'}}
    ]);

    // ----- TEACHERS (24) -----
    const teacherFirstNames = ['محمد','أحمد','خالد','سمير','كريم','ياسين','عمر','بلال','رياض','فارس','نبيل','طارق','أمين','حسام','وليد','فؤاد','مراد','هشام','زكرياء','إسلام','عادل','رشيد','ناصر','سفيان'];
    const teacherLastNames = ['بلحاج','زروقي','مرزوقي','بوزيد','حمداني','شريفي','بن علي','قاسمي','بوجمعة','عثماني'];
    const subjects = ['الرياضيات','اللغة العربية','اللغة الفرنسية','اللغة الإنجليزية','العلوم الطبيعية','الفيزياء','التاريخ والجغرافيا','التربية الإسلامية','الإعلام الآلي'];
    const teachers = [];
    for(let i=0;i<24;i++){
      teachers.push({
        id:'t'+(i+1),
        firstname: teacherFirstNames[i % teacherFirstNames.length],
        lastname: teacherLastNames[i % teacherLastNames.length],
        subject: subjects[i % subjects.length],
        phone: `05${50+i} 0${i}0 ${10+i}0 ${20+i}0`.slice(0,13),
        qualification:'ليسانس/ماستر في التربية',
        section: sectionNames[i % sectionNames.length],
        hireDate:'2020-09-01',
        contractType: i % 4 === 0 ? 'دوام جزئي' : 'دوام كامل',
        salary: 45000 + (i%5)*3000
      });
    }
    DB.set('eliteTeachers', teachers);

    // ----- STAFF (12) -----
    const staffRoles = ['سكرتير','محاسب','مشرف','عامل إداري','عامل صيانة','حارس','مسؤول إداري'];
    const staffNames = [
      {f:'سعيد',l:'براهيمي'},{f:'ليلى',l:'حمدي'},{f:'فريد',l:'مالكي'},{f:'سامية',l:'دراجي'},
      {f:'حكيم',l:'بوطالب'},{f:'وردة',l:'عزوز'},{f:'جمال',l:'صالحي'},{f:'إيمان',l:'شاوش'},
      {f:'عبد الله',l:'قدور'},{f:'رانيا',l:'بلعيد'},{f:'يوسف',l:'تومي'},{f:'حنان',l:'ونيسي'}
    ];
    DB.set('eliteStaff', staffNames.map((s,i) => ({
      id:'staff'+(i+1), firstname:s.f, lastname:s.l, role: staffRoles[i % staffRoles.length],
      phone:`0550 ${10+i} ${20+i} ${30+i}`, hireDate:'2021-01-10', salary: 35000 + (i%4)*2000
    })));

    // ----- PAYMENTS (20+ عملية) -----
    const payments = [];
    students.forEach((s,i) => {
      payments.push({
        id:uid('pay'), receiptNumber:`RC-2026-${String(1000+i)}`, studentId:s.id, studentName:`${s.firstname} ${s.lastname}`,
        cardNumber:s.cardNumber, amount:12000, reason:'القسط الشهري', method: i%2===0 ? 'نقدًا':'تحويل بنكي',
        date:'2026-09-0'+((i%9)+1)
      });
      if(i % 2 === 0){
        payments.push({
          id:uid('pay'), receiptNumber:`RC-2026-${String(2000+i)}`, studentId:s.id, studentName:`${s.firstname} ${s.lastname}`,
          cardNumber:s.cardNumber, amount:5000, reason:'رسوم التسجيل', method:'نقدًا', date:'2026-09-01'
        });
      }
    });
    DB.set('elitePayments', payments);

    // ----- ATTENDANCE (سجلات تجريبية) -----
    const attendance = [];
    students.slice(0,6).forEach((s,i) => {
      attendance.push({
        id:uid('att'), studentId:s.id, studentName:`${s.firstname} ${s.lastname}`,
        section:s.section, date:'2026-09-08', status: i%4===0 ? 'غائب' : (i%4===1 ? 'متأخر' : 'حاضر')
      });
    });
    DB.set('eliteAttendance', attendance);

    // ----- LOGS -----
    DB.set('eliteLogs', [
      {id:uid('log'), text:'تم تسجيل التلميذ أحمد بن يوسف', date:'08/09/2026', time:'10:24'},
      {id:uid('log'), text:'تم تعديل بيانات التلميذة سارة قادري', date:'08/09/2026', time:'11:10'},
      {id:uid('log'), text:'تم تسجيل دفعة بقيمة 12,000 دج', date:'07/09/2026', time:'09:45'},
      {id:uid('log'), text:'تم قبول طلب REG-2026-000122', date:'07/09/2026', time:'14:02'}
    ]);

    localStorage.setItem('eliteSeeded', 'true');
  }
}

/* Run seeding immediately when this script loads on any admin page */
seedDemoDataIfEmpty();
