/* Manhwa Sheet — Quêtes : tableau (cartes), liste ou fenêtre système ; filtres par statut, rang et type ;
 * le MJ crée, coche les objectifs, termine (récompenses versées au groupe selon ses parts) ; un joueur peut accepter une quête disponible. */
import { SYS, esc, getConfig, rankOf, rankPower, rankBadge as rankBadgeHex } from "./config.js";
import { quests, parties, partiesOf, editList, menuCfg, saveMenuCfg, editMenuCfg, uid, actorOf, gmDo, onGm, toast, QUEST_STATUS } from "./world.js";
import { distribute } from "./party.js";

const DialogV2 = foundry.applications.api.DialogV2;
const FP = () => foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
const fmt = n => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const types = () => menuCfg().questTypes;
const typeOf = k => types().find(t => t.key === k) || { key: k, name: k || "—", icon: "fa-scroll", color: "#8ea0c8" };
const VIEWS = { board: ["Tableau", "fa-table-cells-large"], list: ["Liste", "fa-list"], system: ["Fenêtre système", "fa-window-maximize"] };
const STATUS_ICON = { open: "fa-circle-exclamation", active: "fa-person-running", done: "fa-circle-check", failed: "fa-circle-xmark" };

/* une quête (ou un contrat Inter-node) peut viser certains joueurs seulement : targets = [ids] (vide = tout le monde) */
export const questFor = (q, user = game.user) => user.isGM || (q.visible && (!q.targets?.length || q.targets.includes(user.id)));
export const isInternode = q => q.channel === "internode";
const visibleList = () => { const gm = game.user.isGM; return quests().filter(q => questFor(q) && (gm || !isInternode(q))); };   /* les contrats Inter-node vivent dans l'appli du téléphone (le MJ les voit aussi ici) */
/* objectifs : simples (coché / pas coché) ou chiffrés (« 37 / 150 bois ») */
export const objDone = o => Number(o.target) > 0 ? (Number(o.count) || 0) >= Number(o.target) : !!o.done;
const objFrac = o => Number(o.target) > 0 ? Math.min(1, (Number(o.count) || 0) / Number(o.target)) : (o.done ? 1 : 0);
const progress = q => { const o = q.objectives || []; return o.length ? Math.round(o.reduce((a, x) => a + objFrac(x), 0) / o.length * 100) : (q.status === "done" ? 100 : 0); };
const objLine = (o, gm) => { const n = Number(o.target) || 0; const d = objDone(o);
  if (!n) return `<div class="ob${d ? " done" : ""}" data-oid="${o.id}" ${gm ? 'data-mact="qObj"' : ""}><i class="fa-regular ${d ? "fa-square-check" : "fa-square"}"></i><span class="t">${esc(o.text)}</span></div>`;
  const c = Math.max(0, Number(o.count) || 0);
  return `<div class="ob qty${d ? " done" : ""}" data-oid="${o.id}"><i class="fa-regular ${d ? "fa-square-check" : "fa-square"}"></i><span class="t">${esc(o.text)}</span>
    <span class="cnt">${gm ? `<a data-mact="qCnt" data-d="-1" title="−1 (Maj : −10)"><i class="fa-solid fa-minus"></i></a><input type="number" data-objcount min="0" max="${n}" value="${c}">` : `<b>${c}</b>`}<em>/ ${n}</em>${gm ? `<a data-mact="qCnt" data-d="1" title="+1 (Maj : +10)"><i class="fa-solid fa-plus"></i></a>` : ""}</span>
    <i class="bar" style="--p:${Math.round(objFrac(o) * 100)}%"></i></div>`; };
const rankBadge = (cfg, key) => { const r = rankOf(cfg, key); const pw = rankPower(cfg, key); return `<span class="ms-qrank pw${pw}" style="--c:${esc(r?.color || "#fff")}" data-len="${Math.min(4, [...String(r?.name || "")].length)}"><b>${esc(r?.name || "?")}</b></span>`; };
const rewardsLine = q => { const parts = []; if (Number(q.rewards?.xp)) parts.push(`<span class="xp"><i class="fa-solid fa-arrow-trend-up"></i>${fmt(q.rewards.xp)} XP</span>`); if (Number(q.rewards?.gold)) parts.push(`<span class="gd"><i class="fa-solid fa-coins"></i>${fmt(q.rewards.gold)}</span>`); if (q.rewards?.text) parts.push(`<span class="tx"><i class="fa-solid fa-gift"></i>${esc(q.rewards.text)}</span>`); return parts.join(""); };

