// =======================================================
// FOCUS · WEEKLY WRAP ("Tu semana")
// Historia semanal tipo Wrapped: pantalla completa, slides
// con tap para avanzar, mantener pulsado para pausar,
// pacto semanal con veredicto y carta compartible.
//
// Uso desde index.html:
//   import { maybeShowWeeklyWrap, openWeeklyWrap, getWeekKey, todayKey } from "./weekly-wrap.js";
//   maybeShowWeeklyWrap(ctx)  -> lo muestra solo si toca (semana nueva con datos)
//   openWeeklyWrap(ctx)       -> lo abre siempre (botón "Tu semana")
//
// ctx = {
//   uid, profileInfo, customCats, timeSpent,
//   weekLog,          // { [mondayKey]: { mins:{cat:n}, sess:{cat:n}, yes:{prayed,diet}, days:{dateKey:min} } }
//   wrapMeta,         // { lastSeenWeek, pact: { weekKey, type, target, label } }
//   getItems,         // de firebase-init (fotos de Memories para la tira de la semana)
//   createPost,       // de firebase-init (compartir la carta al Social Club)
//   persist(partial)  // callback: guarda { wrapMeta } (y lo que haga falta) en Firestore
// }
// =======================================================

import { getWeeklyStudy } from "./study-library.js";

// ---------- Utilidades de fechas (semana anclada al lunes) ----------
export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Clave de semana = dateKey del lunes de esa semana ("2026-07-27")
export function getWeekKey(d = new Date()) {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = copy.getDay() === 0 ? 7 : copy.getDay(); // lunes=1 ... domingo=7
  copy.setDate(copy.getDate() - (dow - 1));
  return todayKey(copy);
}

export function prevWeekKey(weekKey) {
  const [y, m, d] = weekKey.split("-").map(Number);
  const monday = new Date(y, m - 1, d);
  monday.setDate(monday.getDate() - 7);
  return todayKey(monday);
}

function weekRangeLabel(weekKey) {
  const [y, m, d] = weekKey.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  const MES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth
    ? `${start.getDate()}–${end.getDate()} ${MES[start.getMonth()]}`
    : `${start.getDate()} ${MES[start.getMonth()]} – ${end.getDate()} ${MES[end.getMonth()]}`;
}

function datesOfWeek(weekKey) {
  const [y, m, d] = weekKey.split("-").map(Number);
  const out = [];
  for (let i = 0; i < 7; i++) out.push(todayKey(new Date(y, m - 1, d + i)));
  return out;
}

// ---------- Etiquetas de categorías ----------
const BASE_LABELS = {
  read: "Lectura", trained: "Entrenamiento", meditated: "Meditación",
  worked: "Trabajo", studied: "Estudio", slept: "Sueño"
};
const IDENTITY_PHRASES = {
  read: "un lector", trained: "un atleta", meditated: "alguien que cuida su mente",
  worked: "un profesional imparable", studied: "un estudiante serio", slept: "alguien que se respeta descansando"
};
function catLabel(key, customCats) {
  if (BASE_LABELS[key]) return BASE_LABELS[key];
  const c = (customCats || []).find(c => c.key === key);
  return c ? c.label : key;
}
function identityPhrase(key, customCats) {
  if (IDENTITY_PHRASES[key]) return IDENTITY_PHRASES[key];
  const c = (customCats || []).find(c => c.key === key);
  return c ? `alguien constante en ${c.label}` : "alguien constante";
}

