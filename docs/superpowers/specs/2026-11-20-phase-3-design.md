# Design Doc: Phase 3 — TICKET-03 "Đèn cạn dầu" & Test Contract v1.2

- **Ngày:** 2026-11-20
- **Phạm vi:** Phase 3 (tag nộp `phase-3`), Change Request thay đổi luật cốt lõi (nhiên liệu đèn, Bóng Mực hút dầu, luật thắng bình minh, sức chứa tăng dần, bảng điểm mới, chế độ mù màu) và nâng cấp `Test Contract v1.2`.
- **ADR & Giả định chi tiết:**
  - [docs/notes/adr-001-lantern-fuel-and-win-condition.md](../../notes/adr-001-lantern-fuel-and-win-condition.md)
  - [docs/notes/assumptions.md](../../notes/assumptions.md) (`P3-01`..`P3-08`)

---

## 1. Mục tiêu & Nguyên tắc Thiết kế

1. Chuyển vòng lặp gameplay từ *"thắp đủ là thắng sớm"* sang *"duy trì ít nhất 60% số Đèn Lồng Lớn sáng tới bình minh"* (`240s / 270s / 300s`).
2. Mô hình hóa nhiên liệu theo **số nguyên đơn vị `1/60`** (`fuelSixtieths ∈ [0, 6000]`) để loại bỏ 100% sai số dấu phẩy động IEEE-754 khi vừa tự hao (`-1/60`) vừa bị Bóng Mực hút (`-5/60` mỗi con).
3. Cô lập hoàn toàn hình ảnh thanh dầu 3D, nhấp nháy `1 Hz`, hình dạng đèn xẹp rách giấy khi tắt, và tùy chọn **Bảng màu dễ phân biệt** trong `src/web/` + `index.html`, giữ `src/core/` thuần TypeScript và tất định tuyệt đối.

---

## 2. Đặc tả Kỹ thuật: Lõi Mô Phỏng & Test Contract v1.2

### A. `game.contract.json` (`contract_version: "1.2"`)

```json
{
  "contract_version": "1.2",
  "team": "2A202603370-PhamVietHung",
  "build_cmd": "npm ci && npm run build",
  "run_cmd": "npm run preview",
  "headless_cmd": "node dist-cli/cli/headless.js",
  "tuning": {
    "player_speed": 6,
    "dash_speed": 14,
    "dash_duration_s": 0.2,
    "dash_cooldown_s": 1.5,
    "carry_capacity": 10,
    "lantern_cost": 10,
    "lantern_count_night1": 5,
    "pickup_radius": 1,
    "interact_radius": 2,
    "pulse_cost": 3,
    "pulse_radius": 5,
    "night1_duration_s": 240,
    "night2_duration_s": 270,
    "night3_duration_s": 300,
    "flames": 3,
    "invuln_s": 1.5,
    "hit_drop_ratio": 0.5,
    "pulse_stun_s": 2,
    "pulse_push_m": 4,
    "pulse_cooldown_s": 3,
    "safe_radius": 6,
    "shade_speed": 4,
    "shade_hit_radius": 1,
    "fall_enabled": true,
    "fuel_max": 100,
    "fuel_decay_per_s": 1.0,
    "fuel_per_mote": 10,
    "relight_cost": 5,
    "win_ratio": 0.6,
    "drain_per_s": 5,
    "low_fuel_threshold": 30,
    "capacity_max": 20,
    "score": {
      "per_mote": 5,
      "per_lantern": 100,
      "per_relight": 40,
      "per_stun": 5,
      "per_stun_drain": 15,
      "per_lantern_dawn": 50,
      "per_flame_left": 50
    }
  }
}
```

### B. Nhiên liệu Đèn, Tương tác Châm dầu & Thắp lại

- **Trạng thái đèn:** mỗi `LanternEntity` có `{ id, pos, lit, deposited, fuelSixtieths, everLit, relitCount }`.
  - Khi mới tạo Đêm: `lit = false`, `deposited = 0`, `fuelSixtieths = 0`, `everLit = false`, `relitCount = 0`.
  - Khi `scenario.lanterns` đặt `lit: true` mà không đặt `fuel`: mặc định `fuel = tuning.fuel_max` (`100`, tức `fuelSixtieths = 6000`), và `everLit = item.ever_lit ?? true`. Khi `!lit`: `fuelSixtieths = 0`.
- **Bước 2 (Hao dầu & Tắt đèn):**
  - Với mọi đèn `lit === true`: trừ `decayPerTick = Math.round(tuning.fuel_decay_per_s)` (`1` đơn vị `1/60`) + `drainingCount * Math.round(tuning.drain_per_s)` (`5` đơn vị `1/60` mỗi con đang ở trạng thái `"drain"` nhắm vào đèn này).
  - Với mỗi Bóng Mực đang `"drain"` vào đèn đó (duyệt theo `id` tăng dần): tăng `shade.drainTicks += 1`; khi `shade.drainTicks % 60 === 0`, phát sự kiện `fuel_drain { lantern_id, shade_id, fuel: round1(Math.max(0, lantern.fuelSixtieths) / 60) }`.
  - Ngay sau bước trừ dầu ở Bước 2: nếu `lantern.lit && lantern.fuelSixtieths <= 0`, đặt `lantern.lit = false`, `lantern.fuelSixtieths = 0`, `lantern.deposited = 0`, `lantern.everLit = true`, phát `lantern_out { lantern_id }`, và chuyển mọi Bóng Mực đang `"drain"` đèn này về `"wander"` (`targetLanternId = null`, `drainTicks = 0`).
