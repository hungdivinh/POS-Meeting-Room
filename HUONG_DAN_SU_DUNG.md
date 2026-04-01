# PTSC-POS Meeting Room App
## Hệ thống Đặt phòng họp trực tuyến

**Link truy cập:** [https://pos-team.io.vn](https://pos-team.io.vn)

---

## 1. Giới thiệu

PTSC-POS Meeting Room App là hệ thống đặt phòng họp trực tuyến, cho phép toàn bộ nhân viên xem lịch phòng họp, đặt phòng, và quản lý lịch họp một cách nhanh chóng, minh bạch — thay thế hoàn toàn việc đặt phòng qua gọi điện, nhắn tin hay liên hệ trực tiếp.

---

## 2. Chức năng chính

### 2.1. Đăng nhập nhanh
- Chỉ cần nhập **Họ tên** và **Số điện thoại** (10-11 số).
- Không cần tạo tài khoản, không cần mật khẩu.
- Thông tin được lưu trên trình duyệt, lần sau vào không cần nhập lại.

### 2.2. Xem lịch phòng họp
- **Chế độ Ngày:** Hiển thị dạng timeline từ 8:00 - 18:00, mỗi phòng một hàng — nhìn nhanh phòng nào trống, phòng nào đã đặt.
- **Chế độ Tuần:** Hiển thị tổng quan cả tuần, chia buổi Sáng/Chiều — tiện cho việc lên kế hoạch.
- Chuyển ngày bằng nút mũi tên hoặc chọn ngày trực tiếp trên lịch.
- Nút **"Hôm nay"** để quay về ngày hiện tại.

### 2.3. Đặt phòng họp
- Nhấn vào ô trống trên timeline hoặc nhấn nút **"+"** (góc phải dưới).
- Chọn **Khu vực** (VP1 / VP2 / Xưởng) để lọc nhanh phòng phù hợp.
- Điền thông tin: Phòng, Ngày, Giờ bắt đầu, Giờ kết thúc, Dự án, Mục đích.
- Hệ thống **tự động kiểm tra trùng lịch** — nếu trùng sẽ thông báo kèm thông tin liên hệ người đã đặt.

### 2.4. Nhu cầu (yêu cầu bổ sung)
- Tick vào **"Nhu cầu"** khi đặt phòng để chọn các yêu cầu bổ sung, ví dụ:
  - Giữ chỗ / Chưa confirm (vàng)
  - Chưa có PYC (đỏ)
  - Trái cây (xanh lá)
  - Bánh kẹo (hồng)
  - Nước suối (xanh dương)
- Có thể chọn **nhiều nhu cầu** cùng lúc.
- Khung giờ hiển thị sẽ có **màu theo nhu cầu** — dễ nhận biết bằng mắt.

### 2.5. Lặp lại lịch họp
- Tick vào **"Lặp lại"** khi đặt phòng.
- Chọn kiểu lặp:
  - **Tuần:** Chọn các thứ cần lặp (VD: Thứ 2, Thứ 4, Thứ 6).
  - **Tháng:** Chọn các ngày trong tháng cần lặp (VD: ngày 1, 15, 28).
- Chọn **ngày kết thúc lặp** — hệ thống tự tạo tất cả các khung giờ đến ngày đó.
- Khi xóa một khung giờ trong chuỗi lặp, hệ thống hỏi: **xóa riêng khung giờ này** hay **xóa toàn bộ chuỗi**.

### 2.6. Chỉnh sửa và Xóa
- Nhấn vào khung giờ đã đặt → nút **Sửa** (bút) và **Xóa** (thùng rác) xuất hiện.
- Chỉ người đặt hoặc Admin mới có quyền sửa/xóa.

---

## 3. Chức năng dành cho Admin

Đăng nhập với tài khoản Admin để truy cập các chức năng quản lý.

### 3.1. Quản lý Phòng họp (tab "Phòng họp")
- Thêm / Sửa / Xóa phòng họp.
- Thiết lập: Tên phòng, Khu vực (VP1/VP2/Xưởng), Tầng, Sức chứa, Vị trí chi tiết, Hiện trạng, Màu sắc.
- Phòng **"Tạm ngưng"** hoặc **"Đang triển khai hoán cải"** sẽ bị gạch ngang và đẩy xuống cuối danh sách.

### 3.2. Quản lý Nhu cầu (tab "Nhu cầu")
- Thêm / Sửa / Xóa các loại nhu cầu.
- Tùy chỉnh tên và màu sắc cho từng nhu cầu.

### 3.3. Cấp quyền Admin (tab "Cấp quyền")
- Thêm số điện thoại để cấp quyền Admin cho người khác.
- Xóa số điện thoại để thu hồi quyền.

### 3.4. Nhật ký hoạt động (nút "Log")
- Xem toàn bộ lịch sử hoạt động: ai đăng nhập, ai đặt/sửa/xóa phòng, ai tạo/xóa nhu cầu...
- Hiển thị thời gian, người dùng, hành động, chi tiết.

### 3.5. Quyền đặc biệt của Admin
- Chỉnh sửa **tên và số điện thoại người đặt** trong form đặt phòng (để đặt hộ).
- Chọn **màu hiển thị riêng** cho khung giờ.
- Sửa/xóa lịch đặt của **tất cả** mọi người.

---

## 4. Hướng dẫn sử dụng

### Bước 1: Truy cập
Mở trình duyệt (Chrome, Safari, Edge...) và vào: **[https://pos-team.io.vn](https://pos-team.io.vn)**

### Bước 2: Đăng nhập
Nhập **Họ tên** và **Số điện thoại** (10-11 số) → nhấn **"Bắt đầu"**.

### Bước 3: Xem lịch
- Mặc định hiển thị lịch ngày hôm nay.
- Dùng nút **◀ ▶** để chuyển ngày/tuần.
- Chuyển giữa **Ngày** / **Tuần** bằng nút trên thanh công cụ.

### Bước 4: Đặt phòng
1. Nhấn vào **ô trống** trên timeline (hoặc nhấn nút **+** góc phải dưới).
2. Chọn **Khu vực** để lọc phòng (không bắt buộc).
3. Chọn **Phòng họp**, **Ngày**, **Giờ bắt đầu**, **Giờ kết thúc**.
4. Nhập **Dự án** và **Mục đích** (không bắt buộc).
5. Tick **"Nhu cầu"** nếu cần yêu cầu bổ sung.
6. Tick **"Lặp lại"** nếu họp định kỳ.
7. Nhấn **"Xác nhận đặt phòng"**.

### Bước 5: Sửa / Xóa
- Di chuột vào khung giờ đã đặt → nhấn 🖊️ để sửa, 🗑️ để xóa.

### Bước 6: Đổi tài khoản
- Nhấn **"Đổi tài khoản"** ở góc phải trên để đăng nhập bằng tài khoản khác.

---

## 5. Ưu điểm so với đặt phòng truyền thống

| | Cách cũ (Gọi điện / Nhắn tin) | PTSC-POS Meeting Room App |
|---|---|---|
| **Tốc độ** | Phải gọi/nhắn, chờ phản hồi, có thể mất 5-30 phút | Đặt ngay trong 30 giây, bất kỳ lúc nào |
| **Minh bạch** | Không biết phòng nào trống, phải hỏi từng người | Nhìn ngay toàn bộ lịch trống/bận trên timeline |
| **Tránh trùng lịch** | Hay bị đặt trùng, phát hiện khi đến phòng | Hệ thống tự kiểm tra, không cho đặt trùng |
| **Thông tin liên hệ** | Không biết ai đã đặt để liên hệ đổi lịch | Hiển thị tên + SĐT người đặt, liên hệ ngay |
| **Lặp lại** | Phải đặt từng lần, dễ quên | Đặt 1 lần, tự tạo chuỗi lịch họp định kỳ |
| **Nhu cầu bổ sung** | Phải nhắn riêng cho bộ phận hậu cần | Chọn nhu cầu (trái cây, nước, bánh kẹo...) ngay khi đặt |
| **Lịch sử** | Không có bằng chứng, hay tranh cãi | Mọi thao tác được ghi log đầy đủ |
| **Truy cập** | Chỉ liên hệ được trong giờ hành chính | Truy cập 24/7 trên mọi thiết bị có trình duyệt |
| **Quản lý** | Khó theo dõi tần suất sử dụng phòng | Admin xem log, quản lý tập trung |
| **Đặt hộ** | Phải nhờ người có quyền | Admin có thể đặt hộ cho bất kỳ ai |

---

## 6. Câu hỏi thường gặp

**Q: Quên số điện thoại đã đăng nhập trước đó?**
A: Nhấn "Đổi tài khoản" và đăng nhập lại bằng SĐT đúng.

**Q: Đặt phòng mà bị báo "Khung giờ này đã có người đặt"?**
A: Hệ thống hiển thị tên và SĐT người đã đặt — liên hệ trực tiếp để trao đổi.

**Q: Muốn đặt phòng họp hàng tuần?**
A: Khi đặt phòng, tick "Lặp lại" → chọn "Tuần" → tick các thứ cần họp → chọn ngày kết thúc → Xác nhận.

**Q: Phòng họp không thấy trong danh sách?**
A: Kiểm tra bộ lọc Khu vực (VP1/VP2/Xưởng). Nếu đã tick khu vực mà không thấy → phòng đang ở trạng thái "Tạm ngưng" hoặc "Đang hoán cải".

**Q: Muốn xóa toàn bộ chuỗi lịch họp định kỳ?**
A: Xóa bất kỳ khung giờ nào trong chuỗi → chọn "Xóa toàn bộ chuỗi".

---

*Phiên bản: 1.0 | Cập nhật: 01/04/2026*
*Phát triển bởi: PTSC-POS Team*
