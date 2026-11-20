# Nhật ký dùng AI & Quản lý Token (AI Log)

> Ghi chép công cụ AI, các lần AI sai hoặc thiếu sót, cách chỉnh harness, và ước tính token/chi phí qua từng phase.

---

## Phase 0 (Checkpoint 0 — Chuẩn bị)

- **Công cụ AI:** Google Antigravity (model Gemini 4 Hydrogen, có điều phối subagent reviewer độc lập).
- **Công việc đã giao AI:**
  1. Phân tích repo khung đề bài và kiểm tra công cụ trên máy (Node `v22.16.0`, Python `3.13.12`, Docker `28.0.1`).
  2. Thiết kế kiến trúc tách `src/core/` – `src/web/` – `src/cli/` và AI harness (spec tại `docs/superpowers/specs/2026-11-20-checkpoint-0-design.md`).
  3. Lập kế hoạch 5 task (`docs/superpowers/plans/2026-11-20-checkpoint-0.md`) và triển khai theo chu trình TDD (Red → Green → Commit) kèm kiểm chứng clone sạch và review độc lập cuối nhánh.
- **Lỗi / sự cố phát hiện & cách xử lý:**
  - *Builder check subagent* phát hiện tài liệu thiết kế nháp ban đầu chưa ghi rõ target runtime là Google Antigravity, chưa ghi rõ schema `.agents/hooks.json` (Antigravity chạy hook trong CWD `.agents/` và đòi hỏi JSON thuần trên stdout), và cần `npm test` luôn biên dịch lại CLI để tránh test code cũ → Đã sửa dứt điểm trong spec và viết test kiểm chứng ở `tests/stop-hook.test.mjs`.
  - *Lỗi shell Windows PowerShell khi truyền cờ CLI qua npm & Final Code Reviewer subagent (`pro`)* chỉ ra 2 điểm Important: (1) `README.md` và `.agents/skills/verify-phase/SKILL.md` vẫn hướng dẫn `npm run headless -- --seed ...` vốn lỗi trên PowerShell, và (2) tài liệu ghi `Node.js >= 18` trong khi Vite 8 yêu cầu `^20.19.0 || >=22.12.0` → Đã viết test tái lập lỗi (`tests/cp0-packaging.test.mjs`), sửa `README.md`, `AGENTS.md`, `SKILL.md`, `package.json` (`engines` + `node --test` tự phát hiện không phụ thuộc glob shell), `assumptions.md`, `.github/workflows/ci.yml` và kiểm chứng lại bằng clean clone (`13/13` test PASS).
- **Chiến lược tiết kiệm token:**
  - Dùng `node:test` có sẵn của Node.js thay vì cài thư viện test ngoài và config phức tạp.
  - Giữ `AGENTS.md` ngắn gọn (27 dòng) để không đốt ngữ cảnh ở mọi lượt.
  - Chọn thực thi inline (`executing-plans`) kèm 1 lượt review độc lập ở cuối thay vì gọi subagent riêng cho từng task nhỏ.
- **Ước tính token/chi phí CP0:** Hoàn thành CP0 trong 1 phiên tương tác liên tục (thêm 1 subagent builder-check và 1 subagent final code-review ở model `pro`; bạn có thể đối chiếu con số billing thực tế trên giao diện công cụ AI nếu cần).

---

## Phase 1 (PRD-0 & Test Contract v1.0)

- **Công cụ AI:** Google Antigravity (model Gemini 4 Hydrogen, kèm 1 subagent builder-check và 1 subagent code-reviewer `pro`).
- **Công việc đã giao AI:**
  1. Tách mọi chỗ mơ hồ của PRD-0 & Test Contract v1.0 vào `docs/notes/assumptions.md` trước khi viết code.
  2. Thiết kế & lập kế hoạch triển khai `game.contract.json`, lõi mô phỏng 60 Hz (`src/core/game.ts`), CLI headless (`src/cli/headless.ts`), cảnh 3D + Web Audio + HUD (`src/web/`, `index.html`), bộ 21 unit/contract/CLI/hook tests.
  3. Kiểm chứng trên bản clone sạch và sửa lỗi theo đánh giá độc lập.
