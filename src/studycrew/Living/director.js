/* Living Director: the only decision point. Input: an app event. Output: what to show (or nothing). Pure and testable. */
import {LIVING} from './config.js';
import {policy} from './focus.js';
import {tierFor,capTier,TIER_EFFECTS} from './celebrations.js';
import {COPY,createPicker,createDelight,createFrustration,helpFor} from './emotion.js';
export function createDirector({rand=Math.random,now=()=>Date.now(),getFocus,prefs=()=>({}),quality=()=>2}={}){
  const pick=createPicker(rand),delight=createDelight({now,rand}),frus=createFrustration({now});
  const silent={show:false,message:'',tier:'none',effects:TIER_EFFECTS.none,state:'Idle'};
  return function decide(event,data={}){
    const mode=getFocus();const pol=policy(mode,prefs());
    if(mode==='exam')return {...silent,reason:'exam'};
    const out={...silent,show:true,reason:mode};
    const bubbles=pol.bubbles;
    switch(event){
      case 'fail':case 'error':{
        const kind=data.kind||'generic';
        const help=frus.record(kind);
        out.state='Error';
        out.message=bubbles?(help||data.kind==='offline'||data.kind==='upload'||data.kind==='password'?helpFor(kind):pick('fail')):'';
        out.retry=kind==='upload'||kind==='offline';
        break;
      }
      case 'success':frus.reset(data.kind);out.state='Success';out.tier=tierFor('save');break;
      case 'score':{
        out.state='Celebrate';out.tier=tierFor('score',data);
        if(data.score===100)out.message=pick('perfect');else if(out.tier!=='none')out.message=pick('good');
        else if(data.score!==undefined&&data.score<50){out.state='Idle';out.message=pick('fail');}
        break;}
      case 'firstExam':out.state='Celebrate';out.tier=tierFor('firstExam');out.message=pick('firstExam');break;
      case 'achievement':out.state='Celebrate';out.tier=tierFor('achievement');break;
      case 'streak':out.state='Celebrate';out.tier=tierFor('streak',data);out.message=pick((data.streak>=LIVING.streak.long)?'longStreak':'weekStreak');break;
      case 'return':out.state='Wave';out.message=data.longAway?pick('welcomeBack'):'';if(!data.longAway)out.show=false;break;
      /* hint: a contextual one-liner from COPY.hints (crew spots outside auth). No tier, no effects;
         respects the focus policy like any bubble, and exam stays absolute silence above. */
      case 'hint':{out.state='Wave';out.message=bubbles?(COPY.hints?.[data.hint]||''):'';if(!out.message)out.show=false;break;}
      case 'tick':if(delight()&&pol.bubbles&&pol.motion){out.state='Wave';out.message=pick('delight');}else out.show=false;break;
      default:out.show=false;
    }
    out.tier=capTier(out.tier,pol.celebrate);
    if(quality()===0&&out.tier!=='none'&&out.tier!=='glow')out.tier='glow';
    if(!bubbles)out.message='';
    if(!pol.motion&&out.state!=='Error'&&out.state!=='Success')out.state='Idle';
    out.effects=TIER_EFFECTS[out.tier];
    out.sound=pol.sound&&out.tier!=='none';out.haptics=pol.haptics&&(event==='success'||event==='error'||event==='fail');
    if(!out.message&&out.tier==='none'&&out.state==='Idle')out.show=false;
    return out;
  };
}
