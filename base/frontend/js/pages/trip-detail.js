const detailStatus = document.getElementById("detail-status");
const detailContent = document.getElementById("trip-detail-content");
const detailError = document.getElementById("detail-error");
const detailErrorMessage = document.getElementById("detail-error-message");
const detailParams = new URLSearchParams(window.location.search);
const detailId = detailParams.get("id");

function detailDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return {
    date: date.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    time: date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
  };
}

function setDetailText(id, value) {
  document.getElementById(id).textContent = value ?? "—";
}

function renderTripDetail(trip) {
  const departure = detailDateTime(trip.departure_at);
  const arrival = detailDateTime(trip.arrival_at);
  const durationMinutes = Math.max(0, Math.round((new Date(trip.arrival_at) - new Date(trip.departure_at)) / 60000));
  const duration = `${Math.floor(durationMinutes / 60)} giờ ${durationMinutes % 60} phút`;
  const route = `${trip.origin || `Tuyến ${trip.route_id}`} → ${trip.destination || ""}`;
  const bus = trip.plate_number || `Xe ${trip.bus_id}`;

  setDetailText("detail-operator", trip.driver_name ? `Nhà xe BusGo · ${trip.driver_name}` : "Chuyến xe BusGo");
  setDetailText("detail-driver", trip.driver_name ? `Tài xế ${trip.driver_name}` : "Thông tin chuyến xe");
  setDetailText("detail-distance", route);
  setDetailText("detail-duration", duration);
  setDetailText("timeline-duration", duration);
  setDetailText("detail-seats", `${trip.available_seats ?? "—"} ghế`);
  setDetailText("detail-bus", bus);
  setDetailText("detail-departure-time", departure.time);
  setDetailText("detail-arrival-time", arrival.time);
  setDetailText("detail-origin", trip.origin || `Tuyến ${trip.route_id}`);
  setDetailText("detail-destination", trip.destination || "Điểm đến");
  setDetailText("fare-origin", trip.origin || `Tuyến ${trip.route_id}`);
  setDetailText("fare-destination", trip.destination || "Điểm đến");
  setDetailText("detail-date", departure.date);
  setDetailText("fare-time", `${departure.time} – ${arrival.time}`);
  setDetailText("fare-bus", bus);
  setDetailText("detail-price", formatMoney(trip.ticket_price));
  detailStatus.hidden = true;
  detailContent.hidden = false;
}

async function loadTripDetail() {
  if (!detailId || !/^\d+$/.test(detailId)) {
    throw new Error("Đường dẫn chuyến xe không hợp lệ.");
  }
  const saved = sessionStorage.getItem(`busgo-trip-${detailId}`);
  let trip = saved ? JSON.parse(saved) : null;
  try {
    const fullDetails = await api.get(`/trips/${encodeURIComponent(detailId)}/details`);
    trip = { ...trip, ...fullDetails };
    sessionStorage.setItem(`busgo-trip-${detailId}`, JSON.stringify(trip));
  } catch (error) {
    if (!trip) throw error;
  }
  if (!trip?.departure_at || !trip?.arrival_at) throw new Error("Dữ liệu chuyến xe chưa đầy đủ.");
  renderTripDetail(trip);
}

document.getElementById("choose-seats").addEventListener("click", () => {
  document.getElementById("seat-info-dialog").showModal();
});
document.getElementById("seat-dialog-ok").addEventListener("click", () => {
  document.getElementById("seat-info-dialog").close();
});

loadTripDetail().catch((error) => {
  detailStatus.hidden = true;
  detailError.hidden = false;
  detailErrorMessage.textContent = error.message || "Hãy quay lại danh sách để chọn một chuyến phù hợp.";
});
