# Nhật ký dùng AI & Quản lý Token (AI Log)

> Ghi chép công cụ AI, các lần AI sai hoặc thiếu sót, cách chỉnh harness, và ước tính token/chi phí qua từng phase.

---

## Phase 0 (Checkpoint 0 — Chuẩn bị)

- **Công cụ AI:** Google Antigravity (model Gemini 4 Hydrogen, có điều phối subagent reviewer độc lập).
- **Công việc đã giao AI:**
  1. Phân tích repo khung đề bài và kiểm tra công cụ trên máy (Node `v22.16.0`, Python `3.13.12`, Docker `28.0.1`).
  2. Thiết kế kiến trúc tách `src/core/` – `src/web/` – `src/cli/` và AI harness (spec tại `docs/superpowers/specs/2026-11-20-checkpoint-0-design.md`).
  3. Lập kế hoạch 5 task (`docs/superpowers/plans/2026-11-20-checkpoint-0.md`) và triển khai theo chu trình TDD (Red → Green → Commit) kèm kiểm chứng clone sạch và review độc lập cuối nhánh.
- **Lỗi / sự cố phát hiện & cách xử lý:**
  - *Builder check subagent* phát hiện tài liệu thiết kế nháp ban đầu chưa ghi rõ target runtime là Google Antigravity, chưa ghi rõ schema `.agents/hooks.json` (Antigravity chạy hook trong CWD `.agents/` và đòi hỏi JSON thuần trên stdout), và cần `npm test` luôn biên dịch lại CLI để tránh test code cũ → Đã sửa dứt điểm trong spec và viết test kiểm chứng ở `tests/stop-hook.test.mjs`.
  - *Lỗi shell Windows PowerShell khi truyền cờ CLI qua npm & Final Code Reviewer subagent (`pro`)* chỉ ra 2 điểm Important: (1) `README.md` và `.agents/skills/verify-phase/SKILL.md` vẫn hướng dẫn `npm run headless -- --seed ...` vốn lỗi trên PowerShell, và (2) tài liệu ghi `Node.js >= 18` trong khi Vite 8 yêu cầu `^20.19.0 || >=22.12.0` → Đã viết test tái lập lỗi (`tests/cp0-packaging.test.mjs`), sửa `README.md`, `AGENTS.md`, `SKILL.md`, `package.json` (`engines` + `node --test` tự phát hiện không phụ thuộc glob shell), `assumptions.md`, `.github/workflows/ci.yml` và kiểm chứng lại bằng clean clone (`13/13` test PASS).
- **Chiến lược tiết kiệm token:**
  - Dùng `node:test` có sẵn của Node.js thay vì cài thư viện test ngoài và config phức tạp.
  - Giữ `AGENTS.md` ngắn gọn (27 dòng) để không đốt ngữ cảnh ở mọi lượt.
  - Chọn thực thi inline (`executing-plans`) kèm 1 lượt review độc lập ở cuối thay vì gọi subagent riêng cho từng task nhỏ.
- **Ước tính token/chi phí CP0:** Hoàn thành CP0 trong 1 phiên tương tác liên tục (thêm 1 subagent builder-check và 1 subagent final code-review ở model `pro`; bạn có thể đối chiếu con số billing thực tế trên giao diện công cụ AI nếu cần).

---

## Phase 1 (PRD-0 & Test Contract v1.0)

- **Công cụ AI:** Google Antigravity (model Gemini 4 Hydrogen, kèm 1 subagent builder-check và 1 subagent code-reviewer `pro`).
- **Công việc đã giao AI:**
  1. Tách mọi chỗ mơ hồ của PRD-0 & Test Contract v1.0 vào `docs/notes/assumptions.md` trước khi viết code.
  2. Thiết kế & lập kế hoạch triển khai `game.contract.json`, lõi mô phỏng 60 Hz (`src/core/game.ts`), CLI headless (`src/cli/headless.ts`), cảnh 3D + Web Audio + HUD (`src/web/`, `index.html`), bộ 21 unit/contract/CLI/hook tests.
  3. Kiểm chứng trên bản clone sạch và sửa lỗi theo đánh giá độc lập.
- **Lỗi / vấn đề phát hiện & cách xử lý:**
  - *Builder check subagent* cảnh báo bẫy số thực IEEE-754 (`3.0 - 180*(1/60) > 0` làm choáng thành 181 tick thay vì 180 tick), mâu thuẫn với test CP0 cũ (`tests/cp0-packaging.test.mjs`) khi CLI Phase 1 bắt buộc `--night 1 --out`, và rủi ro `interact` giữ nguyên trạng thái `true` theo zero-order hold → Đã dùng `TIMER_EPS = 1e-9` cho mọi timer, làm tròn `round3` chỉ lúc ghi JSONL, kiểm tra `all_lit` trong lúc `interact`, và cập nhật đồng bộ `SKILL.md` / `ci.yml` / `cp0-packaging.test.mjs`.
  - *Tự phát hiện khi thiết kế camera 3D:* Ở `cam_yaw_deg = 0`, công thức xoay Contract §C định nghĩa `+Z` là hướng tiến và `+X` là bên trái màn hình; đã chỉnh ánh xạ phím `A`/`D` (`+1`/`-1`) để điều khiển `WASD` khớp đúng góc camera.
  - *Independent Final Reviewer (`pro`):* Phát hiện 1 lỗi Critical trong `src/web/main.ts` (`mesh.lookAt()` mặc định `'XYZ'` kèm ghi đè `rotation.z = 0` làm lật ngược ~50% Bóng Mực phía `+Z` xuống dưới mặt đất `Y=0`), 2 lỗi Important (`Space` kích hoạt lại nút HUD đang focus; test zero-order hold cũ bị vacuous và thiếu assert cho Bóng Mực `stunned` trong `safe_radius`), cộng 1 lỗi trùng ID khi scenario đặt thực thể không `id` trước thực thể có `id` tường minh → Đã sửa toàn bộ theo chu trình `RED → GREEN` (`25/25` test pass) và kiểm chứng lại trên bản clone sạch (`82a889b`).
- **Chiến lược tiết kiệm token:**
  - Tiếp tục thực thi inline (`executing-plans`) qua 5 task thay vì gọi subagent implementer riêng cho từng task; gộp bước cập nhật tài liệu & kiểm chứng sạch.
  - Không dùng thư viện âm thanh/asset ngoài, tổng hợp nhẹ bằng Web Audio API (~95 dòng).
- **Ước tính token/chi phí CP0 + Phase 1:** Ước tính Phase 1 sử dụng ~12–16 lượt gọi công cụ chính + 2 subagent review (`builder-check` + `final code-review`), tổng ước lượng khoảng 90k–150k tokens (bao gồm context đọc diff/spec; đối chiếu chính xác qua dashboard tài khoản AI).

---

## Phase 2 … Phase 4

*Sẽ ghi bổ sung sau mỗi phase.*
