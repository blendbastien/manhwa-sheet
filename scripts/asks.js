/* Manhwa Sheet 1.55 — demandes d'un joueur à un autre joueur (Accepter / Refuser), sans passer par le MJ.
 * askUser(userId, { title, html, icon, kind, data }) → Promise<boolean> ; à l'acceptation, le gestionnaire onAsk(kind) tourne chez le destinataire. */
import { SYS, esc } from "./config.js";
const WAIT = new Map(); const ON = {};
export function onAsk(kind, fn) { ON[kind] = fn; }
const rid = () => foundry.utils.randomID(12);
async function prompt({ title, html, icon }) {
  const r = await foundry.applications.api.DialogV2.wait({ window: { title: title || "Demande", icon: `fa-solid ${icon || "fa-circle-question"}` }, classes: ["ms-dialog", "ms-askdlg"], position: { width: 420 }, rejectClose: false,
    content: `<div class="ms-ask">${html || ""}</div>`,
    buttons: [{ action: "yes", label: "Accepter", icon: "fa-solid fa-check", default: true, class: "ok" }, { action: "no", label: "Refuser", icon: "fa-solid fa-xmark", class: "ko" }] });
  return r === "yes";
}
async function receive(m) { const ok = await prompt(m); if (ok) { try { await ON[m.kind]?.(m.data || {}, m.from); } catch (e) { console.error(SYS, "ask", m.kind, e); } } return ok; }
/** pose une question à un joueur ; résout true / false (false au bout de 2 min sans réponse, ou si le joueur est absent) */
export async function askUser(userId, { title, html, icon, kind, data, timeout = 120000 } = {}) {
  const u = game.users.get(userId); if (!u?.active) { ui.notifications.warn(`${u?.name || "Ce joueur"} n'est pas connecté.`); return false; }
  const m = { op: "msAsk", to: userId, rid: rid(), from: game.user.id, title, html, icon, kind, data };
  if (userId === game.user.id) return receive(m);
  return new Promise(res => { const t = setTimeout(() => { WAIT.delete(m.rid); res(false); }, timeout); WAIT.set(m.rid, ok => { clearTimeout(t); WAIT.delete(m.rid); res(!!ok); }); game.socket.emit(`system.${SYS}`, m); });
}
/** propriétaires joueurs connectés d'un personnage */
export const ownersOf = a => game.users.filter(u => !u.isGM && u.active && a?.testUserPermission?.(u, "OWNER"));
Hooks.once("ready", () => {
  game.socket.on(`system.${SYS}`, async m => {
    if (m?.op === "msAsk" && m.to === game.user.id) { const ok = await receive(m); game.socket.emit(`system.${SYS}`, { op: "msAskR", to: m.from, rid: m.rid, ok }); return; }
    if (m?.op === "msAskR" && m.to === game.user.id) WAIT.get(m.rid)?.(m.ok);
  });
});
export const askCard = (img, text) => `<div class="ms-ask-c">${img ? `<img src="${esc(img)}">` : ""}<p>${text}</p></div>`;
