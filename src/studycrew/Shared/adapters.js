/* Adapters for real art. Both load their runtime lazily from a URL you configure, so the main bundle never
   contains Rive (WASM) or Lottie. Until a manifest sets renderer.rive / renderer.lottie, createRenderer falls back
   to the placeholder. UNTESTED against real runtimes: no Rive or Lottie asset exists yet.
   Interface every renderer implements: { kind, el, setState(name), play(recipe), look(x,y), pause(), resume(), destroy() } */
import {createPlaceholder} from './placeholder.js';
import {createImageRenderer} from './image-renderer.js';
export class RendererUnavailable extends Error{}
const load=async url=>{
  if(!url)throw new RendererUnavailable('no runtime url configured');
  return import(/* @vite-ignore */ url);
};
async function riveRenderer(host,manifest,cfg){
  const mod=await load(cfg.runtimeUrl);
  const canvas=document.createElement('canvas');canvas.className='sc-char';canvas.setAttribute('aria-hidden','true');host.append(canvas);
  const Rive=mod.Rive||mod.default?.Rive;
  if(!Rive)throw new RendererUnavailable('Rive export missing');
  const inst=new Rive({src:cfg.src,canvas,stateMachines:cfg.stateMachine||'Crew',autoplay:true});
  return{kind:'rive',el:canvas,setState(n){inst.setTextRunValue?.('state',n);inst.stateMachineInputs?.(cfg.stateMachine||'Crew')?.find(i=>i.name==='state')&&0;},play(){},look(x,y){const ins=inst.stateMachineInputs?.(cfg.stateMachine||'Crew')||[];const ix=ins.find(i=>i.name==='lookX'),iy=ins.find(i=>i.name==='lookY');if(ix)ix.value=x;if(iy)iy.value=y;},pause(){inst.pause?.();},resume(){inst.play?.();},destroy(){try{inst.cleanup?.();}catch{}canvas.remove();}};
}
async function lottieRenderer(host,manifest,cfg){
  const mod=await load(cfg.runtimeUrl);
  const lottie=mod.default||mod;
  const box=document.createElement('div');box.className='sc-char';box.setAttribute('aria-hidden','true');host.append(box);
  const anim=lottie.loadAnimation({container:box,renderer:'svg',loop:true,autoplay:true,path:cfg.src});
  return{kind:'lottie',el:box,setState(n){const seg=cfg.segments?.[n];if(seg)anim.playSegments(seg,true);},play(){},look(){},pause(){anim.pause();},resume(){anim.play();},destroy(){anim.destroy();box.remove();}};
}
export async function createRenderer(host,manifest,opts){
  const r=manifest.renderer||{};
  try{
    if(r.image)return createImageRenderer(host,manifest,r.image,opts);
    if(r.rive)return await riveRenderer(host,manifest,r.rive);
    if(r.lottie)return await lottieRenderer(host,manifest,r.lottie);
  }catch(err){
    opts?.onError?.(err);
  }
  return createPlaceholder(host,manifest,opts);
}
