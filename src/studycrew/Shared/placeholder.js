/* Placeholder renderer: a tiny code-drawn SVG per character (no image files). It implements the same
   renderer interface real Rive/Lottie adapters must implement:
   { setState(name), play(recipe), look(x,y), pause(), resume(), destroy() }.
   Only transform and opacity are animated. */
import {tokens} from '../Themes/tokens.js';
const NS='http://www.w3.org/2000/svg';
const el=(tag,attrs={},kids=[])=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);kids.forEach(k=>n.append(k));return n;};
let uid=0;
const grad=(id,stops,{radial=false,x1=0,y1=0,x2=0,y2=1}={})=>{
  const g=el(radial?'radialGradient':'linearGradient',radial?{id,cx:.5,cy:.4,r:.7}:{id,x1,y1,x2,y2});
  stops.forEach(([o,c])=>g.append(el('stop',{offset:o,'stop-color':c})));return g;
};
const X=(p,k,d)=>(p.extra&&p.extra[k])||d;
/* Each shape returns {defs, body, face}. face: eye centres, eye radius, mouth path and cheek spots.
   Colours come from the manifest palette (main, accent, ink, extra{}), so a theme or a redraw changes data, not logic.
   Proportions follow the approved concept sheets: big head, big glossy eyes, simple readable silhouette. */
