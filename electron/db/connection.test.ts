import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createConnection } from "./connection";

describe("createConnection", () => {
  it("enables foreign key enforcement", () => {
    const db = createConnection(":memory:");
    const result = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
    expect(result.foreign_keys).toBe(1);
    db.close();
  });

  it("documents that WAL has no effect on :memory: databases (SQLite falls back to 'memory' mode)", () => {
    const db = createConnection(":memory:");
    const result = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    expect(result.journal_mode).toBe("memory");
    db.close();
  });

  it("actually enables WAL mode on a real file-backed database", () => {
    const tmpPath = path.join(os.tmpdir(), `printplus-test-${Date.now()}-${Math.random()}.db`);
    const db = createConnection(tmpPath);
    const result = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    expect(result.journal_mode).toBe("wal");
    db.close();

    for (const suffix of ["", "-wal", "-shm"]) {
      const p = tmpPath + suffix;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });
});
