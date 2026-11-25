// تنفيذ عمليات الحسابات والإدارة مباشرة على Firestore بدون Cloud Functions.
// كل ثابت أمني تفرضه قواعد Firestore (firestore.rules)، وهذا الملف يطابق أشكال بيانات وظائف Blaze.
import {
  collection, deleteDoc, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, serverTimestamp, setDoc, startAfter, Timestamp, updateDoc, where, writeBatch
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from '../config/firebase-app.js';
import {
  SUBJECTS, normalizeArabicName, normalizePhone, validateClassInput, validateRejectionReason,
  validateRosterRows, validateSubjectInput
} from '../../functions/src/validation.js';
import { cacheInvalidate } from './cache.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_TTL_MS = 15 * 60 * 1000;
const GRADE_ORDER = ['1', '2', '3'];

const db = () => getFirestore(getFirebaseApp());
const me = () => {
  const user = getAuth(getFirebaseApp()).currentUser;
  if (!user) throw Object.assign(new Error('auth/no-current-user'), { code: 'auth/no-current-user' });
  return user;
};
const fail = (code, message) => Object.assign(new Error(message), { code });

function token(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map(byte => ALPHABET[byte % ALPHABET.length]).join('');
}

async function stableId(prefix, ...parts) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('|')));
  return prefix + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 20);
}

function audit(batch, action, extra = {}) {
  batch.set(doc(collection(db(), 'auditLogs')), { action, actorUid: me().uid, ...extra, createdAt: serverTimestamp() });
}

export async function submitAccountRequest(profile) {
  const user = me();
  const database = db();
  const email = String(user.email ?? '').toLowerCase();
  if (!email) throw fail('failed-precondition', 'استخدم حسابًا مسجلًا ببريد إلكتروني.');
  const profileRef = doc(database, 'profiles', user.uid);
  if ((await getDoc(profileRef)).exists()) throw fail('already-exists', 'يوجد ملف حساب بالفعل لهذا المستخدم.');
  const batch = writeBatch(database);
  const base = { uid: user.uid, email, displayName: profile.displayName, phone: profile.phoneKey, createdAt: serverTimestamp(), consentAt: serverTimestamp() };

  if (profile.role === 'teacher') {
    const subject = await getDoc(doc(database, 'subjects', profile.subjectId));
    if (!subject.exists()) throw fail('invalid-argument', 'اختر تخصصًا من القائمة.');
    batch.set(profileRef, { ...base, role: 'teacher_applicant', status: 'pending' });
    batch.set(doc(database, 'teacherApplications', user.uid), {
      uid: user.uid, displayName: profile.displayName, subjectId: profile.subjectId, subjectName: subject.data().name,
      phone: profile.phoneKey, publishConsent: profile.publishConsent === true, status: 'pending',
      submittedAt: serverTimestamp(), emailVerified: user.emailVerified === true
    });
    await batch.commit();
    return { role: 'teacher_applicant', status: 'pending', created: true };
  }
  if (profile.role === 'parent') {
    batch.set(profileRef, { ...base, role: 'parent', status: 'active' });
    await batch.commit();
    return { role: 'parent', status: 'active', created: true };
  }
  const classId = profile.classId;
  const classSnapshot = classId ? await getDoc(doc(database, 'classes', classId)) : null;
  if (!classSnapshot?.exists()) throw fail('invalid-argument', 'الفصل المختار غير موجود.');
  if (classSnapshot.data().grade !== profile.grade) throw fail('invalid-argument', 'الفصل المختار لا يتبع الصف الدراسي المحدد.');
  if ((classSnapshot.data().branch ?? '') !== (profile.branch ?? '')) throw fail('invalid-argument', 'الفصل المختار لا يتبع المسار الدراسي المحدد.');
  const studentId = `STU-${token(10)}`;
  const record = {
    ...base, role: 'student', status: 'active', studentId, grade: profile.grade, branch: profile.branch ?? '',
    classId, className: classSnapshot.data().name ?? '', rosterVerified: false
  };
  if (profile.birthDate) record.birthDate = profile.birthDate;
  batch.set(profileRef, record);
  batch.set(doc(database, 'studentIds', studentId), { uid: user.uid });
  await batch.commit();
  return { role: 'student', status: 'active', created: true };
}

