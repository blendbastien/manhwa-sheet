/* Manhwa Sheet — configuration (world setting), defaults, helpers */
import { DEFAULT_ITEMS, LEGACY_NAMES } from "./taxonomy.js";
export { LEGACY_NAMES };
export const SYS = "manhwa-sheet";
/** 1.39 : un personnage « joueur » est un personnage attribué à un joueur (sinon : personnage) */
export const isPlayerChar = a => !!a && game.users.some(u => !u.isGM && u.character?.id === a.id);
export const kindLabel = a => isPlayerChar(a) ? "Joueur" : "Personnage";
/** 1.39 : badge de rang commun à la suite (même dessin que la Boutique : hexagone plein, reflet miroir) — hors fiche personnage */
export const rankBadge = (rk, { size = "", cls = "" } = {}) => rk?.name ? `<span class="ms-rkb ${size} n${Math.min(3, String(rk.name).length)} ${cls}" style="--rc:${foundry.utils.escapeHTML(String(rk.color || "#9fb0d4"))}"><b>${foundry.utils.escapeHTML(String(rk.name))}</b></span>` : "";
export const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
export const uid = () => foundry.utils.randomID(8);

export const AWAKENING_ANIMS = { none: "Aucune", pulse: "Pulsation", aura: "Aura (halo)", flame: "Flamme", spark: "Étincelles", glitch: "Glitch", frost: "Givre", void: "Vide" };
export const THEMES = { "solo-neon": "Solo Néon (bleu électrique)", "orv-violet": "Violet Néon (ORV)", crimson: "Cramoisi (murim)", gold: "Or (sénat)", mono: "Mono (noir minimal)",
  /* 1.28 : un thème par monde de la campagne */
  "w-eos": "Eos — La nuit avance", "w-cordelia": "Cordelia — Refuge lumineux", "w-eryndor": "Eryndor — La nuit éternelle", "w-hyperion": "Hyperion — Les îles volantes", "w-andromeda": "Andromeda — Le monde englouti",
  "w-clockwork": "Clockwork — La planète-machine", "w-nova": "Nova — Les dômes assiégés", "w-inertia": "Inertia — La méga-station", "w-triangulum": "Triangulum — Zone fracturée" };

/* field catalog for item categories */
export const ITEM_FIELDS = {
  rank: { label: "Rang", kind: "rank" }, rarity: { label: "Rareté", kind: "list", list: "rarities" }, quantity: { label: "Quantité", kind: "number" }, value: { label: "Valeur", kind: "number" },
  level: { label: "Niveau", kind: "number" }, slotCost: { label: "Places occupées", kind: "number" }, element: { label: "Élément", kind: "list", list: "elements" }, cost: { label: "Coût", kind: "list", list: "costs" }, range: { label: "Portée", kind: "list", list: "ranges" },
  execution: { label: "Exécution", kind: "list", list: "executions" }, origin: { label: "Origine", kind: "origin" }, manufacturer: { label: "Constructeur", kind: "text" }, capacity: { label: "Capacité", kind: "number", hidden: true },
  slots: { label: "Emplacements d'équipement offerts", kind: "number", bag: true }, description: { label: "Description", kind: "rich" }, condition: { label: "Condition d'obtention", kind: "rich" }, lore: { label: "Lore", kind: "rich" },
  stats: { label: "Bonus de stats", kind: "stats", feature: "itemStats" }, formula: { label: "Formule de jet", kind: "formula", feature: "dice" }
};

/* curated Font Awesome Free (solid) icons for the picker */
export const ICONS = ["fa-hand-fist","fa-person-running","fa-heart-pulse","fa-brain","fa-eye","fa-fire","fa-wand-sparkles","fa-clover","fa-bolt","fa-shield-halved","fa-shield","fa-khanda","fa-gun","fa-crosshairs","fa-bullseye","fa-wind","fa-droplet","fa-snowflake","fa-sun","fa-moon","fa-star","fa-skull","fa-ghost","fa-dragon","fa-paw","fa-feather","fa-leaf","fa-seedling","fa-mountain","fa-water","fa-cloud-bolt","fa-meteor","fa-atom","fa-dna","fa-flask","fa-vial","fa-pills","fa-heart","fa-hand-sparkles","fa-hand","fa-hands-praying","fa-dumbbell","fa-person-walking","fa-shoe-prints","fa-ear-listen","fa-nose","fa-comment","fa-book","fa-scroll","fa-gem","fa-coins","fa-sack-dollar","fa-money-bill","fa-ticket","fa-key","fa-lock","fa-unlock","fa-crown","fa-chess-king","fa-chess-queen","fa-chess-knight","fa-ring","fa-shirt","fa-hat-wizard","fa-mask","fa-glasses","fa-sack-xmark","fa-briefcase","fa-box","fa-boxes-stacked","fa-cube","fa-gear","fa-screwdriver-wrench","fa-hammer","fa-car","fa-motorcycle","fa-ship","fa-rocket","fa-plane","fa-horse","fa-house","fa-building","fa-landmark","fa-city","fa-map","fa-compass","fa-flag","fa-trophy","fa-medal","fa-award","fa-certificate","fa-infinity","fa-hourglass","fa-clock","fa-calendar","fa-bell","fa-music","fa-microphone","fa-palette","fa-pen","fa-utensils","fa-mug-hot","fa-bone","fa-bug","fa-spider","fa-fish","fa-dove","fa-crow","fa-cat","fa-dog","fa-user","fa-users","fa-user-ninja","fa-user-secret","fa-user-shield","fa-robot","fa-microchip","fa-satellite","fa-radiation","fa-biohazard","fa-virus","fa-eye-slash","fa-fingerprint","fa-circle","fa-square","fa-diamond","fa-asterisk","fa-burst","fa-explosion","fa-fire-flame-curved","fa-wind","fa-tornado","fa-bolt-lightning","fa-volcano","fa-icicles","fa-hurricane","fa-folder","fa-tag","fa-tags","fa-list","fa-table","fa-layer-group","fa-sitemap"];

