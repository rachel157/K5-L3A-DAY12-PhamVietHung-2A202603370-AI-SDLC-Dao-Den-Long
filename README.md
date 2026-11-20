# Đảo Đèn Lồng — Day 12 AI SDLC

> **Video demo:** *(Sẽ cập nhật link `.mp4` dưới 5 phút tại Release `v1.0.0` ở Checkpoint 5 / Phase 4)*
> **Trạng thái hiện tại:** **Checkpoint 0 (Chuẩn bị)** — Khung dự án 3D (Three.js + Vite), lõi mô phỏng thuần (`src/core/`), chế độ headless deterministic (`src/cli/`), bộ kiểm thử `node:test`, và AI harness Antigravity.

---

## Mô tả ngắn

**Đảo Đèn Lồng** là game 3D góc nhìn thứ ba (Mây gom đom đóm để thắp lại các Đèn Lồng Lớn và né Bóng Mực trong sương đen), phát triển qua 4 phase theo quy trình AI SDLC. Ở Checkpoint 0, dự án cung cấp cảnh thử nghiệm "Hello Đảo Đèn Lồng" dùng chung lõi mô phỏng tất định giữa trình duyệt và CLI headless.

---

## Cài đặt & Chạy game 3D (3 lệnh)

Yêu cầu: **Node.js `^20.19.0 || >=22.12.0`** (khuyến nghị Node 22 LTS theo yêu cầu của Vite 8; bản biên dịch `dist-cli/` chạy được từ Node 18; hoạt động đồng nhất trên macOS, Linux và Windows).

```bash
npm install
npm run build
npm run preview
```

*(Để chạy chế độ phát triển có hot-reload: dùng `npm run dev` thay cho 2 lệnh cuối.)*

---

## Kiểm thử & Chế độ Headless

- **Chạy toàn bộ build CLI, test đơn vị, ranh giới `src/core`, CLI và Stop hook:**
  ```bash
  npm test
  ```
- **Chạy chế độ headless (tất định theo Test Contract v1.0):**
  ```bash
  node dist-cli/cli/headless.js --seed 7 --night 1 --ticks 60 --out run1.jsonl
  ```

---

## Điều khiển

- **Checkpoint 0:** Cảnh 3D tự động hiển thị Đèn Lồng xoay/nhấp nhô theo fixed timestep `1/60`s (chưa có điều khiển nhân vật; sẽ cập nhật theo `PRD-0` ở Phase 1).

---

## Tài liệu & Ghi chép dự án

| Tài liệu | Nội dung |
|---|---|
| [GUIDE.md](GUIDE.md) · [CHECKPOINTS.md](CHECKPOINTS.md) | Hướng dẫn lab & các mốc kiểm tra |
| [SUBMISSION.md](SUBMISSION.md) · [RULES.md](RULES.md) · [RUBRIC.md](RUBRIC.md) | Quy định nộp bài, luật & thang điểm |
| [docs/LAB_README_ORIGINAL.md](docs/LAB_README_ORIGINAL.md) | Bản lưu nguyên văn đề bài gốc |
| [docs/notes/assumptions.md](docs/notes/assumptions.md) | Giả định & truy vết yêu cầu qua các phase |
| [docs/notes/ai-log.md](docs/notes/ai-log.md) | Nhật ký sử dụng AI, lỗi & quản lý token |
| [docs/notes/retro.md](docs/notes/retro.md) | Retrospective tổng kết cuối lab |
| [docs/proof/phase-0/README.md](docs/proof/phase-0/README.md) | Bằng chứng kiểm chứng Checkpoint 0 |
| [AGENTS.md](AGENTS.md) · [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md) | AI harness sử dụng trong repo |
| [CREDITS.md](CREDITS.md) · [LICENSE](LICENSE) | Nguồn thư viện/asset & giấy phép MIT |
