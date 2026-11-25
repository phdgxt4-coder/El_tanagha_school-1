import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,onAuthStateChanged,setPersistence,browserSessionPersistence} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,updateDoc,writeBatch,deleteDoc,addDoc,serverTimestamp,collection,getDocs,query,where} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const LOGO='<img class="logo" src="assets/images/logo-fancy.png" alt="شعار المدرسة" width="44" height="44">';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ic=n=>`<svg class="ic"><use href="#i-${n}"/></svg>`;
const ROLE={admin:'الإدارة',student:'طالب',teacher:'مدرس',parent:'ولي أمر'};
const SUBJ=[
  {i:'book',t:'اللغة العربية',teacher:'أ. محمود عبد الرحمن',desc:'النحو والصرف والبلاغة والأدب والنصوص، مع تدريبات على التعبير والقراءة المتحررة.',count:2},
  {i:'globe',t:'اللغة الإنجليزية',teacher:'أ. سارة إبراهيم',desc:'قواعد ومفردات واستماع وكتابة، مع تدريبات على النطق والكتابة.',count:1},
  {i:'math',t:'الرياضيات',teacher:'أ. أحمد فتحي',desc:'الجبر وحساب المثلثات والهندسة التحليلية والتفاضل، بحل مسائل متدرجة الصعوبة.',count:1},
  {i:'atom',t:'الفيزياء',teacher:'أ. خالد النجار',desc:'الحركة والقوى والكهرباء والمغناطيسية، مع تجارب توضيحية ومسائل تطبيقية.',count:1},
  {i:'flask',t:'الكيمياء',teacher:'أ. منى حسين',desc:'الكيمياء العضوية وغير العضوية، التفاعلات والمعادلات، والتدريب على المعمل.',count:1},
  {i:'leaf',t:'الأحياء',teacher:'أ. عمرو سعيد',desc:'خلية وأنسجة ووراثة وفسيولوجيا، مع رسوم توضيحية وأنشطة عملية.',count:0},
  {i:'hist',t:'التاريخ',teacher:'أ. هالة محمد',desc:'تاريخ مصر والعالم الحديث والمعاصر، وتحليل الوثائق والمصادر التاريخية.',count:0},
  {i:'map',t:'الجغرافيا',teacher:'أ. ياسر عبد الله',desc:'جغرافيا مصر والوطن العربي والعالم، الخرائط والمناخ والسكان والموارد.',count:0}
];
const TEACHERS=[
  {name:'محمود عبد الرحمن',role:'مدرس أول اللغة العربية',subj:'اللغة العربية',bio:'خبرة تزيد على خمسة عشر عامًا في تدريس مناهج الثانوية، متخصص في النحو والبلاغة وتحليل النصوص.',av:'مع'},
  {name:'سارة إبراهيم',role:'مدرسة اللغة الإنجليزية',subj:'اللغة الإنجليزية',bio:'تركيز على المهارات الأربع مع تدريبات مستمرة على المحادثة والكتابة الأكاديمية.',av:'سا'},
  {name:'أحمد فتحي',role:'مدرس الرياضيات',subj:'الرياضيات',bio:'شرح مبسط للجبر وحساب المثلثات والتفاضل، مع بنك أسئلة وحل مسائل الأعوام السابقة.',av:'أح'},
  {name:'خالد النجار',role:'مدرس الفيزياء',subj:'الفيزياء',bio:'يهتم بربط الفيزياء بالتجربة العملية، ويقدم مراجعات مركزة قبل الامتحانات.',av:'خا'},
  {name:'منى حسين',role:'مدرسة الكيمياء',subj:'الكيمياء',bio:'متابعة دقيقة للتفاعلات والمعادلات الكيميائية وتدريب على أسئلة المعمل والتفكير العلمي.',av:'مح'},
  {name:'ياسر عبد الله',role:'مدرس الجغرافيا',subj:'الجغرافيا',bio:'تدريب على قراءة الخرائط وتحليل المناخ والسكان والموارد الاقتصادية.',av:'يع'},
  {name:'هالة محمد',role:'مدرسة التاريخ',subj:'التاريخ',bio:'تحليل الأحداث والوثائق التاريخية، وربط الماضي بالحاضر بأسلوب سردي ممتع.',av:'ها'},
  {name:'سمير رشاد',role:'مدرس الفلسفة',subj:'الفلسفة',bio:'تقديم قضايا الفلسفة والمنطق بأسلوب حواري ينمّي التفكير الناقد لدى الطالب.',av:'سر'}
];
const NEWS=[
  {tag:'مثبت',pinned:true,date:'15 سبتمبر 2025',title:'بدء العام الدراسي الجديد وانتظام الجداول',body:'تعلن إدارة المدرسة عن بدء الدراسة للعام الجديد وانتظام الجدول الدراسي لجميع الصفوف الثانوية. نرجو من الطلاب وأولياء الأمور الالتزام بمواعيد الحضور والانصراف، ومتابعة بوابة الطالب على المنصة للاطلاع على الجداول والدروس أولًا بأول.'},
  {tag:'إعلان',date:'1 نوفمبر 2025',title:'مراجعات نهائية مجانية على المنصة',body:'يبدأ المدرسون في نشر مراجعات مركزة واختبارات إلكترونية قصيرة على المنصة قبل الامتحانات. تابع قسم المواد الدراسية.'},
  {tag:'نشاط',date:'20 أكتوبر 2025',title:'مسابقة البحث العلمي بين الطلاب',body:'تنظم المدرسة مسابقة سنوية للبحث العلمي لطلاب الصفوف الثانوية في مجالات العلوم والبيئة والتكنولوجيا. آخر موعد لتقديم الأبحاث هو بداية الشهر القادم.'},
  {tag:'إعلان',date:'10 أكتوبر 2025',title:'تفعيل بوابة ولي الأمر لمتابعة أبنائكم',body:'تم تفعيل بوابة ولي الأمر على المنصة، وهي تتيح متابعة الحضور والدرجات وملاحظات المدرسين والإعلانات. لربط الحساب، يُدخل ولي الأمر رقم الطالب الظاهر في الملف الشخصي لابنه.'}
];
const ROLES=[
  {k:'student',t:'طالب',d:'الدروس والواجبات والدرجات والحضور',icon:'🎓'},
  {k:'parent',t:'ولي أمر',d:'متابعة ابنك: الدرجات والحضور والملاحظات',icon:'👨‍👩‍👧'},
  {k:'teacher',t:'مدرس',d:'رفع الدروس والفيديوهات وإنشاء الامتحانات وتسجيل الحضور',icon:'📋'}
];
const SCHEDULE={
  1:[['اللغة العربية','book'],['اللغة الإنجليزية','globe'],['الرياضيات','math'],['الفيزياء','atom'],['الكيمياء','flask'],['الأحياء','leaf'],['التاريخ','hist']],
  2:[['اللغة الإنجليزية','globe'],['الجغرافيا','map'],['الفلسفة','book'],['علم النفس','book'],['الفيزياء','atom'],['الأحياء','leaf'],['الرياضيات','math']],
  3:[['الفيزياء','atom'],['الأحياء','leaf'],['اللغة الإنجليزية','globe'],['الرياضيات','math'],['اللغة الفرنسية','globe'],['التاريخ','hist']]
};
const DASH={
admin:{nav:[['home','الرئيسية'],['users','اعتماد المدرسين'],['bell','إرسال إشعارات']],qa:['اعتماد المدرسين','إرسال إشعارات'],st:[['الدور','أدمن']]},
student:{nav:[['home','الرئيسية'],['book','المواد'],['file','الواجبات'],['edit','الامتحانات'],['video','الفيديوهات'],['up','الملفات'],['cal','الجدول'],['chart','الدرجات'],['users','ربط ولي الأمر'],['bell','الإشعارات'],['msg','المساعد الذكي']],qa:['المواد','الواجبات','الامتحانات','الفيديوهات'],st:[['المواد','8'],['واجبات معلقة','0'],['متوسط الدرجات','—']]},
teacher:{nav:[['home','الرئيسية'],['up','رفع الدروس'],['video','رفع الفيديوهات'],['edit','إنشاء امتحان'],['check','التصحيح'],['users','تسجيل الحضور'],['bell','إرسال إشعارات']],qa:['رفع درس','رفع فيديو','إنشاء امتحان','تسجيل الحضور'],st:[['الطلاب','0'],['الدروس المرفوعة','0'],['امتحانات نشطة','0']]},
parent:{nav:[['home','الرئيسية'],['users','ربط ابني'],['chart','تقرير ابني'],['msg','رسائل المدرسة']],qa:['ربط ابني','تقرير ابني','رسائل المدرسة'],st:[['نسبة الحضور','—'],['آخر درجة','—'],['رسائل جديدة','0']]}};
const WG=[['آخر الدروس','لا توجد دروس بعد','سيظهر هنا ما يرفعه المدرسون'],['الامتحانات القادمة','لا توجد امتحانات','ستظهر مواعيدها هنا'],['آخر الإشعارات','مرحبًا بك في المنصة','الآن']];
/* helpers */
function toast(t){const m=document.createElement('div');m.className='msg';m.textContent=t;document.body.append(m);setTimeout(()=>m.remove(),2200)}
function view(v){['login','app'].forEach(x=>$('#'+x).classList.toggle('on',x===v));$('#site').style.display=v?'none':'';scrollTo(0,0)}
document.addEventListener('click',e=>{const b=e.target.closest('.btn,.qa button');if(!b)return;const r=b.getBoundingClientRect(),s=document.createElement('span'),d=Math.max(r.width,r.height);
 s.className='rp';s.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`;b.append(s);setTimeout(()=>s.remove(),600)});
/* landing content */
$('#roleGrid').innerHTML=ROLES.map(r=>`<div class="portal-card rv" data-login data-r="${r.k}"><div class="p-icon">${r.icon}</div><h4>${r.t}</h4><p>${r.d}</p><button class="btn gold" data-login data-r="${r.k}">دخول البوابة</button></div>`).join('');
$('#subGrid').innerHTML=SUBJ.map(s=>`<div class="sub-card rv"><span class="count">${s.count} درس</span><div class="s-ico">${ic(s.i)}</div><h4>${s.t}</h4><div class="teacher">${esc(s.teacher)}</div><p class="desc">${esc(s.desc)}</p><a class="open-link" data-login data-r="student">عرض المحتوى ←</a></div>`).join('');
$('#teachersGrid').innerHTML=TEACHERS.map(t=>`<div class="t-card rv"><div class="t-top"><div class="t-av">${t.av}</div><div><h4>${esc(t.name)}</h4><div class="role">${esc(t.role)}</div><span class="subj-tag">${esc(t.subj)}</span></div></div><p class="bio">${esc(t.bio)}</p><div class="t-acts"><button class="btn outline sm">اتصال</button><button class="btn outline sm">بريد</button></div></div>`).join('');
$('#newsGrid').innerHTML=NEWS.map(n=>`<div class="n-card rv"><div class="n-meta"><span class="n-tag${n.pinned?' pinned':''}">${n.tag}</span><span class="n-date">${n.date}</span></div><h4>${esc(n.title)}</h4><p>${esc(n.body)}</p></div>`).join('');
function renderSchedule(g){const list=SCHEDULE[g]||SCHEDULE[1];$('#periods').innerHTML=list.map((p,i)=>`<div class="period"><span class="num">${i+1}</span><span class="name">${ic(p[1])} ${p[0]}</span></div>`).join('')}
renderSchedule(1);
$$('.schedule-tabs .tab').forEach(b=>b.onclick=()=>{$$('.schedule-tabs .tab').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderSchedule(b.dataset.g)});
/* reveal on scroll */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('show');io.unobserve(e.target)}}),{threshold:.12});
$$('.rv').forEach(el=>io.observe(el));
/* nav scroll */
const nav=$('#nav');
window.addEventListener('scroll',()=>nav.classList.toggle('s',scrollY>40),{passive:true});
/* burger */
const burger=$('#burger'),links=$('#links');
if(burger)burger.onclick=()=>links.classList.toggle('open');
if(links)$$('#links a').forEach(a=>a.onclick=()=>links.classList.remove('open'));
/* contact form */
const cSend=$('#cSend');
if(cSend)cSend.onclick=()=>{const n=$('#cName').value.trim(),p=$('#cPhone').value.trim(),m=$('#cMsg').value.trim();
 if(!n||!p||!m)return toast('املأ جميع الحقول');toast('تم إرسال رسالتك بنجاح');$('#cName').value=$('#cPhone').value=$('#cMsg').value=''};
/* subject search */
const subSearch=$('#subSearch');
if(subSearch)subSearch.oninput=()=>{const q=subSearch.value.trim().toLowerCase();
 $$('#subGrid .sub-card').forEach(c=>{const t=c.querySelector('h4').textContent+c.querySelector('.teacher').textContent;c.style.display=t.toLowerCase().includes(q)?'':'none'})};
/* auth: Firebase — الأمان الحقيقي في firestore.rules على السيرفر مش في الكود */
const auth=getAuth(initializeApp(firebaseConfig)),db=getFirestore(auth.app);
setPersistence(auth,browserSessionPersistence).catch(()=>{});
let role='student',signup=false,cur=null,busy=false;
const mail=p=>p+'@tanaga.school';
const prof=async uid=>{const s=await getDoc(doc(db,'users',uid));return s.exists()?{uid,...s.data()}:null};
const errMsg=c=>({'auth/email-already-in-use':'هذا الرقم مسجل من قبل','auth/invalid-credential':'الرقم أو كلمة المرور غير صحيحة','auth/too-many-requests':'محاولات كثيرة، حاول لاحقًا','auth/network-request-failed':'تحقق من الاتصال بالإنترنت'}[c]||'حدث خطأ، حاول مرة أخرى');
function gw(){$('#grWrap').hidden=!(signup&&role==='student')}
function mode(s){signup=s;gw();$('#lt').textContent=s?'إنشاء حساب':'تسجيل الدخول';$('#nmWrap').hidden=!s;$('#sw').textContent=s?'لديك حساب؟ تسجيل الدخول':'ليس لديك حساب؟ إنشاء حساب';$('#er').textContent=''}
function setRole(r){role=r;gw();$$('#seg button').forEach(b=>b.classList.toggle('on',b.dataset.r===r))}
$$('#seg button').forEach(b=>b.onclick=()=>setRole(b.dataset.r));
$$('[data-login]').forEach(b=>b.onclick=()=>{if(b.dataset.r)setRole(b.dataset.r);mode(b.dataset.login==='signup');view('login')});
$$('[data-home]').forEach(b=>b.onclick=()=>view(''));
$('#sw').onclick=()=>mode(!signup);
async function enter(f,fresh){const p=await prof(f.uid);
 if(!p||p.status!=='active'){await signOut(auth);throw{m:p&&p.status==='pending'?'حسابك بانتظار اعتماد الإدارة':'الحساب غير مفعل'}}
 if(fresh&&p.role!==role&&p.role!=='admin'){await signOut(auth);throw{m:'نوع الحساب غير مطابق، اختر التبويب الصحيح'}}
 openApp(p,fresh)}
$('#go').onclick=async()=>{if(busy)return;const er=$('#er'),ph=$('#ph').value.trim(),pw=$('#pw').value,nm=$('#nm').value.trim();
 if(!/^01\d{9}$/.test(ph))return er.textContent='رقم الهاتف غير صحيح (11 رقم يبدأ بـ 01)';
 if(pw.length<6)return er.textContent='كلمة المرور لا تقل عن 6 أحرف';
 if(signup&&(!nm||nm.length>60))return er.textContent='اكتب اسمك (حتى 60 حرفًا)';
 busy=true;er.textContent='';
 try{let c;
  if(signup){c=await createUserWithEmailAndPassword(auth,mail(ph),pw);
   await setDoc(doc(db,'users',c.user.uid),{name:nm,phone:ph,role,status:role==='teacher'?'pending':'active',...(role==='student'?{grade:$('#gr').value}:{})});
   if(role==='teacher'){await signOut(auth);mode(false);er.textContent='تم إنشاء حسابك، بانتظار اعتماد الإدارة';return}}
  else c=await signInWithEmailAndPassword(auth,mail(ph),pw);
  $('#pw').value='';await enter(c.user,true)}
 catch(e){er.textContent=e.m||errMsg(e.code)}finally{busy=false}};
function resetUI(){cur=null;$('#app').innerHTML='';view('');history.replaceState(null,'',location.pathname+location.search)}
async function logout(){await signOut(auth).catch(()=>{});resetUI();toast('تم تسجيل الخروج')}
const askOut=()=>{if(confirm('هل تريد تسجيل الخروج؟'))logout()};
onAuthStateChanged(auth,f=>{if(busy)return;if(!f){if(cur)resetUI();return}if(!cur)enter(f,false).catch(()=>{})});
addEventListener('popstate',()=>{if($('#app').classList.contains('on')&&location.hash!=='#dashboard')view('')});
/* لوحة الأدمن: اعتماد المدرسين (السيرفر يرفض الطلب لو المستخدم مش أدمن) */
async function adminPanel(){const w=$('#wg');if(!w)return;
 try{const s=await getDocs(query(collection(db,'users'),where('role','==','teacher'),where('status','==','pending')));
  w.innerHTML=`<div class="w"><h5>مدرسون بانتظار الاعتماد</h5>${s.empty?'<div class="li">لا توجد طلبات</div>':s.docs.map(d=>`<div class="li">${esc(d.data().name)} — ${esc(d.data().phone)}<span><button class="btn sm" data-ok="${esc(d.id)}">اعتماد</button></span></div>`).join('')}</div>`;
  $$('[data-ok]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await updateDoc(doc(db,'users',b.dataset.ok),{status:'active'});toast('تم الاعتماد');adminPanel()}catch(e){toast('تعذر الاعتماد');b.disabled=false}})}
 catch(e){w.innerHTML='<div class="w"><div class="li">تعذر تحميل البيانات</div></div>'}}
/* dashboard */
function openApp(u,fresh){cur=u;flt='';const d=DASH[u.role],nm=esc(u.name);
 if(location.hash!=='#dashboard')history[fresh?'pushState':'replaceState'](null,'','#dashboard');
 const out=`<button class="out" type="button" data-out>${ic('out')}تسجيل الخروج</button>`;
 $('#app').innerHTML=`<aside class="side" id="side"><a class="brand">${LOGO}<span>التناغة الشرقية<small>${ROLE[u.role]}</small></span></a>
 <nav class="snav">${d.nav.map(([i,t],k)=>`<a class="${k?'':'on'}">${ic(i)}${t}</a>`).join('')}</nav>${out}</aside><div class="scrim" id="scrim"></div>
 <div class="main"><div class="topb"><button class="mb" id="mb" aria-label="القائمة">${ic('menu')}</button><h3>أهلاً ${nm}</h3><span style="color:var(--mu)">${ic('bell')}</span><div class="av">${esc((u.name||'؟')[0])}</div>
 <button class="out out-t" type="button" data-out aria-label="تسجيل الخروج">${ic('out')}<span><span class="lg">تسجيل </span>الخروج</span></button></div>
 <div class="qa">${d.qa.map(q=>`<button>${ic('arrow')}${q}</button>`).join('')}</div>
 <div class="st">${d.st.map(([l,v])=>`<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
 <div class="wg" id="wg">${WG.map(()=>'<div class="w"><div class="sk" style="width:50%"></div><div class="sk"></div><div class="sk" style="width:70%"></div></div>').join('')}</div></div>`;
 view('app');
 setTimeout(()=>{const w=$('#wg');if(w&&u.role==='admin')return adminPanel();if(w&&u.role==='parent')return reportPanel();if(w)return contentPanel();if(w)w.innerHTML=WG.map(([h,a,b])=>`<div class="w"><h5>${h}</h5><div class="li">${a}<span>${b}</span></div></div>`).join('')},700);
 $$('[data-out]').forEach(b=>b.onclick=askOut);
 const side=$('#side'),shut=()=>side.classList.remove('o');
 $('#mb').onclick=()=>side.classList.toggle('o');$('#scrim').onclick=shut;
 $$('.snav a').forEach(a=>a.onclick=()=>{$$('.snav a').forEach(x=>x.classList.remove('on'));a.classList.add('on');shut();go(a.textContent.trim())});
 $$('.qa button').forEach(b=>b.onclick=()=>go(b.textContent.trim()))}

/* المحتوى: دروس / فيديوهات / واجبات بروابط https فقط (الأمان الفعلي في firestore.rules) */
const KIND={lesson:'درس / ملف',video:'فيديو',assignment:'واجب'},GR={'1':'الصف الأول','2':'الصف الثاني','3':'الصف الثالث'};
const L2K={'الواجبات':'assignment','الفيديوهات':'video','الملفات':'lesson','المواد':'','رفع درس':'lesson','رفع الدروس':'lesson','رفع فيديو':'video','رفع الفيديوهات':'video'};
const okUrl=u=>{try{return new URL(u).protocol==='https:'}catch(e){return false}};
let items=[],flt='';
function go(t){const P={'الامتحانات':examPanel,'إنشاء امتحان':examPanel,'الدرجات':gradesPanel,'التصحيح':resPanel,'تسجيل الحضور':attPanel,'اعتماد المدرسين':adminPanel,'ربط ولي الأمر':linkPanel,'الإشعارات':inboxPanel,'رسائل المدرسة':inboxPanel,'إرسال إشعارات':msgPanel,'ربط ابني':kidsPanel,'تقرير ابني':reportPanel,'المساعد الذكي':aiPanel};
 if(cur.role==='parent')return(P[t]||(t==='الرئيسية'?reportPanel:()=>toast('هذا القسم قيد التجهيز')))();
 if(t==='الرئيسية'){if(cur.role==='admin')adminPanel();else contentPanel();return}
 if(P[t])return P[t]();
 if(!(t in L2K))return toast('هذا القسم قيد التجهيز');
 if($('#cl'))return goC(t);
 if(cur.role!=='teacher')flt=L2K[t];
 contentPanel().then(()=>goC(t))}
function goC(t){
 if(cur.role==='teacher'){const k=$('#ck');if(k)k.value=L2K[t]||'lesson';const f=$('#cf');if(f)f.scrollIntoView({behavior:'smooth'});return}
 flt=L2K[t];$$('#cc button').forEach(b=>b.classList.toggle('on',b.dataset.f===flt));list()}
async function load(){const c=collection(db,'content');
 const q=cur.role==='student'?query(c,where('grade','==',cur.grade||'0')):cur.role==='teacher'?query(c,where('tid','==',cur.uid)):c;
 items=(await getDocs(q)).docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.at?.seconds||0)-(a.at?.seconds||0))}
function list(){const l=$('#cl');if(!l)return;const t=cur.role==='teacher',a=items.filter(i=>!flt||i.kind===flt);
 l.innerHTML=a.length?a.map(i=>`<div class="li"><b>${esc(i.title)}</b><br>${esc(KIND[i.kind])} · ${esc(i.subject)} · ${esc(GR[i.grade])}${i.due?' · التسليم: '+esc(i.due):''}${t?'':' · '+esc(i.tname)}<span>${okUrl(i.url)?`<a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">فتح الرابط</a>`:''}${t?` <button class="lnk" data-del="${esc(i.id)}">حذف</button>`:''}</span></div>`).join(''):'<div class="li">لا يوجد محتوى بعد</div>';
 $$('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('حذف هذا العنصر؟'))return;try{await deleteDoc(doc(db,'content',b.dataset.del));items=items.filter(x=>x.id!==b.dataset.del);list()}catch(e){toast('تعذر الحذف')}})}
async function contentPanel(){const w=$('#wg');if(!w)return;const t=cur.role==='teacher',op=o=>Object.entries(o).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
 w.innerHTML=(t?`<div class="w frm" id="cf"><h5>إضافة محتوى</h5><label>النوع</label><select id="ck">${op(KIND)}</select><label>العنوان</label><input id="ct" maxlength="100"><label>المادة</label><select id="cs">${SUBJ.map(x=>`<option>${x[1]}</option>`).join('')}</select><label>الصف</label><select id="cg">${op(GR)}</select><label>الرابط (https فقط: يوتيوب أو درايف)</label><input id="cu" type="url" dir="ltr" placeholder="https://"><label>موعد التسليم (للواجب فقط)</label><input id="cd" maxlength="30"><div class="err" id="ce"></div><button class="btn full" id="cb">نشر</button></div>`:'')
 +`<div class="w" style="grid-column:1/-1"><h5>${t?'محتواي':'المحتوى الدراسي'}</h5><div class="chips" id="cc">${[['','الكل'],...Object.entries(KIND)].map(([k,v])=>`<button data-f="${k}" class="${k===flt?'on':''}">${v}</button>`).join('')}</div><div id="cl"><div class="sk"></div></div></div>`;
 $$('#cc button').forEach(b=>b.onclick=()=>{flt=b.dataset.f;$$('#cc button').forEach(x=>x.classList.toggle('on',x===b));list()});
 if(t)$('#cb').onclick=async()=>{const e=$('#ce'),title=$('#ct').value.trim(),url=$('#cu').value.trim();
  if(!title)return e.textContent='اكتب العنوان';if(!okUrl(url))return e.textContent='الرابط لازم يبدأ بـ https://';
  const d={kind:$('#ck').value,title,subject:$('#cs').value,grade:$('#cg').value,url,tid:cur.uid,tname:cur.name,at:serverTimestamp()},due=$('#cd').value.trim();
  if(due&&d.kind==='assignment')d.due=due;
  try{await addDoc(collection(db,'content'),d);$('#ct').value=$('#cu').value=$('#cd').value='';e.textContent='';toast('تم النشر');await load();list()}catch(x){e.textContent='تعذر النشر'}};
 try{await load()}catch(e){items=[]}list()}

/* الامتحانات والدرجات والحضور — مفتاح الإجابات منفصل (keys) والسيرفر مايسمحش للطالب يقراه إلا بعد انتهاء الامتحان */
const W=h=>{const w=$('#wg');if(w)w.innerHTML=h},card=(t,b)=>`<div class="w" style="grid-column:1/-1"><h5>${t}</h5>${b}</div>`;
const fmt=d=>d.toDate().toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'}),col=(n,...w)=>getDocs(query(collection(db,n),...w)),rows=q=>q.docs.map(d=>({id:d.id,...d.data()}));
const OPT=o=>Object.entries(o).map(([k,v])=>`<option value="${k}">${v}</option>`).join(''),NONE='<div class="li">لا يوجد بيانات</div>';
const safe=f=>async(...a)=>{try{await f(...a)}catch(e){W(card('خطأ','<div class="li">تعذر تحميل البيانات</div>'))}};
const mineEx=async()=>rows(await col('exams',where('tid','==',cur.uid))).sort((a,b)=>(b.at?.seconds||0)-(a.at?.seconds||0));
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
let qn=0;const qb=()=>{const n=qn++;return `<div class="qb"><input class="qq" placeholder="نص السؤال" maxlength="300">${[0,1,2,3].map(i=>`<label class="op"><input type="radio" name="r${n}" value="${i}"${i?'':' checked'}><input class="qo" placeholder="الاختيار ${i+1}" maxlength="150"></label>`).join('')}</div>`};
function take(e){let left=e.mins*60,done=0;
 W(`<div class="w frm" style="grid-column:1/-1"><h5>${esc(e.title)} <span id="tm"></span></h5>${e.qs.map((q,n)=>`<div class="qb"><b>${n+1}. ${esc(q.q)}</b>${q.o.map((o,i)=>`<label class="op"><input type="radio" name="q${n}" value="${i}"><span>${esc(o)}</span></label>`).join('')}</div>`).join('')}<div class="err" id="xe"></div><button class="btn full" id="xs">تسليم</button></div>`);
 const send=async()=>{if(done)return;done=1;clearInterval(iv);const a=e.qs.map((_,n)=>{const r=document.querySelector(`input[name=q${n}]:checked`);return r?+r.value:-1});
  try{await setDoc(doc(db,'subs',e.id+'_'+cur.uid),{eid:e.id,tid:e.tid,sid:cur.uid,sname:cur.name,grade:cur.grade,a,at:serverTimestamp()});toast('تم تسليم الامتحان');examPanel()}catch(x){done=0;$('#xe').textContent='تعذر التسليم (ربما انتهى الموعد أو سُلّم من قبل)'}};
 const iv=setInterval(()=>{if(!$('#xs')){clearInterval(iv);return}left--;$('#tm').textContent=`⏱ ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;if(left<=0)send()},1000);
 $('#xs').onclick=send}
const examPanel=safe(async()=>{
 if(cur.role==='student'){const[ex,sb]=await Promise.all([col('exams',where('grade','==',cur.grade||'0')),col('subs',where('sid','==',cur.uid))]);
  const dn=new Set(rows(sb).map(x=>x.eid)),now=Date.now(),l=rows(ex).sort((a,b)=>b.closeAt.seconds-a.closeAt.seconds);
  W(card('الامتحانات',l.length?l.map(e=>{const o=e.closeAt.toMillis()>now,d=dn.has(e.id);return `<div class="li"><b>${esc(e.title)}</b><br>${esc(e.subject)} · ${+e.mins} دقيقة · ينتهي ${fmt(e.closeAt)}<span>${d?'تم التسليم':o?`<button class="btn sm" data-x="${esc(e.id)}">ابدأ</button>`:'انتهى'}</span></div>`}).join(''):NONE));
  $$('[data-x]').forEach(b=>b.onclick=()=>{if(confirm('سيبدأ العد التنازلي الآن. متأكد؟'))take(l.find(e=>e.id===b.dataset.x))});return}
 const m=await mineEx();
 W(`<div class="w frm" id="xf"><h5>إنشاء امتحان</h5><label>العنوان</label><input id="xt" maxlength="100"><label>المادة</label><select id="xsu">${SUBJ.map(x=>`<option>${x[1]}</option>`).join('')}</select><label>الصف</label><select id="xg">${OPT(GR)}</select><label>المدة (دقيقة)</label><input id="xm" type="number" min="1" max="180" value="30"><label>آخر موعد للدخول والتسليم</label><input id="xc" type="datetime-local"><label>الأسئلة (حدد الإجابة الصحيحة بالدائرة)</label><div id="xq">${qb()}</div><button class="lnk" id="xa" type="button">+ إضافة سؤال</button><div class="err" id="xe"></div><button class="btn full" id="xp">نشر الامتحان</button></div>`
  +card('امتحاناتي',m.length?m.map(e=>`<div class="li">${esc(e.title)} · ${esc(GR[e.grade])}<span><button class="lnk" data-r="${esc(e.id)}">النتائج</button> <button class="lnk" data-d="${esc(e.id)}">حذف</button></span></div>`).join(''):NONE));
 $('#xa').onclick=()=>$('#xq').insertAdjacentHTML('beforeend',qb());
 $$('[data-r]').forEach(b=>b.onclick=()=>resPanel(b.dataset.r));
 $$('[data-d]').forEach(b=>b.onclick=async()=>{if(!confirm('حذف الامتحان؟'))return;const bt=writeBatch(db);bt.delete(doc(db,'exams',b.dataset.d));bt.delete(doc(db,'keys',b.dataset.d));try{await bt.commit();examPanel()}catch(x){toast('تعذر الحذف')}});
 $('#xp').onclick=async()=>{const e=$('#xe'),title=$('#xt').value.trim(),mins=parseInt($('#xm').value,10),cl=new Date($('#xc').value),qs=[],a=[];let bad=!title;
  $$('#xq .qb').forEach(b=>{const q=b.querySelector('.qq').value.trim(),o=[...b.querySelectorAll('.qo')].map(x=>x.value.trim());if(!q||o.some(x=>!x))bad=true;qs.push({q,o});a.push(+b.querySelector('input[type=radio]:checked').value)});
  if(bad)return e.textContent='املأ العنوان وكل الأسئلة والاختيارات';
  if(!(mins>=1&&mins<=180))return e.textContent='المدة من 1 إلى 180 دقيقة';
  if(isNaN(cl)||cl<=Date.now())return e.textContent='حدد موعد انتهاء في المستقبل';
  const ref=doc(collection(db,'exams')),bt=writeBatch(db);
  bt.set(ref,{title,subject:$('#xsu').value,grade:$('#xg').value,mins,closeAt:cl,qs,tid:cur.uid,tname:cur.name,at:serverTimestamp()});
  bt.set(doc(db,'keys',ref.id),{tid:cur.uid,a});
  try{await bt.commit();toast('تم نشر الامتحان');examPanel()}catch(x){e.textContent='تعذر النشر'}}});
const resPanel=safe(async id=>{const ex=await mineEx();let out='';
 if(id){const e=ex.find(x=>x.id===id),[sb,k]=await Promise.all([col('subs',where('eid','==',id),where('tid','==',cur.uid)),getDoc(doc(db,'keys',id))]);
  const key=k.data().a,t=e.qs.length,r=rows(sb).map(x=>({n:x.sname,s:x.a.filter((v,i)=>v===key[i]).length})).sort((a,b)=>b.s-a.s);
  out=card(esc(e.title),r.length?r.map(x=>`<div class="li"><div style="flex:1">${esc(x.n)}<div class="bar"><i style="width:${Math.round(x.s/t*100)}%"></i></div></div><span>${x.s}/${t} (${Math.round(x.s/t*100)}%)</span></div>`).join('')+`<div class="li"><b>المتوسط</b><span>${(r.reduce((a,x)=>a+x.s,0)/r.length).toFixed(1)}/${t}</span></div>`:'<div class="li">لا توجد تسليمات بعد</div>')}
 W(card('نتائج الامتحانات (تصحيح تلقائي)',ex.length?`<div class="chips">${ex.map(e=>`<button data-r="${esc(e.id)}" class="${e.id===id?'on':''}">${esc(e.title)}</button>`).join('')}</div>`:NONE)+out);
 $$('[data-r]').forEach(b=>b.onclick=()=>resPanel(b.dataset.r))});
const gradesPanel=safe(async()=>W(await kidReport(cur.uid)));
const attPanel=safe(async(g='1',d=today())=>{const[us,ex]=await Promise.all([col('users',where('role','==','student'),where('grade','==',g)),col('att',where('date','==',d),where('tid','==',cur.uid))]);
 const st=Object.fromEntries(rows(ex).map(x=>[x.sid,x.st])),S=rows(us).sort((a,b)=>a.name.localeCompare(b.name,'ar'));
 W(card('تسجيل الحضور',`<div class="frm"><select id="ag">${OPT(GR)}</select><input id="ad" type="date" value="${esc(d)}"></div><button class="btn sm" id="al">تحميل</button>`+(S.length?S.map(s=>`<div class="li">${esc(s.name)}<span class="tg chips" data-s="${esc(s.id)}" data-n="${esc(s.name)}"><button class="${st[s.id]!=='a'?'on':''}" data-v="p">حاضر</button><button class="${st[s.id]==='a'?'on':''}" data-v="a">غائب</button></span></div>`).join('')+'<button class="btn full" id="as">حفظ الحضور</button>':'<div class="li">لا يوجد طلاب مسجلون في هذا الصف</div>')));
 $('#ag').value=g;$('#al').onclick=()=>attPanel($('#ag').value,$('#ad').value||d);
 $$('.tg button').forEach(b=>b.onclick=()=>b.parentNode.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)));
 if(S.length)$('#as').onclick=async()=>{const dd=$('#ad').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(dd))return toast('تاريخ غير صحيح');const bt=writeBatch(db);
  $$('.tg').forEach(t=>bt.set(doc(db,'att',dd+'_'+t.dataset.s),{sid:t.dataset.s,sname:t.dataset.n,grade:g,date:dd,st:t.querySelector('.on').dataset.v,tid:cur.uid}));
  try{await bt.commit();toast('تم حفظ الحضور')}catch(e){toast('تعذر الحفظ')}}});

/* المرحلة 4: ربط ولي الأمر بكود، التقارير، الإشعارات */
const AUD={all:'الجميع',students:'كل الطلاب',parents:'كل أولياء الأمور','1':'طلاب الصف الأول','2':'طلاب الصف الثاني','3':'طلاب الصف الثالث'};
const byAt=(a,b)=>(b.at?.seconds||0)-(a.at?.seconds||0);
async function kidReport(sid){const[sb,at]=await Promise.all([col('subs',where('sid','==',sid)),col('att',where('sid','==',sid))]);
 const out=await Promise.all(rows(sb).map(async x=>{try{const e=(await getDoc(doc(db,'exams',x.eid))).data();if(e.closeAt.toMillis()>Date.now())return `<div class="li">${esc(e.title)}<span>تظهر النتيجة بعد انتهاء الموعد</span></div>`;
  const k=(await getDoc(doc(db,'keys',x.eid))).data().a,n=x.a.filter((v,i)=>v===k[i]).length,p=Math.round(n/e.qs.length*100);
  return `<div class="li"><div style="flex:1">${esc(e.title)} · ${esc(e.subject)}<div class="bar"><i style="width:${p}%"></i></div></div><span>${n}/${e.qs.length}</span></div>`}catch(z){return `<div class="li">امتحان<span>تظهر النتيجة بعد انتهاء الموعد</span></div>`}}));
 const A=rows(at),p=A.filter(x=>x.st==='p').length,pc=A.length?Math.round(p/A.length*100):0;
 return card('الدرجات',out.join('')||NONE)+card('الحضور',A.length?`<div class="li"><div style="flex:1">نسبة الحضور<div class="bar"><i style="width:${pc}%"></i></div></div><span>${pc}% (${p}/${A.length})</span></div><div class="li">أيام الغياب<span>${A.filter(x=>x.st==='a').map(x=>esc(x.date)).sort().join('، ')||'لا يوجد'}</span></div>`:'<div class="li">لم يُسجَّل حضور بعد</div>')}
const unlink=async b=>{try{await deleteDoc(doc(db,'kids',b.dataset.ku))}catch(e){toast('تعذر فك الربط')}};
const linkPanel=safe(async()=>{const[ls,ks]=await Promise.all([col('links',where('sid','==',cur.uid)),col('kids',where('sid','==',cur.uid))]);
 const L=rows(ls).filter(x=>x.exp.toMillis()>Date.now());
 W(card('ربط ولي الأمر',`<div class="li">أعطِ الكود لولي أمرك (صالح 7 أيام، ولا تشاركه مع غيره)</div>${L.map(x=>`<div class="li"><b dir="ltr" style="letter-spacing:2px">${esc(x.id)}</b><span><button class="lnk" data-ld="${esc(x.id)}">إلغاء</button></span></div>`).join('')}<button class="btn" id="lg">إنشاء كود جديد</button>`)
  +card('أولياء الأمور المرتبطون',ks.empty?NONE:rows(ks).map(k=>`<div class="li">${esc(k.pname)}<span><button class="lnk" data-ku="${esc(k.id)}">فك الربط</button></span></div>`).join('')));
 $('#lg').onclick=async()=>{const c=[...crypto.getRandomValues(new Uint8Array(10))].map(b=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%32]).join('');
  try{await setDoc(doc(db,'links',c),{sid:cur.uid,sname:cur.name,grade:cur.grade,exp:new Date(Date.now()+7*864e5)});linkPanel()}catch(e){toast('تعذر إنشاء الكود')}};
 $$('[data-ld]').forEach(b=>b.onclick=async()=>{try{await deleteDoc(doc(db,'links',b.dataset.ld))}catch(e){toast('تعذر الإلغاء')}linkPanel()});
 $$('[data-ku]').forEach(b=>b.onclick=async()=>{await unlink(b);linkPanel()})});
const kidsPanel=safe(async()=>{const k=rows(await col('kids',where('pid','==',cur.uid)));
 W(`<div class="w frm"><h5>ربط ابني</h5><label>كود الربط (من حساب ابنك: ربط ولي الأمر)</label><input id="kc" dir="ltr" maxlength="10" autocomplete="off"><div class="err" id="ke"></div><button class="btn full" id="kb">ربط</button></div>`
  +card('أبنائي',k.length?k.map(x=>`<div class="li">${esc(x.sname)} · ${esc(GR[x.grade])}<span><button class="lnk" data-ku="${esc(x.id)}">فك الربط</button></span></div>`).join(''):NONE));
 $('#kb').onclick=async()=>{const e=$('#ke'),c=$('#kc').value.trim().toUpperCase();if(!/^[A-Z2-9]{10}$/.test(c))return e.textContent='الكود غير صحيح';
  try{const l=await getDoc(doc(db,'links',c)),d=l.data();if(!l.exists()||d.exp.toMillis()<Date.now())throw 0;
   await setDoc(doc(db,'kids',cur.uid+'_'+d.sid),{pid:cur.uid,pname:cur.name,sid:d.sid,sname:d.sname,grade:d.grade,code:c});toast('تم الربط');kidsPanel()}catch(x){e.textContent='كود غير صحيح أو منتهي'}};
 $$('[data-ku]').forEach(b=>b.onclick=async()=>{await unlink(b);kidsPanel()})});
const reportPanel=safe(async sid=>{const k=rows(await col('kids',where('pid','==',cur.uid)));
 if(!k.length)return W(card('تقرير ابني','<div class="li">اربط حساب ابنك أولًا من "ربط ابني"</div>'));
 const s=typeof sid==='string'?sid:k[0].sid;
 W(card('أبنائي',`<div class="chips">${k.map(x=>`<button data-k="${esc(x.sid)}" class="${x.sid===s?'on':''}">${esc(x.sname)} · ${esc(GR[x.grade])}</button>`).join('')}</div>`)+await kidReport(s));
 $$('[data-k]').forEach(b=>b.onclick=()=>reportPanel(b.dataset.k))});
const inboxPanel=safe(async()=>{const a=cur.role==='parent'?['all','parents']:['all','students',cur.grade||'0'];
 const l=rows(await col('msgs',where('aud','in',a))).sort(byAt);
 W(card('رسائل المدرسة',l.length?l.map(m=>`<div class="li"><div style="flex:1"><b>${esc(m.title)}</b><br>${esc(m.text)}</div><span>${esc(m.bname)}${m.at?' · '+fmt(m.at):''}</span></div>`).join(''):'<div class="li">لا توجد رسائل</div>'))});
const msgPanel=safe(async()=>{const l=rows(await getDocs(cur.role==='admin'?collection(db,'msgs'):query(collection(db,'msgs'),where('by','==',cur.uid)))).sort(byAt);
 W(`<div class="w frm"><h5>إرسال إشعار</h5><label>إلى</label><select id="ma">${OPT(AUD)}</select><label>العنوان</label><input id="mt" maxlength="100"><label>النص</label><textarea id="mx" maxlength="1000" rows="4"></textarea><div class="err" id="mr"></div><button class="btn full" id="ms">إرسال</button></div>`
  +card('المُرسَل',l.length?l.map(m=>`<div class="li"><div style="flex:1"><b>${esc(m.title)}</b> · ${esc(AUD[m.aud])}<br>${esc(m.text)}</div><span><button class="lnk" data-md="${esc(m.id)}">حذف</button></span></div>`).join(''):NONE));
 $('#ms').onclick=async()=>{const t=$('#mt').value.trim(),x=$('#mx').value.trim();if(!t||!x)return $('#mr').textContent='اكتب العنوان والنص';
  try{await addDoc(collection(db,'msgs'),{title:t,text:x,aud:$('#ma').value,by:cur.uid,bname:cur.name,at:serverTimestamp()});toast('تم الإرسال');msgPanel()}catch(e){$('#mr').textContent='تعذر الإرسال'}};
 $$('[data-md]').forEach(b=>b.onclick=async()=>{try{await deleteDoc(doc(db,'msgs',b.dataset.md))}catch(e){toast('تعذر الحذف')}msgPanel()})});

/* المرحلة 5: الوضع الليلي + PWA + المساعد الذكي (المفتاح السري على السيرفر في Cloud Functions فقط) */
const getTh=()=>{try{return localStorage.getItem('tn_theme')}catch(e){return null}};
const setTh=t=>{document.documentElement.dataset.theme=t;try{localStorage.setItem('tn_theme',t)}catch(e){}};
setTh(getTh()||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
document.body.insertAdjacentHTML('beforeend','<button id="tgl" type="button" aria-label="تبديل الوضع الليلي">🌓</button>');
$('#tgl').onclick=()=>setTh(document.documentElement.dataset.theme==='dark'?'light':'dark');
/* The legacy PWA is no longer the active app. Do not re-register its offline cache. */
const aiPanel=safe(async()=>{
 W(`<div class="w frm" style="grid-column:1/-1"><h5>المساعد الذكي</h5><div class="li">اسأل عن أي درس أو مسألة وسيشرحها لك. (30 سؤالًا يوميًا، وكل سؤال مستقل عن اللي قبله)</div><div class="ai" id="ai"></div><textarea id="aq" rows="3" maxlength="1000" placeholder="اكتب سؤالك هنا"></textarea><button class="btn full" id="ab">إرسال</button></div>`);
 $('#ab').onclick=async()=>{const q=$('#aq').value.trim(),b=$('#ab'),l=$('#ai');if(!q)return;b.disabled=true;
  l.insertAdjacentHTML('beforeend',`<div class="u">${esc(q)}</div><div class="a" id="aw">جاري التفكير…</div>`);$('#aq').value='';
  const o=$('#aw');
  try{const r=await httpsCallable(getFunctions(db.app,'europe-west1'),'askAI')({q});o.textContent=r.data.a}
  catch(e){o.textContent=e.code==='functions/resource-exhausted'?'وصلت للحد اليومي، جرّب بكرة':'المساعد غير متاح الآن'}
  o.removeAttribute('id');b.disabled=false}});
