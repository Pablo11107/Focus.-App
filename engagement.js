// =======================================================
// FOCUS · CLOUD FUNCTIONS DE ENGAGEMENT
// Función programada que corre cada hora, revisa a cada usuario
// con notificaciones activadas y decide si le toca recibir algo
// — respetando su zona horaria y el límite de 1 aviso al día.
//
// PRIORIDAD (de mayor a menor): racha en peligro > última llamada
// del pacto > wrap del lunes > hito de racha > pacto jueves >
// estudio miércoles > foto pendiente > win-back.
//
// Despliegue:
//   1. Plan Blaze activado en Firebase (las funciones lo requieren;
//      con este volumen el coste es céntimos).
//   2. cd functions && npm install
//   3. firebase deploy --only functions
// =======================================================

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// El index.js principal (Stripe) probablemente ya inicializa Admin:
// solo inicializamos si nadie lo hizo antes, para no chocar.
if (getApps().length === 0) initializeApp();
const db = getFirestore();

// ---------- Utilidades de fecha en la zona del usuario ----------
function localParts(tz) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz || "Europe/Madrid",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false, weekday: "short"
  });
  const parts = {};
  fmt.formatToParts(now).forEach(p => { parts[p.type] = p.value; });
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  const dowMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { dateKey, hour: parseInt(parts.hour, 10), dow: dowMap[parts.weekday] || 1 };
}

// Lunes de la semana de una fecha local (clave del weekLog)
function weekKeyOf(dateKey, dow) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const monday = new Date(Date.UTC(y, m - 1, d - (dow - 1)));
  const mm = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(monday.getUTCDate()).padStart(2, "0");
  return `${monday.getUTCFullYear()}-${mm}-${dd}`;
}

function shiftDateKey(dateKey, deltaDays) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

// Unión de todos los días activos del weekLog → racha actual
function computeStreak(weekLog, todayKey) {
  const days = new Set();
  Object.values(weekLog || {}).forEach(w => Object.keys(w.days || {}).forEach(k => days.add(k)));
  let streak = 0;
  let cursor = days.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);
  while (days.has(cursor)) { streak++; cursor = shiftDateKey(cursor, -1); }
  return { streak, days };
}

