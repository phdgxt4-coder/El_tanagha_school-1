import { collection, getFirestore, onSnapshot, query, where } from 'firebase/firestore';
import { getFirebaseApp } from '../config/firebase-app.js';
import { firebaseConfigured } from '../config/firebase-env.js';
import { announcements, subjects } from '../data/catalog.js';

let firestore;
function getDatabase() {
  if (!firebaseConfigured) throw Object.assign(new Error('Firebase غير مضبوط بعد.'), {code:'firebase/not-configured'});
  if (!firestore) firestore = getFirestore(getFirebaseApp());
  return firestore;
}

function sortByName(records) {
  return records.sort((a, b) => String(a.displayName).localeCompare(String(b.displayName), 'ar'));
}

export const contentService = Object.freeze({
  listSubjects: () => [...subjects],
  getSubject: id => subjects.find(subject => subject.id === id) ?? null,
  listAnnouncements: () => [...announcements],
  watchPublicTeachers(onData, onError = () => {}) {
    try {
      const publicQuery = query(
        collection(getDatabase(), 'publicTeachers'),
        where('published', '==', true)
      );
      return onSnapshot(publicQuery, snapshot => {
        const records = snapshot.docs.map(document => ({
          id: document.id,
          displayName: document.get('displayName'),
          subjectName: document.get('subjectName')
        }));
        onData(sortByName(records));
      }, onError);
    } catch (error) {
      onError(error);
      return () => {};
    }
  }
});
