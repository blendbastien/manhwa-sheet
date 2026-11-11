/* Manhwa Sheet — Échange entre personnages (joueurs ou PNJ), en fenêtre système dans le chat.
 * Chaque côté met des objets et du Gold, puis valide ; toute modification annule les validations ;
 * quand les deux ont validé, le MJ actif exécute le transfert (objets déplacés, Gold échangé). */
import { SYS, esc, getConfig, rankOf, rootOf, iconOf, pathOf, rankBadge } from "./config.js";
import { actorOf, parties, gmDo, onGm, toast, goldKey, goldOf, addGold, actorLock, userCanActor, refreshMenus, uid, menuCfg, activeGM } from "./world.js";

const DialogV2 = foundry.applications.api.DialogV2;
const fmt = n => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const gname = () => getConfig().resources.find(r => r.key === goldKey())?.name || "Gold";
const tradeOf = m => m?.flags?.[SYS]?.trade;

/* ── 1.38 : monnaies (toutes les ressources de la fiche), catégories échangeables, carte « portrait » ── */
const RES_PRESETS = r => /^(pi|p_?i)$/i.test(String(r.key).replace(/[^a-z_]/gi, "")) || /^p\.?i\.?$/i.test(String(r.name).trim()) ? [1, 2, 3, 5, 10] : [10, 50, 100, 500, 1000];
const resList = () => (getConfig().resources || []).filter(r => r?.key);
const resAmt = (a, k) => Number(a?.system?.resources?.[k]) || 0;
const sideRes = s => { const o = { ...(s?.res || {}) }; const g = goldKey(); if (g && !(g in o) && Number(s?.gold)) o[g] = Number(s.gold); return o; };
/* catégories : armes, armures, objets toujours échangeables ; le reste est fermé par défaut, ouvert par le MJ pour chaque personnage */
export const TRADE_LOCKS = { bags: ["Sacs", "fa-bag-shopping"], skill: ["Compétences", "fa-wand-sparkles"], title: ["Titres", "fa-crown"], equipped: ["Objets équipés", "fa-shirt"], vehicle: ["Véhicules", "fa-car-side"], companion: ["Compagnons", "fa-paw"], property: ["Propriétés", "fa-house-flag"] };
export const tradeAllow = a => ({ ...(a?.getFlag?.(SYS, "tradeAllow") || {}) });
const rootId = (cfg, it) => rootOf(cfg, it.system?.category)?.id || "items";
export function tradeBlock(a, it, cfg = getConfig()) { const al = tradeAllow(a); const r = rootId(cfg, it);
  if (TRADE_LOCKS[r] && r !== "equipped" && !al[r]) return TRADE_LOCKS[r][0]; if (it.system?.equipped && !al.equipped) return "Équipé"; return null; }
const rankColor = (cfg, k) => cfg.ranks?.find(r => r.key === k)?.color || "";
const ICON_OK = `systems/${SYS}/assets/ui/trade_ok.svg`, ICON_NO = `systems/${SYS}/assets/ui/trade_no.svg`;

