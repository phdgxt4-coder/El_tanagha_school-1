#!/usr/bin/env node
/* Study Crew asset check. Lists every art/sound file under src/studycrew, checks the size budget and the
   allowed extensions, and prints optimization advice. Exit code 1 when a budget is broken.
   Usage: node scripts/crew-assets.mjs */
import {readdirSync,statSync} from 'node:fs';
import {join,extname,relative} from 'node:path';
import {CONFIG} from '../src/studycrew/Shared/config.js';
const root=new URL('../src/studycrew',import.meta.url).pathname;
const SKIP=['.js','.md','.css'];
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const files=walk(root).filter(f=>!SKIP.includes(extname(f)));
let bad=0;
const kb=n=>(n/1024).toFixed(1)+' KB';
const perChar={};
for(const f of files){
  const ext=extname(f).toLowerCase(),size=statSync(f).size,rel=relative(root,f);
  const isSound=rel.startsWith('Sounds'),limit=isSound?CONFIG.budget.soundFile:CONFIG.budget.characterFile;
  const problems=[];
  if(!CONFIG.assetExtensions.includes(ext))problems.push('extension not allowed');
  if(size>limit)problems.push(`over budget (${kb(size)} > ${kb(limit)})`);
  const m=rel.match(/^Characters\/([^/]+)\//);if(m)perChar[m[1]]=(perChar[m[1]]||0)+size;
  console.log(`${problems.length?'FAIL':'ok  '} ${rel} ${kb(size)} ${problems.join(', ')}`);
  if(problems.length)bad++;
}
for(const [c,n] of Object.entries(perChar))if(n>CONFIG.budget.firstLoadCharacter*3){console.log(`WARN ${c}: ${kb(n)} total, lazy load only; first-load budget is ${kb(CONFIG.budget.firstLoadCharacter)}`);}
if(!files.length)console.log('No art files yet: characters use the code-drawn placeholder (0 bytes of assets).');
console.log(`\nChecked ${files.length} file(s). Budget: character file ${kb(CONFIG.budget.characterFile)}, sound ${kb(CONFIG.budget.soundFile)}.`);
console.log('Optimization tips (not run by this script, no dependency added):\n- SVG: svgo --multipass; remove metadata, round to 1 decimal.\n- Lottie: lottie-optimize / remove unused layers, keep under 60 KB per clip.\n- Rive: one .riv per character, export without editor-only data, check size here.\n- Audio: mono, 22 kHz, mp3 or ogg, under the sound budget (current sounds are synthesized, 0 bytes).');
process.exit(bad?1:0);
