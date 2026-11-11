/* Manhwa Sheet — dice (general mode, feature "dice") : stat rolls and item formulas, styled chat card */
import { esc, getConfig, rollData, effectiveStats } from "./config.js";

async function send(roll, { actor, title, sub, color, icon }) {
  const cfg = getConfig(); const total = roll.total; const dice = roll.dice.flatMap(d => d.results.map(r => `<span class="d${r.result === d.faces ? " max" : r.result === 1 ? " min" : ""}">${r.result}</span>`)).join("");
  const content = `<div class="ms-roll" style="--c:${esc(color || "#38a8ff")}"><div class="ms-roll-top"><i class="fa-solid ${esc(icon || "fa-dice-d20")}"></i><b>${esc(title)}</b><small>${esc(sub || "")}</small></div>
    <div class="ms-roll-mid"><span class="f">${esc(roll.formula)}</span><span class="dice">${dice}</span></div><div class="ms-roll-total">${total}</div></div>`;
  return roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), content, flavor: "" }, { rollMode: game.settings.get("core", "rollMode") });
}

export async function rollStat(actor, key, { formula } = {}) {
  const cfg = getConfig(); const st = cfg.stats.find(s => s.key === key); if (!st) return;
  const data = rollData(cfg, actor); const { eff } = effectiveStats(cfg, actor); data.value = eff[key] || 0; data.stat = data.value;
  const f = formula || cfg.dice?.statFormula || "1d20 + @value";
  const roll = await new Roll(f, data).evaluate();
  return send(roll, { actor, title: st.name, sub: `${st.abbr || key.toUpperCase()} ${data.value}`, color: st.color, icon: st.icon });
}

export async function rollItem(actor, item) {
  const cfg = getConfig(); const f = item.system.formula; if (!f) return ui.notifications.warn(`${item.name} n'a pas de formule de jet.`);
  const data = rollData(cfg, actor || item.parent); data.level = Number((actor || item.parent)?.system.level) || 0; data.item = { level: Number(item.system.level) || 0, quantity: Number(item.system.quantity) || 0 };
  let roll; try { roll = await new Roll(f, data).evaluate(); } catch (e) { return ui.notifications.error(`Formule invalide sur ${item.name} : ${f}`); }
  const rk = cfg.ranks.find(r => r.key === item.system.rank);
  return send(roll, { actor: actor || item.parent, title: item.name, sub: rk ? `Rang ${rk.name}` : "", color: rk?.color, icon: "fa-dice" });
}
