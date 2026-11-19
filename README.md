# Shanagri

Mô phỏng tưới tiêu, truy xuất nguồn gốc và quản lý đặt trước nông sản cho trang trại mẫu.

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

## Các màn hình chính

| Đường dẫn | Chức năng |
| --- | --- |
| `/` | Tổng quan vùng trồng, mô phỏng độ ẩm, hàng đợi và nhật ký tưới. |
| `/cho-nong-san` | Tìm, lọc và so sánh các lô trên Chợ nông sản. |
| `/lo/:code` | Xem nguồn gốc, lịch sử tưới và đặt trước theo lô. |
| `/tra-cuu-don#<token>` | Xác minh OTP, tra cứu phân bổ và theo dõi tiến độ giao hàng. |
| `/chu-trang-trai/don` | Tạo và công bố lô, quản lý đơn, chốt phân bổ, soạn và giao hàng. |

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

### Truy xuất lô
Chạy db:setup để tạo lô CAM-2026-01. Mở /lo/CAM-2026-01 hoặc GET
/api/public/batches/CAM-2026-01. Chỉ lô đã công bố được trả về. Nhật ký
là dữ liệu chạy thử theo vùng, kịch bản và khoảng ngày của lô; reset mô phỏng
cũng làm trống nhật ký demo. Nhu cầu tưới không có nghĩa là đã tưới.

Mỗi lượt tưới mới lưu ngày yêu cầu theo lịch mô phỏng và mã lô nếu có đúng
một lô khớp vùng, kịch bản và khoảng ngày. Lệnh thủ công dùng ngày mô phỏng
gần nhất của vùng (ngày đầu nếu chưa chạy). Nếu không có lô hoặc có nhiều
lô khớp, lượt vẫn chạy nhưng không công bố dưới bất kỳ lô nào. Yêu cầu
trùng không thay đổi liên kết ban đầu; dữ liệu cũ không được gán hồi tố.
Trang lô chỉ hiển thị lượt DONE và để trống ước tính nếu thiếu dữ liệu.

## Chợ nông sản và đặt trước

Mở `/cho-nong-san` để tìm theo tên nông sản, mã lô hoặc tên trang trại. Có thể nhập tiếng Việt có dấu hoặc không dấu. Lọc theo tình trạng còn nhận đặt trước hay đã hết số lượng, rồi sắp xếp theo giá thấp nhất hoặc ngày thu hoạch sớm nhất. Mỗi trang hiển thị tối đa 12 lô. Đường dẫn giữ từ khóa, bộ lọc, cách sắp xếp và số trang.

Chợ hiển thị lô đã công bố, còn mở và chưa đến hạn chốt. Lô hết số lượng vẫn có liên kết truy xuất. API `GET /api/public/market` mặc định chỉ trả lô còn số lượng. Dùng `sort=price` để sắp xếp theo giá và `includeSoldOut=1` để lấy thêm lô đã hết số lượng.

### Giữ chỗ và xác minh số điện thoại

Sau khi chạy `npm run db:setup`, lô mẫu `CAM-2026-01` có hạn mức 100 kg với giá 35.000 ₫/kg. Khách nhập số điện thoại di động Việt Nam và số kg nguyên để giữ chỗ. MVP ghi nhận giá trị đơn và tiến độ giao hàng phục vụ thử nghiệm, chưa tích hợp thanh toán hoặc đơn vị vận chuyển.

Để nhận OTP, cấu hình `OTP_SECRET` bằng chuỗi ngẫu nhiên riêng dài ít nhất 32 ký tự. Đặt `SMS_WEBHOOK_URL` và `SMS_WEBHOOK_TOKEN` cho bộ chuyển tiếp SMS. API gửi JSON `{to,message}` qua HTTP POST với Bearer token. Khi sử dụng thật, dùng URL HTTPS và bộ chuyển tiếp hỗ trợ số Việt Nam dạng `+84`. Thiếu cấu hình SMS thì API không tạo giữ chỗ mới.

Mỗi lượt giữ chỗ có 10 phút để xác minh. Một số điện thoại được giữ tối đa một lượt chờ xác minh cùng lúc và tạo tối đa ba lượt mỗi giờ, kể cả lượt đã hủy. OTP được thử tối đa năm lần. Lượt gửi lại cách nhau ít nhất 60 giây, tổng cộng tối đa ba SMS mỗi lượt giữ chỗ và không gia hạn. Toàn hệ thống nhận tối đa 60 lượt giữ chỗ cần SMS mới trong 10 phút. Khi hết hạn, hệ thống hoàn lại số kg đã giữ.