const SHAPES={
  fennec:(p,i)=>({
    defs:[grad(`f${i}`,[[0,X(p,'light','#f7cf8d')],[1,p.main]]),grad(`e${i}`,[[0,X(p,'earIn','#f4a9a3')],[1,'#e98c8c']])],
    body:[
      el('ellipse',{cx:98,cy:96,rx:15,ry:21,fill:`url(#f${i})`,transform:'rotate(18 98 96)'}),
      el('ellipse',{cx:98,cy:98,rx:8,ry:12,fill:p.accent,opacity:.7,transform:'rotate(18 98 98)'}),
      el('ellipse',{cx:60,cy:100,rx:19,ry:19,fill:p.accent}),
      el('ellipse',{cx:60,cy:100,rx:12,ry:14,fill:'#fff6e4',opacity:.8}),
      el('ellipse',{cx:48,cy:116,rx:9,ry:5,fill:p.accent}),el('ellipse',{cx:72,cy:116,rx:9,ry:5,fill:p.accent}),
      el('path',{d:'M36 52 C14 46 4 20 14 3 C32 6 48 28 50 46 Z',fill:`url(#f${i})`}),
      el('path',{d:'M36 46 C22 42 15 24 20 11 C32 14 42 28 44 42 Z',fill:`url(#e${i})`}),
      el('path',{d:'M84 52 C106 46 116 20 106 3 C88 6 72 28 70 46 Z',fill:`url(#f${i})`}),
      el('path',{d:'M84 46 C98 42 105 24 100 11 C88 14 78 28 76 42 Z',fill:`url(#e${i})`}),
      el('ellipse',{cx:60,cy:62,rx:31,ry:26,fill:`url(#f${i})`}),
      el('ellipse',{cx:60,cy:71,rx:17,ry:12,fill:'#fff6e4'}),
      el('ellipse',{cx:60,cy:65,rx:3.6,ry:2.6,fill:p.ink}),
      el('path',{d:'M31 41 L60 29 L89 41 L60 53 Z',fill:X(p,'cap','#1d2a6b')}),
      el('path',{d:'M46 47 V54 Q60 60 74 54 V47 L60 53 Z',fill:X(p,'cap','#1d2a6b'),opacity:.9}),
      el('path',{d:'M86 40 Q92 46 90 56',fill:'none',stroke:X(p,'gold','#e4bf63'),'stroke-width':2.4,'stroke-linecap':'round'}),
      el('circle',{cx:90,cy:57,r:2.6,fill:X(p,'gold','#e4bf63')}),
      el('rect',{x:70,y:88,width:9,height:24,rx:4,fill:'#fff3d6',transform:'rotate(14 74 100)'}),
      el('rect',{x:70,y:96,width:9,height:4,fill:X(p,'cap','#1d2a6b'),transform:'rotate(14 74 98)'})
    ],
    face:{eyes:[[47,63],[73,63]],r:6.2,mouth:'M54 74 Q60 78 66 74',cheeks:[]}
  }),
  book:(p,i)=>({
    defs:[grad(`b${i}`,[[0,X(p,'light','#3d8580')],[1,p.main]]),grad(`c${i}`,[[0,'#fff1d2'],[1,'#f7dfb2']])],
    body:[
      el('ellipse',{cx:46,cy:115,rx:13,ry:6,fill:p.main}),el('ellipse',{cx:74,cy:115,rx:13,ry:6,fill:p.main}),
      el('rect',{x:98,y:20,width:6,height:82,rx:3,fill:p.accent}),
      el('rect',{x:18,y:16,width:12,height:86,rx:5,fill:'#245a57'}),
      el('rect',{x:24,y:12,width:76,height:92,rx:12,fill:`url(#b${i})`}),
      el('rect',{x:30,y:18,width:64,height:80,rx:8,fill:'none',stroke:p.accent,'stroke-width':1.4,opacity:.85}),
      el('rect',{x:35,y:28,width:54,height:50,rx:22,fill:`url(#c${i})`}),
      el('path',{d:'M32 80 Q60 90 94 76 L94 88 Q62 98 32 92 Z',fill:X(p,'scarf','#e8785f')}),
      el('path',{d:'M58 86 L52 104 L62 98 L70 104 L68 88 Z',fill:X(p,'scarf','#e8785f')}),
      el('ellipse',{cx:36,cy:92,rx:8,ry:7,fill:'#245a57'}),el('ellipse',{cx:86,cy:92,rx:8,ry:7,fill:'#245a57'}),
      el('path',{d:'M60 0 L63 7 L70 8 L65 13 L66 20 L60 16 L54 20 L55 13 L50 8 L57 7 Z',fill:X(p,'gold','#f6c944')})
    ],
    face:{eyes:[[48,50],[72,50]],r:6,mouth:'M52 62 Q60 71 68 62 Z',mouthFill:'#d9577a',cheeks:[[41,60],[79,60]]}
  }),
  pencil:(p,i)=>({
    defs:[grad(`p${i}`,[[0,X(p,'light','#ffd66b')],[1,p.main]],{x1:0,y1:0,x2:1,y2:0})],
    body:[
      el('ellipse',{cx:46,cy:114,rx:10,ry:5,fill:p.main}),el('ellipse',{cx:74,cy:114,rx:10,ry:5,fill:p.main}),
      el('rect',{x:34,y:92,width:52,height:16,rx:8,fill:X(p,'eraser','#f49ab4')}),
      el('rect',{x:33,y:84,width:54,height:9,rx:3,fill:'#b9c0c8'}),
      el('rect',{x:34,y:36,width:52,height:50,rx:8,fill:`url(#p${i})`}),
      el('path',{d:'M34 38 Q38 22 60 9 Q82 22 86 38 Z',fill:X(p,'wood','#f3d3a2')}),
      el('path',{d:'M52 15 Q60 8 68 15 Q60 18 52 15 Z',fill:'#3b3b46'}),
      el('ellipse',{cx:27,cy:74,rx:6,ry:10,fill:p.main,transform:'rotate(-14 27 74)'}),
      el('ellipse',{cx:95,cy:58,rx:6,ry:10,fill:p.main,transform:'rotate(24 95 58)'}),
      el('path',{d:'M48 74 L60 78 L48 84 Z M72 74 L60 78 L72 84 Z',fill:'#2a2a33'}),el('circle',{cx:60,cy:79,r:3.4,fill:'#2a2a33'})
    ],
    face:{eyes:[[49,54],[71,54]],r:5.6,mouth:'M53 64 Q60 70 67 64 Z',mouthFill:'#e0556a',cheeks:[[42,62],[78,62]]}
  }),
  lantern:(p,i)=>({
    defs:[grad(`g${i}`,[[0,'#fff8d6'],[.6,p.accent],[1,'#ffd98a']],{radial:true}),grad(`k${i}`,[[0,'#f6dc86'],[1,'#c99a2e']])],
    body:[
      el('circle',{cx:60,cy:7,r:5,fill:'none',stroke:`url(#k${i})`,'stroke-width':2.4}),
      el('path',{d:'M38 34 Q60 6 82 34 Z',fill:`url(#k${i})`}),
      el('rect',{x:30,y:33,width:60,height:8,rx:4,fill:`url(#k${i})`}),
      el('ellipse',{cx:60,cy:68,rx:29,ry:29,fill:`url(#g${i})`}),
      el('path',{d:'M46 40 Q36 68 46 96 M74 40 Q84 68 74 96',fill:'none',stroke:`url(#k${i})`,'stroke-width':2.6,'stroke-linecap':'round'}),
      el('path',{d:'M42 96 H78 L83 112 H37 Z',fill:`url(#k${i})`}),
      el('rect',{x:36,y:108,width:48,height:6,rx:3,fill:'#b98a26'}),
      el('circle',{cx:26,cy:66,r:5,fill:`url(#k${i})`}),el('circle',{cx:94,cy:66,r:5,fill:`url(#k${i})`}),
      el('ellipse',{'data-part':'flame',cx:60,cy:50,rx:6,ry:8,fill:'#fff3c4',opacity:.55})
    ],
    face:{eyes:[[50,64],[70,64]],r:5.4,mouth:'M54 75 Q60 82 66 75 Z',mouthFill:'#f06a4f',cheeks:[[42,72],[78,72]]}
  }),
  lotus:(p,i)=>({
    defs:[grad(`l${i}`,[[0,'#ffe3ec'],[1,p.main]]),grad(`t${i}`,[[0,'#d9825a'],[1,'#b9633f']]),grad(`v${i}`,[[0,'#fff6ee'],[1,'#fde4e0']],{radial:true})],
    body:[
      el('rect',{x:55,y:80,width:10,height:16,rx:4,fill:'#6fb36f'}),
      el('path',{d:'M56 86 C40 74 22 78 16 84 C28 96 48 94 56 90 Z',fill:p.accent}),
      el('path',{d:'M64 86 C80 74 98 78 104 84 C92 96 72 94 64 90 Z',fill:p.accent}),
      el('path',{d:'M42 96 H78 L74 117 Q60 120 46 117 Z',fill:`url(#t${i})`}),
      el('rect',{x:39,y:91,width:42,height:8,rx:4,fill:'#c8704a'}),
      el('path',{d:'M26 30 C14 52 24 72 44 80 C38 60 34 46 26 30 Z',fill:`url(#l${i})`}),
      el('path',{d:'M94 30 C106 52 96 72 76 80 C82 60 86 46 94 30 Z',fill:`url(#l${i})`}),
      el('path',{d:'M60 4 C40 24 34 46 38 68 Q60 84 82 68 C86 46 80 24 60 4 Z',fill:`url(#l${i})`}),
      el('ellipse',{cx:60,cy:60,rx:24,ry:21,fill:`url(#v${i})`}),
      el('path',{d:'M104 26 L106 31 L111 33 L106 35 L104 40 L102 35 L97 33 L102 31 Z',fill:X(p,'gold','#f6c944')})
    ],
    face:{eyes:[[50,58],[70,58]],r:5.6,mouth:'M54 69 Q60 75 66 69 Z',mouthFill:'#ee7d9c',cheeks:[[43,66],[77,66]]}
  })
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
  const id=++uid;
  const shape=SHAPES[manifest.shape](p,id);
  const defs=el('defs',{},shape.defs);
  const body=el('g',{'data-part':'body'},shape.body);
  const F=shape.face;
  const eye=([cx,cy])=>[
    el('ellipse',{cx,cy,rx:F.r*1.12,ry:F.r*1.2,fill:'#fff'}),
    el('ellipse',{cx:cx,cy:cy+.4,rx:F.r*.9,ry:F.r,fill:X(p,'iris','#5a3418')})
  ];
  const gaze=el('g',{'data-part':'gaze'},F.eyes.flatMap(([cx,cy])=>[
    el('circle',{cx,cy:cy+.6,r:F.r*.52,fill:p.ink}),
    el('circle',{cx:cx+F.r*.32,cy:cy-F.r*.4,r:F.r*.28,fill:'#fff'}),
    el('circle',{cx:cx-F.r*.3,cy:cy+F.r*.3,r:F.r*.13,fill:'#fff',opacity:.8})
  ]));
  const brows=el('g',{'data-part':'brows'},F.eyes.map(([cx,cy],k)=>el('path',{d:`M${cx-F.r} ${cy-F.r*1.55} Q${cx} ${cy-F.r*2.1} ${cx+F.r} ${cy-F.r*1.55+(k?0.6:-0.6)}`,fill:'none',stroke:p.ink,'stroke-width':1.5,'stroke-linecap':'round',opacity:.8})));
  const eyes=el('g',{'data-part':'eyes'},[...F.eyes.flatMap(eye),gaze]);
  const cheeks=(F.cheeks||[]).map(([cx,cy])=>el('ellipse',{cx,cy,rx:5,ry:3.2,fill:'#f48fa4',opacity:.45}));
  const mouth=el('path',{'data-part':'mouth',d:F.mouth,fill:F.mouthFill||'none',stroke:p.ink,'stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round'});
  const cover=el('g',{'data-part':'cover'},F.eyes.map(([cx,cy])=>el('ellipse',{cx,cy:cy+1,rx:F.r*1.9,ry:F.r*1.6,fill:X(p,'hand',p.main),stroke:p.ink,'stroke-opacity':.25,'stroke-width':1})));
  const glow=el('circle',{'data-part':'glow',cx:60,cy:62,r:56,fill:tokens.light.sparkle,opacity:0});
  svg.append(defs,glow,body,...cheeks,brows,eyes,mouth,cover);host.append(svg);
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
