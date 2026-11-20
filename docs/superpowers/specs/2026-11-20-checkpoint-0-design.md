# Design Doc: Checkpoint 0 — Chuẩn bị môi trường & Khung dự án Đảo Đèn Lồng

- **Ngày:** 2026-11-20
- **Phạm vi:** Checkpoint 0 ([CHECKPOINTS.md](../../CHECKPOINTS.md)) cho bài lab Day 12 — AI SDLC: Đảo Đèn Lồng
- **Trạng thái:** Sẵn sàng duyệt (đã qua builder check)

---

## 1. Mục tiêu & Lý do (Intent & Why)

Thiết lập nền tảng kỹ thuật, quy trình SDLC, hệ thống ghi chép bằng chứng và bộ harness AI hoàn chỉnh trước khi bước vào Phase 1 (PRD-0). Mục tiêu là đảm bảo qua cả 4 phase (60m / 60m / 30m / 90m):
1. Lõi mô phỏng game tách rời hoàn toàn khỏi lớp hiển thị 3D để chạy chế độ **headless** tất định (deterministic) theo Test Contract.
2. Dự án xây dựng trên Windows nhưng chạy sạch trên **macOS và Linux** trong tối đa 3 lệnh, không phụ thuộc công cụ đặc thù hệ điều hành.
3. Đáp ứng sớm các tiêu chí chấm điểm của [RUBRIC.md](../../RUBRIC.md): AI harness (`AGENTS.md`, skill, hook chặn kết thúc khi test đỏ), CI tự động kiểm chứng, cấu trúc lưu giả định/nhật ký token/bằng chứng khớp từng tag.

---

## 2. Phạm vi: Goals, Non-Goals, Anti-Goals

### Goals
- Khởi tạo dự án **TypeScript + Vite + Three.js** (web 3D tĩnh) kết hợp **Node.js CLI** (headless) và **`node:test`** (unit + determinism tests).
- Xây dựng chương trình **"hello" 3D + headless** chạy được ngay:
  - Lõi thuần (`src/core/`): mô phỏng một trạng thái thế giới tối giản (một Đèn Lồng phát sáng nhấp nhô theo tick cố định `dt`, không import `three` hay API trình duyệt).
  - Lớp dựng 3D (`src/web/`): dựng khung cảnh Three.js tối giản hiển thị hòn đảo nhỏ, mặt nước/sương tối và Đèn Lồng xoay/nhấp nhô lấy tọa độ & cường độ sáng từ `src/core/`.
  - CLI headless (`src/cli/`): chạy mô phỏng thuần `N` bước theo tham số dòng lệnh (hoặc giá trị mặc định khi chạy `npm run headless` không đối số/không stdin), xuất JSON tất định ra stdout.
  - Bộ test (`tests/`): chạy `tsc` biên dịch phần core/CLI trước khi chạy `node --test` để không bao giờ test code cũ, kiểm chứng logic thuần, định dạng CLI headless và tính tất định (chạy 2 lần cùng đầu vào ra output giống hệt nhau).
- Thiết lập AI Harness cho **Google Antigravity** (lưu trong Git):
  - `AGENTS.md`: ngắn gọn (< 60 dòng), mô tả kiến trúc tách `core`/`web`/`cli`, lệnh build/test/headless, quy ước SDLC và nguyên tắc không sửa/bịa bằng chứng.
  - `.agents/skills/verify-phase/SKILL.md`: skill hướng dẫn agent chạy bộ kiểm chứng một lệnh và lưu log bằng chứng vào `docs/proof/`.
  - `.agents/hooks.json` + `.agents/scripts/stop-test-gate.mjs`: `Stop` hook kiểm tra test khi agent chuẩn bị kết thúc lượt `NO_TOOL_CALL`, buộc tiếp tục nếu test đỏ.
- Thiết lập tự động hóa CI: `.github/workflows/ci.yml` chạy `npm ci`, `npm run build`, `npm test`, và `npm run headless` trên `ubuntu-latest`.
- Thiết lập cấu trúc tài liệu & pháp lý theo [SUBMISSION.md](../../SUBMISSION.md):
  - `docs/notes/assumptions.md`, `docs/notes/ai-log.md`, `docs/notes/retro.md`
  - `docs/proof/phase-0/README.md`
  - `CREDITS.md`, `LICENSE` (MIT), `.gitignore`
  - Lưu bản gốc `README.md` của đề bài thành `docs/LAB_README_ORIGINAL.md`, và cập nhật `README.md` có hướng dẫn cài đặt/chạy/test trong tối đa 3 lệnh kèm đầy đủ liên kết tới tài liệu lab (`GUIDE.md`, `CHECKPOINTS.md`, `SUBMISSION.md`, `RULES.md`, `RUBRIC.md`).
