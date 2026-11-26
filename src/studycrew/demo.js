/* Dev-only demo (served by `pnpm dev` at /studycrew-demo.html, not part of the production build). */
import {mountCharacter,characterIds,STATES,getPrefs,setPrefs,setTheme,themeNames,getLog,setLogSink,CharacterCard,MascotBubble,SuccessAnimation,ErrorAnimation,LoadingScene,NotificationCharacter,AchievementBanner,CelebrationOverlay,watchConnection,reducedMotion} from './Shared/index.js';
const $=id=>document.getElementById(id);
const btn=(label,fn,attrs={})=>{const b=document.createElement('button');b.className='chip';b.type='button';b.textContent=label;Object.entries(attrs).forEach(([k,v])=>b.setAttribute(k,v));b.addEventListener('click',()=>fn(b));return b;};
const names={alex:'أليكس',arthur:'آرثر',oscar:'أوسكار',leo:'ليو',chloe:'كلوي'};
let current=null,currentId='alex';
const logEl=$('log');
const renderLog=()=>{logEl.textContent=getLog().slice(-12).map(e=>`${e.level} ${e.msg} ${e.data?JSON.stringify(e.data):''}`).join('\n');};
setLogSink(renderLog);
async function show(id){
  currentId=id;current?.destroy();
  current=await mountCharacter($('stage'),id,{state:'Idle',slot:'demo-stage'});
  [...$('chars').children].forEach(b=>b.toggleAttribute('aria-current',b.dataset.id===id));
  renderLog();
}
const settings=$('settings');
const toggle=(label,key)=>{const b=btn(label,()=>{const v=!getPrefs()[key];setPrefs({[key]:v});b.setAttribute('aria-pressed',String(v));},{'aria-pressed':String(!!getPrefs()[key])});settings.append(b);};
toggle('الصوت','sound');toggle('الاهتزاز','haptics');
const mb=btn('إيقاف الحركة',()=>{const off=getPrefs().motion!=='off';setPrefs({motion:off?'off':'auto'});document.documentElement.dataset.scMotion=off?'off':'';mb.setAttribute('aria-pressed',String(off));show(currentId);},{'aria-pressed':'false'});settings.append(mb);
themeNames().forEach(t=>settings.append(btn('سمة: '+t,()=>setTheme(t))));
const status=document.createElement('span');status.textContent=reducedMotion()?'تقليل الحركة مفعّل':'الحركة مفعّلة';settings.append(status);
characterIds().forEach(id=>{const b=btn(names[id]+' ('+id+')',()=>show(id));b.dataset.id=id;$('chars').append(b);});
STATES.forEach(s=>$('states').append(btn(s,()=>{current?.request(s,{force:true});renderLog();})));
const gal=$('gallery');let held=[];
const put=c=>{held.forEach(x=>x.destroy?.());held=[c];gal.replaceChildren(c.el);};
const comps={
  'CharacterCard':()=>put(CharacterCard({characterId:'alex',title:'صباح الخير',text:'جاهز نكمل اللي بدأناه؟'})),
  'SuccessAnimation':()=>put(SuccessAnimation({characterId:'oscar',message:'اتسلّم! شغل جامد.'})),
  'ErrorAnimation':()=>put(ErrorAnimation({characterId:'arthur',message:'حصلت مشكلة عندنا. جرّب بعد شوية.',retry:{label:'حاول تاني',onClick:()=>{}}})),
  'LoadingScene':()=>put(LoadingScene({characterId:'arthur',message:'جارٍ التحميل…',delayMs:0})),
  'NotificationCharacter':()=>{const c=NotificationCharacter({type:'info',text:'عندك إشعار جديد.'});put(c);},
  'MascotBubble':()=>{const c=MascotBubble({characterId:'alex',text:'تلميح صغير في الركن.',autoHideMs:0});put(c);},
  'AchievementBanner':()=>put(AchievementBanner({title:'إنجاز كبير',text:'خلصت كل الواجبات.',importance:'big'})),
  'CelebrationOverlay':()=>{CelebrationOverlay({text:'مبروك!'});}
};
Object.entries(comps).forEach(([n,fn])=>$('comps').append(btn(n,fn)));
$('comps').append(btn('محاكاة انقطاع الشبكة',()=>put(NotificationCharacter({type:'warn',text:'النت بعيد شوية. هستناك لحد ما يرجع.'}))));
watchConnection(s=>put(NotificationCharacter({type:s==='offline'?'warn':'success',text:s==='offline'?'النت بعيد شوية. هستناك لحد ما يرجع.':'رجع! كمّل من مكانك.'})));
if(!new URLSearchParams(location.search).get('char'))show('alex');
/* deep links for screenshots and QA: ?char=chloe&state=Success&comp=AchievementBanner&theme=light */
const q=new URLSearchParams(location.search);
if(q.get('theme'))setTheme(q.get('theme'));
if(q.get('char'))show(q.get('char')).then(()=>{if(q.get('state'))current?.request(q.get('state'),{force:true});});
if(q.get('comp')&&comps[q.get('comp')])comps[q.get('comp')]();
