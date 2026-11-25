const art=n=>new URL(`./art/${n}.webp`,import.meta.url).href;
export default {
  id:'alex',name:'Alex',ar:'أليكس',role:'Lead. Home, search, AI assistant, student dashboard, 404.',shape:'fennec',
  palette:{main:'#f0b868',accent:'#fbe3b8',ink:'#3a2418',extra:{light:'#f9d79a',earIn:'#f4a9a3',cap:'#1d2a6b',gold:'#e4bf63'}},speed:0.95,
  renderer:{type:'image',rive:null,lottie:null,image:{
    frames:{happy:art('happy'),thinking:art('thinking'),success:art('success'),error:art('error'),hidden:art('hidden')},
    states:{Idle:'happy',Wave:'happy',Wake:'happy',Sleep:'happy',Reading:'thinking',Typing:'thinking',Searching:'thinking',Thinking:'thinking',Loading:'thinking',Success:'success',Celebrate:'success',Error:'error',HiddenPassword:'hidden',VisiblePassword:'happy'}}},
  idles:[['ear-twitch','shiver'],['one-ear','tilt'],['tail-wag','sway'],['tail-wrap','settle'],['sniff','lookU'],['yawn','yawn',true],['scratch-ear','tilt'],['hop','hop',true],['curious-tilt','tilt'],['follow-butterfly','lookR'],['peek-out','lookL'],['almost-step','hop'],['paw-sweep','settle'],['play-bow','squash',true],['look-at-tail','lookD'],['wink','blink'],['shake-off','shiver',true],['chin-up','lookU'],['nose-twitch','shiver'],['ear-wave','sway']]
};
