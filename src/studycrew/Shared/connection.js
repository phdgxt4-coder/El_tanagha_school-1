/* Offline behavior: watches the browser's online state and calls back with 'offline' or 'online'.
   The Leo "dim then recover" scene is built in components.js (NotificationCharacter + connectionBanner). */
import {log} from './logger.js';
export function watchConnection(onChange,{target=globalThis,isOnline=()=>globalThis.navigator?.onLine!==false}={}){
  let last=isOnline()?'online':'offline';
  const set=s=>{if(s!==last){last=s;log.info('connection',{state:s});onChange(s);}};
  const on=()=>set(isOnline()?'online':'offline');
  target.addEventListener?.('online',on);target.addEventListener?.('offline',on);
  return()=>{target.removeEventListener?.('online',on);target.removeEventListener?.('offline',on);};
}
