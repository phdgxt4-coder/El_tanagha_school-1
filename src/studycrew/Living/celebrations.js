/* Smart Celebration System: tier by value of the event, capped by the focus policy. */
import {LIVING} from './config.js';
export const tierRank=t=>Math.max(0,LIVING.tiers.indexOf(t));
export function tierFor(event,{score=null,streak=0}={}){
  if(event==='score'){
    if(score===100)event='perfectScore';else if(score!==null&&score>=85)event='goodScore';else return 'none';
  }
  if(event==='streak'){event=streak>=LIVING.streak.long?'longStreak':streak>=LIVING.streak.week?'weekStreak':'save';}
  return LIVING.eventTier[event]||'none';
}
export function capTier(tier,cap){return tierRank(tier)>tierRank(cap)?cap:tier;}
/* What each tier means in effects. Wiring code only maps these to Effects/ and CSS classes. */
export const TIER_EFFECTS={
  none:{glow:false,sparkles:0,confetti:0,team:false},
  glow:{glow:true,sparkles:0,confetti:0,team:false},
  sparkles:{glow:true,sparkles:12,confetti:0,team:false},
  confetti:{glow:true,sparkles:12,confetti:30,team:false},
  full:{glow:true,sparkles:16,confetti:40,team:true}
};
