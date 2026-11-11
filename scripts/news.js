/* Manhwa Sheet — Annonces : événements, raids, festivals, nouvelles du monde. Le MJ publie ; tout le monde lit.
 * Une annonce épinglée s'affiche en grand en haut ; les autres en cartes. Non lues = badge dans le Menu. */
import { SYS, esc } from "./config.js";
import { news, editList, uid, refreshMenus } from "./world.js";
import { userRecipients, pickedUsers, bindRecipients } from "./pickers.js";

const DialogV2 = foundry.applications.api.DialogV2;
const FP = () => foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
export const NEWS_KINDS = { event: ["Événement", "fa-calendar-days", "#ff9b3d"], raid: ["Raid", "fa-dragon", "#ff4d5e"], boss: ["Boss mondial", "fa-skull-crossbones", "#ff2bd6"], dungeon: ["Donjon ouvert", "fa-dungeon", "#b980ff"], tournament: ["Tournoi", "fa-trophy", "#ffd070"], festival: ["Festival", "fa-masks-theater", "#ff8af0"], market: ["Marché & soldes", "fa-store", "#5aff9a"], war: ["Guerre", "fa-khanda", "#ff6a3d"], season: ["Nouvelle saison", "fa-leaf", "#9be564"], update: ["Nouveauté", "fa-wand-magic-sparkles", "#38e0ff"], world: ["Nouvelles du monde", "fa-earth-europe", "#4a8dff"], rumor: ["Rumeur", "fa-ear-listen", "#c9b07a"], danger: ["Alerte", "fa-triangle-exclamation", "#ffd000"], info: ["Info", "fa-circle-info", "#9fb0d4"] };
export const NEWS_STYLES = { systeme: "Fenêtre système (bleu)", fantasy: "Fantasy (parchemin doré)", scifi: "Science-fiction (hologramme)", cyber: "Cyberpunk (néon rose)", royal: "Royal (velours et or)", horreur: "Horreur (sang)", festif: "Festif (couleurs pimpantes)", sobre: "Sobre" };
export const NEWS_GLOW = { 0: "Aucun", 1: "Doux", 2: "Fort", 3: "Néon" };
const kind = k => NEWS_KINDS[k] || NEWS_KINDS.info;
const seen = () => Number(game.user.getFlag(SYS, "newsSeen")) || 0;
export const unreadNews = () => news().filter(n => n.date > seen() && (game.user.isGM || !n.audience?.length || n.audience.includes(game.user.id))).length;
const date = ts => new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

export function renderNews(app) {
  const gm = game.user.isGM; const mineN = n => gm || !n.audience?.length || n.audience.includes(game.user.id); const list = news().filter(mineN).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.date - a.date); const s = app._newsSeen ?? seen();
  const hero = list.find(n => n.pinned) || list[0];
  const card = n => { const [kn, ic, kcol] = kind(n.kind); const col = n.color || kcol; const aud = n.audience?.length ? n.audience.map(id => game.users.get(id)?.name).filter(Boolean) : null; return `<article class="ms-news w-${n.style || "systeme"} gl-${Number(n.glow ?? 1)}${n === hero ? " hero" : ""}${n.date > s ? " new" : ""}" data-nid="${n.id}" style="--nc:${col}">
    ${n.img ? `<div class="im" style="background-image:url('${esc(n.img)}')"></div>` : `<div class="im none"><i class="fa-solid ${ic}"></i></div>`}
    <div class="tx"><div class="k"><span><i class="fa-solid ${ic}"></i>${kn}</span>${n.pinned ? `<i class="fa-solid fa-thumbtack pin" title="Épinglée"></i>` : ""}${n.date > s ? `<b class="nw">NOUVEAU</b>` : ""}<small>${date(n.date)}</small></div>${gm && aud ? `<div class="aud"><i class="fa-solid fa-user-lock"></i>Pour : ${esc(aud.join(", "))}</div>` : ""}
      <h3>${esc(n.title)}</h3>${n.when ? `<div class="when"><i class="fa-solid fa-clock"></i>${esc(n.when)}</div>` : ""}<p>${esc(n.body || "").replace(/\n/g, "<br>")}</p>
      ${gm ? `<footer><a data-mact="nEdit"><i class="fa-solid fa-pen"></i> Modifier</a><a data-mact="nPin"><i class="fa-solid fa-thumbtack"></i> ${n.pinned ? "Désépingler" : "Épingler"}</a><a data-mact="nChat"><i class="fa-solid fa-comment"></i> Chat</a><a data-mact="nDel" class="x"><i class="fa-solid fa-trash"></i></a></footer>` : ""}</div></article>`; };
  return `${gm ? `<div class="ms-mtop"><a class="ms-mbtn blue" data-mact="nNew"><i class="fa-solid fa-plus"></i> Nouvelle annonce</a></div>` : ""}
    ${list.length ? `<div class="ms-newslist">${list.map(card).join("")}</div>` : `<div class="ms-mhint big"><i class="fa-solid fa-bullhorn"></i>Aucune annonce pour l'instant.</div>`}`;
}
export function bindNews(app) { const last = Math.max(0, ...news().map(n => n.date)); app._newsSeen ??= seen(); if (last > seen()) game.user.setFlag(SYS, "newsSeen", last); }

