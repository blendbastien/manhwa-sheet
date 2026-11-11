/* Manhwa Sheet — fenêtres de la suite Manhwa : taille et place mémorisées par joueur (navigateur), taille minimale,
 * et jamais plus grandes que l'écran. S'applique aux fenêtres du système et des modules compagnons
 * (Appel des Étoiles, Catalogue, Véhicules, PNJ, Sidebar, Scénarios, Encyclopédie), pas aux petites boîtes de dialogue. */
const KEEP = /^(ms-sheet|ms-config|gm-app|vm-sheet|sm-journal|sbd-sheet|pm-manager|lh-frame|lh-admin|bq-frame|bq-map-form)$/;
const SKIP = /(^|-)dialog$/;
const KEY = "manhwa-winpos";
const MIN = { w: 380, h: 280 };
const ours = classes => { const c = classes || []; return c.some(x => KEEP.test(x)) && !c.some(x => SKIP.test(x)) && !c.includes("ms-fsable"); };   /* plein écran (1.29) : rien à mémoriser */
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } };
const save = m => { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} };
/* une fiche (acteur, objet) garde sa taille pour tous les documents du même type ; une fenêtre unique garde aussi sa place */
const keyOf = (o, ctor) => o?.document ? `sheet:${ctor?.name}:${o.document.documentName}:${o.document.type}` : `app:${o?.id || ctor?.name}`;
const fit = p => { const W = window.innerWidth, H = window.innerHeight; const o = { ...p };
  if (typeof o.width === "number") o.width = Math.min(o.width, W - 16); if (typeof o.height === "number") o.height = Math.min(o.height, H - 16);
  if (typeof o.left === "number") o.left = Math.max(0, Math.min(o.left, W - Math.min(200, (o.width || 400)))); if (typeof o.top === "number") o.top = Math.max(0, Math.min(o.top, H - 60)); return o; };

Hooks.once("init", () => {
  const AV2 = foundry.applications.api.ApplicationV2; const P = AV2.prototype;
  const init0 = P._initializeApplicationOptions;
  P._initializeApplicationOptions = function (options) {
    const o = init0.call(this, options);
    try { if (ours(o.classes)) { const k = keyOf(o, this.constructor); this._msWinKey = k; const s = load()[k];
      const pos = { ...(o.position || {}) }; const mn = this.constructor.MIN_SIZE || MIN; if (s) { if (s.width) pos.width = Math.max(mn.w, s.width); if (s.height) pos.height = Math.max(mn.h, s.height); if (!o.document && s.left != null) { pos.left = s.left; pos.top = s.top; } }
      o.position = fit(pos); } } catch (e) { console.warn("manhwa-sheet | winmem", e); }
    return o;
  };
  const set0 = P.setPosition;
  P.setPosition = function (pos) {
    if (this._msWinKey && pos && !this.minimized) { const m = this.constructor.MIN_SIZE || MIN; if (typeof pos.width === "number" && pos.width < m.w) pos.width = m.w; if (typeof pos.height === "number" && pos.height < m.h) pos.height = m.h; }
    const r = set0.call(this, pos);
    if (this._msWinKey && this.rendered && !this.minimized && !this._msWinMin && !this.element?.classList.contains("maximizing")) { const k = this._msWinKey, p = this.position; clearTimeout(this._msTm); this._msTm = setTimeout(() => { if (typeof p.width !== "number") return; const all = load(); all[k] = { width: Math.round(p.width), height: typeof p.height === "number" ? Math.round(p.height) : undefined, left: Math.round(p.left), top: Math.round(p.top) }; save(all); }, 500); }
    return r;
  };
  /* l'écran rétrécit (fenêtre du navigateur, zoom) : on ramène les fenêtres ouvertes dedans */
  let rt = null; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { for (const app of foundry.applications.instances.values()) { if (!app._msWinKey || !app.rendered || app.minimized) continue; const p = app.position, f = fit(p); if (f.width !== p.width || f.height !== p.height || f.left !== p.left || f.top !== p.top) app.setPosition(f); } }, 250); });
});
