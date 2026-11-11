/* Manhwa Sheet 1.58 — AFFICHAGE D'UNE FICHE (bouton œil, MJ) : même D.A que le Centre du MJ.
 * Rail de catégories à gauche (Onglets, En-tête, Jauges, Monnaies & inventaire, Menu, Style), bandeau avec compteur,
 * tuiles à bascule, « Tout afficher / Tout masquer » par catégorie. Enregistre les drapeaux display, menuHide (fiche et joueurs),
 * sheetTheme et menuBtnTier. La clé « gauges » (toutes les jauges) n'existe plus : une tuile par jauge. */
import { SYS, esc, getConfig, THEMES } from "./config.js";
import { menuCfg } from "./world.js";
import { MENU_BTN_TIERS } from "./sheet-character.js";
const { ApplicationV2 } = foundry.applications.api;

const CATS = [
  { k: "tabs", n: "Onglets", s: "Ce que la fiche propose", i: "fa-folder-tree", c: "#38a8ff" },
  { k: "head", n: "En-tête", s: "Niveau, XP, éveil, titre…", i: "fa-id-badge", c: "#b46bff" },
  { k: "gauges", n: "Jauges", s: "Les jauges de ce monde", i: "fa-heart-pulse", c: "#ff5d6c" },
  { k: "inv", n: "Monnaies & inventaire", s: "Chaque monnaie, sac, places, accès rapide", i: "fa-coins", c: "#ffc63d" },
  { k: "menu", n: "Menu", s: "Icônes du Menu", i: "fa-bars", c: "#3ddc84" },
  { k: "style", n: "Style", s: "Thème et bouton MENU", i: "fa-palette", c: "#ff9ad5" }
];
const ELEMS = {
  tabs: [["background", "Background", "fa-book-open", "Le livre du personnage, en premier"], ["stats", "Statistiques", "fa-chart-simple", "Stats, points, jets"], ["identity", "Identité", "fa-id-card", "Infos personnelles, physique, famille…"], ["items", "Onglets d'objets", "fa-box-open", "Une catégorie d'objets par onglet"], ["equipped", "Équipé", "fa-user-shield", "Ce que le personnage porte sur lui"]],
  head: [["lv", "Niveau", "fa-angles-up", "Pastille du niveau"], ["xp", "Barre d'expérience", "fa-arrow-trend-up", "XP vers le niveau suivant"], ["aw", "Éveil", "fa-sun", "Stade d'éveil"], ["sp", "Constellation", "fa-star", "Constellation qui parraine"], ["or", "Origine", "fa-earth-asia", "Origine du personnage"], ["cl", "Classe & sous-classe", "fa-graduation-cap", "Pastilles de classe"], ["ti", "Titre", "fa-crown", "Titre(s) équipé(s)"], ["menu", "Bouton MENU", "fa-bars", "Accès au Menu du joueur"]],
  inv: [["bag", "Sac", "fa-sack-dollar", "Sac(s) équipé(s)"], ["slots", "Places", "fa-boxes-stacked", "Places d'équipement occupées"], ["qa", "Accès rapide", "fa-bolt", "Objets épinglés, récents, équipés"]]
};
const ico = i => /^fa-/.test(String(i || "")) ? i : "fa-circle";

