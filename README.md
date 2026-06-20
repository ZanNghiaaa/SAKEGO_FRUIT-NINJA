# SAKEGO FRUIT NINJA AI - HAND TRACKING EDITION

Trò chơi tương tác thực tế ảo giống Fruit Ninja, sử dụng bàn tay thật để chém trái cây thông qua webcam và AI MediaPipe. Trò chơi kết hợp các yếu tố nhận diện khuôn mặt và nhận diện bàn tay.

## CÔNG NGHỆ

- Frontend: HTML5, CSS3, JavaScript ES6 (Vite)
- Game Engine: Phaser.js
- AI Tracking: `@mediapipe/hands`, `@mediapipe/face_mesh`
- Database: Firebase Firestore
- CSS Framework: Tailwind CSS

## CÁCH CHẠY DỰ ÁN

1. Clone source code về máy.
2. Cài đặt dependencies:
   ```bash
   npm install
   ```
3. Cấu hình Firebase:
   - Copy file `.env.example` thành `.env`
   - Điền các thông tin API Key của Firebase vào file `.env`.
   - Lưu ý: Firestore Database cần có collection `leaderboard` (hoặc nó sẽ tự tạo khi thêm document).

4. Khởi chạy môi trường phát triển:
   ```bash
   npm run dev
   ```
5. Mở trình duyệt và truy cập `http://localhost:5173`.
6. Cấp quyền truy cập Camera cho trình duyệt.

## CÁCH CHƠI

- Đứng trước Webcam.
- Đợi AI khởi tạo (mất vài giây lần đầu).
- Vung tay (cổ tay / ngón trỏ) trước màn hình để tạo đường kiếm chém trái cây.
- Chém Sa kê (+10 điểm), Dưa hấu (+8), Xoài (+5), Táo (+3), Cam (+3).
- Tránh chém Sâu Bệnh (-10) và Thuốc Hóa Học (-15). Chém Rác Nhựa sẽ mất Combo.
- Chém liên tục tạo Combo. Đạt 50 điểm để vào Golden Sake Mode.
- 15 giây cuối cùng sẽ xuất hiện Boss Sâu Bệnh Khổng Lồ, hãy chém liên tục để tiêu diệt.

## THAY ĐỔI ASSETS

Hiện tại các trái cây đang sử dụng đồ họa tạo tự động (Graphics) của Phaser để có thể chạy mượt mà không cần file ảnh thật. Để thay bằng ảnh thật:
1. Thêm các file `sake.png`, `sake_left.png`, `sake_right.png`,... vào thư mục `public/assets/`.
2. Trong `src/game/MainScene.js`, ở hàm `preload()`, sử dụng `this.load.image('sake', '/assets/sake.png');` để tải ảnh.
3. Thay thế các đoạn code sinh hình đồ họa bằng `Graphics` ở hàm `create()`.
