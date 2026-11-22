const homeSearchForm = document.getElementById("home-search-form");
const homeOrigin = document.getElementById("home-origin");
const homeDestination = document.getElementById("home-destination");
const homeTravelDate = document.getElementById("home-travel-date");
const homeSearchFeedback = document.getElementById("home-search-feedback");

function localIsoDate(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

homeTravelDate.min = localIsoDate();
homeTravelDate.value = localIsoDate();

document.getElementById("swap-cities").addEventListener("click", () => {
  const previousOrigin = homeOrigin.value;
  homeOrigin.value = homeDestination.value;
  homeDestination.value = previousOrigin;
});

document.querySelectorAll(".route-chip, .route-chip-card").forEach((route) => {
  route.addEventListener("click", () => {
    homeOrigin.value = route.dataset.origin;
    homeDestination.value = route.dataset.destination;
    homeTravelDate.focus();
    document.getElementById("home-search-form").scrollIntoView({ behavior: "smooth", block: "center" });
  });
});

homeSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  homeSearchFeedback.hidden = true;
  homeSearchFeedback.textContent = "";

  const origin = homeOrigin.value.trim();
  const destination = homeDestination.value.trim();
  const travelDate = homeTravelDate.value;
  if (!origin || !destination || !travelDate) {
    homeSearchFeedback.textContent = "Vui lòng chọn điểm đi, điểm đến và ngày khởi hành.";
    homeSearchFeedback.hidden = false;
    return;
  }
  if (origin.localeCompare(destination, "vi", { sensitivity: "base" }) === 0) {
    homeSearchFeedback.textContent = "Điểm đi và điểm đến cần khác nhau.";
    homeSearchFeedback.hidden = false;
    return;
  }
  if (travelDate < localIsoDate()) {
    homeSearchFeedback.textContent = "Ngày khởi hành không thể nằm trong quá khứ.";
    homeSearchFeedback.hidden = false;
    homeTravelDate.min = localIsoDate();
    return;
  }

  const params = new URLSearchParams({ origin, destination, travel_date: travelDate });
  const apiOverride = new URLSearchParams(window.location.search).get("api");
  if (apiOverride) params.set("api", apiOverride);
  window.location.href = `pages/trips.html?${params.toString()}`;
});