- **Bước 5 (Tương tác `E`):**
  - Chỉ xét đèn **nhận được đom đóm** trong bán kính `distXZ <= 2.0m && |dy| <= 1.5m`:
    - Hoặc `!lantern.lit` (chưa sáng),
    - Hoặc `lantern.lit && lantern.fuelSixtieths < maxFuelSixtieths` (đang sáng nhưng chưa đầy dầu `100`).
  - Chọn đèn gần nhất theo XZ (hòa thì `id` nhỏ hơn). Đèn đầy `fuelSixtieths === maxFuelSixtieths` không được chọn, không phát sự kiện, không cộng điểm.
  - **Nếu đèn đang sáng (`lit === true`):**
    - `needed = Math.ceil((maxFuelSixtieths - lantern.fuelSixtieths) / (tuning.fuel_per_mote * 60))`
    - `used = Math.min(player.carried, needed)`
    - Trừ `player.carried -= used`; tăng `lantern.fuelSixtieths = Math.min(maxFuelSixtieths, prevFuel + used * tuning.fuel_per_mote * 60)`; cộng `world.score += used * score.per_mote`; phát `refuel { lantern_id, amount: used, fuel: round1(lantern.fuelSixtieths / 60) }`.
    - Nếu `prevFuel < lowFuelSixtieths && lantern.fuelSixtieths >= lowFuelSixtieths`: chuyển mọi Bóng Mực đang `"drain"` đèn này về `"wander"` và gắn `evadeTicksLeft = 30` cho mọi Bóng trong `< safe_radius`.
  - **Nếu đèn đang tắt (`lit === false`):**
    - `cost = lantern.everLit ? tuning.relight_cost : tuning.lantern_cost` (`5` vs `10`).
    - `amount = Math.min(player.carried, cost - lantern.deposited)`, cộng `amount * score.per_mote` điểm, phát `deposit { lantern_id, amount, deposited }`.
    - Khi `deposited >= cost`: đặt `isRelight = lantern.everLit`, `lit = true`, `fuelSixtieths = maxFuelSixtieths`, `everLit = true`, nếu `isRelight` tăng `relitCount += 1`; tăng `world.successfulLights += 1`; cộng `isRelight ? score.per_relight : score.per_lantern` (`40` vs `100`); phát `lantern_lit { lantern_id, relight: isRelight }`; đẩy Bóng trong `< safe_radius` với `evadeTicksLeft = 30`.

### C. Bóng Mực (`drain`), Vùng an toàn, Tỏa sáng & Sức chứa

- **Sức chứa Mây (`capacity`):** `Math.min(tuning.capacity_max, tuning.carry_capacity + 2 * world.successfulLights)` (tối đa `20`; đặt lại `successfulLights = 0` đầu mỗi Đêm; đèn đặt sẵn qua `scenario` không tăng `successfulLights`).
- **Vùng an toàn (`6m`):** Đèn có `lit && fuelSixtieths >= tuning.low_fuel_threshold * 60` (`fuel >= 30.0`) mới tạo vùng an toàn trong `stepSafeZones` và lọc điểm spawn Bóng Mực (`findValidShadeSpawnPoint`). Đèn `fuel < 30` mất vùng an toàn.
- **Máy trạng thái Bóng Mực:**
  - `spawning` / `recoil`: giữ nguyên Phase 2 (khi hết timer ở Bước 2 xét `distXZ <= 12m ? "chase" : "wander"`).
  - `stunned`: trúng Tỏa Sáng trong 3D `<= 5.0m` xóa `targetLanternId = null`, `drainTicks = 0`; cộng `score.per_stun_drain (15)` nếu ngay trước đó đang `"drain"`, ngược lại cộng `score.per_stun (5)`. Khi hết `120` tick choáng ở Bước 2 -> đặt `state = "wander"`, sau đó Bước 8 trong cùng tick đánh giá chuyển trạng thái bình thường theo luật `wander` (`<= 12m` -> `"chase"`, ngoài `12m` -> tìm đèn yếu/tắt).
  - `wander` (tốc độ `2 m/s`):
    1. Nếu Mây sống trong `<= 12m` -> chuyển `"chase"`.
    2. Nếu không, lọc các đèn **có thể tiếp cận theo tầng** (ở Đêm 3, đèn Tầng 2 như `L1` tại `Y=6` chỉ xét khi Bóng đang ở Tầng 2 `shadeFloorY >= 5.5` để Bóng Tầng 0/1 không kẹt vô hạn vào vách đứng). Tìm đèn sáng yếu (`lit && fuel < 30`) gần nhất trong tập này (hòa chọn `id` nhỏ hơn). Nếu có và `distXZ <= 2.0m && |shadeFloorY - lantern.y| <= 1.5m` -> chuyển `"drain"`, `targetLanternId = lantern.id`, `drainTicks = 0`; nếu ở xa hơn thì dẫn đường tới đèn yếu đó (dùng chung routing cầu Đêm 2 / dốc Đêm 3).
    3. Nếu không có đèn sáng yếu khả dụng -> đi tới đèn tắt khả dụng gần nhất (`!lit`); nếu không có hoặc đã đứng gần `<= 2.0m`, tuần quanh khu vực theo `wanderAngle`.
  - `chase`: đuổi Mây (`4.0 m/s`, Đêm 3 `4.5 m/s`), **không đổi mục tiêu** sang đèn yếu; bỏ đuổi về `"wander"` khi `> 18m` hoặc Mây đang chờ hồi sinh.
  - `drain`: đứng yên tại đèn đang hút. Ra khỏi `"drain"` khi:
    - Mây sống vào trong `<= 6.0m` (XZ) -> `"chase"` (`targetLanternId = null`, `drainTicks = 0`).
    - Đèn tắt, `fuel >= 30`, hoặc `distXZ > 2.0m` -> `"wander"`.
    - Trúng Pulse -> `"stunned"`.

