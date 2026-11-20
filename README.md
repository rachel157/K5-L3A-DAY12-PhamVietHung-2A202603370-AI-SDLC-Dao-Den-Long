# Đảo Đèn Lồng — Phase 3 ("Đèn cạn dầu")

> **Video demo:** *(Sẽ cập nhật link `.mp4` dưới 5 phút tại Release `v1.0.0` ở Phase 4)*
> **Trạng thái hiện tại:** **Phase 3 (`TICKET-03` & `Test Contract v1.2`)** — Đổi luật cốt lõi sang **nhiên liệu đèn (`0..100`)**, **Bóng Mực hút dầu (`drain`)**, **sức chứa động `10 → 20`**, **giữ sáng `≥ 60%` đèn tới bình minh (`dawn_survived`)**, cùng **Thanh dầu 3D + nhấp nháy `1 Hz`** và **Chế độ mù màu `"Bảng màu dễ phân biệt"`**. Xem [CHANGELOG.md](CHANGELOG.md) cho đầy đủ breaking changes `v1.1 → v1.2`.

---

## Mô tả 3 Đêm & Luật giữ sáng (v1.2)

1. **Đêm 1 — Đảo Bến (`240s`, 5 đèn `L1..L5`, cần `≥ 3` đèn lúc bình minh):** Đảo tròn bán kính `40m`, làm quen nhịp nhặt đom đóm, châm dầu và xua Bóng Mực khỏi đèn yếu.
2. **Đêm 2 — Đảo Cau (`270s`, 6 đèn `L1..L6`, cần `≥ 4` đèn lúc bình minh):** Hai hòn đảo nối bằng cầu tre và 2 bục nhảy gió; xuất hiện **Bùa Gió (`C1`)** và **Gió Lạc (Drifter)**.
3. **Đêm 3 — Đảo Chuông (`300s`, 7 đèn `L1..L7`, cần `≥ 5` đèn lúc bình minh):** Địa hình 3 tầng (`Y=0 / 3 / 6`), 2 dốc nối, bục nhảy lên **Tháp Chuông**, Bóng Mực `4.5 m/s`, 2 **Bùa Gió (`C1, C2`)**, và chu kỳ **gió mạnh** mỗi `30s` (báo trước `2s`).

- **Vòng đời đèn & Sức chứa mở rộng:**
  - Thắp mới tốn `10` đom đóm (`fuel = 100`, tự hao `1/s`). Bấm `E` ở đèn đang sáng chưa đầy dầu để **châm dầu** (`used = min(đang mang, ceil((100 - fuel) / 10))`, mỗi đom đóm `+10` dầu).
  - Đèn có `fuel < 30` (nhấp nháy `1 Hz`) **mất vùng an toàn `6 m`** (đúng `30` vẫn giữ vùng an toàn) và thu hút Bóng Mực `wander` tới hút **`drain` (`5/s` cộng dồn)**. Nếu cạn dầu (`fuel = 0`), đèn tắt (`lantern_out`) và chỉ cần **`5` đom đóm** để thắp lại.
  - Sức chứa túi đom đóm bắt đầu ở `10`, tăng **`+2`** mỗi lần bạn thắp (hoặc thắp lại) thành công một đèn, tối đa **`20`**.
- **Thắng / Thua (bỏ thắng sớm `all_lit`):**
  - **Thắng (`dawn_survived`):** Sống sót tới bình minh (`time_left_s = 0` với `flames > 0`) và giữ sáng ít nhất `ceil(0.6 × tổng đèn)`.
  - **Thua:** Mất hết 3 Ngọn Lửa (`no_flames`) hoặc đến bình minh mà số đèn sáng `< ceil(0.6 × tổng đèn)` (`dawn`).

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

## Cách tính điểm & Hợp đồng `game.contract.json v1.2`

Thông số chuẩn hóa theo **Ticket-03** khai báo tại [game.contract.json](game.contract.json) và khóa 1:1 với `src/core/contract.ts`:

| Hạng mục / Thông số | Giá trị chuẩn v1.2 | Ghi chú |
|---|---|---|
| Đom đóm nạp / châm dầu (`per_mote`) | **`+5 / đom đóm`** | Cộng khi **nạp** (`deposit`) hoặc **châm dầu** (`refuel`); sức chứa mở rộng **`10 → 20`** (`+2`/đèn thắp mới/thắp lại) |
| Thắp sáng đèn lần đầu (`per_lantern`) | `+100 / đèn` | Chi phí `lantern_cost = 10`; vùng an toàn `6.0m` chỉ còn hiệu lực khi **`fuel >= 30`** |
| Thắp lại đèn từng sáng (`per_relight`) | **`+40 / lần`** | Đèn đã tắt (`ever_lit: true`) thắp lại chỉ tốn **`relight_cost = 5`** đom đóm |
| Bóng Mực trúng Pulse thường (`per_stun`) | `+5 / con / lần` | Tốn `3` đom đóm, bán kính **3D** `5.0m`, choáng `120` tick (hết choáng về `wander`) |
| Bóng Mực đang `drain` trúng Pulse (`per_stun_drain`) | **`+15 / con / lần`** | Áp dụng cho Bóng đang ở trạng thái hút dầu `drain` (`-5 fuel/s` cộng dồn) |
| Thưởng bình minh (`per_lantern_dawn`, `per_flame_left`) | **`+50 + floor(fuel)` / đèn** & `+50 / lửa` | Cộng khi sống sót tới bình minh (`time_left_s = 0, flames > 0`) và giữ sáng `≥ 60%` đèn (`dawn_survived`) |

