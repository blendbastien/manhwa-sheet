/* Manhwa Sheet — Centre du MJ : tous les réglages de la suite Manhwa au même endroit (raccourcis).
 * Bouton dans les outils de gauche (contrôles des jetons), dans les réglages de Foundry et touche configurable.
 * Liste automatiquement les menus de réglages de chaque module de la suite, plus des raccourcis choisis. */
import { SYS, esc, getConfig, rankOf, levelColor } from "./config.js";
import { gmGroupCards, bindGmGroupCards, createGmGroup, editGmGroups } from "./gmgroups.js";
import { ClassesEditor } from "./classes.js";
const { ApplicationV2 } = foundry.applications.api;

const SUITE = ["manhwa-sheet", "gacha-manhwa", "last-horizon-catalogue", "vehicules-manhwa", "sidebar-manhwa", "pnj-manhwa", "scenarios-manhwa", "last-horizon-transfer", "last-horizon-worldbook"];
const anyActor = () => game.user.character || game.actors.find(a => a.type === "character") || game.actors.contents[0];
const mod = id => id === SYS ? game.system : game.modules.get(id);
const on = id => id === SYS || !!game.modules.get(id)?.active;
const suiteIds = () => [SYS, ...game.modules.filter(m => m.active && m.id !== SYS && (SUITE.includes(m.id) || (m.authors || []).some?.(a => /bastien/i.test(a.name || "")))).map(m => m.id)];

/* 1.34 — catégories (comme les outils de Foundry à gauche), chacune avec sa couleur et son icône */
const CATS = [
  { k: "time", n: "Temps et jours", i: "fa-clock", c: "#5ee0ff", s: "Horloge, groupes, jours qui passent" }, { k: "people", n: "Joueurs et groupes", i: "fa-users", c: "#3ddc84", s: "Groupes d'aventure, groupes MJ, personnages" },
  { k: "menu", n: "Menu et saison", i: "fa-bars", c: "#c084fc", s: "Onglets, thèmes, saison, événements" }, { k: "sheet", n: "Fiche", i: "fa-id-card", c: "#ff9a3d", s: "Configuration, progression, classes, téléphone" },
  { k: "eco", n: "Économie", i: "fa-coins", c: "#ffc63d", s: "Boutique, Catalogue, gacha, Signal" }, { k: "uni", n: "Univers", i: "fa-rocket", c: "#5e8bff", s: "Planètes, carte stellaire, portraits" },
  { k: "story", n: "Récit", i: "fa-comment-dots", c: "#b980ff", s: "Scénarios, notifications" }, { k: "home", n: "Domaine", i: "fa-house-chimney", c: "#2fd8c8", s: "Logements, véhicules, garage" },
  { k: "ui", n: "Interface", i: "fa-window-maximize", c: "#ff6bd5", s: "Barre latérale, scènes, playlists, journal, transfert" }, { k: "all", n: "Tous les réglages", i: "fa-list-check", c: "#9fb0d4", s: "Les réglages Foundry de chaque module" }];