### D. Điều kiện Thắng/Thua Bình Minh & Schema v1.2

- **Bước 11 (`stepWinLoss`):**
  1. `flames <= 0` -> `lost` (`no_flames`), **luôn kiểm trước** kể cả đúng tick cuối (`timeLeftTicks <= 0`).
  2. Không còn thắng sớm khi thắp đủ toàn bộ đèn.
  3. Khi `timeLeftTicks <= 0`: đếm `litCount = lanterns.filter(l => l.lit).length` vs `needed = Math.ceil(tuning.win_ratio * lanterns.length)` (`3/5`, `4/6`, `5/7`).
     - Nếu `litCount >= needed`: **THẮNG (`won`, `reason: "dawn_survived"`)**, cộng thêm thưởng bình minh: với mỗi đèn đang sáng `+ score.per_lantern_dawn (50) + Math.floor(lantern.fuelSixtieths / 60)`, và với mỗi Ngọn Lửa còn lại `+ score.per_flame_left (50)`.
     - Nếu `litCount < needed`: **THUA (`lost`, `reason: "dawn"`)**.
- **Schema JSONL v1.2:**
  - Snapshot `lanterns[]` thêm `fuel` (`round1`, đèn tắt `0`), `ever_lit`, `relit_count`; `player` thêm `capacity`; `shades[].state` thêm `"drain"`.
  - Scenario `lanterns[]` thêm `lit?`, `fuel?`, `ever_lit?`; `player` thêm `successful_lights?`; `shades[]` thêm `target_lantern_id?`. Trong CLI (`headless.ts`), `target_lantern_id` phải là `id` đèn hợp lệ của Đêm tương ứng (`L1..L5/L6/L7`), sai sẽ thoát mã `2`. Tại tick `0` của `createGameWorld`, Bóng đặt `state: "drain"` tự gắn `target_lantern_id` (hoặc đèn sáng yếu gần nhất `<= 2m`), và nếu đèn mục tiêu tắt / `fuel >= 30` / ngoài `2m` XZ / chênh cao `> 1.5m` thì chuẩn hóa ngay về `"wander"` ở tick `0`.

---

## 3. Đồ họa 3D, HUD & Chế độ Mù Màu

- **`settings.ts` & UI Cài đặt:** Thêm `colorblindMode: boolean` (mặc định `false`, lưu trong `localStorage`).
- **Chế độ Mù màu (`colorblindMode = true`):**
  - Mắt & viền/hào quang Bóng Mực đổi từ `#7A3CFF` → `#00B3FF`.
  - Màu cảnh báo UI (`--crimson` / `.urgent` / tim / đèn yếu) đổi `#FF5A5F` → `#FFFFFF`, luôn hiển thị biểu tượng `⚠`.
- **Phân biệt không phụ thuộc màu (luôn bật):**
  - Đèn đang tắt bị xẹp chiều cao `20%` (`scale.y = 0.8`) và hiện các vết rách giấy trên thân lồng đèn.
  - Đèn đang sáng hiển thị thanh dầu 3D phía trên lồng đèn; khi `fuel < 30`, cả ánh sáng/lõi đèn và thanh dầu nhấp nháy chậm chu kỳ `1 Hz`.
- **HUD & Âm thanh:** HUD hiển thị `Đom đóm: carried / capacity` (tối đa `20` ô), ngưỡng thắng đèn `lit / total (Cần ≥ needed)`, gợi ý `"E — Châm dầu (fuel/100)"` hoặc `"E — Nạp ánh sáng (deposited/cost)"`, và cảnh báo `⚠` khi đèn cạn dưới 30% hoặc đang bị Bóng Mực hút dầu.
