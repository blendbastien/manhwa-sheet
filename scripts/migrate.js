/* Manhwa Sheet — configuration versioning, backups and migrations.
   Guarantees :
   • actor / item data live in the world and are never rewritten by an update (new fields get defaults from the data models) ;
   • the GM's configuration is merged over the defaults — lists (stats, ranks, categories…) are kept wholesale, new keys only fill gaps ;
   • before any migration the previous configuration is stored in the `configBackups` world setting (last 8) and can be restored from
     Sheet configuration › Safety ;
   • a migration may rename or convert keys, never delete a value it does not understand. */
import { SYS, DEFAULT_CONFIG, LEGACY_NAMES, gaugeStages } from "./config.js";

export const CURRENT = DEFAULT_CONFIG.configVersion;

export function listBackups() { return (game.settings.get(SYS, "configBackups") || []).slice().sort((a, b) => b.at - a.at); }
export async function backupConfig(reason = "manual") {
  const raw = game.settings.get(SYS, "config"); if (!raw || !Object.keys(raw).length) return null;
  const list = game.settings.get(SYS, "configBackups") || [];
  const entry = { at: Date.now(), version: raw.configVersion || 1, reason, system: game.system.version, cfg: foundry.utils.deepClone(raw) };
  list.push(entry); while (list.length > 8) list.shift();
  await game.settings.set(SYS, "configBackups", list); return entry;
}
export async function restoreBackup(at) {
  const b = (game.settings.get(SYS, "configBackups") || []).find(x => x.at === Number(at)); if (!b) return false;
  await backupConfig("before-restore"); await game.settings.set(SYS, "config", foundry.utils.deepClone(b.cfg)); return true;
}

