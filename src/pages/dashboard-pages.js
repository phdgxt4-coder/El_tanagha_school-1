import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { getFirebaseApp } from '../config/firebase-app.js';
import { firebaseConfigured } from '../config/firebase-env.js';
import { sectionHeading, skeletonCards } from '../components/cards.js';
import { withTimeout } from '../utils/load-state.js';

function settle(status,message){status.classList.add('is-settled');status.dataset.kind='error';const text=status.querySelector('p');if(text)text.textContent=message;}

/* Shows the failure with a retry button instead of a dead skeleton: the dashboard load is
   re-run in place, so a stalled connection never strands the user on an endless spinner. */
function settleWithRetry(status,message,retry){
  settle(status,message);
  const button=document.createElement('button');
  button.type='button';
  button.className='button ghost';
  button.textContent='إعادة المحاولة';
  button.addEventListener('click',()=>{
    status.classList.remove('is-settled');
    delete status.dataset.kind;
    status.innerHTML='<p>جارٍ التحقق من الحساب…</p>';
    void retry();
  });
  status.append(' ',button);
}

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
    const account=await withTimeout(auth.getMyAccountStatus());
    if(!status.isConnected)return;
    if(account.status!=='active'){
      settle(status,account.status==='disabled'||account.status==='graduated'?'هذا الحساب موقوف حاليًا. تواصل مع إدارة المدرسة.':`حالة الحساب: ${account.status||'غير متاح'}.`);
      return;
    }
    if(account.role!=='admin'&&account.emailVerified!==true){
      status.innerHTML='<p>وثّق بريدك الإلكتروني أولًا لتفتح لوحتك. افتح الرابط المرسل إلى بريدك ثم اضغط "وثّقت بريدي". لو لم تجد الرسالة ابحث في الرسائل غير المرغوبة (Spam).</p><button type="button" class="button" data-check-verify>وثّقت بريدي</button> <button type="button" class="button ghost" data-resend-verify>أرسل رابط التوثيق مرة أخرى</button>';
      // Recheck in place (refresh the auth token, then reload the dashboard state) instead of
      // a full page reload: faster, and the recheck itself is capped so it cannot hang.
      status.querySelector('[data-check-verify]').addEventListener('click',async event=>{
        const button=event.currentTarget;
        button.disabled=true;
        button.textContent='جارٍ التحقق…';
        try{
          const user=auth.getCurrentUser();
          if(user)await withTimeout(user.reload(),10000);
          status.innerHTML='<p>جارٍ التحقق من الحساب…</p>';
          await initializeDashboard();
        }catch{
          button.disabled=false;
          button.textContent='وثّقت بريدي';
        }
      });
      status.querySelector('[data-resend-verify]').addEventListener('click',async event=>{
        const button=event.currentTarget;
        const {createResendGuard,resendLabel}=await import('../auth/action-logic.js');
        let storage=null;try{storage=window.sessionStorage;}catch{}
        const guard=createResendGuard({storage,key:'tn_resend_action'});
        if(!guard.canSend()){button.textContent=resendLabel(guard);return;}
        button.disabled=true;
        try{await auth.sendVerificationIfNeeded();guard.record();button.textContent='تم الإرسال. افحص بريدك وابحث في Spam.';}catch{button.textContent='تعذر الإرسال الآن، حاول لاحقًا.';}
        setTimeout(()=>{if(button.isConnected){button.textContent=resendLabel(guard,'أرسل رابط التوثيق مرة أخرى');button.disabled=!guard.canSend();}},4000);
      });
      return;
    }
    const database=getFirestore(getFirebaseApp());
    let profile;
    if(account.role==='admin'){
      profile={uid:user.uid,email:user.email,role:'admin',status:'active',displayName:account.displayName||user.email};
    }else{
      const profileSnapshot=await withTimeout(getDoc(doc(database,'profiles',user.uid)));
      if(!status.isConnected)return;
      profile=profileSnapshot.exists()?{uid:user.uid,...profileSnapshot.data(),email:user.email}:{uid:user.uid,email:user.email,role:account.role,status:account.status,displayName:account.displayName};
    }
    const page=document.querySelector('.dashboard-page');
    const modules={student:()=>import('./dashboards/student.js'),teacher:()=>import('./dashboards/teacher.js'),parent:()=>import('./dashboards/parent.js'),admin:()=>import('./dashboards/admin.js')};
    if(!modules[profile.role]){settle(status,'لم يكتمل إعداد هذا الدور بعد.');return;}
    const mod=await modules[profile.role]();
    if(!status.isConnected)return;
    const cap=profile.role[0].toUpperCase()+profile.role.slice(1);
    page.classList.add('dashboard-page--role');
    page.innerHTML=mod[`render${cap}`](profile);
    const root=page.querySelector('.dash');
    root.classList.add('dash-in');
    import('./dashboards/common.js').then(common=>{common.mountBell(root,{profile,database});common.labelOrphans(root);}).catch(()=>{});
    await mod[`mount${cap}`](root,{profile,auth,database});
  }catch(error){
    if(!status.isConnected)return;
    const slow=error?.message==='auth/timeout'||error?.code==='load-timeout';
    settleWithRetry(status,slow
      ?'الاتصال بطيء جدًا أو الخدمة لم تجهز بعد (تأكد أن قاعدة بيانات Firestore أُنشئت والقواعد منشورة). تحقق ثم أعد المحاولة.'
      :'تعذر تحميل لوحة الحساب. تحقق من إعداد Firebase ثم حاول مجددًا.',initializeDashboard);
  }
}
