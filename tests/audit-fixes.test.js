import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('move-student always writes branch; rules require class branch equal to profile branch and a valid grade/branch pair',()=>{
  const spark=read('../src/services/spark-backend.js');
  assert.match(spark,/branch: target\.data\(\)\.branch \?\? ''/);
  assert.doesNotMatch(spark,/\.\.\.\(target\.data\(\)\.branch \?/);
  const rules=read('../firestore.rules');
  assert.doesNotMatch(rules,/classes\/\$\(.*\)\)\.data\.get\('branch', ''\) in \[''/);
  assert.match(rules,/request\.resource\.data\.grade == '1' && request\.resource\.data\.get\('branch', ''\) == ''/);
});
test('registration in Spark rejects a class whose branch differs, including branchless class with a branch',()=>{
  assert.match(read('../src/services/spark-backend.js'),/\(classSnapshot\.data\(\)\.branch \?\? ''\) !== \(profile\.branch \?\? ''\)/);
});
