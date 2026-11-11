/* Manhwa Sheet — saison du monde, source unique pour toute la suite (Catalogue, Appel des Étoiles…).
 * Mode « automatique » : saison du calendrier du monde (Calendaria, calendrier de Foundry), sinon date réelle.
 * Mode « fixe » : choisie par le MJ. Un événement (Halloween, Fêtes) peut s'ajouter par-dessus.
 * Les modules écoutent le hook « manhwaSeason » (clé, infos) ou lisent MANHWA.season(). */
import { SYS, esc } from "./config.js";
import { withLock } from "./world.js";

export const SEASONS = {
  spring: { key: "spring", name: "Printemps", icon: "fa-seedling", color: "#ff9ad5", accent: "#ffd36b" },
  summer: { key: "summer", name: "Été", icon: "fa-sun", color: "#ffb340", accent: "#ff7a3c" },
  autumn: { key: "autumn", name: "Automne", icon: "fa-leaf", color: "#e2763a", accent: "#b8452a" },
  winter: { key: "winter", name: "Hiver", icon: "fa-snowflake", color: "#8fd8ff", accent: "#dff6ff" }
};
/* événements (fêtes) : les mêmes que les « saisons » du Catalogue, avec leur ambiance (effet + couleurs) */
const EV = [["nouvel-an", "Nouvel An", "sparks", ["#ffd760", "#ffffff", "#c9d4ff"], "fa-champagne-glasses"], ["nouvel-an-lunaire", "Nouvel An lunaire", "lanterns", ["#ff4a3a", "#ff8a3a", "#f5c518"], "fa-dragon"],
  ["fetes-d-hiver", "Fêtes d'hiver", "snow", ["#ffffff", "#d6f6ff", "#a8dcff"], "fa-gifts"], ["nuit-des-masques", "Nuit des Masques", "embers", ["#ff8a1e", "#ff5a1e", "#a24bff"], "fa-ghost"],
  ["fete-des-oeufs", "Fête des Œufs", "confetti", ["#8af0c8", "#ffa8d8", "#ffe28a", "#a8c8ff"], "fa-egg"], ["saison-des-plages", "Saison des plages", "bubbles", ["#9ffff0", "#ffffff", "#2ff0d8"], "fa-umbrella-beach"],
  ["fete-des-lumieres", "Fête des Lumières", "lights", ["#ffb347", "#ffd89a", "#fff1c8"], "fa-lightbulb"], ["jour-des-morts", "Jour des Morts", "petals", ["#ff9a1e", "#ffb020", "#ff3aa8"], "fa-skull"],
  ["fete-des-couleurs", "Fête des Couleurs", "dust", ["#ff4ad0", "#ffd23a", "#3affb0", "#3aa8ff", "#ff6a3a"], "fa-palette"], ["fete-de-l-eau", "Fête de l'Eau", "rain", ["#a0e0ff", "#3ab8ff"], "fa-droplet"],
  ["carnaval", "Carnaval", "confetti", ["#ffd23a", "#b05aff", "#3aff8a", "#ff4a6a"], "fa-masks-theater"], ["saint-valentin", "Saint-Valentin", "hearts", ["#ff4a8a", "#ff9ac0", "#ffffff"], "fa-heart"],
  ["floraison", "Floraison", "petals", ["#ffc0dd", "#ffd6ea", "#ff8ac0"], "fa-spa"], ["solstice-d-ete", "Solstice d'été", "embers", ["#ffd870", "#ffb020", "#ff6a2a"], "fa-sun-plant-wilt"],
  ["moisson", "Moisson", "leaves", ["#e8a03a", "#c8582a", "#f0c060", "#9a4a1a"], "fa-wheat-awn"], ["fete-de-la-biere", "Fête de la Bière", "bubbles", ["#ffe08a", "#f5b82a", "#ffffff"], "fa-beer-mug-empty"]];
export const SEASON_EVENTS = Object.fromEntries(EV.map(([key, name, fx, colors, icon]) => [key, { key, name, fx, colors, icon, color: colors[0], accent: colors[1], base: true }]));
/* 1.35 — événements ajoutés par le MJ : même objet SEASON_EVENTS (le Catalogue, Horlogia et le gacha le lisent par MANHWA.seasonEvents) */
export const FX = [["sparks", "Étincelles"], ["lanterns", "Lanternes"], ["snow", "Neige"], ["embers", "Braises"], ["confetti", "Confettis"], ["bubbles", "Bulles"], ["lights", "Lumières"], ["petals", "Pétales"], ["dust", "Poussière colorée"], ["rain", "Pluie"], ["hearts", "Cœurs"], ["leaves", "Feuilles"]];
const customEvents = () => { try { return game.settings.get(SYS, "seasonEvents")?.list || []; } catch (e) { return []; } };
function applyCustom() { for (const k of Object.keys(SEASON_EVENTS)) if (!SEASON_EVENTS[k].base) delete SEASON_EVENTS[k];
  for (const e of customEvents()) { const colors = (e.colors || [e.color || "#ffd760"]).filter(Boolean); SEASON_EVENTS[e.key] = { key: e.key, name: e.name, fx: e.fx || "sparks", colors, icon: e.icon || "fa-star", color: colors[0], accent: colors[1] || colors[0], custom: true }; } }