/* carte d'échange (chat et Menu) : les deux personnages l'un au-dessus de l'autre, la grosse icône d'échange entre eux */
export function tradeCard(msg) {
  const t = tradeOf(msg); if (!t) return ""; const cfg = getConfig(); const R = resList();
  const side = k => { const s = t[k]; const a = actorOf(s.uuid); const mine = a && (game.user.isGM || a.isOwner) && t.state === "open"; const rk = a ? rankOf(cfg, a.system?.rank) : null; const res = sideRes(s);
    const items = (s.items || []).map(i => `<div class="tc-it" style="--ic:${esc(i.color || "#8ea0c8")}" data-tooltip="${esc(i.name)}${i.qty > 1 ? ` ×${i.qty}` : ""}"><img src="${esc(i.img)}">${i.qty > 1 ? `<em>×${i.qty}</em>` : ""}</div>`).join("");
    const money = R.filter(r => Number(res[r.key])).map(r => `<span class="tc-mo" style="--mc:${esc(r.color || "#ffd070")}"><i class="fa-solid ${esc(r.icon || "fa-coins")}"></i><b>${fmt(res[r.key])}</b><small>${esc(r.name)}</small></span>`).join("");
    const ctl = mine ? `<div class="tc-ctl"><a data-trade="items" class="tb obj"><i class="fa-solid fa-box-open"></i>Objets</a>${R.map(r => `<a data-trade="res" data-res="${esc(r.key)}" class="tb" style="--mc:${esc(r.color || "#ffd070")}"><i class="fa-solid ${esc(r.icon || "fa-coins")}"></i>${esc(r.name)}</a>`).join("")}</div>` : "";
    const okBtn = mine ? (s.ok ? `<a data-trade="unok" class="tc-tv un" data-tooltip="Retirer ma validation"><img src="${ICON_OK}"><span>Validé</span><small>retirer</small></a>` : `<a data-trade="ok" class="tc-tv" data-tooltip="Valider l'échange"><img src="${ICON_OK}"><span>Valider</span></a>`) : s.ok ? `<span class="tc-tv st"><img src="${ICON_OK}"><span>Validé</span></span>` : `<span class="tc-tv st wait"><i class="fa-solid fa-hourglass-half"></i><span>En attente</span></span>`;
    return `<div class="sd${s.ok ? " ok" : ""}" data-side="${k}" style="--rc:${esc(rk?.color || "#8ea0c8")}"><div class="tc-pt"><img src="${esc(a?.img || "")}">${rankBadge(rk, { size: "sm" })}</div>
      <div class="tc-bd"><header><b>${esc(a?.name || "?")}</b>${s.ok ? `<span class="v"><i class="fa-solid fa-check"></i> Validé</span>` : ""}</header>
      <div class="offer">${money}${items ? `<div class="tc-its">${items}</div>` : ""}${!money && !items ? `<small class="none">Rien proposé pour l'instant</small>` : ""}</div>${ctl}</div>${okBtn}</div>`; };
  const can = [t.a, t.b].some(s => { const a = actorOf(s.uuid); return a && (game.user.isGM || a.isOwner); });
  const st = { open: "En cours", executing: "Transfert en cours…", done: "Échange conclu", cancel: "Échange annulé" }[t.state];
  return `<div class="ms-tcard st-${t.state}" data-mid="${msg.id}"><header class="hd"><i class="fa-solid fa-right-left"></i><b>ÉCHANGE</b><small>${st}</small></header>
    ${side("a")}<div class="swap"><span class="orb"><i class="fa-solid fa-arrow-right-arrow-left"></i></span>${t.state === "open" && can ? `<a data-trade="cancel" class="tc-tx" data-tooltip="Annuler l'échange"><img src="${ICON_NO}"><span>Annuler</span></a>` : ""}</div>${side("b")}</div>`;
}
export function bindTrade(root) {
  root.querySelectorAll(".ms-tcard [data-trade]").forEach(b => b.addEventListener("click", async ev => { ev.preventDefault(); ev.stopPropagation();
    const card = b.closest("[data-mid]"); const msg = game.messages.get(card.dataset.mid); const t = tradeOf(msg); if (!t || t.state !== "open") return;
    const k = b.closest("[data-side]")?.dataset.side; const op = b.dataset.trade; const a = k ? actorOf(t[k].uuid) : null;
    if (op === "items") { const items = await pickItems(a, t[k].items); if (items) gmDo("trade", { mid: msg.id, side: k, op: "items", items }); return; }
    if (op === "res") { const key = b.dataset.res; const v = await askRes(a, key, sideRes(t[k])[key]); if (v !== null) gmDo("trade", { mid: msg.id, side: k, op: "res", key, amount: v }); return; }
    if (op === "ok" || op === "unok") return gmDo("trade", { mid: msg.id, side: k, op });
    if (op === "cancel") return cancelTrade(msg);
  }));
}
/* annuler marche même sans MJ : l'auteur du message l'annule lui-même, sinon on le lui demande ; s'il n'est pas là non plus, l'échange est caché pour soi */
async function cancelTrade(msg) {
  if (activeGM()) return gmDo("trade", { mid: msg.id, op: "cancel" });
  const t = foundry.utils.deepClone(tradeOf(msg)); t.state = "cancel";
  if (msg.isOwner) return msg.update({ [`flags.${SYS}.trade`]: t });
  const au = msg.author; if (au?.active) { game.socket.emit(`system.${SYS}`, { op: "tradeCancel", mid: msg.id, to: au.id, by: game.user.id }); return ui.notifications.info("Échange annulé."); }
  const hid = new Set(game.user.getFlag(SYS, "tradeHide") || []); hid.add(msg.id); await game.user.setFlag(SYS, "tradeHide", [...hid]); refreshMenus();
  ui.notifications.info("Échange annulé de ton côté (personne d'autre n'est connecté pour le clore).");
}
Hooks.once("ready", () => game.socket.on(`system.${SYS}`, async m => { if (m?.op !== "tradeCancel" || m.to !== game.user.id) return; const msg = game.messages.get(m.mid); const t = tradeOf(msg); if (!t || t.state !== "open" || !msg.isOwner) return;
  const by = game.users.get(m.by); if (!by || ![t.a, t.b].some(x => actorOf(x.uuid)?.testUserPermission(by, "OWNER"))) return; await msg.update({ [`flags.${SYS}.trade`]: { ...foundry.utils.deepClone(t), state: "cancel" } }); }));
Hooks.on("renderChatMessageHTML", (msg, html) => { if (!tradeOf(msg)) return; const el = html instanceof HTMLElement ? html : html?.[0]; const c = el?.querySelector(".message-content"); if (!c) return; c.innerHTML = tradeCard(msg); el.classList.add("ms-trade-msg"); bindTrade(c); if (menuCfg().tradeInChat === false || (game.user.getFlag(SYS, "tradeHide") || []).includes(msg.id)) el.style.display = "none"; });
Hooks.on("updateChatMessage", msg => { if (tradeOf(msg)) refreshMenus(); });

/* onglet Échange du Menu */
export function renderTrade(app) {
  const me = app.actor.uuid; const hid = new Set(game.user.getFlag(SYS, "tradeHide") || []);
  const open = game.messages.filter(m => { const t = tradeOf(m); return t && !hid.has(m.id) && (t.a.uuid === me || t.b.uuid === me) && (t.state === "open" || Date.now() - m.timestamp < 864e5); }).sort((a, b) => b.timestamp - a.timestamp);
  return `<div class="ms-mtop ms-ttop"><a class="ms-tnew" data-mact="tNew"><i class="fa-solid fa-right-left"></i><span>Proposer un échange</span></a><span class="ms-mhint">Chacun met ce qu'il propose, puis valide. Toute modification retire les validations ; quand les deux ont validé, le transfert se fait tout seul.</span></div>
    ${game.user.isGM ? tradeGmPanel() : ""}<div class="ms-trades">${open.map(m => tradeCard(m)).join("") || `<div class="ms-mhint big"><i class="fa-solid fa-right-left"></i>Aucun échange en cours.</div>`}</div>`;
}
/* MJ : ce que chaque personnage joueur peut échanger en plus des armes, armures et objets */
function tradeGmPanel() {
  const pcs = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  if (!pcs.length) return "";
  return `<details class="ms-tgm"${game.user.getFlag(SYS, "tradeGmOpen") ? " open" : ""}><summary><i class="fa-solid fa-user-lock"></i> Ce que chaque joueur peut échanger <small>armes, armures et objets : toujours</small></summary>
    <div class="tb"><table><thead><tr><th></th>${Object.values(TRADE_LOCKS).map(([n, ic]) => `<th data-tooltip="${esc(n)}"><i class="fa-solid ${ic}"></i><span>${esc(n)}</span></th>`).join("")}</tr></thead><tbody>
    ${pcs.map(a => { const al = tradeAllow(a); return `<tr data-aid="${a.id}"><td><img src="${esc(a.img)}"><b>${esc(a.name)}</b></td>${Object.keys(TRADE_LOCKS).map(k => `<td><label class="ms-tsw${al[k] ? " on" : ""}"><input type="checkbox" data-tallow="${k}"${al[k] ? " checked" : ""}><i class="fa-solid ${al[k] ? "fa-lock-open" : "fa-lock"}"></i></label></td>`).join("")}</tr>`; }).join("")}</tbody></table></div></details>`;
}
export const bindTradeTab = (app, root) => { bindTrade(root);
  root.querySelector(".ms-tgm")?.addEventListener("toggle", ev => game.user.setFlag(SYS, "tradeGmOpen", ev.target.open));
  root.querySelectorAll("[data-tallow]").forEach(i => i.addEventListener("change", async () => { const a = game.actors.get(i.closest("[data-aid]").dataset.aid); if (!a) return; await a.setFlag(SYS, "tradeAllow", { ...tradeAllow(a), [i.dataset.tallow]: i.checked }); })); };
export async function actTrade(app, act) {
  if (act !== "tNew") return; const a = app.actor; if (!a.isOwner) return;
  const other = await pickPartner(a); if (!other) return; return startTrade(a, other);
}
export async function startTrade(a, other) {
  if (!a?.isOwner || !other) return;
  const t = { id: uid(), a: { uuid: a.uuid, items: [], gold: 0, res: {}, ok: false }, b: { uuid: other, items: [], gold: 0, res: {}, ok: false }, state: "open" };
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: a }), content: `<p>Échange proposé par ${esc(a.name)} à ${esc(actorOf(other)?.name || "?")}.</p>`, flags: { [SYS]: { trade: t } } });
}

