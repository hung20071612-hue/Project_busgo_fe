const adminForm = document.getElementById("admin-trip-form");
const adminMessage = document.getElementById("admin-page-message");
const adminFeedback = document.getElementById("admin-form-feedback");
const conflictAlert = document.getElementById("conflict-alert");
const conflictMessage = document.getElementById("conflict-message");
const adminSubmit = document.getElementById("admin-submit");
const tripList = document.getElementById("admin-trip-list");
const tripListStatus = document.getElementById("trip-list-status");
const routeSelect = document.getElementById("admin-route");
const busSelect = document.getElementById("admin-bus");
const driverSelect = document.getElementById("admin-driver");
const departureInput = document.getElementById("admin-departure");
const arrivalInput = document.getElementById("admin-arrival");
const optionsByRoute = new Map();
let routes = [];
let buses = [];
let drivers = [];
let scheduledTrips = [];

function adminLocalIsoDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function routeName(routeId) {
  const route = optionsByRoute.get(Number(routeId));
  return route ? `${route.origin} → ${route.destination}` : `Tuyến ${routeId}`;
}

function setAdminFeedback(message) {
  adminFeedback.textContent = message;
  adminFeedback.hidden = !message;
}

function fillSelect(select, items, label, makeLabel) {
  select.replaceChildren(new Option(`Chọn ${label}`, ""));
  items.forEach((item) => select.add(new Option(makeLabel(item), item.id)));
  select.disabled = items.length === 0;
}

async function loadOptions() {
  try {
    const options = await api.get("/trips/options");
    routes = options.routes || [];
    buses = options.buses || [];
    drivers = options.drivers || [];
    routes.forEach((route) => optionsByRoute.set(Number(route.id), route));
    fillSelect(routeSelect, routes, "tuyến đường", (route) => `${route.origin} → ${route.destination}`);
    fillSelect(busSelect, buses, "phương tiện", (bus) => `${bus.plate_number} · ${bus.seat_count} chỗ`);
    fillSelect(driverSelect, drivers, "tài xế", (driver) => driver.full_name);
    fillSelect(document.getElementById("filter-route"), routes, "tuyến", (route) => `${route.origin} → ${route.destination}`);
    adminMessage.className = routes.length && buses.length && drivers.length ? "status status-ok" : "status status-loading";
    adminMessage.textContent = routes.length && buses.length && drivers.length
      ? `Đã tải ${routes.length} tuyến, ${buses.length} phương tiện và ${drivers.length} tài xế đang hoạt động.`
      : "Chưa có đủ tuyến, xe hoặc tài xế đang hoạt động để tạo chuyến.";
  } catch (error) {
    [routeSelect, busSelect, driverSelect].forEach((select) => {
      select.replaceChildren(new Option("Chưa tải được dữ liệu", ""));
      select.disabled = true;
    });
    adminMessage.className = "status status-error";
    adminMessage.textContent = `Không tải được danh sách tuyến, xe và tài xế. ${error.message || "Hãy kiểm tra backend."}`;
  }
}

function tripOverlaps(trip, departure, arrival) {
  return trip.status !== "CANCELLED" && new Date(trip.departure_at) < arrival && new Date(trip.arrival_at) > departure;
}

function findFormConflicts() {
  const busId = Number(busSelect.value);
  const driverId = Number(driverSelect.value);
  const departureValue = departureInput.value;
  const arrivalValue = arrivalInput.value;
  const repeatDaily = document.getElementById("admin-repeat").value === "daily";
  if (!busId || !driverId || !departureValue || !arrivalValue) {
    conflictAlert.hidden = true;
    return [];
  }
  const start = new Date(departureValue);
  const end = new Date(arrivalValue);
  if (end <= start) {
    conflictAlert.hidden = true;
    return [];
  }

  const conflictDays = [];
  for (let offset = 0; offset < (repeatDaily ? 7 : 1); offset += 1) {
    const dayStart = new Date(start.getTime() + offset * 86400000);
    const dayEnd = new Date(end.getTime() + offset * 86400000);
    const conflicting = scheduledTrips.filter((trip) => (Number(trip.bus_id) === busId || Number(trip.driver_id) === driverId) && tripOverlaps(trip, dayStart, dayEnd));
    if (conflicting.length) conflictDays.push({ date: dayStart.toLocaleDateString("vi-VN"), trips: conflicting });
  }
  if (conflictDays.length) {
    const lines = conflictDays.slice(0, 3).map(({ date, trips }) => `${date}: ${trips.map((trip) => `${Number(trip.bus_id) === busId ? "xe" : "tài xế"} trùng chuyến #${trip.id} (${routeName(trip.route_id)})`).join(", ")}`);
    conflictMessage.textContent = lines.join(" · ");
    conflictAlert.hidden = false;
  } else {
    conflictAlert.hidden = true;
  }
  return conflictDays;
}

function renderSchedule() {
  const selectedDate = document.getElementById("filter-date").value;
  const selectedRoute = document.getElementById("filter-route").value;
  const filtered = scheduledTrips.filter((trip) => {
    const dateMatches = !selectedDate || String(trip.departure_at).slice(0, 10) === selectedDate;
    const routeMatches = !selectedRoute || Number(trip.route_id) === Number(selectedRoute);
    return dateMatches && routeMatches;
  });
  tripListStatus.textContent = `${filtered.length} chuyến xe${selectedDate ? ` · ngày ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString("vi-VN")}` : ""}`;
  if (!filtered.length) {
    tripList.innerHTML = `<div class="empty-schedule"><span>⌁</span><strong>Chưa có chuyến phù hợp</strong><p>Thử thay đổi bộ lọc hoặc tạo một chuyến mới.</p></div>`;
    return;
  }
  tripList.innerHTML = filtered.map((trip) => {
    const departure = new Date(trip.departure_at);
    const arrival = new Date(trip.arrival_at);
    const weekday = departure.toLocaleDateString("vi-VN", { weekday: "short" });
    const state = trip.status === "CANCELLED" ? "Đã hủy" : trip.status === "DEPARTED" ? "Đã khởi hành" : "Đã lên lịch";
    const stateClass = trip.status === "CANCELLED" ? "schedule-status-cancelled" : "schedule-status-active";
    return `<article class="schedule-row"><div class="schedule-date-badge"><strong>${escapeHtml(departure.toLocaleDateString("vi-VN", { day: "2-digit" }))}</strong><span>${escapeHtml(weekday)}</span></div><div class="schedule-route"><strong>${escapeHtml(routeName(trip.route_id))}</strong><span>${escapeHtml(departure.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }))} – ${escapeHtml(arrival.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }))}</span></div><div class="schedule-resources"><span>Xe #${escapeHtml(trip.bus_id)}</span><span>Tài xế #${escapeHtml(trip.driver_id)}</span></div><strong class="schedule-price">${escapeHtml(formatMoney(trip.ticket_price))}</strong><span class="schedule-status ${stateClass}">${escapeHtml(state)}</span></article>`;
  }).join("");
}

