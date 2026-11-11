/* Manhwa Sheet — Messagerie entre personnages (joueurs et PNJ) : bulles sur verre dépoli.
 * Chaque message est un message de chat chuchoté (expéditeur + propriétaires du destinataire ; le MJ voit tout), marqué
 * flags.manhwa-sheet.dm = { from, to, text }. Le fil se lit dans le Menu ; il s'affiche aussi dans le chat (option). */
import { SYS, esc, kindLabel, isPlayerChar } from "./config.js";
import { menuCfg, actorOf, parties, refreshMenus } from "./world.js";

const DialogV2 = foundry.applications.api.DialogV2;
const dmOf = m => m.flags?.[SYS]?.dm;
const rkey = (me, other) => `${me}|${other}`.replace(/\./g, "_");
const readMap = () => game.user.getFlag(SYS, "mailRead") || {};
const time = ts => { const d = new Date(ts); const today = new Date().toDateString() === d.toDateString(); return today ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); };

export const threadMessages = (me, other) => game.messages.filter(m => { const d = dmOf(m); return d && ((d.from === me && d.to === other) || (d.from === other && d.to === me)); }).sort((a, b) => a.timestamp - b.timestamp);
export function conversations(me) {
  const map = new Map(); const rm = readMap();
  for (const m of game.messages) { const d = dmOf(m); if (!d || (d.from !== me && d.to !== me)) continue; const other = d.from === me ? d.to : d.from;
    const c = map.get(other) || { other, last: 0, text: "", unread: 0 }; if (m.timestamp > c.last) { c.last = m.timestamp; c.text = d.text; }
    if (d.to === me && m.timestamp > (rm[rkey(me, other)] || 0)) c.unread++; map.set(other, c); }
  return [...map.values()].sort((a, b) => b.last - a.last);
}
export const unreadFor = actor => conversations(actor.uuid).reduce((n, c) => n + c.unread, 0);

/* effets de message (joués une fois à l'apparition) et émojis */
export const MAIL_FX = { "": ["Normal", "fa-comment"], shout: ["Crier", "fa-bullhorn"], whisper: ["Chuchoter", "fa-ear-listen"], glow: ["Lumineux", "fa-sun"], shake: ["Tremblant", "fa-burst"], rainbow: ["Arc-en-ciel", "fa-rainbow"], hearts: ["Cœurs", "fa-heart"], boom: ["Explosion", "fa-explosion"], ghost: ["Fantôme", "fa-ghost"], system: ["Système", "fa-terminal"] };
const EMOJIS = "😀 😁 😂 🤣 😊 😍 😘 😎 🤔 😏 😴 😭 😡 🤯 😱 🥶 🥵 😈 💀 👻 🤖 👍 👎 👏 🙏 💪 🤝 ✌️ 👀 ❤️ 💔 💯 🔥 ⚡ ✨ ⭐ 🌙 ☀️ 💧 ❄️ 🌸 🍀 ⚔️ 🗡️ 🛡️ 🏹 🔮 💎 💰 🪙 🧪 📜 🗝️ 🎁 🎉 🏆 👑 ❓ ❗ ✅ ❌".split(" ");
const MAX_IMG = 400 * 1024;
const bodyHTML = d => `${d.img ? `<img class="pic" src="${esc(d.img)}" data-mact="mZoom">` : ""}${d.text ? `<p>${esc(d.text).replace(/\n/g, "<br>")}</p>` : ""}`;