function weekTotals(week) {
  if (!week) return { min: 0, days: 0 };
  const min = Object.values(week.mins || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  return { min, days: Object.keys(week.days || {}).length };
}

const MILESTONES = [7, 30, 66, 100, 200, 365];

// ---------- La decisión: qué aviso toca (o ninguno) ----------
function decide(user, ctx) {
  const { dateKey, hour, dow } = ctx;
  const prefs = user.notifPrefs || {};
  const weekLog = user.weekLog || {};
  const state = user.notifState || {};
  const { streak, days } = computeStreak(weekLog, dateKey);
  const wk = weekKeyOf(dateKey, dow);
  const thisWeek = weekTotals(weekLog[wk]);
  const lastWeek = weekTotals(weekLog[shiftDateKey(wk, -7)]);
  const activeToday = days.has(dateKey);

  // Días desde la última actividad (para win-back)
  let lastActive = null;
  for (let i = 0; i <= 30; i++) {
    const k = shiftDateKey(dateKey, -i);
    if (days.has(k)) { lastActive = i; break; }
  }

  // 1) RACHA EN PELIGRO — 20h local, racha ≥2 y hoy sin actividad
  if (prefs.streak !== false && hour === 20 && !activeToday && streak >= 2) {
    return {
      type: "streak-risk", badge: "1",
      title: `\u{1F525} Tu racha de ${streak} d\u00edas expira a medianoche`,
      body: "Una sesi\u00f3n de 5 minutos la salva. T\u00fa decides c\u00f3mo acaba esto.",
      tag: "focus-streak", url: "index.html"
    };
  }

  // 2) ÚLTIMA LLAMADA DEL PACTO — domingo 17h si va camino de fallar
  const pact = (user.wrapMeta || {}).pact;
  if (prefs.pact !== false && dow === 7 && hour === 17 && pact && pact.weekKey === wk) {
    const failing =
      (pact.type === "minutes" && thisWeek.min < pact.target) ||
      ((pact.type === "days" || pact.type === "hold") && thisWeek.days < pact.target);
    if (failing) {
      return {
        type: "pact-lastcall",
        title: "\u23F3 Tu pacto se decide hoy",
        body: `"${pact.label}" \u2014 ma\u00f1ana tus datos dan el veredicto. A\u00fan est\u00e1s a tiempo.`,
        tag: "focus-pact", url: "index.html"
      };
    }
  }

  // 3) WRAP LISTO — lunes 9h si la semana pasada hubo actividad
  if (prefs.wrap !== false && dow === 1 && hour === 9 && lastWeek.min > 0) {
    return {
      type: "wrap-ready",
      title: "\u{1F39E}\uFE0F Tu semana est\u00e1 lista",
      body: `${lastWeek.min} minutos que quiz\u00e1 no viste. Y un pacto esperando veredicto.`,
      tag: "focus-wrap", url: "index.html"
    };
  }

  // 4) HITO DE RACHA — 10h local el día que se alcanza
  if (prefs.milestones !== false && hour === 10 && MILESTONES.includes(streak)) {
    const sent = state.sentMilestones || [];
    if (!sent.includes(streak)) {
      const bodies = {
        7: "Una semana entera. La primera frontera est\u00e1 cruzada.",
        30: "30 d\u00edas. Esto ya no es un intento: es un h\u00e1bito tomando forma.",
        66: "66 d\u00edas: seg\u00fan la ciencia (Lally, 2010), esto ya no es esfuerzo. Es quien eres.",
        100: "100 d\u00edas. Hay gente que no aguanta 3. T\u00fa llevas 100.",
        200: "200 d\u00edas. Tu identidad y tu h\u00e1bito ya son la misma cosa.",
        365: "Un a\u00f1o entero, d\u00eda a d\u00eda. Esto ya es legado."
      };
      return {
        type: "milestone", milestone: streak,
        title: `\u{1F3C6} ${streak} d\u00edas de racha`,
        body: bodies[streak] || "Sigue.",
        tag: "focus-milestone", url: "legacy.html"
      };
    }
  }

  // 5) PACTO A MITAD DE SEMANA — jueves 19h, estado honesto
  if (prefs.pact !== false && dow === 4 && hour === 19 && pact && pact.weekKey === wk) {
    const progress = (pact.type === "minutes")
      ? `${thisWeek.min} de ${pact.target} min`
      : `${thisWeek.days} de ${pact.target} d\u00edas`;
    return {
      type: "pact-midweek",
      title: "\u{1F4CB} Tu pacto, a mitad de semana",
      body: `"${pact.label}": vas ${progress}. Quedan 4 d\u00edas \u2014 sigue vivo.`,
      tag: "focus-pact", url: "index.html"
    };
  }

  // 6) ESTUDIO NUEVO — miércoles 12h (solo usuarios activos esta semana)
  if (prefs.study !== false && dow === 3 && hour === 12 && thisWeek.days > 0) {
    return {
      type: "study",
      title: "\u{1F4DA} El estudio de esta semana ya est\u00e1 en tu Legacy",
      body: "Una investigaci\u00f3n real, aplicada a tus datos. 60 segundos de lectura.",
      tag: "focus-study", url: "legacy.html"
    };
  }

  // 7) FOTO DEL DÍA PENDIENTE — 21h si hoy hubo sesión pero no foto
  //    (la comprobación de la foto se hace fuera, es async)
  if (prefs.photo !== false && hour === 21 && activeToday) {
    return { type: "photo-check-needed" }; // marcador: resolver async
  }

  // 8) WIN-BACK — 11h local, a los 3, 7 y 14 días de ausencia
  if (prefs.winback !== false && hour === 11 && lastActive !== null) {
    const stages = { 3: "wb3", 7: "wb7", 14: "wb14" };
    const stage = stages[lastActive];
    if (stage && !(state.sentWinbacks || []).includes(stage + ":" + shiftDateKey(dateKey, -lastActive))) {
      const msgs = {
        wb3: { t: "Tu historia sigue abierta", b: "Lo que escribiste el primer d\u00eda sigue aqu\u00ed, esperando. 3 d\u00edas no borran nada." },
        wb7: { t: "Una semana es una pausa, no un final", b: "Tus datos, tu racha m\u00e1s larga y tu porqu\u00e9 siguen intactos. Solo falta una sesi\u00f3n." },
        wb14: { t: "La persona que empez\u00f3 esto merece otro intento", b: "No hace falta volver a lo grande. 5 minutos hoy reabren la historia." }
      };
      const m = msgs[stage];
      return {
        type: "winback", stage, anchorDate: shiftDateKey(dateKey, -lastActive),
        title: m.t, body: m.b, tag: "focus-winback", url: "index.html"
      };
    }
  }

  return null;
}

// ---------- La función programada ----------
exports.engagementPulse = onSchedule(
  { schedule: "every 60 minutes", timeZone: "Etc/UTC", region: "europe-west1", memory: "256MiB" },
  async () => {
    const snap = await db.collection("users").get();
    const messaging = getMessaging();
    let sent = 0;

    for (const docSnap of snap.docs) {
      const user = docSnap.data();
      const fcm = user.fcm || {};
      const tokens = Array.isArray(fcm.tokens) ? fcm.tokens.filter(Boolean) : [];
      if (tokens.length === 0) continue;

      const ctx = localParts(fcm.tz);
      const state = user.notifState || {};

      // Regla de oro anti-spam: máximo 1 notificación por día local
      if (state.lastDateKey === ctx.dateKey) continue;

      let decision = decide(user, ctx);
      if (!decision) continue;

      // Resolver el caso async de la foto pendiente
      if (decision.type === "photo-check-needed") {
        const photoDoc = await db.doc(`users/${docSnap.id}/photos/${ctx.dateKey}`).get();
        if (photoDoc.exists) continue;
        decision = {
          type: "photo",
          title: "\u{1F4F8} Tu d\u00eda de hoy a\u00fan no tiene foto",
          body: "Registraste tu sesi\u00f3n \u2014 que el d\u00eda no quede en blanco en Memories.",
          tag: "focus-photo", url: "memories.html"
        };
      }

      // Envío (mensaje de datos: nuestro sw.js lo pinta)
      const res = await messaging.sendEachForMulticast({
        tokens,
        data: {
          title: decision.title,
          body: decision.body,
          tag: decision.tag || "focus-general",
          url: decision.url || "index.html",
          badge: decision.badge || ""
        },
        webpush: { headers: { Urgency: "high", TTL: "43200" } }
      });

      // Limpieza de tokens muertos (dispositivo borrado, permiso revocado)
      const dead = [];
      res.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error && r.error.code || "";
          if (code.includes("registration-token-not-registered") || code.includes("invalid-argument")) {
            dead.push(tokens[i]);
          }
        }
      });

      // Actualizar estado anti-spam y cooldowns
      const update = { "notifState.lastDateKey": ctx.dateKey, "notifState.lastType": decision.type };
      if (decision.type === "milestone") {
        update["notifState.sentMilestones"] = FieldValue.arrayUnion(decision.milestone);
      }
      if (decision.type === "winback") {
        update["notifState.sentWinbacks"] = FieldValue.arrayUnion(decision.stage + ":" + decision.anchorDate);
      }
      if (dead.length) update["fcm.tokens"] = FieldValue.arrayRemove(...dead);
      await docSnap.ref.update(update);
      sent++;
    }

    console.log(`engagementPulse: ${sent} notificaciones enviadas de ${snap.size} usuarios.`);
  }
);
