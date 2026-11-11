/* Manhwa Sheet — le Carnet : amis, lieux (points de téléportation) et notes, en arborescences de dossiers.
 * Amis et lieux : juste des noms, rangés dans des dossiers et sous-dossiers (groupes / zones). Un ami dont le nom est exactement
 * celui d'un personnage ou d'un PNJ ouvre sa fiche. Notes : des journaux Foundry (chapitres = pages), rangés dans le dossier
 * « Carnets » du journal, organisés ici en dossiers ; notes partagées = journaux du dossier « Notes partagées », ouverts à toute la table. */
import { SYS, esc, uid, kindLabel } from "./config.js";
import { gmDo, onGm, toast, actorLock } from "./world.js";

const { ApplicationV2 } = foundry.applications.api; const DialogV2 = foundry.applications.api.DialogV2;
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const FOLDER_CARNETS = "Carnets", FOLDER_SHARED = "Notes partagées";
const TABS = [["friends", "Amis", "fa-user-group"], ["places", "Téléportation", "fa-location-dot"], ["notes", "Notes", "fa-pen-nib"]];
const LABEL = { friends: "ami", places: "lieu", notes: "note" };
const ICON = { friends: "fa-user", places: "fa-location-dot", notes: "fa-file-lines" };

/* 1.33 — couleur et icône des dossiers et des entrées, tri */
export const CARNET_ICONS = ["fa-folder", "fa-earth-europe", "fa-globe", "fa-moon", "fa-sun", "fa-star", "fa-meteor", "fa-satellite", "fa-satellite-dish", "fa-rocket", "fa-shuttle-space", "fa-user-astronaut",
  "fa-city", "fa-building", "fa-house", "fa-chess-rook", "fa-tower-observation", "fa-dungeon", "fa-mountain", "fa-mountain-sun", "fa-tree", "fa-water", "fa-anchor", "fa-ship",
  "fa-campground", "fa-landmark", "fa-place-of-worship", "fa-torii-gate", "fa-skull", "fa-dragon", "fa-fire", "fa-snowflake", "fa-gem", "fa-crown", "fa-shield-halved", "fa-flag",
  "fa-location-dot", "fa-map", "fa-compass", "fa-door-open", "fa-atom", "fa-bolt", "fa-heart", "fa-user-group", "fa-user", "fa-book", "fa-feather", "fa-scroll"];
export const CARNET_COLORS = ["#5ee0ff", "#3d8bff", "#a46bff", "#ff4fd8", "#ff5d6c", "#ff9a3d", "#ffd36b", "#9be564", "#3ddc84", "#2fd8c8", "#c9b07a", "#e6ecff"];
const DEF_COLOR = { places: "#a46bff", friends: "#b980ff", notes: "#e2c27a" };
const nodeName = n => n.journal ? (game.journal.get(n.journal)?.name || n.name || "") : (n.name || "");
const sortNodes = (ns, by, deep) => { ns.sort((a, b) => (b.folder ? 1 : 0) - (a.folder ? 1 : 0) || (by === "zone" && !a.folder && !b.folder ? norm(a.zone || "~").localeCompare(norm(b.zone || "~"), "fr") : 0) || norm(nodeName(a)).localeCompare(norm(nodeName(b)), "fr", { numeric: true }));
  if (deep) for (const n of ns) if (n.folder) sortNodes(n.children ||= [], by, deep); };
