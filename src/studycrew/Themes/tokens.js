/* Study Crew design tokens: the single place to edit colors, fonts, shadows, radii, spacing, motion and light.
   applyTokens() writes them as --sc-* CSS variables. styles/studycrew.css reads only those variables. */
export const tokens={
  color:{
    gold:'#c9a24b',gold2:'#e4bf63',navy:'#090d16',surface:'#111722',surfaceRaised:'#151c29',text:'#f0f2f5',muted:'#9aa3b2',
    success:'#3ecf8e',error:'#ff6a54',info:'#818cf8',calm:'#2dd4bf',warn:'#fb923c',
    alex:'#e8a95a',arthur:'#2f6b6a',oscar:'#f2c14e',leo:'#e4bf63',chloe:'#e98fb0'
  },
  colorLight:{surface:'#ffffff',surfaceRaised:'#ffffff',text:'#19202b',muted:'#596579',gold:'#a77c20',gold2:'#85600f'},
  font:{family:'inherit',sizeSm:'13px',sizeMd:'15px',sizeLg:'18px',weight:'600'},
  radius:{sm:'10px',md:'16px',lg:'22px',pill:'999px'},
  space:{1:'4px',2:'8px',3:'12px',4:'16px',5:'24px',6:'32px'},
  shadow:{card:'0 12px 32px #0007',float:'0 18px 44px #000a'},
  light:{glow:'0 0 24px #e4bf6366',glowStrong:'0 0 40px #e4bf63aa',sparkle:'#fff3c4'},
  /* durations in ms, matching the Motion System table */
  motion:{micro:140,button:150,card:210,dialog:270,character:400,celebration:900,celebrationMax:1200,error:1400,wake:800,wave:1000,idleMin:2500,idleMax:7000},
  easing:{out:'cubic-bezier(.22,1,.36,1)',inOut:'cubic-bezier(.65,0,.35,1)',spring:'cubic-bezier(.34,1.3,.64,1)'},
  size:{character:'132px',characterSmall:'72px',hit:'44px'}
};
const flat=(obj,prefix,out={})=>{
  for(const [k,v] of Object.entries(obj)){
    const name=`${prefix}-${k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}`;
    if(v&&typeof v==='object')flat(v,name,out);else out[name]=v;
  }
  return out;
};
export function tokenVars(t=tokens){
  const vars=flat({...t,motion:Object.fromEntries(Object.entries(t.motion).map(([k,v])=>[k,v+'ms']))},'--sc');
  delete vars['--sc-color-light'];
  for(const k of Object.keys(vars))if(k.startsWith('--sc-color-light-'))delete vars[k];
  return vars;
}
export function applyTokens(root=document.documentElement,t=tokens){
  for(const [k,v] of Object.entries(tokenVars(t)))root.style.setProperty(k,String(v));
}
