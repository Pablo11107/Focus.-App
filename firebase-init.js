// firebase-init.js
// Módulo compartido por todas las páginas de FOCUS.
// Aquí vive la configuración de Firebase y las funciones de ayuda
// para autenticación y guardado/lectura de datos en Firestore.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  arrayUnion,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =======================================================
// 1) PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE
//    (Firebase console > Configuración del proyecto > Tus apps > SDK config)
// =======================================================
const firebaseConfig = {
  apiKey: "AIzaSyBk0VfN4BATPOuMIB44zTOhSNya1q6uHd4",
  authDomain: "focus-app-2746d.firebaseapp.com",
  projectId: "focus-app-2746d",
  storageBucket: "focus-app-2746d.firebasestorage.app",
  messagingSenderId: "940097371366",
  appId: "1:940097371366:web:53efc673e5b563045b8f27"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// =======================================================
// Utilidad: redimensiona/comprime una imagen antes de guardarla.
// Firestore rechaza documentos de más de 1MB, así que cualquier
// foto tomada con el móvil (varios MB) hay que reducirla primero.
// =======================================================
export function resizeImageFile(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// =======================================================
// Directorio de usuarios (colección "profiles")
//
// Para invitar a alguien a un chat necesitamos traducir su email
// a un uid. Antes esto se hacía con una query sobre "users", lo que
// obligaba a dejar TODA la colección users legible por cualquier
// usuario autenticado (hábitos, minutos, foto de perfil, el motivo
// del legacy... todo).
//
// Ahora hay una colección aparte, profiles, donde el ID del documento
// es el SHA-256 del email y el contenido es solo { uid }. Al ser una
// lectura directa por ID (no una query), las reglas pueden prohibir
// listar la colección: nadie puede descargarse tus emails.
// =======================================================

export function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

// SHA-256 en hexadecimal minúsculas. crypto.subtle requiere https
// (o localhost), que es justo donde corre la app en Firebase Hosting.
export async function emailHash(email) {
  const bytes = new TextEncoder().encode(normalizeEmail(email));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Deja el documento de profiles al día. Se llama desde requireAuth().
// Solo escribe la primera vez por (uid, email) gracias al sello en
// localStorage: antes esto era un write en Firestore en CADA carga de
// página de CADA usuario, y eso se paga.
async function syncProfile(user) {
  const email = normalizeEmail(user.email);
  if (!email) return;

  const stamp = `focus:profile:${user.uid}:${email}`;
  try {
    if (localStorage.getItem(stamp)) return;
  } catch (_) {
    // Modo incógnito estricto o storage bloqueado: seguimos y escribimos.
  }

  const hash = await emailHash(email);
  await setDoc(doc(db, "users", user.uid), { email }, { merge: true });
  await setDoc(doc(db, "profiles", hash), { uid: user.uid });

  try {
    localStorage.setItem(stamp, "1");
  } catch (_) {}
}

// Borra la entrada del directorio. Úsalo al eliminar la cuenta,
// ANTES de deleteUser() (después ya no hay permisos para borrarlo).
export async function deleteProfileEntry(user) {
  const email = normalizeEmail(user.email);
  if (!email) return;
  const hash = await emailHash(email);
  await deleteDoc(doc(db, "profiles", hash));
  try {
    localStorage.removeItem(`focus:profile:${user.uid}:${email}`);
  } catch (_) {}
}

// =======================================================
// Autenticación
// =======================================================

// Espera a saber si hay usuario logueado.
// Si NO lo hay, redirige a login.html.
// Si lo hay pero se registró con contraseña y NO ha verificado
// su email, lo manda a verify-email.html (candado global de la app).
// Si todo está bien, devuelve el objeto user.
export function requireAuth() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        // Exigir email verificado a los usuarios de email+contraseña.
        // (Google ya verifica el email por su cuenta, así que se salta este paso.)
        const usaPassword = user.providerData.some(p => p.providerId === "password");
        if (usaPassword && !user.emailVerified) {
          window.location.href = "verify-email.html";
          return;
        }

        // Registramos al usuario en el directorio para que puedan invitarlo
        // a un chat por email. No es crítico: si falla, la app sigue.
        try {
          await syncProfile(user);
        } catch (err) {
          console.error("No se pudo sincronizar el perfil del usuario:", err);
        }
        resolve(user);
      } else {
        window.location.href = "login.html";
      }
    });
  });
}

export function logout() {
  return signOut(auth).then(() => {
    window.location.href = "login.html";
  });
}

// =======================================================
// Login social: Google
// Google ya verifica el email por su cuenta, así que sus
// usuarios entran directos sin paso de verificación.
// =======================================================

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

// =======================================================
// Documento principal del usuario
// (guarda: profileInfo, timeSpent)
// =======================================================

