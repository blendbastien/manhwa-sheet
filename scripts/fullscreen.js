/* Manhwa Sheet 1.29 — plein écran des grandes fenêtres de la suite (Appel des Étoiles, Boutique stellaire, Catalogue).
 * Une fenêtre qui porte la classe « ms-fsable » occupe tout l'écran, sans l'en-tête de Foundry, avec trois commandes :
 *  • grosse flèche néon « retour » (écran précédent, posé par attachBack) ;
 *  • « réduire » : la fenêtre devient une barre en bas de l'écran, un clic la remet en plein écran ;
 *  • « quitter » : retour au Menu si on venait du Menu (app._msFromMenu), sinon fermeture.
 * Fichier autonome (aucun import) : les modules peuvent l'utiliser sans dépendre du reste du système. */
export const FS_CLASS = "ms-fsable";
export const isFs = app => !!(app?.options?.classes?.includes?.(FS_CLASS) || app?.element?.classList?.contains(FS_CLASS));

const ARROW = `<svg viewBox="0 0 96 64" aria-hidden="true"><defs><linearGradient id="msfsA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9fdff"/><stop offset=".45" stop-color="#5ef0ff"/><stop offset="1" stop-color="#1a7dff"/></linearGradient></defs>
  <path class="tr t2" d="M70 14 L52 32 L70 50"/><path class="tr t1" d="M84 14 L66 32 L84 50"/>
  <path class="ar" d="M34 6 L8 32 L34 58 L34 42 L62 42 L62 22 L34 22 Z" fill="url(#msfsA)"/></svg>`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function titleOf(app) { try { return app.title || app.options?.window?.title || ""; } catch (e) { return ""; } }
function iconOf(app) { return app.options?.window?.icon || "fa-solid fa-window-maximize"; }

/** pose les commandes (une seule fois par élément) puis les met à jour */
export function fsMount(app) {
  const el = app?.element; if (!el || !isFs(app)) return;
  el.classList.add("ms-fs", FS_CLASS);
  let ctl = el.querySelector(":scope > .ms-fs-ctl");
  if (!ctl) {
    ctl = document.createElement("div"); ctl.className = "ms-fs-ctl";
    ctl.innerHTML = `<div class="ms-fs-ttl"><i class="ic"></i><b></b></div><button type="button" class="ms-fs-back" data-fs="back">${ARROW}<span class="lb"></span></button>
      <div class="ms-fs-r"><button type="button" class="ms-fs-btn" data-fs="min" data-tooltip="Réduire en barre"><i class="fa-solid fa-minus"></i></button><button type="button" class="ms-fs-btn x" data-fs="quit"><i class="fa-solid fa-xmark"></i></button></div>`;
    const bar = document.createElement("div"); bar.className = "ms-fs-bar"; bar.dataset.fs = "restore";
    el.append(ctl, bar);
    const onClick = ev => { const b = ev.target.closest("[data-fs]"); if (!b) return; ev.preventDefault(); ev.stopPropagation(); fsAct(app, b.dataset.fs); };
    ctl.addEventListener("click", onClick); bar.addEventListener("click", onClick);
    /* clic droit sur la barre réduite : fermer directement */
    bar.addEventListener("contextmenu", ev => { ev.preventDefault(); fsAct(app, "quit"); });
  }
  fsSync(app);
}

