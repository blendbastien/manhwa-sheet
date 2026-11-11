/* Manhwa Sheet — le Menu (remplace le bouton Carnet) : une fenêtre de jeu en verre dépoli, onglets à gauche.
 * Onglets : Groupe, Quêtes, Guilde, Messagerie, Échange, Amis, Téléportation, Notes — chacun activable, visible des joueurs
 * ou réservé au MJ, renommable, avec son icône et sa place (onglet « Réglages » du MJ). */
import { SYS, esc, getConfig, rankOf, focusKey, focusBack } from "./config.js";
import { CarnetApp } from "./carnet.js";
import { isFs, fsMount } from "./fullscreen.js";
import { SEASONS, SEASON_EVENTS, currentSeason, seasonCfg, setSeason, seasonChip } from "./season.js";
import { menuCfg, saveMenuCfg, editMenuCfg, editList, MENU_TABS, QUEST_TYPES, refreshMenus, TAB_IMG, TAB_VIS, TAB_OPEN, tabImage, MENU_GROUPS, groupOf } from "./world.js";
import { renderParty, bindParty, actParty } from "./party.js";
import { renderQuests, bindQuests, actQuests } from "./quests.js";
import { renderGuild, bindGuild, actGuild } from "./guild.js";
import { phoneTab, phoneBadge } from "./phone.js";
import { renderTrade, bindTradeTab, actTrade } from "./trade.js";
import { renderFriends, bindFriends, actFriends } from "./friends.js";
import { renderNews, bindNews, actNews, unreadNews } from "./news.js";
import { renderLetters, bindLetters, actLetters, unreadLetters } from "./letters.js";
import { PartyHud, hudCorners } from "./hud.js";
import { playerCardHTML, bindPlayerCard, cardGmPanel, bindCardGm } from "./pcard.js";

const CARNET = ["places", "notes"];
const MACRO_IMG = { news: "icons/svg/sound.svg", party: "icons/svg/combat.svg", quests: "icons/svg/book.svg", guild: "icons/svg/castle.svg", mail: "icons/svg/cowled.svg", letters: "icons/svg/chest.svg", trade: "icons/svg/coins.svg", friends: "icons/svg/mystery-man.svg", places: "icons/svg/village.svg", notes: "icons/svg/book.svg" };
const TAB_IMPL = {
  party: { render: renderParty, bind: bindParty, act: actParty },
  quests: { render: renderQuests, bind: bindQuests, act: actQuests },
  guild: { render: renderGuild, bind: bindGuild, act: actGuild },
  mail: phoneTab,
  trade: { render: renderTrade, bind: bindTradeTab, act: actTrade },
  friends: { render: renderFriends, bind: bindFriends, act: actFriends },
  news: { render: renderNews, bind: bindNews, act: actNews },
  letters: { render: renderLetters, bind: bindLetters, act: actLetters }
};
export function registerTabImpl(key, impl) { TAB_IMPL[key] = impl; }
/* macros : ouvrir un onglet du Menu pour le personnage du joueur */
export function actorForUser() { return game.user.character ?? canvas?.tokens?.controlled?.[0]?.actor ?? game.actors.find(a => a.isOwner && a.type === "character" && (game.user.isGM || a.hasPlayerOwner)) ?? null; }
export function openMenuFor(tab) { const a = actorForUser(); if (!a) return ui.notifications.warn("Aucun personnage : choisis ton personnage dans la configuration du joueur, ou sélectionne un jeton."); return MenuApp.open(a, tab); }
export async function menuMacro(tab, { quiet = false } = {}) {
  const t = menuCfg().tabs.find(x => x.key === tab); if (!t) return null; const name = `Menu : ${t.name}`;
  let m = game.macros.find(x => x.name === name && x.command?.includes(`openMenuFor("${tab}")`)); if (m) return m;
  try { let folder = null; if (game.user.isGM) folder = game.folders.find(f => f.type === "Macro" && f.name === "Menu Manhwa") ?? await Folder.create({ name: "Menu Manhwa", type: "Macro", color: "#38e0ff" });
    m = await Macro.create({ name, type: "script", img: MACRO_IMG[tab] || "icons/svg/book.svg", command: `MANHWA.openMenuFor("${tab}");`, folder: folder?.id ?? null, ownership: game.user.isGM ? { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER } : undefined });
    if (!quiet) ui.notifications.info(`Macro « ${name} » créée.`); return m; }
  catch (err) { console.warn(SYS, err); ui.notifications.warn("Création de macro refusée : demande au MJ de les créer (Menu › Réglages › Macros), puis glisse-les depuis l'onglet Macros."); return null; }
}
Hooks.on("hotbarDrop", (bar, data, slot) => { if (data?.type !== "ManhwaMenu") return; menuMacro(data.tab, { quiet: true }).then(m => m && game.user.assignHotbarMacro(m, slot)); return false; });
/* onglets visibles, dans l'ordre choisi par le joueur (glisser-déposer dans la colonne du Menu) */
/** icône d'onglet : image (réglage ou module) sinon Font Awesome */
export const tabIcon = t => { const u = tabImage(t); return u ? `<i class="ms-ti img"><img src="${esc(u)}" alt="" onerror="this.parentNode.classList.add('nf')"><i class="fa-solid ${esc(t.icon)} fb"></i></i>` : `<i class="fa-solid ${esc(t.icon)}"></i>`; };
const SET_TAB = { key: "settings", name: "Réglages", icon: "fa-gear" };
const HOME_TAB = { key: "home", name: "Carte du joueur", icon: "fa-id-badge", color: "#7fd6ff" };
export const visibleTabs = (actor = null) => { const hide = game.user.isGM ? new Set() : new Set([...(game.user.getFlag(SYS, "menuHide") || []), ...(actor?.getFlag?.(SYS, "menuHide") || [])]);   /* icônes masquées par le MJ pour ce joueur / cette fiche */
  const l = menuCfg().tabs.filter(t => t.on && !hide.has(t.key) && (game.user.isGM || (t.players && (!TAB_VIS[t.key] || TAB_VIS[t.key](game.user) !== false))));
  const L = layoutOf(actor); const pos = new Map(L.items.map((x, n) => [x.k, n])); const i = k => pos.has(k) ? pos.get(k) : 999 + l.findIndex(t => t.key === k);
  const gi = k => { const x = MENU_GROUPS.findIndex(g => g.key === tabGroup(k, actor, L)); return x < 0 ? 99 : x; }; const grouped = menuCfg().grouped !== false;
  return l.slice().sort((a, b) => (grouped ? gi(a.key) - gi(b.key) : 0) || i(a.key) - i(b.key)); };

