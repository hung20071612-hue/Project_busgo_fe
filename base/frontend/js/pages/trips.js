const searchForm = document.getElementById("trip-search-form");
const searchButton = document.getElementById("search-submit");
const searchFeedback = document.getElementById("search-feedback");
const resultsStatus = document.getElementById("trip-results-status");
const resultsContainer = document.getElementById("trip-results");
const dateInput = document.getElementById("travel-date");

function tripsLocalIsoDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function showSearchFeedback(message) {
  searchFeedback.textContent = message;
  searchFeedback.hidden = !message;
}

function renderTripResults(trips) {
  if (trips.length === 0) {
    resultsContainer.replaceChildren();
    resultsStatus.textContent = "Chưa tìm thấy chuyến phù hợp còn ghế. Thử nới khoảng giá hoặc giờ đi nhé.";
    return;
  }

  resultsStatus.textContent = `Tìm thấy ${trips.length} chuyến xe phù hợp.`;
  resultsContainer.innerHTML = trips.map((trip) => {
    const detailKey = `busgo-trip-${trip.id}`;
    sessionStorage.setItem(detailKey, JSON.stringify(trip));
    const detailParams = new URLSearchParams({ id: trip.id });
    const apiOverride = new URLSearchParams(window.location.search).get("api");
    if (apiOverride) detailParams.set("api", apiOverride);
    const departure = new Date(trip.departure_at);
    const arrival = new Date(trip.arrival_at);
    const durationMinutes = Math.max(0, Math.round((arrival - departure) / 60000));
    const duration = `${Math.floor(durationMinutes / 60)} giờ ${durationMinutes % 60} phút`;
    return `
      <article class="trip-result-card card">
        <div class="trip-operator"><span class="operator-mark" aria-hidden="true">B</span><span><strong>BusGo</strong><small>Chuyến xe liên tỉnh</small></span><span class="trip-pill">Đang nhận khách</span></div>
        <div class="trip-schedule">
          <div class="schedule-stop"><strong>${escapeHtml(departure.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }))}</strong><span>${escapeHtml(trip.origin)}</span><small>${escapeHtml(departure.toLocaleDateString("vi-VN"))}</small></div>
          <div class="schedule-line"><span>${escapeHtml(duration)}</span><i aria-hidden="true"></i><small>Đi thẳng</small></div>
          <div class="schedule-stop schedule-arrival"><strong>${escapeHtml(arrival.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }))}</strong><span>${escapeHtml(trip.destination)}</span><small>${escapeHtml(arrival.toLocaleDateString("vi-VN"))}</small></div>
        </div>
        <div class="trip-result-footer"><div class="trip-meta"><span>▣ ${escapeHtml(trip.plate_number)}</span><span class="seat-availability">♧ Còn ${escapeHtml(trip.available_seats)} ghế trống</span></div><div class="trip-booking"><strong class="trip-price">${escapeHtml(formatMoney(trip.ticket_price))}</strong><a class="btn btn-accent" href="trip-detail.html?${detailParams.toString()}">Xem chuyến <span aria-hidden="true">→</span></a></div></div>
      </article>`;
  }).join("");
}

async function searchTrips(event) {
  event?.preventDefault();
  showSearchFeedback("");

  const formData = new FormData(searchForm);
  const origin = String(formData.get("origin") || "").trim();
  const destination = String(formData.get("destination") || "").trim();
  const travelDate = String(formData.get("travel_date") || "");
  const minPrice = String(formData.get("min_price") || "");
  const maxPrice = String(formData.get("max_price") || "");
  const timeFrom = String(formData.get("time_from") || "");
  const timeTo = String(formData.get("time_to") || "");

  if (!origin || !destination || !travelDate) {
    showSearchFeedback("Vui lòng nhập điểm đi, điểm đến và ngày khởi hành.");
    return;
  }
  if (travelDate < tripsLocalIsoDate()) {
    showSearchFeedback("Ngày khởi hành không thể nằm trong quá khứ.");
    dateInput.min = tripsLocalIsoDate();
    return;
  }
  if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
    showSearchFeedback("Giá thấp nhất cần nhỏ hơn hoặc bằng giá cao nhất.");
    return;
  }
  if (Boolean(timeFrom) !== Boolean(timeTo)) {
    showSearchFeedback("Vui lòng nhập đủ giờ khởi hành bắt đầu và kết thúc.");
    return;
  }

  const params = { origin, destination, travel_date: travelDate, sort: String(formData.get("sort") || "departure_asc") };
  if (minPrice) params.min_price = minPrice;
  if (maxPrice) params.max_price = maxPrice;
  if (timeFrom) {
    params.time_from = timeFrom;
    params.time_to = timeTo;
  }

  searchButton.disabled = true;
  resultsContainer.replaceChildren();
  resultsStatus.textContent = "Đang tìm chuyến xe phù hợp…";
  try {
    const trips = await api.get("/trips/search", params);
    renderTripResults(trips);
  } catch (error) {
    resultsStatus.textContent = "Chưa tải được danh sách chuyến.";
    showSearchFeedback(error.message || "Không thể kết nối để tìm chuyến. Vui lòng thử lại.");
  } finally {
    searchButton.disabled = false;
  }
}

const searchParams = new URLSearchParams(window.location.search);
for (const name of ["origin", "destination", "travel_date", "min_price", "max_price", "time_from", "time_to", "sort"]) {
  if (searchParams.has(name) && searchForm.elements[name]) searchForm.elements[name].value = searchParams.get(name);
}
dateInput.min = tripsLocalIsoDate();
searchForm.addEventListener("submit", searchTrips);
if (searchParams.has("origin") || searchParams.has("destination") || searchParams.has("travel_date")) searchForm.requestSubmit();
