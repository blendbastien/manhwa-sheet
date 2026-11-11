/* Manhwa Sheet — GROUPES MJ : une seule liste pour toute la suite (Boutique, Signal, Horlogia, Portraits, Scénarios…).
 * La Fiche est au centre : les modules lisent MANHWA.gmGroups et écrivent par MANHWA.gmGroups.edit().
 * Groupe : { id, name, color, icon, users: [id joueur], actors: [uuid] } ; ses membres = personnages ajoutés + tous les personnages de ses joueurs.
 * Hook « manhwaGmGroups » (liste) à chaque changement. */
import { SYS, esc } from "./config.js";
import { withLock, uid } from "./world.js";

export const GM_COLORS = ["#ffc63d", "#5ee0ff", "#ff6aa8", "#3ddc84", "#a46bff", "#ff8a3d", "#5e8bff", "#e9cf8e", "#ff5d6c", "#9be564"];
const raw = () => { try { return foundry.utils.deepClone(game.settings.get(SYS, "gmGroups")?.list || []); } catch (e) { return []; } };
export const gmGroups = () => raw().map(g => ({ users: [], actors: [], icon: "fa-people-group", color: "#ffc63d", ...g }));
export const gmGroup = id => gmGroups().find(g => g.id === id) || null;
/* personnages d'un joueur (non MJ) */
export const userChars = u => !u || u.isGM ? [] : game.actors.filter(a => a.type === "character" && a.testUserPermission(u, "OWNER")).map(a => a.uuid);
/** membres (uuid) d'un groupe : personnages ajoutés + personnages de ses joueurs */
export function gmMembers(g) { if (typeof g === "string") g = gmGroup(g); if (!g) return []; const s = new Set(g.actors || []); for (const id of g.users || []) for (const x of userChars(game.users.get(id))) s.add(x); return [...s]; }
export const gmGroupsOfActor = a => { const u = typeof a === "string" ? a : a?.uuid; return gmGroups().filter(g => gmMembers(g).includes(u)); };
export const gmGroupsOfUser = (user = game.user) => user?.isGM ? gmGroups() : gmGroups().filter(g => (g.users || []).includes(user.id) || userChars(user).some(x => (g.actors || []).includes(x)));
export async function editGmGroups(fn) {
  if (!game.user.isGM) return null;
  return withLock(`set:${SYS}.gmGroups`, async () => { const list = raw(); const r = await fn(list); if (r === false) return null; await game.settings.set(SYS, "gmGroups", { list }); return list; });
}
export async function createGmGroup(data = {}) { const id = data.id || uid(); await editGmGroups(l => { l.push({ id, name: data.name || "Nouveau groupe MJ", color: data.color || GM_COLORS[l.length % GM_COLORS.length], icon: data.icon || "fa-people-group", users: data.users || [], actors: data.actors || [] }); }); return id; }
export const removeGmGroup = id => editGmGroups(l => { const i = l.findIndex(g => g.id === id); if (i < 0) return false; l.splice(i, 1); });
/* une personne n'est que dans un groupe à la fois (option de l'éditeur : « exclusif ») */
export const setGmMember = (gid, kind, val, on, exclusive = false) => editGmGroups(l => { const g = l.find(x => x.id === gid); if (!g) return false; const k = kind === "user" ? "users" : "actors";
  const s = new Set(g[k] || []); if (on) { s.add(val); if (exclusive) for (const o of l) if (o.id !== gid) o[k] = (o[k] || []).filter(x => x !== val); } else s.delete(val); g[k] = [...s]; });

