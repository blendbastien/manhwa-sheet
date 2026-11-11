/* Manhwa Sheet 1.41 — CARTE DU JOUEUR (même D.A pour tous) + ATELIER DE LA CARTE + CATALOGUE DE COSMÉTIQUES + réglages MJ.
 * Catalogue : chaque effet (aura, type de carte, cadre, fond) et chaque sticker a une catégorie / un pack, une rareté et une source :
 * libre, rang (auras), pack possédé (« pack:plage »), achat à l'unité (« sticker:beach-crab ») ou MJ. Pensé pour des centaines d'éléments :
 * étiquettes de catégorie, recherche, filtre « possédés », pages. La carte est dessinée sur 960 × 560 et mise à l'échelle partout. */
import { SYS, esc, getConfig, rankOf, rootOf, pathOf, iconOf, rankBadge, isPlayerChar, levelColor } from "./config.js";
import { partiesOf, guildOf, actorOf } from "./world.js";
import { actorClass, actorSub, roleOf, subData, ownedIds, classById, subById } from "./classes.js";
import { seasonChip } from "./season.js";
import { moreChip } from "./morepop.js";

const { ApplicationV2, DialogV2 } = foundry.applications.api;
const W = 960, H = 560;
export const CARD_BASE = 3;

/* ══ CATALOGUE ══ */
export const COS_KINDS = { aura: ["Auras", "fa-wand-sparkles", "#7fd6ff"], type: ["Types de carte", "fa-clone", "#b46bff"], frame: ["Cadres du portrait", "fa-border-all", "#f5c518"], bg: ["Fonds", "fa-image", "#3dffb0"], sticker: ["Stickers", "fa-note-sticky", "#ff9ad5"] };
export const PACKS = {
  base: { n: "Essentiels", c: "#7fd6ff", ic: "fa-star" }, rank: { n: "Rangs", c: "#ff4d6d", ic: "fa-ranking-star" }, neon: { n: "Néon", c: "#ff3dd2", ic: "fa-bolt" },
  prestige: { n: "Prestige", c: "#f5c518", ic: "fa-crown" }, cosmos: { n: "Cosmos", c: "#9a7bff", ic: "fa-meteor" }, elem: { n: "Élémentaire", c: "#ff8a3a", ic: "fa-fire" },
  beach: { n: "Plage", c: "#ffd23f", ic: "fa-umbrella-beach", desc: "Soleil, sable et vagues" }
};
export const RARITIES = { common: ["Commun", "#9fb0d4"], rare: ["Rare", "#38a8ff"], epic: ["Épique", "#b46bff"], legend: ["Légendaire", "#f5c518"] };
const C = (kind, key, n, pack, rar, extra = {}) => ({ id: `${kind}:${key}`, kind, key, n, pack, rar, ...extra });
export const COSMETICS = [
  C("aura", "none", "Aucune", "base", "common", { free: true, icon: "fa-ban" }), C("aura", "pulse", "Pulsation", "rank", "rare", { icon: "fa-heart-pulse" }), C("aura", "halo", "Halo", "rank", "rare", { icon: "fa-circle-notch" }),
  C("aura", "flame", "Flammes", "elem", "epic", { icon: "fa-fire" }), C("aura", "frost", "Givre prismatique", "elem", "epic", { icon: "fa-snowflake" }), C("aura", "electric", "Électrique", "elem", "legend", { icon: "fa-bolt" }),
  C("type", "classic", "Classique", "base", "common", { free: true }), C("type", "holo", "Holographique", "neon", "epic"), C("type", "prism", "Prismatique", "cosmos", "epic"), C("type", "royal", "Royale", "prestige", "legend"),
  C("frame", "rank", "Couleur du rang", "base", "common", { free: true }), C("frame", "neon", "Néon", "neon", "rare"), C("frame", "holo", "Holographique", "neon", "epic"), C("frame", "gold", "Or royal", "prestige", "legend"), C("frame", "crystal", "Cristal", "cosmos", "epic"), C("frame", "obsidian", "Obsidienne", "cosmos", "rare"),
  C("bg", "rank", "Couleur du rang", "base", "common", { free: true }), C("bg", "nebula", "Nébuleuse", "cosmos", "rare"), C("bg", "aurora", "Aurore", "cosmos", "epic"), C("bg", "abyss", "Abysse", "cosmos", "rare"), C("bg", "solar", "Solaire", "elem", "rare"), C("bg", "void", "Néant", "cosmos", "legend"),
  ...[["palm", "Palmier", "rare"], ["sun", "Soleil à lunettes", "epic"], ["ball", "Ballon de plage", "common"], ["shell", "Coquillage", "common"], ["starfish", "Étoile de mer", "rare"], ["crab", "Crabe", "epic"], ["surf", "Planche de surf", "rare"]]
    .map(([k, n, r]) => C("sticker", `beach-${k}`, n, "beach", r, { src: `systems/${SYS}/assets/stickers/beach/${k}.svg` }))
];
export const cos = (kind, key) => COSMETICS.find(x => x.kind === kind && x.key === key) || null;
/* compat : anciennes listes */
export const AURAS = Object.fromEntries(COSMETICS.filter(x => x.kind === "aura").map(x => [x.key, [x.n, x.icon]]));
export const STICKERS = COSMETICS.filter(x => x.kind === "sticker").map(x => ({ id: x.key, n: x.n, src: x.src, pack: PACKS[x.pack]?.n }));
const AURA_DEF = { B: "pulse", A: "halo", S: "flame", SS: "frost", SSS: "electric" };
export const CARD_SHOW = { kicker: "Bandeau « Carte du joueur »", level: "Niveau", rank: "Rang", title: "Titre", cls: "Classe", sub: "Sous-classe", party: "Groupe", guild: "Guilde", obj: "Vitrine", ach: "Succès", season: "Saison" };
const SHOW_DEF = { season: false };
const BLOCKS = { portrait: "Portrait", level: "Niveau", rank: "Rang", kicker: "Bandeau", name: "Nom", title: "Titre", tags: "Classes et groupe", obj: "Vitrine", ach: "Succès", common: "Amis en commun" };
const LAYOUT_DEF = { portrait: { x: 44, y: 62 }, level: { x: 120, y: 34 }, rank: { x: 74, y: 452 }, kicker: { x: 344, y: 40 }, name: { x: 344, y: 62 }, title: { x: 344, y: 132 }, tags: { x: 344, y: 196 }, obj: { x: 344, y: 270 }, ach: { x: 344, y: 372 }, common: { x: 344, y: 458 } };
const POS = { top: ["Haut", 50, 12], center: ["Centre", 50, 50], bottom: ["Bas", 50, 88], left: ["Gauche", 20, 30], right: ["Droite", 80, 30] };
const EQ_ROOTS = ["weapon", "armor", "title"];   /* équipables sur la carte pour l'instant */

