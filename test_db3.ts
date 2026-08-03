import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, getDoc, doc } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyBsfMBLEMGjSaiCHhh1D68F2XQ78wXLBMw",
  authDomain: "exfin-oms.firebaseapp.com",
  projectId: "exfin-oms",
  storageBucket: "exfin-oms.firebasestorage.app",
  messagingSenderId: "493336845539",
  appId: "1:493336845539:web:20fcfd48b6ecc8efd4b9d6"
};
async function test() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  try {
    const snap = await getDocs(collection(db, 'appSettings'));
    console.log("Settings size:", snap.size);
  } catch(e) {
    console.log("Settings Error:", e.message);
  }
}
test();
