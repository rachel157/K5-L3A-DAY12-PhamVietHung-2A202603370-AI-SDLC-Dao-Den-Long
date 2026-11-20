# ADR-001: Thay đổi Mô hình Trạng thái Đèn (Fuel + Relight) & Luật Thắng Bình Minh (Phase 3)

- **Ngày:** 2026-11-20
- **Trạng thái:** Đã chấp thuận (TICKET-03 · Contract `v1.2`)
- **Phạm vi:** `src/core/`, `src/cli/`, `src/web/`, `game.contract.json`, bộ test hồi quy & tính năng

---

## 1. Bối cảnh (Context)

Trong Phase 1–2 (`Contract v1.0` & `v1.1`), mỗi Đèn Lồng Lớn chỉ mang trạng thái nhị phân `lit: boolean` và ván chơi kết thúc **ngay lập tức** (`all_lit`) khi người chơi thắp sáng toàn bộ đèn. Kết quả playtest cho thấy người chơi thành thạo hoàn thành Đêm sau ~2 phút, làm mất nhịp căng thẳng ở nửa cuối Đêm và không tạo động lực bảo vệ hay quay lại chăm sóc các đèn đã thắp.

**TICKET-03** yêu cầu thay đổi cốt lõi hai thành phần liên kết chặt chẽ:
1. Đèn có **nhiên liệu tiêu hao** (`100` tối đa, tự hao `1/s`, Bóng Mực `drain` hút thêm `5/s`), có thể châm dầu khi đang sáng, tắt nếu cạn dầu (`fuel <= 0`) và cho phép thắp lại (`5` đom đóm thay vì `10`).
2. Bỏ thắng sớm `all_lit`; chỉ xét thắng tại bình minh (`dawn_survived`) khi người chơi còn sống và giữ sáng ít nhất `ceil(0.6 × tổng đèn)`.

---

## 2. Quyết định Thiết kế (Decisions)

### D1. Mô hình nhiên liệu nguyên `fuelSixtieths` (`1/60`) & cờ vòng đời đèn
- **Biểu diễn nội bộ:** Thay vì lưu `fuel` dạng số thực `float64` (vốn bị tích lũy sai số `1/60` và `5/60` qua 18.000 tick), mỗi đèn lưu **`fuelSixtieths: number` nguyên** (`100` fuel = `6000` đơn vị `1/60`).
  - Tự hao: `-1` mỗi tick ở Bước 2.
  - Hút dầu (`drain`): `-5` mỗi tick mỗi Bóng Mực đang hút ở Bước 2.
  - Làm tròn `round1(fuelSixtieths / 60)` chỉ thực hiện khi xuất JSONL snapshot hoặc event `refuel` / `fuel_drain`; thưởng bình minh dùng `Math.floor(fuelSixtieths / 60)`.
- **Vòng đời trạng thái đèn (`LanternEntity`):**
  - `Chưa từng sáng` (`!lit && !everLit`, `deposited ∈ [0..9]`, `fuel = 0`): cần `10` đom đóm.
  - `Đang sáng an toàn` (`lit && fuel >= 30`): phát sáng, tạo vùng an toàn `6m` chặn Bóng Mực; cho phép châm dầu tới `100`.
  - `Đang sáng yếu` (`lit && 0 < fuel < 30`): **mất vùng an toàn `6m`**, thu hút Bóng Mực `wander` tới hút dầu (`drain`).
  - `Tắt sau khi cạn` (`!lit && everLit`, `deposited ∈ [0..4]`, `fuel = 0`): phát `lantern_out`, giữ `everLit = true`, thắp lại chỉ tốn `5` đom đóm và tăng `relitCount += 1`.

### D2. Đánh giá điều kiện Thắng/Thua ở Bước 11 (Hết `all_lit`)
- Thời lượng chuẩn rút ngắn từ `300/330/360s` xuống **`240/270/300s`** để nhịp giữ đèn tập trung cao hơn.
- Vòng lặp tick không còn nhánh thắng sớm khi mọi đèn sáng.
- Đúng tick cuối (`timeLeftTicks <= 0`), kiểm tra `flames <= 0` (`no_flames`) **trước**; chỉ khi còn sống mới đếm số đèn `lit === true` so với ngưỡng `Math.ceil(win_ratio * totalLanterns)` (`3/5`, `4/6`, `5/7`) để trả về `dawn_survived` (thắng) hoặc `dawn` (thua).

### D3. Phân tách quy tắc điểm trong `game.contract.json v1.2`
- Bổ sung các khóa mới tường minh trong `tuning.score` (`per_relight: 40`, `per_stun_drain: 15`, `per_lantern_dawn: 50`) và xóa `per_second_left` thay vì ngầm hardcode trong `game.ts` — đảm bảo mọi test đồng bộ Contract `1:1` kiểm soát được đầy đủ hệ số điểm Phase 3.

---

## 3. Phương án đã cân nhắc & loại bỏ

- **Lưu `fuel` bằng float + `TIMER_EPS`:** Dễ làm sai ranh giới `fuel === 30.0` (chỉ lệch `1e-13` làm mất vùng an toàn hoặc sai `ceil((100 - fuel) / 10)` tốn thừa 1 đom đóm khi chỉ mất 1 tick dầu) → Loại bỏ.
- **Giữ lại `all_lit` sau cờ tương thích ngầm trong headless:** Trái trực tiếp yêu cầu `[THAY THẾ]` của TICKET-03 ("Không còn thắng sớm — Thắp đủ đèn không kết thúc Đêm") → Loại bỏ hoàn toàn và ghi nhận rõ trong Changelog.

---

## 4. Hệ quả & Truy vết Test

- Các test cũ Phase 1–2 assert `all_lit`, `300/330/360s`, `score.per_mote = 10` hoặc Bóng Mực không thể tiến vào vùng `6m` của mọi đèn đang sáng phải được cập nhật theo Contract `v1.2` kèm ghi chú rõ ràng.
- Mọi cơ chế không bị thay thế (di chuyển, nhảy, lướt + bục nhảy, bản đồ 3 Đêm, Gió Lạc, Bùa Gió, rơi `Y < -10`, gió mạnh Đêm 3, Pause/Resume) tiếp tục giữ nguyên 100% pass.