- Tự kiểm CP0: kiểm chứng bằng lệnh **clone sạch** repo sang một thư mục tạm bên ngoài (sau đó dọn thư mục tạm) và chạy trọn bộ cài đặt → build → test → headless.

### Non-Goals
- Không đoán hoặc code trước cơ chế game của PRD-0 (nhân vật Mây, đom đóm, Đèn Lồng Lớn, Bóng Mực, Test Contract chi tiết).
- Không gắn tag `phase-1`..`phase-4` hay tạo Release `v1.0.0`.
- Không tạo file `.env` hay nhúng bất kỳ API key/token nào.

### Anti-Goals
- Không dùng script đặc thù Windows (`.bat`, `.ps1`) trong `package.json`, hooks hay CI.
- Không dùng thư viện ngoài cho test runner hay helper khi Node `v22` đã có sẵn (`node:test`, `node:assert`, `fs.rmSync`) nhằm giữ `npm install` nhanh và ít rủi ro mạng.
- Không viết test luôn pass giả tạo.

---

## 3. Ràng buộc môi trường & Công cụ AI đích

- **AI Coding Agent Runtime đích:** **Google Antigravity** — phát hiện tự động `AGENTS.md` ở root, skills tại `.agents/skills/<name>/SKILL.md` (YAML frontmatter `name`, `description`), và lifecycle hooks tại `.agents/hooks.json`.
- **Máy phát triển hiện tại:** Windows (`Node.js v22.16.0`, `npm 10.9.2`, `Git`). Không có `gh` CLI, `Godot`, `Rust`, `Go`, `.NET SDK`.
- **Môi trường chấm bài:** macOS hoặc Linux, clone sạch và chạy trong tối đa 3 lệnh; Release `v1.0.0` cần bản chạy được (web tĩnh `dist/` là một lựa chọn được [SUBMISSION.md](../../SUBMISSION.md) chấp nhận).
- **Khả năng tương thích Node trên máy chấm:** Biên dịch TypeScript sang JavaScript qua `tsc` (`dist-cli/`) để chạy bằng `node` thuần thay vì phụ thuộc `--experimental-strip-types`, giúp chạy ổn định từ Node 18 trở lên trên cả macOS/Linux/Windows.
- **Thao tác thủ công của học viên (ngoài phạm vi code):** kiểm tra repo GitHub đang ở chế độ Public, đăng nhập `claude.ai` thử trợ giảng Phase 1, và kiểm tra deadline của Coach.

---

## 4. Các phương án đã cân nhắc (Approaches)

| Phương án | Ưu điểm | Đánh đổi | Quyết định |
|---|---|---|---|
| **1. TypeScript + Vite + Three.js + Node CLI (`node:test`)** | Có sẵn Node 22; tách `src/core` thuần tuyệt đối; build ra web tĩnh chạy đồng nhất macOS/Linux/Windows; test & headless chạy nhanh, tất định; không cần cài engine nặng | Cần tải package npm (`three`, `vite`, `typescript`, `@types/three`, `@types/node`) | **Đã chọn** |
| **2. Python 3.13 + Ursina / Panda3D** | Python 3.13.12 có sẵn, viết logic thuần gọn | Thư viện 3D desktop trên Python hay kén Python 3.13 và lỗi OpenGL trên môi trường chấm macOS/Linux | Loại |
| **3. Godot / C# / Rust** | Engine 3D hoàn chỉnh | Chưa cài sẵn trên máy, mất thời gian cài đặt & cấu hình vượt khung 10 phút CP0 | Loại |

---

## 5. Kiến trúc tổng thể & Đặc tả Harness

