/* Manhwa Sheet — Courrier : boîte aux lettres façon MMORPG. Une lettre a un expéditeur (personnage, PNJ ou nom libre),
 * un objet, un texte et peut contenir des objets et du Gold à récupérer. Le MJ envoie à qui il veut (objets du répertoire,
 * Gold créé) ; un joueur écrit à un personnage, ses pièces jointes quittent son inventaire. Tout passe par le MJ. */
import { SYS, esc, getConfig } from "./config.js";
import { actorRecipients, bindRecipients, pickedActors } from "./pickers.js";
import { letters, editList, uid, actorOf, gmDo, onGm, toast, goldKey, goldOf, addGold, actorLock, userCanActor, parties, refreshMenus } from "./world.js";

const DialogV2 = foundry.applications.api.DialogV2;
const fmt = n => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const gname = () => getConfig().resources.find(r => r.key === goldKey())?.name || "Gold";
const when = ts => new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) + " " + new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
export const inbox = actor => letters().filter(l => l.to === actor.uuid).sort((a, b) => b.date - a.date);
export const unreadLetters = actor => inbox(actor).filter(l => !l.read).length;
const ownersOf = a => game.users.filter(u => !u.isGM && a?.testUserPermission(u, "OWNER")).map(u => u.id);

export function renderLetters(app) {
  const box = inbox(app.actor); if (!box.some(l => l.id === app.letterId)) app.letterId = box[0]?.id || null; const l = box.find(x => x.id === app.letterId);
  const rows = box.map(x => `<a class="ms-lrow${x.id === app.letterId ? " on" : ""}${x.read ? "" : " unread"}" data-mact="lOpen" data-lid="${x.id}"><img src="${esc(x.fromImg || "icons/svg/mystery-man.svg")}"><span><b>${esc(x.subject || "(sans objet)")}</b><small>${esc(x.fromName)}</small></span><em>${when(x.date)}</em>${(x.items?.length || x.gold) && !x.claimed ? `<i class="fa-solid fa-paperclip clip" title="Pièces jointes"></i>` : ""}</a>`).join("");
  const att = l && (l.items?.length || l.gold) ? `<div class="ms-latt${l.claimed ? " done" : ""}"><h4><i class="fa-solid fa-paperclip"></i> Pièces jointes${l.claimed ? " — récupérées" : ""}</h4><div class="its">${(l.items || []).map(i => `<span class="it"><img src="${esc(i.img)}"><b>${esc(i.name)}</b>${i.qty > 1 ? `<em>×${i.qty}</em>` : ""}</span>`).join("")}${l.gold ? `<span class="it gd"><i class="fa-solid fa-coins"></i><b>${fmt(l.gold)} ${esc(gname())}</b></span>` : ""}</div>${l.claimed ? "" : l.pending ? `<small class="hint">Envoi en cours…</small>` : `<a class="ms-mbtn green" data-mact="lClaim"><i class="fa-solid fa-hand-holding-heart"></i> Récupérer</a>`}</div>` : "";
  const view = l ? `<article class="ms-letter"><header><img src="${esc(l.fromImg || "icons/svg/mystery-man.svg")}"><div><small>De</small><b>${esc(l.fromName)}</b></div><em>${when(l.date)}</em></header><h2>${esc(l.subject || "(sans objet)")}</h2>
      <div class="body">${esc(l.body || "").replace(/\n/g, "<br>")}</div>${att}
      <footer>${l.fromUuid ? `<a class="ms-mbtn blue" data-mact="lReply"><i class="fa-solid fa-reply"></i> Répondre</a>` : ""}<a class="ms-mbtn red" data-mact="lDel"><i class="fa-solid fa-trash"></i> Supprimer</a></footer></article>`
    : `<div class="ms-mhint big"><i class="fa-solid fa-envelope-open"></i>${rows ? "Choisis une lettre à gauche." : "Boîte aux lettres vide."}</div>`;
  const unread = box.filter(x => !x.read).length;
  if (!box.length) return `<div class="ms-lhead"><i class="fa-solid fa-inbox"></i><b>Boîte aux lettres</b><small>0 lettre</small><span class="grow"></span><a class="ms-mbtn blue" data-mact="lNew"><i class="fa-solid fa-feather-pointed"></i> Nouvelle lettre</a></div>
    <div class="ms-lempty"><div class="ic"><i class="fa-solid fa-envelope-open"></i></div><b>Boîte aux lettres vide</b><small>Les lettres reçues, avec leurs pièces jointes, arriveront ici.</small></div>`;
  return `<div class="ms-lhead"><i class="fa-solid fa-inbox"></i><b>Boîte aux lettres</b><small>${box.length} lettre${box.length > 1 ? "s" : ""}${unread ? ` · <em>${unread} non lue${unread > 1 ? "s" : ""}</em>` : ""}</small><span class="grow"></span><a class="ms-mbtn blue" data-mact="lNew"><i class="fa-solid fa-feather-pointed"></i> Nouvelle lettre</a></div>
    <div class="ms-letters"><aside><div class="ms-lrows">${rows || ""}</div></aside><section>${view}</section></div>`;
}
const READ_SENT = new Set();   /* lettres dont la demande « lue » est déjà partie : un seul envoi, pas un par rendu */
export function bindLetters(app) { const l = inbox(app.actor).find(x => x.id === app.letterId); if (l && !l.read && !READ_SENT.has(l.id)) { READ_SENT.add(l.id); setTimeout(() => READ_SENT.delete(l.id), 15000); gmDo("letterRead", { lid: l.id, actor: app.actor.uuid }); } }