Hooks.once("init", () => { game.settings.register(SYS, "cardCfg", { scope: "world", config: false, type: Object, default: {}, onChange: () => rerenderAll() }); });
const cardCfg = () => { try { return game.settings.get(SYS, "cardCfg") || {}; } catch (e) { return {}; } };
const rankIdx = (cfg, k) => Math.max(0, cfg.ranks.findIndex(r => r.key === k));
export const auraOfRank = k => { const m = cardCfg().rankAura || {}; return k in m ? m[k] : (AURA_DEF[k] || "none"); };
const owned = a => new Set(a?.getFlag?.(SYS, "cardUnlocks") || []);
const rankAuras = (a, cfg = getConfig()) => { const ri = rankIdx(cfg, a?.system?.rank); const s = new Set(); cfg.ranks.forEach((r, i) => { if (i <= ri) s.add(auraOfRank(r.key)); }); return s; };
/** le personnage possède-t-il cet élément ? (libre, rang, pack, unité, MJ) */
export function owns(a, it) { if (!it) return false; if (game.user.isGM || it.free) return true; if (it.kind === "aura" && rankAuras(a).has(it.key)) return true; const U = owned(a); return U.has(it.id) || U.has(`pack:${it.pack}`); }
export function lockWhy(it) { const cfg = getConfig(); if (it.kind === "aura") { const r = cfg.ranks.find(x => auraOfRank(x.key) === it.key); if (r) return `Rang ${r.name}`; } return it.kind === "sticker" ? `Fait partie du pack ${PACKS[it.pack]?.n || it.pack}` : `Pack ${PACKS[it.pack]?.n || it.pack}`; }
export const cardUnlocked = (a, kind, k) => owns(a, cos(kind, k));
export function aurasOf(a) { return new Set(COSMETICS.filter(x => x.kind === "aura" && owns(a, x)).map(x => x.key)); }
export const cardMax = a => { const v = a?.getFlag?.(SYS, "cardMax"); const n = Number(v); return v !== undefined && v !== null && Number.isFinite(n) && n >= 0 ? n : (cardCfg().max !== undefined ? Number(cardCfg().max) || 0 : CARD_BASE); };
export const stkMax = a => { const v = a?.getFlag?.(SYS, "cardStkMax"); const n = Number(v); return v !== undefined && v !== null && Number.isFinite(n) && n >= 0 ? n : (Number(cardCfg().stkMax) || 0); };
const isTitle = (cfg, it) => rootOf(cfg, it.system?.category)?.id === "title";
const isAch = it => /achiev|succes|succès/i.test(String(it.system?.category || ""));
const nrm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
function friendsOf(a) { const out = []; const walk = l => { for (const n of l || []) { if (n.folder) walk(n.children); else { const o = (n.uuid && actorOf(n.uuid)) || (n.name && game.actors.find(x => nrm(x.name) === nrm(n.name))); if (o && o.uuid !== a?.uuid) out.push(o); } } }; walk(a?.system?.carnet?.friends); return out; }
const canEdit = a => !!a && (game.user.isGM || a.isOwner);

/** données de la carte, validées (élément non possédé → valeur libre) */
export function cardOf(a, raw = null) {
  const cfg = getConfig(); const r = raw ?? (a?.getFlag?.(SYS, "card") || {});
  const c = foundry.utils.mergeObject({ type: "classic", frame: "rank", bg: "rank", glow: "", eq: [], show: {}, cls: "", sub: "", clsHide: [], subHide: [], achHide: [], look: "", aura: "auto", portrait: { img: "", size: 100, pos: "top", zoom: 100, x: 50, y: 12 }, layout: {}, stickers: [] }, foundry.utils.deepClone(r), { inplace: false });
  for (const k of ["frame", "bg", "type"]) { const it = cos(k, c[k]); if (!it || !owns(a, it)) c[k] = COSMETICS.find(x => x.kind === k && x.free).key; }
  const ri = rankIdx(cfg, a?.system?.rank); if (!c.look || rankIdx(cfg, c.look) > ri || !cfg.ranks.some(x => x.key === c.look)) c.look = a?.system?.rank || cfg.ranks[0]?.key || "";
  if (c.aura !== "auto" && !owns(a, cos("aura", c.aura))) c.aura = "auto";
  c.show = { ...Object.fromEntries(Object.keys(CARD_SHOW).map(k => [k, SHOW_DEF[k] ?? true])), ...(c.show || {}) }; if (!r.v) c.show.season = false;
  c.v = 3;
  c.stickers = (c.stickers || []).filter(s => owns(a, cos("sticker", s.id)));
  return c;
}
const auraKey = (a, c) => c.aura === "auto" ? auraOfRank(a?.system?.rank) : c.aura;
const posOf = (c, k) => ({ ...LAYOUT_DEF[k], ...(c.layout?.[k] || {}) });
const clsInfo = (kind, x) => ({ n: x.name, icon: x.icon || (kind === "sub" ? "fa-briefcase" : "fa-graduation-cap"), c: kind === "sub" ? subData().cats?.[x.cat]?.color : roleOf(x).color, s: kind === "sub" ? subData().cats?.[x.cat]?.name || "" : roleOf(x).name || "" });