const inSubtree = (n, id) => { for (const x of walk(n.children || [])) if (x.n.id === id) return true; return false; };
/* fenêtre « Modifier » : nom, couleur, icône */
async function styleDialog(n, key, inh) {
  const cur = n.color || ""; const ic = n.icon || "";
  const content = `<div class="ms-form ms-styledlg"><label>Nom<input type="text" name="name" value="${esc(nodeName(n))}"></label>
    <h5>Couleur</h5><div class="sw"><label class="def"><input type="radio" name="c" value=""${cur ? "" : " checked"}><span style="--c:${inh || DEF_COLOR[key]}">auto</span></label>${CARNET_COLORS.map(c => `<label><input type="radio" name="c" value="${c}"${cur === c ? " checked" : ""}><span style="--c:${c}"></span></label>`).join("")}<label class="free"><input type="radio" name="c" value="free"${cur && !CARNET_COLORS.includes(cur) ? " checked" : ""}><input type="color" name="cf" value="${cur && !CARNET_COLORS.includes(cur) ? cur : "#5ee0ff"}"></label></div>
    <h5>Icône</h5><div class="ig"><label class="def"><input type="radio" name="i" value=""${ic ? "" : " checked"}><span>auto</span></label>${CARNET_ICONS.map(x => `<label><input type="radio" name="i" value="${x}"${ic === x ? " checked" : ""}><i class="fa-solid ${x}"></i></label>`).join("")}</div></div>`;
  return DialogV2.prompt({ window: { title: n.folder ? "Modifier le dossier" : "Modifier", icon: "fa-solid fa-palette" }, classes: ["ms-dialog", "ms-style-dlg"], position: { width: 520 }, content, rejectClose: false,
    render: (ev, dlg) => { const root = dlg.element ?? dlg; root.querySelector('[name="cf"]')?.addEventListener("input", () => { const r = root.querySelector('[name="c"][value="free"]'); if (r) r.checked = true; }); },
    ok: { label: "Valider", icon: "fa-solid fa-check", callback: (e, b) => { const f = b.form.elements; const c = f.c.value === "free" ? f.cf.value : f.c.value; return { name: f.name.value.trim(), color: c, icon: f.i.value }; } } });
}
/* ami lié à une fiche : par son identifiant s'il a été choisi dans la liste, sinon par le nom exact */
const friendActor = n => { if (n?.uuid) { try { const a = fromUuidSync(n.uuid); if (a) return a; } catch (e) { /* acteur supprimé */ } } return game.actors.find(a => norm(a.name) === norm(n?.name)) ?? null; };
/* ── dossiers du journal (créés par le MJ) ── */
export async function journalFolder(name, create = false) {
  let f = game.folders.find(x => x.type === "JournalEntry" && x.name === name && !x.folder);
  if (!f && create && game.user.isGM) f = await Folder.create({ name, type: "JournalEntry", color: name === FOLDER_SHARED ? "#1f6fe0" : "#5a3d8a" });
  return f ?? null;
}
Hooks.once("ready", async () => { if (game.user.isGM) { await journalFolder(FOLDER_CARNETS, true); await journalFolder(FOLDER_SHARED, true); } });
export const sharedNotes = () => game.journal.filter(j => j.getFlag(SYS, "shared") && j.testUserPermission(game.user, "LIMITED"));
const canCreateJournal = () => game.user.isGM || game.user.can("JOURNAL_CREATE");

/* ── arbre : utilitaires ── */
const walk = function* (nodes, depth = 0, parent = null) { for (const n of nodes || []) { yield { n, depth, parent }; if (n.folder) yield* walk(n.children, depth + 1, n); } };
const findNode = (nodes, id) => { for (const { n, parent } of walk(nodes)) if (n.id === id) return { n, parent }; return null; };
const removeNode = (nodes, id) => { const i = nodes.findIndex(x => x.id === id); if (i >= 0) return nodes.splice(i, 1)[0]; for (const n of nodes) if (n.folder) { const r = removeNode(n.children, id); if (r) return r; } return null; };
const folders = nodes => [...walk(nodes)].filter(x => x.n.folder);
const jids = nodes => [...walk(nodes)].filter(x => !x.n.folder && x.n.journal).map(x => x.n.journal);

