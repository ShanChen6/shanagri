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

### Time-Warp
Chọn **Chạy tự động** để chạy tiếp khi dashboard đang mở. Sau khi mỗi bước
hoàn tất, chờ một giây trước bước kế tiếp. **Tạm dừng** cho phép ngày đang
xử lý hoàn tất. Đóng tab dừng bộ hẹn giờ; các ngày đã ghi vẫn còn.
**Đặt lại** yêu cầu xác nhận và xóa lịch sử của kịch bản hiện tại trên
trang trại demo dùng chung (POST /api/farms/demo/simulation/reset).

## Hàng đợi tưới mô phỏng
Chạy lại `npm run db:setup` sau khi cập nhật. Vùng thiếu ẩm tự gửi yêu cầu;
có thể POST /api/farms/demo/zones/:id/irrigate để thử thủ công.
GET /api/farms/demo/queue trả về các lượt đang tưới và đang chờ theo bơm.
Mỗi lượt chạy 10 giây thời gian thực; worker kiểm tra mỗi giây. Yêu cầu
trùng cho vùng còn trong hàng đợi trả lại lượt hiện có. Lượt chờ giữ
nguyên thứ tự sau restart; nếu lượt đang chạy đã hết hạn, worker kết thúc
lượt đó và bắt đầu lượt kế tiếp. Đặt lại mô phỏng xóa cả hàng đợi demo.
Thời hạn này chỉ dùng cho bơm giả lập, chưa xác nhận trạng thái van thật.

### Nhật ký tưới
Dashboard hiển thị tối đa 50 lượt hoàn tất gần nhất và cho lọc theo vùng.
API: GET /api/farms/demo/irrigation-history?zoneId=zone-cam.
Lưu lượng giả lập mặc định 100 mL/s được chụp lại khi bắt đầu mỗi lượt.
Thời lượng theo lịch mô phỏng nhân với lưu lượng này cho ra thể tích ước tính;
thời gian worker ngừng hoạt động không cộng thêm nước. Lượt hoàn tất trước
migration không có số đo ước tính. Reset demo xóa cả lịch sử tưới.

### IoT ảo: nhận độ ẩm
Chạy db:setup, đặt DEVICE_SIM_TOKEN trong .env thành chuỗi bí mật riêng rồi
khởi động lại API. Từ thư mục gốc, chạy:
```sh
node --env-file=.env apps/device-sim/run.mjs
```
Thêm --once để gửi một mẫu. Mỗi 5 giây thiết bị virtual-cam gửi độ ẩm giả
lập cho zone-cam. Tải lại dashboard để xem bản ghi mới nhất. API kiểm tra
token, phạm vi 0–100%, từ chối mẫu mới quá 60 giây hoặc vượt trước hơn
5 giây. Gửi lại cùng ID và nội dung không tạo bản ghi thứ hai.
Dữ liệu thiết bị ảo độc lập với Time-Warp, chưa kích hoạt tưới.

### Van ảo có xác nhận
Sau db:setup, đặt VIRTUAL_VALVE_ENABLED=true và DEVICE_SIM_TOKEN trong .env,
khởi động lại API. Chạy đúng một tiến trình điều khiển:
```sh
node --env-file=.env apps/device-sim/valve.mjs
```
Các lượt Cam Sành mới yêu cầu thiết bị đọc OPEN/STOP qua HTTP. Khi mất kết nối,
van giả lập tự đóng; backend vẫn giữ bơm cho đến khi nhận CLOSED đúng mã lượt.
Sau khi kết nối lại, thiết bị đọc STOP và gửi lại xác nhận nếu cần. Reset trả
409 khi còn lượt van ảo chưa xác nhận. Cờ môi trường không thay đổi lượt đã tạo.
Xương Rồng vẫn dùng bộ mô phỏng thời gian. Lượt van ảo chưa đo lưu lượng.
