import { addDoc, collection, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { getFirebaseApp } from '../config/firebase-app.js';
import { firebaseConfigured } from '../config/firebase-env.js';
import { sectionHeading } from '../components/cards.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roleNames={student:'الطالب',parent:'ولي الأمر',teacher:'المدرس',admin:'الإدارة',teacher_applicant:'طلب مدرس'};
const branchNames={science:'علمي علوم',math:'علمي رياضة',literary:'أدبي'};

export function dashboardPage(){
  return `<section class="section page dashboard-page">
    <div class="dashboard-shell">
      ${sectionHeading('لوحة الحساب','جاري تحميل الحساب…','تظهر هنا بيانات الدور المسموح بها فقط، وتُحسم الصلاحيات في Firebase وليس في الواجهة.')}
      <div class="dashboard-status empty-state" data-dashboard-status><span aria-hidden="true">◷</span><p>جارٍ التحقق من الحساب…</p></div>
      <div class="dashboard-grid" data-dashboard-grid hidden></div>
    </div>
  </section>`;
}

function card(title,body,extra=''){return `<article class="dashboard-card"><h2>${esc(title)}</h2>${body}${extra}</article>`;}
function profileCard(profile){
  const role=roleNames[profile.role]||'الحساب';
  const details=[`الدور: ${role}`,profile.email?`البريد: ${profile.email}`:'',profile.phone?`الهاتف: ${profile.phone}`:'',profile.grade?`الصف: ${profile.grade} ثانوي`:'',profile.branch?`الشعبة: ${branchNames[profile.branch]||profile.branch}`:'',profile.className?`الفصل: ${profile.className}`:''].filter(Boolean);
  return card('بيانات الحساب',`<ul class="dashboard-list">${details.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`);
}

export async function initializeDashboard(){
  const status=document.querySelector('[data-dashboard-status]');
  const grid=document.querySelector('[data-dashboard-grid]');
  if(!status||!grid)return;
  if(!firebaseConfigured){status.innerHTML='<p>إعداد Firebase غير مكتمل؛ لم تُعرض بيانات الحساب.</p>';return;}
  try{
    const auth=await import('../auth/auth-service.js');
    const user=auth.getCurrentUser();
    if(!user){status.innerHTML='<p>يجب تسجيل الدخول للوصول إلى اللوحة.</p>';return;}
    const account=await auth.getMyAccountStatus();
    if(account.status!=='active'){status.innerHTML=`<p>حالة الحساب: ${esc(account.status||'غير متاح')}.</p>`;return;}
    const database=getFirestore(getFirebaseApp());
    const profileSnapshot=await getDoc(doc(database,'profiles',user.uid));
    const profile=profileSnapshot.exists()?{uid:user.uid,...profileSnapshot.data(),email:user.email}: {uid:user.uid,email:user.email,role:account.role,status:account.status,displayName:account.displayName};
    status.hidden=true;grid.hidden=false;
    grid.innerHTML=profileCard(profile)+rolePanel(profile);
    bindRoleActions(grid,auth,profile,database);
    await loadAcademicContent(grid,profile,database);
  }catch(error){status.innerHTML=`<p>تعذر تحميل لوحة الحساب: ${esc(error?.message||'خطأ غير معروف')}</p>`;}
}

function rolePanel(profile){
  if(profile.role==='student')return card('مساحة الطالب',`<p>يمكنك متابعة دروسك وواجباتك ونتائجك وجدولك حسب الصف والشعبة.</p><ul class="dashboard-list" data-academic-content><li>جارٍ تحميل المحتوى الدراسي…</li></ul><div class="dashboard-actions"><a class="button" href="/subjects">المواد الدراسية</a><a class="button ghost" href="/results">النتائج</a></div>${profile.parentCode?card('كود ربط ولي الأمر',`<p>شارك هذا الكود مع ولي أمرك فقط:</p><strong class="parent-code" dir="ltr">${esc(profile.parentCode)}</strong>`):''}`);
  if(profile.role==='parent')return card('مساحة ولي الأمر',`<p>اربط حساب ابنك باستخدام كود الربط الذي يظهر في حساب الطالب. لن تستطيع تعديل بيانات الطالب أو درجاته.</p><form class="dashboard-form" data-parent-link><label>كود الطالب<input name="code" inputmode="text" maxlength="10" placeholder="TNG-482917" required></label><button class="button" type="submit">ربط الطالب</button><p class="form-note" data-link-message role="status"></p></form>`);
  if(profile.role==='teacher')return card('مساحة المدرس',`<p>يمكنك نشر درس أو ملف أو فيديو للصفوف المسندة لك فقط.</p><form class="dashboard-form" data-content-form><label>نوع المحتوى<select name="type"><option value="lesson">درس</option><option value="file">ملف</option><option value="video">فيديو</option><option value="assignment">واجب</option></select></label><label>العنوان<input name="title" maxlength="120" required></label><label>الصف<select name="grade" required><option value="1">الأول الثانوي</option><option value="2">الثاني الثانوي</option><option value="3">الثالث الثانوي</option></select></label><label>رابط آمن HTTPS<input name="url" type="url" placeholder="https://" required></label><button class="button" type="submit">نشر المحتوى</button><p class="form-note" data-content-message role="status"></p></form>`);
  if(profile.role==='admin')return card('مساحة الإدارة',`<p>صلاحيات الإدارة تُحسم من سجل admins الموثوق في الخادم.</p><div class="dashboard-actions"><a class="button" href="/admin/teacher-requests">طلبات اعتماد المدرسين</a></div>`);
  return card('الحساب',`<p>لم يكتمل إعداد هذا الدور بعد.</p>`);
}

async function loadAcademicContent(root,profile,database){
  const target=root.querySelector('[data-academic-content]');
  if(!target||profile.role==='teacher')return;
  try{
    const records=(await getDocs(query(collection(database,'content'),where('grade','==',profile.grade||''),where('published','==',true)))).docs.map(item=>item.data());
    target.innerHTML=records.length?records.map(item=>`<li><b>${esc(item.title)}</b><span>${esc(item.type)} · <a href="${esc(item.url)}" target="_blank" rel="noopener">فتح</a></span></li>`).join(''):'<li>لا يوجد محتوى منشور لصفك حتى الآن.</li>';
  }catch{target.innerHTML='<li>تعذر تحميل المحتوى الدراسي.</li>';}
}

function bindRoleActions(root,auth,profile,database){
  root.querySelector('[data-parent-link]')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    const button=form.querySelector('button');
    const message=form.querySelector('[data-link-message]');
    button.disabled=true;
    try{
      const result=await auth.linkParentToStudent(new FormData(form).get('code'));
      message.textContent=`تم ربط حساب الطالب ${result.displayName||''} بنجاح.`;
      form.reset();
    }catch(error){message.textContent=auth.friendlyAuthError(error);message.dataset.kind='error';}
    finally{button.disabled=false;}
  });
  root.querySelector('[data-content-form]')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget,button=form.querySelector('button'),message=form.querySelector('[data-content-message]');
    const values=Object.fromEntries(new FormData(form));
    if(!/^https:\/\//iu.test(values.url)) {message.textContent='الرابط يجب أن يبدأ بـ https://';message.dataset.kind='error';return;}
    button.disabled=true;
    try{
      await addDoc(collection(database,'content'),{...values,teacherUid:profile.uid,published:true,createdAt:new Date()});
      message.textContent='تم نشر المحتوى للصف المحدد.';form.reset();
    }catch(error){message.textContent='تعذر نشر المحتوى أو لا توجد صلاحية لهذا الصف.';message.dataset.kind='error';}
    finally{button.disabled=false;}
  });
}
