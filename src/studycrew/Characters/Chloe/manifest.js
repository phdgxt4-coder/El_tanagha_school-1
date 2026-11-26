const art=n=>new URL(`./art/${n}.webp`,import.meta.url).href;
export default {
  id:'chloe',name:'Chloe',ar:'كلوي',role:'Results, achievements, badges.',shape:'lotus',
  palette:{main:'#f6a3be',accent:'#7fc47f',ink:'#3a1a28',extra:{gold:'#f6c944'}},speed:1.05,
  renderer:{type:'image',rive:null,lottie:null,image:{
    frames:{happy:art('happy'),thinking:art('thinking'),success:art('success'),error:art('error'),hidden:art('hidden')},
    states:{Idle:'happy',Wave:'happy',Wake:'happy',Sleep:'happy',Reading:'thinking',Typing:'thinking',Searching:'thinking',Thinking:'thinking',Loading:'thinking',Success:'success',Celebrate:'success',Error:'error',HiddenPassword:'hidden',VisiblePassword:'happy'}}},
  idles:[['leaf-fall','lookD',true],['flower-turn','tilt'],['half-bloom','squash'],['leaf-tremble','shiver'],['water-sway','sway'],['ripple','settle'],['bud-curl','squash'],['shy-down','lookD'],['grow-inch','hop'],['deep-breath','settle'],['dew-drop','smile',true],['leaf-wave','sway'],['thank-bow','tilt'],['turn-to-light','lookU'],['happy-close','blinkSlow'],['pollen-glint','smile',true],['little-dance','sway'],['shake-drop','shiver'],['shy-smile','smile'],['petal-breath','settle']]
};
