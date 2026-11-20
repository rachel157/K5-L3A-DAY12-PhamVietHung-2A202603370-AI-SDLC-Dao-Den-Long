# Credits — Đảo Đèn Lồng (`v1.0.0`)

## Tác giả & Mã nguồn
- **Sinh viên thực hiện:** Phạm Việt Hùng (`2A202603370`) — thiết kế gameplay, kiểm thử, kiểm duyệt và điều phối quy trình AI-SDLC qua 4 phase.

## Engine, Thư viện & Công cụ Nền tảng
- **Three.js (`^0.187.0`):** Render 3D WebGL (MIT License).
- **Vite (`^8.3.8`) & TypeScript (`^7.0.2`):** Build & type-checking đa nền tảng.
- **Node.js (`^20.19.0 || >=22.12.0`):** Chạy mô phỏng headless tất định, `node:test` runner, benchmark runner, soak runner và local server.

## Tài nguyên Đồ họa & Âm thanh (100% Procedural)
- **Mô hình 3D (`src/web/worldScene.ts`):** Toàn bộ nhân vật Mây (áo choàng, khăn đỏ, nón lá treo đèn), Bóng Mực, Gió Lạc, Đèn Lồng Lớn (kèm thanh dầu & vết rách giấy), Bùa Gió, 3 hòn đảo, cầu tre, bục nhảy, Tháp Chuông và biển mây được dựng hoàn toàn bằng hình học cơ bản (`BoxGeometry`, `CylinderGeometry`, `ConeGeometry`, `SphereGeometry`, `TorusGeometry`, `ExtrudeGeometry`) trong mã nguồn — không sử dụng model ngoài.
- **Âm thanh (`src/web/audio.ts`):** Nhạc nền ngũ cung đêm và toàn bộ SFX (nhặt đom đóm, nạp/châm dầu, thắp đèn, tắt đèn, cảnh báo hút dầu, tỏa sáng, nhảy, lướt, Bóng Mực xuất hiện, Gió Lạc, thắng/thua) được tổng hợp thời gian thực bằng Web Audio API — không sử dụng file audio ngoài.
- **Phông chữ:** System UI font stack mặc định của hệ điều hành (`system-ui, -apple-system, Segoe UI, sans-serif`).

## Công cụ AI hỗ trợ phát triển
- **Google Antigravity (Gemini 4 Hydrogen):** Hỗ trợ phân tích yêu cầu, viết spec/ADR/plan theo quy trình TDD, sinh mã TypeScript/Three.js/HTML/CSS, rà soát thiết kế (`builder-check`) và đánh giá mã nguồn độc lập (`Final Code Review`).
- **AI Harness trong repo:** `AGENTS.md`, `.agents/skills/verify-phase/SKILL.md`, `.agents/hooks.json` & `.agents/scripts/stop-test-gate.mjs`.
