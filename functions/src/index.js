import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { createHash, randomInt } from 'node:crypto';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  InputValidationError, SUBJECTS, normalizeArabicName, validateAccountRequest, validateClassInput,
  validateRejectionReason, validateRosterRows, validateSubjectInput
} from './validation.js';

if (getApps().length === 0) initializeApp();
const db = getFirestore();
const adminAuth = getAuth();
const ADMIN_COLLECTION = 'admins';
const PROFILE_COLLECTION = 'profiles';
const APPLICATION_COLLECTION = 'teacherApplications';
const PUBLIC_TEACHER_COLLECTION = 'publicTeachers';
const PARENT_CODE_COLLECTION = 'parentCodes';
const PARENT_LINK_COLLECTION = 'parentLinks';
const AUDIT_LOG_COLLECTION = 'auditLogs';
const REGION = 'us-central1';
const CLASS_COLLECTION = 'classes';
const SUBJECT_COLLECTION = 'subjects';
const ASSIGNMENT_COLLECTION = 'teacherAssignments';
const ROSTER_COLLECTION = 'rosterStudents';
const ATTEMPT_COLLECTION = 'linkAttempts';
const PARENT_CODE_TTL_MS = 15 * 60 * 1000;
const MAX_LINK_FAILURES = 5;
const LINK_LOCK_MS = 30 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = new RegExp(`^TNG-[${CODE_ALPHABET}]{8}$`, 'u');

function randomToken(length) {
  let out = '';
  for (let index = 0; index < length; index += 1) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}
const newLinkCode = () => `TNG-${randomToken(8)}`;
const newStudentId = () => `STU-${randomToken(10)}`;
const stableId = (prefix, ...parts) => `${prefix}${createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 20)}`;

async function subjectInfo(subjectId) {
  const snapshot = await db.collection(SUBJECT_COLLECTION).doc(subjectId).get();
  if (snapshot.exists) return { id: subjectId, name: snapshot.data().name };
  if (Object.hasOwn(SUBJECTS, subjectId)) return { id: subjectId, name: SUBJECTS[subjectId] };
  return null;
}

setGlobalOptions({ region: REGION, maxInstances: 10 });

function requireAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'سجّل الدخول أولًا.');
  }
  return request.auth;
}

function requireUid(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/u.test(value)) {
    throw new HttpsError('invalid-argument', 'معرّف الحساب غير صالح.');
  }
  return value;
}

async function requireActiveAdmin(uid) {
  const snapshot = await db.collection(ADMIN_COLLECTION).doc(uid).get();
  if (!snapshot.exists || snapshot.data()?.active !== true) {
    throw new HttpsError('permission-denied', 'هذه العملية متاحة لإدارة المدرسة المخوّلة فقط.');
  }
  return snapshot;
}

function toCallableInputError(error) {
  if (error instanceof HttpsError) return error;
  if (error instanceof InputValidationError) {
    return new HttpsError('invalid-argument', error.message);
  }
  return new HttpsError('internal', 'تعذر إتمام الطلب الآن. حاول مرة أخرى لاحقًا.');
}