---

## Kiểm thử & Chế độ Headless (Test Contract v1.2)

- **Chạy build CLI/core/settings + toàn bộ test đơn vị, hợp đồng v1.2, bản đồ 3 Đêm, tính năng mới, CLI & UI:**
  ```bash
  npm test
  ```
- **Chạy chế độ headless (`60 Hz`, hỗ trợ `--night 1`, `2`, `3`, xuất JSONL):**
  ```bash
  node dist-cli/cli/headless.js --seed 7 --night 1 --ticks 60 --out n1.jsonl
  node dist-cli/cli/headless.js --seed 7 --night 2 --ticks 60 --out n2.jsonl
  node dist-cli/cli/headless.js --seed 7 --night 3 --ticks 60 --out n3.jsonl
  ```
  Hỗ trợ đầy đủ `--scenario <file.json>` (thêm `lanterns[].{lit, fuel, ever_lit}`, `player.successful_lights`, `shades[].{state: "drain", target_lantern_id}`), `--inputs <file.json>`, `--snapshot-every <int>`; mã thoát `0` (thành công), `1` (lỗi tham số CLI), `2` (thiếu/sai định dạng JSON v1.2).

---

## Sáng tạo & Trợ năng (Phase 3)

Toàn bộ sáng tạo & cải tiến trực quan tiếp tục cô lập sạch trong `src/web/` và `index.html`, không làm thay đổi dù 1 byte đầu ra headless từ `src/core/`:
1. **Chế độ mù màu `"Bảng màu dễ phân biệt"` (`src/web/settings.ts`, `worldScene.ts`, `ui.ts`, `index.html`):** Lưu tùy chọn `colorblindMode` vào `localStorage`; khi bật sẽ đổi mắt & vòng phát sáng Bóng Mực sang `#00B3FF` và đổi cảnh báo HUD sang chữ `#FFFFFF` kèm biểu tượng `⚠`. Đèn tắt luôn xẹp 20% chiều cao (`scale.y = 0.8`) kèm vết rách giấy rõ rệt.
2. **Thanh dầu 3D & nhấp nháy chậm `1 Hz` (`src/web/worldScene.ts`):** Mọi đèn đang sáng hiển thị thanh dầu 3D xoay theo camera; khi `fuel < 30`, cả ánh đèn lẫn thanh dầu nhấp nháy `1 Hz` và thu hồi vòng an toàn `6m`.
3. **Âm thanh & HUD Phase 3 (`src/web/audio.ts`, `ui.ts`, `main.ts`):** Bổ sung SFX `playRefuel`, `playLanternOut`, `playFuelWarn`; thanh túi đom đóm mở rộng động `10 → 20` ô; HUD hiển thị mục tiêu bình minh (`≥3`, `≥4`, `≥5`) và gợi ý `E — Châm dầu (x/100)` / `E — Thắp lại (d/5)`.
- **Bằng chứng không phá lõi & hồi quy:** [tests/core-boundary.test.mjs](tests/core-boundary.test.mjs) đảm bảo `src/core/` thuần TypeScript 100%; [tests/core-game.test.mjs](tests/core-game.test.mjs), [tests/maps-terrain.test.mjs](tests/maps-terrain.test.mjs), [tests/phase2-features.test.mjs](tests/phase2-features.test.mjs), [tests/phase3-features.test.mjs](tests/phase3-features.test.mjs) và [tests/cli-headless.test.mjs](tests/cli-headless.test.mjs) kiểm chứng toàn bộ Contract v1.2 và các luật không bị thay thế từ Phase 1–2.

---

## Tài liệu & Ghi chép dự án

| Tài liệu | Nội dung |
|---|---|
| [CHANGELOG.md](CHANGELOG.md) · [ADR-001](docs/notes/adr-001-lantern-fuel-and-win-condition.md) | Chi tiết thay đổi phá vỡ `v1.1 → v1.2` & quyết định kiến trúc nhiên liệu / bình minh |
| [GUIDE.md](GUIDE.md) · [CHECKPOINTS.md](CHECKPOINTS.md) | Hướng dẫn lab & các mốc kiểm tra |
| [SUBMISSION.md](SUBMISSION.md) · [RULES.md](RULES.md) · [RUBRIC.md](RUBRIC.md) | Quy định nộp bài, luật & thang điểm |
| [docs/LAB_README_ORIGINAL.md](docs/LAB_README_ORIGINAL.md) | Bản lưu nguyên văn đề bài gốc |
| [docs/notes/assumptions.md](docs/notes/assumptions.md) | Giả định & truy vết yêu cầu `P1`..`P3` |
| [docs/notes/ai-log.md](docs/notes/ai-log.md) | Nhật ký sử dụng AI, lỗi & quản lý token |
| [docs/proof/phase-0/README.md](docs/proof/phase-0/README.md) · [phase-1](docs/proof/phase-1/README.md) · [phase-2](docs/proof/phase-2/README.md) · [phase-3](docs/proof/phase-3/README.md) | Bằng chứng kiểm chứng từng phase |
| [AGENTS.md](AGENTS.md) · [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md) | AI harness sử dụng trong repo |
| [CREDITS.md](CREDITS.md) · [LICENSE](LICENSE) | Nguồn thư viện/asset & giấy phép MIT |
