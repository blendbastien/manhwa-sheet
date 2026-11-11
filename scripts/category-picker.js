/* Manhwa Sheet — category picker: cascading lists over the item tree (type › family › category › sub-category) */
import { esc, flattenTree } from "./config.js";
const DialogV2 = foundry.applications.api.DialogV2;

export async function pickCategory(cfg, rootId = "", startId = "", currentId = "") {
  const roots = cfg.items; const all = flattenTree(cfg.items);
  const cur = all.find(n => n.id === (currentId || startId)); const path = []; let n = cur; while (n) { path.unshift(n.id); n = n.parent; }
  if (!path.length && rootId) path.push(rootId);
  const content = `<div class="ms-catpick"><div class="ms-cols"></div><div class="ms-catpath"><i class="fa-solid fa-sitemap"></i><span class="p">—</span></div><input type="hidden" name="cat" value=""></div>`;
  return DialogV2.prompt({ window: { title: "Choisir une catégorie", icon: "fa-solid fa-sitemap" }, classes: ["ms-dialog", "ms-catdlg"], position: { width: 720 }, content,
    ok: { label: "Choisir", callback: (ev, btn) => btn.form.elements.cat.value || null },
    render: (ev, dlg) => {
      const el = dlg?.element ?? dlg; const cols = el.querySelector(".ms-cols"), hid = el.querySelector('[name="cat"]'), out = el.querySelector(".ms-catpath .p"), okBtn = el.querySelector('button[data-action="ok"]');
      let sel = [...path];
      const draw = () => {
        cols.innerHTML = ""; let level = roots; let depth = 0;
        while (level && level.length) {
          const chosen = level.find(x => x.id === sel[depth]);
          const col = document.createElement("div"); col.className = "ms-col";
          col.innerHTML = level.map(x => `<a data-id="${x.id}" class="${x.id === sel[depth] ? "on" : ""}${x.children?.length ? " has" : ""}">${x.icon ? `<i class="fa-solid ${esc(x.icon)}"></i>` : ""}<span>${esc(x.name)}</span>${x.children?.length ? '<i class="fa-solid fa-angle-right more"></i>' : ""}</a>`).join("");
          const d = depth; col.querySelectorAll("a").forEach(a => a.addEventListener("click", () => { sel = sel.slice(0, d); sel.push(a.dataset.id); draw(); }));
          cols.appendChild(col); level = chosen?.children; depth++;
        }
        const leaf = all.find(x => x.id === sel[sel.length - 1]); const ok = leaf && !(leaf.children?.length);
        out.textContent = sel.map(id => all.find(x => x.id === id)?.name).filter(Boolean).join(" › ") || "—"; hid.value = ok ? leaf.id : ""; if (okBtn) okBtn.disabled = !ok;
        cols.scrollLeft = cols.scrollWidth;
      };
      draw();
    } });
}
