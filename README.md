# Đảo Đèn Lồng — Day 12 AI SDLC (Phase 1)

> **Video demo:** *(Sẽ cập nhật link `.mp4` dưới 5 phút tại Release `v1.0.0` ở Phase 4 / Checkpoint 5)*
> **Trạng thái hiện tại:** **Phase 1 (`PRD-0` & `Test Contract v1.0`)** — Đêm 1: Đảo Bến chơi được từ đầu tới thắng/thua trên 3D WebGL và chạy kiểm thử tự động qua chế độ headless deterministic.

---

## Mô tả ngắn

Người chơi vào vai **Mây** (người giữ đèn nhỏ tuổi đội nón lá có treo đèn lồng nhỏ) trên **Đảo Bến** hình tròn bán kính `35m`. Khi sương đen phủ kín đảo, Mây thu thập đom đóm để nạp ánh sáng cho **5 Đèn Lồng Lớn** (`L1..L5`) và né **Bóng Mực** tím đen. Mây có thể **tỏa sáng (Pulse)** để đẩy lùi và làm choáng Bóng Mực trong thoáng chốc (tiêu tốn đom đóm đang mang), hoặc đứng trong vùng an toàn quanh các đèn đã thắp.

- **Thắng:** Thắp sáng cả 5 Đèn Lồng Lớn (`all_lit`).
- **Thua:** Mất hết ngọn lửa hộ thân (`no_flames`) hoặc hết thời gian đêm (`dawn`).

---

## Cài đặt & Chạy game 3D (3 lệnh)

Yêu cầu: **Node.js `^20.19.0 || >=22.12.0`** (khuyến nghị Node 22 LTS theo yêu cầu của Vite 8; bản biên dịch `dist-cli/` chạy được từ Node 18; hoạt động đồng nhất trên macOS, Linux và Windows).

```bash
npm install
npm run build
npm run preview
```

*(Để chạy dev server hot-reload: thay 2 lệnh cuối bằng `npm run dev`.)*

---

## Điều khiển

| Thao tác | Phím / Chuột |
|---|---|
| Di chuyển | `W A S D` hoặc phím mũi tên |
| Xoay góc nhìn thứ ba | Kéo chuột trái hoặc `Q` / `C` |
| Nhảy | `Space` |
| Nạp đom đóm vào Đèn Lồng Lớn | `E` hoặc `F` |
| Tỏa sáng xua Bóng Mực (Pulse) | `R`, `Shift`, hoặc chuột phải |
| Bật / tắt âm thanh | `M` hoặc nút trên HUD |
| Chơi lại sau khi thắng/thua | Nút **Chơi lại** trên màn hình |

---

## Cách tính điểm & Hợp đồng `game.contract.json`

Các thông số chính thức được khai báo trong [game.contract.json](game.contract.json) và khóa đồng bộ 1:1 với lõi mô phỏng (`src/core/contract.ts`):

| Sự kiện / Thông số | Giá trị | Giải thích |
|---|---|---|
| Nhặt 1 đom đóm (`per_mote`) | `+10` | Sức chứa tối đa `carry_capacity = 5`, nhặt trong bán kính `1.5m` |
| Thắp sáng 1 đèn (`per_lantern`) | `+200` | Mỗi đèn cần `lantern_cost = 3` đom đóm, nạp trong `2.5m`; đèn sáng có `safe_radius = 4.5m` |
| Làm choáng 1 Bóng Mực (`per_stun`) | `+50` | Pulse tốn `1` đom đóm, bán kính `6m`, đẩy `4m`, choáng `3s`, hồi chiêu `2s` |
| Thời gian còn lại khi thắng (`per_second_left`) | `+2 / giây` | Cộng `Math.floor(time_left_s) * 2` khi thắp đủ 5 đèn (`night1_duration_s = 300s`) |
| Ngọn lửa còn lại khi thắng (`per_flame_left`) | `+100 / lửa` | Tối đa `flames = 3`; bị chạm mất 1 lửa (`invuln_s = 1.5s`), rơi `floor(carried * 0.5)` |
| `fall_enabled` | `false` | Đảo Bến có giới hạn biên tròn `34.5m`, không có cơ chế rơi khỏi đảo ở Phase 1 |

---

## Kiểm thử & Chế độ Headless (Test Contract v1.0)

- **Chạy toàn bộ build CLI, test đơn vị, test hợp đồng, ranh giới `src/core`, CLI và Stop hook:**
  ```bash
  npm test
  ```
- **Chạy chế độ headless (`60 Hz`, xuất JSONL):**
  ```bash
  node dist-cli/cli/headless.js --seed 7 --night 1 --ticks 60 --out run1.jsonl
  ```
  Hỗ trợ đầy đủ các cờ `--scenario <file.json>`, `--inputs <file.json>`, `--snapshot-every <int>` (mặc định `10`), mã thoát `0` (thành công), `1` (sai tham số CLI), `2` (thiếu/sai định dạng file scenario/inputs).

---

## Sáng tạo của tôi

Toàn bộ phần sáng tạo nằm riêng trong lớp trình diễn (`src/web/` và `index.html`) để giữ nguyên 100% logic và đầu ra JSONL của chế độ headless:
1. **Âm thanh Web Audio tổng hợp nhẹ (`src/web/audio.ts`):** Tạo chuông ngũ cung khi nhặt đom đóm, hợp âm ấm khi nạp/thắp đèn, tiếng sóng tỏa sáng, hiệu ứng chạm Bóng Mực và giai điệu thắng/thua — không dùng asset ngoài và có phím `M` tắt/bật.
2. **Hiệu ứng ánh sáng chuyển biến theo tiến độ:** Bầu trời, sương đêm và ánh sáng môi trường của Đảo Bến sáng dần lên mỗi khi thắp thêm đèn; đèn đã sáng hiện vòng hào quang `safe_radius`; vòng sóng ánh sáng 3D tỏa ra khi dùng Pulse; các hạt đom đóm nhỏ bay quanh Mây tỷ lệ theo số lượng đang mang.
- **Bằng chứng phần lõi không bị ảnh hưởng:** [tests/core-boundary.test.mjs](tests/core-boundary.test.mjs) kiểm tra tĩnh `src/core/` không có bất kỳ phụ thuộc `three`/Web Audio/DOM nào; [tests/core-game.test.mjs](tests/core-game.test.mjs) và [tests/cli-headless.test.mjs](tests/cli-headless.test.mjs) xác nhận toàn bộ Test Contract v1.0 chạy thuần trên `src/core/` với tính tất định tuyệt đối.

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
| [docs/proof/phase-0/README.md](docs/proof/phase-0/README.md) · [docs/proof/phase-1/README.md](docs/proof/phase-1/README.md) | Bằng chứng kiểm chứng từng phase |
| [AGENTS.md](AGENTS.md) · [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md) | AI harness sử dụng trong repo |
| [CREDITS.md](CREDITS.md) · [LICENSE](LICENSE) | Nguồn thư viện/asset & giấy phép MIT |
