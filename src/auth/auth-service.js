import { applyActionCode, browserLocalPersistence, checkActionCode, confirmPasswordReset, createUserWithEmailAndPassword, onAuthStateChanged, setPersistence, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, verifyPasswordResetCode } from 'firebase/auth';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { validateAccountRequest } from '../../functions/src/validation.js';
import { getFirebaseApp } from '../config/firebase-app.js';
import { firebaseConfigured, functionsRegion } from '../config/firebase-env.js';
import { isSpark } from '../config/backend-mode.js';
// يُحمَّل عند أول استخدام فقط حتى لا تدخل Firestore في صفحة الدخول
const loadSpark = () => import('../services/spark-backend.js');

let authClient;
let functionsClient;
let authPersistencePromise;

function getAuthClients() {
  if (!firebaseConfigured) throw new Error('firebase/not-configured');
  if (!authClient || !functionsClient) {
    const app = getFirebaseApp();
    authClient = getAuth(app);
    // تسجيل الدخول يبقى محفوظًا على الجهاز حتى يضغط المستخدم تسجيل الخروج.
    // Avoid a race where sign-in finishes before Firebase has enabled durable sessions.
    authPersistencePromise = setPersistence(authClient, browserLocalPersistence);
    authPersistencePromise.catch(() => {});
    functionsClient = getFunctions(app, functionsRegion);
  }
  return { auth: authClient, functions: functionsClient, persistence: authPersistencePromise };
}

function callable(name, data) {
  const {functions} = getAuthClients();
  return httpsCallable(functions, name)(data).then(result => result.data);
}

export function getCurrentUser() {
  return firebaseConfigured ? getAuthClients().auth.currentUser : null;
}

