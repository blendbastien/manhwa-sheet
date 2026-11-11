/* Manhwa Sheet 1.38 — badge « +N » : au survol, une liste stylisée (taille limitée, pages avec flèches) des autres éléments
 * (sous-classes, classes, titres, sacs…). Une seule bulle pour toute l'interface, posée sur <body>. */
import { esc } from "./config.js";
const PER = 5;
/** list : [{ n: nom, img?: image, icon?: icône FA, c?: couleur, s?: sous-titre }] */
export function moreChip(list, title = "Aussi") {
  if (!list?.length) return "";
  return `<em class="ms-more" data-more="${esc(JSON.stringify({ t: title, l: list }))}">+${list.length}</em>`;
}
let pop = null, cur = null, page = 0, hideT = null;
function ensure() {
  if (pop) return pop; pop = document.createElement("div"); pop.id = "ms-morepop"; document.body.append(pop);
  pop.addEventListener("pointerenter", () => clearTimeout(hideT)); pop.addEventListener("pointerleave", () => soonHide());
  pop.addEventListener("click", ev => { const b = ev.target.closest("[data-pg]"); if (!b || !cur) return; ev.preventDefault(); ev.stopPropagation(); const n = Math.ceil(cur.l.length / PER); const d = Number(b.dataset.pg);
    /* 1.39.2 : la bulle garde sa hauteur (une dernière page plus courte ne la rétrécit plus sous le curseur, donc elle ne se ferme plus) ; effet de page qui tourne */
    clearTimeout(hideT); pop.style.minHeight = `${Math.max(pop.offsetHeight, parseFloat(pop.style.minHeight) || 0)}px`; page = (page + d + n) % n; draw(); const ls = pop.querySelector(".ls"); ls?.classList.add(d > 0 ? "pg-n" : "pg-p"); });
  return pop;
}
function draw() {
  const n = Math.max(1, Math.ceil(cur.l.length / PER)); const sl = cur.l.slice(page * PER, page * PER + PER);
  pop.innerHTML = `<header><b>${esc(cur.t)}</b><em>${cur.l.length}</em></header><div class="ls">${sl.map(x => `<div class="r" style="--c:${esc(x.c || "#8ea0c8")}">${x.img ? `<img src="${esc(x.img)}">` : `<i class="fa-solid ${esc(x.icon || "fa-circle")}"></i>`}<span><b>${esc(x.n)}</b>${x.s ? `<small>${esc(x.s)}</small>` : ""}</span></div>`).join("")}</div>${n > 1 ? `<footer><a data-pg="-1"><i class="fa-solid fa-chevron-left"></i></a><span>${page + 1} / ${n}</span><a data-pg="1"><i class="fa-solid fa-chevron-right"></i></a></footer>` : ""}`;
}
function place(el) { const r = el.getBoundingClientRect(); const w = pop.offsetWidth, h = pop.offsetHeight; let x = r.left + r.width / 2 - w / 2, y = r.bottom + 6; if (y + h > innerHeight - 6) y = r.top - h - 6; x = Math.max(6, Math.min(innerWidth - w - 6, x)); pop.style.left = `${x}px`; pop.style.top = `${Math.max(6, y)}px`; }
function show(el) { let d; try { d = JSON.parse(el.dataset.more); } catch (e) { return; } clearTimeout(hideT); ensure(); if (cur?.el !== el) { page = 0; pop.style.minHeight = ""; } cur = { ...d, el }; draw(); pop.classList.add("on"); place(el); }
function soonHide() { clearTimeout(hideT); hideT = setTimeout(() => { if (pop?.matches(":hover") || cur?.el?.matches?.(":hover")) return; pop?.classList.remove("on"); if (pop) pop.style.minHeight = ""; cur = null; }, 260); }
document.addEventListener("pointerover", ev => { const el = ev.target.closest?.(".ms-more[data-more]"); if (el) show(el); });
document.addEventListener("pointerout", ev => { const el = ev.target.closest?.(".ms-more[data-more]"); if (el && !el.contains(ev.relatedTarget) && !pop?.contains(ev.relatedTarget)) soonHide(); });
/* 1.58.8 : molette sur le badge « +N » ou sur la bulle = page suivante / précédente (fiche, carte du joueur, partout) */
let wT = 0;
document.addEventListener("wheel", ev => { if (!cur || !pop?.classList.contains("on")) return; if (!(ev.target.closest?.("#ms-morepop") || ev.target.closest?.(".ms-more[data-more]") === cur.el)) return;
  const n = Math.ceil(cur.l.length / PER); if (n < 2) return; ev.preventDefault(); ev.stopPropagation(); const now = Date.now(); if (now - wT < 180) return; wT = now;
  const d = ev.deltaY > 0 ? 1 : -1; clearTimeout(hideT); pop.style.minHeight = `${Math.max(pop.offsetHeight, parseFloat(pop.style.minHeight) || 0)}px`; page = (page + d + n) % n; draw(); pop.querySelector(".ls")?.classList.add(d > 0 ? "pg-n" : "pg-p"); }, { passive: false, capture: true });
/* 1.58.9 : la bulle se ferme si son badge a disparu (fenêtre fermée pendant le survol) */
let mvT = 0;
document.addEventListener("pointermove", ev => { if (!cur || !pop?.classList.contains("on")) return; const now = Date.now(); if (now - mvT < 120) return; mvT = now;
  if (!cur.el?.isConnected || (!ev.target.closest?.("#ms-morepop") && !ev.target.closest?.(".ms-more[data-more]"))) soonHide(); }, { passive: true });
