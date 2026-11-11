/* Manhwa Sheet — data models (values only; structure comes from the world configuration) */
const F = foundry.data.fields;

export class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      level: new F.NumberField({ integer: true, min: 0, initial: 1 }),
      rank: new F.StringField({ initial: "" }),
      awakening: new F.StringField({ initial: "" }),
      origin: new F.StringField({ initial: "" }),
      sponsor: new F.StringField({ initial: "" }),
      stats: new F.ObjectField({ initial: {} }),          /* { key: number } */
      statsUnlocked: new F.ObjectField({ initial: {} }),  /* { key: true } — GM unseals a locked stat for this character */
      resources: new F.ObjectField({ initial: {} }),      /* { key: number } */
      identity: new F.ObjectField({ initial: {} }),       /* { section: { field: value } } */
      equippedTitle: new F.StringField({ initial: "" }),  /* item id (premier titre équipé, gardé pour les modules) */
      equippedTitles: new F.ArrayField(new F.StringField(), { initial: [] }),  /* tous les titres équipés */
      equippedBag: new F.StringField({ initial: "" }),    /* item id (premier sac, compatibilité) */
      equippedBags: new F.ArrayField(new F.StringField(), { initial: [] }),  /* 1.38 : tous les sacs équipés */
      portrait: new F.StringField({ initial: "center" }), /* framing preset */
      notes: new F.HTMLField({ initial: "" }),           /* notes personnelles (Carnet) */
      carnet: new F.ObjectField({ initial: {} }),       /* Carnet : { friends: arbre, places: arbre, notes: arbre } — nœud = { id, name, folder?, open?, children?, journal? } */
      gauges: new F.ObjectField({ initial: {} }),         /* { key: { value, max } } — max stored only for manual gauges */
      xp: new F.NumberField({ min: 0, initial: 0 }),
      favorites: new F.ArrayField(new F.StringField(), { initial: [] }),  /* item ids pinned at the top of their tab */
      gmNotes: new F.HTMLField({ initial: "" }),          /* GM-only notes (NPC) */
      sheetMode: new F.StringField({ initial: "" })       /* reserved */
    };
  }
  prepareDerivedData() {
    const cfg = globalThis.MANHWA?.config?.() ; if (!cfg) return;
    for (const s of cfg.stats) if (this.stats[s.key] === undefined) this.stats[s.key] = s.min ?? 1;
    for (const r of cfg.resources) if (this.resources[r.key] === undefined) this.resources[r.key] = r.start ?? 0;
    this.statsTotal = cfg.stats.reduce((n, s) => n + (Number(this.stats[s.key]) || 0), 0);
    if (!this.rank && cfg.ranks[0]) this.rank = cfg.ranks[0].key;
    if (!this.awakening && cfg.awakening[0]) this.awakening = cfg.awakening[0].key;
    /* gauges : fill value/max so token bars can read system.gauges.<key>.value / .max */
    const actor = this.parent; const gm = globalThis.MANHWA?.gaugeMax;
    for (const g of cfg.gauges || []) { const cur = this.gauges[g.key] || (this.gauges[g.key] = {}); const max = gm && actor ? gm(cfg, actor, g) : Number(cur.max ?? g.maxValue) || 0; cur.max = max; if (cur.value === undefined) cur.value = max; }
    this.xpNeeded = globalThis.MANHWA?.xpNeeded ? globalThis.MANHWA.xpNeeded(cfg, this.level) : 100;
  }
}
export class NpcData extends CharacterData {}

