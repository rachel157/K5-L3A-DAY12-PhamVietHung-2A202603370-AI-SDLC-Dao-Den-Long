import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function collectTsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectTsFiles(full));
    } else if (entry.name.endsWith(".ts")) {
      result.push(full);
    }
  }
  return result;
}

test("src/core has zero rendering, DOM, process, or nondeterministic globals", () => {
  const coreDir = path.resolve("src/core");
  const files = collectTsFiles(coreDir);
  assert.ok(files.length > 0, "expected at least one .ts file in src/core");

  const forbidden = [
    /\bfrom\s+["']three["']/,
    /\bimport\s+["']three["']/,
    /\bwindow\b/,
    /\bdocument\b/,
    /\bprocess\b/,
    /\bMath\.random\b/,
    /\bDate\.now\b/,
  ];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(pattern.test(content), false, `${file} matched forbidden pattern ${pattern}`);
    }
  }
});
