// ==========================================================
// FOCUS PREMIUM — sistema de suscripción con Stripe.
//
// ┌────────────────────────────────────────────────────────┐
// │  EL INTERRUPTOR: cambia esta línea y ya está.          │
// │                                                        │
// │    PREMIUM_ENABLED = false  → app 100% gratis          │
// │      (modo actual, para los early adopters: no se      │
// │       muestra ningún muro, ningún botón, nada)         │
// │                                                        │
// │    PREMIUM_ENABLED = true   → se activa el muro en     │
// │      "Yo futuro" y "Mentor.", el botón de suscripción  │
// │      en ajustes, y el checkout de Stripe               │
// └────────────────────────────────────────────────────────┘
export const PREMIUM_ENABLED = true;   // ← ponlo en false cuando termines de probar

// IDs de precio de Stripe (se crean en el dashboard de Stripe,
// ver PREMIUM-SETUP.md, paso 3). Sustituir por los reales:
const STRIPE_PRICES = {
  monthly: "price_1TzOH8CCPVnUJQNK1xe0DEzR",   // 2,99 €/mes
  yearly:  "price_1TzOIHCCPVnUJQNKIcDUAOSM"    // 19,99 €/año (−44%)
};

// Región de las Cloud Functions de la extensión. DEBE coincidir con la
// elegida al instalarla: europe-west1, porque tu Firestore está en eur3
// (Europa) y las funciones que escuchan Firestore deben vivir a su lado.
const FUNCTIONS_REGION = "europe-west1";

// ==========================================================
// A partir de aquí no hace falta tocar nada.
// Arquitectura: backend propio en Cloud Functions gen2
// (carpeta functions/), desplegado en europe-west1 junto a
// Firestore. El navegador NUNCA decide quién es premium:
//   1. Para pagar: llamamos a createCheckoutSession, que
//      devuelve la URL de Stripe Checkout (tarjeta, Apple Pay,
//      Google Pay, Link... según el dispositivo).
//   2. Stripe confirma el pago llamando a nuestro webhook, y
//      SOLO ese webhook escribe customers/{uid}.premium = true.
//   3. Aquí solo LEEMOS ese documento. Las reglas de Firestore
//      impiden que un usuario se lo escriba a sí mismo.
// ==========================================================

import { db } from "./firebase-init.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

/** Acceso a nuestras Cloud Functions, siempre en la región correcta. */
function fn(name) {
  return httpsCallable(getFunctions(undefined, FUNCTIONS_REGION), name);
}

// ---------- estado de suscripción ----------
let statusCache = null;

/** ¿Tiene el usuario una suscripción activa? (true si premium está apagado) */
export async function getPremiumStatus(uid) {
  if (!PREMIUM_ENABLED) return { premium: true, disabled: true };
  if (statusCache) return statusCache;
  try {
    const snap = await getDoc(doc(db, "customers", uid));
    const data = snap.exists() ? snap.data() : {};
    // "founder" = acceso vitalicio concedido a mano (early adopters).
    // Se comprueba aparte de "premium" para que el badge del menú de
    // ajustes pueda distinguir a un fundador de un suscriptor normal.
    statusCache = {
      premium: data.premium === true || data.founder === true,
      founder: data.founder === true,
      disabled: false
    };
  } catch (err) {
    console.error("No se pudo leer el estado premium:", err);
    // Ante la duda, no bloqueamos: mejor regalar una vista que
    // castigar a un cliente que ha pagado por un fallo de red.
    statusCache = { premium: true, disabled: false, error: true };
  }
  return statusCache;
}

/**
 * Puerta de acceso a una zona premium. Devuelve true si puede pasar;
 * si no, muestra el paywall y devuelve false.
 */
export async function requirePremium(uid) {
  if (!PREMIUM_ENABLED) return true;
  const { premium } = await getPremiumStatus(uid);
  if (premium) return true;
  openPaywall(uid);
  return false;
}

// ---------- checkout (Stripe Checkout: tarjeta, Apple Pay, Google Pay) ----------
export async function startCheckout(uid, priceKey = "monthly") {
  const { data } = await fn("createCheckoutSession")({
    priceId: STRIPE_PRICES[priceKey],
    successUrl: window.location.href,
    cancelUrl: window.location.href
  });
  window.location.assign(data.url);
}

/** Portal de facturación de Stripe: cambiar tarjeta, cancelar, facturas. */
export async function openBillingPortal() {
  const { data } = await fn("createPortalLink")({ returnUrl: window.location.href });
  window.location.assign(data.url);
}

