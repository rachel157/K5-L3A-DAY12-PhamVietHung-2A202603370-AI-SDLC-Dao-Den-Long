# Design Doc: Phase 2 — Ticket-02 "Ba hòn đảo" & Test Contract v1.1

- **Ngày:** 2026-11-20
- **Phạm vi:** Phase 2 (tag nộp `phase-2`), chuẩn hóa số liệu, mở rộng 3 Đêm, Gió Lạc, Bùa Gió, Gió Mạnh, Giao diện/HUD/Âm thanh/Menu và Test Contract v1.1
- **Giả định chi tiết:** [docs/notes/assumptions.md](../../notes/assumptions.md)
- **Trạng thái:** Sẵn sàng duyệt (đã qua builder check)

---

## 1. Mục tiêu & Ranh giới

1. Chuẩn hóa 100% hằng số vật lý, di chuyển, nhảy (`7.0 m/s`, `-20 m/s²`), lướt (`14 m/s`, `0.2s`, `1.5s`), đom đóm (`10` sức chứa, `20` ban đầu, trần `30`), đèn (`10` chi phí, `2.0m`, `6.0m` safe radius), Tỏa Sáng (`3` chi phí, `5m` 3D, `3s`), Bóng Mực (5 trạng thái), điểm số và thứ tự 12 bước trong 1 tick theo **Ticket-02 Phần 1**.
2. Hỗ trợ trọn vẹn 3 bản đồ chuẩn (**Đêm 1 — Đảo Bến**, **Đêm 2 — Đảo Cau**, **Đêm 3 — Đảo Chuông**) cả trên chế độ **headless (`Contract v1.1`)** lẫn **3D WebGL**, đảm bảo mô phỏng 21.600 tick headless chạy trong **≤ 30 giây** và game 3D đạt **≥ 30 FPS** ở `1280×720`.
3. Tách hoàn toàn phần trình diễn sáng tạo (âm thanh, hiệu ứng gió, hạt đom đóm, UI/menu, cài đặt lưu `localStorage`) trong `src/web/` để không thay đổi đầu ra headless.

---

## 2. Đặc tả Kỹ thuật: Lõi Mô Phỏng & Test Contract v1.1

### A. `game.contract.json` (`contract_version: "1.1"`)
```json
{
  "contract_version": "1.1",
  "team": "2A202603370-PhamVietHung",
  "build_cmd": "npm ci && npm run build",
  "run_cmd": "npm run preview",
  "headless_cmd": "node dist-cli/cli/headless.js",
  "tuning": {
    "player_speed": 6.0,
    "dash_speed": 14.0,
    "dash_duration_s": 0.2,
    "dash_cooldown_s": 1.5,
    "carry_capacity": 10,
    "lantern_cost": 10,
    "lantern_count_night1": 5,
    "pickup_radius": 1.0,
    "interact_radius": 2.0,
    "pulse_cost": 3,
    "pulse_radius": 5.0,
    "night1_duration_s": 300,
    "night2_duration_s": 330,
    "night3_duration_s": 360,
    "flames": 3,
    "invuln_s": 1.5,
    "hit_drop_ratio": 0.5,
    "pulse_stun_s": 2.0,
    "pulse_push_m": 4.0,
    "pulse_cooldown_s": 3.0,
    "safe_radius": 6.0,
    "shade_speed": 4.0,
    "shade_hit_radius": 1.0,
    "fall_enabled": true,
    "score": {
      "per_mote": 10,
      "per_lantern": 100,
      "per_stun": 5,
      "per_second_left": 2,
      "per_flame_left": 50
    }
  }
}
```
- Đêm 3 dùng tốc độ Bóng Mực `4.5 m/s` (tỉ lệ `tuning.shade_speed * (4.5 / 4.0)`).
- Số liệu vật lý chuẩn: `JUMP_VELOCITY_MPS = 7.0`, `GRAVITY_MPS2 = 20`, tăng tốc/dừng ngang tức thời trong `1` tick (`1/60s ≤ 0.1s`), hỗ trợ điều khiển trên không đầy đủ.

