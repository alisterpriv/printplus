import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createConnection } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { updateBusinessSettings } from "../repositories/businessSettingsRepository";
import { createCustomer } from "../repositories/customersRepository";
import { updateRate, listRates } from "../repositories/ratesRepository";
import { createOrder } from "../repositories/ordersRepository";
import {
  createBackup,
  validateBackupFile,
  replaceLiveDatabase,
  InvalidBackupFileError,
  RestoreFailedError,
} from "./backupService";

function tempDbPath(name: string): string {
  return path.join(os.tmpdir(), `printplus-backupsvc-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

function cleanupDbFiles(dbPath: string): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = dbPath + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

describe("createBackup", () => {
  let sourcePath: string;
  let destPath: string;
  let db: DatabaseSync;

  beforeEach(() => {
    sourcePath = tempDbPath("source");
    destPath = tempDbPath("dest");
    db = createConnection(sourcePath);
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
    cleanupDbFiles(sourcePath);
    cleanupDbFiles(destPath);
  });

  it("produces a standalone, independently-openable database file", async () => {
    await createBackup(db, destPath);
    expect(fs.existsSync(destPath)).toBe(true);

    const check = new DatabaseSync(destPath, { readOnly: true });
    const integrity = check.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
    expect(integrity.integrity_check).toBe("ok");
    check.close();
  });

  it("includes a customer, rate change, and order created just before the backup, including data still resident in the WAL", async () => {
    const customer = createCustomer(db, { name: "Ramesh", phone: "9998887770", email: null, address: null });
    const [firstRate] = listRates(db);
    updateRate(db, firstRate.id, 999);
    const order = createOrder(db, {
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      status: "Pending",
      subtotalPaise: 10000,
      discountPercent: 0,
      discountPaise: 0,
      gstPercent: 18,
      gstPaise: 1800,
      grandTotalPaise: 11800,
      items: [
        {
          printType: firstRate.printType,
          width: 2,
          height: 3,
          unit: "Meter",
          areaSquareMeters: 6,
          ratePaise: 99900,
          quantity: 1,
          totalPaise: 10000,
        },
      ],
    });
    updateBusinessSettings(db, {
      businessName: "Backup Test Prints",
      address: "1 Backup Street",
      phone: "9999999999",
      email: "backup@test.example",
      gstin: "27BACKUPTEST1Z5",
    });

    // WAL mode: confirm the -wal file actually has uncheckpointed content
    // before backing up, so this test proves the backup captures it.
    expect(fs.existsSync(`${sourcePath}-wal`)).toBe(true);

    await createBackup(db, destPath);

    const check = new DatabaseSync(destPath, { readOnly: true });
    const customerRow = check.prepare("SELECT * FROM customers WHERE id = ?").get(customer.id) as { name: string };
    expect(customerRow.name).toBe("Ramesh");

    const rateRow = check.prepare("SELECT rate_paise FROM rates WHERE id = ?").get(firstRate.id) as {
      rate_paise: number;
    };
    expect(rateRow.rate_paise).toBe(99900);

    const orderRow = check.prepare("SELECT * FROM orders WHERE id = ?").get(order.id) as {
      invoice_number: string;
      grand_total_paise: number;
    };
    expect(orderRow.invoice_number).toBe(order.invoiceNumber);
    expect(orderRow.grand_total_paise).toBe(11800);

    const itemRows = check.prepare("SELECT * FROM order_items WHERE order_id = ?").all(order.id);
    expect(itemRows).toHaveLength(1);

    const settingsRow = check.prepare("SELECT business_name, gstin FROM business_settings WHERE id = 1").get() as {
      business_name: string;
      gstin: string;
    };
    expect(settingsRow.business_name).toBe("Backup Test Prints");
    expect(settingsRow.gstin).toBe("27BACKUPTEST1Z5");

    check.close();
  });

  it("does not modify the live database", async () => {
    createCustomer(db, { name: "Untouched", phone: null, email: null, address: null });
    const before = db.prepare("SELECT COUNT(*) as count FROM customers").get() as { count: number };

    await createBackup(db, destPath);

    const after = db.prepare("SELECT COUNT(*) as count FROM customers").get() as { count: number };
    expect(after.count).toBe(before.count);
    // The live connection must still be usable after a backup.
    createCustomer(db, { name: "Still Works", phone: null, email: null, address: null });
    const finalCount = db.prepare("SELECT COUNT(*) as count FROM customers").get() as { count: number };
    expect(finalCount.count).toBe(before.count + 1);
  });

  it("rejects when the destination directory does not exist", async () => {
    const badDest = path.join(os.tmpdir(), `printplus-nonexistent-dir-${Date.now()}`, "backup.db");
    await expect(createBackup(db, badDest)).rejects.toThrow();
  });
});

describe("validateBackupFile", () => {
  let validPath: string;

  beforeEach(() => {
    validPath = tempDbPath("valid");
    const db = createConnection(validPath);
    runMigrations(db);
    db.close();
  });

  afterEach(() => {
    cleanupDbFiles(validPath);
  });

  it("accepts a real, migrated PrintPlus database", () => {
    expect(() => validateBackupFile(validPath)).not.toThrow();
  });

  it("rejects a file that is not a SQLite database at all", () => {
    const junkPath = tempDbPath("junk");
    fs.writeFileSync(junkPath, "this is not a sqlite database");
    try {
      expect(() => validateBackupFile(junkPath)).toThrow(InvalidBackupFileError);
    } finally {
      fs.unlinkSync(junkPath);
    }
  });

  it("rejects a nonexistent file path", () => {
    const missingPath = tempDbPath("missing");
    expect(() => validateBackupFile(missingPath)).toThrow(InvalidBackupFileError);
  });

  it("rejects a real SQLite database with no schema_migrations table (not a PrintPlus backup)", () => {
    const foreignPath = tempDbPath("foreign");
    const db = new DatabaseSync(foreignPath);
    db.exec("CREATE TABLE unrelated (id INTEGER PRIMARY KEY)");
    db.close();
    try {
      expect(() => validateBackupFile(foreignPath)).toThrow(InvalidBackupFileError);
    } finally {
      cleanupDbFiles(foreignPath);
    }
  });

  it("rejects a backup claiming a migration version newer than this app knows about", () => {
    const futurePath = tempDbPath("future");
    const db = createConnection(futurePath);
    runMigrations(db);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (999, datetime('now'))").run();
    db.close();
    try {
      expect(() => validateBackupFile(futurePath)).toThrow(InvalidBackupFileError);
      expect(() => validateBackupFile(futurePath)).toThrow(/newer version/i);
    } finally {
      cleanupDbFiles(futurePath);
    }
  });

  it("does not write to the file it validates", () => {
    const before = fs.statSync(validPath).mtimeMs;
    validateBackupFile(validPath);
    const after = fs.statSync(validPath).mtimeMs;
    expect(after).toBe(before);
  });
});

describe("replaceLiveDatabase", () => {
  let liveDbPath: string;
  let backupPath: string;

  beforeEach(() => {
    liveDbPath = tempDbPath("live");
    backupPath = tempDbPath("backup-src");
  });

  afterEach(() => {
    cleanupDbFiles(liveDbPath);
    cleanupDbFiles(backupPath);
    // Sweep any pre-restore-* / restoring-tmp artifacts this test created.
    const dir = path.dirname(liveDbPath);
    const base = path.basename(liveDbPath);
    for (const entry of fs.readdirSync(dir)) {
      if (entry.startsWith(base) && entry !== base) {
        fs.unlinkSync(path.join(dir, entry));
      }
    }
  });

  it("replaces the live database file with the backup's content", () => {
    const live = createConnection(liveDbPath);
    runMigrations(live);
    createCustomer(live, { name: "Pre-restore customer", phone: null, email: null, address: null });
    live.close();

    const backup = createConnection(backupPath);
    runMigrations(backup);
    createCustomer(backup, { name: "From backup", phone: null, email: null, address: null });
    backup.close();

    replaceLiveDatabase(liveDbPath, backupPath);

    const restored = new DatabaseSync(liveDbPath, { readOnly: true });
    const rows = restored.prepare("SELECT name FROM customers").all() as { name: string }[];
    expect(rows.map((r) => r.name)).toEqual(["From backup"]);
    restored.close();
  });

  it("leaves the moved-aside original recoverable on disk after a successful restore", () => {
    const live = createConnection(liveDbPath);
    runMigrations(live);
    live.close();
    const backup = createConnection(backupPath);
    runMigrations(backup);
    backup.close();

    replaceLiveDatabase(liveDbPath, backupPath);

    const dir = path.dirname(liveDbPath);
    const base = path.basename(liveDbPath);
    const preserved = fs.readdirSync(dir).filter((f) => f.startsWith(`${base}.pre-restore-`));
    expect(preserved.length).toBeGreaterThan(0);
  });

  it("works when there is no pre-existing live database file (fresh install edge case)", () => {
    const backup = createConnection(backupPath);
    runMigrations(backup);
    createCustomer(backup, { name: "Only In Backup", phone: null, email: null, address: null });
    backup.close();

    expect(() => replaceLiveDatabase(liveDbPath, backupPath)).not.toThrow();
    const restored = new DatabaseSync(liveDbPath, { readOnly: true });
    const rows = restored.prepare("SELECT name FROM customers").all() as { name: string }[];
    expect(rows.map((r) => r.name)).toEqual(["Only In Backup"]);
    restored.close();
  });

  it("rolls back to the original live database when the backup source disappears mid-restore", () => {
    const live = createConnection(liveDbPath);
    runMigrations(live);
    createCustomer(live, { name: "Original data", phone: null, email: null, address: null });
    live.close();

    const missingBackupPath = tempDbPath("does-not-exist");

    expect(() => replaceLiveDatabase(liveDbPath, missingBackupPath)).toThrow(RestoreFailedError);

    // The original database must still be intact and openable at dbPath.
    const stillThere = new DatabaseSync(liveDbPath, { readOnly: true });
    const rows = stillThere.prepare("SELECT name FROM customers").all() as { name: string }[];
    expect(rows.map((r) => r.name)).toEqual(["Original data"]);
    stillThere.close();
  });
});