export async function loadUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : {};
}

export async function saveUserDoc(uid, partialData) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, partialData, { merge: true });
}

// =======================================================
// Subcolecciones: posts (Socialclub), photos (Memories), chats (Communities)
// Cada usuario tiene su propia subcolección privada:
//   users/{uid}/posts
//   users/{uid}/photos
//   users/{uid}/chats
// =======================================================

export async function addItem(uid, subcollection, data) {
  const colRef = collection(db, "users", uid, subcollection);
  const docRef = await addDoc(colRef, { ...data, createdAt: serverTimestamp() });
  return docRef.id;
}

// Guarda (o sobreescribe) un ítem usando una clave de fecha como ID del documento.
// Así solo puede existir un elemento por día (p.ej. una foto de Memories al día).
export async function setDatedItem(uid, subcollection, dateKey, data) {
  const ref = doc(db, "users", uid, subcollection, dateKey);
  await setDoc(ref, { ...data, dateKey, createdAt: serverTimestamp() }, { merge: true });
  return dateKey;
}

export async function getItems(uid, subcollection, max = 20) {
  const colRef = collection(db, "users", uid, subcollection);
  const q = query(colRef, orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteItem(uid, subcollection, itemId) {
  await deleteDoc(doc(db, "users", uid, subcollection, itemId));
}

// =======================================================
// Socialclub — feed GLOBAL y compartido entre usuarios
// (colección de nivel superior, no una subcolección privada)
//   posts/{postId}
//   posts/{postId}/likes/{uid}
//   posts/{postId}/reposts/{uid}
//   users/{uid}/saved/{postId}   -> guardados, son privados de cada usuario
// =======================================================

// =======================================================
// Control de frecuencia (rate limiting)
//
// Modelo de ventana con cupo, igual que X / Slack / Discord: tienes N
// acciones por ventana y puedes gastarlas seguidas. Nada de esperar un
// tiempo fijo entre acción y acción, que es lo que molesta al usuario
// real sin frenar de verdad al que abusa.
//
// El documento vive en throttles/{uid}/actions/{action} y las reglas de
// Firestore son las que validan la transición: aquí solo proponemos el
// siguiente estado. Si el cupo está agotado, Firestore rechaza la
// escritura y lanzamos un error con code = "rate-limited".
// =======================================================

const LIMITS = {
  post: {
    windowMs: 60 * 60 * 1000,   // 1 hora
    max: 10,
    message: "You've posted a lot this hour. Give it a few minutes and try again."
  },
  msg: {
    windowMs: 60 * 1000,        // 1 minuto
    max: 30,
    message: "Slow down a little — that's a lot of messages at once."
  }
};

function rateLimitError(action) {
  const err = new Error(LIMITS[action].message);
  err.code = "rate-limited";
  err.userMessage = LIMITS[action].message;
  return err;
}

// Reserva un turno. Lanza error "rate-limited" si el cupo está agotado.
export async function claimSlot(uid, action) {
  const cfg = LIMITS[action];
  if (!cfg) return;

  const ref = doc(db, "throttles", uid, "actions", action);
  const fresh = () => ({
    windowStart: serverTimestamp(),
    at: serverTimestamp(),
    count: 1
  });

  let payload = fresh();
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data();
      const startMs = d.windowStart?.toMillis?.() ?? 0;
      // ¿Seguimos dentro de la ventana? Entonces sumamos uno.
      if (Date.now() - startMs <= cfg.windowMs) {
        payload = {
          windowStart: d.windowStart,
          at: serverTimestamp(),
          count: (d.count || 0) + 1
        };
      }
    }
  } catch (_) {
    // Si no podemos leer el estado, probamos con ventana nueva.
  }

  try {
    await setDoc(ref, payload);
    return;
  } catch (err) {
    if (err.code !== "permission-denied") throw err;
  }

  // El reloj del navegador y el del servidor pueden discrepar justo en
  // el borde de la ventana. Reintentamos una vez con ventana nueva:
  // si el cupo está realmente agotado, esto también se deniega.
  try {
    await setDoc(ref, fresh());
  } catch (err) {
    if (err.code === "permission-denied") throw rateLimitError(action);
    throw err;
  }
}