export async function getMyAccountStatus() {
  const user = me();
  const database = db();
  if (!user.emailVerified) {
    await user.reload().catch(() => {});
    if (user.emailVerified) await user.getIdToken(true).catch(() => {});
  }
  const emailVerified = user.emailVerified === true;
  const admin = await getDoc(doc(database, 'admins', user.uid)).catch(() => null);
  if (admin?.exists() && admin.data().active === true) return { role: 'admin', status: 'active', emailVerified, displayName: admin.data().displayName ?? '' };
  const snapshot = await getDoc(doc(database, 'profiles', user.uid));
  if (!snapshot.exists()) return { role: 'none', status: 'none', emailVerified };
  const data = snapshot.data();
  if (data.role === 'teacher_applicant' && emailVerified) {
    const writeBack = writeBatch(database);
    writeBack.update(doc(database, 'teacherApplications', user.uid), { emailVerified: true });
    await writeBack.commit().catch(() => {});
  }
  return { role: data.role, status: data.status, displayName: data.displayName ?? '', emailVerified };
}

export async function listTeacherApplications() {
  const snapshot = await getDocs(query(collection(db(), 'teacherApplications'), where('status', '==', 'pending'), orderBy('submittedAt', 'asc'), limit(100)));
  return {
    applications: snapshot.docs.map(item => {
      const data = item.data();
      return {
        uid: item.id, displayName: data.displayName, subjectName: data.subjectName, publishConsent: data.publishConsent === true,
        submittedAt: data.submittedAt?.toMillis?.() ?? null, emailVerified: data.emailVerified === true
      };
    })
  };
}

export async function approveTeacher(uid) {
  const database = db();
  const application = await getDoc(doc(database, 'teacherApplications', uid));
  if (!application.exists() || application.data().status !== 'pending') throw fail('failed-precondition', 'تمت مراجعة هذا الطلب من قبل.');
  if (application.data().emailVerified !== true) throw fail('failed-precondition', 'يجب توثيق البريد الإلكتروني للمدرس قبل الاعتماد.');
  const data = application.data();
  const batch = writeBatch(database);
  batch.update(doc(database, 'profiles', uid), {
    role: 'teacher', status: 'active', subjectId: data.subjectId, subjectName: data.subjectName, subjectIds: [data.subjectId],
    grades: [], assignedClassIds: [], reviewedAt: serverTimestamp(), reviewedBy: me().uid
  });
  batch.update(doc(database, 'teacherApplications', uid), { status: 'approved', reviewedAt: serverTimestamp(), reviewedBy: me().uid });
  if (data.publishConsent === true) {
    batch.set(doc(database, 'publicTeachers', uid), {
      displayName: data.displayName, subjectId: data.subjectId, subjectName: data.subjectName, published: true, approvedAt: serverTimestamp()
    });
  }
  audit(batch, 'teacher_approved', { teacherUid: uid });
  await batch.commit();
  return { status: 'approved', role: 'teacher', published: data.publishConsent === true };
}

export async function rejectTeacher(uid, reason = '') {
  const database = db();
  let text;
  try { text = validateRejectionReason(reason); } catch (error) { throw fail('invalid-argument', error.message); }
  const batch = writeBatch(database);
  batch.update(doc(database, 'profiles', uid), { status: 'rejected', reviewedAt: serverTimestamp(), reviewedBy: me().uid });
  batch.update(doc(database, 'teacherApplications', uid), { status: 'rejected', rejectionReason: text, reviewedAt: serverTimestamp(), reviewedBy: me().uid });
  audit(batch, 'teacher_rejected', { teacherUid: uid });
  await batch.commit();
  return { status: 'rejected' };
}

/* ---------- ربط ولي الأمر ---------- */
const INVALID_CODE = 'كود الربط غير صالح أو منتهي أو استُخدم من قبل.';
const LAST_CODE_KEY = 'tn:last-parent-code';

