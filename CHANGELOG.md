# Changelog — Đảo Đèn Lồng

Mọi thay đổi đáng chú ý qua các phase phát triển đều được ghi lại tại đây.

---

## [1.2.0] — Phase 3 (`TICKET-03` · "Đèn cạn dầu" · `Contract v1.2` · Tag `phase-3`)

> Quyết định thiết kế kiến trúc: xem [ADR-001](docs/notes/adr-001-lantern-fuel-and-win-condition.md) và bảng truy vết `P3-01..P3-08` trong [docs/notes/assumptions.md](docs/notes/assumptions.md).

### [THAY THẾ] Thay đổi luật cốt lõi & Breaking Changes (`v1.1` → `v1.2`)

1. **Hệ thống nhiên liệu đèn (`fuel: 0..100`) & lưu bằng đơn vị nguyên `1/60` (`fuelSixtieths`):**
   - **[THAY THẾ luật "đèn đã sáng không nhận thêm đom đóm"]**:
     - Đèn vừa thắp (lần đầu hoặc thắp lại) khởi tạo `fuel = 100` (`6000` đơn vị `1/60`), tự hao `1.0/s` (`-1/60` mỗi tick ở Bước 2).
     - Bấm `E` ở đèn đang sáng chưa đầy dầu nạp `used = min(carried, ceil((100 - fuel) / 10))`, tăng `fuel = min(100, fuel + 10 * used)`, trừ `carried`, cộng điểm `5 * used`, phát sự kiện `refuel { lantern_id, amount, fuel }`. Đèn đầy `100` không được chọn khi tương tác.
     - Đèn cạn dầu (`fuelSixtieths <= 0`) tắt ngay cuối Bước 2 (`lit = false`, `deposited = 0`, `fuel = 0`, giữ `ever_lit = true`), phát `lantern_out { lantern_id }`, giảm ánh sáng môi trường.
     - Đèn đã từng sáng (`ever_lit: true`) thắp lại chỉ tốn **`5` đom đóm** (`relight_cost = 5`) thay vì `10`, phát `lantern_lit { lantern_id, relight: true }`, tăng `relit_count += 1`.
2. **Vùng an toàn `6 m` khi đèn yếu & Bóng Mực hút dầu (`drain`):**
   - **[THAY THẾ luật "mọi đèn sáng luôn chặn Bóng Mực"]**: Đèn có `fuel < 30` **mất vùng an toàn `6 m`**; đúng `fuel === 30.0` vẫn giữ vùng an toàn.
   - Bóng Mực ở trạng thái `wander` ưu tiên tìm đèn sáng có `fuel < 30` khả dụng gần nhất (bằng nhau chọn `id` nhỏ hơn; ở Đêm 3 Bóng Mực Tầng 0/1 bỏ qua đèn Tầng 2 `Y >= 5.5` không có dốc nối trực tiếp), tiến tới trong `<= 2 m` XZ (`|dy| <= 1.5 m`) để chuyển sang trạng thái **`drain`**.
   - Bóng `drain` đứng yên hút `5 fuel/s` (`-5/60` mỗi tick, cộng dồn nhiều Bóng; phát `fuel_drain` mỗi `60` tick hút), chuyển `chase` nếu Mây vào `<= 6 m`, `stunned` nếu trúng Pulse, hoặc `wander` nếu đèn tắt / được châm lên `>= 30` / cách `> 2 m`.
   - Hết choáng `120` tick trả Bóng Mực về `wander` (sau đó Bước 8 cùng tick tự quyết định `chase`/`drain`/tuần tra). Châm dầu vượt mốc `>= 30` hoặc thắp lại đẩy mọi Bóng trong `< 6 m` ra mép trong tối đa `30` tick không gây sát thương.
3. **Bỏ thắng sớm `all_lit` — Điều kiện thắng bình minh (`dawn_survived`) & Thời lượng mới:**
   - **[THAY THẾ điều kiện thắng/thua & thời lượng Đêm]**: `night1/2/3_duration_s` đổi từ `300/330/360s` → **`240/270/300s`** (`14.400 / 16.200 / 18.000` ticks).
   - Không còn kết thúc Đêm khi thắp đủ đèn (`all_lit` bị gỡ bỏ). Đúng tick bình minh (`time_left_s <= 0`), kiểm tra `flames <= 0` (`no_flames`) **trước**; chỉ khi còn sống mới thắng `dawn_survived` nếu `lit >= ceil(0.6 * total)` (`3/5` Đêm 1, `4/6` Đêm 2, `5/7` Đêm 3), ngược lại thua `dawn`.
4. **Công thức tính điểm mới (`tuning.score` v1.2):**
   - `per_mote`: `10` → **`5`**
   - `per_lantern`: `100` (giữ nguyên cho đèn thắp lần đầu)
   - `per_relight`: **`40`** (mới — thắp lại đèn đã từng sáng)
   - `per_stun`: `5` (giữ nguyên cho Bóng thường)
   - `per_stun_drain`: **`15`** (mới — trúng Pulse vào Bóng đang `drain`)
   - `per_lantern_dawn`: **`50 + Math.floor(fuel)`** cho mỗi đèn còn sáng lúc thắng bình minh
   - `per_flame_left`: `50` (cộng khi thắng bình minh)
   - `per_second_left`: **đã xóa**