/** carte (surface 960 × 560 mise à l'échelle). mode : "view" | "edit" (atelier) | "chat" */
export function cardSurface(a, c, { viewer = null, mode = "view" } = {}) {
  const cfg = getConfig(); const s = a.system || {}; const sh = k => c.show?.[k] !== false; const ed = mode === "edit";
  const rk = rankOf(cfg, s.rank); const look = rankOf(cfg, c.look) || rk; const lv = Number(s.level) || 0; const lT = Math.min(6, Math.floor(lv / 10));
  const max = cardMax(a); const eq = (c.eq || []).map(id => a.items.get(id)).filter(i => i && EQ_ROOTS.includes(rootOf(cfg, i.system?.category)?.id)).slice(0, max);
  const titles = eq.filter(i => isTitle(cfg, i)), objs = eq.filter(i => !isTitle(cfg, i));
  const lst = l => l.map(i => ({ n: i.name, img: i.img, c: rankOf(cfg, i.system.rank)?.color, s: pathOf(cfg, i.system.category).slice(-1)[0]?.name || "" }));
  const oC = ownedIds(a, "cls"), oS = ownedIds(a, "sub");
  const cl = (c.cls && oC.includes(c.cls) ? classById(c.cls) : null) || actorClass(a); const sub = (c.sub && oS.includes(c.sub) ? subById(c.sub) : null) || actorSub(a); const party = partiesOf(a)[0]; const guild = guildOf(a);
  const more = (kind, fav) => { const by = kind === "sub" ? subById : classById; const hide = new Set(kind === "sub" ? c.subHide : c.clsHide); const o = (kind === "sub" ? oS : oC).filter(id => id !== fav && !hide.has(id)).map(by).filter(Boolean); return moreChip(o.map(x => clsInfo(kind, x)), kind === "sub" ? "Autres sous-classes" : "Autres classes"); };
  const tag = (ic, k, v, col = "") => `<span class="pc-tag"${col ? ` style="--tc:${esc(col)}"` : ""}><i class="fa-solid ${esc(ic)}"></i><small>${k}</small><b>${v}</b></span>`;
  const tags = [sh("cls") && cl ? tag(cl.icon || "fa-graduation-cap", "Classe", esc(cl.name) + more("cls", cl.id), roleOf(cl).color) : "", sh("sub") && sub ? tag(sub.icon || "fa-briefcase", "Sous-classe", esc(sub.name) + more("sub", sub.id), subData().cats?.[sub.cat]?.color) : "",
    sh("party") && party ? tag("fa-people-group", "Groupe", esc(party.name), party.color) : "", sh("guild") && guild ? tag("fa-shield-halved", "Guilde", esc(guild.name), guild.color) : "", sh("season") ? seasonChip() : ""].join("");
  const achH = new Set(c.achHide || []); const ach = a.items.filter(i => isAch(i) && !achH.has(i.id));
  const P = c.portrait || {}; const ps = Math.max(60, Math.min(160, Number(P.size) || 100)) / 100; const pw = Math.round(260 * ps), ph = Math.round(350 * ps);
  const blk = (k, inner, extra = "") => { if (!inner) return ""; const p = posOf(c, k); return `<div class="pc-b pc-b-${k}${ed ? " ed" : ""}" data-blk="${k}" style="left:${p.x}px;top:${p.y}px;${extra}">${inner}${ed ? `<i class="pc-grip" data-tooltip="Glisser : ${esc(BLOCKS[k])}"></i>` : ""}</div>`; };
  let html = "";
  html += blk("portrait", `<div class="pc-portrait" style="width:${pw}px;height:${ph}px"><img src="${esc(P.img || a.img)}" style="object-position:${Number(P.x) || 50}% ${Number(P.y) || 12}%;transform:scale(${Math.max(1, (Number(P.zoom) || 100) / 100)});transform-origin:${Number(P.x) || 50}% ${Number(P.y) || 12}%"></div>`);
  if (sh("level")) html += blk("level", `<div class="pc-lv lt-${lT}" style="--lvc:${esc(levelColor(lv))}"><small>NIV</small><b>${lv}</b></div>`);
  if (sh("rank")) html += blk("rank", `<div class="pc-rank">${rankBadge(rk, { size: "xl" })}<small>RANG ${esc(rk?.name || "")}</small></div>`);
  if (sh("kicker")) html += blk("kicker", `<small class="pc-kicker"><i class="fa-solid fa-id-badge"></i>Carte du joueur${isPlayerChar(a) ? ` · ${esc(game.users.find(u => !u.isGM && u.character?.id === a.id)?.name || "")}` : ""}</small>`);
  html += blk("name", `<h2 class="pc-name">${esc(a.name)}</h2>`);
  if (sh("title")) { const t = titles[0]; html += blk("title", t ? `<div class="pc-title" style="--tg:${esc(c.glow || rankOf(cfg, t.system.rank)?.color || "#f5c518")}"><i class="fa-solid fa-crown"></i><b>${esc(t.name)}</b>${moreChip(lst(titles.slice(1)), "Autres titres sur la carte")}</div>` : (ed ? `<div class="pc-title none"><i class="fa-solid fa-crown"></i><b>Aucun titre</b></div>` : "")); }
  if (tags) html += blk("tags", `<div class="pc-tags">${tags}</div>`);
  if (sh("obj")) { const o = objs[0]; html += blk("obj", o ? `<div class="pc-obj" style="--oc:${esc(rankOf(cfg, o.system.rank)?.color || "#7fd6ff")}"><span class="im"><img src="${esc(o.img)}">${rankBadge(rankOf(cfg, o.system.rank), { size: "sm" })}</span><span class="tx"><small>${esc(pathOf(cfg, o.system.category).map(n => n.name).slice(-2).join(" › "))}</small><b>${esc(o.name)}</b></span>${moreChip(lst(objs.slice(1)), "Autres objets en vitrine")}</div>` : (ed ? `<div class="pc-obj none"><span class="tx"><b>Vitrine vide</b><small>Onglet Équipement de l'atelier</small></span></div>` : "")); }
  if (sh("ach") && ach.length) html += blk("ach", `<div class="pc-ach"><h5><i class="fa-solid fa-trophy"></i>Succès <em>${ach.length}</em></h5><div class="l">${ach.slice(0, 10).map(i => `<span class="pc-achi" style="--ac:${esc(rankOf(cfg, i.system.rank)?.color || "#f5c518")}" data-tooltip="${esc(i.name)}"><img src="${esc(i.img)}"></span>`).join("")}${ach.length > 10 ? moreChip(lst(ach.slice(10)), "Autres succès") : ""}</div></div>`);
  if (viewer && viewer.uuid !== a.uuid) { const mine = new Set(friendsOf(viewer).map(o => o.uuid)); const com = friendsOf(a).filter(o => mine.has(o.uuid));
    html += blk("common", `<div class="pc-common"><h5><i class="fa-solid fa-user-group"></i>Amis en commun <em>${com.length}</em></h5>${com.length ? `<div class="l">${com.slice(0, 6).map(o => `<span class="pc-fr" data-tooltip="${esc(o.name)}"><img src="${esc(o.img)}"></span>`).join("")}${com.length > 6 ? moreChip(com.slice(6).map(o => ({ n: o.name, img: o.img })), "Autres amis en commun") : ""}</div>` : `<small class="none">Aucun pour l'instant.</small>`}</div>`); }
  const stk = (c.stickers || []).map((t, i) => { const def = cos("sticker", t.id); return def ? `<img class="pc-stk${ed ? " ed" : ""}${ed && i === c._sel ? " sel" : ""}" data-stk="${i}" src="${esc(def.src)}" style="left:${Number(t.x) || 0}px;top:${Number(t.y) || 0}px;width:${Number(t.s) || 90}px;transform:translate(-50%,-50%) rotate(${Number(t.r) || 0}deg)${t.f ? " scaleX(-1)" : ""};z-index:${20 + i}" draggable="false">` : ""; }).join("");
  const au = auraKey(a, c);
  return `<div class="pc-stage${mode === "chat" ? " chat" : ""}"><div class="ms-pcard v2 pc-t-${esc(c.type)} fr-${esc(c.frame)} bg-${esc(c.bg)} au-${esc(au)}${ed ? " editing" : ""}" data-uuid="${esc(a.uuid)}" style="--rk:${esc(look?.color || "#38a8ff")};--lvc:${esc(levelColor(lv))};width:${W}px;height:${H}px">
    <i class="pc-aura"><i></i><i></i><i></i></i><i class="pc-corner tl"></i><i class="pc-corner tr"></i><i class="pc-corner bl"></i><i class="pc-corner br"></i><i class="pc-sheen"></i><i class="pc-type"></i>${html}${stk}</div></div>`;
}

/** HTML de la carte (Menu, profil) avec ses boutons */
export function playerCardHTML(a, { viewer = null, edit = canEdit(a), compact = false } = {}) {
  if (!a) return `<div class="ms-mhint big">Personnage introuvable.</div>`;
  const c = cardOf(a);
  const tools = edit && !compact ? `<div class="pc-tools2"><a class="pc-btn studio" data-pc="studio"><i class="fa-solid fa-wand-magic-sparkles"></i>Atelier de la carte</a><a class="pc-btn share" data-pc="share"><i class="fa-solid fa-share-nodes"></i>Partager ma carte</a></div>` : "";
  return `<div class="ms-pchost v2">${cardSurface(a, c, { viewer, mode: compact ? "chat" : "view" })}${tools}</div>`;
}
const RO = new ResizeObserver(es => { for (const e of es) fitOne(e.target); });
function fitOne(st) { const card = st.firstElementChild; if (!card) return; const w = st.clientWidth || 0; const s = w ? w / W : 1; card.style.transform = `scale(${s})`; st.style.height = `${Math.round(H * s)}px`; st._s = s; }
export function fitCards(root) { root?.querySelectorAll?.(".pc-stage").forEach(st => { fitOne(st); RO.observe(st); }); }
export function bindPlayerCard(root, a, rerender) {
  fitCards(root);
  root.querySelectorAll("[data-pc]").forEach(b => b.addEventListener("click", async ev => { ev.preventDefault(); ev.stopPropagation(); const act = b.dataset.pc;
    if (act === "share") return shareCard(a); if (act === "studio") return openStudio(a); }));
}
export async function shareCard(a) {
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: a }), content: `<p>${esc(a.name)} partage sa carte du joueur.</p>`, flags: { [SYS]: { pcard: { uuid: a.uuid } } } });
  ui.notifications.info("Carte partagée dans le chat.");
}
Hooks.on("renderChatMessageHTML", (msg, html) => { const d = msg.flags?.[SYS]?.pcard; if (!d) return; const el = html instanceof HTMLElement ? html : html?.[0]; const c = el?.querySelector(".message-content"); if (!c) return; const a = actorOf(d.uuid);
  c.innerHTML = `<div class="pc-chat">${a ? cardSurface(a, cardOf(a), { mode: "chat" }).replace(/\sdata-more(?:list)?="[^"]*"/g, "") : ""}<a class="pc-btn view" data-pcview="${esc(d.uuid)}"><i class="fa-solid fa-id-badge"></i>Voir le profil</a></div>`;
  requestAnimationFrame(() => fitCards(c)); c.querySelector("[data-pcview]")?.addEventListener("click", ev => { ev.preventDefault(); openProfile(d.uuid); }); });

