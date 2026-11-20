# Checkpoint 0 — Khung dự án Đảo Đèn Lồng Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thiết lập hoàn chỉnh khung dự án **TypeScript + Vite + Three.js + Node.js Headless CLI**, hệ thống ghi chép SDLC, bộ AI harness cho Google Antigravity, CI trên Linux, và kiểm chứng chạy sạch ở thư mục clone mới cho Checkpoint 0.

**Architecture:** Tách toàn bộ mô phỏng tất định vào `src/core/` (thuần TypeScript, không phụ thuộc `three` hay API trình duyệt), được import dùng chung bởi `src/web/` (render 3D bằng Three.js build qua Vite ra `dist/`) và `src/cli/` (biên dịch qua `tsc` ra `dist-cli/` để chạy headless trên Node >= 18). AI harness (`.agents/` + `AGENTS.md`) dùng script Node đa nền tảng đảm bảo test đỏ sẽ chặn kết thúc lượt `NO_TOOL_CALL`.

**Tech Stack:** TypeScript, Vite, Three.js, Node.js `v22.16.0` (`node:test`, `node:assert/strict`), GitHub Actions (`ubuntu-latest`).

**Spec:** [docs/superpowers/specs/2026-11-20-checkpoint-0-design.md](../specs/2026-11-20-checkpoint-0-design.md)

## Global Constraints

- AI Coding Agent Runtime đích: **Google Antigravity** (`AGENTS.md`, `.agents/skills/<name>/SKILL.md`, `.agents/hooks.json`).
- Tương thích chéo nền tảng: phát triển trên Windows, phải cài đặt và chạy sạch trên **macOS và Linux** trong tối đa 3 lệnh; biên dịch `src/cli/` và `src/core/` ra JS (`dist-cli/`) chạy bằng Node >= 18.
- `src/core/` **cấm tuyệt đối** import `three`, `window`, `document`, `process`, hoặc dùng `Math.random()` / `Date.now()`.
- Không dùng script đặc thù Windows (`.bat`, `.ps1`) trong `package.json`, hooks hoặc CI.
- Không thêm thư viện test runner hay helper ngoài khi `node:test`, `node:assert/strict` và `node:fs` đã có sẵn.
- `AGENTS.md` phải ngắn gọn (< 60 dòng); giữ nguyên toàn bộ file harness trong lịch sử Git; không tạo `.env` hay nhúng khóa/token.

## Review Focus

1. **Rò rỉ phụ thuộc vào `src/core/`:** Lỡ import `three` hoặc gọi `Math.random()`/`Date.now()` trong `src/core/` — kiểm chứng bằng `tests/core-boundary.test.mjs` quét tĩnh toàn bộ file trong `src/core/`.
2. **Test chạy trên bản biên dịch `dist-cli/` cũ:** `npm test` phải luôn chạy `npm run build:cli` trước `node --test` để không test code cũ.
3. **Tham số CLI headless thiếu hoặc không hợp lệ:** `npm run headless` không có đối số/không stdin (như trong CI) phải dùng mặc định `--seed 1 --ticks 10 --dt 0.05` và thoát code 0; truyền `--ticks -1` hoặc `--seed abc` phải thoát code khác 0 kèm thông báo lỗi trên `stderr`.
4. **CWD và JSON stdout của Antigravity Stop hook:** `.agents/hooks.json` chạy trong thư mục `.agents/`; script `.agents/scripts/stop-test-gate.mjs` phải đọc được `workspacePaths[0]`, xử lý an toàn khi `stdin` rỗng/lỗi JSON, capture stdio của `npm test` để không làm hỏng JSON stdout, và cho phép dừng khi `terminationReason !== "NO_TOOL_CALL"` hoặc `executionNum >= 3`.
5. **Kiểm chứng clone sạch thực sự:** Clone repo sang một thư mục tạm hoàn toàn mới bên ngoài workspace, cài mới và chạy đủ `npm ci`, `npm run build`, `npm test`, `npm run headless` trước khi xóa thư mục tạm.

---

### Task 1: Scaffolding dự án & Lõi mô phỏng thuần (`src/core/`)

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `tsconfig.cli.json`
- Create: `tsconfig.web.json`
- Create: `vite.config.ts`
- Create: `src/core/prng.ts`
- Create: `src/core/helloLantern.ts`
- Test: `tests/core-hello.test.mjs`
- Test: `tests/core-boundary.test.mjs`

