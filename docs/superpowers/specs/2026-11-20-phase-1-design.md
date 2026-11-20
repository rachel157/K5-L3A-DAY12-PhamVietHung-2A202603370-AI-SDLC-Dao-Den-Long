# Design Doc: Phase 1 — PRD-0 & Test Contract v1.0 (Đảo Đèn Lồng)

- **Ngày:** 2026-11-20
- **Phạm vi:** Phase 1 (tag nộp `phase-1`), triển khai đầy đủ PRD-0 và Test Contract v1.0
- **Giả định chi tiết:** [docs/notes/assumptions.md](../../notes/assumptions.md)
- **Trạng thái:** Sẵn sàng duyệt (đã cập nhật theo builder check)

---

## 1. Mục tiêu & Lý do (Intent & Why)

Xây dựng hoàn chỉnh Đêm 1 ("Đảo Bến") của game 3D **Đảo Đèn Lồng** và chế độ **headless** tuân thủ tuyệt đối **Test Contract v1.0** để vượt qua bộ test tự động ẩn của giảng viên, đồng thời có trải nghiệm 3D ấm áp, cổ tích, và phần sáng tạo gọn nằm riêng trong lớp trình diễn `src/web/` (không ảnh hưởng đầu ra headless).

---

## 2. Đặc tả Test Contract v1.0 (Bắt buộc chính xác)

### A. `game.contract.json` (ở gốc repo)
```json
{
  "contract_version": "1.0",
  "team": "2A202603370-PhamVietHung",
  "build_cmd": "npm ci && npm run build",
  "run_cmd": "npm run preview",
  "headless_cmd": "node dist-cli/cli/headless.js",
  "tuning": {
    "player_speed": 6,
    "carry_capacity": 5,
    "lantern_cost": 3,
    "lantern_count_night1": 5,
    "pickup_radius": 1.5,
    "interact_radius": 2.5,
    "pulse_cost": 1,
    "pulse_radius": 6,
    "night1_duration_s": 300,
    "flames": 3,
    "invuln_s": 1.5,
    "hit_drop_ratio": 0.5,
    "pulse_stun_s": 3,
    "pulse_push_m": 4,
    "pulse_cooldown_s": 2,
    "safe_radius": 4.5,
    "shade_speed": 3.5,
    "shade_hit_radius": 0.9,
    "fall_enabled": false,
    "score": {
      "per_mote": 10,
      "per_lantern": 200,
      "per_stun": 50,
      "per_second_left": 2,
      "per_flame_left": 100
    }
  }
}
```
- **Ràng buộc đồng bộ:** `src/core/contract.ts` giữ bản hằng số `DEFAULT_TUNING`; test tự động xác nhận `game.contract.json` khớp 1:1 với `DEFAULT_TUNING`. `src/cli/headless.ts` đọc `game.contract.json` từ ổ đĩa và truyền vào mô phỏng.

### B. Tham số CLI headless & Mã thoát
- Cú pháp bắt buộc:
  `node dist-cli/cli/headless.js --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>] --ticks <int> --out <file.jsonl> [--snapshot-every <int, mặc định 10>]`
- Thoát `0` khi mô phỏng dừng do đủ `--ticks` hoặc game kết thúc (`won`/`lost`).
- Thoát `2` kèm thông báo `stderr` khi file `--scenario` hoặc `--inputs` không đọc được hoặc sai định dạng (bao gồm `tick` không tăng nghiêm ngặt, âm, hoặc kiểu dữ liệu sai).
- Thoát `1` kèm thông báo `stderr` khi thiếu/sai tham số dòng lệnh (`--seed`, `--night` khác `1`, `--ticks < 0`, `--snapshot-every <= 0`, thiếu `--out`) hoặc lỗi ghi `--out`.
- Logic chạy ở `60 tick/giây` (`dt = 1/60`s). Trục Y hướng lên, mặt đất ở `Y = 0`, người chơi xuất phát `(0, 0, 0)`. Khoảng cách tuning đo theo XZ (`hypot(dx, dz) <= r`).

