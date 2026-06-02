const OPTIONS_URL = "data/filter_options.csv";
const EVENTS_URL = "data/events.csv";
const BY_DATE_URL = "data/by-date";

const state = {
  rows: [],
  filtered: [],
  events: [],
  loadedDates: new Map(),
  byDate: new Map(),
  byShop: new Map(),
  byGenre: new Map()
};

const els = {
  loadStatus: document.getElementById("loadStatus"),
  genreSelect: document.getElementById("genreSelect"),
  shopSelect: document.getElementById("shopSelect"),
  yearSelect: document.getElementById("yearSelect"),
  monthSelect: document.getElementById("monthSelect"),
  daySelect: document.getElementById("daySelect"),
  minSalesInput: document.getElementById("minSalesInput"),
  resetButton: document.getElementById("resetButton"),
  exportButton: document.getElementById("exportButton"),
  salesMetric: document.getElementById("salesMetric"),
  unitsMetric: document.getElementById("unitsMetric"),
  ordersMetric: document.getElementById("ordersMetric"),
  conversionMetric: document.getElementById("conversionMetric"),
  resultCount: document.getElementById("resultCount"),
  resultsBody: document.getElementById("resultsBody"),
  chart: document.getElementById("chart"),
  eventList: document.getElementById("eventList"),
  eventCount: document.getElementById("eventCount")
};

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const whole = new Intl.NumberFormat("en-US");
const pct = new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function addOptions(select, rows) {
  rows.forEach((row) => {
    const option = document.createElement("option");
    option.value = row.id;
    option.textContent = row.label;
    select.appendChild(option);
  });
}

function setEnabled(enabled) {
  [els.genreSelect, els.shopSelect, els.yearSelect, els.monthSelect, els.daySelect, els.minSalesInput, els.resetButton, els.exportButton].forEach((el) => {
    el.disabled = !enabled;
  });
}

function selectedDate() {
  if (!els.yearSelect.value || !els.monthSelect.value || !els.daySelect.value) return "";
  return `${els.yearSelect.value}-${els.monthSelect.value}-${els.daySelect.value}`;
}

function buildDateControls(dateRows) {
  state.dates = dateRows.map((row) => row.id).sort((a, b) => b.localeCompare(a));
  state.availableDates = new Set(state.dates);
  const years = [...new Set(state.dates.map((date) => date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));

  els.yearSelect.innerHTML = `<option value="">Year</option>`;
  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    els.yearSelect.appendChild(option);
  });
}

function refreshMonthOptions(keepValue = true) {
  const oldValue = keepValue ? els.monthSelect.value : "";
  const year = els.yearSelect.value;
  const months = [...new Set(state.dates
    .filter((date) => !year || date.startsWith(`${year}-`))
    .map((date) => date.slice(5, 7)))]
    .sort((a, b) => Number(b) - Number(a));

  els.monthSelect.innerHTML = `<option value="">Month</option>`;
  months.forEach((month) => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = month;
    els.monthSelect.appendChild(option);
  });
  els.monthSelect.value = months.includes(oldValue) ? oldValue : months[0] || "";
}

function refreshDayOptions(keepValue = true) {
  const oldValue = keepValue ? els.daySelect.value : "";
  const year = els.yearSelect.value;
  const month = els.monthSelect.value;
  const prefix = year && month ? `${year}-${month}-` : "";
  const days = [...new Set(state.dates
    .filter((date) => !prefix || date.startsWith(prefix))
    .map((date) => date.slice(8, 10)))]
    .sort((a, b) => Number(b) - Number(a));

  els.daySelect.innerHTML = `<option value="">Day</option>`;
  days.forEach((day) => {
    const option = document.createElement("option");
    option.value = day;
    option.textContent = day;
    els.daySelect.appendChild(option);
  });
  els.daySelect.value = days.includes(oldValue) ? oldValue : days[0] || "";
}

function setDateParts(date) {
  els.yearSelect.value = date.slice(0, 4);
  refreshMonthOptions(false);
  els.monthSelect.value = date.slice(5, 7);
  refreshDayOptions(false);
  els.daySelect.value = date.slice(8, 10);
}

function rowFromCsv(row) {
  return {
    date: row.date,
    shop: row.shop,
    genre: row.genre,
    sales: Number(row.sales) || 0,
    units: Number(row.units) || 0,
    orders: Number(row.orders) || 0,
    pageViews: Number(row.page_views) || 0,
    visitors: Number(row.visitors) || 0,
    carts: Number(row.carts) || 0,
    reviewsPosted: Number(row.reviews_posted) || 0,
    avgRating: row.avg_rating ? Number(row.avg_rating) : null,
    reviewCount: Number(row.review_count) || 0
  };
}

async function update() {
  const genre = els.genreSelect.value;
  const shop = els.shopSelect.value;
  const date = selectedDate();
  const minSales = Number(els.minSalesInput.value) || 0;

  if (!date || !state.availableDates.has(date)) {
    state.filtered = [];
    renderEmptyState();
    renderEvents(date);
    return;
  }

  let baseRows = await loadDate(date);
  if (shop !== "all") baseRows = baseRows.filter((row) => row.shop === shop);
  if (genre !== "all") baseRows = baseRows.filter((row) => row.genre === genre);
  if (minSales > 0) baseRows = baseRows.filter((row) => row.sales >= minSales);

  state.filtered = baseRows;
  renderSummary(baseRows);
  renderTable(baseRows);
  renderChart(baseRows);
  renderEvents(date);
}

