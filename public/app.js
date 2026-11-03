const $ = (id) => document.getElementById(id);
const state = { columns: [], items: [], pseudo: readCookie() };

function readCookie() {
  const m = document.cookie.match(/(?:^|;\s*)pseudo=([^;]*)/);
  try { return m ? decodeURIComponent(m[1]) : ""; } catch { return ""; }
}
function writeCookie(p) {
  document.cookie = `pseudo=${encodeURIComponent(p)}; path=/; max-age=${60 * 60 * 24 * 400}; samesite=lax; secure`;
  state.pseudo = p;
}

async function api(path, opts = {}) {
  const res = await fetch(`/api/${path}`, {
    ...opts,
    headers: { "x-recyclem": "1", ...(opts.body ? { "content-type": "application/json" } : {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`);
  return body;
}

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) n.append(c);
  return n;
}

const textCols = () => state.columns.filter((c) => c.type !== "image");
const imageCol = () => state.columns.find((c) => c.type === "image");
const titleCol = () => textCols()[0];

// Valeur affichée : lien, mail et téléphone sont cliquables.
function value(c, v) {
  const stop = (e) => e.stopPropagation();
  if (c.type === "url" && /^https?:\/\//i.test(v)) {
    let host = v;
    try { host = new URL(v).hostname.replace(/^www\./, ""); } catch {}
    return el("a", { href: v, target: "_blank", rel: "noopener noreferrer", onclick: stop }, host);
  }
  if (c.type === "email") return el("a", { href: `mailto:${v}`, onclick: stop }, v);
  if (c.type === "tel") return el("a", { href: `tel:${v.replace(/[^\d+]/g, "")}`, onclick: stop }, v);
  return v;
}

// ---------- pseudo ----------
function showPseudo() {
  $("pseudoBtn").textContent = state.pseudo ? `👤 ${state.pseudo}` : "Choisir un pseudo";
}
function askPseudo() {
  $("pseudoInput").value = state.pseudo;
  $("pseudoDlg").showModal();
}
$("pseudoForm").addEventListener("submit", () => {
  const p = $("pseudoInput").value.trim();
  if (p) { writeCookie(p); showPseudo(); load(); }
});
$("pseudoBtn").addEventListener("click", askPseudo);
function needPseudo() {
  if (state.pseudo) return true;
  askPseudo();
  return false;
}

// ---------- liste ----------
function matches(item, q) {
  if (!q) return true;
  const hay = [...Object.values(item.data), item.author, ...item.interested].join(" ").toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
}

function render() {
  const q = $("search").value.trim().toLowerCase();
  const only = $("onlyMine").checked;
  const list = state.items.filter((it) => matches(it, q) && (!only || it.mine));
  const grid = $("grid");
  grid.replaceChildren(...list.map(card));
  $("status").textContent = state.items.length === 0
    ? "La liste est vide. Ajoute la première ligne avec « + Ajouter »."
    : list.length === 0 ? "Rien ne correspond." : `${list.length} ligne${list.length > 1 ? "s" : ""}`;
}

function interestButton(item) {
  const n = item.interested.length;
  return el("button", {
    type: "button", class: `interest${item.mine ? " on" : ""}`, "aria-pressed": String(item.mine),
    title: n ? `Intéressé${n > 1 ? "s" : ""} : ${item.interested.join(", ")}` : "Personne pour l'instant",
    onclick: (e) => { e.stopPropagation(); toggleInterest(item); },
  }, item.mine ? "★ Ça m'intéresse" : "☆ Ça m'intéresse", n ? el("span", { class: "count" }, String(n)) : null);
}

function card(item) {
  const t = titleCol();
  const facts = textCols().filter((c) => c.card && item.data[c.key]);
  return el("article", { class: "card", tabindex: "0", onclick: () => openDetail(item),
    onkeydown: (e) => { if (e.key === "Enter") openDetail(item); } },
    item.hasImage
      ? el("img", { class: "thumb", src: `/api/items/${item.id}/image`, alt: "", loading: "lazy" })
      : el("div", { class: "thumb empty" }, "Pas de photo"),
    el("div", { class: "body" },
      el("h3", {}, item.data[t.key] || "(sans titre)"),
      el("dl", {}, facts.map((c) => [el("dt", {}, c.label), el("dd", {}, item.data[c.key])])),
      el("div", { class: "foot" }, interestButton(item))));
}

function openDetail(item) {
  const box = $("detail");
  box.replaceChildren(
    el("button", { class: "close ghost", type: "button", "aria-label": "Fermer", onclick: () => $("detailDlg").close() }, "✕"),
    item.hasImage ? el("img", { class: "big", src: `/api/items/${item.id}/image`, alt: "" }) : null,
    el("h2", {}, item.data[titleCol().key] || "(sans titre)"),
    el("dl", { class: "full" }, textCols().slice(1).filter((c) => item.data[c.key])
      .map((c) => [el("dt", {}, c.label), el("dd", { class: c.type === "long" ? "long" : null }, value(c, item.data[c.key]))])),
    el("p", { class: "hint" }, `Ajouté par ${item.author}`,
      item.interested.length ? ` · Intéressé(s) : ${item.interested.join(", ")}` : ""),
    el("div", { class: "actions" },
      el("button", { type: "button", class: "danger", onclick: () => removeItem(item) }, "Supprimer"),
      interestButton(item)));
  $("detailDlg").showModal();
}
$("detailDlg").addEventListener("click", (e) => { if (e.target === $("detailDlg")) $("detailDlg").close(); });

async function toggleInterest(item) {
  if (!needPseudo()) return;
  try {
    await api(`items/${item.id}/interest`, { method: item.mine ? "DELETE" : "POST" });
    await load();
    if ($("detailDlg").open) {
      const fresh = state.items.find((i) => i.id === item.id);
      fresh ? openDetail(fresh) : $("detailDlg").close();
    }
  } catch (e) { alert(e.message); }
}

async function removeItem(item) {
  if (!needPseudo()) return;
  if (!confirm(`Supprimer « ${item.data[titleCol().key]} » pour tout le monde ?`)) return;
  try {
    await api(`items/${item.id}`, { method: "DELETE" });
    $("detailDlg").close();
    await load();
  } catch (e) { alert(e.message); }
}

// ---------- ajout ----------
let pendingImage = null;

function buildForm() {
  const fields = state.columns.map((c) => {
    const id = `f_${c.key}`;
    let input;
    if (c.type === "image") {
      input = el("div", { class: "drop" },
        el("input", { id, type: "file", accept: "image/*", onchange: (e) => pickImage(e.target.files[0]) }),
        el("img", { id: "preview", alt: "", hidden: true }));
    } else if (c.type === "long") {
      input = el("textarea", { id, name: c.key, rows: "3", required: !!c.required });
    } else {
      const type = { url: "url", email: "email", tel: "tel" }[c.type] || "text";
      input = el("input", { id, name: c.key, type, required: !!c.required, list: `dl_${c.key}`,
        placeholder: c.type === "url" ? "https://…" : null });
    }
    // Suggestions tirées des valeurs déjà saisies (sauf texte long).
    const values = c.type !== "long" && c.type !== "image" ? [...new Set(state.items.map((i) => i.data[c.key]).filter(Boolean))].slice(0, 50) : [];
    return el("label", { class: `field${c.type === "long" || c.type === "image" ? " wide" : ""}` },
      el("span", {}, c.label, c.required ? " *" : ""), input,
      values.length ? el("datalist", { id: `dl_${c.key}` }, values.map((v) => el("option", { value: v }))) : null);
  });
  $("fields").replaceChildren(...fields);
}

async function pickImage(file) {
  pendingImage = null;
  const prev = $("preview");
  if (!file) { prev.hidden = true; return; }
  pendingImage = await shrink(file);
  prev.src = pendingImage;
  prev.hidden = false;
}

// Réduit l'image dans le navigateur (1280 px de côté au plus, JPEG).
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1280 / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * s);
      cv.height = Math.round(img.height * s);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      resolve(cv.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("Image illisible."));
    img.src = URL.createObjectURL(file);
  });
}

$("addBtn").addEventListener("click", () => {
  if (!needPseudo()) return;
  pendingImage = null;
  buildForm();
  $("addError").textContent = "";
  $("addDlg").showModal();
  $("addForm").querySelector("input:not([type=file]), textarea")?.focus();
});
$("addCancel").addEventListener("click", () => $("addDlg").close());
$("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {};
  for (const c of textCols()) data[c.key] = $(`f_${c.key}`).value;
  $("addSubmit").disabled = true;
  try {
    await api("items", { method: "POST", body: JSON.stringify({ data, image: imageCol() ? pendingImage : null }) });
    $("addDlg").close();
    await load();
  } catch (err) {
    $("addError").textContent = err.message;
  } finally {
    $("addSubmit").disabled = false;
  }
});

// ---------- démarrage ----------
async function load() {
  state.items = await api("items");
  render();
}

$("search").addEventListener("input", render);
$("onlyMine").addEventListener("change", render);

(async () => {
  showPseudo();
  try {
    state.columns = await api("columns");
    await load();
  } catch (e) {
    $("status").textContent = `Impossible de charger la liste : ${e.message}`;
  }
  if (!state.pseudo) askPseudo();
})();
