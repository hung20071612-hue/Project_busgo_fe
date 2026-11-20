
const API_URL = "http://127.0.0.1:8000/api/bookings";

// 1. Lấy danh sách chuyến xe trong ngày
async function loadTrips() {
    try {
        const response = await axios.get(`${API_URL}/staff/today-trips`);

        const tripSelect = document.getElementById("tripSelect");
        tripSelect.innerHTML = '<option value="">-- Chọn chuyến xe --</option>';

        response.data.forEach(trip => {
            const option = document.createElement("option");
            option.value = trip.trip_id;
            option.textContent =
                `${trip.route_code} - ${trip.departure_station} đến ${trip.arrival_station} - ${trip.plate_number}`;

            tripSelect.appendChild(option);
        });
    } catch (error) {
        alert("Không tải được danh sách chuyến xe");
        console.log(error);
    }
}

// 2. Lấy danh sách hành khách theo chuyến
async function loadPassengers() {
    const tripId = document.getElementById("tripSelect").value;

    if (!tripId) {
        alert("Vui lòng chọn chuyến xe");
        return;
    }

    try {
        const response = await axios.get(
            `${API_URL}/staff/trips/${tripId}/passengers`
        );

        const passengerList = document.getElementById("passengerList");
        passengerList.innerHTML = "";

        if (response.data.length === 0) {
            passengerList.innerHTML =
                '<tr><td colspan="7">Chưa có hành khách</td></tr>';
            return;
        }

        response.data.forEach((passenger, index) => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${passenger.booking_code}</td>
                <td>${passenger.passenger_name}</td>
                <td>${passenger.passenger_phone}</td>
                <td>${passenger.seat_code}</td>
                <td>${passenger.is_boarded ? "Đã lên xe" : "Chưa lên xe"}</td>
                <td>
                    ${
                        passenger.is_boarded
                            ? "Đã soát"
                            : `<button onclick="checkIn('${passenger.booking_code}', ${passenger.detail_id})">Soát vé</button>`
                    }
                </td>
            `;

            passengerList.appendChild(row);
        });
    } catch (error) {
        alert("Không tải được danh sách hành khách");
        console.log(error);
    }
}

// 3. Xác nhận hành khách lên xe
async function checkIn(bookingCode, detailId) {
    if (!confirm("Xác nhận hành khách này đã lên xe?")) {
        return;
    }

    try {
        await axios.post(
            `${API_URL}/staff/check-in`,
            null,
            {
                params: {
                    booking_code: bookingCode,
                    detail_id: detailId
                }
            }
        );

        alert("Soát vé thành công");
        loadPassengers();
    } catch (error) {
        alert(error.response?.data?.detail || "Soát vé thất bại");
        console.log(error);
    }
}

// Tự động tải chuyến xe khi mở trang
loadTrips();