export function renderMail(app) {
  const me = app.actor.uuid; const convs = conversations(me);
  if (app.mailWith === undefined) app.mailWith = convs[0]?.other || null;
  const list = convs.map(c => { const a = actorOf(c.other); return `<a class="ms-conv${c.other === app.mailWith ? " on" : ""}" data-mact="mOpen" data-uuid="${esc(c.other)}"><img src="${esc(a?.img || "icons/svg/mystery-man.svg")}"><span><b>${esc(a?.name || "Inconnu")}</b><small>${esc(String(c.text || "📷 Image").slice(0, 40))}</small></span><em>${time(c.last)}</em>${c.unread ? `<i class="badge">${c.unread}</i>` : ""}</a>`; }).join("");
  let thread = `<div class="ms-mhint big"><i class="fa-solid fa-envelope-open-text"></i>Choisis une conversation ou écris un nouveau message.</div>`;
  if (app.mailWith) {
    const o = actorOf(app.mailWith); const msgs = threadMessages(me, app.mailWith); const fx = app._mailFx || ""; const seen = app._mailSeenTs ?? Date.now(); app._mailSeenTs = Math.max(Date.now(), ...msgs.map(m => m.timestamp));
    const bubbles = msgs.map(m => { const d = dmOf(m); const mine = d.from === me; return `<div class="ms-bub${mine ? " mine" : ""}${m.timestamp > seen ? " new" : ""}${d.fx ? ` fx-${d.fx}` : ""}${d.img && !d.text ? " only-img" : ""}">${mine ? "" : `<img class="av" src="${esc(o?.img || "")}">`}<div class="b">${bodyHTML(d)}<small>${time(m.timestamp)}</small></div></div>`; }).join("");
    thread = `<header class="ms-thead"><img src="${esc(o?.img || "icons/svg/mystery-man.svg")}"><b>${esc(o?.name || "Inconnu")}</b>${o && isPlayerChar(o) ? "<small>Joueur</small>" : ""}</header>
      <div class="ms-bubs">${bubbles || `<div class="ms-mhint">Aucun message. Dis bonjour !</div>`}</div>
      ${app._mailImg ? `<div class="ms-attach"><img src="${esc(app._mailImg.src)}"><span>${esc(app._mailImg.label)}</span><a data-mact="mImgDel" title="Retirer l'image"><i class="fa-solid fa-xmark"></i></a></div>` : ""}
      <div class="ms-pop ms-emojis${app._mailPop === "emoji" ? " open" : ""}">${EMOJIS.map(e => `<a data-mact="mEmoji" data-e="${e}">${e}</a>`).join("")}</div>
      <div class="ms-pop ms-fxs${app._mailPop === "fx" ? " open" : ""}">${Object.entries(MAIL_FX).map(([k, [n, ic]]) => `<a data-mact="mFx" data-fx="${k}" class="${fx === k ? "on" : ""}"><i class="fa-solid ${ic}"></i>${n}</a>`).join("")}</div>
      <footer class="ms-compose"><a class="ms-ctool" data-mact="mPop" data-pop="emoji" title="Émojis"><i class="fa-regular fa-face-smile"></i></a><a class="ms-ctool" data-mact="mPick" title="Envoyer une image (compressée sous 400 ko)"><i class="fa-regular fa-image"></i></a><a class="ms-ctool${fx ? " on" : ""}" data-mact="mPop" data-pop="fx" title="Effet du message : ${esc(MAIL_FX[fx]?.[0] || "Normal")}"><i class="fa-solid ${MAIL_FX[fx]?.[1] || "fa-wand-magic-sparkles"}"></i></a>
        <input type="file" accept="image/*" data-mailfile hidden><textarea rows="1" data-mailtext placeholder="Message…">${esc(app._mailDraft || "")}</textarea><a class="ms-send" data-mact="mSend"><i class="fa-solid fa-paper-plane"></i></a></footer>`;
  }
  return `<div class="ms-mail"><aside class="ms-convs"><a class="ms-mbtn blue full" data-mact="mNew"><i class="fa-solid fa-pen-to-square"></i> Nouveau message</a>${list || `<div class="ms-mhint">Aucune conversation.</div>`}</aside><section class="ms-thread">${thread}</section></div>`;
}

export function bindMail(app, root) {
  const box = root.querySelector(".ms-bubs"); if (box) { box.scrollTop = box.scrollHeight; box.querySelectorAll("img.pic").forEach(i => i.addEventListener("load", () => box.scrollTop = box.scrollHeight, { once: true })); }
  if (app.mailWith) markRead(app.actor.uuid, app.mailWith);
  const ta = root.querySelector("[data-mailtext]");
  if (ta) { ta.addEventListener("keydown", ev => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); send(app, ta.value); } }); ta.addEventListener("input", () => { app._mailDraft = ta.value; ta.style.height = "auto"; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; });
    ta.addEventListener("paste", ev => { const f = [...(ev.clipboardData?.files || [])].find(x => x.type.startsWith("image/")); if (f) { ev.preventDefault(); attach(app, f); } });
    if (app._mailFocus) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); app._mailFocus = false; } }
  const fi = root.querySelector("[data-mailfile]"); fi?.addEventListener("change", () => { const f = fi.files?.[0]; if (f) attach(app, f); });
  const th = root.querySelector(".ms-thread"); th?.addEventListener("dragover", ev => { if ([...(ev.dataTransfer?.items || [])].some(i => i.type.startsWith("image/"))) ev.preventDefault(); });
  th?.addEventListener("drop", ev => { const f = [...(ev.dataTransfer?.files || [])].find(x => x.type.startsWith("image/")); if (f) { ev.preventDefault(); ev.stopPropagation(); attach(app, f); } });
}
async function markRead(me, other) { const k = rkey(me, other); const last = threadMessages(me, other).at(-1)?.timestamp || 0; if (last && (readMap()[k] || 0) < last) await game.user.setFlag(SYS, "mailRead", { [k]: last }); }