- **Lỗi / vấn đề phát hiện & cách xử lý:**
  - *Builder check subagent* cảnh báo bẫy số thực IEEE-754 (`3.0 - 180*(1/60) > 0` làm choáng thành 181 tick thay vì 180 tick), mâu thuẫn với test CP0 cũ (`tests/cp0-packaging.test.mjs`) khi CLI Phase 1 bắt buộc `--night 1 --out`, và rủi ro `interact` giữ nguyên trạng thái `true` theo zero-order hold → Đã dùng `TIMER_EPS = 1e-9` cho mọi timer, làm tròn `round3` chỉ lúc ghi JSONL, kiểm tra `all_lit` trong lúc `interact`, và cập nhật đồng bộ `SKILL.md` / `ci.yml` / `cp0-packaging.test.mjs`.
  - *Tự phát hiện khi thiết kế camera 3D:* Ở `cam_yaw_deg = 0`, công thức xoay Contract §C định nghĩa `+Z` là hướng tiến và `+X` là bên trái màn hình; đã chỉnh ánh xạ phím `A`/`D` (`+1`/`-1`) để điều khiển `WASD` khớp đúng góc camera.
  - *Independent Final Reviewer (`pro`):* Phát hiện 1 lỗi Critical trong `src/web/main.ts` (`mesh.lookAt()` mặc định `'XYZ'` kèm ghi đè `rotation.z = 0` làm lật ngược ~50% Bóng Mực phía `+Z` xuống dưới mặt đất `Y=0`), 2 lỗi Important (`Space` kích hoạt lại nút HUD đang focus; test zero-order hold cũ bị vacuous và thiếu assert cho Bóng Mực `stunned` trong `safe_radius`), cộng 1 lỗi trùng ID khi scenario đặt thực thể không `id` trước thực thể có `id` tường minh → Đã sửa toàn bộ theo chu trình `RED → GREEN` (`25/25` test pass) và kiểm chứng lại trên bản clone sạch (`82a889b`).
- **Chiến lược tiết kiệm token:**
  - Tiếp tục thực thi inline (`executing-plans`) qua 5 task thay vì gọi subagent implementer riêng cho từng task; gộp bước cập nhật tài liệu & kiểm chứng sạch.
  - Không dùng thư viện âm thanh/asset ngoài, tổng hợp nhẹ bằng Web Audio API (~95 dòng).
- **Ước tính token/chi phí CP0 + Phase 1:** Ước tính Phase 1 sử dụng ~12–16 lượt gọi công cụ chính + 2 subagent review (`builder-check` + `final code-review`), tổng ước lượng khoảng 90k–150k tokens (bao gồm context đọc diff/spec; đối chiếu chính xác qua dashboard tài khoản AI).

---

## Phase 2 (TICKET-02 — "Ba hòn đảo", Contract v1.1)

- **Công cụ AI:** Google Antigravity (thực thi kế hoạch 6 task theo chuẩn TDD + `builder-check` + `final code-review` model `pro`).
- **Công việc đã giao AI:**
  1. Thiết kế & kiểm tra chéo giả định (`docs/superpowers/specs/2026-11-20-phase-2-design.md`, `P2-01..P2-10` trong `docs/notes/assumptions.md`).
  2. Nâng cấp `game.contract.json` (`v1.1`), viết `src/core/maps.ts` (3 đảo + cầu tre + dốc 30°/150° nối kín mép + bục nhảy + Tháp Chuông), nâng cấp lõi 12 bước `src/core/game.ts`, mở rộng CLI `--night 1|2|3` & schema `v1.1`.
  3. Hoàn thiện 3D Three.js 3 hòn đảo theo bảng màu chuẩn (`src/web/worldScene.ts`), Web Audio BGM + 10+ SFX (`src/web/audio.ts`), cài đặt `localStorage` (`src/web/settings.ts`), chiến dịch Menu/Intro Ông Đăng/Pause/Bình Minh + HUD 7 vùng (`src/web/ui.ts`, `index.html`).
  4. Bộ kiểm thử hồi quy & tính năng mới (`39/39` subtests), cập nhật harness (`AGENTS.md`, `SKILL.md`, `ci.yml`), kiểm chứng clean-clone và ghi bằng chứng Phase 2.
