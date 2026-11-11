/* Manhwa Sheet — données partagées du Menu (groupes, quêtes, guildes, réglages des onglets) et relais MJ.
 * Les réglages « monde » ne s'écrivent que par le MJ : un joueur demande une opération par le socket du système,
 * le MJ actif l'exécute (accepter une quête, déposer au trésor, échanger…). */
import { SYS, getConfig, goldResource, uid } from "./config.js";

export const MENU_TABS = [
  { key: "news", name: "Annonces", icon: "fa-bullhorn", color: "#ff9b3d" },
  { key: "letters", name: "Courrier", icon: "fa-envelopes-bulk", color: "#ff8af0" },
  { key: "friends", name: "Amis", icon: "fa-user-group", color: "#b980ff" },
  { key: "mail", name: "Téléphone", icon: "fa-mobile-screen", color: "#4a8dff" },
  { key: "trade", name: "Échange", icon: "fa-right-left", color: "#5aff9a" },
  { key: "party", name: "Groupe", icon: "fa-people-group", color: "#38e0ff" },
  { key: "quests", name: "Quêtes", icon: "fa-scroll", color: "#ffd070" },
  { key: "guild", name: "Guilde", icon: "fa-shield-halved", color: "#e2c273" },
  { key: "places", name: "Téléportation", icon: "fa-location-dot", color: "#8fd4ff" },
  { key: "notes", name: "Notes", icon: "fa-pen-nib", color: "#c9b07a" }
];
/* groupes du Menu (ordre d'affichage) : les modules donnent le leur dans registerMenuTab({ group }) */
export const MENU_GROUPS = [
  { key: "orbis", name: "Orbis Astra" },
  { key: "comm", name: "Communication" },
  { key: "adv", name: "Aventure" },
  { key: "perso", name: "Personnel" },
  { key: "other", name: "Autres" }
];
const TAB_GROUP = { news: "comm", letters: "comm", mail: "comm", friends: "comm", party: "adv", quests: "adv", guild: "adv", places: "adv", trade: "perso", notes: "perso" };
export const groupOf = key => TAB_GROUP[key] || "other";
export const QUEST_TYPES = [
  { key: "main", name: "Principale", icon: "fa-crown", color: "#ffd070" },
  { key: "side", name: "Secondaire", icon: "fa-compass", color: "#38a8ff" },
  { key: "daily", name: "Journalière", icon: "fa-sun", color: "#5aff9a" },
  { key: "hunt", name: "Chasse", icon: "fa-skull", color: "#ff4d5e" },
  { key: "escort", name: "Escorte", icon: "fa-shield-heart", color: "#8fd4ff" },
  { key: "gather", name: "Collecte", icon: "fa-basket-shopping", color: "#9be564" },
  { key: "explore", name: "Exploration", icon: "fa-map", color: "#e2c273" },
  { key: "dungeon", name: "Donjon", icon: "fa-dungeon", color: "#b980ff" },
  { key: "event", name: "Événement", icon: "fa-bolt", color: "#ff8af0" },
  { key: "urgent", name: "Urgente", icon: "fa-triangle-exclamation", color: "#ff9b3d" },
  { key: "hidden", name: "Cachée", icon: "fa-eye-slash", color: "#9aa4bf" }
];
export const QUEST_STATUS = { open: "Disponible", active: "En cours", done: "Terminée", failed: "Échouée" };
export const GUILD_ROLES = ["Maître de guilde", "Officier", "Membre", "Recrue"];

const DEF_MENU = { tabs: MENU_TABS.map(t => ({ key: t.key, name: t.name, icon: t.icon, color: t.color, on: true, players: true })), questTypes: QUEST_TYPES, questView: "board", mailInChat: false, tradeInChat: true, orderV: 2, grouped: true };

Hooks.once("init", () => {
  const reg = (k, d) => game.settings.register(SYS, k, { scope: "world", config: false, type: Object, default: d, onChange: () => refreshMenus() });
  reg("menuCfg", DEF_MENU); reg("parties", { list: [] }); reg("quests", { list: [] }); reg("guilds", { list: [] }); reg("letters", { list: [] }); reg("news", { list: [] });
});