export const submitAccountRequest = onCall(async request => {
  const auth = requireAuth(request);
  if (typeof auth.token.email !== 'string' || !auth.token.email) {
    throw new HttpsError('failed-precondition', 'استخدم حسابًا مسجلًا ببريد إلكتروني.');
  }

  let profile;
  try {
    profile = validateAccountRequest(request.data);
  } catch (error) {
    throw toCallableInputError(error);
  }

  const uid = auth.uid;
  const profileRef = db.collection(PROFILE_COLLECTION).doc(uid);
  const applicationRef = db.collection(APPLICATION_COLLECTION).doc(uid);

  let subject = null;
  if (profile.role === 'teacher') {
    subject = await subjectInfo(profile.subjectId);
    if (!subject) throw new HttpsError('invalid-argument', 'اختر تخصصًا من القائمة.');
  }

  try {
    return await db.runTransaction(async transaction => {
      const existingProfile = await transaction.get(profileRef);
      const existingApplication = profile.role === 'teacher'
        ? await transaction.get(applicationRef)
        : null;
      let classDoc = null;
      let rosterSnapshot = null;
      if (profile.role === 'student') {
        rosterSnapshot = await transaction.get(db.collection(ROSTER_COLLECTION).doc(profile.phoneKey));
        const roster = rosterSnapshot.exists ? rosterSnapshot.data() : null;
        const rosterMatches = roster && roster.claimed !== true
          && roster.fullNameKey === normalizeArabicName(profile.displayName);
        const wantedClassId = rosterMatches ? roster.classId : profile.classId;
        if (wantedClassId) {
          const classSnapshot = await transaction.get(db.collection(CLASS_COLLECTION).doc(wantedClassId));
          if (!classSnapshot.exists) throw new HttpsError('invalid-argument', 'الفصل المختار غير موجود.');
          classDoc = { id: classSnapshot.id, ...classSnapshot.data(), rosterMatched: Boolean(rosterMatches) };
          if (!rosterMatches && classDoc.grade !== profile.grade) {
            throw new HttpsError('invalid-argument', 'الفصل المختار لا يتبع الصف الدراسي المحدد.');
          }
        }
      }

      if (existingProfile.exists) {
        const data = existingProfile.data();
        if (profile.role === 'teacher' && data?.role === 'teacher_applicant') {
          return { role: data.role, status: data.status, created: false };
        }
        throw new HttpsError('already-exists', 'يوجد ملف حساب بالفعل لهذا المستخدم.');
      }

      if (profile.role === 'teacher') {
        if (existingApplication?.exists) {
          return { role: 'teacher_applicant', status: existingApplication.data()?.status ?? 'pending', created: false };
        }
        transaction.create(applicationRef, {
          uid,
          displayName: profile.displayName,
          subjectId: subject.id,
          subjectName: subject.name,
          phone: profile.phone,
          publishConsent: profile.publishConsent,
          status: 'pending',
          submittedAt: FieldValue.serverTimestamp()
        });
        transaction.create(profileRef, {
          uid,
          email: auth.token.email.toLowerCase(),
          displayName: profile.displayName,
          role: 'teacher_applicant',
          status: 'pending',
          phone: profile.phone,
          createdAt: FieldValue.serverTimestamp()
        });
        return { role: 'teacher_applicant', status: 'pending', created: true };
      }

      // الطالب وولي الأمر: يعملان فورًا دون موافقة الإدارة.
      const userProfile = {
        uid,
        email: auth.token.email.toLowerCase(),
        displayName: profile.displayName,
        role: profile.role,
        status: 'active',
        phone: profile.phone,
        createdAt: FieldValue.serverTimestamp()
      };
      if (profile.role === 'student') {
        userProfile.studentId = newStudentId();
        userProfile.grade = classDoc?.grade ?? profile.grade;
        userProfile.branch = profile.branch ?? '';
        userProfile.classId = classDoc?.id ?? null;
        userProfile.className = classDoc?.name ?? profile.className ?? '';
        userProfile.rosterVerified = Boolean(classDoc?.rosterMatched);
        if (profile.birthDate) userProfile.birthDate = profile.birthDate;
        if (classDoc?.rosterMatched) {
          transaction.update(rosterSnapshot.ref, { claimed: true, claimedBy: uid, claimedAt: FieldValue.serverTimestamp() });
        }
        let parentCode;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const candidate = newLinkCode();
          const codeRef = db.collection(PARENT_CODE_COLLECTION).doc(candidate);
          const codeSnapshot = await transaction.get(codeRef);
          if (!codeSnapshot.exists) {
            parentCode = candidate;
            transaction.create(codeRef, {
              studentUid: uid,
              active: true,
              createdAt: FieldValue.serverTimestamp(),
              expiresAt: Timestamp.fromMillis(Date.now() + PARENT_CODE_TTL_MS)
            });
            break;
          }
        }
        if (!parentCode) throw new HttpsError('aborted', 'تعذر إنشاء كود ولي الأمر.');
        userProfile.parentCode = parentCode;
        userProfile.parentCodeExpiresAt = Timestamp.fromMillis(Date.now() + PARENT_CODE_TTL_MS);
      }
      transaction.create(profileRef, userProfile);
      return { role: profile.role, status: 'active', created: true };
    });
  } catch (error) {
    throw toCallableInputError(error);
  }
});

