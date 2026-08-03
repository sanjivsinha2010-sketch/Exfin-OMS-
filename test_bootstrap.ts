import { bootstrapFirebase } from './src/lib/firebaseService';
async function test() {
  try {
    await bootstrapFirebase();
    console.log("Bootstrap complete");
  } catch(e) {
    console.error("Bootstrap error:", e);
  }
}
test();
