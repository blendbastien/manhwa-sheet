/* Manhwa Sheet — cadre de groupe permanent, dans un coin de l'écran, comme dans les MMORPG.
 * Portrait, nom, niveau et jauges de chaque membre ; repliable ; un joueur peut quitter le groupe ; le MJ choisit le groupe affiché.
 * Réglages par poste : afficher, replié, coin. */
import { SYS, esc, getConfig, rankOf, gaugeStages, levelColor, narrativeGaugesOn, stageOf, rankBadge } from "./config.js";
import { askUser, onAsk, ownersOf, askCard } from "./asks.js";
import { actorClass, roleOf } from "./classes.js";
import { parties, partiesOf, actorOf, gmDo, onGm, toast, editList, userCanActor, guildOf, guilds, uid } from "./world.js";

const CORNERS = { tl: "En haut à gauche", bl: "En bas à gauche", tr: "En haut à droite", br: "En bas à droite" };
const S = k => game.settings.get(SYS, k);
Hooks.once("init", () => {
  const reg = (k, o) => game.settings.register(SYS, k, { scope: "client", config: false, onChange: () => PartyHud.render(), ...o });
  reg("hudShow", { type: Boolean, default: true }); reg("hudCollapsed", { type: Boolean, default: false }); reg("hudCorner", { type: String, default: "tl" }); reg("hudParty", { type: String, default: "" });
});

const myActor = () => game.user.character ?? game.actors.find(a => a.isOwner && a.type === "character" && a.hasPlayerOwner) ?? null;
function partyForMe() {
  const all = parties(); if (!all.length) return null;
  if (game.user.isGM) return all.find(p => p.id === S("hudParty")) || all[0];
  const me = myActor(); return (me && partiesOf(me)[0]) || all.find(p => p.members.some(m => actorOf(m.uuid)?.isOwner)) || null;
}
const bars = a => { const cfg = getConfig(); const narr = narrativeGaugesOn(cfg); return (cfg.gauges || []).slice(0, 3).map(g => { const v = a.system.gauges?.[g.key] || {}; const st = gaugeStages(g);
  const s = narr ? stageOf(g, v, st.length) : 0; const p = narr ? s / st.length * 100 : (Number(v.max) ? Math.min(100, (Number(v.value) || 0) / Number(v.max) * 100) : 0);
  return `<i class="mph-g" style="--c:${esc(g.color)};--p:${p}%" title="${esc(g.name)} : ${narr ? esc(st[s - 1]) : `${v.value ?? 0} / ${v.max ?? 0}`}"><u></u>${narr ? "" : `<em>${v.value ?? 0}</em>`}</i>`; }).join(""); };

