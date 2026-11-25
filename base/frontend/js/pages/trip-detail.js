const detailStatus = document.getElementById("detail-status");
const detailContent = document.getElementById("trip-detail-content");
const detailError = document.getElementById("detail-error");
const detailErrorMessage = document.getElementById("detail-error-message");
const detailId = new URLSearchParams(window.location.search).get("id");

function formatTripDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "—", time: "—" };
  return {
    date: date.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }),
    time: date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
  };
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "—";
}

function renderTripDetail(trip) {
  const departure = formatTripDate(trip.departure_at);
  const arrival = formatTripDate(trip.arrival_at);
  const durationMinutes = Math.max(0, Math.round((new Date(trip.arrival_at) - new Date(trip.departure_at)) / 60000));
  const duration = `${Math.floor(durationMinutes / 60)} giờ ${durationMinutes % 60} phút`;

  setText("detail-operator", `${trip.origin} → ${trip.destination}`);
  setText("detail-driver", trip.driver_name ? `Tài xế phụ trách: ${trip.driver_name}` : "Nhà xe BusGo Express");
  setText("detail-distance", trip.distance_km ? `${trip.distance_km} km` : "Tuyến liên tỉnh");
  setText("detail-duration", duration);
  setText("timeline-duration", duration);
  setText("detail-seats", `${trip.available_seats ?? 0} ghế`);
  setText("detail-bus", `${trip.plate_number || "—"} (${trip.bus_type_name || "Xe khách"})`);
  setText("detail-departure-time", departure.time);
  setText("detail-arrival-time", arrival.time);
  setText("detail-origin", trip.origin_station || trip.origin);
  setText("detail-destination", trip.dest_station || trip.destination);
  if (trip.origin_address) setText("detail-origin-addr", trip.origin_address);
  if (trip.dest_address) setText("detail-dest-addr", trip.dest_address);

  setText("fare-origin", trip.origin_station || trip.origin);
  setText("fare-destination", trip.dest_station || trip.destination);
  setText("detail-date", departure.date);
  setText("fare-time", `${departure.time} – ${arrival.time}`);
  setText("fare-bus", trip.plate_number || "—");
  setText("detail-price", formatMoney(trip.ticket_price));

  document.getElementById("choose-seats").href = `seat-selection.html?trip_id=${encodeURIComponent(trip.id)}`;

  detailStatus.hidden = true;
  detailContent.hidden = false;
}

async function loadTripDetail() {
  if (!detailId || !/^\d+$/.test(detailId)) {
    throw new Error("Mã chuyến xe không hợp lệ.");
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

  renderTripDetail(trip);
}

loadTripDetail().catch((error) => {
  detailStatus.hidden = true;
  detailError.hidden = false;
  detailErrorMessage.textContent = error.message || "Không thể tải thông tin chuyến xe.";
});