**Interfaces:**
- Produces in `src/core/prng.ts`:
  - `export function createSeededRng(seed: number): () => number`
- Produces in `src/core/helloLantern.ts`:
  - `export interface Vec3 { x: number; y: number; z: number }`
  - `export interface LanternState { seed: number; tick: number; elapsedSec: number; position: Vec3; yawRad: number; glowIntensity: number }`
  - `export function createInitialLanternState(seed: number): LanternState`
  - `export function stepLanternState(state: LanternState, dtSec?: number): LanternState`
  - `export function runLanternSimulation(seed: number, ticks: number, dtSec?: number): LanternState`

- [ ] **Step 1: Khởi tạo cấu hình dự án và cài dependencies**

Tạo `.gitignore` (chặn `node_modules/`, `dist/`, `dist-cli/`, `.env`, `.env.*`, `*.log`, `.DS_Store`), `package.json` (`"type": "module"`, scripts `dev`: `"vite"`, `preview`: `"vite preview"`, `build:cli`: `"tsc -p tsconfig.cli.json"`, `build:web`: `"tsc -p tsconfig.web.json && vite build"`, `build`: `"npm run build:cli && npm run build:web"`, `test`: `"npm run build:cli && node --test tests/*.test.mjs"`, `headless`: `"node dist-cli/cli/headless.js"`), `tsconfig.base.json`, `tsconfig.cli.json` (`"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"outDir": "dist-cli"`, `"rootDir": "src"`), `tsconfig.web.json` (`"noEmit": true`), và `vite.config.ts`. Chạy `npm install three` và `npm install -D vite typescript @types/three @types/node`.

Verify: `node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).scripts)"` in ra đủ các script.

- [ ] **Step 2: Viết failing tests cho lõi mô phỏng và ranh giới module**

```js
// tests/core-hello.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialLanternState,
  stepLanternState,
  runLanternSimulation,
} from "../dist-cli/core/helloLantern.js";

test("runLanternSimulation is deterministic for identical inputs", () => {
  const first = runLanternSimulation(42, 20, 0.05);
  const second = runLanternSimulation(42, 20, 0.05);
  assert.deepEqual(first, second);
  assert.equal(first.tick, 20);
  assert.ok(Math.abs(first.elapsedSec - 1.0) < 1e-9);
});

test("stepLanternState advances tick and keeps bounded glow", () => {
  const s0 = createInitialLanternState(7);
  const s1 = stepLanternState(s0, 0.1);
  assert.equal(s1.tick, 1);
  assert.ok(s1.glowIntensity >= 0.5 && s1.glowIntensity <= 1.5);
});
```

```js
// tests/core-boundary.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("src/core has zero rendering, DOM, process, or nondeterministic globals", () => {
  const coreDir = path.resolve("src/core");
  const files = fs.readdirSync(coreDir).filter((f) => f.endsWith(".ts"));
  assert.ok(files.length > 0);
  const forbidden = [/\bfrom\s+["']three["']/, /\bwindow\b/, /\bdocument\b/, /\bprocess\b/, /\bMath\.random\b/, /\bDate\.now\b/];
  for (const file of files) {
    const content = fs.readFileSync(path.join(coreDir, file), "utf8");
    for (const pattern of forbidden) {
      assert.equal(pattern.test(content), false, `${file} matched forbidden pattern ${pattern}`);
    }
  }
});
```

- [ ] **Step 3: Chạy `npm test` để xác nhận test thất bại trước khi code**

Run: `npm test`
Expected: FAIL (chưa tồn tại `src/core/` hoặc `dist-cli/core/helloLantern.js`).

- [ ] **Step 4: Cài đặt `src/core/prng.ts` và `src/core/helloLantern.ts`**

- Trong `src/core/prng.ts`: cài `createSeededRng(seed: number): () => number` dùng Mulberry32 chuẩn 32-bit unsigned (`seed >>> 0`).
- Trong `src/core/helloLantern.ts`: cài `createInitialLanternState(seed: number): LanternState` (dùng PRNG xác định pha/góc ban đầu, `position.y = 1.2`), `stepLanternState(state: LanternState, dtSec = 1 / 60): LanternState` (quay `yawRad` đều và dao động `position.y` & `glowIntensity` hình sin mượt, làm tròn số thực ổn định hoặc tính chuẩn IEEE 754 thuần), và `runLanternSimulation(seed: number, ticks: number, dtSec = 0.05): LanternState` (ném lỗi nếu `ticks < 0`, `!Number.isInteger(ticks)`, hoặc `!Number.isFinite(dtSec)` / `dtSec <= 0`).