/* ── fenêtre de profil ── */
export class PlayerCardApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = { classes: ["ms-pcapp"], window: { title: "Carte du joueur", icon: "fa-solid fa-id-badge", resizable: true }, position: { width: 900, height: "auto" } };
  constructor(options, uuid) { super(options); this.uuid = uuid; }
  get actor() { return actorOf(this.uuid); }
  get title() { return `Carte du joueur — ${this.actor?.name || ""}`; }
  async _renderHTML() { const me = game.user.character || game.actors.find(x => x.isOwner && x.type === "character" && !game.user.isGM) || null; return playerCardHTML(this.actor, { viewer: me, edit: canEdit(this.actor) }); }
  _replaceHTML(r, c) { c.innerHTML = r; bindPlayerCard(c, this.actor, () => this.render()); }
}
export function openProfile(uuid) { if (!actorOf(uuid)) return ui.notifications.warn("Personnage introuvable."); const id = `ms-pcard-${String(uuid).replace(/\W/g, "_")}`; const app = foundry.applications.instances.get(id) ?? new PlayerCardApp({ id }, uuid); app.render({ force: true }); return app; }
function rerenderAll() { for (const app of foundry.applications.instances.values()) if ((app instanceof PlayerCardApp || app instanceof CardStudio) && app.rendered) app.render(); }
Hooks.on("updateActor", a => { for (const app of foundry.applications.instances.values()) if (app instanceof PlayerCardApp && app.uuid === a.uuid && app.rendered) app.render(); });

/* ══ CATALOGUE : rendu commun (atelier du joueur et fenêtre MJ) ══ */
const PER = { sticker: 12, default: 9 };
/** grille filtrable : étiquettes de catégories (packs), recherche, « possédés », pages. st = { pack, q, page, own } ; pick(it) → classe « on » */
export function catalogHTML(a, kind, st, { isOn = () => false, gm = false } = {}) {
  const all = COSMETICS.filter(x => x.kind === kind); const packs = [...new Set(all.map(x => x.pack))];
  const q = nrm(st.q); const list = all.filter(x => (st.pack === "all" || (st.pack === "own" ? owns(a, x) : x.pack === st.pack)) && (!q || nrm(x.n).includes(q) || nrm(PACKS[x.pack]?.n).includes(q)));
  const per = PER[kind] || PER.default; const pages = Math.max(1, Math.ceil(list.length / per)); const pg = Math.min(st.page || 0, pages - 1); const sl = list.slice(pg * per, pg * per + per);
  const chip = (k, n, ic, c, cnt, cls = "") => `<a class="cos-chip ${cls}${st.pack === k ? " on" : ""}" data-cos="pack" data-kind="${kind}" data-v="${k}" style="--pc:${esc(c)}"><i class="fa-solid ${ic}"></i>${esc(n)}<em>${cnt}</em></a>`;
  const chips = chip("all", "Tout", "fa-layer-group", "#9fb0d4", all.length) + (gm ? "" : chip("own", "Possédés", "fa-check", "#3ddc84", all.filter(x => owns(a, x)).length)) + packs.map(p => chip(p, PACKS[p]?.n || p, PACKS[p]?.ic || "fa-box", PACKS[p]?.c || "#9fb0d4", all.filter(x => x.pack === p).length, `cpk cp-${p}`)).join("");
  const prev = it => it.kind === "sticker" ? `<img src="${esc(it.src)}">` : it.kind === "aura" ? `<i class="fa-solid ${esc(it.icon || "fa-wand-sparkles")} au-ic a-${esc(it.key)}"></i>` : `<i class="sw"></i>`;
  const tiles = sl.map(it => { const ok = gm ? owned(a).has(it.id) || owned(a).has(`pack:${it.pack}`) || it.free : owns(a, it); const R = RARITIES[it.rar] || RARITIES.common;
    return `<a class="cos-t cp-${esc(it.pack)} o-${it.kind}-${esc(it.key)}${ok ? "" : " lock"}${isOn(it) ? " on" : ""}" data-cos="${gm ? "gm" : ok ? "pick" : "locked"}" data-kind="${kind}" data-v="${esc(it.key)}" style="--rr:${R[1]};--pc:${esc(PACKS[it.pack]?.c || "#9fb0d4")}" data-tooltip="${esc(`${it.n} — ${R[0]} · ${PACKS[it.pack]?.n || ""}${ok ? "" : ` · ${lockWhy(it)}`}`)}">
      <span class="pv">${prev(it)}</span><b>${esc(it.n)}</b><small class="rr">${esc(R[0])}</small>${ok ? (isOn(it) ? `<i class="fa-solid fa-check ck"></i>` : "") : `<em class="lk"><i class="fa-solid fa-lock"></i>${esc(lockWhy(it))}</em>`}</a>`; }).join("");
  const desc = st.pack !== "all" && st.pack !== "own" && PACKS[st.pack]?.desc ? `<div class="cos-pkdesc cp-${st.pack}"><i class="fa-solid ${PACKS[st.pack].ic}"></i>${esc(PACKS[st.pack].desc)}</div>` : "";
  return `<div class="cos-cat" data-kind="${kind}"><div class="cos-chips">${chips}</div><label class="cos-q"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-cosq="${kind}" value="${esc(st.q || "")}" placeholder="Rechercher parmi ${all.length}…"></label>${desc}
    <div class="cos-grid k-${kind}">${tiles || `<p class="pcs-note">Rien ici.</p>`}</div>${pages > 1 ? `<div class="cos-pg"><a data-cos="page" data-kind="${kind}" data-v="-1"><i class="fa-solid fa-chevron-left"></i></a><span>${pg + 1} / ${pages}</span><a data-cos="page" data-kind="${kind}" data-v="1"><i class="fa-solid fa-chevron-right"></i></a></div>` : ""}</div>`;
}
const ntag = (t, ic, c, extra = "") => `<h6 class="ntag" style="--nc:${esc(c)}"><span><i class="fa-solid ${ic}"></i>${esc(t)}</span>${extra ? `<small>${extra}</small>` : ""}</h6>`;

