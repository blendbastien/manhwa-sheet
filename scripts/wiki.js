/* Manhwa Sheet — WIKI (1.46) : sélecteurs « façon wiki » pour l'Éveil, le Rang, le Niveau et la Constellation.
 * Même DA que le sélecteur de classes ; chaque carte s'ouvre vers le bas pour montrer ses détails.
 * Rangs et constellations : détails cachés aux joueurs jusqu'à ce que le MJ les révèle (à tous, à un groupe MJ ou à un joueur).
 * Constellations : registre complet repris de « Re:Write — Registre des Constellations » (data/constellations.json). */
import { SYS, esc, getConfig, rankBadge } from "./config.js";
import { gmGroups, gmGroupsOfUser } from "./gmgroups.js";
const { ApplicationV2 } = foundry.applications.api;
const fa = i => `<i class="fa-solid ${esc(i || "fa-circle")}"></i>`;
const uid = () => foundry.utils.randomID(10);

/* ── réglages monde ── */
Hooks.once("init", () => {
  const W = (k, d) => game.settings.register(SYS, k, { scope: "world", config: false, type: Object, default: d, onChange: () => WikiApp.refreshAll() });
  W("wiki", {});       /* { aw: { key: texte }, rk: { key: texte }, tiers: [{ name, note }], tierSize: 10 } */
  W("reveals", {});    /* { rk: { key: { all, groups: [], users: [] } }, cst: { id: {...} } } */
  W("cstDefs", {});    /* { list: [...] } : registre modifié par le MJ (sinon celui par défaut) */
});
const get = k => { try { return foundry.utils.deepClone(game.settings.get(SYS, k) || {}); } catch (e) { return {}; } };
async function setW(k, fn) { if (!game.user.isGM) return; const v = get(k); if (fn(v) === false) return; await game.settings.set(SYS, k, v); }

/* ── révélations ── */
export function revealed(kind, id, user = game.user) { if (user?.isGM) return true; const r = get("reveals")?.[kind]?.[id]; if (!r) return false; if (r.all) return true;
  if ((r.users || []).includes(user.id)) return true; const mine = gmGroupsOfUser(user).map(g => g.id); return (r.groups || []).some(g => mine.includes(g)); }
