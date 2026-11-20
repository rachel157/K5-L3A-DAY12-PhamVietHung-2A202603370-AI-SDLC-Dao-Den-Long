# Giả định & Truy vết yêu cầu (Assumptions & Requirements)

> Ghi rõ yêu cầu bắt buộc, phần mơ hồ, giả định tự chọn (kèm lý do) và thay đổi giữa các phase.

---

## Phase 0 (Checkpoint 0 — Chuẩn bị)

| Hạng mục | Quyết định / Giả định | Lý do | Trạng thái |
|---|---|---|---|
| Ngôn ngữ & Engine | TypeScript + Vite 8 + Three.js + Node.js (`^20.19.0 \|\| >=22.12.0` để build Vite; `dist-cli/` chạy từ Node 18) | Chạy đồng nhất macOS/Linux/Windows; tách `src/core/` thuần cho chế độ headless tất định; build tĩnh `dist/` cho Release `v1.0.0` | Đã áp dụng |
| Tương thích Node | Biên dịch CLI sang `dist-cli/` bằng `tsc` (`NodeNext`); dùng `node --test` auto-discovery thay vì phụ thuộc glob shell | Không phụ thuộc `--experimental-strip-types` của Node 22 hay glob expansion của bash/Node 21+ | Đã áp dụng |
| Tham số mặc định headless CP0 | `--seed 1 --ticks 10 --dt 0.05` | Cho phép `npm run headless` chạy ngay không cần đối số trong CI và smoke check; sẽ cập nhật theo Test Contract khi nhận PRD-0 | Tạm thời (CP0) |

---

## Phase 1 (PRD-0 & Test Contract v1.0)

