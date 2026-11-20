# Bằng chứng kiểm chứng — Phase 2 (`TICKET-02` · Contract `v1.1` · Tag `phase-2`)

> Toàn bộ kết quả dưới đây được đo trực tiếp từ lệnh chạy thật trên repo ở phiên làm việc ngày 2026-11-20 (Node.js `v22.16.0` trên Windows; kiểm chứng đồng nhất cả CLI lẫn clean-clone).

---

## 1. Kết quả Build & Test Suite

- **Lệnh build:** `npm run build` (`tsc -p tsconfig.cli.json` + `tsc -p tsconfig.web.json && vite build`)
  - **Kết quả:** Thành công (`exit 0`), bundle Vite tạo `dist/index.html` (`9.53 kB`) và `dist/assets/index-C5E2spEF.js` (`625.39 kB`, built in `277–294ms`).
- **Lệnh kiểm thử:** `npm test` (`npm run build:cli && node --test`)
  - **Kết quả:** **39 / 39 subtests PASS (`0 fail`, `0 skipped`, `~3.14s`)** trên các nhóm kiểm thử:
    - `tests/contract-sync.test.mjs` — `game.contract.json` (`contract_version: "1.1"`) khớp 1:1 với `DEFAULT_TUNING`.
    - `tests/core-boundary.test.mjs` — `src/core/` không có `three`, DOM, `process`, `Math.random`, `Date.now`.
    - `tests/maps-terrain.test.mjs` — Bản đồ 3 Đêm (`Đảo Bến`, `Đảo Cau`, `Đảo Chuông`), `spawnPos` đứng đất, Đêm 2 cầu tre/2 đảo/vực, Đêm 3 dốc kín mép `r=24`, chặn vách đứng, Tháp Chuông `r=2.0`.
    - `tests/core-game.test.mjs` — Hồi quy toàn bộ PRD-0 theo thông số chuẩn Ticket-02 (`6.0 m/s`, nhảy `7.0 m/s`, sức chứa `10`, nạp đèn `10` & `+10/mote` + `+100/lantern`, `Pulse` 3D `<= 5m` choáng `120` tick, vùng an toàn `6m`, đom đóm rơi `ttl=480`, bất tử `90` tick, điểm số & thắng/thua).
    - `tests/phase2-features.test.mjs` — Lướt `14 m/s` (`12` tick, `90` tick hồi chiêu), Bùa Gió (`7.2 m/s`, Lướt `0` hồi chiêu, tái sinh `2700` tick), Rơi `Y < -10` (bỏ qua bất tử, mất hết `carried`, hồi sinh `60` tick), Bục nhảy + Lướt trên không Đêm 2, Gió mạnh + Dốc + Bục nhảy Đêm 3, Đẩy Bóng Mực bên trong `6m` trong `<= 30` tick, Gió Lạc (cướp/trốn/thả khi Pulse), Tạm dừng `Pause/Resume` đóng băng `sim_tick` & `TTL`, benchmark `21.600` tick.
    - `tests/cli-headless.test.mjs` — CLI Contract v1.1 (`--night 1|2|3`, exit `1`/`2`, schema `drifters`/`charms`/`wind_enabled`/`dash`/`pause`).
    - `tests/web-helpers.test.mjs` & `tests/web-ui-settings.test.mjs` — Khóa hướng Bóng Mực `+Z`, `Space`/nút HUD, `loadSettings`/`saveSettings` (`localStorage`), mũi tên chỉ đèn ngoài màn hình.
    - `tests/stop-hook.test.mjs` & `tests/cp0-packaging.test.mjs` — Harness Stop hook và chạy thật các lệnh CLI trong `README.md` & `verify-phase/SKILL.md` bằng shell bản địa.

---

## 2. Tính tất định (Determinism) 3 Đêm & Benchmark 21.600 Ticks

- **Benchmark 21.600 ticks Đêm 3 (CLI headless ghi file JSONL đầy đủ 21.600 tick, có shades/drifters/motes/gió):**
  - Lệnh: `node dist-cli/cli/headless.js --seed 7 --night 3 --scenario <flames:9999,wind:true> --ticks 21600 --out ...`
  - **Kết quả quan sát:** **`456.7 ms`** (`0.46 giây`, ghi `2.225` dòng JSONL, kết thúc `{"type":"end","ticks":21600,"state":"lost","score":0}`) — đạt chuẩn `<= 30s` (và unit benchmark đạt `386.9 ms`).
  - **Mặc định không scenario (`--seed 7 --night 3 --ticks 21600`):** **`230.9 ms`**, sống trên Tầng 0 tới tick `8279` (`845` dòng).
