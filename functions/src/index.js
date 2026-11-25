import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { randomInt } from 'node:crypto';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { InputValidationError, validateAccountRequest, validateRejectionReason } from './validation.js';

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
const PARENT_CODE_TTL_MS = 15 * 60 * 1000;

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
  try {
    return await db.runTransaction(async transaction => {
      const existingProfile = await transaction.get(profileRef);
      const existingApplication = profile.role === 'teacher'
        ? await transaction.get(applicationRef)
        : null;

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
          subjectId: profile.subjectId,
          subjectName: profile.subjectName,
          grades: profile.grades,
          phone: profile.phone ?? null,
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
          phone: profile.phone ?? null,
          grades: profile.grades,
          createdAt: FieldValue.serverTimestamp()
        });
        return { role: 'teacher_applicant', status: 'pending', created: true };
      }

      const userProfile = {
        uid,
        email: auth.token.email.toLowerCase(),
        displayName: profile.displayName,
        role: profile.role,
        status: 'active',
        phone: profile.phone ?? null,
        createdAt: FieldValue.serverTimestamp()
      };
      if (profile.role === 'student') {
        userProfile.grade = profile.grade;
        userProfile.branch = profile.branch;
        userProfile.className = profile.className;
        userProfile.birthDate = profile.birthDate;
        let parentCode;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const candidate = `TNG-${String(randomInt(100000, 1000000))}`;
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

export const linkParentToStudent = onCall(async request => {
  const auth = requireAuth(request);
  const parentProfile = await db.collection(PROFILE_COLLECTION).doc(auth.uid).get();
  if (!parentProfile.exists || parentProfile.data()?.role !== 'parent' || parentProfile.data()?.status !== 'active') {
    throw new HttpsError('permission-denied', 'ربط الأبناء متاح لحساب ولي الأمر النشط فقط.');
  }
  const code = String(request.data?.code ?? '').trim().toUpperCase();
  if (!/^TNG-\d{6}$/u.test(code)) throw new HttpsError('invalid-argument', 'كود الربط غير صالح.');
  const codeRef = db.collection(PARENT_CODE_COLLECTION).doc(code);
  const linkRef = db.collection(PARENT_LINK_COLLECTION);
  try {
    return await db.runTransaction(async transaction => {
      const codeSnapshot = await transaction.get(codeRef);
      if (!codeSnapshot.exists || codeSnapshot.data()?.active !== true) {
        throw new HttpsError('not-found', 'كود الربط غير موجود أو منتهي أو استُخدم من قبل.');
      }
      const codeData = codeSnapshot.data();
      if (!codeData.expiresAt?.toMillis || codeData.expiresAt.toMillis() <= Date.now()) {
        transaction.update(codeRef, { active: false, expiredAt: FieldValue.serverTimestamp() });
        throw new HttpsError('not-found', 'كود الربط منتهي الصلاحية. اطلب كودًا جديدًا من حساب الطالب.');
      }
      const studentUid = requireUid(codeData.studentUid);
      if (studentUid === auth.uid) throw new HttpsError('invalid-argument', 'لا يمكن ربط الحساب بنفسه.');
      const studentRef = db.collection(PROFILE_COLLECTION).doc(studentUid);
      const studentProfile = await transaction.get(studentRef);
      if (!studentProfile.exists || studentProfile.data()?.role !== 'student' || studentProfile.data()?.status !== 'active') {
        throw new HttpsError('failed-precondition', 'حساب الطالب غير متاح للربط.');
      }
      const parentLinkRef = db.collection(PARENT_LINK_COLLECTION).doc(`${auth.uid}_${studentUid}`);
      const existingLink = await transaction.get(parentLinkRef);
      if (existingLink.exists && ['pending', 'active'].includes(existingLink.data()?.status)) {
        throw new HttpsError('already-exists', 'يوجد طلب ربط قائم لهذا الطالب.');
      }
      transaction.update(codeRef, { active: false, usedAt: FieldValue.serverTimestamp(), usedBy: auth.uid });
      transaction.set(parentLinkRef, {
        parentUid: auth.uid,
        studentUid,
        code,
        status: 'pending',
        active: false,
        createdAt: FieldValue.serverTimestamp()
      });
      transaction.create(db.collection(AUDIT_LOG_COLLECTION).doc(), {
        action: 'parent_link_requested',
        actorUid: auth.uid,
        parentUid: auth.uid,
        studentUid,
        linkId: parentLinkRef.id,
        createdAt: FieldValue.serverTimestamp()
      });
      return { linked: false, pending: true, studentUid, displayName: studentProfile.data()?.displayName ?? '' };
    });
  } catch (error) {
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
    const candidate = `TNG-${String(randomInt(100000, 1000000))}`;
    const codeRef = db.collection(PARENT_CODE_COLLECTION).doc(candidate);
    const created = await db.runTransaction(async transaction => {
      const existing = await transaction.get(codeRef);
      if (existing.exists) return false;
      const oldCodes = await db.collection(PARENT_CODE_COLLECTION).where('studentUid', '==', auth.uid).where('active', '==', true).limit(20).get();
      oldCodes.docs.forEach(oldCode => transaction.update(oldCode.ref, { active: false, revokedAt: FieldValue.serverTimestamp(), revokedBy: auth.uid }));
      transaction.create(codeRef, {
        studentUid: auth.uid,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + PARENT_CODE_TTL_MS)
      });
      transaction.update(profileRef, { parentCode: candidate, parentCodeExpiresAt: Timestamp.fromMillis(Date.now() + PARENT_CODE_TTL_MS) });
      transaction.create(db.collection(AUDIT_LOG_COLLECTION).doc(), {
        action: 'parent_code_issued', actorUid: auth.uid, studentUid: auth.uid,
        code: candidate, createdAt: FieldValue.serverTimestamp()
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
  const students = await Promise.all(activeLinks.map(async link => {
    const studentUid = requireUid(link.data()?.studentUid);
    const studentSnapshot = await db.collection(PROFILE_COLLECTION).doc(studentUid).get();
    if (!studentSnapshot.exists) return null;
    const student = studentSnapshot.data();
    if (student?.role !== 'student' || student?.status !== 'active') return null;
    return {
      uid: studentUid,
      displayName: student.displayName ?? '',
      grade: student.grade ?? '',
      branch: student.branch ?? '',
      className: student.className ?? ''
    };
  }));
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

export const listParentLinkRequests = onCall(async request => {
  const auth = requireAuth(request);
  await requireActiveAdmin(auth.uid);
  const snapshot = await db.collection(PARENT_LINK_COLLECTION)
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'asc')
    .limit(100)
    .get();
  const requests = await Promise.all(snapshot.docs.map(async document => {
    const data = document.data();
    const [parentSnapshot, studentSnapshot] = await Promise.all([
      db.collection(PROFILE_COLLECTION).doc(data.parentUid).get(),
      db.collection(PROFILE_COLLECTION).doc(data.studentUid).get()
    ]);
    return {
      linkId: document.id,
      parentUid: data.parentUid,
      studentUid: data.studentUid,
      parentName: parentSnapshot.data()?.displayName ?? 'ولي أمر',
      studentName: studentSnapshot.data()?.displayName ?? 'طالب',
      createdAt: data.createdAt?.toMillis?.() ?? null
    };
  }));
  return { requests };
});

export const approveParentLink = onCall(async request => {
  const auth = requireAuth(request);
  await requireActiveAdmin(auth.uid);
  const linkId = String(request.data?.linkId ?? '');
  if (!/^[A-Za-z0-9_-]{1,256}$/u.test(linkId)) throw new HttpsError('invalid-argument', 'معرّف طلب الربط غير صالح.');
  const linkRef = db.collection(PARENT_LINK_COLLECTION).doc(linkId);
  await db.runTransaction(async transaction => {
    const linkSnapshot = await transaction.get(linkRef);
    if (!linkSnapshot.exists || linkSnapshot.data()?.status !== 'pending') {
      throw new HttpsError('not-found', 'طلب الربط غير متاح للمراجعة.');
    }
    const data = linkSnapshot.data();
    transaction.update(linkRef, { status: 'active', active: true, approvedAt: FieldValue.serverTimestamp(), approvedBy: auth.uid });
    transaction.create(db.collection(AUDIT_LOG_COLLECTION).doc(), {
      action: 'parent_link_approved', actorUid: auth.uid, parentUid: data.parentUid,
      studentUid: data.studentUid, linkId, createdAt: FieldValue.serverTimestamp()
    });
  });
  return { approved: true };
});

export const rejectParentLink = onCall(async request => {
  const auth = requireAuth(request);
  await requireActiveAdmin(auth.uid);
  const linkId = String(request.data?.linkId ?? '');
  if (!/^[A-Za-z0-9_-]{1,256}$/u.test(linkId)) throw new HttpsError('invalid-argument', 'معرّف طلب الربط غير صالح.');
  const linkRef = db.collection(PARENT_LINK_COLLECTION).doc(linkId);
  await db.runTransaction(async transaction => {
    const linkSnapshot = await transaction.get(linkRef);
    if (!linkSnapshot.exists || linkSnapshot.data()?.status !== 'pending') {
      throw new HttpsError('not-found', 'طلب الربط غير متاح للمراجعة.');
    }
    const data = linkSnapshot.data();
    transaction.update(linkRef, { status: 'rejected', active: false, rejectedAt: FieldValue.serverTimestamp(), rejectedBy: auth.uid });
    transaction.create(db.collection(AUDIT_LOG_COLLECTION).doc(), {
      action: 'parent_link_rejected', actorUid: auth.uid, parentUid: data.parentUid,
      studentUid: data.studentUid, linkId, createdAt: FieldValue.serverTimestamp()
    });
  });
  return { rejected: true };
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
        grades: application.grades,
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
