# PTSC-POS Meeting Room App
## Hướng dẫn sử dụng và thuyết minh sáng kiến cải tiến

**Link truy cập:** [https://pos-team.io.vn](https://pos-team.io.vn)

## Lời mở đầu theo tinh thần Kaizen

Trong vận hành nội bộ, một bất tiện nhỏ lặp đi lặp lại mỗi ngày sẽ dần trở thành một lãng phí lớn. Việc đặt phòng họp bằng gọi điện, nhắn tin hoặc hỏi trực tiếp tưởng như đơn giản, nhưng thực tế lại làm mất thời gian, dễ trùng lịch, khó theo dõi trách nhiệm và khó kiểm soát nhu cầu phục vụ đi kèm.

PTSC-POS Meeting Room App được xây dựng như một sáng kiến cải tiến theo tinh thần **Kaizen**: không thay đổi quy trình bằng những điều quá phức tạp, mà cải tiến đúng điểm nghẽn để công việc hằng ngày diễn ra nhanh hơn, rõ hơn và ít sai sót hơn. Chỉ với một giao diện dùng trên trình duyệt, hệ thống giúp mọi người biết ngay phòng nào còn trống, ai đã đặt, khung giờ nào phù hợp và các yêu cầu hậu cần cần chuẩn bị là gì.

Giá trị lớn nhất của sáng kiến này không nằm ở công nghệ, mà nằm ở hiệu quả vận hành:

- giảm thời gian trao đổi qua điện thoại và tin nhắn
- tránh trùng lịch ngay từ lúc tạo booking
- minh bạch người đặt, thời gian đặt và lịch sử thay đổi
- hỗ trợ quản lý tập trung cho admin nhưng vẫn thuận tiện cho toàn bộ nhân viên
- tạo thói quen làm việc chuẩn hóa, nhanh và có dữ liệu để theo dõi

Nói ngắn gọn, đây là một cải tiến nhỏ ở thao tác, nhưng tạo ra thay đổi lớn ở tính chủ động, tính minh bạch và chất lượng phối hợp nội bộ.

## 1. Bài toán trước cải tiến

Trước khi có hệ thống, việc đặt phòng họp thường gặp các vấn đề:

- phải gọi điện hoặc nhắn tin để hỏi phòng còn trống hay không
- nhiều đầu mối cùng nhận yêu cầu nên khó kiểm soát
- dễ phát sinh trùng lịch khi nhiều người cùng liên hệ
- người sau khó biết ai đã đặt để trao đổi đổi giờ
- các nhu cầu như trái cây, nước suối, bánh kẹo thường bị báo rời rạc
- không có nhật ký thao tác rõ ràng để tra cứu khi cần

## 2. Mục tiêu cải tiến

Hệ thống được thiết kế để đạt 5 mục tiêu chính:

1. Số hóa toàn bộ thao tác đặt phòng trên một nền tảng thống nhất.
2. Giúp người dùng tự tra cứu và tự đặt mà không cần chờ trung gian.
3. Chặn trùng lịch ngay trong quá trình tạo hoặc chỉnh sửa booking.
4. Hỗ trợ quản lý hậu cần và nhu cầu đi kèm ngay tại thời điểm đặt phòng.
5. Tạo dữ liệu lịch sử để phục vụ kiểm tra, đối soát và cải tiến tiếp theo.

## 3. Hiệu quả mang lại

So với cách làm truyền thống, hệ thống mang lại các cải thiện rõ rệt:

| Tiêu chí | Cách cũ | Sau cải tiến |
|---|---|---|
| Tốc độ đặt phòng | Phụ thuộc người nhận điện thoại/tin nhắn | Người dùng tự đặt trong vài thao tác |
| Minh bạch lịch | Phải hỏi từng người | Xem trực tiếp trên lịch ngày hoặc tuần |
| Tránh trùng lịch | Dễ trùng khi nhiều người cùng đặt | Hệ thống tự kiểm tra và chặn trùng |
| Tra cứu người đặt | Khó tìm đầu mối liên hệ | Hiển thị ngay tên và số điện thoại |
| Nhu cầu phục vụ | Báo riêng lẻ, dễ sót | Gắn trực tiếp trong booking |
| Theo dõi lịch sử | Gần như không có | Có log thao tác cho admin |
| Quản lý tập trung | Phân tán, khó kiểm soát | Admin quản lý trên một màn hình |

## 4. Đối tượng sử dụng

Hệ thống có 2 nhóm người dùng:

- **Người dùng thông thường**: xem lịch, đặt phòng, sửa hoặc xóa booking của chính mình.
- **Admin**: quản lý phòng họp, nhu cầu, cấp quyền admin, xem log và đặt hộ cho người khác.

## 5. Hướng dẫn sử dụng nhanh

### Bước 1. Truy cập hệ thống

Mở trình duyệt Chrome, Edge, Safari hoặc trình duyệt bất kỳ và vào:

**[https://pos-team.io.vn](https://pos-team.io.vn)**

### Bước 2. Đăng nhập nhanh

Người dùng chỉ cần nhập:

- họ tên
- số điện thoại từ 10 đến 11 số

Sau đó nhấn **Bắt đầu** để vào hệ thống.

Điểm thuận tiện:

- không cần tạo tài khoản
- không cần nhớ mật khẩu
- thông tin được lưu trên trình duyệt để dùng lại cho lần sau

### Bước 3. Xem lịch phòng họp

Hệ thống có 2 chế độ xem:

- **Ngày**: phù hợp khi cần xem chi tiết từng phòng theo khung giờ
- **Tuần**: phù hợp khi cần nhìn tổng quan kế hoạch sử dụng phòng trong tuần

Người dùng có thể:

- chuyển ngày hoặc tuần bằng nút mũi tên
- chọn ngày trực tiếp
- nhấn **Hôm nay** để quay về ngày hiện tại

### Bước 4. Đặt phòng họp

Người dùng có thể tạo booking bằng cách:

- nhấn vào ô trống trên lịch
- hoặc nhấn nút **+** trên giao diện mobile

Các thông tin cần nhập:

- phòng họp
- ngày họp
- giờ bắt đầu
- giờ kết thúc
- dự án
- mục đích hoặc ghi chú

Ngay khi lưu, hệ thống sẽ tự kiểm tra trùng lịch. Nếu khung giờ đã có người đặt, hệ thống sẽ từ chối và thông báo để người dùng chọn thời gian khác.

### Bước 5. Chọn nhu cầu đi kèm

Nếu cuộc họp cần phục vụ hậu cần, người dùng có thể bật mục **Nhu cầu** và chọn một hoặc nhiều nhu cầu như:

- trái cây
- nước suối
- bánh kẹo
- hoặc các nhu cầu khác do admin cấu hình

Điểm hay của cải tiến này là nhu cầu không còn bị thông báo rời rạc qua tin nhắn, mà được gắn trực tiếp với booking.

### Bước 6. Tạo lịch lặp lại

Với các cuộc họp định kỳ, người dùng có thể bật tùy chọn **Lặp lại** và chọn:

- lặp theo tuần
- hoặc lặp theo tháng

Người dùng chỉ cần chọn ngày kết thúc, hệ thống sẽ tự tạo chuỗi lịch phù hợp. Khi xóa, hệ thống hỗ trợ chọn:

- xóa riêng một lịch
- hoặc xóa toàn bộ chuỗi

### Bước 7. Sửa hoặc xóa booking

Người đặt phòng có thể sửa hoặc xóa booking của mình. Admin có thể thao tác trên toàn bộ booking khi cần xử lý điều phối.

Các thao tác này được kiểm soát để:

- tránh sửa nhầm lịch của người khác
- đảm bảo lịch sử thay đổi được ghi nhận

### Bước 8. Đổi tài khoản

Nếu cần dùng tài khoản khác trên cùng thiết bị, người dùng chỉ cần nhấn **Đổi tài khoản** ở góc phải màn hình.

## 6. Chức năng dành cho admin

Admin có thêm các nhóm chức năng sau:

### 6.1. Quản lý phòng họp

Admin có thể:

- thêm phòng mới
- cập nhật tên phòng, vị trí, tòa nhà, tầng, sức chứa
- thay đổi trạng thái phòng
- xóa phòng không còn sử dụng

Việc chuẩn hóa danh mục phòng giúp toàn bộ người dùng nhìn cùng một dữ liệu, tránh hiểu sai tên hoặc vị trí phòng.

### 6.2. Quản lý nhu cầu

Admin có thể thêm, sửa, xóa các nhu cầu phục vụ đi kèm và gán màu hiển thị cho từng nhu cầu. Điều này giúp lịch họp không chỉ cho biết có cuộc họp, mà còn cho biết cuộc họp đó cần chuẩn bị gì.

### 6.3. Cấp quyền admin

Admin có thể thêm hoặc thu hồi quyền admin theo số điện thoại. Cách làm này giúp mở rộng phân quyền linh hoạt mà không cần tạo cơ chế tài khoản phức tạp.

### 6.4. Xem nhật ký hoạt động

Module log cho phép admin tra cứu:

- ai đăng nhập
- ai tạo, sửa, xóa booking
- ai thay đổi phòng, nhu cầu hoặc quyền admin

Đây là nền tảng quan trọng để kiểm tra, đối soát và tiếp tục cải tiến quy trình sau này.

### 6.5. Đặt hộ cho người khác

Trong các trường hợp cần điều phối tập trung, admin có thể thay đổi tên và số điện thoại người đặt ngay trong form booking để tạo lịch hộ cho nhân sự khác.

## 7. Nguyên tắc sử dụng hiệu quả

Để sáng kiến phát huy đúng giá trị, người dùng nên thống nhất một số nguyên tắc:

- luôn đặt phòng trực tiếp trên hệ thống thay vì nhắn riêng
- nhập đúng họ tên và số điện thoại để thuận tiện liên hệ
- cập nhật hoặc xóa ngay khi kế hoạch thay đổi
- gắn nhu cầu đi kèm ngay từ đầu để bộ phận liên quan chủ động chuẩn bị
- ưu tiên kiểm tra lịch tuần khi lên kế hoạch họp định kỳ

## 8. Câu hỏi thường gặp

**1. Tôi bị báo trùng lịch thì phải làm gì?**  
Hệ thống sẽ không cho lưu nếu khung giờ đã bị trùng. Người dùng cần chọn giờ khác hoặc liên hệ người đã đặt để thống nhất lại.

**2. Tôi có cần tạo tài khoản không?**  
Không. Hệ thống dùng họ tên và số điện thoại để đăng nhập nhanh.

**3. Tôi có thể đặt phòng lặp hằng tuần không?**  
Có. Chỉ cần bật mục **Lặp lại**, chọn kiểu lặp và ngày kết thúc.

**4. Tôi có thể xem ai đã đặt phòng không?**  
Có. Lịch hiển thị tên và số điện thoại để thuận tiện trao đổi.

**5. Nếu thay đổi kế hoạch họp thì sao?**  
Người đặt có thể sửa hoặc xóa booking của mình. Admin có thể hỗ trợ xử lý khi cần.

## 9. Kết luận

PTSC-POS Meeting Room App không chỉ là một công cụ đặt phòng, mà là một sáng kiến cải tiến quy trình làm việc nội bộ theo đúng tinh thần Kaizen:

- cải tiến từ vấn đề nhỏ nhưng xảy ra mỗi ngày
- chuẩn hóa thao tác để giảm lãng phí thời gian
- tăng tính minh bạch và trách nhiệm
- tạo nền tảng dữ liệu cho các cải tiến tiếp theo

Nếu được sử dụng thống nhất, hệ thống sẽ giúp việc tổ chức họp trở nên nhanh hơn, rõ ràng hơn và chuyên nghiệp hơn cho toàn bộ đơn vị.

---

*Phiên bản tài liệu: 2.0*  
*Cập nhật: 02/04/2026*  
*Phát triển bởi: PTSC-POS Team*