export function renderQuests(app) {
  const cfg = getConfig(); const gm = game.user.isGM; const mc = menuCfg(); const view = mc.questView || "board";
  const f = app.qf ||= { status: "", rank: "", type: "" };
  const all = visibleList();
  let list = all.filter(q => (!f.status || q.status === f.status) && (!f.rank || q.rank === f.rank) && (!f.type || q.type === f.type));
  const rIdx = k => cfg.ranks.findIndex(r => r.key === k); const sOrd = { active: 0, open: 1, done: 2, failed: 3 };
  list.sort((a, b) => (sOrd[a.status] ?? 9) - (sOrd[b.status] ?? 9) || rIdx(b.rank) - rIdx(a.rank) || String(a.title).localeCompare(String(b.title), "fr"));
  const cnt = fn => all.filter(fn).length;
  const stTabs = [["", "Toutes", "fa-layer-group"], ...Object.entries(QUEST_STATUS).map(([k, v]) => [k, v, STATUS_ICON[k]])].map(([k, v, ic]) => `<a data-mact="qF" data-k="status" data-v="${k}" class="${f.status === k ? "on" : ""} st-${k || "all"}"><i class="fa-solid ${ic}"></i>${v}<small>${cnt(q => !k || q.status === k)}</small></a>`).join("");
  const rankChips = cfg.ranks.filter(r => all.some(q => q.rank === r.key)).map(r => `<a data-mact="qF" data-k="rank" data-v="${r.key}" class="ms-qchip${f.rank === r.key ? " on" : ""}" style="--c:${esc(r.color || "#fff")}">${esc(r.name)}</a>`).join("");
  const typeChips = types().filter(t => all.some(q => q.type === t.key)).map(t => `<a data-mact="qF" data-k="type" data-v="${t.key}" class="ms-qchip${f.type === t.key ? " on" : ""}" style="--c:${esc(t.color)}"><i class="fa-solid ${esc(t.icon)}"></i>${esc(t.name)}</a>`).join("");
  const views = Object.entries(VIEWS).map(([k, [n, ic]]) => `<a data-mact="qView" data-v="${k}" class="${view === k ? "on" : ""}" title="${n}"><i class="fa-solid ${ic}"></i></a>`).join("");
  const head = `<div class="ms-qhead"><nav class="ms-qstatus">${stTabs}</nav><span class="grow"></span>${gm ? `<a class="ms-mbtn blue" data-mact="qNew"><i class="fa-solid fa-plus"></i> Nouvelle quête</a>` : ""}</div>
    ${rankChips || typeChips ? `<div class="ms-qfilters">${rankChips ? `<span class="lbl">Rang</span>${rankChips}` : ""}${typeChips ? `<span class="lbl">Type</span>${typeChips}` : ""}${f.rank || f.type ? `<a data-mact="qClear" class="clr"><i class="fa-solid fa-xmark"></i> filtres</a>` : ""}</div>` : ""}`;
  const q = list.find(x => x.id === app.questId) || null;
  const QS = { neon: mc.questNeon || "rank", col: mc.questNeonColor || "#38c8ff", glow: mc.questGlow || "normal", bold: mc.questBold !== false, font: mc.questFont || "cinzel", fx: mc.questTitleFx || "neon", size: mc.questTitleSize || "m" };
  app._qs = QS; const qc = x => QS.neon === "type" ? typeOf(x.type).color : QS.neon === "fixed" ? QS.col : (rankOf(cfg, x.rank)?.color || "#38c8ff");
  const card = x => { const t = typeOf(x.type); const p = progress(x);
    if (view === "list") return `<div class="ms-qrow st-${x.status}${x.id === app.questId ? " sel" : ""}" data-qid="${x.id}" data-mact="qOpen" style="--qc:${esc(qc(x))};--rc:${esc(rankOf(cfg, x.rank)?.color || "#fff")}">${rankBadge(cfg, x.rank)}<span class="ty" style="--c:${esc(t.color)}"><i class="fa-solid ${esc(t.icon)}"></i></span><b class="qtt">${esc(x.title)}</b>${x.visible ? "" : `<i class="fa-solid fa-eye-slash hid" title="Cachée aux joueurs"></i>`}<span class="pr"><i style="width:${p}%"></i></span><span class="st">${QUEST_STATUS[x.status] || ""}</span></div>`;
    if (view === "system") return `<div class="ms-qsys st-${x.status}${x.id === app.questId ? " sel" : ""}" data-qid="${x.id}" data-mact="qOpen" style="--qc:${esc(qc(x))};--rc:${esc(rankOf(cfg, x.rank)?.color || "#fff")}"><header><i class="fa-solid fa-circle-exclamation"></i><span>${x.status === "done" ? "QUÊTE ACCOMPLIE" : x.status === "failed" ? "QUÊTE ÉCHOUÉE" : "QUÊTE"}</span>${rankBadge(cfg, x.rank)}</header><h3 class="qtt">${esc(x.title)}</h3><p>${esc((x.desc || "").replace(/<[^>]+>/g, " ").slice(0, 140))}</p>${(x.objectives || []).slice(0, 3).map(o => `<div class="ob${objDone(o) ? " done" : ""}"><i class="fa-regular ${objDone(o) ? "fa-square-check" : "fa-square"}"></i>${esc(o.text)}${Number(o.target) ? ` <b class="qnum">${Number(o.count) || 0}/${o.target}</b>` : ""}</div>`).join("")}<footer>${rewardsLine(x)}</footer></div>`;
    return `<div class="ms-qcard st-${x.status} pw${rankPower(cfg, x.rank)}${x.id === app.questId ? " sel" : ""}" data-qid="${x.id}" data-mact="qOpen" style="--tc:${esc(t.color)};--rc:${esc(rankOf(cfg, x.rank)?.color || "#fff")};--qc:${esc(qc(x))}">
      <div class="rib"><i class="fa-solid ${esc(t.icon)}"></i>${esc(t.name)}</div>${rankBadge(cfg, x.rank)}${x.visible ? "" : `<i class="fa-solid fa-eye-slash hid" title="Cachée aux joueurs"></i>`}
      ${x.img ? `<div class="im" style="background-image:url('${esc(x.img)}')"></div>` : ""}
      <h3 class="qtt">${esc(x.title)}</h3><div class="meta">${x.giver ? `<span><i class="fa-solid fa-user"></i>${esc(x.giver)}</span>` : ""}${x.location ? `<span><i class="fa-solid fa-location-dot"></i>${esc(x.location)}</span>` : ""}</div>
      <div class="pr"><i style="width:${p}%"></i><small class="qnum">${(x.objectives || []).filter(objDone).length} / ${(x.objectives || []).length}</small></div>
      <footer>${rewardsLine(x)}<span class="st"><i class="fa-solid ${STATUS_ICON[x.status]}"></i>${QUEST_STATUS[x.status] || ""}</span></footer></div>`; };
  const body = list.length ? `<div class="ms-qlist v-${view}">${list.map(card).join("")}</div>` : `<div class="ms-mhint big"><i class="fa-solid fa-scroll"></i>${all.length ? "Aucune quête pour ces filtres." : gm ? "Aucune quête. Crée la première." : "Aucune quête pour l'instant."}</div>`;
  /* 1.52 : le détail s'ouvre en panneau par-dessus la liste (la grille ne bouge plus) */
  return `<div class="ms-qroot qf-${QS.font} qx-${QS.fx} qs-${QS.size} qg-${QS.glow}${QS.bold ? " qbold" : ""}">${head}<div class="ms-qwrap${q ? " has-detail" : ""}"><div class="ms-qdock">${q ? detail(app, q, qc(q)) : ""}</div>${body}</div></div>`;
}