function fmtMin(min) {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

// ---------- Estadísticas de una semana ----------
function weekStats(weekLog, weekKey) {
  const w = (weekLog && weekLog[weekKey]) || null;
  if (!w) return null;
  const mins = w.mins || {};
  const sess = w.sess || {};
  const yes  = w.yes  || {};
  const days = w.days || {};
  const totalMin = Object.values(mins).reduce((a, b) => a + (Number(b) || 0), 0);
  const totalSess = Object.values(sess).reduce((a, b) => a + (Number(b) || 0), 0)
                  + (Number(yes.prayed) || 0) + (Number(yes.diet) || 0);
  const activeDays = Object.keys(days).length;
  let domKey = null, domMin = 0;
  Object.entries(mins).forEach(([k, v]) => { if ((Number(v) || 0) > domMin) { domMin = Number(v); domKey = k; } });
  const hasAnything = totalMin > 0 || totalSess > 0 || activeDays > 0;
  return hasAnything ? { totalMin, totalSess, activeDays, domKey, domMin, mins, days, yes } : null;
}

// ---------- Estilos (se inyectan una sola vez) ----------
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = `
  .wrap-overlay{position:fixed;inset:0;z-index:1150;background:#07070E;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .35s ease;}
  .wrap-overlay.open{opacity:1;pointer-events:auto;}
  .wrap-stage{position:relative;width:100%;height:100%;max-width:480px;margin:0 auto;overflow:hidden;background:linear-gradient(180deg,#191824 0%,#07070E 70%);color:#fff;display:flex;flex-direction:column;user-select:none;-webkit-user-select:none;touch-action:manipulation;}
  .wrap-bars{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);left:12px;right:12px;display:flex;gap:5px;z-index:5;}
  .wrap-bar{flex:1;height:3px;border-radius:99px;background:rgba(255,255,255,.18);overflow:hidden;}
  .wrap-bar i{display:block;height:100%;width:0%;background:#D4AF6D;border-radius:99px;}
  .wrap-close{position:absolute;top:calc(env(safe-area-inset-top,0px) + 24px);right:14px;z-index:6;background:rgba(255,255,255,.08);border:none;color:rgba(255,255,255,.85);width:34px;height:34px;border-radius:50%;font-size:1.05rem;cursor:pointer;display:flex;align-items:center;justify-content:center;}
  .wrap-slide{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:4.2rem 1.8rem 3.2rem;opacity:0;transform:translateY(12px) scale(.985);transition:opacity .45s ease,transform .45s cubic-bezier(.22,1,.36,1);pointer-events:none;}
  .wrap-slide.on{opacity:1;transform:none;pointer-events:auto;}
  .wrap-eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#D4AF6D;font-weight:600;margin-bottom:.9rem;}
  .wrap-big{font-size:clamp(2.6rem,14vw,4.4rem);font-weight:800;line-height:1;letter-spacing:-.02em;}
  .wrap-big small{font-size:.35em;font-weight:600;color:rgba(255,255,255,.6);letter-spacing:0;}
  .wrap-title{font-size:1.5rem;font-weight:700;line-height:1.25;margin:.4rem 0;}
  .wrap-text{font-size:.95rem;line-height:1.6;color:rgba(255,255,255,.78);max-width:32ch;margin:0 auto;}
  .wrap-text strong{color:#D4AF6D;font-weight:700;}
  .wrap-quote{font-size:1.15rem;line-height:1.55;font-style:italic;color:#fff;max-width:30ch;}
  .wrap-delta{display:inline-flex;align-items:center;gap:.35rem;margin-top:1rem;padding:.35rem .8rem;border-radius:99px;font-size:.85rem;font-weight:700;background:rgba(212,175,109,.14);color:#D4AF6D;}
  .wrap-delta.down{background:rgba(255,255,255,.08);color:rgba(255,255,255,.65);}
  .wrap-daystrip{display:flex;gap:6px;margin-top:1.4rem;}
  .wrap-day{width:38px;display:flex;flex-direction:column;align-items:center;gap:5px;font-size:.62rem;color:rgba(255,255,255,.5);}
  .wrap-day .dot{width:38px;height:48px;border-radius:10px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);overflow:hidden;display:flex;align-items:center;justify-content:center;}
  .wrap-day.active .dot{border-color:#D4AF6D;box-shadow:0 0 12px rgba(212,175,109,.25);}
  .wrap-day.active .dot::after{content:"";width:8px;height:8px;border-radius:50%;background:#D4AF6D;}
  .wrap-day .dot img{width:100%;height:100%;object-fit:cover;}
  .wrap-day.active .dot:has(img)::after{display:none;}
  .wrap-meter{width:min(78vw,300px);height:10px;border-radius:99px;background:rgba(255,255,255,.1);margin-top:1.4rem;overflow:hidden;}
  .wrap-meter i{display:block;height:100%;width:0%;background:linear-gradient(90deg,#8f7742,#D4AF6D);border-radius:99px;transition:width 1.2s cubic-bezier(.22,1,.36,1);}
  .wrap-meter-cap{font-size:.72rem;color:rgba(255,255,255,.5);margin-top:.5rem;}
  .wrap-votes{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;margin-top:1.3rem;max-width:280px;}
  .wrap-vote{width:14px;height:14px;border-radius:4px;background:#D4AF6D;opacity:0;transform:scale(.4);animation:wrapVote .4s forwards;}
  @keyframes wrapVote{to{opacity:1;transform:scale(1) rotate(45deg);}}
  .wrap-verdict{font-size:3.2rem;line-height:1;margin-bottom:.6rem;}
  .wrap-pacts{display:flex;flex-direction:column;gap:.7rem;margin-top:1.3rem;width:min(82vw,320px);}
  .wrap-pact-btn{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:.9rem 1rem;color:#fff;font-size:.92rem;font-weight:600;cursor:pointer;text-align:left;transition:border-color .2s,background .2s;font-family:inherit;}
  .wrap-pact-btn:hover{border-color:#D4AF6D;}
  .wrap-pact-btn.picked{border-color:#D4AF6D;background:rgba(212,175,109,.14);}
  .wrap-pact-btn small{display:block;font-weight:400;color:rgba(255,255,255,.55);font-size:.78rem;margin-top:.2rem;}
  .wrap-cta{margin-top:1.4rem;background:#D4AF6D;color:#100F19;border:none;border-radius:12px;padding:.85rem 1.6rem;font-size:.95rem;font-weight:700;cursor:pointer;font-family:inherit;transition:transform .15s;}
  .wrap-cta:hover{transform:translateY(-1px);}
  .wrap-cta:disabled{opacity:.4;cursor:not-allowed;}
  .wrap-cta.ghost{background:rgba(255,255,255,.08);color:#fff;margin-top:.7rem;}
  .wrap-share-status{font-size:.8rem;color:rgba(255,255,255,.55);margin-top:.7rem;min-height:1.1em;}
  .wrap-card-preview{width:min(62vw,230px);border-radius:14px;margin-top:1.2rem;box-shadow:0 18px 44px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.1);}
  .wrap-study-source{font-size:.8rem;font-weight:700;color:rgba(255,255,255,.85);margin-bottom:.8rem;max-width:34ch;line-height:1.4;}
  .wrap-study-applied{margin-top:1.2rem;background:rgba(212,175,109,.1);border:1px solid rgba(212,175,109,.3);border-radius:14px;padding:.9rem 1rem;font-size:.88rem;line-height:1.55;color:#fff;max-width:34ch;text-align:left;}
  .wrap-study-applied span{display:block;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:#D4AF6D;font-weight:700;margin-bottom:.35rem;}
  .wrap-tap-hint{position:absolute;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);left:0;right:0;text-align:center;font-size:.68rem;color:rgba(255,255,255,.35);z-index:5;pointer-events:none;}
  `;
  const tag = document.createElement("style");
  tag.textContent = css;
  document.head.appendChild(tag);
}