export const DEFAULT_CONFIG = {
  v: 1,
  stats: [
    { key: "str", name: "Force", abbr: "FOR", icon: "fa-hand-fist", color: "#ff4d5e", min: 1, max: 99, costMult: 1, locked: false },
    { key: "agi", name: "Agilité", abbr: "AGI", icon: "fa-person-running", color: "#38e0ff", min: 1, max: 99, costMult: 1, locked: false },
    { key: "vit", name: "Vitalité", abbr: "VIT", icon: "fa-heart-pulse", color: "#5aff9a", min: 1, max: 99, costMult: 1, locked: false },
    { key: "int", name: "Intelligence", abbr: "INT", icon: "fa-brain", color: "#7ad7ff", min: 1, max: 99, costMult: 1, locked: false },
    { key: "per", name: "Perception", abbr: "PER", icon: "fa-eye", color: "#ffd070", min: 1, max: 99, costMult: 1, locked: false },
    { key: "wil", name: "Volonté", abbr: "VOL", icon: "fa-fire", color: "#ff8af0", min: 1, max: 99, costMult: 1, locked: false },
    { key: "mana", name: "Mana", abbr: "MANA", icon: "fa-wand-sparkles", color: "#b980ff", min: 1, max: 99, costMult: 1.5, locked: false },
    { key: "luck", name: "Chance", abbr: "CHA", icon: "fa-clover", color: "#c9f06a", min: 1, max: 99, costMult: 1, locked: false }
  ],
  statColorMode: "card",                          /* card | number | watermark */
  statsTotalBar: "center",                        /* center | side | hidden */
  statsAverage: false,
  carnet: { enabled: true },                      /* bouton Carnet (amis, téléportation, notes) sur la fiche */                            /* afficher la moyenne des stats dans le total (désactivé par défaut) */
  portraitShape: "rect",                          /* rect | square */
  resources: [{ key: "coins", name: "Gold", icon: "fa-coins", color: "#ffd070", start: 0, min: 0, inHeader: true, paysStats: true }],
  ranks: [
    { key: "E", name: "E", color: "#9aaac8" }, { key: "D", name: "D", color: "#5aa6f0" }, { key: "C", name: "C", color: "#20d8f8" }, { key: "B", name: "B", color: "#b46bff" },
    { key: "A", name: "A", color: "#34d46e" }, { key: "S", name: "S", color: "#f5c842" }, { key: "S+", name: "S+", color: "#ff7a2a" }
  ],
  rankColor: { targets: ["badge", "name"], intensity: 1, rarityOwnColor: false },  /* targets: badge | name | row | glow | hex */
  awakening: [{ key: "unawakened", name: "Non éveillé", color: "#8ea0c8", anim: "none" }, { key: "awakened", name: "Éveillé", color: "#38a8ff", anim: "pulse" }, { key: "transcended", name: "Transcendé", color: "#ffd070", anim: "aura" }],
  rankTintsSheet: true,                           /* the character's rank color tints the sheet (brackets, name glow, portrait, panels) */
  showEmptyTabs: true,                            /* false = item tabs only appear once the character owns something in them (a + tab opens the others) */
  itemIconSize: 40,                               /* thumbnail size in inventory tables (px) */
  itemImageSize: 128,                             /* image size on the item sheet (px) — each item can override */
  window: { width: 1020, height: 820, zoom: 100, portrait: 150, remember: true },   /* fenêtre de la fiche : taille par défaut, zoom (%), largeur du portrait (px), mémoriser la taille de chaque fiche */
  headerSizes: { res: 36, title: 36, bag: 36, awakening: 36, font: 100 },           /* hauteurs (px) des monnaies, du titre, du sac, de l'éveil ; taille du texte (%) */
  uiSize: "m",                                    /* taille des onglets, sous-catégories, bandeaux et lignes d'objets : s | m | l | xl */
  itemRankStyle: { header: true, frame: true, name: true, fields: true, badge: true, bg: "glow", strength: 1 },  /* how an item's rank color dresses its sheet; bg: none | glow | hatch | scan */
  configVersion: 8,
  /* ── fonctions de la fiche (chacune optionnelle) ; l'ancien « mode narratif » (1.x → 1.25) est converti par la migration 5 → 6 */
  mode: "general",
  features: { gauges: true, xp: true, dice: true, itemStats: true, favorites: true },
  gaugeDisplay: "numbers",                          /* numbers = valeur / max ; stages = dix stades nommés calculés depuis la valeur (même donnée, autre affichage) */
  gauges: [   /* maxMode : simple (base + per level + stat × factor) | formula (advanced) | manual (number per character) */
    { key: "hp", name: "Santé", abbr: "PV", icon: "fa-heart", color: "#ff4d6d", maxMode: "simple", simple: { base: 50, perLevel: 5, stat: "vit", perStat: 10 }, formula: "", maxValue: 100, token: true },
    { key: "mana", name: "Mana", abbr: "PM", icon: "fa-droplet", color: "#38a8ff", maxMode: "simple", simple: { base: 20, perLevel: 2, stat: "mana", perStat: 10 }, formula: "", maxValue: 50, token: true },
    { key: "stamina", name: "Endurance", abbr: "END", icon: "fa-bolt", color: "#5aff9a", maxMode: "simple", simple: { base: 30, perLevel: 3, stat: "vit", perStat: 5 }, formula: "", maxValue: 50, token: false }
  ],
  gaugeStyle: { look: "hatch", warn: 50, crit: 20, warnColor: "#ffb347", critColor: "#ff4d5e" },   /* look : hatch | liquid | bar | segments ; thresholds in % */
  xp: { mode: "auto", costMode: "simple", simple: { base: 100, perLevel: 50 }, formula: "", tiers: [{ from: 1, to: 10, cost: 300 }, { from: 11, to: 30, cost: 1000 }, { from: 31, to: 60, cost: 3000 }, { from: 61, to: 99, cost: 8000 }], manual: [], maxLevel: 100, color: "#38a8ff", hatch: true, hatchOn: "filled", style: "flat", carry: true },   /* mode: auto | manual ; style: flat | wave | liquid ; hatchOn: filled | empty */
  dice: { statFormula: "1d20 + @value", chat: true },
  locks: { level: false, rank: false, awakening: false, sponsor: false, origin: false, resources: false, stats: false, gauges: false, xp: false, bag: false },   /* true = GM only */
  origins: [],
  rarities: [{ key: "ordinaire", name: "Ordinaire", color: "#6b7280" }, { key: "commun", name: "Commun", color: "#9ca3af" }, { key: "commun_plus", name: "Commun+", color: "#22c55e" }, { key: "peu_commun", name: "Peu Commun", color: "#3b82f6" }, { key: "rare", name: "Rare", color: "#06b6d4" }, { key: "tres_rare", name: "Très Rare", color: "#8b5cf6" }, { key: "epique", name: "Épique", color: "#ec4899" }, { key: "legendaire", name: "Légendaire", color: "#f59e0b" }, { key: "mythique", name: "Mythique", color: "#ef4444" }, { key: "proto", name: "Proto", color: "#f0abfc" }, { key: "codex", name: "Codex", color: "#fde68a" }, { key: "nihil", name: "Nihil", color: "#cbd5f5" }, { key: "omega", name: "Oméga", color: "#ff6b6b" }, { key: "artefact", name: "Artefact", color: "#f1f5f9" }],
  elements: [{ key: "arcane", name: "Arcane", color: "#c084fc" }, { key: "brume", name: "Brume", color: "#b8c4d8" }, { key: "chaos", name: "Chaos", color: "#e11d48" }, { key: "cristal", name: "Cristal", color: "#c9d8f5" }, { key: "eau", name: "Eau", color: "#0ea5e9" }, { key: "espace", name: "Espace", color: "#818cf8" }, { key: "feu", name: "Feu", color: "#f97316" }, { key: "foudre", name: "Foudre", color: "#facc15" }, { key: "glace", name: "Glace", color: "#7dd3fc" }, { key: "gravite", name: "Gravité", color: "#6366f1" }, { key: "lumiere", name: "Lumière", color: "#fde68a" }, { key: "magma", name: "Magma", color: "#fb7185" }, { key: "metal", name: "Métal", color: "#a8b2c1" }, { key: "nature", name: "Nature", color: "#4ade80" }, { key: "neutre", name: "Neutre", color: "#9ca3af" }, { key: "neant", name: "Néant", color: "#7a869c" }, { key: "ombre", name: "Ombre", color: "#8b5cf6" }, { key: "poison", name: "Poison", color: "#84cc16" }, { key: "psychique", name: "Psychique", color: "#f472b6" }, { key: "sable", name: "Sable", color: "#eab308" }, { key: "sang", name: "Sang", color: "#dc2626" }, { key: "son", name: "Son", color: "#a5f3fc" }, { key: "temps", name: "Temps", color: "#cbd5e1" }, { key: "terre", name: "Terre", color: "#c98a4b" }, { key: "vent", name: "Vent", color: "#6ee7b7" }, { key: "ether", name: "Éther", color: "#e0e7ff" }],
  costs: [{ key: "none", name: "Aucun" }, { key: "low", name: "Faible" }, { key: "medium", name: "Moyen" }, { key: "high", name: "Élevé" }, { key: "extreme", name: "Extrême" }],
  ranges: [{ key: "self", name: "Sur soi" }, { key: "melee", name: "Mêlée" }, { key: "short", name: "Courte" }, { key: "medium", name: "Moyenne" }, { key: "long", name: "Longue" }, { key: "area", name: "Zone" }],
  executions: [{ key: "instant", name: "Instantané" }, { key: "action", name: "Action" }, { key: "channeled", name: "Canalisé" }, { key: "reaction", name: "Réaction" }, { key: "passive", name: "Passif" }],
  /* item tree : id, name, icon, color, fields (inherited by children unless they define their own), children — see taxonomy.js */
  items: DEFAULT_ITEMS,
  identity: [
    { key: "personal", name: "Infos personnelles", fields: [{ key: "age", label: "Âge", kind: "short" }, { key: "hand", label: "Main dominante", kind: "select", options: ["Droitier", "Gaucher", "Ambidextre"] }, { key: "race", label: "Race / Espèce", kind: "short" }, { key: "height", label: "Taille", kind: "short" }, { key: "faction", label: "Faction / Guilde", kind: "short" }, { key: "affiliation", label: "Affiliation secondaire", kind: "short" }, { key: "personal", label: "Personnel", kind: "rich" }, { key: "background", label: "Historique", kind: "rich" }] },
    { key: "physique", name: "Physique", fields: [{ key: "build", label: "Corpulence", kind: "short" }, { key: "skin", label: "Peau", kind: "short" }, { key: "hair", label: "Cheveux", kind: "short" }, { key: "eyes", label: "Yeux", kind: "short" }, { key: "vision", label: "Vision (lunettes, lentilles…)", kind: "short" }, { key: "health", label: "État de santé (passé, présent, à venir)", kind: "short" }, { key: "marks", label: "Signes distinctifs", kind: "rich" }] },
    { key: "appearance", name: "Aspect extérieur", fields: [{ key: "clothes", label: "Vêtements (style, couleurs, marques…)", kind: "rich" }, { key: "jewelry", label: "Accessoires (bijoux…)", kind: "short" }, { key: "hairstyle", label: "Coiffure", kind: "short" }, { key: "tattoos", label: "Tatouages / piercings", kind: "short" }, { key: "makeup", label: "Maquillage", kind: "short" }] },
    { key: "family", name: "Famille", fields: [{ key: "parents", label: "Parents (noms, âges)", kind: "short" }, { key: "parentsStatus", label: "Parents en couple, divorcés, remariés ?", kind: "short" }, { key: "parentsJobs", label: "Profession des parents", kind: "short" }, { key: "siblings", label: "Frères et sœurs", kind: "rich" }, { key: "relParents", label: "Relations avec ses parents", kind: "short" }, { key: "relSiblings", label: "Relations avec ses frères et sœurs", kind: "short" }, { key: "others", label: "Autres membres importants", kind: "rich" }, { key: "pets", label: "Animaux de compagnie", kind: "short" }] },
    { key: "daily", name: "Vie quotidienne", fields: [{ key: "schedule", label: "Lever et coucher", kind: "short" }, { key: "transport", label: "Se déplace comment ?", kind: "short" }, { key: "housing", label: "Logement", kind: "short" }, { key: "habits", label: "Habitudes quotidiennes", kind: "rich" }, { key: "sayings", label: "Expressions favorites", kind: "short" }, { key: "food", label: "Plats et boissons préférés", kind: "short" }, { key: "diet", label: "Habitudes alimentaires", kind: "rich" }, { key: "likes", label: "Aime au quotidien", kind: "short" }, { key: "dislikes", label: "Déteste au quotidien", kind: "short" }, { key: "sports", label: "Sports", kind: "short" }, { key: "tech", label: "Maîtrise de la technologie", kind: "short" }, { key: "languages", label: "Langues", kind: "short" }, { key: "public", label: "Comportement en public", kind: "short" }] },
    { key: "relations", name: "Relations & amis", fields: [{ key: "bestFriend", label: "Meilleur(e) ami(e)", kind: "short" }, { key: "friends", label: "Autres ami(e)s", kind: "rich" }, { key: "relFriends", label: "Relations avec ses ami(e)s", kind: "rich" }] },
    { key: "personality", name: "Personnalité", fields: [{ key: "qualities", label: "Qualités", kind: "rich" }, { key: "flaws", label: "Défauts — incidences sur sa vie et ses relations", kind: "rich" }, { key: "religion", label: "Religion", kind: "short" }, { key: "politics", label: "Opinion politique", kind: "short" }, { key: "desire", label: "Désir profond", kind: "short" }, { key: "successes", label: "Succès", kind: "short" }, { key: "failures", label: "Échecs", kind: "short" }, { key: "hopes", label: "Espoirs", kind: "short" }, { key: "fears", label: "Peurs", kind: "short" }, { key: "details", label: "Vision des choses, accomplissements, passions…", kind: "rich" }, { key: "likesPlus", label: "Aime bien (+)", kind: "short" }, { key: "likesMinus", label: "Aime moins (−)", kind: "short" }] }
  ],
  progression: {
    paidStats: false, payWith: "coins", refundOnLower: false,
    costMode: "tiers",                                   /* tiers | multiplier | manual | curve (1.56) */
    curve: "square", curveBase: 100, curveMax: 100, statCurves: {},   /* 1.56 : courbe globale, base (coût 1 → 2), valeurs affichées, courbe propre à une stat (clé → courbe) */
    tiers: [{ from: 1, to: 10, cost: 100 }, { from: 11, to: 30, cost: 250 }, { from: 31, to: 60, cost: 600 }, { from: 61, to: 99, cost: 1500 }],
    multiplier: { base: 100, perPoint: 25 },              /* cost of value v → v+1 = base + perPoint × (v − 1) */
    manual: [],                                          /* manual[v] = cost of v → v+1 */
    capPerStat: 0, capTotal: 0,                          /* 0 = none */
    tierEvery: 10, tierNames: ["Novice", "Apprenti", "Adepte", "Expert", "Maître", "Grand maître", "Légende", "Mythe", "Transcendant"],
    messages: { locked: "[ Cette statistique est scellée. ]", cap: "[ Limite de la statistique atteinte. ]", total: "[ Limite totale des statistiques atteinte. ]", broke: "[ {resource} insuffisant. ]" },
    levelUp: { enabled: false, text: "[ {name} a atteint le niveau {level}. ]", chat: true },
    tierUp: { enabled: false, text: "[ {name} — {stat} entre au palier {tier}. ]", chat: true }
  },
  descriptions: { collapse: true, minLength: 90, width: 480, pageH: 340, font: 12.5, colW: 300, lines: 1, anim: true },         /* long descriptions folded in tables, tooltip by blocks */
  equipment: { enabled: true, slots: 6, roots: ["weapon", "armor", "items", "companion", "vehicle"], groupBy: "none", titles: 1, slotsInHeader: true }   /* "on body" equipment, on by default; bags = items whose category has a capacity field */
};