const MODCAT = { [SYS]: "sheet", "gacha-manhwa": "eco", "last-horizon-catalogue": "eco", "vehicules-manhwa": "home", "sidebar-manhwa": "ui", "pnj-manhwa": "uni", "scenarios-manhwa": "story", "notifications-manhwa": "story", "last-horizon-transfer": "ui", "last-horizon-worldbook": "uni", "carte-stellaire-manhwa": "uni", "horlogia-manhwa": "time" };
const short = n => { n = Number(n) || 0; const a = Math.abs(n); return a >= 1e9 ? `${(n / 1e9).toFixed(1).replace(".", ",")} Md` : a >= 1e6 ? `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",")} M` : a >= 1e4 ? `${Math.round(n / 1e3)} k` : new Intl.NumberFormat("fr-FR").format(Math.round(n)); };
const api = id => game.modules.get(id)?.active ? game.modules.get(id).api : null;
const menuSettings = async () => (await import("./menu.js")).MenuApp.openSettings();
/* raccourcis choisis : [catégorie, module, icône, nom, description, action] */
const CURATED = [
  ["menu", SYS, "fa-bars", "Réglages du Menu", "Onglets visibles, ordre, thèmes, disposition pour toutes les fiches, quêtes, chat, historique.", menuSettings],
  ["menu", SYS, "fa-wand-magic-sparkles", "Saison du monde et événements", "Saison automatique ou choisie, événement en cours, et tes propres événements (Catalogue, Boutique, Horlogia, gacha).", async () => (await import("./season.js")).seasonEventsEditor()],
  ["sheet", SYS, "fa-mobile-screen-button", "Téléphone du MJ", "Ton propre téléphone : voir tous les téléphones, appels scénarisés, réseau, Store, cosmétiques.", async () => (await import("./phone.js")).openGmPhone("gm")],
  ["sheet", SYS, "fa-gift", "Récompenses", "XP, monnaies et butin des monstres vaincus, à un groupe ou à des joueurs.", () => globalThis.MANHWA?.rewardDialog?.()],
  ["sheet", SYS, "fa-sitemap", "Classes et sous-classes", "Classes de base, évolutions, sous-classes, qui peut choisir.", () => ClassesEditor.open()],
  ["eco", "last-horizon-catalogue", "fa-store", "Boutique et Catalogue", "Ouvrir la Boutique (blocs, objets, prix).", () => api("last-horizon-catalogue")?.open?.()],
  ["eco", "last-horizon-catalogue", "fa-gear", "Gestion de la Boutique", "Personnages, étiquettes, niveaux, historique, prix, bandeau.", () => api("last-horizon-catalogue")?.admin?.("pcs")],
  ["eco", "last-horizon-catalogue", "fa-tower-broadcast", "Signal Quotidien", "Cycles, récompenses de chaque jour, jours qui passent.", () => api("last-horizon-catalogue")?.admin?.("signal")],
  ["eco", "gacha-manhwa", "fa-store", "Boutique stellaire", "Sections, offres, limites, cosmétiques de téléphone.", () => api("gacha-manhwa")?.shop?.()],
  ["eco", "gacha-manhwa", "fa-pen-ruler", "Éditeur des bannières", "Contenu (Catalogue, blocs de la Boutique), taux, coûts, règles.", () => api("gacha-manhwa")?.editor?.()],
  ["uni", "gacha-manhwa", "fa-earth-americas", "Univers (planètes, galaxies)", "Planète de chaque bannière, ciel, habillage du train.", () => { const e = api("gacha-manhwa")?.editor?.(); if (e) { e.tab = "univ"; e.render(); } }],
  ["eco", "gacha-manhwa", "fa-sliders", "Réglages généraux du gacha", "Pack d'assets, fragments, annonces, habillage par défaut.", () => { const e = api("gacha-manhwa")?.editor?.(); if (e) { e.tab = "gen"; e.render(); } }],
  ["time", "horlogia-manhwa", "fa-calendar-days", "Horlogia : calendrier", "Fêtes et événements, vue mois et année.", () => globalThis.HORLOGIA?.open("cal")],
  ["time", "horlogia-manhwa", "fa-users-gear", "Horlogia : temps des groupes MJ", "Date, calendrier et météo de chaque groupe MJ.", () => globalThis.HORLOGIA?.open("groups")],
  ["time", "horlogia-manhwa", "fa-calendar-plus", "Horlogia : calendriers", "Mois, jours, heures, saisons, lunes, nom de l'année.", () => globalThis.HORLOGIA?.open("cals")],
  ["home", "vehicules-manhwa", "fa-house-chimney", "Domaine", "Logements et véhicules, plans, objets.", () => globalThis.VEHICULES?.logement?.()],
  ["home", "vehicules-manhwa", "fa-warehouse", "Garage : réglages", "Affichage des caractéristiques, emplacements par taille.", () => { const g = globalThis.VEHICULES?.garage?.(); if (g) { g.view = "settings"; g.render(); } }],
  ["uni", "pnj-manhwa", "fa-people-group", "Portrait - Manhwa", "Portraits par groupe MJ, sous-groupes, mise en scène.", () => api("pnj-manhwa")?.open?.()],
  ["story", "scenarios-manhwa", "fa-scroll", "Scénarios", "Tableau des scénarios, diffusion, récompenses.", () => api("scenarios-manhwa")?.open?.()]
];

