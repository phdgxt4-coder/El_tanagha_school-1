import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('only teachers wait for admin approval; student and parent are active after email verification',()=>{
  const spark=read('../src/services/spark-backend.js');
  assert.match(spark,/role: 'teacher_applicant', status: 'pending'/);
  assert.match(spark,/role: 'parent', status: 'active'/);
  assert.match(spark,/role: 'student', status: 'active'/);
  const rules=read('../firestore.rules');
  assert.match(rules,/data\.role == 'parent' && data\.status == 'active'/);
  assert.match(rules,/data\.role == 'teacher_applicant' && data\.status == 'pending'/);
  assert.match(rules,/data\.role == 'student' && data\.status == 'active'/);
});
test('every role in the rules needs a verified email, and the dashboard asks non-admins to verify',()=>{
  const rules=read('../firestore.rules');
  assert.match(rules,/function hasRole\(role\)[\s\S]*?request\.auth\.token\.email_verified == true/);
  assert.match(read('../src/pages/dashboard-pages.js'),/account\.role!=='admin'&&account\.emailVerified!==true/);
});
