import { addDoc, collection, doc, getDoc, getDocs, getFirestore, query, serverTimestamp, where } from 'firebase/firestore';
import { getFirebaseApp } from '../config/firebase-app.js';
import { firebaseConfigured } from '../config/firebase-env.js';
import { subjects } from '../data/catalog.js';
import { sectionHeading, skeletonCards } from '../components/cards.js';

function settle(status,message){status.classList.add('is-settled');status.dataset.kind='error';const text=status.querySelector('p');if(text)text.textContent=message;}
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roleNames={student:'الطالب',parent:'ولي الأمر',teacher:'المدرس',admin:'الإدارة',teacher_applicant:'طلب مدرس'};
const branchNames={science:'علمي علوم',math:'علمي رياضة',literary:'أدبي'};
const gradeNames={'1':'الأول الثانوي','2':'الثاني الثانوي','3':'الثالث الثانوي'};

export function dashboardPage(){
  return `<section class="section page dashboard-page">
    <div class="dashboard-shell">
      <div class="dashboard-toolbar"><button class="button ghost" type="button" data-dashboard-sign-out hidden>تسجيل الخروج</button></div>
      ${sectionHeading('لوحة الحساب','جاري تحميل الحساب…','تظهر هنا بيانات الدور المسموح بها فقط، وتُحسم الصلاحيات في Firebase وليس في الواجهة.')}
      <div class="dashboard-status empty-state" data-dashboard-status role="status"><div class="skeleton-grid" aria-hidden="true">${skeletonCards(2)}</div><p>جارٍ التحقق من الحساب…</p></div>
      <div class="dashboard-grid" data-dashboard-grid hidden></div>
    </div>
  </section>`;
}

function card(title,body,extra=''){return `<article class="dashboard-card"><h2>${esc(title)}</h2>${body}${extra}</article>`;}
function profileCard(profile){
  const role=roleNames[profile.role]||'الحساب';
  const details=[`الدور: ${role}`,profile.email?`البريد: ${profile.email}`:'',profile.phone?`الهاتف: ${profile.phone}`:'',profile.grade?`الصف: ${gradeNames[profile.grade]||profile.grade}`:'',profile.branch?`الشعبة: ${branchNames[profile.branch]||profile.branch}`:'',profile.className?`الفصل: ${profile.className}`:''].filter(Boolean);
  return card('بيانات الحساب',`<ul class="dashboard-list">${details.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`);
}

export async function initializeDashboard(){
  const status=document.querySelector('[data-dashboard-status]');
  const grid=document.querySelector('[data-dashboard-grid]');
  const signOut=document.querySelector('[data-dashboard-sign-out]');
  if(!status||!grid)return;
  if(!firebaseConfigured){settle(status,'إعداد Firebase غير مكتمل؛ لم تُعرض بيانات الحساب.');return;}
  try{
    const auth=await import('../auth/auth-service.js');
    let authTimeout;
    const user=await Promise.race([
      auth.waitForInitialAuthState(),
      new Promise((_,reject)=>{authTimeout=setTimeout(()=>reject(new Error('auth/timeout')),10000);})
    ]).finally(()=>clearTimeout(authTimeout));
    if(!status.isConnected)return;
    if(!user){settle(status,'يجب تسجيل الدخول للوصول إلى اللوحة.');return;}
    const account=await auth.getMyAccountStatus();
    if(!status.isConnected)return;
    if(account.status!=='active'){
      settle(status,`حالة الحساب: ${account.status||'غير متاح'}.`);
      return;
    }
    const database=getFirestore(getFirebaseApp());
    const profileSnapshot=await getDoc(doc(database,'profiles',user.uid));
    if(!status.isConnected)return;
    const profile=profileSnapshot.exists()?{uid:user.uid,...profileSnapshot.data(),email:user.email}:{uid:user.uid,email:user.email,role:account.role,status:account.status,displayName:account.displayName};
    status.hidden=true;
    grid.hidden=false;
    if(signOut)signOut.hidden=false;
    grid.innerHTML=profileCard(profile)+rolePanel(profile);
    bindRoleActions(grid,auth,profile,database);
    await loadAcademicContent(grid,profile,database);
  }catch(error){
    if(status.isConnected)settle(status,error?.message==='auth/timeout'
      ?'تأخر التحقق من جلسة الدخول. تحقق من الاتصال ثم أعد المحاولة.'
      :'تعذر تحميل لوحة الحساب. تحقق من إعداد Firebase ثم حاول مجددًا.');
  }
}

