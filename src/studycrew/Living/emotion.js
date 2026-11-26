/* Emotional UX, Delight and Anti-Frustration. Egyptian Arabic copy lives here only, so it is easy to review and edit. */
import {LIVING} from './config.js';
export const COPY={
  fail:['ولا يهم ❤️ كل محاولة بتقربك من النجاح.','عادي، ده جزء من التعلم. نحاول تاني؟'],
  perfect:['درجة كاملة! أنت جامد جدًا 🌟','١٠٠٪، تعبك باين!'],
  good:['شغل ممتاز 👏','نتيجة حلوة، كمّل كده.'],
  firstExam:['أول امتحان خلص، مبروك! أصعب خطوة عدّت 🎉'],
  weekStreak:['أسبوع كامل مذاكرة! الفريق كله فرحان بيك 🎉'],
  longStreak:['سلسلة طويلة جدًا. أنت مثال حقيقي في الالتزام 🏆'],
  welcomeBack:['حمدلله على السلامة، وحشتنا 👋','أهلًا بعودتك! نكمل من حيث وقفت؟'],
  delight:['أحسنت 👏','كمّل... أنت ماشي ممتاز.','خطوة بخطوة، وبتوصل.'],
  help:{password:'من غير قلق، تقدر تعمل كلمة سر جديدة في دقيقة.',generic:'جرّب مرة كمان، ولو لسه مش ماشي أنا هنا أساعدك.',offline:'مفيش إنترنت دلوقتي. اللي كتبته محفوظ وهيتبعت أول ما النت يرجع.',upload:'الرفع ماكملش. اضغط إعادة المحاولة وهنكمل من جديد.'},
  /* Contextual one-line hints: where each crew member speaks outside auth. Keyed by spot,
     shown once per session through director('hint'). All Egyptian Arabic copy stays in this file. */
  hints:{
    tasks:'خطوة بخطوة وهتخلّصها كلها. يلا نبدأ؟ 💪',
    grades:'شوف تقدّمك بيكبر إزاي. كل درجة خطوة لفوق 🌱',
    teacher:'أهلًا بحضرتك. كل أدوات الفصل جاهزة بين إيديك 📖',
    parent:'اطمّن، درجات ابنك وحضوره وجدوله كلها قدامك هنا 📖',
    notFound:'الصفحة دي مش موجودة. ارجع للرئيسية أو سجّل دخولك من فوق.',
    offline:'الإنترنت انقطع. اللي بتعمله محفوظ وهيكمّل أول ما يرجع.',
    online:'الإنترنت رجع. كمّل من حيث وقفت.'
  }
};
export function createPicker(rand=Math.random){
  const last=new Map();
  return (key,list=COPY[key])=>{
    if(!list?.length)return '';
    let i=Math.floor(rand()*list.length);
    if(list.length>1&&i===last.get(key))i=(i+1)%list.length;
    last.set(key,i);return list[i];
  };
}
/* Delight: rare, never repeated back to back, capped per day. now and rand are injectable for tests. */
export function createDelight({now=()=>Date.now(),rand=Math.random,cfg=LIVING.delight}={}){
  let lastAt=-Infinity,day='',count=0;
  return ()=>{
    const t=now();const d=new Date(t).toDateString();
    if(d!==day){day=d;count=0;}
    if(count>=cfg.maxPerDay||t-lastAt<cfg.minGapMs||rand()>cfg.chance)return false;
    lastAt=t;count++;return true;
  };
}
/* Anti-Frustration: after repeated errors of one kind within the window, switch from "wrong" to help. */
export function createFrustration({now=()=>Date.now(),cfg=LIVING.frustration}={}){
  const hist=new Map();
  return {
    record(kind){
      const t=now();const a=(hist.get(kind)||[]).filter(x=>t-x<cfg.windowMs);a.push(t);hist.set(kind,a);
      return a.length>=cfg.repeatToHelp;
    },
    reset(kind){kind?hist.delete(kind):hist.clear();}
  };
}
export const helpFor=kind=>COPY.help[kind]||COPY.help.generic;
