const art=n=>new URL(`./art/${n}.webp`,import.meta.url).href;
export default {
  id:'leo',name:'Leo',ar:'ليو',role:'Notifications, offline and network states.',shape:'lantern',
  palette:{main:'#e4bf63',accent:'#fff1b8',ink:'#2a2008'},speed:1.15,
  renderer:{type:'image',rive:null,lottie:null,image:{
    frames:{happy:art('happy'),thinking:art('thinking'),success:art('success'),error:art('error'),hidden:art('hidden')},
    states:{Idle:'happy',Wave:'happy',Wake:'happy',Sleep:'happy',Reading:'thinking',Typing:'thinking',Searching:'thinking',Thinking:'thinking',Loading:'thinking',Success:'success',Celebrate:'success',Error:'error',HiddenPassword:'hidden',VisiblePassword:'happy'}}},
  idles:[['flame-sway','sway'],['lantern-swing','tilt'],['dim-and-back','smile'],['spark','shiver'],['float-inch','hop'],['glass-pattern','smile'],['warm-shadow','settle'],['shy-glance','lookL'],['hide-behind-ring','lookD'],['yawn','yawn',true],['orbiting-lights','sway',true],['lean-to-see','tilt'],['glow-smile','smile'],['slow-close','blinkSlow'],['breeze-shiver','shiver'],['rise-settle','hop'],['beam-corner','lookR'],['look-at-stars','lookU'],['whisper-flicker','shiver'],['breathe-light','settle']]
};
