/* Manhwa Sheet 1.60.3 — ÉDITEUR DE CHAPITRE en fenêtre séparée (Background)
 * Fenêtre à part : on peut la réduire, la déplacer, l'agrandir en grand écran. L'éditeur y est toujours ouvert (pas de crayon),
 * un seul bouton « Enregistrer » (ou Ctrl+S) écrit titre + texte (+ icône / couleur d'un repère) en une seule fois.
 * La fiche peut se redessiner derrière (don de Gold, jauge…) : la fenêtre n'est pas touchée, rien n'est perdu. */
import { SYS, esc } from "./config.js";
import { bookOf, bookStyleOf, bookVarsOf, bookFontsLoad, BOOK_ICONS, BOOK_THEMES } from "./sheet-character.js";
const { ApplicationV2, DialogV2 } = foundry.applications.api;

export class ChapterEditor extends ApplicationV2 {
  static DEFAULT_OPTIONS = { classes: ["ms-sheet", "ms-bkeditor"], position: { width: 860, height: 760 }, window: { resizable: true, minimizable: true, icon: "fa-solid fa-feather-pointed" } };
  static open(actor, chId, { onSaved } = {}) {
    const id = `ms-bked-${actor.id}-${chId}`; const ex = foundry.applications.instances.get(id);
    if (ex) { if (ex.minimized) ex.maximize(); ex.bringToFront(); return ex; }
    const app = new ChapterEditor({ id, actor, chId, onSaved }); app.render(true); return app;
  }
  constructor(opts) { super(opts); this.actor = opts.actor; this.chId = opts.chId; this.onSaved = opts.onSaved; this.dirty = false; this.big = false; this.prev = null; }
  get chapter() { return bookOf(this.actor).find(c => c.id === this.chId) || null; }
  get title() { const c = this.chapter; return `Écrire — ${c?.title || "Chapitre"} · ${this.actor.name}`; }
  async _renderHTML() {
    const c = this.chapter; if (!c) return `<p class="bke-none">Ce chapitre n'existe plus.</p>`;
    const st = bookStyleOf(this.actor); bookFontsLoad(); const L = bookOf(this.actor); const N = L.filter(x => !x.special);
    const label = c.special ? "Repère (chapitre spécial)" : `Chapitre ${N.findIndex(x => x.id === c.id) + 1}`;
    const spec = c.special ? `<div class="bke-spec"><span>Icône</span><span class="bke-icons">${BOOK_ICONS.map(i => `<a data-icon="${i}" class="${c.icon === i ? "on" : ""}"><i class="fa-solid ${i}"></i></a>`).join("")}</span><span>Couleur</span><input type="color" data-k="color" value="${esc(c.color || BOOK_THEMES[st.theme]?.[2] || "#ffd070")}"></div>` : "";
    return `<div class="bke" style="${bookVarsOf(st)}">
      <header class="bke-head"><label class="bke-t"><small>${esc(label)}</small><input type="text" data-k="title" value="${esc(c.title || "")}" placeholder="${c.special ? "Nom du repère" : "Titre du chapitre"}"></label>
        <div class="bke-acts"><span class="bke-st" data-st>✓ Enregistré</span>
          <a class="bke-b" data-a="big" data-tooltip="${document.fullscreenElement ? "Quitter le plein écran (Échap)" : "Plein écran"}"><i class="fa-solid ${document.fullscreenElement ? "fa-minimize" : "fa-maximize"}"></i></a>
          <a class="bke-b save" data-a="saveClose" data-tooltip="Enregistrer et fermer (Ctrl+S : enregistrer sans fermer)"><i class="fa-solid fa-check"></i> Enregistrer</a></div></header>
      ${spec}
      <div class="bke-ed"><prose-mirror name="bke-html" value="${esc(c.html || "")}"></prose-mirror></div>
      <footer class="bke-foot"><i class="fa-solid fa-circle-info"></i> Écris librement : tu peux réduire cette fenêtre (double-clic sur sa barre de titre) et revenir plus tard. « Enregistrer » enregistre et ferme ; Ctrl+S enregistre sans fermer.</footer></div>`;
  }
  _replaceHTML(r, el) { el.innerHTML = r; }
  _onFirstRender() {
    const el = this.element; this.#size();
    const mark = () => { if (this.dirty) return; this.dirty = true; const s = el.querySelector("[data-st]"); if (s) { s.textContent = "● Non enregistré"; s.classList.add("dirty"); } };
    el.addEventListener("input", mark); el.addEventListener("keydown", ev => { if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") { ev.preventDefault(); ev.stopPropagation(); this.save(); return; } if (ev.target.closest?.(".ProseMirror") && !ev.ctrlKey && !ev.metaKey && ev.key.length === 1) mark(); }, true);
    el.addEventListener("change", ev => { if (ev.target.matches?.("[data-k]")) mark(); });
    el.addEventListener("click", ev => {
      const ic = ev.target.closest("[data-icon]"); if (ic) { el.querySelectorAll("[data-icon]").forEach(x => x.classList.toggle("on", x === ic)); this._icon = ic.dataset.icon; mark(); return; }
      /* la disquette de la barre de l'éditeur est cachée ; si elle apparaît quand même, elle enregistre sans fermer */
      const pmSave = ev.target.closest('prose-mirror button[data-action="save"]'); if (pmSave) { ev.preventDefault(); ev.stopPropagation(); this.save(); return; }
      const b = ev.target.closest("[data-a]"); if (!b) return; ev.preventDefault();
      if (b.dataset.a === "saveClose") this.save().then(ok => ok && this.close({ force: true })); else if (b.dataset.a === "big") this.toggleBig(); }, true);
    this._fsH = () => this.#fsChange(); document.addEventListener("fullscreenchange", this._fsH);
    this._escH = ev => { if (ev.key !== "Escape" || !this.rendered || !(document.fullscreenElement || this.big)) return; ev.preventDefault(); ev.stopPropagation(); this.toggleBig(); };
    document.addEventListener("keydown", this._escH, true);
    setTimeout(() => el.querySelector(".ProseMirror")?.focus(), 150);
  }
  #size() { const vw = window.innerWidth, vh = window.innerHeight; const w = Math.min(860, vw - 80), h = Math.min(760, vh - 60); this.setPosition({ width: w, height: h, left: Math.max(20, (vw - w) / 2), top: Math.max(10, (vh - h) / 2) }); }
  /* vrai plein écran : la page passe en plein écran et la fenêtre remplit l'écran (les dialogues restent visibles) ; Échap en sort */
  async toggleBig() { if (document.fullscreenElement) return document.exitFullscreen().catch(() => {}); if (this.big) { this.big = false; this.setPosition(this.prev || {}); this.prev = null; this.element?.classList.remove("big"); const b = this.element?.querySelector('[data-a="big"]'); if (b) b.innerHTML = `<i class="fa-solid fa-maximize"></i>`; return; } this.prev = { ...this.position };
    try { await document.documentElement.requestFullscreen(); } catch (e) { /* refusé par le navigateur : la fenêtre remplit toute la page */
      if (this.big) { this.big = false; this.setPosition(this.prev || {}); this.prev = null; } else { this.big = true; this.setPosition({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }); }
      this.element?.classList.toggle("big", this.big); const btn = this.element?.querySelector('[data-a="big"]'); if (btn) btn.innerHTML = `<i class="fa-solid ${this.big ? "fa-minimize" : "fa-maximize"}"></i>`; } }
  #fsChange() { if (!this.rendered) return; const on = !!document.fullscreenElement; const btn = this.element?.querySelector('[data-a="big"]');
    if (btn) { btn.innerHTML = `<i class="fa-solid ${on ? "fa-minimize" : "fa-maximize"}"></i>`; btn.dataset.tooltip = on ? "Quitter le plein écran (Échap)" : "Plein écran"; }
    if (on && this.prev) { this.big = true; setTimeout(() => this.setPosition({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }), 120); }
    else if (!on && this.big) { this.big = false; this.setPosition(this.prev || {}); this.prev = null; }
    this.element?.classList.toggle("big", this.big); }
  _onClose(options) { super._onClose?.(options); if (this._fsH) document.removeEventListener("fullscreenchange", this._fsH); this._fsH = null; if (this._escH) document.removeEventListener("keydown", this._escH, true); this._escH = null; if (this.big && document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
  async save() {
    const el = this.element; const c = this.chapter; if (!el || !c) return false; const pm = el.querySelector('prose-mirror[name="bke-html"]');
    const P = `flags.${SYS}.book.ch.${this.chId}`; const upd = { [`${P}.html`]: pm?.value ?? c.html, [`${P}.title`]: el.querySelector('[data-k="title"]')?.value ?? c.title };
    if (c.special) { if (this._icon) upd[`${P}.icon`] = this._icon; const col = el.querySelector('[data-k="color"]'); if (col && col.value !== (c.color || "")) upd[`${P}.color`] = col.value; }
    try { this.onSaved?.(this.chId); await this.actor.update(upd); } catch (e) { console.error(SYS, e); ui.notifications.error(`Enregistrement impossible : ${e.message}`); return false; }
    this.dirty = false; const s = el.querySelector("[data-st]"); if (s) { s.textContent = "✓ Enregistré"; s.classList.remove("dirty"); s.classList.add("flash"); setTimeout(() => s.classList.remove("flash"), 900); }
    const w = this.window?.title; if (w) w.textContent = this.title; return true;
  }
  async close(options = {}) {
    if (this.dirty && !options.force) { const r = await DialogV2.wait({ window: { title: "Modifications non enregistrées", icon: "fa-solid fa-floppy-disk" }, classes: ["ms-dialog"], content: `<p>Enregistrer ce que tu as écrit avant de fermer ?</p>`, rejectClose: false,
      buttons: [{ action: "save", label: "Enregistrer", icon: "fa-solid fa-floppy-disk", default: true }, { action: "drop", label: "Ne pas enregistrer", icon: "fa-solid fa-trash" }, { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark" }] });
      if (!r || r === "cancel") return this; if (r === "save" && !(await this.save())) return this; }
    return super.close(options);
  }
}