export class CarnetApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = { classes: ["ms-sheet", "ms-carnet"], window: { resizable: true, icon: "fa-solid fa-book-bookmark" }, position: { width: 560, height: 560 } };
  static open(actor, tab) { const id = `ms-carnet-${actor.id}`; let app = foundry.applications.instances.get(id); if (!app) app = new CarnetApp({ id }, actor); if (tab) app.tab = tab; app.render({ force: true }); return app; }
  constructor(options, actor) { super(options); this.actor = actor; this.tab = "friends"; this.noteTab = "mine"; }
  get title() { return `Carnet — ${this.actor.name}`; }
  get editable() { return this.actor.isOwner; }
  get data() { const c = this.actor.system.carnet || {}; return { friends: c.friends || [], places: c.places || [], notes: c.notes || [] }; }
  async save(key, nodes) { return this.actor.update({ [`system.carnet.${key}`]: nodes }); }
  /** modifie l'arbre à partir de sa version la plus fraîche, sous verrou du personnage (1.25.0) : la fenêtre de saisie peut rester ouverte
   * longtemps, pendant que quelqu'un d'autre (MJ, autre joueur du même personnage) change le carnet ; on n'écrase plus ses changements. */
  async edit(key, mut) { return actorLock(this.actor, async () => { const nodes = foundry.utils.deepClone(this.data[key]); const r = mut(nodes); if (r === false) return false; await this.save(key, nodes); return true; }); }

  async _renderHTML() {
    const tabs = TABS.map(t => `<a data-act="tab" data-tab="${t[0]}" class="${this.tab === t[0] ? "on" : ""}"><i class="fa-solid ${t[2]}"></i>${t[1]}</a>`).join("");
    const body = this.tab === "notes" ? this.#notes() : this.#tree(this.tab);
    return `<div class="ms-wrap ms-carnet-wrap"><nav class="ms-tabs">${tabs}</nav><section class="ms-body ms-carnet-body">${body}</section></div>`;
  }
  _replaceHTML(r, c) { c.innerHTML = r; if (!c.dataset.msBound) { c.dataset.msBound = "1"; this.#activate(c); } }
  /* contenu d'un onglet du carnet (réutilisé par le Menu) */
  carnetBody() { return this.tab === "notes" ? this.#notes() : this.#tree(this.tab); }

  /* ── arbre générique (amis, lieux, notes perso) ── */
  #rows(key, nodes, depth = 0, inh = "") {
    const ed = this.editable; const lbl = LABEL[key];
    return (nodes || []).map(n => {
      if (n.folder) {
        const count = [...walk(n.children)].filter(x => !x.n.folder).length;
        const fc = n.color || inh;
        return `<div class="ms-tn folder${n.open === false ? " closed" : ""}" data-id="${n.id}" style="--d:${depth};${fc ? `--fc:${esc(fc)};` : ""}"${ed ? ' draggable="true"' : ""}>
          <a class="tg" data-act="toggle"><i class="fa-solid ${n.open === false ? "fa-chevron-right" : "fa-chevron-down"}"></i></a><span class="fic"><i class="fa-solid ${esc(n.icon || "fa-folder")} fi${n.icon ? " cus" : ""}"></i></span><b>${esc(n.name)}</b><small>${count}</small>
          ${ed ? `<span class="act"><a data-act="style" class="c-style" title="Modifier : nom, couleur, icône"><i class="fa-solid fa-palette"></i></a><a data-act="sortF" data-by="az" title="Trier ce dossier de A à Z"><i class="fa-solid fa-arrow-down-a-z"></i></a>${key === "places" ? `<a data-act="sortF" data-by="zone" title="Trier ce dossier par zone"><i class="fa-solid fa-map"></i></a>` : ""}<a data-act="addFolder" title="Sous-dossier"><i class="fa-solid fa-folder-plus"></i></a>${key === "friends" ? `<a data-act="addActor" title="Ajouter un personnage"><i class="fa-solid fa-address-book"></i></a>` : ""}<a data-act="addItem" title="Ajouter un ${lbl}"><i class="fa-solid fa-plus"></i></a><a data-act="rename" title="Renommer"><i class="fa-solid fa-pen"></i></a><a data-act="move" title="Déplacer"><i class="fa-solid fa-arrows-up-down-left-right"></i></a><a data-act="del" class="danger" title="Supprimer"><i class="fa-solid fa-xmark"></i></a></span>` : ""}</div>
          ${n.open === false ? "" : this.#rows(key, n.children, depth + 1, fc)}`;
      }
      const actor = key === "friends" ? friendActor(n) : null; const linked = actor && actor.testUserPermission(game.user, "LIMITED");
      const j = key === "notes" ? game.journal.get(n.journal) : null;
      const icc = n.color || inh;
      return `<div class="ms-tn item${linked ? " linked" : ""}" data-id="${n.id}" style="--d:${depth};${icc ? `--ic:${esc(icc)};` : ""}" ${j ? 'data-act="openNote"' : ""}${ed ? ' draggable="true"' : ""}>
        ${linked ? `<img class="fi" src="${esc(actor.img)}">` : `<i class="fa-solid ${esc(n.icon || ICON[key])} fi"></i>`}<b>${esc(j ? j.name : linked ? actor.name : n.name)}</b>${linked ? `<small>${kindLabel(actor)}</small>` : ""}${key === "notes" && !j ? `<small class="danger">note supprimée</small>` : ""}${key === "places" && n.zone ? `<small class="ms-zone"><i class="fa-solid fa-circle-nodes"></i>${esc(n.zone)}</small>` : ""}${key === "places" ? tpChip(this.actor, n) : ""}${key === "places" ? `<a class="ms-tp-btn" data-act="tp" title="Demander au MJ de te téléporter ici"><i class="fa-solid fa-location-arrow"></i><span>Téléportation</span></a>` : ""}
        <span class="act">${ed ? `<a data-act="style" class="c-style" title="Modifier : nom, couleur, icône"><i class="fa-solid fa-palette"></i></a>` : ""}${linked ? `<a data-act="sheet" title="Ouvrir la fiche"><i class="fa-solid fa-id-card"></i></a>` : ""}${ed && key === "places" ? `<a data-act="zone" title="Nom de la zone"><i class="fa-solid fa-map"></i></a>` : ""}${ed ? `<a data-act="rename" title="Renommer"><i class="fa-solid fa-pen"></i></a><a data-act="move" title="Déplacer"><i class="fa-solid fa-arrows-up-down-left-right"></i></a><a data-act="del" class="danger" title="Supprimer"><i class="fa-solid fa-xmark"></i></a>` : ""}</span></div>`;
    }).join("");
  }
  #tree(key) {
    const nodes = this.data[key]; const ed = this.editable; const lbl = LABEL[key]; const t = TABS.find(x => x[0] === key);
    const tools = ed ? `<div class="ms-ctools"><a class="ms-btn small" data-act="addFolder" data-root="1"><i class="fa-solid fa-folder-plus"></i> Dossier</a>${key === "friends" ? `<a class="ms-btn small" data-act="addActor" data-root="1" title="Choisir parmi les personnages que tu connais"><i class="fa-solid fa-address-book"></i> Personnage</a>` : ""}<a class="ms-btn small" data-act="addItem" data-root="1"><i class="fa-solid fa-plus"></i> ${key === "friends" ? "Nom libre" : lbl[0].toUpperCase() + lbl.slice(1)}</a><span class="ms-csep"></span><a class="ms-btn small sort" data-act="sortAll" data-by="az" title="Tout trier de A à Z (dossiers d'abord)"><i class="fa-solid fa-arrow-down-a-z"></i> A → Z</a>${key === "places" ? `<a class="ms-btn small sort" data-act="sortAll" data-by="zone" title="Tout trier par zone"><i class="fa-solid fa-circle-nodes"></i> Zone</a>` : ""}</div>` : "";
    return `<div class="ms-band" style="--tc:var(--ms-acc)"><i class="fa-solid ${t[2]}"></i><span class="t">${t[1]}</span><span class="n">${[...walk(nodes)].filter(x => !x.n.folder).length}</span>${tools}</div>
      <div class="ms-tree" data-key="${key}">${this.#rows(key, nodes) || `<div class="ms-empty">Rien pour l'instant.</div>`}${ed && nodes.length ? `<div class="ms-tdrop" data-root="1">Dépose ici pour remettre à la racine</div>` : ""}</div>`;
  }
  /* ── notes : perso (arbre) + partagées (journaux du dossier commun, rangés par chemin) ── */
  #notes() {
    const sub = `<nav class="ms-subtabs"><a data-act="noteTab" data-sub="mine" class="${this.noteTab === "mine" ? "on" : ""}"><i class="fa-solid fa-lock"></i> Personnelles</a><a data-act="noteTab" data-sub="shared" class="${this.noteTab === "shared" ? "on" : ""}"><i class="fa-solid fa-users"></i> Partagées</a></nav>`;
    if (this.noteTab === "mine") return sub + this.#tree("notes");
    const list = sharedNotes(); const byPath = new Map();
    for (const j of list) { const p = String(j.getFlag(SYS, "path") || ""); if (!byPath.has(p)) byPath.set(p, []); byPath.get(p).push(j); }
    const paths = [...byPath.keys()].sort((a, b) => norm(a).localeCompare(norm(b)));
    const row = j => `<div class="ms-tn item" data-jid="${j.id}" data-act="openShared"><i class="fa-solid fa-file-lines fi"></i><b>${esc(j.name)}</b>
      <span class="act">${j.isOwner ? `<a data-act="renameShared" title="Renommer"><i class="fa-solid fa-pen"></i></a><a data-act="moveShared" title="Déplacer"><i class="fa-solid fa-arrows-up-down-left-right"></i></a><a data-act="delShared" class="danger" title="Supprimer"><i class="fa-solid fa-xmark"></i></a>` : ""}</span></div>`;
    const body = paths.map(p => `${p ? `<div class="ms-tn folder" style="--d:0"><i class="fa-solid fa-folder fi"></i><b>${esc(p)}</b><small>${byPath.get(p).length}</small></div>` : ""}${byPath.get(p).sort((a, b) => norm(a.name).localeCompare(norm(b.name))).map(row).join("")}`).join("");
    const tools = canCreateJournal() ? `<div class="ms-ctools"><a class="ms-btn small" data-act="addShared"><i class="fa-solid fa-plus"></i> Note partagée</a></div>` : "";
    return `${sub}<div class="ms-band" style="--tc:var(--ms-acc2)"><i class="fa-solid fa-users"></i><span class="t">Notes partagées</span><span class="n">${list.length}</span>${tools}</div>
      <div class="ms-tree shared">${body || `<div class="ms-empty">Aucune note partagée.${canCreateJournal() ? "" : " Le MJ doit autoriser la création de journaux aux joueurs."}</div>`}</div>`;
  }

  #activate(root) {
    root.addEventListener("click", async ev => { const a = ev.target.closest("[data-act]"); if (!a) return; ev.preventDefault(); ev.stopPropagation(); await this.#act(a.dataset.act, a); });
    /* 1.33 — tri manuel : glisser une entrée ou un dossier avant / après une autre, dans un dossier, ou à la racine */
    const clear = () => root.querySelectorAll(".drop-before, .drop-after, .drop-in").forEach(x => x.classList.remove("drop-before", "drop-after", "drop-in"));
    root.addEventListener("dragstart", ev => { const r = ev.target.closest?.(".ms-tree[data-key] .ms-tn[draggable]"); if (!r) return; ev.dataTransfer.setData("text/ms-carnet", JSON.stringify({ key: r.closest(".ms-tree").dataset.key, id: r.dataset.id })); ev.dataTransfer.effectAllowed = "move"; r.classList.add("dragging"); root.querySelector(".ms-tree")?.classList.add("dnd"); });
    root.addEventListener("dragend", () => { root.querySelectorAll(".dragging").forEach(x => x.classList.remove("dragging")); root.querySelector(".ms-tree")?.classList.remove("dnd"); clear(); });
    root.addEventListener("dragover", ev => { if (!ev.dataTransfer.types.includes("text/ms-carnet")) return; const r = ev.target.closest?.(".ms-tree .ms-tn[data-id], .ms-tdrop"); if (!r) return; ev.preventDefault(); clear();
      if (r.classList.contains("ms-tdrop")) return r.classList.add("drop-in"); const b = r.getBoundingClientRect(), y = (ev.clientY - b.top) / b.height;
      r.classList.add(r.classList.contains("folder") && y > .28 && y < .72 ? "drop-in" : y < .5 ? "drop-before" : "drop-after"); });
    root.addEventListener("drop", async ev => { let d; try { d = JSON.parse(ev.dataTransfer.getData("text/ms-carnet") || "null"); } catch (e) { return; } if (!d) return; const r = ev.target.closest?.(".ms-tree .ms-tn[data-id], .ms-tdrop"); if (!r) return; ev.preventDefault();
      const mode = r.classList.contains("ms-tdrop") ? "root" : r.classList.contains("drop-in") ? "in" : r.classList.contains("drop-after") ? "after" : "before"; clear(); const tid = r.dataset.id; if (tid === d.id) return;
      await this.edit(d.key, ns => { const h = findNode(ns, d.id); if (!h) return false; if (tid && h.n.folder && inSubtree(h.n, tid)) return false; const node = removeNode(ns, d.id);
        if (mode === "root") { ns.push(node); return; } const t = findNode(ns, tid); if (!t) { ns.push(node); return; }
        if (mode === "in") { (t.n.children ??= []).push(node); t.n.open = true; return; } const arr = t.parent ? t.parent.children : ns; const i = arr.indexOf(t.n); arr.splice(mode === "after" ? i + 1 : i, 0, node); });
      this.render(); });
  }
  /* ── actions ── */
  async #act(act, el) {
    const key = this.tab === "notes" ? "notes" : this.tab; const nodes = foundry.utils.deepClone(this.data[key]);
    const row = el.closest("[data-id]"); const id = row?.dataset.id; const hit = id ? findNode(nodes, id) : null;
    /* cible dans un arbre donné (celui relu au moment d'écrire) : dossier visé, sinon parent du nœud, sinon racine */
    const targetIn = ns => { if (el.dataset.root || !id) return ns; const h = findNode(ns, id); if (!h) return ns; return h.n.folder ? (h.n.children ??= []) : (h.parent ? h.parent.children : ns); };
    const withHit = fn => this.edit(key, ns => { const h = findNode(ns, id); if (!h) return false; return fn(h, ns); });
    switch (act) {
      case "tab": this.tab = el.dataset.tab; return this.render();
      case "noteTab": this.noteTab = el.dataset.sub; return this.render();
      case "toggle": if (hit) await withHit(h => { h.n.open = h.n.open === false; }); return this.render();
      case "addFolder": { const name = await ask("Nouveau dossier", "Nom du dossier"); if (!name) return; await this.edit(key, ns => { targetIn(ns).push({ id: uid(), name, folder: true, open: true, children: [] }); }); return this.render(); }
      case "addItem": {
        if (key === "notes" && !canCreateJournal()) {   /* sans la permission Foundry « Créer des journaux » : le MJ crée la note pour le joueur (1.28.2) */
          const name = await ask("Nouvelle note", "Nom"); if (!name) return;
          const parent = el.dataset.root || !hit ? "" : hit.n.folder ? hit.n.id : (hit.parent?.id || "");
          if (await gmDo("carnetNote", { actor: this.actor.uuid, name, parent })) ui.notifications.info(`Note « ${name} » en cours de création…`); return; }
        if (key === "notes") { const j = await this.#createNote(); if (!j) return; await this.edit(key, ns => { targetIn(ns).push({ id: uid(), name: j.name, journal: j.id }); }); j.sheet.render(true); return this.render(); }
        if (key === "places") { const r = await askPlace("Nouveau lieu"); if (!r) return; await this.edit(key, ns => { targetIn(ns).push({ id: uid(), name: r.name, zone: r.zone }); }); return this.render(); }
        const name = await ask("Nouvel ami", "Nom"); if (!name) return; await this.edit(key, ns => { targetIn(ns).push({ id: uid(), name }); }); return this.render(); }
      case "style": { if (!hit) return; const inh = (() => { let c = ""; for (const { n, parent } of walk(nodes)) if (n.id === id) { let p = parent; while (p && !c) { c = p.color || ""; p = findNode(nodes, p.id)?.parent; } } return c; })();
        const r = await styleDialog(hit.n, key, inh); if (!r) return; const j = key === "notes" && !hit.n.folder ? game.journal.get(hit.n.journal) : null; if (j?.isOwner && r.name && r.name !== j.name) await j.update({ name: r.name });
        await withHit(h => { if (r.name) h.n.name = r.name; if (r.color) h.n.color = r.color; else delete h.n.color; if (r.icon) h.n.icon = r.icon; else delete h.n.icon; }); return this.render(); }
      case "sortF": { if (!hit?.n.folder) return; await withHit(h => { sortNodes(h.n.children ||= [], el.dataset.by, true); }); return this.render(); }
      case "sortAll": { await this.edit(key, ns => { sortNodes(ns, el.dataset.by, true); }); return this.render(); }
      case "zone": { if (!hit) return; const r = await askPlace("Lieu et zone", hit.n.name, hit.n.zone); if (!r) return; await withHit(h => { h.n.name = r.name; h.n.zone = r.zone; }); return this.render(); }
      case "tp": { if (!hit) return; if (!game.user.isGM) TP_STATE.set(`${this.actor.id}:${hit.n.name}`, "wait"); refreshTp(); const res = await gmDo("tpRequest", { actor: this.actor.uuid, place: hit.n.name, zone: hit.n.zone || "" }); if (res && !game.user.isGM) ui.notifications.info(`Demande de téléportation vers « ${hit.n.name} » envoyée au MJ.`); if (res === null) { TP_STATE.delete(`${this.actor.id}:${hit.n.name}`); refreshTp(); } return; }
      case "rename": { if (!hit) return; const j = key === "notes" && !hit.n.folder ? game.journal.get(hit.n.journal) : null; const name = await ask("Renommer", "Nom", j ? j.name : hit.n.name); if (!name) return; if (j?.isOwner) await j.update({ name }); await withHit(h => { h.n.name = name; }); return this.render(); }
      case "move": { if (!hit) return; const dest = await this.#pickFolder(nodes, hit.n); if (dest === null) return; await this.edit(key, ns => { const node = removeNode(ns, id); if (!node) return false; const d = dest === "" ? ns : findNode(ns, dest)?.n; if (dest !== "" && !d?.folder) { return false; } (dest === "" ? ns : (d.children ??= [])).push(node); }); return this.render(); }
      case "del": { if (!hit) return; const inside = hit.n.folder ? [...walk(hit.n.children)].filter(x => !x.n.folder).length : 0;
        const ok = await DialogV2.confirm({ window: { title: "Supprimer" }, classes: ["ms-dialog"], content: `<p>Supprimer <b>${esc(hit.n.name)}</b>${inside ? ` et son contenu (${inside})` : ""} ?${key === "notes" ? " Les notes correspondantes sont supprimées du journal." : ""}</p>` }); if (!ok) return;
        if (key === "notes") { const ids = hit.n.folder ? jids([hit.n]) : [hit.n.journal]; const del = ids.map(x => game.journal.get(x)).filter(j => j?.isOwner).map(j => j.id); if (del.length) await JournalEntry.deleteDocuments(del); }
        await this.edit(key, ns => { if (!removeNode(ns, id)) return false; }); return this.render(); }
      case "sheet": { if (!hit) return; return friendActor(hit.n)?.sheet.render(true); }
      case "addActor": { const have = [...walk(nodes)].map(x => x.n.uuid).filter(Boolean); const { recipientPicker } = await import("./pickers.js");
        const r = await recipientPicker({ title: "Ajouter un ami", multi: false, viewer: this.actor, exclude: have, label: "Tape un nom de personnage ou un pseudo de joueur, puis clique pour valider." });
        if (!r?.length) return; await this.edit(key, ns => { const have2 = new Set([...walk(ns)].map(x => x.n.uuid).filter(Boolean)); const dest = targetIn(ns); let n = 0; for (const u of r) { const a = fromUuidSync(u); if (a && !have2.has(u)) { dest.push({ id: uid(), name: a.name, uuid: u }); n++; } } if (!n) return false; }); return this.render(); }
      case "openNote": { if (!hit) return; return game.journal.get(hit.n.journal)?.sheet.render(true); }
      /* partagées */
      case "openShared": return game.journal.get(el.closest("[data-jid]")?.dataset.jid)?.sheet.render(true);
      case "addShared": { const name = await ask("Nouvelle note partagée", "Nom"); if (!name) return; const paths = [...new Set(sharedNotes().map(j => String(j.getFlag(SYS, "path") || "")).filter(Boolean))];
        const path = await askPath("Dossier", paths); if (path === null) return; const f = await journalFolder(FOLDER_SHARED, true);
        const j = await JournalEntry.create({ name, folder: f?.id ?? null, flags: { [SYS]: { shared: true, path } }, ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER }, pages: [{ name, type: "text", text: { format: 1, content: "" } }] });
        j?.sheet.render(true); return this.render(); }
      case "renameShared": { const j = game.journal.get(el.closest("[data-jid]")?.dataset.jid); if (!j?.isOwner) return; const name = await ask("Renommer", "Nom", j.name); if (name) await j.update({ name }); return this.render(); }
      case "moveShared": { const j = game.journal.get(el.closest("[data-jid]")?.dataset.jid); if (!j?.isOwner) return; const paths = [...new Set(sharedNotes().map(x => String(x.getFlag(SYS, "path") || "")).filter(Boolean))]; const path = await askPath("Dossier", paths, String(j.getFlag(SYS, "path") || "")); if (path === null) return; await j.setFlag(SYS, "path", path); return this.render(); }
      case "delShared": { const j = game.journal.get(el.closest("[data-jid]")?.dataset.jid); if (!j?.isOwner) return; const ok = await DialogV2.confirm({ window: { title: "Supprimer" }, classes: ["ms-dialog"], content: `<p>Supprimer <b>${esc(j.name)}</b> pour tout le monde ?</p>` }); if (ok) await j.delete(); return this.render(); }
    }
  }
  async #createNote() {
    if (!canCreateJournal()) { ui.notifications.warn("Le MJ doit autoriser la création de journaux aux joueurs (Permissions → Créer des journaux)."); return null; }
    const name = await ask("Nouvelle note", "Nom"); if (!name) return null;
    const f = await journalFolder(FOLDER_CARNETS, true);
    return JournalEntry.create({ name, folder: f?.id ?? null, flags: { [SYS]: { carnet: this.actor.id } }, pages: [{ name, type: "text", text: { format: 1, content: "" } }] });
  }
  async #pickFolder(nodes, node) {
    const opts = folders(nodes).filter(x => x.n !== node && !(node.folder && findNode(node.children, x.n.id))).map(x => `<option value="${x.n.id}">${"— ".repeat(x.depth)}${esc(x.n.name)}</option>`).join("");
    const r = await DialogV2.prompt({ window: { title: "Déplacer vers" }, classes: ["ms-dialog"], content: `<div class="ms-form"><label>Dossier<select name="dest"><option value="">(racine)</option>${opts}</select></label></div>`, ok: { label: "Déplacer", callback: (ev, btn) => btn.form.elements.dest.value }, rejectClose: false });
    return r === undefined || r === null ? null : r;
  }
}

