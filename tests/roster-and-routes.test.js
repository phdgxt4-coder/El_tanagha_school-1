import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {teachersPage,renderTeacherCards} from '../src/pages/public-pages.js';
import {loginPage} from '../src/pages/auth-pages.js';

test('صفحة المدرسين لا تُنشئ قائمة أسماء محلية وتوضح الاعتماد والموافقة',()=>{
  const html=teachersPage();
  assert.match(html,/data-teacher-directory/u);
  assert.match(html,/اعتمدتهم إدارة المدرسة/u);
  assert.doesNotMatch(html,/أ\. محمود عبد الرحمن/u);
});

test('دليل المدرسين يرمّز الاسم والتخصص قبل وضعهما في HTML',()=>{
  const holder={innerHTML:''};
  renderTeacherCards(holder,[{displayName:'<img src=x onerror=1>',subjectName:'<script>'}]);
  assert.doesNotMatch(holder.innerHTML,/<img src=x/u);
  assert.doesNotMatch(holder.innerHTML,/<script>/u);
  assert.match(holder.innerHTML,/&lt;script&gt;/u);
});

test('نموذج المدرس يطلب موافقة نشر مستقلة ولا يتيح تسجيل الإدارة',()=>{
  const teacher=loginPage('teacher');
  assert.match(teacher,/name="publishConsent"/u);
  assert.match(teacher,/value="yes"/u);
  const admin=loginPage('admin');
  assert.doesNotMatch(admin,/id="register-form"/u);
});

test('ملف المسارات يتضمن تسجيل الإدارة وسير اعتماد المدرسين',()=>{
  const routes=JSON.parse(fs.readFileSync(new URL('../public/manus-routes.json',import.meta.url),'utf8')).routes;
  assert.ok(routes.some(route=>route.path==='/login/admin'));
  assert.ok(routes.some(route=>route.path==='/admin/teacher-requests'));
  assert.ok(routes.some(route=>route.path==='/dashboard'));
});