async function pickPartner(actor) {
  const { recipientPicker } = await import("./pickers.js");
  const r = await recipientPicker({ title: "Échanger avec…", multi: false, viewer: actor, label: "Avec qui veux-tu échanger ?" });
  return r?.[0] || null;
}
/* choix des objets : rangés par catégorie comme sur la fiche (couleur, icône, effet miroir), quantité avec − / + ; catégories fermées grisées */
async function pickItems(actor, cur = []) {
  if (!actor) return null; const cfg = getConfig(); const has = new Map(cur.map(i => [i.id, i.qty]));
  const roots = cfg.items || []; const by = new Map(); for (const it of actor.items) { const r = rootId(cfg, it); if (!by.has(r)) by.set(r, []); by.get(r).push(it); }
  const order = [...roots.map(r => r.id).filter(id => by.has(id)), ...[...by.keys()].filter(k => !roots.some(r => r.id === k))];
  const navs = [];   /* 1.39.2 : colonne de gauche comme la Boutique — catégories possédées et leurs sous-catégories */
  const sec = id => { const node = roots.find(r => r.id === id) || { name: "Autres", icon: "fa-cube", color: "#8ea0c8" }; const list = by.get(id).sort((a, b) => (b.system.equipped ? 0 : 1) - (a.system.equipped ? 0 : 1) || a.name.localeCompare(b.name, "fr"));
    const lockedCat = TRADE_LOCKS[id] && !tradeAllow(actor)[id];
    const sub2 = i => pathOf(cfg, i.system?.category)[1] || null;
    const cardOf = i => { const q = Math.max(1, Number(i.system.quantity) || 1); const why = tradeBlock(actor, i, cfg); const v = Math.min(q, has.get(i.id) || 0); const rc = rankColor(cfg, i.system.rank);
      return `<div class="tp-it${why ? " lock" : ""}${v ? " sel" : ""}" data-id="${i.id}" data-max="${q}" style="--ic:${esc(node.color || "#8ea0c8")}${rc ? `;--rk:${esc(rc)}` : ""}"><div class="im"><img src="${esc(i.img)}">${i.system.rank ? rankBadge(rankOf(cfg, i.system.rank)) : ""}${i.system.equipped ? `<i class="eq fa-solid fa-shirt" data-tooltip="Équipé"></i>` : ""}</div><b>${esc(i.name)}</b>
        ${why ? `<span class="lk"><i class="fa-solid fa-lock"></i>${esc(why)}</span>` : `<span class="qt"><a data-q="-1"><i class="fa-solid fa-minus"></i></a><input type="number" name="${i.id}" min="0" max="${q}" value="${v}"><a data-q="1"><i class="fa-solid fa-plus"></i></a>${q > 1 ? `<small>/ ${q}</small>` : ""}</span>`}</div>`; };
    /* 1.39 : sous-catégories (Mêlée, Distance… / Tête, Torse…) avec leur petit titre */
    const groups = new Map(); for (const i of list) { const n = sub2(i); const k = n?.id || "_"; if (!groups.has(k)) groups.set(k, { n, l: [] }); groups.get(k).l.push(i); }
    const cards = groups.size <= 1 ? `<div class="tp-grid">${list.map(cardOf).join("")}</div>` : [...groups.values()].sort((x, y) => (x.n ? 0 : 1) - (y.n ? 0 : 1) || String(x.n?.name || "").localeCompare(String(y.n?.name || ""), "fr")).map(g => `<div class="tp-sub" data-sub="${esc(g.n?.id || "_")}"><h6 data-tog><i class="fa-solid fa-chevron-down cv"></i><i class="fa-solid ${esc(iconOf(g.n) || "fa-tag")}"></i>${esc(g.n?.name || "Autres")}<em>${g.l.length}</em></h6><div class="tp-grid">${g.l.map(cardOf).join("")}</div></div>`).join("");
    navs.push({ id, node, n: list.length, subs: groups.size <= 1 ? [] : [...groups.values()].map(g => ({ id: g.n?.id || "_", name: g.n?.name || "Autres", icon: iconOf(g.n) || "fa-tag", n: g.l.length })) });
    return `<section class="tp-cat${lockedCat ? " locked" : ""}" data-root="${esc(id)}" style="--ic:${esc(node.color || "#8ea0c8")}"><header data-tog><i class="fa-solid fa-chevron-down cv"></i><i class="fa-solid ${esc(iconOf(node) || "fa-cube")}"></i><b>${esc(node.name)}</b><em>${list.length}</em>${lockedCat ? `<span class="lk"><i class="fa-solid fa-lock"></i> Verrouillé par le MJ</span>` : ""}</header>${cards}</section>`; };
  const body = order.map(sec).join("") || `<p class="ms-mhint big">Inventaire vide.</p>`;
  const nav = `<nav class="tp-nav"><a class="on" data-nav="all"><i class="fa-solid fa-layer-group"></i><span>Tout</span><em>${actor.items.size}</em></a>${navs.map(x => `<div class="tp-ng" style="--ic:${esc(x.node.color || "#8ea0c8")}"><a data-nav="root" data-root="${esc(x.id)}"><i class="fa-solid ${esc(iconOf(x.node) || "fa-cube")}"></i><span>${esc(x.node.name)}</span><em>${x.n}</em></a>${x.subs.map(u => `<a class="sub" data-nav="sub" data-root="${esc(x.id)}" data-sub="${esc(u.id)}"><i class="fa-solid ${esc(u.icon)}"></i><span>${esc(u.name)}</span><em>${u.n}</em></a>`).join("")}</div>`).join("")}</nav>`;
  return DialogV2.prompt({ window: { title: `Objets proposés — ${actor.name}`, icon: "fa-solid fa-box-open" }, classes: ["ms-dialog", "ms-tdlg", "ms-tpickdlg"], position: { width: 940, height: 680 },
    content: `<div class="tp-head"><img src="${esc(actor.img)}"><div><b>Que proposes-tu ?</b><small>Choisis la quantité de chaque objet. Les catégories verrouillées s'ouvrent quand le MJ l'autorise.</small></div><span class="tp-n"><b>0</b> objet(s)</span></div><div class="tp-wrap">${nav}<div class="tp-body">${body}</div></div>`, rejectClose: false,
    render: (ev, dlg) => { const el = dlg.element ?? dlg; const upd = () => { let n = 0; el.querySelectorAll(".tp-it[data-id]").forEach(c => { const i = c.querySelector("input"); const v = Number(i?.value) || 0; c.classList.toggle("sel", v > 0); n += v; }); const b = el.querySelector(".tp-n b"); if (b) b.textContent = n; };
      el.addEventListener("click", e => { const t = e.target.closest("[data-tog]"); if (t) { e.preventDefault(); t.parentElement.classList.toggle("closed"); return; }
        const nv = e.target.closest("[data-nav]"); if (nv) { e.preventDefault(); el.querySelectorAll(".tp-nav a").forEach(a => a.classList.toggle("on", a === nv)); const k = nv.dataset.nav, R = nv.dataset.root, S = nv.dataset.sub;
          el.querySelectorAll(".tp-cat").forEach(c => { const show = k === "all" || c.dataset.root === R; c.hidden = !show; c.classList.remove("closed"); c.querySelectorAll(".tp-sub").forEach(u => { u.hidden = k === "sub" && u.dataset.sub !== S; u.classList.remove("closed"); }); }); el.querySelector(".tp-body").scrollTop = 0; return; }
        const b = e.target.closest("[data-q]"); const c = e.target.closest(".tp-it:not(.lock)"); if (!c) return; const i = c.querySelector("input"); const max = Number(c.dataset.max) || 1;
        if (b) i.value = Math.max(0, Math.min(max, (Number(i.value) || 0) + Number(b.dataset.q))); else if (!e.target.closest("input")) i.value = (Number(i.value) || 0) > 0 ? 0 : max; upd(); });
      el.addEventListener("input", upd); upd(); },
    ok: { label: "Proposer", icon: "fa-solid fa-check", callback: (ev, btn) => [...btn.form.querySelectorAll('.tp-it:not(.lock) input[type="number"]')].map(i => ({ id: i.name, qty: Math.floor(Number(i.value) || 0) })).filter(x => x.qty > 0) } });
}
/* montant d'une monnaie : boutons rapides (+10… ou 1, 2, 3, 5, 10), tout, remise à zéro */
const isPointsW = r => /^points?_?w$/i.test(String(r.key).replace(/[^a-z_]/gi, "")) || /^points?\s*w$/i.test(String(r.name).trim());
/* 1.39 : Points W — juste le chiffre au milieu et la croix pour quitter (Entrée ou fermer = enregistrer) */
async function askSimple(actor, r, cur) {
  const have = resAmt(actor, r.key); const start = Math.min(have, Number(cur) || 0);
  return new Promise(resolve => { let done = false; const fin = v => { if (done) return; done = true; resolve(v); };
    const read = el => { const v = Math.max(0, Math.min(have, Math.floor(Number(el?.querySelector('[name="v"]')?.value) || 0))); return v; };
    const d = new DialogV2({ window: { title: `${r.name} — ${actor.name}`, icon: `fa-solid ${r.icon || "fa-feather-pointed"}` }, classes: ["ms-dialog", "ms-tdlg", "ms-twdlg"], position: { width: 340 },
      content: `<div class="tw-box" style="--mc:${esc(r.color || "#b980ff")}"><small>${esc(r.name)} proposés <em>(disponible : ${fmt(have)})</em></small><input type="number" name="v" min="0" max="${have}" value="${start}" autofocus></div>`,
      buttons: [{ action: "ok", label: "OK", default: true, callback: (ev, btn) => { fin(read(btn.form)); } }], rejectClose: false });
    let last = start; d.addEventListener("close", () => fin(last)); d.render({ force: true }).then(() => { const i = d.element?.querySelector('[name="v"]'); i?.addEventListener("input", () => { last = read(d.element); }); i?.select(); });
  });
}
async function askRes(actor, key, cur) {
  const r = resList().find(x => x.key === key); if (!r || !actor) return null; if (isPointsW(r)) { const v = await askSimple(actor, r, cur); return v === (Number(cur) || 0) ? null : v; } const have = resAmt(actor, key); const pre = RES_PRESETS(r); const big = pre[0] >= 10;
  const out = await DialogV2.prompt({ window: { title: `${r.name} proposé — ${actor.name}`, icon: `fa-solid ${r.icon || "fa-coins"}` }, classes: ["ms-dialog", "ms-tdlg", "ms-tresdlg"], position: { width: 440 },
    content: `<div class="tr-box" style="--mc:${esc(r.color || "#ffd070")}"><div class="tr-ic"><i class="fa-solid ${esc(r.icon || "fa-coins")}"></i></div><div class="tr-have">Disponible<b>${fmt(have)}</b><small>${esc(r.name)}</small></div>
      <div class="tr-val"><a data-z title="Remettre à zéro"><i class="fa-solid fa-rotate-left"></i></a><input type="number" name="v" min="0" max="${have}" value="${Math.min(have, Number(cur) || 0)}"><a data-all title="Tout">MAX</a></div>
      <div class="tr-pre">${pre.map(n => `<a data-add="${n}">+${fmt(n)}${big ? `<small>${esc(String(r.name || "").trim()[0] || "")}</small>` : ""}</a>`).join("")}</div><div class="tr-pre neg">${pre.map(n => `<a data-add="-${n}">−${fmt(n)}</a>`).join("")}</div><p class="tr-warn" hidden>Tu n'en as pas autant.</p></div>`,
    rejectClose: false,
    render: (ev, dlg) => { const el = dlg.element ?? dlg; const i = el.querySelector('[name="v"]'); const w = el.querySelector(".tr-warn"); const clamp = () => { const v = Math.max(0, Math.floor(Number(i.value) || 0)); w.hidden = v <= have; i.value = Math.min(v, have); };
      el.addEventListener("click", e => { const a = e.target.closest("[data-add],[data-z],[data-all]"); if (!a) return; e.preventDefault(); if (a.dataset.add) { const want = (Number(i.value) || 0) + Number(a.dataset.add); i.value = Math.max(0, want); w.hidden = want <= have; i.value = Math.min(have, Math.max(0, want)); } else if (a.hasAttribute("data-z")) i.value = 0; else i.value = have; });
      i.addEventListener("change", clamp); },
    ok: { label: "Valider", icon: "fa-solid fa-check", callback: (ev, btn) => Math.max(0, Math.min(have, Math.floor(Number(btn.form.elements.v.value) || 0))) } });
  return out === undefined || out === null ? null : out;
}