export async function actNews(app, act, el) {
  const nid = el.closest("[data-nid]")?.dataset.nid; const upd = fn => editList("news", l => { const n = l.find(x => x.id === nid); if (!n) return false; return fn(n, l); });
  switch (act) {
    case "nNew": { const n = await editNews(null); if (!n) return; await editList("news", l => { l.push(n); }); announce(n, true); return; }
    case "nEdit": { const n = await editNews(news().find(x => x.id === nid)); if (n) await upd(x => Object.assign(x, n)); return; }
    case "nPin": return upd(n => { n.pinned = !n.pinned; });
    case "nDel": { if (!await DialogV2.confirm({ window: { title: "Supprimer l'annonce" }, classes: ["ms-dialog"], content: "<p>Supprimer cette annonce ?</p>" })) return; return editList("news", l => { l.splice(l.findIndex(x => x.id === nid), 1); }); }
    case "nChat": return announce(news().find(x => x.id === nid), false, true);
  }
}
async function announce(n, ping, chat = false) {
  if (!n) return; const [kn, ic, kcol] = kind(n.kind); const col = n.color || kcol; const to = n.audience?.length ? n.audience : game.users.filter(u => !u.isGM).map(u => u.id);
  if (ping) game.socket.emit(`system.${SYS}`, { op: "mailPing", to, text: `Nouvelle annonce : ${n.title}` });
  if (chat) await ChatMessage.create({ speaker: { alias: "Annonce" }, whisper: n.audience?.length ? [...n.audience, ...game.users.filter(u => u.isGM).map(u => u.id)] : [], content: `<div class="ms-syscard newscard w-${n.style || "systeme"} gl-${Number(n.glow ?? 1)}" style="--nc:${col}"><header><i class="fa-solid ${ic}"></i><b>${esc(kn.toUpperCase())}</b></header>${n.img ? `<img src="${esc(n.img)}">` : ""}<h3>${esc(n.title)}</h3>${n.when ? `<p class="when"><i class="fa-solid fa-clock"></i> ${esc(n.when)}</p>` : ""}<p>${esc(n.body || "").replace(/\n/g, "<br>")}</p></div>` });
  refreshMenus();
}
async function editNews(cur) {
  const n = { id: uid(), title: "", kind: "event", img: "", when: "", body: "", pinned: false, date: Date.now(), color: "", style: "systeme", glow: 1, audience: [], ...(cur || {}) };
  const sel = (name, obj, v) => `<select name="${name}">${Object.entries(obj).map(([k, x]) => `<option value="${k}"${String(k) === String(v) ? " selected" : ""}>${Array.isArray(x) ? x[0] : x}</option>`).join("")}</select>`;
  const content = `<div class="ms-nedit"><div class="col">
    <label>Titre<input type="text" name="title" value="${esc(n.title)}" autofocus placeholder="ex. Festival de la Lune Rouge"></label>
    <div class="r3"><label>Type${sel("kind", NEWS_KINDS, n.kind)}</label><label>Ambiance${sel("style", NEWS_STYLES, n.style)}</label><label>Éclat${sel("glow", NEWS_GLOW, n.glow)}</label></div>
    <div class="r3"><label>Couleur<span class="row"><input type="color" name="color" value="${esc(n.color || NEWS_KINDS[n.kind]?.[2] || "#ff9b3d")}"><label class="chk"><input type="checkbox" name="kcol"${n.color ? "" : " checked"}> celle du type</label></span></label><label class="span2">Quand<input type="text" name="when" value="${esc(n.when)}" placeholder="ex. Samedi soir, à la tombée de la nuit"></label></div>
    <label>Bannière<span class="row"><input type="text" name="img" value="${esc(n.img)}" placeholder="image (facultative)"><button type="button" class="browse"><i class="fa-solid fa-folder-open"></i></button></span></label>
    <label class="grow">Texte<textarea name="body" rows="7">${esc(n.body)}</textarea></label>
    <div class="r3"><label class="chk"><input type="checkbox" name="pinned"${n.pinned ? " checked" : ""}> Épinglée en haut</label>${cur ? "" : `<label class="chk"><input type="checkbox" name="chat" checked> Publier aussi dans le chat</label>`}</div>
    <div class="ms-npreview" data-prev></div></div>
    <div class="col aud"><h3><i class="fa-solid fa-users"></i> Destinée à</h3><label class="chk big"><input type="checkbox" name="all"${n.audience?.length ? "" : " checked"}> Tout le monde</label><p class="ms-mhint">Ou seulement ces joueurs (avec leurs fiches liées) :</p>${userRecipients(n.audience || [])}</div></div>`;
  const r = await DialogV2.prompt({ window: { title: cur ? "Modifier l'annonce" : "Nouvelle annonce", icon: "fa-solid fa-bullhorn" }, classes: ["ms-dialog", "ms-menu-dialog", "ms-nedit-win"], position: { width: 900 }, content, rejectClose: false,
    ok: { label: "Publier", icon: "fa-solid fa-bullhorn", callback: (ev, btn) => { const f = btn.form.elements; const users = pickedUsers(btn.form);
      return { id: n.id, title: f.title.value.trim() || "Annonce", kind: f.kind.value, style: f.style.value, glow: Number(f.glow.value), color: f.kcol.checked ? "" : f.color.value, when: f.when.value.trim(), img: f.img.value.trim(), body: f.body.value.trim(), pinned: f.pinned.checked, audience: f.all.checked ? [] : users, date: cur ? n.date : Date.now(), _chat: f.chat?.checked }; } },
    render: (ev, dlg) => { const el = dlg.element ?? dlg; const f = el.querySelector("form") ?? el; bindRecipients(el);
      el.querySelector(".browse")?.addEventListener("click", () => { const i = el.querySelector('[name="img"]'); new (FP())({ type: "image", current: i.value, callback: p => { i.value = p; prev(); } }).render(true); });
      const prev = () => { const g = n2 => el.querySelector(`[name="${n2}"]`); const k = NEWS_KINDS[g("kind").value] || NEWS_KINDS.info; const col = g("kcol").checked ? k[2] : g("color").value; if (g("kcol").checked) g("color").value = k[2];
        el.querySelector("[data-prev]").innerHTML = `<article class="ms-news w-${g("style").value} gl-${g("glow").value}" style="--nc:${col}">${g("img").value ? `<div class="im" style="background-image:url('${esc(g("img").value)}')"></div>` : `<div class="im none"><i class="fa-solid ${k[1]}"></i></div>`}<div class="tx"><div class="k"><span><i class="fa-solid ${k[1]}"></i>${k[0]}</span></div><h3>${esc(g("title").value || "Titre de l'annonce")}</h3>${g("when").value ? `<div class="when"><i class="fa-solid fa-clock"></i>${esc(g("when").value)}</div>` : ""}<p>${esc(g("body").value.slice(0, 140) || "Aperçu du texte…")}</p></div></article>`; };
      el.addEventListener("input", prev); el.addEventListener("change", e => { if (e.target.name === "color") el.querySelector('[name="kcol"]').checked = false; if (e.target.name === "ruser" && e.target.checked) el.querySelector('[name="all"]').checked = false; prev(); }); prev(); } });
  if (r?._chat) setTimeout(() => announce(r, false, true), 300); if (r) delete r._chat;
  return r || null;
}