### B. Hình học & Địa hình chuẩn 3 Đêm (`x = R*cosθ, z = R*sinθ`, θ đo từ `+X` CCW)
- **Đêm 1 — Đảo Bến (`300s`, 5 đèn):**
  - Mặt đất tròn `r <= 40` (`Y = 0`), ngoài `40m` là vực rơi. Xuất phát `(0,0,0)` quay mặt `+Z` (`facing = [0, 0, 1]`).
  - 5 đèn: `L1 (0,0,25)`, `L2 (23.8,0,7.7)`, `L3 (14.7,0,-20.2)`, `L4 (-14.7,0,-20.2)`, `L5 (-23.8,0,7.7)`.
  - 24 điểm sinh đom đóm: 8 điểm `R=12` (mỗi `45°` từ `0°`) + 16 điểm `R=33` (mỗi `22.5°` từ `0°`). Khởi tạo `20` đom đóm tại `20` điểm khác nhau bằng PRNG.
  - 12 điểm sinh Bóng Mực: `R=37` tại `15°, 45°, ...`; lọc `distXZ >= 15m` từ người chơi và ngoài `6m` đèn sáng; tại tick `0` có `0` Bóng Mực, sinh `2` con tại `tick 300`, sau đó `1` con mỗi `480` tick (`8s`), tối đa `6`.
- **Đêm 2 — Đảo Cau (`330s`, 6 đèn):**
  - Đất `Y = 0`: Đảo A `hypot(x, z) <= 28`, Đảo B `hypot(x - 70, z) <= 28`, cầu tre `x ∈ [26, 44] && z ∈ [-2, 2]`.
  - 2 bục nhảy (`r <= 1.0m` khi chạm đất): `(20, 0, 18)` phóng hướng về `(70, 0, 0)`; `(50, 0, -18)` phóng hướng về `(0, 0, 0)` với `vy = 14 m/s`, `vh = 24 m/s` (giữ `launchVel` tới khi chạm đất, không bị phím di chuyển ghi đè; vẫn được lướt — lúc đang lướt tạm áp vận tốc lướt `14 m/s` trong 12 tick rồi khôi phục `launchVel` nếu còn trên không).
  - 6 đèn (`L1..L6`): `(0,0,20)`, `(17,0,-10)`, `(-17,0,-10)`, `(70,0,20)`, `(87,0,-10)`, `(53,0,-10)`.
  - 24 điểm đom đóm (mỗi đảo 4 điểm `R=10` tại `0°,90°,180°,270°` + 8 điểm `R=22` mỗi `45°`, khởi tạo `20` con); 16 điểm Bóng Mực (mỗi đảo 8 điểm `R=26` từ `22.5°` mỗi `45°`), sinh `2` con ở `tick 300` rồi mỗi `420` tick (`7s`), tối đa `8`.
  - Bùa Gió: `C1 (35, 0, 0)`. Gió Lạc sinh 1 con mỗi lần tại `tick 1200, 2400, ...` tối đa 2 con hoạt động (`state !== "removed"`).
