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

## Phase 1 (PRD-0) — *Chờ phát hành trên Lab board*

| ID Yêu cầu | Mô tả / Chỗ mơ hồ | Giả định áp dụng | Tiêu chí nghiệm thu | Trạng thái |
|---|---|---|---|---|
| — | Chờ PRD-0 | — | — | Chưa phát hành |

---

## Phase 2 (Ticket-02) — *Chờ phát hành*

| ID Yêu cầu | Thay đổi so với Phase 1 | Giả định cập nhật | Ảnh hưởng test cũ | Trạng thái |
|---|---|---|---|---|
| — | Chờ Ticket-02 | — | — | Chưa phát hành |

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
