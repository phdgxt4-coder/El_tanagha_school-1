import { browserLocalPersistence, createUserWithEmailAndPassword, onAuthStateChanged, setPersistence, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { validateAccountRequest } from '../../functions/src/validation.js';
import { getFirebaseApp } from '../config/firebase-app.js';
import { firebaseConfigured, functionsRegion } from '../config/firebase-env.js';
import { isSpark } from '../config/backend-mode.js';
import * as spark from '../services/spark-backend.js';

let authClient;
let functionsClient;

function getAuthClients() {
  if (!firebaseConfigured) throw new Error('firebase/not-configured');
  if (!authClient || !functionsClient) {
    const app = getFirebaseApp();
    authClient = getAuth(app);
    // تسجيل الدخول يبقى محفوظًا على الجهاز حتى يضغط المستخدم تسجيل الخروج.
    setPersistence(authClient, browserLocalPersistence).catch(() => {});
    functionsClient = getFunctions(app, functionsRegion);
  }
  return { auth: authClient, functions: functionsClient };
}

function callable(name, data) {
  const {functions} = getAuthClients();
  return httpsCallable(functions, name)(data).then(result => result.data);
}

export function getCurrentUser() {
  return firebaseConfigured ? getAuthClients().auth.currentUser : null;
}

export function createAuthUser(email, password) {
  const {auth} = getAuthClients();
  return createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

export function submitAccountRequest(formData) {
  const profile = validateAccountRequest(formData);
  if (isSpark) return spark.submitAccountRequest(profile);
  return callable('submitAccountRequest', profile);
}

export async function sendVerificationIfNeeded(user = getCurrentUser()) {
  if (!user) throw new Error('auth/no-current-user');
  if (user.emailVerified) return true;
  await sendEmailVerification(user);
  return true;
}

export function signIn(email, password) {
  const {auth} = getAuthClients();
  return signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

export function sendPasswordReset(email) {
  const {auth} = getAuthClients();
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!normalizedEmail) throw Object.assign(new Error('اكتب البريد الإلكتروني أولًا.'), {code:'auth/invalid-email'});
  return sendPasswordResetEmail(auth, normalizedEmail);
}

export function signOutUser() {
  const {auth} = getAuthClients();
  return signOut(auth);
}

export function subscribeToAuth(callback, onError = () => {}) {
  try {
    const {auth} = getAuthClients();
    return onAuthStateChanged(auth, callback, onError);
  } catch (error) {
    onError(error);
    return () => {};
  }
}

export function getMyAccountStatus() {
  if (isSpark) return spark.getMyAccountStatus();
  return callable('getMyAccountStatus', {});
}

export function listTeacherApplications() {
  if (isSpark) return spark.listTeacherApplications();
  return callable('listTeacherApplications', {});
}

export function approveTeacher(uid) {
  if (isSpark) return spark.approveTeacher(uid);
  return callable('approveTeacher', { uid });
}

export function rejectTeacher(uid, reason = '') {
  if (isSpark) return spark.rejectTeacher(uid, reason);
  return callable('rejectTeacher', { uid, reason });
}

export function linkParentToStudent(code) {
  if (isSpark) return spark.linkParentToStudent(code);
  return callable('linkParentToStudent', { code });
}

export function issueParentCode() {
  if (isSpark) return spark.issueParentCode();
  return callable('issueParentCode', {});
}

export function listLinkedStudents() {
  if (isSpark) return spark.listLinkedStudents();
  return callable('listLinkedStudents', {});
}

export function unlinkParentFromStudent(studentUid) {
  if (isSpark) return spark.unlinkParentFromStudent(studentUid);
  return callable('unlinkParentFromStudent', { studentUid });
}

export function revokeParentLink(linkId) {
  if (isSpark) return spark.revokeParentLink(linkId);
  return callable('revokeParentLink', { linkId });
}

export function adminSaveClass(data) {
  if (isSpark) return spark.adminSaveClass(data);
  return callable('adminSaveClass', data);
}

export function adminDeleteClass(classId) {
  if (isSpark) return spark.adminDeleteClass(classId);
  return callable('adminDeleteClass', { classId });
}

export function adminSaveSubject(name) {
  if (isSpark) return spark.adminSaveSubject(name);
  return callable('adminSaveSubject', { name });
}

export function adminDeleteSubject(subjectId) {
  if (isSpark) return spark.adminDeleteSubject(subjectId);
  return callable('adminDeleteSubject', { subjectId });
}

export function adminSeedDefaultSubjects() {
  if (isSpark) return spark.adminSeedDefaultSubjects();
  return callable('adminSeedDefaultSubjects', {});
}

export function adminAssignTeacher(teacherUid, subjectId, classId) {
  if (isSpark) return spark.adminAssignTeacher(teacherUid, subjectId, classId);
  return callable('adminAssignTeacher', { teacherUid, subjectId, classId });
}

export function adminRemoveAssignment(assignmentId) {
  if (isSpark) return spark.adminRemoveAssignment(assignmentId);
  return callable('adminRemoveAssignment', { assignmentId });
}

export function adminImportRoster(rows) {
  if (isSpark) return spark.adminImportRoster(rows);
  return callable('adminImportRoster', { rows });
}

export function listClassStudents(classId, after = '') {
  if (isSpark) return spark.listClassStudents(classId, after);
  return callable('listClassStudents', { classId, after });
}

export function waitForInitialAuthState() {
  if (!firebaseConfigured) return Promise.resolve(null);
  const {auth}=getAuthClients();
  return new Promise((resolve,reject)=>{
    let unsubscribe=()=>{};
    unsubscribe=onAuthStateChanged(auth,user=>{
      unsubscribe();
      resolve(user);
    },error=>{
      unsubscribe();
      reject(error);
    });
  });
}

export function friendlyAuthError(error) {
  if (error?.message === 'firebase/not-configured') {
    return 'لم تُضبط إعدادات Firebase لهذا التطبيق بعد. لم يُرسل طلب الدخول.';
  }
  const code = String(error?.code ?? '');
  const messages = {
    'auth/invalid-credential': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني.',
    'auth/wrong-password': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'auth/email-already-in-use': 'يوجد حساب بهذا البريد. سجّل الدخول بدلًا من إنشاء حساب جديد.',
    'auth/weak-password': 'اختر كلمة مرور من 8 أحرف على الأقل.',
    'auth/invalid-email': 'اكتب بريدًا إلكترونيًا صحيحًا.',
    'auth/missing-email': 'اكتب البريد الإلكتروني أولًا.',
    'auth/too-many-requests': 'محاولات كثيرة؛ انتظر قليلًا ثم أعد المحاولة.',
    'functions/unauthenticated': 'انتهت الجلسة؛ سجّل الدخول ثم أعد المحاولة.',
    'functions/permission-denied': 'ليست لديك صلاحية تنفيذ هذا الإجراء.',
    'functions/failed-precondition': error?.message || 'يلزم استكمال خطوة تحقق قبل المتابعة.',
    'functions/invalid-argument': error?.message || 'راجع البيانات المدخلة.',
    'functions/already-exists': 'سبق إنشاء ملف لهذا الحساب.',
    'functions/not-found': error?.message || 'لم يُعثر على الطلب المطلوب.',
    'functions/resource-exhausted': error?.message || 'محاولات كثيرة؛ حاول لاحقًا.'
  };
  return messages[code] || 'تعذر إتمام العملية. تحقق من الاتصال وإعداد Firebase ثم حاول مجددًا.';
}