/* exécution par le MJ */
onGm("trade", async ({ mid, side, op, items, gold, key, amount }, userId) => {
  const msg = game.messages.get(mid); const t = foundry.utils.deepClone(tradeOf(msg)); if (!t || t.state !== "open") return;   /* « executing » / done / cancel : rien à faire */
  const s = side ? t[side] : null; const a = s ? actorOf(s.uuid) : null;
  if (op === "cancel") { if (![t.a, t.b].some(x => userCanActor(userId, actorOf(x.uuid)))) return; t.state = "cancel"; return msg.update({ [`flags.${SYS}.trade`]: t }); }
  if (!a || !userCanActor(userId, a)) return toast(userId, "Ce côté de l'échange ne t'appartient pas.", "warn");
  const cfg = getConfig();
  if (op === "items") { s.items = (items || []).map(x => { const it = a.items.get(x.id); if (!it || tradeBlock(a, it, cfg)) return null; const max = Math.max(1, Number(it.system.quantity) || 1); return { id: it.id, name: it.name, img: it.img, qty: Math.min(max, x.qty), color: rootOf(cfg, it.system?.category)?.color || "" }; }).filter(Boolean); t.a.ok = t.b.ok = false; }
  else if (op === "gold" || op === "res") { const k = op === "gold" ? goldKey() : key; const v = Math.max(0, Math.floor(Number(op === "gold" ? gold : amount) || 0)); const r = resList().find(x => x.key === k); if (!r) return;
    if (v > resAmt(a, k)) return toast(userId, `${a.name} n'a pas assez de ${r.name}.`, "warn"); s.res = { ...sideRes(s), [k]: v }; s.gold = 0; t.a.ok = t.b.ok = false; }
  else if (op === "ok") s.ok = true;
  else if (op === "unok") s.ok = false;   /* idempotent : un second clic ne « dévalide » plus par erreur ; la modification d'un côté remet les deux validations à zéro */
  if (t.a.ok && t.b.ok) {
    /* l'échange est marqué « en cours » AVANT de bouger quoi que ce soit : un second clic qui arriverait quand même tombe sur state !== "open" et ne refait rien */
    t.state = "executing"; await msg.update({ [`flags.${SYS}.trade`]: t });
    const err = await execute(t);
    if (err) { t.a.ok = t.b.ok = false; t.state = "open"; toast(userId, err, "warn"); } else t.state = "done";
  }
  await msg.update({ [`flags.${SYS}.trade`]: t });
});
/* ordre sûr : 1) on retire les objets et l'or des deux côtés (sous verrou des deux personnages), 2) on donne. Si une étape échoue, ce qui a été
 * retiré est rendu : rien ne peut être dupliqué (jamais créé avant d'être retiré) et rien ne reste perdu. */