export async function actLetters(app, act, el) {
  switch (act) {
    case "lOpen": app.letterId = el.dataset.lid; return app.render();
    case "lClaim": { if (el.dataset.busy) return; el.dataset.busy = "1"; el.classList.add("off"); setTimeout(() => { delete el.dataset.busy; el.classList.remove("off"); }, 4000); return gmDo("letterClaim", { lid: app.letterId, actor: app.actor.uuid }); }
    case "lDel": { const lid = app.letterId; if (!lid || !await DialogV2.confirm({ window: { title: "Supprimer la lettre" }, classes: ["ms-dialog"], content: "<p>Supprimer cette lettre ? Les pièces jointes non récupérées sont perdues.</p>" })) return; app.letterId = null; return gmDo("letterDelete", { lid, actor: app.actor.uuid }); }
    case "lNew": return compose(app);
    case "lReply": { const l = inbox(app.actor).find(x => x.id === app.letterId); return compose(app, { to: l?.fromUuid, subject: l?.subject?.startsWith("Re :") ? l.subject : `Re : ${l?.subject || ""}` }); }
  }
}

/* ── rédaction : destinataires en cartes (joueurs › fiches, puis PNJ), pièces jointes bien visibles ── */
async function compose(app, pre = {}) {
  const gm = game.user.isGM; const me = app.actor;
  const inv = me.items.contents.sort((a, b) => a.name.localeCompare(b.name, "fr")).map(i => { const q = Math.max(1, Number(i.system.quantity) || 1); return `<label class="ms-tpick" data-iid="${i.id}"><img src="${esc(i.img)}"><b>${esc(i.name)}</b><small>${q > 1 ? `×${q}` : ""}</small><input type="number" name="it-${i.id}" min="0" max="${q}" value="0"></label>`; }).join("");
  const content = `<div class="ms-lcompose">
    <div class="col rc"><h3><i class="fa-solid fa-user-group"></i> Destinataires</h3>${actorRecipients({ selected: pre.to ? [pre.to] : [], exclude: [me.uuid], multi: true, npcs: true })}</div>
    <div class="col wr">
      ${gm ? `<label>De <span class="row"><select name="fromAs"><option value="me">${esc(me.name)}</option><option value="free">Nom libre…</option></select><input type="text" name="fromName" value="" placeholder="PNJ, guilde, organisation…"></span></label>` : `<div class="from"><img src="${esc(me.img)}"><span>De <b>${esc(me.name)}</b></span></div>`}
      <label>Objet<input type="text" name="subject" value="${esc(pre.subject || "")}" placeholder="Objet de la lettre"></label>
      <label class="grow">Lettre<textarea name="body" rows="8" placeholder="Écris ta lettre…"></textarea></label>
      <div class="att"><h3><i class="fa-solid fa-paperclip"></i> Pièces jointes <small data-attcount></small></h3>
        <label class="gold"><i class="fa-solid fa-coins"></i> ${esc(gname())}<input type="number" name="gold" min="0" value="0">${gm ? "" : `<small>dispo : ${fmt(goldOf(me))}</small>`}</label>
        <div class="drop" data-ldrop><i class="fa-solid fa-box-open"></i><span>${gm ? "Glisse ici des objets (répertoire, compendium ou inventaire)" : "Glisse ici des objets de ton inventaire"}</span></div>
        <div class="chips" data-chips></div>
        <details><summary>Choisir dans l'inventaire de ${esc(me.name)}</summary><div class="list">${inv || "<p class='ms-mhint'>Inventaire vide.</p>"}</div></details></div>
    </div></div>`;
  const dropped = [];
  const r = await DialogV2.prompt({ window: { title: "Nouvelle lettre", icon: "fa-solid fa-feather-pointed" }, classes: ["ms-dialog", "ms-menu-dialog", "ms-lcompose-win"], position: { width: 920, height: 640 }, content, rejectClose: false,
    ok: { label: "Envoyer", icon: "fa-solid fa-paper-plane", callback: (ev, btn) => { const f = btn.form; return { to: pickedActors(f), subject: f.elements.subject.value.trim(), body: f.elements.body.value.trim(), gold: Math.max(0, Math.floor(Number(f.elements.gold.value) || 0)), items: [...f.querySelectorAll('input[name^="it-"]')].map(i => ({ id: i.name.slice(3), qty: Math.floor(Number(i.value) || 0) })).filter(x => x.qty > 0), fromName: f.elements.fromName?.value.trim(), fromAs: f.elements.fromAs?.value || "me", dropped }; } },
    render: (ev, dlg) => { const el = dlg.element ?? dlg; bindRecipients(el);
      const chips = el.querySelector("[data-chips]"), cnt = el.querySelector("[data-attcount]");
      const redraw = () => { const inv = [...el.querySelectorAll('input[name^="it-"]')].filter(i => Number(i.value) > 0).map(i => { const row = i.closest(".ms-tpick"); return `<span class="chip inv" data-iid="${row.dataset.iid}"><img src="${row.querySelector("img").src}"><b>${row.querySelector("b").textContent}</b>${Number(i.value) > 1 ? `<em>×${i.value}</em>` : ""}<a data-rm><i class="fa-solid fa-xmark"></i></a></span>`; });
        const dr = dropped.map((o, k) => `<span class="chip new" data-k="${k}"><img src="${esc(o.img)}"><b>${esc(o.name)}</b><small>nouveau</small><a data-rm><i class="fa-solid fa-xmark"></i></a></span>`);
        chips.innerHTML = [...inv, ...dr].join("") || `<span class="ms-mhint">Aucune pièce jointe.</span>`; const n = inv.length + dr.length; cnt.textContent = n ? `(${n})` : ""; };
      el.addEventListener("input", e => { if (e.target.name?.startsWith("it-")) redraw(); });
      chips.addEventListener("click", e => { const x = e.target.closest("[data-rm]"); if (!x) return; e.preventDefault(); const c = x.closest(".chip"); if (c.dataset.k !== undefined) dropped.splice(Number(c.dataset.k), 1); else { const i = el.querySelector(`input[name="it-${c.dataset.iid}"]`); if (i) i.value = 0; } redraw(); });
      const d = el.querySelector("[data-ldrop]");
      for (const tgt of [d, chips]) { tgt.addEventListener("dragover", e => { e.preventDefault(); d.classList.add("over"); }); tgt.addEventListener("dragleave", () => d.classList.remove("over"));
        tgt.addEventListener("drop", async e => { e.preventDefault(); e.stopPropagation(); d.classList.remove("over"); let data; try { data = JSON.parse(e.dataTransfer.getData("text/plain")); } catch (x) { return; } if (data?.type !== "Item") return; const it = await fromUuid(data.uuid); if (!it) return;
          if (it.parent?.uuid === me.uuid) { const i = el.querySelector(`input[name="it-${it.id}"]`); if (i) i.value = Math.min(Number(i.max) || 1, (Number(i.value) || 0) + 1); }
          else if (gm) { const o = it.toObject(); delete o._id; dropped.push(o); }
          else return ui.notifications.warn("Tu ne peux joindre que des objets de ton inventaire.");
          redraw(); }); }
      redraw(); } });
  if (!r) return; if (!r.to.length) return ui.notifications.warn("Choisis au moins un destinataire.");
  if (!r.subject && !r.body && !r.gold && !r.items.length && !r.dropped.length) return ui.notifications.warn("Lettre vide.");
  if (!gm && (r.items.length || r.gold) && r.to.length > 1) return ui.notifications.warn("Avec des pièces jointes, un seul destinataire.");
  return gmDo("letterSend", { from: me.uuid, ...r });
}

