/* Quiet logger. Never throws. Keeps the last entries in memory for the dev page and tests. */
import {CONFIG} from './config.js';
const LEVELS={debug:0,info:1,warn:2,error:3,silent:4};
const buffer=[];
let sink=null;
export const setLogSink=fn=>{sink=fn;};
export const getLog=()=>buffer.slice();
export const clearLog=()=>{buffer.length=0;};
function emit(level,msg,data){
  try{
    const entry={level,msg,data,at:Date.now()};
    buffer.push(entry);if(buffer.length>100)buffer.shift();
    sink?.(entry);
    if(LEVELS[level]>=LEVELS[CONFIG.logLevel]&&typeof console!=='undefined')console[level==='debug'?'log':level](CONFIG.logPrefix,msg,data??'');
  }catch{}
}
export const log={debug:(m,d)=>emit('debug',m,d),info:(m,d)=>emit('info',m,d),warn:(m,d)=>emit('warn',m,d),error:(m,d)=>emit('error',m,d)};