export const getMyAccountStatus = onCall(async request => {
  const auth = requireAuth(request);
  const adminSnapshot = await db.collection(ADMIN_COLLECTION).doc(auth.uid).get();
  if (adminSnapshot.exists && adminSnapshot.data()?.active === true) {
    return { role: 'admin', status: 'active', emailVerified: auth.token.email_verified === true };
  }

  const profileSnapshot = await db.collection(PROFILE_COLLECTION).doc(auth.uid).get();
  if (!profileSnapshot.exists) {
    return { role: 'none', status: 'none', emailVerified: auth.token.email_verified === true };
  }
  const profile = profileSnapshot.data();
  return {
    role: profile.role,
    status: profile.status,
    displayName: profile.displayName ?? '',
    emailVerified: auth.token.email_verified === true
  };
});

async function assertLinkNotLocked(uid) {
  const snapshot = await db.collection(ATTEMPT_COLLECTION).doc(uid).get();
  const lockedUntil = snapshot.data()?.lockedUntil?.toMillis?.() ?? 0;
  if (lockedUntil > Date.now()) {
    throw new HttpsError('resource-exhausted', 'محاولات خاطئة كثيرة. حاول مرة أخرى بعد قليل.');
  }
}

async function recordLinkFailure(uid) {
  const ref = db.collection(ATTEMPT_COLLECTION).doc(uid);
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() ?? {};
    const windowStart = data.windowStart?.toMillis?.() ?? 0;
    const fresh = Date.now() - windowStart < PARENT_CODE_TTL_MS;
    const failures = (fresh ? data.failures ?? 0 : 0) + 1;
    transaction.set(ref, {
      failures: failures >= MAX_LINK_FAILURES ? 0 : failures,
      windowStart: Timestamp.fromMillis(fresh ? windowStart : Date.now()),
      lockedUntil: failures >= MAX_LINK_FAILURES ? Timestamp.fromMillis(Date.now() + LINK_LOCK_MS) : null
    });
  });
}

const INVALID_CODE_MESSAGE = 'كود الربط غير صالح أو منتهي أو استُخدم من قبل.';

export const linkParentToStudent = onCall(async request => {
  const auth = requireAuth(request);
  const parentProfile = await db.collection(PROFILE_COLLECTION).doc(auth.uid).get();
  if (!parentProfile.exists || parentProfile.data()?.role !== 'parent' || parentProfile.data()?.status !== 'active') {
    throw new HttpsError('permission-denied', 'ربط الأبناء متاح لحساب ولي الأمر النشط فقط.');
  }
  await assertLinkNotLocked(auth.uid);
  const code = String(request.data?.code ?? '').trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    await recordLinkFailure(auth.uid);
    throw new HttpsError('not-found', INVALID_CODE_MESSAGE);
  }
  const codeRef = db.collection(PARENT_CODE_COLLECTION).doc(code);
  try {
    return await db.runTransaction(async transaction => {
      const codeSnapshot = await transaction.get(codeRef);
      const codeData = codeSnapshot.data();
      if (!codeSnapshot.exists || codeData?.active !== true
          || !codeData.expiresAt?.toMillis || codeData.expiresAt.toMillis() <= Date.now()) {
        throw new HttpsError('not-found', INVALID_CODE_MESSAGE);
      }
      const studentUid = requireUid(codeData.studentUid);
      if (studentUid === auth.uid) throw new HttpsError('not-found', INVALID_CODE_MESSAGE);
      const studentRef = db.collection(PROFILE_COLLECTION).doc(studentUid);
      const studentProfile = await transaction.get(studentRef);
      if (!studentProfile.exists || studentProfile.data()?.role !== 'student' || studentProfile.data()?.status !== 'active') {
        throw new HttpsError('not-found', INVALID_CODE_MESSAGE);
      }
      const parentLinkRef = db.collection(PARENT_LINK_COLLECTION).doc(`${auth.uid}_${studentUid}`);
      const existingLink = await transaction.get(parentLinkRef);
      if (existingLink.exists && existingLink.data()?.active === true) {
        throw new HttpsError('already-exists', 'هذا الطالب مرتبط بحسابك بالفعل.');
      }
      // الكود يُستهلك مرة واحدة، والربط يعمل فورًا دون موافقة الإدارة.
      transaction.update(codeRef, { active: false, usedAt: FieldValue.serverTimestamp(), usedBy: auth.uid });
      transaction.set(parentLinkRef, {
        parentUid: auth.uid,
        studentUid,
        studentId: studentProfile.data()?.studentId ?? null,
        status: 'active',
        active: true,
        createdAt: FieldValue.serverTimestamp()
      });
      transaction.set(db.collection(ATTEMPT_COLLECTION).doc(auth.uid), { failures: 0, lockedUntil: null, windowStart: Timestamp.fromMillis(Date.now()) });
      transaction.create(db.collection(AUDIT_LOG_COLLECTION).doc(), {
        action: 'parent_link_created',
        actorUid: auth.uid,
        parentUid: auth.uid,
        studentUid,
        linkId: parentLinkRef.id,
        createdAt: FieldValue.serverTimestamp()
      });
      return { linked: true, studentUid, displayName: studentProfile.data()?.displayName ?? '' };
    });
  } catch (error) {
    if (error instanceof HttpsError && error.code === 'not-found') await recordLinkFailure(auth.uid);
    throw toCallableInputError(error);
  }
});

