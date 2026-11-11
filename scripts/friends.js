/* Manhwa Sheet — Amis : grandes cartes rectangulaires (ou liste, ou mosaïque, au choix du joueur), rangées par dossiers.
 * Boutons à droite : écrire, inviter au groupe, échanger, voir la fiche, retirer. Les opérations de dossier restent celles du Carnet. */
import { SYS, esc, getConfig, rankOf, levelColor, kindLabel } from "./config.js";
import { parties, partiesOf, guildOf, actorOf, gmDo, onGm, toast, editList, userCanActor } from "./world.js";
import { startTrade } from "./trade.js";
import { npcFindable } from "./pickers.js";

const SORTS = { fav: "Favoris d'abord", name: "Nom", level: "Niveau", online: "En ligne d'abord" };
const VIEWS = { cards: ["Cartes", "fa-id-card"], list: ["Liste", "fa-list"], tiles: ["Mosaïque", "fa-grip"] };
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const friendActor = n => { if (n?.uuid) { const a = actorOf(n.uuid); if (a) return a; } return game.actors.find(a => norm(a.name) === norm(n?.name)) ?? null; };
const online = a => game.users.some(u => u.active && !u.isGM && (u.character?.id === a.id || a.testUserPermission(u, "OWNER")));
const count = nodes => (nodes || []).reduce((n, x) => n + (x.folder ? count(x.children) : 1), 0);