/* ── interface : cartes des groupes MJ (Centre du MJ, Horlogia…) ── */
export function gmGroupCards({ compact = false } = {}) {
  const players = game.users.filter(u => !u.isGM); const all = game.actors.filter(a => a.type === "character");
  return gmGroups().map(g => { const mem = gmMembers(g); const us = new Set(g.users || []), ac = new Set(g.actors || []);
    const chars = all.filter(a => a.hasPlayerOwner || ac.has(a.uuid));   /* personnages de joueurs (et ceux déjà ajoutés) : pas tout le répertoire */
    return `<div class="ms-gg" data-gg="${g.id}" style="--gc:${esc(g.color)}">
      <header><input type="color" data-ggf="color" value="${esc(g.color)}"><i class="fa-solid ${esc(g.icon || "fa-people-group")}"></i><input class="nm" data-ggf="name" value="${esc(g.name)}"><small>${mem.length} perso${mem.length > 1 ? "s" : ""}</small><a class="x" data-gga="del" title="Supprimer ce groupe MJ"><i class="fa-solid fa-trash"></i></a></header>
      <div class="ms-gg-sec"><b><i class="fa-solid fa-user-group"></i> Joueurs</b><small>tous leurs personnages suivent</small></div>
      <div class="ms-gg-chips">${players.map(u => `<label class="ms-gg-chip pl${us.has(u.id) ? " on" : ""}" style="--uc:${esc(u.color?.css ?? u.color ?? "#8ea0c8")}"><input type="checkbox" data-ggu="${u.id}"${us.has(u.id) ? " checked" : ""}><i class="dot"></i><span>${esc(u.name)}</span><em>${userChars(u).length}</em></label>`).join("") || `<span class="ms-mhint">Aucun joueur.</span>`}</div>
      ${compact ? "" : `<div class="ms-gg-sec"><b><i class="fa-solid fa-user"></i> Personnages</b><small>ajoutés un par un · personnages de joueurs ; glisse un autre acteur sur la carte pour l'ajouter</small></div>
      <div class="ms-gg-chips">${chars.map(a => `<label class="ms-gg-chip ch${ac.has(a.uuid) ? " on" : mem.includes(a.uuid) ? " via" : ""}" title="${mem.includes(a.uuid) && !ac.has(a.uuid) ? "Dans le groupe par son joueur" : ""}"><input type="checkbox" data-gga-c="${a.uuid}"${ac.has(a.uuid) ? " checked" : ""}><img src="${esc(a.img)}"><span>${esc(a.name)}</span></label>`).join("")}</div>`}</div>`; }).join("");
}
export function bindGmGroupCards(root, onChange) {
  root.addEventListener("dragover", ev => { if (ev.target.closest("[data-gg]")) ev.preventDefault(); });
  root.addEventListener("drop", async ev => { const box = ev.target.closest("[data-gg]"); if (!box) return; let d; try { d = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch (e) { return; } if (d?.type !== "Actor") return; ev.preventDefault(); ev.stopPropagation(); await setGmMember(box.dataset.gg, "actor", d.uuid, true); onChange?.(); });
  root.addEventListener("change", ev => { const el = ev.target; const box = el.closest("[data-gg]"); if (!box) return; const gid = box.dataset.gg;
    if (el.dataset.ggf) { const k = el.dataset.ggf; const v = el.value.trim(); if (!v) return; return editGmGroups(l => { const g = l.find(x => x.id === gid); if (!g) return false; g[k] = v; }).then(onChange); }
    if (el.dataset.ggu) return setGmMember(gid, "user", el.dataset.ggu, el.checked).then(onChange);
    if (el.dataset.ggaC) return setGmMember(gid, "actor", el.dataset.ggaC, el.checked).then(onChange); });
  root.addEventListener("click", async ev => { const a = ev.target.closest("[data-gga]"); if (!a) return; ev.preventDefault(); const gid = a.closest("[data-gg]")?.dataset.gg;
    if (a.dataset.gga === "del") { const g = gmGroup(gid); if (!g || !await foundry.applications.api.DialogV2.confirm({ window: { title: "Supprimer le groupe MJ" }, classes: ["ms-dialog"], content: `<p>Supprimer <b>${esc(g.name)}</b> ? Les personnages ne sont pas touchés ; les modules qui l'utilisaient (Boutique, Horlogia, Portraits…) le perdent.</p>` })) return; await removeGmGroup(gid); onChange?.(); } });
}

/* ── reprise des anciens groupes (Boutique, Horlogia) — une seule fois ── */
async function migrate() {
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
  if (game.settings.get(SYS, "gmGroupsMig")) return;
  const list = raw(); const has = id => list.some(g => g.id === id);
  try { const s = game.modules.get("last-horizon-catalogue")?.active ? game.settings.get("last-horizon-catalogue", "shop") : null;
    for (const g of s?.groups || []) if (!has(g.id)) list.push({ id: g.id, name: g.name, color: g.color || "#ffc63d", icon: "fa-people-group", users: [], actors: [...(g.members || [])] }); } catch (e) { console.warn(SYS, "groupes MJ : reprise Boutique", e); }
  try { if (game.modules.get("horlogia-manhwa")?.active) { const st = game.settings.get("horlogia-manhwa", "state") || {};
    for (const g of st.groups || []) if (!g.def && !has(g.id)) list.push({ id: g.id, name: g.name, color: g.color || "#5ee0ff", icon: "fa-people-group", users: [...(g.users || [])], actors: [...(g.actors || [])] }); } } catch (e) { console.warn(SYS, "groupes MJ : reprise Horlogia", e); }
  await game.settings.set(SYS, "gmGroups", { list }); await game.settings.set(SYS, "gmGroupsMig", 1);
  if (list.length) ui.notifications.info(`Groupes MJ : ${list.length} groupe${list.length > 1 ? "s" : ""} repris de la Boutique et d'Horlogia.`);
}

Hooks.once("init", () => {
  game.settings.register(SYS, "gmGroups", { scope: "world", config: false, type: Object, default: { list: [] }, onChange: () => Hooks.callAll("manhwaGmGroups", gmGroups()) });
  game.settings.register(SYS, "gmGroupsMig", { scope: "world", config: false, type: Number, default: 0 });
});
Hooks.once("ready", () => { setTimeout(migrate, 1500); });
/* un nouveau personnage ou un changement de propriétaire change les membres : on prévient les modules */
for (const h of ["createActor", "deleteActor"]) Hooks.on(h, () => Hooks.callAll("manhwaGmGroups", gmGroups()));
Hooks.on("updateActor", (a, ch) => { if (ch.ownership) Hooks.callAll("manhwaGmGroups", gmGroups()); });

export const gmGroupsApi = { list: gmGroups, get: gmGroup, members: gmMembers, ofActor: gmGroupsOfActor, ofUser: gmGroupsOfUser, edit: editGmGroups, create: createGmGroup, remove: removeGmGroup, setMember: setGmMember, cards: gmGroupCards, bindCards: bindGmGroupCards, colors: GM_COLORS };
