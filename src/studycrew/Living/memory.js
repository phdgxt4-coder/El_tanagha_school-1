/* Memory Experience: remembers where the user was. Local only, bounded, expires. No personal text stored, only routes and numbers. */
import {LIVING} from './config.js';
const read=()=>{try{return JSON.parse(localStorage.getItem(LIVING.storageKey)||'{}');}catch{return {};}};
const write=o=>{try{localStorage.setItem(LIVING.storageKey,JSON.stringify(o));}catch{}};
export function remember(kind,value,now=Date.now()){
  const o=read();o.items=o.items||{};o.items[kind]={value,at:now};
  const keys=Object.keys(o.items);
  if(keys.length>LIVING.memory.maxItems)delete o.items[keys.sort((a,b)=>o.items[a].at-o.items[b].at)[0]];
  write(o);
}
export function recall(kind,now=Date.now()){
  const it=read().items?.[kind];
  return it&&now-it.at<=LIVING.memory.maxAgeMs?it.value:null;
}
export function visit(now=Date.now()){
  const o=read();const prev=o.lastVisit||null;o.lastVisit=now;write(o);
  return {returning:prev!==null,awayMs:prev===null?0:now-prev,longAway:prev!==null&&now-prev>=LIVING.welcomeBackMs};
}
export const forgetAll=()=>write({});
