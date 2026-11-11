/* Manhwa Sheet — character sheet (AppV2, rendered from the world configuration) */
import { rankBadge, resLook, bonusActive, goldResource, levelColor, fmtSlots, equippedTitles, equippedBags, slotsUsed, gaugeStages, isStageGauge, narrativeGaugesOn, stageOf, valueForStage, stageNum, rankPower, rarityPower, ammoOn, ammoTxt, THEMES } from "./config.js";
import { SYS, esc, getConfig, costOfStep, rankOf, flattenTree, fieldsOf, rootOf, pathOf, isBagCategory, canEquip, catTags, iconOf, featureOn, lockedFor, effectiveStats, xpNeeded, imgDefaults, gaugeState, itemBonuses, ITEM_FIELDS } from "./config.js";
import { rollStat, rollItem } from "./dice.js";
import { actorLock, menuCfg } from "./world.js";
import { pickCategory } from "./category-picker.js";
import { richEditor, descCell } from "./rich.js";
import { openWiki, levelName, cstCached, cstShown, revealed } from "./wiki.js";
import { MenuApp, visibleTabs } from "./menu.js";
import { unreadFor } from "./mail.js";
import { unreadLetters } from "./letters.js";
/* catégorie retirée : nouvel identifiant probable quand l'arbre a été renommé en allongeant les identifiants
 * (ex. title_achievement → title_achievement_earned_title) ; une seule correspondance, sinon rien (1.28.2) */
const guessCat = (id, all) => { if (!id) return null; const m = all.filter(n => !n.children?.length && n.id.startsWith(`${id}_`)); return m.length === 1 ? m[0] : null; };
import { unreadNews } from "./news.js";

const { ActorSheetV2 } = foundry.applications.sheets;

/* portrait framing presets (same as the former sheet: a bar under the portrait) */
export const POS = [["center", "Centre"], ["top", "Haut"], ["bottom", "Bas"], ["left", "Gauche"], ["right", "Droite"], ["topleft", "Haut gauche"], ["topright", "Haut droite"], ["bottomleft", "Bas gauche"], ["bottomright", "Bas droite"], ["contain", "Image entière"], ["zoom", "Zoom ×1,5 centre"], ["zoomtop", "Zoom ×1,5 haut"], ["zoombottom", "Zoom ×1,5 bas"], ["zoom2", "Zoom ×2 centre"], ["zoom2top", "Zoom ×2 haut"], ["zoom3top", "Zoom ×3 haut (visage)"]];
export const POS_CSS = { center: ["cover", "center center", 1], top: ["cover", "center top", 1], bottom: ["cover", "center bottom", 1], left: ["cover", "left center", 1], right: ["cover", "right center", 1], topleft: ["cover", "left top", 1], topright: ["cover", "right top", 1], bottomleft: ["cover", "left bottom", 1], bottomright: ["cover", "right bottom", 1], contain: ["contain", "center center", 1], zoom: ["cover", "center center", 1.5], zoomtop: ["cover", "center 15%", 1.5], zoombottom: ["cover", "center 85%", 1.5], zoom2: ["cover", "center center", 2], zoom2top: ["cover", "center 12%", 2], zoom3top: ["cover", "center 10%", 3] };
export function portraitStyle(pos) { const c = POS_CSS[pos] || POS_CSS.center; return `object-fit:${c[0]};object-position:${c[1]};${c[2] !== 1 ? `transform:scale(${c[2]});transform-origin:${c[1]};` : ""}`; }

