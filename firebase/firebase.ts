import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'; 

const firebaseConfig = {
  apiKey: "AIzaSyBtKoaEqlgS4jaFZSHL12RdNYzkhUBD864",
  authDomain: "cadetlinks2.firebaseapp.com",
  projectId: "cadetlinks2",
  storageBucket: "cadetlinks2.firebasestorage.app",
  messagingSenderId: "408734276561",
  appId: "1:408734276561:web:84d4a5684cf701aa599ef0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); 