```text
                ┌──────────────────────────┐
                │   src/core/ (Pure TS)    │
                │  - Fixed-step state      │
                │  - Deterministic PRNG    │
                │  - Zero DOM / Three deps │
                └───────────┬──────────────┘
                            │ imported by both
             ┌──────────────┴──────────────┐
             ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│    src/web/ (Three.js)  │   │    src/cli/ (Node)      │
│  - Vite web entry       │   │  - Headless runner      │
│  - 3D camera, lights,   │   │  - Args + safe defaults │
│    lantern mesh         │   │  - Prints deterministic │
│  - Build -> dist/       │   │    JSON -> stdout       │
└─────────────────────────┘   └────────────┬────────────┘
                                           │ tested by
                              ┌────────────▼────────────┐
                              │  tests/ (node:test)     │
                              │  - Build CLI/core first │
                              │  - Unit + determinism   │
                              └─────────────────────────┘
```

### Quy ước ranh giới module
- `src/core/` **cấm tuyệt đối** import `three`, `window`, `document`, `process`, hay dùng `Math.random()`/`Date.now()` không kiểm soát. Tính ngẫu nhiên (nếu cần) phải dùng PRNG nhận seed tường minh.
- Toàn bộ build scripts dùng đường dẫn chuẩn POSIX hoặc Node scripts để hoạt động giống nhau trên Windows, macOS và Linux.

### Cơ chế AI Harness (Antigravity) & CI
1. **`AGENTS.md` (root):** Ngắn gọn (< 60 dòng) nêu ranh giới `src/core` vs `src/web`, các lệnh `npm run build` / `npm test` / `npm run headless`, quy tắc kiểm chứng thật trước khi báo xong, và quy tắc cập nhật `docs/notes/`.
2. **`.agents/skills/verify-phase/SKILL.md`:** Quy trình kiểm chứng chuẩn (build, chạy `npm test`, chạy kiểm tra tất định CLI 2 lần so sánh kết quả, ghi nhận vào `docs/proof/`).
3. **`.agents/hooks.json` (Antigravity `Stop` hook schema):**
   ```json
   {
     "stop-test-gate": {
       "Stop": [
         {
           "type": "command",
           "command": "node ./scripts/stop-test-gate.mjs",
           "timeout": 30
         }
       ]
     }
   }
   ```
   - **Lưu ý CWD:** Antigravity chạy hook command với working directory tại thư mục chứa `hooks.json` (tức `.agents/`), nên lệnh trỏ tới `./scripts/stop-test-gate.mjs`.
   - **Hành vi `.agents/scripts/stop-test-gate.mjs`:**
     - Đọc JSON `stdin` (`terminationReason`, `executionNum`, `workspacePaths`).
     - Xác định `repoRoot` từ `workspacePaths[0]` (fallback `path.resolve(import.meta.dirname, "../..")`).
     - Bỏ qua (trả về `{"decision":"allow"}`) nếu `terminationReason !== "NO_TOOL_CALL"`, `executionNum >= 3`, hoặc chưa có `package.json` / `node_modules/`.
     - Chạy `npm test` tại `repoRoot` với `stdio: "pipe"` (thu toàn bộ output để không làm hỏng JSON stdout của hook).
     - Nếu exit code `0`: trả về `{"decision":"allow"}`.
     - Nếu exit code khác `0`: trả về `{"decision":"continue","reason":"Tests failed (npm test). Fix the failing tests or record honest failure notes before stopping.\n<tóm tắt stderr/stdout>"}`.
4. **`.github/workflows/ci.yml`:** Chạy trên `ubuntu-latest` (Node 22) mỗi khi push/PR lên `main` hoặc tags `phase-*`: `npm ci`, `npm run build`, `npm test`, `npm run headless`.

---

## 6. Phần để mở cho bước lập kế hoạch (What's Left to the Builder)

- Cấu trúc chi tiết các file cấu hình (`package.json`, `tsconfig.json`, `tsconfig.cli.json`, `vite.config.ts`).
- Thiết kế cụ thể thực thể "hello" lantern (tọa độ, chu kỳ nhấp nhô/xoay, tham số CLI của bản thử nghiệm CP0).
- Nội dung chi tiết các mẫu file trong `docs/notes/`, `docs/proof/phase-0/`, `CREDITS.md`, `LICENSE`.
- Kịch bản kiểm tra thực tế hook `.agents/scripts/stop-test-gate.mjs` bằng giả lập payload stdin (cả case pass và case fail).
