// =======================================================
// FOCUS · NOTIFICACIONES (cliente)
// - Pide permiso en el momento adecuado (nunca al aterrizar)
// - Registra el token FCM y lo guarda en el perfil del usuario
// - Guarda zona horaria y preferencias para que las Cloud
//   Functions envíen a la hora local correcta
// - Limpia el badge del icono al abrir la app
//
// REQUISITO iOS: las push solo funcionan si la PWA está añadida
// a la pantalla de inicio (iOS 16.4+). Si no lo está, el prompt
// se convierte en una guía de instalación.
//
// CONFIGURACIÓN: pega tu clave VAPID pública abajo (Firebase
// console → Configuración del proyecto → Cloud Messaging →
// Certificados push web → Generar par de claves).
// =======================================================

import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
import { db } from "./firebase-init.js";
import { doc, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ⚠️ PEGA AQUÍ TU CLAVE VAPID PÚBLICA (empieza por "B...")
const VAPID_KEY = "PEGA_AQUI_TU_VAPID_KEY";

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

// ---------- Estilos del prompt (coherentes con FOCUS) ----------
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const tag = document.createElement("style");
  tag.textContent = `
  .notif-card{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 88px);transform:translateX(-50%) translateY(20px);width:min(92vw,360px);background:linear-gradient(180deg,#2F2E37,#100F19);border:1px solid rgba(212,175,109,.35);border-radius:18px;padding:1.1rem 1.2rem;color:#fff;z-index:1400;opacity:0;pointer-events:none;transition:opacity .35s ease,transform .35s cubic-bezier(.22,1,.36,1);box-shadow:0 18px 44px rgba(0,0,0,.5);}
  .notif-card.open{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0);}
  .notif-card h4{margin:0 0 .35rem;font-size:1rem;font-weight:700;}
  .notif-card p{margin:0 0 .8rem;font-size:.82rem;line-height:1.5;color:rgba(255,255,255,.72);}
  .notif-card p b{color:#D4AF6D;font-weight:600;}
  .notif-row{display:flex;gap:.6rem;}
  .notif-btn{flex:1;border:none;border-radius:11px;padding:.65rem .8rem;font-size:.85rem;font-weight:700;cursor:pointer;font-family:inherit;}
  .notif-btn.gold{background:#D4AF6D;color:#100F19;}
  .notif-btn.ghost{background:rgba(255,255,255,.08);color:rgba(255,255,255,.8);}
  .notif-toast{position:fixed;top:calc(env(safe-area-inset-top,0px) + 12px);left:50%;transform:translateX(-50%) translateY(-8px);width:min(92vw,380px);background:#22212D;border:1px solid rgba(212,175,109,.4);border-radius:14px;padding:.8rem 1rem;color:#fff;z-index:1300;opacity:0;pointer-events:none;transition:opacity .3s,transform .3s;box-shadow:0 12px 30px rgba(0,0,0,.5);}
  .notif-toast.open{opacity:1;transform:translateX(-50%) translateY(0);}
  .notif-toast b{display:block;font-size:.85rem;margin-bottom:.15rem;}
  .notif-toast span{font-size:.78rem;color:rgba(255,255,255,.7);}`;
  document.head.appendChild(tag);
}

// ---------- Guardado del token y metadatos ----------
async function saveTokenToProfile(uid, token) {
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || "Europe/Madrid";
  await setDoc(doc(db, "users", uid), {
    fcm: {
      tokens: arrayUnion(token),
      tz,
      updatedAt: Date.now()
    },
    notifPrefs: {
      // Preferencias por defecto: todo activado. Las Cloud
      // Functions las respetan; una futura pantalla de ajustes
      // podrá desactivarlas una a una.
      streak: true, milestones: true, photo: true,
      wrap: true, pact: true, study: true, winback: true
    }
  }, { merge: true });
}

// ---------- Activación real (requiere gesto del usuario) ----------
async function enablePush(uid, swRegistration) {
  
  const permission = await Notification.requestPermission();
  
  if (permission !== "granted") return { ok: false, reason: permission };
  
  const messaging = getMessaging();
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: swRegistration
  });
  if (!token) { return { ok: false, reason: "no-token" }; }
  
  await saveTokenToProfile(uid, token);
  
  // Mensajes recibidos con la app ABIERTA: toast discreto dentro
  // de la app (el sistema no los muestra en primer plano).
  onMessage(messaging, (payload) => {
    const d = payload.data || {};
    showInAppToast(d.title || "FOCUS", d.body || "");
  });
  return { ok: true };
}

function showInAppToast(title, body) {
  injectStyles();
  const t = document.createElement("div");
  t.className = "notif-toast";
  t.innerHTML = `<b></b><span></span>`;
  t.querySelector("b").textContent = title;
  t.querySelector("span").textContent = body;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("open"));
  setTimeout(() => { t.classList.remove("open"); setTimeout(() => t.remove(), 350); }, 4500);
}

