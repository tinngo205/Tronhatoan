# CoBuy - Quản lý Đi Chợ & Quyết Toán Chi Phí Nhóm

CoBuy là một Ứng dụng Web (Web Application) quản lý chi tiêu đi chợ, bữa ăn hàng ngày và chốt quyết toán chi phí tối ưu hóa số giao dịch chuyển khoản cho các nhóm sinh hoạt chung (gia đình, phòng trọ, nhóm đi du lịch, homestay,...).

Ứng dụng được thiết kế theo các tiêu chuẩn **Production-Ready**: kiến trúc phân lớp sạch sẽ (**Clean Architecture**), bảo mật nghiêm ngặt (**Row Level Security - RLS**), hỗ trợ cập nhật thời gian thực (**Realtime Updates**), và hoạt động ngoại tuyến (**Offline-First PWA**).

---

## 🚀 Các Tính Năng Nổi Bật

1. **Ghi nhận chi tiêu linh hoạt (`shopping_logs`)**:
   - Phân loại chi tiêu thành **Bữa ăn (MEAL)** (chia theo điểm danh) và **Dùng chung (SHARED)** (chia đều cả nhóm).
   - Ô nhập số tiền (VND) trực quan tự động định dạng `350.000 ₫` khi gõ và lưu số nguyên chính xác.

2. **Điểm danh bữa ăn dạng lịch (Calendar UX)**:
   - Giao diện lịch hàng tháng trực quan trên di động.
   - Drawer slide-up điểm danh Sáng (S) - Trưa (T) - Tối (C) cho các thành viên với touch target rộng >= 44px.

3. **Thuật toán chia tiền & Chốt quyết toán tối ưu**:
   - **Cost Allocation Engine**: Chia tiền ăn theo 2 chế độ: Daily Mode (theo người) hoặc Meal Mode (theo bữa), làm tròn deterministic bằng cách phân phối phần dư 1 VND theo thứ tự bảng chữ cái UUID thành viên.
   - **Greedy Settlement Engine**: Tính toán balance thặng dư/thâm hụt và đề xuất danh sách chuyển khoản tối giản nhất để xóa nợ.
   - Khóa dữ liệu tài chính tự động thông qua Database Triggers khi kỳ quyết toán ở trạng thái `LOCKED`.

4. **Offline-First PWA**:
   - Tự động hoạt động ngoại tuyến. Thay đổi được lưu vào hàng đợi IndexedDB thông qua Dexie.js và tự động đồng bộ lên server khi thiết bị trực tuyến trở lại.

5. **Realtime Updates**:
   - Đồng bộ hóa dữ liệu thời gian thực giữa các thiết bị thành viên sử dụng Supabase Realtime Channels.

6. **Hệ thống lời mời SMTP**:
   - Quản trị viên gửi thư mời tham gia nhóm trực tiếp qua email. Người nhận nhấp vào liên kết để tự động đăng ký tài khoản và gia nhập nhóm.

---

## 🛠️ Hướng Dẫn Cài Đặt Nhanh

### 1. Khởi tạo biến môi trường
Sao chép `.env.example` thành `.env.local` và điền thông tin Supabase URL, API Keys và cấu hình SMTP Mailer của bạn.

### 2. Thiết lập cơ sở dữ liệu
Sao chép mã SQL trong [initial_schema.sql](file:///c:/Users/quang/Downloads/project/newtest/supabase/migrations/20260807000000_initial_schema.sql) và chạy trong phần SQL Editor của trang quản trị Supabase.

### 3. Chạy Unit Tests
Kiểm tra tính chính xác của các thuật toán phân bổ chi phí và quyết toán Greedy:
```bash
npx tsx src/infrastructure/services/__tests__/runner.ts
```

### 4. Khởi động môi trường phát triển
```bash
# Cài đặt thư viện
npm install

# Chạy server phát triển
npm run dev
```
Truy cập [http://localhost:3000](http://localhost:3000) để bắt đầu.

---

## 📚 Tài Liệu Chi Tiết

Mọi tài liệu chi tiết về thiết kế kiến trúc và kỹ thuật của CoBuy được lưu trữ tại thư mục `/docs`:

- 🏛️ [Kiến Trúc Hệ Thống (Clean Architecture)](file:///c:/Users/quang/Downloads/project/newtest/docs/ARCHITECTURE.md)
- 💾 [Thiết Kế Database & Chính Sách RLS](file:///c:/Users/quang/Downloads/project/newtest/docs/DATABASE_AND_SECURITY.md)
- 🧮 [Business Logic & Thuật Toán Chia Tiền](file:///c:/Users/quang/Downloads/project/newtest/docs/BUSINESS_LOGIC.md)
- 🔌 [Offline Caching & Cơ Chế Đồng Bộ PWA](file:///c:/Users/quang/Downloads/project/newtest/docs/OFFLINE_AND_PWA.md)
- 🚢 [Hướng Dẫn Triển Khai & Kiểm Thử](file:///c:/Users/quang/Downloads/project/newtest/docs/DEPLOYMENT_AND_TESTING.md)
