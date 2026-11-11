/* Manhwa Sheet — Téléphone des personnages (remplace l'ancienne Messagerie).
 *
 * Rangement : une conversation = un journal caché du dossier « Téléphone » (drapeau phone = { members, group, name, img }),
 * un message = une page de ce journal (drapeau m = { from, text, img, fx, kind, reply, re, hide, del, ts }).
 * Les membres (propriétaires des personnages) possèdent le journal : ils écrivent sans passer par le MJ ; créer, supprimer
 * une conversation ou changer ses membres passe par le MJ. Les anciens messages (messages de chat chuchotés) sont repris
 * une fois par le MJ.
 *
 * Chaque personnage a son téléphone (drapeau phone sur l'acteur) : numéro, statut, photo, contacts, bloqués, épinglés,
 * archivés, silencieux, lus, thème, fond d'écran, sonneries, cadre. Les cadres et effets de message sont des cosmétiques
 * verrouillés : le MJ les débloque par joueur (ou la Boutique stellaire les vend). Volume : réglage de chaque joueur. */
import { SYS, esc, getConfig, rankOf, focusKey, focusBack } from "./config.js";
import { gmDo, onGm, toast, actorOf, menuCfg, parties, TAB_VIS, actorLock, activeGM, quests, QUEST_STATUS, editList } from "./world.js";
import { questFor, isInternode, editQuest, actQuests, objDone } from "./quests.js";

const { DialogV2, ApplicationV2 } = foundry.applications.api;
const FOLDER = "Téléphone";
const SND = n => `systems/${SYS}/sounds/phone/${n}.ogg`;
const K = uuid => String(uuid || "").replace(/\./g, "_");                     /* clé de drapeau sans points */
const now = () => Date.now();
const PAGE = 150;   /* 1.38.1 : mesuré sur test2 — 150 messages restent fluides, au-delà le rendu ralentit nettement */

/* ── catalogues ── */
export const RINGS = { ring_classic: "Classique", ring_synth: "Synthé", ring_soft: "Douce", ring_scifi: "Sci-fi" };
export const NOTIFS = { notif_ping: "Ping", notif_chime: "Carillon", notif_blip: "Bip", notif_crystal: "Cristal" };
export const PH_THEMES = { neon: "Néon", clair: "Clair", sombre: "Sombre pur", holo: "Holographique", parchemin: "Parchemin" };
/* ══ FONDS D'ÉCRAN (1.52) : un seul catalogue pour l'accueil et le démarrage, classé par packs comme les stickers.
 * Rien n'est gratuit (sauf « Aucun ») : chaque fond se débloque à l'unité (« wall:clé ») ou par pack (« wallpack:pack »),
 * l'image personnalisée aussi (« wall:custom »). Ajouter un fond = ajouter une ligne dans WALL_LIST (key, n, pack, rar, tone, css, anim).
 * tone : « dark » (fond sombre, voile léger) ou « light » (fond clair, voile renforcé pour garder l'écran lisible). */
export const WALL_PACKS = {
  basic: { n: "Basique", c: "#7fd6ff", ic: "fa-shapes", desc: "Les fonds de base du téléphone." },
  cosmos: { n: "Cosmos", c: "#9a7bff", ic: "fa-meteor", desc: "Étoiles, failles et abysses." },
  neon: { n: "Néon", c: "#ff3dd2", ic: "fa-bolt", desc: "Interfaces, grilles et glitchs." },
  nature: { n: "Nature", c: "#5aff9a", ic: "fa-leaf", desc: "Forêts, aubes et crépuscules." },
  elem: { n: "Élémentaire", c: "#ff8a3a", ic: "fa-fire", desc: "Feu, sang et cendres." },
  prestige: { n: "Prestige", c: "#f5c518", ic: "fa-crown", desc: "Or et couronnes." }
};
export const WALL_RAR = { common: ["Commun", "#9fb0d4"], rare: ["Rare", "#38a8ff"], epic: ["Épique", "#b46bff"], legend: ["Légendaire", "#f5c518"] };
const WL = (key, n, pack, rar, tone, css, anim = "") => ({ key, n, pack, rar, tone, css, anim, free: key === "" });
export const WALL_LIST = [
  WL("", "Aucun", "basic", "common", "dark", "none"),
  WL("nebula", "Nébuleuse", "basic", "common", "dark", "radial-gradient(120% 80% at 20% 10%, #5b2a86 0%, transparent 60%), radial-gradient(90% 70% at 90% 90%, #1d4f8f 0%, transparent 60%), #070a18"),
  WL("aurora", "Aurore", "basic", "common", "dark", "linear-gradient(160deg, #0b2a2a 0%, #0f5a4a 35%, #2a1d5a 70%, #07101c 100%)"),
  WL("grid", "Grille", "basic", "common", "dark", "linear-gradient(#38e0ff14 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, #38e0ff14 1px, transparent 1px) 0 0 / 22px 22px, radial-gradient(80% 60% at 50% 0%, #10306a, #050914)"),
  WL("stars", "Constellations", "cosmos", "rare", "dark", "radial-gradient(1.5px 1.5px at 20% 18%, #fff, transparent), radial-gradient(1px 1px at 72% 12%, #fff, transparent), radial-gradient(1.5px 1.5px at 84% 40%, #cfe3ff, transparent), radial-gradient(1px 1px at 35% 62%, #fff, transparent), radial-gradient(2px 2px at 58% 30%, #fff8d0, transparent), radial-gradient(1px 1px at 12% 78%, #fff, transparent), radial-gradient(1.5px 1.5px at 66% 82%, #dfe9ff, transparent), radial-gradient(1px 1px at 46% 8%, #fff, transparent), radial-gradient(1px 1px at 90% 70%, #fff, transparent), radial-gradient(1px 1px at 28% 35%, #fff, transparent), radial-gradient(90% 60% at 30% 20%, #2a2a7a88, transparent 70%), radial-gradient(80% 60% at 80% 90%, #5a1a6a77, transparent 70%), #04040f", "stars"),
  WL("rift", "Faille", "cosmos", "epic", "dark", "radial-gradient(18% 34% at 50% 45%, #fff 0%, #e6b3ff 12%, #9a3dff 32%, transparent 70%), radial-gradient(70% 50% at 50% 45%, #5b1aa8aa 0%, transparent 70%), radial-gradient(120% 80% at 50% 110%, #2a0a4a, #07020f)", "rift"),
  WL("ocean", "Abysses", "cosmos", "common", "dark", "radial-gradient(100% 70% at 50% 110%, #0a5a7a 0%, transparent 60%), linear-gradient(180deg, #02101e, #041e33)"),
  WL("deep", "Rayons abyssaux", "cosmos", "rare", "dark", "radial-gradient(30% 60% at 50% -10%, #6fe8ff66 0%, transparent 70%), repeating-linear-gradient(100deg, #6fe8ff0a 0 6px, transparent 6px 40px), radial-gradient(1.5px 1.5px at 40% 70%, #bff6ff, transparent), radial-gradient(1px 1px at 60% 82%, #bff6ff, transparent), linear-gradient(180deg, #03304a, #021a2c 50%, #010812)", "abyss"),
  WL("system", "Système", "neon", "rare", "dark", "radial-gradient(60% 40% at 50% 38%, #1fb6ff55 0%, transparent 70%), repeating-linear-gradient(0deg, #38e0ff0f 0 1px, transparent 1px 4px), conic-gradient(from 200deg at 50% 38%, #0a2a5a, #041022, #0a2a5a, #062048, #0a2a5a), #030a18", "system"),
  WL("synth", "Synthwave", "neon", "epic", "light", "linear-gradient(transparent 62%, #ff2bd6 62.3%, transparent 62.6%), repeating-linear-gradient(90deg, #ff2bd633 0 1px, transparent 1px 26px) 0 100% / 100% 38% no-repeat, repeating-linear-gradient(0deg, #ff2bd633 0 1px, transparent 1px 18px) 0 100% / 100% 38% no-repeat, radial-gradient(22% 13% at 50% 50%, #ffd36b 0%, #ff6a3d 55%, transparent 60%), linear-gradient(180deg, #12002a 0%, #3a0a5a 45%, #ff2bd655 61%, #0a0016 62%)", "synth"),
  WL("glitch", "Glitch", "neon", "rare", "dark", "linear-gradient(90deg, transparent 20%, #ff2bd633 20% 21%, transparent 21% 63%, #00f0ff33 63% 64%, transparent 64%), repeating-linear-gradient(0deg, #ffffff08 0 2px, transparent 2px 5px), linear-gradient(180deg, transparent 30%, #00f0ff22 30% 32%, transparent 32% 58%, #ff2bd622 58% 59%, transparent 59%), radial-gradient(80% 60% at 50% 40%, #1a1a3a, #050510)", "glitch"),
  WL("forest", "Forêt runique", "nature", "rare", "dark", "radial-gradient(3px 3px at 30% 60%, #7dffb8, transparent), radial-gradient(2px 2px at 70% 50%, #7dffb8cc, transparent), radial-gradient(2px 2px at 55% 75%, #b8ffd8, transparent), radial-gradient(2px 2px at 20% 40%, #7dffb899, transparent), radial-gradient(60% 40% at 50% 100%, #0f5a3a 0%, transparent 70%), linear-gradient(180deg, #021a12, #04261a 55%, #010b07)", "forest"),
  WL("dawn", "Aube dorée", "nature", "epic", "light", "radial-gradient(40% 22% at 50% 70%, #ffe7a0 0%, #ffb547aa 35%, transparent 70%), linear-gradient(180deg, #1a1440 0%, #6a3a6a 40%, #e08a4a 68%, #2a1408 69%, #120a04 100%)", "dawn"),
  WL("sunset", "Crépuscule", "nature", "common", "light", "linear-gradient(170deg, #2a0f2e 0%, #7a2a3a 45%, #e0844a 80%, #2a1408 100%)"),
  WL("ember", "Braises", "elem", "common", "dark", "radial-gradient(90% 60% at 50% 120%, #b43a12 0%, transparent 60%), radial-gradient(60% 40% at 80% 20%, #5a1a0a 0%, transparent 70%), #120604"),
  WL("crimson", "Lune de sang", "elem", "epic", "dark", "radial-gradient(16% 9% at 50% 50%, #ffd0c0 0%, #ff3a3a 45%, #8a0a0a 70%, transparent 72%), radial-gradient(50% 30% at 50% 50%, #ff3a3a33, transparent 70%), linear-gradient(180deg, #1a0204, #3a0608 55%, #0a0102)", "crimson"),
  WL("gold", "Or royal", "prestige", "rare", "dark", "radial-gradient(90% 70% at 30% 20%, #6a4a12 0%, transparent 60%), linear-gradient(160deg, #1a1206, #0a0804)"),
  WL("crown", "Couronne", "prestige", "legend", "dark", "radial-gradient(30% 20% at 50% 36%, #ffd36b55 0%, transparent 70%), repeating-conic-gradient(from 0deg at 50% 36%, #ffd36b12 0 6deg, transparent 6deg 18deg), linear-gradient(180deg, #1a1206, #0a0804)", "gold")
];
export const wallDef = k => WALL_LIST.find(w => w.key === (k || "")) || null;
/* compat : anciennes clés des fonds de démarrage */
const WALL_ALIAS = { abyss: "deep" };
export const WALLS = Object.fromEntries(WALL_LIST.map(w => [w.key, [w.n, w.css]]));
/* effets de message (cosmétiques) : « Normal » est toujours disponible */
export const PH_FX = { shout: ["Crier", "fa-bullhorn"], whisper: ["Chuchoter", "fa-ear-listen"], glow: ["Lumineux", "fa-sun"], shake: ["Tremblant", "fa-burst"], rainbow: ["Arc-en-ciel", "fa-rainbow"], hearts: ["Cœurs", "fa-heart"], boom: ["Explosion", "fa-explosion"], ghost: ["Fantôme", "fa-ghost"], system: ["Système", "fa-terminal"], bold: ["Gras", "fa-bold"], italic: ["Italique", "fa-italic"], under: ["Souligné", "fa-underline"] };
/* cadres du téléphone (cosmétiques) */
export const FRAMES = { chrome: ["Chrome", "fa-mobile-screen"], gold: ["Or royal", "fa-crown"], neon: ["Néon", "fa-bolt"], holo: ["Holographique", "fa-wand-magic-sparkles"], rune: ["Runique", "fa-hat-wizard"], carbon: ["Carbone", "fa-shield-halved"], crystal: ["Cristal", "fa-gem"] };
export const COSMETICS = [
  ...Object.entries(FRAMES).map(([k, [n, ic]]) => ({ id: `frame:${k}`, kind: "frame", key: k, name: `Cadre ${n}`, icon: ic, desc: `Cadre de téléphone « ${n} ».` })),
  ...Object.entries(PH_FX).map(([k, [n, ic]]) => ({ id: `fx:${k}`, kind: "fx", key: k, name: `Effet « ${n} »`, icon: ic, desc: `Effet de message « ${n} » pour le téléphone.` })),
  ...Object.entries(WALL_PACKS).filter(([k]) => WALL_LIST.some(w => w.pack === k && !w.free)).map(([k, p]) => ({ id: `wallpack:${k}`, kind: "wallpack", key: k, name: `Pack de fonds « ${p.n} »`, icon: p.ic, desc: `Tous les fonds d'écran du pack « ${p.n} » (${WALL_LIST.filter(w => w.pack === k && !w.free).length}).` })),
  ...WALL_LIST.filter(w => !w.free).map(w => ({ id: `wall:${w.key}`, kind: "wall", key: w.key, name: `Fond « ${w.n} »`, icon: "fa-image", pack: w.pack, rar: w.rar, desc: `Fond d'écran « ${w.n} » (pack ${WALL_PACKS[w.pack]?.n || w.pack}) pour l'accueil et le démarrage du téléphone.` })),
  { id: "wall:custom", kind: "wall", key: "custom", name: "Fond personnalisé", icon: "fa-panorama", desc: "Permet de mettre sa propre image en fond d'écran (accueil et démarrage), avec cadrage et réglage du voile." }
];
export const REACTS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];
export const EMOJI_CATS = {
  smileys: ["fa-face-smile", "Smileys", "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👺 👻 👽 👾 🤖"],
  gestes: ["fa-hand", "Gestes", "👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦵 🦶 👂 👃 🧠 🫀 👀 👁️ 👅 👄 🫦 🙇 🤦 🤷 🙋 🙅 🙆 💁 🧏"],
  coeurs: ["fa-heart", "Cœurs", "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 💋 💌 💐 🌹 🥀 💍 💑 💏"],
  animaux: ["fa-paw", "Animaux", "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🕷️ 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🐘 🦛 🦏 🐪 🦒 🦘 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🐐 🦌 🐕 🐈 🐓 🦃 🦚 🦜 🦢 🕊️ 🐇 🦝 🦨 🦡 🦦 🐉 🐲 🌵 🌲 🌳 🌴 🍀 🍁 🍂 🌸 🌺 🌻 🌼 🌷"],
  nourriture: ["fa-burger", "Nourriture", "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🧀 🥚 🍳 🥞 🧇 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🌮 🌯 🥗 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍙 🍚 🍘 🍥 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🥛 ☕ 🍵 🧃 🥤 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉"],
  activites: ["fa-futbol", "Activités", "⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥅 🏒 🏑 🏏 ⛳ 🏹 🎣 🥊 🥋 🎽 ⛸️ 🥌 🛷 🎿 ⛷️ 🏂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🎗️ 🎫 🎟️ 🎪 🤹 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻 🎲 ♟️ 🎯 🎳 🎮 🕹️ 🧩"],
  voyage: ["fa-plane", "Voyage", "🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🚚 🚛 🚜 🏍️ 🛵 🚲 🛴 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓ 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ ⛺ 🏠 🏡 🏘️ 🏚️ 🏗️ 🏭 🏢 🏬 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛️ ⛪ 🕌 🕍 🛕 🌅 🌄 🌠 🎇 🎆 🌇 🌆 🏙️ 🌃 🌌 🌉 🌁"],
  objets: ["fa-lightbulb", "Objets", "⌚ 📱 📲 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💽 💾 💿 📀 📷 📸 📹 🎥 📞 ☎️ 📟 📠 📺 📻 🎙️ ⏱️ ⏰ ⌛ ⏳ 📡 🔋 🔌 💡 🔦 🕯️ 🧯 💸 💵 💴 💶 💷 💰 💳 💎 ⚖️ 🧰 🔧 🔨 ⚒️ 🛠️ ⛏️ 🔩 ⚙️ 🧱 ⛓️ 🧲 🔫 💣 🧨 🪓 🔪 🗡️ ⚔️ 🛡️ 🚬 ⚰️ 🏺 🔮 📿 🧿 💈 ⚗️ 🔭 🔬 🕳️ 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡️ 🧹 🧺 🧻 🚽 🛁 🧼 🪒 🧽 🛎️ 🔑 🗝️ 🚪 🪑 🛋️ 🛏️ 🧸 🖼️ 🛍️ 🛒 🎁 🎈 🎏 🎀 🎊 🎉 🎎 🏮 🎐 🧧 ✉️ 📩 📨 📧 💌 📥 📤 📦 🏷️ 📪 📫 📬 📭 📮 📯 📜 📃 📄 📑 🧾 📊 📈 📉 🗒️ 🗓️ 📆 📅 🗑️ 📇 🗃️ 🗳️ 🗄️ 📋 📁 📂 🗂️ 🗞️ 📰 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🧷 🔗 📎 🖇️ 📐 📏 🧮 📌 📍 ✂️ 🖊️ 🖋️ ✒️ 🖌️ 🖍️ 📝 ✏️ 🔍 🔎 🔏 🔐 🔒 🔓"],
  symboles: ["fa-icons", "Symboles", "💯 🔥 ⚡ ✨ 🌟 ⭐ 💫 💥 💢 💦 💨 🕳️ 💬 👁️‍🗨️ 🗨️ 🗯️ 💭 💤 ☀️ 🌙 🌛 🌈 ☁️ ⛅ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 🌪️ 🌫️ 🌊 💧 ☔ ☂️ ♻️ ⚜️ 🔱 📛 🔰 ⭕ ✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ ♾️ ‼️ ⁉️ ❓ ❔ ❕ ❗ 〰️ ⚠️ 🚸 ⛔ 🚫 🚳 🚭 🔞 ☢️ ☣️ ⬆️ ↗️ ➡️ ↘️ ⬇️ ↙️ ⬅️ ↖️ ↕️ ↔️ 🔄 🔃 🔀 🔁 🔂 ▶️ ⏸️ ⏹️ ⏺️ ⏭️ ⏮️ ⏩ ⏪ 🔼 🔽 🎵 🎶 💲 ©️ ®️ ™️ 🔚 🔙 🔛 🔝 🔜 🆗 🆕 🆙 🆒 🆓 🆘 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔺 🔻 🔸 🔹 🔶 🔷 ♠️ ♣️ ♥️ ♦️ 🃏 🀄 🎴 ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ⛎"],
  jdr: ["fa-dragon", "Fantasy / JDR", "⚔️ 🗡️ 🛡️ 🏹 🪄 🔮 🧙 🧙‍♀️ 🧝 🧛 🧟 🧞 🧜 🧚 🦸 🦹 🥷 🤴 👸 🫅 👑 💍 💎 🪙 💰 🧪 ⚗️ 📜 🗝️ 🗺️ 🧭 🏰 🐉 🐲 🦄 🔥 ❄️ ⚡ 🌪️ ☄️ 🌑 🌕 ✨ 💫 🌟 ☠️ 💀 👹 👺 👻 🕸️ 🕷️ 🦇 🐺 🩸 🧿 🪬 📿 🕯️ ⚰️ 🪦 🎲 🃏 🏆 🎖️ 🪓 ⛏️ 🔱 ⚜️ 🛐 ☯️ ☮️ ✡️ 🔯 🕉️ ⚛️"]
};

/* ── petites aides ── */
export const phoneOf = a => a?.flags?.[SYS]?.phone || {};
const isConv = j => !!j?.flags?.[SYS]?.phone;
export const convData = j => j?.flags?.[SYS]?.phone || {};
const mOf = p => p?.flags?.[SYS]?.m;
const idKey = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
/* identifiant stellaire : « XK-7Q3-92A » (lettres et chiffres sans ambiguïté), stable pour un acteur */
const ID_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genNumber(id) { const fnv = t => { let h = 2166136261; for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; return (h ^ (h >>> 15)) >>> 0; };
  let out = ""; for (let i = 0; i < 8; i++) { const h = fnv(`${id}#${i}`); out += i < 2 ? ID_ABC[h % 24] : ID_ABC[h % 32]; } return `${out.slice(0, 2)}-${out.slice(2, 5)}-${out.slice(5, 8)}`; }