function detail(app, q, qcol = "") {
  const cfg = getConfig(); const gm = game.user.isGM; const t = typeOf(q.type); const p = parties().find(x => x.id === q.party);
  const objs = (q.objectives || []).map(o => objLine(o, gm)).join("");
  const mineParty = partiesOf(app.actor)[0];
  return `<aside class="ms-qdetail st-${q.status}" style="--tc:${esc(t.color)};--qc:${esc(qcol || t.color)};--rc:${esc(rankOf(cfg, q.rank)?.color || "#fff")}">
    <header>${rankBadge(cfg, q.rank)}<div><span class="ty"><i class="fa-solid ${esc(t.icon)}"></i>${esc(t.name)}</span><h2 class="qtt">${esc(q.title)}</h2></div><a data-mact="qClose" class="x"><i class="fa-solid fa-xmark"></i></a></header>
    ${q.img ? `<img class="im" src="${esc(q.img)}">` : ""}
    <div class="meta">${q.giver ? `<span><i class="fa-solid fa-user"></i>${esc(q.giver)}</span>` : ""}${q.location ? `<span><i class="fa-solid fa-location-dot"></i>${esc(q.location)}</span>` : ""}${q.deadline ? `<span><i class="fa-solid fa-hourglass-half"></i>${esc(q.deadline)}</span>` : ""}<span><i class="fa-solid ${STATUS_ICON[q.status]}"></i>${QUEST_STATUS[q.status] || ""}</span>${p ? `<span><i class="fa-solid fa-people-group"></i>${esc(p.name)}</span>` : ""}</div>
    ${q.desc ? `<div class="desc">${q.desc}</div>` : ""}
    ${objs ? `<h4>Objectifs</h4><div class="obs">${objs}</div>` : ""}
    ${rewardsLine(q) ? `<h4>Récompenses</h4><div class="rw">${rewardsLine(q)}</div>` : ""}
    <footer>${!gm && q.status === "open" ? `<a class="ms-mbtn green" data-mact="qAccept"><i class="fa-solid fa-check"></i> Accepter${mineParty ? ` pour ${esc(mineParty.name)}` : ""}</a>` : ""}
      ${gm ? `<a class="ms-mbtn blue" data-mact="qEdit"><i class="fa-solid fa-pen"></i> Modifier</a>
        ${q.status !== "done" ? `<a class="ms-mbtn green" data-mact="qDone"><i class="fa-solid fa-flag-checkered"></i> Terminer${Number(q.rewards?.xp) || Number(q.rewards?.gold) ? " et récompenser" : ""}</a>` : ""}
        ${q.status !== "failed" && q.status !== "done" ? `<a class="ms-mbtn red" data-mact="qFail"><i class="fa-solid fa-circle-xmark"></i> Échouée</a>` : ""}
        ${q.status === "done" || q.status === "failed" ? `<a class="ms-mbtn ghost" data-mact="qReopen"><i class="fa-solid fa-rotate-left"></i> Rouvrir</a>` : ""}
        <a class="ms-mbtn ghost" data-mact="qVis"><i class="fa-solid ${q.visible ? "fa-eye" : "fa-eye-slash"}"></i> ${q.visible ? "Visible" : "Cachée"}</a>
        <a class="ms-mbtn ghost" data-mact="qShow" title="Annoncer dans le chat"><i class="fa-solid fa-bullhorn"></i></a>
        <a class="ms-mbtn red" data-mact="qDel" title="Supprimer"><i class="fa-solid fa-trash"></i></a>` : ""}</footer></aside>`;
}

