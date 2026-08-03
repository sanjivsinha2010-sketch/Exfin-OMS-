import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, getDoc, doc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
const firebaseConfig = {
  projectId: "exfin-oms",
  appId: "1:493336845539:web:20fcfd48b6ecc8efd4b9d6",
  apiKey: "AIzaSyBsfMBLEMGjSaiCHhh1D68F2XQ78wXLBMw",
  authDomain: "exfin-oms.firebaseapp.com",
  storageBucket: "exfin-oms.firebasestorage.app",
  messagingSenderId: "493336845539"
};
async function test() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  try {
    const cred = await signInWithEmailAndPassword(auth, "sanjivsinha2010@gmail.com", "Admin@123456");
    console.log("Signed in:", cred.user.uid);
    const snap = await getDocs(collection(db, 'appSettings'));
    console.log("Settings size:", snap.size);
  } catch(e) {
    console.log("Settings Error:", e.message);
  }
}
test();