API `POST /api/public/batches/:code/preorders` nhận `id` (UUID), `kg`, `phone`, `lookupToken` và trường tùy chọn `expectedPriceVnd`. Gửi lại cùng yêu cầu không trừ thêm hạn mức. Đơn giữ đơn giá tại thời điểm đặt. Nếu giá đã đổi, API trả `412`. Nếu thiếu hàng, API trả `409 INSUFFICIENT_STOCK` kèm `remainingKg` để khách chọn lại số lượng. Số kg còn nhận trên chợ và trang lô tự cập nhật mỗi 10 giây khi tab hiển thị và khi quay lại tab.

### Liên kết tra cứu đơn

Sau khi giữ chỗ, khách mở hoặc sao chép liên kết riêng để xác minh, xem quyết định hủy, kết quả phân bổ và tiến độ giao hàng. Token nằm sau dấu `#`, được gửi qua header `Authorization`. PostgreSQL lưu mã băm SHA-256 của token. Ai có liên kết đều có thể tra cứu đơn tương ứng, nên hãy giữ liên kết riêng. Mã đơn chỉ dùng để đối chiếu với chủ trại.

Trang tra cứu mở từ **Tra cứu đơn đã đặt** trên Chợ nông sản. Sau khi đặt thành công, trình duyệt lưu liên kết gần nhất trong thẻ hiện tại để mở lại sau khi tải trang. Có thể chọn **Quên liên kết trong thẻ này** để xóa bản lưu. URL gốc vẫn tra cứu được.

## Quản lý đơn của chủ trại

Đặt `DEMO_OWNER_TOKEN` thành một chuỗi bí mật riêng trong `.env`, khởi động lại API rồi nhập mã tại `/chu-trang-trai/don`. Trong **Danh sách đơn**, có thể tìm theo mã đơn đầy đủ và kết hợp bộ lọc theo lô, trạng thái, tiến độ soạn/giao hoặc yêu cầu hủy đang chờ. Danh sách hiển thị tổng số đơn phù hợp và tối đa 25 đơn mỗi trang.

Chủ trại xác nhận hoặc hủy đơn đang chờ. Khi khách yêu cầu hủy đơn đã xác nhận, chủ trại chọn **Duyệt hủy** để hoàn kg đúng một lần hoặc **Từ chối hủy** để giữ nguyên đơn. Khách xem quyết định qua liên kết tra cứu.

Với lô còn mở bán, chủ trại có thể đổi giá cho đơn mới, cập nhật hạn mức hoặc chọn **Tạm dừng nhận đơn** và **Mở lại**. Tổng hạn mức mới phải ít nhất bằng số kg đang giữ. Sau khi chốt thu hoạch, lô dừng nhận đặt trước.

### Tạo lô nháp
Vào /chu-trang-trai/don bằng mã chủ trang trại, nhập tên, vùng trồng và
hai ngày rồi lưu. Ví dụ với dữ liệu seed: Cam Sành, 01/03–31/03/2026.
Hai khoảng cùng vùng và cùng kịch bản không được chung ngày, kể cả ngày biên.
Lô nháp chưa có tin bán và chỉ hiển thị trong danh sách riêng của chủ trại.

### Công bố và mở bán
Ở /chu-trang-trai/don, chọn lô trong danh sách chưa công bố, nhập đơn giá
VND/kg và hạn mức kg nguyên dương. Chọn **Xem lại và mở bán**, kiểm tra
thông tin và xác nhận. Trang truy xuất và tin bán xuất hiện cùng lúc.
Gửi lại lệnh công bố không cập nhật giá, tồn hoặc trạng thái nhận đơn.

Khi công bố, có thể nhập hạn chốt theo giờ Việt Nam (UTC+7), độc lập với ngày thu hoạch dự kiến. Trường API `closesAt` nhận thời điểm ISO UTC hoặc `null`. Khi đến hạn, lô rời chợ. Các đơn đã tạo vẫn tra cứu và xử lý được.

### Chốt thu hoạch và phân bổ

1. Nhập ngày thực thu và sản lượng nguyên kg, kể cả 0, rồi chọn **Chốt thu hoạch**. Mỗi lô được chốt một lần. Cần xử lý hoặc đợi hết hạn các lượt giữ chỗ đang chờ OTP của lô trước khi chốt.
2. Chọn **Xem trước phân bổ** để đối chiếu sản lượng thực thu, đã đặt, dự kiến giao, còn thiếu và chưa phân bổ. Dùng lối tắt trong bản xem trước để xử lý đơn chờ xác nhận hoặc yêu cầu hủy.
3. Chọn **Chốt phân bổ** rồi **Xác nhận chốt phân bổ**. Hệ thống ưu tiên đơn đến trước. Ví dụ, 65 kg thực thu cho ba đơn 30, 25 và 25 kg được chia thành 30, 25 và 10 kg. Nếu dữ liệu thay đổi giữa lúc xem và lúc xác nhận, cần tải lại phương án. Chốt phân bổ một lần cho mỗi lô.

