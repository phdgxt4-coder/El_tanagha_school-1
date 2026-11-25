/* Dynamic World: pure function from a Date to a small descriptor. Themes/CSS read the descriptor, this file draws nothing. */
import {LIVING} from './config.js';
export function daypart(date=new Date(),cfg=LIVING){
  const h=date.getHours();
  for(const [name,[a,b]] of Object.entries(cfg.dayparts)){
    if(a<b?(h>=a&&h<b):(h>=a||h<b))return name;
  }
  return 'afternoon';
}
export function hijri(date=new Date()){
  try{
    const p=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{month:'numeric',day:'numeric'}).formatToParts(date);
    return {month:+p.find(x=>x.type==='month').value,day:+p.find(x=>x.type==='day').value};
  }catch{return null;}
}
export function season(date=new Date(),cfg=LIVING){
  const h=hijri(date);
  if(h){
    const s=cfg.seasons;
    if(h.month===s.ramadan.month)return 'ramadan';
    if(h.month===s.eidFitr.month&&h.day>=s.eidFitr.fromDay&&h.day<=s.eidFitr.toDay)return 'eid';
    if(h.month===s.eidAdha.month&&h.day>=s.eidAdha.fromDay&&h.day<=s.eidAdha.toDay)return 'eid';
  }
  const m=date.getMonth()+1;
  if(m===cfg.schoolYearStart.month&&date.getDate()<=cfg.schoolYearStart.days)return 'backToSchool';
  if(cfg.summer.months.includes(m))return 'vacation';
  if(cfg.winter.months.includes(m))return 'winter';
  return 'term';
}
export const describeWorld=(date=new Date())=>({daypart:daypart(date),season:season(date)});
/* Applies the descriptor as data attributes. CSS in styles/living.css does the visuals with colour variables only. */
export function applyWorld(root,date=new Date()){
  const w=describeWorld(date);
  root.dataset.scDaypart=w.daypart;root.dataset.scSeason=w.season;return w;
}
