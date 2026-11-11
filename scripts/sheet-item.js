/* Manhwa Sheet — item sheet (fields come from the item's category in the tree) */
import { goldResource, bonusActive, canEquip, rootOf, levelColor, fmtSlots, rankPower, rarityPower, ammoOn, ammoTxt } from "./config.js";
import { onlyChanged, deferRender } from "./sheetguard.js";
import { esc, getConfig, flattenTree, fieldsOf, pathOf, catTags, featureOn, imgDefaults, itemBonuses, ITEM_FIELDS } from "./config.js";
import { rollItem } from "./dice.js";
import { POS, portraitStyle } from "./sheet-character.js";
import { pickCategory } from "./category-picker.js";
import { richEditor } from "./rich.js";
const { ItemSheetV2 } = foundry.applications.sheets;
export const FX_LIST = [["", "Aucun"], ["flame", "Flamme"], ["ember", "Braise"], ["lava", "Lave"], ["solar", "Solaire"], ["gold", "Or"], ["royal", "Royal"], ["divine", "Divin"], ["holy", "Sacré"],
  ["frost", "Givre"], ["ice", "Glace vive"], ["lunar", "Lunaire"], ["storm", "Tempête"], ["electric", "Électrique"], ["plasma", "Plasma"], ["neon", "Néon"], ["system", "Système"], ["hologram", "Hologramme"],
  ["nature", "Nature"], ["emerald", "Émeraude"], ["toxic", "Toxique"], ["sakura", "Sakura"], ["aurora", "Aurore"], ["prism", "Prisme"], ["rainbow", "Arc-en-ciel"], ["cosmic", "Cosmique"],
  ["void", "Néant"], ["abyss", "Abysses"], ["shadow", "Ombre"], ["blood", "Sang"], ["cursed", "Maudit"], ["runic", "Runique"], ["chrome", "Chrome"], ["glitch", "Glitch"]];
export const FX = FX_LIST.map(f => f[0]);

