/* Adaptive Motion + Performance Guard. Tier 0 low, 1 medium, 2 high. Frame drops only ever lower the tier. */
import {LIVING} from './config.js';
import {lowPower} from '../Shared/prefs.js';
export function detectTier(env={}){
  const nav=typeof navigator!=='undefined'?navigator:{};
  const mem=env.deviceMemory??nav.deviceMemory??4;
  const cores=env.hardwareConcurrency??nav.hardwareConcurrency??4;
  const save=env.saveData??(nav.connection?.saveData===true);
  const q=LIVING.quality;
  if(save||mem<=q.lowMemoryGb||lowPower())return 0;
  if(cores<=q.lowCores||mem<=4)return 1;
  return 2;
}
/* What each tier allows. Consumers read this; none hard-code particle counts or blur. */
export const TIER_LIMITS=[
  {particles:0,blur:false,glow:false,shadows:'flat',complexity:'minimal',ambient:false},
  {particles:12,blur:false,glow:true,shadows:'soft',complexity:'normal',ambient:false},
  {particles:40,blur:true,glow:true,shadows:'layered',complexity:'full',ambient:true}
];
export function createGuard({tier=detectTier(),onChange=()=>{}}={}){
  let t=tier,bad=0;
  return {
    tier:()=>t,limits:()=>TIER_LIMITS[t],
    /* feed with each frame's duration in ms */
    frame(ms){
      if(ms>LIVING.quality.frameBudgetMs)bad++;else bad=Math.max(0,bad-1);
      if(bad>=LIVING.quality.badFramesToDowngrade&&t>0){t--;bad=0;onChange(t);}
      return t;
    }
  };
}
export function applyTier(root,tier){root.dataset.scQuality=['low','medium','high'][tier]||'low';}
