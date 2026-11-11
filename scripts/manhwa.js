/* Manhwa Sheet — system entry point */
import { SYS, THEMES, DEFAULT_CONFIG, STAGE_LABELS, STAGE_PRESETS, gaugeStages, getConfig, applyTheme, costOfStep, costBetween, flattenTree, pathOf, fieldsOf, gaugeMax, xpNeeded, evalFormula, effectiveStats, rollData, featureOn, gaugeFormula, xpFormula, gaugeState, itemBonuses, imgDefaults } from "./config.js";
import { migrateConfig } from "./migrate.js";
/* polices chargées dès le démarrage (pendant l'écran de chargement) : sinon le navigateur ne les télécharge qu'au premier texte qui les utilise
   — ouverture des onglets Acteurs / Objets / Journal — et le texte « saute » d'une police de secours à la bonne (sur la Forge chaque fichier passe par une redirection) */
(() => { try {
  const base = "systems/manhwa-sheet/fonts/web/";
  const files = ["exo-2-latin-wght-normal", "josefin-sans-latin-wght-normal", "orbitron-latin-wght-normal", "share-tech-mono-latin-400-normal", "inter-latin-wght-normal", "cinzel-latin-wght-normal", "rajdhani-latin-600-normal", "rajdhani-latin-700-normal", "exo-2-latin-ext-wght-normal", "josefin-sans-latin-ext-wght-normal"];
  for (const f of files) { const l = document.createElement("link"); l.rel = "preload"; l.as = "font"; l.type = "font/woff2"; l.crossOrigin = "anonymous"; l.href = base + f + ".woff2"; document.head.appendChild(l); }
  const want = ['400 1em "Exo 2"', '800 1em "Exo 2"', '400 1em "Josefin Sans"', '700 1em "Josefin Sans"', '700 1em "Orbitron"', '900 1em "Orbitron"', '400 1em "Share Tech Mono"', '400 1em "Inter"', '700 1em "Cinzel"', '600 1em "Rajdhani"', '700 1em "Rajdhani"'];
  const go = () => Promise.allSettled(want.map(f => document.fonts.load(f, "AaÉé09"))).then(() => document.documentElement.classList.add("ms-fonts"));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true }); else go();
} catch (e) { /* polices : chargement normal */ } })();
import { rollStat, rollItem } from "./dice.js";
import { CharacterData, NpcData, ItemData, CreatureData } from "./data-models.js";
import { CreatureSheet, lootTool, rewardCreatures } from "./creature.js";
import { CharacterSheet } from "./sheet-character.js";
import { ManhwaItemSheet } from "./sheet-item.js";
import { SheetConfigApp, ProgressionApp } from "./app-config.js";
import "./notices.js";
import "./asks.js";
import { api as cosApi } from "./cosmetics.js";
import "./winmem.js";
import { fsMount, fsSync, fsMinimize, isFs } from "./fullscreen.js";
import { GmHub } from "./gmhub.js";
import "./tools.js";
import "./rich.js";
import { CarnetApp, sharedNotes } from "./carnet.js";
import "./world.js";
import { tx as msTx, applyTx as msApplyTx } from "./tx.js";
import { MenuApp, openMenuFor, menuMacro, registerTabImpl, attachBack } from "./menu.js";
import { openPhone, PhoneApp, unlockCosmetic, COSMETICS, unlocked } from "./phone.js";
import { rcptField, bindRecipients, recipientPicker } from "./pickers.js";
import { SEASONS, SEASON_EVENTS, currentSeason, setSeason, seasonChip, eventByName, seasonEventsEditor, editSeasonEvents } from "./season.js";
import { registerMenuTab, setMenuTabImage, parties, withLock, actorLock, updateActorLocked } from "./world.js";
import { distribute, rewardDialog } from "./party.js";
import { gmGroupsApi } from "./gmgroups.js";
import { classesApi } from "./classes.js";