export async function issueParentCode() {
  const user = me();
  const database = db();
  const profile = await getDoc(doc(database, 'profiles', user.uid));
  if (!profile.exists() || profile.data().role !== 'student') throw fail('permission-denied', 'إصدار كود الربط متاح للطالب النشط فقط.');
  const code = `TNG-${token(12)}`;
  const batch = writeBatch(database);
  let previous = '';
  try { previous = localStorage.getItem(`${LAST_CODE_KEY}:${user.uid}`) || ''; } catch { previous = ''; }
  if (/^TNG-[A-Z0-9]{8,12}$/u.test(previous)) batch.update(doc(database, 'parentCodes', previous), { active: false });
  batch.set(doc(database, 'parentCodes', code), {
    studentUid: user.uid, studentId: profile.data().studentId, active: true,
    createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + CODE_TTL_MS)
  });
  try { await batch.commit(); } catch (error) {
    if (previous) { // الكود السابق انتهى أو حُذف: أعد المحاولة بدونه.
      const retry = writeBatch(database);
      retry.set(doc(database, 'parentCodes', code), {
        studentUid: user.uid, studentId: profile.data().studentId, active: true,
        createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + CODE_TTL_MS)
      });
      await retry.commit();
    } else throw error;
  }
  try { localStorage.setItem(`${LAST_CODE_KEY}:${user.uid}`, code); } catch { /* التخزين المحلي غير متاح */ }
  return { code, expiresInSeconds: CODE_TTL_MS / 1000 };
}

export async function linkParentToStudent(rawCode) {
  const user = me();
  const database = db();
  const code = String(rawCode ?? '').trim().toUpperCase();
  if (!/^TNG-[A-Z0-9]{8,12}$/u.test(code)) throw fail('not-found', INVALID_CODE);
  let snapshot;
  try { snapshot = await getDoc(doc(database, 'parentCodes', code)); } catch { throw fail('not-found', INVALID_CODE); }
  const data = snapshot.exists() ? snapshot.data() : null;
  if (!data || data.active !== true || !(data.expiresAt?.toMillis?.() > Date.now()) || data.studentUid === user.uid) {
    throw fail('not-found', INVALID_CODE);
  }
  const linkRef = doc(database, 'parentLinks', `${user.uid}_${data.studentUid}`);
  const batch = writeBatch(database);
  batch.update(doc(database, 'parentCodes', code), { active: false, usedBy: user.uid, usedAt: serverTimestamp() });
  batch.set(linkRef, {
    parentUid: user.uid, studentUid: data.studentUid, studentId: data.studentId, status: 'active', active: true,
    createdAt: serverTimestamp(), code
  });
  try { await batch.commit(); } catch { throw fail('not-found', INVALID_CODE); }
  const student = await getDoc(doc(database, 'profiles', data.studentUid)).catch(() => null);
  return { linked: true, studentUid: data.studentUid, displayName: student?.data()?.displayName ?? '' };
}

export async function listLinkedStudents() {
  const user = me();
  const database = db();
  const links = await getDocs(query(collection(database, 'parentLinks'), where('parentUid', '==', user.uid), where('active', '==', true), limit(50)));
  const profiles = await Promise.all(links.docs.map(link => getDoc(doc(database, 'profiles', link.data().studentUid)).catch(() => null)));
  return {
    students: profiles.filter(item => item?.exists() && item.data().role === 'student').map(item => ({
      uid: item.id, displayName: item.data().displayName ?? '', grade: item.data().grade ?? '', branch: item.data().branch ?? '',
      className: item.data().className ?? '', classId: item.data().classId ?? null
    }))
  };
}

async function revokeLink(linkId, status) {
  const database = db();
  const batch = writeBatch(database);
  batch.update(doc(database, 'parentLinks', linkId), { active: false, status, revokedAt: serverTimestamp(), revokedBy: me().uid });
  await batch.commit();
}

export async function unlinkParentFromStudent(studentUid) {
  await revokeLink(`${me().uid}_${studentUid}`, 'unlinked');
  return { unlinked: true };
}

export async function revokeParentLink(linkId) {
  if (!/^[A-Za-z0-9_-]{1,300}$/u.test(String(linkId))) throw fail('invalid-argument', 'معرّف الربط غير صالح.');
  await revokeLink(linkId, 'revoked');
  return { revoked: true };
}

/* ---------- الإدارة ---------- */
function invalidate() { cacheInvalidate('structure:classes'); cacheInvalidate('structure:subjects'); }

