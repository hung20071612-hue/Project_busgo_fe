SET NAMES utf8mb4;
USE app_db;

-- ====================== SEED DATA ======================

INSERT INTO stations (name, city, address, phone) VALUES
('Bến xe Mỹ Đình', 'Hà Nội', '20 Phạm Hùng, Nam Từ Liêm', '02437680000'),
('Bến xe Giáp Bát', 'Hà Nội', 'Giải Phóng, Hoàng Mai', '02438650000'),
('Bến xe Nước Ngầm', 'Hà Nội', 'Ngọc Hồi, Hoàng Mai', '02438660000'),
('Bến xe Hải Phòng', 'Hải Phòng', 'Tam Bạc, Hồng Bàng', '02253850000'),
('Bến xe Ninh Bình', 'Ninh Bình', 'Đường Trần Nhân Tông', '02293860000');

INSERT INTO routes (code, departure_id, arrival_id, distance_km, estimated_time, base_price) VALUES
('HN-HP-01', 1, 4, 120.00, 150, 150000),
('HN-HP-02', 2, 4, 105.00, 140, 140000),
('HN-NB-01', 1, 5, 95.00, 120, 120000),
('HN-NB-02', 3, 5, 90.00, 115, 115000),
('HP-HN-01', 4, 1, 120.00, 150, 150000),
('HP-HN-02', 4, 2, 105.00, 140, 140000),
('NB-HN-01', 5, 1, 95.00, 120, 120000),
('NB-HN-02', 5, 3, 90.00, 115, 115000);

INSERT INTO bus_types (name, floors, rows_per_floor, cols_per_floor, seat_type, total_seats, description) VALUES
('Giường nằm 40 chỗ', 2, 10, 2, 'berth', 40, 'Xe giường nằm 2 tầng'),
('Ghế ngồi 45 chỗ', 1, 15, 3, 'seat',  45, 'Xe ghế ngồi 1 tầng');

INSERT INTO buses (plate_number, bus_type_id, status, note) VALUES
('29B-12345', 1, 'active', 'Xe giường nằm chính'),
('29B-12346', 1, 'active', NULL),
('29B-54321', 2, 'active', 'Xe ghế ngồi'),
('29B-54322', 2, 'active', NULL),
('15B-11111', 1, 'active', 'Xe tuyến Hải Phòng'),
('15B-22222', 2, 'maintenance', 'Đang bảo dưỡng');

INSERT INTO drivers (full_name, phone, license_no, license_class, status, hired_date) VALUES
('Nguyễn Văn Thi','0912345678', 'B2-123456', 'D', 'active', '2022-03-15'),
('Nguyễn Tuấn Hưng','0912345679', 'B2-123457', 'D', 'active', '2021-07-20'),
('Nguyễn Trường Vũ','0912345680', 'B2-123458', 'D', 'active', '2023-01-10'),
('Đặng Viết Hoàng Anh','0912345681', 'B2-123459', 'E', 'active', '2020-11-05'),
('Hoàng Văn Em','0912345682', 'B2-123460', 'D', 'on_leave', '2022-09-01');