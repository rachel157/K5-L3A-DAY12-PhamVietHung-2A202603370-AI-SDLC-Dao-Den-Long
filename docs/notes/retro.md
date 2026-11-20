# Retrospective — Đảo Đèn Lồng (Phase 0 → Phase 4 · `v1.0.0`)

> Tổng kết quy trình phát triển game 3D + lõi mô phỏng tất định (`TypeScript` + `Vite` + `Three.js` + `Node.js`) qua 5 chặng từ Checkpoint 0 đến bản phát hành `v1.0.0`.

---

## 1. Tổng hợp Đánh giá qua 4 Phase

| Phase | Phạm vi chính | Contract & Kiểm thử | Kết quả & Bài học nổi bật |
|---|---|---|---|
| **Phase 0 (CP0)** | Kiến trúc tách `src/core` – `src/web` – `src/cli`, CI, AI harness (`AGENTS.md`, `verify-phase`, Stop hook) | `13/13` pass trên clean-clone | Khóa ranh giới thuần TypeScript từ đầu giúp toàn bộ 3 phase sau không bị dính lỗi DOM/Three.js trong lõi headless. |
| **Phase 1 (`PRD-0`)** | Đêm 1 (`Đảo Bến`), di chuyển/nhảy/nạp đèn/tỏa sáng/Bóng Mực, cảnh 3D + Web Audio + HUD | `v1.0`, `25/25` pass, tag `phase-1` | Lỗi lật ngược Bóng Mực nửa `+Z` do `mesh.lookAt` và bẫy số thực IEEE-754 trên timer choáng giúp thiết lập chuẩn kiểm thử toán học `TIMER_EPS`. |
| **Phase 2 (`TICKET-02`)** | Chuẩn hóa số liệu 60 Hz, mở rộng 3 Đêm (`Đảo Bến`, `Đảo Cau`, `Đảo Chuông`), Lướt, Bùa Gió, Gió Lạc, Đảo 3 tầng & gió mạnh | `v1.1`, `44/44` pass, `21.600` ticks `< 0.7s`, tag `phase-2` | Phát hiện sớm lỗi tụt vòm bục nhảy khi lướt trên không (`savedLaunchVy`), lỗi `spawnPos` Đêm 3 dưới Tháp Chuông, và lỗi vách dốc `1.0m` thông qua test tọa độ thật. |
| **Phase 3 (`TICKET-03`)** | Thay thế luật cốt lõi: nhiên liệu nguyên `1/60` (`fuelSixtieths`), châm dầu, Bóng `drain`, thắp lại `5`, bỏ `all_lit` → `dawn_survived`, sức chứa `10→20`, chế độ mù màu | `v1.2`, `51/51` pass, tag `phase-3` | Lưu nhiên liệu bằng số nguyên `1/60` xóa sạch sai số tích lũy qua `18.000` tick; ghi `ADR-001` và `CHANGELOG.md` giúp truy vết rành mạch mọi test `[THAY THẾ]`. |
| **Phase 4 (`TICKET-04`)** | Benchmark `1280×720` (`bench.json`), Soak 10 Đêm (`soak.json`), Bảng xếp hạng cục bộ + `--export-leaderboard`, Trợ năng toàn diện (`>= 18px`, đổi phím, phụ đề + mũi tên, giảm chuyển động), đóng gói `v1.0.0` | `v1.3`, `59/59` pass, tag `phase-4` | Tạo `run.js` kiêm static server + disk persistence cho bảng xếp hạng giúp chạy web thuần và xuất CLI `--export-leaderboard` đồng bộ mà không cần cài thêm database ngoài. |

---

## 2. Điều gì hiệu quả & chưa hiệu quả khi làm việc với AI

- **Hiệu quả:**
  - **Tách Spec → Builder Check → Plan TDD (Red→Green→Commit) → Final Review (`pro`):** Buộc AI viết test thất bại trước khi sửa code giúp bắt ngay bug logic (như ranh giới `fuel = 30.0`, tick cuối `no_flames` trước `dawn_survived`, hay `--crimson` chưa đổi trắng khi mù màu).
  - **Kiến trúc `src/core/` thuần TypeScript & `visualHelpers.js` thuần JS:** Cho phép chạy hơn 50 unit/integration tests trực tiếp trên `node --test` trong `< 7 giây` mà không phải khởi động trình duyệt giả cho từng case nhỏ.
- **Chưa hiệu quả / Cần lưu ý:**
  - Khi thay đổi luật cốt lõi ở Phase 3 (`[THAY THẾ]`), một số test Phase 1–2 cũ bị xung đột ngầm (như `L1` sáng xong tự hao `3/60` ở tick 3 nên nhận châm dầu thay vì nhường `L2`). Phải rà soát kỹ từng test cũ thay vì ép luật mới chiều theo fixture cũ.
  - Ở môi trường Windows PowerShell, lệnh truyền dấu `--`, mã hóa UTF-8 có BOM (`Set-Content`), và xung đột `bash.exe` (WSL vs Git Bash) từng gây kẹt script tự động — cần kiểm tra chéo đường dẫn và chạy trên bash/PowerShell thực tế.