/* ── lecture ── */
/* onglets fournis par d'autres modules (Gacha, boutiques…) : MANHWA.registerMenuTab({ key, name, icon, color, players, render, bind, act }) à l'init */
/* images d'onglet fournies par un module (ex. pack d'icônes du Gacha) et règles de visibilité par joueur */
export const TAB_IMG = {}, TAB_VIS = {}, TAB_OPEN = {};
export function setMenuTabImage(key, url) { if (!key) return; if (url) TAB_IMG[key] = url; else delete TAB_IMG[key]; refreshMenus(); }
export const tabImage = t => t?.img || (typeof TAB_IMG[t?.key] === "function" ? TAB_IMG[t.key]() : TAB_IMG[t?.key]) || "";
export function registerMenuTab(def) { if (def?.key && typeof def.open === "function") TAB_OPEN[def.key] = def.open; if (def?.key && def.group) { TAB_GROUP[def.key] = def.group; if (def.groupName && !MENU_GROUPS.some(g => g.key === def.group)) MENU_GROUPS.splice(MENU_GROUPS.length - 1, 0, { key: def.group, name: def.groupName }); } if (def?.key && typeof def.visible === "function") TAB_VIS[def.key] = def.visible; if (def?.key && def.img) TAB_IMG[def.key] = def.img; if (!def?.key || MENU_TABS.some(m => m.key === def.key)) return; MENU_TABS.push({ key: def.key, name: def.name || def.key, icon: def.icon || "fa-star", color: def.color || "#8ea0c8" }); DEF_MENU.tabs.push({ key: def.key, name: def.name || def.key, icon: def.icon || "fa-star", color: def.color || "#8ea0c8", on: def.on !== false, players: def.players !== false }); }
export function menuCfg() {
  const raw = game.settings.get(SYS, "menuCfg") || {}; const c = foundry.utils.mergeObject(foundry.utils.deepClone(DEF_MENU), raw, { inplace: false });
  const known = new Set(c.tabs.map(t => t.key)); for (const t of DEF_MENU.tabs) if (!known.has(t.key)) c.tabs.push({ ...t });
  c.tabs = c.tabs.filter(t => MENU_TABS.some(m => m.key === t.key)); if ((raw.orderV || 0) < 2) { const idx = k => MENU_TABS.findIndex(m => m.key === k); c.tabs.sort((a, b) => idx(a.key) - idx(b.key)); c.orderV = 2; }
  for (const t of c.tabs) t.color ||= MENU_TABS.find(m => m.key === t.key)?.color || "#8ea0c8";
  /* 1.37 : l'onglet « Messagerie » s'appelle « Téléphone » (sauf s'il a été renommé par le MJ) */
  for (const t of c.tabs) if (t.key === "mail" && (!t.name || t.name === "Messagerie")) { t.name = "Téléphone"; if (!t.icon || t.icon === "fa-comments") t.icon = "fa-mobile-screen"; }
  if (!Array.isArray(c.questTypes) || !c.questTypes.length) c.questTypes = QUEST_TYPES;
  return c;
}
export const parties = () => foundry.utils.deepClone(game.settings.get(SYS, "parties")?.list || []);
export const quests = () => foundry.utils.deepClone(game.settings.get(SYS, "quests")?.list || []);
export const letters = () => foundry.utils.deepClone(game.settings.get(SYS, "letters")?.list || []);
export const news = () => foundry.utils.deepClone(game.settings.get(SYS, "news")?.list || []);
export const guilds = () => foundry.utils.deepClone(game.settings.get(SYS, "guilds")?.list || []);
export const actorOf = uuid => { if (!uuid) return null; try { return fromUuidSync(uuid); } catch (e) { return null; } };
export const partiesOf = actor => parties().filter(p => p.members.some(m => m.uuid === actor?.uuid));
export const guildOf = actor => guilds().find(g => g.members.some(m => m.uuid === actor?.uuid)) || null;

/* ── verrous : une seule opération à la fois par clé (1.25.0) ──
 * Tout ce qui lit puis réécrit une donnée partagée (liste d'un réglage monde, or d'un personnage, requête d'un joueur
 * traitée par le MJ) passe par ici : deux opérations sur la même clé s'enchaînent au lieu de se croiser, sinon la
 * seconde réécrivait la donnée à partir d'une lecture périmée et effaçait la première (lettres disparues, or compté deux fois…).
 * La table est partagée avec les modules compagnons (Gacha, Catalogue, Véhicules) via globalThis pour que l'or d'un
 * personnage soit touché par un seul module à la fois. */
const LOCKS = globalThis.__manhwaLocks ||= new Map();
export function withLock(key, fn) {
  const prev = LOCKS.get(key) || Promise.resolve(); const run = prev.then(fn); const tail = run.catch(() => {}); LOCKS.set(key, tail);
  tail.then(() => { if (LOCKS.get(key) === tail) LOCKS.delete(key); }); return run;
}
export const actorLock = (actor, fn) => withLock(`actor:${actor?.uuid || actor}`, fn);
/** réglage monde objet : lecture + modification + écriture sous verrou ; fn(obj) rend false pour ne rien écrire */
export async function editSetting(ns, key, fn) { if (!game.user.isGM) return null; return withLock(`set:${ns}.${key}`, async () => { const v = foundry.utils.deepClone(game.settings.get(ns, key)); const r = await fn(v); if (r !== false) await game.settings.set(ns, key, v); return v; }); }

