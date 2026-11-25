import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
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
const REGION = 'us-central1';

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
            transaction.create(codeRef, { studentUid: uid, active: true, createdAt: FieldValue.serverTimestamp() });
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
  const codeSnapshot = await db.collection(PARENT_CODE_COLLECTION).doc(code).get();
  if (!codeSnapshot.exists || codeSnapshot.data()?.active !== true) throw new HttpsError('not-found', 'كود الربط غير موجود أو غير فعال.');
  const studentUid = requireUid(codeSnapshot.data().studentUid);
  if (studentUid === auth.uid) throw new HttpsError('invalid-argument', 'لا يمكن ربط الحساب بنفسه.');
  const studentProfile = await db.collection(PROFILE_COLLECTION).doc(studentUid).get();
  if (!studentProfile.exists || studentProfile.data()?.role !== 'student' || studentProfile.data()?.status !== 'active') {
    throw new HttpsError('failed-precondition', 'حساب الطالب غير متاح للربط.');
  }
  await db.collection(PARENT_LINK_COLLECTION).doc(`${auth.uid}_${studentUid}`).set({
    parentUid: auth.uid,
    studentUid,
    code,
    active: true,
    createdAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { linked: true, studentUid, displayName: studentProfile.data()?.displayName ?? '' };
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