export function bindQuests(app, root) {
  if (!app._qEsc) { app._qEsc = ev => { if (ev.key === "Escape" && app.questId && app.element?.querySelector?.(".ms-qdetail") && !ev.target.closest?.("input, textarea")) { ev.stopPropagation(); app.questId = null; app.render(); } }; document.addEventListener("keydown", app._qEsc, true); }
  root.querySelectorAll("[data-objcount]").forEach(inp => inp.addEventListener("change", () => { const oid = inp.closest("[data-oid]").dataset.oid; const qid = app.questId;
    editList("quests", l => { const o = l.find(x => x.id === qid)?.objectives?.find(x => x.id === oid); if (!o) return false; o.count = Math.max(0, Math.min(Number(o.target) || Infinity, Math.floor(Number(inp.value) || 0))); }); }));
}
export async function actQuests(app, act, el, ev) {
  const qid = el.closest("[data-qid]")?.dataset.qid || app.questId; const upd = fn => editList("quests", l => { const q = l.find(x => x.id === qid); if (!q) return false; return fn(q, l); });
  switch (act) {
    case "qF": { const k = el.dataset.k, v = el.dataset.v; app.qf[k] = app.qf[k] === v && k !== "status" ? "" : v; return app.render(); }
    case "qClear": app.qf.rank = app.qf.type = ""; return app.render();
    case "qView": app.qView = el.dataset.v; if (game.user.isGM) await editMenuCfg(c => { c.questView = el.dataset.v; }); return app.render();
    case "qOpen": app.questId = app.questId === qid ? null : qid; return app.render();
    case "qClose": app.questId = null; return app.render();
    case "qNew": { const q = await editQuest(null); if (!q) return; await editList("quests", l => { l.unshift(q); }); app.questId = q.id; return; }
    case "qEdit": { const cur = quests().find(x => x.id === qid); const q = await editQuest(cur); if (!q) return; return upd(x => Object.assign(x, q)); }
    case "qCnt": { const oid = el.closest("[data-oid]")?.dataset.oid; const step = (Number(el.dataset.d) || 1) * (ev?.shiftKey ? 10 : 1);
      return upd(q => { const o = q.objectives.find(x => x.id === oid); if (!o) return false; o.count = Math.max(0, Math.min(Number(o.target) || Infinity, (Number(o.count) || 0) + step)); }); }
    case "qObj": { const oid = el.dataset.oid; return upd(q => { const o = q.objectives.find(x => x.id === oid); if (o) o.done = !o.done; }); }
    case "qVis": return upd(q => { q.visible = !q.visible; });
    case "qFail": await upd(q => { q.status = "failed"; }); return announce(qid, "failed");
    case "qReopen": return upd(q => { q.status = "active"; });
    case "qDel": { const q = quests().find(x => x.id === qid); if (!q || !await DialogV2.confirm({ window: { title: "Supprimer la quête" }, classes: ["ms-dialog"], content: `<p>Supprimer <b>${esc(q.title)}</b> ?</p>` })) return; app.questId = null; return editList("quests", l => { l.splice(l.findIndex(x => x.id === qid), 1); }); }
    case "qShow": return announce(qid, "show");
    case "qAccept": return gmDo("questAccept", { qid, actor: app.actor.uuid });
    case "qDone": {
      const q = quests().find(x => x.id === qid); if (!q) return;
      /* le passage à « terminée » est vérifié DANS l'écriture : un double clic (ou deux MJ) ne verse les récompenses qu'une fois */
      const r = await upd(x => { if (x.status === "done") return false; x.status = "done"; (x.objectives || []).forEach(o => { o.done = true; if (Number(o.target)) o.count = Number(o.target); }); });
      if (!r?.changed) return;
      const p = parties().find(x => x.id === q.party);
      if ((Number(q.rewards?.xp) || Number(q.rewards?.gold)) && p) await distribute({ members: p.members.map(m => ({ actor: actorOf(m.uuid), xp: m.xp, gold: m.gold })), xp: Number(q.rewards.xp) || 0, gold: Number(q.rewards.gold) || 0, mode: "shares", label: `Quête : ${q.title}` });
      else if ((Number(q.rewards?.xp) || Number(q.rewards?.gold)) && actorOf(q.agent)) await distribute({ members: [{ actor: actorOf(q.agent), xp: 100, gold: 100 }], xp: Number(q.rewards.xp) || 0, gold: Number(q.rewards.gold) || 0, mode: "full", label: `${isInternode(q) ? "Contrat" : "Quête"} : ${q.title}` });
      else if (Number(q.rewards?.xp) || Number(q.rewards?.gold)) ui.notifications.warn("Aucun groupe associé à la quête : les récompenses n'ont pas été versées (bouton Récompenses pour le faire à la main).");
      return announce(qid, "done");
    }
  }
}