/* lieu de téléportation : nom + zone */
async function askPlace(title, name = "", zone = "") {
  const r = await DialogV2.prompt({ window: { title, icon: "fa-solid fa-location-dot" }, classes: ["ms-dialog"], content: `<div class="ms-form"><label>Nom du lieu<input type="text" name="n" value="${esc(name)}" autofocus></label><label>Zone<input type="text" name="z" value="${esc(zone)}"></label></div>`, ok: { label: "Valider", callback: (ev, btn) => ({ name: btn.form.elements.n.value.trim(), zone: btn.form.elements.z.value.trim() }) }, rejectClose: false });
  return r?.name ? r : null;
}
/* demande de téléportation : le MJ accepte ou refuse ; réponse verte ou rouge dans le chat (joueur + MJ) */
onGm("tpRequest", async ({ actor: uuid, place, zone }, userId) => {
  const actor = await fromUuid(uuid); const user = game.users.get(userId); if (!actor) return;
  const where = `<b>${esc(place)}</b>${zone ? ` <span class="z">· ${esc(zone)}</span>` : ""}`;
  let ok = true;
  if (!user?.isGM) {
    const r = await DialogV2.wait({ window: { title: "Demande de téléportation", icon: "fa-solid fa-location-arrow" }, classes: ["ms-dialog", "ms-tp-dlg"], rejectClose: false,
      content: `<div class="ms-tp-ask"><img src="${esc(actor.img)}"><p><b>${esc(actor.name)}</b> (${esc(user?.name || "?")}) demande à être téléporté vers<br>${where}</p></div>`,
      buttons: [{ action: "yes", label: "Accepter", icon: "fa-solid fa-check", default: true, class: "ok" }, { action: "no", label: "Refuser", icon: "fa-solid fa-xmark", class: "ko" }] });
    ok = r === "yes";
  }
  const whisper = [...new Set([userId, ...game.users.filter(u => u.isGM).map(u => u.id)])];
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), whisper, content: `<div class="ms-tp-card ${ok ? "ok" : "ko"}"><i class="fa-solid ${ok ? "fa-circle-check" : "fa-circle-xmark"}"></i><div><small>TÉLÉPORTATION ${ok ? "ACCEPTÉE" : "REFUSÉE"}</small><p>${esc(actor.name)} → ${where}</p></div></div>` });
  if (userId === game.user.id) Hooks.callAll("manhwaTpState", { actor: actor.id, place, ok }); else game.socket.emit(`system.${SYS}`, { op: "tpState", to: userId, actor: actor.id, place, ok });
  toast(userId, ok ? `Téléportation vers « ${place} » acceptée.` : `Téléportation vers « ${place} » refusée par le MJ.`, ok ? "info" : "error");
});
/* note de carnet créée par le MJ pour un joueur sans la permission « Créer des journaux » ; le joueur en devient propriétaire */
onGm("carnetNote", async ({ actor: uuid, name, parent }, userId) => {
  const actor = await fromUuid(uuid); const user = game.users.get(userId); if (!actor || !user || !actor.testUserPermission(user, "OWNER")) return;
  name = String(name || "").trim().slice(0, 200); if (!name) return;
  const f = await journalFolder(FOLDER_CARNETS, true); const L = CONST.DOCUMENT_OWNERSHIP_LEVELS;
  const j = await JournalEntry.create({ name, folder: f?.id ?? null, ownership: { default: L.NONE, [userId]: L.OWNER }, flags: { [SYS]: { carnet: actor.id } }, pages: [{ name, type: "text", text: { format: 1, content: "" } }] });
  if (!j) return;
  await actorLock(actor, async () => { const ns = foundry.utils.deepClone(actor.system.carnet?.notes || []); const h = parent ? findNode(ns, parent) : null;
    (h?.n.folder ? (h.n.children ??= []) : ns).push({ id: uid(), name, journal: j.id }); await actor.update({ "system.carnet.notes": ns }); });
  toast(userId, `Note « ${name} » créée.`, "info");
});
/* 1.32 — statut des demandes de téléportation (en attente / acceptée / refusée), gardé le temps de la session */
const TP_STATE = new Map();
const TP_LBL = { wait: ["En attente", "fa-hourglass-half"], ok: ["Acceptée", "fa-circle-check"], ko: ["Refusée", "fa-circle-xmark"] };
function tpChip(actor, n) { const s = TP_STATE.get(`${actor.id}:${n.name}`); return s ? `<span class="ms-tpst ${s}"><i class="fa-solid ${TP_LBL[s][1]}"></i>${TP_LBL[s][0]}</span>` : ""; }
function refreshTp() { for (const app of foundry.applications.instances.values()) if (app instanceof CarnetApp && app.rendered && app.tab === "places") app.render(); }
Hooks.on("manhwaTpState", ({ actor, place, ok }) => { TP_STATE.set(`${actor}:${place}`, ok ? "ok" : "ko"); refreshTp(); });
/* petites saisies : un seul champ, pas de texte d'exemple */
async function ask(title, label, value = "") {
  const r = await DialogV2.prompt({ window: { title }, classes: ["ms-dialog"], content: `<div class="ms-form"><label>${esc(label)}<input type="text" name="v" value="${esc(value)}" autofocus></label></div>`, ok: { label: "Valider", callback: (ev, btn) => btn.form.elements.v.value.trim() }, rejectClose: false });
  return r || null;
}
async function askPath(title, paths, cur = "") {
  const r = await DialogV2.prompt({ window: { title }, classes: ["ms-dialog"], content: `<div class="ms-form"><label>Dossier existant<select name="sel"><option value="">(racine)</option>${paths.map(p => `<option value="${esc(p)}"${p === cur ? " selected" : ""}>${esc(p)}</option>`).join("")}</select></label><label>ou nouveau dossier<input type="text" name="new" value=""></label></div>`, ok: { label: "Valider", callback: (ev, btn) => btn.form.elements.new.value.trim() || btn.form.elements.sel.value }, rejectClose: false });
  return r === undefined || r === null ? null : r;
}

/* le carnet suit l'acteur et les journaux */
Hooks.on("updateActor", a => { const app = foundry.applications.instances.get(`ms-carnet-${a.id}`); if (app?.rendered) app.render(); });
for (const h of ["createJournalEntry", "updateJournalEntry", "deleteJournalEntry"]) Hooks.on(h, () => { for (const app of foundry.applications.instances.values()) if (app instanceof CarnetApp && app.rendered && app.tab === "notes") app.render(); });
