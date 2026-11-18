const searchForm = document.getElementById("trip-search-form");
const searchButton = document.getElementById("search-submit");
const searchFeedback = document.getElementById("search-feedback");
const resultsStatus = document.getElementById("trip-results-status");
const resultsContainer = document.getElementById("trip-results");

function showSearchFeedback(message) {
  searchFeedback.textContent = message;
  searchFeedback.hidden = !message;
}

function formatTripTime(value) {
  return formatDateTime(value);
}

function renderTripResults(trips) {
  if (trips.length === 0) {
    resultsContainer.replaceChildren();
    resultsStatus.textContent = "Không tìm thấy chuyến phù hợp còn chỗ. Hãy thử ngày hoặc điểm đến khác.";
    return;
  }

  resultsStatus.textContent = `Tìm thấy ${trips.length} chuyến xe.`;
  resultsContainer.innerHTML = trips.map((trip) => `
    <article class="card trip-result-card">
      <div class="trip-route">
        <div>
          <span class="trip-label">Điểm đi</span>
          <strong>${escapeHtml(trip.origin)}</strong>
          <span class="muted">${escapeHtml(formatTripTime(trip.departure_at))}</span>
        </div>
        <span class="trip-arrow" aria-hidden="true">→</span>
        <div>
          <span class="trip-label">Điểm đến</span>
          <strong>${escapeHtml(trip.destination)}</strong>
          <span class="muted">${escapeHtml(formatTripTime(trip.arrival_at))}</span>
        </div>
      </div>
      <div class="trip-details">
        <span>Xe <strong>${escapeHtml(trip.plate_number)}</strong></span>
        <span>Còn <strong>${escapeHtml(trip.available_seats)}</strong> chỗ</span>
        <strong class="trip-price">${escapeHtml(formatMoney(trip.ticket_price))}</strong>
      </div>
    </article>`).join("");
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
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
  if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
    showSearchFeedback("Giá từ phải nhỏ hơn hoặc bằng giá đến.");
    return;
  }
  if (Boolean(timeFrom) !== Boolean(timeTo)) {
    showSearchFeedback("Vui lòng nhập cả giờ khởi hành từ và đến.");
    return;
  }

  const params = {
    origin,
    destination,
    travel_date: travelDate,
    sort: String(formData.get("sort") || "departure_asc"),
  };
  if (minPrice) params.min_price = minPrice;
  if (maxPrice) params.max_price = maxPrice;
  if (timeFrom) {
    params.time_from = timeFrom;
    params.time_to = timeTo;
  }

  searchButton.disabled = true;
  resultsContainer.replaceChildren();
  resultsStatus.textContent = "Đang tìm chuyến xe...";

  try {
    const trips = await api.get("/trips/search", params);
    renderTripResults(trips);
  } catch (error) {
    resultsStatus.textContent = "Không thể tải chuyến xe.";
    showSearchFeedback(error.message || "Đã xảy ra lỗi khi tìm chuyến. Vui lòng thử lại.");
  } finally {
    searchButton.disabled = false;
  }
});
