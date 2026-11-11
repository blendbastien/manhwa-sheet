/* Manhwa Sheet 1.55 — COSMÉTIQUES : une seule liste pour tous les modules (Catalogue, Boutique stellaire, MJ).
 * Deux familles : la carte du joueur (par personnage, drapeau « cardUnlocks ») et le téléphone (par joueur, drapeau « phoneUnlocks »).
 * Identifiant commun : « card:<id> » (ex. card:sticker:beach-crab, card:pack:beach) ou « phone:<id> » (ex. phone:wall:rift, phone:wallpack:neon).
 * Les Orbis Astra ne donnent rien : tout se débloque (à l'unité, par pack, en boutique ou par le MJ) ; seuls les éléments par défaut sont libres. */
import { SYS } from "./config.js";
import { COSMETICS as CARD, PACKS as CARD_PACKS, COS_KINDS, RARITIES, owns as cardOwns } from "./pcard.js";
import { COSMETICS as PHONE, WALL_LIST, WALL_PACKS, unlocked as phUnlocked, unlockCosmetic } from "./phone.js";
import { withLock } from "./world.js";

const PH_KINDS = { wall: ["Fonds d'écran", "fa-image", "#38e0ff"], wallpack: ["Packs de fonds", "fa-layer-group", "#7fd6ff"], frame: ["Cadres du téléphone", "fa-mobile-screen", "#f5c518"], fx: ["Effets de message", "fa-wand-magic-sparkles", "#ff9ad5"] };
const PRICE = { common: 500, rare: 2000, epic: 8000, legend: 30000 };
const RANK = { common: "E", rare: "C", epic: "A", legend: "S" };
const RAR_FR = { common: "Commun", rare: "Rare", epic: "Épique", legend: "Légendaire" };
let _list = null;
/** toute la liste (sans les éléments libres) : { id, sys, raw, kind, kindName, name, pack, packName, rar, rarName, rank, price, icon, img, css, color, desc } */
export function list() {
  if (_list) return _list; const out = [];
  for (const it of CARD) { if (it.free) continue; const K = COS_KINDS[it.kind] || []; const P = CARD_PACKS[it.pack] || {};
    out.push({ id: `card:${it.id}`, sys: "card", raw: it.id, kind: it.kind, kindName: K[0], name: it.n, pack: it.pack, packName: P.n || it.pack, rar: it.rar, icon: it.icon || K[1] || "fa-star", img: it.src || "", color: K[2] || P.c,
      desc: `${K[0] ? K[0].replace(/s$/, "").replace(/x$/, "") : "Cosmétique"} de la carte du joueur « ${it.n} » (pack ${P.n || it.pack}).${it.kind === "aura" ? " Les auras se débloquent aussi en montant de rang." : ""}` }); }
  for (const [k, P] of Object.entries(CARD_PACKS)) { const items = CARD.filter(x => x.pack === k && !x.free); if (!items.length || k === "rank") continue;
    const top = items.reduce((m, x) => Math.max(m, Object.keys(PRICE).indexOf(x.rar)), 0);
    out.push({ id: `card:pack:${k}`, sys: "card", raw: `pack:${k}`, kind: "pack", kindName: "Packs", name: `Pack « ${P.n} »`, pack: k, packName: P.n, rar: Object.keys(PRICE)[Math.min(3, top)], icon: P.ic || "fa-box", img: "", color: P.c,
      pkPrice: Math.round(items.reduce((t, x) => t + (PRICE[x.rar] || 500), 0) * 0.7 / 100) * 100, desc: `Tout le pack « ${P.n} » de la carte du joueur (${items.length} éléments).${P.desc ? ` ${P.desc}.` : ""}` }); }
  for (const it of PHONE) { const K = PH_KINDS[it.kind] || []; const w = it.kind === "wall" ? WALL_LIST.find(x => x.key === it.key) : null; const P = WALL_PACKS[it.pack || it.key] || {};
    const rar = it.rar || (it.kind === "wallpack" ? "epic" : it.kind === "frame" ? "rare" : it.key === "custom" ? "legend" : "common");
    const n = WALL_LIST.filter(x => x.pack === it.key && !x.free);
    out.push({ id: `phone:${it.id}`, sys: "phone", raw: it.id, kind: it.kind, kindName: K[0], name: it.name, pack: it.pack || (it.kind === "wallpack" ? it.key : ""), packName: P.n || "", rar, icon: it.icon || K[1], img: "", css: w?.css || "", color: K[2] || P.c, desc: it.desc,
      ...(it.kind === "wallpack" ? { pkPrice: Math.round(n.reduce((t, x) => t + (PRICE[x.rar] || 500), 0) * 0.7 / 100) * 100 } : {}) }); }
  for (const x of out) { x.rarName = RAR_FR[x.rar] || "Commun"; x.rank = RANK[x.rar] || "E"; x.price = x.pkPrice || PRICE[x.rar] || 500; x.family = x.sys === "card" ? "Carte du joueur" : "Téléphone"; }
  return (_list = out);
}
export const get = id => list().find(x => x.id === id) || null;
/** joueurs (non MJ) propriétaires d'un personnage : le téléphone se débloque pour eux */
const ownersOf = a => game.users.filter(u => !u.isGM && a?.testUserPermission?.(u, "OWNER"));
/** le personnage (ou l'un de ses joueurs, pour le téléphone) possède-t-il ce cosmétique ? (le MJ voit tout comme possédé seulement s'il le demande) */
export function owns(a, id, { strict = true } = {}) { const c = get(id); if (!c || !a) return false;
  if (c.sys === "card") { const U = new Set(a.getFlag?.(SYS, "cardUnlocks") || []); if (U.has(c.raw)) return true; if (c.kind === "pack") return false; if (U.has(`pack:${c.pack}`)) return true; if (strict) return false; const it = CARD.find(x => x.id === c.raw); return cardOwns(a, it); }
  const us = ownersOf(a); if (!us.length) return false;
  const has = u => phUnlocked(u, c.raw) || (c.kind === "wall" && c.pack && phUnlocked(u, `wallpack:${c.pack}`));
  return us.every(has);
}
/** débloque (ou retire) un cosmétique pour un personnage — carte : sur le personnage ; téléphone : pour chacun de ses joueurs */
export async function unlock(a, id, on = true) { const c = get(id); if (!c || !a) return false;
  if (c.sys === "card") { if (!game.user.isGM && !a.isOwner) return false; /* verrou propre (pas celui du personnage) : appelé depuis un achat qui tient déjà le verrou du personnage */
    return withLock(`cos:${a.uuid}`, async () => { const U = new Set(a.getFlag(SYS, "cardUnlocks") || []); on ? U.add(c.raw) : U.delete(c.raw); await a.setFlag(SYS, "cardUnlocks", [...U]); return true; }); }
  const us = ownersOf(a); if (!us.length) return false; for (const u of us) await unlockCosmetic(u.id, c.raw, on); return true;
}
export const KINDS = { card: COS_KINDS, phone: PH_KINDS };
export const api = { list, get, owns, unlock, KINDS, RARITIES, PRICE };