export async function editSeasonEvents(fn) { if (!game.user.isGM) return; return withLock(`set:${SYS}.seasonEvents`, async () => { const list = foundry.utils.deepClone(customEvents()); if (await fn(list) === false) return; await game.settings.set(SYS, "seasonEvents", { list }); }); }
const slug = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "evenement";
/** fenêtre « Saisons et événements » : les 4 saisons et les fêtes de la suite, plus les événements du MJ */
export async function seasonEventsEditor() {
  if (!game.user.isGM) return; const { DialogV2 } = foundry.applications.api;
  const body = () => { const L = Object.values(SEASON_EVENTS);
    const sc = seasonCfg(), cur = currentSeason(); const opt = (v, n, on) => `<option value="${v}"${on ? " selected" : ""}>${esc(n)}</option>`;
    return `<div class="ms-sev"><div class="ms-bnr" style="--bc:#3ddc84"><i class="fa-solid fa-earth-europe"></i> Saison du monde <small>actuellement ${seasonChip(cur)} (${esc(cur.src)})</small></div>
      <div class="sev-set"><label>Mode<select data-ss="mode">${opt("auto", "Automatique (Horlogia / calendrier, sinon date réelle)", sc.mode === "auto")}${opt("fixed", "Choisie par le MJ", sc.mode === "fixed")}</select></label>
        <label>Saison<select data-ss="fixed"${sc.mode === "fixed" ? "" : " disabled"}>${Object.values(SEASONS).map(x => opt(x.key, x.name, sc.fixed === x.key)).join("")}</select></label>
        <label>Événement<select data-ss="event">${opt("", "Aucun", !sc.event)}${opt("auto", "Automatique (fête du calendrier)", sc.event === "auto")}${Object.values(SEASON_EVENTS).map(x => opt(x.key, x.name, sc.event === x.key)).join("")}</select></label></div>
      <div class="ms-bnr" style="--bc:#8fd8ff"><i class="fa-solid fa-snowflake"></i> Saisons <small>printemps, été, automne, hiver (Horlogia, Boutique, Catalogue et gacha les suivent)</small></div>
      <div class="sev-row">${Object.values(SEASONS).map(x => `<span class="sev-chip" style="--c:${x.color}"><i class="fa-solid ${x.icon}"></i>${x.name}</span>`).join("")}</div>
      <div class="ms-bnr" style="--bc:#ffd760"><i class="fa-solid fa-champagne-glasses"></i> Événements de la suite <small>les « saisons » du Catalogue</small></div>
      <div class="sev-row">${L.filter(e => e.base).map(x => `<span class="sev-chip" style="--c:${x.color}"><i class="fa-solid ${x.icon}"></i>${esc(x.name)}</span>`).join("")}</div>
      <div class="ms-bnr" style="--bc:#ff6aa8"><i class="fa-solid fa-wand-magic-sparkles"></i> Tes événements <small>ajoutés partout (Catalogue, Boutique, Horlogia, gacha)</small><span class="sp"></span><a class="ms-mbtn blue sm" data-sev="add"><i class="fa-solid fa-plus"></i> Événement</a></div>
      <div class="sev-list">${L.filter(e => e.custom).map(e => `<div class="sev-ed" data-k="${esc(e.key)}" style="--c:${esc(e.color)}"><i class="fa-solid ${esc(e.icon)}"></i><input data-f="name" value="${esc(e.name)}" placeholder="Nom"><input data-f="icon" value="${esc(e.icon)}" placeholder="fa-star" class="ic"><input type="color" data-f="c0" value="${esc(e.colors[0] || "#ffd760")}"><input type="color" data-f="c1" value="${esc(e.colors[1] || e.colors[0] || "#ffffff")}"><input type="color" data-f="c2" value="${esc(e.colors[2] || e.colors[1] || "#ffffff")}"><select data-f="fx">${FX.map(([k, n]) => `<option value="${k}"${e.fx === k ? " selected" : ""}>${n}</option>`).join("")}</select><a class="x" data-sev="del" title="Supprimer"><i class="fa-solid fa-trash"></i></a></div>`).join("") || `<p class="ms-mhint">Aucun pour l'instant.</p>`}</div></div>`; };
  const dlg = new DialogV2({ window: { title: "Saisons et événements", icon: "fa-solid fa-earth-europe" }, classes: ["ms-dialog", "ms-sev-win"], position: { width: 820 }, content: body(), buttons: [{ action: "ok", label: "Fermer", default: true }] });
  const rerender = () => { const box = dlg.element?.querySelector(".ms-sev"); if (box) box.outerHTML = body(); };
  await dlg.render({ force: true }); const el = dlg.element;
  el.addEventListener("click", async ev => { const a = ev.target.closest("[data-sev]"); if (!a) return; ev.preventDefault();
    if (a.dataset.sev === "add") { await editSeasonEvents(l => { let k = slug("Nouvel événement"), i = 1; while (SEASON_EVENTS[k] || l.some(e => e.key === k)) k = `${slug("Nouvel événement")}-${++i}`; l.push({ key: k, name: "Nouvel événement", icon: "fa-star", colors: ["#ff6aa8", "#ffd760", "#ffffff"], fx: "sparks" }); }); return setTimeout(rerender, 80); }
    if (a.dataset.sev === "del") { const k = a.closest("[data-k]").dataset.k; await editSeasonEvents(l => { const i = l.findIndex(e => e.key === k); if (i < 0) return false; l.splice(i, 1); }); return setTimeout(rerender, 80); } });
  el.addEventListener("change", async ev => { if (ev.target.dataset.ss) { await setSeason({ [ev.target.dataset.ss]: ev.target.value }); return setTimeout(rerender, 120); } const f = ev.target.dataset.f; const row = ev.target.closest("[data-k]"); if (!f || !row) return; const k = row.dataset.k; const v = ev.target.value.trim();
    await editSeasonEvents(l => { const e = l.find(x => x.key === k); if (!e) return false; if (/^c\d$/.test(f)) { e.colors = e.colors || []; e.colors[+f[1]] = v; } else if (v) e[f] = v; }); });
}
const norm = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const eventByName = n => { const k = norm(n); return Object.values(SEASON_EVENTS).find(e => norm(e.name) === k || norm(e.key) === k) || null; };
/* fête du calendrier (Calendaria) reconnue parmi les événements */
function festival() { try { const H = globalThis.HORLOGIA; if (H && game.modules.get("horlogia-manhwa")?.active) { for (const e of H.eventsToday() || []) { const ev = eventByName(e.name); if (ev) return ev; } return null; } } catch (e) {} try { const f = globalThis.CALENDARIA?.api?.getCurrentFestival?.(); const n = f?.name || f; return n ? eventByName(game.i18n.localize(String(n))) : null; } catch (e) { return null; } }
const DEF = { mode: "auto", fixed: "spring", event: "" };   /* event : "" (aucun), "auto" (fête du calendrier), ou une clé */
export const seasonCfg = () => { try { return { ...DEF, ...(game.settings.get(SYS, "season") || {}) }; } catch (e) { return { ...DEF }; } };

/* reconnaît une saison d'après un nom ou un type (« spring », « Printemps », « Fall »…) */
function keyOf(s) {
  const t = String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/spring|printemps|primavera|fruhling/.test(t)) return "spring";
  if (/summer|ete\b|^ete|estate|verano|sommer/.test(t)) return "summer";
  if (/autumn|fall|automne|herbst|otono/.test(t)) return "autumn";
  if (/winter|hiver|inverno|invierno/.test(t)) return "winter";
  return null;
}
/** saison donnée par le calendrier du monde, ou null */
function fromCalendar() {
  /* Horlogia (temps du monde de la suite) : saison du groupe de référence */
  try { const H = globalThis.HORLOGIA; if (H && game.modules.get("horlogia-manhwa")?.active) { const s = H.season(); const k = keyOf(s?.type) || keyOf(s?.name); if (k) return { key: k, src: "Horlogia", label: s.name }; } } catch (e) {}
  /* Calendaria : on calcule nous-mêmes à partir de la date (saisons en mois/jour 0-based, date en 1-based) ; getCurrentSeason() se trompe sur certains calendriers */
  try { const A = globalThis.CALENDARIA?.api; if (A) { const cal = A.getActiveCalendar?.(); const raw = cal?.seasons?.values ?? cal?.seasons ?? {}; const vals = Array.isArray(raw) ? raw : Object.values(raw); const dt = A.getCurrentDateTime?.();
    if (vals.length && dt && Number.isFinite(Number(dt.month))) {
      const byMonth = vals.some(s => Number.isFinite(Number(s?.monthStart)));
      let now, list;
      if (byMonth) { now = (Number(dt.month) - 1) * 100 + (Number(dt.day ?? dt.dayOfMonth ?? 1) - 1); list = vals.map(s => ({ s, k: Number(s.monthStart) * 100 + (Number(s.dayStart) || 0) })); }
      else { const months = Object.values(cal?.months?.values ?? cal?.months ?? {}); let doy = Number(dt.day ?? 1) - 1; for (let i = 0; i < Number(dt.month) - 1 && i < months.length; i++) doy += Number(months[i]?.days) || 0; now = doy; list = vals.map(s => ({ s, k: Number(s.dayStart) })); }
      list = list.filter(x => Number.isFinite(x.k)).sort((a, b) => a.k - b.k);
      const pick = list.filter(x => x.k <= now).pop() || list[list.length - 1];
      if (pick) { const nm = game.i18n.localize(String(pick.s.name || "")); const k = keyOf(pick.s.seasonalType) || keyOf(pick.s.name) || keyOf(nm); if (k) return { key: k, src: "Calendaria", label: nm }; } } } } catch (e) {}
  try { const c = globalThis.CALENDARIA?.api?.getCurrentSeason?.(); const k = keyOf(c?.seasonalType) || keyOf(c?.name); if (k) return { key: k, src: "Calendaria", label: c?.name }; } catch (e) {}
  try { const cal = game.time?.calendar; const comp = game.time?.components; const vals = cal?.seasons?.values || []; const i = comp?.season;
    if (Number.isInteger(i) && vals[i]) { const nm = game.i18n.localize(vals[i].name || ""); const k = keyOf(vals[i].name) || keyOf(nm) || ["spring", "summer", "autumn", "winter"][i % 4]; return { key: k, src: "calendrier", label: nm }; } } catch (e) {}
  return null;
}
function fromRealDate() { const d = new Date(); const md = (d.getMonth() + 1) * 100 + d.getDate(); return { key: md >= 321 && md < 621 ? "spring" : md >= 621 && md < 923 ? "summer" : md >= 923 && md < 1221 ? "autumn" : "winter", src: "date réelle" }; }

