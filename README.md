# Shanagri

Mô phỏng tưới tiêu và truy xuất nguồn gốc nông sản.

## Chạy local
Cần Node.js 24, npm và Docker Compose. Tại thư mục gốc:
```sh
cp .env.example .env
docker compose up -d --wait
npm install
npm run db:setup
npm run dev:api
```
Mở terminal khác chạy `npm run dev:web`. Web: http://localhost:3000.
API: http://localhost:4000/health/ready (503 nếu database chưa sẵn sàng).

## Các mốc
1. Nền tảng web, API và PostgreSQL.
2. Prisma, migration và seed hai vùng Cam Sành, Xương Rồng.
3. Mô phỏng thời tiết, độ ẩm và hàng đợi tưới theo bơm.
4. Thiết bị IoT ảo, truy xuất lô và đặt trước.

## Kiểm tra vùng trồng
Chạy lại `npm run db:setup` để áp dụng migration và bổ sung bản ghi mẫu còn thiếu.
GET http://localhost:4000/api/farms/demo/zones trả về hai vùng dùng chung Bơm chính.
Các ngưỡng 50% và 25% chỉ là tham số demo. Nếu đổi cổng API, đặt API_BASE_URL
trong môi trường của Next.js hoặc apps/web/.env.local.

## Mô phỏng 30 ngày
Trên dashboard, chọn **Chạy ngày N** và mở **Lịch sử độ ẩm** tại từng vùng.
Mỗi ngày lấy độ ẩm hôm trước, cộng lượng mưa và trừ hao hụt theo bộ dữ liệu
thời tiết giả lập cố định. Ví dụ ba ngày đầu: 45%, 41%, 54%.
POST /api/farms/demo/simulation/days/:day nhận số 1–30, trả 409 nếu bỏ qua ngày.
Gửi lại cùng ngày không tạo thêm bản ghi. Ngày đầu từ phiên bản trước vẫn được giữ.
