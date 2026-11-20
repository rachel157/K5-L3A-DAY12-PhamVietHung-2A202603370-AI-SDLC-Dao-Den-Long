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

## Phase 1 … Phase 4

*Sẽ ghi bổ sung sau mỗi phase.*
