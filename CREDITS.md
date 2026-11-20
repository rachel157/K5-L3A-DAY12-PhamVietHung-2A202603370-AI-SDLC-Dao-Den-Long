# Credits & Attributions

## Trạng thái hiện tại (Phase 2 — "Ba hòn đảo")

Toàn bộ đồ họa 3D và âm thanh trong game được tạo bằng mã nguồn thủ công (procedural Three.js geometries/materials và Web Audio API), **không sử dụng asset 3D, ảnh hay file âm thanh tải từ bên ngoài**:
- **Mô hình 3D thủ công (`src/web/worldScene.ts`):** Mây (áo kem, khăn đỏ, nón lá treo đèn lồng nhỏ), 5–7 Đèn Lồng Lớn, Đom đóm, Bóng Mực, Gió Lạc, Bùa Gió, địa hình Đảo Bến (`40m`), Đảo Cau (2 đảo + cầu tre + 2 bục nhảy), Đảo Chuông (3 tầng + 2 dốc + bục nhảy + Tháp Chuông + vệt gió mạnh).
- **Âm thanh thủ công (`src/web/audio.ts`):** Nhạc nền đêm ngũ cung và 10+ SFX tổng hợp qua Web Audio API.

## Thư viện & Công cụ

- **Three.js** — MIT License (render 3D WebGL)
- **Vite** — MIT License (bundler & preview server)
- **TypeScript** — Apache-2.0 License
- **Node.js** — MIT License (runtime headless CLI & `node:test`)
- **Google Antigravity** — AI coding assistant hỗ trợ thiết kế, lập kế hoạch, triển khai TDD và rà soát độc lập qua các phase.