- **Đêm 3 — Đảo Chuông (`360s`, 7 đèn):**
  - Mặt đất nhiều tầng `getGroundY(x, z)` (lấy mặt cao nhất hợp lệ):
    - Tầng 2: `r <= 8` (`Y = 6`).
    - Tầng 1: `12 <= r <= 24 && z > 0` (`Y = 3`).
    - 2 dốc rộng `3m` (`|w| <= 1.5`) dọc bán kính `α ∈ {30°, 150°}` với `s ∈ [23.85, 30]` (nối kín mép ngoài `r=24` của Tầng 1), `Y = clamp(3 * (30 - s) / 6, 0, 3)`.
    - Tầng 0: `r <= 45` (`Y = 0`). Ngoài `45m` trả `null` (vực rơi).
  - Tháp chuông tại `(0, 6, 0)`: hình trụ cản ngang `r <= 2.0` khi `y < 14`.
  - Bục nhảy tại `(0, 3, 13)` (`r <= 1.0`, chạm đất tầng 1): phóng `vy = 12 m/s`, `vh = 8 m/s` hướng `-Z` (`[0, -1]`) đáp lên Tầng 2 (cùng cơ chế giữ `launchVel` tới khi chạm đất).
  - Vách đứng & Trượt mép: khi `newGroundY !== null` và `newGroundY > py + 0.45`, chặn bước lên vách bằng tách trục / chiếu tiếp tuyến dọc mép tròn để trượt mượt; khi `newGroundY <= py + 0.45 && py <= newGroundY` (lên dốc), snap `py = newGroundY, grounded = true`. Bóng Mực đi tuần/đuổi và đẩy lùi bởi Pulse cũng tuân thủ mặt đất hợp lệ, vách đứng (> 0.45m) và tháp chuông (nếu Mây ở đảo/tầng khác, Bóng Mực tìm hướng qua cầu `(35,0,0)` hoặc chân dốc `30°`/`150°`).
  - 7 đèn (`L1..L7`): `(0,6,6)`, `(18,3,10)`, `(-18,3,10)`, `(35,0,-10)`, `(-35,0,-10)`, `(20,0,-35)`, `(-20,0,-35)`.
  - 30 điểm đom đóm (`20` con lúc tick 0): Tầng 0 `18` điểm `R=34` (mỗi `20°`), Tầng 1 `8` điểm `R=18` (`20°..160°`), Tầng 2 `4` điểm `R=5` (`45°,135°,225°,315°`).
  - 16 điểm Bóng Mực: `R=43` (mỗi `22.5°`), sinh `2` con tại `tick 300`, rồi mỗi `360` tick (`6s`), tối đa `10`, tốc độ `4.5 m/s`.
  - Gió mạnh (`wind_enabled` mặc định `true` ở Đêm 3): chu kỳ `1800` tick (`30s`): cảnh báo `120` tick trước (`1680..1799`, `3480..3599` — quay hướng ngẫu nhiên `dir_deg` `+X` CCW lúc bắt đầu cảnh báo), thổi `300` tick (`1800..2099`, `3600..3899`, `wind.active = true`), đẩy Mây `2.0 m/s` kể cả trên không (trừ lúc chờ hồi sinh).
  - Bùa Gió: `C1 (30, 0, 25)` và `C2 (-30, 0, 25)`. Gió Lạc sinh 1 con tại `tick 1200, 2400, ...` tối đa 2 con hoạt động.