/** 1.48 : rangs verrouillés pour les joueurs, sauf le premier (F) */
export const rankOpen = (key, user = game.user) => key === getConfig().ranks?.[0]?.key || revealed("rk", key, user);
const cstAny = id => { const r = get("reveals")?.cst?.[id]; return !!(r && (r.all || r.groups?.length || r.users?.length)); };
const revOf = (kind, id) => { const r = get("reveals")?.[kind]?.[id] || {}; return { all: !!r.all, groups: r.groups || [], users: r.users || [] }; };
export function revealTools(kind, id) { const r = revOf(kind, id); const players = game.users.filter(u => !u.isGM);
  return `<div class="wk-rev" data-rk="${kind}" data-rid="${esc(id)}"><b>${fa("fa-eye")} Révélé à</b>
    <span class="wk-tg${r.all ? " on" : ""}" data-rev="all">${fa("fa-users")} Tout le monde</span>
    ${gmGroups().map(g => `<span class="wk-tg${r.groups.includes(g.id) ? " on" : ""}" data-rev="g" data-v="${g.id}" style="--c:${esc(g.color || "#ffc63d")}">${fa(g.icon || "fa-people-group")} ${esc(g.name)}</span>`).join("")}
    ${players.map(u => `<span class="wk-tg${r.users.includes(u.id) ? " on" : ""}" data-rev="u" data-v="${u.id}" style="--c:${esc(u.color?.css ?? u.color ?? "#8ea0c8")}">${fa("fa-user")} ${esc(u.name)}</span>`).join("")}</div>`; }
export async function toggleReveal(kind, id, mode, v) { await setW("reveals", R => { R[kind] ||= {}; const r = R[kind][id] ||= { all: false, groups: [], users: [] };
  if (mode === "all") r.all = !r.all; else { const k = mode === "g" ? "groups" : "users"; r[k] ||= []; const i = r[k].indexOf(v); i >= 0 ? r[k].splice(i, 1) : r[k].push(v); } }); }

/* ── niveaux : paliers nommés (pas d'XP affichée) ── */
const TIER_DEF = ["Initié", "Débutant", "Apprenti", "Aguerri", "Confirmé", "Expert", "Élite", "Maître", "Grand Maître", "Légende"];
export const tierSize = () => Math.max(2, Number(get("wiki").tierSize) || 10);
export const tiers = () => { const T = get("wiki").tiers; return Array.isArray(T) && T.length ? T : TIER_DEF.map(name => ({ name, note: "" })); };
/** nom du niveau : « Initié », « Initié + » (seconde moitié du palier) ; au-delà du dernier palier, le dernier est répété */
export function levelName(lv) { lv = Math.max(1, Number(lv) || 1); const n = tierSize(); const T = tiers(); const ti = Math.min(T.length - 1, Math.floor((lv - 1) / n)); const pos = (lv - 1) - ti * n;
  return `${T[ti]?.name || ""}${pos >= Math.ceil(n / 2) ? " +" : ""}`; }

/* ── constellations ── */
let CST = null; const cstDefault = async () => { if (!CST) { try { const r = await fetch(`systems/${SYS}/data/constellations.json`); CST = await r.json(); } catch (e) { CST = { ranks: [], myths: {}, cats: [], list: [] }; } } return CST; };
/* nom montré aux joueurs (le titre, ou un surnom choisi par le MJ) et surnoms visibles ou non */
export const cstShown = d => { const r = get("reveals")?.cst?.[d.id] || {}; const al = d.alias || []; return { name: r.as && (r.as === d.nom || al.includes(r.as)) ? r.as : d.nom, aliases: !!r.al }; };
let CACHE = null; export const cstCached = () => CACHE;
Hooks.once("ready", () => { cstData().then(D => CACHE = D); });
export async function cstData() { const D = await cstDefault(); const own = get("cstDefs"); CACHE = { ...D, list: Array.isArray(own.list) ? own.list : D.list }; return CACHE; }

/* ── fenêtre générique ── */
export class WikiApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = { classes: ["ms-dialog", "ms-menu-dialog", "mc-dlg", "ms-wiki"], window: { resizable: true }, position: { width: 1000, height: 760 } };
  static refreshAll() { for (const a of foundry.applications.instances.values()) if (a instanceof WikiApp && a.rendered) a.render(); }
  constructor(opts, actor, kind) { super(opts); this.actor = actor; this.kind = kind; this.open = new Set(); this.q = ""; this.edit = null; }
  get title() { return `${{ aw: "Éveil", rk: "Rangs", lv: "Niveaux", cst: "Constellations" }[this.kind]} — ${this.actor?.name || "Wiki"}`; }
  get canSet() { const cfg = getConfig(); const k = { aw: "awakening", rk: "rank", lv: "level", cst: "sponsor" }[this.kind]; return !!this.actor?.isOwner && (game.user.isGM || !cfg.locks?.[k]); }
  async _renderHTML() { const gm = game.user.isGM;
    const body = this.kind === "cst" ? await this.#cst() : this.kind === "aw" ? this.#aw() : this.kind === "rk" ? this.#rk() : this.#lv();
    /* 1.48 : plus de recherche ni de phrase pour les rangs et les niveaux ; la constellation a son propre bandeau (DA des menus Titres / Sacs) */
    const top = this.kind === "aw" ? `<div class="mc-top"><p class="ms-mhint">${this.canSet ? "Clique pour <b>choisir</b>" : "Consultation"} · la flèche <i class="fa-solid fa-chevron-down"></i> ouvre les <b>détails</b>.</p></div>` : "";
    return `<div class="mc-pick wk-pick wk-${this.kind}">${top}<div class="mc-body">${body}</div></div>`; }
  /* carte générique (DA du sélecteur de classes) avec panneau wiki dépliable */
  #card({ id, name, sub = "", icon, color, on = false, locked = false, detail = "", search = "", extra = "" }) {
    const o = this.open.has(id);
    return `<div class="mc-card wk-card${on ? " own isfav" : ""}${locked ? " wk-lock" : ""}${o ? " open" : ""}" data-id="${esc(id)}" data-n="${esc((search || name).toLowerCase())}" style="--c:${esc(color || "#5ee0ff")}">
      ${extra || fa(icon)}<b>${esc(name)}</b><small>${sub}</small>${on ? `<i class="ck fa-solid fa-check"></i>` : ""}${locked ? `<i class="lock fa-solid fa-lock"></i>` : ""}
      <span class="mc-more" data-more>${o ? "Masquer" : "Détails"} <i class="fa-solid fa-chevron-${o ? "up" : "down"}"></i></span><div class="mc-wiki">${o ? detail : ""}</div></div>`; }
  #note(kind, key, txt) { const gm = game.user.isGM; return gm ? `<label class="wk-note"><span>${fa("fa-feather")} Description (écrite par le MJ)</span><textarea data-wnote="${kind}" data-wkey="${esc(key)}" rows="3" placeholder="Ce que signifie cet état, ses effets, ses conditions…">${esc(txt || "")}</textarea></label>` : `<div class="wk-txt">${txt ? esc(txt).replace(/\n/g, "<br>") : `<em>Aucune description pour l'instant.</em>`}</div>`; }
  /* grande ligne lumineuse (éveil, rangs) */
  #row({ id, name, sub = "", color, on = false, locked = false, detail = "", badge = "", tag = "" }) { const o = this.open.has(id);
    return `<div class="wk-row${on ? " on" : ""}${locked ? " wk-lock" : ""}${o ? " open" : ""}" data-id="${esc(id)}" data-n="${esc(name.toLowerCase())}" style="--c:${esc(color || "#5ee0ff")}">
      <div class="wk-rowbar" data-pickrow><span class="wk-shine"></span><span class="wk-stars"></span><span class="wk-bdg">${badge}</span><span class="wk-nm"><b>${esc(name)}</b><small>${sub}</small></span>${tag}${on ? `<span class="wk-cur">${fa("fa-check")} Actuel</span>` : ""}${locked ? `<span class="wk-lk">${fa("fa-lock")}</span>` : ""}<a class="wk-open" data-more>${fa(o ? "fa-chevron-up" : "fa-chevron-down")}</a></div>
      ${o ? `<div class="wk-rowdet">${detail}</div>` : ""}</div>`; }
  #state(kind, key) { const x = revOf(kind, key); return x.all ? "Révélé à tous" : x.groups.length || x.users.length ? "Révélé en partie" : "Caché aux joueurs"; }
  #aw() { const cfg = getConfig(); const W = get("wiki").aw || {}; const cur = this.actor?.system?.awakening; const gm = game.user.isGM;
    return `<div class="wk-rows wk-aws">${cfg.awakening.map((x, i) => { const rv = revealed("aw", x.key) || x.key === cur;
      const detail = rv ? `${this.#note("aw", x.key, W[x.key])}${gm ? revealTools("aw", x.key) : ""}` : `<div class="wk-txt wk-hidden">${fa("fa-lock")} Cet état n'a pas encore été révélé.</div>`;
      return this.#row({ id: x.key, name: rv ? x.name : "???", sub: gm ? this.#state("aw", x.key) : rv ? "" : "Verrouillé", color: rv ? x.color : "#5a6688", on: x.key === cur, locked: !rv, detail, badge: `<i class="fa-solid fa-sun wk-sun aw-${esc(x.anim || "none")}"></i><em>${i + 1}</em>` }); }).join("")}</div>`; }
  #rk() { const cfg = getConfig(); const W = get("wiki").rk || {}; const cur = this.actor?.system?.rank; const gm = game.user.isGM;
    return `<div class="wk-rows wk-rks">${cfg.ranks.map(r => { const rv = rankOpen(r.key) || r.key === cur;
      const detail = rv ? `${this.#note("rk", r.key, W[r.key])}${gm && r.key !== cfg.ranks[0]?.key ? revealTools("rk", r.key) : ""}` : `<div class="wk-txt wk-hidden">${fa("fa-lock")} Ce rang n'a pas encore été révélé.</div>`;
      return this.#row({ id: r.key, name: rv ? r.name : "???", sub: gm ? (r.key === cfg.ranks[0]?.key ? "Toujours visible (premier rang)" : this.#state("rk", r.key)) : rv ? "" : "Verrouillé", color: rv ? r.color : "#5a6688", on: r.key === cur, locked: !rv, detail, badge: rankBadge(rv ? r : { name: "?", color: "#5a6688" }, { size: "lg" }) }); }).join("")}</div>`; }
  #lv() { const cfg = getConfig(); const max = Number(cfg.xp?.maxLevel) || 100; const n = tierSize(); const T = tiers(); const cur = Number(this.actor?.system?.level) || 0; const gm = game.user.isGM; const out = [];
    for (let ti = 0; ti * n < max; ti++) { const from = ti * n + 1, to = Math.min(max, (ti + 1) * n); const t = T[Math.min(T.length - 1, ti)] || { name: "" }; const hasCur = cur >= from && cur <= to; const closed = !hasCur && !this.open.has(`t${ti}`) && !this.q;
      const lvls = []; for (let l = from; l <= to; l++) lvls.push(`<a class="wk-lv${l === cur ? " on" : ""}" data-lv="${l}" data-n="${esc(`${l} ${levelName(l)}`.toLowerCase())}"><b>${l}</b><small>${esc(levelName(l))}</small></a>`);
      out.push(`<section class="wk-tier${closed ? " closed" : ""}${hasCur ? " cur" : ""}" data-tier="${ti}" style="--c:hsl(${190 + ti * 17} 95% 62%)"><header data-tog="t${ti}"><span class="wk-shine"></span><span class="wk-stars"></span><em class="wk-tn">${ti + 1}</em><b>${esc(t.name)}</b><small>Niveaux ${from} à ${to}</small>${hasCur ? `<span class="wk-cur">${fa("fa-check")} Niveau ${cur}</span>` : ""}<i class="fa-solid fa-chevron-down wk-cv"></i></header>
        <div class="wk-tbody"><div class="wk-lvs">${lvls.join("")}</div></div></section>`); }
    return out.join(""); }
  /* 1.48 : constellations dans la DA des menus de la fiche (bandeau, sections par catégorie, une ligne par constellation, coche) */
  async #cst() { const D = await cstData(); const gm = game.user.isGM; const cur = this.actor?.system?.sponsor || ""; const curId = this.actor?.getFlag?.(SYS, "cst") || ""; const q = this.q.trim().toLowerCase();
    const rkById = id => D.ranks.find(r => r.id === id) || D.ranks[0] || { nom: "", col: "#8a93a8", bg: "transparent" }; const myth = m => D.myths?.[m] || { i: "✶", c: "#b3a0ff" };
    const isCur = d => curId ? curId === d.id : !!cur && cur === d.nom;
    const row = (d, cat) => { const rv = revealed("cst", d.id); const on = isCur(d); const locked = !gm && !rv && !on; const rk = rkById(d.r); const mi = myth(d.m); const o = this.open.has(d.id); const sh = cstShown(d);
      if (this.edit === d.id && gm) return `<div class="ms-cst cst-editbox">${this.#cstEdit(d, D)}</div>`;
      const name = gm || rv ? d.nom : sh.name; const als = gm || rv ? (d.alias || []) : sh.aliases ? (d.alias || []).filter(x => x !== sh.name) : [];
      const chips = `${rv || gm ? `<span class="eq-rk" style="--k:${esc(rk.col)}">${esc(rk.nom)}</span><span class="eq-rar" style="--k:${esc(mi.c)}">${mi.i} ${esc(d.m || "")}</span>` : ""}${locked ? `<span class="eq-sub">${fa("fa-lock")} Verrouillée</span>` : ""}${gm && !cstAny(d.id) ? `<span class="eq-sub gmh">${fa("fa-eye-slash")} Cachée aux joueurs${sh.name !== d.nom ? ` · vue « ${esc(sh.name)} »` : ""}</span>` : ""}`;
      const det = !o ? "" : `<div class="cst-det" style="--rc:${esc(cat.col)}">${rv || gm ? `${d.real ? `<div class="cd-real">⟡ ${esc(d.real)}</div>` : ""}${als.length ? `<div class="cd-als">${als.map(x => `<span>${esc(x)}</span>`).join("")}</div>` : ""}
          <div class="cd-blk"><span>${fa("fa-book-open")} Lore</span><p>${esc(d.lore || "—")}</p></div><div class="cd-blk" style="--k:${esc(cat.col)}"><span>${fa("fa-bolt")} Pouvoir</span><p>${esc(d.power || "—")}</p></div><div class="cd-blk" style="--k:${esc(rk.col)}"><span>${fa("fa-star")} Stigma — don signature</span><p>${esc(d.stigma || "—")}</p></div>`
          : `${als.length ? `<div class="cd-als">${als.map(x => `<span>${esc(x)}</span>`).join("")}</div>` : ""}<div class="wk-txt wk-hidden">${fa("fa-lock")} Ses pouvoirs et son histoire n'ont pas encore été révélés.</div>`}
        ${gm ? `${revealTools("cst", d.id)}<div class="wk-rev cst-nm"><b>${fa("fa-user-secret")} Vu par les joueurs</b>${[d.nom, ...(d.alias || [])].map(n => `<span class="wk-tg${sh.name === n ? " on" : ""}" data-cas="${esc(n)}">${esc(n)}</span>`).join("")}<span class="wk-tg${sh.aliases ? " on" : ""}" data-cal="1">${fa("fa-quote-left")} Surnoms visibles</span></div>
          <div class="cd-gm"><button type="button" data-cedit="${esc(d.id)}">${fa("fa-pen")} Éditer</button><button type="button" class="danger" data-cdel="${esc(d.id)}">${fa("fa-trash")} Supprimer</button></div>` : ""}</div>`;
      return `<div class="cst-row${on ? " on" : ""}${locked ? " lock" : ""}${o ? " open" : ""}" data-cid="${esc(d.id)}" style="--rc:${esc(cat.col)};--rk:${esc(rk.col)}"><div class="cst-bar" data-cpick><span class="im">${cat.ic}${rv || gm ? `<em class="rk">${esc(String(rk.nom || "").slice(0, 3))}</em>` : ""}</span>
        <span class="tx"><b>${esc(name)}</b><span class="eq-chips">${chips}</span></span><a class="cst-more" data-more title="Détails">${fa(o ? "fa-chevron-up" : "fa-chevron-down")}</a><span class="ck">${locked ? fa("fa-lock") : fa("fa-check")}</span></div>${det}</div>`; };
    const catIds = new Set(D.cats.map(c => c.id)); const cats = D.list.some(d => !catIds.has(d.c)) ? [...D.cats, { id: "__autres", fam: "Autres", nom: "Sans catégorie", col: "#b3a0ff", ic: "✶" }] : D.cats;
    const hay = (d, cat) => { const rv = gm || revealed("cst", d.id); const sh = cstShown(d); return ((rv ? `${d.nom} ${d.real || ""} ${(d.alias || []).join(" ")} ${d.m || ""}` : `${sh.name} ${sh.aliases ? (d.alias || []).join(" ") : ""}`) + ` ${cat.nom}`).toLowerCase(); };
    const curCat = (D.list.find(d => isCur(d)) || {}).c; if (!this.cstInit) { this.cstInit = true; this.cOpen = new Set(curCat ? [curCat] : []); }
    let shown = 0; const blocks = cats.map(cat => { const items = D.list.filter(d => cat.id === "__autres" ? !catIds.has(d.c) : d.c === cat.id).filter(d => !q || hay(d, cat).includes(q)); if (!items.length) return ""; shown += items.length; const shut = !q && !this.cOpen.has(cat.id);
      return `<section class="ms-eqgrp cst-grp${shut ? " shut" : ""}" id="cst-${cat.id}" style="--gc:${esc(cat.col)}"><header data-ctog="${cat.id}"><span class="cg">${cat.ic}</span><b>${esc(cat.nom)}</b><small>${esc(cat.fam || "")}</small><em>${items.length}</em>${gm ? `<a class="cst-add" data-cadd="${cat.id}" title="Ajouter une constellation">${fa("fa-plus")}</a>` : ""}<i class="fa-solid fa-chevron-down eq-cv"></i></header>${shut ? "" : `<div class="eq-gl">${items.map(d => row(d, cat)).join("")}</div>`}</section>`; }).join("");
    const nOpen = D.list.filter(d => revealed("cst", d.id)).length;
    const head = `<div class="cst-sticky"><div class="ms-eqhead cst-head" style="--c:#b48cff"><i class="fa-solid fa-star-of-life"></i><div><b>Constellations</b></div>${cur ? `<span class="cst-curchip">${fa("fa-check")} ${esc(cur)}${this.canSet ? `<a data-cnone title="Retirer">${fa("fa-xmark")}</a>` : ""}</span>` : ""}<span class="n"><b>${gm ? D.list.length : nOpen}</b>${gm ? "" : ` / ${D.list.length}`}</span></div>
      <div class="mc-q"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-q placeholder="Rechercher une constellation…" value="${esc(this.q)}"></div>
      <div class="cst-jump">${cats.map(c => `<a data-jump="${c.id}" style="--k:${esc(c.col)}">${c.ic} ${esc(c.nom)}</a>`).join("")}</div>
      ${gm ? `<div class="cst-gmbar"><input type="text" data-cfree placeholder="Nom libre pour ${esc(this.actor?.name || "")}…"><button type="button" data-cfreeok>Valider</button><a data-creset>Registre d'origine</a></div>` : ""}<div class="cst-tools"><a data-call="1">${fa("fa-angles-down")} Tout ouvrir</a><a data-call="0">${fa("fa-angles-up")} Tout fermer</a></div></div>`;
    return `<div class="wk-cstlist">${head}<div class="cst-groups">${blocks || `<div class="wk-txt">Aucune constellation ne correspond.</div>`}</div></div>`; }
  #cstEdit(d, D) { const o = (L, cur, k, n) => L.map(x => `<option value="${esc(x[k])}"${x[k] === cur ? " selected" : ""}>${esc(n(x))}</option>`).join("");
    return `<div class="const-card editing" data-cid="${esc(d.id)}"><div class="cc-edit" style="display:block"><div class="erow"><div><label>Voie / Nébuleuse</label><select data-f="c">${o(D.cats, d.c, "id", x => `${x.fam} — ${x.nom}`)}</select></div><div><label>Rang</label><select data-f="r">${o(D.ranks, d.r, "id", x => x.nom)}</select></div></div>
      <label>Mythologie</label><input data-f="m" value="${esc(d.m || "")}"><label>Titre</label><input data-f="nom" value="${esc(d.nom || "")}"><label>Identité réelle</label><input data-f="real" value="${esc(d.real || "")}">
      <label>Surnoms (un par ligne)</label><textarea data-f="alias">${esc((d.alias || []).join("\n"))}</textarea><label>Lore</label><textarea data-f="lore">${esc(d.lore || "")}</textarea><label>Pouvoir</label><textarea data-f="power">${esc(d.power || "")}</textarea><label>Stigma</label><textarea data-f="stigma">${esc(d.stigma || "")}</textarea>
      <div class="cc-edit-btns"><button class="mini" data-csave="${esc(d.id)}">Enregistrer</button><button class="mini" data-ccancel>Annuler</button></div></div></div>`; }

  _replaceHTML(html, c) { const b0 = c.querySelector(".mc-body"); const keep = b0?.scrollTop || 0; const fq = document.activeElement?.matches?.("[data-q]");
    c.innerHTML = html; const b = c.querySelector(".mc-body"); if (b) b.scrollTop = keep; if (fq) { const i = c.querySelector("[data-q]"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    if (c.dataset.bound) return; c.dataset.bound = "1";
    c.addEventListener("input", ev => { if (!ev.target.matches("[data-q]")) return; clearTimeout(this._qt); this._qt = setTimeout(() => { this.q = ev.target.value; this.render(); }, 220); });
    c.addEventListener("change", async ev => { const t = ev.target;
      if (t.dataset.wnote) return setW("wiki", W => { (W[t.dataset.wnote] ||= {})[t.dataset.wkey] = t.value; });
      if (t.dataset.wtier !== undefined) return setW("wiki", W => { const T = Array.isArray(W.tiers) && W.tiers.length ? W.tiers : tiers(); T[+t.dataset.wtier] = { ...(T[+t.dataset.wtier] || { name: "" }), note: t.value }; W.tiers = T; }); });
    c.addEventListener("click", async ev => { const t = ev.target; const gm = game.user.isGM;
      const rev = t.closest("[data-rev]"); if (rev) { ev.preventDefault(); const box = rev.closest("[data-rk]"); return toggleReveal(box.dataset.rk, box.dataset.rid, rev.dataset.rev, rev.dataset.v); }
      const tog = t.closest("[data-tog]"); if (tog) { const k = tog.dataset.tog; const sec = tog.closest(".wk-tier"); const isOpen = !sec.classList.contains("closed"); isOpen ? this.open.delete(k) : this.open.add(k); sec.classList.toggle("closed", isOpen); return; }
      const jump = t.closest("[data-jump]"); if (jump) { if (this.kind === "cst" && !this.cOpen?.has(jump.dataset.jump)) { this.cOpen.add(jump.dataset.jump); await this.render(); } const b = c.querySelector(".mc-body"); const sec = c.querySelector(`#cst-${jump.dataset.jump}`); const st = c.querySelector(".cst-sticky"); if (b && sec) b.scrollTo({ top: b.scrollTop + sec.getBoundingClientRect().top - b.getBoundingClientRect().top - (st?.offsetHeight || 0) - 8, behavior: "smooth" }); return; }
      const ct = t.closest("[data-ctog]"); if (ct && !t.closest("[data-cadd]")) { const k = ct.dataset.ctog; this.cOpen.has(k) ? this.cOpen.delete(k) : this.cOpen.add(k); return this.render(); }
      const ca = t.closest("[data-call]"); if (ca) { const D = await cstData(); this.cOpen = new Set(ca.dataset.call === "1" ? [...D.cats.map(x => x.id), "__autres"] : []); return this.render(); }
      const more = t.closest("[data-more]"); if (more) { ev.preventDefault(); const card = more.closest("[data-id], [data-cid]"); const id = card.dataset.id || card.dataset.cid; this.open.has(id) ? this.open.delete(id) : this.open.add(id); return this.render(); }
      if (this.kind === "cst") return this.#cstClick(t, c);
      if (t.closest(".mc-wiki, textarea")) return;
      const lv = t.closest("[data-lv]"); if (lv) { if (!this.canSet) return; await this.actor.update({ "system.level": +lv.dataset.lv }); return this.render(); }
      const card = t.closest(".wk-row[data-id]") || t.closest(".mc-card[data-id]"); if (!card || !this.canSet) return; if (t.closest(".wk-rowdet")) return; if (card.classList.contains("wk-lock") && !gm) return ui.notifications.info("Pas encore révélé par le MJ.");
      const path = this.kind === "aw" ? "system.awakening" : "system.rank"; await this.actor.update({ [path]: card.dataset.id }); this.render(); });
  }
  async #cstClick(t, c) { const gm = game.user.isGM; const D = await cstData(); const save = list => setW("cstDefs", X => { X.list = list; });
    if (t.closest("[data-cfreeok]")) { const v = c.querySelector("[data-cfree]")?.value.trim(); if (v && gm) { await this.actor.update({ "system.sponsor": v }); await this.actor.unsetFlag(SYS, "cst"); this.render(); } return; }
    if (t.closest("[data-cnone]")) { if (this.canSet) { await this.actor.update({ "system.sponsor": "" }); await this.actor.unsetFlag(SYS, "cst"); this.render(); } return; }
    if (gm) { const as = t.closest("[data-cas]"); if (as) { const id = as.closest("[data-cid]").dataset.cid; return setW("reveals", R => { R.cst ||= {}; const r = R.cst[id] ||= { all: false, groups: [], users: [] }; r.as = as.dataset.cas; }); }
      const al = t.closest("[data-cal]"); if (al) { const id = al.closest("[data-cid]").dataset.cid; return setW("reveals", R => { R.cst ||= {}; const r = R.cst[id] ||= { all: false, groups: [], users: [] }; r.al = !r.al; }); }
      const e = t.closest("[data-cedit]"); if (e) { this.edit = e.dataset.cedit; return this.render(); }
      if (t.closest("[data-ccancel]")) { this.edit = null; return this.render(); }
      const s = t.closest("[data-csave]"); if (s) { const box = s.closest("[data-cid]"); const v = f => box.querySelector(`[data-f="${f}"]`)?.value ?? ""; const L = foundry.utils.deepClone(D.list); const d = L.find(x => x.id === s.dataset.csave); if (!d) return;
        Object.assign(d, { c: v("c"), r: v("r"), m: v("m"), nom: v("nom").trim() || d.nom, real: v("real"), alias: v("alias").split("\n").map(x => x.trim()).filter(Boolean), lore: v("lore"), power: v("power"), stigma: v("stigma") }); this.edit = null; return save(L); }
      const del = t.closest("[data-cdel]"); if (del) { const L = D.list.filter(x => x.id !== del.dataset.cdel); return save(L); }
      const add = t.closest("[data-cadd]"); if (add) { const id = `u${uid()}`; const L = foundry.utils.deepClone(D.list); L.push({ id, c: add.dataset.cadd, r: D.ranks[0]?.id || "", m: "Factice", nom: "Nouvelle constellation", real: "", alias: [], lore: "", power: "", stigma: "" }); this.edit = id; this.open.add(id); return save(L); }
      if (t.closest("[data-creset]")) { const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Registre d'origine" }, content: "<p>Remettre le registre des constellations d'origine ? Tes modifications seront perdues (les révélations sont gardées).</p>" }); if (ok) await game.settings.set(SYS, "cstDefs", {}); return; } }
    const bar = t.closest("[data-cpick]"); if (!bar) return; const row = bar.closest("[data-cid]"); const d = D.list.find(x => x.id === row.dataset.cid); if (!d || !this.canSet) return;
    if (row.classList.contains("lock")) return ui.notifications.info("Constellation verrouillée : le MJ ne l'a pas encore débloquée.");
    if (row.classList.contains("on")) { await this.actor.update({ "system.sponsor": "" }); await this.actor.unsetFlag(SYS, "cst"); return this.render(); }
    await this.actor.update({ "system.sponsor": (gm || revealed("cst", d.id)) ? d.nom : cstShown(d).name }); await this.actor.setFlag(SYS, "cst", d.id); this.render(); }
}
export function openWiki(actor, kind) { const id = `ms-wiki-${kind}-${actor?.id || "x"}`; const big = kind === "cst"; const app = foundry.applications.instances.get(id) ?? new WikiApp({ id, classes: big ? ["wk-cstwin", "ms-eqdlg"] : [], position: { width: big ? Math.min(720, innerWidth - 40) : 1000, height: Math.min(big ? 860 : 760, innerHeight - 60) } }, actor, kind); app.render({ force: true }); return app; }
