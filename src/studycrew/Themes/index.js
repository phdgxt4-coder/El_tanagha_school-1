/* Theme system. A theme is a partial token object merged over the base tokens.
   Add a theme with registerTheme('name',{color:{...}}); no other file changes. */
import {tokens,tokenVars,applyTokens} from './tokens.js';
const themes=new Map();
const merge=(a,b)=>{const o={...a};for(const [k,v] of Object.entries(b||{}))o[k]=v&&typeof v==='object'&&!Array.isArray(v)?merge(a[k]||{},v):v;return o;};
export const registerTheme=(name,overrides)=>{themes.set(name,overrides);};
registerTheme('dark',{});
registerTheme('light',{color:tokens.colorLight});
export const themeNames=()=>[...themes.keys()];
export const themeTokens=name=>merge(tokens,themes.get(name)||{});
export function setTheme(name,root=document.documentElement){
  if(!themes.has(name))return false;
  applyTokens(root,themeTokens(name));
  root.dataset.scTheme=name;
  return true;
}
export {tokens,tokenVars,applyTokens};
