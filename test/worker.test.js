// node --experimental-sqlite --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { handleApi, parseItem, readPseudo } from "../worker.js";

// Imitation minimale de l'API D1 au-dessus de SQLite.
function fakeD1() {
  const db = new DatabaseSync(":memory:");
  return {
    prepare(sql) {
      let args = [];
      const stmt = {
        bind: (...a) => { args = a; return stmt; },
        run: async () => { const r = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid) } }; },
        all: async () => ({ results: db.prepare(sql).all(...args) }),
        first: async () => db.prepare(sql).get(...args) ?? null,
      };
      return stmt;
    },
  };
}

const env = { DB: fakeD1() };
const call = (method, path, { pseudo = "alice", body, csrf = true } = {}) =>
  handleApi(new Request(`https://x/api/${path}`, {
    method,
    headers: { ...(pseudo ? { cookie: `pseudo=${encodeURIComponent(pseudo)}` } : {}), ...(csrf ? { "x-recyclem": "1" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }), env);

test("pseudo lu dans le cookie", () => {
  assert.equal(readPseudo(new Request("https://x", { headers: { cookie: "a=1; pseudo=J%C3%A9r%C3%B4me" } })), "Jérôme");
  assert.equal(readPseudo(new Request("https://x")), null);
});

test("validation d'une ligne", () => {
  assert.throws(() => parseItem({ data: { nom: "  " } }), /obligatoire/);
  assert.throws(() => parseItem({ data: { nom: "a" }, image: "data:text/html;base64,AA==" }), /Image/);
  const ok = parseItem({ data: { nom: " Chaise ", inconnu: "x" }, image: "data:image/png;base64,iVBORw==" });
  assert.equal(ok.data.nom, "Chaise");
  assert.equal(ok.data.inconnu, undefined);
  assert.equal(ok.image.type, "image/png");
});

test("ajouter, s'intéresser, supprimer", async () => {
  assert.equal((await call("POST", "items", { pseudo: null, body: { data: { nom: "x" } } })).status, 401);
  assert.equal((await call("POST", "items", { csrf: false, body: { data: { nom: "x" } } })).status, 403);

  const r = await call("POST", "items", { body: { data: { nom: "Chaise" }, image: "data:image/png;base64,iVBORw==" } });
  assert.equal(r.status, 201);
  const { id } = await r.json();

  assert.equal((await call("POST", `items/${id}/interest`, { pseudo: "bob" })).status, 200);
  await call("POST", `items/${id}/interest`, { pseudo: "bob" }); // deux fois = une seule
  let list = await (await call("GET", "items", { pseudo: "bob" })).json();
  assert.deepEqual(list[0].interested, ["bob"]);
  assert.equal(list[0].mine, true);
  assert.equal(list[0].hasImage, true);
  assert.equal((await call("GET", `items/${id}/image`)).headers.get("content-type"), "image/png");

  await call("DELETE", `items/${id}/interest`, { pseudo: "bob" });
  list = await (await call("GET", "items")).json();
  assert.deepEqual(list[0].interested, []);

  assert.equal((await call("DELETE", `items/${id}`, { pseudo: "carole" })).status, 200);
  assert.deepEqual(await (await call("GET", "items")).json(), []);
  assert.equal((await call("POST", `items/${id}/interest`)).status, 404);
});
