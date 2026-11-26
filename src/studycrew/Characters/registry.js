/* The only list of characters. To add one: create Characters/<Name>/ with manifest.js + index.js, add one line here.
   Loaders are dynamic imports so each character is its own lazy chunk and is loaded only when needed. */
export const characterLoaders={
  alex:()=>import('./Alex/index.js'),
  arthur:()=>import('./Arthur/index.js'),
  oscar:()=>import('./Oscar/index.js'),
  leo:()=>import('./Leo/index.js'),
  chloe:()=>import('./Chloe/index.js')
};
export const characterIds=()=>Object.keys(characterLoaders);