// ---------- Prompt inteligente ----------
// Solo aparece si: hay soporte, el permiso está sin decidir, el
// usuario ya vivió un "momento de valor" (lo decide index.html al
// llamarlo), y no lo descartó en los últimos 7 días.
const DISMISS_KEY = "focusNotifPromptDismissedAt";

export async function maybePromptForNotifications(uid, { swRegistration, force = false } = {}) {
  try {
    // ORDEN IMPORTANTE: en Safari de iOS (sin instalar) la API
    // Notification NO EXISTE, así que hay que detectar ese caso
    // ANTES de comprobar la API — si no, salíamos en silencio sin
    // enseñar siquiera la guía de instalación.
    
    if (isIOS && !isStandalone) { showInstallCard(force); return; }
    if (!("Notification" in window)) {
      
      if (force) showInAppToast("Este dispositivo no admite avisos", "En iPhone se necesita iOS 16.4 o superior y la app instalada.");
      return;
    }
    if (Notification.permission === "granted") {
      
      registerSilently(uid, swRegistration);
      if (force) showInAppToast("Avisos ya activados \u2713", "Todo en orden: llegar\u00e1n cuando toque.");
      return;
    }
    if (Notification.permission === "denied") {
      
      if (force) showInAppToast("Avisos bloqueados en el sistema", "Act\u00edvalos en Ajustes \u2192 Notificaciones \u2192 Focus.");
      return;
    }
    if (!(await isSupported().catch(() => false))) {
      
      if (force) showInAppToast("Avisos no disponibles", "Tu versi\u00f3n de iOS no admite push web (se necesita 16.4+).");
      return;
    }
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
    // La tarjeta automática reaparece cada 24h (antes 7 días): el
    // usuario pidió que la invitación sea proactiva.
    if (!force && Date.now() - dismissed < 24 * 3600 * 1000) return;
    if (document.querySelector(".notif-card")) return; // ya hay uno en pantalla

    
    injectStyles();
    const card = document.createElement("div");
    card.className = "notif-card";
    card.innerHTML = `
      <h4>&#128293; Que la racha no muera en silencio</h4>
      <p>Un aviso <b>a tiempo</b> el d&iacute;a que se te olvida, tu resumen del lunes y el veredicto de tu pacto. <b>M&aacute;ximo uno al d&iacute;a</b>, en tu horario. Sin spam: solo lo que salva rachas.</p>
      <div class="notif-row">
        <button class="notif-btn ghost" id="notifLater">Ahora no</button>
        <button class="notif-btn gold" id="notifEnable">Activar avisos</button>
      </div>`;
    document.body.appendChild(card);
    requestAnimationFrame(() => card.classList.add("open"));

    const close = () => { card.classList.remove("open"); setTimeout(() => card.remove(), 350); };
    card.querySelector("#notifLater").addEventListener("click", () => {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
      close();
    });
    card.querySelector("#notifEnable").addEventListener("click", async () => {
      // El click ES el gesto de usuario que iOS exige para pedir permiso
      const res = await enablePush(uid, swRegistration).catch(err => ({ ok: false, reason: String(err) }));
      close();
      if (res.ok) showInAppToast("Avisos activados \u2713", "Estaremos ah\u00ed cuando la racha lo necesite.");
      else if (res.reason === "denied") showInAppToast("Avisos bloqueados", "Puedes activarlos desde los ajustes del sistema cuando quieras.");
    });
  } catch (err) {
    console.warn("Notificaciones:", err);
  }
}

// Si el permiso ya estaba concedido (sesiones anteriores), refresca
// el token en silencio: los tokens FCM caducan y rotan.
async function registerSilently(uid, swRegistration) {
  try {
    if (!(await isSupported().catch(() => false))) return;
    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swRegistration });
    if (token) await saveTokenToProfile(uid, token);
    onMessage(messaging, (payload) => {
      const d = payload.data || {};
      showInAppToast(d.title || "FOCUS", d.body || "");
    });
  } catch (err) { console.warn("Refresco de token:", err); }
}

// Guía de instalación para iOS sin PWA instalada
function showInstallCard(force = false) {
  const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
  if (!force && Date.now() - dismissed < 7 * 24 * 3600 * 1000) return;
  if (document.querySelector(".notif-card")) return;
  injectStyles();
  const card = document.createElement("div");
  card.className = "notif-card";
  card.innerHTML = `
    <h4>&#128241; Instala FOCUS para recibir avisos</h4>
    <p>En iPhone, los avisos de racha solo funcionan con la app instalada: toca <b>Compartir</b> &rarr; <b>A&ntilde;adir a pantalla de inicio</b>. Tarda 10 segundos y FOCUS se abre a pantalla completa.</p>
    <div class="notif-row">
      <button class="notif-btn gold" id="notifGotIt">Entendido</button>
    </div>`;
  document.body.appendChild(card);
  requestAnimationFrame(() => card.classList.add("open"));
  card.querySelector("#notifGotIt").addEventListener("click", () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    card.classList.remove("open"); setTimeout(() => card.remove(), 350);
  });
}

// ---------- Badge del icono ----------
// Al abrir la app, el badge deja de tener sentido: se limpia.
export function clearAppBadge() {
  if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
}
