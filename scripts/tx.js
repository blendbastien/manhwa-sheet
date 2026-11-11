/* Manhwa Sheet 1.59 — TRANSACTIONS : toute variation de Gold, monnaies, XP, jauges, stats achetées passe par UN seul poste,
 * celui du MJ connecté (file unique, valeurs relues juste avant d'écrire). Sans MJ connecté : en local, sous verrou du personnage.
 * Deux postes qui donnent / dépensent en même temps ne peuvent plus s'annuler.
 *   tx(actor, { add: { "system.resources.gold": +500 }, set: {…}, min: { chemin: plancher }, max: { chemin: plafond }, need: { chemin: minimum exigé } })
 *   → { ok, values } ; ok = false (why = "need") si un minimum exigé n'est pas atteint (achat refusé, rien n'est écrit). */
import { SYS } from "./config.js";
import { activeGM, actorLock, onGm, uid } from "./world.js";

const WAIT = new Map();
const num = v => Number(v) || 0;
async function actorOf(ref) { if (!ref) return null; if (typeof ref !== "string") return ref; return fromUuidSync(ref) || await fromUuid(ref); }

/** exécution réelle (poste du MJ, ou local sans MJ) : relit, vérifie, écrit en une seule mise à jour */
export async function applyTx(actor, spec = {}, by = game.user.id) {
  const a = await actorOf(actor); if (!a) return { ok: false, why: "actor" };
  return actorLock(a, async () => {
    const get = p => num(foundry.utils.getProperty(a, p)); const upd = {}; const values = {};
    for (const [p, d] of Object.entries(spec.add || {})) { let v = get(p) + num(d); if (spec.need && spec.need[p] !== undefined && v < num(spec.need[p])) return { ok: false, why: "need", path: p, have: get(p) };
      if (spec.min && spec.min[p] !== undefined) v = Math.max(num(spec.min[p]), v); if (spec.max && spec.max[p] !== undefined && spec.max[p] !== null) v = Math.min(num(spec.max[p]), v);
      v = Math.round(v * 100) / 100; upd[p] = v; values[p] = v; }
    for (const [p, v] of Object.entries(spec.set || {})) { upd[p] = v; values[p] = v; }
    if (!Object.keys(upd).length) return { ok: true, values };
    await a.update(upd, { msTx: true, msBy: by }); return { ok: true, values };
  });
}

/** demande une transaction : envoyée au MJ connecté (réponse attendue), sinon exécutée ici */
export async function tx(actor, spec = {}, { timeout = 8000 } = {}) {
  const a = await actorOf(actor); if (!a) return { ok: false, why: "actor" };
  const gm = activeGM(); if (game.user.isGM || !gm) return applyTx(a, spec);
  const rid = uid(); const p = new Promise(res => { const t = setTimeout(() => { WAIT.delete(rid); res(null); }, timeout); WAIT.set(rid, r => { clearTimeout(t); WAIT.delete(rid); res(r); }); });
  game.socket.emit(`system.${SYS}`, { op: "msTx", data: { uuid: a.uuid, spec }, user: game.user.id, rid, want: true });
  const r = await p; if (r) return r;
  /* pas de réponse : on n'exécute PAS en local (le MJ a peut-être déjà écrit : risque de double gain) */
  ui.notifications.warn("Le MJ n'a pas répondu à temps : vérifie le montant avant de recommencer."); return { ok: false, why: "timeout" };
}

/* côté MJ : le joueur doit posséder le personnage (il pourrait déjà le modifier lui-même ; on ne fait que passer par la file) */
Hooks.once("setup", () => onGm("msTx", async ({ uuid, spec }, userId) => { const a = await actorOf(uuid); const u = game.users.get(userId);
  if (!a || !u || !a.testUserPermission(u, "OWNER")) return { ok: false, why: "perm" }; return applyTx(a, spec, userId); }));
/* réponse du MJ */
Hooks.once("ready", () => game.socket.on(`system.${SYS}`, m => { if (m?.op === "msTxR" && m.to === game.user.id) WAIT.get(m.rid)?.(m.r); }));

/* raccourcis */
export const addPath = (actor, path, delta, opts = {}) => tx(actor, { add: { [path]: delta }, ...(opts.min !== undefined ? { min: { [path]: opts.min } } : {}), ...(opts.max !== undefined ? { max: { [path]: opts.max } } : {}), ...(opts.need !== undefined ? { need: { [path]: opts.need } } : {}) });
