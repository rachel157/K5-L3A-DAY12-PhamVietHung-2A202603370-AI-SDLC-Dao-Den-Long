# Đảo Đèn Lồng — Phase 2 ("Ba hòn đảo")

> **Video demo:** *(Sẽ cập nhật link `.mp4` dưới 5 phút tại Release `v1.0.0` ở Phase 4 / Checkpoint 5)*
> **Trạng thái hiện tại:** **Phase 2 (`TICKET-02` & `Test Contract v1.1`)** — Trọn vẹn 3 Đêm chơi được liên hoàn (Đảo Bến · Đảo Cau · Đảo Chuông) trên 3D WebGL kèm hệ thống Lướt, Bùa Gió, Gió Lạc, Đảo 3 tầng/gió mạnh, Menu/Pause/Cài đặt/HUD 7 vùng/Web Audio tổng hợp và chế độ headless tất định 60 Hz.

---

## Mô tả 3 Đêm

1. **Đêm 1 — Đảo Bến (`300s`, 5 đèn `L1..L5`):** Đảo tròn bán kính `40m`, làm quen nhịp thu thập đom đóm, lướt né sương và Tỏa Sáng đẩy lùi Bóng Mực.
2. **Đêm 2 — Đảo Cau (`330s`, 6 đèn `L1..L6`):** Hai hòn đảo cách nhau bởi vực mây, nối bởi cầu tre và 2 bục nhảy gió; xuất hiện **Bùa Gió (`C1`)** tăng tốc `7.2 m/s` + lướt không hồi chiêu và **Gió Lạc (Drifter)** rình cướp đom đóm.
3. **Đêm 3 — Đảo Chuông (`360s`, 7 đèn `L1..L7`):** Địa hình 3 tầng (`Y=0 / 3 / 6`), 2 dốc nối, bục nhảy lên **Tháp Chuông**, Bóng Mực tăng tốc `4.5 m/s`, 2 **Bùa Gió (`C1, C2`)**, và chu kỳ **gió mạnh** thổi theo hướng ngẫu nhiên mỗi `30s` (cảnh báo trước `2s`).

- **Thắng:** Thắp đủ toàn bộ Đèn Lồng Lớn của Đêm (`all_lit`) → Đêm 1/2 sang Đêm tiếp theo (cộng dồn điểm); thắng Đêm 3 mở màn **Bình Minh**.
- **Thua:** Mất hết 3 Ngọn Lửa (`no_flames`, gồm bị Bóng Mực chạm hoặc rơi xuống `Y < -10`) hoặc hết giờ (`dawn`).

---

## Cài đặt & Chạy game 3D (3 lệnh)

Yêu cầu: **Node.js `^20.19.0 || >=22.12.0`** (theo yêu cầu Vite 8; bản CLI `dist-cli/` chạy từ Node 18; hoạt động đồng nhất trên macOS, Linux và Windows).

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
| Di chuyển (gồm điều khiển trên không) | `W A S D` hoặc phím mũi tên |
| Xoay góc nhìn thứ ba | Kéo chuột trái (độ nhạy lưu trong Cài đặt) hoặc `Q` / `C` |
| Nhảy (`7.0 m/s`) | `Space` |
| Lướt (`14 m/s`, `0.2s`, hồi `1.5s`) | `Shift` hoặc chuột phải |
| Nạp đom đóm vào Đèn Lồng Lớn | `E` |
| Tỏa sáng xua Bóng Mực & đẩy Gió Lạc | `R` hoặc `F` |
| Tạm dừng / Mở menu Pause | `Esc` hoặc `P` |
| Tắt / bật âm thanh nhanh | `M` hoặc nút trên HUD / Cài đặt |

---

## Cách tính điểm & Hợp đồng `game.contract.json v1.1`

Thông số chuẩn hóa theo **Ticket-02** khai báo tại [game.contract.json](game.contract.json) và khóa 1:1 với `src/core/contract.ts`:

