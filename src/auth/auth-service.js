import { createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { validateAccountRequest } from '../../functions/src/validation.js';
import { getFirebaseApp } from '../config/firebase-app.js';
import { firebaseConfigured, functionsRegion } from '../config/firebase-env.js';

let authClient;
let functionsClient;

function getAuthClients() {
  if (!firebaseConfigured) throw new Error('firebase/not-configured');
  if (!authClient || !functionsClient) {
    const app = getFirebaseApp();
    authClient = getAuth(app);
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
  return callable('getMyAccountStatus', {});
}

export function listTeacherApplications() {
  return callable('listTeacherApplications', {});
}

export function approveTeacher(uid) {
  return callable('approveTeacher', { uid });
}

export function rejectTeacher(uid, reason = '') {
  return callable('rejectTeacher', { uid, reason });
}

export function linkParentToStudent(code) {
  return callable('linkParentToStudent', { code });
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
    'functions/not-found': 'لم يُعثر على الطلب المطلوب.'
  };
  return messages[code] || 'تعذر إتمام العملية. تحقق من الاتصال وإعداد Firebase ثم حاول مجددًا.';
}