- **Lỗi AI / sự cố kỹ thuật phát hiện & cách khắc phục:**
  - *Bục nhảy Đêm 2 kết hợp Lướt trên không (`src/core/game.ts`):* Bản đầu khi Lướt trên không đã gán cứng `vy = 0` và xóa luôn vận tốc đứng sau khi kết thúc `12` tick lướt, khiến Mây bị hụt vòm nhảy và rơi xuống vực giữa hai đảo. Đã thêm `savedLaunchVy` lưu vận tốc đứng lúc bắt đầu lướt khi đang `isLaunched` và khôi phục lại ngay khi hết `12` tick lướt.
  - *Điểm xuất phát Đêm 3 bị đặt nhầm tại `[0, 0, 0]` (`src/core/maps.ts`):* Khi chạy benchmark CLI thực tế `21.600` tick ở Đêm 3, đầu ra cho thấy Mây chết ngay ở tick `300` vì `[0, 0, 0]` nằm bên dưới sàn Tầng 2 (`Y=6`) và bên trong Tháp Chuông! Đã sửa `Night 3` `spawnPos` thành `[0, 0, -20]` trên mặt Tầng 0 (`Y=0`), thêm assertion bắt buộc mọi Đêm có `getGroundY === spawnPos[1]` trong `tests/maps-terrain.test.mjs`, và ghi giả định `P2-10`.
  - *Off-by-1 test Bùa Gió tái sinh (`tests/phase2-features.test.mjs`):* Do Mây đứng đúng tại `[35, 0, 0]` đến tick `2701`, Step 4 trong chính tick Bùa vừa tái sinh (`Step 2`) lập tức nhặt lại Bùa lần 2 nên `available` lại thành `false`. Đã cho Mây bước đi khỏi vị trí bùa sau khi nhặt ở tick `1` để đo đúng trạng thái `false` ở tick `2700` và `true` ở tick `2701`.
  - *Ràng buộc static `core-boundary.test.mjs`:* Comment chứa từ `process` trong `src/core/game.ts` làm test biên giới báo lỗi; đã đổi từ mô tả comment sang `handle`.
  - *Independent Final Reviewer (`pro`) phát hiện 4 Important + 6 Minor:* (1) `stepPlayerMovement` thiếu giới hạn step-down `gy >= oldY - 0.45` khiến bước khỏi mép Tầng 1/2 bị snap ngay xuống `Y=0`; (2) `shade.pos[1]` truyền vào `moveHorizontalOnTerrain` chứa `+0.8m` làm Bóng Mực leo ngang vách dốc `1.0m` và rẽ sớm ở `floorY = 1.2m`; (3) `togglePause()` khi resume không xóa input cũ và bỏ qua `GameEvent[]` dễ softlock nếu trùng tick `game_over`; (4) `drifter_drop` trên vực Đêm 2 giữ `refY = 1.6` làm đom đóm lơ lửng ngoài đảo; cùng 6 điểm Minor (tổng điểm campaign, `fall_enabled`, edge `0`-tick/âm `time_left_s`, `.dispose()` Three.js, test `12m/18m` & tick `1200`, phím `Esc` từ Settings về Pause). Đã viết failing tests trước (`RED`) rồi sửa trọn bộ `4 Important + 6 Minor`, nâng bộ kiểm thử lên **`44/44` PASS (`GREEN`)**.
- **Chiến lược tiết kiệm & kiểm soát token:**
  - Dùng lại bộ test `node:test` nhanh gọn, gom 6 task theo hợp đồng interface kiểm tra trước (`pre-flight check`), chỉ gọi `1` subagent reviewer `pro` độc lập cuối nhánh thay vì gọi ở mọi task nhỏ.
  - Cập nhật `AGENTS.md` gọn `30` dòng (`< 60` dòng) để giảm context overhead cho các phase sau.