function renderEmptyState() {
  els.salesMetric.textContent = "-";
  els.unitsMetric.textContent = "-";
  els.ordersMetric.textContent = "-";
  els.conversionMetric.textContent = "-";
  els.resultCount.textContent = "Choose a day";
  els.resultsBody.innerHTML = `<tr><td colspan="9">Choose a day to search daily sales.</td></tr>`;
  els.chart.innerHTML = `<div class="empty">Choose a day to show sales.</div>`;
}

async function loadDate(date) {
  if (state.loadedDates.has(date)) return state.loadedDates.get(date);
  els.loadStatus.textContent = `Loading ${date}...`;
  const text = await fetch(`${BY_DATE_URL}/${date}.csv`).then((response) => response.text());
  const rows = parseCsv(text).map(rowFromCsv);
  state.loadedDates.set(date, rows);
  els.loadStatus.textContent = `${whole.format(rows.length)} records loaded for ${date}`;
  return rows;
}

function renderSummary(rows) {
  const totals = rows.reduce((acc, row) => {
    acc.sales += row.sales;
    acc.units += row.units;
    acc.orders += row.orders;
    acc.pageViews += row.pageViews;
    return acc;
  }, { sales: 0, units: 0, orders: 0, pageViews: 0 });

  els.salesMetric.textContent = yen.format(totals.sales);
  els.unitsMetric.textContent = whole.format(totals.units);
  els.ordersMetric.textContent = whole.format(totals.orders);
  els.conversionMetric.textContent = totals.pageViews ? pct.format(totals.orders / totals.pageViews) : "-";
  els.resultCount.textContent = `${whole.format(rows.length)} matching rows`;
}

function renderTable(rows) {
  const topRows = [...rows].sort((a, b) => b.sales - a.sales).slice(0, 250);
  if (!topRows.length) {
    els.resultsBody.innerHTML = `<tr><td colspan="9">No matching sales found.</td></tr>`;
    return;
  }

  els.resultsBody.innerHTML = topRows.map((row) => `
    <tr>
      <td>${row.date}</td>
      <td>Shop ${row.shop}</td>
      <td>Product genre ${row.genre}</td>
      <td>${yen.format(row.sales)}</td>
      <td>${whole.format(row.units)}</td>
      <td>${whole.format(row.orders)}</td>
      <td>${whole.format(row.pageViews)}</td>
      <td>${whole.format(row.visitors)}</td>
      <td>${row.avgRating === null ? "-" : row.avgRating.toFixed(2)}</td>
    </tr>
  `).join("");
}

function renderChart(rows) {
  const daily = new Map();
  rows.forEach((row) => daily.set(row.date, (daily.get(row.date) || 0) + row.sales));
  const points = [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-60);
  const max = Math.max(1, ...points.map(([, sales]) => sales));

  if (!points.length) {
    els.chart.innerHTML = `<div class="empty">No chart data for this search.</div>`;
    return;
  }

  els.chart.innerHTML = points.map(([date, sales]) => {
    const height = Math.max(8, Math.round((sales / max) * 260));
    return `<div class="bar" style="height:${height}px" title="${date}: ${yen.format(sales)}"><span>${date.slice(5)}</span></div>`;
  }).join("");
}

function renderEvents(date) {
  if (!date) {
    els.eventCount.textContent = "Choose a day";
    els.eventList.innerHTML = `<div class="empty">Choose a specific day to see calendar events.</div>`;
    return;
  }

  const matches = state.events.filter((event) => event.start_date <= date && event.end_date >= date);
  els.eventCount.textContent = `${matches.length} events`;
  els.eventList.innerHTML = matches.length
    ? matches.map((event) => `<span class="event-chip">${event.name}</span>`).join("")
    : `<div class="empty">No listed events for ${date}.</div>`;
}

function exportCsv() {
  const header = "date,shop,genre,sales,units,orders,page_views,visitors,carts,reviews_posted,avg_rating,review_count";
  const body = state.filtered.map((row) => [
    row.date, row.shop, row.genre, row.sales, row.units, row.orders, row.pageViews, row.visitors,
    row.carts, row.reviewsPosted, row.avgRating ?? "", row.reviewCount
  ].join(","));
  const blob = new Blob([[header, ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "tenki-sales-search-results.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function init() {
  try {
    const [optionsText, eventsText] = await Promise.all([
      fetch(OPTIONS_URL).then((response) => response.text()),
      fetch(EVENTS_URL).then((response) => response.text())
    ]);

    const options = parseCsv(optionsText);
    addOptions(els.genreSelect, options.filter((row) => row.type === "genre"));
    addOptions(els.shopSelect, options.filter((row) => row.type === "shop"));
    const dateRows = options.filter((row) => row.type === "date");
    buildDateControls(dateRows);

    state.events = parseCsv(eventsText);
    setDateParts(state.dates[0] || "");
    els.loadStatus.textContent = "Ready";
    setEnabled(true);
    await update();
  } catch (error) {
    els.loadStatus.textContent = "Could not load data files";
    els.resultsBody.innerHTML = `<tr><td colspan="9">Open this site through a local web server so the CSV files can load.</td></tr>`;
    console.error(error);
  }
}

[els.genreSelect, els.shopSelect, els.minSalesInput].forEach((el) => {
  el.addEventListener("input", () => update());
});

els.yearSelect.addEventListener("input", () => {
  refreshMonthOptions(false);
  refreshDayOptions(false);
  update();
});

els.monthSelect.addEventListener("input", () => {
  refreshDayOptions(false);
  update();
});

els.daySelect.addEventListener("input", () => update());

els.resetButton.addEventListener("click", () => {
  els.genreSelect.value = "all";
  els.shopSelect.value = "all";
  setDateParts(state.dates[0] || "");
  els.minSalesInput.value = "";
  update();
});

els.exportButton.addEventListener("click", exportCsv);

init();