export const issueParentCode = onCall(async request => {
  const auth = requireAuth(request);
  const profileRef = db.collection(PROFILE_COLLECTION).doc(auth.uid);
  const profileSnapshot = await profileRef.get();
  if (!profileSnapshot.exists || profileSnapshot.data()?.role !== 'student' || profileSnapshot.data()?.status !== 'active') {
    throw new HttpsError('permission-denied', 'إصدار كود الربط متاح للطالب النشط فقط.');
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = newLinkCode();
    const codeRef = db.collection(PARENT_CODE_COLLECTION).doc(candidate);
    const created = await db.runTransaction(async transaction => {
      const existing = await transaction.get(codeRef);
      if (existing.exists) return false;
      const oldCodes = await transaction.get(db.collection(PARENT_CODE_COLLECTION).where('studentUid', '==', auth.uid).where('active', '==', true).limit(20));
      oldCodes.docs.forEach(oldCode => transaction.update(oldCode.ref, { active: false, revokedAt: FieldValue.serverTimestamp(), revokedBy: auth.uid }));
      const expiresAt = Timestamp.fromMillis(Date.now() + PARENT_CODE_TTL_MS);
      transaction.create(codeRef, { studentUid: auth.uid, active: true, createdAt: FieldValue.serverTimestamp(), expiresAt });
      transaction.update(profileRef, { parentCode: candidate, parentCodeExpiresAt: expiresAt });
      transaction.create(db.collection(AUDIT_LOG_COLLECTION).doc(), {
        action: 'parent_code_issued', actorUid: auth.uid, studentUid: auth.uid, createdAt: FieldValue.serverTimestamp()
      });
      return true;
    });
    if (created) return { code: candidate, expiresInSeconds: PARENT_CODE_TTL_MS / 1000 };
  }
  throw new HttpsError('aborted', 'تعذر إصدار كود ربط جديد. حاول مرة أخرى.');
});

export const listLinkedStudents = onCall(async request => {
  const auth = requireAuth(request);
  const parentSnapshot = await db.collection(PROFILE_COLLECTION).doc(auth.uid).get();
  if (!parentSnapshot.exists || parentSnapshot.data()?.role !== 'parent' || parentSnapshot.data()?.status !== 'active') {
    throw new HttpsError('permission-denied', 'عرض الأبناء متاح لحساب ولي الأمر النشط فقط.');
  }

  const links = await db.collection(PARENT_LINK_COLLECTION)
    .where('parentUid', '==', auth.uid)
    .limit(100)
    .get();
  const activeLinks = links.docs.filter(document => document.data()?.active === true);
  const refs = activeLinks.map(link => db.collection(PROFILE_COLLECTION).doc(requireUid(link.data()?.studentUid)));
  const snapshots = refs.length ? await db.getAll(...refs) : [];
  const students = snapshots.map(studentSnapshot => {
    if (!studentSnapshot.exists) return null;
    const student = studentSnapshot.data();
    if (student?.role !== 'student' || student?.status !== 'active') return null;
    return {
      uid: studentSnapshot.id,
      displayName: student.displayName ?? '',
      grade: student.grade ?? '',
      branch: student.branch ?? '',
      className: student.className ?? '',
      classId: student.classId ?? null
    };
  });
  return { students: students.filter(Boolean) };
});