- **Kiểm tra byte-for-byte identical khi chạy 2 lần cùng seed (`--seed 7 --ticks 60`):**
  - `--night 1`: `NIGHT_1_IDENTICAL=true BYTES=13408`
  - `--night 2`: `NIGHT_2_IDENTICAL=true BYTES=13632`
  - `--night 3`: `NIGHT_3_IDENTICAL=true BYTES=14850`

---

## 3. Ma trận Acceptance Criteria (Spec §3)

| Tiêu chí | Phương thức kiểm chứng | Kết quả thực tế |
|---|---|---|
| **AC-01: Gió Lạc (Đêm 2 & 3)** | Test unit & CLI (`phase2-features.test.mjs`, `cli-headless.test.mjs`) | **Đạt** |
| **AC-02: Bùa Gió (`C1, C2`)** | Test `phase2-features.test.mjs` (tăng tốc `7.2 m/s`, Lướt `0s`, tái sinh `2700` tick) | **Đạt** |
| **AC-03: Chuỗi 3 Đêm & Menu** | Mã nguồn `src/web/ui.ts` + `src/web/main.ts`, compile `tsc` + Vite bundle | **Đạt (logic & build); chưa đạt (chơi thử trực quan trên trình duyệt)** |
| **AC-04: Tạm dừng (`Esc`/`P`)** | Test lõi `phase2-features.test.mjs` + CLI test (`paused`/`resumed`, `sim_tick` đóng băng) + `src/web/ui.ts` | **Đạt** |
| **AC-05: Cài đặt & Lưu trữ (`localStorage`)** | Test `tests/web-ui-settings.test.mjs` + ràng buộc `settings.ts`/`ui.ts` | **Đạt** |
| **AC-06: Âm thanh đầy đủ (BGM + 10 SFX)** | Kiểm tra code `src/web/audio.ts` + gọi sự kiện trong `src/web/main.ts` (`npm run build`) | **Đạt (cấu trúc & build); chưa đạt (nghe kiểm trực quan trên trình duyệt GPU/Audio)** |
| **AC-07: HUD 7 vùng & Mũi tên chỉ đèn** | `index.html` + `src/web/ui.ts` + unit test `computeOffscreenLanternArrow` | **Đạt** |
| **AC-08: Bảng màu & Ánh sáng chuẩn** | `PALETTE` trong `src/web/worldScene.ts` + công thức `ambient.intensity = 0.15 + 0.55 * brightT` | **Đạt (giá trị hex & công thức trong code)** |
| **AC-09: Hiệu năng** | Headless `21.600` ticks đo được `0.46s` (`<= 30s`); FPS WebGL thực tế ở `1280×720` dùng shared geometry/material | **Đạt (headless `0.46s`); chưa đạt (đo FPS trực tiếp trên trình duyệt người dùng — xem mục 4)** |

---

## 4. Hạng mục cần người dùng kiểm tra trực tiếp trên trình duyệt

Môi trường CLI/terminal hiện tại không cài Playwright hay trình duyệt headless GPU để tự đo FPS WebGL và nghe Web Audio thực tế. Các hạng mục sau được ghi nhận **chưa đạt kiểm chứng chạy trình duyệt tự động** trong phiên này để bạn chạy xác nhận nhanh trên máy:
1. Chạy `npm run preview`, mở URL ở cửa sổ `1280×720`.
2. Kiểm tra điều hướng Menu -> Giới thiệu Ông Đăng (Đêm 1 → 2 → 3) -> Pause (`Esc`/`P`) -> Cài đặt (`Âm lượng`, `Độ nhạy chuột`, reload trang giữ giá trị) -> Màn **Bình Minh**.
3. Kiểm tra FPS ổn định `≥ 30 FPS`, màu sắc 3 đảo/nhân vật, gió Đêm 3, âm thanh BGM/SFX và mũi tên chỉ đèn ngoài màn hình.