export class SheetDisplayApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = { classes: ["ms-sheet", "ms-progapp", "ms-dispapp"], position: { width: 980, height: 660 }, window: { resizable: true, icon: "fa-solid fa-eye" } };
  static open(actor) { const id = `ms-disp-${actor.id}`; const ex = foundry.applications.instances.get(id); if (ex) { ex.bringToFront(); return ex; } const a = new SheetDisplayApp({ id, actor }); a.render(true); return a; }
  constructor(opts) { super(opts); const a = this.actor = opts.actor; const disp = a.getFlag(SYS, "display") || {};
    this.cat = "tabs"; this.dirty = false;
    this.d = {}; for (const [k, v] of Object.entries(disp)) if (v === false && k !== "gauges") this.d[k] = false;
    this.first = disp.firstTab === "stats" ? "stats" : "background";
    if (disp.gauges === false) for (const g of getConfig().gauges || []) this.d[`g:${g.key}`] = false;
    if (disp.res === false) { delete this.d.res; for (const r of getConfig().resources || []) this.d[`r:${r.key}`] = false; }   /* ancien « Monnaies (toutes) » */   /* ancien « Jauges (toutes) » */
    this.hideA = new Set(a.getFlag(SYS, "menuHide") || []);
    this.owners = game.users.filter(u => !u.isGM && a.testUserPermission(u, "OWNER"));
    this.hideU = Object.fromEntries(this.owners.map(u => [u.id, new Set(u.getFlag(SYS, "menuHide") || [])]));
    this.theme = a.getFlag(SYS, "sheetTheme") || ""; this.mbt = Number(a.getFlag(SYS, "menuBtnTier")) || 0; }
  get title() { return `Affichage — ${this.actor.name}`; }
  /* éléments à bascule d'une catégorie : [clé d'état, libellé, icône, aide, couleur] */
  items(k) {
    if (k === "inv") return [...(getConfig().resources || []).filter(r => r.inHeader).map(r => [`d|r:${r.key}`, r.name, ico(r.icon), "Monnaie de l'en-tête", r.color]), ...(ELEMS.inv || []).map(([key, n, i, h]) => [`d|${key}`, n, i, h])];
    if (k === "gauges") return (getConfig().gauges || []).map(g => [`d|g:${g.key}`, g.name, ico(g.icon), g.abbr ? `Abrégée « ${g.abbr} »` : "Jauge", g.color]);
    if (k === "menu") { const tabs = (menuCfg().tabs || []).filter(t => t.on); return [...tabs.map(t => [`m|${t.key}`, t.name, ico(t.icon), "Cette fiche", t.color]), ...this.owners.flatMap(u => tabs.map(t => [`u|${u.id}|${t.key}`, t.name, ico(t.icon), u.name, t.color]))]; }
    return (ELEMS[k] || []).map(([key, n, i, h]) => [`d|${key}`, n, i, h]);
  }
  isOn(id) { const [kind, a, b] = id.split("|"); if (kind === "d") return this.d[a] !== false; if (kind === "m") return !this.hideA.has(a); if (kind === "u") return !this.hideU[a]?.has(b); return true; }
  setOn(id, on) { const [kind, a, b] = id.split("|"); if (kind === "d") { if (on) delete this.d[a]; else this.d[a] = false; } else if (kind === "m") on ? this.hideA.delete(a) : this.hideA.add(a); else if (kind === "u") on ? this.hideU[a]?.delete(b) : this.hideU[a]?.add(b); this.dirty = true; }
  count(k) { const L = this.items(k); return [L.filter(x => this.isOn(x[0])).length, L.length]; }
  chip(l, v, c) { return `<span class="pg-chip"${c ? ` style="--cc:${c}"` : ""}><small>${l}</small><b>${v}</b></span>`; }
  panel(t, ic, body, { hint = "", c = "" } = {}) { return `<section class="pg-panel"${c ? ` style="--pc:${c}"` : ""}><header><i class="fa-solid ${ic}"></i><b>${t}</b></header>${hint ? `<p class="pg-hint">${hint}</p>` : ""}${body}</section>`; }
  tile([id, n, i, h, c]) { return `<label class="pg-tile pg-ck"${c ? ` style="--pc:${esc(c)}"` : ""}><input type="checkbox" data-el="${esc(id)}"${this.isOn(id) ? " checked" : ""}><i class="fa-solid ${esc(i)}"></i><b>${esc(n)}</b><small>${esc(h || "")}</small></label>`; }
  themes() { const out = {}; const p = document.createElement("div"); p.className = "ms-sheet"; p.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0;height:0"; document.body.append(p);
    try { for (const k of ["", ...Object.keys(THEMES)]) { if (k) p.dataset.msTheme = k; else delete p.dataset.msTheme; const cs = getComputedStyle(p); const v = n => cs.getPropertyValue(n).trim(); out[k] = { bg: v("--ms-bg") || "#060a18", pn: v("--ms-panel") || "#0e1736", a: v("--ms-acc") || "#38a8ff", a2: v("--ms-acc2") || "#b46bff", tx: v("--ms-tx") || "#e6eeff", bd: v("--ms-bd2") || v("--ms-bd") || "#22325f" }; } }
    finally { p.remove(); } return out; }
  async _renderHTML() {
    const C = CATS.find(c => c.k === this.cat) || CATS[0];
    const cnt = k => { if (k === "style") return ""; const [o, t] = this.count(k); return t ? `${o}/${t}` : ""; };
    const nav = CATS.map(c => `<a data-cat="${c.k}" class="${c.k === C.k ? "on" : ""}" style="--pc:${c.c}"><i class="fa-solid ${c.i}"></i><span><b>${c.n}</b><small>${c.s}</small></span>${cnt(c.k) ? `<em class="pg-cnt" data-cnt="${c.k}">${cnt(c.k)}</em>` : ""}</a>`).join("");
    let sum = "", acts = "", body = "";
    if (C.k === "style") {
      const T = this.themes(); const sw = k => { const t = T[k] || T[""]; return `<span class="sd-sw" style="--bg:${t.bg};--pn:${t.pn};--a:${t.a};--a2:${t.a2};--tx:${t.tx};--bd:${t.bd}"><em></em><em></em><u>Aa</u></span>`; };
      const th = [["", "Automatique", "Thème du monde"], ...Object.entries(THEMES).map(([k, n]) => [k, n.split(/\s[—(]/)[0], (n.match(/[—(]\s*([^)]*)\)?$/) || [])[1] || ""])];
      sum = this.chip("Thème", esc(this.theme ? THEMES[this.theme]?.split(/\s[—(]/)[0] || this.theme : "Automatique")) + this.chip("Bouton MENU", this.mbt ? `Palier ${this.mbt}` : "Auto");
      body = this.panel("Thème de cette fiche", "fa-palette", `<div class="pg-tiles sd-themes">${th.map(([k, n, h]) => `<label class="pg-tile pg-ck sd-th"><input type="radio" name="sd-theme" value="${esc(k)}"${this.theme === k ? " checked" : ""}>${sw(k)}<b>${esc(n)}</b><small>${esc(h)}</small></label>`).join("")}</div>`, { hint: "Change l'habit de cette fiche seulement. Automatique : le thème choisi pour tout le monde." })
        + this.panel("Bouton MENU de cette fiche", "fa-wand-magic-sparkles", `<div class="pg-tiles sd-mbts">${MENU_BTN_TIERS.map((n, i) => `<label class="pg-tile pg-ck sd-mb"><input type="radio" name="sd-mbt" value="${i}"${this.mbt === i ? " checked" : ""}><span class="sd-mbp">${i ? `<span class="ms-menu-btn mbt mb-t${i}"><i class="fa-solid fa-bars"></i><span>MENU</span>${i >= 5 ? `<em class="sp"></em><em class="sp s2"></em><em class="sp s3"></em>` : ""}</span>` : `<i class="fa-solid fa-arrows-rotate"></i>`}</span><b>${esc(n.split(" — ")[0])}</b><small>${esc(n.split(" — ")[1] || "1-9, 10-29, 30-59, 60-99, 100+")}</small></label>`).join("")}</div>`, { hint: "Automatique : le bouton monte de palier avec le niveau du personnage." });
    } else {
      const [o, t] = this.count(C.k);
      sum = `<span data-sum>${this.chip("Visibles", `${o} / ${t}`, o === t ? "#3ddc84" : o ? "#ffc63d" : "#ff5d6c")}</span>`;
      acts = t ? `<div class="sd-acts"><a class="pg-add" data-all="1"><i class="fa-solid fa-eye"></i> Tout afficher</a><a class="pg-add" data-all="0"><i class="fa-solid fa-eye-slash"></i> Tout masquer</a></div>` : "";
      const L = this.items(C.k);
      if (C.k === "menu") { const tabs = L.filter(x => x[0].startsWith("m|"));
        body = this.panel("Icônes du Menu pour cette fiche", "fa-id-card", `<div class="pg-tiles">${tabs.map(x => this.tile(x)).join("") || `<p class="pg-hint">Aucun onglet actif dans le Menu.</p>`}</div>`, { hint: "Masquées pour les joueurs quand ils ouvrent le Menu depuis cette fiche. Le MJ garde l'accès à tout." })
          + this.owners.map(u => this.panel(`Pour le joueur ${esc(u.name)} <small class="sd-sm">toutes ses fiches</small>`, "fa-user", `<div class="pg-tiles">${L.filter(x => x[0].startsWith(`u|${u.id}|`)).map(x => this.tile(x)).join("")}</div>`, { c: (u.color?.css ?? String(u.color || "")) || "" })).join(""); }
      else if (C.k === "gauges") body = this.panel("Jauges affichées", "fa-heart-pulse", L.length ? `<div class="pg-tiles">${L.map(x => this.tile(x)).join("")}</div>` : `<p class="pg-hint">Aucune jauge dans la configuration de ce monde.</p>`, { hint: "Seulement les jauges de ce monde, chacune avec sa couleur." });
      else body = (C.k === "tabs" ? this.panel("Onglet en premier", "fa-arrow-up-1-9", `<div class="pg-tiles">${[["background", "Background en premier", "fa-book-open", "Le livre ouvre la fiche, puis Statistiques"], ["stats", "Statistiques en premier", "fa-chart-simple", "Les stats ouvrent la fiche, puis Background"]].map(([k, n, i, h]) => `<label class="pg-tile pg-ck"><input type="radio" name="sd-first" value="${k}"${this.first === k ? " checked" : ""}><i class="fa-solid ${i}"></i><b>${n}</b><small>${h}</small></label>`).join("")}</div>`, { hint: "Ordre des premiers onglets et onglet affiché à l'ouverture de la fiche." }) : "") + this.panel(C.n, C.i, `<div class="pg-tiles">${L.map(x => this.tile(x)).join("")}</div>`, { hint: C.k === "tabs" ? "Un onglet masqué disparaît de la barre d'onglets pour tout le monde." : C.k === "inv" ? "Chaque monnaie de l'en-tête se masque à part. « Accès rapide » : la barre d'objets épinglés en haut de la fiche." : "Masqué pour tout le monde sur cette fiche." });
    }
    return `<div class="pg-root" style="--pc:${C.c}"><nav class="pg-rail"><div class="pg-brand"><i class="fa-solid fa-eye"></i><b>AFFICHAGE</b><small>${esc(this.actor.name.toUpperCase())}</small></div>${nav}</nav>
      <section class="pg-body"><header class="pg-band"><i class="fa-solid ${C.i}"></i><div><small>${esc(C.s)}</small><h2>${esc(C.n)}</h2></div><div class="pg-sum">${sum}</div>${acts}</header><div class="pg-page">${body}</div></section>
      <footer class="pg-foot sd-foot"><span class="${this.dirty ? "dirty" : ""}">${this.dirty ? "● Modifications non enregistrées" : "✓ À jour"}</span><span class="grow"></span><button type="button" data-sd="cancel"><i class="fa-solid fa-xmark"></i> Fermer</button><button type="button" data-sd="save" class="primary"><i class="fa-solid fa-check"></i> Enregistrer</button></footer></div>`;
  }
  _replaceHTML(r, el) { el.innerHTML = r; }
  _onFirstRender() {
    const el = this.element;
    el.addEventListener("click", ev => {
      const c = ev.target.closest(".pg-rail a[data-cat]"); if (c) { this.cat = c.dataset.cat; this.render(); return; }
      const all = ev.target.closest("[data-all]"); if (all) { for (const x of this.items(this.cat)) this.setOn(x[0], all.dataset.all === "1"); this.render(); return; }
      const b = ev.target.closest("[data-sd]"); if (b) { if (b.dataset.sd === "save") this.save(); else this.close(); }
    });
    el.addEventListener("change", ev => { const t = ev.target;
      if (t.dataset.el) this.setOn(t.dataset.el, t.checked);
      else if (t.name === "sd-theme") { this.theme = t.value; this.dirty = true; }
      else if (t.name === "sd-mbt") { this.mbt = Number(t.value) || 0; this.dirty = true; }
      else if (t.name === "sd-first") { this.first = t.value; this.dirty = true; }
      else return;
      this.live(); });
  }
  /* compteurs et pied mis à jour sans tout redessiner */
  live() { const el = this.element; for (const c of CATS) { const e = el.querySelector(`[data-cnt="${c.k}"]`); if (e) { const [o, t] = this.count(c.k); e.textContent = `${o}/${t}`; } }
    const s = el.querySelector("[data-sum]"); if (s) { const [o, t] = this.count(this.cat); s.innerHTML = this.chip("Visibles", `${o} / ${t}`, o === t ? "#3ddc84" : o ? "#ffc63d" : "#ff5d6c"); }
    const f = el.querySelector(".sd-foot > span"); if (f) { f.className = "dirty"; f.textContent = "● Modifications non enregistrées"; } }
  async save() { const a = this.actor;
    await a.update({ [`flags.${SYS}.-=display`]: null });
    await a.update({ [`flags.${SYS}.display`]: { ...this.d, ...(this.first === "stats" ? { firstTab: "stats" } : {}) }, [`flags.${SYS}.menuHide`]: [...this.hideA], [`flags.${SYS}.sheetTheme`]: this.theme, [`flags.${SYS}.menuBtnTier`]: this.mbt });
    for (const u of this.owners) await u.setFlag(SYS, "menuHide", [...(this.hideU[u.id] || [])]);
    this.dirty = false; ui.notifications.info(`Affichage de ${a.name} enregistré.`); this.close(); }
}