| ID Yêu cầu | Mô tả / Chỗ mơ hồ | Giả định áp dụng | Tiêu chí nghiệm thu | Trạng thái |
|---|---|---|---|---|
| P1-01 | Kích thước & bố cục mặc định Đảo Bến (5 đèn `L1..L5`) | Đảo tròn bán kính `35m` (mặt đất `Y=0`, `fall_enabled=false`, clamp người chơi ở `r <= 34.5m`). 5 đèn `L1..L5` đặt đều trên vòng bán kính `25m` (`x = 25*sin(i*72°), z = 25*cos(i*72°)`; `L1` tại `[0, 0, 25]`). | Chạy headless tick 0 không scenario có đúng 5 đèn `L1..L5`, người chơi tại `[0,0,0]`. | Đạt |
| P1-02 | Tuning thông số gameplay & đồng bộ `game.contract.json` | `player_speed=6.0`, `carry_capacity=5`, `lantern_cost=3`, `pickup_radius=1.5`, `interact_radius=2.5`, `pulse_cost=1`, `pulse_radius=6.0`, `night1_duration_s=300`, `flames=3`, `invuln_s=1.5`, `hit_drop_ratio=0.5`, `pulse_stun_s=3.0`, `pulse_push_m=4.0`, `pulse_cooldown_s=2.0`, `safe_radius=4.5`, `shade_speed=3.5`, `shade_hit_radius=0.9`, `fall_enabled=false`. Test khóa khớp 1:1 giữa `game.contract.json` và `src/core/`. | Test đối chiếu `game.contract.json` với `DEFAULT_TUNING` pass 100%. | Đạt |
| P1-03 | Di chuyển ngang XZ & nhảy (`jump`) | Di chuyển ngang lấy vận tốc tức thời `moveWorld * player_speed` (không trễ gia tốc). `jump` kích hoạt khi đứng trên đất (`y === 0`) và `jump` chuyển `false -> true` (`vy=6.5`, `g=-18`, tiếp đất `Y=0`); mọi khoảng cách tuning đo trên mặt phẳng XZ đúng Contract §B. | Di chuyển `[0, 1]` với `cam_yaw_deg=0` trong 120 tick đưa `player.pos.z` tới `12.0` (`6.0 * 2s`). | Đạt |
| P1-04 | Đom đóm rơi (`hit_drop_ratio`) & nhặt (`mote_picked`) | Khi `carried < carry_capacity` và `distXZ <= pickup_radius`, tự động nhặt đom đóm (`+1 carried`, `+score.per_mote`). Khi bị Bóng Mực chạm: `dropped = Math.floor(carried * hit_drop_ratio)`, số rơi tan biến (`carried -= dropped`). | Test chạm Bóng Mực ghi đúng `dropped` và giảm `carried` chính xác. | Đạt |
| P1-05 | Tương tác đèn (`interact`), `safe_radius` & scenario merge | `interact` kích hoạt khi `false -> true`, chọn đèn chưa sáng gần nhất trong `interact_radius`, nạp `min(carried, lantern_cost - deposited)`. Đèn **đã thắp (`lit: true`)** đẩy mọi Bóng Mực (cả `chase` và `stunned`) ra ngoài `safe_radius`. `scenario.lanterns` patch theo `id` (giữ đủ 5 đèn). | Đèn chưa sáng không chặn Bóng Mực; đèn đã sáng đẩy Bóng Mực ra ngoài `safe_radius`; patch từng đèn giữ nguyên đèn khác. | Đạt |
| P1-06 | Tỏa sáng (`pulse`), làm choáng & độ chính xác timer | Kích hoạt khi `pulse` chuyển `false -> true`, `carried >= pulse_cost` và `cooldown <= 0`. Trừ `pulse_cost`, đặt cooldown, mọi Bóng Mực trong `pulse_radius` (kể cả đang stunned) được đặt lại `stunTimer = pulse_stun_s` và đẩy lùi `pulse_push_m` dọc tia từ Mây (fallback `+Z`), cộng `per_stun` cho mỗi ID bị pulse. Các bộ đếm thời gian (`stunTimer`, `invulnTimer`, `pulseCooldown`, `time_left_s`) dùng epsilon `1e-9` để `3.0s = 180` tick chính xác. | Phát event `pulse` kèm `stunned_ids`, đúng `180` tick stun với `3.0s`. | Đạt |
| P1-07 | Sinh ngẫu nhiên khi `random_motes`/`random_shades` là `true` vs `false` | Mặc định `true`: tạo 20 đom đóm + 3 Bóng Mực ban đầu bằng PRNG theo `--seed`, và bổ sung định kỳ (đom đóm khi `< 20`, Bóng Mực tối đa `5` mỗi `25s`, phát `shade_spawned`). Khi `false`: chỉ giữ đúng danh sách `motes`/`shades` từ scenario (`[]` nếu vắng) và không tự sinh thêm. | Test `random_motes:false`/`random_shades:false` không tạo thêm thực thể nào. | Đạt |
| P1-08 | Tính điểm thắng (`per_second_left`, `per_flame_left`), làm tròn & thứ tự thắng/hết giờ | Trong bước `k -> k+1`, cập nhật `time_left_s = max(0, initialTimeLeftS - (k+1)/60)`. Khi thắp đủ 5 đèn: cộng `Math.floor(time_left_s) * per_second_left + flames * per_flame_left`, phát `game_over` (`all_lit`) ưu tiên trước kiểm tra `dawn`. Giữ `float64` trong mô phỏng và chỉ làm tròn 3 chữ số thập phân (không `-0`) khi ghi JSONL. | Test thắng ghi `score` khớp công thức, không trôi vị trí và không có `-0`. | Đạt |
| P1-09 | Cập nhật các file CP0 (`helloLantern`, `tests/cp0-packaging.test.mjs`, `SKILL.md`, `ci.yml`) | `src/core/helloLantern.ts` của CP0 là khung khởi động tạm trước PRD-0; trong Phase 1 thay bằng lõi game (`src/core/game.ts`, `contract.ts`, `types.ts`, giữ `prng.ts`), đồng thời cập nhật `tests/cp0-packaging.test.mjs`, `SKILL.md`, `ci.yml` dùng tham số Test Contract v1.0 (`--night 1 --ticks ... --out ...`), và lưu proof CP0 ở `docs/proof/phase-0/`. | `npm test` và CI xanh hoàn toàn với Test Contract v1.0. | Đạt |

