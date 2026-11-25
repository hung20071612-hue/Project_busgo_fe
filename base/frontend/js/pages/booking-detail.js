
const params = new URLSearchParams(window.location.search);
const bookingId = params.get("id");

let currentBooking = null;
let currentTrip = null;

// Tải chi tiết vé
async function loadBookingDetail() {
    const bookingInfo = document.getElementById("booking-info");
    const bookingDetails = document.getElementById("booking-details");
    const cancelButton = document.getElementById("btn-cancel-booking");

    if (!bookingId) {
        bookingInfo.textContent = "Không tìm thấy mã vé.";
        return;
    }

    try {
        const result = await api.get("/bookings/" + bookingId);
        const booking = result.booking;
        const details = result.details;

        currentBooking = booking;

        bookingInfo.innerHTML = `
            <p>Mã vé: ${escapeHtml(String(booking.booking_code))}</p>
            <p>Trạng thái: ${escapeHtml(String(booking.status))}</p>
            <p>Tổng tiền: ${formatMoney(booking.total_price)}</p>
            <p>Tiền hoàn: ${formatMoney(booking.refund_amount)}</p>
            <p>Ngày đặt: ${escapeHtml(String(booking.created_at || ""))}</p>
        `;

        if (!details || details.length === 0) {
            bookingDetails.textContent = "Không có thông tin hành khách.";
            return;
        }

        let html = "";

        for (const item of details) {
            html += `
                <div class="card">
                    <p>Họ tên: ${escapeHtml(String(item.passenger_name || ""))}</p>
                    <p>Số điện thoại: ${escapeHtml(String(item.passenger_phone || ""))}</p>
                    <p>Mã ghế: ${escapeHtml(String(item.seat_id))}</p>
                    <p>Điểm đón: ${escapeHtml(String(item.pickup || ""))}</p>
                    <p>Điểm trả: ${escapeHtml(String(item.dropoff || ""))}</p>
                </div>
            `;
        }

        currentTrip = await api.get("/trips/" + booking.trip_id);

        html += `
            <div class="card">
                <h3>Thông tin chuyến xe</h3>
                <p>Mã chuyến: ${escapeHtml(String(currentTrip.id))}</p>
                <p>Khởi hành: ${escapeHtml(String(currentTrip.departure_at))}</p>
                <p>Giờ đến: ${escapeHtml(String(currentTrip.arrival_at))}</p>
                <p>Giá vé: ${formatMoney(currentTrip.ticket_price)}</p>
                <p>Trạng thái chuyến: ${escapeHtml(String(currentTrip.status))}</p>
            </div>
        `;

        bookingDetails.innerHTML = html;

        // Chỉ hiện nút huỷ khi vé đã thanh toán
        if (String(booking.status).toUpperCase() === "PAID") {
            cancelButton.hidden = false;
        }

    } catch (error) {
        bookingInfo.textContent = "Không thể tải thông tin vé: " + error.message;
    }
}


// Huỷ vé
async function cancelBooking() {
    if (!currentBooking || !currentTrip) {
        alert("Chưa tải được thông tin vé.");
        return;
    }

    const departureTime = new Date(currentTrip.departure_at);
    const now = new Date();

    if (departureTime <= now) {
        alert("Chuyến xe đã khởi hành, không thể huỷ vé.");
        return;
    }

    // Tính thời gian còn lại trước giờ khởi hành
    const remainingTime = departureTime - now;
    const totalPrice = Number(currentBooking.total_price);

    // Còn từ 24 giờ trở lên: hoàn 100%
    // Còn dưới 24 giờ: không hoàn tiền
    let refundAmount = 0;

    if (remainingTime >= 24 * 60 * 60 * 1000) {
        refundAmount = totalPrice;
    }

    // Hiển thị tiền hoàn trước khi xác nhận
    const message = 
        "Bạn có chắc muốn huỷ vé không?\n\n" +
        "Tổng tiền vé: " + formatMoney(totalPrice) + "\n" +
        "Số tiền được hoàn: " + formatMoney(refundAmount);

    if (!confirm(message)) {
        return;
    }

    try {
        const userId = localStorage.getItem("user_id");

        if (!userId) {
            alert("Không tìm thấy thông tin người dùng.");
            return;
        }

        const result = await api.post(
            "/bookings/" + bookingId + "/cancel?user_id=" +
            encodeURIComponent(userId),
            {}
        );

        alert(result.message || "Huỷ vé thành công.");

        loadBookingDetail();

    } catch (error) {
        alert("Không thể huỷ vé: " + error.message);
        console.log(error);
    }
}


// Gắn sự kiện cho nút huỷ vé
document.getElementById("btn-cancel-booking")
    .addEventListener("click", cancelBooking);

// Tải thông tin vé
loadBookingDetail();
