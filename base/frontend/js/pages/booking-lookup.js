
const lookupForm = document.getElementById("lookup-form");

lookupForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const bookingId = document.getElementById("booking-id").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const resultBox = document.getElementById("lookup-result");

    if (!bookingId || !phone) {
        resultBox.textContent = "Vui lòng nhập đầy đủ thông tin.";
        return;
    }

    resultBox.textContent = "Đang tìm kiếm vé...";

    try {
        const result = await api.get("/bookings/lookup", {
            booking_id: bookingId,
            phone: phone
        });

        const booking = result.booking;
        const details = result.details;

        let statusText = booking.status;

        if (booking.status === "PENDING_PAYMENT") {
            statusText = "Chờ thanh toán";
        } else if (booking.status === "PAID") {
            statusText = "Đã thanh toán";
        } else if (booking.status === "CANCELLED") {
            statusText = "Đã huỷ";
        }

        let html = `
            <div class="card">
                <h3>Thông tin vé</h3>
                <p>Mã vé: ${escapeHtml(String(booking.booking_code || booking.booking_id))}</p>
                <p>Trạng thái: ${escapeHtml(String(statusText))}</p>
                <p>Tổng tiền: ${formatMoney(booking.total_price)}</p>
            </div>
        `;

        if (details && details.length > 0) {
            html += "<h3>Thông tin hành khách</h3>";

            details.forEach(function(item) {
                html += `
                    <div class="card">
                        <p>Họ tên: ${escapeHtml(String(item.passenger_name || ""))}</p>
                        <p>Số điện thoại: ${escapeHtml(String(item.passenger_phone || ""))}</p>
                        <p>Mã chuyến: ${escapeHtml(String(item.trip_id))}</p>
                        <p>Mã ghế: ${escapeHtml(String(item.seat_id))}</p>
                        <p>Điểm đón: ${escapeHtml(String(item.pickup || ""))}</p>
                        <p>Điểm trả: ${escapeHtml(String(item.dropoff || ""))}</p>
                    </div>
                `;
            });
        }

        resultBox.innerHTML = html;

    } catch (error) {
        resultBox.textContent = error.message || "Không tìm thấy vé.";
    }
});
