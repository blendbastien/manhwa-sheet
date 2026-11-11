/* Manhwa Sheet — choix des destinataires, façon Roll20 : une seule barre de recherche. On tape quelques lettres, les
 * résultats les plus proches (pseudo du joueur ou nom de personnage, joueurs hors ligne compris) s'affichent, on clique
 * pour valider ; en mode multiple on recommence autant de fois que voulu (puces retirables).
 * Mêmes noms d'export qu'avant (actorRecipients, userRecipients, bindRecipients, pickedActors, pickedUsers). */
import { esc } from "./config.js";

const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const players = () => game.users.filter(u => !u.isGM).sort((a, b) => a.name.localeCompare(b.name, "fr"));
const ownersOf = a => game.users.filter(u => !u.isGM && a.testUserPermission(u, "OWNER"));
const charsOf = u => game.actors.filter(a => a.type === "character" && a.testUserPermission(u, "OWNER"));
const ucolor = u => u?.color?.css ?? u?.color ?? "#8ea0c8";
/* PNJ que les joueurs peuvent trouver (amis, messages…) : réglage « PNJ trouvables par les joueurs » */
const npcGroupIds = () => { try { const pm = game.modules.get("pnj-manhwa"); return new Set(pm?.active ? (pm.api?.getData?.().groups || []).flatMap(g => g.members || []) : []); } catch (e) { return new Set(); } };
export function npcFindable(a, ids = null) {
  if (!a || a.type !== "npc" && a.hasPlayerOwner) return !!a; if (game.user.isGM || a.testUserPermission(game.user, "LIMITED")) return true;
  let mode = "groups"; try { mode = game.settings.get("manhwa-sheet", "npcSearch"); } catch (e) {}
  if (mode === "all") return true; if (mode === "visible") return false;
  return !!a.getFlag?.("manhwa-sheet", "public") || (ids || npcGroupIds()).has(a.id);
}
Hooks.once("init", () => game.settings.register("manhwa-sheet", "npcSearch", { name: "PNJ trouvables par les joueurs", hint: "Dans les recherches de personnages (amis, messages, téléphone…). « Groupes » : les PNJ des groupes de PNJ Manhwa, plus ceux que le joueur peut voir.", scope: "world", config: true, type: String, choices: { groups: "PNJ des groupes + PNJ visibles", visible: "Seulement les PNJ visibles par le joueur", all: "Tous les PNJ" }, default: "groups" }));

