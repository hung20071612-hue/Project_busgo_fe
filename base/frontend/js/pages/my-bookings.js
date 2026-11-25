
let currentStatus = "all";

// Lấy danh sách vé
async function loadBookings() {
    const userId = localStorage.getItem("user_id");
    const bookingList = document.getElementById("booking-list");

    if (!userId) {
        bookingList.innerHTML = "<p>Vui lòng đăng nhập để xem vé.</p>";
        return;
    }

    try {
        const params = {
            user_id: userId
        };

        if (currentStatus !== "all") {
            params.status = currentStatus;
        }

        const bookings = await api.get("/bookings", params);

        if (!bookings || bookings.length === 0) {
            bookingList.innerHTML = "<p>Không có vé nào.</p>";
            return;
        }

        let html = "";

        bookings.forEach(function(booking) {
            let statusText = booking.status;

            if (booking.status === "PENDING_PAYMENT") {
                statusText = "Chờ thanh toán";
            } else if (booking.status === "PAID") {
                statusText = "Đã thanh toán";
            } else if (booking.status === "CANCELLED") {
                statusText = "Đã huỷ";
            }

            html += '<div class="card">';

            html += '<h3>Mã vé: ' +
                escapeHtml(String(booking.booking_code)) +
                '</h3>';

            html += '<p>Trạng thái: ' +
                escapeHtml(String(statusText)) +
                '</p>';

            html += '<p>Tổng tiền: ' +
                formatMoney(booking.total_price) +
                '</p>';

            html += '<a class="btn btn-primary" href="booking-detail.html?id=' +
                encodeURIComponent(booking.booking_id) +
                '">Xem chi tiết</a>';

            html += '</div>';
        });

        bookingList.innerHTML = html;

    } catch (error) {
        bookingList.innerHTML = "<p>Không thể tải danh sách vé.</p>";
        showToast(error.message, "error");
        console.log(error);
    }
}


// Lọc vé theo trạng thái
const statusButtons = document.querySelectorAll("[data-status]");

statusButtons.forEach(function(button) {
    button.addEventListener("click", function() {
        currentStatus = button.dataset.status;
        loadBookings();
    });
});


// Tải danh sách vé khi mở trang
loadBookings();