export async function createPost(uid, author, data) {
  await claimSlot(uid, "post");
  const colRef = collection(db, "posts");
  const docRef = await addDoc(colRef, {
    authorId: uid,
    authorName: author.name,
    authorAvatar: author.avatar || null,
    text: data.text,
    image: data.image || null,
    book: data.book || null,
    likesCount: 0,
    repostsCount: 0,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function getFeedPosts(max = 30) {
  const colRef = collection(db, "posts");
  const q = query(colRef, orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Comprueba si el usuario actual ya dio like / repost / guardó un post concreto
export async function getUserInteractions(postId, uid) {
  const [likeSnap, repostSnap, savedSnap] = await Promise.all([
    getDoc(doc(db, "posts", postId, "likes", uid)),
    getDoc(doc(db, "posts", postId, "reposts", uid)),
    getDoc(doc(db, "users", uid, "saved", postId))
  ]);
  return {
    liked: likeSnap.exists(),
    reposted: repostSnap.exists(),
    saved: savedSnap.exists()
  };
}

export async function toggleLike(postId, uid, currentlyLiked) {
  const likeRef = doc(db, "posts", postId, "likes", uid);
  const postRef = doc(db, "posts", postId);
  if (currentlyLiked) {
    await deleteDoc(likeRef);
    await updateDoc(postRef, { likesCount: increment(-1) });
  } else {
    await setDoc(likeRef, { createdAt: serverTimestamp() });
    await updateDoc(postRef, { likesCount: increment(1) });
  }
}

export async function toggleRepost(postId, uid, currentlyReposted, postSnapshot) {
  const repostRef = doc(db, "posts", postId, "reposts", uid);
  const postRef = doc(db, "posts", postId);
  const mirrorRef = doc(db, "users", uid, "reposted", postId);
  if (currentlyReposted) {
    await deleteDoc(repostRef);
    await deleteDoc(mirrorRef);
    await updateDoc(postRef, { repostsCount: increment(-1) });
  } else {
    await setDoc(repostRef, { createdAt: serverTimestamp() });
    await setDoc(mirrorRef, { ...postSnapshot, createdAt: serverTimestamp() });
    await updateDoc(postRef, { repostsCount: increment(1) });
  }
}

export async function toggleSave(uid, postId, postData, currentlySaved) {
  const savedRef = doc(db, "users", uid, "saved", postId);
  if (currentlySaved) {
    await deleteDoc(savedRef);
  } else {
    await setDoc(savedRef, { ...postData, createdAt: serverTimestamp() });
  }
}

// Todos los posts publicados por un usuario concreto (para su perfil)
export async function getUserPosts(uid) {
  const colRef = collection(db, "posts");
  const q = query(colRef, where("authorId", "==", uid));
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  docs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  return docs;
}

// =======================================================
// Communities — chats REALES y compartidos entre usuarios
//   chats/{chatId}                  -> { name, members: [uid...], avatar, lastMessage, lastMessageAt }
//   chats/{chatId}/messages/{msgId} -> { senderId, senderName, senderAvatar, text, createdAt }
// =======================================================

export async function createChat(uid, name) {
  const colRef = collection(db, "chats");
  const docRef = await addDoc(colRef, {
    name,
    members: [uid],
    avatar: null,
    createdBy: uid,
    createdAt: serverTimestamp(),
    lastMessage: "",
    lastMessageAt: serverTimestamp()
  });
  return docRef.id;
}

// Escucha en tiempo real todos los chats de los que el usuario es miembro
export function listenToUserChats(uid, callback) {
  const colRef = collection(db, "chats");
  const q = query(colRef, where("members", "array-contains", uid));
  return onSnapshot(q, (snap) => {
    const chats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    chats.sort((a, b) => (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0));
    callback(chats);
  });
}

// Busca a un usuario de FOCUS por su email (para invitarlo a un chat).
// Lectura directa por ID contra profiles/{sha256(email)}: una sola
// operación, sin índices, y sin exponer nada más que el uid.
export async function findUserByEmail(email) {
  const clean = normalizeEmail(email);
  if (!clean) return null;
  const snap = await getDoc(doc(db, "profiles", await emailHash(clean)));
  if (!snap.exists()) return null;
  return { uid: snap.data().uid };
}

export async function inviteToChat(chatId, inviteeUid) {
  const chatRef = doc(db, "chats", chatId);
  await updateDoc(chatRef, { members: arrayUnion(inviteeUid) });
}

export async function updateChatAvatar(chatId, avatarUrl) {
  await updateDoc(doc(db, "chats", chatId), { avatar: avatarUrl });
}

// Escucha en tiempo real los mensajes de un chat concreto
export function listenToMessages(chatId, callback) {
  const colRef = collection(db, "chats", chatId, "messages");
  const q = query(colRef, orderBy("createdAt", "asc"), limit(200));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function sendMessage(chatId, sender, text) {
  await claimSlot(sender.uid, "msg");
  const colRef = collection(db, "chats", chatId, "messages");
  await addDoc(colRef, {
    senderId: sender.uid,
    senderName: sender.name,
    senderAvatar: sender.avatar || null,
    text,
    createdAt: serverTimestamp()
  });
  await updateDoc(doc(db, "chats", chatId), {
    lastMessage: text,
    lastMessageAt: serverTimestamp()
  });
}