export async function adminSaveClass(input) {
  let value;
  try { value = validateClassInput(input); } catch (error) { throw fail('invalid-argument', error.message); }
  const classId = await stableId('c', value.year, value.grade, value.section.toLowerCase() + (value.branch ? '|' + value.branch : ''));
  const batch = writeBatch(db());
  batch.set(doc(db(), 'classes', classId), { ...value, updatedAt: serverTimestamp() }, { merge: true });
  await batch.commit();
  invalidate();
  return { classId };
}

export async function adminDeleteClass(classId) {
  const database = db();
  const [assignments, students] = await Promise.all([
    getDocs(query(collection(database, 'teacherAssignments'), where('classId', '==', classId), limit(1))),
    getDocs(query(collection(database, 'profiles'), where('classId', '==', classId), limit(1)))
  ]);
  if (!assignments.empty || !students.empty) throw fail('failed-precondition', 'لا يمكن حذف فصل مرتبط بطلاب أو بإسنادات مدرسين.');
  const batch = writeBatch(database);
  batch.delete(doc(database, 'classes', classId));
  await batch.commit();
  invalidate();
  return { deleted: true };
}

export async function adminSaveSubject(name, branches = []) {
  let value;
  try { value = validateSubjectInput({ name, branches }); } catch (error) { throw fail('invalid-argument', error.message); }
  const subjectId = await stableId('s', value.name.toLowerCase());
  const batch = writeBatch(db());
  batch.set(doc(db(), 'subjects', subjectId), { ...value, updatedAt: serverTimestamp() }, { merge: true });
  await batch.commit();
  invalidate();
  return { subjectId };
}

export async function adminSeedDefaultSubjects() {
  const batch = writeBatch(db());
  for (const [id, name] of Object.entries(SUBJECTS)) batch.set(doc(db(), 'subjects', id), { name, updatedAt: serverTimestamp() }, { merge: true });
  await batch.commit();
  invalidate();
  return { count: Object.keys(SUBJECTS).length };
}

export async function adminDeleteSubject(subjectId) {
  const used = await getDocs(query(collection(db(), 'teacherAssignments'), where('subjectId', '==', subjectId), limit(1)));
  if (!used.empty) throw fail('failed-precondition', 'لا يمكن حذف مادة مسندة إلى مدرس.');
  const batch = writeBatch(db());
  batch.delete(doc(db(), 'subjects', subjectId));
  await batch.commit();
  invalidate();
  return { deleted: true };
}

async function applyScope(batch, teacherUid, removedId = null, added = null) {
  const database = db();
  const current = await getDocs(query(collection(database, 'teacherAssignments'), where('teacherUid', '==', teacherUid), limit(200)));
  const active = current.docs.filter(item => item.id !== removedId).map(item => item.data());
  if (added) active.push(added);
  batch.update(doc(database, 'profiles', teacherUid), {
    grades: [...new Set(active.map(item => item.grade))].sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b)),
    assignedClassIds: [...new Set(active.map(item => item.classId))],
    subjectIds: [...new Set(active.map(item => item.subjectId))]
  });
}

export async function adminAssignTeacher(teacherUid, subjectId, classId) {
  const database = db();
  const [teacher, subject, classSnapshot] = await Promise.all([
    getDoc(doc(database, 'profiles', teacherUid)), getDoc(doc(database, 'subjects', subjectId)), getDoc(doc(database, 'classes', classId))
  ]);
  if (!teacher.exists() || teacher.data().role !== 'teacher' || teacher.data().status !== 'active') throw fail('failed-precondition', 'الإسناد متاح لمدرس معتمد فقط.');
  if (!subject.exists()) throw fail('not-found', 'المادة غير موجودة.');
  if (!classSnapshot.exists()) throw fail('not-found', 'الفصل غير موجود.');
  const assignmentId = `${teacherUid}_${subjectId}_${classId}`;
  const entry = {
    teacherUid, subjectId, subjectName: subject.data().name, classId, className: classSnapshot.data().name,
    grade: classSnapshot.data().grade, year: classSnapshot.data().year ?? '', teacherName: teacher.data().displayName ?? ''
  };
  const batch = writeBatch(database);
  batch.set(doc(database, 'teacherAssignments', assignmentId), { ...entry, assignedBy: me().uid, assignedAt: serverTimestamp() });
  await applyScope(batch, teacherUid, null, entry);
  audit(batch, 'teacher_assigned', { teacherUid, subjectId, classId });
  await batch.commit();
  return { assignmentId };
}

