// Trang thống kê vé và doanh thu

let revenueChart = null;
let routesChart = null;

// Lấy khoảng thời gian người dùng chọn
function getDateParams() {
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;

    if (startDate && endDate && startDate > endDate) {
        throw new Error("Ngày bắt đầu không được lớn hơn ngày kết thúc");
    }

    const params = {};

    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    return params;
}

// Hiển thị tổng số vé và doanh thu
async function loadSummary(params) {
    const ticketElement = document.getElementById("total-tickets");
    const revenueElement = document.getElementById("total-revenue");

    ticketElement.textContent = "Đang tải...";
    revenueElement.textContent = "Đang tải...";

    try {
        const data = await api.get("/statistics/summary", params);

        ticketElement.textContent =
            Number(data.total_tickets).toLocaleString("vi-VN");

        revenueElement.textContent = formatMoney(data.total_revenue);

    } catch (error) {
        ticketElement.textContent = "Không tải được";
        revenueElement.textContent = "Không tải được";

        document.getElementById("filter-error").textContent =
            error.message;
    }
}

// Biểu đồ doanh thu theo ngày
async function loadRevenueChart(params) {
    const loading = document.getElementById("revenue-loading");
    const errorElement = document.getElementById("revenue-error");

    loading.textContent = "Đang tải dữ liệu...";
    errorElement.textContent = "";

    try {
        const data = await api.get("/statistics/revenue/daily", params);

        if (revenueChart) {
            revenueChart.destroy();
        }

        if (!data || data.length === 0) {
            loading.textContent = "Không có dữ liệu doanh thu";
            return;
        }

        loading.textContent = "";

        revenueChart = new Chart(
            document.getElementById("revenue-chart"),
            {
                type: "line",
                data: {
                    labels: data.map(item => item.date),
                    datasets: [{
                        label: "Doanh thu (VNĐ)",
                        data: data.map(item => Number(item.revenue)),
                        borderColor: "#2563eb",
                        backgroundColor: "rgba(37, 99, 235, 0.15)",
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true
                        }
                    }
                }
            }
        );

    } catch (error) {
        loading.textContent = "";
        errorElement.textContent = error.message;
    }
}

// Biểu đồ top 5 tuyến theo số vé bán
async function loadRoutesChart(params) {
    const loading = document.getElementById("routes-loading");
    const errorElement = document.getElementById("routes-error");

    loading.textContent = "Đang tải dữ liệu...";
    errorElement.textContent = "";

    try {
        const data = await api.get("/statistics/routes/fill-rate", params);

        if (routesChart) {
            routesChart.destroy();
        }

        if (!data || data.length === 0) {
            loading.textContent = "Không có dữ liệu tuyến xe";
            return;
        }

        // Sắp xếp theo số vé bán giảm dần và lấy 5 tuyến đầu
        const topRoutes = data
            .sort((a, b) => b.sold_tickets - a.sold_tickets)
            .slice(0, 5);

        loading.textContent = "";

        routesChart = new Chart(
            document.getElementById("routes-chart"),
            {
                type: "bar",
                data: {
                    labels: topRoutes.map(item => item.route),
                    datasets: [{
                        label: "Số vé đã bán",
                        data: topRoutes.map(item => item.sold_tickets),
                        backgroundColor: "#16a34a"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: "y",
                    plugins: {
                        legend: {
                            display: true
                        }
                    }
                }
            }
        );

    } catch (error) {
        loading.textContent = "";
        errorElement.textContent = error.message;
    }
}

// Tải toàn bộ dữ liệu thống kê
async function loadStatistics() {
    document.getElementById("filter-error").textContent = "";

    try {
        const params = getDateParams();

        await Promise.all([
            loadSummary(params),
            loadRevenueChart(params),
            loadRoutesChart(params)
        ]);

    } catch (error) {
        document.getElementById("filter-error").textContent =
            error.message;
    }
}

// Nút lọc dữ liệu
document.getElementById("btn-filter")
    .addEventListener("click", loadStatistics);

// Tải dữ liệu khi mở trang
loadStatistics();
