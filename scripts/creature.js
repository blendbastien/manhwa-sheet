/* Manhwa Sheet — créatures (bestiaire) : fiche simple (niveau, rang, XP et Gold donnés, attaques écrites à la main, butin),
 * bouton « Récompenser » (nombre de créatures abattues) et outil « Butin de combat » (plusieurs créatures, quantité de chacune). */
import { SYS, esc, getConfig, rankOf, levelColor, flattenTree, gaugeState, uid } from "./config.js";
import { onlyChanged, deferRender } from "./sheetguard.js";
import { rewardDialog } from "./party.js";
import { portraitStyle, POS, relInput } from "./sheet-character.js";
import { richEditor } from "./rich.js";

const { ActorSheetV2 } = foundry.applications.sheets; const DialogV2 = foundry.applications.api.DialogV2;
const fmt = n => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
const TE = () => foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;

export class CreatureSheet extends ActorSheetV2 {
  /* 1.59 : pas de rendu pendant qu'on écrit (mise à jour venue d'ailleurs) ; seul le champ modifié est envoyé */
  render(options, _options) { if (deferRender(this, options, _options)) return this; return super.render(options, _options); }
  _prepareSubmitData(event, form, formData, updateData) { return onlyChanged(this, event, super._prepareSubmitData(event, form, formData, updateData)); }
  static DEFAULT_OPTIONS = {
    classes: ["ms-sheet", "ms-creature"], position: { width: 760, height: 760 }, window: { resizable: true, icon: "fa-solid fa-dragon" },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: { reward: CreatureSheet.#reward, atkAdd: CreatureSheet.#atkAdd, atkDel: CreatureSheet.#rowDel, dropAdd: CreatureSheet.#dropAdd, dropDel: CreatureSheet.#rowDel, rowUp: CreatureSheet.#rowUp, dropOpen: CreatureSheet.#dropOpen, gauge: CreatureSheet.#gauge }
  };
  /* taille de la fenêtre : comme la fiche de personnage (défaut de la configuration, puis dernière taille de CETTE fiche sur ce navigateur) */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    try { const w = getConfig().window || {}; const id = options.document?.uuid; const saved = w.remember !== false && id ? JSON.parse(localStorage.getItem(`ms-size.${id}`) || "null") : null;
      options.position ??= {}; if (saved?.width) options.position.width = saved.width; if (saved?.height) options.position.height = saved.height; } catch (e) { /* stockage indisponible */ }
    return options;
  }
  setPosition(position) { const r = super.setPosition(position); try { if (this.rendered && getConfig().window?.remember !== false && (position?.width || position?.height)) { const p = this.position; localStorage.setItem(`ms-size.${this.document.uuid}`, JSON.stringify({ width: Math.round(p.width), height: Math.round(p.height) })); } } catch (e) {} return r; }
  get title() { return this.actor.name; }
  async _renderHTML() {
    const a = this.actor, s = a.system, cfg = getConfig(), gm = game.user.isGM, ed = this.isEditable; const dis = ed ? "" : "disabled";
    const rk = rankOf(cfg, s.rank);
    const gauges = (cfg.gauges || []).map(g => { const gv = s.gauges?.[g.key] || {}; const max = Number(gv.max) || 0, val = Math.max(0, Number(gv.value) || 0); const pct = max ? Math.min(100, Math.round(val / max * 100)) : 0; const st = gaugeState(cfg, val, max);
      return `<div class="ms-gauge ${st}" data-gauge="${g.key}" style="--c:${esc(g.color)};--pct:${pct}%"><div class="top"><i class="fa-solid ${esc(g.icon)} ic"></i><span class="nm">${esc(g.abbr || g.name)}</span>
        <a data-action="gauge" data-d="-1" class="pm" ${dis}><i class="fa-solid fa-minus"></i></a><input type="text" inputmode="decimal" class="ms-rel" data-dtype="Number" data-min="0" name="system.gauges.${g.key}.value" value="${val}" ${dis}><em>/</em><input type="text" inputmode="decimal" class="ms-rel mx" data-dtype="Number" data-min="0" name="system.gauges.${g.key}.max" value="${max}" ${dis}><a data-action="gauge" data-d="1" class="pm" ${dis}><i class="fa-solid fa-plus"></i></a></div>
        <div class="bar"><i class="fill"><u></u></i><span class="pct">${pct}%</span></div></div>`; }).join("");
    const attacks = (s.attacks || []).map((x, i) => `<div class="cr-atk" data-row="attacks" data-i="${i}">
        <div class="l1"><i class="fa-solid fa-burst"></i><input type="text" data-f="name" value="${esc(x.name)}" placeholder="Nom de l'attaque ou du sort" ${dis}><input type="text" class="info" data-f="info" value="${esc(x.info)}" placeholder="Dégâts, coût, portée… (ex. 2d8 feu · 3 tours)" ${dis}>
        ${ed ? `<a data-action="rowUp" title="Monter"><i class="fa-solid fa-chevron-up"></i></a><a data-action="atkDel" class="del" title="Retirer"><i class="fa-solid fa-xmark"></i></a>` : ""}</div>
        <textarea data-f="desc" rows="2" placeholder="Description, effet…" ${dis}>${esc(x.desc)}</textarea></div>`).join("");
    const drops = (s.drops || []).map((x, i) => `<div class="cr-drop" data-row="drops" data-i="${i}"><img src="${esc(x.img || x.data?.img || "icons/svg/item-bag.svg")}" ${x.data ? 'data-action="dropOpen" title="Voir l\'objet"' : ""}>
        <input type="text" data-f="name" value="${esc(x.name)}" placeholder="Objet" ${dis}><label title="Quantité par créature">×<input type="number" data-f="qty" value="${Number(x.qty) || 1}" min="0" ${dis}></label><label title="Chance de l'obtenir (%)"><input type="number" data-f="chance" value="${Number(x.chance ?? 100)}" min="0" max="100" ${dis}>%</label>
        ${x.data ? `<small class="lk" title="Objet complet (glissé) : il sera créé tel quel"><i class="fa-solid fa-link"></i></small>` : ""}${ed ? `<a data-action="rowUp" title="Monter"><i class="fa-solid fa-chevron-up"></i></a><a data-action="dropDel" class="del" title="Retirer"><i class="fa-solid fa-xmark"></i></a>` : ""}</div>`).join("");
    return `<div class="ms-wrap ms-crwrap" style="--rk:${esc(rk?.color || "#ff6a5a")}">
      <header class="cr-head">
        <div class="cr-pic"><div class="cr-frame"><img src="${esc(a.img)}" data-action="editImage" data-edit="img" style="${portraitStyle(s.portrait)}" title="Changer l'image"></div><select name="system.portrait" title="Cadrage" ${dis}>${POS.map(x => `<option value="${x[0]}"${x[0] === s.portrait ? " selected" : ""}>${x[1]}</option>`).join("")}</select></div>
        <div class="cr-id">
          <div class="cr-sys"><i class="fa-solid fa-dragon"></i> SYS::BESTIAIRE · CRÉATURE</div>
          <input class="ms-name" type="text" name="name" value="${esc(a.name)}" placeholder="Nom" ${dis}>
          <div class="cr-chips">
            <label class="cr-chip rank" style="--c:${esc(rk?.color || "#fff")}"><span>Rang</span><select name="system.rank" ${dis}>${cfg.ranks.map(r => `<option value="${esc(r.key)}"${r.key === s.rank ? " selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>
            <label class="cr-chip lvl" style="--c:${levelColor(s.level)}"><span>Niveau</span><input type="number" name="system.level" value="${Number(s.level) || 0}" min="0" ${dis}></label>
            <label class="cr-chip kind"><span>Type</span><input type="text" name="system.kind" value="${esc(s.kind)}" placeholder="Bête, Mort-vivant, Boss…" ${dis}></label>
          </div>
          <div class="cr-loot">
            <label class="cr-big xp"><i class="fa-solid fa-arrow-trend-up"></i><span>XP donnée</span><input type="text" inputmode="decimal" class="ms-rel" data-dtype="Number" data-min="0" name="system.xpReward" value="${Number(s.xpReward) || 0}" ${dis}></label>
            <label class="cr-big gd"><i class="fa-solid fa-coins"></i><span>Gold donné</span><input type="text" inputmode="decimal" class="ms-rel" data-dtype="Number" data-min="0" name="system.goldReward" value="${Number(s.goldReward) || 0}" ${dis}></label>
            ${gm ? `<a class="cr-reward" data-action="reward" title="Donner l'XP, le Gold et le butin pour N créatures abattues"><i class="fa-solid fa-gift"></i><b>Récompenser</b></a>` : ""}
          </div>
          ${gauges ? `<div class="ms-gauges look-${esc(cfg.gaugeStyle?.look || "hatch")}">${gauges}</div>` : ""}
        </div></header>
      <section class="ms-body">
        <div class="ms-band" style="--tc:#ff6a5a"><i class="fa-solid fa-burst"></i><span class="t">Attaques & sorts</span><span class="n">${(s.attacks || []).length}</span><span class="sys">SYS::ARSENAL</span></div>
        <div class="cr-atks">${attacks || `<p class="cr-none">Aucune attaque écrite.</p>`}</div>${ed ? `<a class="ms-btn small" data-action="atkAdd"><i class="fa-solid fa-plus"></i> Ajouter une attaque</a>` : ""}
        <div class="ms-band" style="--tc:#ffd070"><i class="fa-solid fa-sack-dollar"></i><span class="t">Butin possible</span><span class="n">${(s.drops || []).length}</span><span class="sys">SYS::DROPS</span></div>
        <div class="cr-drops" data-dropzone="1">${drops || ""}<div class="cr-dz"><i class="fa-solid fa-hand-holding-hand"></i> Glisse ici un objet (onglet Objets, Catalogue, fiche…) ou ajoute une ligne à la main.</div></div>${ed ? `<a class="ms-btn small" data-action="dropAdd"><i class="fa-solid fa-plus"></i> Ajouter un butin</a>` : ""}
        ${gm ? `<div class="ms-band" style="--tc:var(--ms-warm)"><i class="fa-solid fa-user-secret"></i><span class="t">Notes</span><span class="sys">SYS::MJ</span></div><div class="ms-card">${richEditor("system.notes", s.notes, ed)}</div>` : ""}
      </section></div>`;
  }
  _replaceHTML(result, content) { content.innerHTML = result;
    if (!this._relBound) { this._relBound = true; this.element.addEventListener("change", ev => relInput(ev, this.actor), true); }
    /* lignes d'attaques et de butin : champs sans nom, la liste entière est réécrite à chaque changement */
    content.querySelectorAll("[data-row] [data-f]").forEach(el => el.addEventListener("change", ev => { ev.stopPropagation(); const row = el.closest("[data-row]"); const key = row.dataset.row; const list = foundry.utils.deepClone(this.actor.system[key] || []); const it = list[Number(row.dataset.i)]; if (!it) return;
      it[el.dataset.f] = el.type === "number" ? Math.max(0, Number(el.value) || 0) : el.value; this.actor.update({ [`system.${key}`]: list }); }));
    const dz = content.querySelector("[data-dropzone]");
    if (dz && this.isEditable) { dz.addEventListener("dragover", ev => { ev.preventDefault(); dz.classList.add("over"); }); dz.addEventListener("dragleave", () => dz.classList.remove("over"));
      dz.addEventListener("drop", async ev => { ev.preventDefault(); ev.stopPropagation(); dz.classList.remove("over"); let d; try { d = TE().getDragEventData(ev); } catch (e) { return; } if (d?.type !== "Item") return;
        const it = d.uuid ? await fromUuid(d.uuid) : (d.data ? new Item(d.data) : null); if (!it) return; const data = it.toObject(); delete data._id; delete data.folder; delete data.sort; delete data.ownership; delete data._stats;
        const list = foundry.utils.deepClone(this.actor.system.drops || []); list.push({ id: uid(), name: it.name, img: it.img, qty: 1, chance: 100, data }); await this.actor.update({ "system.drops": list }); }); }
  }
  /* un objet glissé sur la fiche (hors zone de butin) devient aussi un butin, au lieu d'entrer dans un inventaire de créature */
  async _onDropItem(event, item) { if (!this.isEditable) return null; const data = item.toObject(); for (const k of ["_id", "folder", "sort", "ownership", "_stats"]) delete data[k]; const list = foundry.utils.deepClone(this.actor.system.drops || []); list.push({ id: uid(), name: item.name, img: item.img, qty: 1, chance: 100, data }); await this.actor.update({ "system.drops": list }); return null; }
  static async #atkAdd() { const list = foundry.utils.deepClone(this.actor.system.attacks || []); list.push({ id: uid(), name: "", info: "", desc: "" }); await this.actor.update({ "system.attacks": list }); }
  static async #dropAdd() { const list = foundry.utils.deepClone(this.actor.system.drops || []); list.push({ id: uid(), name: "", img: "", qty: 1, chance: 100 }); await this.actor.update({ "system.drops": list }); }
  static async #rowDel(ev, t) { const row = t.closest("[data-row]"); const key = row.dataset.row; const list = foundry.utils.deepClone(this.actor.system[key] || []); list.splice(Number(row.dataset.i), 1); await this.actor.update({ [`system.${key}`]: list }); }
  static async #rowUp(ev, t) { const row = t.closest("[data-row]"); const key = row.dataset.row; const i = Number(row.dataset.i); if (i <= 0) return; const list = foundry.utils.deepClone(this.actor.system[key] || []); [list[i - 1], list[i]] = [list[i], list[i - 1]]; await this.actor.update({ [`system.${key}`]: list }); }
  static async #dropOpen(ev, t) { const d = (this.actor.system.drops || [])[Number(t.closest("[data-row]").dataset.i)]; if (!d?.data) return; const it = new Item(d.data); it.sheet?.render(true); }
  static async #gauge(ev, t) { if (t.hasAttribute("disabled")) return; const key = t.closest("[data-gauge]").dataset.gauge; const g = this.actor.system.gauges?.[key] || {}; const step = (ev.shiftKey ? 10 : 1) * Number(t.dataset.d); const max = Number(g.max) || Infinity; await this.actor.update({ [`system.gauges.${key}.value`]: Math.max(0, Math.min(max, (Number(g.value) || 0) + step)) }); }
  static async #reward() { if (!game.user.isGM) return; return rewardCreatures([{ actor: this.actor, n: 1 }]); }
}

/* récompense pour une liste de { actor (créature), n } → la fenêtre unique « Récompenses », section Monstres remplie */
export async function rewardCreatures(list) { list = list.filter(x => x.actor && x.n > 0); if (!list.length) return; return rewardDialog(null, { monsters: list }); }
/* ancien outil « Butin de combat » : c'est maintenant la fenêtre Récompenses (les jetons de créatures sélectionnés y sont déjà comptés) */
export const lootTool = () => rewardDialog();

/* « Convertir en créature » (clic droit sur un acteur, MJ) : Foundry ne permet pas de changer le type d'un acteur ;
   on crée une créature à partir de lui (nom, image, jeton, niveau, rang, jauges) — l'original n'est pas touché */
export async function convertToCreature(actor) {
  if (!game.user.isGM || !actor || actor.type === "creature") return null; const s = actor.system || {};
  const gauges = {}; for (const [k, g] of Object.entries(s.gauges || {})) gauges[k] = { value: Number(g?.value) || 0, max: Number(g?.max) || 0 };
  const tok = actor.prototypeToken?.toObject?.() ?? {}; delete tok.actorLink;
  const c = await Actor.create({ name: actor.name, img: actor.img, type: "creature", folder: actor.folder?.id ?? null, prototypeToken: { ...tok, actorLink: false },
    system: { level: Number(s.level) || 1, rank: s.rank || "", portrait: s.portrait || "center", gauges } });
  if (c) { ui.notifications.info(`Créature « ${c.name} » créée à partir de ${actor.name} (l'acteur d'origine est conservé).`); c.sheet?.render(true); }
  return c;
}
const ctxOpt = () => ({ name: "Convertir en créature", icon: '<i class="fa-solid fa-dragon"></i>',
  condition: li => { if (!game.user.isGM) return false; const el = li?.[0] ?? li; const a = game.actors.get(el?.dataset?.entryId ?? el?.dataset?.documentId); return !!a && a.type !== "creature"; },
  callback: li => { const el = li?.[0] ?? li; return convertToCreature(game.actors.get(el?.dataset?.entryId ?? el?.dataset?.documentId)); } });
const addOpt = options => { if (Array.isArray(options) && !options.some(o => o.name === "Convertir en créature")) options.push(ctxOpt()); };
Hooks.on("getActorContextOptions", (app, options) => addOpt(options));            /* v13 */
Hooks.on("getActorDirectoryEntryContext", (html, options) => addOpt(options));     /* v12 */