/** saison actuelle : { key, name, icon, color, accent, event, eventInfo, mode, src } */
export function currentSeason() {
  const c = seasonCfg(); const r = c.mode === "fixed" ? { key: SEASONS[c.fixed] ? c.fixed : "spring", src: "choisie par le MJ" } : (fromCalendar() || fromRealDate());
  const ev = c.event === "auto" ? festival() : SEASON_EVENTS[c.event] || null;
  return { ...SEASONS[r.key], mode: c.mode, src: r.src, calLabel: r.label || "", event: ev?.key || "", eventName: ev?.name || "", eventInfo: ev, eventMode: c.event };
}
export const seasonChip = (s = currentSeason()) => `<span class="ms-season" style="--c:${esc(s.color)}" title="Saison du monde (${esc(s.src)})"><i class="fa-solid ${esc(s.icon)}"></i> ${esc(s.name)}${s.eventInfo ? ` · <i class="fa-solid ${esc(s.eventInfo.icon)}"></i> ${esc(s.eventInfo.name)}` : ""}</span>`;

/* annonce aux modules quand la saison (ou l'événement) change */
let LAST = "";
export function checkSeason(force = false) {
  const s = currentSeason(); const sig = `${s.key}|${s.event}`; if (!force && sig === LAST) return s; LAST = sig;
  Hooks.callAll("manhwaSeason", s.key, s); return s;
}
export async function setSeason(patch) { if (!game.user.isGM) return; await withLock(`set:${SYS}.season`, () => game.settings.set(SYS, "season", { ...seasonCfg(), ...patch })); }   /* lecture + écriture sous verrou */

Hooks.once("init", () => {
  game.settings.register(SYS, "season", { scope: "world", config: false, type: Object, default: DEF, onChange: () => checkSeason() });
  game.settings.register(SYS, "seasonEvents", { scope: "world", config: false, type: Object, default: { list: [] }, onChange: () => { applyCustom(); Hooks.callAll("manhwaSeasonEvents", SEASON_EVENTS); checkSeason(true); } });
});
Hooks.once("setup", () => applyCustom());
Hooks.once("ready", () => {
  applyCustom(); LAST = ""; checkSeason(true);
  Hooks.on("updateWorldTime", () => checkSeason());
  Hooks.on("horlogiaChange", () => checkSeason());
  setInterval(() => checkSeason(), 60000); /* calendriers qui changent sans faire avancer le temps, date réelle */
});
