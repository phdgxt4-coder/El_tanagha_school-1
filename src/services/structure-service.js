import { collection, getDocs, getFirestore, limit, query, where } from 'firebase/firestore';
import { getFirebaseApp } from '../config/firebase-app.js';
import { firebaseConfigured } from '../config/firebase-env.js';
import { subjects as defaultSubjects } from '../data/catalog.js';
import { cacheInvalidate, cached } from './cache.js';

const TEN_MINUTES = 10 * 60 * 1000;
const CLASSES_KEY = 'structure:classes';
const SUBJECTS_KEY = 'structure:subjects';

function database() {
  if (!firebaseConfigured) throw Object.assign(new Error('firebase/not-configured'), { code: 'firebase/not-configured' });
  return getFirestore(getFirebaseApp());
}

export function loadClasses() {
  return cached(CLASSES_KEY, TEN_MINUTES, async () => {
    const snapshot = await getDocs(query(collection(database(), 'classes'), limit(100)));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
      .sort((a, b) => String(a.grade).localeCompare(b.grade) || String(a.section).localeCompare(String(b.section), 'ar'));
  });
}

export function loadSubjects() {
  return cached(SUBJECTS_KEY, TEN_MINUTES, async () => {
    const snapshot = await getDocs(query(collection(database(), 'subjects'), limit(100)));
    const records = snapshot.docs.map(item => ({ id: item.id, name: item.data().name }));
    return records.length ? records.sort((a, b) => a.name.localeCompare(b.name, 'ar')) : defaultSubjects.map(({ id, name }) => ({ id, name }));
  });
}

export function invalidateStructure() {
  cacheInvalidate(CLASSES_KEY);
  cacheInvalidate(SUBJECTS_KEY);
}

export async function loadTeacherAssignments(teacherUid) {
  const snapshot = await getDocs(query(collection(database(), 'teacherAssignments'), where('teacherUid', '==', teacherUid), limit(100)));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function loadClassAssignments(classId) {
  const snapshot = await getDocs(query(collection(database(), 'teacherAssignments'), where('classId', '==', classId), limit(50)));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}