export async function createAuthUser(email, password) {
  const {auth, persistence} = getAuthClients();
  await persistence;
  return createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

export function submitAccountRequest(formData) {
  const profile = validateAccountRequest(formData);
  if (isSpark) return loadSpark().then(spark => spark.submitAccountRequest(profile));
  return callable('submitAccountRequest', profile);
}

export async function sendVerificationIfNeeded(user = getCurrentUser()) {
  if (!user) throw new Error('auth/no-current-user');
  if (user.emailVerified) return true;
  await sendEmailVerification(user);
  return true;
}

export async function signIn(email, password) {
  const {auth, persistence} = getAuthClients();
  await persistence;
  return signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

export async function sendPasswordReset(email) {
  const {auth, persistence} = getAuthClients();
  await persistence;
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!normalizedEmail) throw Object.assign(new Error('اكتب البريد الإلكتروني أولًا.'), {code:'auth/invalid-email'});
  return sendPasswordResetEmail(auth, normalizedEmail);
}

/* روابط البريد (/auth/action): كلها تحتاج عميل المصادقة الجاهز قبل الاستدعاء. */
export async function actionAuth() {
  const {auth, persistence} = getAuthClients();
  await persistence;
  return auth;
}
export async function inspectActionCode(oobCode) { return checkActionCode(await actionAuth(), oobCode); }
export async function applyEmailAction(oobCode) { return applyActionCode(await actionAuth(), oobCode); }
export async function verifyResetCode(oobCode) { return verifyPasswordResetCode(await actionAuth(), oobCode); }
export async function confirmReset(oobCode, newPassword) { return confirmPasswordReset(await actionAuth(), oobCode, newPassword); }
/* بعد التأكيد: يحدّث المستخدم الحالي ورمزه حتى تقرأ القواعد email_verified الجديد. يعيد true لو كان البريد موثقًا. */
export async function refreshVerifiedSession() {
  const user = getCurrentUser();
  if (!user) return false;
  await user.reload();
  await user.getIdToken(true);
  return user.emailVerified === true;
}

export async function signOutUser() {
  const {auth, persistence} = getAuthClients();
  await persistence;
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
  if (isSpark) return loadSpark().then(spark => spark.getMyAccountStatus());
  return callable('getMyAccountStatus', {});
}

export function listTeacherApplications() {
  if (isSpark) return loadSpark().then(spark => spark.listTeacherApplications());
  return callable('listTeacherApplications', {});
}

export function approveTeacher(uid) {
  if (isSpark) return loadSpark().then(spark => spark.approveTeacher(uid));
  return callable('approveTeacher', { uid });
}

export function rejectTeacher(uid, reason = '') {
  if (isSpark) return loadSpark().then(spark => spark.rejectTeacher(uid, reason));
  return callable('rejectTeacher', { uid, reason });
}

export function linkParentToStudent(code) {
  if (isSpark) return loadSpark().then(spark => spark.linkParentToStudent(code));
  return callable('linkParentToStudent', { code });
}

export function issueParentCode() {
  if (isSpark) return loadSpark().then(spark => spark.issueParentCode());
  return callable('issueParentCode', {});
}

export function listLinkedStudents() {
  if (isSpark) return loadSpark().then(spark => spark.listLinkedStudents());
  return callable('listLinkedStudents', {});
}

export function unlinkParentFromStudent(studentUid) {
  if (isSpark) return loadSpark().then(spark => spark.unlinkParentFromStudent(studentUid));
  return callable('unlinkParentFromStudent', { studentUid });
}

export function revokeParentLink(linkId) {
  if (isSpark) return loadSpark().then(spark => spark.revokeParentLink(linkId));
  return callable('revokeParentLink', { linkId });
}

export function adminSaveClass(data) {
  if (isSpark) return loadSpark().then(spark => spark.adminSaveClass(data));
  return callable('adminSaveClass', data);
}

export function adminDeleteClass(classId) {
  if (isSpark) return loadSpark().then(spark => spark.adminDeleteClass(classId));
  return callable('adminDeleteClass', { classId });
}

export function adminSaveSubject(name, branches = []) {
  if (isSpark) return loadSpark().then(spark => spark.adminSaveSubject(name, branches));
  return callable('adminSaveSubject', { name, branches });
}

export function adminDeleteSubject(subjectId) {
  if (isSpark) return loadSpark().then(spark => spark.adminDeleteSubject(subjectId));
  return callable('adminDeleteSubject', { subjectId });
}

export function adminSeedDefaultSubjects() {
  if (isSpark) return loadSpark().then(spark => spark.adminSeedDefaultSubjects());
  return callable('adminSeedDefaultSubjects', {});
}

export function adminAssignTeacher(teacherUid, subjectId, classId) {
  if (isSpark) return loadSpark().then(spark => spark.adminAssignTeacher(teacherUid, subjectId, classId));
  return callable('adminAssignTeacher', { teacherUid, subjectId, classId });
}

export function adminRemoveAssignment(assignmentId) {
  if (isSpark) return loadSpark().then(spark => spark.adminRemoveAssignment(assignmentId));
  return callable('adminRemoveAssignment', { assignmentId });
}

export function adminImportRoster(rows) {
  if (isSpark) return loadSpark().then(spark => spark.adminImportRoster(rows));
  return callable('adminImportRoster', { rows });
}

export function listClassStudents(classId, after = '') {
  if (isSpark) return loadSpark().then(spark => spark.listClassStudents(classId, after));
  return callable('listClassStudents', { classId, after });
}

export function waitForInitialAuthState() {
  if (!firebaseConfigured) return Promise.resolve(null);
  const {auth,persistence}=getAuthClients();
  return new Promise((resolve,reject)=>{
    let unsubscribe=()=>{};
    persistence.then(()=>{
      unsubscribe=onAuthStateChanged(auth,user=>{
        unsubscribe();
        resolve(user);
      },error=>{
        unsubscribe();
        reject(error);
      });
    },reject);
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
    'load-timeout': 'الاتصال بطيء جدًا. تحقق من الشبكة ثم أعد المحاولة.',
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
