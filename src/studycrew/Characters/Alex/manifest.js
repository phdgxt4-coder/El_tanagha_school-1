const art=n=>new URL(`./art/${n}.webp`,import.meta.url).href;
const FR={happy:art('happy'),thinking:art('thinking'),success:art('success'),error:art('error'),hidden:art('hidden')};
const ST={Idle:'happy',Wave:'happy',Wake:'happy',Sleep:'happy',Reading:'thinking',Typing:'thinking',Searching:'thinking',Thinking:'thinking',Loading:'thinking',Success:'success',Celebrate:'success',Error:'error',HiddenPassword:'hidden',VisiblePassword:'happy'};
export default {
  id:'alex',name:'Alex',ar:'أليكس',role:'Lead. Home, search, AI assistant, student dashboard, 404.',shape:'fennec',
  palette:{main:'#f0b868',accent:'#fbe3b8',ink:'#3a2418',extra:{light:'#f9d79a',earIn:'#f4a9a3',cap:'#1d2a6b',gold:'#e4bf63'}},speed:0.95,
  renderer:{type:'image',rive:null,lottie:null,image:{
    rig:{height:608,frames:FR,states:ST,blinkPoses:['happy','thinking','error'],layers:{
      tailPivot:[205,470],headPivot:[265,300],earLPivot:[175,215],earRPivot:[345,215],
      tail:[[40,330],[110,320],[200,345],[215,470],[200,545],[110,520],[45,450]],
      head:[[150,90],[260,45],[370,80],[400,150],[405,245],[385,290],[300,312],[210,312],[135,285],[125,230]],
      earL:[[45,60],[95,8],[150,10],[205,110],[210,200],[195,245],[130,205],[60,150]],
      earR:[[320,60],[380,0],[440,5],[480,80],[490,170],[430,235],[350,240],[320,150]],
      eyes:[[215,226,36,28],[322,222,36,28]],fur:['#f0c283','#e9b36e'],lash:'#3a2418',
    }},
    frames:FR,states:ST}},
  idles:[['ear-twitch','shiver'],['one-ear','tilt'],['tail-wag','sway'],['tail-wrap','settle'],['sniff','lookU'],['yawn','yawn',true],['scratch-ear','tilt'],['hop','hop',true],['curious-tilt','tilt'],['follow-butterfly','lookR'],['peek-out','lookL'],['almost-step','hop'],['paw-sweep','settle'],['play-bow','squash',true],['look-at-tail','lookD'],['wink','blink'],['shake-off','shiver',true],['chin-up','lookU'],['nose-twitch','shiver'],['ear-wave','sway']]
};
