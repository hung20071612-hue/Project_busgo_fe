-- Mo hinh tuyen xe, xe, tai xe, chuyen va dat cho cho BusGo.
-- Chay sau init.sql trong MySQL 8. DDL co the chay lai an toan.

USE app_db;

CREATE TABLE IF NOT EXISTS routes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  origin        VARCHAR(120) NOT NULL,
  destination   VARCHAR(120) NOT NULL,
  distance_km   DECIMAL(8, 2) NULL,
  INDEX idx_routes_search (origin, destination)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS buses (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  license_plate VARCHAR(20) NOT NULL UNIQUE,
  seat_count    SMALLINT UNSIGNED NOT NULL,
  CHECK (seat_count > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS drivers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(150) NOT NULL,
  phone         VARCHAR(20) NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trips (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  route_id      INT NOT NULL,
  bus_id        INT NOT NULL,
  driver_id     INT NOT NULL,
  departure_at  DATETIME NOT NULL,
  arrival_at    DATETIME NOT NULL,
  ticket_price  DECIMAL(12, 2) NOT NULL,
  status        ENUM('SCHEDULED', 'DEPARTED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_trips_route FOREIGN KEY (route_id) REFERENCES routes(id),
  CONSTRAINT fk_trips_bus FOREIGN KEY (bus_id) REFERENCES buses(id),
  CONSTRAINT fk_trips_driver FOREIGN KEY (driver_id) REFERENCES drivers(id),
  CONSTRAINT chk_trips_times CHECK (arrival_at > departure_at),
  CONSTRAINT chk_trips_price CHECK (ticket_price >= 0),
  INDEX idx_trips_departure_status (departure_at, status),
  INDEX idx_trips_route_departure (route_id, departure_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  trip_id       BIGINT NOT NULL,
  seat_count    SMALLINT UNSIGNED NOT NULL,
  status        ENUM('CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_trip FOREIGN KEY (trip_id) REFERENCES trips(id),
  CONSTRAINT chk_bookings_seats CHECK (seat_count > 0),
  INDEX idx_bookings_trip_status (trip_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tim chuyen theo diem di/den va ngay (dung khoang [00:00, ngay tiep theo)),
-- dong thoi tinh ghe con trong xe; dat da huy khong bi tru.
-- Thay cac gia tri @... bang tham so tu API/client.
SET @origin = 'Ha Noi';
SET @destination = 'Hai Phong';
SET @travel_date = '2026-11-11';

SELECT
  t.id AS trip_id,
  r.origin,
  r.destination,
  b.license_plate,
  d.full_name AS driver_name,
  t.departure_at,
  t.arrival_at,
  t.ticket_price,
  t.status,
  b.seat_count - COALESCE(SUM(CASE WHEN bk.status = 'CONFIRMED' THEN bk.seat_count ELSE 0 END), 0) AS available_seats
FROM trips AS t
JOIN routes AS r ON r.id = t.route_id
JOIN buses AS b ON b.id = t.bus_id
JOIN drivers AS d ON d.id = t.driver_id
LEFT JOIN bookings AS bk ON bk.trip_id = t.id
WHERE r.origin = @origin
  AND r.destination = @destination
  AND t.departure_at >= CAST(@travel_date AS DATE)
  AND t.departure_at < DATE_ADD(CAST(@travel_date AS DATE), INTERVAL 1 DAY)
  AND t.status = 'SCHEDULED'
GROUP BY t.id, r.origin, r.destination, b.license_plate, d.full_name,
         t.departure_at, t.arrival_at, t.ticket_price, t.status, b.seat_count
HAVING available_seats > 0
ORDER BY t.departure_at;
