import {home,subjectsPage,subjectPage,teachersPage,renderTeacherCards,newsPage,schedulePage,resultsPage,contactPage,privacyPage,notFound} from './pages/public-pages.js';
import {loginPage,teacherApprovalPage,adminJoinPage} from './pages/auth-pages.js';
import {createRouteHelpers,resolveAppLink} from './utils/routes.js';
import {initErrorReporter} from './services/error-reporter.js';
import {initErrorBoundary,errorCardHtml} from './ui/error-boundary.js';
import {enhancePasswordFields} from './ui/password-toggle.js';
import {TRACKS} from '../functions/src/validation.js';
import {runCleanups} from './ui/cleanups.js';
import {livingEnabled} from './config/features.js';
import {initUpdateNotice} from './ui/update-notice.js';
import {isPublicRoute,shouldLockSession,gatedRoute} from './auth/session-gate.js';
import {initMotion,routeStart,routeEnd,withThemeTransition,withPageTransition} from './ui/motion.js';

const moduleScriptUrl=document.querySelector('script[type="module"][src]')?.src;
const sourceBasePath=moduleScriptUrl?new URL('../',moduleScriptUrl).pathname:'/';
const routeHelpers=createRouteHelpers(import.meta.env?.BASE_URL||sourceBasePath,location.origin);
const currentRoutePath=()=>routeHelpers.fromUrlPath(location.pathname)??'/';

/* Session gate (src/auth/session-gate.js): while an active account is signed in, public routes
   redirect to /dashboard and the public menu hides. Fails open: an unreadable account status
   (rules not deployed yet, offline) never locks anyone out of the public site. */
let sessionLocked=false;
function applySessionUi(){
  const root=document.documentElement;
  if(sessionLocked)root.dataset.session='active';else delete root.dataset.session;
  const brand=document.querySelector('.topbar .brand');
  if(brand)brand.setAttribute('href',routeHelpers.toUrlPath(sessionLocked?'/dashboard':'/'));
}
function setSessionLocked(locked){
  if(sessionLocked===locked)return;
  sessionLocked=locked;
  applySessionUi();
  if(locked&&isPublicRoute(currentRoutePath())){
    history.replaceState({},'',routeHelpers.toUrlPath('/dashboard'));
    render('/dashboard');
  }
}
let sessionGateToken=0;
async function initSessionGate(){
  try{
    const env=await import('./config/firebase-env.js');
    if(!env.firebaseConfigured)return;
    const auth=await import('./auth/auth-service.js');
    auth.subscribeToAuth(async user=>{
      const token=++sessionGateToken;
      if(!user){setSessionLocked(false);return;}
      try{
        const status=await auth.getMyAccountStatus();
        if(token===sessionGateToken)setSessionLocked(shouldLockSession(status));
      }catch{
        if(token===sessionGateToken)setSessionLocked(false);
      }
    });
  }catch{/* Firebase unavailable: nothing to gate. */}
}

function normalizeInternalLinks(root=document){
  root.querySelectorAll('a[href]').forEach(link=>{
    const rawHref=link.getAttribute('href');
    if(!rawHref||rawHref.startsWith('#')||/^(?:mailto|tel|javascript):/iu.test(rawHref))return;
    const resolved=resolveAppLink(rawHref,location.href,routeHelpers,routePatterns);
    if(!resolved)return;
    link.href=`${routeHelpers.toUrlPath(resolved.route)}${resolved.search}${resolved.hash}`;
  });
}

const routes=[
  [/^\/$/,home],
  [/^\/subjects\/?$/,subjectsPage],
  [/^\/subjects\/([a-z]+)\/?$/,subjectPage],
  [/^\/teachers\/?$/,teachersPage],
  [/^\/news\/?$/,newsPage],
  [/^\/schedule\/?$/,schedulePage],
  [/^\/results\/?$/,resultsPage],
  [/^\/contact\/?$/,contactPage],
  [/^\/privacy\/?$/,privacyPage],
  [/^\/login(?:\/(student|parent|teacher|admin))?\/?$/,loginPage],
  [/^\/dashboard\/?$/,()=>'<section class="section page dashboard-page"><div class="dashboard-shell"><div class="empty-state" role="status"><div class="skeleton-grid" aria-hidden="true"><div class="skeleton-card"><span class="skeleton skeleton-icon"></span><span class="skeleton skeleton-line title"></span><span class="skeleton skeleton-line"></span></div></div><p>جارٍ تحميل لوحة الحساب…</p></div></div></section>'],
  [/^\/admin\/join\/?$/,adminJoinPage],
  [/^\/admin\/teacher-requests\/?$/,teacherApprovalPage]
];