- **Ước tính token/chi phí Phase 2:** ~180k–260k tokens (tính qua các lượt đọc/viết đa file 3 Đêm, TDD 39 test và final review `pro`; xem thống kê chính xác trên giao diện billing công cụ).

---

## Phase 3 (TICKET-03 — "Đèn cạn dầu", Contract v1.2)

- **Công cụ AI:** Google Antigravity (thiết kế + `builder-check` + kế hoạch 5 task `executing-plans` chuẩn TDD + `final code-review` model `pro`).
- **Công việc đã giao AI:**
  1. Thiết kế thay đổi cốt lõi tại `docs/superpowers/specs/2026-11-20-phase-3-design.md`, lập `docs/notes/adr-001-lantern-fuel-and-win-condition.md` và cập nhật bảng giả định `P3-01..P3-08` trong `docs/notes/assumptions.md`.
  2. Nâng cấp `game.contract.json` (`v1.2`), `src/core/` (`types.ts`, `contract.ts`, `maps.ts`, `game.ts`) sang nhiên liệu nguyên `fuelSixtieths` (`1/60`), châm dầu `ceil`, `lantern_out`, thắp lại `5`, `wander -> drain` (kèm lọc tầng Đêm 3 & thoát choáng về `wander`), sức chứa động `10 → 20`, bỏ `all_lit` sang `dawn_survived`.
  3. Cập nhật CLI `src/cli/headless.ts` kiểm `target_lantern_id`, `drain`, `fuel`, `ever_lit`, `successful_lights` và test validation.
  4. Cài đặt **Chế độ mù màu** (`"Bảng màu dễ phân biệt"` -> `colorblindMode`, Bóng Mực `#00B3FF`, cảnh báo `#FFFFFF + ⚠`), đèn tắt xẹp `scale.y = 0.8` + vết rách giấy, thanh dầu 3D + nhấp nháy `1 Hz`, HUD mở rộng `20` ô và SFX mới.
  5. Viết `CHANGELOG.md`, `README.md`, proof Phase 3 và kiểm chứng build/benchmark/determinism/clean-clone.
- **Lỗi AI / sự cố kỹ thuật phát hiện & cách xử lý:**
  - *Sai tên trường `data` của event `refuel` giữa code và `types.ts`:* Khi viết `stepLanternInteract` ở Task 2 đã tạm ghi `used` thay vì `amount` (vốn đã khóa trong `types.ts` và spec `refuel { lantern_id, amount, fuel }`), kèm lỗi truyền `Vec3Tuple` vào `isLanternReachableByShade` -> Trình biên dịch `tsc` bắt ngay cả hai lỗi ở lần compile đầu tiên.
  - *Xung đột tự nhiên của 2 test cũ `core-game.test.mjs` dưới luật Phase 3:*
    1. Test `zero-order hold + tie-break` cho `L1` sáng lúc tick 0 rồi lại bấm `interact` ở tick 3 ở cùng khoảng cách `1m` với `L2`. Dưới luật v1.2, `L1` tự hao `3/60` (`fuel = 99.95 < 100`) nên hợp lệ nhận châm dầu `1` đom đóm và thắng tie-break (`"L1" < "L2"`)! Đã cô lập riêng test tie-break `!lit` bằng override top-level `tuning: { ...DEFAULT_TUNING, fuel_decay_per_s: 0 }` kèm chú thích `[THAY THẾ v1.2]`.
    2. Test `capacity=10` trước đây dựa vào việc thắp `L5` kết thúc ván luôn ở tick 0 (`all_lit`), nay Đêm tiếp tục chạy sang tick 1 nên sau khi tiêu `10` đom đóm ở Bước 7 tick 0, Bước 5 tick 1 tự nhặt đom đóm thứ hai -> Cập nhật assert kiểm tra rõ `snap1.motes.length === 1` ở cuối tick 0 và `picked[1]` ở tick 1.
  - *Bẫy PowerShell BOM khi benchmark CLI & WSL `bash` path trên Windows:* `Set-Content -Encoding utf8` trong PowerShell 5.1 chèn BOM `U+FEFF` khiến `JSON.parse` báo lỗi ở lần chạy benchmark đầu; đã chuyển sang `[System.IO.File]::WriteAllText(..., ...)` (UTF-8 no BOM). Ngoài ra script `.superpowers` `task-done` gọi `-- bash -c` bị trỏ vào WSL `C:\Windows\System32\bash.exe` thay vì Git Bash; khắc phục bằng truyền trực tiếp `-- node --test` với `usr\bin\bash.exe` đầu `$PATH`.