5. **Sức chứa túi đom đóm mở rộng (`capacity` `10 → 20`):**
   - Đầu mỗi Đêm `capacity = 10`; mỗi lần người chơi tự thắp (hoặc thắp lại) một đèn tăng sức chứa `+2`, tối đa **`20`** (`min(20, 10 + 2 * successful_lights)`). Đèn đặt sẵn `lit: true` trong `scenario` không tự tăng `successful_lights`.
6. **Contract `v1.2`, CLI & Snapshot/Scenario Schema:**
   - `player` snapshot bổ sung `capacity`.
   - `lanterns[]` snapshot bổ sung `fuel` (làm tròn 1 chữ số thập phân khi xuất), `ever_lit`, `relit_count`.
   - `scenario` bổ sung `player.successful_lights`, `lanterns[].{fuel, ever_lit}`, `shades[].state = "drain"` và `shades[].target_lantern_id` (CLI kiểm hợp lệ theo từng Đêm, sai ID thoát mã `2`).
   - Sự kiện mới: `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` thêm `relight: boolean`; `game_over` thay `all_lit` bằng `dawn_survived`.
7. **Cập nhật các test Phase 1–2 bị thay thế bởi luật mới (`[THAY THẾ v1.2]`):**
   - `tests/core-game.test.mjs`, `tests/phase2-features.test.mjs`, `tests/cli-headless.test.mjs`: cập nhật `240s`/`300s`, điểm số `per_mote=5`, bỏ `all_lit` sang `dawn_survived`, cô lập test `interact` tie-break (`fuel_decay_per_s: 0`) do `L1` đã sáng vẫn tự hao `3/60` nhận châm dầu ở tick 3, giữ nguyên toàn bộ test di chuyển/nhảy/lướt/Gió Lạc/Bùa Gió/dốc/rơi `Y < -10`/Pause + benchmark `21.600` tick.
   - `tests/web-ui-settings.test.mjs`: mở rộng `loadSettings`/`saveSettings` kiểm `colorblindMode` mặc định `false`.

### Added (Trợ năng Mù màu & Phản hồi 3D/HUD)
- **Chế độ `"Bảng màu dễ phân biệt"` (`colorblindMode` lưu `localStorage`):**
  - Mắt & viền phát sáng Bóng Mực chuyển sang xanh dương **`#00B3FF`**.
  - Cảnh báo HUD (`status-banner`, đồng hồ `<= 30s`, gió mạnh Đêm 3) dùng chữ **`#FFFFFF` kèm biểu tượng `⚠`**.
  - Đèn tắt tự **xẹp 20% chiều cao** (`scale.y = 0.8`) và hiển thị **vết rách giấy** tối màu bất kể có bật chế độ mù màu hay không.
- **Thanh dầu 3D & nhấp nháy chậm `1 Hz`:** Mọi đèn đang sáng hiển thị thanh nhiên liệu 3D xoay theo camera phía trên đỉnh đèn; khi `fuel < 30`, cả ánh đèn lẫn thanh dầu nhấp nháy ở tần số `1 Hz` và tắt vòng an toàn `6 m`.
- **HUD & Âm thanh Phase 3:** Thanh đom đóm mở rộng động `10 → 20` ô; HUD hiển thị ngưỡng đèn bình minh (`≥3`, `≥4`, `≥5`); gợi ý `E — Châm dầu (x/100)` / `E — Thắp lại (d/5)`; bổ sung SFX `playRefuel`, `playLanternOut`, `playFuelWarn`.

---

## [1.1.0] — Phase 2 (`TICKET-02` · "Ba hòn đảo" · `Contract v1.1` · Tag `phase-2`)
- Mở rộng thành 3 Đêm chơi liên hoàn (`Đảo Bến`, `Đảo Cau` 2 đảo + cầu tre + bục nhảy, `Đảo Chuông` 3 tầng + 2 dốc + Tháp Chuông + gió mạnh).
- Chuẩn hóa hằng số 60 Hz (`6.0 m/s`, nhảy `7.0 m/s`, Lướt `14 m/s`, `safe_radius: 6.0 m`, `pulse_radius: 5.0 m` 3D), bổ sung **Bùa Gió (`C1, C2`)** và **Gió Lạc (Drifters)**.
- Menu chiến dịch 3 Đêm, lời giới thiệu Ông Đăng, Pause/Resume (`Esc`/`P`), Cài đặt (`Âm lượng`, `Độ nhạy chuột`), BGM + 10+ SFX Web Audio, HUD 7 vùng.

## [1.0.0] — Phase 1 (`PRD-0` · `Contract v1.0` · Tag `phase-1`)
- Lõi mô phỏng thuần TypeScript tất định 60 Hz (`src/core/`), CLI JSONL (`src/cli/headless.js`), thế giới 3D Three.js Đêm 1 (`src/web/`).