export async function actMail(app, act, el) {
  const ta = () => app.element?.querySelector("[data-mailtext]");
  switch (act) {
    case "mOpen": app.mailWith = el.dataset.uuid; app._mailImg = null; app._mailDraft = ""; return app.render();
    case "mSend": return send(app, ta()?.value);
    case "mNew": { const uuid = await pickContact(app.actor); if (!uuid) return; app.mailWith = uuid; app._mailFocus = true; return app.render(); }
    case "mPop": app._mailPop = app._mailPop === el.dataset.pop ? null : el.dataset.pop; app._mailDraft = ta()?.value ?? app._mailDraft; return app.render();
    case "mEmoji": { const t = ta(); const v = t?.value ?? ""; const s = t?.selectionStart ?? v.length; app._mailDraft = v.slice(0, s) + el.dataset.e + v.slice(t?.selectionEnd ?? s); app._mailFocus = true; return app.render(); }
    case "mFx": app._mailFx = el.dataset.fx; app._mailPop = null; app._mailDraft = ta()?.value ?? app._mailDraft; app._mailFocus = true; return app.render();
    case "mPick": app._mailDraft = ta()?.value ?? app._mailDraft; return app.element?.querySelector("[data-mailfile]")?.click();
    case "mImgDel": app._mailImg = null; app._mailDraft = ta()?.value ?? app._mailDraft; return app.render();
    case "mZoom": return new (foundry.applications?.apps?.ImagePopout ?? ImagePopout)({ src: el.getAttribute("src"), window: { title: "Image" } }).render({ force: true });
  }
}

/* ── images : compressées dans le navigateur sous 400 ko, puis envoyées sur le serveur (ou gardées dans le message si l'envoi de fichiers est interdit) ── */
export async function compress(file, maxBytes = MAX_IMG) {
  const bmp = await createImageBitmap(file); let w = bmp.width, h = bmp.height; const k0 = Math.min(1, 1600 / Math.max(w, h)); w = Math.round(w * k0); h = Math.round(h * k0);
  const cv = document.createElement("canvas"); const ctx = cv.getContext("2d"); const webp = document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");
  const type = webp ? "image/webp" : "image/jpeg"; let blob = null;
  for (let pass = 0; pass < 8; pass++) { cv.width = w; cv.height = h; ctx.fillStyle = "#000"; if (type === "image/jpeg") ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h);
    for (const q of [0.86, 0.76, 0.66, 0.56]) { blob = await new Promise(r => cv.toBlob(r, type, q)); if (blob && blob.size <= maxBytes) return { blob, type, w, h }; }
    w = Math.round(w * 0.8); h = Math.round(h * 0.8); }
  return { blob, type, w, h };
}
async function attach(app, file) {
  if (!file.type.startsWith("image/")) return ui.notifications.warn("Seules les images peuvent être envoyées.");
  try {
    ui.notifications.info("Compression de l'image…");
    const { blob, type, w, h } = await compress(file); if (!blob) throw new Error("compression impossible");
    const ext = type === "image/webp" ? "webp" : "jpg"; const name = `${Date.now().toString(36)}-${foundry.utils.randomID(4)}.${ext}`; const label = `${w}×${h} · ${Math.round(blob.size / 1024)} ko`;
    let src = null;
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    if (game.user.can("FILES_UPLOAD")) {
      const forge = typeof ForgeVTT !== "undefined" && ForgeVTT.usingTheForge; const source = forge ? "forgevtt" : "data"; const dir = forge ? "manhwa-mail" : `worlds/${game.world.id}/manhwa-mail`;
      try { await FP.createDirectory(source, dir, {}).catch(() => {}); const r = await FP.upload(source, dir, new File([blob], name, { type }), {}, { notify: false }); src = r?.path || r?.url || null; } catch (e) { console.warn(SYS, "envoi de l'image", e); }
    }
    if (!src) src = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    app._mailImg = { src, label }; app._mailDraft = app.element?.querySelector("[data-mailtext]")?.value ?? app._mailDraft; app._mailFocus = true; app.render();
  } catch (err) { console.error(SYS, err); ui.notifications.error(`Image impossible à envoyer : ${err.message}`); }
}

export async function send(app, text) {
  text = String(text || "").trim(); const img = app._mailImg?.src || ""; if ((!text && !img) || !app.mailWith) return; const from = app.actor; const to = actorOf(app.mailWith); if (!to) return;
  if (!from.isOwner) return ui.notifications.warn("Tu ne peux écrire qu'au nom de tes personnages.");
  const users = new Set([game.user.id, ...game.users.filter(u => !u.isGM && to.testUserPermission(u, "OWNER")).map(u => u.id), ...game.users.filter(u => u.isGM).map(u => u.id)]);
  const d = { from: from.uuid, to: to.uuid, text, img, fx: app._mailFx || "" };
  app._mailImg = null; app._mailDraft = ""; app._mailPop = null; app._mailFx = "";
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: from }), whisper: [...users], content: dmHTML(from, to, d), flags: { [SYS]: { dm: d } } });
  app._mailFocus = true;
}
const dmHTML = (from, to, d) => `<div class="ms-dm${d.fx ? ` fx-${d.fx}` : ""}"><img class="av" src="${esc(from.img)}"><div class="b"><header><b>${esc(from.name)}</b><i class="fa-solid fa-angle-right"></i><span>${esc(to.name)}</span></header>${bodyHTML({ ...d, img: "" })}</div></div>`;   /* l'image est ajoutée à l'affichage depuis les drapeaux (pas de doublon dans le message) */