/* ── 1.32 : disposition du Menu (ordre et catégorie de chaque onglet), propre à chaque fiche.
 * Ordre de lecture : la fiche, sinon la disposition choisie par le MJ pour tout le monde, sinon l'ancien ordre du joueur. */
export const GROUP_COLORS = { orbis: "#ffc24d", comm: "#4aa8ff", adv: "#3ddc84", perso: "#c084fc", other: "#8ea0c8" };
export function layoutOf(actor) {
  const ok = x => x && Array.isArray(x.items) && x.items.length;
  const a = actor?.getFlag?.(SYS, "menuLayout"); if (ok(a)) return a;
  const w = menuCfg().layout; if (ok(w)) return w;
  const o = game.user.getFlag(SYS, "menuOrder"); return { items: Array.isArray(o) ? o.map(k => ({ k })) : [] };
}
export const tabGroup = (k, actor = null, L = layoutOf(actor)) => { const g = L.items.find(x => x.k === k)?.g; return g && MENU_GROUPS.some(x => x.key === g) ? g : groupOf(k); };
async function saveLayout(actor, items) { if (!actor?.isOwner) return ui.notifications.warn("Seul le propriétaire de la fiche peut changer la disposition de son Menu."); return actor.setFlag(SYS, "menuLayout", { items }); }

/* ── 1.32 : thèmes de la colonne de gauche, débloqués par une compétence (Compétences › Système › Interface) ── */
export const MENU_THEMES = {
  nebula: { n: "Nébuleuse", skill: "", c: "#9a7bff" }, aurora: { n: "Aurore", skill: "Thème d'interface", c: "#3dffb0" }, abyss: { n: "Abysse", skill: "Mode nuit", c: "#2f7bff" },
  solar: { n: "Solaire", skill: "Widgets", c: "#ffb23d" }, tactic: { n: "Tactique", skill: "Ralenti tactique", c: "#5aff7a" }, void: { n: "Néant", skill: "Interface administrateur", c: "#ff3dd2" }
};
const nrm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const themeSkill = k => { const m = menuCfg().themeSkills || {}; return k in m ? m[k] : MENU_THEMES[k]?.skill || ""; };
export function themeUnlocked(actor, k) { if (!MENU_THEMES[k]) return false; const s = themeSkill(k); if (!s || game.user.isGM) return true;
  return !!actor?.items?.some(i => nrm(i.name) === nrm(s) && (i.system?.equipped || !i.system?.equippable)); }
export function themeOf(actor) { const k = actor?.getFlag?.(SYS, "menuTheme") || menuCfg().theme || "nebula"; if (!MENU_THEMES[k]) return "nebula";
  return themeUnlocked(actor, k) || actor?.getFlag?.(SYS, "menuThemeForced") || (!actor?.getFlag?.(SYS, "menuTheme") && menuCfg().theme === k) ? k : "nebula"; }

/* ── 1.32 : barre de raccourcis du Menu (désactivée par défaut, le joueur l'active et choisit ses boutons) ── */
const barCfg = () => ({ on: false, keys: [], pos: null, ...(game.user.getFlag(SYS, "menuBar") || {}) });
async function setBar(patch) { await game.user.setFlag(SYS, "menuBar", { ...barCfg(), ...patch }); renderMenuBar(); }
export function renderMenuBar() {
  let el = document.getElementById("ms-menubar"); const b = barCfg(); const a = actorForUser();
  const tabs = a && b.on ? visibleTabs(a) : []; const list = b.keys.map(k => tabs.find(t => t.key === k)).filter(Boolean);
  if (!b.on || !a || !list.length) { el?.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "ms-menubar"; document.body.append(el); bindBar(el); }
  if (b.pos) { el.style.left = `${b.pos.x}px`; el.style.top = `${b.pos.y}px`; el.style.bottom = "auto"; el.style.transform = "none"; }
  el.innerHTML = `<span class="hd" title="Glisser pour déplacer la barre"><i class="fa-solid fa-grip-vertical"></i></span>` + list.map(t => `<a data-k="${esc(t.key)}" style="--tc:${esc(t.color || "#8ea0c8")}" data-tooltip="${esc(t.name)} — clic droit : retirer">${tabIcon(t)}</a>`).join("");
}
function bindBar(el) {
  el.addEventListener("click", ev => { const x = ev.target.closest("a[data-k]"); if (x) openMenuFor(x.dataset.k); });
  el.addEventListener("contextmenu", ev => { const x = ev.target.closest("a[data-k]"); if (!x) return; ev.preventDefault(); setBar({ keys: barCfg().keys.filter(k => k !== x.dataset.k) }); refreshMenus(); });
  el.addEventListener("dragover", ev => ev.preventDefault());
  el.addEventListener("drop", ev => { let d; try { d = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch (e) { return; } if (d?.type !== "ManhwaMenu") return; ev.preventDefault();
    const k = barCfg().keys.filter(x => x !== d.tab); const over = ev.target.closest("a[data-k]"); const at = over ? k.indexOf(over.dataset.k) : k.length; k.splice(at < 0 ? k.length : at, 0, d.tab); setBar({ keys: k }); refreshMenus(); });
  el.addEventListener("pointerdown", ev => { if (!ev.target.closest(".hd")) return; ev.preventDefault(); const r = el.getBoundingClientRect(); const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
    const mv = e => { el.style.left = `${Math.max(0, Math.min(innerWidth - r.width, e.clientX - dx))}px`; el.style.top = `${Math.max(0, Math.min(innerHeight - r.height, e.clientY - dy))}px`; el.style.bottom = "auto"; el.style.transform = "none"; };
    const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); const q = el.getBoundingClientRect(); setBar({ pos: { x: Math.round(q.left), y: Math.round(q.top) } }); };
    addEventListener("pointermove", mv); addEventListener("pointerup", up); });
}
Hooks.once("ready", () => { renderMenuBar(); });
Hooks.on("updateUser", u => { if (u.id === game.user.id) renderMenuBar(); });
Hooks.on("manhwaMenuCfg", () => renderMenuBar());