/* 1.38 : la configuration fusionnée est mise en cache (elle était reconstruite — avec tout l'arbre des catégories — à chaque appel, des dizaines de fois par rendu).
 * Le cache tombe quand le réglage change ou que les listes du Catalogue changent. getConfig(true) rend une copie modifiable. */
let _cfgCache = null, _cfgRaw = null, _cfgAt = 0;
/* le cache tombe quand la configuration ou un réglage du Catalogue (raretés, éléments) change — lire la base du Catalogue à chaque appel coûtait ~20 ms */
Hooks.on("updateSetting", st => { if (st?.key === `${SYS}.config` || String(st?.key || "").startsWith("last-horizon-catalogue.")) _cfgCache = null; });
Hooks.on("ready", () => { _cfgCache = null; });
export function getConfig(fresh = false) {
  let raw = null; try { raw = game.settings.get(SYS, "config"); } catch (e) { raw = null; }
  if (!_cfgCache || raw !== _cfgRaw || Date.now() - _cfgAt > 10000) { _cfgCache = buildConfig(); _cfgRaw = raw; _cfgAt = Date.now(); }   /* reconstruit au plus toutes les 10 s (base du Catalogue chargée plus tard) */
  return fresh ? foundry.utils.deepClone(_cfgCache) : _cfgCache;
}
function buildConfig() {
  const c = foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_CONFIG), game.settings.get(SYS, "config") || {}, { inplace: false, insertKeys: true, insertValues: true, overwrite: true, recursive: true });
  /* arrays replace the defaults wholesale (the GM's lists are never altered) — only fill keys an older entry does not have */
  const fill = (list, defs, byKey = "key") => { for (const e of list || []) { const d = (defs || []).find(x => x[byKey] === e[byKey]); if (d) for (const k in d) if (e[k] === undefined) e[k] = foundry.utils.deepClone(d[k]); } };
  fill(c.stats, DEFAULT_CONFIG.stats); fill(c.resources, DEFAULT_CONFIG.resources); fill(c.gauges, DEFAULT_CONFIG.gauges); fill(c.awakening, DEFAULT_CONFIG.awakening);
  for (const g of c.gauges) { g.maxMode ||= "manual"; g.color ||= "#38a8ff"; g.icon ||= "fa-heart"; g.simple ||= { base: 50, perLevel: 5, stat: "", perStat: 0 }; }
  c.gaugeStyle = { ...DEFAULT_CONFIG.gaugeStyle, ...(c.gaugeStyle || {}) }; c.xp.simple ||= { base: 100, perLevel: 50 }; if (!Array.isArray(c.xp.tiers) || !c.xp.tiers.length) c.xp.tiers = foundry.utils.deepClone(DEFAULT_CONFIG.xp.tiers); if (!Array.isArray(c.xp.manual)) c.xp.manual = Object.assign([], c.xp.manual || {}); c.xp.costMode ||= "simple"; c.mode = "general";
  /* raretés / éléments communs avec LE CATALOGUE (s'il est actif et chargé) : sa liste fait foi, les entrées propres à la fiche sont gardées à la suite */
  c.shareCatalogue = { rarities: true, elements: true, ...(c.shareCatalogue || {}) };
  try { const db = game.modules.get("last-horizon-catalogue")?.active ? game.modules.get("last-horizon-catalogue").api?.getDB?.() : null;
    const share = (list, src) => { const out = (src || []).map(x => ({ key: listKey(x.name), name: x.name, color: x.color || "#9aaac8" })); for (const e of list || []) if (!out.some(o => o.key === e.key || o.name.toLowerCase() === String(e.name).toLowerCase())) out.push(e); return out; };
    if (db?.rars?.length && c.shareCatalogue.rarities) c.rarities = share(c.rarities, db.rars);
    if (db?.elems?.length && c.shareCatalogue.elements) c.elements = share(c.elements, db.elems); } catch (e) { /* catalogue absent : listes de la fiche */ }
  c.window = { ...DEFAULT_CONFIG.window, ...(c.window || {}) }; c.headerSizes = { ...DEFAULT_CONFIG.headerSizes, ...(c.headerSizes || {}) };
  return c;
}
/* style d'une monnaie (repris de la fiche CSB) : ingot = lingot doré, holo = crédit holographique, rune = sceau violet, plain = néon simple */
export const RES_LOOKS = { "": "Automatique (d'après la clé)", ingot: "Lingot doré", ink: "Encre & plume", crystal: "Cristal facetté", star: "Constellation (étoiles)", holo: "Holo-crédit (terminal)", rune: "Sceau runique", seal: "Cachet de cire", plain: "Néon simple" };
export function resLook(r) { if (r?.look) return r.look; const k = String(r?.key || "").toLowerCase().replace(/[^a-z]/g, ""); if (["gold", "or", "coins"].includes(k)) return "ingot"; if (["pi"].includes(k)) return "star"; if (["credits", "credit"].includes(k)) return "holo"; if (["pointsw", "w"].includes(k)) return "ink"; if (["karma"].includes(k)) return "rune"; return "plain"; }
/* monnaie de référence pour la valeur des objets : Gold (clé ou nom), sinon le style lingot, sinon celle qui paie les stats, sinon la première */
/* clé stable d'une entrée de liste à partir de son nom (« Commun+ » → commun_plus, « Très Rare » → tres_rare) */
export function listKey(name) { return String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\+/g, "_plus").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "x"; }
/* couleur d'un niveau (paliers de 10) — même palette que le badge NIV du personnage */
export const LEVEL_COLORS = ["#8ea6d8", "#5aff9a", "#38a8ff", "#b46bff", "#f5c842", "#ff7a2a", "#ff3b6b"];
export function levelColor(l) { return LEVEL_COLORS[Math.min(LEVEL_COLORS.length - 1, Math.max(0, Math.floor((Number(l) || 0) / 10)))]; }
export function fmtSlots(n) { n = Math.round((Number(n) || 0) * 100) / 100; return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n); }
/* titres équipés (liste), avec repli sur l'ancien champ simple */
/** 1.38 : sacs équipés (plusieurs possibles), objets existants seulement */
export function equippedBags(actor) { const s = actor?.system || {}; const ids = Array.isArray(s.equippedBags) && s.equippedBags.length ? s.equippedBags : (s.equippedBag ? [s.equippedBag] : []); return [...new Set(ids)].map(id => actor.items.get(id)).filter(Boolean); }
export function equippedTitles(actor) { const s = actor.system; const list = Array.isArray(s.equippedTitles) && s.equippedTitles.length ? s.equippedTitles : (s.equippedTitle ? [s.equippedTitle] : []); return list.filter(id => actor.items.has(id)); }
/* puissance d'un rang (0 sous B, 1 = B, 2 = A, 3 = S, 4 = SS, 5 = SSS…) et d'une rareté (0 sous Épique, 1 = Épique, 2 = Légendaire, … 5 au-delà) */
const nk = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export function rankPower(cfg, key) { const list = cfg.ranks || []; const i = list.findIndex(r => r.key === key); if (i < 0) return 0; let b = list.findIndex(r => nk(r.key) === "b" || nk(r.name) === "b"); if (b < 0) b = Math.ceil(list.length / 2); return i < b ? 0 : Math.min(5, i - b + 1); }
export function rarityPower(cfg, key) { const list = cfg.rarities || []; const i = list.findIndex(r => r.key === key); if (i < 0) return 0; let e = list.findIndex(r => /^epi/.test(nk(r.key)) || /^epi/.test(nk(r.name))); if (e < 0) e = Math.ceil(list.length * 0.6); return i < e ? 0 : Math.min(5, i - e + 1); }
/* places occupées par les objets équipés (slotCost de chaque objet, 1 par défaut) */
export function slotsUsed(actor) { return actor.items.reduce((n, i) => n + (i.system.equipped ? (Number.isFinite(Number(i.system.slotCost)) ? Number(i.system.slotCost) : 1) : 0), 0); }
export function goldResource(cfg) { const n = x => String(x || "").toLowerCase().replace(/[^a-z]/g, ""); return cfg.resources.find(r => n(r.key) === "gold" || n(r.name) === "gold") || cfg.resources.find(r => resLook(r) === "ingot") || cfg.resources.find(r => r.paysStats) || cfg.resources[0]; }
/* tailles proposées en clair dans la configuration */
export const SIZE_PRESETS = { header: [[30, "Petit"], [36, "Moyen"], [42, "Grand"], [50, "Énorme"]], font: [[90, "Petit"], [100, "Moyen"], [115, "Grand"], [135, "Énorme"]], zoom: [[90, "Petit"], [100, "Moyen"], [112, "Grand"], [125, "Énorme"]], portrait: [[120, "Petit"], [150, "Moyen"], [180, "Grand"], [220, "Énorme"]], icon: [[32, "Petit"], [40, "Moyen"], [48, "Grand"], [60, "Énorme"]], ui: [["s", "Petit"], ["m", "Moyen"], ["l", "Grand"], ["xl", "Énorme"]] };
export const featureOn = (cfg, f) => f === "favorites" ? cfg.features?.favorites !== false : !!cfg.features?.[f];
/* jauges narratives : 10 stades, du pire au meilleur (libellés modifiables par jauge) */
export const STAGE_LABELS = ["Agonie", "Critique", "Grave", "Blessé", "Affaibli", "Marqué", "Correct", "Bon", "Excellent", "Parfait"];
/* jeux de libellés par nature de jauge (être « à l'agonie » en énergie n'a pas de sens) */
export const STAGE_PRESETS = {
  sante: { name: "Santé", labels: STAGE_LABELS },
  mana: { name: "Mana / magie", labels: ["À sec", "Tari", "Épuisé", "Vacillant", "Faible", "Instable", "Stable", "Fluide", "Abondant", "Débordant"] },
  energie: { name: "Énergie / endurance", labels: ["Effondré", "Vidé", "Exténué", "À bout", "Fatigué", "Essoufflé", "En forme", "Alerte", "Vif", "Inépuisable"] },
  moral: { name: "Moral / mental", labels: ["Brisé", "Désespéré", "Paniqué", "Angoissé", "Troublé", "Inquiet", "Calme", "Serein", "Déterminé", "Inébranlable"] },
  faim: { name: "Faim / ressources", labels: ["Affamé", "Famélique", "Creux", "Tiraillé", "Peu nourri", "Correct", "Rassasié", "Repu", "Gavé", "Comblé"] },
  corruption: { name: "Contrôle / corruption", labels: ["Possédé", "Consumé", "Submergé", "Dévoré", "Rongé", "Tenté", "Maîtrisé", "Lucide", "Pur", "Immaculé"] }
};
export const guessStagePreset = g => { const k = String(g?.key || "").toLowerCase(); if (/^(mana|mp|pm|magi|ether|qi|ki|chakra)/.test(k)) return "mana"; if (/^(sta|end|en|sp|ener|vigu|fatig)/.test(k)) return "energie"; if (/^(mor|ment|sani|stress|esp)/.test(k)) return "moral"; return "sante"; };
export const gaugeStages = g => { const p = g?.stagePreset; if (p === "custom" && Array.isArray(g.stages) && g.stages.length) return g.stages; if (p && STAGE_PRESETS[p]) return STAGE_PRESETS[p].labels; if (Array.isArray(g?.stages) && g.stages.length) return g.stages; return STAGE_PRESETS[guessStagePreset(g)].labels; };
/* affichage du numéro de stade : « Stade 10 », « 10/10 » ou rien */
export const stageNum = (cfg, v, n) => { const f = cfg?.features?.stageFormat || "stage"; return f === "fraction" ? `${v}/${n}` : f === "none" ? "" : `Stade ${v}`; };
export const isStageGauge = g => g.maxMode === "stages";
/* affichage des jauges en stades (réglage « Affichage des jauges ») — le nom est gardé pour les modules qui l'importent */
export const narrativeGaugesOn = cfg => cfg?.gaugeDisplay === "stages";
/* stade courant d'une jauge affichée en stades : calculé depuis valeur / max (1 = pire, n = meilleur) ; sans max connu, le stade enregistré */
export function stageOf(g, gv, n) { if (isStageGauge(g)) return Math.max(1, Math.min(n, Number(gv?.value) || n)); const max = Number(gv?.max) || 0; const st = Math.round(Number(gv?.stage) || 0);
  /* stade enregistré gardé tant qu'il correspond à la valeur (max < nombre de stades : plusieurs stades donnent la même valeur arrondie, 1.28.2) */
  if (max > 0 && st >= 1 && st <= n && Math.round(st / n * max) === Math.round(Math.max(0, Number(gv?.value) || 0))) return st;
  if (max > 0) return Math.max(1, Math.min(n, Math.ceil((Math.max(0, Number(gv?.value) || 0) / max) * n))); return Math.max(1, Math.min(n, Number(gv?.stage) || n)); }
