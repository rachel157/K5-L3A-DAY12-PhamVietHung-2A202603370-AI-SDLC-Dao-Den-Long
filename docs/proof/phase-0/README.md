# Bằng chứng Checkpoint 0 (Chuẩn bị)

> Trạng thái: Mẫu khởi tạo — số liệu chạy thật và kiểm chứng clone sạch sẽ được điền sau Task 5.

## Bảng tự kiểm kỹ thuật CP0

| Hạng mục | Cách kiểm chứng | Kết quả | Ghi chú |
|---|---|---|---|
| Cài đặt & Build (Web + CLI) | `npm run build` | *Chờ Task 5* | |
| Bộ test đơn vị, ranh giới `core`, CLI & Stop hook | `npm test` | *Chờ Task 5* | |
| Tính tất định headless | Chạy `npm run headless -- --seed 7 --ticks 20` 2 lần | *Chờ Task 5* | |
| Tự kiểm clone sạch | `git clone` sang thư mục tạm, chạy `npm ci && npm run build && npm test && npm run headless` | *Chờ Task 5* | |

## Danh sách thao tác thủ công dành cho học viên

- [ ] Xác nhận repo GitHub cá nhân đang bật chế độ **Public** và tên đúng quy ước `K5-L3A-DAY12-PhamVietHung-2A202603370-AI-SDLC-Dao-Den-Long`.
- [ ] Đăng nhập `claude.ai`, mở Lab board Phase 1 và hỏi thử trợ giảng AI 1 câu.
- [ ] Kiểm tra hạn nộp từng phase và hạn LMS từ Coach.
