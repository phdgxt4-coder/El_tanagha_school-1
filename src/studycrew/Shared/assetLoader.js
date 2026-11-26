/* Smart asset loader: one fetch per URL (in-flight dedupe), small LRU cache, size budget check, never throws
   to the caller's page. Used for real art files (.riv, .json, .svg). Characters without files skip it. */
import {CONFIG} from './config.js';
import {log} from './logger.js';
const cache=new Map();      /* url -> {buf,bytes} */
const inflight=new Map();
export class AssetError extends Error{constructor(msg,url){super(msg);this.url=url;}}
const touch=(url,v)=>{cache.delete(url);cache.set(url,v);while(cache.size>CONFIG.cache.maxEntries)cache.delete(cache.keys().next().value);};
export async function loadAsset(url,{type='arrayBuffer',maxBytes=CONFIG.budget.characterFile,fetchImpl=globalThis.fetch}={}){
  if(!url)throw new AssetError('missing url',url);
  if(cache.has(url)){const v=cache.get(url);touch(url,v);return v.data;}
  if(inflight.has(url))return inflight.get(url);
  const p=(async()=>{
    try{
      const res=await fetchImpl(url);
      if(!res.ok)throw new AssetError('http '+res.status,url);
      const len=Number(res.headers?.get?.('content-length')||0);
      if(len&&len>maxBytes)throw new AssetError(`over budget (${len} > ${maxBytes})`,url);
      const data=await res[type]();
      const bytes=data.byteLength??JSON.stringify(data).length;
      if(bytes>maxBytes)throw new AssetError(`over budget (${bytes} > ${maxBytes})`,url);
      touch(url,{data,bytes});log.debug('asset loaded',{url,bytes});return data;
    }catch(err){
      log.warn('asset failed',{url,error:String(err.message||err)});
      throw err instanceof AssetError?err:new AssetError(String(err.message||err),url);
    }finally{inflight.delete(url);}
  })();
  inflight.set(url,p);return p;
}
/* warm the cache without blocking; failures are swallowed (logged) */
export function preloadAssets(urls,opts){
  const run=()=>Promise.allSettled(urls.map(u=>loadAsset(u,opts)));
  if(CONFIG.preload.onIdle&&typeof requestIdleCallback==='function')requestIdleCallback(run);else setTimeout(run,0);
}
export const clearAssetCache=()=>{cache.clear();inflight.clear();};
export const assetCacheSize=()=>cache.size;