export class ItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      category: new F.StringField({ initial: "" }),       /* leaf id of the item tree */
      rank: new F.StringField({ initial: "" }),
      rarity: new F.StringField({ initial: "" }),
      quantity: new F.NumberField({ integer: true, min: 0, initial: 1 }),
      value: new F.NumberField({ min: 0, initial: 0 }),
      level: new F.NumberField({ integer: true, min: 0, initial: 1 }),
      element: new F.StringField({ initial: "" }),
      cost: new F.StringField({ initial: "" }),
      range: new F.StringField({ initial: "" }),
      execution: new F.StringField({ initial: "" }),
      origin: new F.StringField({ initial: "" }),
      manufacturer: new F.StringField({ initial: "" }),
      capacity: new F.NumberField({ integer: true, min: 0, initial: 0 }),
      slots: new F.NumberField({ integer: true, min: 0, initial: 0 }),
      equippable: new F.BooleanField({ initial: false }),
      equipped: new F.BooleanField({ initial: false }),   /* worn / carried on body — never removed from inventory */
      fx: new F.StringField({ initial: "" }),             /* cosmetic animated name (item settings) */
      imgPos: new F.StringField({ initial: "", blank: true }),   /* image framing preset ; "" = défaut de la catégorie */
      imgSize: new F.NumberField({ integer: true, min: 0, initial: 0 }), /* image size on the item sheet, 0 = world default */
      stats: new F.ObjectField({ initial: {} }),          /* legacy { statKey: bonus } — read, no longer written */
      bonuses: new F.ArrayField(new F.ObjectField(), { initial: [] }),  /* [{ stat, value, pct, passive }] — passive = no need to equip */
      bonusMode: new F.StringField({ initial: "" }),
      slotCost: new F.NumberField({ min: 0, initial: 1 }),  /* places occupées une fois équipé : 0 = ne compte pas, 0.5, 2… */     /* "" = actif seulement si un bonus non nul est saisi ; "on" = activé ; "off" = coupé */
      formula: new F.StringField({ initial: "" }),        /* roll formula, e.g. 2d6 + @str */
      ammo: new F.SchemaField({ value: new F.NumberField({ integer: true, min: 0, initial: 0 }), max: new F.NumberField({ integer: true, min: 0, initial: 0 }) }),   /* munitions (armes à feu ou objets réglés « à munitions ») */
      ammoMode: new F.StringField({ initial: "", blank: true }),   /* "" = auto (armes à feu / énergétiques) · on · off */
      description: new F.HTMLField({ initial: "" }),
      condition: new F.HTMLField({ initial: "" }),        /* titres : condition d'obtention */
      lore: new F.HTMLField({ initial: "" }),
      extra: new F.ObjectField({ initial: {} })            /* GM-defined free fields */
    };
  }
}

/* créature (bestiaire) : fiche simple — niveau, rang, XP et Gold donnés, attaques écrites à la main, butin */
export class CreatureData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const row = () => new F.ArrayField(new F.ObjectField(), { initial: [] });
    return {
      level: new F.NumberField({ integer: true, min: 0, initial: 1 }),
      rank: new F.StringField({ initial: "" }),
      kind: new F.StringField({ initial: "" }),            /* type libre : Bête, Mort-vivant, Boss… */
      xpReward: new F.NumberField({ min: 0, initial: 0 }),
      goldReward: new F.NumberField({ min: 0, initial: 0 }),
      gauges: new F.ObjectField({ initial: {} }),          /* { key: { value, max } } — max saisi sur la fiche */
      attacks: row(),                                      /* [{ id, name, info, desc }] */
      drops: row(),                                        /* [{ id, name, img, qty, chance, data? (objet glissé) }] */
      notes: new F.HTMLField({ initial: "" }),
      portrait: new F.StringField({ initial: "center" })
    };
  }
  prepareDerivedData() {
    const cfg = globalThis.MANHWA?.config?.(); if (!cfg) return;
    if (!this.rank && cfg.ranks[0]) this.rank = cfg.ranks[0].key;
    for (const g of cfg.gauges || []) { const cur = this.gauges[g.key] || (this.gauges[g.key] = {}); cur.max = Math.max(0, Number(cur.max ?? g.maxValue) || 0); if (cur.value === undefined) cur.value = cur.max; }
  }
}
