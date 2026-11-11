/* Manhwa Sheet — CLASSES (inspirées de Log Horizon) : 12 classes de base en 4 rôles, évolutions (rang 2) et classes ultimes (rang 3),
 * plus les SOUS-CLASSES (artisanat, rôle, réservées aux natifs, titres spéciaux). Identité seulement : nom, rôle, icône, description, arbre.
 * Données par défaut : data/classes.json et data/subclasses.json ; le MJ peut tout modifier (réglage monde « classDefs »).
 * Personnage : drapeaux manhwa-sheet.cls (id de la classe actuelle) et manhwa-sheet.sub (id de la sous-classe). Hook « manhwaClasses ». */
import { moreChip } from "./morepop.js";
import { SYS, esc } from "./config.js";
import { uid } from "./world.js";
import { revealed, revealTools, toggleReveal } from "./wiki.js";
const { DialogV2, ApplicationV2 } = foundry.applications.api;
const fa = i => `<i class="fa-solid ${esc(i || "fa-circle")}"></i>`;
let DEF = { classes: { roles: {}, tiers: {}, list: [] }, subs: { cats: {}, list: [] } };
const PERMS = { gm: "Le MJ seulement", base: "Les joueurs choisissent leur classe de base et leur sous-classe (les évolutions : MJ)", all: "Les joueurs choisissent (classes de base, puis les évolutions des classes qu'ils possèdent, et les sous-classes)" };

async function loadDefaults() {
  for (const [k, f] of [["classes", "classes.json"], ["subs", "subclasses.json"]]) { try { const r = await fetch(`systems/${SYS}/data/${f}`); if (r.ok) DEF[k] = await r.json(); } catch (e) { console.warn(SYS, "classes : lecture", f, e); } }
}
const cfg = () => { let c = {}; try { c = game.settings.get(SYS, "classDefs") || {}; } catch (e) {} return c; };
export const classData = () => cfg().classes || DEF.classes;
export const subData = () => cfg().subs || DEF.subs;
export const classPerm = () => cfg().perm || "all";
export const classById = id => classData().list.find(c => c.id === id) || null;
export const subById = id => subData().list.find(c => c.id === id) || null;
export const roleOf = c => classData().roles?.[c?.role] || { name: "", color: "#8ea0c8", icon: "fa-circle" };
/* 1.58 : identité de couleur — chaque lignée (classe de base et ses évolutions) a sa nuance autour de la couleur de son rôle ;
 * chaque sous-classe a une nuance plus claire de la couleur de sa catégorie */
