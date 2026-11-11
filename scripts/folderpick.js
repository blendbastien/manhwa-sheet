/* Manhwa Sheet 1.36 — choix par DOSSIERS (comme le répertoire de Foundry) : monstres, objets, personnages.
 * Dossiers repliés par défaut (rapide même avec des centaines d'acteurs), recherche qui ouvre les dossiers concernés,
 * « + tout » sur un dossier ajoute tout son contenu (sous-dossiers compris). */
import { esc } from "./config.js";

const coll = type => type === "Item" ? game.items : game.actors;
function subtree(f, seen = new Set()) { if (!f || seen.has(f.id)) return []; seen.add(f.id); const out = [f]; for (const c of game.folders.filter(x => x.folder?.id === f.id)) out.push(...subtree(c, seen)); return out; }

/** HTML de l'arbre. opts : { type: "Actor" | "Item", filter(doc), info(doc) → texte, empty } */
export function folderTree({ type = "Actor", filter = () => true, info = () => "", empty = "Rien à choisir." } = {}) {
  const docs = coll(type).filter(d => { try { return filter(d); } catch (e) { return false; } });
  const byFolder = new Map(); for (const d of docs) { const k = d.folder?.id || ""; if (!byFolder.has(k)) byFolder.set(k, []); byFolder.get(k).push(d); }
  const folders = game.folders.filter(f => f.type === type);
  const count = f => subtree(f).reduce((n, x) => n + (byFolder.get(x.id)?.length || 0), 0);
  const doc = d => `<a class="fp-d" data-fp-doc="${d.uuid}" data-n="${esc(d.name.toLowerCase())}"><img src="${esc(d.img || "icons/svg/mystery-man.svg")}" loading="lazy"><span>${esc(d.name)}</span>${info(d) ? `<small>${esc(info(d))}</small>` : ""}</a>`;
  const node = f => { const n = count(f); if (!n) return ""; const kids = folders.filter(x => x.folder?.id === f.id).sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name, "fr"));
    const own = (byFolder.get(f.id) || []).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return `<details class="fp-f" data-fp-folder="${f.id}" style="--fc:${esc(f.color?.css ?? f.color ?? "#5ee0ff")}"><summary><i class="fa-solid fa-folder"></i><b>${esc(f.name)}</b><em>${n}</em><a class="fp-all" data-fp-all="${f.id}" data-tooltip="Tout ajouter">+ tout</a></summary>
      <div class="fp-in">${kids.map(node).join("")}${own.map(doc).join("")}</div></details>`; };
  const roots = folders.filter(f => !f.folder).sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name, "fr"));
  const loose = (byFolder.get("") || []).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const body = roots.map(node).join("") + (loose.length ? `<details class="fp-f" data-fp-folder=""><summary><i class="fa-regular fa-folder"></i><b>Sans dossier</b><em>${loose.length}</em><a class="fp-all" data-fp-all="" data-tooltip="Tout ajouter">+ tout</a></summary><div class="fp-in">${loose.map(doc).join("")}</div></details>` : "");
  return `<div class="fp" data-fp-type="${type}"><div class="fp-q"><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="Rechercher…" data-fp-q></div><div class="fp-tree">${body || `<p class="ms-mhint">${esc(empty)}</p>`}</div></div>`;
}
/** branche l'arbre : onPick(uuids) à chaque clic (un document ou tout un dossier) */
export function bindFolderTree(root, onPick, { filter = () => true } = {}) {
  const fp = root.querySelector(".fp"); if (!fp || fp.dataset.bound) return; fp.dataset.bound = "1"; const type = fp.dataset.fpType;
  fp.addEventListener("click", ev => {
    const all = ev.target.closest("[data-fp-all]"); if (all) { ev.preventDefault(); ev.stopPropagation(); const fid = all.dataset.fpAll;
      const ids = fid ? subtree(game.folders.get(fid)).map(f => f.id) : [""]; const uu = coll(type).filter(d => ids.includes(d.folder?.id || "") && filter(d)).map(d => d.uuid); if (uu.length) onPick(uu); flash(all); return; }
    const d = ev.target.closest("[data-fp-doc]"); if (d) { ev.preventDefault(); onPick([d.dataset.fpDoc]); flash(d); } });
  const q = fp.querySelector("[data-fp-q]"); q?.addEventListener("input", () => { const v = q.value.trim().toLowerCase();
    fp.querySelectorAll(".fp-d").forEach(a => { a.hidden = !!v && !a.dataset.n.includes(v); });
    fp.querySelectorAll(".fp-f").forEach(f => { const any = [...f.querySelectorAll(".fp-d")].some(a => !a.hidden); f.hidden = !!v && !any; if (v) f.open = any; }); });
}
const flash = el => { el.classList.add("fp-ok"); setTimeout(() => el.classList.remove("fp-ok"), 450); };
/** fenêtre autonome : renvoie la liste choisie (plusieurs clics possibles) */
export async function pickByFolders({ title = "Ajouter", type = "Actor", filter, info, hint = "" } = {}) {
  const picked = new Set(); const { DialogV2 } = foundry.applications.api;
  const r = await DialogV2.prompt({ window: { title, icon: "fa-solid fa-folder-tree" }, classes: ["ms-dialog", "ms-menu-dialog", "fp-dlg"], position: { width: 560, height: 640 }, rejectClose: false,
    content: `${hint ? `<p class="ms-mhint">${esc(hint)}</p>` : ""}${folderTree({ type, filter, info })}<div class="fp-sel" data-fp-sel><span class="ms-mhint">Clique un élément ou « + tout » sur un dossier.</span></div>`,
    ok: { label: "Ajouter", icon: "fa-solid fa-check", callback: () => [...picked] },
    render: (ev, dlg) => { const el = dlg.element ?? dlg; const box = el.querySelector("[data-fp-sel]");
      const draw = () => { box.innerHTML = picked.size ? [...picked].map(u => { const d = fromUuidSync(u); return d ? `<a class="fp-chip" data-un="${u}"><img src="${esc(d.img)}">${esc(d.name)}<i class="fa-solid fa-xmark"></i></a>` : ""; }).join("") : `<span class="ms-mhint">Clique un élément ou « + tout » sur un dossier.</span>`; };
      box.addEventListener("click", e => { const a = e.target.closest("[data-un]"); if (!a) return; picked.delete(a.dataset.un); draw(); });
      bindFolderTree(el, uu => { uu.forEach(u => picked.add(u)); draw(); }, { filter: filter || (() => true) }); } });
  return r || [];
}
