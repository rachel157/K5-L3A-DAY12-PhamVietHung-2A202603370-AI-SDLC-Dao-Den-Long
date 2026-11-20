# Bằng chứng Checkpoint 0 (Chuẩn bị)

- **Môi trường kiểm chứng:** Windows (`Node.js v22.16.0`, `npm 10.9.2`), đối chiếu tương thích chéo nền tảng cho macOS / Linux.
- **Commit kiểm chứng:** `af3f91f` (sau khi khắc phục 2 lỗi Important từ lượt review độc lập).

## Bảng truy vết & kết quả kiểm chứng

| Hạng mục | Lệnh đã chạy | Kết quả quan sát thật | Trạng thái |
|---|---|---|---|
| Cài đặt từ repo sạch | `npm ci` (trong thư mục clone tạm) | `added 27 packages, and audited 28 packages in 4s`, `found 0 vulnerabilities` | Đạt |
| Biên dịch CLI & Web 3D | `npm run build` (`tsc -p tsconfig.cli.json` + `tsc -p tsconfig.web.json && vite build`) | Exit code `0`; tạo `dist/index.html` (`0.73–0.74 kB`), JS bundle (`537.38 kB`) trong ~`297–441ms` và `dist-cli/` | Đạt |
| Bộ test đơn vị, ranh giới `core`, CLI, Stop hook & tài liệu/packaging | `npm test` (`npm run build:cli && node --test`) | `13/13` test PASS, `0` fail (`duration_ms` ~`1.58s` tại workspace, ~`1.66s` tại clean clone) | Đạt |
| Tính tất định chế độ headless | Chạy 2 lần `node dist-cli/cli/headless.js --seed 7 --ticks 20` | Cả 2 lần ra chuỗi JSON giống hệt nhau (`CLEAN_CLONE_IDENTICAL: True`) | Đạt |
| Tự kiểm clone sạch | `git clone . <temp>` → `npm ci && npm run build && npm test` → chạy 2 lần CLI → dọn thư mục tạm | Exit code `0`, `13/13` test PASS, `CLEAN_CLONE_IDENTICAL: True` | Đạt |
| Chạy thử đồ họa WebGL trực tiếp trên trình duyệt | Chưa mở trình duyệt / cửa sổ GUI trong phiên terminal tự động | *Chưa kiểm tra trực quan (mới kiểm tra `tsc` + `vite build`)* | Chưa kiểm tra trực quan |

## Output mẫu đã quan sát (từ `node dist-cli/cli/headless.js --seed 7 --ticks 20`)

```json
{"ok":true,"mode":"hello-cp0","seed":7,"ticks":20,"dtSec":0.05,"finalState":{"seed":7,"tick":20,"elapsedSec":1,"position":{"x":0,"y":1.336394614,"z":0},"yawRad":0.973543133,"glowIntensity":1.012474199}}
```

## Thao tác thủ công cần học viên xác nhận để khép kín Checkpoint 0

- [ ] Xác nhận repo GitHub `K5-L3A-DAY12-PhamVietHung-2A202603370-AI-SDLC-Dao-Den-Long` đang để chế độ **Public** và push nhánh `main`.
- [ ] Đăng nhập `claude.ai`, mở **[Đảo Đèn Lồng Lab](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW)**, vào tab Phase 1 và hỏi thử trợ giảng AI 1 câu.
- [ ] Kiểm tra hạn nộp từng phase và hạn nộp LMS từ Coach.
- [ ] Mở thử `npm run preview` (hoặc `npm run dev`) trên trình duyệt để nhìn trực quan cảnh Đèn Lồng 3D.
