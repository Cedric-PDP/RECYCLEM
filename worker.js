// API de RECYCLEM : une liste partagée, un pseudo en cookie, pas de compte.
import { COLUMNS, TEXT_MAX, IMAGE_MAX } from "./columns.js";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS items (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     data TEXT NOT NULL,
     image BLOB,
     image_type TEXT,
     author TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS interests (
     item_id INTEGER NOT NULL,
     pseudo TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     PRIMARY KEY (item_id, pseudo))`,
];

let ready = false;
async function ensureSchema(db) {
  if (ready) return;
  for (const sql of SCHEMA) await db.prepare(sql).run();
  ready = true;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
const fail = (status, message) => json({ error: message }, status);

export function readPseudo(request) {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)pseudo=([^;]*)/);
  if (!m) return null;
  let p;
  try { p = decodeURIComponent(m[1]).trim(); } catch { return null; }
  return p && p.length <= 40 ? p : null;
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function parseItem(body) {
  if (!body || typeof body.data !== "object" || body.data === null) throw new Error("Données manquantes.");
  const data = {};
  for (const col of COLUMNS) {
    if (col.type === "image") continue;
    const v = body.data[col.key];
    const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
    if (s.length > TEXT_MAX) throw new Error(`« ${col.label} » est trop long.`);
    if (col.required && !s) throw new Error(`« ${col.label} » est obligatoire.`);
    if (s && col.type === "url" && !/^https?:\/\/\S+$/i.test(s)) throw new Error(`« ${col.label} » doit commencer par https://`);
    if (s && col.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error(`« ${col.label} » n'est pas une adresse mail.`);
    data[col.key] = s;
  }
  let image = null;
  if (body.image) {
    const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(body.image);
    if (!m || !IMAGE_TYPES.has(m[1])) throw new Error("Image illisible.");
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    if (bytes.length > IMAGE_MAX) throw new Error("Image trop lourde.");
    image = { bytes, type: m[1] };
  }
  return { data, image };
}

async function listItems(db, pseudo) {
  const { results } = await db.prepare(
    `SELECT i.id, i.data, i.author, i.created_at, i.image IS NOT NULL AS has_image,
            (SELECT group_concat(pseudo, char(10)) FROM interests WHERE item_id = i.id) AS interested
       FROM items i ORDER BY i.id DESC`).all();
  return results.map((r) => {
    const interested = r.interested ? r.interested.split("\n").sort((a, b) => a.localeCompare(b, "fr")) : [];
    return {
      id: r.id, data: JSON.parse(r.data), author: r.author, createdAt: r.created_at,
      hasImage: !!r.has_image, interested, mine: pseudo ? interested.includes(pseudo) : false,
    };
  });
}

export async function handleApi(request, env) {
  const db = env.DB;
  await ensureSchema(db);
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const method = request.method;
  const pseudo = readPseudo(request);

  if (parts[0] === "columns" && method === "GET") return json(COLUMNS);

  if (parts[0] !== "items") return fail(404, "Introuvable.");

  if (parts.length === 1 && method === "GET") return json(await listItems(db, pseudo));

  if (method !== "GET" && request.headers.get("x-recyclem") !== "1") return fail(403, "Requête refusée.");
  if (method !== "GET" && !pseudo) return fail(401, "Choisis d'abord un pseudo.");

  if (parts.length === 1 && method === "POST") {
    let parsed;
    try { parsed = parseItem(await request.json()); } catch (e) { return fail(400, e.message); }
    const r = await db.prepare("INSERT INTO items (data, image, image_type, author) VALUES (?, ?, ?, ?)")
      .bind(JSON.stringify(parsed.data), parsed.image ? parsed.image.bytes : null, parsed.image?.type ?? null, pseudo).run();
    return json({ id: r.meta.last_row_id }, 201);
  }

  const id = Number(parts[1]);
  if (!Number.isInteger(id) || id <= 0) return fail(400, "Ligne inconnue.");

  if (parts.length === 2 && method === "DELETE") {
    await db.prepare("DELETE FROM interests WHERE item_id = ?").bind(id).run();
    await db.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  if (parts[2] === "image" && method === "GET") {
    const row = await db.prepare("SELECT image, image_type FROM items WHERE id = ?").bind(id).first();
    if (!row || !row.image) return fail(404, "Pas d'image.");
    return new Response(new Uint8Array(row.image), {
      headers: { "content-type": row.image_type, "cache-control": "public, max-age=86400" },
    });
  }

  if (parts[2] === "interest" && (method === "POST" || method === "DELETE")) {
    const exists = await db.prepare("SELECT 1 FROM items WHERE id = ?").bind(id).first();
    if (!exists) return fail(404, "Ligne supprimée entre-temps.");
    if (method === "POST") {
      await db.prepare("INSERT OR IGNORE INTO interests (item_id, pseudo) VALUES (?, ?)").bind(id, pseudo).run();
    } else {
      await db.prepare("DELETE FROM interests WHERE item_id = ? AND pseudo = ?").bind(id, pseudo).run();
    }
    return json({ ok: true });
  }

  return fail(404, "Introuvable.");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await handleApi(request, env); }
      catch (e) { console.error(e); return fail(500, "Erreur du serveur."); }
    }
    return env.ASSETS.fetch(request);
  },
};