/* valeur correspondant à un stade (pour cliquer un segment / + −) */
export function valueForStage(gv, s, n) { const max = Number(gv?.max) || 0; return max > 0 ? Math.round(s / n * max) : null; }
export const lockedFor = (cfg, key) => !game.user.isGM && !!cfg.locks?.[key];
export async function setConfig(c) { if (!game.user.isGM) return; await game.settings.set(SYS, "config", c); }
export async function updateConfig(fn) { const c = getConfig(true); const r = await fn(c); if (r !== false) await setConfig(c); return c; }

/* theme */
export function applyTheme() {
  const t = game.settings.get(SYS, "theme") || "solo-neon"; const a = game.settings.get(SYS, "anim") || "low";
  document.body.dataset.msTheme = t; document.documentElement.classList.toggle("ms-anim-low", a === "low"); document.documentElement.classList.toggle("ms-anim-off", a === "off");
}

/* munitions : armes à feu et énergétiques d'office (sous-arbre weapon_firearms / weapon_energy), ou tout objet réglé « à munitions » ; « off » les retire */
const AMMO_ROOTS = ["weapon_firearms", "weapon_energy"];
export function ammoOn(cfg, item) { const s = item?.system || {}; if (s.ammoMode === "on") return true; if (s.ammoMode === "off") return false; return pathOf(cfg, s.category).some(n => AMMO_ROOTS.includes(n.id)); }
export const ammoTxt = item => { const a = item?.system?.ammo || {}; return `${Number(a.value) || 0}/${Number(a.max) || 0}`; };
/* ── stat costs ── */
/* 1.56 — 8 courbes de coût pour les stats payantes : f(v, b) = coût pour passer de v à v + 1, b = coût du point 1 → 2 (base réglable) */
export const STAT_CURVES = {
  steady: { n: "Régulière", ic: "fa-ruler-horizontal", c: "#5aff9a", d: "Le prix monte doucement et pareil à chaque point.", f: (v, b) => b * (1 + 0.1 * (v - 1)) },
  system: { n: "Paliers du Système", ic: "fa-stairs", c: "#7fd6ff", d: "Prix stable, puis ×2 à chaque dizaine franchie (10, 20, 30…).", f: (v, b) => b * 2 ** Math.floor(v / 10) },
  square: { n: "Classique", ic: "fa-dice-d20", c: "#38a8ff", d: "Courbe en carré : facile au début, cher à la fin.", f: (v, b) => b * (1 + 0.05 * (v - 1) ** 2) },
  compound: { n: "Intérêts composés", ic: "fa-arrows-spin", c: "#b46bff", d: "+5 % par point : l'effet boule de neige du gacha.", f: (v, b) => b * 1.05 ** (v - 1) },
  walls: { n: "Murs de rang", ic: "fa-dungeon", c: "#ff8a3a", d: "Bon marché, mais le point qui franchit 25, 50 et 75 coûte ×10.", f: (v, b) => b * (1 + 0.05 * (v - 1)) * ([24, 49, 74].includes(v) ? 10 : 1) },
  talent: { n: "Plafond de talent", ic: "fa-hourglass-half", c: "#f5c518", d: "Presque gratuit jusqu'à 40, puis le prix explose.", f: (v, b) => b * (v <= 40 ? 1 : 1.15 ** (v - 40)) },
  abyss: { n: "Abîme", ic: "fa-skull", c: "#ff4d6a", d: "Cubique : chaque point après 60 coûte une fortune.", f: (v, b) => b * (1 + (v - 1) ** 3 / 400) },
  awaken: { n: "Éveil", ic: "fa-seedling", c: "#ffffff", d: "Les 10 premiers points sont chers (déblocage), plateau au milieu, sommet brutal de 90 à 100.", f: (v, b) => b * (v < 10 ? 6 - 0.5 * v : v >= 90 ? 1.6 ** (v - 89) * 4 : 1 + v / 40) }
};
export const statCurveOf = (cfg, stat) => { const p = cfg.progression; const k = (stat?.key && p.statCurves?.[stat.key]) || p.curve; return STAT_CURVES[k] ? k : "square"; };
export function costOfStep(cfg, v, stat) {
  const p = cfg.progression; let c = 0;
  if (p.costMode === "curve") c = STAT_CURVES[statCurveOf(cfg, stat)].f(Math.max(1, Number(v) || 1), Math.max(1, Number(p.curveBase) || 100));
  else if (p.costMode === "multiplier") c = p.multiplier.base + p.multiplier.perPoint * (v - 1);
  else if (p.costMode === "manual") c = Number(p.manual[v]) || 0;
  else { const t = p.tiers.find(x => v >= x.from && v <= x.to); c = t ? t.cost : (p.tiers[p.tiers.length - 1]?.cost || 0); }
  return Math.round(c * (stat?.costMult || 1));
}
export function costBetween(cfg, from, to, stat) { let s = 0; for (let v = from; v < to; v++) s += costOfStep(cfg, v, stat); return s; }
export function rankOf(cfg, key) { return cfg.ranks.find(r => r.key === key) || cfg.ranks[0]; }
export function listOf(cfg, name) { return cfg[name] || []; }

