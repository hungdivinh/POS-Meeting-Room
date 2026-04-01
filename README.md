# PTSC-POS Meeting Room App

Ứng dụng đặt phòng họp nội bộ, gồm frontend React/Vite và backend Cloudflare Worker + D1.

## Tổng quan

Dự án hỗ trợ:

- xem lịch phòng họp theo ngày và theo tuần
- đặt phòng nhanh theo khung giờ
- chặn trùng lịch ở cả frontend và backend
- gắn nhu cầu đi kèm booking như trái cây, bánh kẹo, nước suối
- tạo chuỗi lịch lặp lại theo tuần hoặc theo tháng
- quản lý phòng, nhu cầu, quyền admin và nhật ký hoạt động

Production frontend hiện tại: `https://pos-team.io.vn`  
Production API mặc định: `https://dat-phong-api.hungdivinh.workers.dev`

## Kiến trúc

Project được tách thành 2 phần:

- `src/`: frontend React + Vite
- `worker/`: Cloudflare Worker dùng D1 làm database

Luồng dữ liệu chính:

1. Frontend gọi API qua `src/api.ts`
2. Worker xử lý REST API trong `worker/src/index.ts`
3. D1 lưu dữ liệu phòng họp, booking, nhu cầu, admin phones và activity logs

## Chạy nhanh local

1. Cài dependencies ở thư mục gốc:

```bash
npm install
```

2. Cài dependencies cho worker:

```bash
cd worker
npm install
```

3. Migrate database local:

```bash
cd worker
npm run db:migrate:local
```

4. Chạy worker local:

```bash
cd worker
npm run dev
```

5. Tạo file `.env` ở thư mục gốc:

```env
VITE_API_URL=http://localhost:8787
```

6. Chạy frontend:

```bash
npm run dev
```

Frontend local mặc định chạy ở `http://localhost:3000`.

## Tính năng hiện có

### Người dùng

- đăng nhập nhanh bằng tên và số điện thoại, lưu trong `localStorage`
- xem lịch phòng ở chế độ ngày hoặc tuần
- đặt phòng theo phòng, ngày, khung giờ, dự án, mục đích
- chọn nhiều nhu cầu bổ sung cho từng booking
- tạo booking lặp lại theo tuần hoặc theo tháng
- chỉnh sửa hoặc xóa booking nếu là người đặt

### Admin

- thêm, sửa, xóa phòng họp
- thêm, sửa, xóa nhu cầu
- thêm, xóa số điện thoại được cấp quyền admin
- đặt hộ cho người khác
- chọn màu hiển thị riêng cho booking
- xem nhật ký hoạt động
- xóa một lịch hoặc cả chuỗi lịch lặp lại

## Cấu trúc thư mục

```text
.
|-- src/
|   |-- App.tsx
|   |-- api.ts
|   |-- ErrorBoundary.tsx
|   `-- main.tsx
|-- worker/
|   |-- src/index.ts
|   |-- schema.sql
|   `-- wrangler.toml
|-- HUONG_DAN_SU_DUNG.md
`-- package.json
```

## Công nghệ

- React 19
- Vite
- TypeScript
- date-fns
- Radix UI
- Cloudflare Workers
- Cloudflare D1

## API hiện có

Frontend hiện dùng các route sau:

- `GET /api/rooms`, `POST /api/rooms`, `PUT /api/rooms/:id`, `DELETE /api/rooms/:id`
- `GET /api/needs`, `POST /api/needs`, `PUT /api/needs/:id`, `DELETE /api/needs/:id`
- `GET /api/bookings`, `POST /api/bookings`, `PUT /api/bookings/:id`, `DELETE /api/bookings/:id`
- `DELETE /api/bookings/:id?deleteGroup=true`
- `GET /api/logs`, `POST /api/logs`
- `GET /api/admin-phones`, `POST /api/admin-phones`, `DELETE /api/admin-phones/:phone`

## Database schema

Schema D1 hiện tại nằm ở `worker/schema.sql` và phản ánh contract Worker đang dùng cho:

- `rooms`
- `bookings`
- `needs`
- `admin_phones`
- `activity_logs`

## Build và kiểm tra

Frontend:

```bash
npm run build
npm run lint
```

Worker:

```bash
cd worker
npm run deploy
```

## Khởi tạo database mới

Nếu cần tạo D1 mới trên Cloudflare:

```bash
cd worker
npm run db:create
```

Sau khi tạo xong, cập nhật `database_id` trong `worker/wrangler.toml`, rồi migrate:

```bash
cd worker
npm run db:migrate
```

## Ghi chú vận hành

- Frontend đang poll bookings mỗi 30 giây để cập nhật gần realtime.
- Nếu không cấu hình `.env`, frontend sẽ dùng production API mặc định.
- Backend trả JSON và CORS headers cho tất cả route.
- Tài liệu hướng dẫn người dùng chi tiết nằm trong `HUONG_DAN_SU_DUNG.md`.

## Tài liệu liên quan

- `HUONG_DAN_SU_DUNG.md`: hướng dẫn sử dụng theo nghiệp vụ
- `worker/schema.sql`: schema D1
- `worker/src/index.ts`: REST API Worker
- `src/App.tsx`: giao diện và nghiệp vụ frontend
