/* eslint-disable no-console */
/**
 * Verification of the stock corrections C-1…C-5 (Listing Management prerequisites, approved 2026-11-24).
 *
 * Runs the real Inventoz routes (Products, Orders, Whatnot) against a THROWAWAY local database and checks, with
 * concurrent writers, that stock is never lost or overwritten from a stale page:
 *   C-1 product save with a stock precondition (T184 a–e, T230, T231, T233, observe switch, blank stock)
 *   C-2 Orders-page approve-batch on locked rows (T185 a; SKU + alternative SKU in one batch)
 *   C-3 old Whatnot barcode scan turned off (410)
 *   C-4 POST /products/updateQuantities retired (410)
 *   C-5 StockUpdateService locks inside a transaction (exercised by the concurrent cases above)
 *
 * Usage (never against production; the script refuses any non-local host and any database not ending in "_test"):
 *   VERIFY_DB_URL=mysql://root@127.0.0.1:3306/inventoz_corrections_test node scripts/verify-stock-corrections.js
 * The database is dropped and recreated from the Sequelize models, and dropped again at the end.
 * Authentication is stubbed in-process (an admin user); no other part of Inventoz is started.
 */
const path = require("path");
const assert = require("assert/strict");
const Module = require("module");
const mysql = require("mysql2/promise");

const url = new URL(process.env.VERIFY_DB_URL || "");
const dbName = url.pathname.replace(/^\//, "");
if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname) || !dbName.endsWith("_test")) {
  console.error("Refusing to run: VERIFY_DB_URL must point to a local database whose name ends in _test.");
  process.exit(2);
}

// Stub authentication and permissions before any route is loaded.
const stub = (relative, exports) => {
  const file = Module._resolveFilename(path.join(__dirname, "..", relative), module);
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};
stub("middleware/auth", { auth: (req, _res, next) => { req.user = { id: 1, role: "admin" }; next(); } });
stub("middleware/permissions", { checkPermission: () => (_req, _res, next) => next() });