async function announce(qid, kind) {
  const q = quests().find(x => x.id === qid); if (!q) return; const cfg = getConfig(); const t = typeOf(q.type);
  const head = { show: "NOUVELLE QUÊTE", done: "QUÊTE ACCOMPLIE", failed: "QUÊTE ÉCHOUÉE" }[kind];
  await ChatMessage.create({ speaker: { alias: "Système" }, content: `<div class="ms-syscard quest k-${kind}"><header><i class="fa-solid ${kind === "done" ? "fa-flag-checkered" : kind === "failed" ? "fa-circle-xmark" : "fa-circle-exclamation"}"></i><b>${head}</b>${rankBadge(cfg, q.rank)}</header><h3>${esc(q.title)}</h3><div class="ty" style="--c:${esc(t.color)}"><i class="fa-solid ${esc(t.icon)}"></i>${esc(t.name)}</div>${kind === "show" && q.desc ? `<p>${esc(q.desc.replace(/<[^>]+>/g, " ").slice(0, 220))}</p>` : ""}${rewardsLine(q) ? `<footer>${rewardsLine(q)}</footer>` : ""}</div>` });
}

/* éditeur (MJ) — 1.50 : DA des menus (bandeau, sections), rang en badges hexagonaux, type / statut en puces,
 * objectifs en lignes simples (case « fait », texte brut, bouton # pour un objectif chiffré, poignée pour réordonner) */
const ST_LOOK = { open: ["fa-circle-exclamation", "#38a8ff"], active: ["fa-person-running", "#ffc63d"], done: ["fa-circle-check", "#3ddc84"], failed: ["fa-circle-xmark", "#ff4d6a"] };
const objRow = (o = {}) => { const n = Number(o.target) || 0;
  return `<div class="qo${n ? " num" : ""}" draggable="true"><span class="qo-h" title="Glisser pour réordonner"><i class="fa-solid fa-grip-vertical"></i></span>
    <label class="qo-d" title="Fait"><input type="checkbox" class="qo-done"${o.done && !n ? " checked" : ""}><i class="fa-solid fa-check"></i></label>
    <input type="text" class="qo-t" value="${esc(o.text || "")}" placeholder="${n ? "ex. Récupérer du bois" : "ex. Parler au forgeron"}" autocomplete="off">
    <span class="qo-n"><input type="number" class="qo-c" min="0" value="${Math.max(0, Number(o.count) || 0)}" title="Déjà fait"><em>/</em><input type="number" class="qo-g" min="1" value="${n || 10}" title="Objectif"></span>
    <a class="qo-num" title="Objectif chiffré (ex. 37 / 150)">#</a><a class="qo-x" title="Supprimer"><i class="fa-solid fa-xmark"></i></a></div>`; };
