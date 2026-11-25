/* Pure registration select logic. No DOM, no Firebase: tracks are static and always available. */
import {TRACKS} from '../../functions/src/validation.js';
export const trackOptions=grade=>Object.entries(TRACKS[grade]||{}).map(([id,label])=>({id,label}));
export const needsTrack=grade=>trackOptions(grade).length>0;
/* status: pick-grade | pick-track | loading | unavailable | empty | ready. Submit is allowed only when ready and a class is chosen. */
export function classState({grade='',branch='',load='loading',classes=[]}){
  if(!grade)return {status:'pick-grade',options:[],message:'اختر الصف الدراسي أولًا.'};
  if(needsTrack(grade)&&!branch)return {status:'pick-track',options:[],message:'اختر الشعبة / المسار أولًا.'};
  if(load==='loading')return {status:'loading',options:[],message:'جارٍ تحميل الفصول…'};
  if(load==='error')return {status:'unavailable',options:[],message:'تعذر تحميل الفصول الآن. تأكد من الاتصال وحاول مرة أخرى.'};
  const options=classes.filter(item=>item.grade===grade&&(!item.branch||item.branch===branch)).map(item=>({id:item.id,label:item.section}));
  if(!options.length)return {status:'empty',options,message:'لا توجد فصول متاحة لهذا الصف والمسار حاليًا. تواصل مع إدارة المدرسة.'};
  return {status:'ready',options,message:''};
}
export const canSubmitStudent=(state,classId)=>state.status==='ready'&&state.options.some(o=>o.id===classId);