/* public API for companion modules (Manhwa Scenarios, Catalogue, NPCs, Notices…) */
const api = {
  lootTool, rewardCreatures,
  /** GROUPES MJ — liste unique de la suite (Boutique, Horlogia, Portraits, Scénarios…) ; hook « manhwaGmGroups » */
  gmGroups: gmGroupsApi,
  /** classes et sous-classes (identité) ; hook « manhwaClasses » */
  classes: classesApi,
  config: () => getConfig(true), costOfStep, costBetween, gaugeMax, xpNeeded, evalFormula, effectiveStats, rollData, featureOn, rollStat, rollItem, gaugeFormula, xpFormula, gaugeState, itemBonuses,
  setMenuTabImage,
  registerMenuTab: (def) => { registerMenuTab(def); registerTabImpl(def.key, { render: def.render, bind: def.bind, act: def.act }); },
  openCarnet: (actor, tab) => MenuApp.open(actor, tab), openMenu: (actor, tab, pos) => MenuApp.open(actor, tab, pos), attachBack, fullscreen: { mount: fsMount, sync: fsSync, minimize: fsMinimize, isFs },
  /** téléphone : ouvrir, cosmétiques déblocables (Boutique stellaire) */
  /* choix de joueurs / personnages façon Roll20 (barre de recherche), pour les modules de la suite */
  gmHub: () => GmHub.open(),
  /** groupes du Menu : [{ id, name, members: [{ uuid }] }] */
  parties: () => parties(),
  pickers: { field: o => rcptField(o), bind: root => bindRecipients(root), pick: o => recipientPicker(o) },
  /* saison du monde (source unique pour Catalogue et Appel des Étoiles ; hook « manhwaSeason ») */
  season: () => currentSeason(), seasons: SEASONS, seasonEvents: SEASON_EVENTS, seasonEventsEditor, editSeasonEvents, setSeason: patch => setSeason(patch), seasonChip: () => seasonChip(), eventByName: n => eventByName(n),
  cosmetics: cosApi, openPhone: (actor, conv) => openPhone(actor, conv), phone: { COSMETICS, unlock: (userId, id, on = true) => unlockCosmetic(userId, id, on), isUnlocked: (user, id) => unlocked(user, id), open: a => PhoneApp.open(a) },
  /** cadrage choisi pour l'image d'un document (portrait d'acteur, image d'objet, défaut de la catégorie) : clé de POS */
  framing: doc => { try { if (doc?.documentName === "Actor") return doc.system?.portrait || "center"; if (doc?.documentName === "Item") return doc.system?.imgPos || imgDefaults(getConfig(), doc.system?.category)?.pos || "center"; } catch (e) {} return "center"; }, openMenuFor, menuMacro, distribute, rewardDialog, sharedNotes, STAGE_LABELS, STAGE_PRESETS, gaugeStages,
  gauge: (actor, key) => actor.system.gauges?.[key] || { value: 0, max: 0 },
  setGauge: async (actor, key, value) => { const g = actor.system.gauges?.[key]; return actor.update({ [`system.gauges.${key}.value`]: Math.max(0, Math.min(Number(g?.max) || Infinity, Number(value) || 0)) }); },
  addGauge: async (actor, key, delta) => msTx(actor, { add: { [`system.gauges.${key}.value`]: Number(delta) }, min: { [`system.gauges.${key}.value`]: 0 }, max: { [`system.gauges.${key}.value`]: Number(actor.system.gauges?.[key]?.max) || null } }),
  addXp: async (actor, delta) => msTx(actor, { add: { "system.xp": Number(delta) }, min: { "system.xp": 0 } }),
  resource: (actor, key) => Number(actor.system.resources?.[key]) || 0,
  addResource: async (actor, key, delta, { strict = false } = {}) => msTx(actor, { add: { [`system.resources.${key}`]: Number(delta) }, min: { [`system.resources.${key}`]: getConfig().resources.find(r => r.key === key)?.min ?? 0 }, ...(strict ? { need: { [`system.resources.${key}`]: getConfig().resources.find(r => r.key === key)?.min ?? 0 } } : {}) }),
  /** 1.59 : transaction par le poste du MJ — tx(actor, { add, set, min, max, need }) → { ok, values } (voir tx.js) ; à utiliser par les modules pour toute variation de Gold / XP / jauges */
  tx: msTx,
  /** verrou par personnage (1.25.0) : withLock(clé, fn) / actorLock(actor, fn) — à utiliser par les modules autour de toute lecture + écriture d'un même personnage ou réglage */
  withLock, actorLock, updateActorLocked,
  setResource: async (actor, key, value) => actor.update({ [`system.resources.${key}`]: Number(value) }),
  stat: (actor, key) => Number(actor.system.stats?.[key]) || 0,
  setStat: async (actor, key, value) => actor.update({ [`system.stats.${key}`]: Number(value) }),
  ranks: () => getConfig().ranks, rarities: () => getConfig().rarities, categories: () => flattenTree(getConfig().items), categoryPath: id => pathOf(getConfig(), id).map(n => n.name),
  /** find a leaf category by names along the path, e.g. ["Weapons","Melee","Blades","Dagger"] (case-insensitive; partial paths match the first leaf below) */
  findCategory: (names) => { const cfg = getConfig(); let level = cfg.items, node = null; for (const nm of names) { node = (level || []).find(x => x.name.toLowerCase() === String(nm).toLowerCase()); if (!node) return null; level = node.children; } while (node && node.children?.length) node = node.children[0]; return node?.id || null; },
  /** create an item on an actor: data = { name, img, category (id) | path (names[]), rank, rarity, quantity, value, level, element, description, lore, … } */
  createItem: async (actor, data) => { const cfg = getConfig(); const category = data.category || api.findCategory(data.path || []) || flattenTree(cfg.items).find(n => !n.children?.length)?.id; const sys = { category, rank: data.rank ?? cfg.ranks[0]?.key, rarity: data.rarity ?? cfg.rarities[0]?.key }; for (const k of fieldsOf(cfg, category).concat(["description", "equipped"])) if (data[k] !== undefined) sys[k] = data[k]; if (data.quantity !== undefined) sys.quantity = data.quantity; const [it] = await actor.createEmbeddedDocuments("Item", [{ name: data.name || "Objet", img: data.img, type: "item", system: sys }]); return it; }
};
globalThis.MANHWA = { ...api, api };