### C. File `inputs` & Mô hình Input
- Schema: `{"frames": [{"tick": 0, "move": [0, 1], "cam_yaw_deg": 0}, ...]}` (không có `--inputs` thì người chơi đứng yên).
- Mặc định trước frame đầu tiên: `move: [0, 0]`, `cam_yaw_deg: 0`, `jump: false`, `interact: false`, `pulse: false`.
- **Zero-order hold toàn bộ trường:** mỗi frame chỉ đổi các trường có mặt trong frame đó; các trường vắng mặt (kể cả `interact`, `pulse`, `jump`) giữ nguyên giá trị trước đó cho tới khi có frame mới đổi lại (ví dụ `{tick: 120, interact: true}` rồi `{tick: 121, interact: false}`).
- `tick` của `frames` là số nguyên `>= 0` và **tăng nghiêm ngặt**. Frame có `tick >= --ticks` vẫn hợp lệ trong file (đơn giản chưa chạy tới).
- `move: [x, z]`, mỗi thành phần trong `[-1, 1]`; `θ = cam_yaw_deg * π / 180`; `x' = x*cosθ + z*sinθ`, `z' = -x*sinθ + z*cosθ`; nếu `hypot(x', z') > 1` chuẩn hóa về độ dài 1.
- `jump`, `interact`, `pulse` kích hoạt cạnh lên (`prev === false && cur === true`).

### D. File `scenario` & Quy tắc override
- Schema: `{ player?, random_motes?, random_shades?, motes?, shades?, lanterns?, time_left_s? }`.
- `lanterns`: patch theo `id` (`L1..L5`); đèn không nhắc tới giữ nguyên; có `pos` đổi vị trí; có `deposited` đổi tiến độ; có `lit: true` đặt sáng (nếu không truyền `deposited` khi `lit: true` thì mặc định `deposited = lantern_cost`). Id lạ -> thoát `2`.
- `motes`: mảng `[x, y, z]` (hoặc `{id?, pos}`) thay thế danh sách ban đầu (`[]` = 0 con). Nếu `random_motes === false` và vắng `motes` thì khởi đầu `[]`.
- `shades`: mảng `{id?, pos, state?}` thay thế danh sách ban đầu (`[]` = 0 con), gán ID tự động `"S1"`, `"S2"`,... cho phần tử thiếu `id` và tiếp nối bộ đếm cho sinh mới (`"S3"`...). Nếu `random_shades === false` và vắng `shades` thì khởi đầu `[]`.
- `random_motes: false` / `random_shades: false` tắt hoàn toàn việc sinh ban đầu & sinh định kỳ loại tương ứng.
- Dựng scenario **không phát sự kiện và không cộng điểm**.

### E. Output JSONL (làm tròn 3 chữ số thập phân, không `-0`)
- Giữ `float64` nội bộ trong suốt mô phỏng để tránh trôi vận tốc; chỉ làm tròn `round3` (`Math.round(v * 1000) / 1000`, đổi `-0` thành `0`) cho tọa độ `pos` và `time_left_s` khi xuất snapshot.
- **Snapshot (tick `0` trước bước `0`, và mỗi khi `tick % snapshotEvery === 0`):**
  `{"type":"snapshot","tick":120,"sim_tick":120,"state":"playing","time_left_s":298.0,"score":20,"player":{"pos":[0.0,0.0,12.0],"flames":3,"carried":2},"lanterns":[{"id":"L1","pos":[0,0,25],"lit":false,"deposited":0},...],"shades":[{"id":"S1","pos":[30.1,1.0,2.0],"state":"chase"}],"motes":[{"id":"M1","pos":[0,0,5]}],"motes_active":19}`
- **Event (ghi ngay trong bước `k` với `"tick": k + 1`, trước snapshot của tick `k + 1` nếu trùng):**
  - `mote_picked`: `{"carried": n}`
  - `deposit`: `{"lantern_id": "L1", "amount": n, "deposited": n}`
  - `lantern_lit`: `{"lantern_id": "L1"}`
  - `pulse`: `{"stunned_ids": ["S1"]}`
  - `player_hit`: `{"by": "shade", "flames": n, "dropped": n}`
  - `shade_spawned`: `{"id": "S3"}`
  - `game_over`: `{"result": "won" | "lost", "reason": "all_lit" | "dawn" | "no_flames"}`
- **End (dòng cuối cùng bắt buộc):**
  `{"type":"end","ticks":<steps_run>,"state":"playing"|"won"|"lost","score":<int>}`

---

## 3. Kiến trúc & Thứ tự xử lý bước mô phỏng (`k -> k+1`, `dt = 1/60`s)

