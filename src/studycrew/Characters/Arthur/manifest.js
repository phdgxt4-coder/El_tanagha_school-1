const art=n=>new URL(`./art/${n}.webp`,import.meta.url).href;
export default {
  id:'arthur',name:'Arthur',ar:'آرثر',role:'Auth screens, teacher and parent dashboards, server error.',shape:'book',
  palette:{main:'#1f6b66',accent:'#e4bf63',ink:'#10201f',extra:{light:'#3d8580',scarf:'#e8785f',gold:'#f6c944'}},speed:1.25,
  renderer:{type:'image',rive:null,lottie:null,image:{
    frames:{happy:art('happy'),thinking:art('thinking'),success:art('success'),error:art('error'),hidden:art('hidden')},
    states:{Idle:'happy',Wave:'happy',Wake:'happy',Sleep:'happy',Reading:'thinking',Typing:'thinking',Searching:'thinking',Thinking:'thinking',Loading:'thinking',Success:'success',Celebrate:'success',Error:'error',HiddenPassword:'hidden',VisiblePassword:'happy'}}},
  idles:[['page-turn','sway'],['book-breathe-open','squash'],['cover-flutter','shiver'],['bookmark-adjust','settle'],['read-line','lookR'],['slow-nod','tilt'],['calm-sigh','settle'],['page-shimmer','smile'],['lean-and-back','tilt'],['dog-ear','settle'],['eyes-closed-recall','blinkSlow'],['dust-blow','shiver',true],['letter-float','lookU',true],['pat-book','squash'],['raise-brow','lookU'],['step-forward','hop'],['posture','settle'],['inner-smile','smile'],['tidy-pages','sway'],['think-up','lookU']]
};
