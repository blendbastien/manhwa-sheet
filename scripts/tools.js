/* Manhwa Sheet — outils de la suite dans la barre de gauche, répartis en 4 groupes cohérents
 * (MJ, Économie, Univers, Récit), chacun avec ses icônes 3D (fond dégradé par groupe ou fond transparent). */
import { SYS } from "./config.js";

/* groupe → outils (dans l'ordre d'affichage) */
export const SUITE_GROUPS = [
  { name: "msMJ", title: "MJ — Système", icon: "fa-solid fa-dice-d20", tools: ["msGmHub", "msReward", "msLoot"] },
  { name: "msEco", title: "Économie", icon: "fa-solid fa-coins", tools: ["lh-catalogue", "gacha", "vmGarage"] },
  { name: "msUni", title: "Univers", icon: "fa-solid fa-rocket", tools: ["lh-worldbook", "csm-open", "pnjManhwa", "hzTool"] },
  { name: "msRecit", title: "Récit", icon: "fa-solid fa-comment-dots", tools: ["sm-tool", "sm-journal", "nm-tool", "nm-journal"] }
];
/* outil → groupe (gardé sous ce nom pour compatibilité) */
export const SUITE_TOOLS = Object.fromEntries(SUITE_GROUPS.flatMap(g => g.tools.map((t, i) => [t, [i + 1, g.name]])));
const GROUP_ICON = { msMJ: "msGroupMJ", msEco: "msGroupEco", msUni: "msGroupUni", msRecit: "msGroupRecit" };

/* v13 : crée les groupes et y déplace les outils de la suite, où qu'ils aient été ajoutés ; v12 : tout dans les jetons */
function gather(controls) {
  try {
    if (Array.isArray(controls)) {
      const tok = controls.find(c => c.name === "token"); if (!tok) return;
      for (const c of controls) { if (c === tok) continue; for (let i = c.tools.length - 1; i >= 0; i--) { const t = c.tools[i]; if (SUITE_TOOLS[t.name]) { c.tools.splice(i, 1); if (!tok.tools.some(x => x.name === t.name)) tok.tools.push(t); } } }
      return;
    }
    const found = {};
    for (const c of Object.values(controls)) { if (!c?.tools || SUITE_GROUPS.some(g => g.name === c.name)) continue;
      for (const [n, t] of Object.entries(c.tools)) { const k = t?.name || n; if (SUITE_TOOLS[k]) { found[k] = t; delete c.tools[n]; } } }
    const base = Number(controls.tokens?.order ?? 1);
    SUITE_GROUPS.forEach((g, gi) => {
      const tools = g.tools.filter(n => found[n]); if (!tools.length) return;
      const sel = `${g.name}Sel`;
      const grp = controls[g.name] ||= { name: g.name, title: g.title, icon: g.icon, order: base + (gi + 1) / 10, visible: true, activeTool: sel, tools: {} };
      grp.tools[sel] = { name: sel, title: g.title, icon: g.icon, order: 0 };   /* outil neutre (caché) : ouvrir le groupe ne déclenche aucun bouton */
      tools.forEach((n, i) => { grp.tools[n] = { ...found[n], name: n, order: i + 1 }; });
    });
  } catch (e) { console.warn(SYS, "outils de la suite", e); }
}

/* icônes 3D : feuille de style générée selon le réglage « Icônes de la barre » */
function iconCss() {
  document.getElementById("ms-tool-icons")?.remove();
  let style = "fond"; try { style = game.settings.get(SYS, "toolIcons") || "fond"; } catch (e) {}
  const hide = SUITE_GROUPS.map(g => `#scene-controls [data-tool="${g.name}Sel"]`).join(",") + "{display:none !important}";
  if (style === "aucune") { const st = document.createElement("style"); st.id = "ms-tool-icons"; st.textContent = hide; document.head.appendChild(st); return; }
  const url = n => foundry.utils.getRoute(`systems/${SYS}/assets/tools/${style}/${n}.webp`);
  const rule = (sel, n) => `#scene-controls ${sel}{position:relative;color:transparent !important}#scene-controls ${sel}::before{content:"" !important;position:absolute;inset:${style === "fond" ? 2 : 1}px;background:url("${url(n)}") center/contain no-repeat;filter:drop-shadow(0 1px 2px #000a)}#scene-controls ${sel}:hover::before{filter:drop-shadow(0 0 6px #fff6) brightness(1.12)}`;
  const css = [...Object.keys(SUITE_TOOLS).map(n => rule(`[data-tool="${n}"]`, n)), ...Object.entries(GROUP_ICON).map(([g, n]) => rule(`[data-control="${g}"]`, n))];
  const st = document.createElement("style"); st.id = "ms-tool-icons"; st.textContent = hide + "\n" + css.join("\n"); document.head.appendChild(st);
}

Hooks.once("init", () => {
  game.settings.register(SYS, "toolIcons", { name: "Icônes de la barre d'outils", hint: "Icônes 3D des outils de la suite (barre de gauche) : avec fond dégradé par groupe, sans fond, ou icônes simples.", scope: "client", config: true, type: String, default: "fond",
    choices: { fond: "3D — fond dégradé", transparent: "3D — fond transparent", aucune: "Icônes simples" }, onChange: () => iconCss() });
  /* enregistré à l'init : passe après les modules qui ajoutent leurs outils au chargement */
  Hooks.on("getSceneControlButtons", gather);
});
Hooks.once("ready", () => {
  iconCss();
  /* si un module a ajouté son outil après nous, on reconstruit la barre une fois */
  const C = ui.controls?.controls; if (!C || Array.isArray(C)) return;
  const stray = Object.values(C).some(c => c?.tools && !SUITE_GROUPS.some(g => g.name === c.name) && Object.values(c.tools).some(t => SUITE_TOOLS[t?.name]));
  if (stray) try { ui.controls.render({ reset: true }); } catch (e) {}
});
