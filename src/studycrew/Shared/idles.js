/* Idle catalogue: 12 shared + 20 per character. Each id maps to a "recipe", a tiny transform/opacity motion
   the placeholder renderer can play. Real Rive/Lottie art implements the same ids as named animations. */
export const SHARED_IDLES=[
  ['breathe','breath'],['blink','blink'],['double-blink','blink2'],['slow-blink','blinkSlow'],['look-left','lookL'],['look-right','lookR'],
  ['look-up','lookU'],['look-down','lookD'],['smile','smile'],['head-tilt','tilt'],['shoulder-settle','settle'],['glance-user','glance']
].map(([id,recipe],i)=>({id,recipe,weight:id==='breathe'?0:3,shared:true}));
/* breathe is a permanent layer, not a pickable clip; weight 0 keeps it out of the draw */
export const idlePool=(own)=>[...SHARED_IDLES.filter(c=>c.weight>0),...own.map(([id,recipe,big])=>({id,recipe,big:!!big,weight:big?1:2}))];