export async function adminRemoveAssignment(assignmentId) {
  if (!/^[A-Za-z0-9_-]{1,300}$/u.test(String(assignmentId))) throw fail('invalid-argument', 'معرّف الإسناد غير صالح.');
  const database = db();
  const snapshot = await getDoc(doc(database, 'teacherAssignments', assignmentId));
  if (!snapshot.exists()) throw fail('not-found', 'الإسناد غير موجود.');
  const batch = writeBatch(database);
  batch.delete(doc(database, 'teacherAssignments', assignmentId));
  await applyScope(batch, snapshot.data().teacherUid, assignmentId);
  audit(batch, 'teacher_assignment_removed', { teacherUid: snapshot.data().teacherUid, assignmentId });
  await batch.commit();
  return { removed: true };
}

export async function adminImportRoster(inputRows) {
  let rows;
  try { rows = validateRosterRows(inputRows); } catch (error) { throw fail('invalid-argument', error.message); }
  const database = db();
  const ids = [...new Set(rows.map(row => row.classId))];
  const snapshots = await Promise.all(ids.map(id => getDoc(doc(database, 'classes', id))));
  const classes = new Map(snapshots.filter(item => item.exists()).map(item => [item.id, item.data()]));
  if (ids.some(id => !classes.has(id))) throw fail('invalid-argument', 'بعض الفصول في الملف غير موجودة. أنشئها أولًا.');
  const batch = writeBatch(database);
  rows.forEach(row => batch.set(doc(database, 'rosterStudents', row.phoneKey), {
    fullName: row.fullName, fullNameKey: normalizeArabicName(row.fullName), classId: row.classId,
    grade: classes.get(row.classId).grade, claimed: false, importedBy: me().uid, importedAt: serverTimestamp()
  }));
  audit(batch, 'roster_imported', { count: rows.length });
  await batch.commit();
  return { imported: rows.length };
}

export async function listClassStudents(classId, after = '') {
  const pageSize = 30;
  const parts = [where('role', '==', 'student'), where('classId', '==', classId), orderBy('displayName'), limit(pageSize + 1)];
  if (typeof after === 'string' && after) parts.splice(3, 0, startAfter(after.slice(0, 80)));
  const snapshot = await getDocs(query(collection(db(), 'profiles'), ...parts));
  const docs = snapshot.docs.slice(0, pageSize);
  return {
    students: docs.map(item => ({ uid: item.id, displayName: item.data().displayName ?? '' })),
    next: snapshot.docs.length > pageSize ? docs[docs.length - 1].data().displayName : null
  };
}


/* ---------- إدارة الحسابات (للإدارة فقط، لا حذف أبدًا: إيقاف أو نقل أو تخريج) ---------- */
const USER_ROLES = ['student', 'parent', 'teacher'];
const USER_STATUSES = ['active', 'disabled'];
const BATCH_LIMIT = 400;

export async function adminSearchUsers(role, prefix = '') {
  if (!USER_ROLES.includes(role)) throw fail('invalid-argument', 'نوع الحساب غير صالح.');
  const text = String(prefix).trim().slice(0, 60);
  const parts = [where('role', '==', role), orderBy('displayName')];
  if (text) parts.push(where('displayName', '>=', text), where('displayName', '<=', `${text}\uf8ff`));
  const snapshot = await getDocs(query(collection(db(), 'profiles'), ...parts, limit(30)));
  return snapshot.docs.map(item => {
    const data = item.data();
    return { uid: item.id, role: data.role, status: data.status, displayName: data.displayName ?? '', phone: data.phone ?? '', email: data.email ?? '', classId: data.classId ?? '', className: data.className ?? '', grade: data.grade ?? '', branch: data.branch ?? '' };
  });
}