---

## Phase 2 (Ticket-02 — "Ba hòn đảo", Contract v1.1)

| ID Yêu cầu | Thay đổi so với Phase 1 / Chỗ mơ hồ | Giả định áp dụng & Lý do | Ảnh hưởng test cũ | Trạng thái |
|---|---|---|---|---|
| P2-01 | Đổi chuẩn toàn bộ hằng số tuning & tọa độ góc từ `+X` CCW (`x=R cos θ, z=R sin θ`) | Kiểm chứng từ Đêm 3 (`z > 0` tại `20°..160°` và dốc `30°/150°`) khớp chính xác `x = R*cos(θ), z = R*sin(θ)`. Nhảy dùng đúng `7.0 m/s`, trọng lực `-20 m/s²`. | Sửa test Phase 1 dùng số cũ (`carry_capacity=5`, `lantern_cost=3`, `pickup_radius=1.5`, `safe_radius=4.5`, `pulse_stun_s=3`, ...) sang số chuẩn Ticket-02. | Đạt |
| P2-02 | Tăng tốc / dừng `≤ 0.1 s`, Lướt `14 m/s` (`12` tick) & Bục nhảy Đêm 2/3 | Đổi vận tốc ngang tức thời mỗi tick (`1/60 s ≈ 0.017 s ≤ 0.1 s`), hồi chiêu Lướt `90` tick tính từ lúc bắt đầu lướt. Nếu đang bay từ bục nhảy mà Lướt, tạm áp vận tốc lướt 12 tick rồi lưu/khôi phục vận tốc đứng `savedLaunchVy` cùng `launchVel` cho tới khi chạm đất. | Không làm hỏng test di chuyển Phase 1. | Đạt |
| P2-03 | Đổi công thức tính điểm (`+10` mỗi đom đóm **nạp**, `+100`/đèn, `+5`/Bóng trúng Pulse, `+2`/giây, `+50`/Ngọn Lửa) | Trong `game.contract.json`, `score.per_mote` giữ `10` nhưng cộng khi **nạp** (`deposit`) thay vì khi nhặt (`mote_picked`) để tránh farm điểm từ đom đóm rơi/Pulse. | Cập nhật test Phase 1 vốn assert `+10` lúc nhặt và `+200` lúc thắp đèn. | Đạt |
| P2-04 | Đom đóm `20` lúc tick 0, trần `30`, sinh tại `240, 480, ...` & đom đóm rơi (`ttl=480`) | Mảng `motes` phân biệt `kind: "random"` (`ttl_s: null`) và `kind: "dropped"` (`ttl_s` đếm từ `8.0s`). Đom đóm rơi ở vành `1.5–2.5m` quanh Mây (snap lên mặt đất hợp lệ gần Mây để không rơi xuống vực Đêm 2 hay kẹt tháp chuông), nhặt được từ tick sau (`bornTick < tick`). | Thay quy tắc Phase 1 (đom đóm rơi tan biến). | Đạt |
| P2-05 | Bóng Mực 5 trạng thái (`spawning`, `wander`, `chase`, `recoil`, `stunned`) & vùng an toàn `6 m` | Đêm 1–3 tại tick 0 không có Bóng Mực mặc định; sinh `2` con tại tick `300`, sau đó mỗi `480/420/360` tick ở trạng thái `"spawning"` (`30` ticks). Bóng trong `scenario` mặc định `"chase"` nếu `dist ≤ 12m`, `"wander"` nếu `> 12m`. Đèn vừa thắp đẩy Bóng bên trong ra mép `6m` trong tối đa `30` tick (`evadeTicks`) và không gây sát thương lúc đó; Bóng bên ngoài bị chặn sau bước 8. Đêm 3 dốc nối kín mép `s=23.85..30` và trượt mép theo tách trục/tiếp tuyến. | Cập nhật test Phase 1 vốn dùng `safe_radius=4.5`, `stun=180` ticks (`120` ticks trong Ticket-02) và 3 Bóng Mực tick 0. | Đạt |
| P2-06 | `Pulse` tâm `(x, y + 0.8, z)`, khoảng cách **3D** ≤ `5 m`, đẩy `4 m` trong `15` tick đầu; tương tác đèn `|dy| ≤ 1.5 m` | Tính 3D `hypot(dx, dy, dz) <= 5` từ `(px, py+0.8, pz)` tới `shade.pos` (`y = groundY + 0.8`). Đẩy lùi `4/15` m/tick trong 15 tick đầu, dừng nếu chạm vách đứng/tháp chuông/mép đảo. Tương tác đèn kiểm tra `XZ ≤ 2.0m && |dy| ≤ 1.5m` (để `L1` tầng 2 Đêm 3 không bị nạp từ tầng 1). | Cập nhật test `pulse` dùng khoảng cách 3D và 120 tick stun. | Đạt |
| P2-07 | Rơi khỏi đảo (`Y < -10`) & `player_hit` `by: "fall"` | Khi `Y < -10` (một lần): `-1` Ngọn Lửa, mất toàn bộ `carried`, ghi `player_hit { by: "fall", flames, dropped: 0, lost }`. Nếu `flames > 0`: chờ `60` tick (chặn nhặt/nạp/pulse/chạm), khi `respawnTicks` về `0` đặt về `(0,0,0)`, `vel=[0,0,0]`, `invuln=true` (`90` tick) và chạy tiếp bước đó. | `fall_enabled` đổi từ `false` -> `true`. | Đạt |
| P2-08 | `Gió Lạc` (`idle/chase/flee/removed`), `Bùa Gió` (`C1, C2`) & Gió Mạnh Đêm 3 | Gió Lạc sinh 1 con mỗi tick `1200, 2400, ...` (tối đa 2 con `state !== "removed"`), giữ `"removed"` trong snapshot `drifters` để test đối chiếu được. `scenario.drifters` và `scenario.charms` thay thế danh sách mặc định theo Contract v1.1. Gió mạnh Đêm 3 báo trước `120` tick trước mốc `1800k`, thổi `300` tick (`+X` CCW). | Tính năng mới Đêm 2–3. | Đạt |
| P2-09 | `night_start`, `paused`/`resumed`, `player.invuln` boolean, `end.state = "paused"` | `night_start { night }` phát ở tick `1` khi bắt đầu chạy bước. `player.invuln` là boolean (`invulnTicks > 0`). Khi `pause` bật, cập nhật `prevInput`, đóng băng `sim_tick`/timer/spawn/TTL và vẫn tăng `tick`; nếu kết thúc `--ticks` lúc đang pause thì `end.state = "paused"`. | Mở rộng schema Contract v1.0 -> v1.1. | Đạt |
| P2-10 | Điểm xuất phát `spawnPos` của Đêm 3 (Đảo Chuông) | Vì gốc `(0,0,0)` nằm bên trong Tầng 2 (`Y=6`) và Tháp Chuông (`r <= 2`), Mây xuất phát ở `[0, 0, -20]` trên Tầng 0 (`Y=0`), đứng vững và quay mặt `+Z` nhìn lên Tháp Chuông; cũng là điểm hồi sinh khi rơi khỏi đảo ở Đêm 3. | Đêm 3 không bị kẹt/rơi ngay ở tick 0 (`getGroundY` khớp `spawnPos[1]`). | Đạt |

---

## Phase 3 (Ticket-03) — *Chờ phát hành*

| ID Yêu cầu | Luật cũ bị thay thế | Lý do đổi thiết kế | Test cũ sửa/bỏ | Trạng thái |
|---|---|---|---|---|
| — | Chờ Ticket-03 | — | — | Chưa phát hành |

---

## Phase 4 (Ticket-04) — *Chờ phát hành*

| ID Yêu cầu | Ngưỡng / Số đo bắt buộc | Cách đo | Kết quả thật | Trạng thái |
|---|---|---|---|---|
| — | Chờ Ticket-04 | — | — | Chưa phát hành |
