/* Manhwa Sheet — level-up and stat-tier notices (chat message, plus Manhwa Notices module when present) */
import { SYS, getConfig, esc, featureOn, xpNeeded, levelColor } from "./config.js";

function tpl(s, v) { return String(s || "").replace(/\{(\w+)\}/g, (m, k) => (v[k] ?? m)); }
function announce(text, actor, kind) {
  const nm = game.modules.get("notifications-manhwa") || game.modules.get("manhwa-notices");
  if (nm?.active && nm.api?.notify) { try { nm.api.notify({ text, theme: kind === "level" ? "or" : "cyan", font: "system", duration: 7, position: "top", width: 640, chat: false, targets: "all", gmToo: true, top: "SYS::PROGRESSION", bot: "MANHWA.SHEET · STATUS.SYS", sound: "neutral" }); } catch (e) {} }
  const p = getConfig().progression; const chat = kind === "level" ? p.levelUp.chat : p.tierUp.chat;
  if (chat) ChatMessage.create({ content: `<div class="ms-chat ${kind}"><div class="ms-chat-top">SYS::PROGRESSION</div><div class="ms-chat-txt">${esc(text)}</div></div>`, speaker: { alias: "Système" } });
}

Hooks.on("preUpdateActor", (actor, changes, options) => {
  if (!["character", "npc"].includes(actor.type)) return; const cfg = getConfig(); const p = cfg.progression;
  /* automatic level-up from experience : overflow carries over (or resets) */
  const nx = foundry.utils.getProperty(changes, "system.xp");
  if (nx !== undefined && featureOn(cfg, "xp") && cfg.xp.mode === "auto") {
    let xp = Number(nx) || 0, lv = Number(foundry.utils.getProperty(changes, "system.level") ?? actor.system.level) || 0, need = xpNeeded(cfg, lv), guard = 0;
    while (xp >= need && guard++ < 500) { xp = cfg.xp.carry === false ? 0 : xp - need; lv++; need = xpNeeded(cfg, lv); }
    if (lv !== (Number(actor.system.level) || 0)) { foundry.utils.setProperty(changes, "system.level", lv); foundry.utils.setProperty(changes, "system.xp", xp); }
  }
  const nl = foundry.utils.getProperty(changes, "system.level"); if (nl !== undefined && Number(nl) > Number(actor.system.level)) options.msLevelUp = Number(nl);
  const st = foundry.utils.getProperty(changes, "system.stats"); if (st && p.tierEvery > 0) { const ups = []; for (const [k, v] of Object.entries(st)) { const old = Number(actor.system.stats[k]) || 0, nv = Number(v) || 0; if (nv > old && Math.floor((nv - 1) / p.tierEvery) > Math.floor((old - 1) / p.tierEvery)) ups.push({ k, v: nv }); } if (ups.length) options.msTierUp = ups; }
});
Hooks.on("updateActor", (actor, changes, options, userId) => {
  if (userId !== game.user.id) return; const cfg = getConfig(); const p = cfg.progression;
  if (options.msLevelUp && p.levelUp.enabled) levelUp(actor, options.msLevelUp, tpl(p.levelUp.text, { name: actor.name, level: options.msLevelUp }));
  if (options.msTierUp && p.tierUp.enabled) for (const u of options.msTierUp) { const st = cfg.stats.find(x => x.key === u.k); const tier = p.tierNames[Math.min(p.tierNames.length - 1, Math.floor((u.v - 1) / p.tierEvery))] || ""; announce(tpl(p.tierUp.text, { name: actor.name, stat: st?.name || u.k, tier, value: u.v }), actor, "tier"); }
});

/* 1.55 — passage de niveau : notification au centre de l'écran du joueur (Notifications Manhwa) et carte privée dans son chat,
 * avec un bouton « Partager » qui publie l'annonce pour toute la table (une fois). */
function levelUp(actor, lv, text) {
  const owners = game.users.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER")).map(u => u.id);
  const nm = game.modules.get("notifications-manhwa"); const col = levelColor(lv);
  if (nm?.active && nm.api?.notify) { try { nm.api.notify({ text: `{or}NIVEAU ${lv}{/or}\n${actor.name}`, theme: "or", font: "system", duration: 6, position: "center", width: 560, zoom: 1.15, chat: false, targets: owners.length ? owners : "all", gmToo: true, top: "SYS::LEVEL UP", bot: text, sound: "neutral", image: actor.img }); } catch (e) { console.warn(SYS, e); } }
  const cfg = getConfig(); const chat = cfg.progression.levelUp.chat !== false;
  if (!chat) return;
  const whisper = [...new Set([...owners, ...game.users.filter(u => u.isGM).map(u => u.id)])];
  ChatMessage.create({ speaker: { alias: "Système" }, whisper, flags: { [SYS]: { lvUp: { actor: actor.uuid, level: lv, text } } },
    content: lvCard(actor, lv, text, true) });
}
const lvCard = (actor, lv, text, share) => `<div class="ms-lvup" style="--lc:${esc(levelColor(lv))}"><div class="ms-lvup-top">SYS::LEVEL UP</div><div class="ms-lvup-row"><img src="${esc(actor.img)}"><div><b class="n">${esc(actor.name)}</b><span class="lv"><small>NIVEAU</small>${lv}</span></div></div><p>${esc(text)}</p>${share ? `<button type="button" class="ms-lvup-share" data-ms-lvshare><i class="fa-solid fa-share-nodes"></i> Partager dans le chat</button>` : ""}</div>`;
Hooks.on("renderChatMessageHTML", (msg, html) => {
  const d = msg.getFlag(SYS, "lvUp"); const b = html.querySelector?.("[data-ms-lvshare]"); if (!b) return;
  if (!d) { b.remove(); return; }
  const a = fromUuidSync(d.actor); const key = `lvShared.${a?.id}.${d.level}`;
  if (!a || !(game.user.isGM || a.isOwner) || game.user.getFlag(SYS, key)) { b.remove(); return; }
  b.addEventListener("click", async () => { b.disabled = true; await game.user.setFlag(SYS, key, true);
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: a }), content: lvCard(a, d.level, d.text, false) }); b.remove(); });
});