### C. Thứ tự 12 bước cố định trong mỗi tick
*(Tại bước đầu tiên không bị pause ở tick 1, phát `night_start { night }` trước khi chạy bước; dựng scenario ở tick 0 không phát sự kiện.)*
1. **Đọc input (xử lý `pause` trước):** Luôn cập nhật `prevInput` theo zero-order hold; nếu `pause` chuyển `false -> true`, đảo trạng thái pause (`paused <-> playing`), phát `paused {}` hoặc `resumed {}`. Nếu đang `paused` sau xử lý này: chỉ tăng `tick` (giữ nguyên `sim_tick`, thời gian, hồi chiêu, spawn, TTL), ghi snapshot `state: "paused"` (bước 12) và kết thúc tick.
2. **Giảm bộ đếm:** `timeLeft` (`-= 1/60`), `dashCd`, `pulseCd`, `invuln`, `charmTicks`, `respawnTicks` (nếu `1 -> 0` thì đặt `pos = [0,0,0]`, `vel = [0,0,0]`, `invuln = 90`, `grounded = true`, `isLaunched = false`, `dashTicks = 0`), `shade.state_ticks_left`, `shade.evadeTicks`, `mote.ttl` (xóa khi `<= 0`), `charm.respawnTicks` (tái hiện khi `<= 0`), `drifter.fleeTicks` (chuyển `"removed"` và `stolen = 0` khi `<= 0`), bộ đếm gió mạnh.
3. **Di chuyển Mây & Rơi khỏi đảo (khi `respawnTicks === 0 && flames > 0`):**
   - Cập nhật `facing` khi `move !== [0, 0]`.
   - `dash` (`false -> true`, chưa đang lướt và `dashCd === 0 || charmTicks > 0`): khóa hướng lướt (`move` hoặc `facing`), `dashTicks = 12`, `dashCd = charmTicks > 0 ? 0 : 90`, phát `dash {}`. Trong 12 tick lướt chạy `14 m/s`, giữ nguyên `y` (`vy = 0`).
   - Nhảy (`jump` cạnh lên khi `grounded === true`): `vy = 7.0`. Áp dụng bục nhảy, gió mạnh, trọng lực `-20 m/s²`, trượt vách đứng & tháp chuông. Tính `vel = [(nx-ox)/dt, (ny-oy)/dt, (nz-oz)/dt]`.
   - Kiểm tra rơi (`pos.y < -10`, đúng 1 lần, bỏ qua bất tử): `-1` Ngọn Lửa, mất toàn bộ `carried`, ghi `player_hit { by: "fall", flames, dropped: 0, lost }`, đặt `respawnTicks = 60` (nếu `flames <= 0` sẽ thua ngay ở bước 11).
4. **Nhặt đom đóm & Bùa Gió (khi `respawnTicks === 0 && flames > 0`):** XZ `<= 1.0m`, `|player.y - entity.y| <= 1.5m`, bỏ qua đom đóm có `bornTick === tick`. Nhặt Bùa Gió: `charmTicks = 600`, `dashCd = 0`, `available = false`, `respawnTicks = 2700`, phát `charm_picked { charm_id, charm_ticks: 600 }`.
5. **Tương tác đèn (`interact` cạnh lên, khi `respawnTicks === 0 && flames > 0`):** chọn đèn chưa sáng gần nhất (hòa thì `id` nhỏ hơn) với `distXZ <= 2.0m && |player.y - lantern.y| <= 1.5m`. Nạp `amount = min(carried, 10 - deposited)`, `+10 * amount` điểm, phát `deposit`. Đủ `10` -> `lit = true`, `+100` điểm, phát `lantern_lit`, và đánh dấu mọi Bóng Mực trong `< 6m` của đèn này `evadeTicks = 30`.
6. **Cập nhật vùng an toàn (`6m`):** Đẩy các Bóng Mực có `evadeTicks > 0` ra mép `6m` trong tối đa 30 tick (không gây sát thương lúc đó); đẩy các Bóng Mực ở ngoài nhưng sát mép lùi ra `>= 6m`.
7. **Tỏa Sáng (`pulse` cạnh lên, khi `respawnTicks === 0 && flames > 0`):** Nếu `carried >= 3 && pulseCd === 0`, trừ `3`, `pulseCd = 180`. Tâm = `(px, py + 0.8, pz)`, chốt mục tiêu khoảng cách **3D** `<= 5.0m`:
   - Bóng Mực: `state = "stunned"`, `state_ticks_left = 120`, `pushTicksLeft = 15`, `pushDir = normalizeXZ(shade - player)` (hoặc `[1, 0]` nếu trùng), `+5` điểm mỗi con, phát `pulse { stunned_ids }`.
   - Gió Lạc: nếu `"chase"` -> `"flee"` (`240` tick, 0 cướp); nếu `"flee"` mang `stolen > 0` -> thả `stolen` đom đóm (`ttl=480`, `kind="dropped"`, snap mặt đất hợp lệ), phát `drifter_drop { drifter_id, amount }`, `stolen = 0`, `fleeTicks = 120`.
