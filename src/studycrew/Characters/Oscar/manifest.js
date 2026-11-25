const art=n=>new URL(`./art/${n}.webp`,import.meta.url).href;
export default {
  id:'oscar',name:'Oscar',ar:'أوسكار',role:'Homework, exams, grading, homework upload.',shape:'pencil',
  palette:{main:'#f5b82e',accent:'#f08a4b',ink:'#3b2a10',extra:{light:'#ffd66b',eraser:'#f49ab4',wood:'#f3d3a2'}},speed:0.85,
  renderer:{type:'image',rive:null,lottie:null,image:{
    frames:{happy:art('happy'),thinking:art('thinking'),success:art('success'),error:art('error'),hidden:art('hidden')},
    states:{Idle:'happy',Wave:'happy',Wake:'happy',Sleep:'happy',Reading:'thinking',Typing:'thinking',Searching:'thinking',Thinking:'thinking',Loading:'thinking',Success:'success',Celebrate:'success',Error:'error',HiddenPassword:'hidden',VisiblePassword:'happy'}}},
  idles:[['hat-adjust','tilt'],['pencil-spin','hop',true],['air-write','sway'],['underline','lookR'],['head-tap','shiver'],['tip-hop','hop',true],['sharpen','shiver'],['stretch','squash'],['impatient-shake','shiver'],['count-nods','tilt'],['sway','sway'],['quick-turn','lookL'],['erase','settle'],['hum','tilt'],['lets-go','squash'],['get-ready','squash'],['fast-double-blink','blink2'],['side-smile','smile'],['stand-tall','settle'],['lean-excited','lookU']]
};
