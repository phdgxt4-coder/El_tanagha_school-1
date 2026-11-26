/* Central character manager. Loads a character lazily, mounts it, wires state machine, idle scheduler,
   eye tracking, slot rules and the animation manager, and tears everything down on destroy().
   Every failure degrades to a static placeholder or to "nothing shown"; the page never breaks. */
import {characterLoaders} from '../Characters/registry.js';
import {createStateMachine} from './stateMachine.js';
import {createIdlePicker,createIdleScheduler} from './idleScheduler.js';
import {idlePool} from './idles.js';
import {createRenderer} from './adapters.js';
import {registerController,unregisterController,shouldRunIdle} from './animationManager.js';
import {claimSlot,releaseSlot} from './slots.js';
import {trackEyes} from './eyeTracker.js';
import {playSound} from './audio.js';
import {haptic} from './haptics.js';
import {reducedMotion,coarsePointer} from './prefs.js';
import {CONFIG} from './config.js';
import {log} from './logger.js';
const manifests=new Map();
export async function loadManifest(id){
  if(manifests.has(id))return manifests.get(id);
  const loader=characterLoaders[id];
  if(!loader)throw new Error('unknown character '+id);
  const mod=await loader();
  manifests.set(id,mod.default);return mod.default;
}
export const unloadManifest=id=>manifests.delete(id);
const FALLBACK={id:'fallback',name:'Study Crew',shape:'book',palette:{main:'#c9a24b',accent:'#f3dc9c',ink:'#10141c'},idles:[],speed:1,renderer:{}};
const SOUND_FOR={Success:'success',Celebrate:'celebrate',Error:'error'};
const HAPTIC_FOR={Success:'success',Celebrate:'success',Error:'error'};
export async function mountCharacter(host,id,{slot=CONFIG.slots.main,priority=0,tracking=true,idle=true,state='Idle',sound=true,onPreempt}={}){
  let manifest;
  try{manifest=await loadManifest(id);}
  catch(err){log.error('character failed to load, using fallback',{id,error:String(err.message||err)});manifest=FALLBACK;}
  const owner=Symbol(id);
  let destroyed=false;
  if(!claimSlot(slot,owner,priority,()=>{if(!destroyed){controller.destroy();onPreempt?.();}})){log.info('slot busy, not shown',{id,slot});return null;}
  const wrap=document.createElement('div');wrap.className='sc-host';wrap.dataset.character=manifest.id;host.append(wrap);
  const renderer=await createRenderer(wrap,manifest,{reduced:reducedMotion,onError:e=>log.warn('renderer fallback to placeholder',{id,error:String(e.message||e)})});
  const machine=createStateMachine({initial:state,onChange:(next,prev)=>{
    renderer.setState(next);
    if(sound&&SOUND_FOR[next])playSound(manifest.id,SOUND_FOR[next]);
    if(HAPTIC_FOR[next])haptic(HAPTIC_FOR[next]);
    log.debug('state',{id:manifest.id,from:prev,to:next});
  }});
  renderer.setState(state);
  const scheduler=createIdleScheduler({picker:createIdlePicker({pool:idlePool(manifest.idles)}),play:c=>renderer.play(c.recipe||(c.escalation==='wave'?'tilt':'hop')),canRun:()=>machine.state==='Idle'&&shouldRunIdle()});
  if(idle&&!reducedMotion())scheduler.start();
  const stopTrack=tracking&&!coarsePointer()?trackEyes(wrap,(x,y)=>renderer.look(x,y)):()=>{};
  const controller={
    id:manifest.id,manifest,el:wrap,
    get state(){return machine.state;},
    request(s,opts){const ok=machine.request(s,opts);if(ok)scheduler.interact();return ok;},
    finish:s=>machine.finish(s),
    pause(){renderer.pause();scheduler.stop();},
    resume(){renderer.resume();if(idle&&!reducedMotion())scheduler.start();},
    destroy(){
      if(destroyed)return;destroyed=true;
      scheduler.stop();stopTrack();machine.destroy();unregisterController(controller);releaseSlot(slot,owner);
      try{renderer.destroy();}catch(e){log.warn('renderer destroy failed',{error:String(e)});}
      wrap.remove();
    }
  };
  if(!registerController(controller)){destroyed=true;scheduler.stop();stopTrack();machine.destroy();releaseSlot(slot,owner);renderer.destroy();wrap.remove();return null;}
  return controller;
}