function rolePanel(profile){
  if(profile.role==='student')return card('مساحة الطالب',`<p>يمكنك متابعة محتوى صفك الدراسي من القائمة أدناه.</p><ul class="dashboard-list" data-academic-content><li>جارٍ تحميل المحتوى الدراسي…</li></ul><div class="dashboard-actions"><a class="button" href="/subjects">المواد الدراسية</a><a class="button ghost" href="/results">النتائج</a></div>${profile.parentCode?card('كود ربط ولي الأمر',`<p>الكود صالح لمدة 15 دقيقة ويُستهلك عند إرسال الطلب. شاركه مع ولي أمرك بطريقة آمنة فقط:</p><strong class="parent-code" dir="ltr" data-parent-code>${esc(profile.parentCode)}</strong><p class="form-note" data-parent-code-message>إذا انتهت صلاحيته، أصدر كودًا جديدًا.</p><button class="button ghost" type="button" data-issue-parent-code>إصدار كود جديد</button>`):''}`);
  if(profile.role==='parent')return card('مساحة ولي الأمر',`<p>سيظهر هنا الأبناء المرتبطون بهذا الحساب فقط. كل طلب ربط ينتظر اعتماد إدارة المدرسة.</p><div data-linked-students role="status"><p>جارٍ تحميل روابط الحساب…</p></div><form class="dashboard-form" data-parent-link><label>كود الطالب<input name="code" inputmode="text" maxlength="10" placeholder="TNG-482917" required></label><button class="button" type="submit">إرسال طلب الربط</button><p class="form-note" data-link-message role="status" aria-live="polite"></p></form>`);
  if(profile.role==='teacher'){
    const subjectOptions=subjects.map(subject=>`<option value="${esc(subject.id)}" ${profile.subjectId===subject.id?'selected':''}>${esc(subject.name)}</option>`).join('');
    const grades=Array.isArray(profile.grades)?profile.grades.filter(grade=>gradeNames[grade]):[];
    const gradeOptions=grades.map(grade=>`<option value="${esc(grade)}">${esc(gradeNames[grade])}</option>`).join('');
    return card('مساحة المدرس',`<p>أضف رابط درس أو ملف أو فيديو أو واجب إلى صف مُسند إليك. تقبل المنصة الروابط الآمنة التي تبدأ بـ HTTPS.</p>${grades.length?`<form class="dashboard-form" data-content-form><label>نوع المحتوى<select name="type"><option value="lesson">درس</option><option value="file">ملف</option><option value="video">فيديو</option><option value="assignment">واجب</option></select></label><label>المادة<select name="subjectId" required>${subjectOptions}</select></label><label>العنوان<input name="title" maxlength="120" required></label><label>الصف<select name="grade" required>${gradeOptions}</select></label><label>الرابط الآمن<input name="url" type="url" inputmode="url" pattern="https://.*" placeholder="https://" required></label><button class="button" type="submit">نشر المحتوى</button><p class="form-note" data-content-message role="status" aria-live="polite"></p></form>`:'<p class="form-note">لم تُسند إليك صفوف بعد؛ تواصل مع إدارة المدرسة قبل نشر المحتوى.</p>'}`);
  }
  if(profile.role==='admin')return card('مساحة الإدارة',`<p>صلاحيات الإدارة تُحسم من سجل admins الموثوق في الخادم.</p><div class="dashboard-actions"><a class="button" href="/admin/teacher-requests">طلبات اعتماد المدرسين</a></div><div class="admin-link-requests" data-parent-link-requests role="status"><p>جارٍ تحميل طلبات ربط أولياء الأمور…</p></div>`);
  return card('الحساب',`<p>لم يكتمل إعداد هذا الدور بعد.</p>`);
}

function validHttpsUrl(value){
  try{return new URL(String(value)).protocol==='https:';}
  catch{return false;}
}

async function loadAcademicContent(root,profile,database){
  const target=root.querySelector('[data-academic-content]');
  if(!target||profile.role!=='student')return;
  try{
    const records=(await getDocs(query(collection(database,'content'),where('grade','==',profile.grade||''),where('published','==',true)))).docs.map(item=>item.data());
    target.innerHTML=records.length?records.map(item=>{
      const link=validHttpsUrl(item.url)?`<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">فتح</a>`:'رابط غير متاح';
      return `<li><b>${esc(item.title)}</b><span>${esc(item.type)} · ${link}</span></li>`;
    }).join(''):'<li>لا يوجد محتوى منشور لصفك حتى الآن.</li>';
  }catch{target.innerHTML='<li>تعذر تحميل المحتوى الدراسي الآن.</li>';}
}

async function refreshLinkedStudents(root,auth){
  const target=root.querySelector('[data-linked-students]');
  if(!target)return;
  target.innerHTML='<p>جارٍ تحميل روابط الحساب…</p>';
  try{
    const result=await auth.listLinkedStudents();
    const students=Array.isArray(result.students)?result.students:[];
    if(!students.length){target.innerHTML='<p class="form-note">لا توجد حسابات طلاب مرتبطة بعد.</p>';return;}
    target.innerHTML=`<ul class="dashboard-list linked-student-list">${students.map(student=>{
      const details=[student.grade?gradeNames[student.grade]||student.grade:'',student.branch?branchNames[student.branch]||student.branch:'',student.className||''].filter(Boolean).map(esc).join(' · ');
      return `<li><b>${esc(student.displayName||'طالب')}</b>${details?`<span>${details}</span>`:''}<button class="text-link" type="button" data-parent-unlink="${esc(student.uid)}">فك الربط</button></li>`;
    }).join('')}</ul>`;
  }catch{target.innerHTML='<p class="form-note" data-kind="error">تعذر تحميل الطلاب المرتبطين. تحقق من الاتصال ثم أعد المحاولة.</p>';}
}