8. **Di chuyển Bóng Mực & Gió Lạc (chỉ thực thể có từ trước bước 10):**
   - Bóng Mực: `spawning` đứng yên -> hết hạn chuyển `wander`/`chase`; `wander` đi tuần `2 m/s` theo góc quay định sẵn (không gọi `rng()` mỗi tick) -> `chase` khi `<= 12m`; `chase` đuổi `4.0 m/s` (`4.5` Đêm 3) -> `wander` khi `> 18m` (sau `recoil`/`stunned` cũng xét lại `12m/18m`); `recoil` lùi `2/60 m` mỗi tick; `stunned` lùi `4/15 m` mỗi tick trong 15 tick đầu (dừng khi chạm vách/tháp/mép). Các con `evadeTicks === 0` tiếp tục bị chặn ở mép `6m` đèn sáng sau bước di chuyển.
   - Gió Lạc: `idle` lượn `2 m/s`, `chase` khi `carried >= 5 && distXZ <= 15m` (mất điều kiện về `idle`), `chase` bay `7 m/s`, `flee` bay xa Mây `7 m/s`.
9. **Chạm (khi `respawnTicks === 0 && flames > 0`):**
   - Gió Lạc cướp trước (`state === "chase" && distXZ <= 1.2m && stolen === 0`): cướp `min(3, carried)`, `state = "flee"`, `fleeTicks = 240`, phát `drifter_steal { drifter_id, amount, carried }`.
   - Bóng Mực gây hit (duyệt theo `id` tăng dần, tối đa 1 lần mất Ngọn Lửa mỗi tick): nếu `invuln === 0` và Bóng `state === "chase"` & `evadeTicks === 0` & `distXZ <= 1.0m && |dy| <= 1.5m`: `-1` Ngọn Lửa, rơi `floor(carried / 2)` đom đóm quanh vành `1.5–2.5m` (snap mặt đất hợp lệ gần Mây, `ttl=480`, `kind="dropped"`, `bornTick = tick`), `invuln = 90`, Bóng chuyển `recoil` `60` tick (lùi `2m`), phát `player_hit { by: "shade", flames, dropped }`.
10. **Sinh theo lịch:** Đom đóm ở `tick = 240, 480, ...` (nếu `< 30` và còn điểm trống); Bóng Mực ở `300 + interval*k` (`spawning` `30` tick, dưới trần `6/8/10`); Gió Lạc ở `1200, 2400, ...` (Đêm 2–3, dưới `2` con hoạt động). Thực thể mới không tương tác ở tick này.
11. **Xét thắng / thua (đúng thứ tự ưu tiên):**
    - `flames <= 0` → `lost` (`no_flames`)
    - Còn sống & tất cả đèn sáng → `won` (`all_lit`), cộng `Math.floor(timeLeftS) * 2 + flames * 50`
    - Còn lại mà `timeLeft <= 0` → `lost` (`dawn`)
12. **Ghi snapshot nếu `tick % snapshotEvery === 0`.**

### D. Schema JSONL v1.1 & `--scenario`
- **Snapshot:** `{ type: "snapshot", tick, sim_tick, night, state, time_left_s, score, wind: { active, dir_deg }, player: { pos, vel, grounded, flames, carried, invuln, dash_cd_s, pulse_cd_s, charm_s }, lanterns, shades: [{ id, pos, state }], motes: [{ id, pos, kind, ttl_s }], motes_active, drifters: [{ id, pos, state, stolen }], charms: [{ id, available, respawn_s }] }`.
- **End line:** `{ type: "end", ticks: world.tick, state: world.state, score: world.score }` (`state` thuộc `"playing" | "paused" | "won" | "lost"`).
- **Scenario v1.1:** thêm `player.{invuln_ticks, dash_cd_ticks, pulse_cd_ticks, charm_ticks}`, `shades[].{state, state_ticks_left}` (mặc định `stunned=120, recoil=60, spawning=30`), `drifters` (thay danh sách mặc định), `charms` (thay danh sách mặc định: `{ id, pos?, available?, respawn_ticks? }`), `motes` hỗ trợ thêm `{ id?, pos, kind?, ttl_ticks? }`, `random_drifters`, `wind_enabled`.
- **Inputs v1.1:** thêm `dash?: boolean`, `pause?: boolean`.