/* clé stable d'un élément (chemin d'index depuis la racine) pour retrouver la même zone après un nouveau rendu */
const keyOf = (root, el) => { const p = []; for (let n = el; n && n !== root; n = n.parentElement) p.unshift([...n.parentElement.children].indexOf(n)); return p.join("."); };
const findKey = (root, k) => { let n = root; for (const i of k.split(".")) { n = n?.children?.[+i]; if (!n) return null; } return n; };
export class GmHub extends ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "ms-gmhub", classes: ["ms-sheet", "ms-gmhub", "hb2", "ms-progapp"], window: { title: "Centre du MJ", icon: "fa-solid fa-crown", resizable: true }, position: { width: 1180, height: 800 } };
  static open(cat) { if (!game.user.isGM) return ui.notifications.warn("Réservé au MJ."); const a = foundry.applications.instances.get("ms-gmhub") || new GmHub(); if (cat) a.cat = cat; a.render({ force: true }); return a; }
  constructor(o) { super(o); this.q = ""; this.cat = "time"; }
  _onFirstRender(ctx, opts) { super._onFirstRender?.(ctx, opts); setTimeout(() => { if (this.rendered && this.position.width < 1050 && innerWidth > 1150) { const w = Math.min(1180, innerWidth - 60); this.setPosition({ width: w, left: Math.max(10, (innerWidth - w) / 2) }); } }, 60); }
  entries() {
    const out = [];
    for (const [cat, id, icon, name, desc, run] of CURATED) if (on(id)) out.push({ key: `c:${name}`, cat, mod: id, icon, name, desc, run });
    for (const id of suiteIds()) { const m = mod(id); if (!m) continue;
      for (const [k, menu] of game.settings.menus) { if (!k.startsWith(`${id}.`) || k === `${SYS}.gmHub`) continue; const nm = game.i18n.localize(menu.name || menu.label || k); if (out.some(x => x.mod === id && x.name === nm)) continue; out.push({ key: `m:${k}`, cat: MODCAT[id] || "all", mod: id, icon: (menu.icon || "fa-solid fa-sliders").replace(/^fa-solid\s+|^fas\s+/, ""), name: game.i18n.localize(menu.name || menu.label || k), desc: game.i18n.localize(menu.hint || ""), run: () => new menu.type().render(true) }); }
      const nSet = [...game.settings.settings.values()].filter(s => s.namespace === id && s.config).length;
      if (nSet) out.push({ key: `s:${id}`, cat: "all", mod: id, icon: "fa-list-check", name: `${m.title || id}`, desc: `${nSet} réglage${nSet > 1 ? "s" : ""} dans la configuration de Foundry.`, run: () => openSettingsFor(id) }); }
    return out;
  }
  /* 1.57 — même D.A que Progression & coûts : rail néon, bandeau avec résumé vivant, panneaux, tuiles, graphiques */
  chip(l, v, c) { return `<span class="pg-chip"${c ? ` style="--cc:${c}"` : ""}><small>${l}</small><b>${v}</b></span>`; }
  panel(t, ic, body, { hint = "", cls = "", c = "" } = {}) { return `<section class="pg-panel ${cls}"${c ? ` style="--pc:${c}"` : ""}><header><i class="fa-solid ${ic}"></i><b>${t}</b></header>${hint ? `<p class="pg-hint">${hint}</p>` : ""}${body}</section>`; }
  tile(x) { return `<a class="pg-tile hb-t" data-k="${esc(x.key)}"><i class="fa-solid ${esc(x.icon)}"></i><b>${esc(x.name)}</b><small>${esc(x.desc || "")}</small></a>`; }
  byModule(L) { const g = new Map(); for (const x of L) { if (!g.has(x.mod)) g.set(x.mod, []); g.get(x.mod).push(x); }
    return [...g].map(([id, l]) => this.panel(esc(mod(id)?.title || id), "fa-cube", `<div class="pg-tiles hb-tiles">${l.map(x => this.tile(x)).join("")}</div>`)).join(""); }
  gold(a) { const c = getConfig(); const r = c.resources.find(x => /^(gold|or)$/i.test(x.key) || /^(gold|or)$/i.test(x.name)) || c.resources.find(x => x.key === c.progression?.payWith) || c.resources[0]; return { r, v: Number(a.system.resources?.[r?.key]) || 0 }; }
  pcs() { return game.actors.filter(a => a.type === "character" && a.hasPlayerOwner).sort((a, b) => a.name.localeCompare(b.name, "fr")); }
  summary(k, E) { const H = globalThis.HORLOGIA; const n = E.filter(x => x.cat === k).length;
    try {
      if (k === "time") { if (!H || !on("horlogia-manhwa")) return this.chip("Horlogia", "Inactif", "#ff6b8a"); const S = H.state(); const g = S.groups[0]; return (g ? this.chip(esc(g.name), esc(H.now(g.id).label)) : "") + this.chip("Horloge", S.play ? "▶ Lecture" : "⏸ Pause", S.play ? "#3ddc84" : "#ff9a3d") + this.chip("Combat", S.combat ? "En cours" : "Non", S.combat ? "#ff5d6c" : "#8ea6d8"); }
      if (k === "people") { const P = game.settings.get(SYS, "parties")?.list || []; const G = game.settings.get(SYS, "gmGroups"); const pl = game.users.filter(u => !u.isGM); return this.chip("Groupes d'aventure", P.length) + this.chip("Groupes MJ", (G?.list || G || []).length) + this.chip("Joueurs connectés", `${pl.filter(u => u.active).length} / ${pl.length}`, "#3ddc84"); }
      if (k === "menu") { const S = globalThis.MANHWA?.season?.(); return this.chip("Saison", esc(S?.name || "—")) + this.chip("Événement", esc(S?.eventName || "Aucun"), S?.eventName ? "#ff9ad5" : "#8ea6d8") + this.chip("Outils", n); }
      if (k === "sheet") { const c = getConfig(); return this.chip("Thème", esc((() => { const v = game.settings.get(SYS, "theme"); const ch = game.settings.settings.get(`${SYS}.theme`)?.choices || {}; return game.i18n.localize(ch[v] || v || "—"); })())) + this.chip("Stats payantes", c.progression.paidStats ? "Oui" : "Non", c.progression.paidStats ? "#3ddc84" : "#8ea6d8") + this.chip("XP", esc({ curve: "Courbe", simple: "Simple", tiers: "Paliers", manual: "Un par un", formula: "Formule" }[c.xp.costMode] || "Simple")) + this.chip("Outils", n); }
      if (k === "eco") { const L = this.pcs(); const t = L.reduce((s, a) => s + this.gold(a).v, 0); return this.chip(esc(L[0] ? this.gold(L[0]).r?.name || "Gold" : "Gold") + " des joueurs", short(t), "#ffc63d") + this.chip("Personnages", L.length) + this.chip("Outils", n); }
    } catch (e) { console.warn(SYS, e); }
    return this.chip("Outils", n); }
  async _renderHTML() {
    const q = this.q.trim().toLowerCase(); const E = this.entries(); this._E = E; const C = CATS.find(c => c.k === this.cat) || CATS[0];
    const cnt = k => { if (k === "time") return globalThis.HORLOGIA && on("horlogia-manhwa") ? (globalThis.HORLOGIA.state().groups.length || "") : ""; if (k === "people") return (game.settings.get(SYS, "parties")?.list || []).length || ""; return E.filter(x => x.cat === k).length || ""; };
    const nav = CATS.map(c => `<a data-cat="${c.k}" class="${c.k === this.cat && !q ? "on" : ""}" style="--pc:${c.c}"><i class="fa-solid ${c.i}"></i><span><b>${c.n}</b><small>${c.s}</small></span>${cnt(c.k) ? `<em class="pg-cnt">${cnt(c.k)}</em>` : ""}</a>`).join("");
    let band, body;
    if (q) { const L = E.filter(x => `${x.name} ${x.desc} ${mod(x.mod)?.title || ""}`.toLowerCase().includes(q));
      band = `<header class="pg-band"><i class="fa-solid fa-magnifying-glass"></i><div><small>Recherche « ${esc(this.q)} »</small><h2>${L.length} résultat${L.length > 1 ? "s" : ""}</h2></div></header>`;
      body = CATS.filter(c => L.some(x => x.cat === c.k)).map(c => this.panel(c.n, c.i, `<div class="pg-tiles hb-tiles">${L.filter(x => x.cat === c.k).map(x => this.tile(x)).join("")}</div>`, { c: c.c })).join("") || this.panel("Aucun résultat", "fa-circle-xmark", `<p class="pg-hint">Aucun réglage ne correspond.</p>`); }
    else { const L = E.filter(x => x.cat === C.k);
      band = `<header class="pg-band"><i class="fa-solid ${C.i}"></i><div><small>${esc(C.s)}</small><h2>${esc(C.n)}</h2></div><div class="pg-sum">${this.summary(C.k, E)}</div></header>`;
      body = (C.k === "time" ? this.#time() : C.k === "people" ? this.#people() : C.k === "eco" ? this.#goldChart() : "") + (L.length ? (C.k === "all" ? this.panel("Réglages Foundry par module", "fa-list-check", `<div class="pg-tiles hb-tiles">${L.map(x => this.tile(x)).join("")}</div>`) : this.byModule(L)) : C.k === "time" || C.k === "people" ? "" : this.panel("Rien ici", "fa-circle-xmark", `<p class="pg-hint">Aucun outil dans cette catégorie (module inactif ?).</p>`)); }
    return `<div class="pg-root" style="--pc:${q ? "#9fb0d4" : C.c}"><nav class="pg-rail"><div class="pg-brand"><i class="fa-solid fa-crown"></i><b>CENTRE DU MJ</b><small>[ SYSTÈME ] COMMANDES</small></div><label class="hb-q pg-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="Chercher un réglage…" value="${esc(this.q)}"></label>${nav}</nav>
      <section class="pg-body">${band}<div class="pg-page">${body}</div></section></div>`;
  }
  /* ── Temps et jours ── */
  #time() {
    const H = globalThis.HORLOGIA; let out = "";
    if (H && on("horlogia-manhwa")) { const S = H.state();
      out += this.panel("Horloge du monde", "fa-clock", `<div class="pg-bigs"><a class="pg-big" style="--bc:${S.play ? "#ff9a3d" : "#3ddc84"}" data-t="play"><i class="fa-solid ${S.play ? "fa-pause" : "fa-play"}"></i><b>${S.play ? "Pause" : "Lecture"}</b><small>${S.play ? "Le temps s'écoule" : "Le temps est arrêté"}</small></a><a class="pg-big" style="--bc:#ff5d6c" data-t="combat"><i class="fa-solid fa-khanda"></i><b>${S.combat ? "Fin du combat" : "Mode combat"}</b><small>${S.combat ? "Chrono de combat en cours" : "Chrono séparé du temps des groupes"}</small></a><a class="pg-big" style="--bc:#5ee0ff" data-t="open"><i class="fa-solid fa-calendar-days"></i><b>Ouvrir Horlogia</b><small>Groupes, calendriers, météo</small></a></div>`)
        + this.panel("Temps des groupes", "fa-users-gear", `<div class="pg-groups">${S.groups.map(g => { const n = H.now(g.id); return `<div class="pg-grp" style="--gc:${esc(g.color || "#5ee0ff")}"><header><i class="fa-solid fa-people-group"></i><b>${esc(g.name)}</b>${g.feeds ? `<em data-tooltip="Ses nouveaux jours font avancer les modules"><i class="fa-solid fa-link"></i> modules</em>` : ""}</header><span class="when">${esc(n.label)}</span>
          <div class="adv">${[["+1 h", 3600], ["+6 h", 21600], ["+1 jour", "d"], ["+1 sem.", "w"]].map(([l, v]) => `<a data-t="adv" data-g="${g.id}" data-v="${v}">${l}</a>`).join("")}</div></div>`; }).join("") || `<p class="pg-hint">Aucun groupe dans Horlogia.</p>`}</div>`); }
    else out += this.panel("Horloge du monde", "fa-clock", `<p class="pg-hint">Active le module Horlogia - Manhwa pour la date, l'heure qui défile, les groupes et le mode combat.</p>`);
    const log = (game.settings.get(SYS, "dayLog")?.list || []).slice(0, 8);
    const ck = (k, ic, label, sub, def, ok) => ok ? `<label class="pg-tile pg-ck"><input type="checkbox" data-dk="${k}"${def ? " checked" : ""}><i class="fa-solid ${ic}"></i><b>${label}</b><small>${sub}</small></label>` : "";
    out += this.panel("Faire passer des jours pour les modules", "fa-forward-fast", `<div class="pg-tiles">${ck("signal", "fa-tower-broadcast", "Signal Quotidien", "Jour suivant pour tous les cycles actifs", true, on("last-horizon-catalogue"))}${ck("promo", "fa-percent", "Offres limitées", "Un jour de moins sur les promotions", true, on("last-horizon-catalogue"))}${ck("restock", "fa-boxes-stacked", "Réassort", "Remettre tout le stock au maximum", false, on("last-horizon-catalogue"))}${ck("stellar", "fa-star", "Limites stellaires", "Remettre à zéro les achats de la période", false, on("gacha-manhwa"))}</div>
      <div class="pg-row pg-days"><label class="pg-f"><span>Nombre de jours</span><span class="pg-num"><a data-act="nstep" data-d="-1">−</a><input type="number" min="1" max="60" value="1" data-dn><a data-act="nstep" data-d="1">+</a></span></label><a class="pg-go" data-t="days"><i class="fa-solid fa-forward-fast"></i> Faire passer</a></div>
      ${log.length ? `<div class="pg-log">${log.map(l => `<div><i></i><span>${esc(l.txt)}</span><small>${new Date(l.t).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</small></div>`).join("")}</div>` : ""}`, { hint: "Indépendant d'Horlogia : rien ne bouge sans ce bouton (ou sans un groupe Horlogia coché « fait avancer les modules »). Coche les modules concernés.", c: "#ffc63d" });
    return out;
  }
  /* ── graphique : Gold des joueurs ── */
  #goldChart() { const L = this.pcs(); if (!L.length) return ""; const D = L.map(a => ({ a, ...this.gold(a) })); const mx = Math.max(1, ...D.map(d => d.v)); const rn = D[0].r?.name || "Gold";
    return this.panel(`${esc(rn)} des personnages`, "fa-chart-column", `<div class="pg-bars">${D.sort((x, y) => y.v - x.v).map(d => `<div class="pg-bar"><img src="${esc(d.a.img)}"><span class="nm">${esc(d.a.name)}</span><span class="tr"><i style="width:${Math.max(1, d.v / mx * 100).toFixed(1)}%"></i></span><b>${short(d.v)}</b></div>`).join("")}</div>`, { hint: "Ce que chaque personnage de joueur possède en ce moment." }); }
  /* ── aperçu des personnages : niveau, XP, rang, Gold ── */
  #pcChart() { const L = this.pcs(); if (!L.length) return ""; const cfg = getConfig(); const mxLv = Math.max(10, ...L.map(a => Number(a.system.level) || 0)); const mxG = Math.max(1, ...L.map(a => this.gold(a).v));
    return this.panel("Aperçu des personnages", "fa-chart-simple", `<div class="pg-pcs">${L.map(a => { const lv = Number(a.system.level) || 0; const xp = Number(a.system.xp) || 0; const need = Number(a.system.xpNeeded) || 0; const rk = rankOf(cfg, a.system.rank); const g = this.gold(a); const on2 = game.users.some(u => u.active && !u.isGM && a.testUserPermission(u, "OWNER"));
      return `<div class="pg-pc" style="--lc:${levelColor(lv)};--rc:${esc(rk?.color || "#9fb0d4")}"><img src="${esc(a.img)}"><div class="id"><b>${esc(a.name)}</b><small><i class="fa-solid fa-circle ${on2 ? "on" : ""}"></i>${on2 ? "Connecté" : "Hors ligne"}</small></div><span class="rk">${esc(rk?.name || "—")}</span>
        <div class="m"><small>Niveau <b>${lv}</b></small><span class="tr"><i style="width:${(lv / mxLv * 100).toFixed(1)}%;background:var(--lc)"></i></span></div>
        <div class="m"><small>XP <b>${short(xp)} / ${short(need)}</b></small><span class="tr"><i style="width:${need ? Math.min(100, xp / need * 100).toFixed(1) : 0}%;background:#38a8ff"></i></span></div>
        <div class="m"><small>${esc(g.r?.name || "Gold")} <b>${short(g.v)}</b></small><span class="tr"><i style="width:${(g.v / mxG * 100).toFixed(1)}%;background:#ffc63d"></i></span></div></div>`; }).join("")}</div>`, { hint: "Barre de niveau à l'échelle du plus haut niveau, XP vers le niveau suivant, rang et fortune." }); }
  /* ── Joueurs et groupes ── */
  #people() {
    const chars = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner); const P = (game.settings.get(SYS, "parties")?.list || []);
    const card = (g, mem) => { const extra = mem.map(u => fromUuidSync(u)).filter(a => a && !chars.includes(a));
      return `<div class="hb-pg" data-kind="party" data-id="${esc(g.id)}" style="--gc:${esc(g.color || "#7cc4ff")}"><header><input type="color" data-pf="color" value="${esc(g.color || "#7cc4ff")}"><i class="fa-solid fa-flag"></i><input data-pf="name" value="${esc(g.name)}"><small>${mem.length} perso${mem.length > 1 ? "s" : ""}</small><a class="hb-b sm" style="--bc:#5ee0ff" data-t="padd" data-tooltip="Ajouter d'autres personnages (PNJ…) par dossier"><i class="fa-solid fa-folder-tree"></i> Ajouter</a><a class="hb-x" data-t="pdel" data-tooltip="Supprimer"><i class="fa-solid fa-trash"></i></a></header>
      <div class="hb-mem">${[...chars, ...extra].map(a => `<label class="hb-chip${mem.includes(a.uuid) ? " on" : ""}"><input type="checkbox" data-pm="${a.uuid}"${mem.includes(a.uuid) ? " checked" : ""}><img src="${esc(a.img)}"><span>${esc(a.name)}</span></label>`).join("")}</div></div>`; };
    return this.#pcChart()
      + this.panel("Groupes d'aventure", "fa-flag", `<div class="pg-acts"><a class="pg-add" data-t="pnew"><i class="fa-solid fa-plus"></i> Groupe d'aventure</a></div><div class="hb-pcols">${P.map(p => card(p, (p.members || []).map(m => m.uuid))).join("") || `<p class="pg-hint">Aucun groupe d'aventure.</p>`}</div>`, { hint: "Menu › Groupe : XP et or partagés, récompenses, encadré de groupe.", c: "#3ddc84" })
      + this.panel("Groupes MJ", "fa-crown", `<div class="pg-acts"><a class="pg-add" data-t="ggnew"><i class="fa-solid fa-plus"></i> Groupe MJ</a><a class="pg-add" data-t="ggcopy" data-tooltip="Créer un groupe MJ pour chaque groupe d'aventure absent"><i class="fa-solid fa-copy"></i> Depuis les groupes d'aventure</a></div><div class="hb-pcols ms-gg-list">${gmGroupCards() || `<p class="pg-hint">Aucun groupe MJ.</p>`}</div>`, { hint: "Une seule liste pour toute la suite : Boutique, Signal, Horlogia, Portraits, Scénarios.", c: "#ffc63d" });
  }
  _replaceHTML(html, c) {
    /* 1.45 : garde la position de défilement (fenêtre et zones qui défilent) quand on reste dans la même catégorie */
    const same = this._lastCat === this.cat && this._lastQ === this.q; this._lastCat = this.cat; this._lastQ = this.q; const keep = [];
    if (same) { const win = this.element; for (const el of [win, c, ...c.querySelectorAll("*")]) if (el && el.scrollTop > 0) keep.push([el === win ? "W" : el === c ? "C" : keyOf(c, el), el.scrollTop]); }
    const had = document.activeElement?.closest?.(".hb-q"); c.innerHTML = html;
    if (keep.length) { const restore = () => { for (const [k, top] of keep) { const el = k === "W" ? this.element : k === "C" ? c : findKey(c, k); if (el) el.scrollTop = top; } }; restore(); requestAnimationFrame(restore); }
    const inp = c.querySelector(".hb-q input"); inp.addEventListener("input", foundry.utils.debounce(() => { this.q = inp.value; this.render(); }, 160)); if (had) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    if (c.dataset.hbBound) return; c.dataset.hbBound = "1";
    c.addEventListener("click", async ev => { const ns = ev.target.closest('[data-act="nstep"]'); if (ns) { const i = ns.parentElement.querySelector("input"); i.value = Math.max(Number(i.min) || 1, Math.min(Number(i.max) || 999, (Number(i.value) || 0) + Number(ns.dataset.d))); return; }
      const a = ev.target.closest("[data-k], [data-cat], [data-t]"); if (!a) return; ev.preventDefault();
      if (a.dataset.cat) { this.cat = a.dataset.cat; this.q = ""; return this.render(); }
      if (a.dataset.k) { const x = (this._E || this.entries()).find(e => e.key === a.dataset.k); try { await x?.run?.(); } catch (e) { console.error(SYS, e); ui.notifications.error(`Impossible d'ouvrir : ${e.message}`); } return; }
      try { await this.#act(a); } catch (e) { console.error(SYS, e); ui.notifications.error(e.message); } });
    c.addEventListener("change", ev => { if (ev.target.closest("[data-gg]")) return; this.#change(ev.target); });
    bindGmGroupCards(c, () => this.render());
  }
  async #act(a) {
    const t = a.dataset.t; const H = globalThis.HORLOGIA;
    if (t === "play") { await H?.setPlay(!H.state().play); return setTimeout(() => this.render(), 300); }
    if (t === "combat") return H?.combat.toggle();
    if (t === "open") return H?.open("groups");
    if (t === "adv") { const S = H.state(); const g = S.groups.find(x => x.id === a.dataset.g); const n = H.now(g.id); const D = (n.cal.hpd || 24) * (n.cal.mph || 60) * (n.cal.spm || 60); const v = a.dataset.v === "d" ? D : a.dataset.v === "w" ? D * (n.cal.weekdays.length || 7) : +a.dataset.v; await H.advance(g.id, v); return setTimeout(() => this.render(), 300); }
    if (t === "days") { const n = Math.max(1, Math.min(60, +this.element.querySelector("[data-dn]")?.value || 1)); const want = k => this.element.querySelector(`[data-dk="${k}"]`)?.checked; const done = []; const cat = api("last-horizon-catalogue"), gac = api("gacha-manhwa");
      if (want("signal") && cat?.signalNextDay) { for (let i = 0; i < n; i++) await cat.signalNextDay(); done.push("Signal Quotidien"); }
      if (want("promo") && cat?.promoTick) { await cat.promoTick(n); done.push("offres limitées"); }
      if (want("restock") && cat?.restockAll) { await cat.restockAll(); done.push("réassort"); }
      if (want("stellar") && gac?.resetLimits) { await gac.resetLimits(); done.push("limites de la Boutique stellaire"); }
      if (!done.length) return ui.notifications.warn("Coche au moins un module.");
      const txt = `${n} jour${n > 1 ? "s" : ""} passé${n > 1 ? "s" : ""} : ${done.join(", ")}.`; await game.settings.set(SYS, "dayLog", { list: [{ t: Date.now(), txt }, ...(game.settings.get(SYS, "dayLog")?.list || [])].slice(0, 50) }); ui.notifications.info(txt); return this.render(); }
    const box = a.closest("[data-kind]");
    if (t === "pnew") { const id = foundry.utils.randomID(10); const color = ["#38e0ff", "#3ddc84", "#ffc63d", "#ff5d6c", "#c084fc", "#ff9a3d"][Math.floor(Math.random() * 6)];
      const { editList } = await import("./world.js"); await editList("parties", l => { l.push({ id, name: "Nouveau groupe", color, leader: "", members: [] }); }); return this.render(); }
    if (t === "padd" && box) { const { pickByFolders } = await import("./folderpick.js"); const P = (game.settings.get(SYS, "parties")?.list || []).find(x => x.id === box.dataset.id); const have = new Set((P?.members || []).map(m => m.uuid));
      const uu = await pickByFolders({ title: `Ajouter au groupe « ${P?.name || ""} »`, type: "Actor", filter: a => ["character", "npc"].includes(a.type) && !a.getFlag?.(SYS, "gmPhone") && !have.has(a.uuid), hint: "Personnages et PNJ, rangés par dossier. Les PNJ d'un groupe ne reçoivent pas de récompense." });
      if (!uu.length) return; const { editList } = await import("./world.js"); await editList("parties", l => { const p = l.find(x => x.id === box.dataset.id); if (!p) return false; for (const u of uu) if (!p.members.some(m => m.uuid === u)) p.members.push({ uuid: u, xp: 0, gold: 0 }); }); return this.render(); }
    if (t === "ggnew") { await createGmGroup({}); return this.render(); }
    if (t === "ggcopy") { const P = game.settings.get(SYS, "parties")?.list || []; await editGmGroups(l => { for (const p of P) if (!l.some(g => g.name === p.name)) l.push({ id: foundry.utils.randomID(10), name: p.name, color: p.color || "#7cc4ff", icon: "fa-people-group", users: [], actors: (p.members || []).map(m => m.uuid) }); }); return this.render(); }
    if (t === "pdel" && box) { if (!await foundry.applications.api.DialogV2.confirm({ window: { title: "Supprimer le groupe" }, content: "<p>Supprimer ce groupe d'aventure ?</p>", classes: ["ms-dialog"] })) return;
      const { editList } = await import("./world.js"); await editList("parties", l => { const i = l.findIndex(x => x.id === box.dataset.id); if (i < 0) return false; l.splice(i, 1); }); return this.render(); }
  }
  async #change(el) {
    const box = el.closest('[data-kind="party"]'); if (!box) return; const id = box.dataset.id; const { editList } = await import("./world.js");
    if (el.dataset.pf) { const f = el.dataset.pf, v = el.value.trim(); if (!v) return; await editList("parties", l => { const p = l.find(x => x.id === id); if (!p) return false; p[f] = v; }); return; }
    if (el.dataset.pm) { const u = el.dataset.pm, onn = el.checked; el.closest(".hb-chip")?.classList.toggle("on", onn);
      await editList("parties", l => { const p = l.find(x => x.id === id); if (!p) return false; if (onn) { if (!p.members.some(m => m.uuid === u)) p.members.push({ uuid: u, xp: 0, gold: 0 }); } else p.members = p.members.filter(m => m.uuid !== u); }); }
  }
}
/* fenêtre des réglages de Foundry, ouverte sur l'onglet du module */
async function openSettingsFor(id) {
  const SC = foundry.applications.settings?.SettingsConfig ?? globalThis.SettingsConfig; const app = new SC(); await app.render({ force: true });
  setTimeout(() => { try { app.changeTab?.(id === SYS ? "system" : id, "categories"); } catch (e) {} const el = app.element?.querySelector?.(`[data-tab="${id === SYS ? "system" : id}"]`); if (el && !el.classList.contains("active")) el.click?.(); }, 120);
}

Hooks.once("init", () => {
  game.settings.register(SYS, "dayLog", { scope: "world", config: false, type: Object, default: { list: [] } });
  game.settings.registerMenu(SYS, "gmHub", { name: "Centre du MJ", label: "Ouvrir", hint: "Tous les réglages de la suite Manhwa (fiche, Menu, saison, téléphone, gacha, Catalogue, véhicules, sidebar…) au même endroit.", icon: "fa-solid fa-crown", type: GmHub, restricted: true });
  game.keybindings?.register(SYS, "gmHub", { name: "Ouvrir le Centre du MJ", editable: [], restricted: true, onDown: () => { GmHub.open(); return true; } });
});
Hooks.on("getSceneControlButtons", controls => {
  if (!game.user.isGM) return; const tool = { name: "msGmHub", title: "Centre du MJ (réglages de la suite)", icon: "fa-solid fa-crown", button: true, visible: true, order: 99, onChange: () => GmHub.open(), onClick: () => GmHub.open() };
  if (Array.isArray(controls)) controls.find(c => c.name === "token")?.tools?.push(tool); else { const t = controls.tokens || controls.token; if (t?.tools) t.tools.msGmHub = tool; }
});
/* le Centre suit l'horloge et les groupes (sans couper une saisie) */
const hubRefresh = cats => { const a = foundry.applications.instances.get("ms-gmhub"); if (!a?.rendered || !cats.includes(a.cat) || a.q) return; const f = document.activeElement; if (f && a.element.contains(f) && /INPUT|SELECT|TEXTAREA/.test(f.tagName) && f.type !== "checkbox") return; a.render(); };
Hooks.on("horlogiaChange", () => hubRefresh(["time"]));
Hooks.on("updateSetting", s => { if ([`${SYS}.parties`, `${SYS}.gmGroups`].includes(s.key)) hubRefresh(["people"]); if (s.key === `${SYS}.dayLog`) hubRefresh(["time"]); });
Hooks.once("ready", () => setInterval(() => hubRefresh(["time"]), 20000));