export const numberOf = a => a ? (phoneOf(a).number || genNumber(a.id)) : "";
export const actorByNumber = num => { const d = idKey(num); if (d.length < 4) return null; return game.actors.find(a => ["character", "npc"].includes(a.type) && idKey(numberOf(a)) === d) || null; };
export const unlocked = (user, id) => !!user?.isGM || (user?.getFlag(SYS, "phoneUnlocks") || []).includes(id);
/** 1.52 : un fond est-il débloqué pour cet utilisateur ? (à l'unité, par pack ; « Aucun » est libre) */
export const wallOwned = (user, key) => { if (user?.isGM) return true; if (String(key).startsWith("img:")) return unlocked(user, "wall:custom"); const w = wallDef(key); if (!w) return false; return w.free || unlocked(user, `wall:${w.key}`) || unlocked(user, `wallpack:${w.pack}`); };
/** pour l'affichage : le fond est-il débloqué pour au moins un joueur propriétaire du téléphone (ou un PNJ du MJ) ? */
const wallOk = (a, key) => { if (!key) return true; const owners = game.users.filter(u => !u.isGM && a?.testUserPermission?.(u, "OWNER")); return !owners.length || owners.some(u => wallOwned(u, key)); };
const LOCK_ALIAS = { gold: "crown", abyss: "deep" };   /* anciens fonds de démarrage (1.51) */
/** fond affiché : slot « home » ou « lock » (le démarrage reprend l'accueil s'il n'a pas le sien), cadrage et voile */
function wallpaperOf(a, P, slot, conv = "") {
  let key = conv || ""; let fx = {};
  if (!key) { if (slot === "lock" && P.lockWall) { key = LOCK_ALIAS[P.lockWall] && !String(P.lockWall).startsWith("img:") ? LOCK_ALIAS[P.lockWall] : P.lockWall; fx = P.wallFx?.lock || {}; } else { key = P.wall || ""; fx = P.wallFx?.home || {}; } }
  if (!wallOk(a, key)) key = "";
  const img = String(key).startsWith("img:"); const def = img ? null : wallDef(key);
  const tone = img ? (fx.tone || "dark") : (def?.tone || "dark"); const veil = tone === "custom" ? Math.max(0, Math.min(90, Number(fx.veil ?? 35))) / 100 : tone === "light" ? .5 : img ? .25 : .12;
  const z = Math.max(100, Math.min(400, Number(fx.z) || 100)), x = Math.max(0, Math.min(100, Number(fx.x ?? 50))), y = Math.max(0, Math.min(100, Number(fx.y ?? 50)));
  const html = img ? `<i class="ph-wallp img"><img src="${esc(key.slice(4))}" style="object-position:${x}% ${y}%;transform-origin:${x}% ${y}%;transform:scale(${z / 100})"></i><i class="ph-veil${tone === "custom" ? " custom" : ""}" style="--wv:${veil}"></i>`
    : `<i class="ph-wallp${def?.anim ? ` lkw lkw-${esc(def.anim)}` : ""}" style="background:${esc(def?.css || "none")}"></i><i class="ph-veil${tone === "custom" ? " custom" : ""}" style="--wv:${veil}"></i>`;
  return { key, tone, html }; }
const vol = () => Math.max(0, Math.min(100, Number(game.settings.get(SYS, "phoneVol")) || 0)) / 100;
export function phSound(name, { loop = false, k = 1 } = {}) { const v = vol() * 0.6 * k; if (v <= 0) return null; try { const H = foundry.audio?.AudioHelper ?? AudioHelper; return H.play({ src: SND(name), volume: v, loop, autoplay: true }, false); } catch (e) { return null; } }
const stopSound = s => { try { (s?.then ? s.then(x => x?.stop?.()) : s?.stop?.()); } catch (e) {} };
const hhmm = ts => new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
function dayLabel(ts) { const d = new Date(ts), t = new Date(); const y = new Date(t); y.setDate(t.getDate() - 1); if (d.toDateString() === t.toDateString()) return "Aujourd'hui"; if (d.toDateString() === y.toDateString()) return "Hier"; return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); }
const shortTime = ts => { const d = new Date(ts), t = new Date(); return d.toDateString() === t.toDateString() ? hhmm(ts) : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }); };
/* heure du monde (calendrier du jeu) pour la barre d'état et l'écran verrouillé */
function worldClock() {
  /* le temps du monde n'avance pas (jamais réglé) : heure réelle */
  if (!(game.time?.worldTime > 0)) { const d = new Date(); return { time: hhmm(d.getTime()), date: d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) }; }
  try { const c = game.time?.components; if (c && Number.isFinite(c.hour)) { const cal = game.time.calendar; const mon = cal?.months?.values?.[c.month]?.name; const mName = mon ? game.i18n.localize(mon) : ""; return { time: `${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`, date: mName ? `${(c.dayOfMonth ?? c.day ?? 0) + 1} ${mName}${c.year != null ? " " + c.year : ""}` : "" }; } } catch (e) {}
  const s = Math.floor(game.time?.worldTime || 0); return { time: `${String(Math.floor(s / 3600) % 24).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}`, date: "" };
}
/* réseau : le MJ coupe le réseau d'une scène */
export const noSignal = () => !!game.scenes?.viewed?.getFlag?.(SYS, "noSignal");
/* propriétaires (joueurs) d'un acteur */
const ownersOf = a => game.users.filter(u => !u.isGM && a?.testUserPermission(u, "OWNER"));
/* le téléphone est-il « à moi » (je reçois ses notifications) : mes personnages ; pour le MJ, les PNJ sans joueur */
const mine = a => !!a && (game.user.isGM ? !a.hasPlayerOwner : a.isOwner);
/* acteurs dont je tiens le téléphone */
export const myPhones = () => game.actors.filter(a => ["character", "npc"].includes(a.type) && mine(a) && !a.getFlag?.("manhwa-sheet", "gmPhone"));

/* ── conversations ── */
export const allConvs = () => game.journal.filter(isConv);
export const convsOf = a => allConvs().filter(j => (convData(j).members || []).includes(a?.uuid));
/* 1.38 : liste triée mise en cache par conversation (invalidée à chaque page créée / modifiée / supprimée) */
const _msgCache = new Map(); let _msgVer = 0;
for (const h of ["createJournalEntryPage", "updateJournalEntryPage", "deleteJournalEntryPage"]) Hooks.on(h, p => { _msgCache.delete(p?.parent?.id); _msgVer++; });
export const messagesOf = j => { const c = _msgCache.get(j.id); if (c && c.n === j.pages.size) return c.l;
  const l = j.pages.contents.filter(p => mOf(p)).sort((x, y) => (mOf(x).ts || 0) - (mOf(y).ts || 0)); _msgCache.set(j.id, { n: j.pages.size, l }); return l; };
const visibleTo = (p, a) => { const m = mOf(p); return m && !m.hide?.[K(a.uuid)]; };
export function lastMsg(j, a) { const l = messagesOf(j).filter(p => visibleTo(p, a)); return l.at(-1) || null; }
export function unreadIn(j, a) { const r = phoneOf(a).read?.[j.id] || 0; const bl = phoneOf(a).blocked || []; return messagesOf(j).filter(p => { const m = mOf(p); return m.from !== a.uuid && (m.ts || 0) > r && !m.del && visibleTo(p, a) && !bl.includes(m.from); }).length; }
export const unreadTotal = a => a ? convsOf(a).filter(j => !(phoneOf(a).archived || []).includes(j.id)).reduce((n, j) => n + unreadIn(j, a), 0) : 0;
export const missedCalls = a => { const seen = phoneOf(a).callsSeen || 0; let n = 0; for (const j of convsOf(a)) for (const p of messagesOf(j)) { const m = mOf(p); if (m.kind === "call" && m.data?.status === "missed" && m.from !== a.uuid && m.ts > seen) n++; } return n; };
export function convTitle(j, a) {
  const d = convData(j); if (d.group) return d.name || "Groupe";
  const o = actorOf((d.members || []).find(u => u !== a?.uuid)); return o ? contactName(a, o) : "Inconnu";
}
export function convImg(j, a) { const d = convData(j); if (d.group) return d.img || ""; const o = actorOf((d.members || []).find(u => u !== a?.uuid)); return o ? avatarOf(o) : ""; }
export const avatarOf = o => phoneOf(o).avatar || o?.img || "icons/svg/mystery-man.svg";
/* nom affiché : le vrai nom si c'est un contact (ou pour le MJ), sinon le numéro */
/* 1.38 : les amis du Menu sont automatiquement des contacts du téléphone */
const _nrm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export function friendUuids(a) { const out = []; const walk = l => { for (const n of l || []) { if (n.folder) walk(n.children); else { const o = (n.uuid && actorOf(n.uuid)) || (n.name && game.actors.find(x => _nrm(x.name) === _nrm(n.name))); if (o && o.uuid !== a?.uuid) out.push(o.uuid); } } }; walk(a?.system?.carnet?.friends); return out; }
export const contactsOf = a => [...new Set([...(phoneOf(a).contacts || []), ...friendUuids(a)])];
export function contactName(viewer, o) { if (!o) return "Inconnu"; if (game.user.isGM || o.uuid === viewer?.uuid || contactsOf(viewer).includes(o.uuid)) return o.name; return numberOf(o); }
const isContact = (viewer, o) => contactsOf(viewer).includes(o?.uuid);

/* modifier le téléphone d'un acteur (par clés, sans écraser le reste) */
export async function setPhone(a, patch) {
  if (!a) return; const upd = {}; for (const [k, v] of Object.entries(patch)) upd[`flags.${SYS}.phone.${k}`] = v;
  if (a.isOwner) return a.update(upd); return gmDo("phSetActor", { uuid: a.uuid, upd });
}
async function markRead(a, j) {
  if (!a?.isOwner || (game.user.isGM && a.hasPlayerOwner)) return; const last = lastMsg(j, a); const ts = mOf(last)?.ts || 0;
  if (ts && (phoneOf(a).read?.[j.id] || 0) < ts) await a.update({ [`flags.${SYS}.phone.read.${j.id}`]: ts, [`flags.${SYS}.phone.readAt.${j.id}`]: Date.now() });
}

/* conversation à deux : on reprend l'existante */
export const findDirect = (a, b) => allConvs().find(j => { const d = convData(j); return !d.group && (d.members || []).length === 2 && d.members.includes(a.uuid) && d.members.includes(b.uuid); }) || null;
/* création par le MJ (identifiant choisi par le demandeur pour pouvoir l'ouvrir dès qu'il existe) */
/* identifiant déterministe pour une conversation à deux (1.25.0) : les deux téléphones qui s'écrivent au même instant demandent
 * la même conversation → une seule est créée, et chacun la retrouve par son identifiant */
const directId = (a, b) => { const str = [a, b].sort().join("|"); const AL = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let out = ""; for (let seed = 0; seed < 4; seed++) { let h = (0x811c9dc5 ^ (seed * 0x9e3779b9)) >>> 0; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; h = (h ^ (h >>> 13)) >>> 0; for (let k = 0; k < 4; k++) { out += AL[h % 62]; h = Math.floor(h / 62); } } return out; };
export async function newConv(members, { group = false, name = "", img = "" } = {}) {
  const id = !group && members.length === 2 ? directId(members[0], members[1]) : foundry.utils.randomID(16); await gmDo("phNewConv", { id, members, group, name, img, by: members[0] });
  return waitFor(() => game.journal.get(id), 6000);
}
const waitFor = (fn, ms) => new Promise(res => { const t0 = now(); const tick = () => { const v = fn(); if (v || now() - t0 > ms) return res(v || null); setTimeout(tick, 80); }; tick(); });
function ownership(members) { const o = { default: 0 }; for (const u of members) { const a = actorOf(u); for (const us of ownersOf(a)) o[us.id] = 3; } return o; }
async function phoneFolder() { let f = game.folders.find(x => x.type === "JournalEntry" && x.name === FOLDER && x.getFlag(SYS, "phone")); if (!f && game.user.isGM) f = await Folder.create({ name: FOLDER, type: "JournalEntry", color: "#1d3a6a", flags: { [SYS]: { phone: true } } }); return f; }
/* le demandeur doit être MJ ou posséder l'un des membres */
const canTouch = (j, from) => { const u = game.users.get(from); return !!u && (u.isGM || (convData(j).members || []).some(m => actorOf(m)?.testUserPermission(u, "OWNER"))); };
onGm("phNewConv", async ({ id, members, group, name, img }, from) => {
  const fu = game.users.get(from); if (game.journal.get(id) || !fu || (!fu.isGM && !(members || []).some(m => actorOf(m)?.testUserPermission(fu, "OWNER")))) return; const f = await phoneFolder(); members = [...new Set(members)].filter(u => actorOf(u));
  if (!group && members.length === 2) { const ex = findDirect(actorOf(members[0]), actorOf(members[1])); if (ex) return ex; }
  const title = group ? (name || "Groupe") : members.map(u => actorOf(u)?.name).join(" ↔ ");
  return JournalEntry.create({ _id: id, name: `📱 ${title}`, folder: f?.id ?? null, ownership: ownership(members), flags: { [SYS]: { phone: { members, group, name, img, created: now() } } } }, { keepId: true });
});
onGm("phMembers", async ({ id, members, add, remove, name, img }, from) => { const j = game.journal.get(id); if (!j || !canTouch(j, from)) return; const d = { ...convData(j) }; if (members) d.members = [...new Set(members)];
  /* ajouts / retraits appliqués à la liste actuelle (pas à celle que le demandeur voyait) : deux changements croisés ne s'effacent plus */
  if (add?.length || remove?.length) { const set = new Set(d.members || []); for (const u of add || []) if (actorOf(u)) set.add(u); for (const u of remove || []) set.delete(u); d.members = [...set]; }
  if (name !== undefined) d.name = name; if (img !== undefined) d.img = img;
  await j.update({ ownership: ownership(d.members), [`flags.${SYS}.phone.members`]: d.members, [`flags.${SYS}.phone.name`]: d.name || "", [`flags.${SYS}.phone.img`]: d.img || "", name: `📱 ${d.group ? (d.name || "Groupe") : d.members.map(u => actorOf(u)?.name).join(" ↔ ")}` }); });
onGm("phDelConv", async ({ id }, from) => {
  const j = game.journal.get(id); if (!j || !canTouch(j, from)) return; const d = convData(j);
  const ids = game.messages.filter(m => m.flags?.[SYS]?.phc === id || (!d.group && d.members?.length === 2 && (() => { const dm = m.flags?.[SYS]?.dm; return dm && d.members.includes(dm.from) && d.members.includes(dm.to); })())).map(m => m.id);
  if (ids.length) await ChatMessage.deleteDocuments(ids); await j.delete();
});
onGm("phSetActor", async ({ uuid, upd }, from) => { const a = actorOf(uuid); const u = game.users.get(from); if (!a || !u) return;
  if (!u.isGM && !a.testUserPermission(u, "OWNER")) return; const pre = `flags.${SYS}.phone.`; const ok = {}; for (const [k, v] of Object.entries(upd || {})) if (k.startsWith(pre)) ok[k] = v; if (Object.keys(ok).length) await a.update(ok); });
onGm("phUnlock", async ({ user, id, on = true }, from) => { if (!game.users.get(from)?.isGM) return; const u = game.users.get(user); if (!u) return; const l = new Set(u.getFlag(SYS, "phoneUnlocks") || []); on ? l.add(id) : l.delete(id); await u.setFlag(SYS, "phoneUnlocks", [...l]); });
/* déblocage d'un cosmétique (Boutique stellaire, outils MJ) */
export async function unlockCosmetic(userId, id, on = true) { if (game.user.isGM) { const u = game.users.get(userId); if (!u) return; const l = new Set(u.getFlag(SYS, "phoneUnlocks") || []); on ? l.add(id) : l.delete(id); return u.setFlag(SYS, "phoneUnlocks", [...l]); } return gmDo("phUnlock", { user: userId, id, on }); }

/* envoi d'un message (en file d'attente s'il n'y a pas de réseau) */
export async function sendMessage(a, j, m) {
  const data = { from: a.uuid, ts: now(), kind: "msg", text: "", img: "", fx: "", ...m };
  if (noSignal() && data.kind !== "call") { if (a.isOwner) await actorLock(a, () => setPhone(a, { pending: [...(phoneOf(a).pending || []), { conv: j.id, m: data }] })); else await setPhone(a, { pending: [...(phoneOf(a).pending || []), { conv: j.id, m: data }] }); ui.notifications.warn("Pas de réseau : le message partira dès que le réseau reviendra."); return null; }
  const page = await j.createEmbeddedDocuments("JournalEntryPage", [{ name: String(data.ts), type: "text", text: { format: 1, content: "" }, flags: { [SYS]: { m: data } } }]);
  /* plus de copie dans le chat (1.26.1) : la messagerie reste dans le téléphone */
  return page?.[0] ?? null;
}
/* le réseau revient : la file d'attente part */
async function flushPending() {
  if (noSignal()) return;
  /* un seul client vide les files : le MJ actif (il possède tous les personnages) ; avant, chaque propriétaire du même personnage — et chaque MJ — renvoyait les messages */
  if (game.user !== activeGM()) return;
  for (const a of game.actors.filter(x => (phoneOf(x).pending || []).length)) {
    const q = await actorLock(a, async () => { const q0 = phoneOf(a).pending || []; if (q0.length) await setPhone(a, { pending: [] }); return q0; });
    for (const it of q) { const j = game.journal.get(it.conv); if (j) await j.createEmbeddedDocuments("JournalEntryPage", [{ name: String(it.m.ts), type: "text", text: { format: 1, content: "" }, flags: { [SYS]: { m: { ...it.m, queued: true } } } }]); }
    if (q.length) ui.notifications.info(`Réseau retrouvé : ${q.length} message(s) envoyé(s).`);
  }
}
Hooks.on("canvasReady", () => { flushPending(); refreshViews(); });
Hooks.on("updateScene", (s, ch) => { if (foundry.utils.hasProperty(ch, `flags.${SYS}.noSignal`) && s === game.scenes.viewed) { flushPending(); refreshViews(); } });

/* ── reprise des anciens messages (messages de chat chuchotés) : une fois, par le MJ ── */
async function migrate() {
  if (!game.user.isGM || game.user !== (game.users.activeGM ?? game.user)) return; if ((game.settings.get(SYS, "phoneMigV") || 0) >= 1) return;
  const pairs = new Map();
  for (const m of game.messages) { const d = m.flags?.[SYS]?.dm; if (!d?.from || !d?.to) continue; const key = [d.from, d.to].sort().join("|"); if (!pairs.has(key)) pairs.set(key, []); pairs.get(key).push({ m, d }); }
  let n = 0;
  for (const [key, list] of pairs) {
    const [x, y] = key.split("|"); if (!actorOf(x) || !actorOf(y)) continue;
    let j = findDirect(actorOf(x), actorOf(y)); if (!j) { const id = foundry.utils.randomID(16); j = await HANDLERS_LOCAL.phNewConv({ id, members: [x, y], group: false }); }
    if (!j) continue;
    const pages = list.sort((a, b) => a.m.timestamp - b.m.timestamp).map(({ m, d }) => ({ name: String(m.timestamp), type: "text", text: { format: 1, content: "" }, flags: { [SYS]: { m: { from: d.from, text: d.text || "", img: d.img || "", fx: d.fx || "", kind: "msg", ts: m.timestamp, legacy: m.id } } } }));
    for (let i = 0; i < pages.length; i += 100) await j.createEmbeddedDocuments("JournalEntryPage", pages.slice(i, i + 100)); n += pages.length;
  }
  await game.settings.set(SYS, "phoneMigV", 1); if (n) ui.notifications.info(`Téléphone : ${n} ancien(s) message(s) repris dans les conversations.`);
}
const HANDLERS_LOCAL = { phNewConv: async (d) => { await gmDo("phNewConv", d); return game.journal.get(d.id); } };

/* ══════════════════════════ interface ══════════════════════════ */
const VIEWS = new Set();
let REFRESH_T = null;
export function refreshViews() { clearTimeout(REFRESH_T); REFRESH_T = setTimeout(() => { for (const v of VIEWS) { if (!v.el?.isConnected) { if (v._seen || !v.el) VIEWS.delete(v); continue; } v.render(); }
  /* pastille de l'onglet Messagerie dans les menus ouverts */
  for (const app of foundry.applications.instances.values()) { const a = app.actor; const nav = app.element?.querySelector?.('.ms-mnav a[data-tab="mail"]'); if (!a || !nav) continue; const n = phoneBadge(a); let b = nav.querySelector(".badge");
    if (!n) b?.remove(); else { if (!b) { b = document.createElement("b"); b.className = "badge"; nav.appendChild(b); } b.textContent = String(n); } } }, 40); }
const TYPING = {};                       /* conv → { actorUuid: jusqu'à } */
const typingIn = (jid, me) => Object.entries(TYPING[jid] || {}).filter(([u, t]) => u !== me && t > now()).map(([u]) => actorOf(u)).filter(Boolean);
const recent = () => { try { return JSON.parse(localStorage.getItem("ms-ph-recent") || "[]"); } catch (e) { return []; } };
const pushRecent = e => { try { const l = [e, ...recent().filter(x => x !== e)].slice(0, 32); localStorage.setItem("ms-ph-recent", JSON.stringify(l)); } catch (err) {} };
const flatTree = (nodes, out = []) => { for (const n of nodes || []) { if (n.folder) flatTree(n.children, out); else out.push(n); } return out; };
/* ── applis : de base (toujours là), du téléphone (Store) et raccourcis du Menu (Store) ── */
const CORE_APPS = { messages: ["Messages", "fa-comment-dots", "#2fd27a"], contacts: ["Contacts", "fa-address-book", "#4fa8ff"], calls: ["Appels", "fa-phone", "#35c46a"], settings: ["Réglages", "fa-gear", "#8e9ab8"], store: ["Store", "fa-bag-shopping", "#7a6bff"] };
const NATIVE_APPS = { gallery: ["Galerie", "fa-images", "#ff8a3c", "Toutes les images échangées dans tes conversations."], clock: ["Horloge", "fa-clock", "#38c8ff", "L'heure et la date du monde, en grand."], calc: ["Calculatrice", "fa-calculator", "#ff5d8f", "Pour compter le butin sans se tromper."], internode: ["Inter-node", "fa-circle-nodes", "#2ee6ff", "Le réseau des agents : contrats d'anomalies de rang F à S."],
  weather: ["Météo", "fa-cloud-sun", "#4fc3ff", "Le temps qu'il fait là où se trouve ton groupe, avec les degrés et la saison."], calendar: ["Calendrier", "fa-calendar-days", "#ff6b6b", "Le mois en cours de ton groupe, avec ses fêtes et événements."],
  timer: ["Minuteur", "fa-stopwatch", "#ffb23d", "Chronomètre et minuteur, avec une sonnerie à la fin."], share: ["Share", "fa-share-nodes", "#2ee6a8", "Partage ton numéro à un joueur connecté : il peut t'ajouter en un clic."] };