export async function adminSetUserStatus(uid, status) {
  if (!USER_STATUSES.includes(status)) throw fail('invalid-argument', 'الحالة غير صالحة.');
  if (uid === me().uid) throw fail('failed-precondition', 'لا يمكنك إيقاف حسابك.');
  const database = db();
  const snapshot = await getDoc(doc(database, 'profiles', uid));
  if (!snapshot.exists() || !USER_ROLES.includes(snapshot.data().role)) throw fail('not-found', 'الحساب غير موجود.');
  const batch = writeBatch(database);
  batch.update(doc(database, 'profiles', uid), { status, updatedBy: me().uid, updatedAt: serverTimestamp() });
  audit(batch, status === 'disabled' ? 'user_disabled' : 'user_enabled', { targetUid: uid });
  await batch.commit();
  return { status };
}

export async function adminUpdateUser(uid, { displayName, phone }) {
  const name = String(displayName ?? '').trim().replace(/\s+/gu, ' ');
  const phoneKey = normalizePhone(phone);
  if (name.length < 3 || name.length > 80) throw fail('invalid-argument', 'الاسم غير صالح.');
  if (!phoneKey) throw fail('invalid-argument', 'رقم الهاتف غير صالح.');
  const database = db();
  const snapshot = await getDoc(doc(database, 'profiles', uid));
  if (!snapshot.exists() || !['student', 'parent'].includes(snapshot.data().role)) throw fail('not-found', 'الحساب غير موجود أو لا يمكن تعديله من هنا.');
  const batch = writeBatch(database);
  batch.update(doc(database, 'profiles', uid), { displayName: name, phone: phoneKey, updatedBy: me().uid, updatedAt: serverTimestamp() });
  audit(batch, 'user_updated', { targetUid: uid });
  await batch.commit();
  return { updated: true };
}

export async function adminMoveStudent(uid, classId) {
  const database = db();
  const [student, target] = await Promise.all([getDoc(doc(database, 'profiles', uid)), getDoc(doc(database, 'classes', String(classId)))]);
  if (!student.exists() || student.data().role !== 'student') throw fail('not-found', 'الطالب غير موجود.');
  if (!target.exists()) throw fail('not-found', 'الفصل غير موجود.');
  const batch = writeBatch(database);
  batch.update(doc(database, 'profiles', uid), { classId: target.id, className: target.data().name, grade: target.data().grade, branch: target.data().branch ?? '', updatedBy: me().uid, updatedAt: serverTimestamp() });
  audit(batch, 'student_moved', { targetUid: uid, fromClassId: student.data().classId ?? '', toClassId: target.id });
  await batch.commit();
  return { classId: target.id };
}

/** يحوّل كل إسنادات مدرس إلى مدرس آخر (الإسناد القديم يُحذف، حسابا المدرسين لا يُحذفان). */
export async function adminReplaceTeacher(oldUid, newUid) {
  if (!oldUid || !newUid || oldUid === newUid) throw fail('invalid-argument', 'اختر مدرسين مختلفين.');
  const database = db();
  const [oldTeacher, newTeacher, assigned] = await Promise.all([
    getDoc(doc(database, 'profiles', oldUid)), getDoc(doc(database, 'profiles', newUid)),
    getDocs(query(collection(database, 'teacherAssignments'), where('teacherUid', '==', oldUid), limit(150)))
  ]);
  if (!oldTeacher.exists() || oldTeacher.data().role !== 'teacher') throw fail('not-found', 'المدرس الحالي غير موجود.');
  if (!newTeacher.exists() || newTeacher.data().role !== 'teacher' || newTeacher.data().status !== 'active') throw fail('failed-precondition', 'المدرس الجديد لازم يكون معتمدًا ونشطًا.');
  if (assigned.empty) throw fail('failed-precondition', 'المدرس الحالي ليس له إسنادات.');
  const existing = await getDocs(query(collection(database, 'teacherAssignments'), where('teacherUid', '==', newUid), limit(150)));
  const entries = [...existing.docs.map(item => item.data())];
  const batch = writeBatch(database);
  assigned.docs.forEach(item => {
    const old = item.data();
    const entry = { ...old, teacherUid: newUid, teacherName: newTeacher.data().displayName ?? '' };
    delete entry.assignedBy; delete entry.assignedAt;
    batch.set(doc(database, 'teacherAssignments', `${newUid}_${old.subjectId}_${old.classId}`), { ...entry, assignedBy: me().uid, assignedAt: serverTimestamp() });
    batch.delete(item.ref);
    entries.push(entry);
  });
  const scope = list => ({
    grades: [...new Set(list.map(item => item.grade))].sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b)),
    assignedClassIds: [...new Set(list.map(item => item.classId))], subjectIds: [...new Set(list.map(item => item.subjectId))]
  });
  batch.update(doc(database, 'profiles', newUid), scope(entries));
  batch.update(doc(database, 'profiles', oldUid), scope([]));
  audit(batch, 'teacher_replaced', { oldUid, newUid, count: assigned.size });
  await batch.commit();
  return { moved: assigned.size };
}