const serverUrl = `${url.protocol}//${url.username ? `${decodeURIComponent(url.username)}${url.password ? `:${decodeURIComponent(url.password)}` : ""}@` : ""}${url.host}`;
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const admin = await mysql.createConnection(serverUrl);
  await admin.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await admin.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  // models/index.js always applies DB_USERNAME/DB_PASSWORD (with a built-in fallback), so the run uses its own
  // short-lived local account with a random password, limited to the throwaway database and dropped at the end.
  const runUser = "inv_verify_run";
  const runPassword = require("crypto").randomBytes(18).toString("base64url");
  await admin.query(`DROP USER IF EXISTS '${runUser}'@'localhost', '${runUser}'@'127.0.0.1'`);
  for (const h of ["localhost", "127.0.0.1"]) {
    await admin.query(`CREATE USER '${runUser}'@'${h}' IDENTIFIED BY ?`, [runPassword]);
    await admin.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${runUser}'@'${h}'`);
  }
  url.username = runUser;
  url.password = runPassword;
  process.env.DB_USERNAME = runUser;
  process.env.DB_PASSWORD = runPassword;
  process.env.DB_HOST = url.hostname;
  process.env.DB_NAME = dbName;
  process.env.DATABASE_URL = url.toString();

  const db = require("../models");
  db.sequelize.options.logging = false;
  await db.sequelize.sync();
  // Production stores stock as text (VARCHAR(45), checked 2026-11-24); the model says INTEGER.
  await db.sequelize.query("ALTER TABLE Products MODIFY quantity VARCHAR(45) NULL");

  const express = require("express");
  const app = express();
  app.use(express.json());
  app.use("/products", require("../routes/Products"));
  app.use("/orders", require("../routes/Orders"));
  app.use("/whatnot", require("../routes/whatnot"));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, route, body) => {
    const res = await fetch(base + route, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, body: json };
  };

  const conn = await mysql.createConnection(url.toString());
  const q = async (sql, params = []) => (await conn.query(sql, params))[0];
  const product = async (sku) => (await q("SELECT * FROM Products WHERE sku = ?", [sku]))[0];
  const stock = async (sku) => (await product(sku)).quantity;
  const setStock = (sku, value) => q("UPDATE Products SET quantity = ? WHERE sku = ?", [value, sku]);
  // Required columns without a default get a neutral value (text "" / number 0 / now).
  const fillerFor = async (table) => {
    const required = await q(
      `SELECT COLUMN_NAME AS name, DATA_TYPE AS type, COLUMN_TYPE AS columnType FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND IS_NULLABLE = 'NO' AND COLUMN_DEFAULT IS NULL AND EXTRA NOT LIKE '%auto_increment%'`,
      [dbName, table],
    );
    return Object.fromEntries(
      required.map((c) => [
        c.name,
        /int|decimal|float|double/.test(c.type) ? 0 : /date|time/.test(c.type) ? new Date() : c.type === "enum" ? /'([^']*)'/.exec(c.columnType)[1] : "",
      ]),
    );
  };
  const filler = await fillerFor("Products");
  // The approving user (approvedBy references users.id).
  const userRow = { ...(await fillerFor("users")), id: 1 };
  const userCols = Object.keys(userRow);
  await q(`INSERT INTO users (${userCols.map((c) => `\`${c}\``).join(", ")}) VALUES (${userCols.map(() => "?").join(", ")})`, userCols.map((c) => userRow[c]));
  const addProduct = async (sku, quantity, extra = {}) => {
    const row = { ...filler, sku, brand: "Test", itemName: `Item ${sku}`, quantity, isActive: 1, verified: 0, trackQuantity: 0, refillChecklist: 0, ...extra };
    const cols = Object.keys(row);
    await q(`INSERT INTO Products (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, cols.map((c) => row[c]));
    return product(sku);
  };
  /** A page loaded now: the product as the browser holds it (API JSON). */
  const loadPage = async (sku) => JSON.parse(JSON.stringify(await product(sku)));
  const withoutStock = (p) => {
    const rest = { ...p };
    delete rest.quantity;
    delete rest.expectedQuantity;
    return rest;
  };
  /** Another writer (an LM finalization, a live close-shipment): locks the row, waits, lowers stock, commits. */
  const otherWriter = async (sku, units, holdMs) => {
    const c = await mysql.createConnection(url.toString());
    await c.beginTransaction();
    const [[row]] = await c.query("SELECT quantity FROM Products WHERE sku = ? FOR UPDATE", [sku]);
    const locked = { done: null };
    locked.done = (async () => {
      await sleep(holdMs);
      await c.query("UPDATE Products SET quantity = ? WHERE sku = ?", [String(Number(row.quantity) - units), sku]);
      await c.commit();
      await c.end();
    })();
    return locked;
  };
  const check = async (name, fn) => {
    try {
      await fn();
      results.push([name, "PASS"]);
      console.log(`PASS  ${name}`);
    } catch (e) {
      results.push([name, "FAIL"]);
      console.log(`FAIL  ${name}\n      ${e.message.split("\n").join("\n      ")}`);
    }
  };

  // ── C-1 product save ──────────────────────────────────────────────────────────────────────────────────────────
  await check("C-1 T184a: a switch on a stale page never writes stock (new page sends no quantity)", async () => {
    await addProduct("C1-A", "10");
    const page = await loadPage("C1-A");
    await setStock("C1-A", "8"); // sold meanwhile
    const r = await call("PUT", "/products", { ...withoutStock(page), refillChecklist: true });
    assert.equal(r.status, 200);
    assert.equal(await stock("C1-A"), "8");
    assert.equal(Number((await product("C1-A")).refillChecklist), 1);
  });

  await check("C-1 T230: an OLD page (stale stock, no expected quantity) is refused with 428, nothing saved, logged", async () => {
    await addProduct("C1-B", "10");
    const page = await loadPage("C1-B");
    await setStock("C1-B", "8");
    const r = await call("PUT", "/products", { ...page, refillChecklist: true }); // today's switch payload
    assert.equal(r.status, 428);
    assert.equal(r.body.error, "QUANTITY_PRECONDITION_REQUIRED");
    assert.equal(await stock("C1-B"), "8");
    assert.equal(Number((await product("C1-B")).refillChecklist), 0);
    const logs = await q("SELECT action FROM Logs WHERE entityId = 'C1-B' AND action = 'quantity_precondition_required'");
    assert.equal(logs.length, 1);
  });

  await check("C-1 T184b: an explicit edit with the loaded stock as expectation is applied", async () => {
    await addProduct("C1-C", "8");
    const page = await loadPage("C1-C");
    const r = await call("PUT", "/products", { ...page, quantity: "5", expectedQuantity: page.quantity });
    assert.equal(r.status, 200);
    assert.equal(await stock("C1-C"), "5");
  });

  await check("C-1 T184c: an explicit edit after stock changed underneath → 409 with the current stock, nothing saved", async () => {
    await addProduct("C1-D", "10", { location: "A1" });
    const page = await loadPage("C1-D");
    await setStock("C1-D", "7");
    const r = await call("PUT", "/products", { ...page, location: "B2", quantity: "6", expectedQuantity: page.quantity });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, "QUANTITY_CHANGED");
    assert.equal(String(r.body.currentQuantity), "7");
    const p = await product("C1-D");
    assert.equal(p.quantity, "7");
    assert.equal(p.location, "A1");
  });

  await check("C-1 T184d: the verified switch keeps the CURRENT stock in its history row", async () => {
    await addProduct("C1-E", "10");
    const page = await loadPage("C1-E");
    await setStock("C1-E", "9");
    const r = await call("PUT", "/products", { ...withoutStock(page), verified: true });
    assert.equal(r.status, 200);
    assert.equal(await stock("C1-E"), "9");
    const [h] = await q("SELECT oldQuantity, newQuantity FROM StockUpdateHistories WHERE sku = 'C1-E'").catch(() => q("SELECT oldQuantity, newQuantity FROM StockUpdateHistory WHERE sku = 'C1-E'"));
    assert.ok(h, "a stock history row exists");
    assert.equal(String(h.newQuantity), "9");
  });

  await check("C-1 T231: an old page re-sending the same stock (number vs text) saves the other fields without a stock write", async () => {
    await addProduct("C1-F", "5", { location: "A1" });
    const page = await loadPage("C1-F");
    const r = await call("PUT", "/products", { ...page, quantity: 5, location: "C3" });
    assert.equal(r.status, 200);
    const p = await product("C1-F");
    assert.equal(p.quantity, "5");
    assert.equal(p.location, "C3");
  });

  await check("C-1 T233: only the title changes while stock changes 10 → 9 concurrently → title saved, stock stays 9", async () => {
    await addProduct("C1-G", "10");
    const page = await loadPage("C1-G");
    await setStock("C1-G", "9");
    const r = await call("PUT", "/products", { ...page, itemName: "Renamed", quantity: page.quantity, expectedQuantity: page.quantity });
    assert.equal(r.status, 200);
    const p = await product("C1-G");
    assert.equal(p.quantity, "9");
    assert.equal(p.itemName, "Renamed");
  });

  await check("C-1 T184e: a save waits for a concurrent stock writer and never undoes its deduction", async () => {
    await addProduct("C1-H", "20");
    const page = await loadPage("C1-H");
    const writer = await otherWriter("C1-H", 1, 400); // holds the row lock, then 20 → 19
    const save = call("PUT", "/products", { ...withoutStock(page), refillChecklist: true });
    await writer.done;
    const r = await save;
    assert.equal(r.status, 200);
    assert.equal(await stock("C1-H"), "19");
    // An explicit edit expecting 19 races with another deduction: it waits, then sees 18 and refuses.
    const page2 = await loadPage("C1-H");
    const writer2 = await otherWriter("C1-H", 1, 400);
    const edit = call("PUT", "/products", { ...page2, quantity: "25", expectedQuantity: page2.quantity });
    await writer2.done;
    const r2 = await edit;
    assert.equal(r2.status, 409);
    assert.equal(await stock("C1-H"), "18");
  });

  await check("C-1 blank stock: a blank is only equal to a blank; an explicit first count is applied", async () => {
    await addProduct("C1-I", "");
    const page = await loadPage("C1-I");
    let r = await call("PUT", "/products", { ...page, quantity: "", location: "D4" }); // old page, unchanged blank
    assert.equal(r.status, 200);
    assert.equal(await stock("C1-I"), "");
    r = await call("PUT", "/products", { ...page, quantity: "3", expectedQuantity: "" });
    assert.equal(r.status, 200);
    assert.equal(await stock("C1-I"), "3");
  });

  await check("C-1 observe switch: PRODUCT_QTY_PRECONDITION=observe writes an old page's stock as before and logs it", async () => {
    await addProduct("C1-J", "10");
    const page = await loadPage("C1-J");
    process.env.PRODUCT_QTY_PRECONDITION = "observe";
    try {
      const r = await call("PUT", "/products", { ...page, quantity: "12" });
      assert.equal(r.status, 200);
    } finally {
      delete process.env.PRODUCT_QTY_PRECONDITION;
    }
    assert.equal(await stock("C1-J"), "12");
    const logs = await q("SELECT action FROM Logs WHERE entityId = 'C1-J' AND action = 'legacy_client_quantity_write'");
    assert.equal(logs.length, 1);
  });

  // ── C-2 Orders page approve-batch ─────────────────────────────────────────────────────────────────────────────
  const item = (orderId, sku, quantity) => ({ orderId, store: 983189, storeName: "eBay Buy4LessToday", sku, quantity, lotSize: 1, orderDate: new Date().toISOString() });

  await check("C-2 T185a: approve-batch concurrent with another writer on the same SKU → final stock = start − both", async () => {
    await addProduct("C2-A", "20");
    const writer = await otherWriter("C2-A", 2, 400); // LM finalization of 2 units holds the row
    const approve = call("POST", "/orders/approve-batch", { items: [item("EB-1001", "C2-A", 3)] });
    await writer.done;
    const r = await approve;
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    assert.equal(await stock("C2-A"), "15");
  });

  await check("C-2: an item ordered under its SKU and its alternative SKU in one batch is deducted for both", async () => {
    await addProduct("C2-B", "10", { alternativeSku: "C2-B-ALT" });
    const preview = await call("POST", "/orders/approve-preview", { items: [item("EB-2001", "C2-B", 1), item("EB-2002", "C2-B-ALT", 2)] });
    assert.equal(preview.status, 200, JSON.stringify(preview.body).slice(0, 300));
    const r = await call("POST", "/orders/approve-batch", { items: [item("EB-2001", "C2-B", 1), item("EB-2002", "C2-B-ALT", 2)] });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    assert.equal(await stock("C2-B"), "7");
  });

  // ── C-3 / C-4 retired stock paths ─────────────────────────────────────────────────────────────────────────────
  await check("C-3: the old Whatnot barcode scan answers 410 and never changes stock", async () => {
    await addProduct("C3-A", "10", { upc: "000111222333" });
    const r = await call("POST", "/whatnot/search-barcode", { barcode: "C3-A", showId: 1, reduceQuantity: true });
    assert.equal(r.status, 410);
    assert.equal(await stock("C3-A"), "10");
  });

  await check("C-4: POST /products/updateQuantities answers 410 and never changes stock", async () => {
    await addProduct("C4-A", "10");
    const r = await call("POST", "/products/updateQuantities", [{ sku: "C4-A", quantitySold: 3 }]);
    assert.equal(r.status, 410);
    assert.equal(await stock("C4-A"), "10");
  });

  await conn.end();
  await new Promise((r) => server.close(r));
  await db.sequelize.close();
  await admin.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await admin.query(`DROP USER IF EXISTS '${runUser}'@'localhost', '${runUser}'@'127.0.0.1'`);
  await admin.end();

  const failed = results.filter(([, s]) => s === "FAIL").length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