const routePatterns=routes.map(([pattern])=>pattern);

let pageCleanup=()=>{};
let pageGeneration=0;
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escapeRoute=path=>path.startsWith('/subjects/')?'المادة الدراسية — ':'';

function applyTheme(theme){
  const selected=theme==='light'?'light':'dark';
  document.documentElement.dataset.theme=selected;
  try{localStorage.setItem('tn_theme',selected);}catch{}
  const toggle=document.querySelector('[data-theme-toggle]');
  if(toggle){
    toggle.setAttribute('aria-label',selected==='dark'?'تفعيل الوضع الفاتح':'تفعيل الوضع الداكن');
    toggle.setAttribute('title',selected==='dark'?'تفعيل الوضع الفاتح':'تفعيل الوضع الداكن');
    toggle.textContent=selected==='dark'?'☼':'◐';
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',selected==='dark'?'#090d16':'#f5f6f8');
}

function initializeTheme(){
  let saved='';
  try{saved=localStorage.getItem('tn_theme')||'';}catch{}
  applyTheme(saved||(window.matchMedia?.('(prefers-color-scheme: light)').matches?'light':'dark'));
}

const celebrate=anchor=>import('./ui/celebrate.js').then(m=>m.celebrate(anchor)).catch(()=>{});

function showMessage(target,message,kind='status'){
  if(!target)return;
  target.textContent=message;
  target.dataset.kind=kind==='status'&&/^تم /u.test(message)?'success':kind;
  if(message&&target.matches?.('.directory-note'))target.closest('[data-teacher-directory]')?.classList.add('is-settled');
}

function showSignedInMessage(target,message,kind='status'){
  showMessage(target,message,kind);
  const button=document.createElement('button');
  button.type='button';
  button.className='button ghost sign-out-button';
  button.dataset.signOut='true';
  button.textContent='تسجيل الخروج';
  target.append(document.createTextNode(' '),button);
}

function render(path=currentRoutePath()){
  const gated=gatedRoute(path,sessionLocked);
  if(gated!==path){history.replaceState({},'',routeHelpers.toUrlPath(gated));path=gated;}
  runCleanups();
  pageCleanup();
  pageCleanup=()=>{};
  const generation=++pageGeneration;
  const app=document.querySelector('#app');
  routeStart();
  let html=notFound();
  try{
    for(const [pattern,view] of routes){
      const match=path.match(pattern);
      if(match){html=view(...match.slice(1));break;}
    }
  }catch{
    html=errorCardHtml('تعذر عرض الصفحة','حدث خلل أثناء تحميل هذه الصفحة. أعد المحاولة، ولو تكرر الأمر تواصل مع الإدارة.');
  }
  app.innerHTML=html;
  routeEnd(app);
  normalizeInternalLinks();
  document.title=`${escapeRoute(path)}منصة التناغه الشرقيه الثانويه المشتركه`;
  document.querySelector('#nav')?.classList.remove('open');
  document.querySelector('.menu-toggle')?.setAttribute('aria-expanded','false');
  if(/^\/teachers\/?$/.test(path)) initializeTeacherDirectory(generation);
  if(/^\/login(?:\/|$)/.test(path)||/^\/admin\/join\/?$/.test(path))enhancePasswordFields(app);
  if(/^\/login(?:\/|$)/.test(path)) initializeAuthPage(generation);
  if(/^\/admin\/teacher-requests\/?$/.test(path)) initializeTeacherApprovals(generation);
  if(/^\/dashboard\/?$/.test(path)) initializeDashboard(generation);
}

function initializeDashboard(generation){
  import('./pages/dashboard-pages.js').then(({dashboardPage,initializeDashboard:loadAccount})=>{
    if(generation!==pageGeneration||currentRoutePath()!=='/dashboard')return;
    const app=document.querySelector('#app');
    if(!app)return;
    app.innerHTML=dashboardPage();
    normalizeInternalLinks(app);
    loadAccount();
  }).catch(()=>{
    if(generation!==pageGeneration)return;
    const target=document.querySelector('#app .dashboard-shell');
    if(target)target.innerHTML='<div class="empty-state is-settled" data-kind="error" role="status"><p>تعذر تحميل لوحة الحساب الآن. حاول تحديث الصفحة.</p></div>';
  });
}

function initializeTeacherDirectory(generation){
  const target=document.querySelector('[data-teacher-directory]');
  if(!target)return;
  let cancelled=false;
  let unsubscribe=()=>{};
  pageCleanup=()=>{cancelled=true;unsubscribe();};
  import('./config/firebase-env.js').then(async env=>{
    if(cancelled||!target.isConnected)return;
    if(!env.firebaseConfigured){
      showMessage(target.querySelector('p'),'لم يُضبط اتصال Firebase بعد؛ لن تُعرض أسماء تجريبية.');
      return;
    }
    const {contentService}=await import('./services/content-service.js');
    if(cancelled||generation!==pageGeneration||!target.isConnected)return;
    unsubscribe=contentService.watchPublicTeachers(
      records=>{if(!cancelled&&target.isConnected)renderTeacherCards(target,records);},
      error=>{
        if(!cancelled&&target.isConnected)showMessage(target.querySelector('p'),error?.code==='permission-denied'
          ?'تعذر قراءة الدليل؛ لم تُنشر قواعد Firestore أو لا تسمح بالقراءة العامة.'
          :'تعذر تحميل دليل المدرسين الآن. ستُعاد المحاولة عند تحديث الصفحة.');
      }
    );
  }).catch(()=>showMessage(target.querySelector('p'),'تعذر تهيئة خدمة Firebase الآن.'));
}

let pendingRegistrationOptions=null;
function loadRegistrationOptionsOnce(){const run=pendingRegistrationOptions;pendingRegistrationOptions=null;if(run)void run();}
function setAuthMode(mode){
  const root=document.querySelector('.auth-shell');
  if(!root)return;
  if(mode==='register')queueMicrotask(loadRegistrationOptionsOnce);
  root.querySelectorAll('[data-auth-form]').forEach(form=>{form.hidden=form.dataset.authForm!==mode;});
  root.querySelectorAll('[data-auth-mode]').forEach(button=>{
    const selected=button.dataset.authMode===mode;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-selected',String(selected));
  });
  showMessage(root.querySelector('[data-auth-message]'),'');
}

function setupTrackSelect(){
  const gradeSelect=document.querySelector('[data-grade-select]');
  const branchSelect=document.querySelector('[data-branch-select]');
  const branchLabel=document.querySelector('[data-branch-label]');
  if(!gradeSelect||!branchSelect||!branchLabel)return;
  const render=()=>{
    const tracks=Object.entries(TRACKS[gradeSelect.value]||{});
    const keep=branchSelect.value;
    branchLabel.hidden=!tracks.length;
    branchSelect.required=tracks.length>0;
    branchSelect.innerHTML='<option value="">اختر المسار</option>'+tracks.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
    if(tracks.some(([id])=>id===keep))branchSelect.value=keep;
  };
  gradeSelect.addEventListener('change',render);
  render();
}

async function populateRegistrationOptions(isStale){
  const classSelect=document.querySelector('[data-class-select]');
  const subjectSelect=document.querySelector('[data-subject-select]');
  if(!classSelect&&!subjectSelect)return;
  try{
    const structure=await import('./services/structure-service.js');
    if(subjectSelect){
      const list=await structure.loadSubjects();
      if(isStale())return;
      subjectSelect.innerHTML='<option value="">اختر المادة</option>'+list.map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
    }
    if(classSelect){
      const classes=await structure.loadClasses();
      if(isStale())return;
      const gradeSelect=document.querySelector('[data-grade-select]');
      const fallback=document.querySelector('[data-class-fallback]');
      const branchSelect=document.querySelector('[data-branch-select]');
      const refresh=()=>{
        const grade=gradeSelect?.value||'';
        const branch=branchSelect?.value||'';
        const tracks=Object.keys(TRACKS[grade]||{});
        const options=classes.filter(item=>item.grade===grade&&(
          tracks.length ? item.branch===branch : !item.branch
        ));
        if(!classes.length){classSelect.hidden=true;classSelect.closest('label').hidden=true;if(fallback)fallback.hidden=false;return;}
        classSelect.hidden=false;
        classSelect.closest('label').hidden=false;
        if(fallback)fallback.hidden=true;
        classSelect.disabled=!grade;
        classSelect.innerHTML=grade
          ?'<option value="">اختر الفصل</option>'+options.map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.section)}</option>`).join('')
          :'<option value="">اختر الصف أولًا</option>';
        classSelect.required=Boolean(grade&&options.length);
      };
      gradeSelect?.addEventListener('change',refresh);
      branchSelect?.addEventListener('change',refresh);
      refresh();
    }
  }catch{
    const fallback=document.querySelector('[data-class-fallback]');
    if(fallback&&!isStale()){fallback.hidden=false;classSelect?.closest('label')?.setAttribute('hidden','');}
  }
}

function initializeAuthPage(generation){
  const statusTarget=document.querySelector('[data-auth-message]');
  // عناصر المسار تُجهّز فور رسم الصفحة حتى لا تعتمد على اتصال Firebase.
  setupTrackSelect();
  let cancelled=false;
  let unsubscribe=()=>{};
  pageCleanup=()=>{cancelled=true;unsubscribe();};
  import('./config/firebase-env.js').then(async env=>{
    if(cancelled||generation!==pageGeneration||!statusTarget?.isConnected)return;
    if(!env.firebaseConfigured){
      showMessage(statusTarget,'لم تُضبط إعدادات Firebase في بيئة التطبيق، لذلك لا تُرسل بيانات الدخول.');
      document.querySelector('[data-class-fallback]')?.removeAttribute('hidden');
      document.querySelector('[data-class-select]')?.closest('label')?.setAttribute('hidden','');
      return;
    }
    const api=await import('./auth/auth-service.js');
    if(cancelled||generation!==pageGeneration||!statusTarget.isConnected)return;
    // قوائم الفصول والمواد تحتاج Firestore، فلا تُحمَّل إلا عند فتح نموذج التسجيل
    pendingRegistrationOptions=()=>populateRegistrationOptions(()=>cancelled||!statusTarget.isConnected);
    if(document.querySelector('[data-auth-form="register"]:not([hidden])'))loadRegistrationOptionsOnce();
    unsubscribe=api.subscribeToAuth(async user=>{
      if(!user||cancelled||!statusTarget.isConnected)return;
      try{
        const status=await api.getMyAccountStatus();
        if(cancelled||!statusTarget.isConnected)return;
        if(status.role==='teacher_applicant'&&status.status==='pending'){
          showSignedInMessage(statusTarget,'طلب المدرس قيد مراجعة الإدارة. لن يظهر الاسم أو التخصص في الدليل قبل الاعتماد وموافقة النشر.');
        }else if(status.status==='rejected'){
          showSignedInMessage(statusTarget,'لم تتم الموافقة على طلب المدرس. تواصل مع إدارة المدرسة للمراجعة.','error');
        }else if(status.role==='admin'&&currentRoutePath()==='/login/admin'){
          history.replaceState({},'',routeHelpers.toUrlPath('/dashboard'));
          render('/dashboard');
        }else if(status.status==='disabled'||status.status==='graduated'){
          showSignedInMessage(statusTarget,'هذا الحساب موقوف حاليًا. تواصل مع إدارة المدرسة.','error');
        }else if(status.status==='active'){
          showSignedInMessage(statusTarget,'تم تسجيل الدخول. جارٍ فتح لوحتك…');
          if(currentRoutePath().startsWith('/login')){
            history.replaceState({},'',routeHelpers.toUrlPath('/dashboard'));
            render('/dashboard');
          }
        }
      }catch(error){showMessage(statusTarget,api.friendlyAuthError(error),'error');}
    },error=>showMessage(statusTarget,api.friendlyAuthError(error),'error'));
  }).catch(()=>showMessage(statusTarget,'تعذر تهيئة خدمة المصادقة الآن.'));
}

function safeTimestamp(value){
  if(!value)return 'وقت الإرسال غير متاح';
  try{return new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Cairo'}).format(new Date(value));}
  catch{return 'وقت الإرسال غير متاح';}
}

function renderApprovalCards(target,applications){
  target.replaceChildren();
  if(!applications.length){
    const empty=document.createElement('div');
    empty.className='empty-state';
    empty.textContent='لا توجد طلبات مدرسين معلّقة.';
    target.append(empty);
    return;
  }
  for(const application of applications){
    const article=document.createElement('article');
    article.className='approval-card';
    const title=document.createElement('h2');
    title.textContent=application.displayName;
    const subject=document.createElement('p');
    subject.textContent=`التخصص: ${application.subjectName}`;
    const details=document.createElement('p');
    details.textContent=`البريد موثق: ${application.emailVerified?'نعم':'لا'} · موافقة النشر: ${application.publishConsent?'نعم':'لا'} · ${safeTimestamp(application.submittedAt)}`;
    const actions=document.createElement('div');
    actions.className='approval-actions';
    for(const [action,label] of [['approve','اعتماد الطلب'],['reject','رفض الطلب']]){
      const button=document.createElement('button');
      button.type='button';
      button.className=action==='approve'?'button':'button ghost';
      button.dataset.reviewAction=action;
      button.dataset.uid=application.uid;
      button.textContent=label;
      if(action==='approve'&&!application.emailVerified)button.disabled=true;
      actions.append(button);
    }
    article.append(title,subject,details,actions);
    target.append(article);
  }
}

async function loadTeacherApplications(){
  const message=document.querySelector('[data-admin-message]');
  const target=document.querySelector('[data-admin-requests]');
  if(!message||!target)return;
  try{
    const api=await import('./auth/auth-service.js');
    if(!api.getCurrentUser()){
      showMessage(message,'سجّل الدخول بحساب إدارة مخوّل لعرض الطلبات.','error');
      return;
    }
    const status=await api.getMyAccountStatus();
    if(status.role!=='admin'||status.status!=='active'){
      showMessage(message,'هذا المسار خاص بحساب إدارة مخوّل؛ لم تُعرض أي طلبات.','error');
      return;
    }
    const result=await api.listTeacherApplications();
    renderApprovalCards(target,result.applications??[]);
    showMessage(message,'تم تحميل الطلبات المعلقة من Firebase.');
  }catch(error){
    const api=await import('./auth/auth-service.js').catch(()=>null);
    showMessage(message,api?api.friendlyAuthError(error):'تعذر الاتصال بخدمة Firebase.','error');
  }
}

function initializeTeacherApprovals(generation){
  let cancelled=false;
  let unsubscribe=()=>{};
  pageCleanup=()=>{cancelled=true;unsubscribe();};
  import('./config/firebase-env.js').then(async env=>{
    if(cancelled||generation!==pageGeneration)return;
    if(!env.firebaseConfigured){
      showMessage(document.querySelector('[data-admin-message]'),'إعداد Firebase غير مكتمل؛ لم تُحمّل الطلبات.','error');
      return;
    }
    const api=await import('./auth/auth-service.js');
    if(cancelled||generation!==pageGeneration)return;
    unsubscribe=api.subscribeToAuth(()=>{if(!cancelled)loadTeacherApplications();},error=>showMessage(document.querySelector('[data-admin-message]'),api.friendlyAuthError(error),'error'));
  }).catch(()=>showMessage(document.querySelector('[data-admin-message]'),'تعذر تهيئة خدمة الإدارة.','error'));
}

function formValues(form){
  const values={};
  for(const [key,value] of new FormData(form).entries()){
    if(Object.hasOwn(values,key))values[key]=Array.isArray(values[key])?[...values[key],value]:[values[key],value];
    else values[key]=value;
  }
  return values;
}

async function handleLogin(form){
  const message=document.querySelector('[data-auth-message]');
  const button=form.querySelector('[type="submit"]');
  button.disabled=true;
  try{
    const api=await import('./auth/auth-service.js');
    const {email,password}=formValues(form);
    await api.signIn(email,password);
    const status=await api.getMyAccountStatus();
    if(status.role==='admin'){
      history.pushState({},'',routeHelpers.toUrlPath('/dashboard'));
      render('/dashboard');
    }else if(status.role==='teacher_applicant'&&status.status==='pending'){
      showMessage(message,'تم الدخول؛ طلب المدرس ما زال بانتظار اعتماد الإدارة.');
    }else if(status.status==='rejected'){
      showMessage(message,'لم تتم الموافقة على الطلب. تواصل مع إدارة المدرسة.','error');
    }else if(status.status==='none'){
      showMessage(message,'تم تسجيل الدخول. أكمل نموذج إنشاء الحساب لإرسال طلبك.');
      setAuthMode('register');
    }else{
      history.pushState({},'',routeHelpers.toUrlPath('/dashboard'));
      render('/dashboard');
    }
  }catch(error){
    const api=await import('./auth/auth-service.js').catch(()=>null);
    showMessage(message,api?api.friendlyAuthError(error):'تعذر تهيئة خدمة المصادقة.','error');
  }finally{if(button.isConnected)button.disabled=false;}
}

async function handleRegistration(form){
  const message=document.querySelector('[data-auth-message]');
  const button=form.querySelector('[type="submit"]');
  const values=formValues(form);
  const {password,confirmPassword,email,acceptPrivacy,...rest}=values;
  if(values.acceptPrivacy!=='yes'){showMessage(message,'لازم توافق على سياسة الخصوصية لإنشاء الحساب.','error');return;}
  if(password!==confirmPassword){showMessage(message,'كلمتا المرور غير متطابقتين.','error');return;}
  const role=document.querySelector('.auth-shell')?.dataset.role;
  const profile={...rest,role,publishConsent:values.publishConsent==='yes'};
  button.disabled=true;
  try{
    const api=await import('./auth/auth-service.js');
    const currentUser=api.getCurrentUser();
    if(currentUser?.email?.toLowerCase()!==email.trim().toLowerCase())await api.createAuthUser(email,password);
    const application=await api.submitAccountRequest(profile);
    let verificationSent=true;
    try{await api.sendVerificationIfNeeded();}catch{verificationSent=false;}
    const success=role==='teacher'
      ?'تم استلام طلب المدرس وهو بانتظار اعتماد الإدارة. لا يظهر الاسم أو التخصص للعامة قبل الاعتماد وموافقة النشر.'
      :role==='parent'
        ?'تم إنشاء حساب ولي الأمر. افتح رسالة التأكيد في بريدك وافتح الرابط، وبعدها تفتح لوحتك مباشرة بدون موافقة الإدارة.'
        :'تم إنشاء حساب الطالب. افتح رسالة التأكيد في بريدك وافتح الرابط، وبعدها تفتح لوحتك مباشرة بدون موافقة الإدارة.';
    const note=verificationSent?' أُرسل رابط توثيق البريد الإلكتروني.':' تعذر إرسال رسالة التوثيق الآن؛ أعد المحاولة لاحقًا.';
    showMessage(message,`${success}${note}`);
    celebrate(message);
    if(application.status==='pending')form.reset();
    else if(application.status==='active'){
      history.pushState({},'',routeHelpers.toUrlPath('/dashboard'));
      render('/dashboard');
    }
  }catch(error){
    const api=await import('./auth/auth-service.js').catch(()=>null);
    showMessage(message,api?api.friendlyAuthError(error):'تعذر تهيئة خدمة المصادقة.','error');
  }finally{if(button.isConnected)button.disabled=false;}
}

document.addEventListener('click',async event=>{
  const themeButton=event.target.closest('[data-theme-toggle]');
  if(themeButton){const next=document.documentElement.dataset.theme==='dark'?'light':'dark';withThemeTransition(()=>applyTheme(next));return;}

  const dashboardSignOut=event.target.closest('[data-dashboard-sign-out]');
  if(dashboardSignOut){
    dashboardSignOut.disabled=true;
    try{
      const api=await import('./auth/auth-service.js');
      await api.signOutUser();
      history.replaceState({},'',routeHelpers.toUrlPath('/login'));
      render('/login');
    }catch{
      dashboardSignOut.disabled=false;
      const status=document.querySelector('[data-dashboard-status]');
      if(status)showMessage(status.querySelector('p'),'تعذر تسجيل الخروج. حاول مرة أخرى.','error');
    }
    return;
  }

  const scheduleGrade=event.target.closest('[data-schedule-grade]');
  if(scheduleGrade){
    document.querySelectorAll('[data-schedule-grade]').forEach(button=>{
      const selected=button===scheduleGrade;
      button.classList.toggle('selected',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
    const gradeName=scheduleGrade.dataset.gradeName||'';
    const message=document.querySelector('[data-schedule-message]');
    if(message)message.textContent=`لم يُنشر جدول ${gradeName} بعد.`;
    return;
  }

  const subjectTab=event.target.closest('[data-subject-kind]');
  if(subjectTab){
    const tabs=subjectTab.closest('[role="tablist"]');
    tabs?.querySelectorAll('[data-subject-kind]').forEach(button=>{
      const selected=button===subjectTab;
      button.classList.toggle('selected',selected);
      button.setAttribute('aria-selected',String(selected));
      button.tabIndex=selected?0:-1;
    });
    const target=document.querySelector('[data-subject-content]');
    const label=subjectTab.dataset.subjectLabel||subjectTab.textContent.trim();
    if(target)target.textContent=`لا يوجد محتوى منشور في قسم ${label} لهذه المادة حتى الآن.`;
    return;
  }

  const resetButton=event.target.closest('[data-password-reset]');
  if(resetButton){
    const form=resetButton.closest('form');
    const message=document.querySelector('[data-auth-message]');
    const email=form?.elements.namedItem('email')?.value?.trim();
    if(!email){showMessage(message,'اكتب بريدك الإلكتروني في خانة البريد أولًا.','error');form?.elements.namedItem('email')?.focus();return;}
    resetButton.disabled=true;
    try{
      const api=await import('./auth/auth-service.js');
      await api.sendPasswordReset(email);
      showMessage(message,'إذا كان البريد مسجلًا، ستصلك رسالة آمنة لإعادة تعيين كلمة المرور. تحقق من صندوق الوارد والرسائل غير المرغوب فيها.');
    }catch(error){
      const api=await import('./auth/auth-service.js').catch(()=>null);
      if(error?.code==='auth/user-not-found')showMessage(message,'إذا كان البريد مسجلًا، ستصلك رسالة آمنة لإعادة تعيين كلمة المرور. تحقق من صندوق الوارد والرسائل غير المرغوب فيها.');
      else showMessage(message,api?api.friendlyAuthError(error):'تعذر إرسال رسالة الاستعادة الآن.','error');
    }finally{if(resetButton.isConnected)resetButton.disabled=false;}
    return;
  }

  const modeButton=event.target.closest('[data-auth-mode]');
  if(modeButton){setAuthMode(modeButton.dataset.authMode);return;}

  const signOutButton=event.target.closest('[data-sign-out]');
  if(signOutButton){
    try{
      const api=await import('./auth/auth-service.js');
      await api.signOutUser();
      showMessage(document.querySelector('[data-auth-message]'),'تم تسجيل الخروج.');
    }catch(error){showMessage(document.querySelector('[data-auth-message]'),'تعذر تسجيل الخروج.','error');}
    return;
  }

  const reviewButton=event.target.closest('[data-review-action]');
  if(reviewButton){
    const message=document.querySelector('[data-admin-message]');
    reviewButton.disabled=true;
    try{
      const api=await import('./auth/auth-service.js');
      if(reviewButton.dataset.reviewAction==='approve')await api.approveTeacher(reviewButton.dataset.uid);
      else await api.rejectTeacher(reviewButton.dataset.uid);
      showMessage(message,'تم حفظ قرار المراجعة على الخادم.');
      celebrate(message);
      await loadTeacherApplications();
    }catch(error){
      const api=await import('./auth/auth-service.js').catch(()=>null);
      showMessage(message,api?api.friendlyAuthError(error):'تعذر الاتصال بخدمة المراجعة.','error');
      reviewButton.disabled=false;
    }
    return;
  }

  const link=event.target.closest('a[href]');
  if(!link||event.ctrlKey||event.metaKey||event.shiftKey||link.target==='_blank')return;
  const rawHref=link.getAttribute('href')||'';
  if(rawHref.startsWith('#')||/^(?:mailto|tel|javascript):/iu.test(rawHref))return;
  const resolved=resolveAppLink(rawHref,location.href,routeHelpers,routePatterns);
  if(!resolved)return;
  event.preventDefault();
  const destination=sessionLocked&&isPublicRoute(resolved.route)
    ?{...resolved,route:'/dashboard',search:'',hash:''}
    :resolved;
  history.pushState({},'',`${routeHelpers.toUrlPath(destination.route)}${destination.search}${destination.hash}`);
  window.scrollTo({top:0,behavior:'instant'});
  withPageTransition(()=>render(destination.route));
});

async function handleAdminJoin(form){
  const message=document.querySelector('[data-admin-join-message]');
  const button=form.querySelector('[type="submit"]');
  button.disabled=true;
  try{
    const api=await import('./auth/auth-service.js');
    const values=formValues(form);
    if(form.dataset.adminJoin==='create'){
      await api.createAuthUser(values.email,values.password);
      await api.sendVerificationIfNeeded();
      showMessage(message,'تم إنشاء الحساب وأُرسل رابط التوثيق لبريدك. بعد التوثيق اضغط "تفعيل الدعوة".');
    }else{
      const spark=await import('./services/spark-backend.js');
      await spark.claimAdminInvite(values.displayName);
      showMessage(message,'تم تفعيل الدعوة. افتح /login/teacher وسجّل الدخول لتصل للوحة الإدارة.');
    }
  }catch(error){
    const api=await import('./auth/auth-service.js').catch(()=>null);
    showMessage(message,error?.code==='permission-denied'||error?.code==='failed-precondition'?error.message:(api?api.friendlyAuthError(error):'حدث خطأ.'),'error');
  }finally{button.disabled=false;}
}

document.addEventListener('submit',event=>{
  const form=event.target;
  if(form.dataset?.adminJoin){event.preventDefault();handleAdminJoin(form);return;}
  if(form.id==='contact-form'){
    event.preventDefault();
    const note=form.querySelector('.form-note');
    const button=form.querySelector('button[type=submit]');
    button.disabled=true;note.textContent='جارٍ الإرسال...';
    import('./config/firebase-env.js').then(async env=>{
      if(!env.firebaseConfigured){
        const info=(await import('./config/school-info.js')).schoolInfo;
        const ways=[info.phone&&`الهاتف: ${info.phone}`,info.email&&`البريد: ${info.email}`].filter(Boolean).join(' · ');
        throw Object.assign(new Error('unconfigured'),{unconfigured:true,ways});
      }
    }).then(()=>import('./services/spark-backend.js')).then(api=>api.sendContactMessage({name:form.elements.name.value,email:form.elements.email.value,message:form.elements.message.value}))
      .then(()=>{form.reset();note.textContent='وصلت رسالتك للإدارة. شكرًا لك.';})
      .catch(error=>{note.textContent=error?.unconfigured?`إرسال الرسائل من الموقع غير متاح حاليًا. تواصل مع المدرسة مباشرة. ${error.ways}`:'تعذر الإرسال الآن. حاول لاحقًا أو اتصل بالمدرسة.';})
      .finally(()=>{button.disabled=false;});
    return;
  }
  if(form.id==='login-form'){
    event.preventDefault();
    handleLogin(form);
    return;
  }
  if(form.id==='register-form'){
    event.preventDefault();
    handleRegistration(form);
  }
});

window.addEventListener('popstate',()=>withPageTransition(()=>render(currentRoutePath())));
initializeTheme();
initErrorReporter();
initErrorBoundary();
initUpdateNotice();
if(import.meta.env?.PROD&&'serviceWorker' in navigator){
  addEventListener('load',()=>navigator.serviceWorker.register(`${import.meta.env.BASE_URL||'/'}sw.js`,{scope:import.meta.env.BASE_URL||'/'}).catch(()=>{}));
}
let wasOffline=false;
function netBar(text,back){
  let bar=document.getElementById('offline-bar');
  if(!bar){bar=document.createElement('div');bar.id='offline-bar';bar.className='net-bar';bar.setAttribute('role','status');document.body.append(bar);void bar.offsetWidth;}
  bar.textContent=text;
  bar.classList.toggle('is-back',back);
  bar.classList.add('is-in');
  return bar;
}
function syncOnlineBanner(){
  const bar=document.getElementById('offline-bar');
  if(navigator.onLine){
    if(!bar||!wasOffline){bar?.remove();return;}
    wasOffline=false;
    const el=netBar('عاد الاتصال بالإنترنت.',true);
    setTimeout(()=>{el.classList.remove('is-in');setTimeout(()=>el.remove(),500);},2500);
    return;
  }
  wasOffline=true;
  netBar('لا يوجد اتصال بالإنترنت. البيانات الحية لن تعمل حتى يعود الاتصال.',false);
}
addEventListener('online',syncOnlineBanner);addEventListener('offline',syncOnlineBanner);syncOnlineBanner();
document.addEventListener('click',event=>{if(event.target.closest?.('[data-error-retry]'))location.reload();});
document.querySelector('.menu-toggle')?.addEventListener('click',event=>{
  const nav=document.querySelector('#nav');
  const opened=nav.classList.toggle('open');
  event.currentTarget.setAttribute('aria-expanded',String(opened));
});
initMotion();
render();
initSessionGate();
/* Living layer: OFF unless the feature flag is on (src/config/features.js). Lazy, never blocks the app. */
if(livingEnabled())import('./studycrew/Living/wire.js').then(m=>m.startLiving()).catch(()=>{});
