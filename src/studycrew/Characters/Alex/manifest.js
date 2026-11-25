const art=n=>new URL(`./art/${n}.webp`,import.meta.url).href;
const FR={happy:art('happy'),thinking:art('thinking'),success:art('success'),error:art('error'),hidden:art('hidden')};
const ST={Idle:'happy',Wave:'happy',Wake:'happy',Sleep:'happy',Reading:'thinking',Typing:'thinking',Searching:'thinking',Thinking:'thinking',Loading:'thinking',Success:'success',Celebrate:'success',Error:'error',HiddenPassword:'hidden',VisiblePassword:'happy'};
const pa=n=>new URL(`./art/puppet/${n}.webp`,import.meta.url).href;
const PUPPET={size:640,src:1254,parts:Object.fromEntries(['tail','body','earL','earR','head','irisL','irisR','lidL','lidR'].map(n=>[n,pa(n)])),
  meta:{"tail": [210, 649, 426, 432], "body": [431, 555, 437, 648], "earL": [220, 25, 382, 481], "earR": [685, 22, 379, 483], "head": [387, 117, 516, 510], "irisL": [504, 420, 106, 106], "lidL": [470, 400, 160, 140], "irisR": [697, 406, 106, 106], "lidR": [690, 385, 160, 145]},
  geo:{spine:{n:6,P:[650,1190],theta:-90,len:640},tail:{n:5,P:[610,985],theta:-143.6,len:470},earL:{n:4,P:[520,470],theta:-122.7,len:500},earR:{n:4,P:[740,470],theta:-54.5,len:516},
    hipStrip:1,neck:[640,600],shadow:[650,1196,190],eye:{L:[548,473,56,43],R:[762,460,54,46]},gaze:[9,5]}};
export default {
  id:'alex',name:'Alex',ar:'أليكس',role:'Lead. Home, search, AI assistant, student dashboard, 404.',shape:'fennec',
  palette:{main:'#f0b868',accent:'#fbe3b8',ink:'#3a2418',extra:{light:'#f9d79a',earIn:'#f4a9a3',cap:'#1d2a6b',gold:'#e4bf63'}},speed:0.95,
  renderer:{type:'image',rive:null,lottie:null,image:{
    puppet:PUPPET,
    rig:{height:608,frames:FR,states:ST,blinkPoses:['happy','thinking','error'],layers:{
      tailPivot:[205,470],waist:[265,470],scrollPivot:[330,330],capPivot:[265,125],
      torso:[[185,300],[350,295],[400,380],[395,470],[300,480],[215,480],[170,420]],
      scroll:[[285,310],[370,310],[385,420],[330,450],[285,440]],
      cap:[[185,95],[260,48],[345,70],[355,100],[342,170],[320,165],[300,130],[200,128]],headPivot:[265,300],earLPivot:[175,215],earRPivot:[345,215],
      tail:[[40,330],[110,320],[200,345],[215,470],[200,545],[110,520],[45,450]],
      head:[[150,90],[260,45],[370,80],[400,150],[405,245],[385,290],[300,312],[210,312],[135,285],[125,230]],
      earL:[[45,60],[95,8],[150,10],[205,110],[210,200],[195,245],[130,205],[60,150]],
      earR:[[320,60],[380,0],[440,5],[480,80],[490,170],[430,235],[350,240],[320,150]],
      eyes:[[215,226,36,28],[322,222,36,28]],fur:['#f0c283','#e9b36e'],lash:'#3a2418',
    }},
    frames:FR,states:ST}},
  idles:[['ear-twitch','shiver'],['one-ear','tilt'],['tail-wag','sway'],['tail-wrap','settle'],['sniff','lookU'],['yawn','yawn',true],['scratch-ear','tilt'],['hop','hop',true],['curious-tilt','tilt'],['follow-butterfly','lookR'],['peek-out','lookL'],['almost-step','hop'],['paw-sweep','settle'],['play-bow','squash',true],['look-at-tail','lookD'],['wink','blink'],['shake-off','shiver',true],['chin-up','lookU'],['nose-twitch','shiver'],['ear-wave','sway']]
};