/* candidats : personnages (avec le pseudo de leurs joueurs) ou joueurs (avec leurs personnages) */
function candidates({ mode = "actor", exclude = [], npcs = true, phone = false, viewer = null } = {}) {
  const ex = new Set(exclude);
  if (mode === "user") return players().filter(u => !ex.has(u.id)).map(u => { const ch = charsOf(u); return { id: u.id, label: u.name, sub: ch.map(a => a.name).join(", ") || "aucun personnage", img: ch[0]?.img || u.avatar || "icons/svg/mystery-man.svg", color: ucolor(u), on: u.active, keys: [u.name, ...ch.map(a => a.name)] }; });
  let list;
  if (phone && !game.user.isGM) { const c = viewer?.flags?.["manhwa-sheet"]?.phone?.contacts || []; list = c.map(u => { try { return fromUuidSync(u); } catch (e) { return null; } }).filter(Boolean); }
  else { const ids = npcGroupIds(); list = game.actors.filter(a => ["character", "npc"].includes(a.type) && (a.hasPlayerOwner ? a.type === "character" : npcs && npcFindable(a, ids))); }
  return list.filter(a => !ex.has(a.uuid)).map(a => { const ow = ownersOf(a); return { id: a.uuid, label: a.name, sub: ow.length ? ow.map(u => u.name).join(", ") : "Personnage", img: a.img, color: ow[0] ? ucolor(ow[0]) : "#6a7590", on: ow.some(u => u.active), keys: [a.name, ...ow.map(u => u.name)] }; });
}
/* proximité d'un texte tapé avec les noms d'un candidat */
function score(q, keys) {
  let best = 0; for (const k0 of keys) { const k = norm(k0); if (!k) continue; let s = 0;
    if (k === q) s = 100; else if (k.startsWith(q)) s = 80 - Math.min(20, k.length - q.length); else if (k.split(/[\s\-_'.]+/).some(w => w.startsWith(q))) s = 60; else if (k.includes(q)) s = 40;
    else { let i = 0; for (const ch of k) if (ch === q[i]) i++; if (i === q.length) s = 12; }
    if (s > best) best = s; }
  return best;
}
const chip = (c, name) => `<span class="ms-rchip" data-id="${esc(c.id)}" style="--c:${esc(c.color)}"><img src="${esc(c.img)}"><b>${esc(c.label)}</b><a data-rx title="Retirer"><i class="fa-solid fa-xmark"></i></a><input type="hidden" name="${name}" value="${esc(c.id)}"></span>`;

/** champ de recherche de destinataires */
export function rcptField({ mode = "actor", name = "rcpt", selected = [], exclude = [], multi = true, npcs = true, phone = false, viewer = null, placeholder = "" } = {}) {
  const all = candidates({ mode, exclude, npcs, phone, viewer }); const sel = all.filter(c => selected.includes(c.id));
  const ph = placeholder || (mode === "user" ? "Pseudo d'un joueur ou nom de son personnage…" : "Nom d'un personnage ou pseudo d'un joueur…");
  return `<div class="ms-rsel${multi ? " multi" : ""}" data-mode="${mode}" data-name="${name}" data-multi="${multi ? 1 : 0}" data-npcs="${npcs ? 1 : 0}" data-phone="${phone ? 1 : 0}" data-viewer="${esc(viewer?.uuid || "")}" data-ex="${esc(JSON.stringify(exclude))}">
    <div class="ms-rbox"><span class="ms-rchips">${sel.map(c => chip(c, name)).join("")}</span><input type="text" class="ms-rin" placeholder="${esc(ph)}" autocomplete="off"></div><div class="ms-rsug"></div></div>`;
}
/* compatibilité : grilles d'avant → barre de recherche */
export const actorRecipients = ({ selected = [], exclude = [], multi = true, npcs = true } = {}) => rcptField({ mode: "actor", name: "rcpt", selected, exclude, multi, npcs });
export const userRecipients = (selected = []) => rcptField({ mode: "user", name: "ruser", selected, multi: true });

/** branche la recherche (à appeler une fois le contenu affiché) */
export function bindRecipients(root) {
  root.querySelectorAll(".ms-rsel").forEach(box => {
    if (box.dataset.bound) return; box.dataset.bound = "1";
    const viewer = box.dataset.viewer ? (() => { try { return fromUuidSync(box.dataset.viewer); } catch (e) { return null; } })() : null;
    const all = candidates({ mode: box.dataset.mode, exclude: JSON.parse(box.dataset.ex || "[]"), npcs: box.dataset.npcs === "1", phone: box.dataset.phone === "1", viewer });
    const multi = box.dataset.multi === "1", name = box.dataset.name; const inp = box.querySelector(".ms-rin"), sug = box.querySelector(".ms-rsug"), chips = box.querySelector(".ms-rchips"); let cur = [], hi = 0;
    const picked = () => new Set([...chips.querySelectorAll("input")].map(i => i.value));
    const draw = () => {
      const q = norm(inp.value); const have = picked();
      cur = q ? all.filter(c => !have.has(c.id)).map(c => ({ c, s: score(q, c.keys) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s || a.c.label.localeCompare(b.c.label, "fr")).slice(0, 12).map(x => x.c) : [];
      hi = Math.min(hi, Math.max(0, cur.length - 1));
      sug.innerHTML = cur.map((c, i) => `<a class="ms-ropt${i === hi ? " hi" : ""}" data-i="${i}" style="--c:${esc(c.color)}"><img src="${esc(c.img)}"><span><b>${esc(c.label)}</b><small>${esc(c.sub)}</small></span>${c.on ? '<i class="on" title="En ligne"></i>' : ""}</a>`).join("") || (q ? `<p class="ms-rnone">Personne ne correspond.</p>` : "");
      sug.classList.toggle("open", !!q); if (q) place();
    };
    /* la liste flotte au-dessus de tout (jamais coupée par la fenêtre ou la boîte de dialogue) */
    const place = () => { if (!box.isConnected) { sug.remove(); return; } if (sug.parentNode !== document.body) document.body.appendChild(sug);
      const r = box.querySelector(".ms-rbox").getBoundingClientRect(); const below = innerHeight - r.bottom - 12, above = r.top - 12; const up = below < 220 && above > below;
      Object.assign(sug.style, { position: "fixed", left: `${Math.round(r.left)}px`, width: `${Math.round(r.width)}px`, right: "auto", top: up ? "auto" : `${Math.round(r.bottom + 4)}px`, bottom: up ? `${Math.round(innerHeight - r.top + 4)}px` : "auto", maxHeight: `${Math.max(160, Math.min(420, up ? above : below))}px` }); };
    window.addEventListener("resize", () => { if (sug.classList.contains("open")) place(); }); document.addEventListener("scroll", () => { if (sug.classList.contains("open")) place(); }, true);
    const take = c => { if (!c) return; if (!multi) chips.innerHTML = ""; chips.insertAdjacentHTML("beforeend", chip(c, name)); inp.value = ""; hi = 0; draw(); inp.focus(); box.dispatchEvent(new Event("change", { bubbles: true })); };
    inp.addEventListener("input", () => { hi = 0; draw(); });
    inp.addEventListener("keydown", ev => {
      if (ev.key === "ArrowDown") { ev.preventDefault(); hi = Math.min(cur.length - 1, hi + 1); draw(); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); hi = Math.max(0, hi - 1); draw(); }
      else if (ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); take(cur[hi]); }
      else if (ev.key === "Backspace" && !inp.value) { chips.lastElementChild?.remove(); box.dispatchEvent(new Event("change", { bubbles: true })); }
      else if (ev.key === "Escape" && inp.value) { ev.stopPropagation(); inp.value = ""; draw(); }
    });
    sug.addEventListener("pointerdown", ev => { const o = ev.target.closest(".ms-ropt"); if (!o) return; ev.preventDefault(); take(cur[Number(o.dataset.i)]); });
    chips.addEventListener("click", ev => { const x = ev.target.closest("[data-rx]"); if (!x) return; ev.preventDefault(); x.closest(".ms-rchip").remove(); inp.focus(); box.dispatchEvent(new Event("change", { bubbles: true })); });
    inp.addEventListener("blur", () => setTimeout(() => { sug.classList.remove("open"); if (!box.isConnected) sug.remove(); }, 150)); inp.addEventListener("focus", () => { if (inp.value) draw(); });
  });
}
export const pickedActors = form => [...form.querySelectorAll('input[name="rcpt"]')].map(i => i.value).filter(Boolean);
export const pickedUsers = form => [...form.querySelectorAll('input[name="ruser"]')].map(i => i.value).filter(Boolean);

/** petite fenêtre : choisir une ou plusieurs personnes ; renvoie la liste des identifiants (uuid d'acteur ou id de joueur) */
export async function recipientPicker({ title = "Choisir", mode = "actor", multi = false, npcs = true, phone = false, viewer = null, exclude = [], label = "" } = {}) {
  const r = await foundry.applications.api.DialogV2.prompt({ window: { title, icon: "fa-solid fa-magnifying-glass" }, classes: ["ms-dialog", "ms-rdlg"], position: { width: 460 }, rejectClose: false,
    content: `${label ? `<p class="ms-mhint">${esc(label)}</p>` : ""}${rcptField({ mode, name: "pick", multi, npcs, phone, viewer, exclude: [...exclude, ...(viewer ? [viewer.uuid] : [])] })}`,
    ok: { label: "Valider", icon: "fa-solid fa-check", callback: (ev, btn) => [...btn.form.querySelectorAll('input[name="pick"]')].map(i => i.value) },
    render: (ev, dlg) => { const el = dlg.element ?? dlg; bindRecipients(el); setTimeout(() => el.querySelector(".ms-rin")?.focus(), 60); } });
  return r?.length ? r : null;
}