/* nuances d'une couleur de catégorie pour ses sous-catégories : teinte décalée autour de la couleur mère, icône dans une nuance voisine plus claire */
function hexHsl(hex) { const m = String(hex || "").match(/^#?([0-9a-f]{6})$/i); if (!m) return null; const n = parseInt(m[1], 16); let r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s * 100, l * 100]; }
export function shade(hex, i, n) { const c = hexHsl(hex); if (!c) return { tc: hex, ic: hex }; const span = Math.min(70, 14 * Math.max(1, n - 1)); const off = n > 1 ? -span / 2 + span * i / (n - 1) : 0; const h = (c[0] + off + 360) % 360, s = Math.max(45, c[1]), l = Math.min(68, Math.max(48, c[2] + (i % 2 ? 6 : -4)));
  return { tc: `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`, ic: `hsl(${((h + 28) % 360).toFixed(0)} ${Math.min(100, s + 10).toFixed(0)}% ${Math.min(82, l + 16).toFixed(0)}%)` }; }
const num = n => { n = Number(n) || 0; return Number.isInteger(n) ? String(n) : n.toFixed(1); };
export const bonusTags = (cfg, item) => { const list = itemBonuses(item); return list.length ? `<span class="ms-ibonus">${list.map(b => { const st = cfg.stats.find(x => x.key === b.stat); return `<b style="--sc:${esc(st?.color || "#fff")}" class="${b.passive ? "passive" : ""}" title="${b.passive ? "Passif — agit sans être équipé" : "Une fois équipé"}">${Number(b.value) > 0 ? "+" : ""}${num(b.value)}${b.pct ? "%" : ""} ${esc(st?.abbr || b.stat)}${b.passive ? '<i class="fa-solid fa-infinity"></i>' : ""}</b>`; }).join("")}</span>` : ""; };
const sel = (name, opts, cur, extra = "") => `<select name="${name}" ${extra}>${opts.map(o => `<option value="${esc(o.key)}"${o.key === cur ? " selected" : ""}>${esc(o.name)}</option>`).join("")}</select>`;
const fmt = n => new Intl.NumberFormat("fr-FR").format(Number(n) || 0);

import { classChips, pickClass, pickSub } from "./classes.js";
import { moreChip } from "./morepop.js";
import { equipPicker } from "./equippick.js";
import { SheetDisplayApp } from "./sheetdisp.js";
import { onlyChanged, deferRender, snapFlash, historyOf } from "./sheetguard.js";
import { ChapterEditor } from "./bookeditor.js";
import { tx } from "./tx.js";

/* 1.58 : accès rapide — mode et repli choisis par chaque joueur (ce navigateur), objets récents par fiche */
const QA_MODES = [["bar", "fa-grip-lines", "Barre compacte : les épinglés sur une ligne"], ["pills", "fa-circle-dot", "Pastilles par catégorie, tiroir au clic"], ["side", "fa-table-columns", "Colonne latérale repliable, sur tous les onglets"], ["smart", "fa-wand-magic-sparkles", "Intelligent : épinglés, récents et équipés"]];
const qaMode = () => { try { const m = localStorage.getItem("ms-qa-mode"); return QA_MODES.some(x => x[0] === m) ? m : "bar"; } catch (e) { return "bar"; } };
const qaFolded = () => { try { return localStorage.getItem("ms-qa-fold") === "1"; } catch (e) { return false; } };
const qaRecent = a => { try { return JSON.parse(localStorage.getItem(`ms-qa-recent.${a.uuid}`) || "[]"); } catch (e) { return []; } };
const qaTouch = (a, id) => { try { localStorage.setItem(`ms-qa-recent.${a.uuid}`, JSON.stringify([id, ...qaRecent(a).filter(x => x !== id)].slice(0, 8))); } catch (e) { /* rien */ } };
/* 1.58 : Background — drapeau « book » { ch: { id: { title, html, order } } } ; sans livre, l'ancien champ Identité › Personnel devient le chapitre I */
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
/* 1.63 : polices et dégradés de l'éditeur du background (chaque police est chargée à part : une police absente n'empêche pas les autres) */
const BG_FONTS = [["Livre", ["Cormorant Garamond", "EB Garamond", "Lora", "Crimson Text", "Spectral", "Merriweather", "Playfair Display", "Libre Baskerville"]],
  ["Titres", ["Cinzel", "Cinzel Decorative", "Orbitron", "Audiowide", "Bebas Neue", "Oswald", "Exo 2", "Rajdhani"]],
  ["Fantasy", ["Uncial Antiqua", "MedievalSharp", "Pirata One", "IM Fell English", "Metamorphous", "Almendra"]],
  ["Manuscrite", ["Caveat", "Kalam", "Dancing Script", "Great Vibes", "Satisfy", "Indie Flower"]],
  ["Technique", ["Share Tech Mono", "Courier Prime", "Special Elite", "VT323", "Press Start 2P"]]];
const BG_GRADS = [["Feu", "#ffd23d, #ff6a1f, #ff2d55"], ["Or", "#fff3b0, #ffc63d, #b8860b"], ["Glace", "#e8fbff, #7fdcff, #3c7bff"], ["Aurore", "#5effc8, #3ccbff, #b46bff"], ["Sang", "#ff8a8a, #d0102a, #5a0010"], ["Néon rose", "#ff4fd8, #b46bff"], ["Toxique", "#d4ff3d, #3dff8a"], ["Cosmos", "#3c7bff, #b46bff, #ff4fd8"]];
function bgFontLoad(f) { if (!f) return; const id = `ms-bgf-${f.replace(/\W+/g, "-")}`; if (document.getElementById(id)) return; const l = document.createElement("link"); l.id = id; l.rel = "stylesheet"; l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, "+")}&display=swap`; document.head.append(l); }
function bgFontsIn(html) { for (const m of String(html || "").matchAll(/font-family:\s*'([^']+)'/g)) bgFontLoad(m[1]); }
/* 1.62 : HTML du background nettoyé avant d'être enregistré (pas de script, pas d'attribut on…, pas de lien javascript:) */
function bgClean(html) { try { const d = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html"); const root = d.body.firstElementChild;
  root.querySelectorAll("script, style, iframe, object, embed, link, meta, form, input, button, textarea, select").forEach(n => n.remove());
  root.querySelectorAll("*").forEach(n => { for (const at of [...n.attributes]) { const k = at.name.toLowerCase(); if (k.startsWith("on") || ((k === "href" || k === "src") && /^\s*javascript:/i.test(at.value)) || k === "contenteditable") n.removeAttribute(at.name); } });
  root.querySelectorAll("section.secret").forEach(s => { if (!s.id) s.id = bgSecId(); for (const at of [...s.attributes]) if (!["class", "id"].includes(at.name)) s.removeAttribute(at.name); });
  const txt = root.textContent.replace(/\s+/g, ""); if (!txt && !root.querySelector("img, hr, section.secret")) return ""; return root.innerHTML; } catch (e) { return ""; } }
/* 1.65.0 : blocs « Secret » du background, au format Foundry <section class="secret" id="secret-…">.
 * Le MJ les voit (cadre rouge pointillé) et les révèle d'un clic sur l'étiquette ; les joueurs ne reçoivent qu'un repère vide et invisible,
 * et quand ils enregistrent, chaque secret est remis à sa place (ceux qu'ils auraient effacés avec leur texte sont remis à la fin). */
function bgSecId() { return `secret-${foundry.utils.randomID()}`; }
function bgForViewer(html) { if (game.user.isGM || !/class="[^"]*secret|data-pop-gm/.test(String(html || ""))) return html; try { const d = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html"); const root = d.body.firstElementChild;
  root.querySelectorAll("section.secret").forEach(s => { if (s.classList.contains("revealed")) return; const ph = d.createElement("section"); ph.className = "secret ms-sec-ph"; ph.id = s.id || ""; ph.setAttribute("contenteditable", "false"); s.replaceWith(ph); });
  root.querySelectorAll("span.msw-pop[data-pop-gm]").forEach(sp => { for (const k of ["data-pop", "data-pop-t", "data-pop-u", "data-pop-n", "data-pop-gm"]) sp.removeAttribute(k); sp.className = "msw-pop-h"; });
  return root.innerHTML; } catch (e) { return ""; } }
function bgMergeSecrets(html, old) { try { const P = new DOMParser(); const od = P.parseFromString(`<div>${old || ""}</div>`, "text/html").body.firstElementChild; const keep = new Map();
  od.querySelectorAll("section.secret").forEach(s => { if (!s.classList.contains("revealed") && s.id) keep.set(s.id, s.outerHTML); });
  const nd = P.parseFromString(`<div>${html || ""}</div>`, "text/html"); const root = nd.body.firstElementChild;
  root.querySelectorAll("section.secret").forEach(s => { if (s.classList.contains("revealed") && !s.classList.contains("ms-sec-ph")) return; const h = keep.get(s.id); if (h) { const t = nd.createElement("template"); t.innerHTML = h; s.replaceWith(t.content); keep.delete(s.id); } else s.replaceWith(...s.childNodes); });
  for (const h of keep.values()) root.insertAdjacentHTML("beforeend", h);
  /* mots cliquables « MJ seulement » : on remet leurs données (le joueur n'en a reçu que le mot) */
  const gmPop = new Map(); od.querySelectorAll("span.msw-pop[data-pop-gm][data-pop-id]").forEach(sp => gmPop.set(sp.dataset.popId, sp));
  root.querySelectorAll("span.msw-pop-h, span.msw-pop").forEach(sp => { const o = gmPop.get(sp.dataset.popId);
    if (o) { sp.className = "msw-pop"; for (const k of ["pop", "popT", "popU", "popN", "popGm"]) { if (o.dataset[k] != null) sp.dataset[k] = o.dataset[k]; } }
    else if (sp.classList.contains("msw-pop-h")) sp.replaceWith(...sp.childNodes); else delete sp.dataset.popGm; });
  return root.innerHTML; } catch (e) { return old || ""; } }
/* ═══ 1.66.0 : MOTS CLIQUABLES du background — bulle au survol, épinglée au clic, texte + lien vers une fiche ═══ */
function popMd(x) { const lines = esc(String(x || "")).split(/\r?\n/); let out = "", ul = false;
  const inl = t => t.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>");
  for (const l of lines) { const m = /^\s*[-•]\s+(.*)$/.exec(l); if (m) { if (!ul) { out += "<ul>"; ul = true; } out += `<li>${inl(m[1])}</li>`; continue; } if (ul) { out += "</ul>"; ul = false; } out += l.trim() ? `<p>${inl(l)}</p>` : ""; }
  return out + (ul ? "</ul>" : ""); }
function popDocs() { const L = [];
  const add = (c, label) => { for (const d of c ?? []) if (d.visible ?? d.testUserPermission?.(game.user, "LIMITED")) L.push([`${d.name} · ${label}`, d.uuid, d.name]); };
  add(game.actors, "Acteur"); add(game.journal, "Journal"); add(game.items, "Objet"); add(game.scenes, "Scène");
  return L; }
/* 1.66.2 : contenu riche de la bulle — seules quelques balises et propriétés de style sont gardées */
const POP_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SPAN", "P", "DIV", "BR", "UL", "OL", "LI"]);
const POP_CSS = ["color", "background-color", "font-size", "font-weight", "font-style", "text-decoration", "text-align"];
function popClean(html) { try { const d = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html"); const root = d.body.firstElementChild;
  root.querySelectorAll("script, style, iframe, object, embed, template, textarea, select, button, input").forEach(n => n.remove());
  root.querySelectorAll("font").forEach(f => { const sp = d.createElement("span"); if (f.getAttribute("color")) sp.style.color = f.getAttribute("color"); if (f.dataset?.px) sp.style.fontSize = `${f.dataset.px}px`; while (f.firstChild) sp.appendChild(f.firstChild); f.replaceWith(sp); });
  [...root.querySelectorAll("*")].reverse().forEach(n => { if (!POP_TAGS.has(n.tagName)) { n.replaceWith(...n.childNodes); return; }
    const keep = POP_CSS.map(k => [k, n.style.getPropertyValue(k)]).filter(([, v]) => v && !/url\(|expression/i.test(v));
    for (const at of [...n.attributes]) n.removeAttribute(at.name); keep.forEach(([k, v]) => n.style.setProperty(k, v)); });
  return root.innerHTML.trim(); } catch (e) { return ""; } }
const popContent = x => /<[a-z][\s\S]*>/i.test(x || "") ? popClean(x) : popMd(x);
async function popDialog(v, editing) {
  const docs = popDocs(); const byLabel = new Map(docs.map(d => [d[0], d]));
  const cur = v.u ? docs.find(d => d[1] === v.u) : null;
  const B = (k, i, t) => `<a data-pc="${k}" data-tooltip="${t}"><i class="fa-solid ${i}"></i></a>`;
  const content = `<div class="ms-popdlg">
    <label class="lb">Texte de la bulle</label>
    <div class="pe-tb">${B("bold", "fa-bold", "Gras")}${B("italic", "fa-italic", "Italique")}${B("underline", "fa-underline", "Souligné")}${B("strikeThrough", "fa-strikethrough", "Barré")}<span class="sep"></span>
      <label class="pe-col" data-tooltip="Couleur du texte"><i class="fa-solid fa-font"></i><input type="color" data-ps="foreColor" value="#ffd070"></label>
      <label class="pe-col" data-tooltip="Surligner"><i class="fa-solid fa-highlighter"></i><input type="color" data-ps="hiliteColor" value="#5b3fd0"></label>
      <select data-ps="size" data-tooltip="Taille"><option value="">Taille</option>${[11, 12, 13, 14, 16, 18, 20, 24].map(n => `<option value="${n}">${n} px</option>`).join("")}</select><span class="sep"></span>
      ${B("insertUnorderedList", "fa-list-ul", "Liste à puces")}${B("insertOrderedList", "fa-list-ol", "Liste numérotée")}${B("justifyLeft", "fa-align-left", "À gauche")}${B("justifyCenter", "fa-align-center", "Centrer")}<span class="sep"></span>${B("removeFormat", "fa-text-slash", "Texte normal")}</div>
    <div class="pe-ed" contenteditable="true" spellcheck="true" data-ph="Ce qui s'affiche quand on passe la souris sur le mot…">${popContent(v.x)}</div>
    <label class="lb">Lien vers une fiche (facultatif)<input name="q" type="text" list="ms-pop-docs" placeholder="Nom d'un acteur, d'un journal, d'un objet…" value="${esc(cur ? cur[0] : (v.n || ""))}"></label>
    <datalist id="ms-pop-docs">${docs.map(d => `<option value="${esc(d[0])}"></option>`).join("")}</datalist>
    <div class="drop" data-drop><i class="fa-solid fa-hand-pointer"></i> …ou glisse ici une fiche depuis la barre latérale</div>
    <input type="hidden" name="u" value="${esc(v.u || "")}"><input type="hidden" name="n" value="${esc(v.n || "")}">
    ${game.user.isGM ? `<label class="chk"><input type="checkbox" name="gm"${v.gm ? " checked" : ""}> MJ seulement : les joueurs voient un mot normal</label>` : ""}</div>`;
  const read = form => { const f = form.elements; const q = f.q.value.trim(); let u = f.u.value, n = f.n.value;
    const hit = byLabel.get(q); if (hit) { u = hit[1]; n = hit[2]; } else if (!q) { u = ""; n = ""; } else if (q !== n) { const h2 = docs.find(d => d[2].toLowerCase() === q.toLowerCase()); if (h2) { u = h2[1]; n = h2[2]; } else { u = ""; n = ""; } }
    const ed = form.querySelector(".pe-ed"); const x = ed.textContent.trim() || ed.querySelector("br, li") ? popClean(ed.innerHTML) : "";
    return { t: v.t || "", x, u, n, gm: !!f.gm?.checked }; };
  const buttons = [{ action: "ok", label: editing ? "Enregistrer" : "Créer la bulle", icon: "fa-solid fa-check", default: true, callback: (ev, btn) => read(btn.form) }];
  if (editing) buttons.push({ action: "remove", label: "Retirer la bulle", icon: "fa-solid fa-eraser", callback: () => ({ remove: true }) });
  buttons.push({ action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null });
  const r = await foundry.applications.api.DialogV2.wait({ window: { title: editing ? `Bulle de « ${v.t || "mot"} »` : `Nouvelle bulle sur « ${v.t || "mot"} »`, icon: "fa-solid fa-comment-dots" }, classes: ["ms-popdlg-win"], position: { width: 500 }, content, buttons, rejectClose: false,
    render: (ev, dlg) => { const root = (dlg?.element ?? ev?.target?.element); if (!root) return; const ed = root.querySelector(".pe-ed"), drop = root.querySelector("[data-drop]"), form = ed.closest("form");
      /* barre de mise en forme : la sélection du texte est gardée pendant qu'on passe par une couleur ou une taille */
      let rng = null; const keep = () => { const s = getSelection(); if (s.rangeCount && ed.contains(s.anchorNode)) rng = s.getRangeAt(0).cloneRange(); };
      const back = () => { ed.focus(); if (rng) { const s = getSelection(); s.removeAllRanges(); s.addRange(rng); } try { document.execCommand("styleWithCSS", false, true); } catch (e) { /* rien */ } };
      document.addEventListener("selectionchange", keep); root.addEventListener("remove", () => document.removeEventListener("selectionchange", keep));
      root.querySelector(".pe-tb").addEventListener("mousedown", e => { if (e.target.closest("[data-pc]")) e.preventDefault(); });
      root.querySelector(".pe-tb").addEventListener("click", e => { const a = e.target.closest("[data-pc]"); if (!a) return; e.preventDefault(); back(); document.execCommand(a.dataset.pc); keep(); });
      root.querySelector(".pe-tb").addEventListener("change", e => { const c = e.target.closest("[data-ps]"); if (!c) return; const val = c.value; if (c.tagName === "SELECT") c.value = ""; if (!val) return; back();
        if (c.dataset.ps === "size") { document.execCommand("styleWithCSS", false, false); document.execCommand("fontSize", false, "7"); ed.querySelectorAll('font[size="7"]').forEach(f => { const sp = document.createElement("span"); sp.style.fontSize = `${val}px`; while (f.firstChild) sp.appendChild(f.firstChild); f.replaceWith(sp); }); }
        else document.execCommand(c.dataset.ps, false, val); keep(); });
      ed.addEventListener("paste", e => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData?.getData("text/plain") || ""); });
      setTimeout(() => { ed.focus(); const s = getSelection(); const rr = document.createRange(); rr.selectNodeContents(ed); rr.collapse(false); s.removeAllRanges(); s.addRange(rr); }, 30);
      if (!drop) return;
      drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); }); drop.addEventListener("dragleave", () => drop.classList.remove("over"));
      drop.addEventListener("drop", async e => { e.preventDefault(); drop.classList.remove("over"); let data; try { data = foundry.applications.ux.TextEditor.implementation.getDragEventData(e); } catch (err) { try { data = JSON.parse(e.dataTransfer.getData("text/plain")); } catch (e2) { data = null; } }
        const uuid = data?.uuid; if (!uuid) return ui.notifications.warn("Glisse une fiche (acteur, journal, objet, scène)."); const doc = await fromUuid(uuid); if (!doc) return;
        form.elements.u.value = uuid; form.elements.n.value = doc.name; form.elements.q.value = doc.name; drop.innerHTML = `<i class="fa-solid fa-link"></i> ${esc(doc.name)}`; }); } });
  return r && typeof r === "object" ? r : null; }

/* bulle : verre miroir, pas de titre, pas de barre de défilement ; si le texte est long, il est coupé en pages (‹ 1/3 ›) */
const POP = { el: null, tHide: 0, tShow: 0, cur: null };
const POP_W = 300, POP_H = 210;
function popBuild(sp, pin) { const b = document.createElement("div"); b.className = `ms-bubble${pin ? " pin" : ""}`;
  const u = sp.dataset.popU; const html = popContent(sp.dataset.pop || "");
  b.innerHTML = `<div class="pv"><div class="pg">${html || (u ? "" : `<p class="none">Aucun texte.</p>`)}</div></div>${u ? `<a class="lk" data-popu="${esc(u)}"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${esc(sp.dataset.popN || "Ouvrir la fiche")}</a>` : ""}<footer hidden><a data-pp="-1" aria-label="Page précédente"><i class="fa-solid fa-chevron-left"></i></a><span></span><a data-pp="1" aria-label="Page suivante"><i class="fa-solid fa-chevron-right"></i></a></footer>${sp.dataset.popGm ? `<em class="gm"><i class="fa-solid fa-user-secret"></i> MJ</em>` : ""}`;
  document.body.append(b);
  /* pagination : au-delà de POP_H, le texte s'écoule en colonnes de la largeur de la bulle et on tourne les pages */
  const pv = b.querySelector(".pv"), pg = b.querySelector(".pg"); b._pg = 0; b._n = 1;
  if (pg.scrollHeight > POP_H + 4) { pv.classList.add("paged"); pv.style.height = `${POP_H}px`; const w = pv.clientWidth; pg.style.columnWidth = `${w}px`; pg.style.height = `${POP_H}px`;
    b._w = w + parseFloat(getComputedStyle(pg).columnGap || 0); b._n = Math.max(1, Math.round(pg.scrollWidth / b._w)); const ft = b.querySelector("footer"); ft.hidden = false; popPage(b, 0); }
  b.addEventListener("click", e => { const a = e.target.closest("[data-pp]"); if (!a) return; e.preventDefault(); e.stopPropagation(); popPage(b, b._pg + Number(a.dataset.pp)); });
  b.addEventListener("wheel", e => { if (b._n < 2) return; e.preventDefault(); const now = Date.now(); if (now - (b._wt || 0) < 220) return; b._wt = now; popPage(b, b._pg + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
  return b; }
function popPage(b, p) { p = Math.max(0, Math.min(b._n - 1, p)); b._pg = p; const pg = b.querySelector(".pg"); pg.style.transform = `translateX(${-p * b._w}px)`;
  const ft = b.querySelector("footer"); if (!ft) return; ft.querySelector("span").textContent = `${p + 1} / ${b._n}`; ft.querySelector('[data-pp="-1"]').classList.toggle("off", p === 0); ft.querySelector('[data-pp="1"]').classList.toggle("off", p === b._n - 1); }
function popPlace(b, sp) { const r = sp.getBoundingClientRect(); const w = b.offsetWidth, h = b.offsetHeight; let x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)); let y = r.bottom + 10; b.classList.remove("up"); if (y + h > innerHeight - 8) { y = Math.max(8, r.top - h - 10); b.classList.add("up"); } b.style.left = `${x}px`; b.style.top = `${y}px`; b.style.setProperty("--ax", `${Math.max(14, Math.min(w - 14, r.left + r.width / 2 - x))}px`); }
function popHide() { clearTimeout(POP.tShow); if (POP.el) { POP.el.remove(); POP.el = null; POP.cur = null; } }
function popShow(sp) { clearTimeout(POP.tHide); if (POP.cur === sp && POP.el) return; popHide(); const b = popBuild(sp, false); popPlace(b, sp); POP.el = b; POP.cur = sp;
  b.addEventListener("pointerenter", () => clearTimeout(POP.tHide)); b.addEventListener("pointerleave", () => { POP.tHide = setTimeout(popHide, 250); });
  /* tourner une page d'une bulle de survol l'épingle */
  b.addEventListener("click", e => { if (e.target.closest("[data-pp]") && POP.el === b) { POP.el = null; POP.cur = null; popPinEl(b, sp); } }); }
function popPin(sp) { const keepPg = POP.cur === sp && POP.el ? POP.el._pg : 0; popHide(); const b = popBuild(sp, true); popPlace(b, sp); if (keepPg) popPage(b, keepPg); popPinEl(b, sp); }
function popPinEl(b, sp) { b.classList.add("pin");
  const app = foundry.applications.instances?.get(sp.closest(".application")?.id); const ed = !!sp.closest('[contenteditable="true"]') && app?._popEdit;
  b.insertAdjacentHTML("afterbegin", `<nav class="tools">${ed ? `<a data-pa="edit" data-tooltip="Modifier la bulle"><i class="fa-solid fa-pen"></i></a><a data-pa="del" data-tooltip="Retirer la bulle (le mot reste)"><i class="fa-solid fa-eraser"></i></a>` : ""}<a data-pa="x" data-tooltip="Fermer"><i class="fa-solid fa-xmark"></i></a></nav>`);
  b.addEventListener("click", e => { const a = e.target.closest("[data-pa]"); if (!a) return; e.preventDefault(); if (a.dataset.pa === "x") b.remove(); else if (a.dataset.pa === "edit") { b.remove(); app._popEdit(sp); } else if (a.dataset.pa === "del") { b.remove(); app._popRemove(sp); } });
  /* déplacer la bulle épinglée en la tirant (hors texte et boutons) */
  b.addEventListener("pointerdown", e => { if (e.target.closest("a, .pg *") || e.button !== 0) return; const r = b.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top; b.setPointerCapture(e.pointerId); b.classList.add("drag");
    const mv = ev => { b.style.left = `${Math.max(0, Math.min(innerWidth - 40, ev.clientX - ox))}px`; b.style.top = `${Math.max(0, Math.min(innerHeight - 30, ev.clientY - oy))}px`; };
    b.addEventListener("pointermove", mv); b.addEventListener("pointerup", () => { b.removeEventListener("pointermove", mv); b.classList.remove("drag"); }, { once: true }); }); }
if (!globalThis.__msPopBound) { globalThis.__msPopBound = true;
  const isPop = t => t?.closest?.(".bgx-flow .msw-pop");
  document.addEventListener("pointerover", e => { const sp = isPop(e.target); if (!sp || e.pointerType === "touch") return; clearTimeout(POP.tShow); POP.tShow = setTimeout(() => popShow(sp), 180); });
  document.addEventListener("pointerout", e => { const sp = isPop(e.target); if (!sp || sp.contains(e.relatedTarget)) return; clearTimeout(POP.tShow); POP.tHide = setTimeout(popHide, 250); });
  document.addEventListener("click", async e => { const lk = e.target.closest?.(".ms-bubble [data-popu]"); if (lk) { e.preventDefault(); const doc = await fromUuid(lk.dataset.popu);
      if (!doc) return ui.notifications.warn("Cette fiche n'existe plus."); if (doc.testUserPermission && !doc.testUserPermission(game.user, "LIMITED")) return ui.notifications.warn("Tu n'as pas accès à cette fiche.");
      if (doc.documentName === "JournalEntryPage") doc.parent.sheet.render(true, { pageId: doc.id }); else if (doc.documentName === "Scene") doc.view(); else doc.sheet?.render(true); return; }
    const sp = isPop(e.target); if (sp) popPin(sp); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") popHide(); }); }

export function bookOf(a) { const ch = a.getFlag(SYS, "book")?.ch;
  if (ch && Object.keys(ch).length) return Object.entries(ch).map(([id, c], i) => ({ id, title: c?.title || "", html: c?.html || "", special: !!c?.special, icon: c?.icon || "fa-bookmark", color: c?.color || "", order: Number.isFinite(Number(c?.order)) ? Number(c.order) : 1000 + i })).sort((x, y) => (x.special - y.special) || x.order - y.order);
  const old = a.system.identity?.personal?.personal; return old && String(old).replace(/<[^>]+>/g, "").trim() ? [{ id: "c1", title: "Chapitre 1", html: old, order: 0, special: false, icon: "fa-bookmark", color: "" }] : []; }
/* 1.58.3 : D.A du livre (drapeau book.style) — thème des pages, polices, taille, couleur d'accent */
export const BOOK_THEMES = { sheet: ["Fiche (sombre)", "#131d40", "#ffd070"], night: ["Nuit étoilée", "#0b1030", "#9fd2ff"], neon: ["Néon", "#070912", "#38e0ff"], grimoire: ["Grimoire", "#22100f", "#e0a050"], ash: ["Cendre", "#1c1c1f", "#c9c9d2"], jade: ["Jade", "#0c1f1a", "#5ee0a8"], parchment: ["Parchemin", "#efe1c0", "#8a3b12"], ivory: ["Ivoire", "#f6f1e6", "#2c4a7a"], sepia: ["Sépia", "#e2cfa6", "#5a3416"] };
export const BOOK_FONTS = [["", "Police de la fiche"], ["Cormorant Garamond", "Cormorant Garamond"], ["EB Garamond", "EB Garamond"], ["Lora", "Lora"], ["Crimson Text", "Crimson Text"], ["Spectral", "Spectral"], ["Merriweather", "Merriweather"], ["Cinzel", "Cinzel (capitales)"], ["Playfair Display", "Playfair Display"], ["IM Fell English", "IM Fell (ancien)"], ["Special Elite", "Machine à écrire"], ["Courier Prime", "Courier Prime"], ["Caveat", "Manuscrite (Caveat)"], ["Kalam", "Manuscrite (Kalam)"]];
export const BOOK_ICONS = ["fa-bookmark", "fa-star", "fa-heart", "fa-users", "fa-user-secret", "fa-map", "fa-scroll", "fa-skull", "fa-key", "fa-gem", "fa-feather-pointed", "fa-shield-halved", "fa-dragon", "fa-music", "fa-envelope", "fa-hourglass-half"];
const bookStyle = a => ({ theme: "sheet", body: "", title: "", size: 14, acc: "", ...(a.getFlag(SYS, "book")?.style || {}) });
function bookFonts() { if (document.getElementById("ms-bk-fonts")) return; const fams = BOOK_FONTS.filter(f => f[0]).map(f => `family=${f[0].replace(/ /g, "+")}:ital,wght@0,400;0,700;1,400`).join("&");
  const l = document.createElement("link"); l.id = "ms-bk-fonts"; l.rel = "stylesheet"; l.href = `https://fonts.googleapis.com/css2?${fams}&display=swap`; document.head.append(l); }
const THEME_FONTS = { sheet: ["", ""], night: ["Lora", "Cinzel"], neon: ["", ""], grimoire: ["EB Garamond", "IM Fell English"], ash: ["Spectral", ""], jade: ["Cormorant Garamond", "Cormorant Garamond"], parchment: ["EB Garamond", "IM Fell English"], ivory: ["Lora", "Playfair Display"], sepia: ["Courier Prime", "Special Elite"] };
const bookVars = st => { const q = f => f ? `'${f}', serif` : ""; const tf = THEME_FONTS[st.theme] || ["", ""]; const body = st.body || tf[0], title = st.title || tf[1]; return `${body ? `--bk-font:${q(body)};` : ""}${title ? `--bk-tfont:${q(title)};` : ""}--bk-fs:${Math.min(22, Math.max(11, Number(st.size) || 14))}px;${st.acc ? `--bk-acc:${st.acc};` : ""}`; };
export const bookStyleOf = a => bookStyle(a); export const bookVarsOf = st => bookVars(st); export const bookFontsLoad = () => bookFonts();   /* 1.60 : pour la fenêtre d'écriture */
export class CharacterSheet extends ActorSheetV2 {
  static DEFAULT_OPTIONS = {
    classes: ["ms-sheet", "ms-character"], position: { width: 980, height: 760 }, window: { resizable: true, icon: "fa-solid fa-id-card" },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: { pickClass: CharacterSheet.#pickClass, pickSub: CharacterSheet.#pickSub, statPlus: CharacterSheet.#stat, statMinus: CharacterSheet.#stat, msTab: CharacterSheet.#tab, sub: CharacterSheet.#sub, eqGroup: CharacterSheet.#eqGroup, itemCreate: CharacterSheet.#itemCreate, reassignTo: CharacterSheet.#reassignTo, itemEdit: CharacterSheet.#itemEdit, itemDelete: CharacterSheet.#itemDelete, itemEquip: CharacterSheet.#itemEquip, itemQty: CharacterSheet.#itemQty, equipTitle: CharacterSheet.#equipTitle, titles: CharacterSheet.#titles, unlockStat: CharacterSheet.#unlockStat, tabAdd: CharacterSheet.#tabAdd, gauge: CharacterSheet.#gauge, gaugeSet: CharacterSheet.#gaugeSet, rollStat: CharacterSheet.#rollStat, rollItem: CharacterSheet.#rollItem, fav: CharacterSheet.#fav, levelUp: CharacterSheet.#levelUp, reassign: CharacterSheet.#reassign, carnet: CharacterSheet.#carnet, itemAmmo: CharacterSheet.#itemAmmo, sheetDisp: CharacterSheet.#sheetDisp, sheetHist: CharacterSheet.#sheetHist, bags: CharacterSheet.#bags, titlePick: CharacterSheet.#titlePick, qaUse: CharacterSheet.#qaUse, qaMode: CharacterSheet.#qaMode, qaCat: CharacterSheet.#qaCat, qaFold: CharacterSheet.#qaFold, bkTurn: CharacterSheet.#bkTurn, bkGo: CharacterSheet.#bkGo, bkEdit: CharacterSheet.#bkEdit, bkAdd: CharacterSheet.#bkAdd, bkMove: CharacterSheet.#bkMove, bkDel: CharacterSheet.#bkDel, bkSel: CharacterSheet.#bkSel, bkSpec: CharacterSheet.#bkSpec, bkQuick: CharacterSheet.#bkQuick, bkQuickClose: CharacterSheet.#bkQuickClose, bkStyle: CharacterSheet.#bkStyle, bkAccReset: CharacterSheet.#bkAccReset }
  };
  /* 1.59 : pas de rendu pendant qu'on écrit (mise à jour venue d'ailleurs) ; seul le champ modifié est envoyé */
  render(options, _options) { if (deferRender(this, options, _options)) return this; return super.render(options, _options); }
  _prepareSubmitData(event, form, formData, updateData) { return onlyChanged(this, event, super._prepareSubmitData(event, form, formData, updateData)); }
  constructor(...a) { super(...a); this.tab = "stats"; this.sub = {}; this.sort = {}; this.search = {}; }
  /* taille de la fenêtre : défaut de la configuration, puis la dernière taille de CETTE fiche sur ce navigateur (si « mémoriser ») */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    try { const w = getConfig().window || {}; options.position ??= {}; options.position.width = Number(w.width) || options.position.width; options.position.height = Number(w.height) || options.position.height;
      const id = options.document?.uuid; const saved = w.remember !== false && id ? JSON.parse(localStorage.getItem(`ms-size.${id}`) || "null") : null;
      if (saved?.width) options.position.width = saved.width; if (saved?.height) options.position.height = saved.height; } catch (e) { /* stockage indisponible : taille par défaut */ }
    return options;
  }
  setPosition(position) {
    const r = super.setPosition(position);
    if (this.rendered && this.tab === "background" && (position?.width || position?.height)) { clearTimeout(this._bkT); this._bkT = setTimeout(() => this.#bgHead(), 60); }
    try { if (this.rendered && getConfig().window?.remember !== false && (position?.width || position?.height)) { const p = this.position; localStorage.setItem(`ms-size.${this.document.uuid}`, JSON.stringify({ width: Math.round(p.width), height: Math.round(p.height) })); } } catch (e) { /* rien */ }
    return r;
  }
  get title() { return this.actor.name; }
  async close(o) { try { await this.#bgSave(); } catch (e) { /* rien */ } try { this._bgRO?.disconnect(); } catch (e) { /* rien */ } this.bookEditing = false; this.bookQuick = null; clearTimeout(this._gpT); try { await this.#gCommit(); } catch (e) { /* rien */ } return super.close(o); }

  /* ───────── render ───────── */
  async _renderHTML() {
    const a = this.actor, s = a.system, cfg = getConfig(), gm = game.user.isGM, editable = this.isEditable;
    const p = cfg.progression; const payRes = cfg.resources.find(r => r.key === p.payWith) || cfg.resources[0];
    const dis = key => (!editable || lockedFor(cfg, key)) ? "disabled" : ""; this._dis = dis;
    const npc = a.type === "npc"; const compact = false; const disp = a.getFlag(SYS, "display") || {}; const show = k => disp[k] !== false;   /* affichage par fiche (réglé par le MJ) */
    /* header */
    const resList = cfg.resources.filter(r => r.inHeader && show(`r:${r.key}`)); /* 1.58.6 : chaque monnaie se masque à part (œil) */
    const resources = resList.length ? `<div class="ms-resline full" style="--n:${resList.length}">${resList.map(r => `<label class="ms-chip ms-res anim look-${resLook(r)}" style="--c:${esc(r.color)}"><i class="fa-solid ${esc(r.icon)}"></i><span>${esc(r.name)}</span><input type="text" inputmode="decimal" class="ms-rel" data-dtype="Number" data-min="${r.min ?? 0}" name="system.resources.${r.key}" value="${Number(s.resources[r.key]) || 0}" title="Saisir +200 ou −200 pour ajouter ou retirer" ${dis("resources")}></label>`).join("")}</div>` : "";
    const gs = cfg.gaugeStyle || {};
    const narr = narrativeGaugesOn(cfg); const gauges = featureOn(cfg, "gauges") && show("gauges") ? `<div class="ms-gauges look-${esc(gs.look || "hatch")}${narr ? " narrative" : ""}" style="--warn:${esc(gs.warnColor || "#ffb347")};--crit:${esc(gs.critColor || "#ff4d5e")}">${cfg.gauges.filter(g => show(`g:${g.key}`)).map(g => { const gv = s.gauges?.[g.key] || {}; const max = Number(gv.max) || 0, val = Math.max(0, Number(gv.value) || 0); const pct = max ? Math.min(100, Math.round(val / max * 100)) : 0; const state = gaugeState(cfg, val, max);
      if (narr || isStageGauge(g)) { const st = gaugeStages(g); const v = stageOf(g, gv, st.length); const label = st[v - 1]; const sst = gaugeState(cfg, v, st.length);
        return `<div class="ms-gauge stages ${sst}" data-gauge="${g.key}" style="--c:${esc(g.color)};--pct:${Math.round(v / st.length * 100)}%" title="${esc(g.name)} — stade ${v} : ${esc(label)}">
        <div class="top"><i class="fa-solid ${esc(g.icon)} ic"></i><span class="nm">${esc(g.abbr || g.name)}</span><span class="stg"><b>${esc(label)}</b>${stageNum(cfg, v, st.length) ? `<small>${stageNum(cfg, v, st.length)}</small>` : ""}</span>
          <a data-action="gauge" data-d="-1" class="pm" ${dis("gauges")}><i class="fa-solid fa-minus"></i></a><a data-action="gauge" data-d="1" class="pm" ${dis("gauges")}><i class="fa-solid fa-plus"></i></a></div>
        <div class="segs">${st.map((n, i) => `<a class="seg${i < v ? " on" : ""}" data-action="gaugeSet" data-v="${i + 1}" title="${esc(n)}" ${dis("gauges")}></a>`).join("")}</div></div>`; }
      return `<div class="ms-gauge ${state}" data-gauge="${g.key}" style="--c:${esc(g.color)};--pct:${pct}%" title="${esc(g.name)} ${val} / ${max}${state === "crit" ? " — CRITIQUE" : state === "warn" ? " — bas" : ""}">
        <div class="top"><i class="fa-solid ${esc(g.icon)} ic"></i><span class="nm">${esc(g.abbr || g.name)}</span><span class="st">${state === "empty" ? "À TERRE" : state === "crit" ? "CRITIQUE" : state === "warn" ? "BAS" : ""}</span>
          <a data-action="gauge" data-d="-1" class="pm" ${dis("gauges")}><i class="fa-solid fa-minus"></i></a><input type="text" inputmode="decimal" class="ms-rel" data-dtype="Number" data-min="0" name="system.gauges.${g.key}.value" value="${val}" title="Saisir +10 ou −10 pour ajouter ou retirer" ${dis("gauges")}><em>/</em>${g.maxMode === "manual" ? `<input type="number" class="mx" name="system.gauges.${g.key}.max" value="${max}" min="0" ${gm && editable ? "" : "disabled"}>` : `<b class="mx">${max}</b>`}<a data-action="gauge" data-d="1" class="pm" ${dis("gauges")}><i class="fa-solid fa-plus"></i></a></div>
        <div class="bar"><i class="fill"><u></u></i>${gs.look === "segments" ? `<i class="segs"></i>` : ""}<span class="pct">${pct}%</span></div></div>`; }).join("")}</div>` : "";
    const xp = featureOn(cfg, "xp") && show("xp") ? (() => { const need = s.xpNeeded || xpNeeded(cfg, s.level); const val = Number(s.xp) || 0; const pct = Math.min(100, Math.round(val / need * 100)); const x = cfg.xp; const full = x.mode === "manual" && val >= need;
      return `<div class="ms-xp style-${esc(x.style || "flat")}${x.hatch !== false && x.hatchOn !== "none" ? ` hatch-${esc(x.hatchOn || "filled")}` : ""}${full ? " full" : ""}" style="--c:${esc(x.color || "#38a8ff")};--pct:${pct}%">
        <span class="lb"><i class="fa-solid fa-arrow-trend-up"></i><b>XP</b><small>NIV ${s.level} <i class="fa-solid fa-angles-right"></i> ${Number(s.level) + 1}</small></span>
        <div class="bar"><i class="track"></i><i class="fill"><u></u><s></s></i><span class="pct"><b>${pct}</b><small>%</small></span></div>
        <span class="num"><input type="text" inputmode="decimal" class="ms-rel" data-dtype="Number" data-min="0" name="system.xp" value="${val}" title="Saisir +200 ou −200 pour ajouter ou retirer" ${dis("xp")}><em>/ ${fmt(need)}</em></span>${full && editable && !lockedFor(cfg, "level") ? `<a data-action="levelUp" class="ms-btn small lvup"><i class="fa-solid fa-angles-up"></i> Niveau +</a>` : x.mode === "manual" ? `<small class="hint">manuel</small>` : ""}</div>`; })() : "";
    const titles = equippedTitles(a).map(id => a.items.get(id)); const title = titles[0];
    const used = slotsUsed(a); const maxSlots = this.slotMax(cfg);
    const bags = a.items.filter(i => isBagCategory(cfg, i.system.category)); const eqBags = equippedBags(a); const bag = eqBags[0] || null; const bagSlots = eqBags.reduce((n, b) => n + (Number(b.system.slots) || 0), 0);
    const rk = rankOf(cfg, s.rank); const aw = cfg.awakening.find(x => x.key === s.awakening) || cfg.awakening[0];
    const header = `<header class="ms-head">
      <div class="ms-portrait"><div class="ms-pic"><img src="${esc(a.img)}" data-action="editImage" data-edit="img" style="${portraitStyle(s.portrait)}" title="Cliquer pour changer le portrait"></div>
        <div class="ms-rankbox anim pick" style="--c:${esc(rk?.color || "#fff")}"><span>Rang</span><b class="rkv">${esc(rk?.name || "—")}</b></div>
        ${compact ? "" : `<div class="ms-frame-bar"><i class="fa-solid fa-crop-simple"></i><select name="system.portrait" title="Cadrage du portrait">${POS.map(x => `<option value="${x[0]}"${x[0] === s.portrait ? " selected" : ""}>${x[1]}</option>`).join("")}</select></div>`}</div>
      <div class="ms-idblock">
        <div class="ms-namerow"><input class="ms-name" type="text" name="name" value="${esc(a.name)}" placeholder="Nom" ${editable ? "" : "disabled"}>${gm ? `<a data-action="sheetDisp" class="ms-disp-btn" title="Affichage de cette fiche (MJ) : éléments visibles, style, icônes du Menu"><i class="fa-solid fa-eye"></i></a><a data-action="sheetHist" class="ms-disp-btn" title="Historique des modifications de cette fiche (session, MJ)"><i class="fa-solid fa-clock-rotate-left"></i></a>` : ""}${cfg.carnet?.enabled !== false && (game.user.isGM || visibleTabs(a).length) ? (() => { const un = unreadFor(a) + unreadLetters(a) + unreadNews(); const tr = menuBtnTier(a); return `<a data-action="carnet" class="ms-menu-btn mbt mb-t${tr}" title="Menu : groupe, quêtes, guilde, messagerie, échange, carnet"><i class="fa-solid fa-bars"></i><span>MENU</span>${tr >= 5 ? `<em class="sp"></em><em class="sp s2"></em><em class="sp s3"></em>` : ""}${un ? `<b>${un}</b>` : ""}</a>`; })() : ""}</div>
        <div class="ms-rows">
          <label class="ms-chip ms-lvchip pick" title="Niveau ${s.level} — ${esc(levelName(s.level))}"><i class="fa-solid fa-angles-up"></i><span>Niv</span><b class="lvv">${Number(s.level) || 0}</b></label>
          <div class="ms-chip aw anim full pick aw-${esc(aw?.anim || "none")}" style="--c:${esc(aw?.color || "#7ad7ff")}"><i class="fa-solid fa-sun"></i><span>Éveil</span><b>${esc(aw?.name || "—")}</b></div>
          ${compact ? "" : `<div class="ms-chip sp anim full pick"><i class="fa-solid fa-star"></i><span>Constellation</span><b>${s.sponsor ? esc((() => { const id = a.getFlag(SYS, "cst"); const d = id && cstCached()?.list.find(x => x.id === id); return d && !revealed("cst", d.id) ? cstShown(d).name : s.sponsor; })()) : "<em>aucune</em>"}</b></div>`}
          ${cfg.origins.length && !compact ? `<div class="ms-chip or full"><i class="fa-solid fa-earth-asia"></i><span>Origine</span>${sel("system.origin", [{ key: "", name: "—" }, ...cfg.origins], s.origin, dis("origin"))}</div>` : ""}
          ${cfg.classesOn !== false && !compact ? classChips(a, game.user.isGM || a.isOwner) : ""}
          ${resources}
          <div class="ms-tbs"><div class="ms-chip ti anim${titles.length > 1 ? " many" : ""}" ${editable ? 'data-action="titlePick" title="Choisir les titres équipés"' : titles.length > 1 ? 'data-action="titles" title="Voir les titres équipés"' : `title="Équiper un titre : onglet Titres, bouton couronne sur la ligne du titre. Plusieurs titres en même temps : Paramètres du système › Configuration › page Fiche › « Titres équipables en même temps » (actuellement ${Number(cfg.equipment.titles) || 1}). Créer un titre : onglet Titres, bouton +."`}><i class="fa-solid fa-crown"></i><span>Titre${titles.length > 1 ? "s" : ""}</span><b>${title ? `<span class="mq"><span class="mq-in">${esc(title.name)}</span></span>` : "<em>aucun titre équipé</em>"}</b>${moreChip(titles.slice(1).filter(Boolean).map(t => ({ n: t.name, img: t.img, c: rankOf(cfg, t.system.rank)?.color, s: rankOf(cfg, t.system.rank)?.name ? `Rang ${rankOf(cfg, t.system.rank).name}` : "" })), "Autres titres équipés")}</div>
          ${cfg.equipment.enabled ? `<div class="ms-chip bg ms-bag${editable && !lockedFor(cfg, "bag") ? " pick" : ""}" ${editable && !lockedFor(cfg, "bag") ? 'data-action="bags"' : ""} title="${eqBags.length ? `${eqBags.length} sac${eqBags.length > 1 ? "s" : ""} équipé${eqBags.length > 1 ? "s" : ""}${bagSlots ? ` · +${bagSlots} places` : ""} — cliquer pour choisir` : bags.length ? "Aucun sac équipé — cliquer pour en équiper" : "Aucun sac : ajoute-en un dans l'onglet Sacs"}"><i class="fa-solid ${eqBags.length ? "fa-sack-dollar" : "fa-sack-xmark"}"></i><span>Sac${eqBags.length > 1 ? "s" : ""}</span><b>${bag ? `<span class="mq"><span class="mq-in">${esc(bag.name)}</span></span>` : "<em>aucun</em>"}${bagSlots ? `<small class="bs">+${bagSlots}</small>` : ""}</b>${moreChip(eqBags.slice(1).map(b => ({ n: b.name, img: b.img, s: Number(b.system.slots) ? `+${b.system.slots} places` : "", c: rankOf(cfg, b.system.rank)?.color })), "Autres sacs équipés")}</div>` : ""}
          ${cfg.equipment.enabled && cfg.equipment.slotsInHeader !== false ? `<div class="ms-chip slots${maxSlots && used > maxSlots ? " over" : ""}" title="Places occupées par l'équipement${bagSlots ? ` (sacs : +${bagSlots})` : ""}"><i class="fa-solid fa-boxes-stacked"></i><span>Places</span><b><u>${fmtSlots(used)}</u> / ${maxSlots ? fmtSlots(maxSlots) : "∞"}</b><i class="bar" style="--p:${maxSlots ? Math.min(100, used / maxSlots * 100) : 0}%"></i></div>` : ""}</div>
        </div>${gauges}${xp}
      </div></header>`;
    /* tabs */
    const owned = r => a.items.some(i => rootOf(cfg, i.system.category)?.id === r.id);
    const roots = cfg.showEmptyTabs ? cfg.items : cfg.items.filter(r => owned(r) || r.id === this.tab || this.shownRoots?.has(r.id));
    const hidden = cfg.items.filter(r => !roots.includes(r));
    const tabs = [...(show("background") ? [["background", "Background", "fa-book-open", "var(--ms-warm, #ffd070)"]] : []), ...(show("stats") ? [["stats", "Statistiques", "fa-chart-simple", "var(--ms-acc)"]] : []), ...(show("identity") ? [["identity", "Identité", "fa-id-card", "var(--ms-acc2)"]] : []), ...(show("items") ? roots.map(r => [r.id, r.name, r.icon, r.color || "var(--ms-acc)"]) : []), ...(npc && gm ? [["gmnotes", "Notes MJ", "fa-user-secret", "var(--ms-warm)"]] : [])];
    if (!tabs.some(t => t[0] === this.tab) && this.tab !== "equipped") this.tab = tabs[0]?.[0] || "stats";
    const addTab = hidden.length && editable ? `<a data-action="tabAdd" class="ms-tab-add" title="Ouvrir un onglet de catégorie (${hidden.map(r => r.name).join(", ")})"><i class="fa-solid fa-plus"></i></a>` : "";
    const eqTab = cfg.equipment.enabled && show("equipped") ? `<a data-action="msTab" data-tab="equipped" class="ms-tab-eq ${this.tab === "equipped" ? "on" : ""}"><i class="fa-solid fa-user-shield"></i>Équipé<b>${a.items.filter(i => i.system.equipped).length}</b></a>` : "";
    const rootCount = id => a.items.filter(i => rootOf(cfg, i.system.category)?.id === id).length;
    const tabA = t => { const n = cfg.items.some(r => r.id === t[0]) ? rootCount(t[0]) : 0; return `<a data-action="msTab" data-tab="${t[0]}" class="${this.tab === t[0] ? "on" : ""}" style="--tc:${t[3]}"><i class="fa-solid ${t[2]}"></i>${esc(t[1])}${n ? `<b class="ms-tcnt" title="${n} objet${n > 1 ? "s" : ""}">${n}</b>` : ""}</a>`; };
    const firstK = disp.firstTab === "stats" ? ["stats", "background", "identity"] : ["background", "stats", "identity"]; /* 1.58.3 : œil › Onglets › onglet en premier */
    const first = firstK.map(k => tabs.find(t => t[0] === k)).filter(Boolean), rest = tabs.filter(t => !firstK.includes(t[0]));
    if (!this._tabInit) { this._tabInit = true; if (first[0] && this.tab === "stats") this.tab = first[0][0]; }
    const cnt = t => { let n = 0; const w = l => { for (const x of l || []) { if (x.folder) w(x.children); else n++; } }; w(t); return n; }; const nf = cnt(s.carnet?.friends) + cnt(s.carnet?.places) + cnt(s.carnet?.notes);
    const carnet = "";
    const nav = `<nav class="ms-tabs">${first.map(tabA).join("")}${eqTab}<span class="ms-tabsep"></span>${rest.map(tabA).join("")}${addTab}${carnet}</nav>`;
    /* items whose category no longer exists in the tree are never lost : they are listed here until reassigned */
    const all = flattenTree(cfg.items); const orphans = a.items.filter(i => !all.some(n => n.id === i.system.category));
    const orphanBox = orphans.length ? `<div class="ms-orphans"><div class="ttl"><i class="fa-solid fa-triangle-exclamation"></i> ${orphans.length} objet${orphans.length > 1 ? "s" : ""} pointe${orphans.length > 1 ? "nt" : ""} vers une catégorie retirée de la configuration — rien n'a été supprimé, choisis une nouvelle catégorie pour chacun.</div>${orphans.map(i => `<div class="row" data-item="${i.id}"><img src="${esc(i.img)}"><b>${esc(i.name)}</b><small>était : <code>${esc(i.system.category || "—")}</code></small><a data-action="itemEdit" class="ms-btn small"><i class="fa-solid fa-pen"></i> Ouvrir</a>${editable && guessCat(i.system.category, all) ? `<a data-action="reassignTo" data-cat="${esc(guessCat(i.system.category, all).id)}" class="ms-btn small ok"><i class="fa-solid fa-wand-magic-sparkles"></i> Ranger dans « ${esc(guessCat(i.system.category, all).name)} »</a>` : ""}${editable ? `<a data-action="reassign" class="ms-btn small"><i class="fa-solid fa-sitemap"></i> Choisir une catégorie</a>` : ""}</div>`).join("")}</div>` : "";
    let body = "";
    if (this.tab === "stats") body = this.#statsHTML(cfg, s, gm, editable, payRes);
    else if (this.tab === "identity") body = this.#identityHTML(cfg, s, editable);
    else if (this.tab === "background") body = this.#bgHTML(editable);
    else if (this.tab === "equipped") body = this.#equippedHTML(cfg, editable);
    else if (this.tab === "gmnotes") body = gm ? `<div class="ms-band" style="--tc:var(--ms-warm)"><i class="fa-solid fa-user-secret"></i><span class="t">Notes MJ</span><span class="sys">SYS::CACHÉ · MJ SEULEMENT</span></div><div class="ms-card">${richEditor("system.gmNotes", s.gmNotes, editable)}</div>` : "";
    else body = this.#itemsHTML(cfg, this.tab, editable);
    const hs = cfg.headerSizes || {}, win = cfg.window || {}; const px = (v, d) => `${Math.max(16, Number(v) || d)}px`;
    const vars = `--rk:${esc(rk?.color || "#38a8ff")};--isz:${Number(cfg.itemIconSize) || 40}px;--hs-res:${px(hs.res, 38)};--hs-ti:${px(hs.title, 34)};--hs-bg:${px(hs.bag, 34)};--hs-aw:${px(hs.awakening, 32)};--hs-f:${(Number(hs.font) || 100) / 100};--ms-zoom:${Math.min(1.6, Math.max(0.6, (Number(win.zoom) || 100) / 100))};--pw:${Math.min(320, Math.max(80, Number(win.portrait) || 150))}px`;
    /* palier de rang (0 = bas de l'échelle … 4 = sommet) et palier de niveau (tous les 10 niveaux, 0 … 6) : la fiche change d'habit avec eux */
    const ri = Math.max(0, cfg.ranks.findIndex(r => r.key === s.rank)); const rTier = cfg.ranks.length > 1 ? Math.round(ri / (cfg.ranks.length - 1) * 4) : 0;
    const lTier = Math.min(6, Math.floor((Number(s.level) || 0) / 10));
    const rPow = rankPower(cfg, s.rank);
    const qa = show("qa") && featureOn(cfg, "favorites") && this.tab !== "background" ? this.#qaHTML(cfg) : { top: "", side: "" };
    const hideCls = ["lv", "aw", "sp", "or", "cl", "res", "ti", "bag", "slots", "menu"].filter(k => !show(k)).map(k => ` hide-${k}`).join("");
    return `<div class="ms-wrap${hideCls}${this.tab === "background" ? " bgm" : ""} portrait-${cfg.portraitShape || "rect"}${cfg.rankTintsSheet !== false ? " rank-tint" : ""}${npc ? " npc" : ""} rk-t${rTier} lv-t${lTier} rk-pow${rPow} sz-${esc(cfg.uiSize || "m")}" data-rank="${esc(s.rank)}" style="${vars}">${header}${nav}${qa.top}<div class="ms-mid${qa.side ? " qa-side-on" : ""}"><section class="ms-body">${orphanBox}${body}</section>${qa.side}</div></div>`;
  }
  _replaceHTML(result, content) {
    /* 1.53 : on garde la position de défilement de chaque zone (boutons + / − des quantités, cases…) */
    const keep = []; const pathOf = e => { const p = []; while (e && e !== content) { p.unshift(Array.prototype.indexOf.call(e.parentElement.children, e)); e = e.parentElement; } return p; };
    for (const e of content.querySelectorAll("*")) if (e.scrollTop > 0 || e.scrollLeft > 0) keep.push([pathOf(e), e.scrollTop, e.scrollLeft]);
    const top0 = content.scrollTop;
    content.innerHTML = result;
    for (const [p, t, l] of keep) { let e = content; for (const i of p) { e = e?.children?.[i]; if (!e) break; } if (e) { e.scrollTop = t; e.scrollLeft = l; } }
    if (top0) content.scrollTop = top0;
    { const th = this.actor.getFlag(SYS, "sheetTheme"); if (th && THEMES[th]) this.element.dataset.msTheme = th; else delete this.element.dataset.msTheme; }
    /* 1.58 : livre (flèches du clavier), accès rapide (clic droit = ouvrir, molette = défiler la ligne) */
    if (!this.element.dataset.bkb) { this.element.dataset.bkb = "1";
      /* 1.58.8 : la disquette de l'éditeur rapide enregistre ET ramène au livre (un seul clic) */
      this.element.addEventListener("click", ev => { const b = ev.target.closest?.('.bk-erich prose-mirror button[data-action="save"]'); if (!b) return; this.#bkCommit(); if (!b.closest(".bk-qedit")) return; this._bkAfterSave = true; clearTimeout(this._bkAsT); this._bkAsT = setTimeout(() => { if (this._bkAfterSave && this.bookQuick) this.render(); }, 900); }, true);
      this.element.addEventListener("dblclick", ev => { const c = ev.target.closest?.(".bk[tabindex] .bk-ch"); if (!c || !this.isEditable) return; ev.preventDefault(); this.#openEditor(c.dataset.ch); });
      /* 1.58.8 : dans l'éditeur, titre / icône / couleur attendent l'enregistrement (sinon la fiche se redessinait et le texte en cours était perdu → il fallait cliquer deux fois) */
      this.element.addEventListener("change", ev => { const c = ev.target.closest?.("[data-bkset]"); if (!c) return; ev.stopPropagation(); if (c.closest(".bk-ecur")?.querySelector("prose-mirror")) { if (c.type === "radio") c.closest(".bk-icons")?.querySelectorAll("input").forEach(x => { x.checked = x === c; x.parentElement.classList.toggle("on", x === c); }); (this._bkPend ||= {})[c.dataset.bkset] = c.value; return; } this.actor.update({ [c.dataset.bkset]: c.value }); }, true);
      this.element.addEventListener("keydown", ev => { if (!ev.target.closest?.(".bk[tabindex]") || ev.target.closest("input, textarea, select, [contenteditable], prose-mirror") || !this._bk) return;
        const m = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 }[ev.key]; if (m) { ev.preventDefault(); this.#bookTurn((this.bookPg || 0) + m); } else if (ev.key === "Home") { ev.preventDefault(); this.#bookTurn(0); } else if (ev.key === "End") { ev.preventDefault(); this.#bookTurn(this._bk.spreads - 1); } });
      this.element.addEventListener("contextmenu", ev => { const q = ev.target.closest?.(".qa-i"); if (!q) return; ev.preventDefault(); ev.stopPropagation(); const it = this.actor.items.get(q.dataset.item); if (it) { qaTouch(this.actor, it.id); it.sheet.render(true); } });
      this.element.addEventListener("wheel", ev => { const r = ev.target.closest?.(".qa-bar .qa-row, .qa-smart .qa-row, .qa-pills .qa-row, .qa-drawer"); if (r && Math.abs(ev.deltaY) > Math.abs(ev.deltaX) && r.scrollWidth > r.clientWidth + 2) { r.scrollLeft += ev.deltaY; ev.preventDefault(); } }, { passive: false }); }
    this.#bgBind();
    if (!this.element.dataset.relb) { this.element.dataset.relb = "1"; this.element.addEventListener("change", ev => relInput(ev, this.actor), true); }
    /* 1.46 : nom de sac trop long → il défile au survol */
    if (!this.element.dataset.mqb) { this.element.dataset.mqb = "1"; this.element.addEventListener("mouseover", ev => { const m = ev.target.closest?.(".mq"); if (!m || m.dataset.mqOn) return; const inn = m.firstElementChild; const d = inn.scrollWidth - m.clientWidth; if (d <= 2) return; m.dataset.mqOn = "1"; m.style.setProperty("--mq-d", `-${d + 6}px`); m.style.setProperty("--mq-t", `${Math.max(2, (d + 6) / 40)}s`); m.classList.add("go"); m.addEventListener("mouseleave", () => { m.classList.remove("go"); delete m.dataset.mqOn; }, { once: true }); }); }
    /* 1.46 : rang, éveil, niveau et constellation s'ouvrent dans le wiki (au lieu de la liste déroulante / du champ) */
    if (!this.element.dataset.wkb) { this.element.dataset.wkb = "1"; const zone = t => t.closest?.(".ms-head .ms-rankbox, .ms-head .ms-chip.aw, .ms-head .ms-lvchip, .ms-head .ms-chip.sp");
      const kindOf = z => z.classList.contains("ms-rankbox") ? "rk" : z.classList.contains("aw") ? "aw" : z.classList.contains("ms-lvchip") ? "lv" : "cst";
      this.element.addEventListener("mousedown", ev => { if (ev.button === 0 && zone(ev.target)) ev.preventDefault(); }, true);
      this.element.addEventListener("click", ev => { const z = zone(ev.target); if (!z) return; ev.preventDefault(); ev.stopPropagation(); openWiki(this.actor, kindOf(z)); }, true);
      this.element.addEventListener("keydown", ev => { const z = zone(ev.target); if (!z || !["Enter", " ", "ArrowDown", "ArrowUp"].includes(ev.key)) return; ev.preventDefault(); openWiki(this.actor, kindOf(z)); }, true); }
    { const w = content.querySelector(".ms-wrap"); const el = this.element; if (w && el) { for (let k = 0; k <= 5; k++) el.classList.toggle(`rk-pow${k}`, w.classList.contains(`rk-pow${k}`)); el.style.setProperty("--rk", w.style.getPropertyValue("--rk")); } }
    content.querySelectorAll("[data-search]").forEach(inp => { let t; inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { this.search[inp.dataset.search] = inp.value; this._focusSearch = inp.dataset.search; this.render(); }, 250); }); });
    content.querySelectorAll("[data-sort]").forEach(sel => sel.addEventListener("change", () => { this.sort[sel.dataset.sort] = sel.value; this.render(); }));
    /* glisser un objet de la fiche : vers la barre des Objets (copie dans le monde), le Catalogue, une autre fiche… */
    content.querySelectorAll("[data-item]").forEach(el => { const it = this.actor.items.get(el.dataset.item); if (!it) return; el.draggable = true; el.classList.add("ms-drag");
      el.addEventListener("dragstart", ev => { if (ev.target instanceof HTMLElement && ev.target.matches("input, select, textarea")) return; ev.stopPropagation(); ev.dataTransfer.setData("text/plain", JSON.stringify(it.toDragData())); ev.dataTransfer.effectAllowed = "copyMove"; }); });
    if (this._gp) for (const k of Object.keys(this._gp)) this.#gPaint(k);
    if (this._focusSearch) { const inp = content.querySelector(`[data-search="${this._focusSearch}"]`); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } this._focusSearch = null; } }

  #statsHTML(cfg, s, gm, editable, payRes) {
    const p = cfg.progression; const paid = p.paidStats; const total = s.statsTotal || 0; const dice = featureOn(cfg, "dice"); const { bonus } = effectiveStats(cfg, this.actor); const lockAll = lockedFor(cfg, "stats");
    const cards = cfg.stats.map(st => {
      const v = Number(s.stats[st.key]) || st.min || 0; const locked = st.locked && !s.statsUnlocked?.[st.key]; const bn = bonus[st.key] || 0;
      const capped = (p.capPerStat && v >= p.capPerStat) || (st.max && v >= st.max) || (p.capTotal && total >= p.capTotal);
      const cost = paid ? costOfStep(cfg, v, st) : 0; const funds = Number(s.resources[payRes?.key]) || 0; const broke = paid && !gm && cost > funds;
      const tier = p.tierEvery ? p.tierNames[Math.min(p.tierNames.length - 1, Math.floor((v - 1) / p.tierEvery))] : "";
      return `<div class="ms-stat mode-${cfg.statColorMode}${locked ? " locked" : ""}${capped ? " capped" : ""}" style="--sc:${esc(st.color)}" data-stat="${st.key}">
        <div class="ms-stat-h">${dice ? `<a data-action="rollStat" class="roll" title="Lancer ${esc(st.name)}"><i class="fa-solid ${esc(st.icon)}"></i></a>` : `<i class="fa-solid ${esc(st.icon)}"></i>`}<span>${esc(st.name)}</span><small>${esc(st.abbr)}</small>${tier ? `<em class="tier">${esc(tier)}</em>` : ""}${bn ? `<b class="bonus${bn < 0 ? " neg" : ""}" title="Bonus des objets">${bn > 0 ? "+" : ""}${num(bn)}</b>` : ""}</div>
        <i class="ms-stat-wm fa-solid ${esc(st.icon)}"></i>
        <div class="ms-stat-v">
          <button type="button" class="ms-pm" data-action="statMinus" ${!editable || lockAll || locked || v <= (st.min ?? 0) || (!gm && !game.settings.get(SYS, "playersCanLower")) ? "disabled" : ""} title="${paid && p.refundOnLower ? `Rembourse ${fmt(costOfStep(cfg, v - 1, st))} ${esc(payRes?.name || "")}` : "Baisser"}"><i class="fa-solid fa-minus"></i></button>
          <input type="number" name="system.stats.${st.key}" value="${v}" ${gm && editable ? "" : "readonly"}>
          <button type="button" class="ms-pm plus${broke ? " broke" : ""}" data-action="statPlus" ${!editable || lockAll || locked || capped ? "disabled" : ""} title="${locked ? esc(p.messages.locked) : capped ? esc(p.messages.cap) : paid ? `Point suivant : ${fmt(cost)} ${esc(payRes?.name || "")}` : "Augmenter"}"><i class="fa-solid fa-plus"></i></button>
        </div>
        ${paid && !locked && !capped ? `<div class="ms-stat-cost">${fmt(cost)} <i class="fa-solid ${esc(payRes?.icon || "fa-coins")}"></i></div>` : ""}
        ${locked ? `<div class="ms-stat-lock"><i class="fa-solid fa-lock"></i> SCELLÉ${gm ? ` <a data-action="unlockStat" title="Desceller pour ce personnage">desceller</a>` : ""}</div>` : ""}
      </div>`;
    }).join("");
    const sband = `<div class="ms-band" style="--tc:var(--ms-acc)"><i class="fa-solid fa-chart-simple"></i><span class="t">Statistiques</span><span class="n">${cfg.stats.length}</span><span class="sys">SYS::STATUT · ATTRIBUTS</span></div>`;
    const bar = cfg.statsTotalBar || "center"; const scols = Number(cfg.statsCols) || 0; const scls = scols ? ` cols cols-${scols}" style="--cols:${scols}` : ""; if (bar === "hidden") return `${sband}<div class="ms-stats${scls}">${cards}</div>`;
    const pctTot = p.capTotal ? Math.min(100, Math.round(total / p.capTotal * 100)) : 0; const avg = cfg.stats.length ? Math.round(total / cfg.stats.length * 10) / 10 : 0;
    return `${sband}<div class="ms-stats${scls}">${cards}</div><div class="ms-stats-foot pos-${bar}" style="--p:${pctTot}%">
      <span class="tot"><i class="fa-solid fa-chart-simple"></i><small>Total des points</small><b>${total}</b>${p.capTotal ? `<em>/ ${p.capTotal}</em>` : ""}</span>
      ${cfg.statsAverage ? `<span class="avg"><small>Moyenne</small><b>${avg}</b></span>` : ""}
      ${p.capTotal ? `<span class="capbar"><i></i></span>` : ""}
      ${paid ? `<span class="pay"><small>Payé en</small><b style="color:${esc(payRes?.color || "#fff")}">${esc(payRes?.name || "")}</b><em>${fmt(s.resources[payRes?.key] || 0)} dispo.</em></span>` : ""}</div>`;
  }
  #identityHTML(cfg, s, editable) {
    const cur = this.sub.identity || cfg.identity[0]?.key; const sec = cfg.identity.find(x => x.key === cur) || cfg.identity[0]; if (!sec) return `<div class="ms-empty">Aucune section d'identité configurée.</div>`;
    const nav = `<nav class="ms-subtabs">${cfg.identity.map((x, i) => `<a data-action="sub" data-group="identity" data-sub="${x.key}" class="${x.key === sec.key ? "on" : ""}">${i + 1}. ${esc(x.name)}</a>`).join("")}</nav>`;
    const val = f => s.identity?.[sec.key]?.[f.key] ?? "";
    const fields = sec.fields.filter(f => !(sec.key === "personal" && (f.key === "personal" || f.key === "background"))).map(f => { const n = `system.identity.${sec.key}.${f.key}`; const v = val(f);
      if (f.kind === "rich") return `<div class="ms-f wide"><span>${esc(f.label)}</span>${richEditor(n, v, editable)}</div>`;
      if (f.kind === "number") return `<label class="ms-f"><span>${esc(f.label)}</span><input type="number" name="${n}" value="${esc(v)}"></label>`;
      if (f.kind === "select") return `<label class="ms-f"><span>${esc(f.label)}</span><select name="${n}"><option value="">—</option>${(f.options || []).map(o => `<option${o === v ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
      return `<label class="ms-f"><span>${esc(f.label)}</span><input type="text" name="${n}" value="${esc(v)}" placeholder="${esc(f.label)}…"></label>`; }).join("");
    return `<div class="ms-band" style="--tc:var(--ms-acc2)"><i class="fa-solid fa-id-card"></i><span class="t">Identité</span><span class="n">${cfg.identity.length}</span><span class="sys">SYS::PROFIL · ${esc(sec.name.toUpperCase())}</span></div>${nav}<div class="ms-card"><div class="ms-grid2">${fields}</div></div>`;
  }
  #itemsHTML(cfg, rootId, editable) {
    const root = cfg.items.find(r => r.id === rootId); if (!root) return "";
    const nodes = flattenTree([root]); const leaves = nodes.filter(n => !n.children?.length);
    const items = this.actor.items.filter(i => nodes.some(n => n.id === i.system.category));
    const subs = root.children?.length ? `<nav class="ms-subtabs" style="--tc:${esc(root.color || "var(--ms-acc)")}">${[{ id: "", name: "Tout", icon: root.icon }, ...root.children].map((c, k, arr) => { const sh = c.id ? shade(root.color || "#38a8ff", k - 1, arr.length - 1) : { tc: root.color || "var(--ms-acc)", ic: root.color || "var(--ms-acc)" }; const n = c.id ? (() => { const ids = new Set(flattenTree([c]).map(x => x.id)); return items.filter(i => ids.has(i.system.category)).length; })() : items.length; return `<a data-action="sub" data-group="${root.id}" data-sub="${c.id}" class="${(this.sub[root.id] || "") === c.id ? "on" : ""}${n ? "" : " empty"}" style="--tc:${sh.tc};--ic:${sh.ic}">${iconOf(c) ? `<i class="fa-solid ${esc(iconOf(c))}"></i>` : ""}${esc(c.name)}${n ? `<b class="ms-tcnt" title="${n} objet${n > 1 ? "s" : ""}">${n}</b>` : ""}</a>`; }).join("")}</nav>` : "";
    const curSub = this.sub[root.id] || ""; const subNodes = curSub ? flattenTree([root.children.find(c => c.id === curSub)]) : nodes;
    let shown = items.filter(i => subNodes.some(n => n.id === i.system.category)).sort((a, b) => a.name.localeCompare(b.name));
    const q = (this.search[root.id] || "").toLowerCase(); const sortBy = this.sort[root.id] || "name";
    if (q) shown = shown.filter(i => i.name.toLowerCase().includes(q) || String(i.system.description || "").toLowerCase().includes(q));
    const rankIdx = k => cfg.ranks.findIndex(r => r.key === k), rarIdx = k => cfg.rarities.findIndex(r => r.key === k);
    if (sortBy === "rank") shown.sort((a, b) => rankIdx(b.system.rank) - rankIdx(a.system.rank) || a.name.localeCompare(b.name)); else if (sortBy === "rarity") shown.sort((a, b) => rarIdx(b.system.rarity) - rarIdx(a.system.rarity) || a.name.localeCompare(b.name)); else if (sortBy === "value") shown.sort((a, b) => (b.system.value || 0) - (a.system.value || 0)); else if (sortBy === "level") shown.sort((a, b) => (b.system.level || 0) - (a.system.level || 0));
    const fields = fieldsOf(cfg, curSub || root.id).filter(f => !ITEM_FIELDS[f]?.hidden && f !== "lore" && f !== "equippable" && f !== "formula" && f !== "stats" && (!ITEM_FIELDS[f]?.feature || featureOn(cfg, ITEM_FIELDS[f].feature)));
    /* colonne « Bonus de stats » seulement si un objet de la liste en a d'actifs */
    if (featureOn(cfg, "itemStats") && shown.some(i => bonusActive(i))) fields.push("stats");
    const dice = featureOn(cfg, "dice"), favs = featureOn(cfg, "favorites"); const favIds = this.actor.system.favorites || []; const titleIds = equippedTitles(this.actor);
    const cols = fields.map(f => `<th class="c-${f}">${esc(ITEM_FIELDS[f]?.label || f)}</th>`).join("");
    const rows = shown.map(i => { const r = rankOf(cfg, i.system.rank); const rar = cfg.rarities.find(x => x.key === i.system.rarity); const node = nodes.find(n => n.id === i.system.category);
      const cells = fields.map(f => { const v = i.system[f]; let t = esc(v ?? "");
        if (f === "rank") t = `<span class="ms-rank" style="--rc:${esc(r?.color || "#fff")}">${esc(r?.name || v || "—")}</span>`;
        else if (f === "rarity") t = `<span class="ms-rar" style="--rc:${esc(rar?.color || "#8ea0c8")}">${esc(rar?.name || v || "—")}</span>`;
        else if (f === "quantity") t = `<span class="ms-qty"><a data-action="itemQty" data-d="-1"><i class="fa-solid fa-minus"></i></a><b>${Number(v) || 0}</b><a data-action="itemQty" data-d="1"><i class="fa-solid fa-plus"></i></a></span>`;
        else if (f === "value") { const coin = goldResource(cfg); t = `<span class="ms-val" style="--c:${esc(coin?.color || "#ffd070")}"><i class="fa-solid ${esc(coin?.icon || "fa-coins")}"></i>${fmt(v)}</span>`; }
        else if (f === "level") t = `<span class="ms-lvl" style="--lc:${levelColor(v)}"><small>NIV</small>${Number(v) || 0}</span>`;
        else if (f === "description") t = descCell(v, cfg.descriptions);
        else if (f === "stats") t = (bonusActive(i) && bonusTags(cfg, i)) || "—";
        else if (ITEM_FIELDS[f]?.kind === "list") t = esc((cfg[ITEM_FIELDS[f].list] || []).find(x => x.key === v)?.name || v || "—");
        return `<td class="c-${f}">${t}</td>`; }).join("");
      const isTitle = root.id === "title" || root.id === "titles";
      const eq = isTitle ? `<a data-action="equipTitle" class="eq${titleIds.includes(i.id) ? " on" : ""}" title="${titleIds.includes(i.id) ? "Retirer ce titre" : "Équiper ce titre"}"><i class="fa-solid fa-crown"></i></a>` : (cfg.equipment.enabled && canEquip(cfg, i.system.category) ? `<a data-action="itemEquip" class="eq${i.system.equipped ? " on" : ""}" title="${i.system.equipped ? "Équipé sur soi — cliquer pour déséquiper (reste dans l'inventaire)" : "Équiper sur soi (reste dans l'inventaire)"}"><i class="fa-solid fa-user-shield"></i></a>` : "");
      const rollBtn = dice && i.system.formula ? `<a data-action="rollItem" class="rl" title="Lancer ${esc(i.system.formula)}"><i class="fa-solid fa-dice"></i></a>` : "";
      const favBtn = favs ? `<a data-action="fav" class="fv${favIds.includes(i.id) ? " on" : ""}" title="${favIds.includes(i.id) ? "Retirer de l'accès rapide" : "Épingler en accès rapide"}"><i class="fa-solid fa-star"></i></a>` : "";
      const rp = rarityPower(cfg, i.system.rarity); const rarC = cfg.rarities.find(x => x.key === i.system.rarity)?.color || "#fff";
      return `<tr data-item="${i.id}" class="${i.system.fx ? "fx-" + esc(i.system.fx) : ""}${favIds.includes(i.id) ? " fav" : ""}${rp ? ` rar-pow rar-pow${rp}` : ""}" style="--rarc:${esc(rarC)}"><td class="c-name"><span class="ms-thumb" data-action="itemEdit"><img src="${esc(i.img)}" style="${portraitStyle(i.system.imgPos || imgDefaults(cfg, i.system.category).pos)}"></span><div class="nm"><a data-action="itemEdit"><b>${esc(i.name)}</b></a>${ammoOn(cfg, i) ? `<span class="ms-ammo${Number(i.system.ammo?.max) && !Number(i.system.ammo?.value) ? " empty" : ""}" title="Munitions"><a data-action="itemAmmo" data-d="-1" title="Tirer (−1)"><i class="fa-solid fa-minus"></i></a><b>${ammoTxt(i)}</b><a data-action="itemAmmo" data-d="1" title="+1 (Maj : recharger)"><i class="fa-solid fa-plus"></i></a></span>` : ""}${catTags(cfg, i.system.category)}</div></td>${cells}<td class="c-act">${favBtn}${rollBtn}${eq}<a data-action="itemEdit" class="ed" title="Modifier"><i class="fa-solid fa-pen"></i></a>${editable ? `<a data-action="itemDelete" class="danger" title="Supprimer"><i class="fa-solid fa-trash"></i></a>` : ""}</td></tr>`; }).join("");
    const creates = `<div class="ms-create"><a data-action="itemCreate" data-root="${root.id}" data-sub="${curSub}" class="ms-btn new" style="--tc:${esc(root.color || "var(--ms-acc)")}"><i class="fa-solid fa-plus"></i> Nouveau · ${esc(curSub ? root.children.find(c => c.id === curSub)?.name || root.name : root.name)}</a><span class="hint">choisis la catégorie, les champs suivent</span></div>`;
    const sortOpts = [["name", "Nom"], ["rank", "Rang"], ["rarity", "Rareté"], ["value", "Valeur"], ...(fields.includes("level") ? [["level", "Niveau"]] : [])];
    const tools = `<div class="ms-tools"><label class="ms-search"><i class="fa-solid fa-magnifying-glass"></i><input type="text" data-search="${root.id}" value="${esc(this.search[root.id] || "")}" placeholder="Rechercher…"></label><label class="ms-sort"><span>Trier</span><select data-sort="${root.id}">${sortOpts.map(o => `<option value="${o[0]}"${o[0] === sortBy ? " selected" : ""}>${o[1]}</option>`).join("")}</select></label><span class="ms-count">${shown.length} / ${items.length}</span></div>`;
    const band = `<div class="ms-band" style="--tc:${esc(root.color || "var(--ms-acc)")}"><i class="fa-solid ${esc(root.icon)}"></i><span class="t">${esc(root.name)}</span><span class="n">${items.length}</span><span class="sys">SYS::INVENTAIRE · ${esc(root.name.toUpperCase())}</span></div>`;
    const favList = favs ? items.filter(i => favIds.includes(i.id)) : [];
    const favStrip = favList.length ? `<div class="ms-favs" style="--tc:${esc(root.color || "var(--ms-acc)")}"><span class="lb"><i class="fa-solid fa-star"></i> Accès rapide</span>${favList.map(i => { const r = rankOf(cfg, i.system.rank); return `<div class="ms-favchip" data-item="${i.id}" style="--rc:${esc(r?.color || "#fff")}"><img src="${esc(i.img)}" data-action="itemEdit"><a data-action="itemEdit" class="nm"><b>${esc(i.name)}</b><small>${esc(r?.name || "")}${i.system.quantity > 1 ? ` · ×${i.system.quantity}` : ""}</small></a>${dice && i.system.formula ? `<a data-action="rollItem" class="rl" title="Lancer"><i class="fa-solid fa-dice"></i></a>` : ""}${cfg.equipment.enabled && canEquip(cfg, i.system.category) ? `<a data-action="itemEquip" class="eq${i.system.equipped ? " on" : ""}" title="Équiper / déséquiper"><i class="fa-solid fa-user-shield"></i></a>` : ""}<a data-action="fav" class="fv on" title="Retirer"><i class="fa-solid fa-xmark"></i></a></div>`; }).join("")}</div>` : "";
    return `${band}${subs}${tools}<div class="ms-card ms-table" style="--tc:${esc(root.color || "var(--ms-acc)")}"><table><thead><tr><th class="c-name">Nom</th>${cols}<th class="c-act"></th></tr></thead><tbody>${rows || `<tr><td colspan="${fields.length + 2}" class="ms-empty">Rien ici pour l'instant.</td></tr>`}</tbody></table>${editable ? creates : ""}</div>`;
  }
  #equippedHTML(cfg, editable) {
    const all = this.actor.items.filter(i => i.system.equipped); const nodes = flattenTree(cfg.items);
    const rootsWith = cfg.items.filter(r => all.some(i => rootOf(cfg, i.system.category)?.id === r.id));
    const f = this.sub.equipped || ""; const eq = f ? all.filter(i => rootOf(cfg, i.system.category)?.id === f) : all;
    const grouped = this.eqGroup !== false && !f; const groups = grouped ? rootsWith.map(r => [r, all.filter(i => rootOf(cfg, i.system.category)?.id === r.id)]) : [[null, eq]];
    const card = i => { const r = rankOf(cfg, i.system.rank); const rar = cfg.rarities.find(x => x.key === i.system.rarity); const root = rootOf(cfg, i.system.category); const path = pathOf(cfg, i.system.category).slice(1).map(n => n.name).join(" › ");
      const rp = rarityPower(cfg, i.system.rarity); const rarC = cfg.rarities.find(x => x.key === i.system.rarity)?.color || "#fff";
      return `<div class="ms-eq ${i.system.fx ? "fx-" + esc(i.system.fx) : ""}${rp ? ` rar-pow rar-pow${rp}` : ""}" data-item="${i.id}" style="--rarc:${esc(rarC)};--rc:${esc(r?.color || "#fff")};--tc:${esc(root?.color || "var(--ms-acc)")}"><div class="ms-eq-img"><span class="ms-thumb"><img src="${esc(i.img)}" style="${portraitStyle(i.system.imgPos || imgDefaults(cfg, i.system.category).pos)}"></span><span class="ms-rank">${esc(r?.name || "")}</span></div><div class="ms-eq-body"><a data-action="itemEdit" class="c-name"><b>${esc(i.name)}</b></a>${ammoOn(cfg, i) ? `<span class="ms-ammo${Number(i.system.ammo?.max) && !Number(i.system.ammo?.value) ? " empty" : ""}" title="Munitions"><a data-action="itemAmmo" data-d="-1" title="Tirer (−1)"><i class="fa-solid fa-minus"></i></a><b>${ammoTxt(i)}</b><a data-action="itemAmmo" data-d="1" title="+1 (Maj : recharger)"><i class="fa-solid fa-plus"></i></a></span>` : ""}${catTags(cfg, i.system.category, { cls: "small" })}<div class="meta"><span class="ms-rar" style="--rc:${esc(rar?.color || "#8ea6d8")}">${esc(rar?.name || "")}</span>${fieldsOf(cfg, i.system.category).includes("level") ? `<span class="ms-lvl" style="--lc:${levelColor(i.system.level)}"><small>NIV</small>${Number(i.system.level) || 0}</span>` : ""}${Number(i.system.slotCost) !== 1 && i.system.slotCost !== undefined ? `<em class="slotc" title="Places occupées">${fmtSlots(i.system.slotCost)} pl.</em>` : ""}${i.system.quantity > 1 ? `<em class="qty">×${i.system.quantity}</em>` : ""}${featureOn(cfg, "itemStats") && bonusActive(i) ? bonusTags(cfg, i) : ""}</div></div><a data-action="itemEquip" class="eq on" title="Déséquiper (reste dans l'inventaire)"><i class="fa-solid fa-user-shield"></i></a></div>`; };
    const max = this.slotMax(cfg); const eqB = equippedBags(this.actor); const used = slotsUsed(this.actor);
    const filters = `<nav class="ms-subtabs"><a data-action="sub" data-group="equipped" data-sub="" class="${f ? "" : "on"}">Tout</a>${rootsWith.map(r => `<a data-action="sub" data-group="equipped" data-sub="${r.id}" class="${f === r.id ? "on" : ""}" style="--tc:${esc(r.color || "")}"><i class="fa-solid ${esc(r.icon)}"></i>${esc(r.name)}</a>`).join("")}<a data-action="eqGroup" class="alt ${grouped ? "on" : ""}" title="Grouper par catégorie"><i class="fa-solid fa-layer-group"></i></a></nav>`;
    const body = groups.map(([r, list]) => `${r ? `<div class="ms-eqhead" style="--tc:${esc(r.color || "")}"><i class="fa-solid ${esc(r.icon)}"></i> ${esc(r.name)} <small>${list.length}</small></div>` : ""}<div class="ms-eqgrid">${list.map(card).join("") || `<div class="ms-empty">Rien ici.</div>`}</div>`).join("");
    return `<div class="ms-eqbar"><span class="big"><i class="fa-solid fa-user-shield"></i> Sur soi</span><span class="slots"><b>${fmtSlots(used)}</b> / ${max ? fmtSlots(max) : "∞"} places <small>(${all.length} objet${all.length > 1 ? "s" : ""})</small>${eqB.length ? ` · ${eqB.length > 1 ? "sacs" : "sac"} ${eqB.map(b => `<b>${esc(b.name)}</b>${b.system.slots ? ` +${b.system.slots}` : ""}`).join(", ")}` : ""}</span></div>${filters}${all.length ? body : `<div class="ms-card"><div class="ms-empty">Rien d'équipé pour l'instant. Utilise le bouclier à côté d'un objet de l'inventaire : il y reste et apparaît aussi ici.</div></div>`}`;
  }

  /* ───────── 1.58 : ACCÈS RAPIDE (toutes catégories) — A barre, B pastilles + tiroir, C colonne latérale, E intelligent ───────── */
  /* 1.58.3 : repliable dans tous les modes (une fine barre « Accès rapide · N » à déplier) */
  #qaHTML(cfg) { const r = this.#qaBuild(cfg); if (qaMode() === "side" || !r.top) return r;
    const n = (r.top.match(/class="qa-i"/g) || []).length;
    if (qaFolded()) return { top: `<div class="ms-qa qa-folded"><a class="qa-lb" data-action="qaFold" data-tooltip="Déplier l'accès rapide"><i class="fa-solid fa-bolt"></i><b>Accès rapide</b>${n ? `<em>${n}</em>` : ""}</a><a class="qa-foldbtn" data-action="qaFold" data-tooltip="Déplier"><i class="fa-solid fa-chevron-down"></i></a></div>`, side: "" };
    return { top: r.top.replace('<span class="qa-modes">', '<a class="qa-foldbtn" data-action="qaFold" data-tooltip="Replier l\'accès rapide"><i class="fa-solid fa-chevron-up"></i></a><span class="qa-modes">'), side: "" }; }
  #qaBuild(cfg) {
    const a = this.actor; const mode = qaMode(); const favIds = a.system.favorites || [];
    const fav = favIds.map(id => a.items.get(id)).filter(Boolean);
    const icon = i => { const r = rankOf(cfg, i.system.rank); const root = rootOf(cfg, i.system.category); const rar = cfg.rarities.find(x => x.key === i.system.rarity); const q = Number(i.system.quantity) || 0;
      const d = String(i.system.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const tip = `<div class="ms-qatip" style="--rc:${esc(r?.color || "#9fb0d4")}"><b>${esc(i.name)}</b><small>${esc(pathOf(cfg, i.system.category).map(n => n.name).join(" › "))}</small><span>${r ? `Rang <em style="color:${esc(r.color)}">${esc(r.name)}</em>` : ""}${rar ? ` · <em style="color:${esc(rar.color)}">${esc(rar.name)}</em>` : ""}${q > 1 ? ` · ×${q}` : ""}${i.system.equipped ? " · équipé" : ""}</span>${d ? `<p>${esc(d.length > 170 ? `${d.slice(0, 170)}…` : d)}</p>` : ""}<i>${featureOn(cfg, "dice") && i.system.formula ? `Clic : lancer ${esc(i.system.formula)}` : "Clic : ouvrir"} · clic droit : ouvrir${favIds.includes(i.id) ? " · Maj+clic : désépingler" : ""}</i></div>`;
      return `<a class="qa-i" data-item="${i.id}" data-action="qaUse" style="--rc:${esc(r?.color || "#9fb0d4")};--tc:${esc(root?.color || "#7fd6ff")}" data-tooltip-html="${esc(tip)}" data-tooltip-direction="DOWN"><img src="${esc(i.img)}">${r ? `<span class="qa-rb">${rankBadge(r, { size: "sm" })}</span>` : ""}${q > 1 ? `<em class="qa-q">×${q > 999 ? "999+" : q}</em>` : ""}${featureOn(cfg, "dice") && i.system.formula ? `<i class="qa-d fa-solid fa-dice"></i>` : ""}</a>`; };
    const modes = `<span class="qa-modes">${QA_MODES.map(([k, ic, n]) => `<a data-action="qaMode" data-m="${k}" class="${k === mode ? "on" : ""}" data-tooltip="${esc(n)}"><i class="fa-solid ${ic}"></i></a>`).join("")}</span>`;
    const lb = n => `<span class="qa-lb"><i class="fa-solid fa-bolt"></i><b>Accès rapide</b>${n ? `<em>${n}</em>` : ""}</span>`;
    if (mode === "smart") {
      const seen = new Set(); const take = l => l.filter(i => i && !seen.has(i.id) && seen.add(i.id));
      const G = [["Épinglés", "fa-star", "#ffc63d", take(fav)], ["Récents", "fa-clock-rotate-left", "#38e0ff", take(qaRecent(a).map(id => a.items.get(id)))], ["Équipés", "fa-user-shield", "#3ddc84", take(a.items.filter(i => i.system.equipped))]].filter(g => g[3].length);
      if (!G.length) return { top: `<div class="ms-qa qa-smart qa-empty">${lb(0)}<span class="qa-hint">Épingle des objets avec <i class="fa-solid fa-star"></i>, utilise-en ou équipe-en : ils apparaîtront ici.</span>${modes}</div>`, side: "" };
      return { top: `<div class="ms-qa qa-smart">${lb(seen.size)}<div class="qa-row">${G.map(([n, ic, c, l]) => `<span class="qa-sep" style="--gc:${c}" data-tooltip="${n}"><i class="fa-solid ${ic}"></i></span>${l.map(icon).join("")}`).join("")}</div>${modes}</div>`, side: "" };
    }
    if (!fav.length) return { top: `<div class="ms-qa qa-empty">${lb(0)}<span class="qa-hint">Épingle des objets avec <i class="fa-solid fa-star"></i> dans leurs onglets pour les retrouver ici, quel que soit l'onglet ouvert.</span>${modes}</div>`, side: "" };
    if (mode === "pills") {
      const roots = cfg.items.map(r => [r, fav.filter(i => rootOf(cfg, i.system.category)?.id === r.id)]).filter(x => x[1].length);
      if (!roots.some(([r]) => r.id === this.qaCat)) this.qaCat = this.qaCat === "" ? "" : null;
      const cur = roots.find(([r]) => r.id === this.qaCat);
      return { top: `<div class="ms-qa qa-pills">${lb(fav.length)}<div class="qa-row">${roots.map(([r, l]) => `<a class="qa-pill${cur?.[0].id === r.id ? " on" : ""}" data-action="qaCat" data-c="${r.id}" style="--tc:${esc(r.color || "#7fd6ff")}"><i class="fa-solid ${esc(r.icon)}"></i><span>${esc(r.name)}</span><b>${l.length}</b></a>`).join("")}</div>${modes}${cur ? `<div class="qa-drawer" style="--tc:${esc(cur[0].color || "#7fd6ff")}">${cur[1].map(icon).join("")}</div>` : ""}</div>`, side: "" };
    }
    if (mode === "side") {
      const folded = qaFolded(); const roots = cfg.items.map(r => [r, fav.filter(i => rootOf(cfg, i.system.category)?.id === r.id)]).filter(x => x[1].length);
      return { top: "", side: `<aside class="ms-qa qa-side${folded ? " fold" : ""}"><a class="qa-fold" data-action="qaFold" data-tooltip="${folded ? "Déplier l'accès rapide" : "Replier l'accès rapide"}"><i class="fa-solid fa-bolt"></i><em>${fav.length}</em><i class="fa-solid ${folded ? "fa-chevron-left" : "fa-chevron-right"} ar"></i></a>${folded ? "" : `<div class="qa-col">${roots.map(([r, l]) => `<span class="qa-sep" style="--gc:${esc(r.color || "#7fd6ff")}" data-tooltip="${esc(r.name)}"><i class="fa-solid ${esc(r.icon)}"></i></span>${l.map(icon).join("")}`).join("")}</div>${modes}`}</aside>` };
    }
    return { top: `<div class="ms-qa qa-bar">${lb(fav.length)}<div class="qa-row">${fav.map(icon).join("")}</div>${modes}</div>`, side: "" };
  }

  /* ───────── 1.58 : BACKGROUND — un livre : chapitres, sommaire, pages automatiques, page qui tourne ───────── */
  /* ═══ 1.62 : BACKGROUND — un seul bloc de texte qu'on écrit directement ; quand il dépasse la hauteur, il continue
   * sur la page suivante, qu'on tourne comme les bulles « +N » (flèches du bas, molette, page qui pivote). Enregistrement automatique. ═══ */
  #bgSrc() { const f = this.actor.getFlag(SYS, "bg"); if (f && typeof f.html === "string") return f.html;
    const L = bookOf(this.actor); return L.map(c => `${c.title && !(L.length === 1 && /^Chapitre 1$/.test(c.title)) ? `<h2>${esc(c.title)}</h2>` : ""}${c.html || ""}`).join(""); }
  #bgHTML(editable) { const src = this.#bgSrc(); bgFontsIn(src);
    const B = (k, i, t) => `<a data-bgcmd="${k}" data-tooltip="${t}"><i class="fa-solid ${i}"></i></a>`; const SEP = `<span class="sep"></span>`;
    const opt = (L, ph) => `<option value="">${ph}</option>` + L.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join("");
    const fontOpts = `<option value="">Police</option><option value="__sheet">Police de la fiche</option>${BG_FONTS.map(([g, L]) => `<optgroup label="${esc(g)}">${L.map(f => `<option value="${esc(f)}" style="font-family:'${esc(f)}'">${esc(f)}</option>`).join("")}</optgroup>`).join("")}`;
    const tOn = (() => { try { return localStorage.getItem("ms-bg-tools") === "1"; } catch (e) { return false; } })();
    const tools = editable ? `<div class="bgx-tb${tOn ? "" : " hide"}">
      <select data-bgset="block" data-tooltip="Style du paragraphe">${opt([["p", "Texte"], ["h1", "Titre 1"], ["h2", "Titre 2"], ["h3", "Titre 3"], ["h4", "Sous-titre 1"], ["h5", "Sous-titre 2"], ["h6", "Sous-titre 3"], ["blockquote", "Citation"], ["pre", "Encadré"], ...(game.user.isGM ? [["secret", "Secret (caché aux joueurs)"]] : [])], "Paragraphe")}</select>
      <select data-bgset="font" class="wf" data-tooltip="Police">${fontOpts}</select>
      <select data-bgset="size" class="ws" data-tooltip="Taille">${opt([12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64].map(n => [n, `${n} px`]), "Taille")}</select>${SEP}
      ${B("bold", "fa-bold", "Gras (Ctrl+B)")}${B("italic", "fa-italic", "Italique (Ctrl+I)")}${B("underline", "fa-underline", "Souligné (Ctrl+U)")}${B("strikeThrough", "fa-strikethrough", "Barré")}${SEP}
      <label class="bgx-col" data-tooltip="Couleur du texte"><i class="fa-solid fa-font"></i><input type="color" data-bgset="color" value="#ffd070"></label>
      <label class="bgx-col" data-tooltip="Surligner"><i class="fa-solid fa-highlighter"></i><input type="color" data-bgset="hili" value="#5b3fd0"></label>
      <label class="bgx-col neon" data-tooltip="Néon : le texte choisi brille de cette couleur"><i class="fa-solid fa-lightbulb"></i><input type="color" data-bgset="neon" value="#3ccbff"></label>
      <a data-bgcmd="gradmenu" class="grad" data-tooltip="Dégradé"><i class="fa-solid fa-droplet"></i></a>${SEP}
      ${B("justifyLeft", "fa-align-left", "Aligner à gauche")}${B("justifyCenter", "fa-align-center", "Centrer")}${B("justifyRight", "fa-align-right", "Aligner à droite")}${B("justifyFull", "fa-align-justify", "Justifier")}${SEP}
      ${B("ul", "fa-list-ul", "Liste à puces")}${B("ol", "fa-list-ol", "Liste numérotée")}${B("hr", "fa-minus", "Séparateur")}${SEP}${B("pop", "fa-comment-dots", "Mot cliquable : une bulle s'ouvre au survol, reste ouverte au clic (texte et lien vers une fiche)")}${SEP}${B("clear", "fa-text-slash", "Texte normal (enlève la mise en forme)")}</div>` : "";
    return `<div class="bgx${editable ? " ed" : ""}${game.user.isGM ? " gm" : ""}"><div class="bgx-top"><b><i class="fa-solid fa-book-open"></i> Background</b>${editable ? `<a class="bgx-tg${tOn ? " on" : ""}" data-bgcmd="tools" data-tooltip="Afficher / cacher la mise en forme"><i class="fa-solid fa-pen-nib"></i> Mise en forme</a>` : ""}<span class="bgx-st" data-bgst>${editable ? "✓ Enregistré" : "Lecture"}</span></div>${tools}
      <div class="bgx-page" data-bgpage><div class="bgx-flow" data-bgflow${editable ? ' contenteditable="true" spellcheck="true"' : ""} data-ph="${editable ? "Écris ici l'histoire de ton personnage… (enregistré tout seul)" : "Aucun background pour l'instant."}">${bgForViewer(src)}</div></div>
      <footer class="bgx-foot"><a data-bgpg="-1" data-tooltip="Page précédente (molette)"><i class="fa-solid fa-chevron-left"></i></a><a class="bgx-n" data-bgcmd="toc" data-tooltip="Sommaire : titres et pages"><i class="fa-solid fa-list-ul"></i><span data-bgn>Page 1 / 1</span><i class="fa-solid fa-caret-up"></i></a><a data-bgpg="1" data-tooltip="Page suivante (molette)"><i class="fa-solid fa-chevron-right"></i></a></footer></div>`; }
  /* l'onglet monte jusque sous le portrait : les onglets se placent sous le nom, à droite du portrait */
  #bgHead() { const w = this.element?.querySelector(".ms-wrap.bgm"); if (!w) return; const head = w.querySelector(".ms-head"), id = w.querySelector(".ms-idblock"), nr = w.querySelector(".ms-namerow"), nav = w.querySelector(":scope > .ms-tabs"); if (!head || !id || !nr || !nav) return;
    const wr = w.getBoundingClientRect(); const z = wr.width / (w.offsetWidth || 1) || 1; const ir = id.getBoundingClientRect(), nb = nr.getBoundingClientRect(); const top = (nb.bottom - wr.top) / z + w.scrollTop + 6;
    w.style.setProperty("--bgx", `${(ir.left - wr.left) / z}px`); w.style.setProperty("--bgy", `${top}px`); w.style.setProperty("--bgw", `${ir.width / z}px`);
    head.style.minHeight = ""; const need = top + nav.offsetHeight + 6 - ((head.getBoundingClientRect().top - wr.top) / z); if (need > head.offsetHeight) head.style.minHeight = `${need}px`; }
  #bgEls() { const r = this.element?.querySelector(".bgx"); return r ? { r, page: r.querySelector("[data-bgpage]"), flow: r.querySelector("[data-bgflow]"), lbl: r.querySelector("[data-bgn]") } : null; }
  #bgInit() { const E = this.#bgEls(); if (!E) return; this._bgPg ??= 0;
    const lay = () => { const E2 = this.#bgEls(); if (!E2) return; const W = E2.page.clientWidth; if (W < 60) return; const P = Math.max(16, Math.min(34, Math.round(W * .045)));
      E2.flow.style.padding = `16px ${P}px 14px`; E2.flow.style.columnWidth = `${W - 2 * P}px`; E2.flow.style.columnGap = `${2 * P}px`; this._bgW = W; this.#bgCount(); this.#bgGo(this._bgPg, 0); };
    this._bgLay = lay; lay(); requestAnimationFrame(lay);
    E.flow.querySelectorAll("img").forEach(im => { if (!im.complete) im.addEventListener("load", lay, { once: true }); });
    try { this._bgRO?.disconnect(); this._bgRO = new ResizeObserver(() => { this.#bgHead(); lay(); }); this._bgRO.observe(E.page); this._bgRO.observe(this.element.querySelector(".ms-wrap")); } catch (e) { /* rien */ } }
  #bgCount() { const E = this.#bgEls(); if (!E || !this._bgW) return;
    /* pendant que la page pivote (effet 3D), les mesures sont faussées : on recompte à la fin de l'animation */
    if (E.page.classList.contains("pg-n") || E.page.classList.contains("pg-p")) { if (!E.page._bgWait) { E.page._bgWait = true; E.page.addEventListener("animationend", () => { E.page._bgWait = false; E.page.classList.remove("pg-n", "pg-p"); this.#bgCount(); }, { once: true }); } return; }
    const rg = document.createRange(); rg.selectNodeContents(E.flow); const pr = E.page.getBoundingClientRect(); let max = 0;
    for (const q of rg.getClientRects()) if (q.width || q.height) max = Math.max(max, q.right - pr.left + E.page.scrollLeft);
    this._bgN = Math.max(1, Math.ceil((max - 2) / this._bgW));
    /* repère invisible au bout de la dernière page : sinon le navigateur arrête le défilement au bout du texte et la dernière page est décalée */
    let sp = E.page.querySelector(":scope > .bgx-sp"); if (!sp) { sp = document.createElement("i"); sp.className = "bgx-sp"; sp.setAttribute("aria-hidden", "true"); E.page.appendChild(sp); } sp.style.left = `${this._bgN * this._bgW - 1}px`;
    this.#bgLabel(); }
  #bgLabel() { const E = this.#bgEls(); if (!E) return; const n = this._bgN || 1, p = Math.min(this._bgPg || 0, n - 1); E.lbl.textContent = `Page ${p + 1} / ${n}`; E.r.querySelector('[data-bgpg="-1"]')?.classList.toggle("dis", p <= 0); E.r.querySelector('[data-bgpg="1"]')?.classList.toggle("dis", p >= n - 1); }
  #bgGo(p, d) { const E = this.#bgEls(); if (!E || !this._bgW) return; const n = this._bgN || 1; p = Math.max(0, Math.min(n - 1, p)); const ch = p !== this._bgPg; this._bgPg = p; this._bgSnap = true; E.page.scrollLeft = p * this._bgW; this._bgSnap = false;
    if (d && ch) { E.page.classList.remove("pg-n", "pg-p"); void E.page.offsetWidth; E.page.classList.add(d > 0 ? "pg-n" : "pg-p"); E.page.addEventListener("animationend", () => { E.page.classList.remove("pg-n", "pg-p"); this.#bgCount(); }, { once: true }); } this.#bgLabel(); }
  #bgDirty() { this._bgDirty = true; const st = this.element?.querySelector("[data-bgst]"); if (st) { st.textContent = "● Enregistrement…"; st.classList.add("dirty"); } clearTimeout(this._bgST); this._bgST = setTimeout(() => this.#bgSave(), 1200);
    /* 1.66.4 : après chaque frappe le navigateur fait défiler la page vers une mauvaise colonne (bug des colonnes CSS) et ne le signale que tard :
     * on remet la page tout de suite, puis juste avant l'image suivante (avant que l'écran ne soit redessiné) */
    this.#bgHold(); setTimeout(() => this.#bgHold(), 0);
    cancelAnimationFrame(this._bgRA); this._bgRA = requestAnimationFrame(() => { this.#bgHold(); this.#bgCount(); this.#bgHold(); }); }
  /* d'abord remettre la page affichée (tant que la vue est décalée, la position du curseur est fausse), ensuite seulement suivre le curseur s'il est passé sur une autre page */
  #bgHold() { const E = this.#bgEls(); if (!E || !this._bgW) return; const want = (this._bgPg || 0) * this._bgW;
    if (Math.abs(E.page.scrollLeft - want) >= 1) { this._bgSnap = true; E.page.scrollLeft = want; this._bgSnap = false; }
    if (!document.activeElement?.matches?.("[data-bgflow]")) return; const c = this.#bgCaretPage(); if (c != null && c !== this._bgPg) this.#bgGo(c, c > this._bgPg ? 1 : -1); }
  async #bgSave() { clearTimeout(this._bgST); if (!this._bgDirty) return; const flow = this.element?.querySelector("[data-bgflow]"); if (!flow) return; this._bgDirty = false; let html = bgClean(flow.innerHTML); if (!game.user.isGM) html = bgMergeSecrets(html, this.#bgSrc());
    const st = this.element?.querySelector("[data-bgst]"); try { await this.actor.update({ [`flags.${SYS}.bg.html`]: html }); if (st && !this._bgDirty) { st.textContent = "✓ Enregistré"; st.classList.remove("dirty"); st.classList.add("flash"); setTimeout(() => st.classList.remove("flash"), 900); } }
    catch (e) { console.error(SYS, e); this._bgDirty = true; if (st) st.textContent = "⚠ Non enregistré"; ui.notifications.error(`Background non enregistré : ${e.message}`); } }
  #bgBind() { const el = this.element; if (el.dataset.bgb) return; el.dataset.bgb = "1";
    const flowOf = () => el.querySelector("[data-bgflow]");
    /* la sélection est gardée quand on passe par une liste ou un sélecteur de couleur */
    const restore = () => { const f = flowOf(); if (!f) return null; const pg = f.closest("[data-bgpage]"), sl = pg.scrollLeft; this._bgSnap = true; f.focus({ preventScroll: true }); const r = this._bgRange; if (r && f.contains(r.startContainer)) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } pg.scrollLeft = sl; this._bgSnap = false; return f; };
    const prep = () => { try { document.execCommand("defaultParagraphSeparator", false, "p"); document.execCommand("styleWithCSS", false, false); } catch (e) { /* rien */ } };
    /* style posé sur la sélection : on la marque, puis chaque marque devient un <span> stylé */
    const wrap = (fn, strip = []) => { const f = restore(); if (!f) return; const sel = getSelection(); if (!sel.rangeCount || sel.isCollapsed) { ui.notifications.info("Sélectionne d'abord le texte à mettre en forme."); return; } prep();
      /* marque = lien temporaire (ne touche ni aux polices ni aux couleurs déjà posées) */
      document.execCommand("createLink", false, "https://msbgmark.invalid/");
      const made = []; f.querySelectorAll('a[href="https://msbgmark.invalid/"]').forEach(m => { const sp = document.createElement("span"); while (m.firstChild) sp.appendChild(m.firstChild);
        sp.querySelectorAll("[style]").forEach(d => { for (const k of strip) d.style.removeProperty(k); if (!d.getAttribute("style")) d.removeAttribute("style"); }); fn(sp, m.parentElement); m.replaceWith(sp); made.push(sp); });
      /* le texte mis en forme reste sélectionné : on peut enchaîner (néon + taille + police…) */
      if (made.length) { try { const r = document.createRange(); const last = made[made.length - 1]; r.setStart(made[0], 0); r.setEnd(last, last.childNodes.length); sel.removeAllRanges(); sel.addRange(r); this._bgRange = r.cloneRange(); } catch (e) { /* rien */ } }
      this.#bgDirty(); return made; };
    const GRAD = ["background-image", "-webkit-background-clip", "background-clip", "-webkit-text-fill-color", "-webkit-box-decoration-break", "box-decoration-break"];
    const grad = (a, b, c) => wrap((sp, par) => { const ts = par ? getComputedStyle(par).textShadow : "none"; sp.style.textShadow = "none"; const nc = ts && ts !== "none" ? (ts.match(/rgba?\([^)]+\)/g) || [])[1] : null; if (nc) sp.style.filter = `drop-shadow(0 0 3px ${nc}) drop-shadow(0 0 9px ${nc})`; sp.style.backgroundImage = `linear-gradient(90deg, ${a}, ${c ? `${b}, ${c}` : b})`; sp.style.setProperty("-webkit-background-clip", "text"); sp.style.backgroundClip = "text"; sp.style.setProperty("-webkit-text-fill-color", "transparent"); sp.style.setProperty("-webkit-box-decoration-break", "clone"); sp.style.boxDecorationBreak = "clone"; }, [...GRAD, "color", "text-shadow", "filter"]);
    /* Secret (MJ) : entoure les paragraphes sélectionnés ; dans un secret, le retire (le texte reste) */
    const secretToggle = f => { if (!game.user.isGM) return; const sel = getSelection(); if (!sel.rangeCount) return; const r = sel.getRangeAt(0); const at = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
      const inS = at?.closest?.("section.secret"); if (inS && f.contains(inS)) { inS.replaceWith(...inS.childNodes); ui.notifications.info("Bloc secret retiré : le texte est de nouveau visible des joueurs."); return; }
      let kids = [...f.childNodes].filter(n => r.intersectsNode(n)); if (!kids.length || kids.every(n => n.nodeType === 3)) { document.execCommand("formatBlock", false, "p"); const r2 = getSelection().rangeCount ? getSelection().getRangeAt(0) : r; kids = [...f.childNodes].filter(n => r2.intersectsNode(n)); }
      if (!kids.length) { const p = document.createElement("p"); p.innerHTML = "<br>"; f.appendChild(p); kids = [p]; }
      const s = document.createElement("section"); s.className = "secret"; s.id = bgSecId(); kids[0].before(s); kids.forEach(n => s.appendChild(n));
      try { const nr = document.createRange(); nr.selectNodeContents(s); nr.collapse(false); sel.removeAllRanges(); sel.addRange(nr); this._bgRange = nr.cloneRange(); } catch (e) { /* rien */ } };
    /* 1.66.0 : mot cliquable — la sélection devient <span class="msw-pop" data-pop-*> */
    const popCreate = async f => { const sel = getSelection(); if (!sel.rangeCount) return; const r = sel.getRangeAt(0);
      const at = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement; const cur = at?.closest?.(".msw-pop");
      if (cur && f.contains(cur)) return popEdit(cur);
      if (r.collapsed || !r.toString().trim()) { ui.notifications.info("Sélectionne d'abord le mot ou l'expression à rendre cliquable."); return; }
      const frag = r.cloneContents(); if (frag.querySelector("p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, section, div, br")) { ui.notifications.warn("Sélectionne un mot ou une expression dans un seul paragraphe."); return; }
      const word = r.toString().trim(); const v = await popDialog({ t: word }); if (!v) return;
      const sp = document.createElement("span"); sp.className = "msw-pop"; sp.dataset.popId = foundry.utils.randomID(); popApply(sp, v);
      r.deleteContents(); sp.appendChild(frag); r.insertNode(sp); sel.removeAllRanges(); this.#bgDirty(); };
    const popApply = (sp, v) => { sp.dataset.popT = v.t || ""; sp.dataset.pop = v.x || ""; if (v.u) { sp.dataset.popU = v.u; sp.dataset.popN = v.n || ""; } else { delete sp.dataset.popU; delete sp.dataset.popN; } if (v.gm) sp.dataset.popGm = "1"; else delete sp.dataset.popGm; };
    const popEdit = async sp => { const v = await popDialog({ t: sp.dataset.popT || sp.textContent.trim(), x: sp.dataset.pop, u: sp.dataset.popU, n: sp.dataset.popN, gm: !!sp.dataset.popGm }, true); if (!v) return;
      if (v.remove) sp.replaceWith(...sp.childNodes); else popApply(sp, v); this.#bgDirty(); };
    this._popEdit = popEdit; this._popRemove = sp => { sp.replaceWith(...sp.childNodes); this.#bgDirty(); };
    const unwrapAll = root => root.querySelectorAll("span, font, b, strong, i, em, u, s, strike").forEach(n => n.replaceWith(...n.childNodes));
    const cmd = (k, v) => { const f = restore(); if (!f) return; prep();
      if (k === "block") { if (v === "secret") secretToggle(f); else document.execCommand("formatBlock", false, v); }
      else if (k === "ul") document.execCommand("insertUnorderedList"); else if (k === "ol") document.execCommand("insertOrderedList"); else if (k === "hr") document.execCommand("insertHorizontalRule");
      else if (k === "clear") { const sel = getSelection(); if (sel.rangeCount && !sel.isCollapsed) { const made = wrap(sp => { unwrapAll(sp); }) || []; const sel2 = getSelection(); const first = made[0]?.firstChild, lastS = made[made.length - 1], lastC = lastS?.lastChild; made.forEach(n => n.replaceWith(...n.childNodes)); if (first && lastC) { try { const r = document.createRange(); r.setStartBefore(first); r.setEndAfter(lastC); sel2.removeAllRanges(); sel2.addRange(r); this._bgRange = r.cloneRange(); } catch (e) { /* rien */ } } } document.execCommand("formatBlock", false, "p"); }
      else if (k === "font") { if (v === "__sheet") wrap(sp => { sp.style.fontFamily = "inherit"; }, ["font-family"]); else { bgFontLoad(v); wrap(sp => { sp.style.fontFamily = `'${v}', serif`; }, ["font-family"]); } }
      else if (k === "size") wrap(sp => { sp.style.fontSize = `${Number(v)}px`; }, ["font-size"]);
      else if (k === "color") wrap(sp => { sp.style.color = v; }, ["color", ...GRAD]);
      else if (k === "hili") wrap(sp => { sp.style.backgroundColor = v; sp.style.borderRadius = "3px"; }, ["background-color"]);
      else if (k === "neon") wrap((sp, par) => { /* sur un dégradé : le dégradé reste et brille */ if (par?.closest?.('[style*="background-clip"]') || sp.querySelector('[style*="background-clip"]')) { sp.style.filter = `drop-shadow(0 0 3px ${v}) drop-shadow(0 0 9px ${v})`; return; } sp.style.color = `color-mix(in srgb, ${v} 35%, #ffffff)`; sp.style.textShadow = `0 0 2px #ffffffaa, 0 0 6px ${v}, 0 0 14px ${v}, 0 0 28px ${v}`; }, ["color", "text-shadow", "filter"]);
      else if (k === "grad") { const [a, b, c] = v.split(","); grad(a, b, c); }
      else if (k === "pop") { popCreate(f); return; }
      else document.execCommand(k);
      this.#bgDirty(); this.#bgTools(); };
    const toggleTools = btn => { const tb = el.querySelector(".bgx-tb"); if (!tb) return; const on = tb.classList.toggle("hide") === false; btn.classList.toggle("on", on); try { localStorage.setItem("ms-bg-tools", on ? "1" : "0"); } catch (e) { /* rien */ } };
    /* sommaire : chaque titre avec sa page, et toutes les pages en accès direct */
    const tocMenu = btn => { const old = el.querySelector(".bgx-toc"); if (old) { old.remove(); return; } const E = this.#bgEls(); if (!E || !this._bgW) return; this.#bgCount();
      const pr = E.page.getBoundingClientRect(); const pageOf = n => { const q = n.getBoundingClientRect(); return Math.max(0, Math.min((this._bgN || 1) - 1, Math.floor((q.left + 2 - pr.left + E.page.scrollLeft) / this._bgW))); };
      const H = [...E.flow.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter(h => h.textContent.trim()).map(h => ({ t: h.textContent.trim(), lv: Number(h.tagName[1]), p: pageOf(h) }));
      const cur = this._bgPg || 0, n = this._bgN || 1;
      const m = document.createElement("div"); m.className = "bgx-toc";
      m.innerHTML = `<header><b><i class="fa-solid fa-list-ul"></i> Sommaire</b><em>${n} page${n > 1 ? "s" : ""}</em></header>
        <div class="ls">${H.map(h => `<a class="lv${h.lv}${h.p === cur ? " on" : ""}" data-gop="${h.p}"><span>${esc(h.t)}</span><small>p. ${h.p + 1}</small></a>`).join("") || `<small class="none">Aucun titre : utilise « Titre 1 » à « Sous-titre 3 » dans la mise en forme pour qu'ils apparaissent ici.</small>`}</div>
        <footer>${Array.from({ length: n }, (_, i) => `<a class="pg${i === cur ? " on" : ""}" data-gop="${i}">${i + 1}</a>`).join("")}</footer>`;
      E.r.appendChild(m); const fb = btn.getBoundingClientRect(), rr = E.r.getBoundingClientRect(); m.style.left = `${Math.max(4, Math.min(rr.width - m.offsetWidth - 4, fb.left - rr.left + fb.width / 2 - m.offsetWidth / 2))}px`; m.style.bottom = `${rr.bottom - fb.top + 6}px`;
      m.querySelector(".on")?.scrollIntoView({ block: "nearest" });
      m.addEventListener("mousedown", e => e.preventDefault());
      m.addEventListener("click", e => { const g = e.target.closest("[data-gop]"); if (!g) return; const to = Number(g.dataset.gop); m.remove(); this.#bgGo(to, to === this._bgPg ? 0 : (to > this._bgPg ? 1 : -1)); });
      setTimeout(() => { const off = e => { if (m.contains(e.target) || e.target.closest?.('[data-bgcmd="toc"]')) return; m.remove(); document.removeEventListener("pointerdown", off, true); }; document.addEventListener("pointerdown", off, true); }, 0); };
    const gradMenu = btn => { const old = el.querySelector(".bgx-gm"); if (old) { old.remove(); return; } const r = btn.closest(".bgx"); const m = document.createElement("div"); m.className = "bgx-gm";
      m.innerHTML = `<b>Dégradé</b>${BG_GRADS.map(([n, c]) => `<a data-grad="${c}" style="--g:linear-gradient(90deg, ${c})"><span>${esc(n)}</span></a>`).join("")}<div class="cus"><input type="color" value="#ff4fd8" data-g1><input type="color" value="#3ccbff" data-g2><a data-gcus>Appliquer</a></div>`;
      const br = btn.getBoundingClientRect(), rr = r.getBoundingClientRect(); m.style.left = `${Math.min(br.left - rr.left, rr.width - 230)}px`; m.style.top = `${br.bottom - rr.top + 4}px`; r.appendChild(m);
      m.addEventListener("mousedown", e => { if (!e.target.matches("input")) e.preventDefault(); });
      m.addEventListener("click", e => { const g = e.target.closest("[data-grad]"); if (g) { m.remove(); return cmd("grad", g.dataset.grad); } if (e.target.closest("[data-gcus]")) { const v = `${m.querySelector("[data-g1]").value},${m.querySelector("[data-g2]").value}`; m.remove(); cmd("grad", v); } });
      setTimeout(() => { const off = e => { if (m.contains(e.target) || e.target.closest?.('[data-bgcmd="gradmenu"]')) return; m.remove(); document.removeEventListener("pointerdown", off, true); }; document.addEventListener("pointerdown", off, true); }, 0); };
    el.addEventListener("change", ev => { const c = ev.target.closest?.("[data-bgset]"); if (!c) return; ev.stopPropagation(); const v = c.value; if (c.tagName === "SELECT") c.value = ""; if (v) cmd(c.dataset.bgset, v); }, true);
    el.addEventListener("mousedown", ev => { if (ev.target.closest?.("[data-bgcmd], [data-bgpg]")) { ev.preventDefault(); return; } if (ev.target.closest?.(".bgx-tb")) return;
      /* premier clic dans le texte : le navigateur ramenait la page 1 au moment de donner le focus → on garde la page et on pose le curseur sous la souris */
      const f = ev.target.closest?.("[data-bgflow][contenteditable]"); if (!f || ev.button !== 0 || document.activeElement === f || ev.shiftKey) return; ev.preventDefault();
      const pg = f.closest("[data-bgpage]"); const sl = pg.scrollLeft; this._bgSnap = true; f.focus({ preventScroll: true }); pg.scrollLeft = sl;
      let r = null; if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(ev.clientX, ev.clientY); else if (document.caretPositionFromPoint) { const c = document.caretPositionFromPoint(ev.clientX, ev.clientY); if (c) { r = document.createRange(); r.setStart(c.offsetNode, c.offset); r.collapse(true); } }
      if (r && f.contains(r.startContainer)) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } pg.scrollLeft = sl; this._bgSnap = false; }, true);
    el.addEventListener("click", ev => { const sec = ev.target.closest?.("[data-bgflow] section.secret"); if (sec && ev.target === sec && game.user.isGM && ev.clientY - sec.getBoundingClientRect().top < 22) { ev.preventDefault(); sec.classList.toggle("revealed"); this.#bgDirty(); return; }
      const c = ev.target.closest?.("[data-bgcmd]"); if (c) { ev.preventDefault(); if (c.dataset.bgcmd === "tools") return toggleTools(c); if (c.dataset.bgcmd === "toc") return tocMenu(c); return c.dataset.bgcmd === "gradmenu" ? gradMenu(c) : cmd(c.dataset.bgcmd); }
      const g = ev.target.closest?.("[data-bgpg]"); if (g) { ev.preventDefault(); const d = Number(g.dataset.bgpg); this.#bgGo((this._bgPg || 0) + d, d); } });
    let wT = 0; el.addEventListener("wheel", ev => { if (ev.target.closest?.(".bgx-toc") || !ev.target.closest?.("[data-bgpage], .bgx-foot")) return; ev.preventDefault(); const now = Date.now(); if (now - wT < 200) return; wT = now; const d = ev.deltaY > 0 || ev.deltaX > 0 ? 1 : -1; this.#bgGo((this._bgPg || 0) + d, d); }, { passive: false });
    el.addEventListener("input", ev => { if (ev.target.closest?.("[data-bgflow]")) this.#bgDirty(); });
    el.addEventListener("focusin", ev => { if (ev.target.closest?.("[data-bgflow]")) try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) { /* rien */ } });
    el.addEventListener("focusout", ev => { if (ev.target.closest?.("[data-bgflow]")) this.#bgSave(); });
    el.addEventListener("paste", ev => { const f = ev.target.closest?.("[data-bgflow]"); if (!f) return; ev.preventDefault(); const t = ev.clipboardData?.getData("text/plain") || ""; document.execCommand("insertText", false, t); });
    el.addEventListener("keydown", ev => { if (!ev.target.closest?.("[data-bgflow]")) return; if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") { ev.preventDefault(); ev.stopPropagation(); this.#bgSave(); } else setTimeout(() => this.#bgTools(), 0); }, true);
    /* le navigateur fait défiler la page jusqu'au curseur pendant l'écriture : on se recale sur une page entière (tourne la page) */
    el.addEventListener("scroll", ev => { const pg = ev.target; if (!pg?.matches?.("[data-bgpage]") || this._bgSnap || !this._bgW) return; const p = Math.round(pg.scrollLeft / this._bgW); if (Math.abs(pg.scrollLeft - p * this._bgW) < 1 && p === this._bgPg) return;
      /* 1.66.3 : pendant la frappe, le navigateur ramène tout seul la vue vers une autre colonne (bug des colonnes) : on remet la page AVANT l'affichage, sans attendre → plus de flash */
      if (document.activeElement?.matches?.("[data-bgflow]")) { this.#bgHold(); return; }
      clearTimeout(this._bgSc); this._bgSc = setTimeout(() => { this.#bgCount(); let q = Math.round(pg.scrollLeft / this._bgW); const c = this.#bgCaretPage(); if (c != null) q = c; this.#bgGo(q, q === this._bgPg ? 0 : (q > this._bgPg ? 1 : -1)); }, 30); }, true);
    /* le curseur passe sur une autre page (flèches, Entrée…) : la page tourne avec lui */
    if (!this._bgSelH) { this._bgSelH = () => { if (!this.rendered || this.tab !== "background") return; const sel = getSelection(), f = this.element?.querySelector("[data-bgflow]"); if (f && sel.rangeCount && f.contains(sel.anchorNode)) { this._bgRange = sel.getRangeAt(0).cloneRange(); this.#bgTools(); this.#bgHold(); } }; document.addEventListener("selectionchange", this._bgSelH); } }
  #bgTools() { const tb = this.element?.querySelector(".bgx-tb"); if (!tb) return; for (const k of ["bold", "italic", "underline", "strikeThrough", "justifyLeft", "justifyCenter", "justifyRight", "justifyFull", "insertUnorderedList", "insertOrderedList"]) { let on = false; try { on = document.queryCommandState(k); } catch (e) { /* rien */ } const key = k === "insertUnorderedList" ? "ul" : k === "insertOrderedList" ? "ol" : k; tb.querySelector(`[data-bgcmd="${key}"]`)?.classList.toggle("on", !!on); } }
  #bgCaretPage() { const E = this.#bgEls(); if (!E || !this._bgW) return null; const sel = getSelection(); if (!sel?.rangeCount || !E.flow.contains(sel.anchorNode)) return null; const r = sel.getRangeAt(0).cloneRange(); r.collapse(true);
    let q = [...r.getClientRects()][0];
    /* curseur sans position mesurable (début de ligne, nœud vide…) : on mesure le caractère voisin ; jamais le paragraphe entier, qui peut commencer sur la page d'avant */
    if (!q) { const nd = r.startContainer, o = r.startOffset; if (nd.nodeType === 3) { const r2 = document.createRange(); if (o < nd.length) { r2.setStart(nd, o); r2.setEnd(nd, o + 1); } else if (o > 0) { r2.setStart(nd, o - 1); r2.setEnd(nd, o); } q = [...r2.getClientRects()].pop(); }
      else { const ch = nd.childNodes[o] || nd.childNodes[o - 1]; const rs = ch?.nodeType === 1 ? [...ch.getClientRects()] : []; q = rs[0]; } }
    if (!q) return null; const pr = E.page.getBoundingClientRect();
    return Math.max(0, Math.floor((q.left + 1 - pr.left + E.page.scrollLeft) / this._bgW)); }
  #bookHTML(cfg, editable) {
    const L = bookOf(this.actor); const N = L.filter(c => !c.special), S = L.filter(c => c.special); const R = n => ROMAN[n] || String(n); const num = c => N.indexOf(c) + 1;
    const st = bookStyle(this.actor); const thCls = `bk-th-${BOOK_THEMES[st.theme] ? st.theme : "sheet"}`; const vars = bookVars(st); bookFonts();
    const ttl = c => esc(c.title || (c.special ? "Repère" : `Chapitre ${num(c)}`));
    const SP = `flags.${SYS}.book.style`; const sel = (n, opts, v) => `<select name="${n}">${opts.map(([k, l]) => `<option value="${esc(k)}"${String(v) === String(k) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    const stylePanel = () => `<details class="bk-style"${this.bkStyleOpen ? " open" : ""}><summary data-bkstyle><i class="fa-solid fa-palette"></i> D.A du livre <small>${esc(BOOK_THEMES[st.theme]?.[0] || "Fiche")}${st.body ? ` · ${esc(st.body)}` : ""}</small></summary>
        <div class="bk-sgrid"><div class="bk-themes">${Object.entries(BOOK_THEMES).map(([k, [n, bg, ac]]) => `<label class="bk-thc${st.theme === k ? " on" : ""}" style="--bg:${bg};--ac:${ac}"><input type="radio" name="${SP}.theme" value="${k}"${st.theme === k ? " checked" : ""}><span><em></em><em></em></span><b>${esc(n)}</b></label>`).join("")}</div>
          <div class="bk-sfields"><label><span>Police du texte</span>${sel(`${SP}.body`, [["", "Celle du thème"], ...BOOK_FONTS.slice(1)], st.body)}</label><label><span>Police des titres</span>${sel(`${SP}.title`, [["", "Celle du thème"], ...BOOK_FONTS.slice(1)], st.title)}</label>
            <label><span>Taille du texte</span>${sel(`${SP}.size`, [11, 12, 13, 14, 15, 16, 17, 18, 20, 22].map(n => [n, `${n} px`]), st.size)}</label>
            <label><span>Couleur d'accent</span><span class="bk-acc"><input type="color" data-bkset="flags.${SYS}.book.style.acc" value="${esc(st.acc || BOOK_THEMES[st.theme]?.[2] || "#ffd070")}"><a data-action="bkAccReset" data-tooltip="Couleur du thème"><i class="fa-solid fa-rotate-left"></i></a></span></label></div>
          <div class="bk ${thCls} bk-prev" style="${vars}"><div class="bk-ppage bk-page"><div class="bk-ch"><header><small>Chapitre I</small><h2>Aperçu</h2><span class="orn"><i></i><b>◆</b><i></i></span></header><div class="bk-tx"><p>Les engrenages chantaient sous la ville quand il ouvrit les yeux pour la première fois…</p></div></div></div></div></div></details>`;
    const editorOf = cur => { const P = `flags.${SYS}.book.ch.${cur.id}`; return `<label class="bk-etitle"><small>${cur.special ? "Chapitre spécial" : `Chapitre ${R(num(cur))}`}</small><input type="text" data-bkset="${P}.title" value="${esc(cur.title || "")}" placeholder="${cur.special ? "Nom du repère (Relations, Carnet de quêtes…)" : "Titre du chapitre"}"></label>
        ${cur.special ? `<div class="bk-spopts"><span>Icône</span><span class="bk-icons">${BOOK_ICONS.map(i => `<label class="${cur.icon === i ? "on" : ""}"><input type="radio" data-bkset="${P}.icon" value="${i}"${cur.icon === i ? " checked" : ""}><i class="fa-solid ${i}"></i></label>`).join("")}</span><span>Couleur</span><input type="color" data-bkset="${P}.color" value="${esc(cur.color || BOOK_THEMES[st.theme]?.[2] || "#ffd070")}"></div>` : ""}
        <div class="bk-erich">${richEditor(`${P}.html`, cur.html, true)}</div><p class="bk-ehint"><i class="fa-solid fa-circle-info"></i> Écris directement, puis la disquette (à droite de la barre d'outils) enregistre. Chaque chapitre commence sur une nouvelle page ; les pages se découpent toutes seules.</p>`; };
    /* 1.58.6 : écriture directe depuis le livre (sans passer par Organiser) */
    if (this._bkAfterSave) { this._bkAfterSave = false; this._bkGoto = this.bookQuick; this.bookQuick = null; }
    const qc = editable && this.bookQuick ? L.find(c => c.id === this.bookQuick) : null;
    if (qc && !this.bookEditing) return `${this.#bookBand(L)}<div class="bk-qedit" data-ch="${qc.id}"><header><a data-action="bkQuickClose" class="ms-btn small ok"><i class="fa-solid fa-book-open-reader"></i> Revenir au livre</a><span class="grow"></span>
        <a data-action="bkSpec" class="ms-btn small${qc.special ? " on" : ""}" data-tooltip="${qc.special ? "Repasser en chapitre normal" : "En faire un repère (hors sommaire, liste à gauche du livre)"}"><i class="fa-solid fa-thumbtack"></i> ${qc.special ? "Repère" : "Chapitre"}</a><a data-action="bkDel" class="ms-btn small danger"><i class="fa-solid fa-trash"></i></a></header>
      <section class="bk-ecur">${editorOf(qc)}</section></div>`;
    if (this.bookEditing && editable) {
      const cur = L.find(c => c.id === this.bookCh) || L[0]; this.bookCh = cur?.id;
      const row = c => { const i = L.indexOf(c), grp = c.special ? S : N, k = grp.indexOf(c); return `<div class="bk-er${c.id === cur?.id ? " on" : ""}${c.special ? " sp" : ""}" data-ch="${c.id}"${c.color ? ` style="--sc:${esc(c.color)}"` : ""}><a data-action="bkSel" class="n">${c.special ? `<i class="fa-solid ${esc(c.icon)}"></i>` : R(num(c))}</a><a data-action="bkSel" class="t">${ttl(c)}</a><a data-action="bkSpec" class="spb${c.special ? " on" : ""}" data-tooltip="${c.special ? "Repasser en chapitre normal" : "Chapitre spécial : hors sommaire, dans la liste d'accès rapide"}"><i class="fa-solid fa-thumbtack"></i></a><a data-action="bkMove" data-d="-1" class="${k ? "" : "off"}" data-tooltip="Monter"><i class="fa-solid fa-chevron-up"></i></a><a data-action="bkMove" data-d="1" class="${k < grp.length - 1 ? "" : "off"}" data-tooltip="Descendre"><i class="fa-solid fa-chevron-down"></i></a><a data-action="bkDel" class="danger" data-tooltip="Supprimer"><i class="fa-solid fa-trash"></i></a></div>`; };
      const editor = cur ? `<label class="bk-etitle"><small>${cur.special ? "Chapitre spécial" : `Chapitre ${R(num(cur))}`}</small><input type="text" data-bkset="flags.${SYS}.book.ch.${cur.id}.title" value="${esc(cur.title || "")}" placeholder="Titre"></label>
        <a data-action="bkQuick" data-ch="${cur.id}" class="bk-openw"><i class="fa-solid fa-feather-pointed"></i><span><b>Écrire ce chapitre</b><small>Fenêtre séparée : réduire, agrandir, un seul « Enregistrer » (ou double-clic sur le texte du livre)</small></span></a>
        <div class="bk-eprev">${cur.html || `<p class="bk-none">Chapitre vide.</p>`}</div>` : `<div class="bk-none big"><i class="fa-solid fa-feather-pointed"></i><p>Ajoute un premier chapitre pour commencer le livre.</p></div>`;
      return `${this.#bookBand(L)}${stylePanel()}<div class="bk-edit"><aside class="bk-elist"><header><i class="fa-solid fa-list-ol"></i> Chapitres</header>${N.map(row).join("") || `<p class="bk-none">Aucun chapitre.</p>`}<a data-action="bkAdd" class="bk-add"><i class="fa-solid fa-plus"></i> Nouveau chapitre</a>
        <header class="sp"><i class="fa-solid fa-thumbtack"></i> Chapitres spéciaux</header>${S.map(row).join("") || `<p class="bk-none">Hors sommaire, toujours à portée de clic (Relations, Lieux, Carnet…).</p>`}<a data-action="bkAdd" data-special="1" class="bk-add sp"><i class="fa-solid fa-plus"></i> Chapitre spécial</a></aside>
        <section class="bk-ecur">${editor}</section></div>`;
    }
    if (!L.length) return `${this.#bookBand(L)}<div class="bk-empty"><i class="fa-solid fa-book-open"></i><b>Le livre est vierge</b><p>L'histoire de ${esc(this.actor.name)} : origines, souvenirs, blessures, rencontres… chapitre par chapitre.</p>${editable ? `<a data-action="bkEdit" class="ms-btn"><i class="fa-solid fa-feather-pointed"></i> Écrire le premier chapitre</a>` : ""}</div>`;
    const toc = `<section class="bk-toc"><h2><small>✦</small>Sommaire<small>✦</small></h2><ol>${N.map(c => `<li><a data-action="bkGo" data-ch="${c.id}"><em>${R(num(c))}</em><span>${ttl(c)}</span><i></i><b data-tocp="${c.id}"></b></a></li>`).join("")}</ol></section>`;
    const chs = L.map(c => `<section class="bk-ch${c.special ? " sp" : ""}" data-ch="${c.id}"${c.color ? ` style="--bk-acc:${esc(c.color)}"` : ""}><header>${c.special ? `<small><i class="fa-solid ${esc(c.icon)}"></i></small>` : `<small>Chapitre ${R(num(c))}</small>`}<h2>${ttl(c)}</h2><span class="orn"><i></i><b>◆</b><i></i></span></header><div class="bk-tx">${c.html || "<p class='bk-blank'>…</p>"}</div></section>`).join("");
    const specs = S.length ? `<nav class="bk-specs"><header><i class="fa-solid fa-thumbtack"></i> Repères</header>${S.map(c => `<a data-action="bkGo" data-ch="${c.id}" class="bk-spec"${c.color ? ` style="--sc:${esc(c.color)}"` : ""}><i class="fa-solid ${esc(c.icon)}"></i><span>${ttl(c)}</span></a>`).join("")}</nav>` : "";
    return `${this.#bookBand(L)}<div class="bk ${thCls}" tabindex="0" style="${vars}"><div class="bk-tools"><a data-action="bkTurn" data-d="-1" class="bk-tb" data-tooltip="Page précédente (←)"><i class="fa-solid fa-chevron-left"></i></a><a data-action="bkGo" data-ch="" class="bk-tb" data-tooltip="Sommaire"><i class="fa-solid fa-list-ul"></i></a>
      <span class="bk-chips">${N.map(c => `<a data-action="bkGo" data-ch="${c.id}" class="bk-chip" data-tooltip="${ttl(c)}">${R(num(c))}</a>`).join("")}</span><span class="bk-pg" data-bkpg>—</span><a data-action="bkTurn" data-d="1" class="bk-tb" data-tooltip="Page suivante (→)"><i class="fa-solid fa-chevron-right"></i></a>${editable ? `<span class="bk-wr"><a data-action="bkQuick" class="bk-tb wr" data-tooltip="Écrire dans le chapitre de cette page (ou double-clic sur le texte)"><i class="fa-solid fa-pen-nib"></i></a><a data-action="bkAdd" class="bk-tb" data-tooltip="Nouveau chapitre"><i class="fa-solid fa-plus"></i></a><a data-action="bkAdd" data-special="1" class="bk-tb" data-tooltip="Nouveau repère (hors sommaire)"><i class="fa-solid fa-thumbtack"></i></a><a data-action="bkStyle" class="bk-tb${this.bkStyleOpen ? " on" : ""}" data-tooltip="D.A du livre"><i class="fa-solid fa-palette"></i></a></span>` : ""}</div>
      ${editable && this.bkStyleOpen ? stylePanel() : ""}<div class="bk-main${specs ? " has-specs" : ""}">${specs}<div class="bk-book"><div class="bk-page l"><span class="bk-num" data-pn="l"></span></div><div class="bk-page r"><span class="bk-num" data-pn="r"></span></div><i class="bk-spine"></i>
        <div class="bk-flow"><div class="bk-in">${toc}${chs}</div></div><div class="bk-leaf"></div><a class="bk-hot prev" data-action="bkTurn" data-d="-1"></a><a class="bk-hot next" data-action="bkTurn" data-d="1"></a></div></div></div>`;
  }
  #bookBand(L) { const ed = this.isEditable; return `<div class="ms-band bk-band" style="--tc:var(--ms-warm, #ffd070)"><i class="fa-solid fa-book-open"></i><span class="t">Background</span><span class="n">${L.length}</span><span class="sys">SYS::ARCHIVES · ${L.length} CHAPITRE${L.length > 1 ? "S" : ""}</span>${ed ? `<a data-action="bkEdit" data-tooltip="Réordonner, supprimer, gérer les repères" class="ms-btn small bk-mode${this.bookEditing ? " on" : ""}">${this.bookEditing ? `<i class="fa-solid fa-book-open-reader"></i> Lire le livre` : `<i class="fa-solid fa-list-check"></i> Organiser`}</a>` : ""}</div>`; }
  /* mise en page : colonnes CSS = pages ; une double page si la place le permet */
  #bookLayout() {
    const el = this.element?.querySelector(".bk[tabindex]"); if (!el || !el.isConnected) return; const book = el.querySelector(".bk-book"), flow = el.querySelector(".bk-flow"), inn = el.querySelector(".bk-in"); const body = this.element.querySelector(".ms-body");
    const z = (body.getBoundingClientRect().width / body.offsetWidth) || 1; /* zoom CSS de la fiche */ const vis = getComputedStyle(body).overflowY === "visible"; const top = (el.getBoundingClientRect().top - body.getBoundingClientRect().top) / z + body.scrollTop;
    const H = vis ? 560 : Math.max(380, Math.min(1100, body.clientHeight - top - 52 - 18)); book.style.height = `${H}px`;
    inn.style.transform = "none"; flow.scrollLeft = 0; const W = book.clientWidth; const spread = W >= 700; el.classList.toggle("single", !spread);
    const G = spread ? 64 : 40; inn.style.columnCount = spread ? 2 : 1; inn.style.columnGap = `${G}px`;
    const PW = spread ? (flow.clientWidth - G) / 2 : flow.clientWidth; const step = PW + G; const per = spread ? 2 : 1;
    const total = Math.max(1, Math.round((flow.scrollWidth + G) / step)); const spreads = Math.ceil(total / per);
    this._bk = { step, per, total, spreads };
    const fr = flow.getBoundingClientRect(); const pageOf = n => Math.max(0, Math.floor(((n.getBoundingClientRect().left - fr.left) / z + flow.scrollLeft + 2) / step));
    this._bkCh = {}; for (const c of inn.querySelectorAll(".bk-ch")) { const p = pageOf(c); this._bkCh[c.dataset.ch] = p; const b = inn.querySelector(`[data-tocp="${c.dataset.ch}"]`); if (b) b.textContent = p + 1; }
    if (this._bkGoto && this._bkCh[this._bkGoto] !== undefined) this.bookPg = Math.floor(this._bkCh[this._bkGoto] / per); this._bkGoto = null;
    this.bookPg = Math.min(Math.max(0, this.bookPg || 0), spreads - 1); this.#bookShow();
    for (const im of inn.querySelectorAll("img")) if (!im.complete && !im.dataset.bkw) { im.dataset.bkw = "1"; im.addEventListener("load", () => this.#bookLayout(), { once: true }); }
  }
  #bkCommit() { const p = this._bkPend; this._bkPend = null; if (p && Object.keys(p).length) return this.actor.update(p); }
  #bookCurCh() { const B = this._bk; if (!B) return bookOf(this.actor)[0]?.id; let cur = ""; for (const [id, pg] of Object.entries(this._bkCh || {})) if (pg < (this.bookPg + 1) * B.per) cur = id; return cur || Object.keys(this._bkCh || {})[0]; }
  #bookShow() { const el = this.element?.querySelector(".bk[tabindex]"); const B = this._bk; if (!el || !B) return; const flow = el.querySelector(".bk-flow");
    flow.scrollLeft = 0; flow.firstElementChild.style.transform = `translateX(${-this.bookPg * B.per * B.step}px)`; /* 1.58.3 : translation (le défilement était bloqué sur la dernière double page) */ const p1 = this.bookPg * B.per + 1, p2 = p1 + 1;
    el.querySelector('[data-pn="l"]').textContent = p1 <= B.total ? p1 : ""; el.querySelector('[data-pn="r"]').textContent = B.per === 2 && p2 <= B.total ? p2 : "";
    el.querySelector("[data-bkpg]").textContent = B.per === 2 ? `Pages ${p1}${p2 <= B.total ? `–${p2}` : ""} / ${B.total}` : `Page ${p1} / ${B.total}`;
    el.querySelector(".bk-hot.prev").classList.toggle("off", this.bookPg <= 0); el.querySelector(".bk-hot.next").classList.toggle("off", this.bookPg >= B.spreads - 1);
    const pages = Object.entries(this._bkCh || {}); let curCh = ""; for (const [id, pg] of pages) if (pg < (this.bookPg + 1) * B.per) curCh = id;
    for (const c of el.querySelectorAll(".bk-chip, .bk-spec")) c.classList.toggle("on", c.dataset.ch === curCh); }
  /* page qui tourne : une feuille pivote autour de la reliure, le contenu change à mi-course */
  #bookTurn(to) { const B = this._bk; const el = this.element?.querySelector(".bk[tabindex]"); if (!B || !el || this._bkBusy) return; to = Math.min(Math.max(0, to), B.spreads - 1); if (to === this.bookPg) return;
    const fwd = to > this.bookPg; const leaf = el.querySelector(".bk-leaf"); this._bkBusy = true;
    leaf.className = `bk-leaf ${fwd ? "fwd" : "back"}${el.classList.contains("single") ? " one" : ""} go`;
    setTimeout(() => { this.bookPg = to; this.#bookShow(); }, 230);
    setTimeout(() => { leaf.className = "bk-leaf"; this._bkBusy = false; }, 520); }
  _onRender(ctx, opts) { super._onRender?.(ctx, opts); try { snapFlash(this, this.actor); } catch (e) { /* rien */ } if (this.tab !== "background") { try { this._bgRO?.disconnect(); } catch (e) { /* rien */ } return; } this.#bgHead(); this.#bgInit(); }
  static #bkTurn(ev, t) { this.#bookTurn((this.bookPg || 0) + Number(t.dataset.d)); }
  static #bkGo(ev, t) { const id = t.dataset.ch; if (!this._bk) return; const p = id ? this._bkCh?.[id] ?? 0 : 0; this.#bookTurn(Math.floor(p / this._bk.per)); }
  static async #bkEdit() { if (!this.isEditable) return; await this.#bkCommit(); this.bookEditing = !this.bookEditing;
    if (this.bookEditing && !this.actor.getFlag(SYS, "book")?.ch) { const L = bookOf(this.actor); const ch = {}; L.forEach((c, i) => { ch[c.id] = { title: c.title, html: c.html, order: i }; }); if (!L.length) { const id = foundry.utils.randomID(8); ch[id] = { title: "Chapitre 1", html: "", order: 0 }; this.bookCh = id; } await this.actor.setFlag(SYS, "book", { ch }); }
    this.render(); }
  static async #bkAdd(ev, t) { const L = bookOf(this.actor); const sp = t?.dataset.special === "1"; const id = foundry.utils.randomID(8); this.bookCh = id; const n = L.filter(c => c.special === sp).length;
    await this.actor.update({ [`flags.${SYS}.book.ch.${id}`]: { title: sp ? "Repère" : `Chapitre ${n + 1}`, html: "", special: sp, icon: "fa-bookmark", order: L.length ? Math.max(...L.map(c => c.order)) + 1 : 0 } }); this.#openEditor(id); }
  static #bkQuick(ev, t) { const id = t?.dataset?.ch || this.#bookCurCh(); if (!id) return; this.#openEditor(id); }
  #openEditor(id) { this.bookQuick = null; ChapterEditor.open(this.actor, id, { onSaved: cid => { this._bkGoto = cid; } }); }
  static async #bkQuickClose() { await this.#bkCommit(); this._bkGoto = this.bookQuick; this.bookQuick = null; this.render(); }
  static #bkStyle() { this.bkStyleOpen = !this.bkStyleOpen; this.render(); }
  static async #bkSpec(ev, t) { const id = t.closest("[data-ch]").dataset.ch; const c = bookOf(this.actor).find(x => x.id === id); if (!c) return; await this.actor.update({ [`flags.${SYS}.book.ch.${id}.special`]: !c.special }); }
  static async #bkAccReset() { await this.actor.update({ [`flags.${SYS}.book.style.acc`]: "" }); }
  static async #bkSel(ev, t) { await this.#bkCommit(); this.bookCh = t.closest("[data-ch]").dataset.ch; this.render(); }
  static async #bkMove(ev, t) { const all = bookOf(this.actor); const me = all.find(c => c.id === t.closest("[data-ch]").dataset.ch); if (!me) return; const L = all.filter(c => c.special === me.special); const i = L.indexOf(me); const j = i + Number(t.dataset.d); if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]];
    await this.actor.update(Object.fromEntries(L.map((c, k) => [`flags.${SYS}.book.ch.${c.id}.order`, k]))); }
  static async #bkDel(ev, t) { const id = t.closest("[data-ch]").dataset.ch; const c = bookOf(this.actor).find(x => x.id === id); if (!c) return;
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Supprimer le chapitre", icon: "fa-solid fa-trash" }, classes: ["ms-dialog"], content: `<p>Supprimer « <b>${esc(c.title || "Chapitre")}</b> » et tout son texte ?</p>`, rejectClose: false }); if (!ok) return;
    if (this.bookCh === id) this.bookCh = null; if (this.bookQuick === id) this.bookQuick = null; await this.actor.update({ [`flags.${SYS}.book.ch.-=${id}`]: null }); }
  static async #qaUse(ev, t) { const it = this.actor.items.get(t.closest("[data-item]").dataset.item); if (!it) return;
    if (ev.shiftKey && (this.actor.system.favorites || []).includes(it.id)) { await this.actor.update({ "system.favorites": this.actor.system.favorites.filter(x => x !== it.id) }); return; }
    qaTouch(this.actor, it.id); const cfg = getConfig();
    if (featureOn(cfg, "dice") && it.system.formula) { await rollItem(this.actor, it); if (qaMode() === "smart") this.render(); } else it.sheet.render(true); }
  static #qaMode(ev, t) { try { localStorage.setItem("ms-qa-mode", t.dataset.m); } catch (e) { /* rien */ } this.render(); }
  static #qaCat(ev, t) { this.qaCat = this.qaCat === t.dataset.c ? null : t.dataset.c; this.render(); }
  static #qaFold() { try { localStorage.setItem("ms-qa-fold", qaFolded() ? "0" : "1"); } catch (e) { /* rien */ } this.render(); }

  /* ───────── actions ───────── */
  static async #tab(ev, t) { if (this.tab === "background" && t.dataset.tab !== "background") { try { await this.#bgSave(); } catch (e) { /* rien */ } } this.tab = t.dataset.tab; if (this.tab === "background") { this.bookEditing = false; this.bookQuick = null; } this.render(); }
  /* "+" tab : pick a hidden category, open its tab (it stays open until the sheet is closed, or forever once it holds an item) */
  static async #tabAdd(ev, t) {
    const cfg = getConfig(); const a = this.actor; const hidden = cfg.items.filter(r => !a.items.some(i => rootOf(cfg, i.system.category)?.id === r.id) && !this.shownRoots?.has(r.id));
    if (!hidden.length) return;
    const content = `<div class="ms-tabpick">${hidden.map(r => `<label class="opt" style="--tc:${esc(r.color || "var(--ms-acc)")}"><input type="radio" name="root" value="${r.id}"><i class="fa-solid ${esc(r.icon || "fa-cube")}"></i><span>${esc(r.name)}</span></label>`).join("")}</div>`;
    const id = await foundry.applications.api.DialogV2.prompt({ window: { title: "Ouvrir un onglet de catégorie", icon: "fa-solid fa-plus" }, classes: ["ms-dialog"], content, ok: { label: "Ouvrir", callback: (ev, btn) => btn.form.elements.root?.value || null } });
    if (!id) return; (this.shownRoots ??= new Set()).add(id); this.tab = id; this.render();
  }
  static async #eqGroup() { this.eqGroup = this.eqGroup === false; this.render(); }
  static async #sub(ev, t) { this.sub[t.dataset.group] = t.dataset.sub; this.render(); }
  static async #stat(ev, t) { const run = (this._statQ || Promise.resolve()).then(() => this.#statLocked(t)); this._statQ = run.catch(() => {}); return run; }   /* 1.59 : clics rapides à la suite (file de la fiche) ; le paiement passe par la file du MJ (tx), pas sous le verrou du personnage (sinon blocage) */   /* lecture + écriture sous verrou : clics rapides et mouvements d'or simultanés ne se mélangent plus */
  async #statLocked(t) {
    const key = t.closest(".ms-stat").dataset.stat; const cfg = getConfig(); const st = cfg.stats.find(x => x.key === key); if (!st) return;
    const s = this.actor.system; const v = Number(s.stats[key]) || st.min || 0; const up = t.dataset.action === "statPlus"; const p = cfg.progression; const gm = game.user.isGM;
    if (!up) { if (v <= (st.min ?? 0)) return; const add = { [`system.stats.${key}`]: -1 }; if (p.paidStats && p.refundOnLower && !gm) { const res = cfg.resources.find(r => r.key === p.payWith); if (res) add[`system.resources.${res.key}`] = costOfStep(cfg, v - 1, st); } this._selfT = Date.now(); return tx(this.actor, { add, min: { [`system.stats.${key}`]: st.min ?? 0 } }); }
    if (st.locked && !s.statsUnlocked?.[key]) return ui.notifications.warn(p.messages.locked);
    if ((st.max && v >= st.max) || (p.capPerStat && v >= p.capPerStat)) return ui.notifications.warn(p.messages.cap);
    if (p.capTotal && (s.statsTotal || 0) >= p.capTotal) return ui.notifications.warn(p.messages.total);
    /* 1.59 : achat par la file du MJ — le prix est retiré du solde réel (un Gold reçu au même moment n'est plus perdu) ; refusé si le solde réel ne suffit pas */
    const add = { [`system.stats.${key}`]: 1 }; const need = {}; let res = null;
    if (p.paidStats && !(gm && game.settings.get(SYS, "gmFree"))) { res = cfg.resources.find(r => r.key === p.payWith); const cost = costOfStep(cfg, v, st); const have = Number(s.resources[res?.key]) || 0; if (res && cost > have) return ui.notifications.warn(p.messages.broke.replace("{resource}", res.name)); if (res && cost) { add[`system.resources.${res.key}`] = -cost; need[`system.resources.${res.key}`] = 0; } }
    this._selfT = Date.now(); const r = await tx(this.actor, { add, need }); if (r && !r.ok && r.why === "need" && res) ui.notifications.warn(p.messages.broke.replace("{resource}", res.name));
  }
  /* 1.39 : jauges réactives — chaque clic change l'affichage tout de suite, la valeur n'est enregistrée qu'une fois, 0,4 s après le dernier clic */
  #gEff(key) { return { ...(this.actor.system.gauges?.[key] || {}), ...(this._gp?.[key] || {}) }; }
  #gPush(key, patch) {
    const b = ((this._gb ||= {})[key] ||= {}); for (const f of Object.keys(patch)) if (!(f in b)) b[f] = Number(this.actor.system.gauges?.[key]?.[f]) || 0;   /* valeur de départ : on n'enverra que l'écart */
    (this._gp ||= {})[key] = { ...(this._gp[key] || {}), ...patch }; this.#gPaint(key);
    clearTimeout(this._gpT); this._gpT = setTimeout(() => this.#gCommit(), 400);
  }
  /* 1.59 : on envoie l'ÉCART (par la file du MJ) : si le MJ a changé la jauge entre-temps, les deux changements s'additionnent */
  async #gCommit() { const gp = this._gp, gb = this._gb || {}; this._gp = null; this._gb = null; if (!gp) return; const add = {}, set = {}, min = {}, max = {};
    for (const [k, o] of Object.entries(gp)) for (const [f, v] of Object.entries(o)) { const path = `system.gauges.${k}.${f}`;
      if (f === "value") { const d = (Number(v) || 0) - (Number(gb[k]?.[f]) || 0); if (d) { add[path] = d; const cg = getConfig().gauges.find(x => x.key === k); min[path] = cg && isStageGauge(cg) ? 1 : 0; const mx = Number(this.actor.system.gauges?.[k]?.max); if (mx) max[path] = mx; } }
      else set[path] = v; }
    if (Object.keys(add).length || Object.keys(set).length) { this._selfT = Date.now(); await tx(this.actor, { add, set, min, max }); } }
  #gPaint(key) {
    const el = this.element?.querySelector(`.ms-gauge[data-gauge="${CSS.escape(key)}"]`); if (!el) return; const cfg = getConfig(); const cg = cfg.gauges.find(x => x.key === key); const g = this.#gEff(key);
    if (el.classList.contains("stages")) { const st = gaugeStages(cg); const n = st.length; const v = stageOf(cg, g, n); el.style.setProperty("--pct", `${Math.round(v / n * 100)}%`); el.querySelectorAll(".seg").forEach((x, i) => x.classList.toggle("on", i < v)); const b = el.querySelector(".stg b"); if (b) b.textContent = st[v - 1] || ""; const sm = el.querySelector(".stg small"); if (sm) sm.textContent = stageNum(cfg, v, n);
      for (const c of ["warn", "crit", "empty"]) el.classList.toggle(c, gaugeState(cfg, v, n) === c); return; }
    const max = Number(g.max) || 0, val = Math.max(0, Number(g.value) || 0); const pct = max ? Math.min(100, Math.round(val / max * 100)) : 0; const state = gaugeState(cfg, val, max);
    el.style.setProperty("--pct", `${pct}%`); const inp = el.querySelector(`input[name="system.gauges.${key}.value"]`); if (inp) inp.value = val; const pc = el.querySelector(".pct"); if (pc) pc.textContent = `${pct}%`;
    for (const c of ["warn", "crit", "empty", "low"]) el.classList.toggle(c, state === c); const stx = el.querySelector(".top .st"); if (stx) stx.textContent = state === "empty" ? "À TERRE" : state === "crit" ? "CRITIQUE" : state === "warn" ? "BAS" : "";
  }
  static async #gaugeSet(ev, t) { if (t.hasAttribute("disabled")) return; const key = t.closest("[data-gauge]").dataset.gauge; const cfg = getConfig(); const cg = cfg.gauges.find(x => x.key === key); const s = Number(t.dataset.v) || 1;
    if (narrativeGaugesOn(cfg) && cg && !isStageGauge(cg)) { const gv = this.#gEff(key); const v = valueForStage(gv, s, gaugeStages(cg).length); return this.#gPush(key, v === null ? { stage: s } : { value: v, stage: s }); }
    this.#gPush(key, { value: s }); }
  static async #gauge(ev, t) { if (t.hasAttribute("disabled")) return; const key = t.closest("[data-gauge]").dataset.gauge; const g = this.#gEff(key); const step = ev.shiftKey ? 10 : 1; const cfg = getConfig(); const cg = cfg.gauges.find(x => x.key === key); const narr = narrativeGaugesOn(cfg) && cg && !isStageGauge(cg);
    if (narr) { const n = gaugeStages(cg).length; const nx = Math.max(1, Math.min(n, stageOf(cg, g, n) + Number(t.dataset.d))); const v = valueForStage(g, nx, n); return this.#gPush(key, v === null ? { stage: nx } : { value: v, stage: nx }); }
    const stage = cg && isStageGauge(cg); const cur = stage ? Math.max(1, Math.min(Number(g.max) || 10, Number(g.value) || Number(g.max) || 10)) : (Number(g.value) || 0); const v = Math.max(stage ? 1 : 0, Math.min(Number(g.max) || Infinity, cur + Number(t.dataset.d) * (stage ? 1 : step))); this.#gPush(key, { value: v }); }
  static async #rollStat(ev, t) { await rollStat(this.actor, t.closest(".ms-stat").dataset.stat); }
  static async #rollItem(ev, t) { const it = this.actor.items.get(t.closest("[data-item]").dataset.item); if (it) await rollItem(this.actor, it); }
  static async #fav(ev, t) { const id = t.closest("[data-item]").dataset.item; const f = [...(this.actor.system.favorites || [])]; const i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else f.push(id); await this.actor.update({ "system.favorites": f }); }
  static async #levelUp() { const cfg = getConfig(); const s = this.actor.system; const need = xpNeeded(cfg, s.level); if ((Number(s.xp) || 0) < need) return; this._selfT = Date.now();
    /* 1.59 : par la file du MJ, sur l'XP réelle (refusé si elle ne suffit plus) */
    if (cfg.xp.carry === false) return tx(this.actor, { add: { "system.level": 1, "system.xp": -need }, need: { "system.xp": 0 }, set: {} }).then(r => r?.ok && this.actor.update({ "system.xp": 0 }));
    return tx(this.actor, { add: { "system.level": 1, "system.xp": -need }, need: { "system.xp": 0 } }); }
  static async #reassignTo(ev, t) { const it = this.actor.items.get(t.closest("[data-item]").dataset.item); if (it && t.dataset.cat) await it.update({ "system.category": t.dataset.cat }); }
  static async #reassign(ev, t) { const it = this.actor.items.get(t.closest("[data-item]").dataset.item); if (!it) return; const cat = await pickCategory(getConfig()); if (cat) await it.update({ "system.category": cat }); }
  static async #unlockStat(ev, t) { if (!game.user.isGM) return; const key = t.closest(".ms-stat").dataset.stat; await this.actor.update({ [`system.statsUnlocked.${key}`]: true }); }
  static async #itemCreate(ev, t) { const cfg = getConfig(); const cat = await pickCategory(cfg, t.dataset.root, t.dataset.sub); if (!cat) return; const node = flattenTree(cfg.items).find(n => n.id === cat); const [it] = await this.actor.createEmbeddedDocuments("Item", [{ name: `Nouveau · ${node?.name || "objet"}`, type: "item", system: { category: cat, rank: cfg.ranks[0]?.key || "", rarity: cfg.rarities[0]?.key || "" } }]); it?.sheet.render(true); }
  static async #itemEdit(ev, t) { this.actor.items.get(t.closest("[data-item]").dataset.item)?.sheet.render(true); }
  static async #itemDelete(ev, t) { const it = this.actor.items.get(t.closest("[data-item]").dataset.item); if (!it) return; if (await foundry.applications.api.DialogV2.confirm({ window: { title: "Supprimer l'objet" }, classes: ["ms-dialog"], content: `<p>Supprimer <b>${esc(it.name)}</b> ?</p>` })) await it.delete(); }
  slotMax(cfg) { const base = Number(cfg.equipment.slots) || 0; return base ? base + equippedBags(this.actor).reduce((n, b) => n + (Number(b.system.slots) || 0), 0) : 0; }
  /* 1.38 : plusieurs sacs équipés, leurs places s'additionnent */
  static async #bags() { const a = this.actor; const cfg = getConfig(); if (!this.isEditable || lockedFor(cfg, "bag")) return; const bags = a.items.filter(i => isBagCategory(cfg, i.system.category)); if (!bags.length) return ui.notifications.info("Aucun sac : ajoute-en un dans l'onglet Sacs.");
    const base = Number(cfg.equipment.slots) || 0; const used = slotsUsed(a);
    const ids = await equipPicker({ title: "Sacs équipés", icon: "fa-sack-dollar", color: "#c9a06a", items: bags, on: equippedBags(a).map(b => b.id), fav: true, favLabel: "Sac favori",
      pill: b => { const n = Number(b.system.slots) || 0; return n ? { t: `<i class="fa-solid fa-plus"></i> ${n} place${n > 1 ? "s" : ""}`, c: "#3ddc84" } : { t: "aucune place", c: "#8ea0c8" }; },
      free: sel => base ? base + sel.reduce((n, id) => n + (Number(a.items.get(id)?.system.slots) || 0), 0) - used : null });
    if (!Array.isArray(ids)) return; await a.update({ "system.equippedBags": ids, "system.equippedBag": ids[0] || "" }); }
  /* 1.39 : choix des titres équipés (même fenêtre que les sacs), limite = « Titres équipables en même temps » */
  static async #titlePick() { const a = this.actor; const cfg = getConfig(); if (!this.isEditable) return; const list = a.items.filter(i => rootOf(cfg, i.system.category)?.id === "title"); if (!list.length) return ui.notifications.info("Aucun titre : ajoute-en un dans l'onglet Titres.");
    const max = Math.max(1, Number(cfg.equipment.titles) || 1);
    const ids = await equipPicker({ title: "Titres équipés", icon: "fa-crown", color: "#f5c518", items: list, on: equippedTitles(a), max, fav: true, favLabel: "Titre favori" });
    if (!Array.isArray(ids)) return; await a.update({ "system.equippedTitles": ids, "system.equippedTitle": ids[0] || "" }); }
  static async #itemEquip(ev, t) { const it = this.actor.items.get(t.closest("[data-item]").dataset.item); if (!it) return; const cfg = getConfig(); const max = this.slotMax(cfg); const cost = Number.isFinite(Number(it.system.slotCost)) ? Number(it.system.slotCost) : 1; if (!it.system.equipped && max && slotsUsed(this.actor) + cost > max + 1e-9) return ui.notifications.warn(`Plus de place : ${fmtSlots(slotsUsed(this.actor))} / ${fmtSlots(max)} places occupées, cet objet en prend ${fmtSlots(cost)}.`); await it.update({ "system.equipped": !it.system.equipped }); }
  static async #itemAmmo(ev, t) { const id = t.closest("[data-item]").dataset.item; await actorLock(this.actor, async () => { const it = this.actor.items.get(id); if (!it) return; const a = it.system.ammo || {}; const max = Number(a.max) || 0, cur = Number(a.value) || 0; const v = ev.shiftKey && Number(t.dataset.d) > 0 ? max : Math.max(0, Math.min(max || Infinity, cur + Number(t.dataset.d))); if (v !== cur) await it.update({ "system.ammo.value": v }); }); }
  /* MJ : ce que cette fiche affiche, son style, les icônes du Menu pour cette fiche et pour ses joueurs */
  static async #sheetHist() { if (!game.user.isGM) return; const L = historyOf(this.actor); const cfg = getConfig();
    const lab = k => { const m = k.match(/^system\.resources\.(.+)$/); if (m) return cfg.resources.find(r => r.key === m[1])?.name || m[1]; const g = k.match(/^system\.gauges\.([^.]+)\.(\w+)$/); if (g) return `${cfg.gauges.find(x => x.key === g[1])?.name || g[1]} (${g[2]})`; return { "system.xp": "XP", "system.level": "Niveau", name: "Nom" }[k] || k.replace(/^system\./, "").replace(/^flags\.[^.]+\./, ""); };
    const val = v => v === undefined ? "…" : typeof v === "object" ? "(…)" : esc(String(v).replace(/<[^>]+>/g, "").slice(0, 40));
    const html = L.length ? L.map(e => `<div class="ms-hrow"><header><b>${esc(e.u)}</b>${e.tx ? `<em title="Passé par la file du MJ">file MJ</em>` : ""}<small>${new Date(e.t).toLocaleTimeString("fr-FR")}</small></header>${e.rows.slice(0, 8).map(r => `<div><span>${esc(lab(r.k))}</span><i>${val(r.from)}</i><i class="fa-solid fa-arrow-right"></i><b>${val(r.to)}</b></div>`).join("")}${e.rows.length > 8 ? `<small>+${e.rows.length - 8} autres champs</small>` : ""}</div>`).join("") : `<p class="ms-mhint">Rien depuis l'ouverture de Foundry.</p>`;
    await foundry.applications.api.DialogV2.wait({ window: { title: `Historique — ${this.actor.name}`, icon: "fa-solid fa-clock-rotate-left" }, classes: ["ms-dialog", "ms-histdlg"], position: { width: 520 }, content: `<p class="ms-mhint">Modifications de cette fiche depuis l'ouverture de Foundry (60 dernières), avec leur auteur.</p><div class="ms-hist">${html}</div>`, buttons: [{ action: "ok", label: "Fermer", icon: "fa-solid fa-check", default: true }], rejectClose: false }); }
  static async #sheetDisp() { if (!game.user.isGM) return; await sheetDisplayDialog(this.actor); }
  static async #itemQty(ev, t) { const id = t.closest("[data-item]").dataset.item; await actorLock(this.actor, async () => { const it = this.actor.items.get(id); if (!it) return; await it.update({ "system.quantity": Math.max(0, (Number(it.system.quantity) || 0) + Number(t.dataset.d)) }); }); }
  static async #equipTitle(ev, t) { const id = t.closest("[data-item]").dataset.item; const cfg = getConfig(); const max = Math.max(1, Number(cfg.equipment.titles) || 1); let list = equippedTitles(this.actor);
    if (list.includes(id)) list = list.filter(x => x !== id); else if (max === 1) list = [id]; else if (list.length >= max) return ui.notifications.warn(`Déjà ${max} titre${max > 1 ? "s" : ""} équipé${max > 1 ? "s" : ""} (réglable dans Configuration de la fiche › Fiche).`); else list = [...list, id];
    await this.actor.update({ "system.equippedTitles": list, "system.equippedTitle": list[0] || "" }); }
  /* liste des titres équipés (clic sur la puce Titre quand il y en a plusieurs) */
  static #carnet() { MenuApp.open(this.actor); }
  static #pickClass() { pickClass(this.actor); }
  static #pickSub() { pickSub(this.actor); }
  static async #titles() { const cfg = getConfig(); const list = equippedTitles(this.actor).map(id => this.actor.items.get(id)).filter(Boolean); if (list.length < 2) return;
    const rows = list.map(i => { const r = rankOf(cfg, i.system.rank); const rar = cfg.rarities.find(x => x.key === i.system.rarity); return `<div class="row" data-item="${i.id}" style="--rc:${esc(r?.color || "#fff")}"><img src="${esc(i.img)}"><div class="t"><b>${esc(i.name)}</b><small><span class="ms-rank">${esc(r?.name || "")}</span>${rar ? ` <span class="ms-rar" style="--rc:${esc(rar.color)}">${esc(rar.name)}</span>` : ""}</small>${i.system.description ? `<div class="d">${i.system.description}</div>` : ""}</div></div>`; }).join("");
    await foundry.applications.api.DialogV2.wait({ window: { title: `Titres équipés (${list.length})`, icon: "fa-solid fa-crown" }, classes: ["ms-dialog", "ms-titles-dlg"], position: { width: 520 }, content: `<div class="ms-titles">${rows}</div>`, buttons: [{ action: "ok", label: "Fermer", icon: "fa-solid fa-check", default: true }], rejectClose: false }); }
}

/* saisie relative : « +200 » ajoute, « -200 » (ou « −200 ») retire, un nombre seul remplace ; écrit la valeur finale avant l'envoi du formulaire */
export function relInput(ev, doc) {
  const el = ev.target; if (!el?.matches?.("input.ms-rel")) return;
  const cur = Number(foundry.utils.getProperty(doc, el.name)) || 0; const raw = String(el.value).trim().replace(/\s/g, "").replace(/−/g, "-").replace(",", ".");
  const m = raw.match(/^([+-])(\d+(?:\.\d+)?)$/); let v;
  /* 1.59 : « +200 / −200 » sur un personnage = un écart envoyé à la file du MJ (ajouté au solde RÉEL, jamais à un affichage en retard) */
  if (m && doc?.documentName === "Actor") { ev.stopImmediatePropagation(); const d = (m[1] === "-" ? -1 : 1) * Number(m[2]); const min = el.dataset.min !== undefined && el.dataset.min !== "" ? Number(el.dataset.min) : undefined; const app = foundry.applications.instances.get(el.closest(".application")?.id); if (app) app._selfT = Date.now();
    el.value = String(Math.max(min ?? -Infinity, cur + d)); const gm = el.name.match(/^system\.gauges\.([^.]+)\.value$/); const mx = gm ? Number(doc.system.gauges?.[gm[1]]?.max) || null : null; tx(doc, { add: { [el.name]: d }, ...(min !== undefined ? { min: { [el.name]: min } } : {}), ...(mx ? { max: { [el.name]: mx } } : {}) }); return; }
  if (m) v = cur + (m[1] === "-" ? -1 : 1) * Number(m[2]); else if (/^=?\d+(?:\.\d+)?$/.test(raw)) v = Number(raw.replace("=", "")); else { el.value = cur; ev.stopImmediatePropagation(); return; }
  const min = el.dataset.min !== undefined && el.dataset.min !== "" ? Number(el.dataset.min) : -Infinity; v = Math.max(min, Math.round(v * 100) / 100); el.value = String(v);
}

/* bouton MENU néon : palier selon le niveau du personnage (1-9, 10-29, 30-59, 60-99, 100+), ou palier imposé par le MJ */
export const MENU_BTN_TIERS = ["Automatique (selon le niveau)", "Palier 1 — néon simple", "Palier 2 — double liseré", "Palier 3 — pulsation HUD", "Palier 4 — dégradé animé", "Palier 5 — irisé à particules"];
export function menuBtnTier(a) { const f = Number(a?.getFlag?.(SYS, "menuBtnTier")) || 0; if (f >= 1 && f <= 5) return f; const lv = Number(a?.system?.level) || 0; return lv >= 100 ? 5 : lv >= 60 ? 4 : lv >= 30 ? 3 : lv >= 10 ? 2 : 1; }
/* réglages d'affichage d'une fiche (MJ) — 1.58 : fenêtre à rail de catégories (sheetdisp.js) */
export async function sheetDisplayDialog(actor) { return SheetDisplayApp.open(actor); }