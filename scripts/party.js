/* Manhwa Sheet — Groupe : membres (joueurs connectés, groupes de PNJ Manhwa, n'importe quel acteur), parts d'XP et de Gold en %,
 * et distribution des récompenses (MJ) — depuis le Menu ou le bouton « Récompenses » des contrôles de jetons. */
import { SYS, esc, getConfig, rankOf, gaugeStages, levelColor, narrativeGaugesOn, stageOf, flattenTree, kindLabel } from "./config.js";
import { parties, editList, actorOf, uid, goldKey, addGold, addXp, updateActorLocked } from "./world.js";
import { folderTree, bindFolderTree, pickByFolders } from "./folderpick.js";

const DialogV2 = foundry.applications.api.DialogV2;
const PCOLORS = ["#38e0ff", "#b980ff", "#5aff9a", "#ffd070", "#ff8af0", "#ff9b3d"];
const pct = n => `${Math.round((Number(n) || 0) * 10) / 10} %`;
const fmt = n => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));

/* ── répartition : arrondi au plus juste (la somme distribuée est exacte) ── */
export function split(total, weights) {
  total = Math.round(Number(total) || 0); const sum = weights.reduce((a, b) => a + Math.max(0, Number(b) || 0), 0);
  if (!total || !weights.length) return weights.map(() => 0);
  const w = sum > 0 ? weights.map(x => Math.max(0, Number(x) || 0) / sum) : weights.map(() => 1 / weights.length);
  const raw = w.map(x => x * total); const base = raw.map(Math.floor); let rest = total - base.reduce((a, b) => a + b, 0);
  raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { base[i]++; rest--; } });
  return base;
}
/** distribue XP et monnaies. members : [{ actor, xp, gold }] (parts en %) ; res : { cléMonnaie: montant } ; mode : shares | equal | full */
export async function distribute({ members, xp = 0, gold = 0, res = {}, mode = "shares", label = "" }) {
  if (!game.user.isGM) return ui.notifications.warn("Réservé au MJ.");
  members = members.filter(m => m.actor); if (!members.length) return;
  const cfg = getConfig(); res = { ...res }; if (gold && goldKey()) res[goldKey()] = (Number(res[goldKey()]) || 0) + Number(gold);
  const keys = Object.keys(res).filter(k => Number(res[k]) > 0);
  const share = (total, field) => mode === "full" ? members.map(() => Math.round(total)) : split(total, members.map(m => mode === "equal" ? 1 : (m[field] ?? 1)));
  const xs = share(xp, "xp"); const rs = Object.fromEntries(keys.map(k => [k, share(res[k], k === goldKey() ? "gold" : "gold")]));
  for (const [i, m] of members.entries()) { if (xs[i]) await addXp(m.actor, xs[i]); await updateActorLocked(m.actor, a => { const upd = {}; for (const k of keys) if (rs[k][i]) upd[`system.resources.${k}`] = (Number(a.system.resources?.[k]) || 0) + rs[k][i]; return upd; }); }   /* lecture + écriture sous verrou du personnage : une récompense ne peut plus être écrasée par un autre mouvement d'or au même instant */
  const R = k => cfg.resources.find(r => r.key === k) || { name: k, icon: "fa-coins", color: "#ffd070" };
  const rows = members.map((m, i) => `<div class="r"><img src="${esc(m.actor.img)}"><b>${esc(m.actor.name)}</b>${xp ? `<span class="xp">+${fmt(xs[i])} XP</span>` : ""}${keys.map(k => rs[k][i] ? `<span class="rs" style="--c:${esc(R(k).color || "#ffd070")}"><i class="fa-solid ${esc(R(k).icon || "fa-coins")}"></i>+${fmt(rs[k][i])}</span>` : "").join("")}</div>`).join("");
  const tot = [xp ? `${fmt(xp)} XP` : "", ...keys.map(k => `${fmt(res[k])} ${esc(R(k).name)}`)].filter(Boolean).join(" · ");
  await ChatMessage.create({ speaker: { alias: "Système" }, content: `<div class="ms-syscard reward"><header><i class="fa-solid fa-gift"></i><b>Récompenses</b>${label ? `<small>${esc(label)}</small>` : ""}</header><div class="rows">${rows}</div><footer>${tot} · ${{ shares: "selon les parts du groupe", equal: "parts égales", full: "montant entier pour chacun" }[mode]}</footer></div>`, flags: { [SYS]: { reward: true } } });
  return { xs, rs };
}

/* ── boîte « Récompenses » : groupes et joueurs (jamais de PNJ), XP et toutes les monnaies ── */
/* butin : crée les objets choisis chez le destinataire (même nom déjà possédé → la quantité s'ajoute) */
export async function giveDrops(actor, drops) {
  if (!actor || !drops?.length) return []; const cfg = getConfig(); const leaves = flattenTree(cfg.items).filter(n => !n.children?.length);
  const lootCat = (leaves.find(n => /^item_loot/.test(n.id)) || leaves.find(n => /^item_/.test(n.id)) || leaves[0])?.id || "";
  const out = [];
  for (const d of drops) { const qty = Math.max(0, Math.floor(Number(d.qty) || 0)); if (!qty) continue; const name = d.data?.name || d.name || "Butin";
    const have = actor.items.find(i => i.name === name && (!d.data || i.system.category === d.data.system?.category));
    if (have) { await have.update({ "system.quantity": (Number(have.system.quantity) || 0) + qty }); out.push(`${qty} × ${name}`); continue; }
    const data = d.data ? foundry.utils.deepClone(d.data) : { name, img: d.img || "icons/svg/item-bag.svg", type: "item", system: { category: lootCat } };
    data.type = "item"; data.system = { ...(data.system || {}), quantity: qty, equipped: false }; if (!data.system.category) data.system.category = lootCat;
    await actor.createEmbeddedDocuments("Item", [data]); out.push(`${qty} × ${name}`); }
  if (out.length) await ChatMessage.create({ speaker: { alias: "Système" }, content: `<div class="ms-syscard reward"><header><i class="fa-solid fa-sack-dollar"></i><b>Butin</b><small>${esc(actor.name)}</small></header><div class="rows">${out.map(x => `<div class="r"><b>${esc(x)}</b></div>`).join("")}</div></div>`, flags: { [SYS]: { reward: true } } });
  return out;
}

/* butin agrégé d'une liste de { actor (créature), n } : quantité × nombre, un tirage par source */
export function monsterLoot(list) {
  let xp = 0, gold = 0; const drops = [];
  for (const { actor, n } of list) { if (!actor || !(n > 0)) continue; xp += (Number(actor.system.xpReward) || 0) * n; gold += (Number(actor.system.goldReward) || 0) * n;
    for (const d of actor.system.drops || []) { if (!d.name && !d.data) continue; const key = d.data ? `${d.data.name}|${d.data.img}` : `${d.name}|${d.img}`; const qty = (Number(d.qty) || 1) * n; const ex = drops.find(x => x.key === key);
      const ch = Number(d.chance ?? 100); const roll = { n, per: Number(d.qty) || 1, chance: ch };
      if (ex) { ex.qty += qty; ex.chances.push(ch); ex.chance = Math.min(ex.chance, ch); ex.rolls.push(roll); } else drops.push({ key, name: d.name || d.data?.name, img: d.img || d.data?.img, qty, chance: ch, chances: [ch], per: roll.per, n, rolls: [roll], data: d.data || null }); } }
  return { xp, gold, drops };
}

/* ── fenêtre unique « Récompenses » : montants, + Monstres (XP, Gold et butin des créatures vaincues), puis destinataires :
 *    groupes d'aventure, groupes MJ et joueurs en pastilles compactes, séparés par des bandeaux ── */
export async function rewardDialog(partyId = null, preset = {}) {
  if (!game.user.isGM) return;
  const cfg = getConfig(); const list = parties(); const isPC = a => a && a.hasPlayerOwner; const gk = goldKey(); const rk = a => rankOf(cfg, a.system.rank);
  let GG = []; try { GG = (await import("./gmgroups.js")).gmGroups().map(g => ({ g, mem: null })); const { gmMembers } = await import("./gmgroups.js"); GG.forEach(x => { x.mem = gmMembers(x.g).map(u => fromUuidSync(u)).filter(isPC); }); } catch (e) { console.warn(SYS, e); }
  const users = game.users.filter(u => !u.isGM).map(u => ({ u, chars: game.actors.filter(a => a.type === "character" && a.testUserPermission(u, "OWNER")) })).filter(x => x.chars.length);
  const allPC = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner);
  const creatures = game.actors.filter(a => a.type === "creature").sort((x, y) => x.name.localeCompare(y.name, "fr"));
  /* monstres : ceux donnés, sinon les jetons de créatures sélectionnés */
  const mons = new Map(); const addMon = (a, n = 1) => { if (!a || a.type !== "creature") return; const k = a.uuid; const ex = mons.get(k); if (ex) ex.n += n; else mons.set(k, { actor: a, n }); };
  if (preset.monsters) for (const m of preset.monsters) addMon(m.actor, m.n); else for (const t of canvas?.tokens?.controlled || []) addMon(t.actor?.type === "creature" ? (t.document.actorLink ? t.actor : game.actors.get(t.actor.id) || t.actor) : null);
  const fixedDrops = [...(preset.drops || [])]; let drops = []; let monXp = 0, monGold = 0;
  const imgs = arr => arr.slice(0, 6).map(a => `<img src="${esc(a.img)}" title="${esc(a.name)}">`).join("") + (arr.length > 6 ? `<em>+${arr.length - 6}</em>` : "");
  const gchip = (name, val, c, icon, pcs, on) => `<label class="rw-g" style="--c:${esc(c || "#38e0ff")}"><input type="checkbox" name="${name}" value="${esc(val.id)}"${on ? " checked" : ""}><i class="fa-solid ${icon}"></i><b>${esc(val.name)}</b><span>${imgs(pcs)}</span></label>`;
  const advH = list.map(p => gchip("party", p, p.color, "fa-flag", p.members.map(m => actorOf(m.uuid)).filter(isPC), p.id === partyId)).join("");
  const ggH = GG.map(({ g, mem }) => gchip("gmg", g, g.color, g.icon || "fa-crown", mem, false)).join("");
  const plH = users.map(({ u, chars }) => `<div class="rw-u" style="--uc:${esc(u.color?.css ?? u.color ?? "#8ea0c8")}"><span class="un"><i></i>${esc(u.name)}${u.active ? `<em>en ligne</em>` : ""}</span>${chars.map(a => `<label class="rw-c"><input type="checkbox" name="pc" value="${a.uuid}"><img src="${esc(a.img)}"><b>${esc(a.name)}</b></label>`).join("")}</div>`).join("");
  const amounts = [`<label class="ms-rwa" style="--c:#38a8ff"><i class="fa-solid fa-arrow-trend-up"></i><span>XP</span><input type="number" name="xp" value="${Math.round(Number(preset.xp) || 0)}" min="0"></label>`, ...cfg.resources.map(r => `<label class="ms-rwa" style="--c:${esc(r.color || "#ffd070")}"><i class="fa-solid ${esc(r.icon || "fa-coins")}"></i><span>${esc(r.name)}</span><input type="number" name="res-${r.key}" value="${r.key === gk ? Math.round(Number(preset.gold) || 0) : 0}" min="0"></label>`)].join("");
  const monRow = ({ actor: a, n }) => { const r = rk(a); return `<div class="lt-row" data-uuid="${a.uuid}"><img src="${esc(a.img)}"><b>${esc(a.name)}</b><span class="rk" style="--c:${esc(r?.color || "#fff")}">${esc(r?.name || "")}</span><small>Niv ${Number(a.system.level) || 0}</small><small class="v">${fmt(a.system.xpReward)} XP · ${fmt(a.system.goldReward)} G</small><span class="lt-steps">${[-5, -3, -1].map(d => `<a class="lt-st m" data-step="${d}">${d}</a>`).join("")}<label>×<input type="number" class="n" value="${n}" min="0"></label>${[1, 3, 5].map(d => `<a class="lt-st p" data-step="${d}">+${d}</a>`).join("")}</span><a class="rm" title="Retirer"><i class="fa-solid fa-xmark"></i></a></div>`; };
  const dropsHTML = () => drops.length ? `<div class="ms-rwdrops">${drops.map((d, i) => `<label class="ms-rwdrop"><input type="checkbox" name="drop" value="${i}"${d.chance >= 100 ? " checked" : ""}><img src="${esc(d.img || "icons/svg/item-bag.svg")}"><b>${esc(d.name)}</b><small>${d.chances?.some(c => c < 100) ? `chance ${[...new Set(d.chances)].join(" / ")} %` : ""}</small><input type="number" name="dq-${i}" value="${d.qty}" min="0" title="Quantité"></label>`).join("")}</div>
      <div class="ms-rwdropbar">${drops.some(d => d.chance < 100) ? `<a class="ms-mbtn ghost" data-roll="1"><i class="fa-solid fa-dice"></i> Tirer au sort selon les chances</a>` : ""}<label>Donner le butin à<select name="dropTo">${allPC.map(a => `<option value="${a.uuid}">${esc(a.name)}</option>`).join("")}</select></label></div>` : `<p class="ms-mhint">Pas de butin${mons.size ? " sur ces monstres" : ""}.</p>`;
  const content = `<div class="ms-reward3"><section class="amt">
      <div class="ms-bnr" style="--bc:#38a8ff"><i class="fa-solid fa-gift"></i> Récompense</div><div class="ms-rwas">${amounts}</div>
      <div class="rw-row"><label class="mode">Répartition<select name="mode"><option value="shares">Selon les parts du groupe (%)</option><option value="equal">Parts égales</option><option value="full">Chacun reçoit le montant entier</option></select></label>
      <label class="mode">Motif (dans le chat)<input type="text" name="label" value="${esc(preset.label || "")}" placeholder="ex. Donjon de la Lune Noire"></label></div>
      <div class="ms-bnr" style="--bc:#ff6a5a"><i class="fa-solid fa-skull-crossbones"></i> Monstres vaincus <small>leur XP, leur Gold et leur butin s'ajoutent</small><span class="sp"></span><a class="ms-mbtn red sm" data-mon-add><i class="fa-solid fa-plus"></i> Monstres</a></div>
      <div class="rw-mon${mons.size ? "" : " off"}"><div class="rw-pick" data-pick="mon" hidden>${folderTree({ type: "Actor", filter: a => a.type === "creature", info: a => `niv ${Number(a.system.level) || 0} · ${fmt(a.system.xpReward)} XP`, empty: "Aucune créature : crée un acteur de type « Créature »." })}</div>
        <div class="lt-list">${[...mons.values()].map(monRow).join("")}</div><div class="lt-tot"><span>Monstres</span><b class="txp">0 XP</b><b class="tgd">0 Gold</b></div></div>
      <div class="ms-bnr" style="--bc:#ffd070"><i class="fa-solid fa-sack-dollar"></i> Butin <small>celui des monstres, plus les objets que tu ajoutes</small><span class="sp"></span><a class="ms-mbtn gold sm" data-it-add><i class="fa-solid fa-plus"></i> Objets</a></div>
      <div class="rw-pick" data-pick="it" hidden>${folderTree({ type: "Item", info: i => i.system?.rank ? `rang ${i.system.rank}` : "", empty: "Aucun objet dans le monde." })}</div><div class="rw-drops"></div></section>
    <section class="tgt">
      <div class="ms-bnr" style="--bc:#3ddc84"><i class="fa-solid fa-flag"></i> Groupes d'aventure</div><div class="rw-gs">${advH || `<p class="ms-mhint">Aucun groupe d'aventure.</p>`}</div>
      ${GG.length ? `<hr class="ms-sep"><div class="ms-bnr" style="--bc:#ffc63d"><i class="fa-solid fa-crown"></i> Groupes MJ</div><div class="rw-gs">${ggH}</div>` : ""}
      <hr class="ms-sep"><div class="ms-bnr" style="--bc:#ff8af0"><i class="fa-solid fa-user"></i> Joueurs <small>un clic sur un personnage</small></div><div class="rw-us">${plH || `<p class="ms-mhint">Aucun personnage joueur.</p>`}</div>
      <p class="ms-mhint">Les PNJ d'un groupe ne reçoivent rien. Un personnage présent dans plusieurs choix ne reçoit qu'une fois.</p></section></div>`;
  const r = await DialogV2.prompt({ window: { title: "Récompenses", icon: "fa-solid fa-gift" }, classes: ["ms-dialog", "ms-menu-dialog", "ms-reward-win"], position: { width: 980 }, content, rejectClose: false,
    render: (ev, dlg) => { const el = dlg.element ?? dlg; const box = el.querySelector(".lt-list"); const xpIn = el.querySelector('input[name="xp"]'); const gIn = gk ? el.querySelector(`input[name="res-${gk}"]`) : null;
      const sync = () => { box.querySelectorAll(".lt-row").forEach(row => { const m = mons.get(row.dataset.uuid); if (m) m.n = Math.max(0, Math.floor(Number(row.querySelector(".n").value) || 0)); });
        const L = monsterLoot([...mons.values()]); xpIn.value = Math.max(0, (Number(xpIn.value) || 0) - monXp + L.xp); if (gIn) gIn.value = Math.max(0, (Number(gIn.value) || 0) - monGold + L.gold); monXp = L.xp; monGold = L.gold;
        el.querySelector(".txp").textContent = `${fmt(L.xp)} XP`; el.querySelector(".tgd").textContent = `${fmt(L.gold)} Gold`; const keep = new Map(drops.map((d, i) => [d.key, { q: el.querySelector(`input[name="dq-${i}"]`)?.value, c: el.querySelector(`input[name="drop"][value="${i}"]`)?.checked }]));
        drops = [...fixedDrops, ...L.drops]; el.querySelector(".rw-drops").innerHTML = dropsHTML();
        drops.forEach((d, i) => { const k = keep.get(d.key); if (!k) return; const q = el.querySelector(`input[name="dq-${i}"]`), c = el.querySelector(`input[name="drop"][value="${i}"]`); if (c && k.c != null) c.checked = k.c; }); bindRoll(); };
      const bindRoll = () => el.querySelector("[data-roll]")?.addEventListener("click", e => { e.preventDefault(); drops.forEach((d, i) => { const cb = el.querySelector(`input[name="drop"][value="${i}"]`); const q = el.querySelector(`input[name="dq-${i}"]`); if (!cb || !q) return; let got = 0; for (const rr of d.rolls || [{ n: d.n || 1, per: d.per || 1, chance: d.chance ?? 100 }]) for (let k = 0; k < (rr.n || 1); k++) if (Math.random() * 100 < (rr.chance ?? 100)) got += rr.per || 1; q.value = got; cb.checked = got > 0; }); });
      const tog = k => { const p = el.querySelector(`[data-pick="${k}"]`); p.hidden = !p.hidden; if (k === "mon") el.querySelector(".rw-mon").classList.remove("off"); if (!p.hidden) p.querySelector("[data-fp-q]")?.focus(); };
      el.querySelector("[data-mon-add]").addEventListener("click", e => { e.preventDefault(); tog("mon"); });
      el.querySelector("[data-it-add]").addEventListener("click", e => { e.preventDefault(); tog("it"); });
      el.querySelector(".rw-drops").addEventListener("change", e => { const m = /^dq-(\d+)$/.exec(e.target.name || ""); if (m && drops[+m[1]]) drops[+m[1]].qty = Math.max(0, Number(e.target.value) || 0); });
      box.addEventListener("change", sync); box.addEventListener("click", e => { const st = e.target.closest("[data-step]"); if (st) { e.preventDefault(); const inp = st.closest(".lt-row").querySelector(".n"); inp.value = Math.max(0, (Number(inp.value) || 0) + Number(st.dataset.step)); sync(); return; } const rm = e.target.closest(".rm"); if (!rm) return; const row = rm.closest(".lt-row"); mons.delete(row.dataset.uuid); row.remove(); sync(); });
      bindFolderTree(el.querySelector('[data-pick="mon"]'), uu => { for (const u of uu) { const ex = box.querySelector(`.lt-row[data-uuid="${CSS.escape(u)}"] .n`); if (ex) { ex.value = Number(ex.value) + 1; continue; } const a = fromUuidSync(u); if (!a) continue; addMon(a, 1); box.insertAdjacentHTML("beforeend", monRow(mons.get(u))); } sync(); }, { filter: a => a.type === "creature" });
      bindFolderTree(el.querySelector('[data-pick="it"]'), uu => { for (const u of uu) { const it = fromUuidSync(u); if (!it) continue; const key = `it|${u}`; const ex = fixedDrops.find(d => d.key === key); if (ex) { ex.qty += 1; continue; } const data = it.toObject(); for (const k of ["_id", "folder", "sort", "ownership", "_stats"]) delete data[k]; fixedDrops.push({ key, name: it.name, img: it.img, qty: 1, chance: 100, chances: [100], data, fixed: true }); } sync(); });
      sync(); },
    ok: { label: "Distribuer", icon: "fa-solid fa-gift", callback: (ev, btn) => { const f = btn.form; const res = {}; for (const rr of cfg.resources) res[rr.key] = Math.max(0, Number(f.elements[`res-${rr.key}`]?.value) || 0);
      const dsel = [...f.querySelectorAll('input[name="drop"]:checked')].map(i => ({ ...drops[Number(i.value)], qty: Math.max(0, Number(f.elements[`dq-${i.value}`]?.value) || 0) })).filter(d => d.qty);
      const all = n => [...f.querySelectorAll(`input[name="${n}"]:checked`)].map(i => i.value);
      return { drops: dsel, dropTo: f.elements.dropTo?.value || "", xp: Math.max(0, Number(f.elements.xp.value) || 0), res, mode: f.elements.mode.value, label: f.elements.label.value.trim(), parties: all("party"), gmg: all("gmg"), pcs: all("pc"), mons: [...mons.values()].filter(m => m.n > 0) }; } } });
  if (!r) return;
  if (!r.label && r.mons.length) r.label = r.mons.map(m => `${m.n} × ${m.actor.name}`).join(", ");
  if (r.drops?.length) await giveDrops(actorOf(r.dropTo), r.drops);
  if (!r.xp && !Object.values(r.res).some(Boolean)) return;
  const members = new Map();
  for (const pid of r.parties) { const p = list.find(x => x.id === pid); for (const m of p?.members || []) { const a = actorOf(m.uuid); if (isPC(a) && !members.has(a.uuid)) members.set(a.uuid, { actor: a, xp: m.xp, gold: m.gold }); } if (!r.label && p) r.label = p.name; }
  const loose = [...r.pcs]; for (const gid of r.gmg) { const x = GG.find(y => y.g.id === gid); for (const a of x?.mem || []) loose.push(a.uuid); if (!r.label && x) r.label = x.g.name; }
  for (const u of loose) { const a = actorOf(u); if (a && !members.has(u)) members.set(u, { actor: a, xp: 1, gold: 1, loose: true }); }
  if (!members.size) return ui.notifications.warn("Choisis au moins un groupe ou un joueur.");
  if (loose.length && r.mode === "shares") { const avg = 100 / members.size; for (const m of members.values()) if (m.loose) { m.xp = avg; m.gold = avg; } }
  return distribute({ members: [...members.values()], xp: r.xp, res: r.res, mode: r.mode, label: r.label });
}

/* ── onglet Groupe ── */
const gaugeMini = a => { const cfg = getConfig(); return (cfg.gauges || []).slice(0, 3).map(g => { const v = a.system.gauges?.[g.key] || {}; const narr = narrativeGaugesOn(cfg);
  const st = gaugeStages(g); const s = narr ? stageOf(g, v, st.length) : 0; const p = narr ? s / st.length * 100 : (Number(v.max) ? Math.min(100, (Number(v.value) || 0) / Number(v.max) * 100) : 0);
  return `<i class="gm" style="--c:${esc(g.color)};--p:${p}%" title="${esc(g.name)} : ${narr ? esc(st[s - 1]) : `${v.value ?? 0} / ${v.max ?? 0}`}"></i>`; }).join(""); };

export function renderParty(app) {
  const gm = game.user.isGM; const all = parties(); const mine = gm ? all : all.filter(p => p.members.some(m => m.uuid === app.actor.uuid || actorOf(m.uuid)?.isOwner));
  if (!mine.some(p => p.id === app.partyId)) app.partyId = mine.find(p => p.members.some(m => m.uuid === app.actor.uuid))?.id || mine[0]?.id || null;
  const p = mine.find(x => x.id === app.partyId);
  const chips = mine.map(x => `<a data-mact="pSel" data-id="${x.id}" class="ms-pchip${x.id === app.partyId ? " on" : ""}" style="--c:${esc(x.color || "#38e0ff")}"><i></i>${esc(x.name)}<small>${x.members.length}</small></a>`).join("");
  const top = `<div class="ms-mtop">${chips || `<span class="ms-mhint">${gm ? "Aucun groupe." : "Tu ne fais partie d'aucun groupe."}</span>`}${gm ? `<a class="ms-mbtn blue" data-mact="pNew"><i class="fa-solid fa-plus"></i> Nouveau groupe</a>` : ""}</div>`;
  if (!p) return top;
  const tx = p.members.reduce((a, m) => a + (Number(m.xp) || 0), 0), tg = p.members.reduce((a, m) => a + (Number(m.gold) || 0), 0);
  const cards = p.members.map(m => { const a = actorOf(m.uuid); if (!a) return `<div class="ms-pmem missing" data-uuid="${esc(m.uuid)}"><b>Acteur introuvable</b>${gm ? `<a data-mact="pDel" class="x"><i class="fa-solid fa-xmark"></i></a>` : ""}</div>`;
    const rk = rankOf(getConfig(), a.system.rank); const online = game.users.some(u => u.active && !u.isGM && u.character?.id === a.id);
    return `<div class="ms-pmem${a.uuid === app.actor.uuid ? " me" : ""}" data-uuid="${esc(m.uuid)}">
      <div class="pic"><img src="${esc(a.img)}">${online ? `<i class="on" title="Joueur connecté"></i>` : ""}<span class="rk" style="--c:${esc(rk?.color || "#fff")}">${esc(rk?.name || "")}</span></div>
      <div class="info"><b>${esc(a.name)}</b><small><span style="color:${levelColor(a.system.level)}">Niv ${Number(a.system.level) || 0}</span> · ${kindLabel(a)}${p.leader === m.uuid ? ` · <i class="fa-solid fa-crown"></i> chef` : ""}</small><div class="gms">${gaugeMini(a)}</div></div>
      <div class="sh"><label title="Part d'XP"><i class="fa-solid fa-arrow-trend-up"></i>${gm ? `<input type="number" data-share="xp" value="${Number(m.xp) || 0}" min="0" step="1">` : `<b>${Math.round((Number(m.xp) || 0) * 10) / 10}</b>`}<em>%</em></label><label title="Part de Gold"><i class="fa-solid fa-coins"></i>${gm ? `<input type="number" data-share="gold" value="${Number(m.gold) || 0}" min="0" step="1">` : `<b>${Math.round((Number(m.gold) || 0) * 10) / 10}</b>`}<em>%</em></label></div>
      <div class="acts">${a.testUserPermission(game.user, "LIMITED") ? `<a data-mact="pSheet" title="Ouvrir la fiche (clic droit sur la carte : carte du joueur)"><i class="fa-solid fa-id-card"></i></a>` : ""}${gm ? `<a data-mact="pLead" title="Chef du groupe"><i class="fa-solid fa-crown"></i></a><a data-mact="pDel" class="x" title="Retirer du groupe"><i class="fa-solid fa-xmark"></i></a>` : ""}</div></div>`; }).join("");
  const warn = v => Math.round(v) === 100 ? "ok" : "bad";
  return `${top}<div class="ms-mpanel ms-party" style="--pc:${esc(p.color || "#38e0ff")}">
    <header class="ms-phead">${gm ? `<input type="text" class="pn" data-pfield="name" value="${esc(p.name)}"><input type="color" data-pfield="color" value="${esc(p.color || "#38e0ff")}">` : `<h2>${esc(p.name)}</h2>`}
      <span class="tot"><span class="${warn(tx)}"><i class="fa-solid fa-arrow-trend-up"></i> XP ${pct(tx)}</span><span class="${warn(tg)}"><i class="fa-solid fa-coins"></i> Gold ${pct(tg)}</span></span>
      ${gm ? `<a class="ms-mbtn ghost" data-mact="pEqual" title="Mettre toutes les parts à égalité"><i class="fa-solid fa-scale-balanced"></i> Parts égales</a><a class="ms-mbtn red" data-mact="pRemove" title="Supprimer le groupe"><i class="fa-solid fa-trash"></i></a>` : ""}</header>
    <div class="ms-pmembers" data-drop="party">${cards || `<div class="ms-mhint">Groupe vide.${gm ? " Ajoute des membres ou glisse des acteurs ici." : ""}</div>`}</div>
    ${gm ? `<footer class="ms-pfoot"><a class="ms-mbtn blue" data-mact="pAdd"><i class="fa-solid fa-user-plus"></i> Ajouter des membres</a><a class="ms-mbtn green" data-mact="pReward"><i class="fa-solid fa-gift"></i> Distribuer XP / Gold</a>${Math.round(tx) !== 100 || Math.round(tg) !== 100 ? `<span class="ms-mhint">Si le total n'est pas 100 %, les parts sont recalculées à la distribution.</span>` : ""}</footer>` : ""}
  </div>`;
}

export function bindParty(app, root) {
  /* 1.39 : clic droit sur un membre → sa carte du joueur */
  root.querySelectorAll(".ms-pmem[data-uuid]").forEach(m => m.addEventListener("contextmenu", async ev => { ev.preventDefault(); ev.stopPropagation(); const { openProfile } = await import("./pcard.js"); openProfile(m.dataset.uuid); }));
  root.querySelectorAll("[data-share]").forEach(inp => inp.addEventListener("change", () => { const uuid = inp.closest("[data-uuid]").dataset.uuid; const k = inp.dataset.share; const v = Math.max(0, Number(inp.value) || 0);
    editList("parties", l => { const m = l.find(x => x.id === app.partyId)?.members.find(x => x.uuid === uuid); if (m) m[k] = v; }); }));
  root.querySelectorAll("[data-pfield]").forEach(inp => inp.addEventListener("change", () => { const k = inp.dataset.pfield; const v = inp.value.trim(); if (!v) return; editList("parties", l => { const p = l.find(x => x.id === app.partyId); if (p) p[k] = v; }); }));
  const drop = root.querySelector('[data-drop="party"]');
  if (drop && game.user.isGM) {
    drop.addEventListener("dragover", ev => { ev.preventDefault(); drop.classList.add("over"); }); drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", async ev => { drop.classList.remove("over"); let d; try { d = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch (e) { return; } ev.preventDefault();
      let uuids = []; if (d?.type === "Actor") uuids = [d.uuid]; else if (d?.type === "Folder" && d.documentName === "Actor") { const f = await fromUuid(d.uuid); uuids = (f?.contents || []).map(a => a.uuid); }
      if (uuids.length) await addMembers(app.partyId, uuids); });
  }
}
async function addMembers(pid, uuids) { await editList("parties", l => { const p = l.find(x => x.id === pid); if (!p) return false; for (const u of uuids) if (!p.members.some(m => m.uuid === u)) p.members.push({ uuid: u, xp: 0, gold: 0 }); equalize(p); }); }
const equalize = p => { const n = p.members.length || 1; const v = Math.floor(1000 / n) / 10; p.members.forEach((m, i) => { m.xp = m.gold = i === 0 ? Math.round((100 - v * (n - 1)) * 10) / 10 : v; }); };

export async function actParty(app, act, el) {
  const uuid = el.closest("[data-uuid]")?.dataset.uuid;
  switch (act) {
    case "pSel": app.partyId = el.dataset.id; return app.render();
    case "pNew": { const name = await askName("Nouveau groupe", ""); if (!name) return; const id = uid(); await editList("parties", l => { l.push({ id, name, color: PCOLORS[l.length % PCOLORS.length], leader: "", members: [] }); }); app.partyId = id; return; }
    case "pRemove": { const p = parties().find(x => x.id === app.partyId); if (!p || !await DialogV2.confirm({ window: { title: "Supprimer le groupe" }, classes: ["ms-dialog"], content: `<p>Supprimer le groupe <b>${esc(p.name)}</b> ? Les personnages ne sont pas touchés.</p>` })) return; await editList("parties", l => l.splice(l.findIndex(x => x.id === p.id), 1) && undefined); return; }
    case "pEqual": return editList("parties", l => { const p = l.find(x => x.id === app.partyId); if (p) equalize(p); });
    case "pDel": return editList("parties", l => { const p = l.find(x => x.id === app.partyId); if (p) p.members = p.members.filter(m => m.uuid !== uuid); });
    case "pLead": return editList("parties", l => { const p = l.find(x => x.id === app.partyId); if (p) p.leader = p.leader === uuid ? "" : uuid; });
    case "pSheet": return actorOf(uuid)?.sheet?.render(true);
    case "pReward": return rewardDialog(app.partyId);
    case "pAdd": return pickMembers(app.partyId);
  }
}

/* choix des membres : joueurs connectés, groupes de PNJ Manhwa, tous les personnages */
async function pickMembers(pid) {
  const p = parties().find(x => x.id === pid); if (!p) return; const { recipientPicker } = await import("./pickers.js");
  const r = await recipientPicker({ title: `Ajouter au groupe « ${p.name} »`, multi: true, exclude: p.members.map(m => m.uuid), label: "Tape un nom de personnage ou un pseudo de joueur, puis clique pour l'ajouter (plusieurs possibles)." });
  if (r?.length) await addMembers(pid, r);
}
export async function askName(title, value) {
  const r = await DialogV2.prompt({ window: { title }, classes: ["ms-dialog"], content: `<div class="ms-form"><label>Nom<input type="text" name="v" value="${esc(value)}" autofocus></label></div>`, ok: { label: "Valider", callback: (ev, btn) => btn.form.elements.v.value.trim() }, rejectClose: false });
  return r || null;
}

/* bouton « Récompenses » dans les contrôles de jetons (MJ) */
Hooks.on("getSceneControlButtons", controls => {
  if (!game.user?.isGM) return;
  const tool = { name: "msReward", title: "Récompenses : XP, monnaies et butin des monstres", icon: "fa-solid fa-gift", button: true, visible: true, order: 98, onChange: () => rewardDialog(), onClick: () => rewardDialog() };
  if (Array.isArray(controls)) controls.find(c => c.name === "token")?.tools?.push(tool); else { const t = controls.tokens || controls.token; if (t?.tools) t.tools.msReward = tool; }
});