export async function editQuest(cur, preset = {}) {
  const cfg = getConfig(); const q = foundry.utils.mergeObject({ id: uid(), title: "", rank: cfg.ranks[0]?.key || "", type: "side", status: "open", giver: "", location: "", deadline: "", img: "", desc: "", objectives: [], rewards: { xp: 0, gold: 0, text: "" }, party: "", visible: true, channel: "", targets: [], ...preset }, foundry.utils.deepClone(cur || {}), { inplace: false });
  const players = game.users.filter(u => !u.isGM);
  const opt = (list, v) => list.map(x => `<option value="${esc(x[0])}"${x[0] === v ? " selected" : ""}>${esc(x[1])}</option>`).join("");
  const rk0 = rankOf(cfg, q.rank) || cfg.ranks[0] || {};
  const ranks = cfg.ranks.map(r => `<label class="qe-rk${r.key === q.rank ? " on" : ""}" style="--rc:${esc(r.color || "#9fb0d4")}" title="Rang ${esc(r.name)}"><input type="radio" name="rank" value="${esc(r.key)}"${r.key === q.rank ? " checked" : ""}>${rankBadgeHex(r, { size: "lg" })}</label>`).join("");
  const chips = (name, list, v) => list.map(([k, label, ic, col]) => `<label class="qe-chip${k === v ? " on" : ""}" style="--k:${esc(col)}"><input type="radio" name="${name}" value="${esc(k)}"${k === v ? " checked" : ""}><i class="fa-solid ${esc(ic)}"></i>${esc(label)}</label>`).join("");
  const content = `<div class="ms-qedit2">
    <div class="ms-eqhead qe-head" style="--c:${esc(rk0.color || "#ffc63d")}"><i class="fa-solid fa-scroll"></i><div><b data-qhtitle>${esc(q.title || (cur ? "Quête" : "Nouvelle quête"))}</b></div><span class="qe-hrk" data-qhrk>${rankBadgeHex(rk0, { size: "lg" })}</span></div>
    <section class="qe-sec"><h4><i class="fa-solid fa-pen-nib"></i> Quête</h4>
      <input type="text" name="title" class="qe-title" value="${esc(q.title)}" placeholder="Titre de la quête" autofocus>
      <div class="qe-lbl">Rang</div><div class="qe-rks">${ranks}</div>
      <div class="qe-lbl">Type</div><div class="qe-chips">${chips("type", types().map(t => [t.key, t.name, t.icon, t.color]), q.type)}</div>
      <div class="qe-lbl">Statut</div><div class="qe-chips">${chips("status", Object.entries(QUEST_STATUS).map(([k, v]) => [k, v, ST_LOOK[k]?.[0] || "fa-circle", ST_LOOK[k]?.[1] || "#9fb0d4"]), q.status)}</div>
      <div class="qe-grid">
        <label><span><i class="fa-solid fa-user-tie"></i> Donneur</span><input type="text" name="giver" value="${esc(q.giver)}"></label>
        <label><span><i class="fa-solid fa-location-dot"></i> Lieu</span><input type="text" name="location" value="${esc(q.location)}"></label>
        <label><span><i class="fa-solid fa-hourglass-half"></i> Délai</span><input type="text" name="deadline" value="${esc(q.deadline)}" placeholder="ex. 3 jours"></label>
        <label><span><i class="fa-solid fa-people-group"></i> Groupe</span><select name="party"><option value="">—</option>${opt(parties().map(p => [p.id, p.name]), q.party)}</select></label>
      </div></section>
    <section class="qe-sec"><h4><i class="fa-solid fa-eye"></i> Visibilité</h4>
      <div class="qe-row"><label class="qe-tog"><input type="checkbox" name="visible"${q.visible ? " checked" : ""}><span></span> Visible des joueurs</label>
        <div class="qe-chips sm">${chips("channel", [["", "Quêtes (Menu)", "fa-scroll", "#38a8ff"], ["internode", "Inter-node (téléphone)", "fa-mobile-screen", "#ff8af0"]], q.channel || "")}</div></div>
      <div class="qe-lbl">Pour quels joueurs ? <small>aucun = tous</small></div>
      <div class="qe-chips sm">${players.map(u => `<label class="qe-chip${(q.targets || []).includes(u.id) ? " on" : ""}" style="--k:${esc(u.color?.css ?? u.color ?? "#8ea0c8")}"><input type="checkbox" name="tgt" value="${u.id}"${(q.targets || []).includes(u.id) ? " checked" : ""}><i class="fa-solid fa-user"></i>${esc(u.name)}</label>`).join("") || "<em>Aucun joueur.</em>"}</div></section>
    <section class="qe-sec qe-media"><h4><i class="fa-solid fa-image"></i> Image & description</h4>
      <div class="qe-imgrow"><span class="qe-prev" data-qprev>${q.img ? `<img src="${esc(q.img)}">` : `<i class="fa-solid fa-image"></i>`}</span><div class="qe-imgin"><span class="row"><input type="text" name="img" value="${esc(q.img)}" placeholder="Chemin de l'image"><button type="button" class="browse" title="Parcourir"><i class="fa-solid fa-folder-open"></i></button></span>
      <textarea name="desc" rows="4" placeholder="Ce que les joueurs lisent sur la quête…"></textarea></div></div></section>
    <section class="qe-sec"><h4><i class="fa-solid fa-list-check"></i> Objectifs <small>Entrée = nouvelle ligne · # = objectif chiffré</small></h4>
      <div class="qe-objs" data-qobjs>${(q.objectives || []).map(objRow).join("")}</div>
      <div class="qe-add"><a data-qadd="0"><i class="fa-solid fa-plus"></i> Objectif</a><a data-qadd="1"><i class="fa-solid fa-hashtag"></i> Objectif chiffré</a></div></section>
    <section class="qe-sec"><h4><i class="fa-solid fa-gift"></i> Récompenses</h4>
      <div class="qe-rw"><label class="xp"><span><i class="fa-solid fa-arrow-trend-up"></i> XP</span><input type="number" name="xp" value="${Number(q.rewards.xp) || 0}" min="0"></label>
        <label class="gd"><span><i class="fa-solid fa-coins"></i> Gold</span><input type="number" name="gold" value="${Number(q.rewards.gold) || 0}" min="0"></label>
        <label class="tx"><span><i class="fa-solid fa-gem"></i> Autres</span><input type="text" name="rtext" value="${esc(q.rewards.text)}" placeholder="ex. Épée de givre, titre « Tueur de loups »"></label></div></section></div>`;
  const r = await DialogV2.prompt({ window: { title: cur ? "Modifier la quête" : "Nouvelle quête", icon: "fa-solid fa-scroll", resizable: true }, classes: ["ms-dialog", "ms-menu-dialog", "ms-eqdlg", "ms-qedlg"], position: { width: 720, height: Math.min(900, innerHeight - 60) }, content, rejectClose: false,
    ok: { label: "Enregistrer", icon: "fa-solid fa-check", callback: (ev, btn) => { const f = btn.form.elements; const form = btn.form; const old = q.objectives || []; const val = n => form.querySelector(`input[name="${n}"]:checked`)?.value ?? "";
      const objectives = [...form.querySelectorAll(".qo")].map(row => { const text = row.querySelector(".qo-t").value.trim(); if (!text) return null; const num = row.classList.contains("num");
        const prev = old.find(o => o.text === text); const o = { id: prev?.id || uid(), text, done: !num && row.querySelector(".qo-done").checked };
        if (num) { const target = Math.max(1, Number(row.querySelector(".qo-g").value) || 1); o.target = target; o.count = Math.min(target, Math.max(0, Number(row.querySelector(".qo-c").value) || 0)); } return o; }).filter(Boolean);
      return { id: q.id, channel: val("channel"), targets: [...form.querySelectorAll('input[name="tgt"]:checked')].map(i => i.value), agent: q.agent || "", title: f.title.value.trim() || "Quête sans nom", rank: val("rank") || q.rank, type: val("type") || q.type, status: val("status") || q.status, party: f.party.value, giver: f.giver.value.trim(), location: f.location.value.trim(), deadline: f.deadline.value.trim(), visible: f.visible.checked, img: f.img.value.trim(), desc: f.desc.value.trim().replace(/\n/g, "<br>"), objectives, rewards: { xp: Number(f.xp.value) || 0, gold: Number(f.gold.value) || 0, text: f.rtext.value.trim() } }; } },
    render: (ev, dlg) => { const el = dlg.element ?? dlg; const box = el.querySelector("[data-qobjs]");
      el.querySelector('[name="desc"]').value = String(q.desc || "").replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "");
      const prev = () => { const v = el.querySelector('[name="img"]').value.trim(); el.querySelector("[data-qprev]").innerHTML = v ? `<img src="${esc(v)}">` : `<i class="fa-solid fa-image"></i>`; };
      el.querySelector(".browse")?.addEventListener("click", () => { const inp = el.querySelector('[name="img"]'); new (FP())({ type: "image", current: inp.value, callback: p => { inp.value = p; prev(); } }).render(true); });
      el.querySelector('[name="img"]').addEventListener("change", prev);
      el.querySelector('[name="title"]').addEventListener("input", e => { el.querySelector("[data-qhtitle]").textContent = e.target.value || "Nouvelle quête"; });
      const add = (num, after) => { const t = document.createElement("div"); t.innerHTML = objRow(num ? { target: 10, count: 0 } : {}); const row = t.firstElementChild; after ? after.after(row) : box.appendChild(row); row.querySelector(".qo-t").focus(); return row; };
      el.addEventListener("change", e => { const i = e.target; if (i.matches('input[type="radio"]')) { el.querySelectorAll(`input[name="${i.name}"]`).forEach(x => x.closest("label")?.classList.toggle("on", x.checked));
          if (i.name === "rank") { const r2 = rankOf(cfg, i.value); el.querySelector("[data-qhrk]").innerHTML = rankBadgeHex(r2, { size: "lg" }); el.querySelector(".qe-head").style.setProperty("--c", r2?.color || "#ffc63d"); } }
        if (i.matches('input[name="tgt"]')) i.closest("label").classList.toggle("on", i.checked);
        if (i.matches(".qo-c, .qo-g")) { const row = i.closest(".qo"); const g = Math.max(1, Number(row.querySelector(".qo-g").value) || 1); const c = row.querySelector(".qo-c"); if (Number(c.value) > g) c.value = g; if (Number(c.value) < 0) c.value = 0; } });
      el.addEventListener("click", e => { const a = e.target.closest("[data-qadd]"); if (a) { e.preventDefault(); add(a.dataset.qadd === "1"); return; }
        const x = e.target.closest(".qo-x"); if (x) { e.preventDefault(); x.closest(".qo").remove(); return; }
        const nb = e.target.closest(".qo-num"); if (nb) { e.preventDefault(); const row = nb.closest(".qo"); row.classList.toggle("num"); if (row.classList.contains("num")) row.querySelector(".qo-g").focus(); return; } });
      el.addEventListener("keydown", e => { const t = e.target; if (!t.matches?.(".qo-t, .qo-c, .qo-g")) return;
        if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); const row = t.closest(".qo"); add(row.classList.contains("num"), row); }
        if (e.key === "Backspace" && t.matches(".qo-t") && !t.value) { const row = t.closest(".qo"); const p = row.previousElementSibling; if (p) { e.preventDefault(); row.remove(); p.querySelector(".qo-t").focus(); } } });
      /* glisser-déposer pour réordonner (la poignée seulement) */
      let drag = null;
      box.addEventListener("pointerdown", e => { const h = e.target.closest(".qo-h"); box.querySelectorAll(".qo").forEach(r0 => r0.draggable = false); if (h) h.closest(".qo").draggable = true; });
      box.addEventListener("dragstart", e => { drag = e.target.closest(".qo"); if (!drag?.draggable) { e.preventDefault(); return; } drag.classList.add("drag"); e.dataTransfer.effectAllowed = "move"; });
      box.addEventListener("dragover", e => { if (!drag) return; e.preventDefault(); const over = e.target.closest(".qo"); if (!over || over === drag) return; const r0 = over.getBoundingClientRect(); over[e.clientY > r0.top + r0.height / 2 ? "after" : "before"](drag); });
      box.addEventListener("dragend", () => { drag?.classList.remove("drag"); drag = null; });
      if (!box.children.length) { add(false); el.querySelector('[name="title"]').focus(); } } });
  return r || null;
}

/* le MJ exécute l'acceptation demandée par un joueur */
onGm("questAccept", async ({ qid, actor }, userId) => {
  const a = actorOf(actor); let name = "";
  const u = game.users.get(userId);
  await editList("quests", l => { const q = l.find(x => x.id === qid); if (!q || q.status !== "open" || (u && !questFor(q, u))) return false; q.status = "active"; if (!q.party) q.party = partiesOf(a)[0]?.id || ""; if (a) q.agent = a.uuid; name = q.title; });
  if (name) { toast(userId, `Quête acceptée : ${name}`); ui.notifications.info(`${a?.name || "Un joueur"} a accepté la quête « ${name} ».`); }
});
