import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

// Firebase Client Configuration
export const firebaseConfig = {
  apiKey: "AIzaSyBsfMBLEMGjSaiCHhh1D68F2XQ78wXLBMw",
  authDomain: "exfin-oms.firebaseapp.com",
  projectId: "exfin-oms",
  storageBucket: "exfin-oms.firebasestorage.app",
  messagingSenderId: "493336845539",
  appId: "1:493336845539:web:20fcfd48b6ecc8efd4b9d6"
};

// Initialize Firebase
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);
export const storage = getStorage(firebaseApp);

/**
 * Uploads a base64-encoded file (Data URL format) to Firebase Storage
 * and returns the public download URL.
 * 
 * @param base64DataUrl The complete base64 data URL (e.g. data:image/png;base64,...)
 * @param storagePath The destination path inside Firebase Storage
 * @returns The resolved download URL
 */
export async function uploadBase64File(base64DataUrl: string, storagePath: string): Promise<string> {
  if (!base64DataUrl || !base64DataUrl.startsWith('data:')) {
    return base64DataUrl; // Return as-is if it is not a base64 Data URL
  }

  try {
    const fileRef = ref(storage, storagePath);

    // Extract the mime type and the raw base64 content
    const mimeTypeMatch = base64DataUrl.match(/^data:([^;]+);/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'application/octet-stream';
    const base64Content = base64DataUrl.split(',')[1];

    // Upload using standard string upload
    await uploadString(fileRef, base64Content, 'base64', {
      contentType: mimeType,
    });

    // Retrieve download URL
    return await getDownloadURL(fileRef);
  } catch (error) {
    console.error('Error uploading file to Firebase Storage:', error);
    throw error;
  }
}
