/* Celebration burst for positive events only. DOM particles animated with transform and opacity.
   Skipped entirely under prefers-reduced-motion. Lazy loaded. */
const COLORS=['#e4bf63','#c9a24b','#f3dc9c','#2dd4bf','#818cf8','#fb923c'];
export function celebrate(anchor,count=22){
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const rect=(anchor?.getBoundingClientRect?.())||{left:innerWidth/2,top:innerHeight/3,width:0,height:0};
  const cx=rect.left+rect.width/2,cy=rect.top+Math.min(rect.height/2,40);
  const layer=document.createElement('div');
  layer.setAttribute('aria-hidden','true');
  layer.style.cssText='position:fixed;inset:0;z-index:90;pointer-events:none;overflow:hidden';
  const pieces=[];
  for(let i=0;i<count;i++){
    const el=document.createElement('i');
    const size=6+Math.random()*7;
    const round=i%3===0;
    el.style.cssText=`position:absolute;left:${cx}px;top:${cy}px;width:${size}px;height:${round?size:size*1.6}px;border-radius:${round?'50%':'2px'};background:${COLORS[i%COLORS.length]};will-change:transform,opacity`;
    layer.append(el);
    pieces.push(el);
  }
  document.body.append(layer);
  let done=0;
  pieces.forEach((el,i)=>{
    const angle=-Math.PI/2+(Math.random()-.5)*Math.PI*1.1;
    const power=90+Math.random()*130;
    const x=Math.cos(angle)*power,y=Math.sin(angle)*power;
    const anim=el.animate([
      {transform:'translate3d(0,0,0) rotate(0deg) scale(.6)',opacity:1},
      {transform:`translate3d(${x}px,${y}px,0) rotate(${Math.random()*360}deg) scale(1)`,opacity:1,offset:.45},
      {transform:`translate3d(${x*1.25}px,${y+170}px,0) rotate(${Math.random()*720}deg) scale(.9)`,opacity:0}
    ],{duration:1100+Math.random()*500,easing:'cubic-bezier(.2,.7,.3,1)',delay:i*8,fill:'forwards'});
    anim.onfinish=()=>{if(++done===pieces.length)layer.remove();};
  });
  setTimeout(()=>layer.remove(),2800);
}
