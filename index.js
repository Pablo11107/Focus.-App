/**
 * FOCUS — Backend de pagos con Stripe.
 *
 * Sustituye a la extensión "Run Payments with Stripe", que no sirve
 * para este proyecto por dos motivos:
 *   1. Usa Cloud Functions de 1ª generación, y sus disparadores de
 *      Firestore NO admiten bases multirregión europeas (eur3).
 *   2. Las extensiones de Firebase se retiran en marzo de 2027.
 *
 * Aquí usamos 2ª generación en europe-west1 y, sobre todo, NINGÚN
 * disparador de Firestore: dos funciones "callable" (las llama la app
 * directamente) y un webhook HTTP (lo llama Stripe). Así el problema
 * de la región desaparece por completo.
 *
 * El navegador nunca decide quién es premium: solo el webhook, que
 * viene firmado por Stripe, escribe el estado en Firestore.
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const Stripe = require("stripe");

// Misma región que Firestore (eur3 / Europa).
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

// Secretos: se guardan cifrados en Secret Manager, nunca en el código.
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

initializeApp();
const db = getFirestore();

const stripeClient = (key) => new Stripe(key, { apiVersion: "2024-06-20" });

/** Devuelve el customer de Stripe del usuario, creándolo si no existe. */
async function getOrCreateCustomer(stripe, uid, email) {
  const ref = db.collection("customers").doc(uid);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data().stripeCustomerId : null;
  if (existing) return existing;

  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: { firebaseUID: uid }
  });
  await ref.set({ stripeCustomerId: customer.id, email: email || null }, { merge: true });
  return customer.id;
}

/* =========================================================
   1) createCheckoutSession — la app la llama al pulsar un plan.
   Devuelve la URL de Stripe Checkout (tarjeta, Apple Pay,
   Google Pay y Link se muestran solos según el dispositivo).
   ========================================================= */
exports.createCheckoutSession = onCall(
  { secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

    const { priceId, successUrl, cancelUrl } = request.data || {};
    if (!priceId) throw new HttpsError("invalid-argument", "Falta el priceId.");

    const stripe = stripeClient(STRIPE_SECRET_KEY.value());
    const customerId = await getOrCreateCustomer(stripe, uid, request.auth.token.email);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,          // cupones para early adopters
      client_reference_id: uid,
      subscription_data: { metadata: { firebaseUID: uid } },
      success_url: successUrl,
      cancel_url: cancelUrl
    });

    return { url: session.url };
  }
);

/* =========================================================
   2) createPortalLink — portal de Stripe: cambiar tarjeta,
   cancelar, descargar facturas.
   ========================================================= */
exports.createPortalLink = onCall(
  { secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

    const snap = await db.collection("customers").doc(uid).get();
    const customerId = snap.exists ? snap.data().stripeCustomerId : null;
    if (!customerId) throw new HttpsError("not-found", "No hay suscripción que gestionar.");

    const stripe = stripeClient(STRIPE_SECRET_KEY.value());
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: request.data?.returnUrl
    });
    return { url: session.url };
  }
);

/* =========================================================
   3) stripeWebhook — Stripe avisa aquí de todo lo que pasa.
   Es el ÚNICO sitio donde se escribe el estado premium.
   ========================================================= */
exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET], cors: false },
  async (req, res) => {
    const stripe = stripeClient(STRIPE_SECRET_KEY.value());

    let event;
    try {
      // rawBody es imprescindible: la firma se calcula sobre los bytes.
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        req.headers["stripe-signature"],
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      console.error("Firma de webhook inválida:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          if (session.mode === "subscription" && session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription);
            await saveSubscription(sub);
          }
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          await saveSubscription(event.data.object);
          break;
        }
        default:
          break; // el resto de eventos no nos afectan
      }
      res.json({ received: true });
    } catch (err) {
      console.error("Error procesando webhook:", err);
      res.status(500).send("Error interno");
    }
  }
);

/** Escribe/actualiza el estado de la suscripción en Firestore. */
async function saveSubscription(sub) {
  // El uid viaja en los metadatos; si faltara, lo buscamos por customer.
  let uid = sub.metadata?.firebaseUID;
  if (!uid) {
    const q = await db.collection("customers")
      .where("stripeCustomerId", "==", sub.customer).limit(1).get();
    if (q.empty) {
      console.error("No se encontró el usuario del customer", sub.customer);
      return;
    }
    uid = q.docs[0].id;
  }

  const active = ["active", "trialing"].includes(sub.status);
  await db.collection("customers").doc(uid).set({
    stripeCustomerId: sub.customer,
    premium: active,
    status: sub.status,
    subscriptionId: sub.id,
    priceId: sub.items?.data?.[0]?.price?.id || null,
    currentPeriodEnd: sub.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}