async function loadTrips() {
  tripListStatus.textContent = "Đang tải lịch trình…";
  try {
    scheduledTrips = await api.get("/trips");
    renderSchedule();
    findFormConflicts();
  } catch (error) {
    tripListStatus.textContent = "Không tải được danh sách chuyến.";
    tripList.innerHTML = `<div class="empty-schedule"><strong>Không thể tải lịch trình</strong><p>${escapeHtml(error.message || "Vui lòng kiểm tra backend.")}</p></div>`;
  }
}

document.getElementById("focus-create").addEventListener("click", () => document.getElementById("create-trip-section").scrollIntoView({ behavior: "smooth" }));
document.getElementById("refresh-trips").addEventListener("click", loadTrips);
document.getElementById("filter-date").addEventListener("change", renderSchedule);
document.getElementById("filter-route").addEventListener("change", renderSchedule);
document.querySelectorAll("#admin-trip-form select, #admin-trip-form input").forEach((field) => field.addEventListener("change", findFormConflicts));
busSelect.addEventListener("change", () => {
  const bus = buses.find((item) => Number(item.id) === Number(busSelect.value));
  document.getElementById("bus-seat-hint").textContent = bus ? `Sức chứa ${bus.seat_count} hành khách.` : "";
});

adminForm.addEventListener("reset", () => {
  setTimeout(() => {
    setAdminFeedback("");
    conflictAlert.hidden = true;
    document.getElementById("bus-seat-hint").textContent = "";
  });
});

adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAdminFeedback("");
  const form = new FormData(adminForm);
  const departureAt = String(form.get("departure_at") || "");
  const arrivalAt = String(form.get("arrival_at") || "");
  if (!form.get("route_id") || !form.get("bus_id") || !form.get("driver_id") || !departureAt || !arrivalAt || !form.get("ticket_price")) {
    setAdminFeedback("Vui lòng điền đầy đủ các trường bắt buộc.");
    return;
  }
  if (new Date(arrivalAt) <= new Date(departureAt)) {
    setAdminFeedback("Giờ đến dự kiến phải sau giờ khởi hành.");
    return;
  }
  const repeat = form.get("repeat") === "daily";
  const conflicts = findFormConflicts();
  if (conflicts.length && !repeat) {
    setAdminFeedback("Hãy đổi xe, tài xế hoặc thời gian trước khi lưu chuyến.");
    return;
  }
  const payload = {
    route_id: Number(form.get("route_id")),
    bus_id: Number(form.get("bus_id")),
    driver_id: Number(form.get("driver_id")),
    departure_at: departureAt,
    arrival_at: arrivalAt,
    ticket_price: Number(form.get("ticket_price")),
  };
  adminSubmit.disabled = true;
  adminSubmit.textContent = "Đang lưu…";
  try {
    const result = await api.post(repeat ? "/trips/repeat" : "/trips", payload);
    const createdCount = repeat ? result.created.length : 1;
    const skippedCount = repeat ? result.skipped.length : 0;
    adminMessage.className = "status status-ok";
    adminMessage.textContent = repeat
      ? `Đã tạo ${createdCount} chuyến${skippedCount ? `; bỏ qua ${skippedCount} ngày do trùng lịch` : ""}.`
      : "Đã tạo chuyến xe thành công.";
    if (repeat && skippedCount) {
      const firstSkipped = result.skipped[0];
      const details = (firstSkipped.conflicts || []).map((item) => `${item.resource === "bus" ? "xe" : "tài xế"} trùng chuyến #${item.trip_id}`).join(", ");
      setAdminFeedback(`Một số ngày không thể tạo do trùng lịch${details ? `: ${details}` : "."}`);
    } else {
      adminForm.reset();
    }
    await loadTrips();
  } catch (error) {
    if (error.status === 409) {
      conflictMessage.textContent = error.message;
      conflictAlert.hidden = false;
      setAdminFeedback("Lịch trình vừa được cập nhật ở nơi khác. Hãy kiểm tra lại trước khi lưu.");
    } else {
      setAdminFeedback(error.message || "Chưa thể lưu chuyến xe. Vui lòng thử lại.");
    }
  } finally {
    adminSubmit.disabled = false;
    adminSubmit.innerHTML = 'Lưu chuyến xe <span aria-hidden="true">→</span>';
  }
});

const minimumDateTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
departureInput.min = minimumDateTime;
arrivalInput.min = minimumDateTime;
document.getElementById("filter-date").value = adminLocalIsoDate();
loadOptions().then(loadTrips);
