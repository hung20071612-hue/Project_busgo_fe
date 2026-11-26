-- 1. Thống kê tổng số vé đã bán
SELECT COUNT(bd.id) AS total_tickets_sold
FROM booking_details bd
JOIN bookings b ON bd.booking_id = b.id
WHERE b.status = 'paid';


-- 2. Thống kê tổng doanh thu
SELECT COALESCE(SUM(p.amount), 0) AS total_revenue
FROM payments p
JOIN bookings b ON p.booking_id = b.id
WHERE p.status = 'successful'
AND b.status = 'paid';