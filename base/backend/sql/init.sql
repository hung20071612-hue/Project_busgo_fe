-- Tạo database app_db + bảng items + dữ liệu mẫu.
-- Cách chạy bằng MySQL Workbench:
--   File > Open SQL Script... > chọn file này > bấm nút tia sét (Execute) > Refresh ô SCHEMAS.
-- Chạy lại nhiều lần không lỗi (đã có thì bỏ qua), chỉ là dữ liệu mẫu sẽ bị thêm lặp.

SET NAMES utf8mb4; -- để tiếng Việt không bị lỗi font

CREATE DATABASE IF NOT EXISTS app_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE app_db;

INSERT INTO users (full_name, email, phone, password_hash, role, status) VALUES
('Quản trị viên', 'admin@busgo.vn',    '0900000021', '$2b$12$3KuY4COIiolL.0jsSo9yF.q/66bXHYszUIv7b9HDGW9JfJBSIvfM2', 'admin',    'active'),
('Nhân viên',     'staff@busgo.vn',    '0900000002', '$2b$12$cakQnf2ibmHfj6BO487zyOoxFet4TsTn0cNlRTPD9QbWQCetn0Ou6', 'staff',    'active'),
('Khách hàng',    'customer@busgo.vn', '0900000003', '$2b$12$vvCw.Sh23uN6drxB9jxYQOoyy5F7FtY85NetOmGNqRJsmgulXGmdW', 'user', 'active');

