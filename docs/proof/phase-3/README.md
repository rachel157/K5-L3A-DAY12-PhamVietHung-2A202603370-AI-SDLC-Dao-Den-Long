# Bằng chứng kiểm chứng — Phase 3 (`TICKET-03` · Contract `v1.2` · Tag `phase-3`)

> Toàn bộ số liệu dưới đây được đo trực tiếp từ lệnh chạy thật trong workspace hiện tại ở phiên làm việc ngày 2026-11-20 (`Node.js v22.16.0` trên Windows).

---

## 1. Kết quả Build & Test Suite

- **Lệnh build:** `npm run build` (`tsc -p tsconfig.cli.json` + `tsc -p tsconfig.web.json && vite build`)
  - **Kết quả:** Thành công (`exit 0`), bundle Vite tạo `dist/index.html` (`10.28 kB`) và `dist/assets/index-BppuuMK3.js` (`635.81 kB`, built in `380ms`).
- **Lệnh kiểm thử:** `npm test` (`npm run build:cli && node --test`)
  - **Kết quả:** **50 / 50 subtests PASS (`0 fail`, `0 skipped`, `4956.0 ms`)** trên các nhóm kiểm thử:
    - `tests/contract-sync.test.mjs` — `game.contract.json` (`contract_version: "1.2"`) khớp 1:1 với `DEFAULT_TUNING` (`fuel_max=100`, `fuel_decay_per_s=1`, `fuel_per_mote=10`, `relight_cost=5`, `win_ratio=0.6`, `drain_per_s=5`, `low_fuel_threshold=30`, `capacity_max=20`, `240/270/300s`, điểm `v1.2`), kèm `isLanternSafe`/`getDynamicCapacity`.
    - `tests/core-boundary.test.mjs` — `src/core/` thuần TypeScript 100% (không `three`, DOM, `process`, `Math.random`, `Date.now`).
    - `tests/maps-terrain.test.mjs` — Đêm 1/2/3 bản đồ, cầu tre, dốc kín mép `r=24`, Tháp Chuông và thời lượng mới `240/270/300s`.
    - `tests/core-game.test.mjs` — Hồi quy PRD-0 kết hợp các quy tắc mới (`fuel`, bỏ `all_lit` sang `dawn_survived`, điểm `v1.2`); các test điều chỉnh theo `[THAY THẾ v1.2]` được chú thích rõ và ghi tại `CHANGELOG.md` + `docs/notes/adr-001-lantern-fuel-and-win-condition.md`.
    - `tests/phase2-features.test.mjs` — Toàn bộ tính năng Phase 2 (Lướt, Bùa Gió, rơi `Y < -10`, bục nhảy Đêm 2/3, Gió Lạc, Gió mạnh Đêm 3, Pause/Resume, benchmark `21.600` tick ở `443.2 ms` với `time_left_s: 360`).
    - `tests/phase3-features.test.mjs` — Hao dầu `1/60` nguyên (`1/s` tự hao, tắt đèn `lantern_out`, thắp lại `5` đom đóm, `ever_lit`, `relit_count`), châm dầu `ceil((100 - fuel) / 10)` và bỏ qua đèn đầy `100`, ranh giới chính xác `fuel = 30.0` (an toàn) vs `< 30` (mất vùng `6 m`), Bóng Mực `wander -> drain` (`-5/s` cộng dồn, `fuel_drain` mỗi `60` tick), thoát `drain` (`chase <= 6 m`, `>= 30` đẩy ra mép `<= 30` tick, tắt đèn đồng bộ cùng tick Bước 2 trước Pulse -> `+5`, Pulse vào `drain` -> `+15`, hết choáng về `wander`), sức chứa động `10 → 20`, ưu tiên `no_flames` trên tick cuối và `dawn_survived` vs `dawn`.
    - `tests/cli-headless.test.mjs` — Schema CLI `v1.2` (`fuel`, `ever_lit`, `successful_lights`, `state: "drain"`, `target_lantern_id`, lỗi sai schema thoát mã `2`), sự kiện `refuel`/`fuel_drain`/`lantern_out`/`dawn_survived`.
    - `tests/web-helpers.test.mjs` & `tests/web-ui-settings.test.mjs` — Lưu/đọc `colorblindMode` (`localStorage`), `computeLanternVisualState` (`scaleY = 0.8` + rách giấy khi tắt, thanh dầu & vòng an toàn ở đúng `30.0`, nhấp nháy `1 Hz` khi `< 30`), `formatColorblindAlert` (`⚠ `), và toàn bộ helper HUD/Pause từ Phase 2.
    - `tests/stop-hook.test.mjs` & `tests/cp0-packaging.test.mjs` — Harness Stop hook và kiểm thử lệnh CLI từ `README.md` / `verify-phase/SKILL.md`.

---

## 2. Benchmark 21.600 Ticks & Tính Tất Định (Determinism) 3 Đêm

