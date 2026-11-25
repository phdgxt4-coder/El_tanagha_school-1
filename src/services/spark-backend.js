// تنفيذ عمليات الحسابات والإدارة مباشرة على Firestore بدون Cloud Functions.
// كل ثابت أمني تفرضه قواعد Firestore (firestore.rules)، وهذا الملف يطابق أشكال بيانات وظائف Blaze.
import {
  collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, serverTimestamp, startAfter, Timestamp, where, writeBatch
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
  const base = { uid: user.uid, email, displayName: profile.displayName, phone: profile.phoneKey, createdAt: serverTimestamp() };

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
  if (admin?.exists() && admin.data().active === true) return { role: 'admin', status: 'active', emailVerified };
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
  const classId = await stableId('c', value.year, value.grade, value.section.toLowerCase());
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

export async function adminSaveSubject(name) {
  let value;
  try { value = validateSubjectInput({ name }); } catch (error) { throw fail('invalid-argument', error.message); }
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