/* item tree helpers */
const DEFAULT_ICONS = (() => { const m = {}; const walk = ns => { for (const n of ns || []) { if (n.icon) m[n.id] = n.icon; walk(n.children); } }; walk(DEFAULT_ITEMS); return m; })();
export function iconOf(node) { return node?.icon || DEFAULT_ICONS[node?.id] || ""; }
export function flattenTree(nodes, parent = null, depth = 0, out = []) { for (const n of nodes || []) { out.push({ ...n, parent, depth, path: parent ? `${parent.path}/${n.id}` : n.id }); flattenTree(n.children, out[out.length - 1], depth + 1, out); } return out; }
const _nodeIdx = new WeakMap();
export function findNode(cfg, id) { const items = cfg?.items; if (!items) return null; let m = _nodeIdx.get(items); if (!m) { m = new Map(); for (const n of flattenTree(items)) if (!m.has(n.id)) m.set(n.id, n); _nodeIdx.set(items, m); } return m.get(id) || null; }
export function fieldsOf(cfg, id) {
  let n = findNode(cfg, id), f = null; while (n) { if (n.fields && n.fields.length) { f = n.fields; break; } n = n.parent; } f = [...(f || ["rank", "rarity", "quantity", "value", "description", "lore"])];
  /* general mode : equipable types and titles carry stat bonuses, weapons and skills a roll formula (unless the category lists them itself) */
  const r = rootOf(cfg, id); if (r) { /* bonus de stats : plus ajoutés d'office, ils s'activent objet par objet (bonusActive) */ if (featureOn(cfg, "dice") && !f.includes("formula") && ["weapon", "skill"].includes(r.id)) f.push("formula"); }
  return f;
}
export function pathOf(cfg, id) { const p = []; let n = findNode(cfg, id); while (n) { p.unshift(n); n = n.parent; } return p; }
/* 1.44 : un sac = une catégorie qui offre des emplacements (l'ancien champ « Capacité », jamais utilisé, est masqué mais reconnu) */
export function isBagCategory(cfg, id) { const f = fieldsOf(cfg, id); return f.includes("slots") || f.includes("capacity"); }
export function canEquip(cfg, id) { const r = rootOf(cfg, id); return !!r && (cfg.equipment.roots || []).includes(r.id); }
export function rootOf(cfg, id) { let n = findNode(cfg, id); while (n && n.parent) n = n.parent; return n; }
/* category path rendered as tags — each level has its own shape: type = filled arrow tag, family = pill, category = rectangle, sub = dashed chevron */
const LV_ICON = ["", "fa-folder-open", "fa-tag", "fa-angles-right"];
export function catTags(cfg, id, { withRoot = false, cls = "" } = {}) {
  const p = pathOf(cfg, id); if (!p.length) return `<span class="ms-tags ${cls}"><em>sans catégorie</em></span>`;
  const root = p[0]; const list = p.map((n, i) => [n, i]).filter(([, i]) => withRoot || i > 0);
  return `<span class="ms-tags ${cls}" style="--tc:${esc(root.color || "var(--ms-acc)")}">${list.map(([n, i]) => `<span class="ms-tag lv${i}" title="${["Type", "Famille", "Catégorie", "Sous-catégorie"][i] || ""}"><i class="fa-solid ${esc(i === 0 ? (iconOf(n) || "fa-cube") : (iconOf(n) || LV_ICON[i] || "fa-tag"))}"></i>${esc(n.name)}</span>`).join("")}</span>`;
}