const NO_MENU_APP = new Set(["mail", "notes", "settings"]);
const BASE_DOCK = ["messages", "calls", "contacts"];
/** toutes les applis connues (selon ce que le joueur voit du Menu) */
export function appDefs(actor = null) {
  const out = {}; for (const [k, [n, ic, c]] of Object.entries(CORE_APPS)) out[k] = { id: k, name: n, icon: ic, color: c, core: true };
  if (game.user.isGM) out.gm = { id: "gm", name: "MJ", icon: "fa-crown", color: "#f5c518", core: true };
  for (const [k, [n, ic, c, d]] of Object.entries(NATIVE_APPS)) out[k] = { id: k, name: n, icon: ic, color: c, desc: d, kind: "native" };
  const hide = game.user.isGM ? new Set() : new Set([...(game.user.getFlag(SYS, "menuHide") || []), ...(actor?.getFlag?.(SYS, "menuHide") || [])]);   /* comme visibleTabs : masqués pour ce joueur ou pour cette fiche */
  void hide;   /* 1.37 : plus de raccourcis du Menu dans le téléphone (Guilde, Quêtes… sont déjà dans le Menu) */
  return out;
}
const storeCfg = () => { try { return game.settings.get(SYS, "phoneStore") || {}; } catch (e) { return {}; } };
/** règle du Store pour une appli : libre, sur demande au MJ, ou masquée */
export const storeRule = d => storeCfg()[d.id] || (d.kind === "native" ? "free" : "ask");
const canInstall = (d, user = game.user) => d.core || user.isGM || (storeRule(d) !== "hidden" && (storeRule(d) === "free" || unlocked(user, `app:${d.id}`)));
const installedIds = a => { const P = phoneOf(a); return Array.isArray(P.apps) ? P.apps : ["gallery"]; };
/** applis présentes sur l'écran d'accueil (grille et dock), dans l'ordre choisi */
function homeLayout(a) {
  const defs = appDefs(a); const have = new Set(Object.values(defs).filter(d => d.core || (installedIds(a).includes(d.id) && canInstall(d))).map(d => d.id));
  const P = phoneOf(a); const dock = (Array.isArray(P.dock) ? P.dock : BASE_DOCK).filter(id => have.has(id)).slice(0, 4);
  const order = (Array.isArray(P.home) ? P.home : []).filter(id => have.has(id) && !dock.includes(id));
  for (const id of have) if (!order.includes(id) && !dock.includes(id)) order.push(id);
  return { defs, grid: order, dock };
}

const LOCK_AFTER = 10 * 60 * 1000;

