/* Image renderer: final raster art (one transparent WebP per expression) with crossfade, plus CSS-transform float,
   breathing, eye-follow parallax and small action recipes. Same interface as the placeholder renderer.
   Limit: no real blink or limb motion, those need separated layers (Rive/Lottie). Images load lazily. */
const MOTION={
  hop:[[{transform:'translateY(0)'},{transform:'translateY(-14px) scale(1.02,.98)'},{transform:'translateY(0)'}],700],
  tilt:[[{transform:'rotate(0)'},{transform:'rotate(-4deg)'},{transform:'rotate(0)'}],900],
  sway:[[{transform:'rotate(0)'},{transform:'rotate(3deg)'},{transform:'rotate(-3deg)'},{transform:'rotate(0)'}],1200],
  shiver:[[{transform:'translateX(0)'},{transform:'translateX(-2px)'},{transform:'translateX(2px)'},{transform:'translateX(0)'}],360]
};
export function createImageRenderer(host,manifest,cfg,opts={}){
  const reduced=()=>typeof opts.reduced==='function'?opts.reduced():false;
  const box=document.createElement('div');box.className='sc-char sc-img-char';box.setAttribute('aria-hidden','true');
  box.style.cssText='position:relative;inline-size:100%;block-size:100%';
  const mover=document.createElement('div');mover.style.cssText='position:absolute;inset:0;transform-origin:50% 100%';
  const bob=document.createElement('div');bob.style.cssText='position:absolute;inset:0;transform-origin:50% 100%';
  mover.append(bob);box.append(mover);host.append(box);
  const imgs={};
  const get=key=>{
    if(imgs[key])return imgs[key];
    const im=new Image();im.decoding='async';im.loading='lazy';im.alt='';im.draggable=false;
    im.src=cfg.frames[key];
    im.style.cssText='position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:contain;opacity:0;transition:opacity 220ms ease-out';
    bob.append(im);imgs[key]=im;return im;
  };
  const pick=s=>cfg.states[s]||cfg.states.Idle;
  let cur=null,paused=false;const anims=new Set();
  const show=key=>{if(key===cur)return;const next=get(key);const go=()=>{next.style.opacity='1';if(cur&&imgs[cur])imgs[cur].style.opacity='0';cur=key;};
    if(next.complete)go();else{next.onload=go;next.onerror=()=>{};}};
  const loop=(el,frames,ms)=>{if(reduced())return null;const a=el.animate(frames,{duration:ms,iterations:Infinity,easing:'ease-in-out'});anims.add(a);return a;};
  loop(bob,[{transform:'translateY(0)'},{transform:'translateY(-4px)'},{transform:'translateY(0)'}],3200/(manifest.speed||1));
  loop(mover,[{transform:'scale(1,1)'},{transform:'scale(1.012,1.022)'},{transform:'scale(1,1)'}],4200);
  show(pick('Idle'));
  return{
    kind:'image',el:box,
    setState(name){box.dataset.state=name;show(pick(name));
      if(!reduced()&&(name==='Success'||name==='Celebrate')){const a=mover.animate(MOTION.hop[0],{duration:MOTION.hop[1]});anims.add(a);a.onfinish=()=>anims.delete(a);}},
    play(recipe){if(reduced()||paused)return null;const m=/hop|jump/.test(recipe)?MOTION.hop:/tilt|curious|sniff/.test(recipe)?MOTION.tilt:/shiver|twitch/.test(recipe)?MOTION.shiver:MOTION.sway;
      const a=mover.animate(m[0],{duration:m[1]});anims.add(a);a.onfinish=()=>anims.delete(a);return a;},
    look(x,y){if(reduced())return;mover.style.translate=`${(x*4).toFixed(1)}px ${(y*2).toFixed(1)}px`;},
    pause(){paused=true;anims.forEach(a=>a.pause?.());},
    resume(){paused=false;anims.forEach(a=>a.play?.());},
    destroy(){anims.forEach(a=>a.cancel?.());anims.clear();box.remove();}
  };
}
