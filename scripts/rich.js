/* Manhwa Sheet — texte riche (ProseMirror) et descriptions repliées avec infobulle structurée */
import { esc } from "./config.js";

/* nettoie les restes d'imports (CSB laissait parfois une apostrophe avant le HTML) */
export function cleanHTML(html) { let h = String(html ?? ""); if (/^\s*['"]\s*</.test(h)) h = h.replace(/^\s*['"]\s*/, ""); return h; }

/* <prose-mirror toggled> : en v13 la valeur à éditer DOIT être dans l'attribut `value` (le contenu intérieur n'est que l'affichage).
 * Sans elle, l'éditeur s'ouvrait vide et l'enregistrement remplaçait l'ancien texte. */
export function richEditor(name, html, editable = true) {
  const h = cleanHTML(html);
  if (!editable) return `<div class="ms-rich ro">${h || "<p class='ms-ph'>—</p>"}</div>`;
  return `<prose-mirror name="${name}" toggled class="ms-rich" value="${esc(h)}">${h}</prose-mirror>`;
}

/* ── structure d'une description, tirée de l'éditeur de texte riche ──
 * Titre 1 (h1)                         → titre de l'infobulle
 * Titre 2-6, ou paragraphe tout en gras → en-tête d'un bloc
 * le reste (paragraphes, listes…)      → contenu du bloc en cours
 * Une ligne horizontale (—) coupe aussi un bloc. Sans aucun titre : un bloc par paragraphe, comme avant. */
export function parseDesc(html) {
  const h = cleanHTML(html); const out = { title: "", blocks: [], text: "" };
  if (typeof DOMParser === "undefined") { out.text = h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); out.blocks = [{ head: "", body: h }]; return out; }
  const doc = new DOMParser().parseFromString(`<div>${h}</div>`, "text/html"); const root = doc.body.firstElementChild;
  out.text = [...root.childNodes].map(n => n.textContent || "").join(" ").replace(/\s+/g, " ").trim();
  let cur = null; const push = () => { if (cur && (cur.head || cur.body.trim())) out.blocks.push(cur); cur = null; };
  const isBoldPara = el => el.tagName === "P" && el.textContent.trim() && [...el.childNodes].every(n => (n.nodeType === 3 && !n.textContent.trim()) || (n.nodeType === 1 && /^(STRONG|B)$/.test(n.tagName)));
  const hasHeads = [...root.children].some(el => /^H[1-6]$/.test(el.tagName) || isBoldPara(el) || el.tagName === "HR");
  for (const el of [...root.children]) {
    if (el.tagName === "H1" && !out.title) { out.title = el.textContent.trim(); continue; }
    if (/^H[1-6]$/.test(el.tagName) || isBoldPara(el)) { push(); cur = { head: el.textContent.trim(), body: "" }; continue; }
    if (el.tagName === "HR") { push(); continue; }
    if (!hasHeads) { push(); out.blocks.push({ head: "", body: el.outerHTML }); continue; }
    (cur ??= { head: "", body: "" }).body += el.outerHTML;
  }
  push();
  if (!root.children.length && out.text) out.blocks.push({ head: "", body: `<p>${esc(out.text)}</p>` });
  return out;
}

/* cellule de tableau : résumé court + badge LIRE, texte complet en infobulle structurée */
export function descCell(html, opts = { collapse: true, minLength: 90 }) {
  const d = parseDesc(html); const text = d.text; if (!text) return `<span class="ms-ph">—</span>`;
  const structured = !!d.title || d.blocks.some(b => b.head);
  if (!opts.collapse || (text.length <= (opts.minLength || 90) && !structured)) return `<div class="ms-desc"${+opts.colW ? ` style="max-width:min(${+opts.colW}px, 100%)"` : ""}>${cleanHTML(html)}</div>`;
  const summary = d.title || d.blocks.find(b => b.head)?.head || text;
  const n = d.blocks.length;
  const full = `${d.title ? `<header class="ms-tip-title">${esc(d.title)}</header>` : ""}${d.blocks.map(b => `<section class="ms-block">${b.head ? `<h4 class="ms-block-h">${esc(b.head)}</h4>` : ""}${b.body ? `<div class="ms-block-b">${b.body}</div>` : ""}</section>`).join("")}`;
  const o = { w: +opts.width || 480, h: +opts.pageH || 340, f: +opts.font || 12.5, a: opts.anim === false ? 0 : 1 };
  return `<div class="ms-desc-sum${+opts.lines === 2 ? " l2" : ""}" data-ms-tip="1" data-tw="${o.w}" data-th="${o.h}" data-tf="${o.f}" data-ta="${o.a}"${+opts.colW ? ` style="max-width:min(${+opts.colW}px, 100%)"` : ""}><span class="ms-desc-txt">${esc(summary.slice(0, 120))}</span><i class="ms-badge"><i class="fa-solid fa-eye"></i><b>${n > 1 ? `${n} blocs` : "lire"}</b></i><div class="ms-desc-full" hidden>${full}</div></div>`;
}

/* infobulle globale : survol = afficher, clic = épingler, Échap / clic ailleurs = libérer */
let tipEl = null, pinned = null;
function tip() { if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "ms-tip"; document.body.appendChild(tipEl); } return tipEl; }
function place(anchor) { const t = tip(); const r = anchor.getBoundingClientRect(); t.style.left = Math.min(window.innerWidth - t.offsetWidth - 12, Math.max(12, r.left)) + "px"; const below = r.bottom + 8 + t.offsetHeight < window.innerHeight; t.style.top = (below ? r.bottom + 8 : Math.max(8, r.top - t.offsetHeight - 8)) + "px"; }
function show(anchor) { const full = anchor.querySelector(".ms-desc-full"); if (!full) return; const t = tip(); const same = t._a === anchor && t._built; t._a = anchor; t.className = "ms-tip on" + (pinned === anchor ? " pin" : "") + (anchor.dataset.ta === "0" ? " noanim" : ""); const tc = getComputedStyle(anchor).getPropertyValue("--tc"); if (tc) t.style.setProperty("--tc", tc); document.body.dataset.msTheme && (t.dataset.msTheme = document.body.dataset.msTheme);
  if (same) { const n = t.querySelector(".ms-tip-nav"); n?.classList.toggle("pin", pinned === anchor); } else { t.style.width = `${Math.min(window.innerWidth - 24, +anchor.dataset.tw || 480)}px`; t.style.setProperty("--tf", `${+anchor.dataset.tf || 12.5}px`); t.innerHTML = full.innerHTML; paginate(t, +anchor.dataset.th || 340); t._built = true; } place(anchor); }
/* 1.43 : pages qui se tournent — découpe par blocs, puis paragraphes / lignes de liste, puis phrases, puis mots.
 * Chaque page tient dans la hauteur choisie (réglage MJ) ; le titre du bloc est répété avec « (suite) ». */
function paginate(t, H0) {
  t._pages = null; t._pg = 0; const H = Math.max(120, Math.min(H0, window.innerHeight - 120)); const title = t.querySelector(":scope > .ms-tip-title"); const body = [...t.children].filter(x => x !== title);
  const box = document.createElement("div"); box.className = "ms-tip-pg"; t.innerHTML = ""; if (title) t.appendChild(title); t.appendChild(box);
  const all = body.map(el => el.outerHTML).join(""); box.innerHTML = all; if (box.offsetHeight <= H + 4) return;
  /* unités : { b: n° de bloc (-1 = hors bloc), head, k: "el" | "li" | "txt", tag, html | text, pid } */
  const units = []; let pid = 0;
  const addEl = (b, head, el) => { if (/^(UL|OL)$/.test(el.tagName)) { for (const li of el.children) units.push({ b, head, k: "li", tag: el.tagName.toLowerCase(), html: li.outerHTML }); return; }
    units.push({ b, head, k: "el", html: el.outerHTML, text: el.textContent || "", tag: el.tagName.toLowerCase() }); };
  body.forEach((el, bi) => { if (el.matches?.("section.ms-block")) { const head = el.querySelector(":scope > .ms-block-h")?.innerHTML || ""; const bb = el.querySelector(":scope > .ms-block-b"); if (!bb || !bb.children.length) { units.push({ b: bi, head, k: "el", html: bb ? bb.innerHTML : "", text: "" }); return; } for (const ch of bb.children) addEl(bi, head, ch); } else addEl(-1, "", el); });
  const firstOf = new Map(); units.forEach((u, i) => { if (!firstOf.has(u.b)) firstOf.set(u.b, i); u.i = i; });
  /* construit le HTML d'une page à partir de ses unités (regroupe par bloc, liste et paragraphe découpé) */
  const build = L => { let out = "", cur = null, inner = "", list = null, para = null;
    const flushPara = () => { if (para) { inner += `<p>${esc(para.join(" "))}</p>`; para = null; } };
    const flushList = () => { if (list) { inner += `<${list.tag}>${list.items.join("")}</${list.tag}>`; list = null; } };
    const flushBlock = () => { flushPara(); flushList(); if (cur === null) return; if (cur.b < 0) out += inner; else out += `<section class="ms-block">${cur.head ? `<h4 class="ms-block-h">${cur.head}${cur.cont ? " <small>(suite)</small>" : ""}</h4>` : ""}<div class="ms-block-b">${inner}</div></section>`; inner = ""; cur = null; };
    for (const u of L) { if (!cur || cur.b !== u.b) { flushBlock(); cur = { b: u.b, head: u.head, cont: u.b >= 0 && (u.i !== firstOf.get(u.b) || u.sub > 0) }; }
      if (u.k === "li") { flushPara(); if (list && list.tag !== u.tag) flushList(); (list ??= { tag: u.tag, items: [] }).items.push(u.html); }
      else if (u.k === "txt") { flushList(); if (para && para.pid !== u.pid) flushPara(); if (!para) { para = []; para.pid = u.pid; } para.push(u.text); }
      else { flushPara(); flushList(); inner += u.html; } }
    flushBlock(); return out; };
  const fits = L => { box.innerHTML = build(L); return box.offsetHeight <= H; };
  /* découpe d'une unité trop haute : phrases, puis mots */
  const split = u => { const txt = (u.k === "txt" ? u.text : (u.k === "li" ? u.html.replace(/<[^>]+>/g, " ") : u.text || "")).replace(/\s+/g, " ").trim(); if (!txt) return null;
    const id = u.k === "txt" ? u.pid : ++pid; let parts = txt.split(/(?<=[.!?…;:])\s+/); if (parts.length < 2) parts = txt.split(" "); if (parts.length < 2) parts = txt.match(/.{1,120}/g) || [txt];
    return parts.map((x, n) => ({ b: u.b, head: u.head, k: "txt", text: x, pid: id, i: u.i, sub: (u.sub || 0) + n })); };
  const pages = []; let cur = []; const Q = [...units]; let guard = 0;
  while (Q.length && guard++ < 5000) { const u = Q.shift();
    if (fits([...cur, u])) { cur.push(u); continue; }
    if (cur.length) { pages.push(cur); cur = []; Q.unshift(u); continue; }
    const parts = split(u); if (parts && parts.length > 1) { Q.unshift(...parts); continue; }
    cur.push(u); pages.push(cur); cur = []; }
  if (cur.length) pages.push(cur);
  if (pages.length < 2) { box.innerHTML = all; return; }
  t._pages = pages.map(build); let mh = 0; for (const pg of t._pages) { box.innerHTML = pg; mh = Math.max(mh, box.offsetHeight); }
  box.style.height = `${mh}px`; box.innerHTML = t._pages[0];
  const nav = document.createElement("div"); nav.className = "ms-tip-nav" + (pinned === t._a ? " pin" : ""); nav.innerHTML = `<a data-tp="-1"><i class="fa-solid fa-chevron-left"></i></a><span><b>1</b> / ${pages.length}</span><a data-tp="1"><i class="fa-solid fa-chevron-right"></i></a><em>Molette pour tourner · clic pour épingler</em>`; t.appendChild(nav); turn(t, 0, 0);
}
function turn(t, to, dir) { if (!t._pages) return; const n = t._pages.length; to = Math.max(0, Math.min(n - 1, to)); const box = t.querySelector(".ms-tip-pg"); if (!box) return;
  if (to !== t._pg) { t._pg = to; box.innerHTML = t._pages[to]; box.classList.remove("pg-n", "pg-p"); if (!t.classList.contains("noanim")) { void box.offsetWidth; box.classList.add(dir > 0 ? "pg-n" : "pg-p"); } }
  const nav = t.querySelector(".ms-tip-nav"); if (nav) { nav.querySelector("b").textContent = to + 1; nav.querySelector('[data-tp="-1"]').classList.toggle("off", to === 0); nav.querySelector('[data-tp="1"]').classList.toggle("off", to === n - 1); } }
document.addEventListener("click", ev => { const a = ev.target.closest?.(".ms-tip [data-tp]"); if (!a) return; ev.preventDefault(); ev.stopPropagation(); const t = tip(); const d = +a.dataset.tp; turn(t, t._pg + d, d); }, true);
document.addEventListener("keydown", ev => { const t = tipEl; if (!t?._pages || !t.classList.contains("on") || ev.target.closest?.("input, textarea, [contenteditable]")) return; if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") { ev.preventDefault(); const d = ev.key === "ArrowRight" ? 1 : -1; turn(t, t._pg + d, d); } });
document.addEventListener("wheel", ev => { const t = tipEl; if (!t?._pages || !t.classList.contains("on") || !(ev.target.closest?.(".ms-tip") || ev.target.closest?.("[data-ms-tip]") === t._a)) return; const d = ev.deltaY > 0 ? 1 : -1; if ((d > 0 && t._pg < t._pages.length - 1) || (d < 0 && t._pg > 0)) { ev.preventDefault(); const k = Date.now(); if (k - (t._wh || 0) < 350) return; t._wh = k; turn(t, t._pg + d, d); } }, { passive: false });
document.addEventListener("mouseover", ev => { const a = ev.target.closest?.("[data-ms-tip]"); if (!a || pinned) return; show(a); });
document.addEventListener("mouseout", ev => { const a = ev.target.closest?.("[data-ms-tip]"); if (!a || pinned) return; if (a.contains(ev.relatedTarget)) return; tip().className = "ms-tip"; tip()._a = null; tip()._built = false; });
document.addEventListener("click", ev => { const a = ev.target.closest?.("[data-ms-tip]"); if (a) { if (pinned === a) { pinned = null; tip().className = "ms-tip"; } else { pinned = a; show(a); } return; } if (pinned && !ev.target.closest(".ms-tip")) { pinned = null; tip().className = "ms-tip"; } });
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && pinned) { pinned = null; tip().className = "ms-tip"; } });