export const PartyHud = {
  el: null,
  render() {
    if (!game.ready) return;
    const p = S("hudShow") ? partyForMe() : null;
    if (!p) { this.el?.remove(); this.el = null; return; }
    if (!this.el) { this.el = document.createElement("div"); this.el.id = "ms-party-hud"; document.body.appendChild(this.el); this.el.addEventListener("click", ev => this.click(ev)); }
    const col = S("hudCollapsed"); const me = myActor(); const cfg = getConfig();
    /* 1.55 : le chef (couronne) en premier, puis les autres dans l'ordre du groupe, numérotés 2, 3, 4… ; le chef (ou le MJ) les réordonne en les glissant */
    const all = p.members.map(m => ({ m, a: actorOf(m.uuid) })).filter(x => x.a);
    const members = [...all.filter(x => x.m.uuid === p.leader), ...all.filter(x => x.m.uuid !== p.leader)];
    const boss = game.user.isGM || (me && p.leader === me.uuid);
    const frames = members.map(({ m, a }, i) => { const rk = rankOf(cfg, a.system.rank); const on = game.users.some(u => u.active && !u.isGM && (u.character?.id === a.id)); const lead = p.leader === m.uuid; const lv = Number(a.system.level) || 0; const lc = levelColor(lv);
      const cl = actorClass(a); const role = cl ? roleOf(cl) : null; const drag = boss && !lead && members.length > 2;
      return `<div class="mph-fr${a.uuid === me?.uuid ? " me" : ""}${lead ? " lead" : ""}" data-uuid="${esc(a.uuid)}" style="--rc:${esc(rk?.color || "#9fb0d4")};--lc:${esc(lc)}"${drag ? ' draggable="true"' : ""}>
        <div class="mph-pic"><img src="${esc(a.img)}">${on ? `<i class="mph-on"></i>` : ""}${lead ? `<i class="fa-solid fa-crown mph-lead"></i>` : `<em class="mph-num">${i + 1}</em>`}<span class="mph-rkb">${rankBadge(rk || { name: "?", color: "#9fb0d4" }, { size: "sm" })}</span></div>
        <div class="mph-inf"><div class="mph-nm"><b>${esc(a.name)}</b><span class="mph-lv"><small>NIV</small>${lv}</span></div>${cl ? `<div class="mph-cl" style="--cc:${esc(role?.color || "#8ea0c8")}"><i class="fa-solid ${esc(cl.icon || role?.icon || "fa-graduation-cap")}"></i>${esc(cl.name)}</div>` : ""}<div class="mph-gs">${bars(a)}</div></div></div>`; }).join("");
    const mine = me && p.members.some(m => m.uuid === me.uuid);
    const gmSel = game.user.isGM && parties().length > 1 ? `<select data-hud="party">${parties().map(x => `<option value="${x.id}"${x.id === p.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : `<b>${esc(p.name)}</b>`;
    this.el.className = `c-${S("hudCorner")}${col ? " col" : ""}`; this.el.style.setProperty("--pc", p.color || "#38e0ff");
    this.el.innerHTML = `<header><i class="fa-solid fa-people-group"></i>${gmSel}<small>${members.length}</small><span class="grow"></span>
      ${!game.user.isGM && mine ? `<a data-hud="leave" title="Quitter le groupe"><i class="fa-solid fa-person-walking-arrow-right"></i></a>` : ""}<a data-hud="corner" title="Changer de coin"><i class="fa-solid fa-arrows-up-down-left-right"></i></a><a data-hud="fold" title="${col ? "Déplier" : "Replier"}"><i class="fa-solid ${col ? "fa-chevron-down" : "fa-chevron-up"}"></i></a><a data-hud="hide" title="Masquer (réaffichable depuis Menu › Groupe)"><i class="fa-solid fa-xmark"></i></a></header>
      ${col ? `<div class="mph-minis">${members.map(({ a }) => `<img src="${esc(a.img)}" title="${esc(a.name)}" data-uuid="${esc(a.uuid)}">`).join("")}</div>` : `<div class="mph-frs">${frames}</div>`}`;
    if (!this._ctxBound) { this._ctxBound = true; this.el.addEventListener("contextmenu", ev => this.ctx(ev)); bindDrag(this); }
    this.el.querySelector('[data-hud="party"]')?.addEventListener("change", e => game.settings.set(SYS, "hudParty", e.target.value));
    this._pid = p.id;
  },
  async click(ev) {
    const a = ev.target.closest("[data-hud]"); const h = a?.dataset.hud;
    if (h === "fold") return game.settings.set(SYS, "hudCollapsed", !S("hudCollapsed"));
    if (h === "hide") return game.settings.set(SYS, "hudShow", false);
    if (h === "corner") { const ks = Object.keys(CORNERS); return game.settings.set(SYS, "hudCorner", ks[(ks.indexOf(S("hudCorner")) + 1) % ks.length]); }
    if (h === "leave") { const me = myActor(); const p = parties().find(x => x.id === this._pid); if (!me || !p) return;
      if (!await foundry.applications.api.DialogV2.confirm({ window: { title: "Quitter le groupe" }, classes: ["ms-dialog"], content: `<p>${esc(me.name)} quitte le groupe <b>${esc(p.name)}</b> ?</p>` })) return; return gmDo("partyLeave", { pid: p.id, actor: me.uuid }); }
    if (h) return;
    const f = ev.target.closest("[data-uuid]"); const act = f && actorOf(f.dataset.uuid);
    if (act && (game.user.isGM || act.testUserPermission(game.user, "OBSERVER"))) act.sheet.render(true);
    else if (act) { const tok = act.getActiveTokens()[0]; if (tok) canvas.animatePan({ x: tok.center.x, y: tok.center.y }); }
  }
};

/* ── 1.55 : clic droit sur un portrait ── */
const closeCtx = () => document.getElementById("mph-ctx")?.remove();
PartyHud.ctx = function (ev) {
  const f = ev.target.closest(".mph-fr[data-uuid], .mph-minis img[data-uuid]"); if (!f) return; ev.preventDefault(); closeCtx();
  const p = parties().find(x => x.id === this._pid); const t = actorOf(f.dataset.uuid); if (!p || !t) return;
  const me = myActor(); const gm = game.user.isGM; const self = me && me.uuid === t.uuid; const boss = gm || (me && p.leader === me.uuid);
  const items = [];
  const add = (k, ic, n, cls = "") => items.push(`<a data-ctx="${k}" class="${cls}"><i class="fa-solid ${ic}"></i>${esc(n)}</a>`);
  if (self) { add("card", "fa-id-card", "Voir ma carte du joueur"); if (boss && !gm) add("tp", "fa-location-arrow", "Proposer une téléportation au groupe"); if (!gm) add("leave", "fa-person-walking-arrow-right", "Quitter le groupe", "red"); }
  else {
    add("card", "fa-id-card", "Voir sa carte du joueur");
    if (me) { add("msg", "fa-comment", "Envoyer un message");
      const fr = (me.system.carnet?.friends || []); const isF = JSON.stringify(fr).includes(t.uuid); if (!isF) add("friend", "fa-user-plus", "Ajouter en ami");
      add("trade", "fa-right-left", "Proposer un échange");
      const g = guildOf(me); const role = g?.members.find(m => m.uuid === me.uuid)?.role; if (g && ["Maître de guilde", "Officier"].includes(role) && !g.members.some(m => m.uuid === t.uuid)) add("guild", "fa-shield-halved", `Inviter dans la guilde ${g.name}`);
      add("show", "fa-share-from-square", "Lui montrer ma carte du joueur"); }
    if (boss && p.leader !== t.uuid) add("kick", "fa-user-xmark", "Exclure du groupe", "red");
  }
  const m = document.createElement("div"); m.id = "mph-ctx"; m.innerHTML = `<header><img src="${esc(t.img)}"><b>${esc(t.name)}</b></header>${items.join("")}`;
  document.body.appendChild(m); const r = m.getBoundingClientRect(); m.style.left = `${Math.min(ev.clientX, innerWidth - r.width - 8)}px`; m.style.top = `${Math.min(ev.clientY, innerHeight - r.height - 8)}px`;
  m.addEventListener("click", e => { const a = e.target.closest("[data-ctx]"); if (!a) return; closeCtx(); ctxAct(a.dataset.ctx, p, t, me); });
  setTimeout(() => document.addEventListener("pointerdown", e => { if (!e.target.closest("#mph-ctx")) closeCtx(); }, { once: true, capture: true }), 0);
};
async function ctxAct(k, p, t, me) {
  if (k === "card") { const { openProfile } = await import("./pcard.js"); return openProfile(t.uuid); }
  if (k === "leave") { if (!await foundry.applications.api.DialogV2.confirm({ window: { title: "Quitter le groupe" }, classes: ["ms-dialog"], content: `<p>${esc(me.name)} quitte le groupe <b>${esc(p.name)}</b> ?</p>` })) return; return gmDo("partyLeave", { pid: p.id, actor: me.uuid }); }
  if (k === "kick") { if (!await foundry.applications.api.DialogV2.confirm({ window: { title: "Exclure du groupe" }, classes: ["ms-dialog"], content: `<p>Exclure <b>${esc(t.name)}</b> du groupe <b>${esc(p.name)}</b> ?</p>` })) return; return gmDo("partyKick", { pid: p.id, target: t.uuid, by: me?.uuid || "" }); }
  if (k === "msg") { const { PhoneApp } = await import("./phone.js"); const app = PhoneApp.open(me); if (!app) return; await new Promise(r => setTimeout(r, 120)); app.view.s.scr = "home"; return app.view.msgTo(t.uuid); }
  if (k === "friend") { const fr = foundry.utils.deepClone(me.system.carnet?.friends || []); fr.push({ id: uid(), name: t.name, uuid: t.uuid }); await me.update({ "system.carnet.friends": fr }); return ui.notifications.info(`${t.name} ajouté à tes amis.`); }
  if (k === "trade") { const { startTrade } = await import("./trade.js"); return startTrade(me, t.uuid); }
  if (k === "guild") { const g = guildOf(me); const us = ownersOf(t); if (!us.length) return ui.notifications.warn(`Le joueur de ${t.name} n'est pas connecté.`);
    const ok = await askUser(us[0].id, { title: "Invitation de guilde", icon: "fa-shield-halved", kind: "guildJoin", data: { gid: g.id, actor: t.uuid, by: me.uuid }, html: askCard(me.img, `<b>${esc(me.name)}</b> t'invite à rejoindre la guilde <b>${esc(g.name)}</b>.`) });
    return ui.notifications.info(ok ? `${t.name} a accepté l'invitation.` : `${t.name} a refusé (ou n'a pas répondu).`); }
  if (k === "show") { const us = ownersOf(t); if (!us.length) return ui.notifications.warn(`Le joueur de ${t.name} n'est pas connecté.`);
    const ok = await askUser(us[0].id, { title: "Carte du joueur", icon: "fa-id-card", kind: "showCard", data: { uuid: me.uuid }, html: askCard(me.img, `<b>${esc(me.name)}</b> veut te montrer sa carte du joueur.`) });
    if (!ok) ui.notifications.info(`${t.name} n'a pas voulu voir ta carte.`); return; }
  if (k === "tp") return groupTeleport(p, me);
}
onAsk("showCard", async ({ uuid }) => { const { openProfile } = await import("./pcard.js"); openProfile(uuid); });
onAsk("guildJoin", data => gmDo("guildJoin", data));
onAsk("tpJoin", () => true);
onGm("guildJoin", async ({ gid, actor, by }, userId) => {
  const t = actorOf(actor), b = actorOf(by); if (!t || !b || !userCanActor(userId, t)) return;
  const g = guilds().find(x => x.id === gid); if (!g || !["Maître de guilde", "Officier"].includes(g.members.find(m => m.uuid === by)?.role)) return toast(userId, "Invitation expirée.", "warn");
  await editList("guilds", l => { for (const x of l) x.members = x.members.filter(m => m.uuid !== actor || x.id === gid); const x = l.find(y => y.id === gid); if (!x) return false; if (!x.members.some(m => m.uuid === actor)) x.members.push({ uuid: actor, role: "Recrue" }); });
  toast(userId, `${t.name} rejoint la guilde ${g.name}.`);
});
/* le chef (ou le MJ) : exclure, réordonner */
const canLead = (userId, p, by) => { const u = game.users.get(userId); if (u?.isGM) return true; const b = actorOf(by); return !!b && p.leader === by && userCanActor(userId, b); };
onGm("partyKick", async ({ pid, target, by }, userId) => {
  const p = parties().find(x => x.id === pid); const t = actorOf(target); if (!p || !t || !canLead(userId, p, by) || p.leader === target) return;
  await editList("parties", l => { const x = l.find(y => y.id === pid); if (!x) return false; x.members = x.members.filter(m => m.uuid !== target); });
  toast(userId, `${t.name} a été exclu du groupe ${p.name}.`); const us = ownersOf(t).map(u => u.id); if (us.length) game.socket.emit(`system.${SYS}`, { op: "mailPing", to: us, text: `Tu as été exclu du groupe ${p.name}.` });
});
onGm("partyOrder", async ({ pid, order, by }, userId) => {
  const p = parties().find(x => x.id === pid); if (!p || !canLead(userId, p, by) || !Array.isArray(order)) return;
  await editList("parties", l => { const x = l.find(y => y.id === pid); if (!x) return false; const idx = u => { const i = order.indexOf(u); return i < 0 ? 999 : i; }; x.members.sort((a, b) => idx(a.uuid) - idx(b.uuid)); });
});
function bindDrag(hud) { let dragU = null;
  hud.el.addEventListener("dragstart", e => { const f = e.target.closest?.(".mph-fr[draggable]"); if (!f) return; dragU = f.dataset.uuid; f.classList.add("drag"); e.dataTransfer.effectAllowed = "move"; });
  hud.el.addEventListener("dragover", e => { if (!dragU) return; const f = e.target.closest(".mph-fr[draggable]"); if (!f || f.dataset.uuid === dragU) return; e.preventDefault(); const src = hud.el.querySelector(`.mph-fr[data-uuid="${CSS.escape(dragU)}"]`); const r = f.getBoundingClientRect(); f[e.clientY > r.top + r.height / 2 ? "after" : "before"](src); });
  hud.el.addEventListener("dragend", () => { if (!dragU) return; dragU = null; const order = [...hud.el.querySelectorAll(".mph-fr[data-uuid]")].map(x => x.dataset.uuid); const me = myActor(); gmDo("partyOrder", { pid: hud._pid, order, by: me?.uuid || "" }); });
}
/* téléportation de groupe : le chef choisit un de ses lieux ; chaque membre accepte ou refuse ; une seule demande au MJ */
async function groupTeleport(p, me) {
  const walk = (ns, out = []) => { for (const n of ns || []) { if (n.folder || n.children?.length) walk(n.children, out); if (!n.folder && n.name) out.push(n); } return out; };
  const places = walk(me?.system.carnet?.places);
  if (!places.length) return ui.notifications.warn("Ajoute d'abord des lieux dans Menu › Téléportation.");
  const pick = await foundry.applications.api.DialogV2.prompt({ window: { title: `Téléportation du groupe ${p.name}`, icon: "fa-solid fa-location-arrow" }, classes: ["ms-dialog"], rejectClose: false,
    content: `<div class="ms-form"><label>Destination<select name="pl">${places.map((n, i) => `<option value="${i}">${esc(n.name)}${n.zone ? ` · ${esc(n.zone)}` : ""}</option>`).join("")}</select></label><p class="ms-mhint">Chaque membre reçoit la proposition et choisit de venir ou non. Le MJ valide ensuite le voyage de tous ceux qui ont accepté.</p></div>`,
    ok: { label: "Proposer", icon: "fa-solid fa-paper-plane", callback: (ev, btn) => Number(btn.form.elements.pl.value) } });
  if (pick == null) return; const pl = places[pick];
  const others = p.members.map(m => actorOf(m.uuid)).filter(a => a && a.uuid !== me?.uuid);
  ui.notifications.info(`Proposition envoyée aux ${others.length} membre(s)…`);
  const res = await Promise.all(others.map(async a => { const u = ownersOf(a)[0]; if (!u) return null; const ok = await askUser(u.id, { title: "Téléportation de groupe", icon: "fa-location-arrow", kind: "tpJoin", html: askCard(me?.img, `<b>${esc(me?.name || "Le chef")}</b> propose au groupe <b>${esc(p.name)}</b> de se téléporter vers<br><b>${esc(pl.name)}</b>${pl.zone ? ` · ${esc(pl.zone)}` : ""}.<br>Tu viens avec <b>${esc(a.name)}</b> ?`) }); return ok ? a.uuid : null; }));
  const go = [me?.uuid, ...res].filter(Boolean);
  return gmDo("tpGroup", { pid: p.id, by: me?.uuid || "", actors: go, place: pl.name, zone: pl.zone || "", refused: others.filter((a, i) => !res[i]).map(a => a.name) });
}
onGm("tpGroup", async ({ pid, by, actors, place, zone, refused = [] }, userId) => {
  const p = parties().find(x => x.id === pid); const user = game.users.get(userId); if (!p || !canLead(userId, p, by)) return;
  const list = (actors || []).map(actorOf).filter(Boolean); if (!list.length) return;
  const where = `<b>${esc(place)}</b>${zone ? ` <span class="z">· ${esc(zone)}</span>` : ""}`;
  let ok = true;
  if (!user?.isGM) { const r = await foundry.applications.api.DialogV2.wait({ window: { title: "Téléportation de groupe", icon: "fa-solid fa-location-arrow" }, classes: ["ms-dialog", "ms-tp-dlg"], rejectClose: false,
      content: `<div class="ms-tp-ask"><div><p>Le groupe <b>${esc(p.name)}</b> demande à être téléporté vers<br>${where}</p><p>${list.map(a => `<img src="${esc(a.img)}" title="${esc(a.name)}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;margin-right:4px">`).join("")}</p>${refused.length ? `<p><small>Restent sur place : ${refused.map(esc).join(", ")}</small></p>` : ""}</div></div>`,
      buttons: [{ action: "yes", label: "Accepter", icon: "fa-solid fa-check", default: true, class: "ok" }, { action: "no", label: "Refuser", icon: "fa-solid fa-xmark", class: "ko" }] }); ok = r === "yes"; }
  const users = new Set([...game.users.filter(u => u.isGM).map(u => u.id)]); for (const a of list) for (const u of game.users) if (!u.isGM && a.testUserPermission(u, "OWNER")) users.add(u.id);
  await ChatMessage.create({ speaker: { alias: p.name }, whisper: [...users], content: `<div class="ms-tp-card ${ok ? "ok" : "ko"}"><i class="fa-solid ${ok ? "fa-circle-check" : "fa-circle-xmark"}"></i><div><small>TÉLÉPORTATION DE GROUPE ${ok ? "ACCEPTÉE" : "REFUSÉE"}</small><p>${list.map(a => esc(a.name)).join(", ")} → ${where}</p>${refused.length ? `<p><small>Restent sur place : ${refused.map(esc).join(", ")}</small></p>` : ""}</div></div>` });
  for (const a of list) Hooks.callAll("manhwaTpState", { actor: a.id, place, ok });
  toast(userId, ok ? `Téléportation du groupe vers « ${place} » acceptée.` : `Téléportation du groupe vers « ${place} » refusée par le MJ.`, ok ? "info" : "error");
});
export const hudCorners = CORNERS;

onGm("partyLeave", async ({ pid, actor }, userId) => {
  const a = actorOf(actor); if (!a || !userCanActor(userId, a)) return; let name = "";
  await editList("parties", l => { const p = l.find(x => x.id === pid); if (!p) return false; name = p.name; p.members = p.members.filter(m => m.uuid !== actor); if (p.leader === actor) p.leader = ""; });
  toast(userId, `${a.name} a quitté le groupe ${name}.`); ui.notifications.info(`${a.name} a quitté le groupe ${name}.`);
});

let _t = null; const soon = () => { clearTimeout(_t); _t = setTimeout(() => PartyHud.render(), 150); };
Hooks.once("ready", () => PartyHud.render());
Hooks.on("updateSetting", s => { if (s.key === `${SYS}.parties` || s.key === `${SYS}.config`) soon(); });
Hooks.on("updateActor", a => { if (PartyHud.el && parties().some(p => p.members.some(m => m.uuid === a.uuid))) soon(); });
Hooks.on("userConnected", soon); Hooks.on("updateUser", soon);