/* ── formulas ── @stat keys, @level, @value ; only arithmetic survives ── */
export function evalFormula(expr, data = {}) {
  let e = String(expr || "").replace(/@([a-zA-Z_][\w.]*)/g, (m, k) => String(Number(foundry.utils.getProperty(data, k)) || 0));
  if (!/^[\d\s+\-*/().,%]*$/.test(e)) return 0;
  try { const R = globalThis.Roll; const v = R?.safeEval ? R.safeEval(e) : Function(`"use strict";return (${e || 0})`)(); return Number.isFinite(v) ? v : 0; } catch (err) { return 0; }
}
/* stats as seen in play : base + bonuses of equipped items (and the equipped title) */
/* un objet donne ses bonus seulement si on l'a paramétré : activé à la main, ou au moins un bonus non nul saisi (mode auto) */
export function bonusActive(item) { const m = item?.system?.bonusMode || ""; if (m === "off") return false; if (m === "on") return true; return itemBonuses(item).some(b => Number(b.value)); }
export function itemBonuses(item) {
  const list = Array.isArray(item.system.bonuses) ? item.system.bonuses : [];
  /* legacy { stat: n } map from 1.0 early builds */
  const legacy = Object.entries(item.system.stats || {}).filter(([, n]) => Number(n)).map(([stat, n]) => ({ stat, value: Number(n), pct: false, passive: false }));
  return (list.length ? list : legacy).filter(b => b && b.stat);
}
export function effectiveStats(cfg, actor) {
  const base = {}, flat = {}, pct = {}; for (const st of cfg.stats) { base[st.key] = Number(actor.system.stats?.[st.key]) || st.min || 0; flat[st.key] = 0; pct[st.key] = 0; }
  if (featureOn(cfg, "itemStats")) { const titles = equippedTitles(actor); for (const it of actor.items) { if (!bonusActive(it)) continue; const worn = it.system.equipped || titles.includes(it.id); for (const b of itemBonuses(it)) { if (!(b.stat in base)) continue; if (!worn && !b.passive) continue; if (b.pct) pct[b.stat] += Number(b.value) || 0; else flat[b.stat] += Number(b.value) || 0; } } }
  const eff = {}, bonus = {}; for (const k in base) { eff[k] = Math.round((base[k] + flat[k]) * (1 + pct[k] / 100) * 10) / 10; bonus[k] = Math.round((eff[k] - base[k]) * 10) / 10; }
  return { base, bonus, eff, flat, pct };
}
export function rollData(cfg, actor) { const { eff } = effectiveStats(cfg, actor); return { ...eff, level: Number(actor.system.level) || 0, rank: cfg.ranks.findIndex(r => r.key === actor.system.rank) + 1 }; }
export function gaugeFormula(g) { if (g.maxMode === "formula") return g.formula || "0"; const sm = g.simple || {}; const parts = []; if (Number(sm.base)) parts.push(String(Number(sm.base))); if (Number(sm.perLevel)) parts.push(`@level * ${Number(sm.perLevel)}`); if (sm.stat && Number(sm.perStat)) parts.push(`@${sm.stat} * ${Number(sm.perStat)}`); return parts.join(" + ") || "0"; }
export function gaugeMax(cfg, actor, g) { const stored = actor.system.gauges?.[g.key]; if (g.maxMode === "stages") return gaugeStages(g).length; if (g.maxMode === "manual") return Number(stored?.max ?? g.maxValue) || 0; return Math.max(0, Math.round(evalFormula(gaugeFormula(g), rollData(cfg, actor)))); }
export function xpFormula(cfg) { const x = cfg.xp; if (x.formula && (x.costMode || "formula") === "formula") return x.formula; const sm = x.simple || {}; return [Number(sm.base) ? String(Number(sm.base)) : "", Number(sm.perLevel) ? `@level * ${Number(sm.perLevel)}` : ""].filter(Boolean).join(" + ") || "100"; }
/* 1.54 — 8 courbes d'XP toutes faites, du niveau 1 au niveau 100, aux seuils très différents. b = XP du niveau 1 → 2 (base réglable). */
export const XP_CURVES = {
  steady: { n: "Régulière", ic: "fa-ruler-horizontal", c: "#5aff9a", d: "Chaque niveau coûte un peu plus que le précédent, sans surprise.", f: (L, b) => b * (1 + 0.25 * (L - 1)) },
  flash: { n: "Éclair", ic: "fa-bolt", c: "#7fd6ff", d: "On monte très vite, la courbe s'aplatit : idéal pour une campagne courte.", f: (L, b) => b * (1 + 2 * Math.log(L)) },
  classic: { n: "Classique RPG", ic: "fa-dice-d20", c: "#38a8ff", d: "Courbe en carré : rapide au début, de plus en plus long.", f: (L, b) => b * (1 + 0.1 * (L - 1) ** 2) },
  grind: { n: "Grind MMO", ic: "fa-arrows-spin", c: "#b46bff", d: "Exponentielle : +7 % par niveau, le haut niveau devient un vrai farm.", f: (L, b) => b * 1.07 ** (L - 1) },
  walls: { n: "Murs du Système", ic: "fa-dungeon", c: "#ff8a3a", d: "Progression douce, mais chaque dizaine (10, 20, 30…) est un mur ×10 à franchir.", f: (L, b) => b * (1 + 0.2 * (L - 1)) * (L % 10 === 0 ? 10 : 1) },
  awaken: { n: "Éveil tardif", ic: "fa-seedling", c: "#f5c518", d: "Facile jusqu'au niveau 45, explosion vers 60, puis plateau très haut.", f: (L, b) => b * (1 + 299 / (1 + Math.exp(-(L - 60) / 6))) },
  abyss: { n: "Abîme", ic: "fa-skull", c: "#ff4d6a", d: "Cubique : chaque niveau élevé coûte des milliers de fois le premier.", f: (L, b) => b * (1 + (L - 1) ** 3 / 100) },
  summit: { n: "Sommet final", ic: "fa-mountain", c: "#ffffff", d: "Tranquille jusqu'à 89, puis chaque niveau de 90 à 100 double le précédent.", f: (L, b) => b * (1 + 0.1 * (L - 1)) * (L >= 90 ? 2 ** (L - 89) : 1) }
};
/* XP pour passer du niveau L à L+1 : simple (base + par niveau), paliers (une plage de niveaux = un coût), un par un (un coût par niveau), formule */
export function xpNeeded(cfg, level) {
  const x = cfg.xp || {}; const L = Math.max(0, Number(level) || 0); const m = x.costMode || (x.formula ? "formula" : "simple");
  if (m === "tiers" && Array.isArray(x.tiers) && x.tiers.length) { const t = x.tiers.find(r => L >= Number(r.from) && L <= Number(r.to)) || (L < Number(x.tiers[0].from) ? x.tiers[0] : x.tiers[x.tiers.length - 1]); return Math.max(1, Math.round(Number(t.cost) || 1)); }
  if (m === "curve") { const cv = XP_CURVES[x.curve] || XP_CURVES.classic; return Math.max(1, Math.round(cv.f(Math.max(1, L), Math.max(1, Number(x.curveBase) || 100)))); }
  if (m === "manual") { const list = x.manual || []; let v = Number(list[Math.max(1, L)]); if (!v) { for (let i = Math.max(1, L); i >= 1 && !v; i--) v = Number(list[i]) || 0; } if (v) return Math.max(1, Math.round(v)); }
  const f = m === "formula" && x.formula ? x.formula : xpFormula({ xp: { ...x, formula: "" } });
  return Math.max(1, Math.round(evalFormula(f, { level: L })));
}
export function xpBetween(cfg, from, to) { let s = 0; for (let l = from; l < to; l++) s += xpNeeded(cfg, l); return s; }
/* gauge state from thresholds : "" | warn | crit | empty */
export function gaugeState(cfg, val, max) { if (!max) return ""; if (val <= 0) return "empty"; const p = val / max * 100; const gs = cfg.gaugeStyle || {}; if (p <= (Number(gs.crit) || 0)) return "crit"; if (p <= (Number(gs.warn) || 0)) return "warn"; return ""; }
/* per-category image defaults (inherited down the tree) : { size, pos } */
export function imgDefaults(cfg, catId) { let n = findNode(cfg, catId); let size = 0, pos = ""; while (n) { if (!size && n.imgSize) size = Number(n.imgSize); if (!pos && n.imgPos) pos = n.imgPos; n = n.parent; } return { size: size || Number(cfg.itemImageSize) || 128, pos: pos || "center" }; }

/* garder la saisie en cours quand une fenêtre se redessine (message reçu, joueur qui bouge…) : même champ, même curseur */
export function focusKey(c) {
  const ae = document.activeElement; if (!ae || !c?.contains(ae) || !ae.matches?.('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]),textarea,[contenteditable="true"]')) return null;
  const at = [...ae.attributes].filter(a => a.name === "name" || (a.name.startsWith("data-") && a.value.length < 80));
  const sel = ae.tagName.toLowerCase() + at.map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join("");
  return { sel, i: [...c.querySelectorAll(sel)].indexOf(ae), s: ae.selectionStart, e: ae.selectionEnd, v: ae.value };
}
export function focusBack(c, k) {
  if (!k) return; const el = [...c.querySelectorAll(k.sel)][Math.max(0, k.i)] || c.querySelector(k.sel); if (!el || document.activeElement === el) return;
  el.focus({ preventScroll: true }); try { if (el.value === k.v && k.s != null) el.setSelectionRange(k.s, k.e); else if (typeof el.value === "string") el.setSelectionRange(el.value.length, el.value.length); } catch (e) {}
}