export class MenuApp extends CarnetApp {
  static DEFAULT_OPTIONS = { classes: ["ms-sheet", "ms-menu"], window: { resizable: true, icon: "fa-solid fa-bars" }, position: { width: 920, height: 640 } };
  /** ouvre le Menu ; un onglet « fenêtre » (Appel des Étoiles, Boutique, Catalogue…) s'ouvre à la place du Menu, avec un bouton Précédent */
  static open(actor, tab, pos = null) {
    const id = `ms-menu-${actor.id}`; let app = foundry.applications.instances.get(id);
    if (tab && TAB_OPEN[tab]) return openTabWindow(tab, actor, pos || app?.position || null, app?.tab || null, app);
    if (!app) app = new MenuApp({ id }, actor); if (tab) app.tab = tab; app.render({ force: true }).then(() => { if (pos) app.setPosition({ left: pos.left, top: pos.top, width: pos.width, height: pos.height }); }); return app;
  }
  /** 1.34 — réglages du Menu et saison, pour le MJ, sans passer par une fiche */
  static openSettings() { if (!game.user.isGM) return; const id = "ms-menu-gmset"; let app = foundry.applications.instances.get(id); if (!app) app = new MenuApp({ id, gmOnly: true, position: { width: 960, height: 760 } }, null); app.tab = "settings"; app.render({ force: true }); return app; }
  _initializeApplicationOptions(options) { const o = super._initializeApplicationOptions(options); if (options?.gmOnly) { o.gmOnly = true; o.window = { ...(o.window || {}), icon: "fa-solid fa-sliders" }; return o; } let fs = true; try { fs = game.settings.get(SYS, "menuFullscreen") !== false; } catch (e) { /* réglage pas encore déclaré */ }
    if (fs) o.classes = [...new Set([...(o.classes || []), "ms-fsable", "ms-fs-band"])]; return o; }
  constructor(options, actor) { super(options, actor); this.tab = "home"; }
  get title() { return this.options.gmOnly ? "Réglages du Menu et saison du monde (MJ)" : `Menu — ${this.actor?.name || ""}`; }