- **Chiến lược tiết kiệm token:**
  - Tiếp tục `AGENTS.md` gọn `30` dòng (`< 60`), thi hành kế hoạch 5 task inline + ledger `progress.md`, dùng helper `visualHelpers.js` thuần JS kiểm trực tiếp thanh dầu/nhấp nháy `1 Hz`/chế độ mù màu qua Node `50` tests không cần dựng trình duyệt giả nặng.
- **Ước tính token/chi phí Phase 3:** ~150k–230k tokens (bao gồm thiết kế + builder-check, thực thi 5 task TDD đa module, benchmark/clean-clone và 1 lượt final review `pro`; xem số liệu billing thực tế trên giao diện công cụ AI).

---

## Phase 4 (TICKET-04 — "Bình minh: phát hành v1.0.0", Contract v1.3)

- **Công cụ AI:** Google Antigravity (thiết kế + TDD 5 task + chạy thực tế Chrome WebGL benchmark, soak test 10 Đêm, chụp screenshot thật & kiểm chứng clean-clone).
- **Công việc đã giao AI:**
  1. Nâng cấp `game.contract.json` (`v1.3`) thêm `bench_cmd`, `soak_cmd`, `run_cmd`; tạo `createBenchWorld`/`stepBenchWorld` (`200` Bóng Mực `wander` + `100` đom đóm + `L1..L3` `fuel=100`), `src/core/benchMetrics.ts` và `src/cli/soak.ts`.
  2. Xây dựng Bảng xếp hạng cục bộ `src/core/leaderboard.ts`, local server `src/cli/run.ts` (`--export-leaderboard`, lưu đĩa `~/.dao-den-long/leaderboard.json`) và `src/web/leaderboardClient.ts`.
  3. Tạo `src/cli/bench.ts` & chế độ `?bench=1` trong `src/web/main.ts` (quỹ đạo camera tròn `R=30, Y=15`, `15s/vòng`, warm-up `3s`), chạy thật 30s trên Chrome WebGL ghi `bench.json`.
  4. Hoàn thiện Trợ năng Phase 4 (đổi phím 9 hành động + báo trùng + khôi phục mặc định, phụ đề `#subtitle-box` + mũi tên Bóng Mực `#shade-arrow`, giảm chuyển động `reduceMotion`, cỡ chữ tối thiểu `18px` + `×1.25`) và UI Bảng xếp hạng.
  5. Chụp screenshot thật `1280×720` (`docs/demo/`), viết `LICENSE`, `CREDITS.md`, `CHANGELOG.md`, `README.md`, `docs/notes/retro.md`, `docs/proof/phase-4/README.md` và kiểm chứng clean-clone.
- **Lỗi AI / sự cố kỹ thuật phát hiện & cách xử lý:**
  - *Lỗi import tên hàm PRNG trong `src/cli/soak.ts`:* Gõ nhầm `createPrng` thay vì `createSeededRng` (`src/core/prng.ts`) -> Trình biên dịch `tsc` phát hiện ngay, sửa lại và kiểm tra `npm test` xanh toàn bộ.
  - *Đảm bảo cỡ chữ `>= 18px` không phá vỡ bố cục `1280×720`:* Dùng CSS `--font-scale` (`1` mặc định, `1.25` khi bật Chữ lớn) kết hợp unit test regex tự động quét mọi `font-size` trong `index.html`.
- **Chiến lược tiết kiệm token:**
  - Không đọc lại toàn bộ file lớn đã biết, dùng `node:test` thuần và tận dụng Chrome có sẵn thay vì cài Playwright/Electron nặng.
- **Ước tính token/chi phí Phase 4:** ~160k–240k tokens (tổng dự án 4 phase ~580k–880k tokens).