/* ── écriture (MJ) ── */
export async function saveMenuCfg(c) { if (game.user.isGM) await withLock(`set:${SYS}.menuCfg`, () => game.settings.set(SYS, "menuCfg", c)); }
/** modifie menuCfg sous verrou : fn(cfg) (préférer à saveMenuCfg quand on part de menuCfg()) */
export async function editMenuCfg(fn) { if (!game.user.isGM) return null; return withLock(`set:${SYS}.menuCfg`, async () => { const c = menuCfg(); const r = await fn(c); if (r !== false) await game.settings.set(SYS, "menuCfg", c); return c; }); }
export async function saveList(key, list) { if (game.user.isGM) await withLock(`set:${SYS}.${key}`, () => game.settings.set(SYS, key, { list })); }
/** lit la liste la plus fraîche sous verrou, applique fn(liste) et réécrit (sauf si fn rend false). Rend { list, changed }.
 * Toute vérification (déjà réclamé, déjà membre, solde suffisant…) doit se faire DANS fn, jamais avant l'appel. */
export async function editList(key, fn) {
  if (!game.user.isGM) { const l = foundry.utils.deepClone(game.settings.get(SYS, key)?.list || []); return Object.assign(l, { changed: false }); }
  return withLock(`set:${SYS}.${key}`, async () => { const l = foundry.utils.deepClone(game.settings.get(SYS, key)?.list || []); const r = await fn(l); const changed = r !== false; if (changed) await game.settings.set(SYS, key, { list: l }); return Object.assign(l, { changed }); });
}

/* ── or : clé de la monnaie de référence ── */
export const goldKey = () => goldResource(getConfig())?.key || null;
export const goldOf = actor => Number(actor?.system?.resources?.[goldKey()]) || 0;
/** ajoute (ou retire) de l'or sous verrou du personnage ; `strict` : refuse (false) au lieu de plafonner à 0 si le solde ne suffit pas */
/* 1.59 : par le poste du MJ (tx.js) — une récompense et un achat simultanés ne s'annulent plus */
export async function addGold(actor, delta, { strict = false } = {}) { const k = goldKey(); if (!k || !actor) return false; const { tx } = await import("./tx.js"); const p = `system.resources.${k}`; const r = await tx(actor, { add: { [p]: Number(delta || 0) }, min: { [p]: 0 }, ...(strict ? { need: { [p]: 0 } } : {}) }); return !!r?.ok; }
export async function addXp(actor, delta) { if (!actor) return false; const { tx } = await import("./tx.js"); const r = await tx(actor, { add: { "system.xp": Number(delta || 0) }, min: { "system.xp": 0 } }); return !!r?.ok; }
/** mise à jour d'un personnage calculée à partir de ses données : fn(actor) rend l'objet de mise à jour (ou null) ; sous verrou */
export async function updateActorLocked(actor, fn) { if (!actor) return null; return actorLock(actor, async () => { const u = await fn(actor); if (u && Object.keys(u).length) await actor.update(u); return u; }); }

/* ── relais MJ ── */
const HANDLERS = {}; const UNLOCKED = new Set(["tpRequest"]);   /* handlers qui attendent une réponse du MJ (fenêtre) : hors file */
export function onGm(op, fn) { HANDLERS[op] = fn; }
export const activeGM = () => game.users.activeGM ?? game.users.find(u => u.isGM && u.active);
const SEEN = new Map();   /* identifiants de requêtes déjà traitées (double clic, renvoi) */
function runHandler(op, data, userId) { const h = HANDLERS[op]; if (!h) return null; return UNLOCKED.has(op) ? h(data, userId) : withLock("gm", () => h(data, userId)); }
export async function gmDo(op, data = {}) {
  if (game.user.isGM) return runHandler(op, data, game.user.id);
  if (!activeGM()) { ui.notifications.warn("Aucun MJ connecté : l'action sera possible quand le MJ sera là."); return null; }
  game.socket.emit(`system.${SYS}`, { op, data, user: game.user.id, rid: uid() });
  return true;
}
Hooks.once("ready", () => {
  game.socket.on(`system.${SYS}`, async msg => {
    if (!msg?.op) return;
    if (msg.op === "toast") { if (!msg.to || msg.to === game.user.id) ui.notifications[msg.level || "info"](msg.text); return; }
    if (msg.op === "folderMade") { if (msg.to === game.user.id) FOLDER_WAIT.get(msg.rid)?.(msg.ids || []); return; }
    if (msg.op === "tpState") { if (msg.to === game.user.id) Hooks.callAll("manhwaTpState", msg); return; }
    if (msg.op === "mailPing") { if (msg.to?.includes(game.user.id)) { refreshMenus(); ui.notifications.info(msg.text); } return; }
    if (game.user !== activeGM()) return;
    /* un MJ exécute toujours en local : une requête réseau qui se dit « MJ » est forgée ; un expéditeur inconnu ou absent aussi */
    const sender = game.users.get(msg.user); if (!sender || sender.isGM || !sender.active) { console.warn(SYS, "requête refusée (expéditeur invalide)", msg.op, msg.user); return; }
    if (msg.rid) { const now = Date.now(); for (const [k, t] of SEEN) if (now - t > 60000) SEEN.delete(k); if (SEEN.has(msg.rid)) return; SEEN.set(msg.rid, now); }
    try { const r = await runHandler(msg.op, msg.data || {}, msg.user); if (msg.want) game.socket.emit(`system.${SYS}`, { op: "msTxR", to: msg.user, rid: msg.rid, r: r ?? { ok: false, why: "none" } }); }
    catch (err) { console.error(SYS, msg.op, err); if (msg.want) game.socket.emit(`system.${SYS}`, { op: "msTxR", to: msg.user, rid: msg.rid, r: { ok: false, why: "error", msg: err.message } }); else toast(msg.user, `Échec : ${err.message}`, "error"); }
  });
});
/* ── dossiers créés par un joueur ──
   Foundry réserve la création de dossiers au MJ : un module (widget, quêtes, import…) qui en crée un côté joueur échoue avec
   « User X lacks permission to create Folder ». On relaie la création au MJ connecté (même identifiant, sans doublon de nom au même endroit)
   et l'appelant reçoit le vrai dossier. Sans MJ connecté, rien ne change (comportement de Foundry). */
