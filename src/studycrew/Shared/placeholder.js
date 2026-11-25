/* Placeholder renderer: a tiny code-drawn SVG per character (no image files). It implements the same
   renderer interface real Rive/Lottie adapters must implement:
   { setState(name), play(recipe), look(x,y), pause(), resume(), destroy() }.
   Only transform and opacity are animated. */
import {tokens} from '../Themes/tokens.js';
const NS='http://www.w3.org/2000/svg';
const el=(tag,attrs={},kids=[])=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);kids.forEach(k=>n.append(k));return n;};
const SHAPES={
  fennec:(p)=>[el('path',{d:'M34 52 L26 10 L52 36 Z M86 52 L94 10 L68 36 Z',fill:p.main}),el('ellipse',{cx:60,cy:68,rx:34,ry:32,fill:p.main}),el('ellipse',{cx:60,cy:80,rx:20,ry:15,fill:p.accent})],
  book:(p)=>[el('rect',{x:24,y:20,width:72,height:84,rx:10,fill:p.main}),el('rect',{x:32,y:28,width:56,height:68,rx:6,fill:p.accent,opacity:.35})],
  pencil:(p)=>[el('rect',{x:38,y:14,width:44,height:70,rx:8,fill:p.main}),el('path',{d:'M38 84 H82 L60 110 Z',fill:p.accent}),el('rect',{x:38,y:14,width:44,height:12,rx:6,fill:p.accent})],
  lantern:(p)=>[el('rect',{x:34,y:26,width:52,height:74,rx:16,fill:p.main}),el('rect',{x:44,y:14,width:32,height:12,rx:5,fill:p.ink,opacity:.6}),el('ellipse',{cx:60,cy:46,rx:9,ry:12,fill:p.accent,'data-part':'flame'})],
  lotus:(p)=>[el('path',{d:'M60 30 C42 46 42 84 60 98 C78 84 78 46 60 30Z',fill:p.main}),el('path',{d:'M28 56 C34 80 46 92 60 98 C46 78 40 66 28 56Z M92 56 C86 80 74 92 60 98 C74 78 80 66 92 56Z',fill:p.main,opacity:.8}),el('ellipse',{cx:60,cy:104,rx:30,ry:6,fill:p.accent})]
};
/* motion recipes: [keyframes, ms at speed 1]. transform/opacity only. */
const R={
  blink:[[{transform:'scaleY(1)'},{transform:'scaleY(.08)'},{transform:'scaleY(1)'}],150,'eyes'],
  blink2:[[{transform:'scaleY(1)'},{transform:'scaleY(.08)',offset:.2},{transform:'scaleY(1)',offset:.4},{transform:'scaleY(.08)',offset:.6},{transform:'scaleY(1)'}],420,'eyes'],
  blinkSlow:[[{transform:'scaleY(1)'},{transform:'scaleY(.08)',offset:.45},{transform:'scaleY(1)'}],420,'eyes'],
  lookL:[[{transform:'translateX(0)'},{transform:'translateX(-3px)',offset:.2},{transform:'translateX(-3px)',offset:.75},{transform:'translateX(0)'}],1200,'eyes'],
  lookR:[[{transform:'translateX(0)'},{transform:'translateX(3px)',offset:.2},{transform:'translateX(3px)',offset:.75},{transform:'translateX(0)'}],1200,'eyes'],
  lookU:[[{transform:'translateY(0)'},{transform:'translateY(-3px)',offset:.2},{transform:'translateY(-3px)',offset:.75},{transform:'translateY(0)'}],1300,'eyes'],
  lookD:[[{transform:'translateY(0)'},{transform:'translateY(3px)',offset:.2},{transform:'translateY(3px)',offset:.75},{transform:'translateY(0)'}],1200,'eyes'],
  glance:[[{transform:'translate(0,0)'},{transform:'translate(0,1px)',offset:.2},{transform:'translate(0,1px)',offset:.8},{transform:'translate(0,0)'}],1000,'eyes'],
  tilt:[[{transform:'rotate(0)'},{transform:'rotate(4deg)',offset:.35},{transform:'rotate(4deg)',offset:.7},{transform:'rotate(0)'}],1400,'body'],
  sway:[[{transform:'rotate(0)'},{transform:'rotate(-3deg)',offset:.3},{transform:'rotate(3deg)',offset:.7},{transform:'rotate(0)'}],1800,'body'],
  settle:[[{transform:'translateY(0)'},{transform:'translateY(2px)',offset:.4},{transform:'translateY(0)'}],900,'body'],
  hop:[[{transform:'translateY(0) scale(1,1)'},{transform:'translateY(0) scale(1.06,.92)',offset:.2},{transform:'translateY(-10px) scale(.96,1.06)',offset:.5},{transform:'translateY(0) scale(1.04,.95)',offset:.8},{transform:'translateY(0) scale(1,1)'}],700,'body'],
  squash:[[{transform:'scale(1,1)'},{transform:'scale(1.06,.93)',offset:.4},{transform:'scale(1,1)'}],700,'body'],
  shiver:[[{transform:'translateX(0)'},{transform:'translateX(-1.5px)',offset:.25},{transform:'translateX(1.5px)',offset:.5},{transform:'translateX(-1px)',offset:.75},{transform:'translateX(0)'}],420,'body'],
  yawn:[[{transform:'scale(1,1)'},{transform:'scale(1.04,1.05)',offset:.4},{transform:'scale(1.04,1.05)',offset:.65},{transform:'scale(1,1)'}],1600,'body'],
  smile:[[{opacity:1},{opacity:.7,offset:.3},{opacity:1}],1500,'glow'],
  breath:[[{transform:'scale(1,1)'},{transform:'scale(1.02,1.025)'},{transform:'scale(1,1)'}],3800,'body']
};
const STATE_LOOP={Thinking:'tilt',Reading:'sway',Searching:'sway',Loading:'sway',Typing:'shiver'};
const STATE_ONCE={Success:'hop',Celebrate:'hop',Wake:'squash',Wave:'tilt',Error:'settle'};
export function createPlaceholder(host,manifest,{reduced=()=>false}={}){
  const p=manifest.palette;
  const svg=el('svg',{viewBox:'0 0 120 120',class:'sc-char',role:'img','aria-hidden':'true',focusable:'false'});
  const body=el('g',{'data-part':'body'},SHAPES[manifest.shape](p));
  const gaze=el('g',{'data-part':'gaze'},[el('circle',{cx:48,cy:62,r:4.5,fill:p.ink}),el('circle',{cx:72,cy:62,r:4.5,fill:p.ink})]);
  const eyes=el('g',{'data-part':'eyes'},[gaze]);
  const mouth=el('path',{'data-part':'mouth',d:'M52 76 Q60 82 68 76',fill:'none',stroke:p.ink,'stroke-width':2.5,'stroke-linecap':'round'});
  const cover=el('g',{'data-part':'cover'},[el('circle',{cx:46,cy:62,r:10,fill:p.accent}),el('circle',{cx:74,cy:62,r:10,fill:p.accent})]);
  const glow=el('circle',{'data-part':'glow',cx:60,cy:62,r:56,fill:tokens.light.sparkle,opacity:0});
  svg.append(glow,body,eyes,mouth,cover);host.append(svg);
  const parts={body,eyes,glow};
  const anims=new Set();let loop=null,paused=false,speed=manifest.speed||1,eyeNow=[0,0];
  const run=(recipe,{loopIt=false}={})=>{
    const r=R[recipe];if(!r||reduced()||paused)return null;
    const a=parts[r[2]].animate(r[0],{duration:r[1]*speed,easing:tokens.easing.inOut,iterations:loopIt?Infinity:1});
    anims.add(a);a.onfinish=()=>anims.delete(a);return a;
  };
  const stopLoop=()=>{if(loop){loop.cancel();anims.delete(loop);loop=null;}};
  const breath=run('breath',{loopIt:true});
  let breathAnim=breath;
  return{
    kind:'svg-placeholder',el:svg,
    setState(name){
      svg.dataset.state=name;stopLoop();
      if(STATE_LOOP[name])loop=run(STATE_LOOP[name],{loopIt:true});
      if(STATE_ONCE[name])run(STATE_ONCE[name]);
      if(name==='Success'||name==='Celebrate'||name==='Wake'){const g=parts.glow.animate([{opacity:0},{opacity:.35},{opacity:0}],{duration:tokens.motion.celebration});anims.add(g);}
    },
    play(recipe){return run(recipe);},
    look(x,y){
      if(reduced())return;
      eyeNow=[x*3,y*2.5];
      gaze.style.transform=`translate(${eyeNow[0].toFixed(2)}px,${eyeNow[1].toFixed(2)}px)`;
    },
    pause(){paused=true;anims.forEach(a=>a.pause?.());},
    resume(){paused=false;anims.forEach(a=>a.play?.());},
    destroy(){anims.forEach(a=>a.cancel?.());anims.clear();loop=null;breathAnim=null;svg.remove();}
  };
}
export const RECIPES=Object.keys(R);