/* step migrations : from version N to N+1 ; each receives the raw stored object and mutates it */
export const STEPS = {
  1: raw => { /* 0.x → 1.0 : nothing renamed ; `rankColor` (never wired) is left in place, unused keys are harmless */ },
  /* 1.0 → 1.1 : interface en français, arbre des objets aligné sur LE CATALOGUE, familles d'armures par zone du corps.
   * Si l'arbre enregistré est resté celui d'origine (mêmes identifiants, mêmes noms anglais), il est remplacé par le nouveau ;
   * sinon seuls les noms encore anglais sont traduits, et la structure du MJ est respectée. Les identifiants des feuilles ne changent pas. */
  2: raw => {
    if (!Array.isArray(raw.items) || !raw.items.length) return;
    const flat = []; const walk = ns => { for (const n of ns || []) { flat.push(n); walk(n.children); } }; walk(raw.items);
    const untouched = flat.every(n => LEGACY_NAMES[n.id] !== undefined && LEGACY_NAMES[n.id] === n.name);
    if (untouched) { raw.items = foundry.utils.deepClone(DEFAULT_CONFIG.items); return; }
    const fr = {}; const walk2 = ns => { for (const n of ns || []) { fr[n.id] = n.name; walk2(n.children); } }; walk2(DEFAULT_CONFIG.items);
    for (const n of flat) if (LEGACY_NAMES[n.id] === n.name && fr[n.id]) n.name = fr[n.id];
    /* listes par défaut restées en anglais → français (seulement si inchangées) */
    const lists = ["rarities", "elements", "costs", "ranges", "executions", "awakening", "stats", "resources"];
    for (const L of lists) { const def = DEFAULT_CONFIG[L]; if (!Array.isArray(raw[L]) || !Array.isArray(def)) continue; for (const e of raw[L]) { const d = def.find(x => x.key === e.key); if (d && EN_DEFAULTS[L]?.[e.key] === e.name) { e.name = d.name; if (d.abbr && e.abbr === EN_DEFAULTS.abbr?.[e.key]) e.abbr = d.abbr; } } }
    if (Array.isArray(raw.identity) && raw.identity.every((sec, i) => EN_DEFAULTS.identitySections[i] === sec.name && sec.fields?.length === DEFAULT_CONFIG.identity[i]?.fields.length)) raw.identity = foundry.utils.deepClone(DEFAULT_CONFIG.identity);
  }
  ,
  /* 1.2 → 1.3 : familles de véhicules renommées (si encore aux noms 1.1), clés de rareté en double (« Commun » et « Commun+ » → commun) séparées */
  3: raw => {
    const REN = { vehicle_land: ["Terre", "Véhicules terrestres"], vehicle_sea_and_air: ["Mer & Air", "Navires & aéronefs"], vehicle_space_and_beyond: ["Espace & Au-delà", "Spatial & au-delà"] };
    const LEAF = { vehicle_ground: ["Terrestre", "Routiers"], vehicle_nautical: ["Nautique", "Navires"], vehicle_aerial: ["Aérien", "Aéronefs"], vehicle_mechanical: ["Mécanique", "Mécas"] };
    const walk = ns => { for (const n of ns || []) { const r = REN[n.id] || LEAF[n.id]; if (r && n.name === r[0]) n.name = r[1]; walk(n.children); } };
    if (Array.isArray(raw.items)) walk(raw.items);
    if (Array.isArray(raw.rarities)) { const seen = new Set(); for (const r of raw.rarities) { if (seen.has(r.key)) r.key = String(r.name || r.key).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\+/g, "_plus").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); seen.add(r.key); } }
  }
  ,
  4: raw => { /* 1.24.3 : Titres › « Obtention » devient « Succès » ; les titres gagnent le champ « Condition d'obtention » */
    const walk = ns => { for (const n of ns || []) { if (n.id === "title_achievement" && n.name === "Obtention") n.name = "Succès"; if (n.id === "title" && Array.isArray(n.fields) && !n.fields.includes("condition")) { const i = n.fields.indexOf("description"); n.fields.splice(i >= 0 ? i + 1 : n.fields.length, 0, "condition"); } walk(n.children); } };
    if (Array.isArray(raw.items)) walk(raw.items);
  }
  ,
  5: raw => { /* 1.26.0 : fin du « mode narratif ». Ce qu'il masquait reste masqué (XP, dés, bonus d'objets) ; ses jauges en stades deviennent le réglage « Affichage des jauges : stades ».
     L'XP gagne des modèles de coût (simple, paliers, un par un, formule) : une formule déjà saisie reste utilisée. */
    raw.features ||= {}; const f = raw.features;
    if (raw.mode === "narrative") { f.xp = false; f.dice = false; f.itemStats = false; const st = f.narrativeGauges !== false; f.gauges = st; raw.gaugeDisplay = st ? "stages" : "numbers"; if (st) raw.__syncStages = true; }
    raw.mode = "general"; delete f.narrativeGauges;
    raw.xp ||= {}; if (!raw.xp.costMode) raw.xp.costMode = raw.xp.formula ? "formula" : "simple";
  }
  ,
  /* 1.x → v7 : arbre des objets refondu d'après LE CATALOGUE — catégories manquantes ajoutées (De fortune, Matériaux, Butin, Récupération…),
     branches trop maigres enrichies (Tenues complètes, Munitions…), « Instruments » sort de Magie, niveaux inutiles supprimés (Boucliers › Boucliers,
     Tenues complètes › Tenues, Bijoux › Accessoires, Titres › « Titre acquis »…). Tout se fait par identifiant, sur l'arbre du MJ :
     aucune feuille n'est supprimée ni renommée d'identifiant, noms / icônes / couleurs / champs personnalisés et nœuds ajoutés par le MJ sont conservés. */
  6: raw => { if (Array.isArray(raw.items) && raw.items.length) treeV7(raw.items); },
  /* 1.35 : textes de progression restés en anglais (anciens mondes) → français, seulement s'ils n'ont pas été réécrits */
  7: raw => { const P = raw.progression; if (!P) return; const D = DEFAULT_CONFIG.progression;
    const TN = { Novice: "Novice", Apprentice: "Apprenti", Adept: "Adepte", Expert: "Expert", Master: "Maître", "Grand master": "Grand maître", Grandmaster: "Grand maître", Legend: "Légende", Legendary: "Légende", Myth: "Mythe", Mythic: "Mythe", Transcendent: "Transcendant" };
    if (Array.isArray(P.tierNames)) P.tierNames = P.tierNames.map(n => TN[n] ?? n);
    const EN = /\b(sealed|reached|limit|insufficient|not enough|enters|tier|stat)\b/i;
    if (P.messages) for (const k of Object.keys(D.messages)) if (typeof P.messages[k] === "string" && EN.test(P.messages[k]) && !/[éèàç]|statistique/i.test(P.messages[k])) P.messages[k] = D.messages[k];
    for (const k of ["levelUp", "tierUp"]) if (P[k]?.text && EN.test(P[k].text) && !/[éèàç]|niveau|palier/i.test(P[k].text)) P[k].text = D[k].text; }
};