### Thông số mặc định Đảo Bến
- Đảo tròn bán kính `35m` (clamp người chơi & thực thể ở `r <= 34.5m`).
- 5 đèn `L1..L5` trên vòng bán kính `25m`: `x = 25*sin(i*72°), z = 25*cos(i*72°)` (`i = 0..4`), nên `L1` tại `[0, 0, 25]`.
- Khi `random_motes !== false` và không truyền `scenario.motes`: sinh 20 đom đóm theo `--seed`; khi thiếu `< 20` sinh bổ sung mỗi `4s`.
- Khi `random_shades !== false` và không truyền `scenario.shades`: sinh 3 Bóng Mực (`S1..S3`) ở khoảng `r ∈ [16, 28]` (cách `(0,0,0)` an toàn); mỗi `25s` nếu `< 5` con thì sinh thêm 1 con (phát `shade_spawned`), tránh `safe_radius` các đèn đã sáng.

### Thứ tự cập nhật trong bước `k` (tạo trạng thái `tick = k + 1`, `stepsRun = k + 1`)
1. **Cập nhật thời gian & bộ đếm (dùng epsilon `1e-9` cho hết giờ):**
   - `time_left_s = Math.max(0, initialTimeLeftS - (k + 1) / 60)` (dùng giá trị này xuyên suốt bước `k` cho cả tính điểm thắng lẫn kiểm tra `dawn`).
   - Giảm `invulnTimer`, `pulseCooldown`, và `stunTimer` của từng Bóng Mực; nếu `stunTimer <= 1e-9` thì đặt `stunTimer = 0` và `state = "chase"`.
2. **Đọc input tick `k`, di chuyển & nhảy:**
   - Áp dụng frame có `tick === k` (nếu có), kiểm tra cạnh lên `jump`, `interact`, `pulse`.
   - Di chuyển XZ tức thời `moveWorld * player_speed * dt` và giới hạn trong bán kính `34.5m`. Nhảy dọc trục Y khi `y === 0` (`vy = 6.5`, `g = -18`, kẹp `y >= 0`).
3. **Nhặt đom đóm (`mote_picked`):**
   - Duyệt danh sách đom đóm theo thứ tự cố định; nếu `carried < carry_capacity` và `distXZ <= pickup_radius`: xóa đom đóm, `carried += 1`, `score += per_mote`, emit `mote_picked`.
4. **Nạp đèn (`interact` cạnh lên):**
   - Tìm đèn chưa sáng (`!lit`) gần nhất có `distXZ <= interact_radius` (hòa khoảng cách ưu tiên thứ tự `L1..L5`). Nếu có và `carried > 0`:
     - `amount = Math.min(carried, lantern_cost - deposited)`
     - `carried -= amount`; `deposited += amount`; emit `deposit`.
     - Nếu `deposited >= lantern_cost`: `lit = true`, `score += per_lantern`, emit `lantern_lit`.
     - Nếu cả 5 đèn `lit === true`: `score += Math.floor(time_left_s) * per_second_left + flames * per_flame_left`, `state = "won"`, emit `game_over` (`all_lit`) -> nhảy tới bước xuất snapshot/end, kết thúc bước.
5. **Tỏa sáng (`pulse` cạnh lên):**
   - Nếu `carried >= pulse_cost` và `pulseCooldown <= 1e-9`:
     - `carried -= pulse_cost`; `pulseCooldown = pulse_cooldown_s`.
     - Mọi Bóng Mực trong `distXZ <= pulse_radius` được đặt `state = "stunned"`, `stunTimer = pulse_stun_s`, đẩy lùi `pulse_push_m` dọc tia từ Mây (fallback `[0, 0, 1]` nếu trùng tâm), đẩy ra ngoài `safe_radius` đèn sáng nếu lọt vào và clamp bán kính đảo.
     - `score += per_stun * stunned_ids.length`, emit `pulse`.
6. **Cập nhật Bóng Mực & Vùng an toàn (`safe_radius`):**
   - Mọi Bóng Mực `"chase"` tiến về phía Mây trên XZ với tốc độ `shade_speed * dt`.
   - Mọi Bóng Mực (cả `chase` và `stunned`) nếu nằm trong `< safe_radius` của bất kỳ đèn **đã sáng (`lit === true`)** nào được đẩy ra ngoài tới đúng `safe_radius` và clamp trong đảo.