/* ── exécuté par le MJ ── */
onGm("letterSend", async (d, userId) => {
  const user = game.users.get(userId); const from = actorOf(d.from); if (!from || !userCanActor(userId, from)) return;
  const gm = user?.isGM; const to = (d.to || []).map(actorOf).filter(Boolean); if (!to.length) return;
  const extra = (gm ? d.dropped || [] : []).map(o => ({ name: o.name, img: o.img, qty: Math.max(1, Number(o.system?.quantity) || 1), data: o }));
  const free = gm && d.fromAs === "free" && d.fromName; const gold = Math.max(0, Number(d.gold) || 0);
  /* tout se fait sous le verrou de l'expéditeur : deux lettres parties en même temps ne peuvent pas joindre le même objet ni dépenser le même or */
  const sent = await actorLock(from, async () => {
    /* pièces jointes prises dans l'inventaire de l'expéditeur (relues ici, sous verrou) */
    const items = []; for (const x of d.items || []) { const it = from.items.get(x.id); if (!it) continue; const q = Math.max(1, Number(it.system.quantity) || 1); const n = Math.min(q, Math.max(1, Number(x.qty) || 1)); const o = it.toObject(); delete o._id; o.system.quantity = n; o.system.equipped = false; items.push({ name: it.name, img: it.img, qty: n, data: o, src: it.id, left: q - n }); }
    if (items.length && to.length > 1) { toast(userId, "Une lettre avec des objets de ton inventaire ne peut partir qu'à un seul destinataire.", "warn"); return false; }
    if (gold && !gm && goldOf(from) < gold * to.length) { toast(userId, `${from.name} n'a pas assez de ${gname()}.`, "warn"); return false; }
    /* 1. la lettre est écrite d'abord (pièces jointes « en transit ») : si la prise d'objets échoue, on la retire ; rien ne peut être perdu */
    const ids = to.map(() => uid());
    const r = await editList("letters", l => { to.forEach((a, i) => l.push({ id: ids[i], to: a.uuid, fromUuid: free ? "" : from.uuid, fromName: free ? d.fromName : from.name, fromImg: free ? "icons/svg/book.svg" : from.img, subject: String(d.subject || "").slice(0, 200), body: String(d.body || "").slice(0, 8000), items: [...items, ...extra].map(({ name, img, qty, data }) => ({ name, img, qty, data })), gold, read: false, claimed: false, pending: true, date: Date.now() })); });
    if (!r?.changed) { toast(userId, "La lettre n'a pas pu être enregistrée.", "error"); return false; }
    /* 2. prise des objets et de l'or */
    try {
      const del = items.filter(i => i.left <= 0).map(i => i.src), upd = items.filter(i => i.left > 0).map(i => ({ _id: i.src, "system.quantity": i.left }));
      if (upd.length) await from.updateEmbeddedDocuments("Item", upd); if (del.length) await from.deleteEmbeddedDocuments("Item", del);
      if (gold && !gm) { const k = goldKey(); if (k) await from.update({ [`system.resources.${k}`]: Math.max(0, goldOf(from) - gold * to.length) }); }
    } catch (err) { console.error(SYS, err); await editList("letters", l => { for (const id of ids) { const i = l.findIndex(y => y.id === id); if (i >= 0) l.splice(i, 1); } }); toast(userId, `Envoi annulé : ${err.message}`, "error"); return false; }
    /* 3. la lettre devient réclamable */
    await editList("letters", l => { for (const x of l) if (ids.includes(x.id)) delete x.pending; });
    return true;
  });
  if (!sent) return;
  const users = [...new Set(to.flatMap(ownersOf))]; game.socket.emit(`system.${SYS}`, { op: "mailPing", to: users, text: `Vous avez du courrier : « ${d.subject || "(sans objet)"} »` });
  toast(userId, `Lettre envoyée à ${to.map(a => a.name).join(", ")}.`); refreshMenus();
});
onGm("letterRead", async ({ lid, actor }, userId) => { const a = actorOf(actor); if (!userCanActor(userId, a)) return; await editList("letters", l => { const x = l.find(y => y.id === lid && y.to === actor); if (!x || x.read) return false; x.read = true; }); });
onGm("letterClaim", async ({ lid, actor }, userId) => {
  const a = actorOf(actor); if (!a || !userCanActor(userId, a)) return;
  /* la vérification « déjà réclamée » et le marquage se font dans la même écriture sous verrou : un double clic ne peut pas récupérer deux fois */
  let x = null; await editList("letters", l => { const y = l.find(z => z.id === lid && z.to === actor); if (!y || y.claimed || y.pending) return false; y.claimed = true; y.read = true; x = foundry.utils.deepClone(y); });
  if (!x) return;
  try { if (x.items?.length) await a.createEmbeddedDocuments("Item", x.items.map(i => i.data).filter(Boolean)); if (x.gold) await addGold(a, x.gold); }
  catch (err) { console.error(SYS, err); await editList("letters", l => { const y = l.find(z => z.id === lid); if (y) y.claimed = false; }); toast(userId, `Récupération échouée : ${err.message}`, "error"); return; }
  toast(userId, `${a.name} récupère les pièces jointes.`);
});
onGm("letterDelete", async ({ lid, actor }, userId) => { const a = actorOf(actor); if (!userCanActor(userId, a)) return; await editList("letters", l => { const i = l.findIndex(y => y.id === lid && y.to === actor); if (i < 0) return false; l.splice(i, 1); }); });