/* ── outils d'arbre (migrations par identifiant) ── */
function locate(roots, id) {   /* → { node, list (tableau qui le contient), index, parent } ou null */
  const walk = (list, parent) => { for (let i = 0; i < list.length; i++) { const n = list[i]; if (n?.id === id) return { node: n, list, index: i, parent }; const r = Array.isArray(n?.children) ? walk(n.children, n) : null; if (r) return r; } return null; };
  return walk(roots, null);
}
const hasKids = n => Array.isArray(n?.children) && n.children.length > 0;
const idsOf = (n, out = new Set()) => { if (n?.id) out.add(n.id); for (const c of n?.children || []) idsOf(c, out); return out; };
/* insère `node` dans `list` : pos = { after: id } | { before: id } | rien (à la fin) — si le repère n'y est pas, à la fin */
function insertAt(list, node, pos = {}) {
  const ref = pos.after ?? pos.before; const i = ref ? list.findIndex(n => n?.id === ref) : -1;
  if (i < 0) list.push(node); else list.splice(pos.after ? i + 1 : i, 0, node);
}
/* premier parent existant parmi les candidats, jamais une feuille (une feuille porte peut-être des objets : lui ajouter des enfants la rendrait inaccessible) */
function parentFor(roots, candidates, fresh) {
  for (const pid of [].concat(candidates)) { const f = locate(roots, pid); if (!f) continue; if (hasKids(f.node) || fresh?.has(pid)) return f.node; }
  return null;
}
/* ajoute un nœud (et sa descendance) s'il n'existe nulle part ; s'il existe déjà, complète seulement ses enfants manquants */
function ensureNode(roots, candidates, spec, pos, fresh = new Set()) {
  const there = locate(roots, spec.id);
  if (there) { for (const c of spec.children || []) ensureNode(roots, [spec.id], c, undefined, fresh); return; }
  const parent = parentFor(roots, candidates, fresh); if (!parent) return;
  const existing = new Set(); for (const r of roots) idsOf(r, existing);
  const prune = n => ({ ...foundry.utils.deepClone({ ...n, children: [] }), children: (n.children || []).filter(c => !existing.has(c.id)).map(prune) });
  const node = prune(spec); idsOf(node, fresh);
  insertAt(parent.children ||= [], node, pos);
}
/* déplace un nœud — seulement s'il est encore sous son ancien parent (un déplacement fait par le MJ est respecté) */
function moveNode(roots, id, fromParent, toCandidates, pos) {
  const f = locate(roots, id); if (!f || (f.parent?.id ?? null) !== fromParent) return null;
  const to = parentFor(roots, toCandidates); if (!to || idsOf(f.node).has(to.id)) return null;
  f.list.splice(f.index, 1); insertAt(to.children ||= [], f.node, pos); return f.node;
}
/* supprime un niveau intermédiaire inutile : `parent` n'a qu'un enfant `child` (qui a lui-même des enfants) → les enfants de `child` remontent dans `parent`.
   Rien n'est perdu : toute la descendance (y compris ce que le MJ y a ajouté) remonte ; si le MJ a mis d'autres enfants dans `parent`, on ne touche à rien. */
