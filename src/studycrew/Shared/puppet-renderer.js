/* Puppet renderer (Alex). Canvas 2D, no dependencies.
   Real separated parts (torso clean plate, two arms, tail, ears, head, irises, closed-eye lids) driven by chains of springs:
   - spine: 6 strips bent joint by joint (breathing, lean, weight shift, crouch). Tail attaches at the hip, the arms at the
     shoulders and the head at the neck, so the body leads and everything above it follows.
   - arms: 6 strips each (shoulder, elbow, wrist). Raise, curl and wave are joint targets, with lag toward the hand.
   - tail: 5 strips following each other. Ears: 4 strips each, driven by head and body acceleration.
   - gaze: irises slide inside the eye opening, the lid sweeps down. Order: eyes first, head 90 ms later, body 180 ms later.
   Same renderer interface as the other adapters. Honest limit: the parts are cut from AI-generated pictures, so bends stay
   moderate, the face has no eyebrow or mouth change and the wrist has no hand poses. Hand-rigged Rive/Spine art goes further. */
const SPR=(k,c,t=0)=>({x:t,v:0,t,k,c});
const stepSpr=(s,dt)=>{const a=s.k*(s.t-s.x)-s.c*s.v;s.v+=a*dt;s.x+=s.v*dt;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rnd=(a,b)=>a+Math.random()*(b-a);
const M=()=>new DOMMatrix();
const ALIAS={Celebrate:'Success',Loading:'Thinking',Reading:'Thinking',Searching:'Thinking',Typing:'Thinking',Help:'Curious',VisiblePassword:'Wake'};
const HIDE=['Sleep','Happy','Success','Celebrate','HiddenPassword'];
function chain(n,P,theta,len){
  const seg=len/n;
  return{n,P,theta,seg,len,mats:[],
    solve(a){let m=M().translate(P[0],P[1]).rotate(theta);this.mats=[];
      for(let i=0;i<n;i++){if(i>0)m=m.translate(seg,0);m=m.rotate(a[i]);this.mats.push(m);}},
    strip(i){return this.mats[i].translate(-i*seg,0).rotate(-theta).translate(-P[0],-P[1]);},
    frame(i){return this.mats[i].translate(-i*seg,0);}
  };
}
export function createPuppetRenderer(host,manifest,cfg,opts={}){
  const SZ=cfg.size||640, K=SZ/(cfg.src||1254)*.9, OX=SZ*.05, OY=SZ*.1, G=cfg.geo, meta=cfg.meta;
  const box=document.createElement('div');box.className='sc-char sc-puppet';box.setAttribute('aria-hidden','true');
  box.style.cssText='position:relative;inline-size:100%;block-size:100%;display:flex;align-items:flex-end;justify-content:center';
  const cv=document.createElement('canvas');cv.width=SZ;cv.height=SZ;
  cv.style.cssText='aspect-ratio:1/1;block-size:100%;max-inline-size:100%';
  box.append(cv);host.append(box);
  const ctx=cv.getContext('2d');
  const img={};let ready=0;const names=Object.keys(cfg.parts);
  names.forEach(n=>{const i=new Image();i.decoding='async';i.onload=()=>{ready++;};i.src=cfg.parts[n];img[n]=i;});
  const C=k=>chain(G[k].n,G[k].P,G[k].theta,G[k].len);
  const spine=C('spine'),tail=C('tail'),earL=C('earL'),earR=C('earR'),armL=C('armL'),armR=C('armR');
  const J=(n,k,c,f)=>Array.from({length:n},(_,i)=>SPR(k*(1-i*f),c));
  const sp=J(6,70,9,.07),tl=J(5,38,3.2,.1),eL=J(4,60,3.6,.1),eR=J(4,60,3.6,.1),aL=J(6,60,6.5,.08),aR=J(6,60,6.5,.08);
  const S={lean:SPR(34,6.5),bodyX:SPR(42,7),bodyY:SPR(120,12),crouch:SPR(110,10),headR:SPR(80,9),yaw:SPR(60,9),headY:SPR(90,10),
    gx:SPR(430,32),gy:SPR(430,32),earLb:SPR(120,9),earRb:SPR(120,9),tailB:SPR(46,6),lid:SPR(1300,80),
    sL:SPR(55,7),cL:SPR(55,7),sR:SPR(55,7),cR:SPR(55,7),shr:SPR(110,11)};
  const set=o=>{for(const k in o)S[k].t=o[k];};
  let time=0,tPrev=performance.now(),paused=false,dead=false,state='Idle',busy=false,seq=0,wagAmp=0,wagRate=7,wagAmpT=0,calm=1,idleAt=2,blinkAt=2,waveL=0,waveLT=0,waveR=0,waveRT=0,front=0;
  const look=(x,y,hw=.7,bw=.25,delay=90)=>{set({gx:x,gy:y});
    setTimeout(()=>{if(!dead)set({yaw:x*hw*16,headY:y*hw*8});},delay);
    setTimeout(()=>{if(!dead)set({bodyX:x*bw*20,lean:x*bw*3});},delay*2);};
  const blink=async(slow)=>{S.lid.t=1;await sleep(slow?260:85);if(!dead)S.lid.t=S.lid.hold||0;};
  const run=async fn=>{const id=++seq;const w=async ms=>{await sleep(ms);if(id!==seq||dead)throw 0;};try{await fn(w);}catch(e){if(e!==0)throw e;}};
  const rest=()=>{set({lean:0,bodyX:0,bodyY:0,crouch:0,headR:0,yaw:0,headY:0,gx:0,gy:0,earLb:0,earRb:0,tailB:0,lid:0,sL:0,cL:0,sR:0,cR:0,shr:0});S.lid.hold=0;wagAmpT=0;waveLT=0;waveRT=0;calm=1;};
  // arms: s = how far the arm lifts out from the shoulder (deg), c = how far the elbow curls inward (deg)
  const SEQ={
    Idle:async w=>{rest();},
    Curious:async w=>{
      set({crouch:.022,lean:-3,headR:-3,earLb:5,earRb:-5});await w(130);                       // anticipation: draw back and sink
      set({crouch:-.014,lean:5,bodyX:8,earLb:-12,earRb:10,tailB:-8,sR:10,cR:18});await w(100);   // body moves in, ears come up
      look(.85,-.4,.5,.25);set({headR:9});await w(280);                                       // eyes lock on, head tilts
      set({earLb:-17});await w(480);                                                            // one ear lifts further
      look(-.35,-.15,.5,.25);await w(560);blink();await w(240);
      look(.3,-.3,.4,.15);set({headR:7,earLb:-9,earRb:5});},
    Happy:async w=>{
      set({crouch:.035,lean:-3,sL:8,sR:8});await w(130);
      set({crouch:-.035,bodyY:-18,lean:2,earLb:-12,earRb:12,lid:.8,sL:38,sR:38,cL:20,cR:20});S.lid.hold=.8;wagAmpT=22;wagRate=11;await w(240);
      set({crouch:.03,bodyY:0,headR:-6,sL:14,sR:14});await w(200);
      set({crouch:-.025,bodyY:-10,headR:6,sL:32,sR:32});await w(220);
      set({crouch:0,bodyY:0,lean:0,headR:3,earLb:2,earRb:-2,sL:4,sR:4,cL:0,cR:0});await w(500);
      set({lid:.35});S.lid.hold=.35;},
    Wave:async w=>{
      look(.4,-.1,.5,.2);set({crouch:.015,lean:-2});await w(120);
      set({sL:125,cL:30,shr:-4,headR:-5,earLb:-6,lean:3,lid:.3});S.lid.hold=.3;await w(380);       // arm lifts from the shoulder
      waveLT=34;await w(1500);waveLT=0;set({sL:120,cL:30});await w(200);
      set({sL:0,cL:0,headR:0,lean:0,lid:0});S.lid.hold=0;look(0,0,.5,.2);await w(500);},
    Thinking:async w=>{
      set({crouch:.012,lean:-1,gx:0,gy:0});await w(380);                                        // pause
      set({headR:-5,yaw:-8,lean:-2});await w(260);                                              // head moves first
      look(-.75,-.75,.55,.25);set({earLb:9,earRb:-12,tailB:3,lid:.28});S.lid.hold=.28;await w(520);// then eyes look up
      set({sR:125,cR:175});await w(800);                                                         // hand to chin
      look(.1,-.8,.5,.2);await w(560);look(.6,-.4,.55,.2);set({headR:-2});await w(560);
      blink();look(-.5,.25,.5,.2);await w(560);look(-.7,-.6,.5,.2);},
    Success:async w=>{
      set({crouch:.05,lean:-4,earLb:6,earRb:-6,sL:10,sR:10});await w(150);
      set({crouch:-.055,bodyY:-32,lean:3,earLb:-12,earRb:12,lid:.85,tailB:9,sL:120,sR:120,cL:10,cR:10});S.lid.hold=.85;wagAmpT=24;wagRate=12;await w(260);
      set({crouch:.045,bodyY:0,sL:30,sR:30});await w(180);
      set({crouch:-.035,bodyY:-14,headR:-6,sL:80,sR:80});await w(220);
      set({crouch:.01,bodyY:0,headR:4,lean:0,sL:0,sR:0,cL:0,cR:0});await w(400);set({lid:.3});S.lid.hold=.3;},
    Error:async w=>{
      set({crouch:-.015,bodyY:-4,lean:3,earLb:-4,earRb:4,sL:12,sR:12});await w(100);
      set({crouch:.04,lean:-7,headY:12,headR:5,earLb:16,earRb:-16,tailB:-10,gy:.5,sL:0,sR:0,cL:30,cR:30,shr:-6});await w(300);
      look(-.6,.5,.4,.1);await w(380);blink(true);await w(350);look(.4,.45,.3,.1);},
    HiddenPassword:async w=>{
      look(0,-.15,.5,.1);await w(450);                                                          // look at the screen
      set({shr:-9,lean:-2,crouch:.012});await w(220);                                          // shoulders rise
      set({sL:110,cL:120,sR:110,cR:105,headR:3,earLb:6,earRb:-6});await w(560);                   // hands travel to the face
      set({lid:1});S.lid.hold=1;await w(160);set({sL:125,cL:140,sR:125,cR:125,crouch:.02});},                 // cover the eyes
    Sleep:async w=>{
      calm=.5;look(0,.9,.9,.3);set({crouch:.045,headY:16,headR:9,earLb:14,earRb:-14,tailB:-5,lean:-4,cL:20,cR:20});await w(500);set({lid:1});S.lid.hold=1;},
    Wake:async w=>{
      set({lid:.55,crouch:.035,headY:9});await w(220);set({lid:0,crouch:-.035,lean:3,headY:-3,earLb:-12,earRb:10,sL:30,sR:30});await w(300);
      set({crouch:0,lean:0,earLb:0,earRb:0,headY:0,sL:0,sR:0});S.lid.hold=0;await w(200);}
  };
  const flickEar=l=>{const a=l?eL:eR;a[0].v+=(l?-1:1)*rnd(200,300);};
  const idleBeat=()=>{
    const r=Math.random();
    if(r<.28){const d=Math.random()<.5?-1:1;look(d*rnd(.6,.95),rnd(-.25,.1),.6,.3);setTimeout(()=>blink(),170);setTimeout(()=>look(0,0,.5,.2),rnd(1000,1800));}
    else if(r<.46){flickEar(Math.random()<.5);if(Math.random()<.5)setTimeout(()=>flickEar(Math.random()<.5),180);}
    else if(r<.68){const d=Math.random()<.5?-1:1;set({bodyX:d*18,lean:d*4,crouch:.012,headR:d*-3});wagAmpT=7;setTimeout(()=>{set({bodyX:0,lean:0,crouch:0,headR:0});wagAmpT=0;},rnd(1800,2800));}  // weight shift
    else if(r<.82){look(rnd(-.4,.4),-.55,.5,.2);set({earLb:-6,earRb:6});setTimeout(()=>{look(0,0,.4,.1);set({earLb:0,earRb:0});},rnd(900,1400));}
    else {set({headR:rnd(-6,6),shr:-3});setTimeout(()=>set({headR:0,shr:0}),1800);flickEar(Math.random()<.5);}
  };
  const draw=()=>{
    const idle=state==='Sleep'?.55:calm;
    const br=Math.sin(time*1.7)*idle, br2=Math.sin(time*1.7-.8)*idle, wt=Math.sin(time*.55)*idle;
    // spine: breathing opens the chest, the top follows with a delay
    const sa=sp.map((s,i)=>s.x+br*(i>=2?.9:.25)+wt*(i<3?.7:1.1));
    spine.solve(sa);
    const sy=1-S.crouch.x+br*.016, sx=1+S.crouch.x*.7-br*.007;
    const root=M().translate(OX,OY).scale(K,K).translate(G.spine.P[0]+S.bodyX.x+wt*9,G.spine.P[1]+S.bodyY.x).scale(sx,sy).translate(-G.spine.P[0],-G.spine.P[1]);
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);
    ctx.save();ctx.setTransform(K,0,0,K,OX,OY);const sh=1-Math.min(.35,Math.max(-.35,-S.bodyY.x/90));
    const gr=ctx.createRadialGradient(G.shadow[0]+S.bodyX.x*.6,G.shadow[1],4,G.shadow[0]+S.bodyX.x*.6,G.shadow[1],G.shadow[2]*sh);
    gr.addColorStop(0,'rgba(10,6,2,.30)');gr.addColorStop(1,'rgba(10,6,2,0)');ctx.fillStyle=gr;
    ctx.save();ctx.translate(G.shadow[0],G.shadow[1]);ctx.scale(1,.14);ctx.translate(-G.shadow[0],-G.shadow[1]);ctx.fillRect(G.shadow[0]-G.shadow[2]*1.2,G.shadow[1]-G.shadow[2]*1.2,G.shadow[2]*2.4,G.shadow[2]*2.4);ctx.restore();ctx.restore();
    const stripDraw=(name,ch,mat0,i)=>{
      const fr=mat0.multiply(ch.frame(i));ctx.save();ctx.setTransform(fr);ctx.beginPath();
      const x0=i===0?-4000:i*ch.seg-1,x1=i===ch.n-1?4000:(i+1)*ch.seg+ch.seg*.85;ctx.rect(x0,-4000,x1-x0,8000);ctx.clip();
      const m=meta[name];ctx.setTransform(mat0.multiply(ch.strip(i)));ctx.drawImage(img[name],m[0],m[1],m[2],m[3]);ctx.restore();};
    // tail on the hip
    const hipM=root.multiply(spine.strip(G.hipStrip));
    const tws=Math.sin(time*wagRate)*wagAmp;
    const exc=-(S.bodyX.v*.06+S.lean.v*.12+S.yaw.v*.02);
    tl.forEach((s,i)=>{s.t=i===0?S.tailB.x+tws+exc*5+Math.sin(time*1.25-.9)*5*idle+wt*-3.5:tl[i-1].x*.82+(i>1?tws*.07:0)+Math.sin(time*1.25-.9-i*.6)*1.4*idle;});
    tail.solve(tl.map(s=>s.x));
    for(let i=0;i<tail.n;i++)stripDraw('tail',tail,hipM,i);
    for(let i=0;i<spine.n;i++)stripDraw('torso',spine,root,i);
    // arms hang from the shoulders (spine strip 5), so chest motion, shrug and lean carry them
    const shM=root.multiply(spine.strip(G.shoulderStrip));
    const shrug=S.shr.x+br2*-3.2, sw=-(S.lean.v*.35+S.bodyX.v*.08);
    const armJ=(a,sgn,s,c,wv)=>a.forEach((j,i)=>{
      const lift=i===0?s*sgn:0, elbow=(i===2?.3:i===3?.4:i===4?.3:0)*c*sgn, wrist=i===5?(.12*c*sgn):0;
      j.t=lift+elbow+wrist+(i<=1?shrug*sgn*(i===0?1:.4):0)+sw*sgn*(i+1)*.25+(i>=2&&i<=4?wv*sgn*Math.sin(time*9-i*.7)*(i===3?1:.6):0)+Math.sin(time*1.7-i*.4)*.9*idle*sgn;});
    armJ(aL,1,S.sL.x,S.cL.x,waveL);armJ(aR,-1,S.sR.x,S.cR.x,waveR);
    armL.solve(aL.map(j=>j.x));armR.solve(aR.map(j=>j.x));
    const armsDraw=()=>{for(let i=0;i<armL.n;i++)stripDraw('armL',armL,shM,i);for(let i=0;i<armR.n;i++)stripDraw('armR',armR,shM,i);};
    const raised=Math.max(Math.abs(S.sL.x),Math.abs(S.sR.x),Math.abs(S.cL.x),Math.abs(S.cR.x));
    front=raised>14?1:0;
    if(!front)armsDraw();
    // head
    const neck=G.neck, headBase=root.multiply(spine.strip(spine.n-1));
    const yawN=S.yaw.x+Math.sin(time*.9+1)*1.4*idle, hy=S.headY.x-br2*5.5, hr=S.headR.x+Math.sin(time*.7)*1.3*idle-wt*1.4+S.yaw.x*.08;
    const headM=headBase.translate(neck[0]+yawN,neck[1]+hy).rotate(hr).scale(1-Math.abs(yawN)*.0016,1+br2*.008).translate(-neck[0],-neck[1]);
    const he=-(S.yaw.v*.07+S.headR.v*.16+S.lean.v*.15+S.bodyY.v*.014);
    eL.forEach((s,i)=>{s.t=i===0?S.earLb.x+he*.9+Math.sin(time*.8)*2.6*idle:eL[i-1].x*.72+(i===1?-4:0)*(1-Math.abs(S.earLb.x)/25);});
    eR.forEach((s,i)=>{s.t=i===0?S.earRb.x+he*.9+Math.sin(time*.8+2)*2.6*idle:eR[i-1].x*.72+(i===1?4:0)*(1-Math.abs(S.earRb.x)/25);});
    earL.solve(eL.map(s=>s.x));earR.solve(eR.map(s=>s.x));
    for(let i=0;i<earL.n;i++)stripDraw('earL',earL,headM,i);
    for(let i=0;i<earR.n;i++)stripDraw('earR',earR,headM,i);
    const hm=meta.head;ctx.setTransform(headM);ctx.drawImage(img.head,hm[0],hm[1],hm[2],hm[3]);
    ['L','R'].forEach(k=>{
      const e=meta.eye[k],m=meta['iris'+k];
      ctx.save();ctx.setTransform(headM);ctx.beginPath();ctx.ellipse(e[0],e[1],e[2],e[3],0,0,Math.PI*2);ctx.clip();
      ctx.drawImage(img['iris'+k],m[0]+S.gx.x*G.gaze[0],m[1]+S.gy.x*G.gaze[1],m[2],m[3]);
      const l=Math.max(0,Math.min(1,S.lid.x));
      if(l>.01){const lm=meta['lid'+k];ctx.beginPath();ctx.rect(lm[0],lm[1],lm[2],lm[3]*l*.85);ctx.clip();ctx.drawImage(img['lid'+k],lm[0],lm[1],lm[2],lm[3]);}
      ctx.restore();});
    if(front)armsDraw();
  };
  const loop=now=>{if(dead)return;requestAnimationFrame(loop);if(paused||ready<names.length){tPrev=now;return;}
    const dt=Math.min(.033,(now-tPrev)/1000);tPrev=now;time+=dt;
    wagAmp+=(wagAmpT-wagAmp)*Math.min(1,dt*5);waveL+=(waveLT-waveL)*Math.min(1,dt*6);waveR+=(waveRT-waveR)*Math.min(1,dt*6);
    for(let s=0;s<2;s++){const h=dt/2;for(const k in S)stepSpr(S[k],h);
      sp.forEach((j,i)=>{j.t=S.lean.x*[.05,.12,.18,.25,.2,.2][i]*1.3+(i>0?sp[i-1].x*.3:0);stepSpr(j,h);});
      [tl,eL,eR,aL,aR].forEach(a=>a.forEach(j=>stepSpr(j,h)));}
    if(!busy&&time>idleAt&&state==='Idle'){idleBeat();idleAt=time+rnd(1.8,4);}
    if(time>blinkAt&&state!=='Sleep'&&state!=='HiddenPassword'){blink(Math.random()<.2);blinkAt=time+rnd(2.2,5);if(Math.random()<.2)setTimeout(blink,250);}
    draw();};
  requestAnimationFrame(loop);
  return{
    kind:'puppet',el:box,
    setState(name){
      box.dataset.state=name;const prev=state;state=name;
      run(async w=>{busy=true;
        if(prev==='HiddenPassword'){set({sL:50,sR:50,cL:60,cR:60});await w(260);set({lid:.4});S.lid.hold=0;set({sL:0,sR:0,cL:0,cR:0,shr:0});await w(420);}   // hands come down first
        else if(prev!==name){set({crouch:.012,headY:-3});await w(110);}
        const fn=SEQ[name]||SEQ[ALIAS[name]]||SEQ.Idle;
        if(!HIDE.includes(name)&&!HIDE.includes(ALIAS[name]||''))calm=1;
        if(prev==='Sleep'){S.lid.hold=0;set({lid:0});}
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
