import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {trackOptions,needsTrack,classState,canSubmitStudent} from '../src/utils/registration-logic.js';
import {loginPage} from '../src/pages/auth-pages.js';
const classes=[{id:'c1',grade:'1',branch:'',section:'أ'},{id:'c2',grade:'2',branch:'bac_med',section:'أ'},{id:'c3',grade:'3',branch:'science',section:'ب'}];
test('tracks are static: grade 1 none, 2 has 4, 3 has 3',()=>{
  assert.equal(trackOptions('1').length,0);assert.equal(trackOptions('2').length,4);assert.equal(trackOptions('3').length,3);
  assert.equal(needsTrack('1'),false);assert.equal(needsTrack(''),false);
});
test('class state walks grade -> track -> load -> options',()=>{
  assert.equal(classState({grade:''}).status,'pick-grade');
  assert.equal(classState({grade:'2'}).status,'pick-track');
  assert.equal(classState({grade:'1',load:'loading'}).status,'loading');
  assert.equal(classState({grade:'1',load:'error'}).status,'unavailable');
  const s=classState({grade:'1',load:'ready',classes});assert.equal(s.status,'ready');assert.deepEqual(s.options,[{id:'c1',label:'أ'}]);
});
test('no matching classes gives a clear message and blocks submit',()=>{
  const s=classState({grade:'2',branch:'bac_eng',load:'ready',classes});
  assert.equal(s.status,'empty');assert.match(s.message,/لا توجد فصول متاحة/);assert.equal(canSubmitStudent(s,''),false);
});
test('submit only with a real listed classId',()=>{
  const s=classState({grade:'3',branch:'science',load:'ready',classes});
  assert.equal(canSubmitStudent(s,'c3'),true);assert.equal(canSubmitStudent(s,'c1'),false);assert.equal(canSubmitStudent(s,'1/أ'),false);
});
test('a class from another track is never offered',()=>{assert.equal(classState({grade:'2',branch:'bac_biz',load:'ready',classes}).status,'empty');});
test('form has no manual class field and clear labels',()=>{
  const html=loginPage('student');
  assert.doesNotMatch(html,/name="className"|data-class-fallback/);
  assert.match(html,/الشعبة \/ المسار/);assert.match(html,/الفصل \(أ، ب، ج\)/);
});
test('track select does not depend on Firebase: set up before the auth service import',()=>{
  const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  const init=app.slice(app.indexOf('function initializeAuthPage'));
  // firebase-env is a tiny static import now; the heavy dependency that must stay after the
  // synchronous select setup is the auth service (pulls the Firebase SDK chunks).
  assert.ok(init.indexOf('setupRegistrationSelects(')<init.indexOf("import('./auth/auth-service.js')"));
});