export function renderFriends(app) {
  const view = game.user.getFlag(SYS, "friendsView") || "cards"; const sort = game.user.getFlag(SYS, "friendsSort") || "fav"; const ed = app.editable; const cfg = getConfig(); const nodes = app.data.friends;
  const card = n => { const a = friendActor(n); const ok = a && (game.user.isGM || a.testUserPermission(game.user, "LIMITED") || (a.type === "character" && a.hasPlayerOwner) || npcFindable(a)); const see = a && (game.user.isGM || a.testUserPermission(game.user, "LIMITED"));
    if (!ok) return `<div class="ms-fr nolink${n.fav ? " fav" : ""}" data-id="${n.id}"><div class="pic"><i class="fa-solid fa-user"></i></div><div class="inf"><b>${ed ? `<a data-mact="fFav" class="star${n.fav ? " on" : ""}"><i class="fa-${n.fav ? "solid" : "regular"} fa-star"></i></a>` : ""}${esc(n.name)}</b><small>Ami (nom libre)</small></div>
      ${ed ? `<div class="btns"><a data-act="rename" title="Renommer"><i class="fa-solid fa-pen"></i></a><a data-act="move" title="Déplacer"><i class="fa-solid fa-arrows-up-down-left-right"></i></a><a data-act="del" class="x" title="Retirer"><i class="fa-solid fa-user-minus"></i></a></div>` : ""}</div>`;
    const rk = rankOf(cfg, a.system.rank); const on = online(a); const p = partiesOf(a)[0]; const g = guildOf(a);
    return `<div class="ms-fr${on ? " online" : ""}${n.fav ? " fav" : ""}" data-id="${n.id}" data-uuid="${esc(a.uuid)}" style="--rc:${esc(rk?.color || "#8ea0c8")}">
      <div class="pic"><img src="${esc(a.img)}"><span class="rk">${esc(rk?.name || "")}</span></div>
      <div class="inf"><b>${ed ? `<a data-mact="fFav" class="star${n.fav ? " on" : ""}" title="${n.fav ? "Retirer des favoris" : "Mettre en favori"}"><i class="fa-${n.fav ? "solid" : "regular"} fa-star"></i></a>` : n.fav ? `<i class="fa-solid fa-star star on"></i>` : ""}${esc(a.name)}</b><div class="tags"><span style="color:${levelColor(a.system.level)}">Niv ${Number(a.system.level) || 0}</span><span>${kindLabel(a)}</span><span class="st"><i></i>${on ? "En ligne" : "Hors ligne"}</span></div>
        <div class="meta">${p ? `<span><i class="fa-solid fa-people-group"></i>${esc(p.name)}</span>` : ""}${g ? `<span><i class="fa-solid fa-shield-halved"></i>${esc(g.name)}</span>` : ""}</div></div>
      <div class="btns"><a data-mact="fProfile" title="Voir la carte du joueur (profil)"><i class="fa-solid fa-id-badge"></i></a><a data-mact="fMsg" title="Envoyer un message"><i class="fa-solid fa-comment-dots"></i></a><a data-mact="fInvite" title="Inviter dans mon groupe"><i class="fa-solid fa-user-plus"></i></a><a data-mact="fTrade" title="Proposer un échange"><i class="fa-solid fa-right-left"></i></a>${see ? `<a data-act="sheet" title="Voir la fiche"><i class="fa-solid fa-id-card"></i></a>` : ""}${ed ? `<a data-act="del" class="x" title="Retirer des amis"><i class="fa-solid fa-user-minus"></i></a>` : ""}</div></div>`; };
  const key = n => { const a = friendActor(n); return { name: norm(a?.name || n.name), lvl: Number(a?.system?.level) || 0, on: a && online(a) ? 1 : 0, fav: n.fav ? 1 : 0 }; };
  const cmp = (x, y) => { const a = key(x), b = key(y); if (sort === "level") return b.lvl - a.lvl || a.name.localeCompare(b.name); if (sort === "online") return b.on - a.on || b.fav - a.fav || a.name.localeCompare(b.name); if (sort === "name") return a.name.localeCompare(b.name); return b.fav - a.fav || b.on - a.on || a.name.localeCompare(b.name); };
  const block = (list, depth = 0) => { const items = list.filter(n => !n.folder).sort(cmp), folders = list.filter(n => n.folder);
    return `${items.length ? `<div class="ms-frs v-${view}">${items.map(card).join("")}</div>` : ""}${folders.map(f => `<section class="ms-frf" data-id="${f.id}" style="--d:${depth}"><header><a data-act="toggle" class="tg"><i class="fa-solid ${f.open === false ? "fa-chevron-right" : "fa-chevron-down"}"></i></a><i class="fa-solid fa-folder"></i><b>${esc(f.name)}</b><small>${count(f.children)}</small>
      ${ed ? `<span class="act"><a data-act="addActor" title="Ajouter un personnage"><i class="fa-solid fa-address-book"></i></a><a data-act="addItem" title="Nom libre"><i class="fa-solid fa-plus"></i></a><a data-act="addFolder" title="Sous-dossier"><i class="fa-solid fa-folder-plus"></i></a><a data-act="rename" title="Renommer"><i class="fa-solid fa-pen"></i></a><a data-act="move" title="Déplacer"><i class="fa-solid fa-arrows-up-down-left-right"></i></a><a data-act="del" class="x" title="Supprimer le dossier"><i class="fa-solid fa-xmark"></i></a></span>` : ""}</header>${f.open === false ? "" : block(f.children || [], depth + 1)}</section>`).join("")}`; };
  return `<div class="ms-mtop"><span class="ms-frviews">${Object.entries(VIEWS).map(([k, [n, ic]]) => `<a data-mact="fView" data-v="${k}" class="${view === k ? "on" : ""}" title="${n}"><i class="fa-solid ${ic}"></i></a>`).join("")}</span>
      <label class="ms-frsort"><i class="fa-solid fa-arrow-down-wide-short"></i><select data-fsort>${Object.entries(SORTS).map(([k, v]) => `<option value="${k}"${sort === k ? " selected" : ""}>${v}</option>`).join("")}</select></label><span class="ms-mhint">${count(nodes)} ami${count(nodes) > 1 ? "s" : ""}</span><span class="grow"></span>
      ${ed ? `<a class="ms-mbtn blue" data-act="addActor" data-root="1"><i class="fa-solid fa-address-book"></i> Personnage</a><a class="ms-mbtn ghost" data-act="addItem" data-root="1"><i class="fa-solid fa-plus"></i> Nom libre</a><a class="ms-mbtn ghost" data-act="addFolder" data-root="1"><i class="fa-solid fa-folder-plus"></i> Dossier</a>` : ""}</div>
    ${nodes.length ? block(nodes) : `<div class="ms-mhint big"><i class="fa-solid fa-user-group"></i>Aucun ami pour l'instant.</div>`}`;
}

