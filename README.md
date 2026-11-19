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

## Mô phỏng ngày đầu
Sau khi cập nhật nhánh, chạy lại `npm run db:setup`. Mở dashboard và chọn
**Chạy mô phỏng ngày đầu** (hoặc POST /api/farms/demo/simulation/day-one).
Kịch bản dry-day-v1 dùng ngày cố định, thời tiết tổng hợp: 50% ban đầu,
0 mm mưa, hao hụt 5 điểm. Mô hình demo cộng 1 điểm cho mỗi mm mưa, giới
hạn kết quả trong 0–100%. Cam Sành cần tưới, Xương Rồng chưa cần tưới.
Chạy lại cập nhật cùng bản ghi mỗi vùng; chưa điều khiển bơm.
