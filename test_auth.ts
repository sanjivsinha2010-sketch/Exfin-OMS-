import { initializeApp } from "firebase/app";
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
  const auth = getAuth(app);
  try {
    const cred = await signInWithEmailAndPassword(auth, "sanjivsinha2010@gmail.com", "Admin@123456");
    console.log("Success:", cred.user.uid);
  } catch(e) {
    console.log("Error:", e.message);
  }
}
test();