---

## 3. Tiêu chí nghiệm thu Phần 3 (Acceptance Criteria — Bắt buộc theo DoD)

| Tính năng Phần 3 | Tiêu chí nghiệm thu (Acceptance Criteria) |
|---|---|
| **AC-01: Gió Lạc (Đêm 2 & 3)** | Xuất hiện từ tick `1200, 2400, ...` tối đa 2 con hoạt động; chuyển `idle → chase` khi Mây mang `≥ 5` và cách `≤ 15m`; chạm (`XZ ≤ 1.2m`) cướp `min(3, carried)` phát `drifter_steal` và `flee` `240` tick rồi `removed`; trúng Pulse khi `chase` chuyển `flee` không cướp, khi `flee` có đồ thả `drifter_drop` rồi `removed` sau `120` tick. |
| **AC-02: Bùa Gió (`C1, C2`)** | Đêm 2 ở `(35,0,0)`, Đêm 3 ở `(30,0,25)` & `(-30,0,25)`; nhặt phát `charm_picked`, tăng tốc `7.2 m/s` và bỏ hồi chiêu Lướt trong `600` tick (nhặt lại làm mới, đang lướt nhấn thêm bỏ qua), tái sinh sau `2700` tick. |
| **AC-03: Chuỗi 3 Đêm & Menu** | Menu chính chọn Chơi từ Đêm 1; trước mỗi Đêm có màn giới thiệu tên đảo + lời Ông Đăng; thắng chuyển Đêm kế tiếp (cộng dồn tổng điểm), thắng Đêm 3 hiện màn **Bình Minh**; thua cho phép chơi lại Đêm hiện tại. |
| **AC-04: Tạm dừng (`Esc` / `P`)** | Đóng băng hoàn toàn `sim_tick`, thời gian, hồi chiêu, spawn, TTL (`tick` vẫn tăng, `state: "paused"`); UI hiện Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu. |
| **AC-05: Cài đặt & Lưu trữ** | Có thanh chỉnh **Âm lượng** và **Độ nhạy chuột**, lưu vào `localStorage` và khôi phục chính xác khi tải lại trang. |
| **AC-06: Âm thanh đầy đủ** | Có nhạc nền đêm tổng hợp nhẹ và đủ 10 SFX (nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược `10s` cuối); hoạt động qua Web Audio API và tôn trọng âm lượng/tắt tiếng. |
| **AC-07: HUD & Chỉ dẫn** | Đủ 7 vùng HUD: Ngọn Lửa (trên trái), đồng hồ `mm:ss` đỏ nhấp nháy khi `≤ 30s` (trên giữa), đèn `k/n` + điểm (trên phải), thanh 10 ô đom đóm (dưới giữa), cooldown Lướt & Tỏa Sáng (dưới phải), nhắc `"E — Nạp ánh sáng (x/10)"` khi gần đèn, mũi tên hướng tới đèn chưa sáng gần nhất khi ngoài màn hình. |
| **AC-08: Bảng màu & Ánh sáng chuẩn** | Các đối tượng chính khớp bảng màu hex (`±10%` RGB) và cường độ ánh sáng môi trường `= 0.15 + 0.55 * (đèn sáng / tổng đèn)`. |
| **AC-09: Hiệu năng** | Headless chạy 21.600 tick trong `≤ 30s`; cảnh 3D đạt `≥ 30 FPS` trung bình ở `1280×720`. |
