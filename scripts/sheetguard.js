/* Manhwa Sheet 1.59 — FICHES SANS ÉCRASEMENT
 * 1) Une modification n'envoie que le champ touché (et ses sous-champs) : ce qu'une fiche affiche encore d'ancien ne repart jamais.
 * 2) Pendant qu'on écrit (champ actif, éditeur de texte ouvert), une mise à jour venue d'ailleurs ne redessine pas la fiche :
 *    les nombres changés sont mis à jour sur place (avec un éclair « +500 ») et la fiche se redessine dès qu'on a fini d'écrire.
 * 3) Éclair sur les valeurs changées par quelqu'un d'autre (Gold, XP, niveau, jauges). */

const EDIT_SEL = "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]), textarea, select, [contenteditable=\"true\"], .ProseMirror";
export function editing(app) {
  const el = app?.element; if (!el) return false; const a = document.activeElement;
  if (a && el.contains(a) && a.matches?.(EDIT_SEL) && !a.matches?.("[data-search], .ms-search input")) return true;
  return !!el.querySelector("prose-mirror.active, prose-mirror .editor-menu");
}
/** à appeler dans _prepareSubmitData : ne garde que le champ modifié */
export function onlyChanged(app, event, data) {
  app._selfT = Date.now();
  const name = event?.target?.name; if (event?.type !== "change" || !name) return data;
  const flat = foundry.utils.flattenObject(data); const out = {};
  for (const [k, v] of Object.entries(flat)) if (k === name || k.startsWith(`${name}.`)) out[k] = v;
  return Object.keys(out).length ? foundry.utils.expandObject(out) : data;
}
/** à appeler au début de render() : true = rendu différé (on écrit), la fiche est patchée sur place */
export function deferRender(app, options, _options) {
  if (!app.rendered) return false;
  const o = (options && typeof options === "object") ? options : (_options || {}); const ctx = String(o.renderContext || "");
  if (!/^(update|create|delete)/.test(ctx)) return false;
  if (Date.now() - (app._selfT || 0) < 1500) return false;
  if (!editing(app)) return false;
  app._deferred = true; livePatch(app, o.renderData);
  if (!app._defT) app._defT = setInterval(() => {
    if (!app.rendered) { clearInterval(app._defT); app._defT = null; return; }
    if (editing(app)) return; clearInterval(app._defT); app._defT = null; if (app._deferred) { app._deferred = false; app.render(); }
  }, 400);
  return true;
}
function livePatch(app, changes) {
  if (!changes || typeof changes !== "object") return; const el = app.element; const flat = foundry.utils.flattenObject(changes);
  for (const [k, v] of Object.entries(flat)) { const inp = el.querySelector(`[name="${CSS.escape(k)}"]`); if (!inp || inp === document.activeElement || inp.closest("prose-mirror")) continue;
    const old = Number(inp.value); if (inp.type === "checkbox") inp.checked = !!v; else inp.value = v ?? "";
    if (Number.isFinite(old) && Number.isFinite(Number(v)) && Number(v) !== old) flashEl(inp, Number(v) - old); }
}
/* ── éclair : valeurs suivies, comparées d'un rendu à l'autre ── */
const TRACK = a => { const s = a?.system || {}; const out = {}; for (const [k, v] of Object.entries(s.resources || {})) out[`system.resources.${k}`] = Number(v) || 0;
  out["system.xp"] = Number(s.xp) || 0; out["system.level"] = Number(s.level) || 0; for (const [k, g] of Object.entries(s.gauges || {})) out[`system.gauges.${k}.value`] = Number(g?.value) || 0; return out; };
export function snapFlash(app, doc) {
  const now = TRACK(doc); const prev = app._snapV; app._snapV = now; if (!prev || !app.element) return;
  if (Date.now() - (app._selfT || 0) < 1500) return;   /* ses propres changements : pas d'éclair */
  for (const [k, v] of Object.entries(now)) { if (prev[k] === undefined || prev[k] === v) continue;
    const g = k.match(/^system\.gauges\.([^.]+)\.value$/); const t = g ? app.element.querySelector(`.ms-gauge[data-gauge="${CSS.escape(g[1])}"]`) : app.element.querySelector(`[name="${CSS.escape(k)}"]`) || (k === "system.level" ? app.element.querySelector(".lvv") : null);
    if (t) flashEl(t, v - prev[k]); }
}
const fmt = n => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);
export function flashEl(t, d) {
  if (!t || !d) return; const host = t.closest(".ms-chip, .ms-gauge, .ms-xp, label, .ms-f") || t.parentElement || t; host.classList.remove("ms-flash", "up", "down"); void host.offsetWidth; host.classList.add("ms-flash", d > 0 ? "up" : "down");
  const b = document.createElement("b"); b.className = `ms-flash-n ${d > 0 ? "up" : "down"}`; b.textContent = `${d > 0 ? "+" : "−"}${fmt(Math.abs(d))}`;
  if (getComputedStyle(host).position === "static") host.style.position = "relative"; host.append(b); setTimeout(() => { b.remove(); host.classList.remove("ms-flash", "up", "down"); }, 1800);
}

/* ── historique de session (MJ) : qui a changé quoi sur chaque personnage, depuis l'ouverture de Foundry ── */
const HIST = new Map();
Hooks.on("preUpdateActor", (a, ch, o, userId) => { if (!game.user.isGM) return; const flat = foundry.utils.flattenObject(ch); const keys = Object.keys(flat).filter(k => !k.startsWith("_stats") && k !== "_id"); if (!keys.length) return;
  const before = {}; for (const k of keys) before[k] = foundry.utils.getProperty(a, k); o.__msHist = before; });
Hooks.on("updateActor", (a, ch, o, userId) => { if (!game.user.isGM) return; const flat = foundry.utils.flattenObject(ch); const rows = Object.entries(flat).filter(([k]) => !k.startsWith("_stats") && k !== "_id").map(([k, v]) => ({ k, from: o.__msHist?.[k], to: v }));
  if (!rows.length) return; const L = HIST.get(a.id) || []; L.unshift({ t: Date.now(), u: game.users.get(o.msBy || userId)?.name || "?", tx: !!o.msTx, rows }); HIST.set(a.id, L.slice(0, 60)); });
export const historyOf = a => HIST.get(a?.id) || [];