// ---------- candados en las pestañas ----------
/**
 * Añade un 🔒 a los botones indicados si el usuario no es premium.
 * No hace nada con el premium apagado.
 */
export async function markLockedButtons(uid, buttonIds) {
  if (!PREMIUM_ENABLED) return;
  const { premium } = await getPremiumStatus(uid);
  if (premium) return;
  buttonIds.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn && !btn.querySelector(".premium-lock")) {
      const lock = document.createElement("span");
      lock.className = "premium-lock";
      lock.textContent = " 🔒";
      btn.appendChild(lock);
    }
  });
}

/**
 * Botón de suscripción para el menú de ajustes del index.
 * - premium apagado → el botón permanece oculto
 * - encendido y sin suscripción → "✨ Go Premium" (abre el paywall)
 * - encendido y suscrito → "Manage subscription" (portal de Stripe)
 */
export async function mountPremiumButton(btn, uid) {
  if (!PREMIUM_ENABLED || !btn) return;
  const { premium, founder } = await getPremiumStatus(uid);
  btn.style.display = "block";
  if (founder) {
    // Fundador: acceso de por vida, no hay suscripción que gestionar.
    btn.textContent = "★ Founder — Premium de por vida";
    btn.style.color = "#D4AF6D";
    btn.style.cursor = "default";
  } else if (premium) {
    btn.textContent = "Manage subscription";
    btn.addEventListener("click", () => openBillingPortal().catch(console.error));
  } else {
    btn.textContent = "✨ Go Premium";
    btn.addEventListener("click", () => openPaywall(uid));
  }
}

// ---------- paywall (modal) ----------
const PAYWALL_CSS = `
.paywall-overlay {
  position: fixed; inset: 0; z-index: 1500;
  background: rgba(0, 0, 10, 0.78);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem; opacity: 0; pointer-events: none; transition: opacity 0.25s ease;
}
.paywall-overlay.open { opacity: 1; pointer-events: auto; }
.paywall-card {
  width: 100%; max-width: 380px; max-height: 90vh; max-height: 90dvh;
  overflow-y: auto; background: #16141d; border: 1px solid rgba(212,175,109,0.35);
  border-radius: 20px; padding: 1.6rem 1.4rem; color: #fff;
  font-family: 'Inter', sans-serif; position: relative;
  transform: translateY(10px); transition: transform 0.25s ease;
}
.paywall-overlay.open .paywall-card { transform: translateY(0); }
.paywall-close {
  position: absolute; top: 0.8rem; right: 0.9rem; background: none; border: none;
  color: #888; font-size: 1.1rem; cursor: pointer; padding: 0.3rem;
}
.paywall-close:hover { color: #fff; }
.paywall-eyebrow {
  font-size: 0.68rem; font-weight: 800; letter-spacing: 0.14em;
  text-transform: uppercase; color: #D4AF6D;
}
.paywall-title { font-size: 1.35rem; font-weight: 700; margin: 0.35rem 0 0.9rem; }
.paywall-benefits { list-style: none; margin: 0 0 1.2rem; padding: 0; display: flex; flex-direction: column; gap: 0.55rem; }
.paywall-benefits li { font-size: 0.86rem; color: #ddd; line-height: 1.45; padding-left: 1.4rem; position: relative; }
.paywall-benefits li::before { content: "✦"; position: absolute; left: 0; color: #D4AF6D; }
.paywall-plans { display: flex; flex-direction: column; gap: 0.6rem; }
.paywall-plan {
  display: flex; align-items: center; justify-content: space-between; gap: 0.8rem;
  width: 100%; background: #201d29; border: 2px solid #2f2c39; border-radius: 14px;
  padding: 0.85rem 1rem; cursor: pointer; color: #fff; font-family: inherit;
  transition: border-color 0.2s, background 0.2s; text-align: left;
}
.paywall-plan:hover { border-color: #D4AF6D; }
.paywall-plan:disabled { opacity: 0.6; cursor: wait; }
.paywall-plan .plan-name { font-size: 0.92rem; font-weight: 700; }
.paywall-plan .plan-sub { font-size: 0.72rem; color: #999; margin-top: 0.1rem; }
.paywall-plan .plan-price { font-size: 1.05rem; font-weight: 800; white-space: nowrap; }
.paywall-plan.best { border-color: rgba(212,175,109,0.65); background: rgba(212,175,109,0.07); }
.plan-badge {
  display: inline-block; background: #D4AF6D; color: #100F19; font-size: 0.6rem;
  font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;
  border-radius: 999px; padding: 0.15rem 0.5rem; margin-left: 0.45rem; vertical-align: middle;
}
.paywall-paymethods {
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  margin-top: 1rem; font-size: 0.72rem; color: #888; flex-wrap: wrap;
}
.paywall-paymethods span { background: #201d29; border-radius: 8px; padding: 0.3rem 0.55rem; }
.paywall-fineprint { font-size: 0.68rem; color: #777; text-align: center; margin-top: 0.9rem; line-height: 1.5; }
.paywall-fineprint a { color: #D4AF6D; cursor: pointer; text-decoration: underline; }
.paywall-error { color: #ff6b6b; font-size: 0.76rem; text-align: center; min-height: 1rem; margin-top: 0.5rem; }
`;