/* ══ ATELIER DE LA CARTE ══ */
const TABS = [["look", "Apparence", "fa-palette"], ["portrait", "Portrait", "fa-image-portrait"], ["layout", "Mise en page", "fa-up-down-left-right"], ["stickers", "Stickers", "fa-note-sticky"], ["infos", "Infos", "fa-eye"], ["equip", "Équipement", "fa-shirt"]];
const LOOK = [["color", "Couleur", "fa-droplet", "#ff4d6d"], ["aura", "Aura", "fa-wand-sparkles", "#7fd6ff"], ["type", "Type", "fa-clone", "#b46bff"], ["frame", "Cadre", "fa-border-all", "#f5c518"], ["bg", "Fond", "fa-image", "#3dffb0"], ["glow", "Glow", "fa-sun", "#ffd23f"]];
export function openStudio(a) { if (!canEdit(a)) return; const id = `ms-pcstudio-${a.id}`; const app = foundry.applications.instances.get(id) ?? new CardStudio({ id }, a.uuid); app.render({ force: true }); return app; }
export class CardStudio extends ApplicationV2 {
  static DEFAULT_OPTIONS = { classes: ["ms-pcstudio"], window: { title: "Atelier de la carte", icon: "fa-solid fa-wand-magic-sparkles", resizable: true }, position: { width: 1440, height: 840 } };
  constructor(options, uuid) { super(options); this.uuid = uuid; this.tab = "look"; this.look = "color"; this.d = null; this.sel = -1; this.cat = {}; this.eqNav = "all"; this.eqClosed = new Set(); }
  get actor() { return actorOf(this.uuid); }
  get title() { return `Atelier de la carte — ${this.actor?.name || ""}`; }
  st(kind) { return (this.cat[kind] ||= { pack: "all", q: "", page: 0 }); }
  async _renderHTML() {
    const a = this.actor; if (!a) return "<p>Personnage introuvable.</p>"; if (!this.d) this.d = cardOf(a); const d = this.d; d._sel = this.sel; const cfg = getConfig();
    const tabs = TABS.map(([k, n, ic]) => `<a data-st="tab" data-k="${k}" class="${this.tab === k ? "on" : ""}"><i class="fa-solid ${ic}"></i><span>${n}</span></a>`).join("");
    return `<div class="pcs-wrap"><section class="pcs-prev"><div class="pcs-hint"><i class="fa-solid fa-hand-pointer"></i> Glisse les blocs et les stickers directement sur la carte. Rien n'est enregistré avant « Enregistrer ».</div>${cardSurface(a, d, { mode: "edit" })}</section>
      <aside class="pcs-side"><nav class="pcs-tabs">${tabs}</nav><div class="pcs-panel">${this.#panel(a, d, cfg)}</div>
      <footer class="pcs-foot"><a class="pc-btn ghost" data-st="cancel"><i class="fa-solid fa-xmark"></i>Annuler</a><a class="pc-btn ghost" data-st="reset"><i class="fa-solid fa-rotate-left"></i>Tout par défaut</a><a class="pc-btn save" data-st="save"><i class="fa-solid fa-floppy-disk"></i>Enregistrer</a></footer></aside></div>`;
  }
  #panel(a, d, cfg) {
    const ri = rankIdx(cfg, a.system?.rank); const tg = (attr, n, v) => `<label class="pcs-tog"><input type="checkbox" ${attr}${v ? " checked" : ""}><i></i><span>${esc(n)}</span></label>`;
    if (this.tab === "look") {
      const sub = `<nav class="pcs-sub">${LOOK.map(([k, n, ic, c]) => `<a data-st="look" data-k="${k}" class="${this.look === k ? "on" : ""}" style="--nc:${c}"><i class="fa-solid ${ic}"></i>${n}</a>`).join("")}</nav>`;
      let body = "";
      if (this.look === "color") body = ntag("Couleur de la carte", "fa-droplet", "#ff4d6d", "tous les rangs déjà atteints") + `<div class="pcs-rks">${cfg.ranks.map((r, i) => { const ok = i <= ri || game.user.isGM; return `<a class="pcs-rk${d.look === r.key ? " on" : ""}${ok ? "" : " lock"}" data-st="${ok ? "set" : "locked"}" data-f="look" data-v="${esc(r.key)}" style="--c:${esc(r.color)}">${rankBadge(r, { size: "lg" })}${ok ? "" : `<i class="fa-solid fa-lock lk"></i>`}</a>`; }).join("")}</div>`;
      else if (this.look === "glow") body = ntag("Glow du titre", "fa-sun", "#ffd23f") + `<div class="pcs-row"><input type="color" data-in="glow" value="${esc(d.glow || "#f5c518")}"><label class="pcs-tog"><input type="checkbox" data-in="glowAuto"${d.glow ? "" : " checked"}><i></i><span>Couleur du rang du titre</span></label></div>`;
      else { const kind = this.look; const K = COS_KINDS[kind]; const cur = kind === "aura" ? d.aura : d[kind];
        const extra = kind === "aura" ? `<a class="cos-auto${d.aura === "auto" ? " on" : ""}" data-st="set" data-f="aura" data-v="auto"><i class="fa-solid fa-ranking-star"></i>Celle de mon rang <em>${esc(cos("aura", auraOfRank(a.system?.rank))?.n || "aucune")}</em></a>` : "";
        body = ntag(K[0], K[1], K[2], `${COSMETICS.filter(x => x.kind === kind && owns(a, x)).length} / ${COSMETICS.filter(x => x.kind === kind).length} possédés`) + extra + catalogHTML(a, kind, this.st(kind), { isOn: it => it.key === cur }); }
      return sub + body;
    }
    if (this.tab === "portrait") { const P = d.portrait || {};
      const sl = (k, n, min, max, v, u = "%") => `<label class="pcs-sl"><span>${n}</span><input type="range" data-pp="${k}" min="${min}" max="${max}" value="${v}"><b>${v}${u}</b></label>`;
      return ntag("Image", "fa-image", "#7fd6ff") + `<div class="pcs-img"><img src="${esc(P.img || a.img)}"><div><a class="pc-btn" data-st="pickImg"><i class="fa-solid fa-folder-open"></i>Choisir une image</a><a class="pc-btn ghost" data-st="sheetImg"><i class="fa-solid fa-id-card"></i>Image de la fiche</a></div></div>
        <label class="pcs-url"><span>ou un lien d'image</span><input type="text" data-in="img" value="${esc(P.img || "")}" placeholder="https://… ou chemin d'un fichier"></label>
        ${ntag("Taille et cadrage", "fa-crop-simple", "#b46bff")}${sl("size", "Taille du portrait", 60, 160, Number(P.size) || 100)}${sl("zoom", "Zoom", 100, 300, Number(P.zoom) || 100)}
        <div class="pcs-pos">${Object.entries(POS).map(([k, [n]]) => `<a class="pc-opt${P.pos === k ? " on" : ""}" data-st="pos" data-v="${k}"><span>${n}</span></a>`).join("")}</div>${sl("x", "Position horizontale", 0, 100, Number(P.x) || 50)}${sl("y", "Position verticale", 0, 100, Number(P.y) ?? 12)}`; }
    if (this.tab === "layout") return ntag("Blocs de la carte", "fa-up-down-left-right", "#7fd6ff", "glisse-les sur la carte") + `<div class="pcs-blocks">${Object.entries(BLOCKS).filter(([k]) => k !== "common").map(([k, n]) => { const sk = { level: "level", rank: "rank", kicker: "kicker", title: "title", obj: "obj", ach: "ach" }[k]; return `<div class="pcs-blk"><i class="fa-solid fa-grip-vertical"></i><span>${esc(n)}</span>${sk ? `<a data-st="eye" data-k="${sk}" class="${d.show[sk] !== false ? "on" : ""}"><i class="fa-solid ${d.show[sk] !== false ? "fa-eye" : "fa-eye-slash"}"></i></a>` : `<em>toujours</em>`}<a data-st="blkReset" data-k="${k}" data-tooltip="Remettre à sa place"><i class="fa-solid fa-rotate-left"></i></a></div>`; }).join("")}</div>
      <a class="pc-btn ghost wide" data-st="layoutReset"><i class="fa-solid fa-table-cells"></i>Disposition par défaut</a><p class="pcs-note">Les blocs s'aimantent tous les 10 px.</p>`;
    if (this.tab === "stickers") { const t = d.stickers?.[this.sel]; const mx = stkMax(a); const n = (d.stickers || []).length;
      return ntag("Stickers", "fa-note-sticky", "#ff9ad5", mx ? `<b class="stk-n${n >= mx ? " full" : ""}">${Math.max(0, mx - n)} / ${mx}</b> restants` : "") + catalogHTML(a, "sticker", this.st("sticker"), { isOn: () => false })
        + ntag("Sticker sélectionné", "fa-arrow-pointer", "#7fd6ff") + (t ? `<label class="pcs-sl"><span>Taille</span><input type="range" data-sk="s" min="30" max="320" value="${Number(t.s) || 90}"><b>${Number(t.s) || 90} px</b></label><label class="pcs-sl"><span>Rotation</span><input type="range" data-sk="r" min="-180" max="180" value="${Number(t.r) || 0}"><b>${Number(t.r) || 0}°</b></label>
          <div class="pcs-row"><a class="pc-btn" data-st="stkFlip"><i class="fa-solid fa-left-right"></i>Retourner</a><a class="pc-btn" data-st="stkFront"><i class="fa-solid fa-layer-group"></i>Devant</a><a class="pc-btn danger" data-st="stkDel"><i class="fa-solid fa-trash"></i>Retirer</a></div>` : `<p class="pcs-note">Clique sur un sticker de la carte pour le régler.</p>`); }
    if (this.tab === "infos") { const oC = ownedIds(a, "cls").map(classById).filter(Boolean), oS = ownedIds(a, "sub").map(subById).filter(Boolean); const fc = d.cls || actorClass(a)?.id || "", fs = d.sub || actorSub(a)?.id || "";
      const pickList = (L, fav, hide, f, kind) => L.filter(x => x.id !== fav).map(x => { const i = clsInfo(kind, x); return `<label class="pcs-chk" style="--c:${esc(i.c || "#7fd6ff")}"><input type="checkbox" data-hide="${f}" value="${esc(x.id)}"${(hide || []).includes(x.id) ? "" : " checked"}><i class="fa-solid ${esc(i.icon)}"></i><span>${esc(x.name)}</span><small>${esc(i.s)}</small></label>`; }).join("") || `<p class="pcs-note">Aucune autre.</p>`;
      const ach = a.items.filter(isAch);
      return ntag("Classe favorite", "fa-graduation-cap", "#ff6a5a") + (oC.length ? `<select data-in="cls">${oC.map(x => `<option value="${esc(x.id)}"${x.id === fc ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : `<p class="pcs-note">Aucune classe.</p>`)
        + ntag("Autres classes dans le « + »", "fa-list-check", "#ff6a5a", "coche exactement celles à montrer") + `<div class="pcs-chks">${pickList(oC, fc, d.clsHide, "clsHide", "cls")}</div>`
        + ntag("Sous-classe favorite", "fa-briefcase", "#ff5ad2") + (oS.length ? `<select data-in="sub">${oS.map(x => `<option value="${esc(x.id)}"${x.id === fs ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : `<p class="pcs-note">Aucune sous-classe.</p>`)
        + ntag("Autres sous-classes dans le « + »", "fa-list-check", "#ff5ad2", "coche exactement celles à montrer") + `<div class="pcs-chks">${pickList(oS, fs, d.subHide, "subHide", "sub")}</div>`
        + ntag("Succès montrés", "fa-trophy", "#f5c518") + `<div class="pcs-chks">${ach.map(i => `<label class="pcs-chk" style="--c:${esc(rankOf(cfg, i.system.rank)?.color || "#f5c518")}"><input type="checkbox" data-hide="achHide" value="${i.id}"${(d.achHide || []).includes(i.id) ? "" : " checked"}><img src="${esc(i.img)}"><span>${esc(i.name)}</span></label>`).join("") || `<p class="pcs-note">Aucun succès.</p>`}</div>`
        + ntag("Informations affichées", "fa-eye", "#7fd6ff") + `<div class="pcs-togs">${Object.entries(CARD_SHOW).map(([k, n]) => tg(`data-sf="${k}"`, n, d.show[k] !== false)).join("")}</div><p class="pcs-note">Les titres du « + » sont ceux équipés sur la carte (onglet Équipement), dans leur ordre.</p>`; }
    if (this.tab === "equip") return this.#equip(a, d, cfg);
    return "";
  }
  /* équipement : trié comme l'échange (catégories possédées, sous-catégories, repliables) ; armes, armures et titres seulement pour l'instant */
  #equip(a, d, cfg) {
    const max = cardMax(a); const on = (d.eq || []).filter(id => a.items.has(id)); const roots = cfg.items || [];
    const by = new Map(); for (const it of a.items) { const r = rootOf(cfg, it.system?.category)?.id || "items"; if (!by.has(r)) by.set(r, []); by.get(r).push(it); }
    const order = [...roots.map(r => r.id).filter(id => by.has(id)), ...[...by.keys()].filter(k => !roots.some(r => r.id === k))]; order.sort((x, y) => (EQ_ROOTS.includes(y) ? 1 : 0) - (EQ_ROOTS.includes(x) ? 1 : 0)); if (!this._eqInit) { this._eqInit = true; order.filter(id => !EQ_ROOTS.includes(id)).forEach(id => this.eqClosed.add(id)); }
    const nav = `<nav class="pcs-eqnav"><a data-st="eqNav" data-k="all" class="${this.eqNav === "all" ? "on" : ""}"><i class="fa-solid fa-layer-group"></i><span>Tout</span><em>${a.items.size}</em></a>${order.map(id => { const n = roots.find(r => r.id === id) || { name: "Autres", icon: "fa-cube", color: "#8ea0c8" }; const ok = EQ_ROOTS.includes(id);
      return `<a data-st="eqNav" data-k="${esc(id)}" class="${this.eqNav === id ? "on" : ""}${ok ? "" : " lockc"}" style="--ic:${esc(n.color || "#8ea0c8")}"><i class="fa-solid ${esc(iconOf(n) || "fa-cube")}"></i><span>${esc(n.name)}</span>${ok ? `<em>${by.get(id).length}</em>` : `<i class="fa-solid fa-lock lk"></i>`}</a>`; }).join("")}</nav>`;
    const secs = order.filter(id => this.eqNav === "all" || this.eqNav === id).map(id => { const n = roots.find(r => r.id === id) || { name: "Autres", icon: "fa-cube", color: "#8ea0c8" }; const ok = EQ_ROOTS.includes(id); const list = by.get(id).sort((x, y) => x.name.localeCompare(y.name, "fr"));
      const groups = new Map(); for (const i of list) { const s2 = pathOf(cfg, i.system?.category)[1]; const k = s2?.id || "_"; if (!groups.has(k)) groups.set(k, { n: s2, l: [] }); groups.get(k).l.push(i); }
      const card = i => { const k = on.indexOf(i.id); const r = rankOf(cfg, i.system.rank); return `<a class="pcs-eqi${k >= 0 ? " on" : ""}${ok ? "" : " lock"}" data-st="${ok ? "eq" : "eqLocked"}" data-id="${i.id}" style="--rc:${esc(r?.color || n.color || "#7fd6ff")}"><span class="im"><img src="${esc(i.img)}">${rankBadge(r, { size: "sm" })}</span><b>${esc(i.name)}</b>${ok ? `<em>${k >= 0 ? k + 1 : ""}</em>` : `<i class="fa-solid fa-lock lk"></i>`}</a>`; };
      const body = groups.size <= 1 ? `<div class="pcs-eqg">${list.map(card).join("")}</div>` : [...groups.entries()].map(([gk, g]) => `<div class="pcs-eqs${this.eqClosed.has(`${id}/${gk}`) ? " closed" : ""}"><h6 data-st="eqTog" data-k="${esc(id)}/${esc(gk)}"><i class="fa-solid fa-chevron-down cv"></i><i class="fa-solid ${esc(iconOf(g.n) || "fa-tag")}"></i>${esc(g.n?.name || "Autres")}<em>${g.l.length}</em></h6><div class="pcs-eqg">${g.l.map(card).join("")}</div></div>`).join("");
      return `<section class="pcs-eqc${this.eqClosed.has(id) ? " closed" : ""}${ok ? "" : " locked"}" style="--ic:${esc(n.color || "#8ea0c8")}"><header data-st="eqTog" data-k="${esc(id)}"><i class="fa-solid fa-chevron-down cv"></i><i class="fa-solid ${esc(iconOf(n) || "fa-cube")}"></i><b>${esc(n.name)}</b><em>${list.length}</em>${ok ? "" : `<span class="lk"><i class="fa-solid fa-lock"></i> Bientôt</span>`}</header>${body}</section>`; }).join("");
    return ntag("Équipement de la carte", "fa-shirt", "#3dffb0", `<b>${on.length}</b> / ${max} — armes, armures et titres pour l'instant`) + `<div class="pcs-eqwrap">${nav}<div class="pcs-eqbody">${secs}</div></div>`;
  }
  _replaceHTML(r, c) {
    const keep = c.querySelector(".pcs-panel")?.scrollTop || 0; const fq = document.activeElement?.dataset?.cosq; c.innerHTML = r; const p = c.querySelector(".pcs-panel"); if (p) p.scrollTop = keep; fitCards(c);
    if (fq) { const i = c.querySelector(`[data-cosq="${fq}"]`); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
    if (c.dataset.bound) return; c.dataset.bound = "1";
    c.addEventListener("click", ev => { const k = ev.target.closest("[data-cos]"); if (k) { ev.preventDefault(); return this.#cos(k); } const b = ev.target.closest("[data-st]"); if (b) { ev.preventDefault(); this.#act(b.dataset.st, b); } });
    c.addEventListener("input", ev => this.#input(ev.target, false)); c.addEventListener("change", ev => this.#input(ev.target, true));
    c.addEventListener("pointerdown", ev => this.#drag(ev));
  }
  #cos(b) { const kind = b.dataset.kind; const st = this.st(kind); const a = this.actor; const d = this.d;
    if (b.dataset.cos === "pack") { st.pack = b.dataset.v; st.page = 0; return this.render(); }
    if (b.dataset.cos === "page") { st.page = Math.max(0, (st.page || 0) + Number(b.dataset.v)); return this.render(); }
    if (b.dataset.cos === "locked") return ui.notifications.info(`Verrouillé : ${lockWhy(cos(kind, b.dataset.v))}.`);
    if (b.dataset.cos === "pick") { const key = b.dataset.v;
      if (kind === "sticker") { const mx = stkMax(a); if (mx && d.stickers.length >= mx) return ui.notifications.info(`Limite de stickers atteinte (${mx}).`); d.stickers.push({ id: key, x: W / 2 + (Math.random() * 120 - 60), y: H / 2 + (Math.random() * 80 - 40), s: 100, r: Math.round(Math.random() * 30 - 15) }); this.sel = d.stickers.length - 1; return this.render(); }
      if (kind === "aura") d.aura = key; else d[kind] = key; return this.render(); } }
  #redraw() { const c = this.element?.querySelector(".pcs-prev"); if (!c) return this.render(); this.d._sel = this.sel; const old = c.querySelector(".pc-stage"); const tmp = document.createElement("div"); tmp.innerHTML = cardSurface(this.actor, this.d, { mode: "edit" }); old.replaceWith(tmp.firstElementChild); fitCards(c); }
  #input(t, commit) {
    const d = this.d;
    if (t.dataset.cosq) { clearTimeout(this._qT); this._qT = setTimeout(() => { const st = this.st(t.dataset.cosq); st.q = t.value; st.page = 0; this.render(); }, 220); return; }
    if (t.dataset.pp) { d.portrait[t.dataset.pp] = Number(t.value); if (t.dataset.pp === "x" || t.dataset.pp === "y") d.portrait.pos = ""; const b = t.parentElement.querySelector("b"); if (b) b.textContent = `${t.value}%`; return this.#redraw(); }
    if (t.dataset.sk && d.stickers[this.sel]) { d.stickers[this.sel][t.dataset.sk] = Number(t.value); const b = t.parentElement.querySelector("b"); if (b) b.textContent = `${t.value}${t.dataset.sk === "r" ? "°" : " px"}`; return this.#redraw(); }
    if (t.dataset.sf) { d.show[t.dataset.sf] = t.checked; return this.#redraw(); }
    if (t.dataset.hide) { const k = t.dataset.hide; const s = new Set(d[k] || []); t.checked ? s.delete(t.value) : s.add(t.value); d[k] = [...s]; return this.#redraw(); }
    if (t.dataset.in === "glow") { d.glow = t.value; const ck = this.element.querySelector('[data-in="glowAuto"]'); if (ck) ck.checked = false; return this.#redraw(); }
    if (t.dataset.in === "glowAuto") { d.glow = t.checked ? "" : (this.element.querySelector('[data-in="glow"]')?.value || "#f5c518"); return this.#redraw(); }
    if (t.dataset.in === "img" && commit) { d.portrait.img = t.value.trim(); return this.render(); }
    if (t.dataset.in === "cls" || t.dataset.in === "sub") { d[t.dataset.in] = t.value; return this.render(); }
  }
  async #act(act, b) {
    const a = this.actor, d = this.d;
    if (act === "tab") { this.tab = b.dataset.k; return this.render(); }
    if (act === "look") { this.look = b.dataset.k; return this.render(); }
    if (act === "locked") return ui.notifications.info("Verrouillé : rang pas encore atteint.");
    if (act === "set") { d[b.dataset.f] = b.dataset.v; return this.render(); }
    if (act === "pos") { const [, x, y] = POS[b.dataset.v]; Object.assign(d.portrait, { pos: b.dataset.v, x, y }); return this.render(); }
    if (act === "pickImg") { const FP = foundry.applications.apps.FilePicker.implementation; return new FP({ type: "image", current: d.portrait.img || a.img, callback: path => { d.portrait.img = path; this.render(); } }).render(true); }
    if (act === "sheetImg") { d.portrait.img = ""; return this.render(); }
    if (act === "eye") { const k = b.dataset.k; d.show[k] = d.show[k] === false; return this.render(); }
    if (act === "blkReset") { delete d.layout[b.dataset.k]; return this.render(); }
    if (act === "layoutReset") { d.layout = {}; return this.render(); }
    if (act === "stkDel") { d.stickers.splice(this.sel, 1); this.sel = -1; return this.render(); }
    if (act === "stkFlip") { const t = d.stickers[this.sel]; if (t) t.f = !t.f; return this.render(); }
    if (act === "stkFront") { const t = d.stickers.splice(this.sel, 1)[0]; if (t) { d.stickers.push(t); this.sel = d.stickers.length - 1; } return this.render(); }
    if (act === "eqNav") { this.eqNav = b.dataset.k; return this.render(); }
    if (act === "eqTog") { const k = b.dataset.k; this.eqClosed.has(k) ? this.eqClosed.delete(k) : this.eqClosed.add(k); return this.render(); }
    if (act === "eqLocked") return ui.notifications.info("Cette catégorie ne s'équipe pas encore sur la carte (armes, armures et titres pour l'instant).");
    if (act === "eq") { const id = b.dataset.id; const max = cardMax(a); const l = (d.eq || []).filter(x => a.items.has(x)); const k = l.indexOf(id); if (k >= 0) l.splice(k, 1); else { if (l.length >= max) return ui.notifications.info(max ? `Limite atteinte (${max}) : retire d'abord un élément.` : "Le MJ n'a pas encore ouvert d'emplacement sur ta carte."); l.push(id); } d.eq = l; return this.render(); }
    if (act === "reset") { if (!await DialogV2.confirm({ window: { title: "Tout remettre par défaut" }, classes: ["ms-dialog"], content: "<p>Remettre la carte comme au départ (apparence, portrait, disposition, stickers, infos) ? L'équipement est gardé.</p>" })) return; this.d = cardOf(a, { eq: d.eq, v: 3 }); this.sel = -1; return this.render(); }
    if (act === "cancel") { this.d = null; return this.close(); }
    if (act === "save") { const out = foundry.utils.deepClone(d); delete out._sel; await a.update({ [`flags.${SYS}.-=card`]: null }); await a.setFlag(SYS, "card", out); ui.notifications.info("Carte du joueur enregistrée."); this.d = null; return this.close(); }
  }
  #drag(ev) {
    const st = this.element?.querySelector(".pcs-prev .pc-stage"); if (!st || !st.contains(ev.target) || ev.button !== 0) return; if (ev.target.closest(".ms-more")) return;
    const sk = ev.target.closest("[data-stk]"); const bk = sk ? null : ev.target.closest("[data-blk]"); if (!sk && !bk) { if (this.sel !== -1) { this.sel = -1; if (this.tab === "stickers") this.render(); else this.#redraw(); } return; }
    ev.preventDefault(); const s = st._s || 1; const el = sk || bk; const x0 = ev.clientX, y0 = ev.clientY;
    const start = sk ? { x: Number(this.d.stickers[sk.dataset.stk].x) || 0, y: Number(this.d.stickers[sk.dataset.stk].y) || 0 } : posOf(this.d, bk.dataset.blk);
    if (sk) { this.sel = Number(sk.dataset.stk); st.querySelectorAll(".pc-stk").forEach(x => x.classList.toggle("sel", x === sk)); }
    el.classList.add("drag"); el.setPointerCapture?.(ev.pointerId); let cur = { ...start };
    const mv = e => { const dx = (e.clientX - x0) / s, dy = (e.clientY - y0) / s; cur = sk ? { x: Math.round(start.x + dx), y: Math.round(start.y + dy) } : { x: Math.round((start.x + dx) / 10) * 10, y: Math.round((start.y + dy) / 10) * 10 };
      cur.x = Math.max(sk ? 0 : -20, Math.min(W - (sk ? 0 : 40), cur.x)); cur.y = Math.max(sk ? 0 : -20, Math.min(H - (sk ? 0 : 30), cur.y)); el.style.left = `${cur.x}px`; el.style.top = `${cur.y}px`; };
    const up = () => { el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); el.classList.remove("drag");
      if (sk) Object.assign(this.d.stickers[sk.dataset.stk], cur); else this.d.layout[bk.dataset.blk] = cur; if (sk && this.tab === "stickers") this.render(); };
    el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  }
}

/* ══ RÉGLAGES MJ (Menu › Réglages) ══ */
export function cardGmPanel() {
  const cfg = getConfig(); const pcs = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner).sort((x, y) => x.name.localeCompare(y.name, "fr")); const cc = cardCfg();
  return `<h4><i class="fa-solid fa-id-badge"></i> Cartes du joueur</h4><p class="ms-mhint">Chaque rang atteint débloque sa couleur de carte et son aura (le joueur peut garder celles d'un rang inférieur). Le reste du catalogue (packs entiers ou éléments à l'unité) se donne joueur par joueur.</p>
    <div class="pcg-ranks">${cfg.ranks.map(r => `<label style="--c:${esc(r.color)}">${rankBadge(r, { size: "sm" })}<select data-pcg="aura" data-rank="${esc(r.key)}">${COSMETICS.filter(x => x.kind === "aura").map(x => `<option value="${x.key}"${auraOfRank(r.key) === x.key ? " selected" : ""}>${esc(x.n)}</option>`).join("")}</select></label>`).join("")}</div>
    <div class="ms-mtop"><label class="ms-mcheck">Limite d'équipement par défaut <input type="number" min="0" max="30" data-pcg="max" value="${Number(cc.max ?? CARD_BASE)}" style="width:60px"></label><label class="ms-mcheck">Stickers par défaut (0 = illimité) <input type="number" min="0" max="99" data-pcg="stk" value="${Number(cc.stkMax || 0)}" style="width:60px"></label></div>
    <table class="pcg-pl"><thead><tr><th>Personnage</th><th>Équipement</th><th>Stickers <small>(0 = illimité)</small></th><th>Catalogue</th></tr></thead><tbody>${pcs.map(a => `<tr data-aid="${a.id}"><td><img src="${esc(a.img)}"><b>${esc(a.name)}</b></td><td><input type="number" min="0" max="30" data-pcg="amax" value="${cardMax(a)}"></td><td><input type="number" min="0" max="99" data-pcg="astk" value="${stkMax(a)}"></td><td><a class="ms-mbtn blue" data-pcg="unl"><i class="fa-solid fa-box-open"></i> ${owned(a).size} élément(s) / pack(s)</a></td></tr>`).join("") || `<tr><td colspan="4">Aucun personnage joueur.</td></tr>`}</tbody></table>`;
}
export function bindCardGm(root) {
  const setCC = async (k, v) => { const cc = foundry.utils.deepClone(cardCfg()); if (typeof k === "function") k(cc); else cc[k] = v; await game.settings.set(SYS, "cardCfg", cc); };
  root.querySelectorAll('[data-pcg="aura"]').forEach(s => s.addEventListener("change", () => setCC(cc => { cc.rankAura = { ...(cc.rankAura || {}), [s.dataset.rank]: s.value }; })));
  root.querySelector('[data-pcg="max"]')?.addEventListener("change", e => setCC("max", Math.max(0, Number(e.target.value) || 0)));
  root.querySelector('[data-pcg="stk"]')?.addEventListener("change", e => setCC("stkMax", Math.max(0, Number(e.target.value) || 0)));
  root.querySelectorAll('[data-pcg="amax"]').forEach(i => i.addEventListener("change", async () => { const a = game.actors.get(i.closest("[data-aid]").dataset.aid); if (a) await a.setFlag(SYS, "cardMax", Math.max(0, Number(i.value) || 0)); }));
  root.querySelectorAll('[data-pcg="astk"]').forEach(i => i.addEventListener("change", async () => { const a = game.actors.get(i.closest("[data-aid]").dataset.aid); if (a) await a.setFlag(SYS, "cardStkMax", Math.max(0, Number(i.value) || 0)); }));
  root.querySelectorAll('[data-pcg="unl"]').forEach(b => b.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); const a = game.actors.get(b.closest("[data-aid]").dataset.aid); if (a) new CatalogGM({ id: `ms-pccat-${a.id}` }, a.uuid).render({ force: true }); }));
}
/* catalogue du MJ : packs entiers et éléments à l'unité, avec les mêmes étiquettes / recherche / pages que l'atelier */
class CatalogGM extends ApplicationV2 {
  static DEFAULT_OPTIONS = { classes: ["ms-pcstudio", "ms-pccat"], window: { title: "Catalogue de la carte", icon: "fa-solid fa-box-open", resizable: true }, position: { width: 820, height: 760 } };
  constructor(o, uuid) { super(o); this.uuid = uuid; this.kind = "aura"; this.cat = {}; }
  get actor() { return actorOf(this.uuid); } get title() { return `Catalogue de la carte — ${this.actor?.name || ""}`; }
  st(k) { return (this.cat[k] ||= { pack: "all", q: "", page: 0 }); }
  async _renderHTML() { const a = this.actor; const U = owned(a);
    const packs = Object.entries(PACKS).filter(([k]) => COSMETICS.some(x => x.pack === k && !x.free)).map(([k, p]) => `<label class="cos-chip cpk cp-${k}${U.has(`pack:${k}`) ? " on" : ""}" style="--pc:${p.c}"><input type="checkbox" data-gpk="${k}"${U.has(`pack:${k}`) ? " checked" : ""}><i class="fa-solid ${p.ic}"></i>${esc(p.n)}<em>${COSMETICS.filter(x => x.pack === k).length}</em></label>`).join("");
    return `<div class="pcc-wrap">${ntag("Packs possédés", "fa-box-open", "#f5c518", "un pack donne tous ses éléments")}<div class="cos-chips">${packs}</div>
      ${ntag("Éléments à l'unité", "fa-cube", "#7fd6ff", "clique pour donner / retirer")}<nav class="pcs-sub">${Object.entries(COS_KINDS).map(([k, [n, ic, c]]) => `<a data-gk="${k}" class="${this.kind === k ? "on" : ""}" style="--nc:${c}"><i class="fa-solid ${ic}"></i>${n}</a>`).join("")}</nav>
      ${catalogHTML(a, this.kind, this.st(this.kind), { gm: true, isOn: it => U.has(it.id) })}<p class="pcs-note">Vert = possédé (à l'unité ou par un pack). Les auras de rang se gèrent dans les réglages des rangs.</p></div>`; }
  _replaceHTML(r, c) { const fq = document.activeElement?.dataset?.cosq; c.innerHTML = r; if (fq) { const i = c.querySelector(`[data-cosq="${fq}"]`); i?.focus(); }
    if (c.dataset.bound) return; c.dataset.bound = "1"; const a = () => this.actor;
    c.addEventListener("click", async ev => { const g = ev.target.closest("[data-gk]"); if (g) { this.kind = g.dataset.gk; return this.render(); }
      const k = ev.target.closest("[data-cos]"); if (!k) return; ev.preventDefault(); const st = this.st(k.dataset.kind);
      if (k.dataset.cos === "pack") { st.pack = k.dataset.v; st.page = 0; return this.render(); } if (k.dataset.cos === "page") { st.page = Math.max(0, st.page + Number(k.dataset.v)); return this.render(); }
      if (k.dataset.cos === "gm") { const it = cos(k.dataset.kind, k.dataset.v); if (!it || it.free) return; const U = owned(a()); U.has(it.id) ? U.delete(it.id) : U.add(it.id); await a().setFlag(SYS, "cardUnlocks", [...U]); return this.render(); } });
    c.addEventListener("change", async ev => { const p = ev.target.dataset.gpk; if (!p) return; const U = owned(a()); ev.target.checked ? U.add(`pack:${p}`) : U.delete(`pack:${p}`); await a().setFlag(SYS, "cardUnlocks", [...U]); this.render(); });
    c.addEventListener("input", ev => { const q = ev.target.dataset.cosq; if (!q) return; clearTimeout(this._t); this._t = setTimeout(() => { const st = this.st(q); st.q = ev.target.value; st.page = 0; this.render(); }, 220); }); }
}