Hooks.once("init", () => {
  CONFIG.Actor.dataModels.character = CharacterData; CONFIG.Actor.dataModels.npc = NpcData; CONFIG.Actor.dataModels.creature = CreatureData; CONFIG.Item.dataModels.item = ItemData;
  const Actors = foundry.documents.collections.Actors, Items = foundry.documents.collections.Items;
  try { const AS = foundry.appv1?.sheets?.ActorSheet ?? globalThis.ActorSheet, IS = foundry.appv1?.sheets?.ItemSheet ?? globalThis.ItemSheet; if (AS) Actors.unregisterSheet("core", AS); if (IS) Items.unregisterSheet("core", IS); } catch (e) { console.warn(SYS, e); }
  Actors.registerSheet(SYS, CharacterSheet, { types: ["character", "npc"], makeDefault: true, label: "Fiche Manhwa" });
  /* 1.39 : à la création, tout est « Personnage » (plus de choix PNJ). Un personnage joueur = attribué à un joueur. Les anciens PNJ restent lisibles tels quels. */
  try { const AC = CONFIG.Actor.documentClass; const orig = AC.createDialog; AC.createDialog = function (data = {}, createOptions = {}, opts = {}) { if (!opts?.types) opts = { ...(opts || {}), types: ["character", "creature"] }; if (data?.type === "npc") data = { ...data, type: "character" }; return orig.call(this, data, createOptions, opts); }; } catch (e) { console.warn(SYS, e); }
  Actors.registerSheet(SYS, CreatureSheet, { types: ["creature"], makeDefault: true, label: "Fiche Créature" });
  Items.registerSheet(SYS, ManhwaItemSheet, { types: ["item"], makeDefault: true, label: "Objet Manhwa" });

  game.settings.register(SYS, "config", { scope: "world", config: false, type: Object, default: {} });
  game.settings.register(SYS, "configBackups", { scope: "world", config: false, type: Array, default: [] });
  /* token bars : every configured gauge, plus level / xp as values */
  const gk = (getConfig().gauges || []).map(g => `gauges.${g.key}`);
  CONFIG.Actor.trackableAttributes = { character: { bar: gk, value: ["level", "xp"] }, npc: { bar: gk, value: ["level", "xp"] }, creature: { bar: gk, value: ["level", "xpReward", "goldReward"] } };
  game.settings.registerMenu(SYS, "configMenu", { name: "MANHWA.Settings.Config", label: "MANHWA.Settings.ConfigLabel", hint: "MANHWA.Settings.ConfigHint", icon: "fa-solid fa-sliders", type: SheetConfigApp, restricted: true });
  game.settings.registerMenu(SYS, "progressionMenu", { name: "MANHWA.Settings.Progression", label: "MANHWA.Settings.ProgressionLabel", hint: "MANHWA.Settings.ProgressionHint", icon: "fa-solid fa-arrow-trend-up", type: ProgressionApp, restricted: true });
  game.settings.register(SYS, "theme", { name: "MANHWA.Settings.Theme", hint: "MANHWA.Settings.ThemeHint", scope: "world", config: true, type: String, choices: THEMES, default: "solo-neon", onChange: () => { applyTheme(); rerenderAll(); } });
  game.settings.register(SYS, "anim", { name: "MANHWA.Settings.Anim", hint: "MANHWA.Settings.AnimHint", scope: "client", config: true, type: String, choices: { full: "Complètes", low: "Réduites", off: "Aucune" }, default: "low", onChange: applyTheme });
  game.settings.register(SYS, "playersCanLower", { name: "MANHWA.Settings.PlayersCanLower", scope: "world", config: true, type: Boolean, default: true });
  game.settings.register(SYS, "gmFree", { name: "MANHWA.Settings.GmFree", scope: "world", config: true, type: Boolean, default: true });
});

function rerenderAll() { for (const app of foundry.applications.instances.values()) if (app.actor || app.item) app.render(); }
Hooks.once("ready", async () => { applyTheme(); await migrateConfig(); Hooks.callAll("manhwaSheetReady", api); });
Hooks.on("updateSetting", s => { if (s.key === `${SYS}.config`) { for (const a of game.actors) a.reset(); rerenderAll(); } });

/* boîtes de confirmation du système : « Oui / Non » même quand Foundry est en anglais (1.28.2) */
Hooks.on("renderDialogV2", (app, el) => { const root = el instanceof HTMLElement ? el : app.element; if (!root?.classList?.contains("ms-dialog")) return;
  for (const [act, fr] of [["yes", "Oui"], ["no", "Non"]]) { const b = root.querySelector(`button[data-action="${act}"]`); if (!b) continue; const sp = b.querySelector("span") || b; if (/^(yes|no)$/i.test(sp.textContent.trim())) sp.textContent = fr; } });
