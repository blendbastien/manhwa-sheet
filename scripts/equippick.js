/* Manhwa Sheet 1.39 — fenêtre de choix commune (sacs, titres de la fiche, équipement de la carte du joueur) */
import { esc, getConfig, rankOf, pathOf, flattenTree, iconOf } from "./config.js";
/* 1.49 : catégories repliables (mémorisées pendant la session) */
const SHUT = new Set();
/** fenêtre de choix (sacs, titres) — lignes à cocher néon, limite facultative ; rend la liste des ids cochés (ordre conservé, le 1er = favori)
 * 1.48 : couleurs de rang et de rareté sur chaque ligne ; bandeau « favori » (étoile sur chaque ligne) ; places libres en néon (sacs) */
export async function equipPicker({ title, icon, color = "#7fd6ff", hint = "", items, on = [], max = 0, sub = () => "", fav = false, favLabel = "Favori", free = null, pill = null }) {
  const cfg = getConfig(); const sel = [...on.filter(id => items.some(i => i.id === id))];
  const rar = i => cfg.rarities.find(x => x.key === i.system.rarity);
  const chips = i => { const r = rankOf(cfg, i.system.rank); const y = rar(i); const p = pill?.(i);
    return `${r?.name ? `<span class="eq-rk" style="--k:${esc(r.color || color)}">Rang ${esc(r.name)}</span>` : ""}${y?.name ? `<span class="eq-rar" style="--k:${esc(y.color || "#9fb0d4")}">${esc(y.name)}</span>` : ""}${p ? `<span class="eq-pill" style="--k:${esc(p.c || "#3ddc84")}">${p.t}</span>` : ""}${sub(i) ? `<span class="eq-sub">${esc(sub(i))}</span>` : ""}`; };
  const card = i => { const r = rankOf(cfg, i.system.rank); const y = rar(i); const k = sel.indexOf(i.id);
    return `<label class="ms-eqpick${k >= 0 ? " on" : ""}" data-id="${i.id}" style="--rc:${esc(r?.color || color)};--ry:${esc(y?.color || r?.color || color)}"><input type="checkbox" value="${i.id}"${k >= 0 ? " checked" : ""}><span class="im"><img src="${esc(i.img)}">${r?.name ? `<em class="rk">${esc(r.name)}</em>` : ""}</span><span class="tx"><b>${esc(i.name)}</b><span class="eq-chips">${chips(i)}</span></span>${fav ? `<span class="fv" data-fv title="${esc(favLabel)}"><i class="fa-solid fa-star"></i></span>` : ""}<span class="ck"><i class="fa-solid fa-check"></i></span></label>`; };
  const ord = [...items].sort((x, y) => (sel.includes(y.id) ? 1 : 0) - (sel.includes(x.id) ? 1 : 0) || x.name.localeCompare(y.name, "fr"));
  /* 1.47 : rangés par sous-catégorie (comme les menus de la fiche) */
  const order = flattenTree(cfg.items).map(n => n.id); const groups = new Map();
  for (const i of ord) { const p = pathOf(cfg, i.system?.category); const n = p[p.length - 1] || { id: "_", name: "Autres" }; if (!groups.has(n.id)) groups.set(n.id, { n, root: p[0], l: [] }); groups.get(n.id).l.push(i); }
  const gl = [...groups.values()].sort((a, b) => (order.indexOf(a.n.id) + 1 || 1e9) - (order.indexOf(b.n.id) + 1 || 1e9));
  const body = gl.length > 1 ? gl.map(g => { const key = `${title}|${g.n.id}`; return `<section class="ms-eqgrp${SHUT.has(key) ? " shut" : ""}" data-gk="${esc(key)}" style="--gc:${esc(g.n.color || g.root?.color || color)}"><header data-gtog><i class="fa-solid ${esc(iconOf(g.n) || iconOf(g.root) || "fa-tag")}"></i><b>${esc(g.n.name)}</b><em>${g.l.length}</em><i class="fa-solid fa-chevron-down eq-cv"></i></header><div class="eq-gl">${g.l.map(card).join("")}</div></section>`; }).join("") : ord.map(card).join("");
  const favBox = fav ? `<div class="ms-eqfav" data-favbox></div>` : "";
  return foundry.applications.api.DialogV2.prompt({ window: { title, icon: `fa-solid ${icon}` }, classes: ["ms-dialog", "ms-eqdlg"], position: { width: 580 },
    content: `<div class="ms-eqhead" style="--c:${esc(color)}"><i class="fa-solid ${icon}"></i><div><b>${esc(title)}</b>${hint ? `<small>${esc(hint)}</small>` : ""}</div>${free ? `<span class="eq-free" data-free></span>` : ""}<span class="n"><b>${sel.length}</b>${max ? ` / ${max}` : ""}</span></div>${favBox}<div class="ms-eqpicks">${body}</div>`, rejectClose: false,
    render: (ev, dlg) => { const el = dlg.element ?? dlg;
      const paint = () => { el.querySelectorAll(".ms-eqpick").forEach(l => { const k = sel.indexOf(l.dataset.id); l.classList.toggle("on", k >= 0); l.classList.toggle("isfav", fav && k === 0); l.querySelector("input").checked = k >= 0; l.classList.toggle("full", !!max && sel.length >= max && k < 0); });
        el.querySelector(".ms-eqhead .n b").textContent = sel.length;
        if (free) { const f = free(sel); const b = el.querySelector("[data-free]"); if (b) { b.className = `eq-free ${f == null ? "inf" : f < 0 ? "over" : f <= 2 ? "low" : "ok"}`; b.innerHTML = f == null ? `<b>∞</b> places` : `<b>${f}</b> place${Math.abs(f) > 1 ? "s" : ""} libre${Math.abs(f) > 1 ? "s" : ""}`; } }
        const fb = el.querySelector("[data-favbox]"); if (fb) { const it = items.find(i => i.id === sel[0]); const r = it && rankOf(cfg, it.system.rank);
          fb.style.setProperty("--rc", r?.color || color);
          fb.innerHTML = it ? `<span class="fl">${'<i class="fa-solid fa-star"></i>'} ${esc(favLabel)}</span><span class="im"><img src="${esc(it.img)}">${r?.name ? `<em class="rk">${esc(r.name)}</em>` : ""}</span><span class="tx"><b>${esc(it.name)}</b><span class="eq-chips">${chips(it)}</span></span>`
            : `<span class="fl">${'<i class="fa-solid fa-star"></i>'} ${esc(favLabel)}</span><span class="tx"><b class="none">Aucun</b><span class="eq-sub">Clique l'étoile d'une ligne pour le mettre en premier.</span></span>`; } };
      el.addEventListener("click", e => { const gt = e.target.closest("[data-gtog]"); if (gt) { const sec = gt.closest("[data-gk]"); const k = sec.dataset.gk; const shut = !sec.classList.contains("shut"); sec.classList.toggle("shut", shut); shut ? SHUT.add(k) : SHUT.delete(k); return; }
        const l = e.target.closest(".ms-eqpick"); if (!l) return; e.preventDefault(); const id = l.dataset.id; const k = sel.indexOf(id);
        if (fav && e.target.closest("[data-fv]")) { if (k >= 0) sel.splice(k, 1); else if (max && sel.length >= max) { if (max === 1) sel.splice(0, 1); else return ui.notifications.info(`Maximum ${max} : décoche d'abord un élément.`); } sel.unshift(id); return paint(); }
        if (k >= 0) sel.splice(k, 1); else { if (max && sel.length >= max) { if (max === 1) sel.splice(0, 1); else return ui.notifications.info(`Maximum ${max} : décoche d'abord un élément.`); } sel.push(id); } paint(); }); paint(); },
    ok: { label: "Valider", icon: "fa-solid fa-check", callback: () => [...sel] } });
}