  async _renderHTML() {
    if (this.options.gmOnly) { this.tab = "settings"; let body = ""; try { body = this.#settings(); } catch (err) { console.error(SYS, err); body = `<div class="ms-mhint big">Erreur : ${esc(err.message)}</div>`; }
      return `<div class="ms-wrap ms-menu-wrap gmset"><section class="ms-mbody tab-settings" style="--tc:#c084fc"><h2 class="ms-mtitle" style="--tc:#c084fc">${tabIcon(SET_TAB)}Réglages du Menu et saison du monde</h2><div class="ms-mcontent">${body}</div></section></div>`; }
    const tabs = visibleTabs(this.actor); const gm = game.user.isGM;
    if (this.tab !== "home" && (!tabs.some(t => t.key === this.tab) && !(gm && this.tab === "settings") || TAB_OPEN[this.tab])) this.tab = tabs.find(t => !TAB_OPEN[t.key])?.key || (gm ? "settings" : tabs[0]?.key || "");
    const badge = { mail: phoneBadge(this.actor), letters: unreadLetters(this.actor), news: unreadNews() };
    const grouped = menuCfg().grouped !== false; const L = layoutOf(this.actor); const bar = barCfg(); const pinned = new Set(bar.on ? bar.keys : []);
    const link = t => `<a data-mact="tab" data-tab="${t.key}" draggable="true" class="mt${this.tab === t.key ? " on" : ""}${t.players ? "" : " gmonly"}${pinned.has(t.key) ? " pin" : ""}" style="--tc:${esc(t.color || "#8ea0c8")}" title="${esc(t.name)}${t.players ? "" : " (MJ seulement)"} — glisse pour le déplacer (ordre ou catégorie)${bar.on ? ", clic droit : ajouter / retirer de la barre de raccourcis" : ""}">${tabIcon(t)}<span>${esc(t.name)}</span>${badge[t.key] ? `<em class="badge">${badge[t.key]}</em>` : ""}</a>`;
    const boxes = (grouped ? MENU_GROUPS : [{ key: "_all", name: "" }]).map(g => { const list = tabs.filter(t => !grouped || tabGroup(t.key, this.actor, L) === g.key);
      return `<div class="ms-gbox${list.length ? "" : " empty"}${grouped ? "" : " flat"}" data-g="${g.key}" style="--gc:${esc(GROUP_COLORS[g.key] || "#8ea0c8")}">${grouped ? `<div class="ms-ngrp"><span>${esc(g.name)}</span><small>${list.length}</small></div>` : ""}${list.map(link).join("")}${list.length ? "" : `<div class="ms-gdrop">Glisse un onglet ici</div>`}</div>`; }).join("");
    const nav = `<a data-mact="tab" data-tab="home" class="mt home${this.tab === "home" ? " on" : ""}" style="--tc:${HOME_TAB.color}">${tabIcon(HOME_TAB)}<span>Carte du joueur</span></a>` + boxes + (gm ? `<a data-mact="tab" data-tab="settings" class="mt set${this.tab === "settings" ? " on" : ""}" style="--tc:#9aa4bf">${tabIcon(SET_TAB)}<span>Réglages</span></a>` : "");
    const th = themeOf(this.actor);
    const foot = `<div class="ms-nfoot"><a data-mact="themePick" class="${this._themePick ? "on" : ""}" data-tooltip="Thème de la colonne"><i class="fa-solid fa-palette"></i></a><a data-mact="barToggle" class="${bar.on ? "on" : ""}" data-tooltip="${bar.on ? "Barre de raccourcis : activée (clic droit sur un onglet pour l'ajouter)" : "Barre de raccourcis : désactivée"}"><i class="fa-solid fa-bolt"></i></a><a data-mact="layoutReset" data-tooltip="Disposition par défaut pour cette fiche"><i class="fa-solid fa-rotate-left"></i></a></div>`
    const thModal = (this._themePick ? (() => { const all = Object.entries(MENU_THEMES); const have = all.filter(([k]) => themeUnlocked(this.actor, k)).length;
        /* 1.37 : présentation « jeu » — équipé, possédé, verrouillé (avec la compétence qui le débloque) */
        return `<div class="ms-thmodal" data-mact="themePick"><div class="ms-thpick" data-stop="1"><div class="ms-thhd"><i class="fa-solid fa-palette"></i>Thèmes de la colonne<em>${have}/${all.length}</em><a data-mact="themePick" class="x" title="Fermer"><i class="fa-solid fa-xmark"></i></a></div><div class="ms-thgrid">${all.map(([k, v]) => { const ok = themeUnlocked(this.actor, k); const st = k === th ? `<em class="st eq"><i class="fa-solid fa-check"></i>Équipé</em>` : ok ? `<em class="st ok">Possédé</em>` : `<em class="st lk"><i class="fa-solid fa-lock"></i>${esc(themeSkill(k) || "Verrouillé")}</em>`;
          return `<a data-mact="theme" data-k="${k}" class="th-${k}${k === th ? " on" : ""}${ok ? "" : " lock"}" style="--thc:${v.c}" data-tooltip="${ok ? (k === th ? `${esc(v.n)} — équipé` : `Équiper « ${esc(v.n)} »`) : `${esc(v.n)} — verrouillé : équipe la compétence « ${esc(themeSkill(k))} »`}"><i class="sw"></i><span>${esc(v.n)}</span>${st}</a>`; }).join("")}</div></div></div>`; })() : "");
    let body = "";
    try { body = this.tab === "home" ? this.#home() : this.tab === "settings" ? this.#settings() : CARNET.includes(this.tab) ? this.carnetBody() : (this.tab === "party" ? this.#hudCtl() : "") + (TAB_IMPL[this.tab]?.render(this) ?? ""); }
    catch (err) { console.error(SYS, err); body = `<div class="ms-mhint big">Erreur d'affichage : ${esc(err.message)}</div>`; }
    if (!tabs.length && !gm) body = `<div class="ms-mhint big">Le MJ n'a ouvert aucun onglet du Menu.</div>`;
    const rk = rankOf(getConfig(), this.actor.system.rank); const cur = this.tab === "home" ? HOME_TAB : tabs.find(t => t.key === this.tab); const lv = Number(this.actor.system.level) || 0;
    const who = `<div class="who" style="--rc:${esc(rk?.color || "#9fb0d4")}"><div class="pf"><img src="${esc(this.actor.img)}"></div><b>${esc(this.actor.name)}</b>
      <div class="ms-lvrk"><span class="lv"><small>NIV</small><b>${lv}</b></span><span class="rkh" data-tooltip="Rang ${esc(rk?.name || "")}"><b>${esc(rk?.name || "")}</b></span><span class="rkn">RANG <b>${esc(rk?.name || "")}</b></span></div>${seasonChip()}</div>`;
    return `<div class="ms-wrap ms-menu-wrap"><aside class="ms-mnav" data-mth="${th}">${who}${nav}${foot}</aside>
      <section class="ms-mbody tab-${this.tab}" style="--tc:${esc(cur?.color || "var(--mg-acc)")}"><h2 class="ms-mtitle" style="--tc:${esc(cur?.color || "var(--mg-acc)")}">${tabIcon(cur || SET_TAB)}${esc(cur?.name || "Réglages du Menu")}</h2><div class="ms-mcontent">${body}</div></section>${thModal}</div>`;
  }
  /** 1.39 — accueil du Menu : la Carte du joueur (D.A de sa fiche, titres et objets en vitrine, personnalisation, partage) */
  #home() { return `<div class="ms-home">${playerCardHTML(this.actor, { edit: this.actor?.isOwner || game.user.isGM })}</div>`; }
  _replaceHTML(r, c) {
    /* garder la position de défilement de la colonne d'onglets (et du contenu si on reste sur le même onglet) */
    const nav0 = c.querySelector(".ms-mnav"), navY = nav0?.scrollTop || 0, same = this._msLastTab === this.tab, bodyY = same ? [...c.querySelectorAll(".ms-mcontent, .ms-mcontent [data-keep-scroll]")].map(e => e.scrollTop) : [];
    const fk = same ? focusKey(c) : null;
    super._replaceHTML(r, c); this._msLastTab = this.tab; focusBack(c, fk);
    const nav1 = c.querySelector(".ms-mnav"); if (nav1) nav1.scrollTop = navY; if (same) c.querySelectorAll(".ms-mcontent, .ms-mcontent [data-keep-scroll]").forEach((e, i) => { if (bodyY[i]) e.scrollTop = bodyY[i]; });
    if (!c.dataset.msMenuBound) { c.dataset.msMenuBound = "1"; c.addEventListener("click", async ev => { const a = ev.target.closest("[data-mact]"); if (!a || !c.contains(a)) return; if (a.classList.contains("ms-thmodal") && ev.target.closest(".ms-thpick")) return; ev.preventDefault(); ev.stopPropagation(); await this.#mact(a.dataset.mact, a, ev); }); }
    const nav = c.querySelector(".ms-mnav");
    c.querySelectorAll('.ms-mnav a[draggable="true"]').forEach(a => {
      a.addEventListener("dragstart", ev => { const t = menuCfg().tabs.find(x => x.key === a.dataset.tab); ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "ManhwaMenu", tab: a.dataset.tab, name: t?.name })); a.classList.add("dragging"); nav?.classList.add("drag"); });
      a.addEventListener("dragend", () => { a.classList.remove("dragging"); nav?.classList.remove("drag"); });
      a.addEventListener("dragover", ev => { ev.preventDefault(); ev.stopPropagation(); const r = a.getBoundingClientRect(); a.classList.toggle("drop-before", ev.clientY < r.top + r.height / 2); a.classList.toggle("drop-after", ev.clientY >= r.top + r.height / 2); });
      a.addEventListener("dragleave", () => a.classList.remove("drop-before", "drop-after"));
      a.addEventListener("drop", async ev => { const after = a.classList.contains("drop-after"); a.classList.remove("drop-before", "drop-after"); let d; try { d = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch (e) { return; } if (d?.type !== "ManhwaMenu" || d.tab === a.dataset.tab) return; ev.preventDefault(); ev.stopPropagation();
        await this.#moveTab(d.tab, a.closest(".ms-gbox")?.dataset.g, a.dataset.tab, after); });
      a.addEventListener("contextmenu", async ev => { const b = barCfg(); if (!b.on) return; ev.preventDefault(); const k = a.dataset.tab; await setBar({ keys: b.keys.includes(k) ? b.keys.filter(x => x !== k) : [...b.keys, k] }); this.render(); });
    });
    c.querySelectorAll(".ms-mnav .ms-gbox").forEach(g => {
      g.addEventListener("dragover", ev => { ev.preventDefault(); g.classList.add("over"); });
      g.addEventListener("dragleave", ev => { if (!g.contains(ev.relatedTarget)) g.classList.remove("over"); });
      g.addEventListener("drop", async ev => { g.classList.remove("over"); let d; try { d = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch (e) { return; } if (d?.type !== "ManhwaMenu") return; ev.preventDefault(); await this.#moveTab(d.tab, g.dataset.g, null, true); });
    });
    c.querySelectorAll("[data-hudset]").forEach(i => i.addEventListener("change", () => game.settings.set(SYS, i.dataset.hudset, i.type === "checkbox" ? i.checked : i.value)));
    try { if (this.tab === "settings") this.#bindSettings(c); else if (this.tab === "home") bindPlayerCard(c, this.actor, () => this.render()); else TAB_IMPL[this.tab]?.bind?.(this, c); } catch (err) { console.error(SYS, err); }
  }
  /** déplace un onglet : dans une catégorie (g), avant / après un autre onglet (ref), sinon à la fin de la catégorie ; enregistré sur la fiche */
  async #moveTab(key, g, ref, after) {
    const L = layoutOf(this.actor); const vis = visibleTabs(this.actor).map(t => t.key);
    let items = [...vis.map(k => ({ k, g: tabGroup(k, this.actor, L) })), ...L.items.filter(x => !vis.includes(x.k))];
    const me = items.find(x => x.k === key) || { k: key }; items = items.filter(x => x.k !== key);
    if (g && g !== "_all") me.g = g;
    const at = ref ? items.findIndex(x => x.k === ref) + (after ? 1 : 0) : items.length; items.splice(at < 0 ? items.length : at, 0, me);
    await saveLayout(this.actor, items.map(x => x.g ? { k: x.k, g: x.g } : { k: x.k })); this.render();
  }
  async #mact(act, el, ev) {
    if (act === "themePick") { this._themePick = !this._themePick; return this.render(); }
    if (act === "theme") { const k = el.dataset.k; if (!themeUnlocked(this.actor, k)) return ui.notifications.info(`Thème « ${MENU_THEMES[k].n} » : équipe la compétence « ${themeSkill(k)} » pour le débloquer.`); if (!this.actor.isOwner) return;
      await this.actor.update({ [`flags.${SYS}.menuTheme`]: k, [`flags.${SYS}.menuThemeForced`]: false }); this._themePick = false; return this.render(); }
    if (act === "barToggle") { const b = barCfg(); const on = !b.on; await setBar({ on, keys: on && !b.keys.length ? visibleTabs(this.actor).filter(t => t.key !== "settings").slice(0, 6).map(t => t.key) : b.keys });
      ui.notifications.info(on ? "Barre de raccourcis activée : clic droit sur un onglet pour l'ajouter ou le retirer, glisse la poignée pour la déplacer." : "Barre de raccourcis désactivée."); return this.render(); }
    if (act === "layoutReset") { if (!this.actor.isOwner) return; await this.actor.unsetFlag(SYS, "menuLayout"); return this.render(); }
    if (act === "setLayoutAll" || act === "setLayoutReset") return this.#layoutAll(act === "setLayoutReset");
    if (act === "tab") { const k = el.dataset.tab; if (TAB_OPEN[k]) return openTabWindow(k, this.actor, { ...this.position }, this.tab, this); this.tab = k; return this.render(); }
    if (act.startsWith("set")) return this.#actSettings(act, el);
    if (act === "macro") return menuMacro(el.dataset.tab);
    const impl = TAB_IMPL[this.tab]; if (impl?.act) { await impl.act(this, act, el, ev); if (["qF", "qClear", "qView", "qOpen", "qClose", "pSel", "gSel", "mOpen", "mNew", "tab", "fView", "fMsg", "fFav", "lOpen", "fProfile"].includes(act)) return; this.render(); }
  }

  #hudCtl() { return `<div class="ms-hudctl"><label class="ms-mcheck"><input type="checkbox" data-hudset="hudShow"${game.settings.get(SYS, "hudShow") ? " checked" : ""}> Cadre de groupe à l'écran</label><label class="ms-mcheck">Coin <select data-hudset="hudCorner">${Object.entries(hudCorners).map(([k, v]) => `<option value="${k}"${game.settings.get(SYS, "hudCorner") === k ? " selected" : ""}>${v}</option>`).join("")}</select></label><label class="ms-mcheck"><input type="checkbox" data-hudset="hudCollapsed"${game.settings.get(SYS, "hudCollapsed") ? " checked" : ""}> Replié</label></div>`; }
  /* MJ : impose la disposition (et le thème) de cette fiche à toutes les fiches de joueurs, ou remet tout par défaut */
  async #layoutAll(reset) {
    const targets = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner);
    if (!reset && !this.actor) return; const L = this.actor?.getFlag(SYS, "menuLayout"); const th = this.actor?.getFlag(SYS, "menuTheme") || "nebula";
    const msg = reset ? `Remettre la disposition et le thème par défaut sur <b>${targets.length}</b> fiche(s) de joueurs ?` : `Appliquer la disposition et le thème (<b>${esc(MENU_THEMES[th]?.n || th)}</b>) du Menu de <b>${esc(this.actor?.name || "")}</b> à <b>${targets.length}</b> fiche(s) de joueurs ? Ils restent libres de les changer ensuite.`;
    if (!await foundry.applications.api.DialogV2.confirm({ window: { title: "Menu de toutes les fiches" }, classes: ["ms-dialog"], content: `<p>${msg}</p>` })) return;
    const items = L?.items?.length ? L.items : visibleTabs(this.actor).map(t => ({ k: t.key, g: tabGroup(t.key, this.actor) }));
    await editMenuCfg(c => { if (reset) { delete c.layout; delete c.theme; } else { c.layout = { items }; c.theme = th; } });
    const updates = targets.filter(a => a.id !== this.actor?.id || reset).map(a => reset ? { _id: a.id, [`flags.${SYS}.-=menuLayout`]: null, [`flags.${SYS}.-=menuTheme`]: null, [`flags.${SYS}.-=menuThemeForced`]: null }
      : { _id: a.id, [`flags.${SYS}.menuLayout`]: { items }, [`flags.${SYS}.menuTheme`]: th, [`flags.${SYS}.menuThemeForced`]: true });
    if (updates.length) await Actor.updateDocuments(updates);
    ui.notifications.info(reset ? `Menu remis par défaut sur ${targets.length} fiche(s).` : `Menu appliqué à ${targets.length} fiche(s) (et aux nouvelles fiches).`); refreshMenus();
  }
  /* ── Réglages (MJ) ── */
  #settings() {
    const c = menuCfg();
    const rows = c.tabs.map((t, i) => `<tr data-i="${i}"><td class="ic" style="color:${esc(t.color)}">${tabIcon(t)}</td><td><input type="color" data-set="color" value="${esc(t.color)}"></td><td><input type="text" data-set="name" value="${esc(t.name)}"></td><td><input type="text" data-set="icon" value="${esc(t.icon)}" class="w"></td><td class="imgc"><input type="text" data-set="img" value="${esc(t.img || "")}" placeholder="${esc(TAB_IMG[t.key] && typeof TAB_IMG[t.key] !== "function" ? "image du module" : tabImage(t) ? "image du module" : "aucune")}" class="w"><a data-mact="setImg" title="Choisir une image"><i class="fa-solid fa-image"></i></a></td>
      <td class="c"><input type="checkbox" data-set="on"${t.on ? " checked" : ""}></td><td class="c"><input type="checkbox" data-set="players"${t.players ? " checked" : ""}></td>
      <td class="mv"><a data-mact="macro" data-tab="${t.key}" title="Créer la macro"><i class="fa-solid fa-code"></i></a><a data-mact="setUp"${i ? "" : ' class="off"'}><i class="fa-solid fa-chevron-up"></i></a><a data-mact="setDown"${i < c.tabs.length - 1 ? "" : ' class="off"'}><i class="fa-solid fa-chevron-down"></i></a></td></tr>`).join("");
    const qt = c.questTypes.map((t, i) => `<tr data-q="${i}"><td class="ic" style="color:${esc(t.color)}"><i class="fa-solid ${esc(t.icon)}"></i></td><td><input type="text" data-qset="name" value="${esc(t.name)}"></td><td><input type="text" data-qset="icon" value="${esc(t.icon)}" class="w"></td><td><input type="color" data-qset="color" value="${esc(t.color)}"></td><td class="mv"><a data-mact="setQDel" class="x"><i class="fa-solid fa-xmark"></i></a></td></tr>`).join("");
    const sc = seasonCfg(), cur = currentSeason();
    const seasonBox = `<h4><i class="fa-solid fa-earth-europe"></i> Saison du monde</h4><p class="ms-mhint">Une seule saison pour toute la suite : le Catalogue (objets et ambiance de l'événement) et l'Appel des Étoiles (habillage du train) la suivent. L'événement correspond aux « saisons » du Catalogue. Actuellement : ${seasonChip(cur)} <em>(${esc(cur.src)}${cur.calLabel ? ` : ${esc(cur.calLabel)}` : ""})</em></p>
      <div class="ms-mtop ms-seasonset"><label class="ms-mcheck">Mode <select data-season="mode"><option value="auto"${sc.mode === "auto" ? " selected" : ""}>Automatique (calendrier du monde, sinon date réelle)</option><option value="fixed"${sc.mode === "fixed" ? " selected" : ""}>Choisie par le MJ</option></select></label>
      <label class="ms-mcheck">Saison <select data-season="fixed"${sc.mode === "fixed" ? "" : " disabled"}>${Object.values(SEASONS).map(x => `<option value="${x.key}"${sc.fixed === x.key ? " selected" : ""}>${x.name}</option>`).join("")}</select></label>
      <label class="ms-mcheck">Événement <select data-season="event"><option value="">Aucun</option><option value="auto"${sc.event === "auto" ? " selected" : ""}>Automatique (fête du calendrier)</option>${Object.values(SEASON_EVENTS).map(x => `<option value="${x.key}"${sc.event === x.key ? " selected" : ""}>${x.name}</option>`).join("")}</select></label><a class="ms-mbtn blue" data-mact="setSeasonEv"><i class="fa-solid fa-wand-magic-sparkles"></i> Ajouter des événements</a></div>`;
    return `<div class="ms-mpanel ms-mset">${seasonBox}${cardGmPanel()}<h4><i class="fa-solid fa-table-list"></i> Onglets du Menu</h4>
      <table><thead><tr><th></th><th>Couleur</th><th>Nom</th><th>Icône (Font Awesome)</th><th>Image (remplace l'icône)</th><th>Activé</th><th>Joueurs</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <p class="ms-mhint">« Joueurs » décoché : l'onglet n'est visible que du MJ. « Activé » décoché : l'onglet disparaît pour tout le monde.</p><label class="ms-mcheck"><input type="checkbox" data-opt="grouped"${c.grouped !== false ? " checked" : ""}> Classer les onglets par groupe (${MENU_GROUPS.map(g => esc(g.name)).join(", ")})</label>
      <h4><i class="fa-solid fa-table-columns"></i> Disposition du Menu pour toutes les fiches</h4><p class="ms-mhint">Chaque fiche a sa propre disposition : on glisse un onglet pour changer son ordre ou sa catégorie (Orbis Astra, Communication, Aventure…). ${this.actor ? `Range ce Menu (fiche de <b>${esc(this.actor.name)}</b>) comme tu le veux, choisis son thème, puis impose-le à toutes les fiches de joueurs ; il devient aussi la disposition des nouvelles fiches.` : "Pour imposer une disposition, ouvre le Menu d'une fiche, range-le, puis utilise ce bouton depuis ses Réglages."}</p>
      <div class="ms-mtop">${this.actor ? "" : "<!--"}<a class="ms-mbtn blue" data-mact="setLayoutAll"><i class="fa-solid fa-users-gear"></i> Appliquer ce Menu à toutes les fiches</a>${this.actor ? "" : "-->"}<a class="ms-mbtn ghost" data-mact="setLayoutReset"><i class="fa-solid fa-rotate-left"></i> Tout remettre par défaut</a></div>
      <h4><i class="fa-solid fa-palette"></i> Thèmes de la colonne de gauche</h4><p class="ms-mhint">Un thème se débloque quand le personnage possède (et a équipé, si elle est équipable) la compétence indiquée. Vide = thème libre.</p>
      <table><thead><tr><th>Thème</th><th>Compétence qui le débloque</th></tr></thead><tbody>${Object.entries(MENU_THEMES).map(([k, v]) => `<tr><td><span class="ms-thname" style="--thc:${v.c}">${esc(v.n)}</span></td><td><input type="text" data-thskill="${k}" value="${esc(themeSkill(k))}" placeholder="libre"></td></tr>`).join("")}</tbody></table>
      <label class="ms-mcheck"><input type="checkbox" data-mfs${(() => { try { return game.settings.get(SYS, "menuFullscreen") !== false; } catch (e) { return true; } })() ? " checked" : ""}> Menu en plein écran (réductible) — réglage personnel</label>
      <h4><i class="fa-solid fa-code"></i> Macros</h4><p class="ms-mhint">Chaque onglet peut devenir une macro : glisse-le depuis la colonne de gauche sur la barre de macros, ou crée-les ici (dossier « Menu Manhwa », visibles des joueurs, qui les glissent sur leur barre). La macro ouvre le Menu du personnage du joueur.</p><div class="ms-mtop"><a class="ms-mbtn blue" data-mact="setMacros"><i class="fa-solid fa-code"></i> Créer toutes les macros</a></div>
      <h4><i class="fa-solid fa-comments"></i> Chat</h4><label class="ms-mcheck"><input type="checkbox" data-opt="tradeInChat"${c.tradeInChat !== false ? " checked" : ""}> Afficher les échanges dans le chat</label>
      <h4><i class="fa-solid fa-broom"></i> Historique</h4><div class="ms-mtop"><a class="ms-mbtn red" data-mact="setPurgeTrades"><i class="fa-solid fa-right-left"></i> Supprimer l'historique des échanges</a><a class="ms-mbtn red" data-mact="setPurgeDm"><i class="fa-solid fa-comments"></i> Supprimer les messages privés</a><a class="ms-mbtn red" data-mact="setPurgeLetters"><i class="fa-solid fa-envelopes-bulk"></i> Vider le courrier</a><a class="ms-mbtn red" data-mact="setPurgeNews"><i class="fa-solid fa-bullhorn"></i> Vider les annonces</a></div>
      <h4><i class="fa-solid fa-scroll"></i> Quêtes</h4><label class="ms-mcheck">Présentation <select data-optsel="questView">${[["board", "Tableau de cartes"], ["list", "Liste compacte"], ["system", "Fenêtre système"]].map(o => `<option value="${o[0]}"${(c.questView || "board") === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select></label>
      <div class="ms-qset"><label class="ms-mcheck"><i class="fa-solid fa-lightbulb"></i> Couleur du néon <select data-optsel="questNeon">${[["rank", "Couleur du rang"], ["type", "Couleur du type"], ["fixed", "Couleur fixe"]].map(o => `<option value="${o[0]}"${(c.questNeon || "rank") === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select></label>
      <label class="ms-mcheck">Couleur fixe <input type="color" data-optsel="questNeonColor" value="${esc(c.questNeonColor || "#38c8ff")}"></label>
      <label class="ms-mcheck">Intensité du néon <select data-optsel="questGlow">${[["soft", "Douce"], ["normal", "Normale"], ["strong", "Forte"]].map(o => `<option value="${o[0]}"${(c.questGlow || "normal") === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select></label>
      <label class="ms-mcheck"><input type="checkbox" data-opt="questBold"${c.questBold !== false ? " checked" : ""}> Objectifs chiffrés en gras et en néon</label>
      <label class="ms-mcheck"><i class="fa-solid fa-heading"></i> Police du titre <select data-optsel="questFont">${[["rajdhani", "Rajdhani (net)"], ["cinzel", "Cinzel (épique)"], ["orbitron", "Orbitron (système)"]].map(o => `<option value="${o[0]}"${(c.questFont || "cinzel") === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select></label>
      <label class="ms-mcheck">Effet du titre <select data-optsel="questTitleFx">${[["neon", "Néon lumineux"], ["gold", "Dégradé doré"], ["rank", "Dégradé du rang"], ["plain", "Simple"]].map(o => `<option value="${o[0]}"${(c.questTitleFx || "neon") === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select></label>
      <label class="ms-mcheck">Taille du titre <select data-optsel="questTitleSize">${[["s", "Petite"], ["m", "Moyenne"], ["l", "Grande"], ["xl", "Très grande"]].map(o => `<option value="${o[0]}"${(c.questTitleSize || "m") === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select></label></div>
      <h4><i class="fa-solid fa-scroll"></i> Types de quêtes</h4><table><thead><tr><th></th><th>Nom</th><th>Icône</th><th>Couleur</th><th></th></tr></thead><tbody>${qt}</tbody></table>
      <div class="ms-mtop"><a class="ms-mbtn blue" data-mact="setQAdd"><i class="fa-solid fa-plus"></i> Type de quête</a><a class="ms-mbtn ghost" data-mact="setQReset"><i class="fa-solid fa-rotate-left"></i> Types par défaut</a><a class="ms-mbtn ghost" data-mact="setReset"><i class="fa-solid fa-rotate-left"></i> Onglets par défaut</a></div></div>`;
  }
  #bindSettings(root) {
    bindCardGm(root);
    root.querySelectorAll("[data-set]").forEach(i => i.addEventListener("change", () => editMenuCfg(c => { const t = c.tabs[i.closest("[data-i]").dataset.i]; if (!t) return false; t[i.dataset.set] = i.type === "checkbox" ? i.checked : i.dataset.set === "img" ? i.value.trim() : (i.value.trim() || t[i.dataset.set]); })));
    root.querySelectorAll("[data-qset]").forEach(i => i.addEventListener("change", () => editMenuCfg(c => { const t = c.questTypes[i.closest("[data-q]").dataset.q]; if (!t) return false; t[i.dataset.qset] = i.value.trim() || t[i.dataset.qset]; })));
    root.querySelectorAll("[data-opt]").forEach(i => i.addEventListener("change", () => editMenuCfg(c => { c[i.dataset.opt] = i.checked; })));
    root.querySelectorAll("[data-season]").forEach(i => i.addEventListener("change", async () => { await setSeason({ [i.dataset.season]: i.value }); this.render(); }));
    root.querySelectorAll("[data-thskill]").forEach(i => i.addEventListener("change", () => editMenuCfg(c => { c.themeSkills = { ...(c.themeSkills || {}), [i.dataset.thskill]: i.value.trim() }; })));
    root.querySelector("[data-mfs]")?.addEventListener("change", ev => game.settings.set(SYS, "menuFullscreen", ev.target.checked));
    root.querySelectorAll("[data-optsel]").forEach(i => i.addEventListener("change", () => editMenuCfg(c => { c[i.dataset.optsel] = i.value; })));
  }
  async #actSettings(act, el) {
    const i = Number(el.closest("[data-i]")?.dataset.i); const q = Number(el.closest("[data-q]")?.dataset.q);
    if (act === "setSeasonEv") { const { seasonEventsEditor } = await import("./season.js"); return seasonEventsEditor(); }
    if (["setUp", "setDown", "setReset", "setQAdd", "setQDel", "setQReset"].includes(act)) return editMenuCfg(c => {   /* lecture + écriture sous verrou : deux clics rapides ne s'effacent plus */
      if (act === "setUp" && i > 0) [c.tabs[i - 1], c.tabs[i]] = [c.tabs[i], c.tabs[i - 1]];
      else if (act === "setDown" && i < c.tabs.length - 1) [c.tabs[i + 1], c.tabs[i]] = [c.tabs[i], c.tabs[i + 1]];
      else if (act === "setReset") c.tabs = MENU_TABS.map(t => ({ ...t, on: true, players: true }));
      else if (act === "setQAdd") c.questTypes.push({ key: `t${Date.now().toString(36)}`, name: "Nouveau type", icon: "fa-star", color: "#8ea0c8" });
      else if (act === "setQDel") c.questTypes.splice(q, 1);
      else if (act === "setQReset") c.questTypes = QUEST_TYPES;
      else return false; });
    const c = menuCfg();
    if (act === "setUp" && i > 0) [c.tabs[i - 1], c.tabs[i]] = [c.tabs[i], c.tabs[i - 1]];
    else if (act === "setDown" && i < c.tabs.length - 1) [c.tabs[i + 1], c.tabs[i]] = [c.tabs[i], c.tabs[i + 1]];
    else if (act === "setReset") c.tabs = MENU_TABS.map(t => ({ ...t, on: true, players: true }));
    else if (act === "setImg") { const FP = foundry.applications.apps.FilePicker.implementation; return new FP({ type: "image", current: c.tabs[i].img || "", callback: path => editMenuCfg(c2 => { if (!c2.tabs[i]) return false; c2.tabs[i].img = path; }) }).render(true); }
    else if (act === "setQAdd") c.questTypes.push({ key: `t${Date.now().toString(36)}`, name: "Nouveau type", icon: "fa-star", color: "#8ea0c8" });
    else if (act === "setQDel") c.questTypes.splice(q, 1);
    else if (act === "setQReset") c.questTypes = QUEST_TYPES;
    else if (act === "setMacros") { let n = 0; for (const t of c.tabs) if (await menuMacro(t.key, { quiet: true })) n++; return ui.notifications.info(`${n} macros prêtes dans le dossier « Menu Manhwa ».`); }
    else if (act.startsWith("setPurge")) {
      const what = { setPurgeTrades: ["l'historique des échanges", "trade"], setPurgeDm: ["tous les messages privés", "dm"], setPurgeLetters: ["tout le courrier", null], setPurgeNews: ["toutes les annonces", null] }[act];
      if (!await foundry.applications.api.DialogV2.confirm({ window: { title: "Supprimer l'historique" }, classes: ["ms-dialog"], content: `<p>Supprimer <b>${what[0]}</b> ? C'est définitif.</p>` })) return;
      if (what[1]) { const ids = game.messages.filter(m => m.flags?.[SYS]?.[what[1]] && (what[1] !== "trade" || m.flags[SYS].trade.state !== "open")).map(m => m.id); await ChatMessage.deleteDocuments(ids); ui.notifications.info(`${ids.length} message(s) supprimé(s).`); }
      else if (act === "setPurgeLetters") await editList("letters", l => { for (let k = l.length - 1; k >= 0; k--) if (!l[k].pending) l.splice(k, 1); });   /* une lettre en cours d'envoi est gardée (ses objets sont déjà pris à l'expéditeur) */
      else await editList("news", l => { l.length = 0; });
      return refreshMenus(); }
    else return;
    await saveMenuCfg(c);
  }
}

/* le Menu suit les personnages, les messages et les réglages */
let _t = null; const soon = () => { clearTimeout(_t); _t = setTimeout(refreshMenus, 120); };
Hooks.on("updateActor", soon); Hooks.on("createItem", soon); Hooks.on("deleteItem", soon);
for (const h of ["createJournalEntry", "updateJournalEntry", "deleteJournalEntry"]) Hooks.on(h, soon);

/* ── fenêtres liées au Menu : la fenêtre ouverte prend la place (et la taille) du Menu, avec un bouton « Précédent » ── */
async function openTabWindow(key, actor, pos, backTab, menuApp) {
  if (menuApp?.rendered) await menuApp.close({ animate: false });
  let win = null; try { win = await TAB_OPEN[key]({ actor, pos }); } catch (err) { console.error(SYS, err); }
  if (!win) { MenuApp.open(actor, backTab, pos); return null; }
  const reopen = () => MenuApp.open(actor, backTab && !TAB_OPEN[backTab] ? backTab : null, isFs(win) ? pos : { ...win.position });
  win._msFromMenu = reopen;   /* plein écran : « quitter » ramène au Menu (1.29) */
  attachBack(win, reopen, "Menu");
  return win;
}
/** ajoute (ou remplace) un bouton « ‹ Précédent » dans l'en-tête d'une fenêtre ; il la ferme et lance onBack */
export function attachBack(win, onBack, label = "Précédent") {
  if (isFs(win)) { win._msBack = onBack; win._msBackLabel = label; if (win.element) fsMount(win); return; }   /* plein écran : grosse flèche néon (1.29) */
  const put = () => { const h = win.element?.querySelector(".window-header"); if (!h) return false; h.querySelector(".ms-back")?.remove();
    const b = document.createElement("button"); b.type = "button"; b.className = "header-control ms-back"; b.dataset.tooltip = `Revenir : ${label}`; b.innerHTML = `<i class="fa-solid fa-chevron-left"></i><span>${label}</span>`;
    b.addEventListener("click", async ev => { ev.preventDefault(); ev.stopPropagation(); win._msBack = null; await win.close({ animate: false }); onBack(); });
    h.prepend(b); win._msBack = onBack; return true; };
  if (!put()) { let n = 0; const iv = setInterval(() => { if (put() || ++n > 40) clearInterval(iv); }, 100); }
}

Hooks.on("manhwaSeason", () => { for (const app of foundry.applications.instances.values()) if (app instanceof MenuApp && app.rendered) app.render(); });

Hooks.once("init", () => {
  game.settings.register(SYS, "menuFullscreen", { name: "Menu en plein écran", hint: "Le Menu s'ouvre en plein écran (réductible en barre). Décoché : fenêtre classique.", scope: "client", config: true, type: Boolean, default: true,
    onChange: () => { for (const app of [...foundry.applications.instances.values()]) if (app instanceof MenuApp) app.close({ animate: false }); } });
});