/** ترقية فصل كامل: لفصل جديد، أو تخريج (الحساب يبقى محفوظًا بحالة graduated). */
export async function adminPromoteClass(fromClassId, toClassId) {
  const database = db();
  const [from, to] = await Promise.all([getDoc(doc(database, 'classes', String(fromClassId))), toClassId ? getDoc(doc(database, 'classes', String(toClassId))) : null]);
  if (!from.exists()) throw fail('not-found', 'الفصل الحالي غير موجود.');
  if (toClassId && !to.exists()) throw fail('not-found', 'الفصل الجديد غير موجود.');
  if (toClassId && to.id === from.id) throw fail('invalid-argument', 'اختر فصلًا مختلفًا.');
  const students = await getDocs(query(collection(database, 'profiles'), where('role', '==', 'student'), where('classId', '==', from.id), limit(BATCH_LIMIT)));
  if (students.empty) throw fail('failed-precondition', 'لا يوجد طلاب في هذا الفصل.');
  const batch = writeBatch(database);
  const stamp = { updatedBy: me().uid, updatedAt: serverTimestamp() };
  students.docs.forEach(item => batch.update(item.ref, toClassId ? { classId: to.id, className: to.data().name, grade: to.data().grade, branch: to.data().branch ?? '', ...stamp } : { status: 'graduated', ...stamp }));
  audit(batch, toClassId ? 'class_promoted' : 'class_graduated', { fromClassId: from.id, toClassId: toClassId || '', count: students.size });
  await batch.commit();
  return { count: students.size, more: students.size === BATCH_LIMIT };
}

/* ---------- ترقية السنة الدراسية: إنشاء فصول السنة الجديدة ونقل الطلاب ---------- */
const YEAR_PATTERN = /^\d{4}-\d{4}$/u;

export async function adminPlanRollover(fromYear, toYear) {
  if (!YEAR_PATTERN.test(String(fromYear)) || !YEAR_PATTERN.test(String(toYear)) || fromYear === toYear) throw fail('invalid-argument', 'اكتب السنتين بصيغة 2026-2027 ومختلفتين.');
  const snapshot = await getDocs(query(collection(db(), 'classes'), where('year', '==', fromYear), limit(100)));
  if (snapshot.empty) throw fail('failed-precondition', 'لا توجد فصول في سنة المصدر.');
  const plan = snapshot.docs.map(item => item.data()).sort((a, b) => String(a.grade).localeCompare(b.grade) || String(a.section).localeCompare(String(b.section), 'ar')).map(item => {
    const next = GRADE_ORDER[GRADE_ORDER.indexOf(String(item.grade)) + 1];
    return { fromYear, fromGrade: item.grade, section: item.section, fromName: item.name, toGrade: next ?? null };
  });
  const intake = snapshot.docs.map(item => item.data()).filter(item => String(item.grade) === '1').map(item => ({ grade: '1', section: item.section }));
  return { plan, intake, toYear };
}

export async function adminRunRollover(fromYear, toYear) {
  const { plan, intake } = await adminPlanRollover(fromYear, toYear);
  const result = { created: 0, moved: 0, graduated: 0, skipped: 0 };
  const idOf = (year, grade, section) => stableId('c', year, grade, String(section).toLowerCase());
  // أولًا الفصول الجديدة (الأعلى أولًا حتى لا يختلط الطلاب)، ثم النقل.
  const wanted = [...plan.filter(item => item.toGrade).map(item => ({ grade: item.toGrade, section: item.section })), ...intake];
  for (const item of wanted) { await adminSaveClass({ grade: item.grade, section: item.section, year: toYear }); result.created += 1; }
  for (const item of [...plan].reverse()) {
    const fromId = await idOf(fromYear, item.fromGrade, item.section);
    const toId = item.toGrade ? await idOf(toYear, item.toGrade, item.section) : '';
    try {
      const done = await adminPromoteClass(fromId, toId);
      if (toId) result.moved += done.count; else result.graduated += done.count;
    } catch (error) { if (error.code === 'failed-precondition') result.skipped += 1; else throw error; }
  }
  return result;
}


