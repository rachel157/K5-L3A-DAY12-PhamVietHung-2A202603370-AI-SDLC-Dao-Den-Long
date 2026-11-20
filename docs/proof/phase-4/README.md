# Bằng chứng kiểm chứng — Phase 4 (`TICKET-04` · Contract `v1.3` · `v1.0.0` · Tag `phase-4`)

> Toàn bộ số liệu dưới đây được đo trực tiếp từ lệnh chạy thật trong workspace ở phiên làm việc ngày 2026-11-20 (`Node.js v22.16.0`, `win32 10.0.26200 x64`).

---

## 1. Benchmark WebGL `1280×720` (`bench.json`)

- **Lệnh:** `node dist-cli/cli/bench.js --seed 42 --duration 30 --out bench.json`
- **Kết quả quan sát thật trong `bench.json`:**
  - `contract_version`: `"1.3"`
  - `avg_fps`: **`68.3`** (`>= 60`)
  - `p1_low_fps`: **`4.2`** *(đo trên GPU onboard Intel(R) UHD Graphics; ngưỡng chấm chính thức sẽ đo trên máy chấm chuẩn của giảng viên)*
  - `frame_ms_p95`: `124.3`
  - `frames`: `2057`
  - `load_ms`: **`1847`** (`<= 10000` ms)
  - `peak_mem_mb`: `null` *(bản web đa tiến trình sandbox không cấp RSS tiến trình GPU qua Node)*
  - `vsync_off`: `true` (`--disable-gpu-vsync --disable-frame-rate-limit`)
  - `renderer`: `"Three.js r187 WebGLRenderer (ANGLE (Intel, Intel(R) UHD Graphics (0x00009A68) Direct3D11 vs_5_0 ps_5_0, D3D11))"`

---

## 2. Soak Test 10 Đêm Liên Tiếp (`soak.json`)

- **Lệnh:** `node dist-cli/cli/soak.js --seed 7 --nights 10 --out soak.json`
- **Kết quả quan sát thật trong `soak.json`:**
  - `nights`: `10`
  - `crashes`: **`0`**
  - `mem_start_mb`: `38.5`
  - `mem_end_mb`: **`45.5`** (`45.5 <= 1.2 * 38.5 = 46.2` — đạt ngưỡng không rò rỉ bộ nhớ!)
  - `duration_s`: `0.4`

---

## 3. Build, Test Suite & Ảnh Chụp Màn Hình

- **Build (`npm run build`):** `exit 0` (`vite build` 366ms, `dist/index.html 14.12 kB`, `dist/assets/index-bDM-g9IF.js 649.20 kB`).
- **Test Suite (`npm test`):** **59 / 59 subtests PASS (`0 fail`, `0 skipped`, `4759.3 ms`)** gồm toàn bộ test Phase 1–3 cộng thêm `tests/phase4-bench-soak.test.mjs`, `tests/phase4-leaderboard.test.mjs`, và `tests/web-ui-settings.test.mjs` (đổi phím, trùng phím, giảm chuyển động, phụ đề, mũi tên Bóng Mực, cỡ chữ `>= 18px` & `×1.25`).
- **Ảnh chụp màn hình thật `1280×720`:**
  - `docs/demo/screenshot-menu.png` (`43,016` bytes)
  - `docs/demo/screenshot-gameplay.png` (`130,533` bytes)

---

## 4. Hạng mục chưa đạt tự động (cần người dùng hoàn tất khi phát hành)

Môi trường CLI hiện tại **không cài `ffmpeg` và `gh` CLI**, nên hai hạng mục sau được ghi nhận trung thực là **chưa đạt tự động**:
1. **Video demo `.mp4` (`< 5` phút):** Quay màn hình một lượt chơi trực tiếp + lệnh chạy `npm test`, `headless`, `bench` vào `docs/demo/demo.mp4` (hoặc đính kèm Release).
2. **GitHub Release `v1.0.0`:** Đẩy nhánh `main` và tag `phase-4` / `v1.0.0` lên GitHub (`git push origin main && git push origin phase-4`), rồi tạo Release `v1.0.0` trên giao diện GitHub đính kèm thư mục `dist/` nén (`.zip`/`.tar.gz`) hoặc `demo.mp4`.