---

## 3. Những lần AI sai và cách phát hiện

1. **Quay ngược Bóng Mực ở nửa sân `+Z` (Phase 1):** `THREE.Object3D.lookAt` xoay Euler `X/Z = ±π` rồi ghi đè `rotation.z = 0` làm lật ngược mesh → Phát hiện qua **Final Reviewer (`pro`)**, sửa bằng đặt `rotation.order = "YXZ"` trong `applyShadeFacing` kèm unit test khóa.
2. **Đặt nhầm `spawnPos` Đêm 3 ở `[0, 0, 0]` (Phase 2):** Nằm dưới sàn Tầng 2 (`Y=6`) khiến Mây rơi/kẹt ngay đầu trận → Phát hiện khi **chạy CLI benchmark 21.600 tick thật** (chết ở tick 300), sửa sang `[0, 0, -20]` và thêm test bắt buộc `getGroundY === spawnPos[1]`.
3. **Bóng Mực leo ngang vách dốc `1.0m` & Pause softlock (Phase 2):** Truyền `shade.pos[1]` (đã `+0.8m`) vào kiểm tra vách và bỏ quên `GameEvent[]` lúc resume → Phát hiện qua **Final Reviewer (`pro`)**, viết failing test tái lập rồi sửa dứt điểm.
4. **Sai tên trường `refuel` (`used` vs `amount`) & thiếu `--crimson: #ffffff` khi mù màu (Phase 3):** Lần lượt bị **`tsc` strict** và **Final Reviewer (`pro`)** phát hiện → Bổ sung `getLowFuelHudStatus` và test kiểm CSS `index.html`.

---

## 4. Harness nào giúp ích nhiều nhất?

1. **`AGENTS.md` ngắn gọn (`30` dòng `< 60`):** Giữ nguyên tắc ranh giới `src/core/`, định dạng import `.js`, và bắt buộc chạy `npm run build && npm test` ở mỗi lượt mà không làm phình context window.
2. **Stop Hook (`.agents/scripts/stop-test-gate.mjs`) + Test biên giới (`tests/core-boundary.test.mjs`):** Đảm bảo không bao giờ kết thúc lượt làm việc khi test đang đỏ hoặc vô tình lọt `process`/`window`/`Math.random` vào `src/core/`.
3. **Skill `.agents/skills/verify-phase/SKILL.md`:** Chuẩn hóa bộ lệnh determinism 3 Đêm + benchmark `21.600` tick + clean-clone trước mỗi lần gắn tag `phase-N`.

---

## 5. Ước tính Token / Chi phí AI & Chiến lược Tiết kiệm

- **Ước tính tổng qua CP0 + 4 Phase:**
  - CP0 + Phase 1: ~90k–150k tokens
  - Phase 2: ~180k–260k tokens
  - Phase 3: ~150k–230k tokens
  - Phase 4: ~160k–240k tokens
  - **Tổng ước lượng toàn dự án:** **~580k–880k tokens** (gồm ngữ cảnh đọc/sửa code, chạy test và các lượt `builder-check` / `final-review` `pro`; đối chiếu số billing chính xác trên dashboard tài khoản AI).
- **Cách tiết kiệm token hiệu quả:**
  - Thực thi kế hoạch theo mô hình **inline (`executing-plans`)** kết hợp **1 lượt review độc lập `pro` ở cuối mỗi phase**, tránh gọi subagent implementer/reviewer lặp lại cho từng task nhỏ.
  - Dùng `node:test` thuần và `Select-String` / đọc theo dải dòng ngắn thay vì đọc toàn bộ file dài nhiều lần.
  - Giữ tài sản 3D và âm thanh 100% procedural trong code gọn nhẹ, không sinh file cấu hình/asset thừa.

---

## 6. Nếu làm lại từ đầu sẽ thay đổi gì?

1. **Đưa `visualHelpers` & CSS contract vào bộ test ngay từ Phase 1:** Giúp kiểm tự động cỡ chữ `>= 18px`, bảng màu mù màu, và trạng thái HUD song song với lõi game mà không đợi tới Phase 3–4.
2. **Chuẩn hóa từ sớm `run.js` làm local server ngay từ Phase 1:** Vừa phục vụ static `dist/`, vừa sẵn sàng cho lưu trữ đĩa cục bộ (leaderboard, config) và benchmark mà không phụ thuộc `vite preview` đơn thuần.
3. **Cài sẵn Playwright/ffmpeg trong môi trường dev ngay từ CP0:** Để tự động hóa hoàn toàn kiểm tra WebGL visual, quay video demo `.mp4` và chụp screenshot ngay trong CI.
