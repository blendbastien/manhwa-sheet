/* Manhwa Sheet — Guilde : bannière (emblème, couleur, rang, devise), membres et rôles, trésor (dépôts des membres,
 * retraits par le maître, les officiers ou le MJ) et tableau d'annonces. Le MJ crée et gère ; les opérations des joueurs passent par le MJ. */
import { SYS, esc, getConfig, rankOf, rankPower, levelColor } from "./config.js";
import { guilds, guildOf, editList, uid, actorOf, gmDo, onGm, toast, goldKey, goldOf, addGold, userCanActor, GUILD_ROLES } from "./world.js";
import { askName } from "./party.js";

const DialogV2 = foundry.applications.api.DialogV2;
const FP = () => foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
const fmt = n => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const gname = () => getConfig().resources.find(r => r.key === goldKey())?.name || "Gold";
const canWithdraw = (g, uuid) => game.user.isGM || ["Maître de guilde", "Officier"].includes(g.members.find(m => m.uuid === uuid)?.role);

export function renderGuild(app) {
  const gm = game.user.isGM; const all = guilds(); const own = guildOf(app.actor);
  if (!gm && !own) return `<div class="ms-mhint big"><i class="fa-solid fa-shield-halved"></i>${esc(app.actor.name)} ne fait partie d'aucune guilde.</div>`;
  if (!gm) app.guildId = own.id; else if (!all.some(g => g.id === app.guildId)) app.guildId = own?.id || all[0]?.id || null;
  const g = all.find(x => x.id === app.guildId);
  const top = gm ? `<div class="ms-mtop">${all.map(x => `<a data-mact="gSel" data-id="${x.id}" class="ms-pchip${x.id === app.guildId ? " on" : ""}" style="--c:${esc(x.color || "#ffd070")}"><i></i>${esc(x.name)}<small>${x.members.length}</small></a>`).join("")}<a class="ms-mbtn blue" data-mact="gNew"><i class="fa-solid fa-plus"></i> Nouvelle guilde</a></div>` : "";
  if (!g) return top || `<div class="ms-mhint">Aucune guilde.</div>`;
  const cfg = getConfig(); const rk = rankOf(cfg, g.rank); const me = g.members.find(m => m.uuid === app.actor.uuid);
  const members = g.members.slice().sort((a, b) => GUILD_ROLES.indexOf(a.role) - GUILD_ROLES.indexOf(b.role)).map(m => { const a = actorOf(m.uuid); if (!a) return "";
    return `<div class="ms-gm" data-uuid="${esc(m.uuid)}"><img src="${esc(a.img)}"><b>${esc(a.name)}</b><small style="color:${levelColor(a.system.level)}">Niv ${Number(a.system.level) || 0}</small>
      ${gm ? `<select data-grole>${GUILD_ROLES.map(r => `<option${r === m.role ? " selected" : ""}>${r}</option>`).join("")}</select><a data-mact="gKick" class="x" title="Retirer"><i class="fa-solid fa-xmark"></i></a>` : `<span class="role r${GUILD_ROLES.indexOf(m.role)}">${esc(m.role)}</span>`}</div>`; }).join("");
  const board = (g.board || []).slice().reverse().map(n => `<div class="ms-gnote" data-nid="${n.id}"><header><b>${esc(n.author)}</b><small>${new Date(n.date).toLocaleDateString("fr-FR")}</small>${gm || canWithdraw(g, app.actor.uuid) ? `<a data-mact="gUnpost" class="x"><i class="fa-solid fa-xmark"></i></a>` : ""}</header><p>${esc(n.text).replace(/\n/g, "<br>")}</p></div>`).join("");
  return `${top}<div class="ms-mpanel ms-guild" style="--gc:${esc(g.color || "#ffd070")}">
    <header class="ms-gbanner"><div class="em" ${gm ? 'data-mact="gEmblem" title="Changer l\'emblème"' : ""}>${g.emblem ? `<img src="${esc(g.emblem)}">` : `<i class="fa-solid fa-shield-halved"></i>`}</div>
      <div class="t">${gm ? `<input type="text" data-gfield="name" value="${esc(g.name)}" class="gn"><input type="text" data-gfield="motto" value="${esc(g.motto || "")}" placeholder="Devise" class="gmotto">` : `<h2>${esc(g.name)}</h2>${g.motto ? `<em>« ${esc(g.motto)} »</em>` : ""}`}</div>
      <div class="rk pw${rankPower(cfg, g.rank)}" style="--c:${esc(rk?.color || "#fff")}"><small>Rang</small>${gm ? `<select data-gfield="rank">${cfg.ranks.map(r => `<option value="${r.key}"${r.key === g.rank ? " selected" : ""}>${esc(r.name)}</option>`).join("")}</select>` : `<b>${esc(rk?.name || "—")}</b>`}</div>
      ${gm ? `<input type="color" data-gfield="color" value="${esc(g.color || "#ffd070")}"><a class="ms-mbtn red" data-mact="gDel" title="Supprimer la guilde"><i class="fa-solid fa-trash"></i></a>` : ""}</header>
    ${gm ? `<textarea data-gfield="desc" rows="2" placeholder="Présentation de la guilde">${esc(g.desc || "")}</textarea>` : g.desc ? `<p class="ms-gdesc">${esc(g.desc)}</p>` : ""}
    <div class="ms-gcols">
      <section><h4><i class="fa-solid fa-users"></i> Membres <small>${g.members.length}</small>${gm ? `<a data-mact="gAdd" class="add"><i class="fa-solid fa-user-plus"></i></a>` : ""}</h4><div class="ms-gmembers" data-drop="guild">${members || `<div class="ms-mhint">Aucun membre.</div>`}</div></section>
      <section><h4><i class="fa-solid fa-vault"></i> Trésor</h4><div class="ms-gvault"><b>${fmt(g.treasury)}</b><span>${esc(gname())}</span></div>
        ${me || gm ? `<div class="ms-gmove"><input type="number" min="1" value="" placeholder="Montant" data-gamount><a class="ms-mbtn green" data-mact="gDeposit"><i class="fa-solid fa-arrow-down"></i> Déposer</a>${canWithdraw(g, app.actor.uuid) ? `<a class="ms-mbtn ghost" data-mact="gWithdraw"><i class="fa-solid fa-arrow-up"></i> Retirer</a>` : ""}</div><small class="ms-mhint">${esc(app.actor.name)} a ${fmt(goldOf(app.actor))} ${esc(gname())}.</small>` : ""}
        <h4><i class="fa-solid fa-thumbtack"></i> Annonces</h4>${me || gm ? `<div class="ms-gpost"><textarea rows="2" data-gpost placeholder="Écrire une annonce…"></textarea><a class="ms-mbtn blue" data-mact="gPost"><i class="fa-solid fa-paper-plane"></i></a></div>` : ""}<div class="ms-gboard">${board || `<div class="ms-mhint">Aucune annonce.</div>`}</div></section>
    </div></div>`;
}

export function bindGuild(app, root) {
  const upd = fn => editList("guilds", l => { const g = l.find(x => x.id === app.guildId); if (!g) return false; return fn(g); });
  root.querySelectorAll("[data-gfield]").forEach(i => i.addEventListener("change", () => upd(g => { g[i.dataset.gfield] = i.value.trim(); })));
  root.querySelectorAll("[data-grole]").forEach(s => s.addEventListener("change", () => { const uuid = s.closest("[data-uuid]").dataset.uuid; upd(g => { const m = g.members.find(x => x.uuid === uuid); if (m) m.role = s.value; }); }));
  const drop = root.querySelector('[data-drop="guild"]');
  if (drop && game.user.isGM) { drop.addEventListener("dragover", ev => ev.preventDefault()); drop.addEventListener("drop", async ev => { let d; try { d = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch (e) { return; } if (d?.type !== "Actor") return; ev.preventDefault(); await addToGuild(app.guildId, [d.uuid]); }); }
}
async function addToGuild(gid, uuids) { await editList("guilds", l => { for (const g of l) g.members = g.members.filter(m => !uuids.includes(m.uuid) || g.id === gid); const g = l.find(x => x.id === gid); if (!g) return false; for (const u of uuids) if (!g.members.some(m => m.uuid === u)) g.members.push({ uuid: u, role: g.members.length ? "Membre" : "Maître de guilde" }); }); }

export async function actGuild(app, act, el) {
  const gid = app.guildId; const uuid = el.closest("[data-uuid]")?.dataset.uuid; const root = el.closest(".ms-guild");
  const upd = fn => editList("guilds", l => { const g = l.find(x => x.id === gid); if (!g) return false; return fn(g, l); });
  switch (act) {
    case "gSel": app.guildId = el.dataset.id; return app.render();
    case "gNew": { const name = await askName("Nouvelle guilde", ""); if (!name) return; const id = uid(); await editList("guilds", l => { l.push({ id, name, emblem: "", color: "#ffd070", rank: getConfig().ranks[0]?.key || "", motto: "", desc: "", members: [], treasury: 0, board: [] }); }); app.guildId = id; return; }
    case "gDel": { const g = guilds().find(x => x.id === gid); if (!g || !await DialogV2.confirm({ window: { title: "Supprimer la guilde" }, classes: ["ms-dialog"], content: `<p>Supprimer <b>${esc(g.name)}</b> ? Le trésor est perdu.</p>` })) return; return editList("guilds", l => { l.splice(l.findIndex(x => x.id === gid), 1); }); }
    case "gEmblem": { const g = guilds().find(x => x.id === gid); return new (FP())({ type: "image", current: g?.emblem || "", callback: p => upd(x => { x.emblem = p; }) }).render(true); }
    case "gKick": return upd(g => { g.members = g.members.filter(m => m.uuid !== uuid); });
    case "gAdd": { const { recipientPicker } = await import("./pickers.js"); const g = guilds().find(x => x.id === gid);
      const r = await recipientPicker({ title: "Ajouter à la guilde", multi: true, exclude: (g?.members || []).map(m => m.uuid), label: "Tape un nom de personnage ou un pseudo de joueur, puis clique pour l'ajouter (plusieurs possibles)." });
      if (r?.length) await addToGuild(gid, r); return; }
    case "gDeposit": case "gWithdraw": { const amount = Math.floor(Number(root.querySelector("[data-gamount]")?.value) || 0); if (amount <= 0) return ui.notifications.warn("Indique un montant.");
      if (el.dataset.busy) return; el.dataset.busy = "1"; setTimeout(() => delete el.dataset.busy, 2500); const inp = root.querySelector("[data-gamount]"); if (inp) inp.value = "";   /* un clic = une opération */
      return gmDo(act === "gDeposit" ? "guildDeposit" : "guildWithdraw", { gid, actor: app.actor.uuid, amount }); }
    case "gPost": { const text = root.querySelector("[data-gpost]")?.value.trim(); if (!text) return; return gmDo("guildPost", { gid, actor: app.actor.uuid, text }); }
    case "gUnpost": { const nid = el.closest("[data-nid]")?.dataset.nid; return gmDo("guildUnpost", { gid, actor: app.actor.uuid, nid }); }
  }
}

/* opérations exécutées par le MJ */
const member = (g, uuid) => g.members.find(m => m.uuid === uuid);
onGm("guildDeposit", async ({ gid, actor, amount }, userId) => {
  const a = actorOf(actor); const g = guilds().find(x => x.id === gid); amount = Math.floor(Number(amount) || 0); if (!a || !g || amount <= 0 || !userCanActor(userId, a)) return;
  if (!member(g, actor) && !game.users.get(userId)?.isGM) return toast(userId, "Ce personnage n'est pas membre de la guilde.", "warn");
  /* l'or est retiré sous verrou du personnage et seulement s'il suffit (strict) ; le trésor n'est crédité qu'après ; si le crédit échoue, l'or est rendu */
  if (!await addGold(a, -amount, { strict: true })) return toast(userId, `${a.name} n'a pas assez de ${gname()}.`, "warn");
  const r = await editList("guilds", l => { const x = l.find(y => y.id === gid); if (!x) return false; x.treasury = (Number(x.treasury) || 0) + amount; });
  if (!r?.changed) { await addGold(a, amount); return toast(userId, "La guilde n'existe plus : or rendu.", "warn"); }
  toast(userId, `${fmt(amount)} ${gname()} déposés au trésor de ${g.name}.`);
});
onGm("guildWithdraw", async ({ gid, actor, amount }, userId) => {
  const a = actorOf(actor); const g = guilds().find(x => x.id === gid); amount = Math.floor(Number(amount) || 0); if (!a || !g || amount <= 0 || !userCanActor(userId, a)) return;
  if (!game.users.get(userId)?.isGM && !["Maître de guilde", "Officier"].includes(member(g, actor)?.role)) return toast(userId, "Seuls le maître de guilde et les officiers peuvent retirer.", "warn");
  /* la vérification du trésor se fait DANS l'écriture (liste fraîche, sous verrou) : deux retraits simultanés ne peuvent pas vider le trésor deux fois */
  let short = false; const r = await editList("guilds", l => { const x = l.find(y => y.id === gid); if (!x) return false; if ((Number(x.treasury) || 0) < amount) { short = true; return false; } x.treasury = (Number(x.treasury) || 0) - amount; });
  if (short) return toast(userId, "Le trésor n'est pas assez rempli.", "warn"); if (!r?.changed) return;
  await addGold(a, amount);
  toast(userId, `${fmt(amount)} ${gname()} retirés du trésor.`);
});
onGm("guildPost", async ({ gid, actor, text }, userId) => {
  const a = actorOf(actor); const g = guilds().find(x => x.id === gid); if (!a || !g || !userCanActor(userId, a) || (!member(g, actor) && !game.users.get(userId)?.isGM)) return;
  await editList("guilds", l => { const x = l.find(y => y.id === gid); (x.board ||= []).push({ id: uid(), author: a.name, text: String(text).slice(0, 2000), date: Date.now() }); if (x.board.length > 60) x.board.splice(0, x.board.length - 60); });
});
onGm("guildUnpost", async ({ gid, actor, nid }, userId) => {
  const g = guilds().find(x => x.id === gid); if (!g || !(game.users.get(userId)?.isGM || ["Maître de guilde", "Officier"].includes(member(g, actor)?.role))) return;
  await editList("guilds", l => { const x = l.find(y => y.id === gid); x.board = (x.board || []).filter(n => n.id !== nid); });
});