export const unlinkParentFromStudent = onCall(async request => {
  const auth = requireAuth(request);
  const parentSnapshot = await db.collection(PROFILE_COLLECTION).doc(auth.uid).get();
  if (!parentSnapshot.exists || parentSnapshot.data()?.role !== 'parent' || parentSnapshot.data()?.status !== 'active') {
    throw new HttpsError('permission-denied', 'فك الربط متاح لحساب ولي الأمر النشط فقط.');
  }
  const studentUid = requireUid(request.data?.studentUid);
  const linkRef = db.collection(PARENT_LINK_COLLECTION).doc(`${auth.uid}_${studentUid}`);
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(linkRef);
    if (!snapshot.exists || snapshot.data()?.parentUid !== auth.uid || snapshot.data()?.active !== true) {
      throw new HttpsError('not-found', 'لا يوجد ربط نشط لهذا الطالب.');
    }
    transaction.update(linkRef, {
      active: false,
      status: 'unlinked',
      unlinkedAt: FieldValue.serverTimestamp()
    });
    transaction.create(db.collection(AUDIT_LOG_COLLECTION).doc(), {
      action: 'parent_link_unlinked',
      actorUid: auth.uid,
      parentUid: auth.uid,
      studentUid,
      linkId: linkRef.id,
      createdAt: FieldValue.serverTimestamp()
    });
  });
  return { unlinked: true };
});

export const listTeacherApplications = onCall(async request => {
  const auth = requireAuth(request);
  await requireActiveAdmin(auth.uid);
  const snapshot = await db.collection(APPLICATION_COLLECTION)
    .where('status', '==', 'pending')
    .orderBy('submittedAt', 'asc')
    .limit(100)
    .get();

  const records = await Promise.all(snapshot.docs.map(async document => {
    let emailVerified = false;
    try {
      const user = await adminAuth.getUser(document.id);
      emailVerified = user.emailVerified;
    } catch {
      // A deleted Auth account remains visible to the administrator for cleanup.
    }
    const data = document.data();
    return {
      uid: document.id,
      displayName: data.displayName,
      subjectName: data.subjectName,
      publishConsent: data.publishConsent === true,
      submittedAt: data.submittedAt?.toMillis?.() ?? null,
      emailVerified
    };
  }));
  return { applications: records };
});

export const approveTeacher = onCall(async request => {
  const auth = requireAuth(request);
  await requireActiveAdmin(auth.uid);
  const uid = requireUid(request.data?.uid);

  let teacherUser;
  try {
    teacherUser = await adminAuth.getUser(uid);
  } catch {
    throw new HttpsError('not-found', 'تعذر العثور على حساب المدرس.');
  }
  if (!teacherUser.emailVerified) {
    throw new HttpsError('failed-precondition', 'يجب توثيق البريد الإلكتروني للمدرس قبل الاعتماد.');
  }

  const profileRef = db.collection(PROFILE_COLLECTION).doc(uid);
  const applicationRef = db.collection(APPLICATION_COLLECTION).doc(uid);
  const publicRef = db.collection(PUBLIC_TEACHER_COLLECTION).doc(uid);
  try {
    return await db.runTransaction(async transaction => {
      const [adminSnapshot, profileSnapshot, applicationSnapshot] = await Promise.all([
        transaction.get(db.collection(ADMIN_COLLECTION).doc(auth.uid)),
        transaction.get(profileRef),
        transaction.get(applicationRef)
      ]);
      if (!adminSnapshot.exists || adminSnapshot.data()?.active !== true) {
        throw new HttpsError('permission-denied', 'انتهت صلاحية الإدارة لهذه العملية.');
      }
      if (!profileSnapshot.exists || profileSnapshot.data()?.role !== 'teacher_applicant') {
        throw new HttpsError('failed-precondition', 'الحساب ليس طلب مدرس معلقًا.');
      }
      if (!applicationSnapshot.exists || applicationSnapshot.data()?.status !== 'pending') {
        throw new HttpsError('failed-precondition', 'تمت مراجعة هذا الطلب من قبل.');
      }

      const application = applicationSnapshot.data();
      transaction.update(profileRef, {
        role: 'teacher',
        status: 'active',
        subjectId: application.subjectId,
        subjectName: application.subjectName,
        subjectIds: [application.subjectId],
        // الصفوف والفصول تُسند من الإدارة فقط بعد الاعتماد.
        grades: [],
        assignedClassIds: [],
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: auth.uid
      });
      transaction.update(applicationRef, {
        status: 'approved',
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: auth.uid
      });
      if (application.publishConsent === true) {
        transaction.set(publicRef, {
          displayName: application.displayName,
          subjectId: application.subjectId,
          subjectName: application.subjectName,
          published: true,
          approvedAt: FieldValue.serverTimestamp()
        });
      } else {
        transaction.delete(publicRef);
      }
      return {
        status: 'approved',
        role: 'teacher',
        published: application.publishConsent === true
      };
    });
  } catch (error) {
    throw toCallableInputError(error);
  }
});

