/**
 * صفحة لتعليم مناهج الثانوية
 * مدرسة التناغة الشرقية الثانوية المشتركة
 * Production SPA — local-first persistent storage
 */
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const now = () => Date.now();
const today = () => new Date().toISOString().slice(0, 10);
const fmt = ts => new Date(ts).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

const ROLE = { student: 'طالب', teacher: 'مدرس', parent: 'ولي أمر', admin: 'الإدارة' };
const GR = { '1': 'الصف الأول الثانوي', '2': 'الصف الثاني الثانوي', '3': 'الصف الثالث الثانوي' };
const KIND = { lesson: 'درس', video: 'فيديو', pdf: 'PDF', word: 'Word', ppt: 'PowerPoint', hw: 'واجب', link: 'رابط' };

const SUBJECTS = [
  { id: 'ar', icon: 'book', name: 'اللغة العربية', teacher: 'أ. محمود عبد الرحمن', desc: 'النحو والصرف والبلاغة والأدب والنصوص.' },
  { id: 'en', icon: 'globe', name: 'اللغة الإنجليزية', teacher: 'أ. سارة إبراهيم', desc: 'قواعد ومفردات واستماع وكتابة.' },
  { id: 'math', icon: 'math', name: 'الرياضيات', teacher: 'أ. أحمد فتحي', desc: 'الجبر والمثلثات والهندسة والتفاضل.' },
  { id: 'phy', icon: 'atom', name: 'الفيزياء', teacher: 'أ. خالد النجار', desc: 'الحركة والقوى والكهرباء والمغناطيسية.' },
  { id: 'chem', icon: 'flask', name: 'الكيمياء', teacher: 'أ. منى حسين', desc: 'الكيمياء العضوية وغير العضوية والمعادلات.' },
  { id: 'bio', icon: 'leaf', name: 'الأحياء', teacher: 'أ. عمرو سعيد', desc: 'الخلية والأنسجة والوراثة والفسيولوجيا.' },
  { id: 'hist', icon: 'hist', name: 'التاريخ', teacher: 'أ. هالة محمد', desc: 'تاريخ مصر والعالم الحديث والمعاصر.' },
  { id: 'geo', icon: 'map', name: 'الجغرافيا', teacher: 'أ. ياسر عبد الله', desc: 'جغرافيا مصر والوطن العربي والعالم.' },
  { id: 'phil', icon: 'brain', name: 'الفلسفة', teacher: 'أ. سمير رشاد', desc: 'قضايا الفلسفة والمنطق والتفكير الناقد.' },
  { id: 'psy', icon: 'brain', name: 'علم النفس', teacher: 'أ. نادية حسن', desc: 'مدخل إلى علم النفس والسلوك.' },
  { id: 'fr', icon: 'flag', name: 'اللغة الفرنسية', teacher: 'أ. دنيا مصطفى', desc: 'القواعد والمفردات والنطق.' }
];

const TEACHERS_LIST = [
  { name: 'محمود عبد الرحمن', role: 'مدرس أول اللغة العربية', subj: 'اللغة العربية', bio: 'خبرة تزيد على خمسة عشر عامًا، متخصص في النحو والبلاغة.', av: 'مع' },
  { name: 'سارة إبراهيم', role: 'مدرسة اللغة الإنجليزية', subj: 'اللغة الإنجليزية', bio: 'تركيز على المهارات الأربع والمحادثة الأكاديمية.', av: 'سا' },
  { name: 'أحمد فتحي', role: 'مدرس الرياضيات', subj: 'الرياضيات', bio: 'شرح مبسط مع بنك أسئلة وحل مسائل الأعوام السابقة.', av: 'أح' },
  { name: 'خالد النجار', role: 'مدرس الفيزياء', subj: 'الفيزياء', bio: 'ربط الفيزياء بالتجربة العملية ومراجعات مركزة.', av: 'خا' },
  { name: 'منى حسين', role: 'مدرسة الكيمياء', subj: 'الكيمياء', bio: 'متابعة دقيقة للمعادلات وتدريب على أسئلة المعمل.', av: 'مح' },
  { name: 'عمرو سعيد', role: 'مدرس الأحياء', subj: 'الأحياء', bio: 'رسوم توضيحية وأنشطة عملية.', av: 'عم' },
  { name: 'هالة محمد', role: 'مدرسة التاريخ', subj: 'التاريخ', bio: 'تحليل الوثائق وربط الماضي بالحاضر.', av: 'ها' },
  { name: 'ياسر عبد الله', role: 'مدرس الجغرافيا', subj: 'الجغرافيا', bio: 'تدريب على قراءة الخرائط وتحليل الموارد.', av: 'يع' },
  { name: 'سمير رشاد', role: 'مدرس الفلسفة', subj: 'الفلسفة', bio: 'أسلوب حواري ينمّي التفكير الناقد.', av: 'سر' },
  { name: 'نادية حسن', role: 'مدرسة علم النفس', subj: 'علم النفس', bio: 'مدخل واضح لعلم النفس والسلوك الإنساني.', av: 'نا' },
  { name: 'دنيا مصطفى', role: 'مدرسة اللغة الفرنسية', subj: 'اللغة الفرنسية', bio: 'تأسيس قوي في القواعد والنطق.', av: 'دم' }
];

const NEWS_SEED = [
  { tag: 'مثبت', pinned: true, date: '15 سبتمبر 2025', title: 'بدء العام الدراسي الجديد وانتظام الجداول', body: 'تعلن إدارة المدرسة عن بدء الدراسة للعام الجديد وانتظام الجدول الدراسي لجميع الصفوف الثانوية.' },
  { tag: 'إعلان', date: '1 نوفمبر 2025', title: 'مراجعات نهائية على المنصة', body: 'يبدأ المدرسون في نشر مراجعات مركزة واختبارات قصيرة قبل الامتحانات.' },
  { tag: 'نشاط', date: '20 أكتوبر 2025', title: 'مسابقة البحث العلمي', body: 'مسابقة سنوية لطلاب الثانوية في العلوم والبيئة والتكنولوجيا.' },
  { tag: 'إعلان', date: '10 أكتوبر 2025', title: 'تفعيل بوابة ولي الأمر', body: 'تم تفعيل بوابة ولي الأمر لمتابعة الحضور والدرجات والملاحظات.' }
];