function collapseLevel(roots, parentId, childId) {
  const p = locate(roots, parentId)?.node; if (!p || !Array.isArray(p.children) || p.children.length !== 1 || p.children[0]?.id !== childId) return false;
  const c = p.children[0]; if (!hasKids(c)) return false;
  if (Array.isArray(c.fields)) { if (!Array.isArray(p.fields)) p.fields = c.fields; else for (const g of c.children) if (!Array.isArray(g.fields)) g.fields = foundry.utils.deepClone(c.fields); }
  if (c.color && !p.color) p.color = c.color;
  if (!p.icon && c.icon) p.icon = c.icon;
  p.children = c.children; return true;
}
/* catégorie à feuille unique (Succès › « Titre acquis ») : la feuille (son identifiant, donc ses objets) prend la place de la catégorie,
   avec son nom (sauf si le MJ avait renommé la feuille), son icône, sa couleur et ses champs */
function promoteLeaf(roots, parentId, leafId, leafDefaultName, icon) {
  const f = locate(roots, parentId); if (!f) return false; const p = f.node;
  if (!Array.isArray(p.children) || p.children.length !== 1 || p.children[0]?.id !== leafId || hasKids(p.children[0])) return false;
  const leaf = p.children[0];
  if (leaf.name === leafDefaultName || !leaf.name) leaf.name = p.name;
  if (!leaf.icon) leaf.icon = p.icon || icon; if (!leaf.icon) delete leaf.icon;
  if (p.color && !leaf.color) leaf.color = p.color;
  if (Array.isArray(p.fields) && !Array.isArray(leaf.fields)) leaf.fields = p.fields;
  leaf.children = []; f.list.splice(f.index, 1, leaf); return true;
}
function renameNode(roots, id, from, to) { const n = locate(roots, id)?.node; if (n && n.name === from) n.name = to; }

