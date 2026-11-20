# Nhật ký dùng AI & Quản lý Token (AI Log)

> Ghi chép công cụ AI, các lần AI sai hoặc thiếu sót, cách chỉnh harness, và ước tính token/chi phí qua từng phase.

---

## Phase 0 (Checkpoint 0 — Chuẩn bị)

- **Công cụ AI:** Google Antigravity (model Gemini 4 Hydrogen, có điều phối subagent reviewer độc lập).
- **Công việc đã giao AI:**
  1. Phân tích repo khung đề bài và kiểm tra công cụ trên máy (Node `v22.16.0`, Python `3.13.12`, Docker `28.0.1`).
  2. Thiết kế kiến trúc tách `src/core/` – `src/web/` – `src/cli/` và AI harness (spec tại `docs/superpowers/specs/2026-11-20-checkpoint-0-design.md`).
  3. Lập kế hoạch 5 task và triển khai theo chu trình TDD (Red → Green → Commit) + review độc lập cuối nhánh.
- **Lỗi / thiếu sót phát hiện & cách xử lý:**
  - *Builder check subagent* phát hiện tài liệu thiết kế nháp ban đầu chưa ghi rõ target runtime là Google Antigravity, chưa ghi rõ schema `.agents/hooks.json` (Antigravity chạy hook trong CWD `.agents/` và đòi hỏi JSON thuần trên stdout), và cần `npm test` luôn biên dịch lại CLI để tránh test code cũ → Đã sửa dứt điểm trong spec và chốt test cho hook ở `tests/stop-hook.test.mjs`.
- **Chiến lược tiết kiệm token:**
  - Dùng `node:test` có sẵn của Node.js thay vì cài thư viện test ngoài và config phức tạp.
  - Giữ `AGENTS.md` ngắn gọn (27 dòng) để không đốt ngữ cảnh ở mọi lượt.
  - Chọn thực thi inline (`executing-plans`) kèm 1 lượt review độc lập ở cuối thay vì gọi subagent riêng cho từng task nhỏ.
- **Ước tính token/chi phí CP0:** *Sẽ cập nhật sau khi hoàn tất Task 5.*

---

## Phase 1 … Phase 4

*Sẽ ghi bổ sung sau mỗi phase.*