// ---------- Contador animado ----------
function animateCount(el, to, { decimals = 0, duration = 1100, suffix = "" } = {}) {
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
    el.textContent = (to * eased).toFixed(decimals) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ---------- Carta compartible (canvas) ----------
function drawShareCard(stats, weekKey, ctx2) {
  const W = 1080, H = 1350;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  const grad = c.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#22212D"); grad.addColorStop(1, "#07070E");
  c.fillStyle = grad; c.fillRect(0, 0, W, H);
  // Marco dorado sutil
  c.strokeStyle = "rgba(212,175,109,.35)"; c.lineWidth = 3;
  c.strokeRect(40, 40, W - 80, H - 80);

  const gold = "#D4AF6D";
  c.textAlign = "center";
  c.fillStyle = gold;
  c.font = "600 34px system-ui, -apple-system, sans-serif";
  c.fillText("M I   S E M A N A   E N   F O C U S", W / 2, 150);
  c.fillStyle = "rgba(255,255,255,.55)";
  c.font = "400 30px system-ui, sans-serif";
  c.fillText(weekRangeLabel(weekKey), W / 2, 200);

  // Número grande: minutos
  c.fillStyle = "#fff";
  c.font = "800 190px system-ui, sans-serif";
  c.fillText(fmtMin(stats.totalMin), W / 2, 450);
  c.fillStyle = "rgba(255,255,255,.6)";
  c.font = "400 34px system-ui, sans-serif";
  c.fillText("invertidos en mí", W / 2, 510);

  // Tres stats
  const cols = [
    [String(stats.activeDays) + "/7", "días activos"],
    [String(stats.totalSess), stats.totalSess === 1 ? "voto de identidad" : "votos de identidad"],
    [stats.domKey ? catLabel(stats.domKey, ctx2.customCats) : "—", "mi foco principal"]
  ];
  cols.forEach((col, i) => {
    const x = W / 2 + (i - 1) * 300;
    c.fillStyle = gold;
    c.font = "700 52px system-ui, sans-serif";
    c.fillText(col[0], x, 680);
    c.fillStyle = "rgba(255,255,255,.55)";
    c.font = "400 26px system-ui, sans-serif";
    c.fillText(col[1], x, 725);
  });

  // El porqué
  const reason = (ctx2.profileInfo && ctx2.profileInfo.reason || "").trim();
  if (reason) {
    c.fillStyle = "rgba(255,255,255,.85)";
    c.font = "italic 400 38px Georgia, serif";
    const words = reason.split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach(w => {
      const test = line ? line + " " + w : w;
      if (c.measureText("\u201C" + test + "\u201D").width > W - 260) { lines.push(line); line = w; }
      else line = test;
    });
    if (line) lines.push(line);
    const shown = lines.slice(0, 4);
    if (lines.length > 4) shown[3] = shown[3].replace(/\s+\S*$/, "") + "…";
    shown.forEach((l, i) => {
      const txt = (i === 0 ? "\u201C" : "") + l + (i === shown.length - 1 ? "\u201D" : "");
      c.fillText(txt, W / 2, 880 + i * 54);
    });
    c.fillStyle = "rgba(255,255,255,.4)";
    c.font = "400 26px system-ui, sans-serif";
    c.fillText("— por qué empecé", W / 2, 880 + shown.length * 54 + 30);
  }

  c.fillStyle = gold;
  c.font = "700 44px system-ui, sans-serif";
  c.fillText("Focus.", W / 2, H - 120);
  c.fillStyle = "rgba(255,255,255,.4)";
  c.font = "400 26px system-ui, sans-serif";
  c.fillText("Your progress, 1% at a time", W / 2, H - 78);

  return cv.toDataURL("image/jpeg", 0.85);
}

// ---------- Definición de pactos ----------
function pactOptions(stats) {
  const opts = [];
  opts.push({
    type: "minutes", target: stats.totalMin + 1,
    label: "Superar mis minutos",
    sub: `Hacer más de ${fmtMin(stats.totalMin)} la próxima semana`
  });
  if (stats.activeDays < 7) {
    opts.push({
      type: "days", target: stats.activeDays + 1,
      label: "Un día activo más",
      sub: `Pasar de ${stats.activeDays} a ${stats.activeDays + 1} días con actividad`
    });
  }
  opts.push({
    type: "hold", target: Math.max(stats.activeDays, 1),
    label: "Mantener el ritmo",
    sub: `No bajar de ${Math.max(stats.activeDays, 1)} día${stats.activeDays === 1 ? "" : "s"} activo${stats.activeDays === 1 ? "" : "s"}`
  });
  return opts;
}

function judgePact(pact, stats) {
  if (!pact || !stats) return null;
  if (pact.type === "minutes") return { ok: stats.totalMin >= pact.target, got: fmtMin(stats.totalMin), want: fmtMin(pact.target - 1) };
  if (pact.type === "days")    return { ok: stats.activeDays >= pact.target, got: `${stats.activeDays} días`, want: `${pact.target} días` };
  if (pact.type === "hold")    return { ok: stats.activeDays >= pact.target, got: `${stats.activeDays} días`, want: `${pact.target} días` };
  return null;
}

// =======================================================
// MOTOR DE LA HISTORIA
// =======================================================
async function runWrap(ctx, wrappedWeekKey) {
  injectStyles();

  const stats = weekStats(ctx.weekLog, wrappedWeekKey);
  const prevStats = weekStats(ctx.weekLog, prevWeekKey(wrappedWeekKey));
  const reason = (ctx.profileInfo && ctx.profileInfo.reason || "").trim();
  const lifetimeMin = ["read","trained","meditated","worked","studied","slept"]
    .concat((ctx.customCats || []).map(c => c.key))
    .reduce((a, k) => a + (Number(ctx.timeSpent && ctx.timeSpent[k]) || 0), 0);

  // Fotos de Memories de esa semana (tira de días) — carga tolerante a fallos
  let weekPhotos = {};
  try {
    const photos = await ctx.getItems(ctx.uid, "photos", 60);
    const wanted = new Set(datesOfWeek(wrappedWeekKey));
    photos.forEach(p => { if (p.dateKey && wanted.has(p.dateKey) && p.image) weekPhotos[p.dateKey] = p.image; });
  } catch (e) { /* sin fotos no pasa nada */ }

  // ---------- Construcción de slides ----------
  const slides = [];
  const rangeLbl = weekRangeLabel(wrappedWeekKey);

  // 1) Portada
  slides.push({ dur: 5000, html: `
    <div class="wrap-eyebrow">FOCUS · ${rangeLbl}</div>
    <div class="wrap-title" style="font-size:2rem;">Tu semana,<br>contada de verdad.</div>
    <p class="wrap-text">Los datos que no viste mientras estabas ocupado viviendo tu semana.</p>` });

  // 2) Veredicto del pacto (si lo hubo para esta semana)
  const pact = ctx.wrapMeta && ctx.wrapMeta.pact;
  if (pact && pact.weekKey === wrappedWeekKey && stats) {
    const v = judgePact(pact, stats);
    if (v) slides.push({ dur: 7000, html: `
      <div class="wrap-eyebrow">El pacto de la semana pasada</div>
      <div class="wrap-verdict">${v.ok ? "&#10003;" : "&#8226;&#8226;&#8226;"}</div>
      <div class="wrap-title">${v.ok ? "Cumplido." : "No esta vez."}</div>
      <p class="wrap-text">${pact.auto ? "El pacto por defecto era" : "Te propusiste"}: <strong>${escapeHtml(pact.label)}</strong> (${escapeHtml(v.want)}).<br>
      Resultado: <strong>${escapeHtml(v.got)}</strong>.<br>
      ${v.ok ? "Dijiste que lo harías. Y lo hiciste. Eso, repetido, es identidad." : "Un pacto fallido no borra la semana: los datos que vienen ahora también cuentan."}</p>` });
  }

  if (stats) {
    // 3) Días activos + tira de fotos
    const dias = datesOfWeek(wrappedWeekKey);
    const DOW = ["L","M","X","J","V","S","D"];
    slides.push({ dur: 8000, html: `
      <div class="wrap-eyebrow">Presencia</div>
      <div class="wrap-big" data-count="${stats.activeDays}">0</div>
      <div class="wrap-title" style="font-size:1.1rem;font-weight:600;color:rgba(255,255,255,.7);">de 7 días apareciste</div>
      <div class="wrap-daystrip">
        ${dias.map((dk, i) => `
          <div class="wrap-day ${stats.days[dk] || weekPhotos[dk] ? "active" : ""}">
            <div class="dot">${weekPhotos[dk] ? `<img src="${weekPhotos[dk]}" alt="">` : ""}</div>
            <span>${DOW[i]}</span>
          </div>`).join("")}
      </div>
      <p class="wrap-text" style="margin-top:1.2rem;">Woody Allen lo dijo: el 80% del éxito es aparecer. Tú apareciste.</p>` });

    // 4) Minutos totales + delta
    let deltaHtml = "";
    if (prevStats && prevStats.totalMin > 0) {
      const pct = Math.round(((stats.totalMin - prevStats.totalMin) / prevStats.totalMin) * 100);
      deltaHtml = pct >= 0
        ? `<div class="wrap-delta">&#9650; +${pct}% vs semana anterior</div>`
        : `<div class="wrap-delta down">&#9660; ${pct}% vs semana anterior — las semanas valle tambi&eacute;n construyen</div>`;
    }
    slides.push({ dur: 7000, html: `
      <div class="wrap-eyebrow">Tiempo invertido en ti</div>
      <div class="wrap-big"><span data-count="${Math.round(stats.totalMin)}">0</span><small> min</small></div>
      ${deltaHtml}
      <p class="wrap-text" style="margin-top:1.1rem;">${fmtMin(stats.totalMin)} que nadie te regal&oacute;. Los sacaste t&uacute;, de tu semana real.</p>` });

    // 5) Categoría dominante
    if (stats.domKey) slides.push({ dur: 7000, html: `
      <div class="wrap-eyebrow">Tu foco principal</div>
      <div class="wrap-title" style="font-size:1.9rem;">Esta semana fuiste<br><span style="color:#D4AF6D;">${escapeHtml(identityPhrase(stats.domKey, ctx.customCats))}</span></div>
      <p class="wrap-text">${fmtMin(stats.domMin)} dedicados a ${escapeHtml(catLabel(stats.domKey, ctx.customCats).toLowerCase())} — tu mayor apuesta de la semana.</p>` });

    // 6) Progreso invisible (la tesis FOCUS)
    if (lifetimeMin > 0) {
      const nextMilestoneH = Math.ceil((lifetimeMin / 60 + 0.001) / 25) * 25; // hito cada 25h
      const pctToMilestone = Math.min(100, Math.round((lifetimeMin / 60 / nextMilestoneH) * 100));
      const weekShare = Math.max(1, Math.round((stats.totalMin / lifetimeMin) * 100));
      slides.push({ dur: 9000, html: `
        <div class="wrap-eyebrow">El progreso que no se ve</div>
        <div class="wrap-title">Esta semana parec&iacute;a poca cosa.</div>
        <p class="wrap-text">Pero se sum&oacute; a tus <strong>${(lifetimeMin/60).toFixed(1)} horas</strong> totales. Solo esta semana pusiste el <strong>${weekShare}%</strong> de todo lo que llevas construido.</p>
        <div class="wrap-meter"><i data-meter="${pctToMilestone}"></i></div>
        <div class="wrap-meter-cap">${pctToMilestone}% del camino a tus ${nextMilestoneH} horas</div>` });
    }

    // 7) Votos de identidad
    if (stats.totalSess > 0) {
      const votes = Math.min(stats.totalSess, 40);
      slides.push({ dur: 8000, html: `
        <div class="wrap-eyebrow">Identidad</div>
        <div class="wrap-big" data-count="${stats.totalSess}">0</div>
        <div class="wrap-title" style="font-size:1.1rem;font-weight:600;color:rgba(255,255,255,.7);">${stats.totalSess === 1 ? "voto emitido" : "votos emitidos"} esta semana</div>
        <div class="wrap-votes">${Array.from({length: votes}, (_, i) => `<span class="wrap-vote" style="animation-delay:${0.35 + i * 0.05}s"></span>`).join("")}</div>
        <p class="wrap-text" style="margin-top:1.2rem;">Cada sesi&oacute;n fue un voto por la persona que est&aacute;s eligiendo ser. Ninguna elecci&oacute;n fue peque&ntilde;a.</p>` });
    }

    // 7b) El estudio de la semana — rotación compartida con Legacy
    // (misma semana en curso = mismo estudio en ambas superficies),
    // aplicado a los datos de la semana que se está resumiendo.
    {
      const { study, index, total } = getWeeklyStudy(getWeekKey());
      const s = {
        weekMin: Math.round(stats.totalMin),
        weekSess: stats.totalSess,
        activeDays: stats.activeDays,
        lifetimeH: lifetimeMin / 60,
        hasReason: !!reason,
        domLabel: stats.domKey ? catLabel(stats.domKey, ctx.customCats) : null
      };
      slides.push({ dur: 11000, html: `
        <div class="wrap-eyebrow">El estudio de la semana &middot; ${index + 1}/${total}</div>
        <div class="wrap-study-source">${escapeHtml(study.source)}</div>
        <p class="wrap-text" style="max-width:36ch;">${escapeHtml(study.claim)}</p>
        <div class="wrap-study-applied"><span>Aplicado a ti</span>${escapeHtml(study.apply(s))}</div>` });
    }
  } else {
    // Semana sin datos (solo al abrirlo manualmente)
    slides.push({ dur: 7000, html: `
      <div class="wrap-eyebrow">${rangeLbl}</div>
      <div class="wrap-title">Esta semana no dej&oacute; huella&hellip; todav&iacute;a.</div>
      <p class="wrap-text">No hay sesiones registradas. La buena noticia: la pr&oacute;xima historia se empieza a escribir con la primera sesi&oacute;n de hoy.</p>` });
  }

  // 8) Tu porqué
  if (reason) slides.push({ dur: 8000, html: `
    <div class="wrap-eyebrow">Y todo esto fue por&hellip;</div>
    <p class="wrap-quote">&ldquo;${escapeHtml(reason)}&rdquo;</p>
    <p class="wrap-text" style="margin-top:1rem;">Lo escribiste t&uacute;. Esta semana estuviste a la altura de esa frase.</p>` });

  // 9) Pacto para la próxima semana (OBLIGATORIO: no hay botón de
  // saltar y el tap no avanza hasta que se sella; si el usuario
  // cierra el wrap con la X, se asigna el pacto por defecto).
  const currentWeek = getWeekKey();
  if (stats) {
    const opts = pactOptions(stats);
    slides.push({ dur: 0, interactive: true, mustComplete: true, html: `
      <div class="wrap-eyebrow">El pacto &middot; obligatorio</div>
      <div class="wrap-title">&iquest;C&oacute;mo quieres que sea<br>la pr&oacute;xima semana?</div>
      <p class="wrap-text" style="margin-top:.3rem;font-size:.82rem;">En FOCUS no se sale de la semana sin un compromiso. El lunes que viene, tus datos dar&aacute;n el veredicto.</p>
      <div class="wrap-pacts">
        ${opts.map((o, i) => `<button class="wrap-pact-btn" data-pact="${i}">${escapeHtml(o.label)}<small>${escapeHtml(o.sub)}</small></button>`).join("")}
      </div>
      <button class="wrap-cta" id="wrapPactSeal" disabled>Sellar el pacto</button>`,
      mount(slideEl, api) {
        let picked = null;
        slideEl.querySelectorAll(".wrap-pact-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            slideEl.querySelectorAll(".wrap-pact-btn").forEach(b => b.classList.remove("picked"));
            btn.classList.add("picked");
            picked = opts[Number(btn.dataset.pact)];
            slideEl.querySelector("#wrapPactSeal").disabled = false;
          });
        });
        slideEl.querySelector("#wrapPactSeal").addEventListener("click", () => {
          if (!picked) return;
          ctx.wrapMeta.pact = { weekKey: currentWeek, type: picked.type, target: picked.target, label: picked.label };
          ctx.persist({ wrapMeta: ctx.wrapMeta });
          slideEl.closest(".wrap-slide").dataset.done = "1";
          api.next();
        });
      }});
  }

  // 10) Carta compartible (interactivo, cierre)
  if (stats) {
    const cardUrl = drawShareCard(stats, wrappedWeekKey, ctx);
    slides.push({ dur: 0, interactive: true, html: `
      <div class="wrap-eyebrow">Tu carta de la semana</div>
      <img class="wrap-card-preview" src="${cardUrl}" alt="Resumen semanal">
      <button class="wrap-cta" id="wrapShareBtn">Compartir en el Social Club</button>
      <button class="wrap-cta ghost" id="wrapDoneBtn">Cerrar</button>
      <div class="wrap-share-status" id="wrapShareStatus"></div>`,
      mount(slideEl, api) {
        const status = slideEl.querySelector("#wrapShareStatus");
        slideEl.querySelector("#wrapShareBtn").addEventListener("click", async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true; status.textContent = "Publicando…";
          try {
            const name = (ctx.profileInfo && (ctx.profileInfo.userName || ctx.profileInfo.realName)) || "Anónimo";
            await ctx.createPost(ctx.uid, { name, avatar: ctx.profileInfo && ctx.profileInfo.profilePic || null }, {
              text: `Mi semana en FOCUS · ${rangeLbl} — ${fmtMin(stats.totalMin)} invertidos en mí, ${stats.activeDays}/7 días activos.`,
              image: cardUrl
            });
            status.textContent = "Publicado en el Social Club ✓";
          } catch (err) {
            console.error(err);
            btn.disabled = false;
            status.textContent = "No se pudo publicar. Inténtalo de nuevo.";
          }
        });
        slideEl.querySelector("#wrapDoneBtn").addEventListener("click", () => api.close());
      }});
  }

  // ---------- Montaje del DOM ----------
  const overlay = document.createElement("div");
  overlay.className = "wrap-overlay";
  overlay.innerHTML = `
    <div class="wrap-stage">
      <div class="wrap-bars">${slides.map(() => `<div class="wrap-bar"><i></i></div>`).join("")}</div>
      <button class="wrap-close" aria-label="Cerrar">&#10005;</button>
      ${slides.map((s, i) => `<div class="wrap-slide" data-i="${i}">${s.html}</div>`).join("")}
      <div class="wrap-tap-hint">Toca para avanzar · mantén pulsado para pausar</div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("open"));
  document.body.style.overflow = "hidden";

  const bars = [...overlay.querySelectorAll(".wrap-bar i")];
  const slideEls = [...overlay.querySelectorAll(".wrap-slide")];
  let idx = -1, raf = null, slideStart = 0, elapsedPaused = 0, paused = false, closed = false;

  function markSeen() {
    ctx.wrapMeta.lastSeenWeek = getWeekKey();
    ctx.persist({ wrapMeta: ctx.wrapMeta });
  }

  const api = {
    next() {
      // Slides obligatorios (el pacto): no se avanza hasta completar
      if (idx >= 0 && slides[idx].mustComplete && slideEls[idx].dataset.done !== "1") {
        const seal = slideEls[idx].querySelector("#wrapPactSeal");
        if (seal) {
          seal.animate(
            [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
            { duration: 260 }
          );
        }
        return;
      }
      if (idx < slides.length - 1) show(idx + 1); else api.close();
    },
    prev() { if (idx > 0) show(idx - 1); },
    close() {
      if (closed) return;
      closed = true;
      // Pacto obligatorio: si cierra sin sellarlo, se asigna el
      // pacto por defecto ("mantener el ritmo") para que la próxima
      // semana siempre haya veredicto.
      if (stats && (!ctx.wrapMeta.pact || ctx.wrapMeta.pact.weekKey !== currentWeek)) {
        const holdTarget = Math.max(stats.activeDays, 1);
        ctx.wrapMeta.pact = {
          weekKey: currentWeek, type: "hold", target: holdTarget,
          label: "Mantener el ritmo", auto: true
        };
      }
      markSeen();
      cancelAnimationFrame(raf);
      overlay.classList.remove("open");
      document.body.style.overflow = "";
      setTimeout(() => overlay.remove(), 400);
    }
  };

  function tickBar(now) {
    if (closed) return;
    const s = slides[idx];
    if (!s.dur) return; // slides interactivos: la barra queda llena a medias fija
    if (!paused) {
      const elapsed = now - slideStart - elapsedPaused;
      const p = Math.min(elapsed / s.dur, 1);
      bars[idx].style.width = (p * 100) + "%";
      if (p >= 1) { api.next(); return; }
    }
    raf = requestAnimationFrame(tickBar);
  }

  function show(i) {
    cancelAnimationFrame(raf);
    idx = i;
    slideEls.forEach((el, j) => el.classList.toggle("on", j === i));
    bars.forEach((b, j) => { b.style.width = j < i ? "100%" : "0%"; });
    if (slides[i].interactive) bars[i].style.width = "100%";
    // Animaciones internas del slide
    const el = slideEls[i];
    el.querySelectorAll("[data-count]").forEach(n => animateCount(n, Number(n.dataset.count)));
    el.querySelectorAll("[data-meter]").forEach(m => { requestAnimationFrame(() => { m.style.width = m.dataset.meter + "%"; }); });
    if (slides[i].mount && !el.dataset.mounted) { el.dataset.mounted = "1"; slides[i].mount(el, api); }
    slideStart = performance.now(); elapsedPaused = 0; paused = false;
    if (slides[i].dur) raf = requestAnimationFrame(tickBar);
  }

  // Navegación: tap izquierda/derecha, mantener para pausar
  const stage = overlay.querySelector(".wrap-stage");
  let holdTimer = null, holding = false, pauseStamp = 0;
  function pointerDown() {
    holdTimer = setTimeout(() => { holding = true; paused = true; pauseStamp = performance.now(); }, 220);
  }
  function pointerUp(e) {
    clearTimeout(holdTimer);
    if (holding) {
      holding = false; paused = false;
      elapsedPaused += performance.now() - pauseStamp;
      return;
    }
    // Tap (ignorar si fue sobre un botón/enlace del slide)
    if (e.target.closest("button, a, input, textarea")) return;
    const x = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX) - stage.getBoundingClientRect().left;
    if (x < stage.clientWidth * 0.32) api.prev(); else api.next();
  }
  stage.addEventListener("mousedown", pointerDown);
  stage.addEventListener("mouseup", pointerUp);
  stage.addEventListener("touchstart", pointerDown, { passive: true });
  stage.addEventListener("touchend", pointerUp);
  overlay.querySelector(".wrap-close").addEventListener("click", api.close);

  show(0);
}

// =======================================================
// API PÚBLICA
// =======================================================

// Se muestra solo si: hay porqué escrito, es una semana nueva
// que aún no ha visto, y la semana anterior tuvo actividad.
export async function maybeShowWeeklyWrap(ctx) {
  const hasReason = !!(ctx.profileInfo && ctx.profileInfo.reason && ctx.profileInfo.reason.trim());
  if (!hasReason) return false; // no pisar el gate del porqué
  const currentWeek = getWeekKey();
  if (ctx.wrapMeta && ctx.wrapMeta.lastSeenWeek === currentWeek) return false;
  const lastWeek = prevWeekKey(currentWeek);
  if (!weekStats(ctx.weekLog, lastWeek)) return false;
  await runWrap(ctx, lastWeek);
  return true;
}

// Apertura manual (botón "Tu semana"): enseña la última semana
// completada; si no tiene datos, la actual en curso.
export async function openWeeklyWrap(ctx) {
  const lastWeek = prevWeekKey(getWeekKey());
  const target = weekStats(ctx.weekLog, lastWeek) ? lastWeek : getWeekKey();
  await runWrap(ctx, target);
}