/** met à jour flèche, bulle d'aide de « quitter » et barre réduite */
export function fsSync(app) {
  const el = app?.element; if (!el) return; const ctl = el.querySelector(":scope > .ms-fs-ctl"); if (!ctl) return;
  const back = typeof app._msBack === "function"; el.classList.toggle("has-back", back);
  const bk = ctl.querySelector(".ms-fs-back"); bk.dataset.tooltip = back ? `Revenir : ${app._msBackLabel || "Précédent"}` : ""; bk.querySelector(".lb").textContent = back ? (app._msBackLabel || "") : "";
  ctl.querySelector('[data-fs="quit"]').dataset.tooltip = typeof app._msFromMenu === "function" ? "Quitter (retour au Menu)" : "Fermer";
  const tt = ctl.querySelector(".ms-fs-ttl"); if (tt) { tt.querySelector(".ic").className = `ic ${iconOf(app)}`; tt.querySelector("b").textContent = titleOf(app);
    /* 1.36.2 : sous-titre en grand dans le bandeau (ex. Worldbook › Atlas des mondes) */
    tt.querySelector("em.sub")?.remove(); const sub = app.options?.window?.subtitle || ""; let em = ctl.querySelector(":scope > .ms-fs-sub");
    if (sub && !em) { em = document.createElement("div"); em.className = "ms-fs-sub"; ctl.append(em); } if (em) { em.textContent = sub; em.hidden = !sub; } }
  const bar = el.querySelector(":scope > .ms-fs-bar");
  if (bar) bar.innerHTML = `<i class="ic ${esc(iconOf(app))}"></i><b>${esc(titleOf(app))}</b><span class="hint">Agrandir</span><i class="up fa-solid fa-up-right-and-down-left-from-center"></i><button type="button" class="x" data-fs="quit" data-tooltip="Fermer"><i class="fa-solid fa-xmark"></i></button>`;
  el.classList.toggle("ms-fs-min", !!app._msFsMin);
}

/* 1.36.2 — plusieurs fenêtres réduites : les barres se rangent côte à côte (puis sur plusieurs rangées), au lieu de s'empiler */
export function fsLayout() {
  /* fenêtres de la suite réduites + barres « externes » (ex. Carte Stellaire : élément .ms-fs-min-ext avec data-min-at) */
  const list = [...[...(foundry.applications.instances?.values?.() ?? [])].filter(a => (a._msFsMin || a._msWinMin) && a.element?.isConnected).map(a => ({ element: a.element, at: a._msFsMinAt || 0 })),
    ...[...document.querySelectorAll(".ms-fs-min-ext")].map(el => ({ element: el, at: Number(el.dataset.minAt) || 0 }))].sort((a, b) => a.at - b.at);
  const gap = 12, minW = 230, maxW = 560, avail = Math.max(minW, window.innerWidth * 0.92);
  const perRow = Math.max(1, Math.floor((avail + gap) / (minW + gap)));
  list.forEach((a, i) => {
    const row = Math.floor(i / perRow), inRow = Math.min(perRow, list.length - row * perRow), col = i % perRow;
    const w = Math.min(maxW, (avail - (inRow - 1) * gap) / inRow); const total = inRow * w + (inRow - 1) * gap;
    const x = (window.innerWidth - total) / 2 + col * (w + gap); const el = a.element;
    el.style.setProperty("--ms-fs-x", `${Math.round(x)}px`); el.style.setProperty("--ms-fs-w", `${Math.round(w)}px`); el.style.setProperty("--ms-fs-b", `${84 + row * 72}px`);
  });
}
const fsClear = el => { if (!el) return; for (const v of ["--ms-fs-x", "--ms-fs-w", "--ms-fs-b"]) el.style.removeProperty(v); };
window.addEventListener("resize", () => fsLayout());
globalThis.msFsLayout = fsLayout;   /* pour les modules qui ont leur propre barre réduite */

export async function fsMinimize(app, on = true) {
  app._msFsMin = !!on; if (on) app._msFsMinAt = Date.now(); else fsClear(app.element); app.element?.classList.toggle("ms-fs-min", !!on); fsLayout();
  if (!on) try { app.bringToFront?.(); } catch (e) {}
  try { app.onFsMinimize?.(!!on); } catch (e) { console.warn("manhwa-sheet | plein écran", e); }
}

