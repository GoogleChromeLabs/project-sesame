/*
 * @license
 * Copyright 2024 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License
 */

import url from 'url';
import path from 'path';
import dotenv from 'dotenv';  
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));  
dotenv.config({ path: path.join(__dirname, '.env') });  

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseJson from '../firebase.json' assert { type: 'json' };  

if (process.env.NODE_ENV === 'localhost') {  
  process.env.DOMAIN = 'http://localhost:8080';  
  process.env.FIRESTORE_EMULATOR_HOST = `${firebaseJson.emulators.firestore.host}:${firebaseJson.emulators.firestore.port}`;  
}  

initializeApp();  
const store = getFirestore(process.env.FIRESTORE_DATABASENAME);  
store.settings({ ignoreUndefinedProperties: true });  

export {__dirname, store }