export class ManhwaItemSheet extends ItemSheetV2 {
  /* 1.59 : pas de rendu pendant qu'on écrit (mise à jour venue d'ailleurs) ; seul le champ modifié est envoyé */
  render(options, _options) { if (deferRender(this, options, _options)) return this; return super.render(options, _options); }
  _prepareSubmitData(event, form, formData, updateData) { return onlyChanged(this, event, super._prepareSubmitData(event, form, formData, updateData)); }
  static DEFAULT_OPTIONS = { classes: ["ms-sheet", "ms-item"], position: { width: 640, height: 680 }, window: { resizable: true, icon: "fa-solid fa-cube" }, form: { submitOnChange: true, closeOnSubmit: false }, actions: { bonusMode: ManhwaItemSheet.#bonusMode, pickCat: ManhwaItemSheet.#pickCat, iSettings: ManhwaItemSheet.#settings, roll: ManhwaItemSheet.#roll, bonusAdd: ManhwaItemSheet.#bonusAdd, bonusDel: ManhwaItemSheet.#bonusDel, rollMode: ManhwaItemSheet.#rollMode, ammo: ManhwaItemSheet.#ammo } };
  constructor(...a) { super(...a); this.settingsOpen = false; }
  get title() { try { if (ammoOn(getConfig(), this.item) && Number(this.item.system.ammo?.max)) return `${this.item.name} ${ammoTxt(this.item)}`; } catch (e) {} return this.item.name; }
  async _renderHTML() {
    const i = this.item, s = i.system, cfg = getConfig(); const nodes = flattenTree(cfg.items); const leaves = nodes.filter(n => !n.children?.length);
    const node = nodes.find(n => n.id === s.category); const canFrame = game.user.isGM || this.isEditable; const ammo = ammoOn(cfg, i); const am = s.ammo || {}; const amMax = Number(am.max) || 0, amVal = Number(am.value) || 0; const fields = fieldsOf(cfg, s.category).filter(f => !ITEM_FIELDS[f]?.feature || featureOn(cfg, ITEM_FIELDS[f].feature)); const gm = game.user.isGM;
    const coin = goldResource(cfg); const fmt = n => new Intl.NumberFormat("fr-FR").format(Number(n) || 0);
    const crumb = catTags(cfg, s.category, { withRoot: true, cls: "big" });
    const idef = imgDefaults(cfg, s.category); const size = Number(s.imgSize) || idef.size; const SIZES = [[0, `Défaut de la catégorie (${idef.size}px)`], [64, "64 px"], [96, "96 px"], [128, "128 px"], [160, "160 px"], [200, "200 px"], [260, "260 px"]];
    const listSel = (name, list, cur) => `<select name="${name}"><option value="">—</option>${(cfg[list] || []).map(o => `<option value="${esc(o.key)}"${o.key === cur ? " selected" : ""}>${esc(o.name)}</option>`).join("")}</select>`;
    const field = f => { const d = ITEM_FIELDS[f]; if (!d || d.hidden) return ""; const n = `system.${f}`; const v = s[f];
      if (d.kind === "rank") { const cur = cfg.ranks.find(r => r.key === v); return `<label class="ms-f tinted rank" style="--fc:${esc(cur?.color || "#8ea6d8")}"><span>Rang</span><select name="${n}">${cfg.ranks.map(r => `<option value="${esc(r.key)}"${r.key === v ? " selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>`; }
      if (d.kind === "list") { const cur = (cfg[d.list] || []).find(o => o.key === v); const tint = cur?.color ? ` tinted" style="--fc:${esc(cur.color)}` : ""; return `<label class="ms-f ${f}${tint}"><span>${esc(d.label)}</span>${listSel(n, d.list, v)}</label>`; }
      if (f === "value") return `<label class="ms-f tinted value" style="--fc:${esc(coin?.color || "#ffd070")}"><span><i class="fa-solid ${esc(coin?.icon || "fa-coins")}"></i> ${esc(d.label)}${coin ? ` (${esc(coin.name)})` : ""}</span><input type="number" name="${n}" value="${esc(v)}" min="0"><small class="fmt">${fmt(v)}</small></label>`;
      if (d.kind === "stats") { const list = itemBonuses(i); const can = gm || this.isEditable;
        return `<div class="ms-f wide ms-istats"><span>${esc(d.label)} <em>points ou %, une fois équipé — ou passif (toujours actif)</em></span>
          <div class="list">${list.map((b, k) => { const st = cfg.stats.find(x => x.key === b.stat); return `<div class="brow" data-k="${k}" style="--sc:${esc(st?.color || "#8ea6d8")}"><i class="fa-solid ${esc(st?.icon || "fa-star")}"></i>
            <select data-bonus="stat">${cfg.stats.map(x => `<option value="${esc(x.key)}"${x.key === b.stat ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
            <input type="number" data-bonus="value" value="${Number(b.value) || 0}" step="0.1">
            <select data-bonus="pct"><option value="0"${!b.pct ? " selected" : ""}>points</option><option value="1"${b.pct ? " selected" : ""}>%</option></select>
            <label class="ms-toggle sm" title="Passif : agit sans être équipé"><input type="checkbox" data-bonus="passive"${b.passive ? " checked" : ""}><i></i><span>passif</span></label>
            ${can ? `<a data-action="bonusDel" class="del" title="Retirer"><i class="fa-solid fa-xmark"></i></a>` : ""}</div>`; }).join("")}${list.length ? "" : `<p class="none">Aucun bonus pour l'instant.</p>`}</div>
          ${can ? `<div class="addrow"><a data-action="bonusAdd" class="ms-btn small"><i class="fa-solid fa-plus"></i> Ajouter un bonus</a><a data-action="bonusAdd" data-all="1" class="ms-btn small ghost" title="Une ligne par stat"><i class="fa-solid fa-layer-group"></i> Toutes les stats</a></div>` : ""}</div>`; }
      if (d.kind === "formula") { const f = String(v || ""); const m = f.match(/^\s*(\d+)d(\d+)(?:\s*\+\s*@(\w+))?(?:\s*([+-])\s*(\d+))?\s*$/); const adv = this.rollAdv || (f && !m);
        const n = m ? m[1] : "1", die = m ? m[2] : "20", st = m ? (m[3] || "") : "", bn = m ? Number((m[4] === "-" ? "-" : "") + (m[5] || 0)) : 0;
        return `<div class="ms-f wide ms-iroll"><span>${esc(d.label)} <em>${adv ? "avancé — @force, @agi…, @level" : "simple"}</em><a data-action="rollMode" class="mode">${adv ? "simple" : "avancé"}</a></span>
          ${adv ? `<div class="row"><input type="text" name="${n}" value="${esc(f)}" placeholder="2d6 + @force + 1"><a data-action="roll" class="ms-btn small" title="Lancer"><i class="fa-solid fa-dice"></i></a></div>`
          : `<div class="row build"><input type="hidden" name="${n}" value="${esc(f)}"><label>Lancer<input type="number" data-rb="n" value="${n}" min="1" max="20"></label><label>dés<select data-rb="die">${[4, 6, 8, 10, 12, 20, 100].map(x => `<option value="${x}"${String(x) === die ? " selected" : ""}>d${x}</option>`).join("")}</select></label>
             <label>+ stat<select data-rb="stat"><option value="">aucune</option>${cfg.stats.map(x => `<option value="${esc(x.key)}"${x.key === st ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label><label>+ bonus<input type="number" data-rb="bn" value="${bn}"></label>
             <code class="prev">${esc(f || "—")}</code><a data-action="roll" class="ms-btn small" title="Lancer"><i class="fa-solid fa-dice"></i></a></div>`}</div>`; }
      if (d.kind === "origin") return `<label class="ms-f"><span>Origine</span>${cfg.origins.length ? listSel(n, "origins", v) : `<input type="text" name="${n}" value="${esc(v)}">`}</label>`;
      if (f === "slotCost") return `<label class="ms-f slotcost" title="0 = ne prend pas de place ; 0,5 ; 2…"><span><i class="fa-solid fa-boxes-stacked"></i> ${esc(d.label)}</span><input type="number" name="${n}" value="${esc(v ?? 1)}" min="0" step="0.1"><small class="fmt">${Number(v) === 0 ? "ne compte pas" : `${fmtSlots(v ?? 1)} place${Number(v ?? 1) > 1 ? "s" : ""}`}</small></label>`;
      if (d.kind === "number") return `<label class="ms-f"><span>${esc(d.label)}</span><input type="number" name="${n}" value="${esc(v)}"></label>`;
      if (d.kind === "boolean") return `<label class="ms-f chk ms-toggle"><input type="checkbox" name="${n}"${v ? " checked" : ""}><i></i><span>${esc(d.label)}</span></label>`;
      if (d.kind === "rich") return `<div class="ms-f wide"><span>${esc(d.label)}</span>${richEditor(n, v, this.isEditable)}</div>`;
      return `<label class="ms-f"><span>${esc(d.label)}</span><input type="text" name="${n}" value="${esc(v)}"></label>`; };
    const root = (() => { let n = node; while (n?.parent) n = n.parent; return n; })();
    const rk = cfg.ranks.find(r => r.key === s.rank); const rar = cfg.rarities.find(r => r.key === s.rarity);
    const rs = cfg.itemRankStyle || {}; const rsCls = ["header", "frame", "name", "fields", "badge"].filter(k => rs[k] !== false).map(k => `irs-${k}`).join(" ") + ` irs-bg-${rs.bg || "glow"}`;
    const rp = rarityPower(cfg, s.rarity); const kp = rankPower(cfg, s.rank);
    return `<div class="ms-wrap ms-itemwrap ${rsCls}${rp ? ` rar-pow rar-pow${rp}` : ""}${kp ? ` rk-pow${kp}` : ""}" style="--rarc:${esc(rar?.color || "#fff")};--rk:${esc(rk?.color || "#8ea6d8")};--rc:${esc(rk?.color || "#8ea6d8")};--tc:${esc(root?.color || "#38a8ff")};--rs:${Number(rs.strength) || 1}">
      <header class="ms-ihead">
        <div class="ms-ihead-top"><span class="sys"><i class="fa-solid ${esc(root?.icon || "fa-cube")}"></i> SYS::OBJET · ${esc((root?.name || "OBJET").toUpperCase())}</span><span class="id">#${esc(i.id.slice(0, 6).toUpperCase())}${canFrame ? `<a data-action="iSettings" class="gear ${this.settingsOpen ? "on" : ""}" title="Réglages de l'objet : cadrage et taille de l'image${gm ? ", munitions, places occupées, effet du nom" : ""}"><i class="fa-solid fa-gear"></i></a>` : ""}</span></div>
        <div class="ms-ihead-main">
          <div class="ms-iimg" style="--sz:${size}px"><div class="ms-ipic"><img src="${esc(i.img)}" data-action="editImage" data-edit="img" style="${portraitStyle(s.imgPos || idef.pos)}" title="Cliquer pour changer l'image"></div>${hexBadge(rk?.name || "–")}</div>
          <div class="ms-iinfo"><input class="ms-name ${s.fx ? "fx-" + esc(s.fx) : ""}" type="text" name="name" value="${esc(i.name)}">
            <div class="ms-crumb">${crumb}<a data-action="pickCat" class="ms-btn small" title="Changer de catégorie"><i class="fa-solid fa-sitemap"></i> Changer</a></div>
            <div class="ms-ibadges"><span class="ms-rank">${esc(rk?.name || "–")}</span>${rar ? `<span class="ms-rar" style="--rc:${esc(rar.color)}">${esc(rar.name)}</span>` : ""}${fields.includes("level") ? `<span class="ms-lvl" style="--lc:${levelColor(s.level)}"><small>NIV</small>${Number(s.level) || 0}</span>` : ""}${s.quantity > 1 ? `<span class="q">×${s.quantity}</span>` : ""}${ammo ? `<span class="ms-ammo big${amMax && !amVal ? " empty" : ""}" title="Munitions"><i class="fa-solid fa-gun"></i>${this.isEditable ? `<a data-action="ammo" data-d="-1" title="Tirer (−1)"><i class="fa-solid fa-minus"></i></a>` : ""}<b>${amVal}/${amMax}</b>${this.isEditable ? `<a data-action="ammo" data-d="1" title="+1"><i class="fa-solid fa-plus"></i></a><a data-action="ammo" data-d="reload" title="Recharger"><i class="fa-solid fa-rotate"></i></a>` : ""}</span>` : ""}${s.equipped ? `<span class="eq"><i class="fa-solid fa-user-shield"></i> sur soi</span>` : ""}</div>
          </div></div>
      </header>
      ${this.settingsOpen && canFrame ? `<div class="ms-card ms-isettings"><div class="ms-sec-lbl"><i class="fa-solid fa-gear"></i> Réglages de l'objet</div><div class="ms-grid3">
        <label class="ms-f"><span>Cadrage de l'image</span><select name="system.imgPos"><option value="">Défaut de la catégorie (${esc(idef.pos)})</option>${POS.map(x => `<option value="${x[0]}"${x[0] === s.imgPos ? " selected" : ""}>${x[1]}</option>`).join("")}</select></label>
        <label class="ms-f"><span>Taille de l'image</span><select name="system.imgSize">${SIZES.map(x => `<option value="${x[0]}"${x[0] === (Number(s.imgSize) || 0) ? " selected" : ""}>${x[1]}</option>`).join("")}</select></label>
        ${gm && cfg.equipment?.enabled ? field("slotCost") : ""}
        ${gm ? `<label class="ms-f"><span>Munitions (MJ)</span><select name="system.ammoMode"><option value=""${!s.ammoMode ? " selected" : ""}>Auto (armes à feu et énergétiques)</option><option value="on"${s.ammoMode === "on" ? " selected" : ""}>Oui, cet objet a des munitions</option><option value="off"${s.ammoMode === "off" ? " selected" : ""}>Non</option></select></label>` : ""}
        ${gm ? `<label class="ms-f"><span>Effet du nom (MJ)</span><select name="system.fx">${FX_LIST.map(([f, l]) => `<option value="${f}"${f === s.fx ? " selected" : ""}>${l}</option>`).join("")}</select></label>` : ""}
      </div><p class="hint">${gm ? `${cfg.equipment?.enabled ? "Places occupées : 1 par défaut, 0 = ne compte pas, 0,5, 2… (une fois équipé). " : ""}Cadrage et taille ne valent que pour cet objet. Les défauts par catégorie se règlent dans Configuration de la fiche › Catégories d'objets (icône colonnes d'un nœud), le défaut du monde dans › Fiche.` : "Cadrage et taille ne valent que pour cet objet."}</p></div>` : ""}
      <section class="ms-body"><div class="ms-card ms-ifields"><div class="ms-sec-lbl"><i class="fa-solid fa-sliders"></i> Propriétés</div><div class="ms-grid2">${ammo ? `<label class="ms-f ammo"><span><i class="fa-solid fa-gun"></i> Munitions <em>chargées / capacité</em></span><div class="row"><input type="number" name="system.ammo.value" value="${amVal}" min="0"><b>/</b><input type="number" name="system.ammo.max" value="${amMax}" min="0"></div></label>` : ""}${fields.filter(f => f !== "lore" && f !== "description" && f !== "condition" && f !== "equippable" && f !== "stats" && f !== "slotCost").map(field).join("")}</div></div>
      ${(() => { /* bonus de stats : seulement si on les active sur cet objet */
        if (!featureOn(cfg, "itemStats")) return ""; const eligible = fields.includes("stats") || canEquip(cfg, s.category) || rootOf(cfg, s.category)?.id === "title"; if (!eligible) return "";
        const on = bonusActive(i) || s.bonusMode === "on"; const can = this.isEditable;
        if (!on) return can ? `<div class="ms-card ms-ibonus-off"><a data-action="bonusMode" data-mode="on" class="ms-btn small"><i class="fa-solid fa-plus"></i> Ajouter des bonus de stats</a><span class="hint">Aucun bonus : l'objet ne modifie pas les stats.</span></div>` : "";
        return `<div class="ms-card ms-ibonus-on"><div class="ms-sec-lbl"><i class="fa-solid fa-chart-simple"></i> Bonus de stats${can ? `<a data-action="bonusMode" data-mode="off" class="ms-btn small ghost right" title="Désactiver les bonus de cet objet (ils sont conservés)"><i class="fa-solid fa-power-off"></i> Désactiver</a>` : ""}</div>${field("stats")}</div>`; })()}
      <div class="ms-card"><div class="ms-sec-lbl"><i class="fa-solid fa-align-left"></i> Description</div>${richEditor("system.description", s.description, this.isEditable)}${fields.includes("condition") ? `<div class="ms-sec-lbl cond"><i class="fa-solid fa-trophy"></i> Condition d'obtention</div>${richEditor("system.condition", s.condition, this.isEditable)}` : ""}${fields.includes("lore") ? `<div class="ms-sec-lbl lore"><i class="fa-solid fa-book"></i> Lore</div>${richEditor("system.lore", s.lore, this.isEditable)}` : ""}</div></section></div>`;
  }
  _replaceHTML(result, content) { content.innerHTML = result;
    /* bonus rows : rebuild the array on any change (unnamed inputs, so the form does not try to submit them) */
    content.querySelectorAll("[data-bonus]").forEach(el => el.addEventListener("change", () => { const rows = [...content.querySelectorAll(".brow")].map(r => ({ stat: r.querySelector('[data-bonus="stat"]').value, value: Number(r.querySelector('[data-bonus="value"]').value) || 0, pct: r.querySelector('[data-bonus="pct"]').value === "1", passive: r.querySelector('[data-bonus="passive"]').checked })); this.item.update({ "system.bonuses": rows }); }));
    /* roll builder : compose the formula into the hidden field */
    const rb = content.querySelector(".build"); if (rb) rb.querySelectorAll("[data-rb]").forEach(el => el.addEventListener("change", () => { const g = k => rb.querySelector(`[data-rb="${k}"]`).value; const bn = Number(g("bn")) || 0; const f = `${Math.max(1, Number(g("n")) || 1)}d${g("die")}${g("stat") ? ` + @${g("stat")}` : ""}${bn ? ` ${bn > 0 ? "+" : "-"} ${Math.abs(bn)}` : ""}`; this.item.update({ "system.formula": f }); })); }
  static async #bonusAdd(ev, t) { const cfg = getConfig(); const cur = itemBonuses(this.item); const add = t.dataset.all ? cfg.stats.filter(st => !cur.some(b => b.stat === st.key)).map(st => ({ stat: st.key, value: 0, pct: false, passive: false })) : [{ stat: cfg.stats.find(st => !cur.some(b => b.stat === st.key))?.key || cfg.stats[0]?.key, value: 1, pct: false, passive: false }]; await this.item.update({ "system.bonuses": [...cur, ...add] }); }
  static async #bonusDel(ev, t) { const k = Number(t.closest(".brow").dataset.k); const cur = itemBonuses(this.item); cur.splice(k, 1); await this.item.update({ "system.bonuses": cur }); }
  static async #bonusMode(ev, t) { const mode = t.dataset.mode; const upd = { "system.bonusMode": mode }; if (mode === "on" && !itemBonuses(this.item).length) { const cfg = getConfig(); upd["system.bonuses"] = [{ stat: cfg.stats[0]?.key, value: 1, pct: false, passive: false }]; } await this.item.update(upd); }
  static async #rollMode() { this.rollAdv = !this.rollAdv; this.render(); }
  static async #ammo(ev, t) { const a = this.item.system.ammo || {}; const max = Number(a.max) || 0; const cur = Number(a.value) || 0; const v = t.dataset.d === "reload" ? max : Math.max(0, Math.min(max || Infinity, cur + Number(t.dataset.d))); if (v !== cur) await this.item.update({ "system.ammo.value": v }); }
  static async #settings() { if (!(game.user.isGM || this.isEditable)) return; this.settingsOpen = !this.settingsOpen; this.render(); }
  static async #roll() { await rollItem(this.item.parent, this.item); }
  static async #pickCat() { const cfg = getConfig(); const root = pathOf(cfg, this.item.system.category)[0]; const cat = await pickCategory(cfg, root?.id, "", this.item.system.category); if (cat) await this.item.update({ "system.category": cat }); }
}

/* badge de rang extensible : hexagone pour 1 caractère, hexagone allongé au-delà (SS, SSS, EX+…) */
function hexBadge(name) { const n = [...String(name)].length; const W = n <= 1 ? 46 : 30 + n * 15;
  const d = n <= 1 ? "M23 2 L43 13 L43 39 L23 50 L3 39 L3 13 Z" : `M13 3 L${W - 13} 3 L${W - 2} 26 L${W - 13} 49 L13 49 L2 26 Z`;
  return `<div class="ms-ihex" data-len="${Math.min(n, 5)}" style="width:${W}px"><svg viewBox="0 0 ${W} 52" preserveAspectRatio="none"><path d="${d}"/></svg><b>${esc(name)}</b></div>`; }