async function execute(t) {
  const A = actorOf(t.a.uuid), B = actorOf(t.b.uuid); if (!A || !B) return "Un des personnages n'existe plus.";
  const lockBoth = fn => actorLock(A, () => A === B ? fn() : actorLock(B, fn));
  return lockBoth(async () => {
    const RA = sideRes(t.a), RB = sideRes(t.b);
    for (const [s, src, R0] of [[t.a, A, RA], [t.b, B, RB]]) { for (const [k, v] of Object.entries(R0)) if (resAmt(src, k) < (Number(v) || 0)) return `${src.name} n'a plus assez de ${resList().find(r => r.key === k)?.name || k}.`; for (const i of s.items) { const it = src.items.get(i.id); if (!it || (Number(it.system.quantity) || 1) < i.qty) return `${src.name} n'a plus « ${i.name} ».`; } }
    const taken = [];   /* { from, data } pour pouvoir rendre */
    const take = async (s, from) => { for (const i of s.items) { const it = from.items.get(i.id); const q = Math.max(1, Number(it.system.quantity) || 1); const data = it.toObject(); const give = foundry.utils.deepClone(data); delete give._id; give.system.quantity = i.qty; give.system.equipped = false;
        if (i.qty >= q) await it.delete(); else await it.update({ "system.quantity": q - i.qty }); taken.push({ from, back: i.qty >= q ? data : null, id: it.id, qty: i.qty, give }); } };
    const keys = [...new Set([...Object.keys(RA), ...Object.keys(RB)])].filter(k => Number(RA[k]) || Number(RB[k]));
    try {
      await take(t.a, A); await take(t.b, B);
      const subA = {}, subB = {}; for (const k of keys) { if (Number(RA[k])) subA[`system.resources.${k}`] = Math.max(0, resAmt(A, k) - Number(RA[k])); if (Number(RB[k])) subB[`system.resources.${k}`] = Math.max(0, resAmt(B, k) - Number(RB[k])); }
      if (Object.keys(subA).length) await A.update(subA); if (Object.keys(subB).length) await B.update(subB);
      const toB = taken.filter(x => x.from === A).map(x => x.give), toA = taken.filter(x => x.from === B).map(x => x.give);
      if (toB.length) await B.createEmbeddedDocuments("Item", toB); if (toA.length) await A.createEmbeddedDocuments("Item", toA);
      const addA = {}, addB = {}; for (const k of keys) { if (Number(RA[k])) addB[`system.resources.${k}`] = resAmt(B, k) + Number(RA[k]); if (Number(RB[k])) addA[`system.resources.${k}`] = resAmt(A, k) + Number(RB[k]); }
      if (Object.keys(addB).length) await B.update(addB); if (Object.keys(addA).length) await A.update(addA);
      return null;
    } catch (err) {
      console.error(SYS, "échange interrompu, restitution", err);
      try { for (const x of taken) { if (x.back) await x.from.createEmbeddedDocuments("Item", [x.back], { keepId: true }); else { const it = x.from.items.get(x.id); if (it) await it.update({ "system.quantity": (Number(it.system.quantity) || 1) + x.qty }); } } } catch (e2) { console.error(SYS, e2); }
      return `Échange interrompu (${err.message}) : objets rendus, à vérifier sur les fiches.`;
    }
  });
}
/* l'autre côté est prévenu (utile quand les échanges ne s'affichent pas dans le chat) */
Hooks.on("createChatMessage", msg => { const t = tradeOf(msg); if (!t || msg.author?.id === game.user.id) return; const b = actorOf(t.b.uuid); if (b && (game.user.isGM ? !b.hasPlayerOwner : b.isOwner)) ui.notifications.info(`${actorOf(t.a.uuid)?.name || "Quelqu'un"} propose un échange à ${b.name} (Menu › Échange).`); });