| Hạng mục / Thông số | Giá trị chuẩn v1.1 | Ghi chú |
|---|---|---|
| Đom đóm nạp (`per_mote`) | `+10 / đom đóm` | Cộng khi **nạp** (`deposit`), sức chứa tối đa `10`, nhặt XZ `<= 1.0m` & `\|dy\| <= 1.5m` |
| Thắp sáng đèn (`per_lantern`) | `+100 / đèn` | Chi phí `lantern_cost = 10`, nạp nhiều lần được; vùng an toàn sáng bán kính `6.0m` |
| Bóng Mực trúng Tỏa Sáng (`per_stun`) | `+5 / con / lần` | Tốn `3` đom đóm, bán kính **3D** `5.0m` từ tâm `(x, y+0.8, z)`, choáng `2s` (`120` tick), đẩy `4m`, hồi `3s` |
| Thời gian còn lại khi thắng (`per_second_left`) | `+2 / giây` | Cộng `Math.floor(time_left_s) * 2` |
| Ngọn Lửa còn lại khi thắng (`per_flame_left`) | `+50 / lửa` | Tối đa `3` Ngọn Lửa, hồi đầy đầu mỗi Đêm; rơi `Y < -10` trừ `1` lửa + mất hết đom đóm đang mang |
| Lướt (`dash`) & Bùa Gió | `14 m/s` · `0.2s` · `1.5s` | Bùa Gió giúp chạy `7.2 m/s` và bỏ hồi chiêu Lướt trong `10s` (`600` tick), tái sinh `45s` |

---

## Kiểm thử & Chế độ Headless (Test Contract v1.1)

- **Chạy build CLI/core/settings + toàn bộ test đơn vị, hợp đồng v1.1, bản đồ 3 Đêm, tính năng mới, CLI & UI:**
  ```bash
  npm test
  ```
- **Chạy chế độ headless (`60 Hz`, hỗ trợ `--night 1`, `2`, `3`, xuất JSONL):**
  ```bash
  node dist-cli/cli/headless.js --seed 7 --night 1 --ticks 60 --out n1.jsonl
  node dist-cli/cli/headless.js --seed 7 --night 2 --ticks 60 --out n2.jsonl
  node dist-cli/cli/headless.js --seed 7 --night 3 --ticks 60 --out n3.jsonl
  ```
  Hỗ trợ đầy đủ `--scenario <file.json>`, `--inputs <file.json>`, `--snapshot-every <int>` (mặc định `10`); mã thoát `0` (thành công), `1` (lỗi tham số CLI), `2` (thiếu/sai định dạng file JSON v1.1).

---

## Sáng tạo của tôi

Toàn bộ sáng tạo tiếp tục được cô lập sạch trong `src/web/` và `index.html`, không làm thay đổi dù 1 byte đầu ra headless từ `src/core/`:
1. **Nhạc nền đêm & 10+ SFX tổng hợp (`src/web/audio.ts`):** Nhạc ngũ cung trầm ấm kết hợp 10 SFX bắt buộc (nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược `10s` cuối) cùng cue Bùa Gió & Gió Lạc, điều chỉnh theo thanh **Âm lượng**.
2. **Dựng hình 3D thủ công theo bảng màu chuẩn (`src/web/worldScene.ts`):** Tách rõ màu đom đóm rơi vs ngẫu nhiên, Bóng Mực chuyển màu & rung khi choáng, Gió Lạc quấn dải lụa đổi sáng khi giữ đom đóm, Bùa Gió xoay đỏ-vàng, vệt gió Đêm 3 báo hiệu trước `2s`, nón lá có đèn lồng và ánh sáng môi trường `0.15 + 0.55 * (đèn_sáng / tổng_đèn)`.
3. **Chiến dịch 3 Đêm, lời kể Ông Đăng & HUD 7 vùng (`src/web/ui.ts`, `src/web/settings.ts`):** Màn giới thiệu từng đảo với lời dặn của Ông Đăng, menu Pause (`Esc`/`P`), lưu cài đặt `localStorage`, đồng hồ nhấp nháy đỏ `<= 30s`, thanh 10 ô đom đóm, nhắc `"E — Nạp ánh sáng (x/10)"` và mũi tên xoay ngoài mép màn hình trỏ tới đèn chưa sáng gần nhất.
- **Bằng chứng không phá lõi & hồi quy:** [tests/core-boundary.test.mjs](tests/core-boundary.test.mjs) đảm bảo `src/core/` thuần TypeScript 100%; [tests/core-game.test.mjs](tests/core-game.test.mjs), [tests/maps-terrain.test.mjs](tests/maps-terrain.test.mjs), [tests/phase2-features.test.mjs](tests/phase2-features.test.mjs) và [tests/cli-headless.test.mjs](tests/cli-headless.test.mjs) kiểm chứng toàn bộ Contract v1.1 và tính tất định trên cả 3 Đêm.

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
| [docs/proof/phase-0/README.md](docs/proof/phase-0/README.md) · [docs/proof/phase-1/README.md](docs/proof/phase-1/README.md) · [docs/proof/phase-2/README.md](docs/proof/phase-2/README.md) | Bằng chứng kiểm chứng từng phase |
| [AGENTS.md](AGENTS.md) · [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md) | AI harness sử dụng trong repo |
| [CREDITS.md](CREDITS.md) · [LICENSE](LICENSE) | Nguồn thư viện/asset & giấy phép MIT |
