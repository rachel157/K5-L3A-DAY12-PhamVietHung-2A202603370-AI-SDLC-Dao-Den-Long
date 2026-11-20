# Bằng chứng kiểm chứng Phase 1 (`PRD-0` & `Test Contract v1.0`)

- **Môi trường kiểm chứng:** Windows (`Node.js v22.16.0`, `npm 10.9.2`), hỗ trợ chéo nền tảng macOS / Linux (`engines: ^20.19.0 || >=22.12.0`).
- **Commit kiểm chứng:** `ff30240` (clean clone & toàn bộ test suite); tài liệu bằng chứng này cập nhật ngay sau đó.

## Bảng truy vết yêu cầu đến bằng chứng

| Yêu cầu PRD-0 / Contract | Cách kiểm chứng | Bằng chứng / File liên quan | Kết quả |
|---|---|---|---|
| `game.contract.json` đúng schema v1.0 & khớp `src/core/` | `tests/contract-sync.test.mjs` đối chiếu 1:1 `game.contract.json` với `DEFAULT_TUNING` & 5 đèn `L1..L5` (`L1` `[0,0,25]`) | [game.contract.json](../../../game.contract.json), [tests/contract-sync.test.mjs](../../../tests/contract-sync.test.mjs) | Đạt (`2/2` pass) |
| Tách biệt thuần `src/core/` (không `three`/DOM/`process`/`Math.random`/`Date.now`) | `tests/core-boundary.test.mjs` quét tĩnh toàn bộ `.ts` trong `src/core/` | [tests/core-boundary.test.mjs](../../../tests/core-boundary.test.mjs) | Đạt (`1/1` pass) |
| Logic 60Hz: di chuyển + `cam_yaw_deg` + chuẩn hóa vector + nhảy + zero-order hold + edge trigger | `tests/core-game.test.mjs` kiểm chứng `player_speed * 2s = 12.0m`, xoay 90°, nhảy `Y > 0`, giữ `interact: true` không nạp đúp | [src/core/game.ts](../../../src/core/game.ts), [tests/core-game.test.mjs](../../../tests/core-game.test.mjs) | Đạt (`3/3` pass) |
| Scenario override (`lanterns` patch, `random_*=false`, không phát event/điểm lúc dựng) | `tests/core-game.test.mjs` kiểm chứng patch từng đèn, `0` điểm lúc setup, `0` spawn qua 1800 ticks | [tests/core-game.test.mjs](../../../tests/core-game.test.mjs) | Đạt (`1/1` pass) |
| Nhặt đom đóm, `carry_capacity`, thắp 5 đèn thắng (`all_lit`) trước `dawn` + bonus | `tests/core-game.test.mjs` kiểm chứng giới hạn sức chứa, thắng trả `all_lit` và thưởng đúng `410` điểm | [tests/core-game.test.mjs](../../../tests/core-game.test.mjs) | Đạt (`1/1` pass) |
| `pulse` làm choáng `3.0s` (`180` tick), đẩy `4m`, cooldown `2.0s` (`120` tick), `safe_radius` đèn sáng | `tests/core-game.test.mjs` kiểm chứng `stunned` hết hạn đúng tick 181 và đẩy Bóng Mực ra `>= 4.5m` quanh đèn sáng (đèn tắt không chặn) | [tests/core-game.test.mjs](../../../tests/core-game.test.mjs) | Đạt (`2/2` pass) |
| Va chạm Bóng Mực (`invuln_s`, `hit_drop_ratio`, `no_flames`), hết giờ (`dawn`) | `tests/core-game.test.mjs` kiểm chứng `dropped = floor(carried * 0.5)`, miễn thương 90 ticks, thua `no_flames` và `dawn` | [tests/core-game.test.mjs](../../../tests/core-game.test.mjs) | Đạt (`2/2` pass) |
| CLI `--seed`, `--night 1`, `--scenario`, `--inputs`, `--ticks`, `--out`, mã thoát `0`/`1`/`2` | `tests/cli-headless.test.mjs` chạy tiến trình thật qua Node CLI kiểm tra JSONL và đủ mã thoát `0`, `1`, `2` | [src/cli/headless.ts](../../../src/cli/headless.ts), [tests/cli-headless.test.mjs](../../../tests/cli-headless.test.mjs) | Đạt (`4/4` pass) |
| Tính tất định tuyệt đối & không có `-0` trong JSONL | Chạy `node dist-cli/cli/headless.js --seed 7 --night 1 --ticks 300 --out <f1/f2>` 2 lần so sánh byte-for-byte + check regex `-0` | Lệnh chạy thật tại workspace & clean clone | Đạt (`DET_IDENTICAL: True`, `CLEAN_CLONE_P1_IDENTICAL: True`) |
| Tự kiểm clone sạch (`git clone` -> `npm ci` -> `npm run build` -> `npm test` -> headless) | Chạy thực tế trên thư mục tạm ngoài workspace (`dao-den-long-p1-clean-044b1f05`) | Log chạy thật commit `ff30240` | Đạt (`21/21` pass trong `1.70s`) |
| Giao diện 3D Three.js Đảo Bến, Mây đội nón lá + đèn nhỏ, HUD, âm thanh, Chơi lại | Kiểm tra biên dịch `tsc -p tsconfig.web.json && vite build` thành công (`241–256ms`); *chưa mở trình duyệt GUI trực tiếp để kiểm tra hiển thị trực quan* | [index.html](../../../index.html), [src/web/main.ts](../../../src/web/main.ts), [src/web/audio.ts](../../../src/web/audio.ts) | Chưa kiểm tra trực quan (mới pass build) |

## Output mẫu đã quan sát

`node dist-cli/cli/headless.js --seed 7 --night 1 --ticks 300 --out r1.jsonl` (33 dòng JSONL):
- Dòng đầu (`tick: 0`):
  `{"type":"snapshot","tick":0,"sim_tick":0,"state":"playing","time_left_s":300,"score":0,"player":{"pos":[0,0,0],"flames":3,"carried":0},"lanterns":[{"id":"L1","pos":[0,0,25],"lit":false,"deposited":0},{"id":"L2","pos":[23.776,0,7.725],"lit":false,"deposited":0},{"id":"L3","pos":[14.695,0,-20.225],"lit":false,"deposited":0},{"id":"L4","pos":[-14.695,0,-20.225],"lit":false,"deposited":0},{"id":"L5","pos":[-23.776,0,7.725],"lit":false,"deposited":0}],"shades":[{"id":"S1","pos":[-12.775,0.8,6.477],"state":"chase"},{"id":"S2","pos":[22.362,0.8,13.821],"state":"chase"},{"id":"S3","pos":[-14.159,0.8,15.275],"state":"chase"}],"motes":[...],"motes_active":20}`
- Dòng cuối:
  `{"type":"end","ticks":300,"state":"playing","score":0}`

## Việc cần tự kiểm thêm trên máy học viên trước khi tag & push `phase-1`

- [ ] Chạy `npm run preview`, mở trình duyệt chơi thử từ lúc vào Đảo Bến tới khi thắng/thua và bấm **Chơi lại** để xác nhận trực quan 3D + âm thanh.
- [ ] Gắn tag `phase-1` (nếu cần cập nhật) và push lên GitHub (`git push origin main && git push origin phase-1`).