function bindRoleActions(root,auth,profile,database){
  if(profile.role==='parent')void refreshLinkedStudents(root,auth);
  if(profile.role==='admin')void refreshParentLinkRequests(root,auth);
  root.querySelector('[data-issue-parent-code]')?.addEventListener('click',async event=>{
    const button=event.currentTarget;
    const codeTarget=root.querySelector('[data-parent-code]');
    const message=root.querySelector('[data-parent-code-message]');
    button.disabled=true;
    try{
      const result=await auth.issueParentCode();
      if(codeTarget)codeTarget.textContent=result.code;
      if(message)message.textContent='تم إصدار كود جديد صالح لمدة 15 دقيقة.';
    }catch{if(message){message.textContent='تعذر إصدار كود جديد الآن.';message.dataset.kind='error';}}
    finally{button.disabled=false;}
  });
  root.querySelector('[data-parent-link]')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    const button=form.querySelector('button');
    const message=form.querySelector('[data-link-message]');
    button.disabled=true;
    try{
      const result=await auth.linkParentToStudent(new FormData(form).get('code'));
      message.textContent=`تم إرسال طلب ربط الطالب ${result.displayName||''} إلى إدارة المدرسة للموافقة.`;
      message.dataset.kind='status';
      form.reset();
      await refreshLinkedStudents(root,auth);
    }catch(error){message.textContent=auth.friendlyAuthError(error);message.dataset.kind='error';}
    finally{button.disabled=false;}
  });
  root.addEventListener('click',async event=>{
    const button=event.target.closest('[data-parent-unlink]');
    if(!button)return;
    if(!window.confirm('سيُلغى وصول هذا الحساب إلى بيانات الطالب. هل تريد فك الربط؟'))return;
    button.disabled=true;
    try{
      await auth.unlinkParentFromStudent(button.dataset.parentUnlink);
      await refreshLinkedStudents(root,auth);
    }catch{
      button.disabled=false;
      const target=root.querySelector('[data-linked-students]');
      const note=document.createElement('p');
      note.className='form-note';
      note.dataset.kind='error';
      note.textContent='تعذر فك الربط. تحقق من الاتصال ثم حاول مرة أخرى.';
      target?.append(note);
    }
  });
  root.addEventListener('click',async event=>{
    const button=event.target.closest('[data-parent-link-review]');
    if(!button)return;
    button.disabled=true;
    try{
      if(button.dataset.parentLinkReview==='approve')await auth.approveParentLink(button.dataset.linkId);
      else await auth.rejectParentLink(button.dataset.linkId);
      await refreshParentLinkRequests(root,auth);
    }catch{button.disabled=false;}
  });
  root.querySelector('[data-content-form]')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget,button=form.querySelector('button'),message=form.querySelector('[data-content-message]');
    const values=Object.fromEntries(new FormData(form));
    if(!validHttpsUrl(values.url)) {message.textContent='الرابط يجب أن يكون عنوان HTTPS صالحًا.';message.dataset.kind='error';return;}
    if(!profile.grades?.includes(values.grade)||values.subjectId!==profile.subjectId){message.textContent='المادة أو الصف غير مسندين إلى حسابك.';message.dataset.kind='error';return;}
    button.disabled=true;
    try{
      await addDoc(collection(database,'content'),{...values,teacherUid:profile.uid,published:true,createdAt:serverTimestamp()});
      message.textContent='تم نشر المحتوى للصف المحدد.';message.dataset.kind='status';form.reset();
    }catch{message.textContent='تعذر نشر المحتوى أو لا توجد صلاحية لهذا الصف.';message.dataset.kind='error';}
    finally{button.disabled=false;}
  });
}

async function refreshParentLinkRequests(root,auth){
  const target=root.querySelector('[data-parent-link-requests]');
  if(!target)return;
  try{
    const result=await auth.listParentLinkRequests();
    const requests=Array.isArray(result.requests)?result.requests:[];
    if(!requests.length){target.innerHTML='<p class="form-note">لا توجد طلبات ربط معلقة.</p>';return;}
    target.innerHTML=`<div class="admin-request-list">${requests.map(request=>`<article class="approval-card"><h3>${esc(request.parentName)} ← ${esc(request.studentName)}</h3><p>طلب ربط ينتظر التحقق الإداري.</p><div class="approval-actions"><button class="button" type="button" data-parent-link-review="approve" data-link-id="${esc(request.linkId)}">اعتماد الربط</button><button class="button ghost" type="button" data-parent-link-review="reject" data-link-id="${esc(request.linkId)}">رفض</button></div></article>`).join('')}</div>`;
  }catch{target.innerHTML='<p class="form-note" data-kind="error">تعذر تحميل طلبات الربط.</p>';}
}