/* données de l'étape 6 (figées : elles décrivent le passage v6 → v7, pas les défauts futurs) */
const L = (id, name) => ({ id, name, children: [] });
const V7 = {
  moves: [
    { id: "weapon_instruments", from: "weapon_magic", to: ["weapon"], pos: { after: "weapon_magic" }, icon: "fa-music" },
    { id: "armor_clothing_night", from: "armor_underwear", to: ["armor_clothing", "armor_outfits"], pos: { after: "armor_outfits_winter" }, late: true }   /* après les ajouts : son repère (Tenue d'hiver) existe alors */
  ],
  collapses: [["armor_jewelry", "armor_accessories"], ["armor_shields_fam", "armor_shields"], ["armor_outfits", "armor_clothing"]],
  promotes: [
    ["title_achievement", "title_achievement_earned_title", "Titre acquis"], ["title_shop", "title_shop_purchased_title", "Titre acheté"],
    ["title_faction", "title_faction_earned_title", "Titre acquis"], ["title_negative", "title_negative_earned_title", "Titre acquis"],
    ["title_event", "title_event_earned_title", "Titre acquis"], ["title_hidden", "title_hidden_earned_title", "Titre acquis"],
    ["title_slayer", "title_slayer_earned_title", "Titre acquis"], ["title_explorer", "title_explorer_earned_title", "Titre acquis"],
    ["title_honorific", "title_honorific_earned_title", "Titre acquis"], ["title_social", "title_social_earned_title", "Titre acquis"],
    ["title_sponsor", "title_sponsor_earned_title", "Titre acquis"], ["title_scenario", "title_scenario_earned_title", "Titre acquis"],
    ["title_seasonal", "title_seasonal_earned_title", "Titre acquis"], ["title_lecteur", "title_lecteur_titre_acquis", "Titre acquis", "fa-book-open"],
    ["skill_scourge", "skill_scourge_malus", "Malus"], ["skill_awakening", "skill_awakening_signature", "Signature"]
  ],
  renames: [
    ["weapon_ranged", "Distance", "Trait & jet"], ["armor_clothing_outfits", "Tenues", "Tenues diverses"], ["armor_clothing_night", "Nuit", "Pyjamas & nuit"],
    ["armor_underwear", "Sous-vêtements & nuit", "Sous-vêtements & lingerie"], ["item_ammunition_cells", "Cellules", "Cellules d'énergie"],
    /* feuilles homonymes de leur catégorie (Jouets › Jouet…) */
    ["armor_clothing_belts", "Ceinture", "Ceinture simple"], ["item_relics_relic", "Relique", "Relique ancienne"], ["item_toys_toy", "Jouet", "Jouet classique"],
    ["companion_avatar_avatar", "Avatar", "Avatar complet"], ["vehicle_aerial_aircraft", "Aéronef", "Avion"], ["vehicle_mechanical_mech", "Méca", "Méca piloté"], ["vehicle_fuels_fuel", "Carburant", "Carburant liquide"]
  ],
  adds: [
    /* armes */
    { to: "weapon_melee", pos: { after: "weapon_improvised" }, node: { id: "weapon_makeshift", name: "De fortune", icon: "fa-screwdriver-wrench", children: [L("weapon_makeshift_slashing", "Tranchant"), L("weapon_makeshift_blunt", "Contondant"), L("weapon_makeshift_piercing", "Perforant"), L("weapon_makeshift_ranged", "Tir")] } },
    { to: "weapon_firearms", pos: { after: "weapon_firearms_machine_gun" }, node: L("weapon_firearms_grenade_launcher", "Lance-grenades") },
    { to: "weapon_firearms", pos: { after: "weapon_firearms_grenade_launcher" }, node: L("weapon_firearms_rocket_launcher", "Lance-roquettes") },
    { to: "weapon_firearms", pos: { after: "weapon_firearms_rocket_launcher" }, node: L("weapon_firearms_flamethrower", "Lance-flammes") },
    { to: "weapon_special_ammunition", pos: { after: "weapon_special_ammunition_bullet" }, node: L("weapon_special_ammunition_cartridge", "Cartouche") },
    { to: "weapon_special_ammunition", pos: { after: "weapon_special_ammunition_bolt" }, node: L("weapon_special_ammunition_dart", "Fléchette") },
    { to: "weapon_special_ammunition", pos: { after: "weapon_special_ammunition_shell" }, node: L("weapon_special_ammunition_rocket", "Roquette") },
    { to: "weapon_special_ammunition", pos: { after: "weapon_special_ammunition_cell" }, node: L("weapon_special_ammunition_plasma", "Charge plasma") },
    { to: "weapon_special_ammunition", pos: { after: "weapon_special_ammunition_plasma" }, node: L("weapon_special_ammunition_mana_crystal", "Cristal de mana") },
    { to: "weapon_instruments", node: L("weapon_instruments_harp", "Harpe") },
    { to: "weapon_instruments", node: L("weapon_instruments_lyre", "Lyre") },
    { to: "weapon_instruments", node: L("weapon_instruments_trumpet", "Trompette") },
    { to: "weapon_instruments", node: L("weapon_instruments_synthesizer", "Synthétiseur") },
    { to: "weapon_artifacts", node: L("weapon_artifacts_legendary", "Arme légendaire") },
    { to: "weapon_artifacts", node: L("weapon_artifacts_divine", "Arme divine") },
    { to: "weapon_artifacts", node: L("weapon_artifacts_sealed", "Arme scellée") },
    { to: "weapon_sponsor", node: L("weapon_sponsor_blessed", "Arme bénie") },
    { to: "weapon_sponsor", node: L("weapon_sponsor_pact", "Arme de pacte") },
    /* armures */
    { to: "armor_armors", pos: { after: "armor_natural" }, node: { id: "armor_makeshift", name: "De fortune", icon: "fa-screwdriver-wrench", children: [L("armor_makeshift_chest", "Plastron"), L("armor_makeshift_helmet", "Casque"), L("armor_makeshift_pads", "Protections"), L("armor_makeshift_mask", "Masque")] } },
    { to: ["armor_shields", "armor_shields_fam"], node: L("armor_shields_tower", "Pavois") },
    { to: ["armor_shields", "armor_shields_fam"], node: L("armor_shields_riot", "Antiémeute") },
    { to: ["armor_accessories", "armor_jewelry"], pos: { after: "armor_accessories_earring" }, node: L("armor_accessories_piercing", "Piercing") },
    { to: ["armor_accessories", "armor_jewelry"], pos: { after: "armor_accessories_necklace" }, node: L("armor_accessories_pendant", "Pendentif") },
    { to: ["armor_accessories", "armor_jewelry"], pos: { after: "armor_accessories_watch" }, node: L("armor_accessories_anklet", "Chaîne de cheville") },
    ...[["armor_outfits_city", "Tenue de ville"], ["armor_outfits_casual", "Tenue décontractée"], ["armor_outfits_beach", "Tenue de plage & maillots"], ["armor_outfits_formal", "Tenue de soirée & gala"],
      ["armor_outfits_ceremony", "Tenue de cérémonie & mariage"], ["armor_outfits_combat", "Tenue de combat"], ["armor_outfits_martial", "Tenue d'arts martiaux"], ["armor_outfits_adventure", "Tenue d'aventurier"],
      ["armor_outfits_noble", "Tenue noble & de cour"], ["armor_outfits_stage", "Tenue de scène"], ["armor_outfits_winter", "Tenue d'hiver"], ["armor_outfits_rain", "Tenue de pluie"]]
      .map(([id, name], i, a) => ({ to: ["armor_clothing", "armor_outfits"], pos: { after: i ? a[i - 1][0] : "armor_clothing_outfits" }, node: L(id, name) })),
    { to: ["armor_clothing", "armor_outfits"], pos: { after: "armor_clothing_costumes" }, node: L("armor_outfits_disguise", "Déguisements & cosplay") },
    { to: ["armor_clothing", "armor_outfits"], pos: { after: "armor_clothing_traditionnel_clockwork" }, node: L("armor_outfits_traditional", "Tenue traditionnelle") },
    /* objets */
    { to: "item_ammunition", pos: { before: "item_ammunition_cartridges" }, node: L("item_ammunition_bullets", "Balles") },
    { to: "item_ammunition", pos: { after: "item_ammunition_cartridges" }, node: L("item_ammunition_powder", "Poudre & amorces") },
    { to: "item_ammunition", pos: { after: "item_ammunition_bolts" }, node: L("item_ammunition_darts", "Fléchettes & aiguilles") },
    { to: "item_ammunition", pos: { after: "item_ammunition_darts" }, node: L("item_ammunition_sling", "Billes & galets de fronde") },
    { to: "item_ammunition", pos: { after: "item_ammunition_sling" }, node: L("item_ammunition_javelins", "Javelines & harpons") },
    { to: "item_ammunition", pos: { after: "item_ammunition_shell" }, node: L("item_ammunition_grenades", "Grenades de lanceur") },
    { to: "item_ammunition", pos: { after: "item_ammunition_grenades" }, node: L("item_ammunition_rockets", "Roquettes & missiles") },
    ...[["item_ammunition_batteries", "Batteries"], ["item_ammunition_plasma", "Charges plasma"], ["item_ammunition_laser", "Capsules laser"], ["item_ammunition_rail", "Projectiles de railgun"],
      ["item_ammunition_cryo", "Charges cryogéniques"], ["item_ammunition_cores", "Noyaux d'énergie"], ["item_ammunition_antimatter", "Antimatière"], ["item_ammunition_mana_crystals", "Cristaux de mana"], ["item_ammunition_fuel", "Carburant & gaz d'arme"]]
      .map(([id, name], i, a) => ({ to: "item_ammunition", pos: { after: i ? a[i - 1][0] : "item_ammunition_cells" }, node: L(id, name) })),
    { to: "item_survival_and_daily", pos: { after: "item_tools" }, node: { id: "item_salvage", name: "Récupération", icon: "fa-recycle", children: [L("item_salvage_scrap", "Ferraille"), L("item_salvage_electronics", "Électronique"), L("item_salvage_filtration", "Filtration"), L("item_salvage_parts", "Pièce détachée"), L("item_salvage_fuel", "Carburant"), L("item_salvage_find", "Trouvaille")] } },
    { to: "item_rarities", pos: { after: "item_trophies" }, node: { id: "item_loot", name: "Butin", icon: "fa-bone", children: [L("item_loot_beast", "Bête"), L("item_loot_insect", "Insecte"), L("item_loot_undead", "Mort-vivant"), L("item_loot_dragon", "Dragon & reptile"), L("item_loot_elemental", "Élémentaire"), L("item_loot_aberration", "Aberration"), L("item_loot_plant", "Plante"), L("item_loot_machine", "Machine"), L("item_loot_abyssal", "Abysseux"), L("item_loot_shadow", "Ombre")] } },
    { to: "item_knowledge_and_tech", pos: { after: "item_components" }, node: { id: "item_materials", name: "Matériaux", icon: "fa-cubes-stacked", children: [L("item_materials_wood", "Bois"), L("item_materials_ore", "Minerai"), L("item_materials_ingot", "Lingot"), L("item_materials_leather", "Cuir & peau"), L("item_materials_cloth", "Tissu & fibre"), L("item_materials_stone", "Pierre"), L("item_materials_resin", "Résine & huile"), L("item_materials_bone", "Os & corne"), L("item_materials_tech", "Composant tech"), L("item_materials_glass", "Verre & céramique")] } },
    { to: "item_treasures", node: L("item_treasures_boss", "Butin de boss") },
    { to: "item_treasures", node: L("item_treasures_hoard", "Trésor caché") },
    { to: "item_fragments", node: L("item_fragments_soul", "Fragment d'âme") },
    { to: "item_fragments", node: L("item_fragments_artifact", "Fragment d'artefact") },
    { to: "item_fragments", node: L("item_fragments_map", "Fragment de carte") },
    { to: "item_fragments", node: L("item_fragments_memory", "Fragment de mémoire") },
    /* véhicules, propriétés */
    { to: "vehicle_fuels", node: L("vehicle_fuels_battery", "Batterie & cellule") },
    { to: "vehicle_fuels", node: L("vehicle_fuels_mana_crystal", "Cristal de propulsion") },
    { to: "property_mining", node: L("property_mining_quarry", "Carrière") },
    { to: "property_mining", node: L("property_mining_well", "Puits de forage") },
    { to: "property_mining", node: L("property_mining_crystal", "Gisement de cristaux") },
    { to: "property_guild", node: L("property_guild_hq", "Quartier général") },
    { to: "property_guild", node: L("property_guild_outpost", "Avant-poste") },
    { to: "property_guild", node: L("property_guild_training", "Salle d'entraînement") }
  ]
};
export function treeV7(roots) {
  const move = m => { const n = moveNode(roots, m.id, m.from, m.to, m.pos); if (n && m.icon && !n.icon) n.icon = m.icon; };
  V7.moves.filter(m => !m.late).forEach(move);
  for (const [p, c] of V7.collapses) collapseLevel(roots, p, c);
  for (const [p, l, def, icon] of V7.promotes) promoteLeaf(roots, p, l, def, icon);
  for (const [id, from, to] of V7.renames) renameNode(roots, id, from, to);
  const fresh = new Set(); for (const a of V7.adds) ensureNode(roots, a.to, a.node, a.pos, fresh);
  V7.moves.filter(m => m.late).forEach(move);
  return roots;
}
/* ancien mode narratif : le stade était saisi à part ; on recopie chaque stade dans la valeur (valeur = stade / n × max) pour que l'affichage en stades et en nombres montre la même chose */
async function syncStages(cfg) {
  for (const a of game.actors) { const upd = {}; for (const g of cfg.gauges || []) { if (g.maxMode === "stages") continue; const gv = a.system.gauges?.[g.key]; const n = gaugeStages(g).length; const max = Number(gv?.max) || 0; if (!gv || !gv.stage || !max) continue; upd[`system.gauges.${g.key}.value`] = Math.round(Math.max(1, Math.min(n, Number(gv.stage))) / n * max); }
    if (Object.keys(upd).length) try { await a.update(upd, { manhwaMigration: true }); } catch (e) { console.warn(SYS, "stage sync", a.name, e); } }
}
/* anciens libellés anglais des listes par défaut (1.0.x) */
const EN_DEFAULTS = {
  stats: { str: "Strength", agi: "Agility", vit: "Vitality", int: "Intelligence", per: "Perception", wil: "Will", mana: "Mana", luck: "Luck" }, abbr: { str: "STR", agi: "AGI", vit: "VIT", int: "INT", per: "PER", wil: "WIL", mana: "MANA", luck: "LUCK" },
  resources: { coins: "Coins" }, awakening: { unawakened: "Unawakened", awakened: "Awakened", transcended: "Transcended" },
  rarities: { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary", mythic: "Mythic" },
  elements: { none: "None", fire: "Fire", water: "Water", earth: "Earth", wind: "Wind", lightning: "Lightning", light: "Light", dark: "Dark" },
  costs: { none: "None", low: "Low", medium: "Medium", high: "High", extreme: "Extreme" }, ranges: { self: "Self", melee: "Melee", short: "Short", medium: "Medium", long: "Long", area: "Area" },
  executions: { instant: "Instant", action: "Action", channeled: "Channeled", reaction: "Reaction", passive: "Passive" },
  identitySections: ["Personal", "Physique", "Appearance", "Family", "Daily life", "Relationships", "Personality"]
};

export async function migrateConfig() {
  if (!game.user.isGM || game.user !== (game.users.activeGM ?? game.user)) return;   /* un seul MJ migre (deux MJ connectés : une seule sauvegarde, une seule écriture) */
  const raw = game.settings.get(SYS, "config"); if (!raw || !Object.keys(raw).length) return;   /* fresh world : defaults apply, nothing stored yet */
  let v = Number(raw.configVersion) || 1; if (v >= CURRENT) return;
  await backupConfig(`migration ${v} → ${CURRENT}`);
  const work = foundry.utils.deepClone(raw);
  while (v < CURRENT) { try { STEPS[v]?.(work); } catch (e) { console.error(SYS, "migration step failed", v, e); return ui.notifications.error(`Manhwa Sheet : la migration de configuration ${v} → ${v + 1} a échoué — rien n'a été modifié, une sauvegarde a été conservée.`); } v++; }
  work.configVersion = CURRENT; const sync = work.__syncStages; delete work.__syncStages;
  await game.settings.set(SYS, "config", work);
  if (sync) await syncStages(foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_CONFIG), work, { inplace: false }));
  ui.notifications.info(`Manhwa Sheet : configuration passée en v${CURRENT}. L'ancienne est sauvegardée dans Configuration de la fiche › Sécurité.`);
}