export const rejectTeacher = onCall(async request => {
  const auth = requireAuth(request);
  await requireActiveAdmin(auth.uid);
  const uid = requireUid(request.data?.uid);
  let reason;
  try {
    reason = validateRejectionReason(request.data?.reason);
  } catch (error) {
    throw toCallableInputError(error);
  }

  const profileRef = db.collection(PROFILE_COLLECTION).doc(uid);
  const applicationRef = db.collection(APPLICATION_COLLECTION).doc(uid);
  try {
    return await db.runTransaction(async transaction => {
      const [adminSnapshot, profileSnapshot, applicationSnapshot] = await Promise.all([
        transaction.get(db.collection(ADMIN_COLLECTION).doc(auth.uid)),
        transaction.get(profileRef),
        transaction.get(applicationRef)
      ]);
      if (!adminSnapshot.exists || adminSnapshot.data()?.active !== true) {
        throw new HttpsError('permission-denied', 'انتهت صلاحية الإدارة لهذه العملية.');
      }
      if (!profileSnapshot.exists || profileSnapshot.data()?.role !== 'teacher_applicant'
          || !applicationSnapshot.exists || applicationSnapshot.data()?.status !== 'pending') {
        throw new HttpsError('failed-precondition', 'الطلب غير متاح للمراجعة.');
      }
      transaction.update(profileRef, {
        status: 'rejected',
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: auth.uid
      });
      transaction.update(applicationRef, {
        status: 'rejected',
        rejectionReason: reason,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: auth.uid
      });
      transaction.delete(db.collection(PUBLIC_TEACHER_COLLECTION).doc(uid));
      return { status: 'rejected' };
    });
  } catch (error) {
    throw toCallableInputError(error);
  }
});

async function recomputeTeacherScope(transaction, teacherUid, removedId = null) {
  const assignments = await transaction.get(db.collection(ASSIGNMENT_COLLECTION).where('teacherUid', '==', teacherUid).limit(200));
  const active = assignments.docs.filter(document => document.id !== removedId).map(document => document.data());
  return { active };
}

function applyScope(transaction, teacherUid, active) {
  transaction.update(db.collection(PROFILE_COLLECTION).doc(teacherUid), {
    grades: [...new Set(active.map(item => item.grade))],
    assignedClassIds: [...new Set(active.map(item => item.classId))],
    subjectIds: [...new Set(active.map(item => item.subjectId))]
  });
}

function auditEntry(transaction, action, actorUid, extra) {
  transaction.create(db.collection(AUDIT_LOG_COLLECTION).doc(), { action, actorUid, ...extra, createdAt: FieldValue.serverTimestamp() });
}