async function fsAct(app, a) {
  if (a === "min") return fsMinimize(app, true);
  if (a === "restore") return fsMinimize(app, false);
  if (a === "back") { const f = app._msBack; if (typeof f !== "function") return; app._msBack = null; app._msFromMenu = null; await app.close({ animate: false }); return f(); }
  if (a === "quit") { const m = app._msFromMenu; app._msBack = null; app._msFromMenu = null; await app.close({ animate: false }); if (typeof m === "function") return m(); }
}

/* toute fenêtre « ms-fsable » reçoit ses commandes à chaque affichage (idempotent) */
Hooks.on("renderApplicationV2", app => { if (isFs(app)) fsMount(app); });
/* fenêtre fermée : elle se rouvrira en plein écran */
Hooks.on("closeApplicationV2", app => { if (app) { app._msFsMin = false; fsClear(app.element); } setTimeout(fsLayout, 0); });

/* 1.53 — fenêtres de la suite (fiches, téléphone, menus…) réduites d'un double-clic : petite barre rangée en bas de l'écran,
 * avec les autres fenêtres réduites (au lieu d'un gros carré qui reste au milieu). Clic sur la barre = rouvrir. */
/* 1.64.2 : seulement les fenêtres du Menu ; les fiches (personnages, objets… : tout ce qui a un document) gardent le double-clic normal de Foundry */
const isOurs = app => { const el = app?.element; if (!el || el.classList.contains("ms-fs")) return false; if (app instanceof foundry.applications.api.DocumentSheetV2 || (globalThis.DocumentSheet && app instanceof globalThis.DocumentSheet)) return false;
  return typeof app._msFromMenu === "function" || el.classList.contains("ms-menu") || el.classList.contains("ms-menu-dialog") || el.classList.contains("ms-wiki") || el.classList.contains("ms-pcstudio") || el.classList.contains("ms-phone-app") || /^ms-/.test(el.id || ""); };
Hooks.once("init", () => {
  const AV2 = foundry.applications.api.ApplicationV2; const P = AV2.prototype; const om = P.minimize, ox = P.maximize, oc = P.close;
  P.minimize = async function (...args) { if (!this.minimized && isOurs(this)) { const p = this.position || {}; this._msPrePos = { left: p.left, top: p.top, width: p.width, height: p.height }; } const r = await om.apply(this, args);
    if (this.minimized && isOurs(this)) { this._msWinMin = true; this._msFsMinAt = Date.now(); const el = this.element; el.classList.add("ms-win-min");
      if (!el.dataset.mwm) { el.dataset.mwm = "1"; el.querySelector(".window-header")?.addEventListener("click", ev => { if (!this._msWinMin || ev.target.closest("button, a, [data-action]")) return; this.maximize(); }); }
      fsLayout(); }
    return r; };
  /* 1.54 : à la réouverture, la fenêtre reprend exactement sa place et son format d'avant. L'animation d'agrandissement de Foundry tourne encore
   * quand maximize() rend la main et bride la hauteur (max-height animé depuis la barre) : on l'arrête, puis on remet la taille d'avant. */
  P.maximize = async function (...args) { const was = this._msWinMin; if (was) { this._msWinMin = false; this.element?.classList.remove("ms-win-min"); fsClear(this.element); fsLayout(); }
    const r = await ox.apply(this, args); const pre = this._msPrePos; this._msPrePos = null;
    if (was && pre && typeof pre.width === "number") { const el = this.element; if (el) { try { el.getAnimations().forEach(a => a.cancel()); } catch (e) {} for (const k of ["inset", "right", "bottom", "translate", "transform", "max-height", "max-width"]) el.style.removeProperty(k); } this.setPosition({ left: pre.left, top: pre.top, width: pre.width, height: typeof pre.height === "number" ? pre.height : undefined }); }
    return r; };
  P.close = async function (...args) { const was = this._msWinMin; this._msWinMin = false; const r = await oc.apply(this, args); if (was) setTimeout(fsLayout, 50); return r; };
});
