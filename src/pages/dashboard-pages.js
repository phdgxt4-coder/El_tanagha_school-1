import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { getFirebaseApp } from '../config/firebase-app.js';
import { firebaseConfigured } from '../config/firebase-env.js';
import { sectionHeading, skeletonCards } from '../components/cards.js';

function settle(status,message){status.classList.add('is-settled');status.dataset.kind='error';const text=status.querySelector('p');if(text)text.textContent=message;}

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
    const account=await auth.getMyAccountStatus();
    if(!status.isConnected)return;
    if(account.status!=='active'){
      settle(status,`حالة الحساب: ${account.status||'غير متاح'}.`);
      return;
    }
    const database=getFirestore(getFirebaseApp());
    let profile;
    if(account.role==='admin'){
      profile={uid:user.uid,email:user.email,role:'admin',status:'active',displayName:account.displayName||user.email};
    }else{
      const profileSnapshot=await getDoc(doc(database,'profiles',user.uid));
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
    await mod[`mount${cap}`](root,{profile,auth,database});
  }catch(error){
    if(status.isConnected)settle(status,error?.message==='auth/timeout'
      ?'تأخر التحقق من جلسة الدخول. تحقق من الاتصال ثم أعد المحاولة.'
      :'تعذر تحميل لوحة الحساب. تحقق من إعداد Firebase ثم حاول مجددًا.');
  }
}