let paywallEl = null;

function ensurePaywall(uid) {
  if (paywallEl) return paywallEl;

  const style = document.createElement("style");
  style.id = "premium-paywall-styles";
  style.textContent = PAYWALL_CSS;
  document.head.appendChild(style);

  paywallEl = document.createElement("div");
  paywallEl.className = "paywall-overlay";
  paywallEl.innerHTML = `
    <div class="paywall-card" role="dialog" aria-modal="true" aria-label="FOCUS Premium">
      <button class="paywall-close" aria-label="Cerrar">✕</button>
      <div class="paywall-eyebrow">Focus Premium</div>
      <div class="paywall-title">Tu historia completa, con toda la profundidad</div>
      <ul class="paywall-benefits">
        <li><strong>Yo futuro</strong> — retrato psicológico, proyecciones a 90 días, índice de fuerza del hábito, autoeficacia y perseverancia.</li>
        <li><strong>Mentor</strong> — consultas ilimitadas construidas con tus datos reales y respaldo científico.</li>
        <li><strong>Y lo que viene</strong> — la IA conversacional de FOCUS será premium desde el día uno.</li>
      </ul>
      <div class="paywall-plans">
        <button class="paywall-plan best" data-plan="yearly">
          <span><span class="plan-name">Anual<span class="plan-badge">−44%</span></span>
          <span class="plan-sub">19,99 € al año · sale a 1,67 €/mes</span></span>
          <span class="plan-price">19,99 €</span>
        </button>
        <button class="paywall-plan" data-plan="monthly">
          <span><span class="plan-name">Mensual</span>
          <span class="plan-sub">Sin permanencia, cancela cuando quieras</span></span>
          <span class="plan-price">2,99 €</span>
        </button>
      </div>
      <div class="paywall-paymethods">
        <span> Apple Pay</span><span>G Pay</span><span>💳 Tarjeta</span><span>Link</span>
      </div>
      <p class="paywall-error" id="paywallError"></p>
      <p class="paywall-fineprint">
        Pago seguro gestionado por Stripe. Cancela en un clic desde
        <a id="paywallPortalLink">gestionar suscripción</a>.
        ¿Tienes un código de fundador? Introdúcelo en el siguiente paso.
        Todo lo demás en FOCUS sigue siendo gratis, siempre.
      </p>
    </div>
  `;
  document.documentElement.appendChild(paywallEl);

  paywallEl.querySelector(".paywall-close").addEventListener("click", closePaywall);
  paywallEl.addEventListener("click", (e) => { if (e.target === paywallEl) closePaywall(); });

  paywallEl.querySelectorAll(".paywall-plan").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const errEl = paywallEl.querySelector("#paywallError");
      errEl.textContent = "";
      paywallEl.querySelectorAll(".paywall-plan").forEach((b) => (b.disabled = true));
      btn.querySelector(".plan-price").textContent = "…";
      try {
        await startCheckout(uid, btn.dataset.plan);
      } catch (err) {
        console.error(err);
        errEl.textContent = "No se pudo iniciar el pago. Inténtalo de nuevo.";
        paywallEl.querySelectorAll(".paywall-plan").forEach((b) => (b.disabled = false));
        btn.querySelector(".plan-price").textContent = btn.dataset.plan === "yearly" ? "19,99 €" : "2,99 €";
      }
    });
  });

  paywallEl.querySelector("#paywallPortalLink").addEventListener("click", () => {
    openBillingPortal().catch(() => {
      paywallEl.querySelector("#paywallError").textContent =
        "Aún no tienes ninguna suscripción que gestionar.";
    });
  });

  return paywallEl;
}

export function openPaywall(uid) {
  ensurePaywall(uid).classList.add("open");
}
export function closePaywall() {
  paywallEl?.classList.remove("open");
}
