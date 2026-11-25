/* Puppet renderer (Alex). Canvas 2D, no dependencies.
   Real separated parts (body clean plate, tail, ears, head, irises, closed-eye lids) driven by chains of springs:
   - spine: 6 strips bent joint by joint (breathing, lean, weight shift, crouch). Tail attaches at the hip, the head
     at the neck, so the body leads and everything above it follows.
   - tail: 5 strips, each following the one before it with lag (a real whip, not a rotation).
   - ears: 4 strips each, driven by the head and body acceleration (weight and follow-through).
   - gaze: pupils slide inside the eye opening. Order is eyes first, head 90 ms later, body 180 ms later.
   Same renderer interface as the other adapters. Honest limit: parts are cut from AI-generated pictures, so bends stay
   moderate and the face has no eyebrow or mouth change. Hand-rigged Rive/Spine art would go further. */
const SPR=(k,c,t=0)=>({x:t,v:0,t,k,c});
const stepSpr=(s,dt)=>{const a=s.k*(s.t-s.x)-s.c*s.v;s.v+=a*dt;s.x+=s.v*dt;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rnd=(a,b)=>a+Math.random()*(b-a);
const M=()=>new DOMMatrix();
const ALIAS={Celebrate:'Success',Loading:'Thinking',Reading:'Thinking',Searching:'Thinking',Typing:'Thinking',Wave:'Happy',Help:'Curious',VisiblePassword:'Wake'};
function chain(n,P,theta,len){
  const seg=len/n;
  return{n,P,theta,seg,len,mats:[],
    solve(a){let m=M().translate(P[0],P[1]).rotate(theta);this.mats=[];
      for(let i=0;i<n;i++){if(i>0)m=m.translate(seg,0);m=m.rotate(a[i]);this.mats.push(m);}},
    // image coords -> deformed coords for strip i
    strip(i){return this.mats[i].translate(-i*seg,0).rotate(-theta).translate(-P[0],-P[1]);},
    // local axis frame for clipping
    frame(i){return this.mats[i].translate(-i*seg,0);}
  };
}
export function createPuppetRenderer(host,manifest,cfg,opts={}){
  const reduced=()=>typeof opts.reduced==='function'?opts.reduced():false;
  const SZ=cfg.size||640, K=SZ/(cfg.src||1254), G=cfg.geo, meta=cfg.meta;
  const box=document.createElement('div');box.className='sc-char sc-puppet';box.setAttribute('aria-hidden','true');
  box.style.cssText='position:relative;inline-size:100%;block-size:100%;display:flex;align-items:flex-end;justify-content:center';
  const cv=document.createElement('canvas');cv.width=SZ;cv.height=Math.round(SZ*(cfg.aspect||1));
  cv.style.cssText=`aspect-ratio:${cv.width}/${cv.height};block-size:100%;max-inline-size:100%`;
  box.append(cv);host.append(box);
  const ctx=cv.getContext('2d');
  const img={};let ready=0;const names=Object.keys(cfg.parts);
  names.forEach(n=>{const i=new Image();i.decoding='async';i.onload=()=>{ready++;};i.src=cfg.parts[n];img[n]=i;});
  const spine=chain(G.spine.n,G.spine.P,G.spine.theta,G.spine.len);
  const tail=chain(G.tail.n,G.tail.P,G.tail.theta,G.tail.len);
  const earL=chain(G.earL.n,G.earL.P,G.earL.theta,G.earL.len);
  const earR=chain(G.earR.n,G.earR.P,G.earR.theta,G.earR.len);
  const J=(n,k,c,f)=>Array.from({length:n},(_,i)=>SPR(k*(1-i*f),c));
  const sp=J(spine.n,70,9,.07), tl=J(tail.n,38,3.2,.1), eL=J(earL.n,60,3.6,.1), eR=J(earR.n,60,3.6,.1);
  // intent springs (what the character wants), each with its own weight
  const S={lean:SPR(34,6.5),bodyX:SPR(42,7),bodyY:SPR(120,12),crouch:SPR(110,10),headR:SPR(80,9),yaw:SPR(60,9),headY:SPR(90,10),
    gx:SPR(430,32),gy:SPR(430,32),earLb:SPR(120,9),earRb:SPR(120,9),tailB:SPR(46,6),lid:SPR(1300,80),capX:SPR(40,6)};
  const set=o=>{for(const k in o)S[k].t=o[k];};
  let time=0,tPrev=performance.now(),paused=false,dead=false,state='Idle',busy=false,seq=0,wagAmp=0,wagRate=7,wagAmpT=0,calm=1,idleAt=2.5,blinkAt=2;
  const bodyBefore={x:0,y:0};
  const look=(x,y,hw=.7,bw=.25,delay=90)=>{set({gx:x,gy:y});
    setTimeout(()=>{if(!dead)set({yaw:x*hw*14,headY:y*hw*6,headR:x*hw*3+S.headR.t*0});},delay);
    setTimeout(()=>{if(!dead)set({bodyX:x*bw*16,lean:x*bw*2.5});},delay*2);};
  const blink=async(slow)=>{S.lid.t=1;await sleep(slow?260:85);if(!dead)S.lid.t=S.lid.hold||0;};
  const run=async fn=>{const id=++seq;const w=async ms=>{await sleep(ms);if(id!==seq||dead)throw 0;};try{await fn(w);}catch(e){if(e!==0)throw e;}};
  const rest=()=>{set({lean:0,bodyX:0,bodyY:0,crouch:0,headR:0,yaw:0,headY:0,gx:0,gy:0,earLb:0,earRb:0,tailB:0,lid:0});S.lid.hold=0;wagAmpT=0;calm=1;};
  const SEQ={
    Idle:async w=>{rest();},
    Curious:async w=>{
      set({crouch:.018,lean:-2,headR:-2});await w(110);                              // anticipation: sink and draw back
      set({crouch:-.012,lean:6,bodyX:10,earLb:-9,earRb:8,tailB:-5});await w(90);       // body moves in
      look(.8,-.35,.5,.3);set({headR:9});await w(260);                                 // eyes lead, head tilts
      set({earLb:-16});await w(460);                                                    // one ear lifts with interest
      look(-.4,-.15,.45,.2);await w(520);blink();await w(240);
      look(.25,-.3,.35,.1);set({headR:6,earLb:-7,earRb:4});},
    Happy:async w=>{
      set({crouch:.03,lean:-2});await w(120);
      set({crouch:-.03,bodyY:-14,lean:2,earLb:-8,earRb:8,lid:.8});S.lid.hold=.8;wagAmpT=16;wagRate=11;await w(230);
      set({crouch:.025,bodyY:0,headR:-5});await w(190);
      set({crouch:-.02,bodyY:-8,headR:5});await w(210);
      set({crouch:0,bodyY:0,lean:0,headR:3,earLb:2,earRb:-2});await w(500);
      set({lid:.35});S.lid.hold=.35;},
    Thinking:async w=>{
      set({crouch:.01,lean:-1});await w(120);
      look(-.75,-.7,.55,.25);set({headR:-6,earLb:7,earRb:-10,tailB:3});await w(520);
      look(.1,-.8,.5,.2);await w(420);look(.65,-.45,.55,.2);set({headR:-2});await w(500);
      blink();look(-.5,.25,.5,.2);await w(560);look(-.7,-.6,.5,.2);},
    Success:async w=>{
      set({crouch:.045,lean:-3,earLb:6,earRb:-6});await w(150);
      set({crouch:-.05,bodyY:-28,lean:3,earLb:-10,earRb:10,lid:.85,tailB:8});S.lid.hold=.85;wagAmpT=22;wagRate=12;await w(240);
      set({crouch:.04,bodyY:0});await w(170);
      set({crouch:-.03,bodyY:-12,headR:-5});await w(200);
      set({crouch:.01,bodyY:0,headR:4,lean:0});await w(400);set({lid:.3});S.lid.hold=.3;},
    Error:async w=>{
      set({crouch:-.015,bodyY:-4,lean:3,earLb:-4,earRb:4});await w(100);
      set({crouch:.035,lean:-6,headY:10,headR:5,earLb:14,earRb:-14,tailB:-9,gy:.5});await w(300);
      look(-.6,.5,.4,.1);await w(380);blink(true);await w(350);look(.4,.45,.3,.1);},
    HiddenPassword:async w=>{
      look(-1,0,.9,.4);set({headR:5,lean:-2});await w(200);set({lid:1});S.lid.hold=1;await w(160);set({crouch:.02,earLb:6,earRb:-6});},
    Sleep:async w=>{
      calm=.5;look(0,.9,.9,.3);set({crouch:.04,headY:14,headR:8,earLb:12,earRb:-12,tailB:-4,lean:-3});await w(500);set({lid:1});S.lid.hold=1;},
    Wake:async w=>{
      set({lid:.55,crouch:.03,headY:8});await w(220);set({lid:0,crouch:-.03,lean:2,headY:-2,earLb:-9,earRb:8});await w(300);
      set({crouch:0,lean:0,earLb:0,earRb:0,headY:0});S.lid.hold=0;await w(200);}
  };
  const flickEar=l=>{const a=l?eL:eR;a[0].v+=(l?-1:1)*rnd(90,150);};
  const idleBeat=()=>{
    const r=Math.random();
    if(r<.3){const d=Math.random()<.5?-1:1;look(d*rnd(.5,.9),rnd(-.2,.1),.55,.2);setTimeout(()=>blink(),160);setTimeout(()=>look(0,0,.5,.2),rnd(900,1700));}   // side glance, eyes then head
    else if(r<.5){flickEar(Math.random()<.5);}
    else if(r<.7){const d=Math.random()<.5?-1:1;set({bodyX:d*8,lean:d*2.5,crouch:.008});setTimeout(()=>set({bodyX:0,lean:0,crouch:0}),rnd(1400,2400));wagAmpT=5;setTimeout(()=>{wagAmpT=0;},1500);} // posture change
    else if(r<.85){look(rnd(-.4,.4),-.5,.4,.15);setTimeout(()=>look(0,0,.4,.1),rnd(800,1300));}
    else {set({headR:rnd(-4,4)});setTimeout(()=>set({headR:0}),1600);flickEar(Math.random()<.5);}
  };
  const draw=()=>{
    const idle=state==='Sleep'?.5:calm;
    const br=Math.sin(time*1.55)*idle, br2=Math.sin(time*1.55-.8)*idle, wt=Math.sin(time*.47)*idle;
    // spine joints: lean spread by weight, breathing in the chest, lag toward the top
    const lw=[.04,.1,.16,.22,.24,.24];
    const sa=sp.map((s,i)=>s.x+br*(i>=2?.35:.1)*(i>=3?1.1:1)+wt*.6*(i<3?.3:.5));
    spine.solve(sa);
    const base=M().scale(K,K).translate(0,0);
    const sy=1+S.crouch.x*-1+br*.006, sx=1+S.crouch.x*.7-br*.003;
    const root=M().scale(K,K).translate(G.spine.P[0]+S.bodyX.x+wt*3,G.spine.P[1]+S.bodyY.x).scale(sx,sy).translate(-G.spine.P[0],-G.spine.P[1]);
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);
    // floor shadow
    ctx.save();ctx.setTransform(K,0,0,K,0,0);const sh=1-Math.min(.35,Math.max(-.35,-S.bodyY.x/90));
    const gr=ctx.createRadialGradient(G.shadow[0]+S.bodyX.x*.6,G.shadow[1],4,G.shadow[0]+S.bodyX.x*.6,G.shadow[1],G.shadow[2]*sh);
    gr.addColorStop(0,'rgba(10,6,2,.30)');gr.addColorStop(1,'rgba(10,6,2,0)');ctx.fillStyle=gr;
    ctx.save();ctx.translate(G.shadow[0],G.shadow[1]);ctx.scale(1,.14);ctx.translate(-G.shadow[0],-G.shadow[1]);ctx.fillRect(G.shadow[0]-G.shadow[2]*1.2,G.shadow[1]-G.shadow[2]*1.2,G.shadow[2]*2.4,G.shadow[2]*2.4);ctx.restore();ctx.restore();
    const put=(name,mat)=>{const m=meta[name];ctx.setTransform(mat);ctx.drawImage(img[name],m[0],m[1],m[2],m[3]);};
    const stripDraw=(name,ch,mat0,i,ov=2)=>{
      const fr=mat0.multiply(ch.frame(i));ctx.save();ctx.setTransform(fr);ctx.beginPath();
      const x0=i===0?-4000:i*ch.seg-1,x1=i===ch.n-1?4000:(i+1)*ch.seg+ch.seg*.85;ctx.rect(x0,-4000,x1-x0,8000);ctx.clip();
      const m=meta[name];ctx.setTransform(mat0.multiply(ch.strip(i)));ctx.drawImage(img[name],m[0],m[1],m[2],m[3]);ctx.restore();};
    // tail: attached to the hip strip of the spine
    const hip=G.hipStrip;
    const hipM=root.multiply(spine.strip(hip));
    const tws=Math.sin(time*wagRate)*wagAmp;
    const exc=-(S.bodyX.v*.06+S.lean.v*.12+S.yaw.v*.02)*(1);
    tl.forEach((s,i)=>{s.t=i===0?S.tailB.x+tws+exc*4+Math.sin(time*1.1-.9)*1.8*idle+wt*-1.2:tl[i-1].x*.78+(i>1?tws*.06:0);});
    tail.solve(tl.map(s=>s.x));
    for(let i=0;i<tail.n;i++)stripDraw('tail',tail,hipM,i);
    // body strips
    for(let i=0;i<spine.n;i++)stripDraw('body',spine,root,i);
    // head: neck on the last spine strip, then its own lagged roll, yaw and bob
    const neck=G.neck, headBase=root.multiply(spine.strip(spine.n-1));
    const yawN=S.yaw.x+Math.sin(time*.9+1)*.5*idle, hy=S.headY.x-br2*2.4, hr=S.headR.x+Math.sin(time*.7)*.5*idle-wt*.7+S.yaw.x*.08;
    const headM=headBase.translate(neck[0]+yawN,neck[1]+hy).rotate(hr).scale(1-Math.abs(yawN)*.0016,1+br2*.004).translate(-neck[0],-neck[1]);
    // ears: base targets plus inertia from head and body, followers lag and droop
    const he=-(S.yaw.v*.045+S.headR.v*.1+S.lean.v*.1+S.bodyY.v*.01);
    eL.forEach((s,i)=>{s.t=i===0?S.earLb.x+he*1.4+Math.sin(time*.6)*1.2*idle:eL[i-1].x*.72+(i===1?-3:0)*(1-Math.abs(S.earLb.x)/25);});
    eR.forEach((s,i)=>{s.t=i===0?S.earRb.x+he*1.4+Math.sin(time*.6+2)*1.2*idle:eR[i-1].x*.72+(i===1?3:0)*(1-Math.abs(S.earRb.x)/25);});
    earL.solve(eL.map(s=>s.x));earR.solve(eR.map(s=>s.x));
    for(let i=0;i<earL.n;i++)stripDraw('earL',earL,headM,i);
    for(let i=0;i<earR.n;i++)stripDraw('earR',earR,headM,i);
    put('head',headM);
    // eyes: irises slide inside the eye opening, lids sweep down
    ['L','R'].forEach(k=>{
      const e=G.eye[k],m=meta['iris'+k];
      ctx.save();ctx.setTransform(headM);ctx.beginPath();ctx.ellipse(e[0],e[1],e[2],e[3],0,0,Math.PI*2);ctx.clip();
      ctx.drawImage(img['iris'+k],m[0]+S.gx.x*G.gaze[0],m[1]+S.gy.x*G.gaze[1],m[2],m[3]);
      const l=Math.max(0,Math.min(1,S.lid.x));
      if(l>.01){const lm=meta['lid'+k];ctx.beginPath();ctx.rect(lm[0],lm[1],lm[2],lm[3]*l*.82);ctx.clip();ctx.drawImage(img['lid'+k],lm[0],lm[1],lm[2],lm[3]);}
      ctx.restore();});
  };
  const loop=now=>{if(dead)return;requestAnimationFrame(loop);if(paused||ready<names.length){tPrev=now;return;}
    const dt=Math.min(.033,(now-tPrev)/1000);tPrev=now;time+=dt;
    wagAmp+=(wagAmpT-wagAmp)*Math.min(1,dt*5);
    for(let s=0;s<2;s++){const h=dt/2;for(const k in S)stepSpr(S[k],h);sp.forEach((j,i)=>{j.t=S.lean.x*[.05,.12,.18,.25,.2,.2][i]*3+((i>0?sp[i-1].x*.3:0));stepSpr(j,h);});
      [tl,eL,eR].forEach(a=>a.forEach(j=>stepSpr(j,h)));}
    if(!busy&&time>idleAt&&(state==='Idle'||state==='Thinking')&&state==='Idle'){idleBeat();idleAt=time+rnd(2.2,5.5);}
    if(time>blinkAt&&state!=='Sleep'&&state!=='HiddenPassword'){blink(Math.random()<.2);blinkAt=time+rnd(2.2,5);if(Math.random()<.2)setTimeout(blink,250);}
    draw();};
  requestAnimationFrame(loop);
  return{
    kind:'puppet',el:box,
    setState(name){
      box.dataset.state=name;const prev=state;state=name;
      run(async w=>{busy=true;
        if(prev!==name){set({crouch:.012,headY:-3});await w(110);}                       // small realisation beat
        const fn=SEQ[name]||SEQ[ALIAS[name]]||SEQ.Idle;
        if(!['Sleep','Happy','Success','Celebrate','HiddenPassword'].includes(name)&&!['Sleep','Happy','Success','Celebrate','HiddenPassword'].includes(ALIAS[name]||'')){calm=1;}
        if(prev==='Sleep'||prev==='HiddenPassword'){S.lid.hold=0;set({lid:0});}
        await fn(w);busy=false;});
    },
    play(r){if(paused)return null;
      if(/hop|jump/.test(r))run(async w=>{set({crouch:.04});await w(120);set({crouch:-.04,bodyY:-18});await w(220);set({crouch:0,bodyY:0});});
      else if(/tail|wag|sway/.test(r)){wagAmpT=18;wagRate=10;setTimeout(()=>{wagAmpT=0;},1400);}
      else if(/ear|twitch|shiver/.test(r)){flickEar(true);setTimeout(()=>flickEar(false),140);}
      else idleBeat();return null;},
    look(x,y){look(Math.max(-1,Math.min(1,x)),Math.max(-1,Math.min(1,y)),.6,.2,60);},
    pause(){paused=true;},resume(){paused=false;},destroy(){dead=true;box.remove();}
  };
}
