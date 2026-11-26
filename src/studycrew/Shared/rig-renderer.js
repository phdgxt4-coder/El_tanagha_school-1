/* Layered raster rig. The art is cut from the final per-expression images into layers (body, tail, head, two
   ears, eyelids) that move on spring physics with anticipation, follow-through and overlap, so the face and the
   body move together. Poses crossfade as groups; the head, ears and tail keep moving through the swap.
   Same renderer interface as the other adapters. Limit: layers are cut from flat images, so there is no hidden
   art behind a moving part. Keep angles small; real freedom needs layers drawn separately (Rive/Spine).
   Low quality or reduced motion falls back to the simple image renderer. */
const W=520;
const SPR=(k,c)=>({x:0,v:0,t:0,k,c});
const stepSpr=(s,dt)=>{const a=s.k*(s.t-s.x)-s.c*s.v;s.v+=a*dt;s.x+=s.v*dt;};
const pct=(pts,h)=>`polygon(${pts.map(([x,y])=>`${(x/W*100).toFixed(2)}% ${(y/h*100).toFixed(2)}%`).join(',')})`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function createRigRenderer(host,manifest,cfg,opts={}){
  const reduced=()=>typeof opts.reduced==='function'?opts.reduced():false;
  const H=cfg.height||608, L=cfg.layers;
  const box=document.createElement('div');box.className='sc-char sc-rig';box.setAttribute('aria-hidden','true');
  box.style.cssText='position:relative;inline-size:100%;block-size:100%;display:flex;align-items:flex-end;justify-content:center';
  const stage=document.createElement('div');
  stage.style.cssText=`position:relative;aspect-ratio:${W}/${H};block-size:100%;max-inline-size:100%;transform-origin:50% 100%;will-change:transform`;
  box.append(stage);host.append(box);
  const mk=(parent,css)=>{const d=document.createElement('div');d.style.cssText='position:absolute;inset:0;'+(css||'');parent.append(d);return d;};
  const img=(parent,src,clip)=>{const i=new Image();i.decoding='async';i.alt='';i.draggable=false;i.src=src;i.style.cssText='position:absolute;inset:0;inline-size:100%;block-size:100%;'+(clip?`clip-path:${pct(clip,H)};`:'');parent.append(i);return i;};
  const poses={};
  const ch={tail:[],head:[],earL:[],earR:[],body:[],torso:[],scroll:[],cap:[]};
  const build=key=>{
    if(poses[key])return poses[key];
    const src=cfg.frames[key];const g=mk(stage,'opacity:0;transition:opacity 300ms ease-out');
    const body=mk(g,'transform-origin:50% 100%');img(body,src);ch.body.push(body);
    const tail=mk(g,`transform-origin:${L.tailPivot[0]/W*100}% ${L.tailPivot[1]/H*100}%`);img(tail,src,L.tail);ch.tail.push(tail);
    const torso=mk(g,`transform-origin:${L.waist[0]/W*100}% ${L.waist[1]/H*100}%`);img(torso,src,L.torso);ch.torso.push(torso);
    const scr=mk(torso,`transform-origin:${L.scrollPivot[0]/W*100}% ${L.scrollPivot[1]/H*100}%`);img(scr,src,L.scroll);ch.scroll.push(scr);
    const head=mk(g,`transform-origin:${L.headPivot[0]/W*100}% ${L.headPivot[1]/H*100}%`);ch.head.push(head);
    const eL=mk(head,`transform-origin:${L.earLPivot[0]/W*100}% ${L.earLPivot[1]/H*100}%`);img(eL,src,L.earL);ch.earL.push(eL);
    const eR=mk(head,`transform-origin:${L.earRPivot[0]/W*100}% ${L.earRPivot[1]/H*100}%`);img(eR,src,L.earR);ch.earR.push(eR);
    // face layer on top of the ears
    const face=mk(head);img(face,src,L.head);
    const cap=mk(head,`transform-origin:${L.capPivot[0]/W*100}% ${L.capPivot[1]/H*100}%`);img(cap,src,L.cap);ch.cap.push(cap);
    poses[key]=g;return g;
  };
  // eyelids ride on the head, above the pose groups
  const lidHost=mk(stage,`transform-origin:${L.headPivot[0]/W*100}% ${L.headPivot[1]/H*100}%`);
  const lids=L.eyes.map(([cx,cy,rx,ry])=>{
    const d=mk(lidHost,`left:${(cx-rx)/W*100}%;top:${(cy-ry)/H*100}%;inset:auto;inline-size:${2*rx/W*100}%;block-size:${2*ry/H*100}%;border-radius:50%;background:radial-gradient(ellipse at 50% 30%,${L.fur[0]},${L.fur[1]});transform-origin:50% 0;transform:scaleY(0);box-shadow:inset 0 -2px 0 ${L.lash}`);return d;});
  const poseFor=s=>cfg.states[s]||cfg.states.Idle;
  let cur=null,state='Idle',paused=false,dead=false,seq=0,tPrev=performance.now(),time=0,blinkAt=2.5,glanceAt=4,busy=false,lookX=0,lookY=0;
  const S={headR:SPR(120,14),headX:SPR(120,14),headY:SPR(120,14),earL:SPR(160,9),earR:SPR(150,8),tail:SPR(70,5),bodyY:SPR(160,16),bodySY:SPR(180,13),bodyR:SPR(110,12),lid:SPR(900,60),torsoR:SPR(70,9),torsoX:SPR(60,10),torsoSX:SPR(90,8),torsoSY:SPR(90,8),skew:SPR(80,9),capR:SPR(55,4.5),scrollR:SPR(45,4),glanceX:SPR(40,9)};
  const pose=key=>{if(key===cur)return;const g=build(key);requestAnimationFrame(()=>{g.style.transition='opacity 300ms ease-out';g.style.opacity='1';if(cur&&poses[cur]){const o=poses[cur];o.style.transition='opacity 140ms linear 170ms';o.style.opacity='0';}cur=key;});};
  const set=(o)=>{for(const k in o)S[k].t=o[k];};
  const blink=async(slow)=>{if(!L.blinkPoses.includes(cur))return;S.lid.t=1;await sleep(slow?240:90);S.lid.t=0;};
  const apply=()=>{
    const idle=state==='Sleep'?.45:1;
    const br=Math.sin(time*1.55)*idle;               // breath, ~4 s per cycle
    const br2=Math.sin(time*1.55-0.7)*idle;          // shoulders and head follow the chest with a delay
    const wt=Math.sin(time*0.47)*idle;               // weight shift, ~13 s per cycle
    const bodyT=`translateY(${(S.bodyY.x).toFixed(2)}px) scale(${(1+(1-(1+S.bodySY.x))*0.5).toFixed(4)},${(1+S.bodySY.x).toFixed(4)}) rotate(${S.bodyR.x.toFixed(2)}deg)`;
    ch.body.forEach(e=>e.style.transform=bodyT);
    const tR=S.torsoR.x+wt*1.4, tX=S.torsoX.x+wt*3.2;
    const torsoT=`translate(${tX.toFixed(2)}px,${(-br2*2.2).toFixed(2)}px) rotate(${tR.toFixed(2)}deg) scale(${(1+S.torsoSX.x+br*0.011).toFixed(4)},${(1+S.torsoSY.x+br*0.026).toFixed(4)}) skewX(${(S.skew.x+br2*0.7-wt*0.5).toFixed(2)}deg)`;
    ch.torso.forEach(e=>e.style.transform=torsoT);
    ch.scroll.forEach(e=>e.style.transform=`rotate(${(S.scrollR.x-S.torsoR.v*0.05-tR*0.4).toFixed(2)}deg)`);
    const hr=S.headR.x+Math.sin(time*0.9+1)*0.5*idle+wt*-0.9;
    const hx=S.headX.x+S.glanceX.x+lookX*3+tX*0.7, hy=S.headY.x+lookY*2-br2*2.6;
    const headT=`translate(${hx.toFixed(2)}px,${hy.toFixed(2)}px) rotate(${(hr+lookX*1.2+S.glanceX.x*0.6).toFixed(2)}deg)`;
    ch.head.forEach(e=>e.style.transform=headT);lidHost.style.transform=headT;
    ch.cap.forEach(e=>e.style.transform=`rotate(${(S.capR.x-S.headR.v*0.03).toFixed(2)}deg)`);
    ch.earL.forEach(e=>e.style.transform=`rotate(${(S.earL.x-S.headR.v*0.03-S.glanceX.v*0.05).toFixed(2)}deg)`);
    ch.earR.forEach(e=>e.style.transform=`rotate(${(S.earR.x-S.headR.v*0.03-S.glanceX.v*0.05).toFixed(2)}deg)`);
    ch.tail.forEach(e=>e.style.transform=`rotate(${(S.tail.x+Math.sin(time*1.1-0.9)*2.2*idle-tX*0.8-S.bodyR.v*0.04).toFixed(2)}deg)`);
    lids.forEach(l=>l.style.transform=`scaleY(${Math.max(0,Math.min(1,S.lid.x)).toFixed(3)})`);
  };
  const loop=now=>{if(dead)return;requestAnimationFrame(loop);if(paused){tPrev=now;return;}
    const dt=Math.min(.033,(now-tPrev)/1000);tPrev=now;time+=dt;
    for(const k in S){stepSpr(S[k],dt);}
    const calm=state==='Idle'||state==='Thinking'||state==='Loading'||state==='Reading'||state==='Searching'||state==='Typing';
    if(calm&&!busy&&time>glanceAt){const d=Math.random()<.5?-1:1;glanceAt=time+3+Math.random()*5;
      // the head leads: turn, then a blink after the head has started moving, then return
      S.glanceX.t=d*(3+Math.random()*3);S.earL.t=-d*4;S.earR.t=-d*4;setTimeout(()=>{blink();},140);
      setTimeout(()=>{S.glanceX.t=0;S.earL.t=0;S.earR.t=0;},650+Math.random()*500);}
    if(time>blinkAt&&state!=='Sleep'&&state!=='HiddenPassword'){blink(Math.random()<.2);blinkAt=time+2.2+Math.random()*4.5;if(Math.random()<.18)setTimeout(blink,260);}
    apply();};
  // choreography helpers: each step sets spring targets, waits, sets the next (anticipation, action, settle)
  const run=async fn=>{const id=++seq;const w=async ms=>{await sleep(ms);if(id!==seq||dead)throw 0;};try{await fn(w);}catch(e){if(e!==0)throw e;}};
  const rest=()=>set({headR:0,headX:0,headY:0,earL:0,earR:0,tail:0,bodyY:0,bodySY:0,bodyR:0,lid:0});
  const SEQ={
    Idle:async w=>{rest();},
    Wave:async w=>{set({bodyY:2,bodySY:-.02});await w(120);set({headR:-5,earL:-6,earR:6,bodyY:-8,bodySY:.025,tail:7});await w(260);set({tail:-7,headR:3});await w(260);set({tail:5,headR:-2});await w(260);rest();},
    Wake:async w=>{set({lid:1,bodySY:-.02,headY:6});await w(160);set({lid:0,bodySY:.03,headY:-3,earL:-7,earR:7});await w(380);rest();},
    Thinking:async w=>{set({bodyY:1,headR:-2});await w(140);set({headR:-9,headX:-5,earL:4,earR:-9,tail:3});await w(240);blink(true);},
    Success:async w=>{set({bodyY:7,bodySY:-.04,headY:5,earL:5,earR:-5});await w(170);set({bodyY:-20,bodySY:.05,headY:-5,earL:-9,earR:9,tail:9});await w(220);set({bodyY:0,bodySY:-.03,tail:-8});await w(190);set({bodySY:.015,headR:-3,tail:6});await w(260);set({headR:2,tail:-5});await w(300);rest();},
    Error:async w=>{set({bodyY:-3,bodySY:.02,headY:-3,earL:-3,earR:3});await w(110);set({bodyY:4,bodySY:-.03,headY:8,headR:6,earL:14,earR:-14,tail:-6});await w(420);blink(true);},
    HiddenPassword:async w=>{set({headX:-5,headR:4});await w(240);blink(true);await w(220);set({bodyY:3,bodySY:-.02,headY:4});await w(150);set({bodyY:-3,bodySY:.015,headR:0,headX:0,earL:-3,earR:3});},
    Help:async w=>{set({bodyY:2,bodySY:-.02});await w(110);set({bodyY:-3,bodySY:.015,headR:-6,headY:-3,earL:-5,earR:5});},
    Sleep:async w=>{set({headY:12,headR:7,earL:12,earR:-12,bodyY:4,bodySY:-.02,tail:-3});await w(260);set({lid:1});}
  };
  const ALIAS={Celebrate:'Success',Loading:'Thinking',Reading:'Thinking',Searching:'Thinking',Typing:'Thinking',VisiblePassword:'Wake'};
  build(poseFor('Idle'));pose(poseFor('Idle'));
  requestAnimationFrame(loop);
  return{
    kind:'rig',el:box,
    setState(name){
      box.dataset.state=name;
      const prev=state;state=name;
      const toHidden=name==='HiddenPassword',fromHidden=prev==='HiddenPassword';
      run(async w=>{
        busy=true;
        // beat 1: never a direct swap. A short realisation, then the head and body prepare for the change.
        if(prev!==name){
          if(prev==='Thinking'||prev==='Loading'||prev==='Reading'||prev==='Searching'||prev==='Typing'){set({headY:-5,headR:0,headX:0,earL:-9,earR:9,bodySY:.02,lid:0});await w(230);blink();await w(150);}
          else if(fromHidden){set({headY:-3,headR:-3,bodySY:.015});await w(260);}
          else if(prev==='Error'){set({headY:-4,earL:-3,earR:3,bodySY:.025});await w(380);}
          else if(prev==='Sleep'){set({lid:.5});await w(260);}
          else {set({bodySY:-.015,headY:2});await w(130);}
        }
        const fn=SEQ[name]||SEQ[ALIAS[name]]||SEQ.Idle;
        // expression crossfade (480 ms) starts inside the body move
        setTimeout(()=>{if(!dead)pose(poseFor(name));},toHidden?330:name==='Success'||name==='Celebrate'?200:120);
        await fn(w);
        // beat 3: body settles, springs overshoot once and come to rest
        set({torsoSY:.012,torsoR:-1});await w(240);set({torsoSY:0,torsoR:0});busy=false;
      });
    },
    play(recipe){if(paused)return null;
      run(async w=>{if(/hop|jump/.test(recipe)){set({bodyY:5,bodySY:-.03});await w(120);set({bodyY:-14,bodySY:.04,tail:6});await w(220);rest();}
        else if(/tail|wag|sway/.test(recipe)){set({tail:10});await w(220);set({tail:-9});await w(220);set({tail:5});await w(240);set({tail:0});}
        else if(/ear|twitch|shiver/.test(recipe)){set({earL:-9});await w(110);set({earL:2,earR:8});await w(140);set({earR:0,earL:0});}
        else {set({headR:-2});await w(120);set({headR:-6,headX:-3,earR:-5});await w(500);blink();set({headR:0,headX:0,earR:0});}});return null;},
    look(x,y){lookX=Math.max(-1,Math.min(1,x));lookY=Math.max(-1,Math.min(1,y));},
    pause(){paused=true;},resume(){paused=false;},
    destroy(){dead=true;box.remove();}
  };
}