- **Benchmark 21.600 ticks Đêm 3 (CLI headless ghi file JSONL có Bóng Mực, Gió Lạc, gió mạnh, `time_left_s: 360`, `flames: 9999`):**
  - **Kết quả quan sát:** `exit 0`, **`722.9 ms`** (`0.72 giây`, `<= 30s`), ghi `2.241` dòng JSONL, kết thúc `{"type":"end","ticks":21600,"state":"lost","score":0}`.
- **Chạy mặc định Đêm 3 không scenario (`--seed 7 --night 3 --ticks 18000`):**
  - **Kết quả quan sát:** `exit 0`, **`306.8 ms`**, `END={"type":"end","ticks":5853,"state":"lost","score":0}`.
- **Kiểm tra byte-for-byte identical khi chạy 2 lần cùng seed (`--seed 7 --ticks 60`):**
  - `--night 1`: `NIGHT_1_IDENTICAL=True BYTES=14976`
  - `--night 2`: `NIGHT_2_IDENTICAL=True BYTES=15494`
  - `--night 3`: `NIGHT_3_IDENTICAL=True BYTES=17006`

---

## 3. Bảng Đối Chiếu Yêu Cầu TICKET-03

| Hạng mục / Yêu cầu | Phương thức kiểm chứng | Kết quả thực tế |
|---|---|---|
| Nhiên liệu `0..100`, tự hao `1/60`, châm dầu `ceil`, thắp lại `5`, `lantern_out` | `tests/phase3-features.test.mjs`, `tests/core-game.test.mjs` | **Đạt** |
| Vùng an toàn mất khi `fuel < 30` (giữ ở `= 30.0`), `wander -> drain`, `+15` Pulse, đẩy ra khi `>= 30`, hết choáng -> `wander` | `tests/phase3-features.test.mjs`, `tests/cli-headless.test.mjs` | **Đạt** |
| Sức chứa mở rộng `10 → 20` (`+2`/đèn thắp thành công, bỏ qua đèn đặt sẵn scenario) | `tests/phase3-features.test.mjs`, `tests/cli-headless.test.mjs` | **Đạt** |
| Bỏ `all_lit`, thắng bình minh `>= 60%` (`dawn_survived`), ưu tiên `no_flames`, điểm mới `v1.2`, thời lượng `240/270/300s` | `tests/contract-sync.test.mjs`, `tests/core-game.test.mjs`, `tests/phase3-features.test.mjs` | **Đạt** |
| CLI Contract `v1.2` (`--night 1\|2\|3`, schema `drain`/`target_lantern_id`/`fuel`/`ever_lit`) | `tests/cli-headless.test.mjs` | **Đạt** |
| Lưu `colorblindMode` (`localStorage`), helper thanh dầu / nhấp nháy `1 Hz` / đèn tắt xẹp `20%` + rách / `#FFFFFF + ⚠` / `#00B3FF` + HUD `10..20` ô | `tests/web-ui-settings.test.mjs`, `npm run build` (`vite build`) | **Đạt (logic, setting & build); chưa đạt (kiểm trực quan & âm thanh trên trình duyệt GPU — xem mục 4)** |
| Tài liệu ADR-001, `CHANGELOG.md`, `AGENTS.md` (`30` dòng `< 60`), `assumptions.md` | Đọc kiểm tra file & line count | **Đạt** |

---

## 4. Hạng mục cần người dùng tự kiểm tra trên trình duyệt

Môi trường CLI/terminal không có Playwright/trình duyệt headless GPU, nên các kiểm tra trình duyệt tương tác sau được ghi nhận trung thực là **chưa đạt kiểm chứng chạy trình duyệt tự động**:
1. Chạy `npm run preview` và mở URL trên trình duyệt ở `1280×720`.
2. Kiểm tra trực quan:
   - Thanh dầu 3D xoay theo camera trên các đèn đang sáng, nhấp nháy chậm `1 Hz` cả ánh sáng lẫn thanh dầu khi `fuel < 30`, mất vòng tròn an toàn khi `< 30`.
   - Đèn tắt bị xẹp `20%` chiều cao (`scale.y = 0.8`) và hiển thị các vết rách giấy tối màu.
   - Mở **Cài đặt** -> bật **`"Bảng màu dễ phân biệt"`**, reload trang xác nhận vẫn giữ, quan sát Bóng Mực có mắt & vòng phát sáng xanh dương `#00B3FF` cùng cảnh báo HUD `#FFFFFF` kèm biểu tượng `⚠`.
   - Nghe SFX châm dầu (`playRefuel`), tắt đèn (`playLanternOut`), cảnh báo hút dầu (`playFuelWarn`), xác nhận HUD mở rộng `10 → 20` ô đom đóm khi thắp đèn và thắng bình minh `dawn_survived` khi giữ sáng đủ `≥ 3/5`, `≥ 4/6`, `≥ 5/7`.