export class PhoneView {
  /** getActor : le personnage dont on tient le téléphone ; opts.menu : la fenêtre du Menu qui l'héberge */
  constructor(getActor, opts = {}) { this.getActor = getActor; this.opts = opts; this.s = { scr: "lock", conv: null, view: null, cat: "recent", pop: null, draft: "", reply: null, fx: "", img: null, limit: PAGE, q: "", arch: false, ctx: null, contact: null, info: false, seen: 0 }; this.last = 0; }
  get actor() { return (this.s.view && actorOf(this.s.view)) || this.getActor(); }
  get conv() { return this.s.conv ? game.journal.get(this.s.conv) : null; }
  mount(el) {
    this.el = el; VIEWS.add(this); if (now() - this.last > LOCK_AFTER && this.s.scr !== "lock" && !this.s.conv) this.s.scr = "lock"; this.last = now();
    el.addEventListener("click", ev => { if (this._lpDone) { this._lpDone = false; ev.preventDefault(); ev.stopPropagation(); return; } if (this._swiped && now() - this._swiped < 300) { ev.preventDefault(); ev.stopPropagation(); return; } const t = ev.target.closest("[data-ph]"); if (!t || !el.contains(t)) { if (this.s.ctx || this.s.pop) { if (!ev.target.closest(".ph-pop, .ph-ctx")) { this.s.ctx = null; this.s.pop = null; this.render(); } } return; } ev.preventDefault(); ev.stopPropagation(); this.last = now(); this.act(t.dataset.ph, t, ev); });
    el.addEventListener("mousedown", ev => { if (ev.target.closest?.(".ph-pop [data-ph]")) ev.preventDefault(); });
    /* 1.37 : on retient la position de défilement de chaque zone de l'écran (même si le Menu se redessine entièrement) */
    el.addEventListener("scroll", ev => { const t = ev.target; if (t?.closest?.(".ph-body") && !t.classList?.contains("ph-msgs")) (this._scrollMap ||= {})[t.className] = t.scrollTop; }, true);   /* cliquer un émoji ne retire pas le focus de la zone de saisie */
    el.addEventListener("contextmenu", ev => { const t = ev.target.closest("[data-ctx]"); if (!t) return; ev.preventDefault(); this.openCtx(t); });
    let lp = null; el.addEventListener("pointerdown", ev => { const t = ev.target.closest("[data-ctx]"); if (!t || ev.button !== 0) return; lp = setTimeout(() => { lp = null; this._lpDone = true; this.openCtx(t); }, 520); });
    for (const e of ["pointerup", "pointerleave", "pointercancel"]) el.addEventListener(e, () => { clearTimeout(lp); lp = null; });
    this._ro?.disconnect(); let rt = null; this._ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (this.s.scr === "home" && this.el === el && el.isConnected && this.measureHome()) this.render(); }, 120); }); this._ro.observe(el);
    this.render();
  }
  openCtx(t) { this.s.ctx = { kind: t.dataset.ctx, id: t.dataset.id }; this.s.pop = null; this.render(); }
  /* rendu complet du téléphone (le brouillon et la position de lecture sont gardés) */
  render() {
    const el = this.el; if (!el) return; if (!el.isConnected) { /* fenêtre pas encore posée dans la page (premier rendu) : on réessaie */ if ((this._wait = (this._wait || 0) + 1) < 40) requestAnimationFrame(() => this.render()); return; } this._wait = 0; this._seen = true; VIEWS.add(this); const a = this.actor;
    const ta = el.querySelector("textarea[data-phtext]"); if (ta) this.s.draft = ta.value; const focus = document.activeElement === ta; const caret = ta?.selectionStart;
    const box = el.querySelector(".ph-msgs"); const atBottom = !box || box.scrollHeight - box.scrollTop - box.clientHeight < 60; const prevTop = box?.scrollTop;
    const q = el.querySelector("input[data-phq]"); const qFocus = document.activeElement === q;
    /* même écran qu'avant : pas d'animation d'entrée et on garde la position de défilement (changer un fond, un cadre…) */
    const vk = `${this.s.scr}|${this.s.conv || ""}`; const same = this._vk === vk; this._anim = { body: !same, sheet: !!this.s.info && !(same && this._info), pop: this.s.pop && this.s.pop !== this._pop, ctx: !!this.s.ctx && !this._ctx };
    const keep = same ? [...el.querySelectorAll(".ph-body, .ph-body *, .ph-sheet-b, .ph-pop *")].filter(x => x.scrollTop > 0 && x !== box).map(x => [x.className, x.scrollTop]) : [];
    this._vk = vk; this._info = !!this.s.info; this._pop = this.s.pop; this._ctx = !!this.s.ctx;
    el.innerHTML = a ? this.html(a) : `<div class="ph"><div class="ph-screen"><div class="ph-empty"><i class="fa-solid fa-mobile-screen"></i><p>Aucun personnage : choisis ton personnage dans la configuration du joueur.</p></div></div></div>`;
    if (!a) return;
    if (!same) this._scrollMap = {};
    const restore = same ? [...Object.entries(this._scrollMap || {}), ...keep] : keep;
    for (const [cls, top] of restore) { const t = [...el.querySelectorAll(".ph-body, .ph-body *, .ph-sheet-b, .ph-pop *")].find(x => x.className === cls); if (t) t.scrollTop = top; }
    const nb = el.querySelector(".ph-msgs"); if (nb && this._moreAnchor) { const A = this._moreAnchor; const fix = () => { const e = nb.querySelector(`.ph-msg[data-id="${A.id}"]`); if (e) nb.scrollTop += e.getBoundingClientRect().top - nb.getBoundingClientRect().top - A.off; }; fix(); requestAnimationFrame(() => { fix(); requestAnimationFrame(fix); }); this._moreAnchor = null; this._stick = false; this._scrollEnd = false; nb.addEventListener("scroll", () => { this._stick = nb.scrollHeight - nb.scrollTop - nb.clientHeight < 60; }); } else if (nb) { if (atBottom || this._scrollEnd) { nb.scrollTop = nb.scrollHeight; nb.querySelectorAll("img").forEach(i => i.addEventListener("load", () => { if (this._stick) nb.scrollTop = nb.scrollHeight; }, { once: true })); this._stick = true; } else { nb.scrollTop = prevTop; this._stick = false; } this._scrollEnd = false; nb.addEventListener("scroll", () => { this._stick = nb.scrollHeight - nb.scrollTop - nb.clientHeight < 60; }); }
    const t2 = el.querySelector("textarea[data-phtext]");
    if (t2) {
      t2.addEventListener("keydown", ev => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); this.send(); } });
      t2.addEventListener("input", () => { this.s.draft = t2.value; t2.style.height = "auto"; t2.style.height = Math.min(110, t2.scrollHeight) + "px"; typingPing(this.conv, this.actor); });
      t2.addEventListener("paste", ev => { const f = [...(ev.clipboardData?.files || [])].find(x => x.type.startsWith("image/")); if (f) { ev.preventDefault(); this.attach(f); } });
      if (focus || this._focus) { t2.focus(); const c = caret ?? t2.value.length; t2.setSelectionRange(c, c); this._focus = false; }
    }
    const tq2 = el.querySelector("input[data-phtq]"); if (tq2) { tq2.addEventListener("input", () => { clearTimeout(this._tqT); this._tqT = setTimeout(() => { this.s.tq = tq2.value; this._tqCaret = tq2.selectionStart; this._tqFocus = true; this._scrollEnd = true; this.render(); }, 180); }); if (this._tqFocus) { tq2.focus(); const c = this._tqCaret ?? tq2.value.length; tq2.setSelectionRange(c, c); this._tqFocus = false; } }
    const q2 = el.querySelector("input[data-phq]"); if (q2) { q2.addEventListener("input", () => { this.s.q = q2.value; this._qCaret = q2.selectionStart; this.render(); }); if (qFocus) { q2.focus(); q2.setSelectionRange(this._qCaret ?? q2.value.length, this._qCaret ?? q2.value.length); } }
    el.querySelectorAll("input[data-phset], select[data-phset]").forEach(i => i.addEventListener("change", () => this.setting(i)));
    el.querySelector("input[data-phvol]")?.addEventListener("input", ev => { game.settings.set(SYS, "phoneVol", Number(ev.target.value)); ev.target.nextElementSibling.textContent = ev.target.value + " %"; });
    el.querySelector("input[data-phvol]")?.addEventListener("change", () => phSound(phoneOf(this.actor).notif || "notif_ping"));
    const fi = el.querySelector("input[data-phfile]"); fi?.addEventListener("change", () => { const f = fi.files?.[0]; if (f) this.attach(f); });
    const thr = el.querySelector(".ph-thread"); thr?.addEventListener("dragover", ev => { if ([...(ev.dataTransfer?.items || [])].some(i => i.type.startsWith("image/"))) ev.preventDefault(); });
    thr?.addEventListener("drop", ev => { const f = [...(ev.dataTransfer?.files || [])].find(x => x.type.startsWith("image/")); if (f) { ev.preventDefault(); ev.stopPropagation(); this.attach(f); } });
    if (this.s.scr === "home") { if (this.measureHome()) return this.render(); this.bindHome(); }
    if (this.s.scr === "clock" && !this._tick) this._tick = setTimeout(() => { this._tick = null; if (this.s.scr === "clock") this.render(); }, 1000);
    if (this.s.scr === "timer" && this.s.tm?.run) this.tickTimer();
    if (this.s.scr === "thread" && this.conv) markRead(a, this.conv);
    if (this.s.scr === "calls" && missedCalls(a)) setPhone(a, { callsSeen: now() });
  }

  html(a) {
    const P = phoneOf(a); const theme = P.theme || "neon"; const fr = P.frame && unlocked(game.user, `frame:${P.frame}`) ? P.frame : "";
    const wp = wallpaperOf(a, P, this.s.scr === "lock" ? "lock" : "home", this.s.scr === "thread" && this.conv ? P.walls?.[this.conv.id] : "");
    const body = { lock: () => this.lock(a), home: () => this.home(a), messages: () => this.messages(a), thread: () => this.thread(a), contacts: () => this.contacts(a), contact: () => this.contactCard(a), calls: () => this.calls(a), gallery: () => this.gallery(a), settings: () => this.settings(a), gm: () => this.gm(a), store: () => this.store(a), clock: () => this.clock(a), calc: () => this.calc(a), internode: () => this.internode(a), weather: () => this.weatherApp(a), calendar: () => this.calendarApp(a), timer: () => this.timerApp(a), share: () => this.shareApp(a) }[this.s.scr]?.() ?? this.home(a);
    const screen = `<div class="ph-screen">${wp.html}${this.status(a)}<div class="ph-body ph-s-${this.s.scr}${this._anim?.body ? " ph-anim" : ""}">${body}</div>${this.pop(a)}${this.ctx(a)}</div>`;
    return `<div class="ph ph-t-${theme}${fr ? ` ph-framed ph-fr-${fr}` : ""}${game.user.isGM && this.s.view ? " ph-spy" : ""}" style="${P.bubble ? `--ph-bub:${esc(P.bubble)};` : ""}">${fr ? `<div class="ph-bezel">${screen}</div>` : screen}</div>`;
  }
  /* 1.53 : bouton de la barre d'état — dans le Menu : sortir le téléphone en fenêtre ; en fenêtre : la réduire dans la barre du bas */
  winBtn() { const win = !!this.opts.win; if (!win && !this.opts.menu) return "";
    return `<a class="ph-winbtn" data-ph="phWin" title="${win ? "Réduire le téléphone (barre du bas)" : "Ouvrir le téléphone en fenêtre"}"><i class="fa-solid ${win ? "fa-window-minimize" : "fa-up-right-from-square"}"></i></a>`; }
  status(a) {
    const c = worldClock(); const P = phoneOf(a); const sig = noSignal();
    return `<div class="ph-status"><span class="l">${esc(c.time)}${game.user.isGM && this.s.view ? ` <em class="spy"><i class="fa-solid fa-eye"></i> ${esc(a.name)}</em>` : ""}</span><span class="r">${P.dnd ? '<i class="fa-solid fa-moon" title="Silencieux"></i>' : ""}${(P.pending || []).length ? `<i class="fa-solid fa-clock-rotate-left" title="${P.pending.length} message(s) en attente"></i>` : ""}${sig ? '<span class="ph-link off" title="Lien astral rompu : les messages partiront au retour du lien"><i></i><i></i><i></i><em>Lien rompu</em></span>' : '<span class="ph-link" title="Lien astral : stable"><i></i><i></i><i></i></span>'}<span class="ph-core" title="Noyau d'éther"><i></i></span>${this.winBtn()}</span></div>`;
  }
  bar(title, back = "home", extra = "") { return `<header class="ph-bar"><a class="bk" data-ph="go" data-to="${back}" title="Retour"><i class="fa-solid fa-chevron-left"></i></a><b>${title}</b><span class="sp"></span>${extra}</header>`; }

  /* ── écran verrouillé ── */
  lock(a) {
    const c = worldClock(); const n = convsOf(a).map(j => ({ j, u: unreadIn(j, a), l: lastMsg(j, a) })).filter(x => x.u).sort((x, y) => (mOf(y.l)?.ts || 0) - (mOf(x.l)?.ts || 0)).slice(0, 4); const mc = missedCalls(a);
    return `<div class="ph-lock" data-ph="unlock"><i class="fa-solid fa-lock ph-lk-ic"></i><div class="ph-lk-time">${esc(c.time)}</div><div class="ph-lk-date">${esc(c.date || a.name)}</div>
      <div class="ph-lk-notifs">${mc ? `<div class="ph-lk-n call"><i class="fa-solid fa-phone-slash"></i><div><b>Appels manqués</b><small>${mc} appel${mc > 1 ? "s" : ""} manqué${mc > 1 ? "s" : ""}</small></div></div>` : ""}${n.map(x => `<div class="ph-lk-n" data-ph="open" data-id="${x.j.id}"><img src="${esc(convImg(x.j, a))}"><div><b>${esc(convTitle(x.j, a))}</b><small>${esc(preview(x.l, a))}</small></div><em>${x.u}</em></div>`).join("")}</div>
      <div class="ph-lk-hint"><i class="fa-solid fa-chevron-up"></i>Toucher pour déverrouiller</div></div>`;
  }
  /* ── écran d'accueil : pages d'applis (glisser, molette, points), dock, mode « modifier » (réordonner, trier, désinstaller) ── */
  home(a) {
    const P = phoneOf(a); const badge = { messages: unreadTotal(a), calls: missedCalls(a), store: game.user.isGM ? 0 : 0 }; const { defs, grid, dock } = homeLayout(a); const ed = this.s.edit;
    const cap = Math.max(4, this._cap || 16); const pages = []; for (let i = 0; i < grid.length; i += cap) pages.push(grid.slice(i, i + cap)); if (!pages.length || ed) pages.push([]);
    const pg = this.s.page = Math.max(0, Math.min(this.s.page || 0, pages.length - 1));
    const icon = (id, inDock) => { const d = defs[id]; if (!d) return ""; const rm = ed && !d.core; return `<a class="ph-app" data-ph="app" data-app="${esc(id)}" style="--c:${esc(d.color)}" title="${esc(d.name)}"><span class="ic"><i class="fa-solid ${esc(d.icon)}"></i>${badge[id] && !ed ? `<b class="bd">${badge[id]}</b>` : ""}${rm ? `<em class="rm" data-ph="uninstall" data-app="${esc(id)}" title="Désinstaller"><i class="fa-solid fa-minus"></i></em>` : ""}</span>${inDock ? "" : `<small>${esc(d.name)}</small>`}</a>`; };
    return `<div class="ph-home${ed ? " edit" : ""}">
      ${ed ? `<div class="ph-edbar"><a class="ph-btn small" data-ph="sortApps" data-k="az"><i class="fa-solid fa-arrow-down-a-z"></i> A → Z</a><a class="ph-btn small" data-ph="sortApps" data-k="color"><i class="fa-solid fa-palette"></i> Couleur</a><a class="ph-btn small" data-ph="sortApps" data-k="reset"><i class="fa-solid fa-rotate-left"></i> Défaut</a><span class="sp"></span><a class="ph-btn small ok" data-ph="editHome"><i class="fa-solid fa-check"></i> Terminé</a></div>`
        : `<div class="ph-me"><img src="${esc(avatarOf(a))}" data-ph="go" data-to="settings"><div data-ph="go" data-to="settings"><b>${esc(a.name)}</b><small><i class="fa-solid fa-fingerprint"></i> ${esc(numberOf(a))}${P.status ? ` · ${esc(P.status)}` : ""}</small></div><a class="ed" data-ph="editHome" title="Modifier l'écran d'accueil (ou appui long sur une appli)"><i class="fa-solid fa-table-cells"></i></a></div>`}
      <div class="ph-pages" data-pages><a class="ph-edge l" data-edge="-1"></a><a class="ph-edge r" data-edge="1"></a><div class="ph-track" style="transform:translateX(${-pg * 100}%)">${pages.map((p, i) => `<div class="ph-page" data-page="${i}"><div class="ph-apps" style="--cols:${this._cols || 4};--rows:${this._rows || 4}">${p.map(id => icon(id)).join("")}</div></div>`).join("")}</div></div>
      ${pages.length > 1 ? `<div class="ph-dots">${pages.map((p, i) => `<a class="${i === pg ? "on" : ""}" data-ph="page" data-i="${i}"></a>`).join("")}</div>` : `<div class="ph-dots"></div>`}
      <div class="ph-dock" data-dock>${dock.map(id => icon(id, true)).join("") || (ed ? `<span class="ph-hint">Glisse des applis ici</span>` : "")}</div></div>`;
  }
  /* mesure la place pour décider combien d'icônes tiennent par page */
  measureHome() {
    const box = this.el?.querySelector("[data-pages]"); if (!box) return false; const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return false;
    const cols = Math.max(3, Math.min(8, Math.floor(w / 86))), rows = Math.max(2, Math.floor(h / 96)); const cap = cols * rows;
    if (cap !== this._cap || cols !== this._cols) { this._cap = cap; this._cols = cols; this._rows = rows; return true; } return false;
  }
  bindHome() {
    const el = this.el; const box = el.querySelector("[data-pages]"); if (!box) return; const track = box.querySelector(".ph-track"); const n = box.querySelectorAll(".ph-page").length;
    const show = i => { this.s.page = Math.max(0, Math.min(n - 1, i)); track.style.transition = ""; track.style.transform = `translate3d(${-this.s.page * 100}%, 0, 0)`; el.querySelectorAll(".ph-dots a").forEach((d, k) => d.classList.toggle("on", k === this.s.page)); };
    let wt = 0; box.addEventListener("wheel", ev => { const d = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY; if (Math.abs(d) < 20 || now() - wt < 450) return; ev.preventDefault(); wt = now(); show(this.s.page + Math.sign(d)); }, { passive: false });
    /* balayage à la souris ou au doigt (hors mode modifier) */
    let sx = null, moved = false; box.addEventListener("pointerdown", ev => { if (this.s.edit || ev.button !== 0) return; sx = ev.clientX; moved = false; });
    /* 1.37 : le suivi du doigt est calé sur l'affichage (une écriture par image) et capte le pointeur même hors du cadre */
    let raf = 0, lastDx = 0; box.addEventListener("pointermove", ev => { if (sx == null) return; lastDx = ev.clientX - sx; if (Math.abs(lastDx) > 8 && !moved) { moved = true; track.style.transition = "none"; try { box.setPointerCapture(ev.pointerId); } catch (e) {} }
      if (moved && !raf) raf = requestAnimationFrame(() => { raf = 0; if (sx != null) track.style.transform = `translate3d(calc(${-this.s.page * 100}% + ${lastDx}px), 0, 0)`; }); });
    const up = ev => { if (sx == null) return; const dx = ev.clientX - sx; sx = null; if (moved) { this._swiped = now(); show(this.s.page + (dx < -50 ? 1 : dx > 50 ? -1 : 0)); } };
    box.addEventListener("pointerup", up); box.addEventListener("pointerleave", up);
    /* appui long : mode modifier */
    let lp = null; el.querySelector(".ph-home")?.addEventListener("pointerdown", ev => { if (this.s.edit || ev.button !== 0 || ev.target.closest(".ph-me, .ph-dots")) return; lp = setTimeout(() => { if (moved) return; this._lpDone = true; this.s.edit = true; this.render(); }, 600); });
    for (const e of ["pointerup", "pointerleave", "pointermove"]) el.querySelector(".ph-home")?.addEventListener(e, ev => { if (e === "pointermove" && sx != null && Math.abs(ev.clientX - sx) < 8) return; clearTimeout(lp); });
    if (!this.s.edit) return;
    /* glisser pour ranger (souris ou doigt) : l'icône suit le pointeur, on la lâche sur une appli, une page ou le dock */
    const clear = () => el.querySelectorAll(".drop-b, .drop-a, .drop-in").forEach(x => x.classList.remove("drop-b", "drop-a", "drop-in"));
    el.querySelectorAll(".ph-page .ph-app, .ph-dock .ph-app").forEach(ic => ic.addEventListener("pointerdown", ev => {
      if (ev.button !== 0 || ev.target.closest(".rm")) return; ev.preventDefault(); const id = ic.dataset.app; const x0 = ev.clientX, y0 = ev.clientY; let ghost = null, flip = null, flipDir = 0, tgt = null;
      const move = e => {
        if (!ghost) { if (Math.hypot(e.clientX - x0, e.clientY - y0) < 5) return; const r = ic.getBoundingClientRect(); ghost = ic.cloneNode(true); ghost.classList.add("ph-ghost"); Object.assign(ghost.style, { width: `${r.width}px`, left: "0", top: "0" }); el.querySelector(".ph").appendChild(ghost); ic.classList.add("dragging"); ghost._dx = x0 - r.left; ghost._dy = y0 - r.top; }
        const host = el.querySelector(".ph").getBoundingClientRect(); ghost.style.transform = `translate(${e.clientX - host.left - ghost._dx}px, ${e.clientY - host.top - ghost._dy}px)`;
        ghost.style.visibility = "hidden"; const under = document.elementFromPoint(e.clientX, e.clientY); ghost.style.visibility = "";
        clear(); tgt = null; const edge = under?.closest?.(".ph-edge"); const dir = edge ? Number(edge.dataset.edge) : 0;
        if (dir !== flipDir) { clearTimeout(flip); flip = null; flipDir = dir; } if (dir && !flip) flip = setTimeout(() => { flip = null; flipDir = 0; show(this.s.page + dir); }, 500);
        const app = under?.closest?.(".ph-app"); const dock = under?.closest?.("[data-dock]"); const page = under?.closest?.(".ph-page");
        if (app && app !== ic && el.contains(app)) { const r = app.getBoundingClientRect(); const after = e.clientX > r.left + r.width / 2; app.classList.add(after ? "drop-a" : "drop-b"); tgt = { target: app.dataset.app, after, dock: !!app.closest("[data-dock]") }; }
        else if (dock) { dock.classList.add("drop-in"); tgt = { target: null, after: true, dock: true }; }
        else if (page) { tgt = { target: null, after: true, dock: false, page: Number(page.dataset.page) }; }
      };
      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); clearTimeout(flip); clear(); ic.classList.remove("dragging");
        if (!ghost) return; ghost.remove(); this._lpDone = true; setTimeout(() => { this._lpDone = false; }, 50); if (tgt) this.moveApp(id, tgt.target, tgt.after, tgt.dock, tgt.page ?? null); };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    }));
  }
  /* ── liste des conversations ── */
  messages(a) {
    const P = phoneOf(a); const arch = P.archived || [], pins = P.pinned || [], muted = P.muted || {}; const q = this.s.q.trim().toLowerCase();
    let list = convsOf(a).map(j => ({ j, l: lastMsg(j, a), u: unreadIn(j, a) }));
    const nArch = list.filter(x => arch.includes(x.j.id)).length;
    list = list.filter(x => this.s.arch ? arch.includes(x.j.id) : !arch.includes(x.j.id));
    if (q) list = list.filter(x => convTitle(x.j, a).toLowerCase().includes(q) || messagesOf(x.j).some(p => String(mOf(p).text || "").toLowerCase().includes(q)));
    list.sort((x, y) => (pins.includes(y.j.id) - pins.includes(x.j.id)) || ((mOf(y.l)?.ts || convData(y.j).created || 0) - (mOf(x.l)?.ts || convData(x.j).created || 0)));
    const rows = list.map(({ j, l, u }) => `<div class="ph-row${u ? " unread" : ""}" data-ph="open" data-id="${j.id}" data-ctx="conv"><img src="${esc(convImg(j, a))}"><div class="t"><b>${convData(j).group ? '<i class="fa-solid fa-users"></i> ' : ""}${esc(convTitle(j, a))}</b><small>${typingIn(j.id, a.uuid).length ? `<span class="typ">écrit…</span>` : esc(preview(l, a))}</small></div><div class="m"><em>${l ? shortTime(mOf(l).ts) : ""}</em><span>${pins.includes(j.id) ? '<i class="fa-solid fa-thumbtack"></i>' : ""}${muted[j.id] ? '<i class="fa-solid fa-bell-slash"></i>' : ""}${u ? `<b class="bd">${u}</b>` : ""}</span></div></div>`).join("");
    return this.bar(this.s.arch ? "Archivées" : "Messages", this.s.arch ? "messages-main" : "home", `<a data-ph="newGroup" title="Nouveau groupe"><i class="fa-solid fa-users-rectangle"></i></a><a data-ph="newMsg" title="Nouveau message"><i class="fa-solid fa-pen-to-square"></i></a>`)
      + `<div class="ph-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-phq value="${esc(this.s.q)}" placeholder="Rechercher"></div><div class="ph-list">${rows || `<div class="ph-none"><i class="fa-regular fa-comments"></i><p>${q ? "Rien trouvé." : this.s.arch ? "Aucune conversation archivée." : "Aucune conversation. Écris à un contact !"}</p></div>`}</div>`
      + (!this.s.arch && nArch ? `<a class="ph-archlink" data-ph="toggleArch"><i class="fa-solid fa-box-archive"></i> Archivées (${nArch})</a>` : "");
  }
  /* ── fil de discussion ── */
  thread(a) {
    const j = this.conv; if (!j) { this.s.scr = "messages"; return this.messages(a); }
    const d = convData(j); const P = phoneOf(a); const members = (d.members || []).map(actorOf).filter(Boolean); const others = members.filter(o => o.uuid !== a.uuid);
    const other = !d.group ? others[0] : null; const blocked = other && (P.blocked || []).includes(other.uuid); const typing = typingIn(j.id, a.uuid);
    const sub = typing.length ? `<span class="typ">${esc(typing.map(o => contactName(a, o)).join(", "))} écrit…</span>` : d.group ? `${members.length} membres` : other ? esc(isContact(a, other) || game.user.isGM ? (phoneOf(other).status || numberOf(other)) : "Numéro inconnu") : "";
    const head = `<header class="ph-bar thread"><a class="bk" data-ph="go" data-to="messages" title="Retour"><i class="fa-solid fa-chevron-left"></i></a><img src="${esc(convImg(j, a))}" data-ph="info"><div class="tt" data-ph="info"><b>${esc(convTitle(j, a))}</b><small>${sub}</small></div><span class="sp"></span>${other && !isContact(a, other) && !game.user.isGM ? `<a data-ph="addContact" data-uuid="${other.uuid}" title="Ajouter aux contacts"><i class="fa-solid fa-user-plus"></i></a>` : ""}<a data-ph="tSearch" class="${this.s.ts ? "on" : ""}" title="Rechercher dans la conversation"><i class="fa-solid fa-magnifying-glass"></i></a><a data-ph="call" title="Appeler"><i class="fa-solid fa-phone"></i></a><a data-ph="info" title="Infos"><i class="fa-solid fa-circle-info"></i></a></header>`;
    const all = messagesOf(j).filter(p => visibleTo(p, a)); const tq = this.s.ts ? _nrm(this.s.tq) : "";
    const hits = tq ? all.filter(p => { const m = mOf(p); return !m.del && _nrm([m.text, m.data?.name].filter(Boolean).join(" ")).includes(tq); }) : null;
    const shown = hits ? hits.slice(-300) : all.slice(-this.s.limit); const bl = P.blocked || [];
    const sbar = this.s.ts ? `<div class="ph-tsearch"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-phtq value="${esc(this.s.tq || "")}" placeholder="Chercher un mot dans toute la conversation…"><small>${tq ? `${hits.length} résultat${hits.length > 1 ? "s" : ""}` : `${all.length} messages`}</small><a data-ph="tSearch" title="Fermer"><i class="fa-solid fa-xmark"></i></a></div>` : "";
    let lastDay = "", html = !hits && shown.length < all.length ? `<a class="ph-more" data-ph="more"><i class="fa-solid fa-clock-rotate-left"></i> Charger les anciens messages (${all.length - shown.length})</a>` : "";
    const readers = others.map(o => ({ o, at: phoneOf(o).readAt?.[j.id] || 0, ts: phoneOf(o).read?.[j.id] || 0 }));
    const lastMine = [...shown].reverse().find(p => mOf(p).from === a.uuid);
    for (const p of shown) {
      const m = mOf(p); if (bl.includes(m.from) && m.from !== a.uuid) continue; const day = dayLabel(m.ts); if (day !== lastDay) { html += `<div class="ph-day"><span>${esc(day)}</span></div>`; lastDay = day; }
      html += this.msg(p, m, a, d, j);
      if (p === lastMine) { const seen = readers.filter(r => r.ts >= m.ts); if (seen.length) html += `<div class="ph-seen">${d.group ? `Vu par ${esc(seen.map(r => contactName(a, r.o)).join(", "))}` : `Vu${seen[0].at ? ` à ${hhmm(seen[0].at)}` : ""}`}</div>`; }
    }
    if (typing.length) html += `<div class="ph-typing"><img src="${esc(avatarOf(typing[0]))}"><span class="dots"><i></i><i></i><i></i></span></div>`;
    const info = this.s.info ? this.info(a, j, d, members, other, blocked) : "";
    const reply = this.s.reply ? j.pages.get(this.s.reply) : null;
    const canFx = true;
    const compose = blocked ? `<footer class="ph-blocked"><i class="fa-solid fa-ban"></i> Contact bloqué <a data-ph="block" data-uuid="${other.uuid}">Débloquer</a></footer>`
      : `${reply ? `<div class="ph-replyto"><i class="fa-solid fa-reply"></i><div><b>${esc(contactName(a, actorOf(mOf(reply).from)))}</b><small>${esc(preview(reply, a))}</small></div><a data-ph="replyX"><i class="fa-solid fa-xmark"></i></a></div>` : ""}${this.s.img ? `<div class="ph-attach"><img src="${esc(this.s.img.src)}"><span>${esc(this.s.img.label)}</span><a data-ph="imgX"><i class="fa-solid fa-xmark"></i></a></div>` : ""}
      <footer class="ph-compose"><a class="t${this.s.pop === "emoji" ? " on" : ""}" data-ph="pop" data-pop="emoji" title="Émojis"><i class="fa-regular fa-face-smile"></i></a><a class="t" data-ph="pickImg" title="Image"><i class="fa-regular fa-image"></i></a><a class="t${this.s.pop === "share" ? " on" : ""}" data-ph="pop" data-pop="share" title="Partager un lieu ou un objet"><i class="fa-solid fa-paperclip"></i></a>${canFx ? `<a class="t${this.s.fx ? " on" : ""}" data-ph="pop" data-pop="fx" title="Effet : ${esc(PH_FX[this.s.fx]?.[0] || "Normal")}"><i class="fa-solid ${PH_FX[this.s.fx]?.[1] || "fa-wand-magic-sparkles"}"></i></a>` : ""}
        <input type="file" accept="image/*" data-phfile hidden><textarea rows="1" data-phtext placeholder="${noSignal() ? "Pas de réseau — en attente…" : "Message…"}">${esc(this.s.draft)}</textarea><a class="send" data-ph="send" title="Envoyer"><i class="fa-solid fa-paper-plane"></i></a></footer>`;
    return `<div class="ph-thread${tq ? " searching" : ""}">${head}${sbar}<div class="ph-msgs">${html || `<div class="ph-none"><i class="fa-regular fa-comment"></i><p>${tq ? "Aucun message ne contient ce mot." : "Aucun message. Dis bonjour !"}</p></div>`}</div>${compose}${info}</div>`;
  }
  /** surligne le mot cherché dans la conversation */
  hl(html) { const q = this.s.ts && String(this.s.tq || "").trim(); if (!q) return html; const e = esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); try { return html.replace(new RegExp(`(${e})`, "gi"), "<mark>$1</mark>"); } catch (err) { return html; } }
  msg(p, m, a, d, j) {
    const mineM = m.from === a.uuid; const from = actorOf(m.from); const fx = m.fx && !m.del ? ` fx-${m.fx}` : ""; const fresh = now() - m.ts < 8000 ? " new" : "";
    const reacts = Object.entries(m.re || {}).filter(([, e]) => e); const rc = {}; for (const [, e] of reacts) rc[e] = (rc[e] || 0) + 1;
    const rep = m.reply ? j.pages.get(m.reply) : null;
    let inner = "";
    if (m.del) inner = `<p class="del"><i class="fa-solid fa-ban"></i> Message supprimé</p>`;
    else if (m.kind === "call") { const st = m.data?.status; inner = `<p class="call ${st}"><i class="fa-solid ${st === "missed" ? "fa-phone-slash" : "fa-phone"}"></i> ${st === "missed" ? (mineM ? "Appel sans réponse" : "Appel manqué") : st === "refused" ? "Appel refusé" : `Appel · ${fmtDur(m.data?.dur || 0)}`}</p>`; }
    else if (m.kind === "place") inner = `<div class="card place"><i class="fa-solid fa-location-dot"></i><div><b>${esc(m.data?.name)}</b>${m.data?.zone ? `<small>${esc(m.data.zone)}</small>` : ""}</div><a class="go" data-ph="tpCard" data-name="${esc(m.data?.name)}" data-zone="${esc(m.data?.zone || "")}" title="Demander la téléportation"><i class="fa-solid fa-location-arrow"></i></a></div>${m.text ? `<p>${esc(m.text)}</p>` : ""}`;
    else if (m.kind === "item") inner = `<div class="card item" data-ph="itemCard" data-uuid="${esc(m.data?.uuid || "")}" style="--rc:${esc(m.data?.color || "#8ea0c8")}"><img src="${esc(m.data?.img || "")}"><div><b>${esc(m.data?.name)}</b><small>${esc([m.data?.rank && `Rang ${m.data.rank}`, m.data?.rar].filter(Boolean).join(" · "))}</small></div></div>${m.text ? `<p>${esc(m.text)}</p>` : ""}`;
    else inner = `${m.img ? `<img class="pic" src="${esc(m.img)}" data-ph="zoom" loading="lazy" decoding="async">` : ""}${m.text ? `<p>${this.hl(esc(m.text)).replace(/\n/g, "<br>")}</p>` : ""}`;
    return `<div class="ph-msg${mineM ? " mine" : ""}" data-id="${p.id}" data-ctx="msg">${!mineM && d.group ? `<small class="who">${esc(contactName(a, from))}</small>` : ""}<div class="ms-bub${mineM ? " mine" : ""}${fx}${fresh}${m.img && !m.text && !m.del ? " only-img" : ""}">${mineM ? "" : `<img class="av" src="${esc(avatarOf(from))}">`}<div class="b">${rep ? `<div class="quote"><b>${esc(contactName(a, actorOf(mOf(rep).from)))}</b><span>${esc(preview(rep, a))}</span></div>` : ""}${inner}<small>${hhmm(m.ts)}${m.queued ? ' <i class="fa-solid fa-clock-rotate-left" title="Envoyé après coupure de réseau"></i>' : ""}</small></div></div>${reacts.length ? `<div class="ph-reacts">${Object.entries(rc).map(([e, n]) => `<span>${e}${n > 1 ? `<b>${n}</b>` : ""}</span>`).join("")}</div>` : ""}</div>`;
  }
  info(a, j, d, members, other, blocked) {
    const P = phoneOf(a); const muted = !!P.muted?.[j.id]; const wall = P.walls?.[j.id] || ""; const admin = game.user.isGM || d.by === a.uuid || members[0]?.uuid === a.uuid;
    return `<div class="ph-sheet${this._anim?.sheet ? " ph-anim" : ""}"><header class="ph-bar"><a class="bk" data-ph="infoX"><i class="fa-solid fa-chevron-down"></i></a><b>Infos</b><span class="sp"></span></header><div class="ph-sheet-b">
      <div class="ph-ihead"><img src="${esc(convImg(j, a))}"${d.group && admin ? ` data-ph="groupImg" title="Changer la photo"` : ""}><b>${esc(convTitle(j, a))}</b>${other ? `<small>${esc(numberOf(other))}${phoneOf(other).status ? ` · ${esc(phoneOf(other).status)}` : ""}</small>` : `<small>${members.length} membres</small>`}${d.group && admin ? `<a class="ph-btn" data-ph="groupName"><i class="fa-solid fa-pen"></i> Renommer</a>` : ""}</div>
      <label class="ph-tog"><span><i class="fa-solid fa-bell-slash"></i> Silencieux</span><input type="checkbox" data-phset="convMute" ${muted ? "checked" : ""}></label>
      <label class="ph-field"><span><i class="fa-solid fa-image"></i> Fond de la conversation</span><select data-phset="convWall"><option value="">Celui du téléphone</option>${Object.entries(WALLS).filter(([k]) => k && wallOwned(game.user, k)).map(([k, [n]]) => `<option value="${k}"${wall === k ? " selected" : ""}>${n}</option>`).join("")}${wall.startsWith("img:") ? `<option value="${esc(wall)}" selected>Image perso</option>` : ""}<option value="__img">Image…</option></select></label>
      ${d.group ? `<h5>Membres</h5><div class="ph-members">${members.map(o => `<div class="ph-mem"><img src="${esc(avatarOf(o))}"><b>${esc(contactName(a, o))}</b>${admin && o.uuid !== a.uuid ? `<a data-ph="groupDel" data-uuid="${o.uuid}" title="Retirer"><i class="fa-solid fa-user-minus"></i></a>` : ""}</div>`).join("")}${admin ? `<a class="ph-btn" data-ph="groupAdd"><i class="fa-solid fa-user-plus"></i> Ajouter des membres</a>` : ""}${!admin || members.length > 1 ? `<a class="ph-btn" data-ph="groupLeave"><i class="fa-solid fa-right-from-bracket"></i> Quitter le groupe</a>` : ""}</div>` : ""}
      ${other ? `<a class="ph-btn" data-ph="block" data-uuid="${other.uuid}"><i class="fa-solid fa-ban"></i> ${blocked ? "Débloquer" : "Bloquer"}</a>` : ""}
      <a class="ph-btn danger" data-ph="delConv"><i class="fa-solid fa-trash"></i> Supprimer la conversation</a></div></div>`;
  }
  /* ── contacts ── */
  contacts(a) {
    const P = phoneOf(a); const CL = contactsOf(a); const FR = new Set(friendUuids(a)); const list = CL.map(actorOf).filter(Boolean).sort((x, y) => x.name.localeCompare(y.name, "fr"));
    const gm = game.user.isGM ? game.actors.filter(o => ["character", "npc"].includes(o.type) && !isGmPhone(o) && o.uuid !== a.uuid && !CL.includes(o.uuid)).sort((x, y) => x.name.localeCompare(y.name, "fr")) : [];
    const row = (o, extra = "") => `<div class="ph-row" data-ph="contact" data-uuid="${o.uuid}"><img src="${esc(avatarOf(o))}"><div class="t"><b>${esc(o.name)}</b><small>${esc(numberOf(o))}${phoneOf(o).status ? ` · ${esc(phoneOf(o).status)}` : ""}</small></div>${(P.blocked || []).includes(o.uuid) ? '<i class="fa-solid fa-ban blk"></i>' : ""}${extra}</div>`;
    return this.bar("Contacts", "home") + `<div class="ph-addnum"><i class="fa-solid fa-hashtag"></i><input type="text" data-phnum placeholder="Identifiant stellaire (ex. XK-7Q3-92A)…" autocomplete="off" spellcheck="false"><a class="ph-btn small" data-ph="addNum">Ajouter</a></div>
      <div class="ph-list">${list.map(o => row(o, FR.has(o.uuid) ? `<em class="ph-fr" title="Ami (Menu › Amis)"><i class="fa-solid fa-user-group"></i></em>` : "")).join("") || `<div class="ph-none"><i class="fa-solid fa-address-book"></i><p>Aucun contact. Demande son numéro à quelqu'un !</p></div>`}${gm.length ? `<h5 class="ph-sec">Tous les personnages (MJ)</h5>${gm.map(o => row(o)).join("")}` : ""}</div>`;
  }
  contactCard(a) {
    const o = actorOf(this.s.contact); if (!o) { this.s.scr = "contacts"; return this.contacts(a); } const P = phoneOf(a); const isC = isContact(a, o); const bl = (P.blocked || []).includes(o.uuid);
    return this.bar("", "contacts") + `<div class="ph-ccard"><img src="${esc(avatarOf(o))}"><b>${esc(o.name)}</b><small>${esc(numberOf(o))}</small>${phoneOf(o).status ? `<em>${esc(phoneOf(o).status)}</em>` : ""}
      <div class="ph-cacts"><a data-ph="msgTo" data-uuid="${o.uuid}"><i class="fa-solid fa-comment"></i><span>Message</span></a><a data-ph="callTo" data-uuid="${o.uuid}"><i class="fa-solid fa-phone"></i><span>Appeler</span></a><a data-ph="block" data-uuid="${o.uuid}" class="${bl ? "on" : ""}"><i class="fa-solid fa-ban"></i><span>${bl ? "Débloquer" : "Bloquer"}</span></a>${isC ? `<a data-ph="delContact" data-uuid="${o.uuid}"><i class="fa-solid fa-user-minus"></i><span>Retirer</span></a>` : `<a data-ph="addContact" data-uuid="${o.uuid}"><i class="fa-solid fa-user-plus"></i><span>Ajouter</span></a>`}</div></div>`;
  }
  /* ── journal d'appels ── */
  calls(a) {
    const rows = []; for (const j of convsOf(a)) for (const p of messagesOf(j)) { const m = mOf(p); if (m.kind !== "call" || !visibleTo(p, a)) continue; rows.push({ j, m }); }
    rows.sort((x, y) => y.m.ts - x.m.ts);
    return this.bar("Appels", "home") + `<div class="ph-list">${rows.slice(0, 80).map(({ j, m }) => { const out = m.from === a.uuid; const st = m.data?.status; const miss = st === "missed" && !out; return `<div class="ph-row call${miss ? " miss" : ""}"><span class="ci"><i class="fa-solid ${miss ? "fa-phone-slash" : out ? "fa-arrow-up-right" : "fa-arrow-down-left"}"></i></span><div class="t"><b>${esc(convTitle(j, a))}</b><small>${st === "missed" ? (out ? "Sans réponse" : "Manqué") : st === "refused" ? "Refusé" : fmtDur(m.data?.dur || 0)} · ${esc(shortTime(m.ts))} ${hhmm(m.ts)}</small></div><a class="ph-round" data-ph="callConv" data-id="${j.id}" title="Rappeler"><i class="fa-solid fa-phone"></i></a></div>`; }).join("") || `<div class="ph-none"><i class="fa-solid fa-phone"></i><p>Aucun appel.</p></div>`}</div>`;
  }
  /* ── galerie : images échangées ── */
  gallery(a) {
    const imgs = []; for (const j of convsOf(a)) for (const p of messagesOf(j)) { const m = mOf(p); if (m.img && !m.del && visibleTo(p, a)) imgs.push(m); } imgs.sort((x, y) => y.ts - x.ts);
    return this.bar("Galerie", "home") + `<div class="ph-gallery">${imgs.map(m => `<img src="${esc(m.img)}" data-ph="zoom" title="${esc(shortTime(m.ts))}">`).join("") || `<div class="ph-none"><i class="fa-regular fa-images"></i><p>Aucune image échangée.</p></div>`}</div>`;
  }
  /* ── Store : installer les applis permises par le MJ ── */
  store(a) {
    const defs = appDefs(a); const inst = installedIds(a); const gm = game.user.isGM; const asked = this.s.asked || (this.s.asked = new Set());
    const card = d => { const rule = storeRule(d); const has = inst.includes(d.id); const ok = canInstall(d);
      const btn = has && ok ? `<a class="ph-btn small" data-ph="app" data-app="${esc(d.id)}">Ouvrir</a><a class="ph-btn small ghost" data-ph="uninstall" data-app="${esc(d.id)}" title="Désinstaller"><i class="fa-solid fa-trash"></i></a>`
        : ok ? `<a class="ph-btn small" data-ph="install" data-app="${esc(d.id)}"><i class="fa-solid fa-download"></i> Installer</a>`
        : asked.has(d.id) ? `<span class="ph-btn small wait"><i class="fa-solid fa-hourglass-half"></i> En attente du MJ</span>`
        : `<a class="ph-btn small ask" data-ph="askApp" data-app="${esc(d.id)}"><i class="fa-solid fa-hand"></i> Demander au MJ</a>`;
      return `<div class="ph-sapp" style="--c:${esc(d.color)}"><span class="ic"><i class="fa-solid ${esc(d.icon)}"></i></span><div class="tx"><b>${esc(d.name)}</b><small>${esc(d.desc || "")}</small>${gm ? `<select data-phset="store" data-id="${esc(d.id)}" title="Règle du Store">${[["free", "Libre"], ["ask", "Sur demande"], ["hidden", "Masquée"]].map(([k, l]) => `<option value="${k}"${rule === k ? " selected" : ""}>${l}</option>`).join("")}</select>` : rule === "ask" && !ok ? `<em class="lk"><i class="fa-solid fa-lock"></i> Autorisation du MJ</em>` : ""}</div><div class="bt">${btn}</div></div>`; };
    const list = Object.values(defs).filter(d => !d.core && (gm || storeRule(d) !== "hidden"));
    const sec = (title, ic, arr) => arr.length ? `<h5><i class="fa-solid ${ic}"></i> ${title}</h5>${arr.map(card).join("")}` : "";
    return this.bar("Store", "home") + `<div class="ph-store">${gm ? `<p class="ph-hint"><i class="fa-solid fa-crown"></i> Règle par appli : <b>Libre</b> (tout le monde l'installe), <b>Sur demande</b> (le joueur te la demande) ou <b>Masquée</b>.</p>` : ""}${sec("Applis du téléphone", "fa-mobile-screen", list.filter(d => d.kind === "native"))}${sec("Raccourcis du Menu", "fa-bars", list.filter(d => d.kind === "menu"))}${list.length ? "" : `<div class="ph-none"><i class="fa-solid fa-bag-shopping"></i><p>Rien à installer pour le moment.</p></div>`}</div>`;
  }
  /* ── 1.37 : Météo (reliée à Horlogia) ── */
  weatherApp(a) {
    const H = game.modules.get("horlogia-manhwa")?.active ? game.modules.get("horlogia-manhwa").api : null; const w = H?.weather?.(a);
    if (!w) return this.bar("Météo", "home") + `<div class="ph-none"><i class="fa-solid fa-cloud-sun"></i><p>Pas de station météo (Horlogia n'est pas actif).</p></div>`;
    return this.bar("Météo", "home") + `<div class="ph-wx" style="--wc:${esc(w.color)}"><small>${esc(w.group)}</small><i class="fa-solid ${esc(w.icon)} big"></i><b class="tp">${w.temp == null ? "—" : `${w.temp}°`}</b><span class="nm">${esc(w.name || "—")}</span>
      ${w.season ? `<span class="se" style="--sc:${esc(w.season.color || "#cfe6ff")}"><i class="fa-solid ${esc(w.season.icon || "fa-circle")}"></i>${esc(w.season.name)}</span>` : ""}<p class="ph-hint">${esc(w.date)} · ${esc(w.time)}</p></div>`;
  }
  /* ── 1.37 : Calendrier (lecture seule, relié à Horlogia) ── */
  calendarApp(a) {
    const H = game.modules.get("horlogia-manhwa")?.active ? game.modules.get("horlogia-manhwa").api : null; const M = H?.month?.(a, this.s.calOff || 0);
    if (!M) return this.bar("Calendrier", "home") + `<div class="ph-none"><i class="fa-solid fa-calendar-days"></i><p>Pas de calendrier (Horlogia n'est pas actif).</p></div>`;
    const cells = []; for (let i = 0; i < M.start; i++) cells.push(`<i class="e"></i>`);
    for (let d = 1; d <= M.days; d++) { const ev = M.events[d]; cells.push(`<span class="d${d === M.today ? " today" : ""}${ev ? " ev" : ""}"${ev ? ` style="--ec:${esc(ev[0].color)}" title="${esc(ev.map(e => e.name).join(", "))}"` : ""}>${d}</span>`); }
    const list = Object.entries(M.events).map(([d, l]) => l.map(e => `<div class="ph-calev" style="--ec:${esc(e.color)}"><i class="fa-solid ${esc(e.icon)}"></i><b>${d}</b><span>${esc(e.name)}</span></div>`).join("")).join("");
    return this.bar("Calendrier", "home") + `<div class="ph-cal"><div class="hd"><a data-ph="calOff" data-v="-1"><i class="fa-solid fa-chevron-left"></i></a><b>${esc(M.name)} ${M.y}${M.era ? ` ${esc(M.era)}` : ""}</b><a data-ph="calOff" data-v="1"><i class="fa-solid fa-chevron-right"></i></a></div>
      <div class="wd">${M.weekdays.map(w => `<span>${esc(String(w).slice(0, 2))}</span>`).join("")}</div><div class="gr" style="--n:${M.weekdays.length || 7}">${cells.join("")}</div>${this.s.calOff ? `<a class="ph-btn small ghost" data-ph="calOff" data-v="0">Aujourd'hui</a>` : ""}<div class="evs">${list || `<p class="ph-hint">Aucune fête ce mois-ci.</p>`}</div></div>`;
  }
  /* ── 1.37 : Minuteur / chronomètre ── */
  timerApp(a) {
    const T = this.s.tm ||= { mode: "chrono", acc: 0, start: 0, run: false, dur: 300 }; const el = T.acc + (T.run ? (now() - T.start) / 1000 : 0);
    const shown = T.mode === "timer" ? Math.max(0, T.dur - el) : el; const f = x => { x = Math.floor(x); const h = Math.floor(x / 3600), m = Math.floor(x / 60) % 60, sec = x % 60; return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`; };
    const pct = T.mode === "timer" && T.dur ? Math.min(1, el / T.dur) : (el % 60) / 60;
    return this.bar("Minuteur", "home") + `<div class="ph-timer"><div class="seg"><a data-ph="tmMode" data-k="chrono" class="${T.mode === "chrono" ? "on" : ""}">Chronomètre</a><a data-ph="tmMode" data-k="timer" class="${T.mode === "timer" ? "on" : ""}">Minuteur</a></div>
      <div class="dial" style="--p:${(pct * 360).toFixed(1)}deg"><b data-ph-tm>${f(shown)}</b></div>
      ${T.mode === "timer" && !T.run && !T.acc ? `<div class="pre">${[[60, "1 min"], [180, "3 min"], [300, "5 min"], [600, "10 min"], [900, "15 min"], [1800, "30 min"]].map(([v, l]) => `<a data-ph="tmDur" data-v="${v}" class="${T.dur === v ? "on" : ""}">${l}</a>`).join("")}</div>` : ""}
      <div class="ctl"><a class="ph-round ${T.run ? "stop" : "go"}" data-ph="tmRun"><i class="fa-solid ${T.run ? "fa-pause" : "fa-play"}"></i></a><a class="ph-round ghost" data-ph="tmReset" title="Remettre à zéro"><i class="fa-solid fa-rotate-left"></i></a></div></div>`;
  }
  tickTimer() {
    clearTimeout(this._tmT); this._tmT = setTimeout(() => { if (this.s.scr !== "timer" || !this.s.tm?.run || !this.el?.isConnected) return; const T = this.s.tm; const el = T.acc + (now() - T.start) / 1000;
      if (T.mode === "timer" && el >= T.dur) { T.run = false; T.acc = T.dur; phSound(phoneOf(this.actor).notif || "notif_chime", { k: 1 }); phBanner({ img: "icons/svg/clockwork.svg", title: "Minuteur", text: "Temps écoulé !" }); return this.render(); }
      const b = this.el.querySelector("[data-ph-tm]"); if (!b) return this.render(); const shown = T.mode === "timer" ? Math.max(0, T.dur - el) : el; const x = Math.floor(shown), h = Math.floor(x / 3600), m = Math.floor(x / 60) % 60, sec = x % 60;
      b.textContent = `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`; const pct = T.mode === "timer" && T.dur ? Math.min(1, el / T.dur) : (el % 60) / 60; b.parentElement.style.setProperty("--p", `${(pct * 360).toFixed(1)}deg`); this.tickTimer(); }, 250);
  }
  /* ── 1.37 : Share — partager son numéro à un joueur connecté ── */
  shareApp(a) {
    const users = game.users.filter(u => u.active && u.id !== game.user.id && !u.isGM);
    return this.bar("Share", "home") + `<div class="ph-share"><div class="me"><img src="${esc(avatarOf(a))}"><b>${esc(a.name)}</b><small>${esc(numberOf(a))}</small></div><h5 class="ph-sec">Joueurs connectés</h5>
      <div class="ph-list">${users.map(u => { const c = u.character; return `<div class="ph-row"><img src="${esc(c ? avatarOf(c) : u.avatar || "icons/svg/mystery-man.svg")}"><div class="t"><b>${esc(c?.name || u.name)}</b><small>${esc(u.name)}</small></div><a class="ph-btn small" data-ph="shareTo" data-user="${u.id}"><i class="fa-solid fa-share-nodes"></i> Partager</a></div>`; }).join("") || `<div class="ph-none"><i class="fa-solid fa-user-slash"></i><p>Aucun autre joueur connecté.</p></div>`}</div></div>`;
  }
  /* ── Horloge ── */
  clock(a) {
    const c = worldClock(); const d = new Date();
    return this.bar("Horloge", "home") + `<div class="ph-clock"><div class="big">${esc(c.time)}</div><div class="dt">${esc(c.date || "")}</div><div class="ring"><i style="--r:${(d.getSeconds() / 60) * 360}deg"></i></div><p class="ph-hint">Heure du monde${game.time?.worldTime > 0 ? "" : " (le temps du monde n'avance pas : heure réelle)"}</p></div>`;
  }
  /* ── Inter-node : contrats d'anomalies (des quêtes « Inter-node » visibles de ce joueur) ── */
  internode(a) {
    const cfg = getConfig(); const gm = game.user.isGM; const tab = this.s.inTab || "open";
    const all = quests().filter(q => isInternode(q) && questFor(q)); const ofTab = q => tab === "open" ? q.status === "open" : tab === "active" ? q.status === "active" : (q.status === "done" || q.status === "failed");
    const rIdx = k => cfg.ranks.findIndex(r => r.key === k); const rk = k => rankOf(cfg, k);
    const fmt = n => new Intl.NumberFormat("fr-FR").format(Number(n) || 0);
    const rew = q => [Number(q.rewards?.xp) ? `<span class="xp">${fmt(q.rewards.xp)} XP</span>` : "", Number(q.rewards?.gold) ? `<span class="gd"><i class="fa-solid fa-coins"></i>${fmt(q.rewards.gold)}</span>` : "", q.rewards?.text ? `<span class="tx">${esc(q.rewards.text)}</span>` : ""].join("");
    const badge = k => { const r = rk(k); return `<span class="in-rk" style="--c:${esc(r?.color || "#8ea0c8")}">${esc(r?.name || "?")}</span>`; };
    const q = all.find(x => x.id === this.s.inSel);
    if (q) { const objs = (q.objectives || []).map(o => `<div class="ob${objDone(o) ? " done" : ""}"><i class="fa-regular ${objDone(o) ? "fa-square-check" : "fa-square"}"></i><span>${esc(o.text)}${Number(o.target) ? ` <em>${Number(o.count) || 0}/${o.target}</em>` : ""}</span></div>`).join("");
      const agent = actorOf(q.agent);
      return this.bar("Contrat", "internode", "") + `<div class="ph-inode det st-${q.status}" style="--c:${esc(rk(q.rank)?.color || "#2ee6ff")}">
        <header>${badge(q.rank)}<div><small>ANOMALIE · ${esc(QUEST_STATUS[q.status] || "")}</small><h3>${esc(q.title)}</h3></div></header>
        <div class="meta">${q.location ? `<span><i class="fa-solid fa-location-dot"></i>${esc(q.location)}</span>` : ""}${q.deadline ? `<span><i class="fa-solid fa-hourglass-half"></i>${esc(q.deadline)}</span>` : ""}${q.giver ? `<span><i class="fa-solid fa-user-secret"></i>${esc(q.giver)}</span>` : ""}${agent ? `<span><i class="fa-solid fa-id-badge"></i>${esc(agent.name)}</span>` : ""}</div>
        ${q.img ? `<img class="im" src="${esc(q.img)}">` : ""}${q.desc ? `<div class="desc">${q.desc}</div>` : ""}
        ${objs ? `<h4>Objectifs</h4><div class="obs">${objs}</div>` : ""}${rew(q) ? `<h4>Prime</h4><div class="rw">${rew(q)}</div>` : ""}
        <footer>${!gm && q.status === "open" ? `<a class="in-btn ok" data-ph="inAccept" data-qid="${q.id}"><i class="fa-solid fa-check"></i> Accepter le contrat</a>` : ""}
          ${gm ? `<a class="in-btn" data-ph="inEdit" data-qid="${q.id}"><i class="fa-solid fa-pen"></i> Modifier</a>${q.status !== "done" ? `<a class="in-btn ok" data-ph="inDone" data-qid="${q.id}"><i class="fa-solid fa-flag-checkered"></i> Terminé</a>` : ""}${q.status === "open" || q.status === "active" ? `<a class="in-btn ko" data-ph="inFail" data-qid="${q.id}"><i class="fa-solid fa-xmark"></i> Échec</a>` : ""}` : ""}</footer></div>`; }
    const list = all.filter(ofTab).sort((x, y) => rIdx(y.rank) - rIdx(x.rank) || String(x.title).localeCompare(String(y.title), "fr"));
    const n = k => all.filter(x => k === "open" ? x.status === "open" : k === "active" ? x.status === "active" : (x.status === "done" || x.status === "failed")).length;
    const tabs = [["open", "Disponibles"], ["active", "En cours"], ["past", "Archives"]].map(([k, l]) => `<a data-ph="inTab" data-k="${k}" class="${tab === k ? "on" : ""}">${l}<b>${n(k)}</b></a>`).join("");
    return this.bar("Inter-node", "home", gm ? `<a data-ph="inNew" title="Publier un contrat"><i class="fa-solid fa-plus"></i></a>` : "") + `<div class="ph-inode">
      <div class="in-head"><i class="fa-solid fa-circle-nodes"></i><div><b>INTER-NODE</b><small>Réseau des agents · anomalies F → S</small></div></div>
      <nav class="in-tabs">${tabs}</nav>
      <div class="in-list">${list.map(x => `<div class="in-row st-${x.status}" data-ph="inOpen" data-qid="${x.id}" style="--c:${esc(rk(x.rank)?.color || "#2ee6ff")}">${badge(x.rank)}<div class="t"><b>${esc(x.title)}</b><small>${[x.location, x.deadline].filter(Boolean).map(esc).join(" · ") || esc(QUEST_STATUS[x.status] || "")}</small><div class="rw">${rew(x)}</div></div><i class="fa-solid fa-chevron-right"></i></div>`).join("") || `<div class="ph-none"><i class="fa-solid fa-satellite-dish"></i><p>${tab === "open" ? "Aucun contrat disponible pour toi." : "Rien ici."}</p></div>`}</div></div>`;
  }
  /* ── Calculatrice ── */
  calc(a) {
    const v = this.s.calc || "0"; const keys = ["C", "(", ")", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "±", "0", ",", "="];
    return this.bar("Calculatrice", "home") + `<div class="ph-calc"><div class="scr"><small>${esc(this.s.calcPrev || "")}</small><b>${esc(v)}</b></div><div class="keys">${keys.map(k => `<a data-ph="calcKey" data-k="${k}" class="${/[÷×−+=]/.test(k) ? "op" : k === "C" ? "cl" : ""}">${k}</a>`).join("")}</div></div>`;
  }

  /* ── réglages ── */
  /* 1.52 : fonds d'écran — accueil et démarrage, même catalogue (packs, recherche, pages), cadrage et voile des images */
  wallSettings(a, P, gm) {
    const slot = this.s.wslot || "home"; const st = (this.s.wcat ||= { pack: "all", q: "", page: 0 }); const cur = slot === "lock" ? (P.lockWall === "none" ? "" : (LOCK_ALIAS[P.lockWall] || P.lockWall || "")) : (P.wall || ""); const fx = P.wallFx?.[slot] || {};
    const owners = game.users.filter(u => !u.isGM && a.testUserPermission(u, "OWNER")); const mine = k => gm ? true : wallOwned(game.user, k);
    const gmLock = k => gm && owners.length && !owners.some(u => wallOwned(u, k)) ? `<i class="fa-solid fa-lock gl" title="Verrouillé pour le joueur"></i>` : "";
    const nrm = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const all = WALL_LIST; const q = nrm(st.q);
    const list = all.filter(w => (st.pack === "all" || (st.pack === "own" ? mine(w.key) : w.pack === st.pack)) && (!q || nrm(w.n).includes(q) || nrm(WALL_PACKS[w.pack]?.n).includes(q)));
    const per = 12; const pages = Math.max(1, Math.ceil(list.length / per)); const pg = Math.min(st.page || 0, pages - 1); const sl = list.slice(pg * per, pg * per + per);
    const chip = (k, n, ic, c, cnt) => `<a class="ph-wchip${st.pack === k ? " on" : ""}" data-ph="wpack" data-k="${k}" style="--pc:${esc(c)}"><i class="fa-solid ${ic}"></i>${esc(n)}<em>${cnt}</em></a>`;
    const chips = chip("all", "Tout", "fa-layer-group", "#9fb0d4", all.length) + (gm ? "" : chip("own", "Possédés", "fa-check", "#3ddc84", all.filter(w => mine(w.key)).length)) + Object.entries(WALL_PACKS).filter(([k]) => all.some(w => w.pack === k)).map(([k, p]) => chip(k, p.n, p.ic, p.c, all.filter(w => w.pack === k).length)).join("");
    const tile = w => { const ok = mine(w.key); const R = WALL_RAR[w.rar] || WALL_RAR.common; const on = cur === w.key && !(slot === "lock" && !P.lockWall && w.key !== "");
      return `<a class="ph-wt${on ? " on" : ""}${ok ? "" : " lock"}${w.anim ? ` lkw-${esc(w.anim)}` : ""}" data-ph="wpick" data-k="${esc(w.key)}" style="background:${esc(w.css)};--rr:${R[1]};--pc:${esc(WALL_PACKS[w.pack]?.c || "#9fb0d4")}" title="${esc(`${w.n} · ${WALL_PACKS[w.pack]?.n || ""} · ${R[0]}`)}">${w.key ? "" : `<i class="fa-solid fa-ban nil"></i>`}<em>${esc(w.n)}</em><small>${esc(R[0])}</small>${ok ? (on ? `<i class="fa-solid fa-check ck"></i>` : "") : `<i class="fa-solid fa-lock lk"></i>`}${gmLock(w.key)}</a>`; };
    const imgOk = gm || unlocked(game.user, "wall:custom"); const isImg = String(cur).startsWith("img:");
    const special = `${slot === "lock" ? `<a class="ph-wt sp${!P.lockWall ? " on" : ""}" data-ph="wpick" data-k="__same" title="Le même fond que l'accueil"><i class="fa-solid fa-clone nil"></i><em>Comme l'accueil</em>${!P.lockWall ? `<i class="fa-solid fa-check ck"></i>` : ""}</a>` : ""}<a class="ph-wt sp${isImg ? " on" : ""}${imgOk ? "" : " lock"}" data-ph="wpickImg" title="Ta propre image (à débloquer)"><i class="fa-solid fa-panorama nil"></i><em>Image perso</em>${imgOk ? (isImg ? `<i class="fa-solid fa-check ck"></i>` : "") : `<i class="fa-solid fa-lock lk"></i>`}${gm && owners.length && !owners.some(u => unlocked(u, "wall:custom")) ? `<i class="fa-solid fa-lock gl" title="Verrouillé pour le joueur"></i>` : ""}</a>`;
    const rg = (f, n, min, max, v, u) => `<label class="ph-field ph-wrg"><span>${n}</span><span class="ph-range"><input type="range" min="${min}" max="${max}" step="1" data-phset="wfx" data-f="${f}" value="${v}"><b>${v}${u}</b></span></label>`;
    const tone = fx.tone || "dark";
    const frame = isImg ? `<div class="ph-wframe"><b><i class="fa-solid fa-crop-simple"></i> Cadrage de l'image</b>${rg("z", "Zoom", 100, 300, Number(fx.z) || 100, " %")}${rg("x", "Horizontal", 0, 100, Number(fx.x ?? 50), " %")}${rg("y", "Vertical", 0, 100, Number(fx.y ?? 50), " %")}
      <label class="ph-field"><span><i class="fa-solid fa-circle-half-stroke"></i> Type de fond</span><select data-phset="wtone"><option value="dark"${tone === "dark" ? " selected" : ""}>Sombre (voile léger)</option><option value="light"${tone === "light" ? " selected" : ""}>Clair (voile renforcé)</option><option value="custom"${tone === "custom" ? " selected" : ""}>Personnalisé</option></select></label>
      ${tone === "custom" ? rg("veil", "Voile", 0, 90, Number(fx.veil ?? 35), " %") : ""}</div>` : "";
    const curName = slot === "lock" && !P.lockWall ? "Comme l'accueil" : isImg ? "Image perso" : (wallDef(cur)?.n || "Aucun");
    return `<h5>Fonds d'écran</h5><div class="ph-wslot"><a class="${slot === "home" ? "on" : ""}" data-ph="wslot" data-k="home"><i class="fa-solid fa-house"></i> Accueil</a><a class="${slot === "lock" ? "on" : ""}" data-ph="wslot" data-k="lock"><i class="fa-solid fa-lock"></i> Démarrage</a></div>
      <div class="ph-wcur"><span>${slot === "lock" ? "Démarrage" : "Accueil"} :</span><b>${esc(curName)}</b></div>${frame}
      <div class="ph-wchips">${chips}</div><label class="ph-wq"><i class="fa-solid fa-magnifying-glass"></i><input type="search" data-phset="wq" value="${esc(st.q || "")}" placeholder="Rechercher parmi ${all.length} fonds…"></label>
      ${st.pack !== "all" && st.pack !== "own" && WALL_PACKS[st.pack]?.desc ? `<p class="ph-wdesc" style="--pc:${esc(WALL_PACKS[st.pack].c)}"><i class="fa-solid ${WALL_PACKS[st.pack].ic}"></i>${esc(WALL_PACKS[st.pack].desc)}</p>` : ""}
      <div class="ph-wgrid">${pg === 0 ? special : ""}${sl.map(tile).join("") || `<p class="ph-hint">Aucun fond.</p>`}</div>
      ${pages > 1 ? `<div class="ph-wpg"><a data-ph="wpage" data-k="-1"><i class="fa-solid fa-chevron-left"></i></a><span>${pg + 1} / ${pages}</span><a data-ph="wpage" data-k="1"><i class="fa-solid fa-chevron-right"></i></a></div>` : ""}
      ${gm ? "" : `<p class="ph-hint"><i class="fa-solid fa-store"></i> Les fonds se débloquent à l'unité ou par pack, à la Boutique stellaire ou par le MJ.</p>`}`;
  }
  settings(a) {
    const P = phoneOf(a); const gm = game.user.isGM; const v = Number(game.settings.get(SYS, "phoneVol")) || 0;
    const frames = Object.entries(FRAMES).filter(([k]) => gm || unlocked(game.user, `frame:${k}`)); const fxs = Object.entries(PH_FX).filter(([k]) => gm || unlocked(game.user, `fx:${k}`));
    const lock = id => gm && !game.users.filter(u => !u.isGM && a.testUserPermission(u, "OWNER")).some(u => unlocked(u, id)) ? ' <i class="fa-solid fa-lock" title="Verrouillé pour le joueur (déblocable)"></i>' : "";
    return this.bar("Réglages", "home") + `<div class="ph-set">
      <h5>Profil</h5><div class="ph-prof"><img src="${esc(avatarOf(a))}" data-ph="avatar" title="Changer la photo"><div><b>${esc(a.name)}</b>${gm ? `<input type="text" data-phset="number" value="${esc(numberOf(a))}" title="Numéro (MJ)">` : `<small>${esc(numberOf(a))}</small>`}</div></div>
      <label class="ph-field"><span>Statut</span><input type="text" data-phset="status" value="${esc(P.status || "")}" placeholder="Disponible, en mission…"></label>
      <h5>Son</h5><label class="ph-field"><span><i class="fa-solid fa-volume-low"></i> Volume (pour toi)</span><span class="ph-range"><input type="range" min="0" max="100" step="5" data-phvol value="${v}"><b>${v} %</b></span></label>
      <label class="ph-field"><span>Sonnerie</span><span class="ph-inl"><select data-phset="ring">${Object.entries(RINGS).map(([k, n]) => `<option value="${k}"${(P.ring || "ring_classic") === k ? " selected" : ""}>${n}</option>`).join("")}</select><a class="ph-round" data-ph="preview" data-snd="ring" title="Écouter"><i class="fa-solid fa-play"></i></a></span></label>
      <label class="ph-field"><span>Notification</span><span class="ph-inl"><select data-phset="notif">${Object.entries(NOTIFS).map(([k, n]) => `<option value="${k}"${(P.notif || "notif_ping") === k ? " selected" : ""}>${n}</option>`).join("")}</select><a class="ph-round" data-ph="preview" data-snd="notif" title="Écouter"><i class="fa-solid fa-play"></i></a></span></label>
      <label class="ph-tog"><span><i class="fa-solid fa-moon"></i> Silencieux (tout le téléphone)</span><input type="checkbox" data-phset="dnd" ${P.dnd ? "checked" : ""}></label>
      <label class="ph-tog"><span><i class="fa-solid fa-mobile-screen-button"></i> Vibreur</span><input type="checkbox" data-phset="vibe" ${P.vibe === false ? "" : "checked"}></label>
      <h5>Apparence</h5><label class="ph-field"><span>Thème</span><select data-phset="theme">${Object.entries(PH_THEMES).map(([k, n]) => `<option value="${k}"${(P.theme || "neon") === k ? " selected" : ""}>${n}</option>`).join("")}</select></label>
      <label class="ph-field"><span>Couleur des messages</span><span class="ph-inl"><input type="color" data-phset="bubble" value="${esc(P.bubble || "#38a8ff")}"><a class="ph-round" data-ph="bubbleX" title="Couleur du thème"><i class="fa-solid fa-rotate-left"></i></a></span></label>
      ${this.wallSettings(a, P, gm)}
      ${frames.length ? `<h5>Cadre</h5><div class="ph-chips"><a class="${!P.frame ? "on" : ""}" data-ph="frame" data-k="">Aucun</a>${frames.map(([k, [n, ic]]) => `<a class="${P.frame === k ? "on" : ""}" data-ph="frame" data-k="${k}"><i class="fa-solid ${ic}"></i>${n}${lock(`frame:${k}`)}</a>`).join("")}</div>` : ""}
      ${fxs.length ? `<h5>Effets de message</h5><div class="ph-chips static">${fxs.map(([k, [n, ic]]) => `<span><i class="fa-solid ${ic}"></i>${n}${lock(`fx:${k}`)}</span>`).join("")}</div>` : ""}
      ${!gm && !frames.length && !fxs.length ? `<p class="ph-hint"><i class="fa-solid fa-store"></i> Cadres et effets de message se débloquent à la Boutique stellaire.</p>` : ""}</div>`;
  }
  /* ── outils du MJ ── */
  gm(a) {
    if (!game.user.isGM) return this.home(a);
    const actors = game.actors.filter(o => ["character", "npc"].includes(o.type) && !isGmPhone(o)).sort((x, y) => (y.hasPlayerOwner - x.hasPlayerOwner) || x.name.localeCompare(y.name, "fr"));
    const players = game.users.filter(u => !u.isGM); const pl = game.users.get(this.s.gmUser) || players[0]; const npcs = actors.filter(o => !o.hasPlayerOwner);
    return this.bar("Outils du MJ", "home") + `<div class="ph-set">
      <h5><i class="fa-solid fa-eye"></i> Téléphone affiché</h5><label class="ph-field"><select data-phset="gmView"><option value="">${esc(this.getActor()?.name || "—")} (fenêtre)</option>${actors.map(o => `<option value="${o.uuid}"${this.s.view === o.uuid ? " selected" : ""}>${esc(o.name)}${o.hasPlayerOwner ? "" : " (PNJ)"}</option>`).join("")}</select></label>
      <h5><i class="fa-solid fa-phone-volume"></i> Appel scénarisé</h5><label class="ph-field"><span>De</span><select data-gm="from">${npcs.map(o => `<option value="${o.uuid}">${esc(o.name)}</option>`).join("")}</select></label><label class="ph-field"><span>Vers</span><select data-gm="to">${actors.filter(o => o.hasPlayerOwner).map(o => `<option value="${o.uuid}">${esc(o.name)}</option>`).join("")}</select></label><label class="ph-field"><span>Message entendu en décrochant (facultatif)</span><input type="text" data-gm="text" placeholder="« Retrouve-moi au port, seul. »"></label><a class="ph-btn" data-ph="gmCall"><i class="fa-solid fa-phone"></i> Lancer l'appel</a>
      <h5><i class="fa-solid fa-tower-broadcast"></i> Réseau</h5><div class="ph-list compact">${game.scenes.contents.map(sc => `<label class="ph-tog"><span>${esc(sc.name)}</span><input type="checkbox" data-phset="sig" data-id="${sc.id}" ${sc.getFlag(SYS, "noSignal") ? "" : "checked"}></label>`).join("")}</div>
      <h5><i class="fa-solid fa-bag-shopping"></i> Store</h5><a class="ph-btn" data-ph="go" data-to="store"><i class="fa-solid fa-sliders"></i> Régler les applis du Store</a>
      <h5><i class="fa-solid fa-unlock"></i> Cosmétiques et applis par joueur</h5>${players.length ? `<label class="ph-field"><select data-phset="gmUser">${players.map(u => `<option value="${u.id}"${pl?.id === u.id ? " selected" : ""}>${esc(u.name)}</option>`).join("")}</select></label><div class="ph-list compact">${[...COSMETICS, ...Object.values(appDefs()).filter(d => !d.core && storeRule(d) === "ask").map(d => ({ id: `app:${d.id}`, icon: d.icon, name: `Appli ${d.name}` }))].map(c => `<label class="ph-tog"><span><i class="fa-solid ${c.icon}"></i> ${esc(c.name)}</span><input type="checkbox" data-phset="unlock" data-id="${c.id}" ${unlocked(pl, c.id) && !pl?.isGM ? "checked" : ""}></label>`).join("")}</div>` : `<p class="ph-hint">Aucun joueur.</p>`}
      <h5><i class="fa-solid fa-hashtag"></i> Numéros</h5><div class="ph-list compact">${actors.map(o => `<label class="ph-field row"><span>${esc(o.name)}</span><input type="text" data-phset="numOf" data-uuid="${o.uuid}" value="${esc(numberOf(o))}"></label>`).join("")}</div></div>`;
  }

  /* ── fenêtres flottantes : émojis, partage, effets, menus contextuels ── */
  pop(a) {
    const p = this.s.pop; if (!p) return "";
    if (p === "emoji") { const cats = [["recent", "fa-clock-rotate-left", "Récents"], ...Object.entries(EMOJI_CATS).map(([k, [ic, n]]) => [k, ic, n])]; const list = this.s.cat === "recent" ? recent() : EMOJI_CATS[this.s.cat]?.[2].split(" ") || [];
      return `<div class="ph-pop emoji${this._anim?.pop ? " ph-anim" : ""}"><nav>${cats.map(([k, ic, n]) => `<a class="${this.s.cat === k ? "on" : ""}" data-ph="cat" data-k="${k}" title="${n}"><i class="fa-solid ${ic}"></i></a>`).join("")}</nav><div class="grid">${list.map(e => `<a data-ph="emo" data-e="${e}">${e}</a>`).join("") || `<p class="ph-hint">Les émojis utilisés apparaîtront ici.</p>`}</div></div>`; }
    if (p === "share") { const places = flatTree(a.system?.carnet?.places); const items = a.items.contents.slice().sort((x, y) => x.name.localeCompare(y.name, "fr"));
      return `<div class="ph-pop share${this._anim?.pop ? " ph-anim" : ""}"><h6><i class="fa-solid fa-location-dot"></i> Lieux</h6>${places.map(n => `<a data-ph="sharePlace" data-name="${esc(n.name)}" data-zone="${esc(n.zone || "")}"><i class="fa-solid fa-location-dot"></i>${esc(n.name)}${n.zone ? `<small>${esc(n.zone)}</small>` : ""}</a>`).join("") || `<p class="ph-hint">Aucun lieu (onglet Téléportation).</p>`}<h6><i class="fa-solid fa-box"></i> Objets</h6>${items.map(i => `<a data-ph="shareItem" data-id="${i.id}"><img src="${esc(i.img)}">${esc(i.name)}</a>`).join("") || `<p class="ph-hint">Aucun objet.</p>`}</div>`; }
    if (p === "fx") { const ok = k => game.user.isGM || unlocked(game.user, `fx:${k}`); const l = Object.entries(PH_FX).sort(([a], [b]) => (ok(b) ? 1 : 0) - (ok(a) ? 1 : 0));   /* 1.39 : les effets verrouillés sont montrés, grisés, avec un cadenas */
      return `<div class="ph-pop fx${this._anim?.pop ? " ph-anim" : ""}"><a class="${!this.s.fx ? "on" : ""}" data-ph="fx" data-k=""><i class="fa-solid fa-comment"></i>Normal</a>${l.map(([k, [n, ic]]) => ok(k) ? `<a class="${this.s.fx === k ? "on" : ""}" data-ph="fx" data-k="${k}"><i class="fa-solid ${ic}"></i>${n}</a>` : `<a class="lock" data-ph="fxLock" data-k="${k}" title="Verrouillé : à débloquer (Boutique stellaire ou MJ)"><i class="fa-solid ${ic}"></i>${n}<i class="fa-solid fa-lock lk"></i></a>`).join("")}</div>`; }
    return "";
  }
  ctx(a) {
    const c = this.s.ctx; if (!c) return "";
    if (c.kind === "msg") { const j = this.conv; const p = j?.pages.get(c.id); const m = mOf(p); if (!m) return ""; const mineM = m.from === a.uuid; const my = m.re?.[K(a.uuid)];
      return `<div class="ph-ctx${this._anim?.ctx ? " ph-anim" : ""}"><div class="reacts">${REACTS.map(e => `<a class="${my === e ? "on" : ""}" data-ph="react" data-e="${e}">${e}</a>`).join("")}</div>${m.del ? "" : `<a data-ph="reply"><i class="fa-solid fa-reply"></i> Répondre</a>${m.text ? `<a data-ph="copy"><i class="fa-regular fa-copy"></i> Copier</a>` : ""}`}<a data-ph="delMe"><i class="fa-solid fa-eye-slash"></i> Supprimer pour moi</a>${(mineM || game.user.isGM) && !m.del ? `<a class="danger" data-ph="delAll"><i class="fa-solid fa-trash"></i> Supprimer pour tous</a>` : ""}</div>`; }
    if (c.kind === "conv") { const P = phoneOf(a); const pin = (P.pinned || []).includes(c.id), arch = (P.archived || []).includes(c.id), mute = !!P.muted?.[c.id];
      return `<div class="ph-ctx${this._anim?.ctx ? " ph-anim" : ""}"><a data-ph="pin"><i class="fa-solid fa-thumbtack"></i> ${pin ? "Désépingler" : "Épingler"}</a><a data-ph="arch"><i class="fa-solid fa-box-archive"></i> ${arch ? "Désarchiver" : "Archiver"}</a><a data-ph="mute"><i class="fa-solid ${mute ? "fa-bell" : "fa-bell-slash"}"></i> ${mute ? "Réactiver les notifications" : "Silencieux"}</a><a class="danger" data-ph="delConv"><i class="fa-solid fa-trash"></i> Supprimer</a></div>`; }
    return "";
  }
}
const fmtDur = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export function preview(p, a) { const m = mOf(p); if (!m) return ""; const who = m.from === a?.uuid ? "Toi : " : ""; if (m.del) return "Message supprimé"; if (m.kind === "call") return m.data?.status === "missed" ? (who ? "Appel sans réponse" : "Appel manqué") : m.data?.status === "refused" ? "Appel refusé" : "Appel"; if (m.kind === "place") return `${who}📍 ${m.data?.name || "Lieu"}`; if (m.kind === "item") return `${who}🎁 ${m.data?.name || "Objet"}`; return who + (m.text ? String(m.text).slice(0, 60) : m.img ? "📷 Image" : ""); }

/* ── actions ── */
Object.assign(PhoneView.prototype, {
  openApp(id) {
    const d = appDefs(this.actor)[id]; if (!d) return;
    if (d.kind === "menu") { const a = this.getActor() || this.actor; const pos = this.opts.menu?.rendered ? { ...this.opts.menu.position } : null; return import("./menu.js").then(m => m.MenuApp.open(a, d.tab, pos)); }
    return this.go(id);
  },
  /* déplace une appli : avant/après une autre, à la fin d'une page, ou dans le dock (4 max) */
  async moveApp(id, target, after, toDock, page = null) {
    const a = this.actor; const { grid, dock } = homeLayout(a); const g = grid.filter(x => x !== id), dk = dock.filter(x => x !== id);
    if (toDock) { if (dk.length >= 4 && !dock.includes(id)) { ui.notifications.warn("Le dock est plein (4 applis)."); return this.render(); } let i = target ? dk.indexOf(target) + (after ? 1 : 0) : dk.length; if (i < 0) i = dk.length; dk.splice(i, 0, id); }
    else if (target) { let i = g.indexOf(target); i = i < 0 ? g.length : i + (after ? 1 : 0); g.splice(i, 0, id); }
    else { const cap = Math.max(4, this._cap || 16); const end = page == null ? g.length : Math.min(g.length, (page + 1) * cap - 1); g.splice(end, 0, id); }
    await setPhone(a, { home: g, dock: dk }); this.render();
  },
  calcKey(k) {
    let v = this.s.calc || "0"; const isOp = c => /[÷×−+]/.test(c);
    if (k === "C") { this.s.calc = "0"; this.s.calcPrev = ""; return this.render(); }
    if (k === "=") { const expr = v.replace(/÷/g, "/").replace(/×/g, "*").replace(/−/g, "-").replace(/,/g, "."); let r = "Erreur"; if (/^[0-9+\-*/().\s]+$/.test(expr)) { try { const x = Function(`"use strict";return (${expr})`)(); if (Number.isFinite(x)) r = String(Math.round(x * 1e10) / 1e10).replace(".", ","); } catch (e) {} } this.s.calcPrev = v + " ="; this.s.calc = r; return this.render(); }
    if (k === "±") { this.s.calc = v.startsWith("−") ? v.slice(1) : v === "0" ? v : "−" + v; return this.render(); }
    if (v === "0" || v === "Erreur") v = isOp(k) ? v === "Erreur" ? "0" : "0" : ""; if (isOp(k) && isOp(v.slice(-1))) v = v.slice(0, -1);
    this.s.calc = (v + k).slice(0, 40); return this.render();
  },
  go(scr) { this.s.edit = false; this.s.scr = scr; this.s.pop = null; this.s.ctx = null; this.s.info = false; if (scr !== "thread") this.s.conv = null; this.render(); },
  async open(id) { this.s.conv = id; this.s.scr = "thread"; this.s.limit = PAGE; this.s.ts = false; this.s.tq = ""; this.s.reply = null; this.s.img = null; this.s.info = false; this.s.pop = null; this.s.ctx = null; this._scrollEnd = true; this._focus = true; this.render(); },
  async act(act, t, ev) {
    const a = this.actor; const s = this.s; const j = this.conv;
    switch (act) {
      case "unlock": if (ev.target.closest("[data-ph='open']") && ev.target.closest("[data-ph='open']") !== t) return; s.scr = "home"; return this.render();
      case "go": { const to = t.dataset.to; if (to === "messages-main") { s.arch = false; return this.go("messages"); } if (to === "messages") s.arch = false; return this.go(to); }
      case "open": return this.open(t.dataset.id);
      case "app": return this.s.edit ? undefined : this.openApp(t.dataset.app);
      case "inTab": s.inTab = t.dataset.k; s.inSel = null; return this.render();
      case "inOpen": s.inSel = t.dataset.qid; return this.render();
      case "inAccept": { if (!activeGM()) return ui.notifications.warn("Aucun MJ connecté pour valider le contrat."); await gmDo("questAccept", { qid: t.dataset.qid, actor: a.uuid }); s.inTab = "active"; return; }
      case "inNew": { if (!game.user.isGM) return; const q = await editQuest(null, { channel: "internode", type: "side" }); if (!q) return; await editList("quests", l => { l.unshift(q); }); s.inSel = q.id; return this.render(); }
      case "inEdit": { if (!game.user.isGM) return; const cur = quests().find(x => x.id === t.dataset.qid); const q = await editQuest(cur); if (!q) return; await editList("quests", l => { const x = l.find(y => y.id === q.id); if (!x) return false; Object.assign(x, q); }); return this.render(); }
      case "inDone": case "inFail": { if (!game.user.isGM) return; const fake = { questId: t.dataset.qid, actor: a, qf: {}, render: () => this.render() }; await actQuests(fake, act === "inDone" ? "qDone" : "qFail", t, ev); return this.render(); }
      case "page": this.s.page = Number(t.dataset.i) || 0; return this.render();
      case "editHome": this.s.edit = !this.s.edit; return this.render();
      case "install": { const d = appDefs(a)[t.dataset.app]; if (!d || !canInstall(d)) return; await setPhone(a, { apps: [...new Set([...installedIds(a), d.id])] }); phSound("send", { k: 0.5 }); return this.render(); }
      case "uninstall": { const id = t.dataset.app; const P = phoneOf(a); await setPhone(a, { apps: installedIds(a).filter(x => x !== id), home: (P.home || []).filter(x => x !== id), dock: (Array.isArray(P.dock) ? P.dock : BASE_DOCK).filter(x => x !== id) }); return this.render(); }
      case "askApp": { const d = appDefs(a)[t.dataset.app]; if (!d) return; if (!game.users.activeGM) return ui.notifications.warn("Aucun MJ connecté pour autoriser l'appli."); (this.s.asked ||= new Set()).add(d.id); game.socket.emit(`system.${SYS}`, { op: "phAppReq", user: game.user.id, actor: a.uuid, app: d.id, name: d.name }); ui.notifications.info(`Demande envoyée au MJ : ${d.name}.`); return this.render(); }
      case "sortApps": { const { defs, grid } = homeLayout(a); const k = t.dataset.k; if (k === "reset") { await setPhone(a, { home: [], dock: BASE_DOCK }); return this.render(); }
        const hue = c => { const m = String(c).match(/^#?([0-9a-f]{6})$/i); if (!m) return 0; const n = parseInt(m[1], 16); const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return 400; const d = mx - mn; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
        const sorted = grid.slice().sort((x, y) => k === "color" ? hue(defs[x].color) - hue(defs[y].color) : defs[x].name.localeCompare(defs[y].name, "fr")); await setPhone(a, { home: sorted }); return this.render(); }
      case "calcKey": return this.calcKey(t.dataset.k);
      case "calOff": { const v = Number(t.dataset.v) || 0; s.calOff = v === 0 ? 0 : (s.calOff || 0) + v; return this.render(); }
      case "tmMode": { if (s.tm?.run) return; s.tm = { mode: t.dataset.k, acc: 0, start: 0, run: false, dur: s.tm?.dur || 300 }; return this.render(); }
      case "tmDur": { s.tm.dur = Number(t.dataset.v) || 300; return this.render(); }
      case "tmRun": { const T = s.tm; if (T.run) { T.acc += (now() - T.start) / 1000; T.run = false; } else { if (T.mode === "timer" && T.acc >= T.dur) T.acc = 0; T.start = now(); T.run = true; } return this.render(); }
      case "tmReset": { const T = s.tm; T.acc = 0; T.start = now(); if (!T.run) T.start = 0; return this.render(); }
      case "shareTo": { const u = game.users.get(t.dataset.user); if (!u?.active) return ui.notifications.warn("Ce joueur n'est plus connecté.");
        game.socket.emit(`system.${SYS}`, { op: "phShare", to: u.id, from: a.uuid, name: a.name, img: avatarOf(a), number: numberOf(a) }); phSound("send", { k: 0.5 }); ui.notifications.info(`Numéro partagé avec ${u.character?.name || u.name}.`); return; }
      case "toggleArch": s.arch = !s.arch; return this.render();
      case "newMsg": { const uuid = await pickRecipients({ title: "Nouveau message", viewer: a, multi: false, phone: true }); if (!uuid?.length) return; return this.msgTo(uuid[0]); }
      case "newGroup": { const name = await askText("Nouveau groupe", "Nom du groupe"); if (!name) return; const l = await pickRecipients({ title: `Membres de « ${name} »`, viewer: a, multi: true, phone: true }); if (!l?.length) return; const c = await newConv([a.uuid, ...l], { group: true, name }); if (c) this.open(c.id); return; }
      case "msgTo": return this.msgTo(t.dataset.uuid);
      case "callTo": { const o = actorOf(t.dataset.uuid); if (!o) return; let c = findDirect(a, o) || await newConv([a.uuid, o.uuid]); if (c) startCall(a, c); return; }
      case "callConv": { const c = game.journal.get(t.dataset.id); if (c) startCall(a, c); return; }
      case "call": if (j) startCall(a, j); return;
      case "info": s.info = true; s.pop = null; return this.render();
      case "infoX": s.info = false; return this.render();
      case "more": { const b = this.el?.querySelector(".ph-msgs"); if (b) { const top = b.getBoundingClientRect().top; const f = [...b.querySelectorAll(".ph-msg[data-id]")].find(x => x.getBoundingClientRect().bottom > top + 2); this._moreAnchor = f ? { id: f.dataset.id, off: f.getBoundingClientRect().top - top } : null; } s.limit += PAGE; return this.render(); }
      case "fxLock": return ui.notifications.info(`Effet « ${PH_FX[t.dataset.k]?.[0] || ""} » verrouillé : il se débloque dans la Boutique stellaire ou par le MJ.`);
      case "tSearch": s.ts = !s.ts; s.tq = ""; this._tqFocus = s.ts; this._scrollEnd = true; return this.render();
      case "send": return this.send();
      case "pop": s.pop = s.pop === t.dataset.pop ? null : t.dataset.pop; s.ctx = null; return this.render();
      case "cat": s.cat = t.dataset.k; return this.render();
      case "emo": { const e = t.dataset.e; pushRecent(e); const ta = this.el.querySelector("textarea[data-phtext]"); const v = ta?.value ?? s.draft ?? ""; const st = ta?.selectionStart ?? v.length; const en = ta?.selectionEnd ?? st; s.draft = v.slice(0, st) + e + v.slice(en);
        /* le rendu relit la zone de saisie : on y écrit d'abord le texte avec l'émoji et le curseur après lui (avant, l'émoji était effacé par le rendu) */
        if (ta) { ta.value = s.draft; ta.setSelectionRange(st + e.length, st + e.length); } this._focus = true; return this.render(); }
      case "fx": s.fx = t.dataset.k; s.pop = null; this._focus = true; return this.render();
      case "pickImg": return this.el.querySelector("input[data-phfile]")?.click();
      case "imgX": s.img = null; return this.render();
      case "replyX": s.reply = null; return this.render();
      case "zoom": return new (foundry.applications?.apps?.ImagePopout ?? ImagePopout)({ src: t.getAttribute("src"), window: { title: "Image" } }).render({ force: true });
      case "sharePlace": s.pop = null; if (j) await sendMessage(a, j, { kind: "place", data: { name: t.dataset.name, zone: t.dataset.zone } }); phSound("send", { k: 0.6 }); return this.render();
      case "shareItem": { s.pop = null; const it = a.items.get(t.dataset.id); if (j && it) { const rk = it.system?.rank || ""; await sendMessage(a, j, { kind: "item", data: { name: it.name, img: it.img, uuid: it.uuid, rank: rk, rar: it.system?.rarity || "", color: (() => { try { return rankOf(getConfig(), rk)?.color || ""; } catch (e) { return ""; } })() } }); phSound("send", { k: 0.6 }); } return this.render(); }
      case "tpCard": return gmDo("tpRequest", { actor: a.uuid, place: t.dataset.name, zone: t.dataset.zone || "" }).then(r => { if (r && !game.user.isGM) ui.notifications.info(`Demande de téléportation vers « ${t.dataset.name} » envoyée au MJ.`); });
      case "itemCard": { const it = t.dataset.uuid ? await fromUuid(t.dataset.uuid).catch(() => null) : null; if (it?.testUserPermission?.(game.user, "LIMITED")) it.sheet.render(true); else ui.notifications.info("Cet objet appartient à quelqu'un d'autre."); return; }
      /* menus contextuels */
      case "react": { const p = j?.pages.get(s.ctx?.id); s.ctx = null; if (p) { const cur = mOf(p).re?.[K(a.uuid)]; await p.update({ [`flags.${SYS}.m.re.${K(a.uuid)}`]: cur === t.dataset.e ? null : t.dataset.e }); } return this.render(); }
      case "reply": s.reply = s.ctx?.id; s.ctx = null; this._focus = true; return this.render();
      case "copy": { const p = j?.pages.get(s.ctx?.id); s.ctx = null; try { await navigator.clipboard.writeText(mOf(p)?.text || ""); ui.notifications.info("Copié."); } catch (e) {} return this.render(); }
      case "delMe": { const p = j?.pages.get(s.ctx?.id); s.ctx = null; if (p) await p.update({ [`flags.${SYS}.m.hide.${K(a.uuid)}`]: true }); return this.render(); }
      case "delAll": { const p = j?.pages.get(s.ctx?.id); s.ctx = null; if (p) await p.update({ [`flags.${SYS}.m.del`]: true, [`flags.${SYS}.m.text`]: "", [`flags.${SYS}.m.img`]: "", [`flags.${SYS}.m.data`]: null }); return this.render(); }
      case "pin": case "arch": { const key = act === "pin" ? "pinned" : "archived"; const id = s.ctx?.id; s.ctx = null; const l = new Set(phoneOf(a)[key] || []); l.has(id) ? l.delete(id) : l.add(id); await setPhone(a, { [key]: [...l] }); return this.render(); }
      case "mute": { const id = s.ctx?.id; s.ctx = null; await setPhone(a, { [`muted.${id}`]: !phoneOf(a).muted?.[id] }); return this.render(); }
      case "delConv": { const id = s.ctx?.id || s.conv; s.ctx = null; const c = game.journal.get(id); if (!c) return;
        const ok = await DialogV2.confirm({ window: { title: "Supprimer la conversation", icon: "fa-solid fa-trash" }, classes: ["ms-dialog"], content: `<p>Supprimer la conversation <b>${esc(convTitle(c, a))}</b> ?</p><p class="ms-mhint">Elle disparaît pour tous ses membres, avec ses messages recopiés dans le chat.</p>` }); if (!ok) return;
        await gmDo("phDelConv", { id }); if (s.conv === id) { s.conv = null; s.scr = "messages"; } return this.render(); }
      case "block": { const u = t.dataset.uuid; const l = new Set(phoneOf(a).blocked || []); l.has(u) ? l.delete(u) : l.add(u); await setPhone(a, { blocked: [...l] }); return this.render(); }
      case "addContact": { const u = t.dataset.uuid; const l = new Set(phoneOf(a).contacts || []); l.add(u); await setPhone(a, { contacts: [...l] }); ui.notifications.info(`${actorOf(u)?.name} ajouté aux contacts.`); return this.render(); }
      case "delContact": { const u = t.dataset.uuid; await setPhone(a, { contacts: (phoneOf(a).contacts || []).filter(x => x !== u) }); s.scr = "contacts"; return this.render(); }
      case "addNum": { const inp = this.el.querySelector("input[data-phnum]"); const q = String(inp?.value || "").trim(); if (!q) return; const o = actorByNumber(q);
        /* 1.37 : numéro inconnu ou nom (ex. un PNJ) : la demande part chez le MJ, qui accepte ou refuse */
        if (!o) { if (game.user.isGM) return ui.notifications.warn("Aucun téléphone ne répond à ce numéro."); if (!activeGM()) return ui.notifications.warn("Aucun MJ connecté pour transmettre la demande.");
          game.socket.emit(`system.${SYS}`, { op: "phContactReq", user: game.user.id, actor: a.uuid, q }); inp.value = ""; ui.notifications.info(`Demande envoyée au MJ : ajouter « ${q} » à tes contacts.`); return; } if (o.uuid === a.uuid) return ui.notifications.warn("C'est ton propre numéro."); const l = new Set(phoneOf(a).contacts || []); l.add(o.uuid); await setPhone(a, { contacts: [...l] }); ui.notifications.info(`${o.name} ajouté aux contacts.`); return this.render(); }
      case "contact": s.contact = t.dataset.uuid; s.scr = "contact"; return this.render();
      /* groupes */
      case "groupName": { const n = await askText("Renommer le groupe", "Nom", convData(j).name); if (n) await gmDo("phMembers", { id: j.id, name: n }); return; }
      case "groupImg": return pickFile(src => gmDo("phMembers", { id: j.id, img: src }));
      case "groupAdd": { const l = await pickRecipients({ title: "Ajouter des membres", viewer: a, multi: true, phone: true, exclude: convData(j).members }); if (l?.length) await gmDo("phMembers", { id: j.id, add: l }); return; }
      case "groupDel": return gmDo("phMembers", { id: j.id, remove: [t.dataset.uuid] });
      case "groupLeave": { const ok = await DialogV2.confirm({ window: { title: "Quitter le groupe" }, classes: ["ms-dialog"], content: `<p>Quitter « ${esc(convData(j).name)} » ?</p>` }); if (!ok) return; await gmDo("phMembers", { id: j.id, remove: [a.uuid] }); s.conv = null; s.scr = "messages"; return this.render(); }
      /* réglages */
      case "preview": { const P = phoneOf(a); const sn = t.dataset.snd === "ring" ? (P.ring || "ring_classic") : (P.notif || "notif_ping"); return phSound(sn); }
      case "bubbleX": await setPhone(a, { bubble: "" }); return this.render();
      case "phWin": { if (this.opts.win) return this.opts.win.minimize(); const h = this.opts.menu; if (!h) return;
        const app = PhoneApp.open(this.getActor?.() || this.actor); if (h.element?.classList.contains("ms-fs")) { const F = await import("./fullscreen.js"); F.fsMinimize?.(h, true); } else h.minimize?.(); return app; }
      case "wslot": this.s.wslot = t.dataset.k; return this.render();
      case "wpack": this.s.wcat = { ...(this.s.wcat || {}), pack: t.dataset.k, page: 0 }; return this.render();
      case "wpage": { const c = (this.s.wcat ||= { pack: "all", q: "", page: 0 }); c.page = Math.max(0, (c.page || 0) + Number(t.dataset.k)); return this.render(); }
      case "wpick": { const k = t.dataset.k; const slot = this.s.wslot || "home"; if (k !== "__same" && !game.user.isGM && !wallOwned(game.user, k)) return ui.notifications.info("Fond verrouillé : il se débloque à l'unité ou avec son pack (Boutique stellaire ou MJ).");
        await setPhone(a, slot === "lock" ? { lockWall: k === "__same" ? "" : (k || "none") } : { wall: k }); return this.render(); }
      case "wpickImg": { if (!game.user.isGM && !unlocked(game.user, "wall:custom")) return ui.notifications.info("Fond personnalisé verrouillé : à débloquer (Boutique stellaire ou MJ).");
        const slot = this.s.wslot || "home"; return pickFile(src => setPhone(a, { [slot === "lock" ? "lockWall" : "wall"]: `img:${src}`, [`wallFx.${slot}`]: { z: 100, x: 50, y: 50, tone: "dark", veil: 35 } }).then(() => this.render())); }
      case "avatar": return pickFile(src => setPhone(a, { avatar: src }).then(() => this.render()));
      case "frame": await setPhone(a, { frame: t.dataset.k }); return this.render();
      case "carnet": { const m = this.opts.menu; if (m) { m.tab = "notes"; m.render(); } return; }
      case "note": return game.journal.get(t.dataset.id)?.sheet.render(true);
      case "gmCall": { const g = k => this.el.querySelector(`[data-gm="${k}"]`)?.value; const from = actorOf(g("from")), to = actorOf(g("to")); if (!from || !to) return ui.notifications.warn("Choisis l'appelant et le destinataire."); let c = findDirect(from, to) || await newConv([from.uuid, to.uuid]); if (c) startCall(from, c, { script: g("text") || "" }); return; }
    }
  },
  async msgTo(uuid) { const a = this.actor; const o = actorOf(uuid); if (!o) return; let c = findDirect(a, o); if (!c) c = await newConv([a.uuid, o.uuid]); if (c) this.open(c.id); },
  async setting(i) {
    const a = this.actor; const k = i.dataset.phset; const v = i.type === "checkbox" ? i.checked : i.value; const j = this.conv;
    switch (k) {
      case "convMute": return setPhone(a, { [`muted.${j.id}`]: v });
      case "wfx": { const slot = this.s.wslot || "home"; await setPhone(a, { [`wallFx.${slot}.${i.dataset.f}`]: Number(v) || 0 }); return this.render(); }
      case "wtone": { const slot = this.s.wslot || "home"; await setPhone(a, { [`wallFx.${slot}.tone`]: v }); return this.render(); }
      case "wq": this.s.wcat = { ...(this.s.wcat || {}), q: v, page: 0 }; return this.render();
      case "convWall": if (v === "__img") return pickFile(src => setPhone(a, { [`walls.${j.id}`]: `img:${src}` }).then(() => this.render())); return setPhone(a, { [`walls.${j.id}`]: v }).then(() => this.render());
      case "gmView": this.s.view = v || null; this.s.scr = v ? "home" : "gm"; return this.render();
      case "gmUser": this.s.gmUser = v; return this.render();
      case "unlock": { const u = this.s.gmUser || game.users.find(x => !x.isGM)?.id; return unlockCosmetic(u, i.dataset.id, v); }
      case "store": { if (!game.user.isGM) return; const c = { ...storeCfg(), [i.dataset.id]: v }; await game.settings.set(SYS, "phoneStore", c); return this.render(); }
      case "sig": return game.scenes.get(i.dataset.id)?.setFlag(SYS, "noSignal", !v);
      case "numOf": return setPhone(actorOf(i.dataset.uuid), { number: v.trim() });
      case "number": return setPhone(a, { number: v.trim() });
      default: return setPhone(a, { [k]: v }).then(() => this.render());
    }
  },
  async send() {
    const a = this.actor, j = this.conv; if (!a || !j) return; const ta = this.el.querySelector("textarea[data-phtext]"); const text = String(ta?.value ?? this.s.draft).trim(); const img = this.s.img?.src || "";
    if (!text && !img) return; if (!a.isOwner) return ui.notifications.warn("Tu ne peux écrire qu'au nom de tes personnages.");
    const m = { text, img, fx: this.s.fx || "", reply: this.s.reply || "" }; this.s.draft = ""; this.s.img = null; this.s.reply = null; this.s.pop = null; this.s.fx = ""; this._focus = true; this._scrollEnd = true;
    if (ta) ta.value = ""; await sendMessage(a, j, m); phSound("send", { k: 0.6 }); typingStop(j, a); this.render();
  },
  async attach(file) {
    if (!file.type.startsWith("image/")) return ui.notifications.warn("Seules les images peuvent être envoyées.");
    try { const { compress } = await import("./mail.js"); ui.notifications.info("Compression de l'image…"); const { blob, type, w, h } = await compress(file); if (!blob) throw new Error("compression impossible");
      const src = await uploadBlob(blob, type); this.s.img = { src, label: `${w}×${h} · ${Math.round(blob.size / 1024)} ko` }; this._focus = true; this.render(); }
    catch (err) { console.error(SYS, err); ui.notifications.error(`Image impossible à envoyer : ${err.message}`); }
  }
});
async function uploadBlob(blob, type) {
  const ext = type === "image/webp" ? "webp" : "jpg"; const name = `${now().toString(36)}-${foundry.utils.randomID(4)}.${ext}`; const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
  if (game.user.can("FILES_UPLOAD")) { const forge = typeof ForgeVTT !== "undefined" && ForgeVTT.usingTheForge; const source = forge ? "forgevtt" : "data"; const dir = forge ? "manhwa-mail" : `worlds/${game.world.id}/manhwa-mail`;
    try { await FP.createDirectory(source, dir, {}).catch(() => {}); const r = await FP.upload(source, dir, new File([blob], name, { type }), {}, { notify: false }); const src = r?.path || r?.url; if (src) return src; } catch (e) { console.warn(SYS, e); } }
  return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
}
function pickFile(cb) { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; new FP({ type: "image", callback: p => cb(p) }).render(true); }
async function askText(title, label, value = "") { const r = await DialogV2.prompt({ window: { title }, classes: ["ms-dialog"], content: `<div class="ms-form"><label>${esc(label)}<input type="text" name="v" value="${esc(value)}" autofocus></label></div>`, ok: { label: "Valider", callback: (ev, btn) => btn.form.elements.v.value.trim() }, rejectClose: false }); return r || null; }

/* ── choisir des destinataires : recherche façon Roll20 (voir pickers) ── */
async function pickRecipients(o) { const { recipientPicker } = await import("./pickers.js"); return recipientPicker(o); }

/* ══════════════════════════ « en train d'écrire », notifications, appels ══════════════════════════ */
let typT = 0;
function typingPing(j, a) { if (!j || !a || now() - typT < 1500) return; typT = now(); game.socket.emit(`system.${SYS}`, { op: "phTyping", conv: j.id, from: a.uuid }); }
function typingStop(j, a) { typT = 0; game.socket.emit(`system.${SYS}`, { op: "phTyping", conv: j.id, from: a.uuid, stop: true }); }

/* bannières en haut de l'écran */
function toastBox() { let b = document.getElementById("ms-ph-toasts"); if (!b) { b = document.createElement("div"); b.id = "ms-ph-toasts"; document.body.appendChild(b); } return b; }
export function phBanner({ img, title, text, onClick, cls = "" }) {
  const b = toastBox(); const t = document.createElement("div"); t.className = `ms-ph-toast ${cls}`; t.innerHTML = `<i class="fa-solid fa-mobile-screen-button ap"></i>${img ? `<img src="${esc(img)}">` : ""}<div><b>${esc(title)}</b><small>${esc(text)}</small></div>`;
  t.addEventListener("click", () => { t.remove(); onClick?.(); }); b.appendChild(t); requestAnimationFrame(() => t.classList.add("on"));
  setTimeout(() => { t.classList.remove("on"); setTimeout(() => t.remove(), 400); }, 5500); while (b.children.length > 4) b.firstChild.remove();
}
const vibrate = a => { if (phoneOf(a).vibe === false) return; for (const v of VIEWS) if (v.el?.isConnected) { v.el.classList.remove("ph-vibe"); void v.el.offsetWidth; v.el.classList.add("ph-vibe"); } };
/* ouvrir le téléphone d'un personnage sur une conversation */
export async function openPhone(actor, convId = null) { const app = PhoneApp.open(actor); if (convId) { await new Promise(r => setTimeout(r, 80)); app.view.open(convId); } return app; }

Hooks.on("createJournalEntryPage", (page, opts, userId) => {
  const j = page.parent; if (!isConv(j)) return; refreshViews(); const m = mOf(page); if (!m || userId === game.user.id || m.kind === "call") return;
  const targets = (convData(j).members || []).map(actorOf).filter(a => a && a.uuid !== m.from && mine(a) && !(phoneOf(a).blocked || []).includes(m.from)); if (!targets.length) return;
  const a = targets[0]; const P = phoneOf(a); const from = actorOf(m.from);
  const openHere = [...VIEWS].some(v => v.el?.isConnected && v.s.scr === "thread" && v.s.conv === j.id && v.actor?.uuid === a.uuid && !document.hidden);
  if (P.dnd || P.muted?.[j.id]) return;
  if (openHere) return phSound(P.notif || "notif_ping", { k: 0.5 });
  phSound(P.notif || "notif_ping"); vibrate(a);
  phBanner({ img: convData(j).group ? (convData(j).img || avatarOf(from)) : avatarOf(from), title: convData(j).group ? `${convTitle(j, a)} · ${contactName(a, from)}` : contactName(a, from), text: preview(page, null), onClick: () => openPhone(a, j.id) });
});
Hooks.on("updateJournalEntryPage", page => { if (isConv(page.parent)) refreshViews(); });
Hooks.on("deleteJournalEntryPage", page => { if (isConv(page.parent)) refreshViews(); });
for (const h of ["createJournalEntry", "updateJournalEntry", "deleteJournalEntry"]) Hooks.on(h, j => { if (isConv(j)) refreshViews(); });
Hooks.on("updateActor", (a, ch) => { if (foundry.utils.hasProperty(ch, `flags.${SYS}.phone`)) refreshViews(); });
Hooks.on("updateUser", (u, ch) => { if (foundry.utils.hasProperty(ch, `flags.${SYS}.phoneUnlocks`)) refreshViews(); });
/* le dossier des conversations n'apparaît pas dans l'onglet Journal */
Hooks.on("renderJournalDirectory", (app, html) => { const el = html instanceof HTMLElement ? html : html?.[0] ?? app.element; const f = game.folders.find(x => x.type === "JournalEntry" && x.getFlag(SYS, "phone")); if (!f || !el) return; el.querySelectorAll(`[data-folder-id="${f.id}"]`).forEach(n => n.remove()); el.querySelectorAll("li.directory-item.entry").forEach(li => { if (isConv(game.journal.get(li.dataset.entryId))) li.remove(); }); });

/* ── appels (faux appels : sonnerie, décrocher / refuser, chronomètre, journal) ── */
let CALL = null;   /* { id, conv, from, to:[], role:"out"|"in", start, snd, timer, me, script } */
const emit = d => game.socket.emit(`system.${SYS}`, d);
function callBox() { let b = document.getElementById("ms-ph-call"); if (!b) { b = document.createElement("div"); b.id = "ms-ph-call"; document.body.appendChild(b); } return b; }
function callUI() {
  const b = callBox(); if (!CALL) { b.className = ""; b.innerHTML = ""; return; }
  const me = actorOf(CALL.me); const other = CALL.role === "out" ? null : actorOf(CALL.from); const j = game.journal.get(CALL.conv);
  const title = CALL.role === "out" ? (j ? convTitle(j, me) : "…") : contactName(me, other); const img = CALL.role === "out" ? (j ? convImg(j, me) : "") : avatarOf(other);
  const st = CALL.state;
  b.className = `on ${st}`;
  b.innerHTML = `<img src="${esc(img)}"><div class="tx"><b>${esc(title)}</b><small>${st === "ringing" ? (CALL.role === "out" ? "Appel en cours…" : "Appel entrant…") : st === "live" ? `<span data-dur>0:00</span>` : esc(CALL.end || "")}</small>${st === "live" && CALL.script ? `<p class="script">« ${esc(CALL.script)} »</p>` : ""}</div>
    <div class="bt">${st === "ringing" && CALL.role === "in" ? `<a class="ok" data-c="ans" title="Décrocher"><i class="fa-solid fa-phone"></i></a>` : ""}${st !== "ended" ? `<a class="ko" data-c="end" title="${st === "ringing" && CALL.role === "in" ? "Refuser" : "Raccrocher"}"><i class="fa-solid fa-phone-slash"></i></a>` : ""}</div>`;
  b.querySelector('[data-c="ans"]')?.addEventListener("click", answerCall); b.querySelector('[data-c="end"]')?.addEventListener("click", () => endCall(CALL.role === "in" && CALL.state === "ringing" ? "refused" : "hang"));
}
function tickDur() { const el = document.querySelector("#ms-ph-call [data-dur]"); if (el && CALL?.start) el.textContent = fmtDur((now() - CALL.start) / 1000); }
export async function startCall(a, j, { script = "" } = {}) {
  if (CALL) return ui.notifications.warn("Un appel est déjà en cours.");
  if (noSignal() && !script) return ui.notifications.warn("Pas de réseau.");
  const to = (convData(j).members || []).filter(u => u !== a.uuid); if (!to.length) return;
  CALL = { id: foundry.utils.randomID(12), conv: j.id, from: a.uuid, to, role: "out", state: "ringing", me: a.uuid, script, t0: now() };
  CALL.snd = phSound("ringback", { loop: true, k: 0.7 }); callUI(); emit({ op: "phCall", id: CALL.id, conv: j.id, from: a.uuid, to, script });
  CALL.timer = setTimeout(() => { if (CALL?.state === "ringing" && CALL.role === "out") endCall("missed"); }, 30000);
}
function answerCall() { if (!CALL || CALL.role !== "in") return; stopSound(CALL.snd); CALL.state = "live"; CALL.start = now(); emit({ op: "phCallAns", id: CALL.id, by: CALL.me, user: game.user.id }); callUI(); CALL.iv = setInterval(tickDur, 500); }
async function endCall(reason, remote = false) {
  if (!CALL) return; const c = CALL; stopSound(c.snd); clearTimeout(c.timer); clearInterval(c.iv);
  if (!remote) emit({ op: "phCallEnd", id: c.id, reason });
  if (c.role === "out") { const j = game.journal.get(c.conv); const a = actorOf(c.from); const status = c.state === "live" ? "answered" : reason === "refused" ? "refused" : "missed";
    if (j && a) await sendMessage(a, j, { kind: "call", data: { status, dur: c.start ? Math.round((now() - c.start) / 1000) : 0 } }); }
  phSound("hangup", { k: 0.6 }); CALL.state = "ended"; CALL.end = reason === "refused" ? "Refusé" : reason === "missed" ? (c.role === "out" ? "Pas de réponse" : "Appel manqué") : "Appel terminé"; callUI();
  setTimeout(() => { if (CALL === c) { CALL = null; callUI(); } }, 1600);
}
Hooks.once("ready", () => {
  game.socket.on(`system.${SYS}`, msg => {
    if (!msg?.op?.startsWith?.("ph")) return;
    if (msg.op === "phAppReq") { if (game.users.activeGM?.id === game.user.id) appRequest(msg); return; }
    if (msg.op === "phContactReq") { if (game.users.activeGM?.id === game.user.id) contactRequest(msg); return; }
    if (msg.op === "phContactRes") { if (msg.to !== game.user.id) return; refreshViews(); phBanner({ img: msg.img || "icons/svg/mystery-man.svg", title: "Contacts", text: msg.ok ? `${msg.name} a été ajouté à tes contacts.` : msg.none ? `Personne ne répond à « ${msg.q} ».` : `Le MJ a refusé : « ${msg.q} » n'a pas été ajouté.` }); if (msg.ok) phSound("notif_chime", { k: 0.6 }); return; }
    if (msg.op === "phShare") { if (msg.to !== game.user.id) return; const me = game.user.character || game.actors.find(x => x.type === "character" && x.isOwner); if (!me) return;
      phSound(phoneOf(me).notif || "notif_ping", { k: 0.7 });
      phBanner({ img: msg.img, title: "Share", text: `${msg.name} t'a partagé son numéro (${msg.number}). Clique pour l'ajouter.`, onClick: async () => { const l = new Set(phoneOf(me).contacts || []); l.add(msg.from); await setPhone(me, { contacts: [...l] }); ui.notifications.info(`${msg.name} ajouté aux contacts.`); refreshViews(); } }); return; }
    if (msg.op === "phAppRes") { if (msg.to !== game.user.id) return; for (const v of VIEWS) v.s.asked?.delete(msg.app); refreshViews(); phBanner({ img: "icons/svg/item-bag.svg", title: "Store", text: msg.ok ? `« ${msg.name} » est autorisée et installée.` : `Le MJ a refusé « ${msg.name} ».` }); if (msg.ok) phSound("notif_chime", { k: 0.6 }); return; }
    if (msg.op === "phTyping") { (TYPING[msg.conv] ||= {})[msg.from] = msg.stop ? 0 : now() + 3500; refreshViews(); if (!msg.stop) setTimeout(refreshViews, 3700); return; }
    if (msg.op === "phCall") {
      const target = (msg.to || []).map(actorOf).find(a => mine(a)); if (!target || CALL) return; if ((phoneOf(target).blocked || []).includes(msg.from)) return;
      CALL = { id: msg.id, conv: msg.conv, from: msg.from, to: msg.to, role: "in", state: "ringing", me: target.uuid, script: msg.script || "" };
      const P = phoneOf(target); if (!P.dnd && !P.muted?.[msg.conv]) { CALL.snd = phSound(P.ring || "ring_classic", { loop: true }); vibrate(target); }
      callUI(); CALL.timer = setTimeout(() => { if (CALL?.id === msg.id && CALL.state === "ringing") { stopSound(CALL.snd); CALL.state = "ended"; CALL.end = "Appel manqué"; callUI(); setTimeout(() => { if (CALL?.id === msg.id) { CALL = null; callUI(); } }, 1600); } }, 31000); return;
    }
    if (!CALL || msg.id !== CALL.id) return;
    if (msg.op === "phCallAns") { if (CALL.role === "out") { stopSound(CALL.snd); clearTimeout(CALL.timer); CALL.state = "live"; CALL.start = now(); callUI(); CALL.iv = setInterval(tickDur, 500); } else if (msg.by !== CALL.me || (msg.user && msg.user !== game.user.id)) { stopSound(CALL.snd); clearTimeout(CALL.timer); CALL = null; callUI(); } return; }
    if (msg.op === "phCallEnd") return endCall(msg.reason === "hang" && CALL.state === "ringing" && CALL.role === "in" ? "missed" : msg.reason, true);
  });
});

/* demande d'appli reçue par le MJ : accepter (déblocage + installation) ou refuser */
/* 1.37 : un joueur veut ajouter un contact par son nom (ex. un PNJ) ou un numéro qu'il ne voit pas : le MJ décide */
async function contactRequest({ user, actor, q }) {
  const u = game.users.get(user), a = actorOf(actor); if (!u || !a) return;
  const norm = x => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); const nq = norm(q);
  const pool = game.actors.filter(o => ["character", "npc"].includes(o.type) && o.uuid !== a.uuid && !isGmPhone(o));
  let hits = pool.filter(o => idKey(numberOf(o)) === idKey(q) && idKey(q).length >= 4); if (!hits.length) hits = pool.filter(o => norm(o.name) === nq); if (!hits.length) hits = pool.filter(o => norm(o.name).includes(nq)).slice(0, 12);
  const reply = d => game.socket.emit(`system.${SYS}`, { op: "phContactRes", to: user, q, ...d });
  if (!hits.length) { ui.notifications.info(`Contacts : ${u.name} (${a.name}) a cherché « ${q} », aucun personnage ne correspond.`); return reply({ ok: false, none: true }); }
  const opts = hits.map((o, i) => `<option value="${o.uuid}"${i ? "" : " selected"}>${esc(o.name)}${o.hasPlayerOwner ? " (joueur)" : ""}</option>`).join("");
  const pick = await foundry.applications.api.DialogV2.wait({ window: { title: "Contacts — demande d'ajout", icon: "fa-solid fa-address-book" }, classes: ["ms-dialog"], rejectClose: false,
    content: `<p><b>${esc(u.name)}</b> (${esc(a.name)}) veut ajouter <b>« ${esc(q)} »</b> à ses contacts.</p><label>Personnage<select name="who">${opts}</select></label>`,
    buttons: [{ action: "ok", label: "Accepter", icon: "fa-solid fa-check", default: true, callback: (ev, b) => b.form.elements.who.value }, { action: "no", label: "Refuser", icon: "fa-solid fa-xmark" }] }).catch(() => null);
  const o = pick && pick !== "no" ? actorOf(pick) : null;
  if (!o) return reply({ ok: false });
  const cur = new Set(phoneOf(a).contacts || []); cur.add(o.uuid); await a.update({ [`flags.${SYS}.phone.contacts`]: [...cur] });
  reply({ ok: true, name: o.name, img: avatarOf(o) });
}
async function appRequest({ user, actor, app, name }) {
  const u = game.users.get(user), a = actorOf(actor); if (!u || !a) return;
  const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Store — demande d'appli", icon: "fa-solid fa-bag-shopping" }, classes: ["ms-dialog"], content: `<p><b>${esc(u.name)}</b> (${esc(a.name)}) demande à installer l'appli <b>${esc(name)}</b> sur son téléphone.</p>`, yes: { label: "Autoriser", icon: "fa-solid fa-check" }, no: { label: "Refuser", icon: "fa-solid fa-xmark" }, rejectClose: false }).catch(() => false);
  if (ok) { await unlockCosmetic(u.id, `app:${app}`, true); const cur = Array.isArray(phoneOf(a).apps) ? phoneOf(a).apps : ["gallery"]; await a.update({ [`flags.${SYS}.phone.apps`]: [...new Set([...cur, app])] }); }
  game.socket.emit(`system.${SYS}`, { op: "phAppRes", to: user, ok: !!ok, app, name });
}

/* ── au démarrage : reprise des anciens messages, messages non lus pendant l'absence ── */
Hooks.once("ready", () => {
  setTimeout(() => { migrate().catch(e => console.error(SYS, e)); }, 2500);
  setTimeout(() => { for (const a of myPhones()) { const n = unreadTotal(a), mc = missedCalls(a); if ((n || mc) && !phoneOf(a).dnd) phBanner({ img: avatarOf(a), title: `Téléphone de ${a.name}`, text: [n && `${n} message${n > 1 ? "s" : ""} non lu${n > 1 ? "s" : ""}`, mc && `${mc} appel${mc > 1 ? "s" : ""} manqué${mc > 1 ? "s" : ""}`].filter(Boolean).join(" · "), onClick: () => openPhone(a) }); } }, 4000);
});
Hooks.once("init", () => {
  game.settings.register(SYS, "phoneVol", { name: "Téléphone : volume", hint: "Volume des sons du téléphone (notifications, sonneries) pour toi.", scope: "client", config: true, type: Number, range: { min: 0, max: 100, step: 5 }, default: 25 });
  game.settings.register(SYS, "phoneStore", { scope: "world", config: false, type: Object, default: {}, onChange: () => refreshViews() });
  game.settings.register(SYS, "phoneMigV", { scope: "world", config: false, type: Number, default: 0 });
  game.keybindings?.register(SYS, "openPhone", { name: "Ouvrir le téléphone", hint: "Par défaut : P (modifiable dans Configurer les contrôles).", editable: [{ key: "KeyP" }], precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL, onDown: () => { if (game.user.isGM && !game.user.character) { openGmPhone("home"); return true; } const a = game.user.character || myPhones()[0]; if (a) openPhone(a); return true; } });
});

/* ── 1.36 : téléphone du MJ — un appareil à lui (acteur caché « Téléphone du MJ »), jamais celui d'un joueur ── */
export const isGmPhone = a => !!a?.getFlag?.(SYS, "gmPhone");
export async function gmPhoneActor() {
  let a = game.actors.find(isGmPhone); if (a || !game.user.isGM) return a || null;
  a = await Actor.create({ name: "Téléphone du MJ", type: "npc", img: "icons/svg/mystery-man.svg", ownership: { default: 0 }, flags: { [SYS]: { gmPhone: true } } }, { renderSheet: false });
  return a;
}
export async function openGmPhone(screen = "gm") {
  if (!game.user.isGM) return null; const a = await gmPhoneActor(); if (!a) return null; const app = PhoneApp.open(a); if (!app) return null;
  setTimeout(() => { try { app.view.s.view = null; app.view.s.scr = screen; app.view.render(); } catch (e) { console.warn(SYS, e); } }, 200); return app;
}
/* ── fenêtre du téléphone (raccourci, macro, touche) ── */
export class PhoneApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = { classes: ["ms-sheet", "ms-phone-app"], window: { resizable: true, icon: "fa-solid fa-mobile-screen-button" }, position: { width: 400, height: 720 } };
  static MIN_SIZE = { w: 320, h: 480 };
  static open(actor) { actor ||= game.user.character || myPhones()[0]; if (!actor) { ui.notifications.warn("Aucun personnage."); return null; } const id = `ms-phone-${actor.id}`; let app = foundry.applications.instances.get(id); if (!app) app = new PhoneApp({ id }, actor); app.render({ force: true }); return app; }
  constructor(o, actor) { super(o); this.actor = actor; this.view = new PhoneView(() => this.actor, { win: this }); }
  get title() { return `Téléphone — ${this.actor.name}`; }
  async _renderHTML() { return `<div class="ph-host"></div>`; }
  _replaceHTML(r, c) { const fk = focusKey(c); c.innerHTML = r; this.view.mount(c.querySelector(".ph-host")); focusBack(c, fk); }
}

/* ── onglet du Menu (Messagerie → téléphone) ── */
export const phoneTab = {
  render: () => `<div class="ph-host"></div>`,
  bind: (app, root) => { app._phone ||= new PhoneView(() => app.actor, { menu: app }); const h = root.querySelector(".ph-host"); if (h) app._phone.mount(h); if (app._phoneTo) { const u = app._phoneTo; app._phoneTo = null; app._phone.s.scr = "home"; app._phone.msgTo(u); } }
};
export const phoneBadge = a => unreadTotal(a) + missedCalls(a);
/* Inter-node : les contrats changent → les téléphones ouverts sur l'appli se redessinent */
Hooks.on("updateSetting", st => { if (st.key === `${SYS}.quests` && [...VIEWS].some(v => v.s?.scr === "internode")) refreshViews(); });