/* ---------- المدراء: الأول من Firebase Console، والباقي بدعوة من أدمن نشط ---------- */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/u;

export async function adminInviteAdmin(email) {
  const key = String(email ?? '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(key) || key.length > 254) throw fail('invalid-argument', 'البريد الإلكتروني غير صالح.');
  const database = db();
  const batch = writeBatch(database);
  batch.set(doc(database, 'adminInvites', key), { email: key, createdBy: me().uid, createdAt: serverTimestamp(), claimed: false });
  audit(batch, 'admin_invited', { email: key });
  await batch.commit();
  return { email: key };
}

export async function adminListAdmins() {
  const database = db();
  const [admins, invites] = await Promise.all([
    getDocs(query(collection(database, 'admins'), limit(50))),
    getDocs(query(collection(database, 'adminInvites'), where('claimed', '==', false), limit(50)))
  ]);
  return {
    admins: admins.docs.map(item => ({ uid: item.id, email: item.data().email ?? '', displayName: item.data().displayName ?? '', active: item.data().active === true, self: item.id === me().uid })),
    invites: invites.docs.map(item => ({ email: item.id }))
  };
}

export async function adminSetAdminActive(uid, active) {
  if (uid === me().uid) throw fail('failed-precondition', 'لا يمكنك إيقاف حسابك.');
  const database = db();
  const batch = writeBatch(database);
  batch.update(doc(database, 'admins', uid), { active: active === true });
  audit(batch, active ? 'admin_enabled' : 'admin_disabled', { targetUid: uid });
  await batch.commit();
  return { active: active === true };
}

export async function adminRevokeInvite(email) {
  await deleteDoc(doc(db(), 'adminInvites', String(email).toLowerCase()));
  return { revoked: true };
}

/** يقبل الأدمن الجديد دعوته بعد توثيق بريده. */
export async function claimAdminInvite(displayName) {
  const user = me();
  await user.reload().catch(() => {});
  if (!user.emailVerified) throw fail('failed-precondition', 'وثّق بريدك الإلكتروني أولًا ثم أعد المحاولة.');
  await user.getIdToken(true);
  const database = db();
  const email = String(user.email ?? '').toLowerCase();
  const name = String(displayName ?? '').trim().slice(0, 80) || email;
  const batch = writeBatch(database);
  const inviteRef = doc(database, 'adminInvites', email);
  const invite = await getDoc(inviteRef).catch(() => null);
  if (!invite?.exists() || invite.data().claimed !== false) throw fail('permission-denied', 'لا توجد دعوة إدارة لهذا البريد أو استُخدمت من قبل.');
  batch.update(inviteRef, { claimed: true, claimedBy: user.uid, claimedAt: serverTimestamp() });
  batch.set(doc(database, 'admins', user.uid), { active: true, email, displayName: name, createdBy: invite.data().createdBy, createdAt: serverTimestamp() });
  await batch.commit();
  return { admin: true };
}

export async function sendContactMessage({ name, email, message }) {
  const clean = { name: String(name ?? '').trim().slice(0, 60), email: String(email ?? '').trim().slice(0, 120), message: String(message ?? '').trim().slice(0, 800) };
  if (!clean.name || !clean.message) throw fail('invalid-argument', 'الاسم والرسالة مطلوبان.');
  await setDoc(doc(collection(db(), 'contactMessages')), { ...clean, read: false, createdAt: serverTimestamp() });
}

export async function adminListContactMessages() {
  const snapshot = await getDocs(query(collection(db(), 'contactMessages'), orderBy('createdAt', 'desc'), limit(50)));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data(), createdAt: item.data().createdAt?.toDate?.() ?? null }));
}

export async function adminSetContactRead(id, read) {
  await updateDoc(doc(db(), 'contactMessages', id), { read: read === true });
}

export async function adminDeleteContactMessage(id) {
  await deleteDoc(doc(db(), 'contactMessages', id));
}