function tone(hex, dh = 0, dl = 0) { const m = String(hex || "").match(/^#?([0-9a-f]{6})$/i); if (!m) return hex || "#5ee0ff"; const n = parseInt(m[1], 16); const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return `hsl(${Math.round((h + dh + 360) % 360)} ${Math.round(Math.max(45, s * 100))}% ${Math.round(Math.min(78, Math.max(42, l * 100 + dl)))}%)`; }
export function classTone(c) { if (!c) return "#8ea0c8"; const base = classPath(c.id)[0] || c; const roots = classData().list.filter(x => x.role === base.role && !x.parent); const i = Math.max(0, roots.findIndex(x => x.id === base.id)); const n = roots.length;
  return tone(roleOf(c).color, n > 1 ? -26 + 52 * i / (n - 1) : 0, 0); }
export function subTone(s) { if (!s) return "#8ea0c8"; const S = subData(); const L = S.list.filter(x => x.cat === s.cat); const i = Math.max(0, L.findIndex(x => x.id === s.id)); const n = L.length;
  return tone(S.cats?.[s.cat]?.color || "#5ee0ff", n > 1 ? -18 + 36 * i / (n - 1) : 0, 6 + (i % 3) * 4); }
/** chemin de la classe de base jusqu'à la classe actuelle */
export function classPath(id) { const out = []; let c = classById(id); let n = 0; while (c && n++ < 10) { out.unshift(c); c = c.parent ? classById(c.parent) : null; } return out; }
export const childrenOf = id => classData().list.filter(c => (c.parent || "") === (id || ""));
export const actorClass = a => classById(a?.getFlag?.(SYS, "cls")); export const actorSub = a => subById(a?.getFlag?.(SYS, "sub"));
async function saveDefs(patch) { if (!game.user.isGM) return; const c = { ...cfg(), ...patch }; await game.settings.set(SYS, "classDefs", c); }

/* ── 1.36 : plusieurs classes et sous-classes par personnage (comme les titres), une FAVORITE affichée sur la fiche ──
 * drapeaux : cls / sub = la favorite ; clsAll / subAll = toutes celles possédées. */
const flagKeys = kind => kind === "sub" ? ["sub", "subAll"] : ["cls", "clsAll"];
export function ownedIds(actor, kind = "cls") { const [f, all] = flagKeys(kind); const byId = kind === "sub" ? subById : classById; const fav = actor?.getFlag?.(SYS, f);
  return [...new Set([fav, ...(actor?.getFlag?.(SYS, all) || [])].filter(id => id && byId(id)))]; }
export async function setOwned(actor, kind, ids, fav) { const [f, all] = flagKeys(kind); ids = [...new Set(ids)]; if (!ids.includes(fav)) fav = ids[0] || null;
  await actor.update({ [`flags.${SYS}.${all}`]: ids, [`flags.${SYS}.${f}`]: fav }); }

/* ── cadres de l'en-tête de la fiche : la favorite, puis « +N » (la liste des autres au survol) ── */
export function classChips(actor, editable) {
  const c = actorClass(actor), s = actorSub(actor); const r = roleOf(c); const T = classData().tiers || {};
  const sc = subData().cats?.[s?.cat] || {};
  const more = (kind, favId) => { const o = ownedIds(actor, kind).filter(id => id !== favId); if (!o.length) return ""; const byId = kind === "sub" ? subById : classById;
    return moreChip(o.map(byId).filter(Boolean).map(x => ({ n: x.name, icon: x.icon || (kind === "sub" ? "fa-briefcase" : "fa-graduation-cap"), c: kind === "sub" ? subTone(x) : classTone(x), s: kind === "sub" ? subData().cats?.[x.cat]?.name || "" : roleOf(x).name || "" })), kind === "sub" ? "Autres sous-classes" : "Autres classes"); };
  return `<div class="ms-chip cl anim${editable ? " pick" : ""}" style="--c:${esc(c ? classTone(c) : "#8ea0c8")}" ${editable ? 'data-action="pickClass"' : ""} title="${c ? esc(`${classPath(c.id).map(x => x.name).join(" › ")} — ${c.desc || ""}`) : "Aucune classe"}">${fa(c?.icon || "fa-graduation-cap")}<span>Classe</span><b>${c ? `${esc(c.name)}${c.tier > 1 ? `<small class="tier t${c.tier}">${esc(T[c.tier] || "")}</small>` : ""}` : "<em>aucune</em>"}</b>${more("cls", c?.id)}</div>
    <div class="ms-chip scl anim${editable ? " pick" : ""}" style="--c:${esc(s ? subTone(s) : "#8ea0c8")}" ${editable ? 'data-action="pickSub"' : ""} title="${s ? esc(`${s.name} — ${s.desc || ""}`) : "Aucune sous-classe"}">${fa(s?.icon || "fa-briefcase")}<span>Sous-classe</span><b>${s ? esc(s.name) : "<em>aucune</em>"}</b>${more("sub", s?.id)}</div>`;
}
/* ce que l'utilisateur a le droit d'ajouter : le MJ tout ; le joueur choisit (classe de base, puis une évolution d'une classe qu'il possède) */
/* 1.47 : tout est verrouillé pour les joueurs ; le MJ débloque chaque classe / sous-classe à tous, à un groupe MJ ou à un joueur */
const canPick = (actor, kind, target, owned = new Set()) => { if (game.user.isGM) return true; if (!actor?.isOwner) return false; if (target && !revealed(kind, target.id)) return false; const p = classPerm(); if (p === "gm") return false;
  if (kind === "sub") return true; const t = target?.tier || 1;
  if (t === 1) return true; return p === "all" && owned.has(target?.parent); };
const dlgSize = () => ({ width: Math.min(1100, window.innerWidth - 40), height: Math.min(860, window.innerHeight - 40) });

/* fenêtre commune : cartes à cocher (posséder), étoile = favorite, recherche, grands encadrés néon par catégorie */
/* 1.46 : détail « wiki » d'une classe : description + évolution visuelle (base → évoluée → ultime, et ce qui suit) */
function wikiOf(c, isSub, D) {
  const rv = game.user.isGM ? revealTools(isSub ? "sub" : "cls", c.id) : "";
  if (!game.user.isGM && !revealed(isSub ? "sub" : "cls", c.id)) return `<div class="wk-txt wk-hidden"><i class="fa-solid fa-lock"></i> Pas encore débloquée par le MJ.</div>`;
  const txt = c.desc ? `<div class="wk-txt">${esc(c.desc)}</div>` : `<div class="wk-txt"><em>Pas encore de description.</em></div>`;
  if (isSub) { const cat = D.cats?.[c.cat] || {}; return `${txt}<div class="wk-meta">${fa(cat.icon || "fa-briefcase")} ${esc(cat.name || "")}</div>${rv}`; }
  const role = roleOf(c); const path = classPath(c.id); const kids = childrenOf(c.id); const tierN = t => esc(D.tiers?.[t] || "");
  const node = (x, cur) => `<span class="evo-n${cur ? " cur" : ""} t${x.tier}" style="--c:${esc(classTone(x))}">${fa(x.icon)}<b>${esc(x.name)}</b><small>${tierN(x.tier)}</small></span>`;
  const chain = path.map(x => node(x, x.id === c.id)).join(`<i class="evo-a fa-solid fa-chevron-right"></i>`);
  const next = kids.length ? `<div class="evo-next"><span>${fa("fa-code-branch")} Évolue ensuite en</span>${kids.map(k => `<div class="evo-row"><i class="evo-br fa-solid fa-turn-up fa-rotate-90"></i>${node(k, false)}${childrenOf(k.id).map(g => `<i class="evo-a fa-solid fa-chevron-right"></i>${node(g, false)}`).join("")}</div>`).join("")}</div>` : `<div class="evo-next end">${fa("fa-crown")} Sommet de cette lignée</div>`;
  return `${txt}<div class="wk-meta" style="--c:${esc(role.color || "#5ee0ff")}">${fa(role.icon)} ${esc(role.name || "")} · ${tierN(c.tier)}</div><div class="evo"><div class="evo-chain">${chain}</div>${next}</div>${rv}`;
}
const anyReveal = (kind, id) => { try { const r = game.settings.get(SYS, "reveals")?.[kind]?.[id]; return !!(r && (r.all || r.groups?.length || r.users?.length)); } catch (e) { return false; } };
async function pickMany(actor, kind) {
  const isSub = kind === "sub"; const D = isSub ? subData() : classData(); const byId = isSub ? subById : classById;
  const owned = new Set(ownedIds(actor, kind)); let fav = actor.getFlag(SYS, isSub ? "sub" : "cls"); if (!owned.has(fav)) fav = [...owned][0] || null;
  if (isSub && classPerm() === "gm" && !game.user.isGM) return ui.notifications.warn("Les sous-classes sont choisies par le MJ.");
  const card = c => { const cat = isSub ? (D.cats?.[c.cat] || {}) : roleOf(c); const ok = canPick(actor, kind, c, owned);
    return `<a class="mc-card${isSub ? " mc-sub" : ` t${c.tier}`}${game.user.isGM && !anyReveal(kind, c.id) ? " gm-hid" : ""}" data-id="${c.id}" data-n="${esc(`${c.name} ${c.desc || ""}`.toLowerCase())}" style="--c:${esc(isSub ? subTone(c) : classTone(c))}">${fa(c.icon)}<b>${esc(c.name)}</b><small>${isSub ? esc(c.desc || "") : esc(D.tiers?.[c.tier] || "")}</small>${isSub ? "" : `<span class="tb">${["", "I", "II", "III", "IV", "V"][c.tier] || c.tier}${c.tier >= 3 ? ' <i class="fa-solid fa-crown"></i>' : ""}</span>`}<i class="ck fa-solid fa-check"></i><span class="fav" data-fav title="Favorite (affichée sur la fiche)"><i class="fa-solid fa-star"></i></span>${ok ? "" : `<i class="lock fa-solid fa-lock"></i>`}<span class="mc-more" data-more>Détails <i class="fa-solid fa-chevron-down"></i></span><div class="mc-wiki">${wikiOf(c, isSub, D)}</div></a>`; };
  const tree = c => `<div class="mc-node t${c.tier}">${card(c)}${D.list.some(k => k.parent === c.id) ? `<div class="mc-kids">${D.list.filter(k => k.parent === c.id).map(tree).join("")}</div>` : ""}</div>`;
  const groups = isSub ? Object.entries(D.cats || {}).map(([k, g]) => ({ k, g, body: `<div class="mc-grid">${D.list.filter(x => x.cat === k).map(card).join("")}</div>` }))
    : Object.entries(D.roles || {}).map(([k, g]) => ({ k, g, body: `<div class="mc-trees">${D.list.filter(c => c.role === k && !c.parent).map(tree).join("")}</div>` }));
  const content = `<div class="mc-pick"><div class="mc-top"><div class="mc-q"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-q placeholder="Rechercher ${isSub ? "une sous-classe" : "une classe"}…"></div>
      <div class="mc-jump">${groups.map(({ k, g }) => `<a data-jump="${k}" style="--c:${esc(g.color)}">${fa(g.icon)} ${esc(g.name)}</a>`).join("")}</div>
      <p class="ms-mhint">Clique pour <b>ajouter / retirer</b> ; l'<i class="fa-solid fa-star"></i> choisit la <b>favorite</b> affichée sur la fiche (les autres apparaissent en « +N »).${game.user.isGM ? "" : isSub ? "" : " Une évolution se débloque quand tu possèdes la classe dont elle découle."}</p>
      <div class="mc-mine" data-mine></div></div>
    <div class="mc-body">${groups.map(({ k, g, body }) => `<section class="mc-sec" data-sec="${k}" style="--c:${esc(g.color)}"><header>${fa(g.icon)}<b>${esc(g.name)}</b>${g.desc ? `<small>${esc(g.desc)}</small>` : ""}</header>${body}</section>`).join("")}</div></div>`;
  const r = await DialogV2.wait({ window: { title: `${isSub ? "Sous-classes" : "Classes"} — ${actor.name}`, icon: `fa-solid ${isSub ? "fa-briefcase" : "fa-graduation-cap"}`, resizable: true }, classes: ["ms-dialog", "ms-menu-dialog", "mc-dlg"], position: dlgSize(), content, rejectClose: false,
    buttons: [{ action: "ok", label: "Enregistrer", icon: "fa-solid fa-check", default: true, callback: () => "ok" }],
    render: (ev, dlg) => { const el = dlg.element ?? dlg; const mine = el.querySelector("[data-mine]");
      const draw = () => { el.querySelectorAll(".mc-card").forEach(a => { a.classList.toggle("own", owned.has(a.dataset.id)); a.classList.toggle("isfav", a.dataset.id === fav); a.classList.toggle("no", !owned.has(a.dataset.id) && !canPick(actor, kind, byId(a.dataset.id), owned)); });
        mine.innerHTML = owned.size ? [...owned].map(id => { const c = byId(id); return `<a class="mc-own${id === fav ? " fav" : ""}" data-mfav="${id}" title="Clic : favorite">${id === fav ? '<i class="fa-solid fa-star"></i>' : ""}${esc(c?.name || "")}</a>`; }).join("") : `<span class="ms-mhint">Aucune pour l'instant.</span>`; };
      el.addEventListener("click", e => {
        const j = e.target.closest("[data-jump]"); if (j) { e.preventDefault(); el.querySelector(`[data-sec="${j.dataset.jump}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
        const mf = e.target.closest("[data-mfav]"); if (mf) { fav = mf.dataset.mfav; return draw(); }
        const rvb = e.target.closest("[data-rev]"); if (rvb) { e.preventDefault(); e.stopPropagation(); const box = rvb.closest("[data-rk]"); toggleReveal(box.dataset.rk, box.dataset.rid, rvb.dataset.rev, rvb.dataset.v).then(() => { box.outerHTML = revealTools(box.dataset.rk, box.dataset.rid); el.querySelectorAll(`.mc-card[data-id="${box.dataset.rid}"]`).forEach(cd => cd.classList.toggle("gm-hid", !anyReveal(box.dataset.rk, box.dataset.rid))); }); return; }
        const mo = e.target.closest("[data-more]"); if (mo) { e.preventDefault(); e.stopPropagation(); const cd = mo.closest(".mc-card"); const o = !cd.classList.contains("open"); cd.classList.toggle("open", o); mo.innerHTML = `${o ? "Masquer" : "Détails"} <i class="fa-solid fa-chevron-${o ? "up" : "down"}"></i>`; return; }
        if (e.target.closest(".mc-wiki")) return;
        const a = e.target.closest(".mc-card"); if (!a) return; e.preventDefault(); const id = a.dataset.id;
        if (e.target.closest("[data-fav]")) { if (!owned.has(id)) { if (!canPick(actor, kind, byId(id), owned)) return; owned.add(id); } fav = id; return draw(); }
        if (owned.has(id)) { owned.delete(id); if (!isSub) for (const c of D.list) if (!game.user.isGM && classPath(c.id).some(x => x.id === id) && c.id !== id) owned.delete(c.id); if (fav === id) fav = [...owned][0] || null; }
        else { if (!canPick(actor, kind, byId(id), owned)) return ui.notifications.warn(isSub ? "Réservé au MJ." : "Possède d'abord la classe dont elle découle (ou demande au MJ)."); owned.add(id); if (!fav) fav = id; }
        draw(); });
      el.querySelector("[data-q]").addEventListener("input", e => { const q = e.target.value.trim().toLowerCase();
        el.querySelectorAll(".mc-card").forEach(a => a.classList.toggle("hid", !!q && !a.dataset.n.includes(q)));
        el.querySelectorAll(".mc-sec").forEach(sct => { sct.hidden = !!q && !sct.querySelector(".mc-card:not(.hid)"); }); });
      draw(); setTimeout(() => { el.querySelector(".mc-body")?.scrollTo(0, 0); el.querySelector("[data-q]")?.focus({ preventScroll: true }); }, 30); } });
  if (r !== "ok") return; return setOwned(actor, kind, [...owned], fav);
}
export const pickClass = actor => pickMany(actor, "cls");
export const pickSub = actor => pickMany(actor, "sub");

/* ── éditeur du MJ ── */
export class ClassesEditor extends ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "ms-classes", classes: ["ms-sheet", "ms-classes-app"], window: { title: "Classes et sous-classes", icon: "fa-solid fa-graduation-cap", resizable: true }, position: { width: 1100, height: 780 } };
  static open(tab) { const a = foundry.applications.instances.get("ms-classes") || new ClassesEditor(); if (tab) a.tab = tab; a.render({ force: true }); return a; }
  tab = "cls"; q = ""; cat = "";
  async _renderHTML() {
    const D = classData(), S = subData();
    const row = c => `<div class="ce-row t${c.tier}" data-id="${c.id}" style="--c:${esc(roleOf(c).color)}"><span class="ind">${c.tier > 1 ? "↳".padStart(c.tier - 1, " ") : ""}</span><input class="ic" data-f="icon" value="${esc(c.icon)}" title="Icône Font Awesome (fa-…)">${fa(c.icon)}<input class="nm" data-f="name" value="${esc(c.name)}"><em>${esc(D.tiers?.[c.tier] || "")}</em><input class="ds" data-f="desc" value="${esc(c.desc || "")}" placeholder="Description">
      ${c.tier < 3 ? `<a data-a="addKid" title="Ajouter une évolution">${fa("fa-code-branch")}</a>` : `<span></span>`}<a class="x" data-a="del" title="Supprimer (et ses évolutions)">${fa("fa-trash")}</a></div>`;
    const tree = id => childrenOf(id).map(c => row(c) + tree(c.id)).join("");
    const cls = `<div class="ce-perm"><label>Qui choisit la classe ?<select data-perm>${Object.entries(PERMS).map(([k, v]) => `<option value="${k}"${classPerm() === k ? " selected" : ""}>${v}</option>`).join("")}</select></label></div>
      ${Object.entries(D.roles || {}).map(([rk, r]) => `<section class="ce-role" style="--c:${esc(r.color)}"><header>${fa(r.icon)}<b>${esc(r.name)}</b><small>${esc(r.desc || "")}</small><a class="ms-mbtn" data-a="addBase" data-role="${rk}">${fa("fa-plus")} Classe de base</a></header>
        ${D.list.filter(c => c.role === rk && !c.parent).map(c => `<div class="ce-tree">${row(c)}${tree(c.id)}</div>`).join("")}</section>`).join("")}`;
    const list = S.list.filter(s => (!this.cat || s.cat === this.cat) && (!this.q || `${s.name} ${s.desc}`.toLowerCase().includes(this.q)));
    const sub = `<div class="ce-top"><input type="search" data-q value="${esc(this.q)}" placeholder="Rechercher…"><div class="scl-cats"><a class="${this.cat ? "" : "on"}" data-c="">Toutes</a>${Object.entries(S.cats || {}).map(([k, c]) => `<a class="${this.cat === k ? "on" : ""}" data-c="${k}" style="--c:${esc(c.color)}">${fa(c.icon)} ${esc(c.name)}</a>`).join("")}</div><a class="ms-mbtn" data-a="addSub">${fa("fa-plus")} Sous-classe</a></div>
      <div class="ce-subs">${list.map(s => `<div class="ce-row sub" data-sid="${s.id}" style="--c:${esc(S.cats?.[s.cat]?.color || "#5ee0ff")}"><input class="ic" data-f="icon" value="${esc(s.icon)}">${fa(s.icon)}<input class="nm" data-f="name" value="${esc(s.name)}"><select data-f="cat">${Object.entries(S.cats || {}).map(([k, c]) => `<option value="${k}"${s.cat === k ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select><input class="ds" data-f="desc" value="${esc(s.desc || "")}"><a class="x" data-a="delSub">${fa("fa-trash")}</a></div>`).join("")}</div>`;
    return `<div class="ce-wrap"><nav class="ce-tabs"><a data-a="tab" data-k="cls" class="${this.tab === "cls" ? "on" : ""}">${fa("fa-sitemap")} Classes <em>${D.list.length}</em></a><a data-a="tab" data-k="sub" class="${this.tab === "sub" ? "on" : ""}">${fa("fa-briefcase")} Sous-classes <em>${S.list.length}</em></a><span class="sp"></span><a class="ms-mbtn ghost" data-a="reset">${fa("fa-rotate-left")} Revenir aux listes d'origine</a></nav>
      <section class="ce-body">${this.tab === "cls" ? cls : sub}</section></div>`;
  }
  _replaceHTML(html, el) { const b = el.querySelector(".ce-body"); const top = b?.scrollTop || 0; el.innerHTML = html; const nb = el.querySelector(".ce-body"); if (nb) nb.scrollTop = top; if (el.dataset.bound) return; el.dataset.bound = "1";
    el.addEventListener("click", e => { const a = e.target.closest("[data-a], .scl-cats a"); if (!a) return; e.preventDefault(); if (a.matches(".scl-cats a")) { this.cat = a.dataset.c; return this.render(); } this.#act(a); });
    el.addEventListener("change", e => this.#change(e.target)); el.addEventListener("input", e => { if (e.target.matches("[data-q]")) { this.q = e.target.value.trim().toLowerCase(); clearTimeout(this._qt); this._qt = setTimeout(() => this.render().then(() => { const q = this.element.querySelector("[data-q]"); q?.focus(); q?.setSelectionRange(q.value.length, q.value.length); }), 250); } }); }
  async #act(a) { const k = a.dataset.a; const D = foundry.utils.deepClone(classData()), S = foundry.utils.deepClone(subData());
    if (k === "tab") { this.tab = a.dataset.k; return this.render(); }
    if (k === "reset") { if (!await DialogV2.confirm({ window: { title: "Listes d'origine" }, classes: ["ms-dialog"], content: `<p>Remettre les ${this.tab === "cls" ? "classes" : "sous-classes"} d'origine ? Tes modifications sur cet onglet seront perdues.</p>` })) return; await saveDefs(this.tab === "cls" ? { classes: null } : { subs: null }); return this.render(); }
    if (k === "addBase") { D.list.push({ id: uid(), name: "Nouvelle classe", role: a.dataset.role, tier: 1, parent: "", icon: "fa-star", desc: "" }); await saveDefs({ classes: D }); return this.render(); }
    if (k === "addKid") { const p = D.list.find(c => c.id === a.closest("[data-id]").dataset.id); D.list.push({ id: uid(), name: "Nouvelle évolution", role: p.role, tier: Math.min(3, p.tier + 1), parent: p.id, icon: "fa-star", desc: "" }); await saveDefs({ classes: D }); return this.render(); }
    if (k === "del") { const id = a.closest("[data-id]").dataset.id; const drop = new Set([id]); let grow = true; while (grow) { grow = false; for (const c of D.list) if (drop.has(c.parent) && !drop.has(c.id)) { drop.add(c.id); grow = true; } } D.list = D.list.filter(c => !drop.has(c.id)); await saveDefs({ classes: D }); return this.render(); }
    if (k === "addSub") { S.list.unshift({ id: uid(), cat: this.cat || "role", name: "Nouvelle sous-classe", icon: "fa-star", desc: "" }); await saveDefs({ subs: S }); return this.render(); }
    if (k === "delSub") { const id = a.closest("[data-sid]").dataset.sid; S.list = S.list.filter(s => s.id !== id); await saveDefs({ subs: S }); return this.render(); } }
  async #change(el) { if (el.matches("[data-perm]")) return saveDefs({ perm: el.value }); const f = el.dataset.f; if (!f) return;
    const cRow = el.closest("[data-id]"), sRow = el.closest("[data-sid]");
    if (cRow) { const D = foundry.utils.deepClone(classData()); const c = D.list.find(x => x.id === cRow.dataset.id); if (!c) return; c[f] = el.value.trim(); await saveDefs({ classes: D }); }
    else if (sRow) { const S = foundry.utils.deepClone(subData()); const s = S.list.find(x => x.id === sRow.dataset.sid); if (!s) return; s[f] = el.value.trim(); await saveDefs({ subs: S }); }
    if (f === "icon" || f === "cat") this.render(); }
}

Hooks.once("init", () => { game.settings.register(SYS, "classDefs", { scope: "world", config: false, type: Object, default: {}, onChange: () => { Hooks.callAll("manhwaClasses"); for (const a of game.actors) if (a.sheet?.rendered) a.sheet.render(); } }); });
Hooks.once("setup", () => { loadDefaults().then(() => Hooks.callAll("manhwaClasses")); });

export const classesApi = { list: () => classData().list, roles: () => classData().roles, subclasses: () => subData().list, subCategories: () => subData().cats, get: classById, getSub: subById, path: classPath, owned: (a, kind = "cls") => ownedIds(a, kind), of: a => ({ cls: actorClass(a), sub: actorSub(a), path: classPath(actorClass(a)?.id) }), pick: pickClass, pickSub, editor: tab => ClassesEditor.open(tab) };