- [ ] **Step 5: Chạy `npm test` để xác nhận toàn bộ test Task 1 xanh**

Run: `npm test`
Expected: PASS (2 test suites pass).

- [ ] **Step 6: Commit Task 1**

```bash
git add .gitignore package.json package-lock.json tsconfig.base.json tsconfig.cli.json tsconfig.web.json vite.config.ts src/core tests/core-hello.test.mjs tests/core-boundary.test.mjs
git commit -m "chore(cp0): scaffold TypeScript/Vite project and pure deterministic core"
```

---

### Task 2: CLI Headless & Chương trình "Hello" 3D Three.js (`src/cli/` & `src/web/`)

**Files:**
- Create: `src/cli/headless.ts`
- Create: `index.html`
- Create: `src/web/main.ts`
- Test: `tests/cli-headless.test.mjs`

**Interfaces:**
- Consumes: `runLanternSimulation` from `../core/helloLantern.js` (trong CLI) và `createInitialLanternState`, `stepLanternState` from `../core/helloLantern.js` (trong web).
- Produces:
  - `dist-cli/cli/headless.js` chạy bằng `node dist-cli/cli/headless.js [--seed N] [--ticks N] [--dt F]` (mặc định `--seed 1 --ticks 10 --dt 0.05`), xuất 1 dòng JSON `{ ok: true, mode: "hello-cp0", seed, ticks, dtSec, finalState }`.
  - `dist/` web tĩnh build bởi `vite build` hiển thị khung cảnh 3D "Đảo Đèn Lồng (Hello CP0)" (hòn đảo tối, mặt nước, đèn lồng phát sáng quay và nhấp nhô theo `stepLanternState`).

- [ ] **Step 1: Viết failing tests cho CLI headless**

```js
// tests/cli-headless.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const runCli = (args) =>
  spawnSync(process.execPath, ["dist-cli/cli/headless.js", ...args], { encoding: "utf8" });

test("headless CLI runs with default arguments and returns deterministic JSON", () => {
  const r1 = runCli([]);
  const r2 = runCli([]);
  assert.equal(r1.status, 0, r1.stderr);
  assert.equal(r1.stdout, r2.stdout);
  const parsed = JSON.parse(r1.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.seed, 1);
  assert.equal(parsed.ticks, 10);
  assert.equal(parsed.finalState.tick, 10);
});

test("headless CLI rejects negative ticks and non-numeric seed with non-zero exit code", () => {
  const resNeg = runCli(["--ticks", "-5"]);
  assert.notEqual(resNeg.status, 0);
  assert.ok(resNeg.stderr.length > 0);

  const resBadSeed = runCli(["--seed", "abc"]);
  assert.notEqual(resBadSeed.status, 0);
  assert.ok(resBadSeed.stderr.length > 0);
});
```

- [ ] **Step 2: Chạy `npm test` để xác nhận test CLI thất bại**

Run: `npm test`
Expected: FAIL (`dist-cli/cli/headless.js` không tồn tại).

- [ ] **Step 3: Implement `src/cli/headless.ts`, `index.html`, và `src/web/main.ts`**

- `src/cli/headless.ts`: parse `process.argv.slice(2)` cho `--seed`, `--ticks`, `--dt` (dùng giá trị mặc định nếu không truyền), validate số hợp lệ (`Number.isInteger` cho seed/ticks, `ticks >= 0`, `dt > 0`), gọi `runLanternSimulation(seed, ticks, dtSec)`, in `JSON.stringify({ ok: true, mode: "hello-cp0", seed, ticks, dtSec, finalState })` ra stdout. Khi lỗi input thì ghi thông báo rõ ra `console.error` và `process.exit(1)`.
- `index.html` & `src/web/main.ts`: dựng Three.js `WebGLRenderer`, `PerspectiveCamera`, `Scene` nền sương đêm tối, mặt đảo tròn + mặt nước, nhóm mesh Đèn Lồng (khung + lõi phát sáng + `PointLight`), đồng bộ `position`, `rotation.y`, và `light.intensity` từ `stepLanternState` theo fixed timestep `1/60`s. Kèm bộ đọc TypeScript `npx tsc -p tsconfig.web.json --noEmit` qua `npm run build:web`.

