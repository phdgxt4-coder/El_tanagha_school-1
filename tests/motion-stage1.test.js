import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../styles/motion.css',import.meta.url),'utf8');
const reduced=css.slice(css.lastIndexOf('@media(prefers-reduced-motion:reduce)'));
test('new motion pieces are disabled under reduced motion',()=>{
  for(const s of ['.panel-enter','[data-tip]::after','.progress>i','view-transition'])assert.ok(reduced.includes(s),s);
});
test('new keyframes animate only transform and opacity',()=>{
  for(const name of ['panelEnter','vtOut','vtIn']){
    const m=css.match(new RegExp('@keyframes '+name+'\\{[^@]*?\\}\\}?'));
    assert.ok(m,name);
    assert.ok(!/(width|height|top|left|margin|box-shadow)\s*:/.test(m[0]),name);
  }
});