export const adminSaveClass = onCall(async request => {
  const auth = requireAuth(request);
  await requireActiveAdmin(auth.uid);
  let input;
  try { input = validateClassInput(request.data); } catch (error) { throw toCallableInputError(error); }
  const classId = stableId('c', input.year, input.grade, input.section.toLowerCase());
  await db.collection(CLASS_COLLECTION).doc(classId).set({ ...input, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { classId };
});

export const adminDeleteClass = onCall(async request => {
  const auth = requireAuth(request);
  await requireActiveAdmin(auth.uid);
  const classId = requireUid(request.data?.classId);
  const [assignments, students] = await Promise.all([
    db.collection(ASSIGNMENT_COLLECTION).where('classId', '==', classId).limit(1).get(),
    db.collection(PROFILE_COLLECTION).where('classId', '==', classId).limit(1).get()
  ]);
  if (!assignments.empty || !students.empty) {
    throw new HttpsError('failed-precondition', 'لا يمكن حذف فصل مرتبط بطلاب أو بإسنادات مدرسين.');
  }
  await db.collection(CLASS_COLLECTION).doc(classId).delete();
  return { deleted: true };
});

export const adminSaveSubject = onCall(async request => {
  const auth = requireAuth(request);
  await requireActiveAdmin(auth.uid);
  let input;
  try { input = validateSubjectInput(request.data); } catch (error) { throw toCallableInputError(error); }
  const subjectId = stableId('s', input.name.toLowerCase());
  await db.collection(SUBJECT_COLLECTION).doc(subjectId).set({ ...input, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { subjectId };
});

export const adminSeedDefaultSubjects = onCall(async request => {
  const auth = requireAuth(request);
  await requireActiveAdmin(auth.uid);
  const batch = db.batch();
  for (const [id, name] of Object.entries(SUBJECTS)) {
    batch.set(db.collection(SUBJECT_COLLECTION).doc(id), { name, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  await batch.commit();
  return { count: Object.keys(SUBJECTS).length };
});

export const adminDeleteSubject = onCall(async request => {
  const auth = requireAuth(request);
  await requireActiveAdmin(auth.uid);
  const subjectId = requireUid(request.data?.subjectId);
  const used = await db.collection(ASSIGNMENT_COLLECTION).where('subjectId', '==', subjectId).limit(1).get();
  if (!used.empty) throw new HttpsError('failed-precondition', 'لا يمكن حذف مادة مسندة إلى مدرس.');
  await db.collection(SUBJECT_COLLECTION).doc(subjectId).delete();
  return { deleted: true };
});

export const adminAssignTeacher = onCall(async request => {
  const auth = requireAuth(request);
  await requireActiveAdmin(auth.uid);
  const teacherUid = requireUid(request.data?.teacherUid);
  const subjectId = requireUid(request.data?.subjectId);
  const classId = requireUid(request.data?.classId);
  const subject = await subjectInfo(subjectId);
  if (!subject) throw new HttpsError('not-found', 'المادة غير موجودة.');
  const assignmentId = `${teacherUid}_${subjectId}_${classId}`;
  return db.runTransaction(async transaction => {
    const [teacher, classSnapshot, existing] = await Promise.all([
      transaction.get(db.collection(PROFILE_COLLECTION).doc(teacherUid)),
      transaction.get(db.collection(CLASS_COLLECTION).doc(classId)),
      transaction.get(db.collection(ASSIGNMENT_COLLECTION).doc(assignmentId))
    ]);
    if (!teacher.exists || teacher.data()?.role !== 'teacher' || teacher.data()?.status !== 'active') {
      throw new HttpsError('failed-precondition', 'الإسناد متاح لمدرس معتمد فقط.');
    }
    if (!classSnapshot.exists) throw new HttpsError('not-found', 'الفصل غير موجود.');
    const { active } = await recomputeTeacherScope(transaction, teacherUid);
    const entry = {
      teacherUid, subjectId, subjectName: subject.name, classId, className: classSnapshot.data().name,
      grade: classSnapshot.data().grade, year: classSnapshot.data().year, teacherName: teacher.data().displayName ?? ''
    };
    if (!existing.exists) active.push(entry);
    transaction.set(db.collection(ASSIGNMENT_COLLECTION).doc(assignmentId), { ...entry, assignedBy: auth.uid, assignedAt: FieldValue.serverTimestamp() });
    applyScope(transaction, teacherUid, active);
    auditEntry(transaction, 'teacher_assigned', auth.uid, { teacherUid, subjectId, classId });
    return { assignmentId };
  });
});

export const adminRemoveAssignment = onCall(async request => {
  const auth = requireAuth(request);
  await requireActiveAdmin(auth.uid);
  const assignmentId = String(request.data?.assignmentId ?? '');
  if (!/^[A-Za-z0-9_-]{1,300}$/u.test(assignmentId)) throw new HttpsError('invalid-argument', 'معرّف الإسناد غير صالح.');
  const ref = db.collection(ASSIGNMENT_COLLECTION).doc(assignmentId);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError('not-found', 'الإسناد غير موجود.');
    const teacherUid = snapshot.data().teacherUid;
    const { active } = await recomputeTeacherScope(transaction, teacherUid, assignmentId);
    transaction.delete(ref);
    applyScope(transaction, teacherUid, active);
    auditEntry(transaction, 'teacher_assignment_removed', auth.uid, { teacherUid, assignmentId });
    return { removed: true };
  });
});

export const adminImportRoster = onCall(async request => {
  const auth = requireAuth(request);
  await requireActiveAdmin(auth.uid);
  let rows;
  try { rows = validateRosterRows(request.data?.rows); } catch (error) { throw toCallableInputError(error); }
  const classIds = [...new Set(rows.map(row => row.classId))];
  const classSnapshots = await db.getAll(...classIds.map(id => db.collection(CLASS_COLLECTION).doc(id)));
  const classes = new Map(classSnapshots.filter(item => item.exists).map(item => [item.id, item.data()]));
  const missing = classIds.filter(id => !classes.has(id));
  if (missing.length) throw new HttpsError('invalid-argument', 'بعض الفصول في الملف غير موجودة. أنشئها أولًا.');
  const batch = db.batch();
  rows.forEach(row => {
    batch.set(db.collection(ROSTER_COLLECTION).doc(row.phoneKey), {
      fullName: row.fullName,
      fullNameKey: normalizeArabicName(row.fullName),
      classId: row.classId,
      grade: classes.get(row.classId).grade,
      claimed: false,
      importedBy: auth.uid,
      importedAt: FieldValue.serverTimestamp()
    });
  });
  batch.create(db.collection(AUDIT_LOG_COLLECTION).doc(), { action: 'roster_imported', actorUid: auth.uid, count: rows.length, createdAt: FieldValue.serverTimestamp() });
  await batch.commit();
  return { imported: rows.length };
});

export const listClassStudents = onCall(async request => {
  const auth = requireAuth(request);
  const classId = requireUid(request.data?.classId);
  let allowed = false;
  const adminSnapshot = await db.collection(ADMIN_COLLECTION).doc(auth.uid).get();
  if (adminSnapshot.exists && adminSnapshot.data()?.active === true) allowed = true;
  if (!allowed) {
    const assigned = await db.collection(ASSIGNMENT_COLLECTION)
      .where('teacherUid', '==', auth.uid).where('classId', '==', classId).limit(1).get();
    allowed = !assigned.empty;
  }
  if (!allowed) throw new HttpsError('permission-denied', 'هذا الفصل غير مسند إلى حسابك.');
  const pageSize = 30;
  let query = db.collection(PROFILE_COLLECTION).where('classId', '==', classId).orderBy('displayName').limit(pageSize + 1);
  const after = request.data?.after;
  if (typeof after === 'string' && after) query = query.startAfter(after.slice(0, 80));
  const snapshot = await query.get();
  const docs = snapshot.docs.slice(0, pageSize);
  return {
    students: docs.map(document => ({ uid: document.id, displayName: document.data().displayName ?? '' })),
    next: snapshot.docs.length > pageSize ? docs[docs.length - 1].data().displayName : null
  };
});

export const revokeParentLink = onCall(async request => {
  const auth = requireAuth(request);
  const linkId = String(request.data?.linkId ?? '');
  if (!/^[A-Za-z0-9_-]{1,300}$/u.test(linkId)) throw new HttpsError('invalid-argument', 'معرّف الربط غير صالح.');
  const adminSnapshot = await db.collection(ADMIN_COLLECTION).doc(auth.uid).get();
  const isAdmin = adminSnapshot.exists && adminSnapshot.data()?.active === true;
  const ref = db.collection(PARENT_LINK_COLLECTION).doc(linkId);
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    if (!snapshot.exists || data.active !== true || (!isAdmin && data.studentUid !== auth.uid)) {
      throw new HttpsError('not-found', 'لا يوجد ربط نشط لهذا المعرّف.');
    }
    transaction.update(ref, { active: false, status: 'revoked', revokedAt: FieldValue.serverTimestamp(), revokedBy: auth.uid });
    auditEntry(transaction, 'parent_link_revoked', auth.uid, { parentUid: data.parentUid, studentUid: data.studentUid, linkId });
  });
  return { revoked: true };
});
export { notifyOnAttendance, notifyOnContent, notifyOnGrade } from './notifications.js';