- [ ] **Step 4: Chạy `npm run build`, `npm test`, và `npm run headless`**

Run: `npm run build && npm test && npm run headless`
Expected: `dist/` và `dist-cli/` build thành công không lỗi TypeScript; toàn bộ test xanh; `npm run headless` in JSON hợp lệ.

- [ ] **Step 5: Commit Task 2**

```bash
git add index.html src/cli/headless.ts src/web/main.ts tests/cli-headless.test.mjs
git commit -m "feat(cp0): add deterministic headless CLI and Three.js hello lantern scene"
```

---

### Task 3: AI Harness cho Antigravity & GitHub Actions CI

**Files:**
- Create: `AGENTS.md`
- Create: `.agents/skills/verify-phase/SKILL.md`
- Create: `.agents/hooks.json`
- Create: `.agents/scripts/stop-test-gate.mjs`
- Create: `.github/workflows/ci.yml`
- Test: `tests/stop-hook.test.mjs`

**Interfaces:**
- Consumes: `npm test` và `npm run headless`
- Produces:
  - `AGENTS.md` (< 60 dòng)
  - `.agents/skills/verify-phase/SKILL.md` (frontmatter `name: verify-phase`, `description`)
  - `.agents/hooks.json` (key `"stop-test-gate"` -> `"Stop"` -> `"command": "node ./scripts/stop-test-gate.mjs"`)
  - `.agents/scripts/stop-test-gate.mjs` (đọc JSON stdin, output JSON `{"decision":"allow"}` hoặc `{"decision":"continue","reason":"..."}`)

- [ ] **Step 1: Viết failing tests cho Stop hook `.agents/scripts/stop-test-gate.mjs`**