/* ========== STORAGE ========== */
const DB = {
  _g(k, d) { try { const v = localStorage.getItem('tg_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  _s(k, v) { try { localStorage.setItem('tg_' + k, JSON.stringify(v)); } catch {} },
  users: () => DB._g('users', []),
  saveUsers: u => DB._s('users', u),
  content: () => DB._g('content', []),
  saveContent: c => DB._s('content', c),
  homework: () => DB._g('homework', []),
  saveHomework: h => DB._s('homework', h),
  hwSubs: () => DB._g('hwSubs', []),
  saveHwSubs: s => DB._s('hwSubs', s),
  quizzes: () => DB._g('quizzes', []),
  saveQuizzes: q => DB._s('quizzes', q),
  quizSubs: () => DB._g('quizSubs', []),
  saveQuizSubs: s => DB._s('quizSubs', s),
  exams: () => DB._g('exams', []),
  saveExams: e => DB._s('exams', e),
  examSubs: () => DB._g('examSubs', []),
  saveExamSubs: s => DB._s('examSubs', s),
  att: () => DB._g('att', []),
  saveAtt: a => DB._s('att', a),
  msgs: () => DB._g('msgs', []),
  saveMsgs: m => DB._s('msgs', m),
  notifs: () => DB._g('notifs', []),
  saveNotifs: n => DB._s('notifs', n),
  links: () => DB._g('links', []),
  saveLinks: l => DB._s('links', l),
  kids: () => DB._g('kids', []),
  saveKids: k => DB._s('kids', k),
  contact: () => DB._g('contact', []),
  saveContact: c => DB._s('contact', c),
  chats: () => DB._g('chats', []),
  saveChats: c => DB._s('chats', c),
  session() { try { return JSON.parse(sessionStorage.getItem('tg_sess') || 'null'); } catch { return null; } },
  setSession(u) { if (u) sessionStorage.setItem('tg_sess', JSON.stringify({ uid: u.uid })); else sessionStorage.removeItem('tg_sess'); }
};

let cur = null;
let authMode = 'login'; // login | register
let authRole = 'student';
let currentSubject = null;

/* ========== UI HELPERS ========== */
function toast(msg, ms = 2800) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a2334;color:#e8edf5;padding:12px 24px;border-radius:12px;z-index:9999;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.45);transition:opacity .3s;opacity:0;max-width:90vw;text-align:center;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._tm);
  t._tm = setTimeout(() => { t.style.opacity = '0'; }, ms);
}

function showLoader(on) {
  const l = $('#loader');
  if (l) l.hidden = !on;
}

function showView(name) {
  $('#site').style.display = name === 'site' ? '' : 'none';
  $('#authView').hidden = name !== 'auth';
  $('#app').hidden = name !== 'app';
  if (name === 'app') $('#app').style.display = 'flex';
  else if ($('#app')) $('#app').style.display = 'none';
}

function card(title, html) {
  return `<div class="w"><h5>${title}</h5>${html || '<div class="li" style="color:var(--mu)">لا يوجد محتوى</div>'}</div>`;
}
function empty(m = 'لا يوجد محتوى حالياً') {
  return `<div class="li" style="color:var(--mu)">${m}</div>`;
}

function pushNotif(toUid, title, body, type = 'info') {
  const list = DB.notifs();
  list.push({ id: uid(), to: toUid, title, body, type, read: false, at: now() });
  DB.saveNotifs(list);
}

function strongPass(p) {
  return p.length >= 6 && /[0-9]/.test(p) && /[a-zA-Z\u0600-\u06FF]/.test(p);
}

/* ========== LANDING ========== */
function renderLanding() {
  // Stats
  const users = DB.users();
  $('#stStudents').textContent = users.filter(u => u.role === 'student').length;
  $('#stTeachers').textContent = users.filter(u => u.role === 'teacher').length;
  $('#stContent').textContent = DB.content().length;
  $('#stExams').textContent = DB.exams().length + DB.quizzes().length;

  // Portals
  const portals = [
    { role: 'student', t: 'طالب', d: 'الدروس والفيديوهات والواجبات والامتحانات والدرجات والحضور', icon: '🎓' },
    { role: 'parent', t: 'ولي أمر', d: 'متابعة الحضور والدرجات والواجبات وملاحظات المدرسين', icon: '👨‍👩‍👧' },
    { role: 'teacher', t: 'مدرس', d: 'رفع المحتوى وإنشاء الواجبات والامتحانات وتسجيل الحضور', icon: '📋' }
  ];
  $('#roleGrid').innerHTML = portals.map(p => `
    <div class="portal-card glass" data-open-auth="login" data-role="${p.role}">
      <div class="portal-icon">${p.icon}</div>
      <h4>${p.t}</h4>
      <p>${p.d}</p>
      <button class="btn sm gold">دخول البوابة</button>
    </div>`).join('');

  // Subjects
  renderSubjects(SUBJECTS);

  // Teachers
  $('#teachersGrid').innerHTML = TEACHERS_LIST.map(t => `
    <div class="teacher-card glass">
      <div class="tav">${t.av}</div>
      <div>
        <h4>${t.name}</h4>
        <span class="trole">${t.role}</span>
        <span class="tsubj">${t.subj}</span>
        <p style="font-size:13px;color:var(--mu)">${t.bio}</p>
        <div class="tact">
          <button class="btn sm outline" data-open-auth="login" data-role="student">تواصل</button>
        </div>
      </div>
    </div>`).join('');

  // News
  const msgs = DB.msgs().filter(m => m.aud === 'all' || m.aud === 'school').slice(0, 4);
  const news = msgs.length ? msgs.map(m => ({
    tag: 'إعلان', pinned: false, date: fmt(m.at), title: m.title, body: m.text
  })) : NEWS_SEED;
  $('#newsGrid').innerHTML = news.map(n => `
    <div class="news-card glass ${n.pinned ? 'pinned' : ''}">
      <div class="news-meta"><span class="ntag">${n.tag}</span><span class="ndate">${n.date}</span></div>
      <h4>${esc(n.title)}</h4>
      <p style="font-size:13px;color:var(--mu)">${esc(n.body)}</p>
    </div>`).join('');
}

function renderSubjects(list) {
  const content = DB.content();
  $('#subGrid').innerHTML = list.map(s => {
    const count = content.filter(c => c.subject === s.name).length;
    return `
    <div class="sub-card glass" data-open-subject="${s.id}">
      <div class="sub-top">
        <span class="sub-count">${count} محتوى</span>
        <svg class="ic"><use href="#i-${s.icon}"/></svg>
      </div>
      <h4>${s.name}</h4>
      <p class="sub-teacher">${s.teacher}</p>
      <p class="sub-desc">${s.desc}</p>
      <button class="lnk">عرض المادة ←</button>
    </div>`;
  }).join('');
}

/* ========== AUTH ========== */
function openAuth(mode = 'login', role = 'student') {
  authMode = mode;
  authRole = role;
  showView('auth');
  $('#authTitle').textContent = mode === 'register' ? 'إنشاء حساب جديد' : 'تسجيل الدخول';
  $('#authSwitch').textContent = mode === 'register' ? 'لديك حساب؟ تسجيل الدخول' : 'ليس لديك حساب؟ إنشاء حساب';
  $('#regFields').hidden = mode !== 'register';
  $('#passConfirmWrap').hidden = mode !== 'register';
  $('#termsWrap').hidden = mode !== 'register';
  $('#gradeWrap').hidden = !(mode === 'register' && role === 'student');
  $('#subjWrap').hidden = !(mode === 'register' && role === 'teacher');
  $$('#authSeg button').forEach(b => b.classList.toggle('on', b.dataset.role === role));
  $('#authErr').textContent = '';
  $('#aPhone').value = '';
  $('#aPass').value = '';
  if ($('#aPass2')) $('#aPass2').value = '';
  if ($('#aName')) $('#aName').value = '';
  if ($('#aTerms')) $('#aTerms').checked = false;

  // fill subjects for teacher
  const sel = $('#aSubj');
  if (sel) {
    sel.innerHTML = SUBJECTS.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
  }
}

function handleAuth(e) {
  e.preventDefault();
  const err = $('#authErr');
  err.textContent = '';
  const phone = ($('#aPhone').value || '').trim().replace(/\s/g, '');
  const pass = ($('#aPass').value || '').trim();

  if (!/^01[0125][0-9]{8}$/.test(phone)) {
    err.textContent = 'أدخل رقم هاتف مصري صحيح (01xxxxxxxxx)';
    return;
  }
  if (pass.length < 6) {
    err.textContent = 'كلمة المرور يجب ألا تقل عن 6 أحرف';
    return;
  }

  if (authMode === 'register') {
    const name = ($('#aName').value || '').trim();
    const pass2 = ($('#aPass2').value || '').trim();
    if (name.length < 3) { err.textContent = 'أدخل الاسم الكامل (3 أحرف على الأقل)'; return; }
    if (pass !== pass2) { err.textContent = 'كلمتا المرور غير متطابقتين'; return; }
    if (!strongPass(pass)) { err.textContent = 'كلمة المرور ضعيفة: استخدم حروفاً وأرقاماً (6+ أحرف)'; return; }
    if (!$('#aTerms')?.checked) { err.textContent = 'يجب الموافقة على الشروط'; return; }

    const users = DB.users();
    if (users.some(u => u.phone === phone)) {
      err.textContent = 'رقم الهاتف مسجل مسبقاً';
      return;
    }

    // photo
    let photo = null;
    const file = $('#aPhoto')?.files?.[0];
    const finish = (photoData) => {
      const user = {
        uid: uid(),
        name,
        phone,
        pass,
        role: authRole,
        grade: authRole === 'student' ? ($('#aGrade')?.value || '1') : null,
        subject: authRole === 'teacher' ? ($('#aSubj')?.value || '') : null,
        photo: photoData,
        status: 'active',
        createdAt: now()
      };
      // first registered teacher can be promoted manually; first admin seed if none
      if (authRole === 'teacher' && !users.some(u => u.role === 'admin')) {
        // keep as teacher
      }
      users.push(user);
      DB.saveUsers(users);
      cur = user;
      DB.setSession(user);
      toast('تم إنشاء الحساب بنجاح');
      openApp(user);
    };

    if (file && file.size < 800000) {
      const reader = new FileReader();
      reader.onload = () => finish(reader.result);
      reader.readAsDataURL(file);
    } else {
      finish(null);
    }
  } else {
    const users = DB.users();
    const user = users.find(u => u.phone === phone && u.pass === pass);
    if (!user) { err.textContent = 'رقم الهاتف أو كلمة المرور غير صحيحة'; return; }
    if (user.status === 'blocked') { err.textContent = 'هذا الحساب موقوف'; return; }
    cur = user;
    DB.setSession(user);
    toast('مرحباً ' + user.name);
    openApp(user);
  }
}

/* ========== APP ========== */
const MENUS = {
  student: ['الرئيسية', 'المواد', 'الواجبات', 'الاختبارات', 'الامتحانات', 'الدرجات', 'الحضور', 'الرسائل', 'الإشعارات', 'الملف'],
  teacher: ['الرئيسية', 'محتواي', 'الواجبات', 'الاختبارات', 'الامتحانات', 'الحضور', 'الطلاب', 'الرسائل', 'الإعلانات', 'الملف'],
  parent: ['الرئيسية', 'متابعة الأبناء', 'الإشعارات', 'الملف'],
  admin: ['الرئيسية', 'المستخدمون', 'المحتوى', 'الإعلانات', 'الرسائل', 'الملف']
};

function openApp(u) {
  cur = u;
  showView('app');
  const menus = MENUS[u.role] || MENUS.student;
  const photoHtml = u.photo
    ? `<img class="avatar" src="${u.photo}" alt="" style="width:40px;height:40px">`
    : `<div class="avatar" style="width:40px;height:40px;font-size:14px">${esc(u.name[0] || '?')}</div>`;

  $('#app').innerHTML = `
    <aside class="side" id="side">
      <a class="brand" data-home-app>
        <img class="logo" src="assets/images/logo-fancy.png" alt="" width="42" height="42">
        <span>التناغة الشرقية<small>${ROLE[u.role]}</small></span>
      </a>
      <nav class="side-nav">
        ${menus.map((m, i) => `<button class="side-btn ${i === 0 ? 'on' : ''}" data-t="${m}">${m}</button>`).join('')}
      </nav>
      <div class="side-foot">
        <div class="user-chip" style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
          ${photoHtml}
          <div><b>${esc(u.name)}</b><span>${ROLE[u.role]}${u.grade ? ' · ' + GR[u.grade] : ''}</span></div>
        </div>
        <button class="btn sm outline full" id="logoutBtn">تسجيل الخروج</button>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <button class="burger" id="sideToggle">☰</button>
        <h2 id="pageTitle">الرئيسية</h2>
      </header>
      <div class="work" id="wg"></div>
    </main>`;

  $('#logoutBtn').onclick = () => { cur = null; DB.setSession(null); showView('site'); renderLanding(); toast('تم تسجيل الخروج'); };
  $('#sideToggle')?.addEventListener('click', () => $('#side').classList.toggle('open'));
  $$('.side-btn').forEach(b => {
    b.onclick = () => {
      $$('.side-btn').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      $('#pageTitle').textContent = b.dataset.t;
      $('#side')?.classList.remove('open');
      route(b.dataset.t);
    };
  });
  route('الرئيسية');
}

function route(t) {
  const r = cur.role;
  if (r === 'student') {
    if (t === 'الرئيسية') return studentHome();
    if (t === 'المواد') return subjectsPanel();
    if (t === 'الواجبات') return studentHw();
    if (t === 'الاختبارات') return studentQuiz();
    if (t === 'الامتحانات') return studentExam();
    if (t === 'الدرجات') return gradesPanel();
    if (t === 'الحضور') return studentAtt();
    if (t === 'الرسائل') return chatPanel();
    if (t === 'الإشعارات') return notifPanel();
    if (t === 'الملف') return profilePanel();
  }
  if (r === 'teacher') {
    if (t === 'الرئيسية') return teacherHome();
    if (t === 'محتواي') return teacherContent();
    if (t === 'الواجبات') return teacherHw();
    if (t === 'الاختبارات') return teacherQuiz();
    if (t === 'الامتحانات') return teacherExam();
    if (t === 'الحضور') return attPanel();
    if (t === 'الطلاب') return studentsPanel();
    if (t === 'الرسائل') return chatPanel();
    if (t === 'الإعلانات') return announcePanel();
    if (t === 'الملف') return profilePanel();
  }
  if (r === 'parent') {
    if (t === 'الرئيسية' || t === 'متابعة الأبناء') return parentHome();
    if (t === 'الإشعارات') return notifPanel();
    if (t === 'الملف') return profilePanel();
  }
  if (r === 'admin') {
    if (t === 'الرئيسية') return adminHome();
    if (t === 'المستخدمون') return usersPanel();
    if (t === 'المحتوى') return teacherContent();
    if (t === 'الإعلانات') return announcePanel();
    if (t === 'الرسائل') return contactPanel();
    if (t === 'الملف') return profilePanel();
  }
  $('#wg').innerHTML = card(t, empty());
}

/* ===== STUDENT ===== */
function studentHome() {
  const content = DB.content().filter(c => !cur.grade || c.grade === cur.grade || c.grade === 'all');
  const hw = DB.homework().filter(h => h.grade === cur.grade);
  const quizzes = DB.quizzes().filter(q => q.grade === cur.grade && q.closeAt > now());
  const exams = DB.exams().filter(e => e.grade === cur.grade && e.closeAt > now());
  const notifs = DB.notifs().filter(n => n.to === cur.uid && !n.read).length;

  $('#wg').innerHTML = `
    <div class="welcome"><h3>مرحباً ${esc(cur.name)} 👋</h3><p>${GR[cur.grade] || ''} · صفحة لتعليم مناهج الثانوية</p></div>
    <div class="stats">
      <div class="stat"><b>${content.length}</b><span>محتوى</span></div>
      <div class="stat"><b>${hw.length}</b><span>واجبات</span></div>
      <div class="stat"><b>${quizzes.length + exams.length}</b><span>اختبارات/امتحانات</span></div>
      <div class="stat"><b>${notifs}</b><span>إشعارات جديدة</span></div>
    </div>
    ${card('المواد الدراسية', `<div class="mini-grid">${SUBJECTS.map(s => `
      <div class="mini-card" data-open-subject="${s.id}"><span>${s.name}</span><small>${s.teacher}</small></div>`).join('')}</div>`)}
    ${card('امتحانات واختبارات قريبة', [...exams, ...quizzes].slice(0, 4).map(x => `
      <div class="li"><b>${esc(x.title)}</b><span>${x.mins || 20} د</span></div>`).join('') || empty('لا يوجد حالياً'))}`;
  bindSubjectClicks();
}

function subjectsPanel() {
  $('#wg').innerHTML = card('اختر مادة', `<div class="mini-grid">${SUBJECTS.map(s => `
    <div class="mini-card" data-open-subject="${s.id}">
      <span>${s.name}</span><small>${s.teacher}</small>
    </div>`).join('')}</div>`);
  bindSubjectClicks();
}

function bindSubjectClicks() {
  $$('[data-open-subject]').forEach(el => {
    el.onclick = () => openSubjectPage(el.dataset.openSubject);
  });
}

function openSubjectPage(sid) {
  const s = SUBJECTS.find(x => x.id === sid);
  if (!s) return;
  currentSubject = s;
  const items = DB.content().filter(c => c.subject === s.name && (!cur.grade || c.grade === cur.grade || c.grade === 'all'));
  const hw = DB.homework().filter(h => h.subject === s.name && h.grade === cur.grade);
  const quizzes = DB.quizzes().filter(q => q.subject === s.name && q.grade === cur.grade);
  const exams = DB.exams().filter(e => e.subject === s.name && e.grade === cur.grade);

  $('#pageTitle').textContent = s.name;
  $('#wg').innerHTML = `
    <div class="w">
      <button class="lnk" id="backSub">← رجوع للمواد</button>
      <h3 style="margin:10px 0">${s.name}</h3>
      <p style="color:var(--mu);font-size:14px">${s.teacher} · ${s.desc}</p>
    </div>
    ${card('الدروس والملفات والفيديوهات', items.length ? items.map(c => `
      <div class="li">
        <div style="flex:1"><b>${esc(c.title)}</b><br><span style="font-size:12px;color:var(--mu)">${KIND[c.kind] || c.kind}</span>
          ${c.link ? `<br><a class="lnk" href="${esc(c.link)}" target="_blank" rel="noopener">فتح ↗</a>` : ''}
        </div>
      </div>`).join('') : empty('لا يوجد محتوى لهذه المادة بعد'))}
    ${card('واجبات المادة', hw.length ? hw.map(h => {
      const sub = DB.hwSubs().find(x => x.hid === h.id && x.sid === cur.uid);
      return `<div class="li"><b>${esc(h.title)}</b><span>${sub ? (sub.score != null ? sub.score + '%' : 'مُسلّم') : `<button class="btn sm" data-hw="${h.id}">تسليم</button>`}</span></div>`;
    }).join('') : empty())}
    ${card('اختبارات وامتحانات', [...quizzes.map(q => ({...q, typ:'quiz'})), ...exams.map(e => ({...e, typ:'exam'}))].map(x => `
      <div class="li"><b>${esc(x.title)}</b><span><button class="btn sm" data-start="${x.typ}:${x.id}">ابدأ</button></span></div>`).join('') || empty())}`;

  $('#backSub').onclick = () => { $('#pageTitle').textContent = 'المواد'; subjectsPanel(); };
  $$('[data-hw]').forEach(b => b.onclick = () => submitHw(b.dataset.hw));
  $$('[data-start]').forEach(b => {
    b.onclick = () => {
      const [typ, id] = b.dataset.start.split(':');
      if (typ === 'quiz') startQuiz(id);
      else startExam(id);
    };
  });
}

function studentHw() {
  const list = DB.homework().filter(h => h.grade === cur.grade);
  $('#wg').innerHTML = card('واجباتي', list.length ? list.map(h => {
    const sub = DB.hwSubs().find(x => x.hid === h.id && x.sid === cur.uid);
    return `<div class="li">
      <div style="flex:1"><b>${esc(h.title)}</b><br><span style="font-size:12px;color:var(--mu)">${esc(h.subject)} · يستحق ${fmt(h.due)}</span>
        ${h.desc ? `<br>${esc(h.desc)}` : ''}
      </div>
      <span>${sub ? (sub.score != null ? `<span class="ok">${sub.score}%</span>` : 'بانتظار التصحيح') : `<button class="btn sm" data-hw="${h.id}">تسليم</button>`}</span>
    </div>`;
  }).join('') : empty('لا توجد واجبات'));
  $$('[data-hw]').forEach(b => b.onclick = () => submitHw(b.dataset.hw));
}

function submitHw(hid) {
  const h = DB.homework().find(x => x.id === hid);
  if (!h) return;
  const text = prompt('اكتب إجابتك أو رابط التسليم (Drive / صور):');
  if (!text || !text.trim()) return;
  const subs = DB.hwSubs().filter(x => !(x.hid === hid && x.sid === cur.uid));
  subs.push({ id: uid(), hid, sid: cur.uid, sname: cur.name, text: text.trim(), score: null, note: '', at: now() });
  DB.saveHwSubs(subs);
  pushNotif(h.tid, 'تسليم واجب', `${cur.name} سلّم واجب: ${h.title}`, 'hw');
  toast('تم تسليم الواجب');
  studentHw();
}

function studentQuiz() {
  const list = DB.quizzes().filter(q => q.grade === cur.grade);
  const done = new Set(DB.quizSubs().filter(s => s.sid === cur.uid).map(s => s.qid));
  $('#wg').innerHTML = card('الاختبارات', list.map(q => `
    <div class="li"><b>${esc(q.title)}</b><span>${done.has(q.id) ? '<span class="ok">تم</span>' : q.closeAt > now() ? `<button class="btn sm" data-q="${q.id}">ابدأ</button>` : 'انتهى'}</span></div>`).join('') || empty());
  $$('[data-q]').forEach(b => b.onclick = () => startQuiz(b.dataset.q));
}

function startQuiz(id) {
  const q = DB.quizzes().find(x => x.id === id);
  if (!q) return;
  if (DB.quizSubs().some(s => s.qid === id && s.sid === cur.uid)) return toast('تم التسليم مسبقاً');
  runTimedTest(q, 'quiz');
}

function studentExam() {
  const list = DB.exams().filter(e => e.grade === cur.grade);
  const done = new Set(DB.examSubs().filter(s => s.sid === cur.uid).map(s => s.eid));
  $('#wg').innerHTML = card('الامتحانات', list.map(e => `
    <div class="li"><b>${esc(e.title)}</b><span>${done.has(e.id) ? '<span class="ok">تم</span>' : e.closeAt > now() ? `<button class="btn sm" data-e="${e.id}">ابدأ</button>` : 'انتهى'}</span></div>`).join('') || empty());
  $$('[data-e]').forEach(b => b.onclick = () => startExam(b.dataset.e));
}

function startExam(id) {
  const e = DB.exams().find(x => x.id === id);
  if (!e) return;
  if (DB.examSubs().some(s => s.eid === id && s.sid === cur.uid)) return toast('تم التسليم مسبقاً');
  runTimedTest(e, 'exam');
}

function runTimedTest(test, typ) {
  let left = (test.mins || 20) * 60;
  let done = false;
  $('#wg').innerHTML = `
    <div class="w">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h5 style="margin:0">${esc(test.title)}</h5>
        <span id="tm" style="color:var(--gold);font-weight:700">⏱ ${test.mins}:00</span>
      </div>
      ${test.qs.map((q, i) => `
        <div class="qitem"><b>${i + 1}. ${esc(q.q)}</b>
          ${q.type === 'tf' ? `
            <label class="opt"><input type="radio" name="q${i}" value="1"> صواب</label>
            <label class="opt"><input type="radio" name="q${i}" value="0"> خطأ</label>
          ` : q.type === 'short' ? `
            <input name="q${i}" placeholder="إجابتك" style="width:100%;margin-top:6px">
          ` : (q.opts || []).map((o, j) => `
            <label class="opt"><input type="radio" name="q${i}" value="${j}"> ${esc(o)}</label>
          `).join('')}
        </div>`).join('')}
      <button class="btn gold full" id="submitTest">تسليم</button>
    </div>`;

  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(iv);
    const answers = test.qs.map((q, i) => {
      if (q.type === 'short') return document.querySelector(`[name="q${i}"]`)?.value?.trim() || '';
      const r = document.querySelector(`input[name="q${i}"]:checked`);
      return r ? r.value : '';
    });
    let score = null;
    const auto = test.qs.every(q => q.type !== 'short');
    if (auto) {
      let correct = 0;
      test.qs.forEach((q, i) => {
        if (q.type === 'tf') { if (String(q.a) === answers[i]) correct++; }
        else if (String(q.a) === answers[i]) correct++;
      });
      score = Math.round((correct / test.qs.length) * 100);
    }
    if (typ === 'quiz') {
      const subs = DB.quizSubs();
      subs.push({ id: uid(), qid: test.id, sid: cur.uid, sname: cur.name, a: answers, score, at: now() });
      DB.saveQuizSubs(subs);
    } else {
      const subs = DB.examSubs();
      subs.push({ id: uid(), eid: test.id, sid: cur.uid, sname: cur.name, a: answers, score, at: now() });
      DB.saveExamSubs(subs);
    }
    toast(score != null ? `تم التسليم — درجتك: ${score}%` : 'تم التسليم — بانتظار التصحيح');
    if (typ === 'quiz') studentQuiz(); else studentExam();
  };

  const iv = setInterval(() => {
    if (!$('#tm')) { clearInterval(iv); return; }
    left--;
    $('#tm').textContent = `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (left <= 0) finish();
  }, 1000);
  $('#submitTest').onclick = () => { if (confirm('تأكيد التسليم؟')) finish(); };
}

function gradesPanel() {
  const qSubs = DB.quizSubs().filter(s => s.sid === cur.uid);
  const eSubs = DB.examSubs().filter(s => s.sid === cur.uid);
  const hwSubs = DB.hwSubs().filter(s => s.sid === cur.uid && s.score != null);
  const quizzes = DB.quizzes();
  const exams = DB.exams();
  const hws = DB.homework();

  const rows = [
    ...qSubs.map(s => { const q = quizzes.find(x => x.id === s.qid); return q ? { t: q.title, subj: q.subject, score: s.score, kind: 'اختبار' } : null; }),
    ...eSubs.map(s => { const e = exams.find(x => x.id === s.eid); return e ? { t: e.title, subj: e.subject, score: s.score, kind: 'امتحان' } : null; }),
    ...hwSubs.map(s => { const h = hws.find(x => x.id === s.hid); return h ? { t: h.title, subj: h.subject, score: s.score, kind: 'واجب' } : null; })
  ].filter(Boolean);

  const att = DB.att().filter(a => a.sid === cur.uid);
  const pct = att.length ? Math.round(att.filter(a => a.st === 'p').length / att.length * 100) : 0;

  $('#wg').innerHTML = `
    ${card('الدرجات', rows.length ? rows.map(r => `
      <div class="li"><div style="flex:1"><b>${esc(r.t)}</b><br><span style="font-size:12px;color:var(--mu)">${r.kind} · ${esc(r.subj)}</span>
        ${r.score != null ? `<div class="bar"><i style="width:${r.score}%"></i></div>` : ''}</div>
        <span>${r.score != null ? r.score + '%' : '—'}</span></div>`).join('') : empty())}
    ${card('الحضور', `<div class="li"><div style="flex:1">نسبة الحضور<div class="bar"><i style="width:${pct}%"></i></div></div><span>${pct}%</span></div>`)}`;
}

function studentAtt() {
  const att = DB.att().filter(a => a.sid === cur.uid).sort((a, b) => b.date.localeCompare(a.date));
  $('#wg').innerHTML = card('سجل الحضور', att.map(a => `
    <div class="li"><span>${a.date}</span><span class="${a.st === 'p' ? 'ok' : 'no'}">${a.st === 'p' ? 'حاضر' : 'غائب'}</span></div>`).join('') || empty());
}

/* ===== TEACHER ===== */
function teacherHome() {
  const content = DB.content().filter(c => c.tid === cur.uid);
  const hw = DB.homework().filter(h => h.tid === cur.uid);
  const pending = DB.hwSubs().filter(s => {
    const h = hw.find(x => x.id === s.hid);
    return h && s.score == null;
  }).length;

  $('#wg').innerHTML = `
    <div class="welcome"><h3>مرحباً أستاذ ${esc(cur.name)}</h3><p>لوحة المدرس</p></div>
    <div class="stats">
      <div class="stat"><b>${content.length}</b><span>محتوى</span></div>
      <div class="stat"><b>${hw.length}</b><span>واجبات</span></div>
      <div class="stat"><b>${pending}</b><span>بانتظار التصحيح</span></div>
    </div>
    ${card('إجراءات سريعة', `<div style="display:flex;flex-wrap:wrap;gap:10px">
      <button class="btn gold" data-go="محتواي">رفع محتوى</button>
      <button class="btn outline" data-go="الواجبات">واجب جديد</button>
      <button class="btn outline" data-go="الامتحانات">امتحان جديد</button>
      <button class="btn outline" data-go="الحضور">تسجيل حضور</button>
    </div>`)}`;
  $$('[data-go]').forEach(b => b.onclick = () => {
    $$('.side-btn').forEach(x => x.classList.toggle('on', x.dataset.t === b.dataset.go));
    $('#pageTitle').textContent = b.dataset.go;
    route(b.dataset.go);
  });
}

function teacherContent() {
  const isTeacher = cur.role === 'teacher' || cur.role === 'admin';
  let list = DB.content();
  if (cur.role === 'teacher') list = list.filter(c => c.tid === cur.uid);
  list = list.sort((a, b) => b.at - a.at);

  $('#wg').innerHTML = `
    <div class="w frm">
      <h5>رفع محتوى جديد</h5>
      <label>النوع</label>
      <select id="ck">
        <option value="lesson">درس نصي</option>
        <option value="video">فيديو (يوتيوب / درايف)</option>
        <option value="pdf">ملف PDF</option>
        <option value="word">ملف Word</option>
        <option value="ppt">PowerPoint</option>
        <option value="link">رابط خارجي</option>
      </select>
      <label>العنوان</label><input id="ct" maxlength="120">
      <label>المادة</label><select id="cs">${SUBJECTS.map(s => `<option>${s.name}</option>`).join('')}</select>
      <label>الصف</label><select id="cg"><option value="all">كل الصفوف</option>${Object.entries(GR).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
      <label>الرابط (https فقط)</label><input id="cl" dir="ltr" placeholder="https://...">
      <label>وصف مختصر</label><textarea id="cn" rows="2" maxlength="300"></textarea>
      <button class="btn gold full" id="cp">نشر</button>
    </div>
    ${card('المحتوى المنشور', list.map(c => `
      <div class="li"><div style="flex:1"><b>${esc(c.title)}</b><br><span style="font-size:12px;color:var(--mu)">${KIND[c.kind]} · ${esc(c.subject)}</span>
        ${c.link ? `<br><a class="lnk" href="${esc(c.link)}" target="_blank" rel="noopener">فتح</a>` : ''}</div>
        <button class="lnk" data-del="${c.id}">حذف</button></div>`).join('') || empty())}`;

  $('#cp').onclick = () => {
    const title = $('#ct').value.trim();
    if (!title) return toast('أدخل العنوان');
    const link = $('#cl').value.trim();
    if (link && !/^https?:\/\//i.test(link)) return toast('الرابط يجب أن يبدأ بـ http');
    const item = { id: uid(), kind: $('#ck').value, title, subject: $('#cs').value, grade: $('#cg').value, link, note: $('#cn').value.trim(), tid: cur.uid, tname: cur.name, at: now() };
    const all = DB.content(); all.push(item); DB.saveContent(all);
    toast('تم النشر'); teacherContent();
  };
  $$('[data-del]').forEach(b => b.onclick = () => {
    if (!confirm('حذف؟')) return;
    DB.saveContent(DB.content().filter(x => x.id !== b.dataset.del));
    teacherContent();
  });
}

function teacherHw() {
  const list = DB.homework().filter(h => h.tid === cur.uid || cur.role === 'admin');
  $('#wg').innerHTML = `
    <div class="w frm">
      <h5>إنشاء واجب</h5>
      <label>العنوان</label><input id="ht">
      <label>المادة</label><select id="hs">${SUBJECTS.map(s => `<option>${s.name}</option>`).join('')}</select>
      <label>الصف</label><select id="hg">${Object.entries(GR).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
      <label>الوصف / التعليمات</label><textarea id="hd" rows="3"></textarea>
      <label>آخر موعد</label><input type="date" id="hdue">
      <button class="btn gold full" id="hpub">نشر الواجب</button>
    </div>
    ${card('واجباتي', list.map(h => {
      const subs = DB.hwSubs().filter(s => s.hid === h.id);
      const pending = subs.filter(s => s.score == null).length;
      return `<div class="li"><div style="flex:1"><b>${esc(h.title)}</b><br><span style="font-size:12px;color:var(--mu)">${esc(h.subject)} · ${subs.length} تسليم · ${pending} بانتظار</span></div>
        <button class="lnk" data-corr="${h.id}">تصحيح</button></div>`;
    }).join('') || empty())}`;

  $('#hpub').onclick = () => {
    const title = $('#ht').value.trim();
    if (!title) return toast('أدخل العنوان');
    const all = DB.homework();
    all.push({ id: uid(), title, subject: $('#hs').value, grade: $('#hg').value, desc: $('#hd').value.trim(), due: new Date($('#hdue').value || Date.now() + 7*864e5).getTime(), tid: cur.uid, tname: cur.name, at: now() });
    DB.saveHomework(all);
    toast('تم نشر الواجب'); teacherHw();
  };
  $$('[data-corr]').forEach(b => b.onclick = () => correctHw(b.dataset.corr));
}

function correctHw(hid) {
  const h = DB.homework().find(x => x.id === hid);
  const subs = DB.hwSubs().filter(s => s.hid === hid);
  $('#wg').innerHTML = `
    <div class="w">
      <button class="lnk" id="backHw">← رجوع</button>
      <h5>تصحيح: ${esc(h?.title || '')}</h5>
      ${subs.map(s => `
        <div class="li" style="flex-direction:column;align-items:stretch">
          <b>${esc(s.sname)}</b>
          <p style="font-size:13px;margin:6px 0">${esc(s.text)}</p>
          ${s.score != null ? `<span class="ok">الدرجة: ${s.score}% — ${esc(s.note || '')}</span>` : `
            <div class="row">
              <input type="number" min="0" max="100" placeholder="الدرجة %" data-score="${s.id}" style="width:100px">
              <input placeholder="ملاحظة" data-note="${s.id}" style="flex:1">
              <button class="btn sm gold" data-save="${s.id}">حفظ</button>
            </div>`}
        </div>`).join('') || empty('لا تسليمات')}
    </div>`;
  $('#backHw').onclick = () => teacherHw();
  $$('[data-save]').forEach(b => b.onclick = () => {
    const id = b.dataset.save;
    const score = parseInt(document.querySelector(`[data-score="${id}"]`)?.value, 10);
    const note = document.querySelector(`[data-note="${id}"]`)?.value || '';
    if (isNaN(score)) return toast('أدخل درجة');
    const all = DB.hwSubs();
    const s = all.find(x => x.id === id);
    if (s) { s.score = score; s.note = note; DB.saveHwSubs(all); pushNotif(s.sid, 'درجة واجب', `حصلت على ${score}% في ${h.title}`, 'grade'); toast('تم الحفظ'); correctHw(hid); }
  });
}

function teacherQuiz() {
  testBuilder('quiz');
}
function teacherExam() {
  testBuilder('exam');
}

function testBuilder(typ) {
  const isQuiz = typ === 'quiz';
  const list = isQuiz ? DB.quizzes().filter(q => q.tid === cur.uid) : DB.exams().filter(e => e.tid === cur.uid);
  const saveFn = isQuiz ? DB.saveQuizzes : DB.saveExams;
  const getFn = isQuiz ? DB.quizzes : DB.exams;

  $('#wg').innerHTML = `
    <div class="w frm">
      <h5>إنشاء ${isQuiz ? 'اختبار' : 'امتحان'}</h5>
      <label>العنوان</label><input id="tt">
      <label>المادة</label><select id="ts">${SUBJECTS.map(s => `<option>${s.name}</option>`).join('')}</select>
      <label>الصف</label><select id="tg">${Object.entries(GR).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
      <label>المدة (دقيقة)</label><input type="number" id="tm" value="${isQuiz ? 15 : 30}" min="5" max="180">
      <label>آخر موعد</label><input type="datetime-local" id="tc">
      <label>الأسئلة</label>
      <div id="tq">
        <div class="qbox">
          <select class="qtype"><option value="mc">اختيار من متعدد</option><option value="tf">صواب/خطأ</option><option value="short">إجابة قصيرة</option></select>
          <input class="qq" placeholder="نص السؤال">
          <input class="o1" placeholder="خيار 1">
          <input class="o2" placeholder="خيار 2">
          <input class="o3" placeholder="خيار 3">
          <input class="o4" placeholder="خيار 4">
          <input class="qa" type="number" min="0" max="3" value="0" title="رقم الإجابة الصحيحة" style="width:70px">
        </div>
      </div>
      <button class="lnk" type="button" id="tadd">+ سؤال</button>
      <button class="btn gold full" id="tpub" style="margin-top:12px">نشر</button>
    </div>
    ${card(isQuiz ? 'اختباراتي' : 'امتحاناتي', list.map(x => `
      <div class="li"><b>${esc(x.title)}</b><span>${x.qs.length} أسئلة</span></div>`).join('') || empty())}`;

  $('#tadd').onclick = () => {
    $('#tq').insertAdjacentHTML('beforeend', `<div class="qbox">
      <select class="qtype"><option value="mc">اختيار من متعدد</option><option value="tf">صواب/خطأ</option><option value="short">إجابة قصيرة</option></select>
      <input class="qq" placeholder="نص السؤال">
      <input class="o1" placeholder="خيار 1"><input class="o2" placeholder="خيار 2">
      <input class="o3" placeholder="خيار 3"><input class="o4" placeholder="خيار 4">
      <input class="qa" type="number" min="0" max="3" value="0" style="width:70px">
    </div>`);
  };

  $('#tpub').onclick = () => {
    const title = $('#tt').value.trim();
    if (!title) return toast('أدخل العنوان');
    const qs = [...$$('#tq .qbox')].map(box => {
      const type = box.querySelector('.qtype').value;
      const q = box.querySelector('.qq').value.trim();
      if (!q) return null;
      if (type === 'tf') return { type: 'tf', q, a: box.querySelector('.qa').value === '1' ? 1 : 0 };
      if (type === 'short') return { type: 'short', q, a: '' };
      return {
        type: 'mc', q,
        opts: [box.querySelector('.o1').value, box.querySelector('.o2').value, box.querySelector('.o3').value, box.querySelector('.o4').value],
        a: parseInt(box.querySelector('.qa').value, 10) || 0
      };
    }).filter(Boolean);
    if (!qs.length) return toast('أضف سؤالاً');
    const item = {
      id: uid(), title, subject: $('#ts').value, grade: $('#tg').value,
      mins: parseInt($('#tm').value, 10) || 20,
      closeAt: $('#tc').value ? new Date($('#tc').value).getTime() : now() + 7 * 864e5,
      qs, tid: cur.uid, tname: cur.name, at: now()
    };
    const all = getFn(); all.push(item); saveFn(all);
    toast('تم النشر');
    if (isQuiz) teacherQuiz(); else teacherExam();
  };
}

function attPanel(g = '1', d = today()) {
  const students = DB.users().filter(u => u.role === 'student' && u.grade === g);
  const existing = DB.att().filter(a => a.date === d && a.tid === cur.uid);
  const map = Object.fromEntries(existing.map(a => [a.sid, a.st]));
  const marks = { ...map };

  $('#wg').innerHTML = `
    <div class="w">
      <h5>تسجيل الحضور</h5>
      <div class="row">
        <select id="ag">${Object.entries(GR).map(([k,v])=>`<option value="${k}" ${k===g?'selected':''}>${v}</option>`).join('')}</select>
        <input type="date" id="ad" value="${d}">
        <button class="btn sm" id="areload">عرض</button>
      </div>
      ${students.map(s => `
        <div class="li"><span>${esc(s.name)}</span>
          <span>
            <button class="btn sm ${map[s.uid]==='p'?'gold':'outline'}" data-sid="${s.uid}" data-st="p">حاضر</button>
            <button class="btn sm ${map[s.uid]==='a'?'gold':'outline'}" data-sid="${s.uid}" data-st="a">غائب</button>
          </span>
        </div>`).join('') || empty('لا طلاب في هذا الصف')}
      <button class="btn gold full" id="asave" style="margin-top:12px">حفظ</button>
    </div>`;

  $('#areload').onclick = () => attPanel($('#ag').value, $('#ad').value);
  $$('[data-sid]').forEach(b => b.onclick = () => {
    marks[b.dataset.sid] = b.dataset.st;
    $$(`[data-sid="${b.dataset.sid}"]`).forEach(x => {
      x.classList.toggle('gold', x.dataset.st === marks[b.dataset.sid]);
      x.classList.toggle('outline', x.dataset.st !== marks[b.dataset.sid]);
    });
  });
  $('#asave').onclick = () => {
    let list = DB.att().filter(a => !(a.date === d && a.tid === cur.uid));
    students.forEach(s => {
      if (marks[s.uid]) list.push({ id: uid(), sid: s.uid, sname: s.name, grade: g, date: d, st: marks[s.uid], tid: cur.uid });
    });
    DB.saveAtt(list);
    toast('تم حفظ الحضور');
  };
}

function studentsPanel() {
  const students = DB.users().filter(u => u.role === 'student');
  $('#wg').innerHTML = card(`الطلاب (${students.length})`, students.map(s => `
    <div class="li"><b>${esc(s.name)}</b><span>${GR[s.grade] || ''} · ${s.phone}</span></div>`).join('') || empty());
}

function announcePanel() {
  const list = DB.msgs().filter(m => m.by === cur.uid || cur.role === 'admin').sort((a,b)=>b.at-a.at);
  $('#wg').innerHTML = `
    <div class="w frm">
      <h5>إرسال إعلان</h5>
      <label>العنوان</label><input id="mt">
      <label>النص</label><textarea id="mx" rows="3"></textarea>
      <label>الجمهور</label>
      <select id="ma">
        <option value="all">الجميع</option>
        <option value="students">الطلاب</option>
        <option value="parents">أولياء الأمور</option>
        <option value="1">الصف الأول</option>
        <option value="2">الصف الثاني</option>
        <option value="3">الصف الثالث</option>
      </select>
      <button class="btn gold full" id="ms">إرسال</button>
    </div>
    ${card('إعلاناتي', list.map(m => `<div class="li"><b>${esc(m.title)}</b><span>${fmt(m.at)}</span></div>`).join('') || empty())}`;
  $('#ms').onclick = () => {
    const title = $('#mt').value.trim(), text = $('#mx').value.trim();
    if (!title || !text) return toast('أكمل الحقول');
    const all = DB.msgs();
    all.push({ id: uid(), title, text, aud: $('#ma').value, by: cur.uid, bname: cur.name, at: now() });
    DB.saveMsgs(all);
    toast('تم الإرسال'); announcePanel();
  };
}

/* ===== PARENT ===== */
function parentHome() {
  const kids = DB.kids().filter(k => k.pid === cur.uid);
  if (!kids.length) {
    $('#wg').innerHTML = `
      <div class="w">
        <h5>ربط حساب الابن</h5>
        <p style="color:var(--mu);font-size:14px;margin-bottom:14px">اطلب من ابنك إنشاء كود من الملف الشخصي، ثم أدخله هنا.</p>
        <input id="lk" maxlength="12" placeholder="كود الربط" style="letter-spacing:3px;text-transform:uppercase;text-align:center;font-size:18px">
        <button class="btn gold full" id="ldo" style="margin-top:12px">ربط</button>
      </div>`;
    $('#ldo').onclick = () => {
      const code = ($('#lk').value || '').trim().toUpperCase();
      const link = DB.links().find(l => l.id === code && l.exp > now());
      if (!link) return toast('كود غير صالح أو منتهي');
      const kids = DB.kids();
      kids.push({ id: uid(), sid: link.sid, sname: link.sname, grade: link.grade, pid: cur.uid, pname: cur.name, at: now() });
      DB.saveKids(kids);
      DB.saveLinks(DB.links().filter(l => l.id !== code));
      toast('تم الربط'); parentHome();
    };
    return;
  }
  const kid = kids[0];
  const att = DB.att().filter(a => a.sid === kid.sid);
  const pct = att.length ? Math.round(att.filter(a => a.st === 'p').length / att.length * 100) : 0;
  const hwSubs = DB.hwSubs().filter(s => s.sid === kid.sid);
  const grades = [
    ...DB.quizSubs().filter(s => s.sid === kid.sid && s.score != null),
    ...DB.examSubs().filter(s => s.sid === kid.sid && s.score != null)
  ];

  $('#wg').innerHTML = `
    <div class="welcome"><h3>متابعة ${esc(kid.sname)}</h3><p>${GR[kid.grade] || ''}</p></div>
    <div class="stats">
      <div class="stat"><b>${pct}%</b><span>حضور</span></div>
      <div class="stat"><b>${grades.length}</b><span>درجات</span></div>
      <div class="stat"><b>${hwSubs.length}</b><span>واجبات مُسلّمة</span></div>
    </div>
    ${card('آخر الدرجات', grades.slice(-5).reverse().map(g => `
      <div class="li"><span>درجة</span><span class="ok">${g.score}%</span></div>`).join('') || empty())}
    ${card('الحضور', att.slice(-8).reverse().map(a => `
      <div class="li"><span>${a.date}</span><span class="${a.st==='p'?'ok':'no'}">${a.st==='p'?'حاضر':'غائب'}</span></div>`).join('') || empty())}`;
}

/* ===== ADMIN ===== */
function adminHome() {
  const u = DB.users();
  $('#wg').innerHTML = `
    <div class="welcome"><h3>لوحة الإدارة</h3></div>
    <div class="stats">
      <div class="stat"><b>${u.filter(x=>x.role==='student').length}</b><span>طلاب</span></div>
      <div class="stat"><b>${u.filter(x=>x.role==='teacher').length}</b><span>مدرسون</span></div>
      <div class="stat"><b>${u.filter(x=>x.role==='parent').length}</b><span>أولياء</span></div>
      <div class="stat"><b>${DB.content().length}</b><span>محتوى</span></div>
    </div>`;
}

function usersPanel() {
  const users = DB.users();
  $('#wg').innerHTML = card('المستخدمون', users.map(u => `
    <div class="li">
      <div style="flex:1"><b>${esc(u.name)}</b><br><span style="font-size:12px;color:var(--mu)">${ROLE[u.role]} · ${u.phone}</span></div>
      ${u.role !== 'admin' ? `<button class="lnk" data-block="${u.uid}">${u.status==='blocked'?'تفعيل':'إيقاف'}</button>` : ''}
    </div>`).join('') || empty());
  $$('[data-block]').forEach(b => b.onclick = () => {
    const all = DB.users();
    const u = all.find(x => x.uid === b.dataset.block);
    if (u) { u.status = u.status === 'blocked' ? 'active' : 'blocked'; DB.saveUsers(all); usersPanel(); }
  });
}

function contactPanel() {
  const list = DB.contact().sort((a,b)=>b.at-a.at);
  $('#wg').innerHTML = card('رسائل التواصل', list.map(m => `
    <div class="li"><div style="flex:1"><b>${esc(m.name)}</b> · ${esc(m.phone)}<br>${esc(m.msg)}<br><span style="font-size:12px;color:var(--mu)">${fmt(m.at)}</span></div></div>`).join('') || empty());
}

function notifPanel() {
  const list = DB.notifs().filter(n => n.to === cur.uid).sort((a,b)=>b.at-a.at);
  list.forEach(n => { n.read = true; });
  DB.saveNotifs(DB.notifs());
  $('#wg').innerHTML = card('الإشعارات', list.map(n => `
    <div class="li"><div style="flex:1"><b>${esc(n.title)}</b><br>${esc(n.body)}<br><span style="font-size:12px;color:var(--mu)">${fmt(n.at)}</span></div></div>`).join('') || empty());
}

function profilePanel() {
  let extra = '';
  if (cur.role === 'student') {
    const links = DB.links().filter(l => l.sid === cur.uid && l.exp > now());
    extra = `<div class="w"><h5>ربط ولي الأمر</h5>
      <p style="color:var(--mu);font-size:13px;margin-bottom:10px">أنشئ كوداً وأعطه لولي أمرك (صالح 7 أيام).</p>
      ${links.map(l => `<div class="li"><b dir="ltr" style="letter-spacing:3px">${l.id}</b></div>`).join('')}
      <button class="btn gold" id="genLink">إنشاء كود</button></div>`;
  }
  const photo = cur.photo
    ? `<img class="avatar" src="${cur.photo}" alt="">`
    : `<div class="avatar">${esc(cur.name[0] || '?')}</div>`;

  $('#wg').innerHTML = `
    <div class="w" style="display:flex;gap:16px;align-items:center">
      ${photo}
      <div>
        <h4>${esc(cur.name)}</h4>
        <p style="color:var(--mu);font-size:13px">${ROLE[cur.role]}${cur.grade ? ' · ' + GR[cur.grade] : ''}${cur.subject ? ' · ' + cur.subject : ''}</p>
      </div>
    </div>
    <div class="w">
      <div class="li"><b>الهاتف</b><span dir="ltr">${esc(cur.phone)}</span></div>
      <div class="li"><b>تاريخ التسجيل</b><span>${cur.createdAt ? fmt(cur.createdAt) : '—'}</span></div>
    </div>
    ${extra}
    <div class="w"><button class="btn outline full" id="chgPass">تغيير كلمة المرور</button></div>`;

  $('#genLink')?.addEventListener('click', () => {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
    const links = DB.links();
    links.push({ id: code, sid: cur.uid, sname: cur.name, grade: cur.grade, exp: now() + 7 * 864e5 });
    DB.saveLinks(links);
    toast('الكود: ' + code);
    profilePanel();
  });
  $('#chgPass')?.addEventListener('click', () => {
    const np = prompt('كلمة المرور الجديدة (6+ أحرف):');
    if (!np || np.length < 6) return toast('قصيرة جداً');
    const users = DB.users();
    const u = users.find(x => x.uid === cur.uid);
    if (u) { u.pass = np; DB.saveUsers(users); cur.pass = np; toast('تم التغيير'); }
  });
}


/* ========== CHAT / MESSAGES ========== */
function getThread(uid1, uid2) {
  return DB.chats().filter(c => (c.from === uid1 && c.to === uid2) || (c.from === uid2 && c.to === uid1)).sort((a, b) => a.at - b.at);
}
function sendMsg(from, to, text) {
  const t = (text || '').trim();
  if (!t) return false;
  if (t.length > 2000) { toast('الرسالة طويلة'); return false; }
  const chats = DB.chats();
  chats.push({ id: uid(), from: from.uid, fromName: from.name, to: to.uid, toName: to.name, text: t, at: now(), read: false });
  DB.saveChats(chats);
  pushNotif(to.uid, 'رسالة جديدة', from.name + ': ' + t.slice(0, 50), 'chat');
  return true;
}
function markChatRead(reader, other) {
  const chats = DB.chats();
  let ch = false;
  chats.forEach(c => { if (c.to === reader && c.from === other && !c.read) { c.read = true; ch = true; } });
  if (ch) DB.saveChats(chats);
}
function conversationsFor(user) {
  const map = new Map();
  DB.chats().forEach(c => {
    const other = c.from === user.uid ? c.to : (c.to === user.uid ? c.from : null);
    if (!other) return;
    const name = c.from === user.uid ? c.toName : c.fromName;
    if (!map.has(other) || map.get(other).at < c.at) map.set(other, { uid: other, name, last: c.text, at: c.at, unread: 0 });
  });
  DB.chats().forEach(c => { if (c.to === user.uid && !c.read && map.has(c.from)) map.get(c.from).unread++; });
  return [...map.values()].sort((a, b) => b.at - a.at);
}
function chatPanel(targetUid) {
  const users = DB.users();
  const convs = conversationsFor(cur);
  let contacts = [];
  if (cur.role === 'student') contacts = users.filter(u => u.role === 'teacher' && u.status !== 'blocked');
  else if (cur.role === 'teacher') contacts = users.filter(u => u.role === 'student' && u.status !== 'blocked');
  else contacts = users.filter(u => u.uid !== cur.uid);

  if (!targetUid && convs.length) targetUid = convs[0].uid;
  const target = users.find(u => u.uid === targetUid);
  const thread = target ? getThread(cur.uid, target.uid) : [];
  if (target) markChatRead(cur.uid, target.uid);

  $('#wg').innerHTML = `
    <div class="chat-layout">
      <div class="chat-sidebar glass">
        <h5>المحادثات ${unreadBadge()}</h5>
        <div class="chat-list">
          ${convs.length ? convs.map(c => `
            <button class="chat-item ${c.uid === targetUid ? 'on' : ''}" data-chat="${c.uid}">
              <div class="chat-av">${esc((c.name||'?')[0])}</div>
              <div class="chat-meta"><b>${esc(c.name)}</b><span>${esc((c.last||'').slice(0,36))}</span></div>
              ${c.unread ? `<span class="badge">${c.unread}</span>` : ''}
            </button>`).join('') : '<div class="li empty">لا محادثات</div>'}
        </div>
        <div class="chat-new">
          <label>محادثة جديدة</label>
          <select id="chatPick"><option value="">— اختر —</option>
            ${contacts.map(u => `<option value="${u.uid}">${esc(u.name)}</option>`).join('')}
          </select>
          <button class="btn sm gold full" id="chatStart" style="margin-top:8px">بدء</button>
        </div>
      </div>
      <div class="chat-main glass">
        ${target ? `
          <div class="chat-head"><div class="chat-av">${esc(target.name[0])}</div>
            <div><b>${esc(target.name)}</b><br><span style="font-size:12px;color:var(--mu)">${ROLE[target.role]}</span></div></div>
          <div class="chat-msgs" id="chatMsgs">
            ${thread.map(m => `<div class="bubble ${m.from===cur.uid?'me':'them'}"><p>${esc(m.text)}</p><time>${new Date(m.at).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</time></div>`).join('') || '<div class="empty-chat">ابدأ المحادثة</div>'}
          </div>
          <form class="chat-input" id="chatForm">
            <input id="chatText" placeholder="اكتب رسالتك..." maxlength="2000" autocomplete="off">
            <button type="submit" class="btn gold">إرسال</button>
          </form>
        ` : '<div class="empty-chat">اختر محادثة أو ابدأ محادثة جديدة</div>'}
      </div>
    </div>`;

  $('#chatStart')?.addEventListener('click', () => {
    const id = $('#chatPick')?.value;
    if (!id) return toast('اختر مستخدماً');
    chatPanel(id);
  });
  $$('[data-chat]').forEach(b => b.onclick = () => chatPanel(b.dataset.chat));
  $('#chatForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const text = $('#chatText')?.value;
    const tid = document.querySelector('.chat-item.on')?.dataset.chat || $('#chatPick')?.value;
    const target = users.find(u => u.uid === tid);
    if (!target) return toast('اختر مستلماً');
    if (sendMsg(cur, target, text)) { chatPanel(target.uid); }
  });
  const box = $('#chatMsgs');
  if (box) box.scrollTop = box.scrollHeight;
}
function unreadBadge() {
  const n = DB.chats().filter(c => c.to === cur.uid && !c.read).length;
  return n ? `<span class="badge">${n}</span>` : '';
}

/* ========== INIT ========== */
function init() {
  // Theme
  const getTh = () => { try { return localStorage.getItem('tg_theme'); } catch { return null; } };
  const setTh = t => { document.documentElement.dataset.theme = t; try { localStorage.setItem('tg_theme', t); } catch {} };
  setTh(getTh() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  if (!$('#tgl')) {
    document.body.insertAdjacentHTML('beforeend', '<button id="tgl" type="button" aria-label="الوضع">🌓</button>');
    $('#tgl').onclick = () => setTh(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  }

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  renderLanding();

  // Nav scroll
  addEventListener('scroll', () => $('#nav')?.classList.toggle('s', scrollY > 40), { passive: true });

  // Global clicks
  document.body.addEventListener('click', e => {
    const authBtn = e.target.closest('[data-open-auth]');
    if (authBtn) {
      e.preventDefault();
      openAuth(authBtn.dataset.openAuth === 'register' ? 'register' : 'login', authBtn.dataset.role || 'student');
    }
    if (e.target.closest('[data-home]')) {
      e.preventDefault();
      showView('site');
      renderLanding();
    }
    const sub = e.target.closest('[data-open-subject]');
    if (sub && cur) {
      e.preventDefault();
      openSubjectPage(sub.dataset.openSubject);
    } else if (sub && !cur) {
      openAuth('login', 'student');
      toast('سجّل دخولك أولاً لعرض المادة');
    }
  });

  // Auth segment
  $('#authSeg')?.addEventListener('click', e => {
    const b = e.target.closest('button[data-role]');
    if (!b) return;
    authRole = b.dataset.role;
    $$('#authSeg button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    $('#gradeWrap').hidden = !(authMode === 'register' && authRole === 'student');
    $('#subjWrap').hidden = !(authMode === 'register' && authRole === 'teacher');
  });

  $('#authSwitch')?.addEventListener('click', () => {
    openAuth(authMode === 'login' ? 'register' : 'login', authRole);
  });

  $('#authForm')?.addEventListener('submit', handleAuth);

  // Search subjects
  $('#subSearch')?.addEventListener('input', () => {
    const q = $('#subSearch').value.trim().toLowerCase();
    renderSubjects(SUBJECTS.filter(s => s.name.includes(q) || s.teacher.includes(q) || s.desc.includes(q)));
  });

  // Contact
  $('#contactForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#cName').value.trim();
    const phone = $('#cPhone').value.trim();
    const msg = $('#cMsg').value.trim();
    if (!name || !msg) return toast('أكمل الحقول');
    const list = DB.contact();
    list.push({ id: uid(), name, phone, msg, at: now() });
    DB.saveContact(list);
    toast('تم إرسال رسالتك بنجاح');
    $('#contactForm').reset();
  });

  $('#burger')?.addEventListener('click', () => $('#links')?.classList.toggle('open'));

  // Session restore
  const sess = DB.session();
  if (sess) {
    const user = DB.users().find(u => u.uid === sess.uid);
    if (user && user.status !== 'blocked') {
      openApp(user);
      return;
    }
  }
  showView('site');
}

init();