const FOLDER_WAIT = new Map();
Hooks.once("ready", () => {
  const cls = CONFIG.Folder?.documentClass; if (!cls || cls.__msRelay) return; cls.__msRelay = true;
  const orig = cls.createDocuments;
  cls.createDocuments = async function (data = [], operation = {}) {
    if (game.user.isGM || operation?.pack || operation?.parent || !activeGM()) return orig.call(this, data, operation);
    const list = (Array.isArray(data) ? data : [data]).map(d => { const o = typeof d?.toObject === "function" ? d.toObject() : foundry.utils.deepClone(d || {}); if (!o._id || !operation?.keepId) o._id = foundry.utils.randomID(); o.folder = o.folder?.id ?? o.folder ?? null; return o; });
    if (!list.length) return [];
    const rid = uid();
    const ids = await new Promise(res => { const t = setTimeout(() => { FOLDER_WAIT.delete(rid); res(null); }, 10000); FOLDER_WAIT.set(rid, v => { clearTimeout(t); FOLDER_WAIT.delete(rid); res(v); }); game.socket.emit(`system.${SYS}`, { op: "createFolder", data: { list, rid }, user: game.user.id, rid: uid() }); });
    if (!ids) { ui.notifications.warn("Création de dossier : le MJ n'a pas répondu."); return []; }
    /* le document arrive par la synchronisation normale juste après la réponse */
    const got = []; for (const id of ids) { let f = game.folders.get(id); for (let i = 0; !f && id && i < 20; i++) { await new Promise(r => setTimeout(r, 100)); f = game.folders.get(id); } if (f) got.push(f); }
    return got;
  };
});
onGm("createFolder", async ({ list, rid }, userId) => {
  const ids = [];
  for (const o of (list || []).slice(0, 20)) {
    if (!o || !CONST.FOLDER_DOCUMENT_TYPES.includes(o.type) || !String(o.name || "").trim()) { ids.push(null); continue; }
    const parent = o.folder || null; if (parent && !game.folders.get(parent)) o.folder = null;
    const same = game.folders.find(f => f.type === o.type && f.name === o.name && (f.folder?.id ?? null) === (o.folder ?? null));
    if (same) { ids.push(same.id); continue; }
    const keep = /^[A-Za-z0-9]{16}$/.test(o._id || "") && !game.folders.get(o._id); if (!keep) delete o._id;
    try { const f = await Folder.create(o, { keepId: keep }); ids.push(f?.id ?? null); } catch (e) { console.warn(SYS, "createFolder", e); ids.push(null); }
  }
  if (userId === game.user.id) FOLDER_WAIT.get(rid)?.(ids); else game.socket.emit(`system.${SYS}`, { op: "folderMade", to: userId, rid, ids });
});
export function toast(userId, text, level = "info") { if (userId === game.user.id) return ui.notifications[level](text); game.socket.emit(`system.${SYS}`, { op: "toast", to: userId, text, level }); }
export const userCanActor = (userId, actor) => !!actor && (game.users.get(userId)?.isGM || actor.testUserPermission(game.users.get(userId), "OWNER"));

/* rafraîchit tous les menus ouverts */
export function refreshMenus() { for (const app of foundry.applications.instances.values()) if (app.constructor?.name === "MenuApp" && app.rendered) app.render(); Hooks.callAll("manhwaMenuCfg"); }
export { uid };