```js
// tests/stop-hook.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const runHook = (payloadObjOrRaw) => {
  const input = typeof payloadObjOrRaw === "string" ? payloadObjOrRaw : JSON.stringify(payloadObjOrRaw);
  return spawnSync(process.execPath, ["./scripts/stop-test-gate.mjs"], {
    cwd: path.resolve(".agents"),
    input,
    encoding: "utf8",
  });
};

test("allows non-NO_TOOL_CALL termination and executionNum >= 3", () => {
  const r1 = runHook({ terminationReason: "USER_CANCELED", executionNum: 1 });
  assert.equal(r1.status, 0);
  assert.equal(JSON.parse(r1.stdout).decision, "allow");

  const r2 = runHook({ terminationReason: "NO_TOOL_CALL", executionNum: 3 });
  assert.equal(r2.status, 0);
  assert.equal(JSON.parse(r2.stdout).decision, "allow");
});

test("handles malformed stdin gracefully", () => {
  const res = runHook("{bad json");
  assert.equal(res.status, 0);
  assert.equal(JSON.parse(res.stdout).decision, "allow");
});

test("blocks stop with valid JSON when tests fail and allows when tests pass", () => {
  const tmpFail = fs.mkdtempSync(path.join(os.tmpdir(), "hook-fail-"));
  const tmpPass = fs.mkdtempSync(path.join(os.tmpdir(), "hook-pass-"));
  fs.mkdirSync(path.join(tmpFail, "node_modules"));
  fs.mkdirSync(path.join(tmpPass, "node_modules"));
  fs.writeFileSync(path.join(tmpFail, "package.json"), JSON.stringify({
    name: "tmp-fail",
    scripts: { test: "node -e \"console.log('noisy'); process.exit(1)\"" },
  }));
  fs.writeFileSync(path.join(tmpPass, "package.json"), JSON.stringify({
    name: "tmp-pass",
    scripts: { test: "node -e \"console.log('ok')\"" },
  }));

  try {
    const resFail = runHook({
      terminationReason: "NO_TOOL_CALL",
      executionNum: 1,
      workspacePaths: [tmpFail],
    });
    assert.equal(resFail.status, 0);
    const parsedFail = JSON.parse(resFail.stdout);
    assert.equal(parsedFail.decision, "continue");
    assert.ok(parsedFail.reason.length > 0);

    const resPass = runHook({
      terminationReason: "NO_TOOL_CALL",
      executionNum: 1,
      workspacePaths: [tmpPass],
    });
    assert.equal(resPass.status, 0);
    assert.equal(JSON.parse(resPass.stdout).decision, "allow");
  } finally {
    fs.rmSync(tmpFail, { recursive: true, force: true });
    fs.rmSync(tmpPass, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Chạy `npm test` để xác nhận test hook thất bại**

Run: `npm test`
Expected: FAIL (chưa có `.agents/scripts/stop-test-gate.mjs`).

- [ ] **Step 3: Tạo `AGENTS.md`, `.agents/skills/verify-phase/SKILL.md`, `.agents/hooks.json`, `.agents/scripts/stop-test-gate.mjs`, `.github/workflows/ci.yml`**

- `AGENTS.md` (< 60 dòng): hướng dẫn ngắn gọn về kiến trúc tách `src/core/`, lệnh `npm run build`, `npm test`, `npm run headless`, nguyên tắc chỉ kết luận đã đạt khi tự chạy và kiểm chứng thật, và cập nhật `docs/notes/` sau mỗi phase.
- `.agents/skills/verify-phase/SKILL.md`: hướng dẫn quy trình chạy `npm run build`, `npm test`, chạy `npm run headless` 2 lần so sánh output, và ghi bảng đối chiếu vào `docs/proof/phase-N/`.
- `.agents/hooks.json` & `.agents/scripts/stop-test-gate.mjs`: đúng đặc tả Antigravity `Stop` hook trong Spec §5, capture stdio của `npm test` (`stdio: "pipe"`), cross-platform trên Windows (`shell: process.platform === "win32"`) và Unix.
- `.github/workflows/ci.yml`: trigger `push` trên `main` và tag `phase-*` + `pull_request`, chạy trên `ubuntu-latest` với `actions/setup-node@v4` (Node 22), `npm ci`, `npm run build`, `npm test`, `npm run headless`.

- [ ] **Step 4: Chạy `npm test` và kiểm tra độ dài `AGENTS.md` (< 60 dòng)**

Run: `npm test && node -e "const lines = require('fs').readFileSync('AGENTS.md','utf8').trimEnd().split(/\r?\n/).length; console.log('AGENTS lines:', lines); if (lines >= 60) process.exit(1);"`
Expected: PASS và `AGENTS lines: < 60`.

- [ ] **Step 5: Commit Task 3**

```bash
git add AGENTS.md .agents .github tests/stop-hook.test.mjs
git commit -m "chore(cp0): add Antigravity AI harness (AGENTS.md, verify skill, Stop hook) and CI"
```

---

### Task 4: Tài liệu Lab, Pháp lý, Ghi chép SDLC & README

**Files:**
- Create: `docs/LAB_README_ORIGINAL.md`
- Modify: `README.md`
- Create: `LICENSE`
- Create: `CREDITS.md`
- Create: `docs/notes/assumptions.md`
- Create: `docs/notes/ai-log.md`
- Create: `docs/notes/retro.md`
- Create: `docs/proof/phase-0/README.md`

- [ ] **Step 1: Lưu nguyên bản `README.md` gốc sang `docs/LAB_README_ORIGINAL.md`**

Copy chính xác nội dung `README.md` ban đầu của đề bài sang `docs/LAB_README_ORIGINAL.md` để không mất thông tin gốc.

- [ ] **Step 2: Cập nhật `README.md` cho dự án Đảo Đèn Lồng**

Bao gồm:
- Chỗ chờ link Video demo ở đầu file (ghi rõ sẽ cập nhật ở Phase 4 / CP5).
- Mô tả ngắn dự án & trạng thái hiện tại (Checkpoint 0).
- Hướng dẫn cài đặt và chạy thử 3D trong tối đa 3 lệnh (`npm install`, `npm run build`, `npm run preview` hoặc `npm run dev`).
- Lệnh chạy kiểm tra (`npm test`) và chế độ headless (`npm run headless`).
- Liên kết tới `GUIDE.md`, `CHECKPOINTS.md`, `SUBMISSION.md`, `RULES.md`, `RUBRIC.md`, `docs/LAB_README_ORIGINAL.md`, `docs/notes/`, `docs/proof/`, `CREDITS.md`, `LICENSE`.

- [ ] **Step 3: Tạo `LICENSE` (MIT), `CREDITS.md`, và các file mẫu trong `docs/notes/` & `docs/proof/phase-0/`**

- `LICENSE`: MIT License đứng tên `Pham Viet Hung` (năm 2026).
- `CREDITS.md`: ghi rõ hiện ở CP0 chưa dùng asset bên ngoài; mã nguồn khung khởi tạo được xây dựng cùng Google Antigravity trên nền Three.js (MIT) và Vite (MIT).
- `docs/notes/assumptions.md`: khung bảng giả định & truy vết yêu cầu theo từng phase (`Phase 0`, sẵn sàng cho `Phase 1`..`Phase 4`).
- `docs/notes/ai-log.md`: khung nhật ký dùng AI, ghi nhận bước CP0 (công cụ sử dụng, chiến lược tiết kiệm token bằng `node:test` thuần + `AGENTS.md` gọn, lỗi thiết kế được reviewer phát hiện ở builder-check).
- `docs/notes/retro.md`: khung retro cuối lab.
- `docs/proof/phase-0/README.md`: khung báo cáo bằng chứng Checkpoint 0 (sẽ điền số liệu thật sau Task 5).

- [ ] **Step 4: Kiểm tra sự tồn tại của mọi file liên kết từ `README.md`**

Run: `node -e "const fs=require('fs'); for (const f of ['GUIDE.md','CHECKPOINTS.md','SUBMISSION.md','RULES.md','RUBRIC.md','LICENSE','CREDITS.md','docs/LAB_README_ORIGINAL.md','docs/notes/assumptions.md','docs/notes/ai-log.md','docs/notes/retro.md','docs/proof/phase-0/README.md']) { if(!fs.existsSync(f)) throw new Error('Missing '+f); } console.log('All doc links verified');"`
Expected: `All doc links verified`.

- [ ] **Step 5: Commit Task 4**

```bash
git add README.md LICENSE CREDITS.md docs/LAB_README_ORIGINAL.md docs/notes docs/proof/phase-0/README.md
git commit -m "docs(cp0): set up project README, license, credits, SDLC notes, and proof template"
```

---

### Task 5: Kiểm chứng cuối cùng & Tự kiểm Clone sạch (Clean Clone Check)

**Files:**
- Modify: `docs/proof/phase-0/README.md`
- Modify: `docs/notes/ai-log.md`

- [ ] **Step 1: Chạy toàn bộ bộ kiểm chứng tại workspace hiện tại**

Run: `npm run build && npm test && npm run headless -- --seed 7 --ticks 20 && npm run headless -- --seed 7 --ticks 20`
Expected: Tất cả lệnh exit code `0`, 2 lần chạy `headless` in ra chuỗi JSON giống hệt nhau.

- [ ] **Step 2: Thực hiện bài tự kiểm Clone sạch theo `CHECKPOINTS.md`**

Clone từ local repo hiện tại (`git clone . <tempDir>`) sang thư mục tạm ngoài workspace (`os.tmpdir()`), chạy trong thư mục đó:
`npm ci && npm run build && npm test && npm run headless`
Xác nhận tất cả pass từ một thư mục hoàn toàn sạch không có `node_modules` hay cache sẵn, rồi xóa thư mục tạm đó.

- [ ] **Step 3: Ghi kết quả quan sát thật vào `docs/proof/phase-0/README.md` và cập nhật `docs/notes/ai-log.md`**

Chỉ ghi đúng output, phiên bản công cụ, kết quả test và kết quả clean clone đã thực sự chạy và quan sát được; đồng thời liệt kê rõ 3 việc thủ công còn lại trong Checkpoint 0 để học viên tự xác nhận (Repo GitHub Public, thử trợ giảng Lab board Phase 1 trên `claude.ai`, kiểm tra deadline từ Coach).

- [ ] **Step 4: Chạy `npm test` lần cuối sau edit tài liệu và Commit**

Run: `npm test`
Expected: PASS, `git status` sạch sau khi commit.

```bash
git add docs/proof/phase-0/README.md docs/notes/ai-log.md
git commit -m "docs(cp0): record clean-clone verification proof and CP0 AI log"
```