export function bindFriends(app, root) { root.querySelector("[data-fsort]")?.addEventListener("change", async e => { await game.user.setFlag(SYS, "friendsSort", e.target.value); app.render(); }); }
export async function actFriends(app, act, el) {
  const uuid = el.closest("[data-uuid]")?.dataset.uuid;
  switch (act) {
    case "fView": await game.user.setFlag(SYS, "friendsView", el.dataset.v); return app.render();
    case "fFav": { const id = el.closest("[data-id]")?.dataset.id; const nodes = foundry.utils.deepClone(app.data.friends); const find = l => { for (const n of l) { if (n.id === id) return n; if (n.folder) { const r = find(n.children || []); if (r) return r; } } return null; }; const n = find(nodes); if (!n) return; n.fav = !n.fav; await app.save("friends", nodes); return app.render(); }
    case "fProfile": { const { openProfile } = await import("./pcard.js"); return openProfile(uuid); }
    case "fMsg": app.tab = "mail"; app._phoneTo = uuid; return app.render();
    case "fTrade": return startTrade(app.actor, uuid);
    case "fInvite": {
      const mine = partiesOf(app.actor);
      if (!game.user.isGM) { if (!mine.length) return ui.notifications.warn(`${app.actor.name} n'a pas de groupe. Le MJ crée les groupes dans le Menu.`); return gmDo("partyInvite", { actor: app.actor.uuid, target: uuid }); }
      const list = mine.length ? mine : parties(); if (!list.length) return ui.notifications.warn("Crée d'abord un groupe (onglet Groupe).");
      let pid = list[0].id; if (list.length > 1) { pid = await foundry.applications.api.DialogV2.prompt({ window: { title: "Inviter dans quel groupe ?" }, classes: ["ms-dialog"], content: `<div class="ms-form"><select name="p">${list.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div>`, ok: { callback: (ev, btn) => btn.form.elements.p.value }, rejectClose: false }); if (!pid) return; }
      return gmDo("partyInvite", { actor: app.actor.uuid, target: uuid, pid });
    }
  }
}

/* invitation : le MJ ajoute l'ami au groupe du personnage qui invite */
onGm("partyInvite", async ({ actor, target, pid }, userId) => {
  const a = actorOf(actor), t = actorOf(target); if (!a || !t || !userCanActor(userId, a)) return;
  const p = pid ? parties().find(x => x.id === pid) : partiesOf(a)[0]; if (!p) return toast(userId, `${a.name} n'a pas de groupe.`, "warn");
  /* la vérification « déjà membre » se fait dans l'écriture (liste fraîche) : deux invitations croisées ne doublent plus l'entrée */
  let dup = false; const r = await editList("parties", l => { const x = l.find(y => y.id === p.id); if (!x) return false; if (x.members.some(m => m.uuid === target)) { dup = true; return false; } x.members.push({ uuid: target, xp: 0, gold: 0 }); });
  if (dup) return toast(userId, `${t.name} est déjà dans ${p.name}.`, "info"); if (!r?.changed) return toast(userId, "Ce groupe n'existe plus.", "warn");
  toast(userId, `${t.name} rejoint le groupe ${p.name}.`);
  const owners = game.users.filter(u => !u.isGM && t.testUserPermission(u, "OWNER")).map(u => u.id); game.socket.emit(`system.${SYS}`, { op: "mailPing", to: owners, text: `${a.name} t'a invité dans le groupe ${p.name}.` });
});