### Soạn và giao hàng

- Trong bảng phân bổ đã chốt, chọn **Tải danh sách soạn hàng (CSV)**. File có mã lô, mã đơn, số kg đã đặt, số kg cần soạn, đơn giá và giá trị giao. File chỉ gồm các đơn có số kg phân bổ lớn hơn 0.
- Theo dõi **Chờ soạn hàng**, **Chờ giao** và **Đã giao** trong hàng đợi của tất cả lô hoặc lô đang lọc. Có thể đánh dấu trực tiếp từ thẻ đơn hoặc bảng phân bổ. Đơn cần được đánh dấu đã soạn trước khi xác nhận đã giao.
- Trong hàng đợi **Chờ soạn hàng** hoặc **Chờ giao**, có thể chọn từng đơn hoặc **Chọn tất cả trên trang**, tối đa 25 đơn mỗi lượt. Kiểm tra tổng số đơn và số kg trước khi xác nhận. Nếu một đơn không đủ điều kiện, cả lượt cập nhật được hoàn tác. Gửi lại cùng thao tác giữ nguyên thời điểm đã lưu.
- Khách thấy số kg được phân bổ, giá trị theo số lượng giao và tiến độ trên trang tra cứu. Đơn phân bổ 0 kg hiển thị rõ không có hàng để giao.

## Nghiệm thu MVP

Workflow [MVP acceptance](.github/workflows/mvp-acceptance.yml) chạy khi cập nhật `develop`, mở hoặc cập nhật PR vào `main` hay `develop`, hoặc chạy thủ công. Chỉ chạy các script nghiệm thu trên PostgreSQL thử nghiệm mới vì chúng tạo đơn và chốt lô.

Để chạy local, đặt `DATABASE_URL` cho database thử nghiệm, `DEMO_OWNER_TOKEN`, `OTP_SECRET`, `SMS_WEBHOOK_TOKEN` và `SMS_WEBHOOK_URL=http://127.0.0.1:4599`. Tắt `VIRTUAL_VALVE_ENABLED`. Chạy `npm run db:setup`, khởi động API ở cổng 4000, web ở cổng 3000 và hộp thư kiểm thử bằng `node tests/acceptance/sms.mjs`. Các tiến trình API, hộp thư và kịch bản nghiệm thu phải nhận cùng cấu hình từ môi trường, kể cả khi chạy ở các terminal khác nhau. Sau đó chạy:

```sh
node tests/acceptance/api.mjs
python -m playwright install chromium
python tests/acceptance/browser.py
```

Cài Python Playwright theo phiên bản trong workflow. Bộ kiểm thử đi từ công bố lô, đặt trước và xác minh OTP đến phân bổ, CSV, soạn và giao hàng loạt. Hộp thư kiểm thử chỉ dành cho môi trường nghiệm thu. Việc nhận SMS trên điện thoại thật cần kiểm tra riêng với nhà cung cấp.


## Nghiệm thu trước khi mở cho khách

- Dùng web HTTPS, API và PostgreSQL riêng cho staging. Đặt `API_BASE_URL` trong môi trường của web và áp dụng migration lên database đích trước khi khởi động API. Chạy seed demo và kịch bản nghiệm thu trên database thử nghiệm.
- Đặt `DEMO_CONTROLS_ENABLED=false` trong môi trường của cả web và API dành cho khách. Xác minh trang tổng quan ẩn nút mô phỏng, các thao tác chạy, reset và gửi yêu cầu tưới trả `403`, còn trang chợ và truy xuất vẫn mở được.
- Cấu hình bộ chuyển tiếp SMS thật qua HTTPS bằng `SMS_WEBHOOK_URL` và `SMS_WEBHOOK_TOKEN`, cùng `OTP_SECRET` riêng của môi trường. Từ web staging, đặt một đơn bằng số thử đã được phép, nhận SMS trên điện thoại và nhập mã để xác minh. Kiểm tra khách thấy đơn chờ xác nhận, chủ trại thấy đúng đơn và thao tác hủy trả lại hạn mức.
- Kiểm tra `GET /health/ready` của API, luồng giữ chỗ đến giao hàng trên staging và kết quả nhận OTP thật trước khi mở đặt hàng cho khách. Cất mã chủ trại và các khóa trong cấu hình bí mật của môi trường.