7. **Va chạm Bóng Mực -> Mây (`player_hit`):**
   - Nếu `invulnTimer <= 1e-9`: tìm Bóng Mực `"chase"` đầu tiên theo thứ tự có `distXZ <= shade_hit_radius`. Nếu có:
     - `flames = Math.max(0, flames - 1)`
     - `dropped = Math.floor(carried * hit_drop_ratio)`; `carried -= dropped` (số rơi tan biến vào sương đen, không rơi ra đất)
     - `invulnTimer = invuln_s`
     - Emit `player_hit` (`by: "shade"`).
     - Nếu `flames <= 0`: `state = "lost"`, emit `game_over` (`no_flames`) -> kết thúc bước.
8. **Sinh ngẫu nhiên (chỉ khi `random_motes` / `random_shades` là `true`):**
   - Đom đóm (< 20, mỗi `4s`) và Bóng Mực (< 5, mỗi `25s` ngoài `safe_radius` đèn sáng, emit `shade_spawned`).
9. **Kiểm tra hết giờ (`dawn`):**
   - Nếu `state === "playing"` và `time_left_s <= 1e-9`: `time_left_s = 0`, `state = "lost"`, emit `game_over` (`dawn`).

---

## 4. Giao diện 3D, Âm thanh & Sáng tạo (`src/web/`)

- **Dùng chung lõi `src/core/`:** Vòng lặp game 3D chạy fixed-timestep `60 Hz` từ `src/core/game.ts`, không có bất kỳ logic sáng tạo nào chen vào `src/core/`.
- **Đồ họa & Phong cách PRD-0:**
  - Đảo Bến hình tròn trên biển mây sương tối; 5 Đèn Lồng Lớn có cột đá & lồng đèn chuyển từ tím-tắt sang vàng cam ấm khi thắp, đồng thời tăng cường độ ánh sáng môi trường của toàn đảo theo số đèn đã thắp (`0..5`).
  - Nhân vật **Mây** đội **nón lá** có **đèn lồng nhỏ treo** phía trước/trên nón, nhún nhẹ khi đi/nhảy.
  - Đom đóm phát sáng vàng cam nhấp nhô; Bóng Mực màu tím đen có mắt phát sáng mờ và đổi dáng/màu khi bị `"stunned"`.
- **Điều khiển & HUD + Chơi lại:**
  - `WASD` / phím mũi tên di chuyển theo hướng camera (kéo chuột hoặc `Q`/`C` xoay góc nhìn thứ ba), `Space` nhảy, `E` hoặc `F` nạp đèn, `R` hoặc `Shift` tỏa sáng (`pulse`), `M` tắt/bật âm thanh.
  - HUD rõ ràng: ngọn lửa (máu), đom đóm đang mang (`x/5`), đèn đã thắp (`x/5`), đồng hồ đếm ngược, điểm số, cooldown tỏa sáng, màn hình Thắng/Thua + nút **Chơi lại**.
- **Sáng tạo của tôi (thuần `src/web/`):**
  - Âm thanh Web Audio tổng hợp nhẹ (chuông gió khi nhặt đom đóm, hợp âm ấm khi thắp đèn, tiếng sóng tỏa sáng xua Bóng Mực, giai điệu thắng/thua — không phụ thuộc file asset ngoài).
  - Hiệu ứng vòng sóng ánh sáng 3D khi tỏa sáng + hào quang an toàn quanh đèn đã thắp + đom đóm nhỏ bay quanh Mây tỷ lệ theo `carried`.

---

## 5. Cập nhật các file CP0 chịu ảnh hưởng

- Thay `src/core/helloLantern.ts` bằng `src/core/types.ts`, `src/core/contract.ts`, `src/core/game.ts` (giữ `src/core/prng.ts`).
- Cập nhật `tests/cp0-packaging.test.mjs`, `.agents/skills/verify-phase/SKILL.md`, `.github/workflows/ci.yml` để dùng cú pháp Test Contract v1.0 (`--seed ... --night 1 --ticks ... --out ...`), và giải thích rõ trong `docs/notes/assumptions.md` (P1-09).
- Cập nhật `README.md` (cài/chạy `<= 3` lệnh, điều khiển, bảng tính điểm, giải thích `game.contract.json`, mục `"Sáng tạo của tôi"`).
- Lưu bằng chứng Phase 1 vào `docs/proof/phase-1/README.md`, cập nhật `docs/notes/ai-log.md`, kiểm tra hồi quy + test hợp đồng rồi gắn tag `phase-1`.