async function pickContact(actor) {
  const seen = new Set([actor.uuid]); const groups = [];
  const add = (title, icon, list) => { const l = list.filter(a => a && !seen.has(a.uuid) && (game.user.isGM || a.testUserPermission(game.user, "LIMITED") || a.type === "character")); l.forEach(a => seen.add(a.uuid)); if (l.length) groups.push(`<section><h4><i class="fa-solid ${icon}"></i> ${title}</h4><div class="grid">${l.map(a => `<label class="ms-pick"><input type="radio" name="u" value="${a.uuid}"><img src="${esc(a.img)}"><b>${esc(a.name)}</b><small>${kindLabel(a)}</small></label>`).join("")}</div></section>`); };
  const party = parties().filter(p => p.members.some(m => m.uuid === actor.uuid)).flatMap(p => p.members.map(m => actorOf(m.uuid)));
  add("Mon groupe", "fa-people-group", party);
  add("Personnages des joueurs", "fa-user", game.actors.filter(a => a.type === "character" && a.hasPlayerOwner));
  const pm = game.modules.get("pnj-manhwa"); if (pm?.active && pm.api?.getData) for (const g of pm.api.getData().groups || []) add(`PNJ — ${esc(g.name)}`, "fa-masks-theater", (g.members || []).map(id => game.actors.get(id)));
  if (game.user.isGM) add("Tous les acteurs", "fa-users", game.actors.filter(a => ["character", "npc"].includes(a.type)));
  const r = await DialogV2.prompt({ window: { title: "Nouveau message", icon: "fa-solid fa-pen-to-square" }, classes: ["ms-dialog", "ms-menu-dialog"], position: { width: 560 }, content: `<div class="ms-picker-m"><input type="search" class="q" placeholder="Filtrer">${groups.join("") || "<p>Personne à contacter.</p>"}</div>`, rejectClose: false,
    ok: { label: "Écrire", icon: "fa-solid fa-pen", callback: (ev, btn) => btn.form.querySelector('input[name="u"]:checked')?.value || null },
    render: (ev, dlg) => { const e2 = dlg.element ?? dlg; const q = e2.querySelector(".q"); q?.addEventListener("input", () => { const v = q.value.toLowerCase(); e2.querySelectorAll(".ms-pick").forEach(l => l.style.display = l.textContent.toLowerCase().includes(v) ? "" : "none"); }); } });
  return r || null;
}

/* chat : bulles sur verre, ou masqué selon l'option ; notification au destinataire */
Hooks.on("renderChatMessageHTML", (msg, html) => { const d = dmOf(msg); if (!d) return; const el = html instanceof HTMLElement ? html : html?.[0]; if (!el) return; el.classList.add("ms-dm-msg"); if (Date.now() - msg.timestamp < 15000) el.querySelector(".ms-dm")?.classList.add("new"); if (d.img && !el.querySelector(".ms-dm img.pic")) { const b = el.querySelector(".ms-dm .b"); const im = document.createElement("img"); im.className = "pic"; im.src = d.img; b?.querySelector("header")?.after(im); } el.querySelectorAll(".ms-dm img.pic").forEach(im => im.addEventListener("click", () => new (foundry.applications?.apps?.ImagePopout ?? ImagePopout)({ src: im.getAttribute("src"), window: { title: "Image" } }).render({ force: true }))); if (d.from && actorOf(d.from)?.isOwner && !game.user.isGM) el.classList.add("mine"); el.style.display = "none"; });   /* la messagerie ne s'affiche plus dans le chat (1.26.1) : elle vit dans le téléphone */
Hooks.on("createChatMessage", msg => { const d = dmOf(msg); if (!d) return; refreshMenus(); const to = actorOf(d.to);
  if (to && msg.author?.id !== game.user.id && (game.user.isGM ? !to.hasPlayerOwner : to.isOwner)) ui.notifications.info(`Message de ${actorOf(d.from)?.name || "?"} pour ${to.name}`);
  for (const app of foundry.applications.instances.values()) if (app.actor && (app.actor.uuid === d.to || app.actor.uuid === d.from) && app.rendered && app.constructor?.name === "CharacterSheet") app.render(); });
