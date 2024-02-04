import url from 'url';
import path from 'path';
import dotenv from 'dotenv';  
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));  
dotenv.config({ path: path.join(__dirname, '.env') });  

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseJson from './firebase.json' assert { type: 'json' };  

if (process.env.NODE_ENV === 'localhost') {  
  process.env.DOMAIN = 'http://localhost:8080';  
  process.env.FIRESTORE_EMULATOR_HOST = `${firebaseJson.emulators.firestore.host}:${firebaseJson.emulators.firestore.port}`;  
}  

initializeApp();  
const store = getFirestore(process.env.FIRESTORE_DATABASENAME);  
store.settings({ ignoreUndefinedProperties: true });  

export {__dirname, store }
