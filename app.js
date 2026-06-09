const OPTIONS_URL = "data/filter_options.csv";
const EVENTS_URL = "data/events.csv";
const RANK_CURVES_URL = "data/rank_curves.csv?v=20260609-holdout-rank-curves";
const BY_MONTH_URL = "data/by-month";
const ITEMS_BY_MONTH_URL = "data/items-by-month";
const SHOP_ESTIMATES_BY_MONTH_URL = "data/shop-estimates-by-month";
const RANK_GAP_URL = "data/ranked-shops";
const ALL_TIME_URL = "data/all-time";
const RANK_DATA_VERSION = "20260609-holdout-rank-curves";
const SHOP_PROJECTION_VERSION = "20260609-full-shop-projection";
const ALL_TIME_DATA_VERSION = "20260609-full-shop-projection";
const GENRES_WITHOUT_RANK_DATA = new Set(["101384", "101954"]);

const state = {
  rows: [],
  filtered: [],
  events: [],
  rankCurves: new Map(),
  loadedMonths: new Map(),
  loadedItemMonths: new Map(),
  loadedShopEstimateMonths: new Map(),
  loadedRankGapMonths: new Map(),
  allTimeData: null,
  genreLabels: new Map(),
  byDate: new Map(),
  byShop: new Map(),
  byGenre: new Map(),
  shopProjectionSelected: new Set(),
  shopProjectionSelectionKey: ""
};

const els = {
  loadStatus: document.getElementById("loadStatus"),
  genreSelect: document.getElementById("genreSelect"),
  shopSelect: document.getElementById("shopSelect"),
  dateModeSelect: document.getElementById("dateModeSelect"),
  yearSelect: document.getElementById("yearSelect"),
  monthSelect: document.getElementById("monthSelect"),
  daySelect: document.getElementById("daySelect"),
  endYearSelect: document.getElementById("endYearSelect"),
  endMonthSelect: document.getElementById("endMonthSelect"),
  endDaySelect: document.getElementById("endDaySelect"),
  startDateInput: document.getElementById("startDateInput"),
  endDateInput: document.getElementById("endDateInput"),
  dateRangeButton: document.getElementById("dateRangeButton"),
  dateRangeLabel: document.getElementById("dateRangeLabel"),
  datePopover: document.getElementById("datePopover"),
  datePresetButtons: document.querySelectorAll(".date-preset-button"),
  clearDateButton: document.getElementById("clearDateButton"),
  applyDateButton: document.getElementById("applyDateButton"),
  dateCalendarGrid: document.getElementById("dateCalendarGrid"),
  granularitySelect: document.getElementById("granularitySelect"),
  compareYearSelect: document.getElementById("compareYearSelect"),
  compareMonthSelect: document.getElementById("compareMonthSelect"),
  compareDaySelect: document.getElementById("compareDaySelect"),
  resetButton: document.getElementById("resetButton"),
  salesMetric: document.getElementById("salesMetric"),
  unitsMetric: document.getElementById("unitsMetric"),
  pageViewsMetric: document.getElementById("pageViewsMetric"),
  trendChart: document.getElementById("trendChart"),
  trendSubtitle: document.getElementById("trendSubtitle"),
  shopProjectionChart: document.getElementById("shopProjectionChart"),
  shopProjectionSubtitle: document.getElementById("shopProjectionSubtitle"),
  shopProjectionControls: document.getElementById("shopProjectionControls"),
  shopCompareBody: document.getElementById("shopCompareBody"),
  shopCompareCount: document.getElementById("shopCompareCount"),
  dayCompareBody: document.getElementById("dayCompareBody"),
  dayCompareStatus: document.getElementById("dayCompareStatus"),
  topItemsBody: document.getElementById("topItemsBody"),
  topItemsCount: document.getElementById("topItemsCount"),
  rankGapBody: document.getElementById("rankGapBody"),
  rankGapCount: document.getElementById("rankGapCount"),
  eventsTitle: document.getElementById("eventsTitle"),
  eventList: document.getElementById("eventList"),
  eventCount: document.getElementById("eventCount")
};

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const whole = new Intl.NumberFormat("en-US");
const shopProjectionColors = ["#0f766e", "#2563eb", "#db2777", "#f97316", "#7c3aed", "#16a34a", "#dc2626", "#0891b2"];

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setEnabled(enabled) {
  [
    els.genreSelect, els.shopSelect, els.dateModeSelect, els.yearSelect, els.monthSelect, els.daySelect,
    els.endYearSelect, els.endMonthSelect, els.endDaySelect,
    els.startDateInput, els.endDateInput, els.dateRangeButton, els.clearDateButton, els.applyDateButton,
    els.granularitySelect,
    els.compareYearSelect, els.compareMonthSelect, els.compareDaySelect,
    els.resetButton
  ].forEach((el) => {
    el.disabled = !enabled;
  });
  els.datePresetButtons.forEach((button) => {
    button.disabled = !enabled;
  });
}

function selectedDate() {
  if (!els.yearSelect.value || !els.monthSelect.value || !els.daySelect.value) return "";
  return `${els.yearSelect.value}-${els.monthSelect.value}-${els.daySelect.value}`;
}

function selectedEndDate() {
  if (!els.endYearSelect.value || !els.endMonthSelect.value || !els.endDaySelect.value) return "";
  return `${els.endYearSelect.value}-${els.endMonthSelect.value}-${els.endDaySelect.value}`;
}

function syncCalendarInputs() {
  els.startDateInput.value = selectedDate();
  els.endDateInput.value = selectedEndDate();
  renderDateCalendars();
}

function rangeButtonLabel() {
  const dates = selectedPeriodDates();
  if (!dates.length) return "Choose dates";
  const activePreset = document.querySelector(".date-preset-button.active");
  if (activePreset) return activePreset.textContent;
  if (dates.length === 1) return dates[0];
  return `${dates[0]} to ${dates[dates.length - 1]}`;
}

function syncDateRangeLabel() {
  els.dateRangeLabel.textContent = rangeButtonLabel();
}

function setDatePopoverOpen(open) {
  els.datePopover.hidden = !open;
  els.dateRangeButton.setAttribute("aria-expanded", String(open));
}

function clearActivePreset() {
  els.datePresetButtons.forEach((button) => button.classList.remove("active"));
}

function monthTitle(month) {
  const date = new Date(`${month}-01T00:00:00Z`);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function previousMonth(month) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function calendarMonthsToShow() {
  const end = selectedEndDate() || selectedDate() || state.latestDate;
  const endMonth = end ? end.slice(0, 7) : "";
  if (!endMonth) return [];
  const start = selectedDate();
  const startMonth = start ? start.slice(0, 7) : previousMonth(endMonth);
  if (startMonth && startMonth !== endMonth) return [startMonth, endMonth];
  return [previousMonth(endMonth), endMonth].filter(Boolean);
}

function renderMonthCalendar(month) {
  const selectedStart = selectedDate();
  const selectedEnd = selectedEndDate();
  const firstDay = new Date(`${month}-01T00:00:00Z`);
  const daysInMonth = new Date(Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + 1, 0)).getUTCDate();
  const startOffset = firstDay.getUTCDay();
  const blanks = Array.from({ length: startOffset }, () => `<span class="calendar-empty"></span>`).join("");
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    const date = `${month}-${day}`;
    const unavailable = !state.availableDates?.has(date);
    const selected = date === selectedStart || date === selectedEnd;
    const inRange = selectedStart && selectedEnd && date >= selectedStart && date <= selectedEnd;
    return `
      <button class="calendar-day${selected ? " selected" : ""}${inRange ? " in-range" : ""}" type="button" data-date="${date}" ${unavailable ? "disabled" : ""}>
        ${index + 1}
      </button>
    `;
  }).join("");

  return `
    <div class="month-calendar">
      <div class="month-title">${monthTitle(month)}</div>
      <div class="weekday-row">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
      </div>
      <div class="calendar-days">${blanks}${days}</div>
    </div>
  `;
}

function renderDateCalendars() {
  if (!els.dateCalendarGrid || !state.latestDate) return;
  const months = calendarMonthsToShow();
  els.dateCalendarGrid.innerHTML = months.map(renderMonthCalendar).join("");
}

function isRangeMode() {
  return els.dateModeSelect.value === "range";
}

function selectedCompareDate() {
  if (!els.compareYearSelect.value || !els.compareMonthSelect.value || !els.compareDaySelect.value) return "";
  return `${els.compareYearSelect.value}-${els.compareMonthSelect.value}-${els.compareDaySelect.value}`;
}

function buildDateControls(dateRows) {
  state.dates = dateRows.map((row) => row.id).sort((a, b) => b.localeCompare(a));
  state.availableDates = new Set(state.dates);
  const sortedDates = [...state.dates].sort((a, b) => a.localeCompare(b));
  state.firstDate = sortedDates[0] || "";
  state.latestDate = sortedDates[sortedDates.length - 1] || "";
  const years = [...new Set(state.dates.map((date) => date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));

  els.yearSelect.innerHTML = `<option value="">Year</option>`;
  els.endYearSelect.innerHTML = `<option value="">Year</option>`;
  els.compareYearSelect.innerHTML = `<option value="">Year</option>`;
  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    els.yearSelect.appendChild(option);
    els.endYearSelect.appendChild(option.cloneNode(true));
    els.compareYearSelect.appendChild(option.cloneNode(true));
  });
  [els.startDateInput, els.endDateInput].forEach((input) => {
    input.min = state.firstDate;
    input.max = state.latestDate;
  });
}

function refreshMonthOptions(keepValue = true, chooseFirst = false) {
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
  els.monthSelect.value = months.includes(oldValue) ? oldValue : (chooseFirst ? months[0] || "" : "");
}

function refreshDayOptions(keepValue = true, chooseFirst = false) {
  const oldValue = keepValue ? els.daySelect.value : "";
  const year = els.yearSelect.value;
  const month = els.monthSelect.value;
  if (!year || !month) {
    els.daySelect.innerHTML = `<option value="">Day</option>`;
    els.daySelect.value = "";
    els.daySelect.selectedIndex = 0;
    return;
  }

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
  els.daySelect.value = days.includes(oldValue) ? oldValue : (chooseFirst ? days[0] || "" : "");
}

function refreshCompareMonthOptions(keepValue = true, chooseFirst = false) {
  const oldValue = keepValue ? els.compareMonthSelect.value : "";
  const year = els.compareYearSelect.value;
  const months = [...new Set(state.dates
    .filter((date) => !year || date.startsWith(`${year}-`))
    .map((date) => date.slice(5, 7)))]
    .sort((a, b) => Number(b) - Number(a));

  els.compareMonthSelect.innerHTML = `<option value="">Month</option>`;
  months.forEach((month) => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = month;
    els.compareMonthSelect.appendChild(option);
  });
  els.compareMonthSelect.value = months.includes(oldValue) ? oldValue : (chooseFirst ? months[0] || "" : "");
}

function refreshCompareDayOptions(keepValue = true, chooseFirst = false) {
  const oldValue = keepValue ? els.compareDaySelect.value : "";
  const year = els.compareYearSelect.value;
  const month = els.compareMonthSelect.value;
  if (!year || !month) {
    els.compareDaySelect.innerHTML = `<option value="">Day</option>`;
    els.compareDaySelect.value = "";
    els.compareDaySelect.selectedIndex = 0;
    return;
  }

  const prefix = year && month ? `${year}-${month}-` : "";
  const days = [...new Set(state.dates
    .filter((date) => !prefix || date.startsWith(prefix))
    .map((date) => date.slice(8, 10)))]
    .sort((a, b) => Number(b) - Number(a));

  els.compareDaySelect.innerHTML = `<option value="">Day</option>`;
  days.forEach((day) => {
    const option = document.createElement("option");
    option.value = day;
    option.textContent = day;
    els.compareDaySelect.appendChild(option);
  });
  els.compareDaySelect.value = days.includes(oldValue) ? oldValue : (chooseFirst ? days[0] || "" : "");
}

function refreshEndMonthOptions(keepValue = true, chooseFirst = false) {
  const oldValue = keepValue ? els.endMonthSelect.value : "";
  const year = els.endYearSelect.value;
  const months = [...new Set(state.dates
    .filter((date) => !year || date.startsWith(`${year}-`))
    .map((date) => date.slice(5, 7)))]
    .sort((a, b) => Number(b) - Number(a));

  els.endMonthSelect.innerHTML = `<option value="">Month</option>`;
  months.forEach((month) => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = month;
    els.endMonthSelect.appendChild(option);
  });
  els.endMonthSelect.value = months.includes(oldValue) ? oldValue : (chooseFirst ? months[0] || "" : "");
}

function refreshEndDayOptions(keepValue = true, chooseFirst = false) {
  const oldValue = keepValue ? els.endDaySelect.value : "";
  const year = els.endYearSelect.value;
  const month = els.endMonthSelect.value;
  if (!year || !month) {
    els.endDaySelect.innerHTML = `<option value="">Day</option>`;
    els.endDaySelect.value = "";
    els.endDaySelect.selectedIndex = 0;
    return;
  }

  const prefix = `${year}-${month}-`;
  const days = [...new Set(state.dates
    .filter((date) => date.startsWith(prefix))
    .map((date) => date.slice(8, 10)))]
    .sort((a, b) => Number(b) - Number(a));

  els.endDaySelect.innerHTML = `<option value="">Day</option>`;
  days.forEach((day) => {
    const option = document.createElement("option");
    option.value = day;
    option.textContent = day;
    els.endDaySelect.appendChild(option);
  });
  els.endDaySelect.value = days.includes(oldValue) ? oldValue : (chooseFirst ? days[0] || "" : "");
}

function setDateParts(date) {
  if (!date || !state.availableDates.has(date)) {
    els.yearSelect.value = "";
    els.yearSelect.selectedIndex = 0;
    els.monthSelect.innerHTML = `<option value="">Month</option>`;
    els.monthSelect.value = "";
    els.monthSelect.selectedIndex = 0;
    els.daySelect.innerHTML = `<option value="">Day</option>`;
    els.daySelect.value = "";
    els.daySelect.selectedIndex = 0;
    els.startDateInput.value = "";
    renderDateCalendars();
    return;
  }

  const [year, month, day] = date.split("-");
  els.yearSelect.value = year;
  refreshMonthOptions(false);
  els.monthSelect.value = month;
  refreshDayOptions(false);
  els.daySelect.value = day;
  els.startDateInput.value = date;
  renderDateCalendars();
}

function setCompareDateParts(date) {
  if (!date || !state.availableDates.has(date)) {
    els.compareYearSelect.value = "";
    els.compareYearSelect.selectedIndex = 0;
    els.compareMonthSelect.innerHTML = `<option value="">Month</option>`;
    els.compareMonthSelect.value = "";
    els.compareMonthSelect.selectedIndex = 0;
    els.compareDaySelect.innerHTML = `<option value="">Day</option>`;
    els.compareDaySelect.value = "";
    els.compareDaySelect.selectedIndex = 0;
    return;
  }

  const [year, month, day] = date.split("-");
  els.compareYearSelect.value = year;
  refreshCompareMonthOptions(false);
  els.compareMonthSelect.value = month;
  refreshCompareDayOptions(false);
  els.compareDaySelect.value = day;
}

function setEndDateParts(date) {
  if (!date || !state.availableDates.has(date)) {
    els.endYearSelect.value = "";
    els.endYearSelect.selectedIndex = 0;
    els.endMonthSelect.innerHTML = `<option value="">Month</option>`;
    els.endMonthSelect.value = "";
    els.endMonthSelect.selectedIndex = 0;
    els.endDaySelect.innerHTML = `<option value="">Day</option>`;
    els.endDaySelect.value = "";
    els.endDaySelect.selectedIndex = 0;
    els.endDateInput.value = "";
    renderDateCalendars();
    return;
  }

  const [year, month, day] = date.split("-");
  els.endYearSelect.value = year;
  refreshEndMonthOptions(false);
  els.endMonthSelect.value = month;
  refreshEndDayOptions(false);
  els.endDaySelect.value = day;
  els.endDateInput.value = date;
  renderDateCalendars();
}

function nearestComparisonDate(date) {
  if (!state.dates.length) return "";
  return state.dates.find((availableDate) => availableDate !== date) || state.dates[0];
}

function resetFilters() {
  els.genreSelect.value = "all";
  els.shopSelect.value = "all";
  els.granularitySelect.value = "daily";
  clearActivePreset();
  const defaultPreset = [...els.datePresetButtons].find((button) => button.dataset.preset === "183");
  if (defaultPreset) defaultPreset.classList.add("active");
  applyDatePreset("183", false);
  setCompareDateParts("");
  syncDateRangeLabel();
}

function keepComparisonDateDifferent() {
  if (!selectedDate()) return;
  if (selectedCompareDate() === selectedDate()) {
    setCompareDateParts(nearestComparisonDate(selectedDate()));
  }
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

function itemFromCsv(row) {
  return {
    date: row.date,
    shop: row.shop,
    genre: row.genre,
    item: row.item,
    sales: Number(row.sales) || 0,
    units: Number(row.units) || 0
  };
}

function estimateFromCsv(row) {
  return {
    date: row.date,
    shop: row.shop || "",
    genre: row.genre_id || row.genre,
    predictedSales: Number(row.predicted_sales) || 0
  };
}

function rankGapFromCsv(row) {
  return {
    date: row.date,
    genre: row.genre,
    rank: Number(row.rank) || 0,
    shop: row.shop || "",
    source: row.source || "estimated",
    sales: row.sales === "" ? null : Number(row.sales) || 0,
    salesKnown: row.sales !== "",
    lowerRank: Number(row.lower_rank) || 0,
    upperRank: Number(row.upper_rank) || 0,
    lowerSales: Number(row.lower_sales) || 0,
    upperSales: Number(row.upper_sales) || 0
  };
}

function rankCurveFromCsv(row) {
  return {
    genre: row.genre,
    rank: Number(row.rank) || 0,
    estimatedSales: Number(row.estimated_sales) || 0
  };
}

function allTimeSummaryFromCsv(row) {
  return {
    date: "all-time",
    shop: row.shop,
    genre: row.genre,
    sales: Number(row.sales) || 0,
    units: Number(row.units) || 0,
    pageViews: Number(row.page_views) || 0
  };
}

function allTimeMonthlyFromCsv(row) {
  return {
    date: row.date,
    shop: row.shop,
    genre: row.genre,
    sales: Number(row.sales) || 0,
    units: Number(row.units) || 0,
    pageViews: Number(row.page_views) || 0
  };
}

function allTimeItemFromCsv(row) {
  return {
    date: "all-time",
    shop: row.shop,
    genre: row.genre,
    item: row.item,
    sales: Number(row.sales) || 0,
    units: Number(row.units) || 0
  };
}

function genreLabel(id) {
  return state.genreLabels.get(String(id)) || `Genre ${id}`;
}

function syncRangeControls() {
  document.body.classList.toggle("range-mode", isRangeMode());
  const isRange = isRangeMode();
  const startLabel = els.startDateInput.closest("label");
  if (startLabel) {
    startLabel.firstChild.nodeValue = isRange ? "Start date" : "Calendar date";
  }
}

function selectedPeriodDates() {
  const startDate = selectedDate();
  if (!startDate || !state.availableDates.has(startDate)) return [];
  if (!isRangeMode()) return [startDate];

  const endDate = selectedEndDate();
  if (!endDate || !state.availableDates.has(endDate)) return [];

  const first = startDate <= endDate ? startDate : endDate;
  const last = startDate <= endDate ? endDate : startDate;
  return state.dates
    .filter((date) => date >= first && date <= last)
    .sort((a, b) => a.localeCompare(b));
}

function datesEndingOn(endDate, count) {
  if (!endDate || !state.availableDates.has(endDate)) return [];
  return state.dates
    .filter((date) => date <= endDate)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, count)
    .sort((a, b) => a.localeCompare(b));
}

function latestMonthDates() {
  if (!state.latestDate) return [];
  const month = state.latestDate.slice(0, 7);
  return state.dates
    .filter((date) => date.startsWith(month))
    .sort((a, b) => a.localeCompare(b));
}

function monthToDateDates() {
  if (!state.latestDate) return [];
  const start = `${state.latestDate.slice(0, 7)}-01`;
  return datesBetween(start, state.latestDate);
}

function yearToDateDates() {
  if (!state.latestDate) return [];
  const start = `${state.latestDate.slice(0, 4)}-01-01`;
  return datesBetween(start, state.latestDate);
}

function allTimeDates() {
  return [...state.dates].sort((a, b) => a.localeCompare(b));
}

function datesBetween(startDate, endDate) {
  if (!startDate || !endDate) return [];
  const first = startDate <= endDate ? startDate : endDate;
  const last = startDate <= endDate ? endDate : startDate;
  return state.dates
    .filter((date) => date >= first && date <= last)
    .sort((a, b) => a.localeCompare(b));
}

function applyPeriodDates(dates) {
  if (!dates.length) return;
  if (dates.length === 1) {
    els.dateModeSelect.value = "day";
    syncRangeControls();
    setDateParts(dates[0]);
    setEndDateParts("");
    keepComparisonDateDifferent();
    syncDateRangeLabel();
    update();
    return;
  }

  els.dateModeSelect.value = "range";
  syncRangeControls();
  setDateParts(dates[0]);
  setEndDateParts(dates[dates.length - 1]);
  keepComparisonDateDifferent();
  syncDateRangeLabel();
  update();
}

function applyDatePreset(preset, shouldUpdate = true) {
  const count = Number(preset);
  const dates = Number.isFinite(count)
    ? datesEndingOn(state.latestDate, count)
    : preset === "today"
      ? datesEndingOn(state.latestDate, 1)
      : preset === "mtd"
        ? monthToDateDates()
        : preset === "ytd"
          ? yearToDateDates()
          : preset === "all"
            ? allTimeDates()
            : latestMonthDates();

  if (!dates.length) return;
  if (dates.length === 1) {
    els.dateModeSelect.value = "day";
    syncRangeControls();
    setDateParts(dates[0]);
    setEndDateParts("");
  } else {
    els.dateModeSelect.value = "range";
    syncRangeControls();
    setDateParts(dates[0]);
    setEndDateParts(dates[dates.length - 1]);
  }
  keepComparisonDateDifferent();
  syncDateRangeLabel();
  if (shouldUpdate) update();
}

function stageCalendarDate(date) {
  const start = selectedDate();
  const end = selectedEndDate();
  clearActivePreset();

  if (!start || end) {
    els.dateModeSelect.value = "day";
    syncRangeControls();
    setDateParts(date);
    setEndDateParts("");
    syncDateRangeLabel();
    return;
  }

  if (date === start) {
    setEndDateParts("");
    syncDateRangeLabel();
    return;
  }

  els.dateModeSelect.value = "range";
  syncRangeControls();
  if (date < start) {
    setDateParts(date);
    setEndDateParts(start);
  } else {
    setEndDateParts(date);
  }
  syncDateRangeLabel();
}

function nearestAvailableDate(date) {
  if (!date) return "";
  if (state.availableDates.has(date)) return date;
  return [...state.dates]
    .sort((a, b) => a.localeCompare(b))
    .find((availableDate) => availableDate >= date) || state.latestDate || "";
}

function trendDatesForPeriod(periodDates) {
  if (!periodDates.length) return [];
  if (periodDates.length > 1) return periodDates;
  return datesEndingOn(periodDates[0], 14);
}

function bucketKeyForDate(date, granularity) {
  if (granularity === "monthly") return date.slice(0, 7);
  if (granularity !== "weekly") return date;

  const value = new Date(`${date}T00:00:00Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return value.toISOString().slice(0, 10);
}

function bucketLabel(key, granularity) {
  if (granularity === "monthly") return key;
  if (granularity === "weekly") return `Week of ${key.slice(5)}`;
  return key.slice(5);
}

function aggregateTrendRows(rows, dates, granularity, valueKey = "sales") {
  const buckets = new Map();
  dates.forEach((date) => {
    const key = bucketKeyForDate(date, granularity);
    if (!buckets.has(key)) {
      buckets.set(key, { key, label: bucketLabel(key, granularity), dates: [], sales: 0, rowCount: 0 });
    }
    buckets.get(key).dates.push(date);
  });
  rows.forEach((row) => {
    const key = bucketKeyForDate(row.date, granularity);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.sales += row[valueKey] || 0;
      bucket.rowCount += 1;
    }
  });
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function buildShopProjectionSeries(rows, dates, granularity) {
  if (!rows.length) return [];
  const topShops = new Map();
  rows.forEach((row) => {
    if (!row.shop) return;
    topShops.set(row.shop, (topShops.get(row.shop) || 0) + row.predictedSales);
  });
  const shops = [...topShops.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([shop]) => shop);

  return shops.map((shop) => {
    const shopRows = rows.filter((row) => row.shop === shop);
    return {
      shop,
      buckets: aggregateTrendRows(shopRows, dates, granularity, "predictedSales")
        .filter((bucket) => bucket.rowCount > 0)
    };
  }).filter((series) => series.buckets.length);
}

function syncShopProjectionSelection(shops) {
  const key = shops.join("|");
  if (state.shopProjectionSelectionKey !== key) {
    state.shopProjectionSelectionKey = key;
    state.shopProjectionSelected = new Set(shops);
    return;
  }
  const selected = [...state.shopProjectionSelected].filter((shop) => shops.includes(shop));
  state.shopProjectionSelected = new Set(selected);
}

function renderShopProjectionControls(pointSets, renderAgain, keepOpen = false) {
  if (!pointSets.length) {
    els.shopProjectionControls.innerHTML = "";
    return;
  }

  const allSelected = pointSets.every((row) => state.shopProjectionSelected.has(row.shop));
  els.shopProjectionControls.innerHTML = `
    <details class="shop-picker" ${keepOpen ? "open" : ""}>
      <summary>${allSelected ? "All shops" : `${state.shopProjectionSelected.size} shops selected`}</summary>
      <div class="shop-picker-menu">
        <label class="shop-picker-option">
          <input type="checkbox" data-shop-picker-all ${allSelected ? "checked" : ""}>
          All shops
        </label>
        ${pointSets.map((row) => `
          <label class="shop-picker-option">
            <input type="checkbox" data-shop="${row.shop}" ${state.shopProjectionSelected.has(row.shop) ? "checked" : ""}>
            <i style="background: ${row.color}"></i>
            Shop ${row.shop}
          </label>
        `).join("")}
      </div>
    </details>
    <small>Model-predicted values, not actual sales.</small>
  `;

  const allToggle = els.shopProjectionControls.querySelector("[data-shop-picker-all]");
  allToggle?.addEventListener("change", () => {
    state.shopProjectionSelected = allToggle.checked
      ? new Set(pointSets.map((row) => row.shop))
      : new Set();
    renderAgain(true);
  });

  els.shopProjectionControls.querySelectorAll("[data-shop]").forEach((input) => {
    input.addEventListener("change", () => {
      const selected = new Set();
      els.shopProjectionControls.querySelectorAll("[data-shop]").forEach((shopInput) => {
        if (shopInput.checked) selected.add(shopInput.dataset.shop);
      });
      state.shopProjectionSelected = selected;
      renderAgain(true);
    });
  });
}

function eventsForDates(dates) {
  if (!dates.length) return [];
  const first = dates[0];
  const last = dates[dates.length - 1];
  return state.events
    .filter((event) => event.start_date <= last && event.end_date >= first)
    .map((event) => event.name);
}

function pointTooltip(point) {
  const events = eventsForDates(point.dates);
  const promotionLine = events.length
    ? `Promotion: ${events.join(", ")}`
    : "Promotion: No promotion listed";
  return `${point.label}\nSales: ${yen.format(point.value)}\n${promotionLine}`;
}

function compactYen(value) {
  if (value >= 100000000) return `JPY ${(value / 100000000).toFixed(1)}B`;
  if (value >= 1000000) return `JPY ${(value / 1000000).toFixed(0)}M`;
  if (value >= 1000) return `JPY ${(value / 1000).toFixed(0)}K`;
  return yen.format(value);
}

function positionTrendTooltip(tooltip, event) {
  const chart = tooltip.closest(".trend-chart") || els.trendChart;
  const chartRect = chart.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const targetRect = event.currentTarget?.getBoundingClientRect();
  const clientX = event.clientX || (targetRect ? targetRect.left + targetRect.width / 2 : chartRect.left + 20);
  const clientY = event.clientY || (targetRect ? targetRect.top + targetRect.height / 2 : chartRect.top + 20);
  const x = Math.min(chartRect.width - tooltipRect.width - 12, Math.max(12, clientX - chartRect.left + 14));
  const y = Math.min(chartRect.height - tooltipRect.height - 12, Math.max(12, clientY - chartRect.top - tooltipRect.height - 10));
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function showTrendTooltip(point, tooltip, event) {
  const lines = point.dataset.tooltip.split("\n");
  tooltip.innerHTML = `
    <strong>${escapeHtml(lines[0] || "")}</strong>
    <span>${escapeHtml(lines[1] || "")}</span>
    <span>${escapeHtml(lines[2] || "")}</span>
  `;
  tooltip.hidden = false;
  positionTrendTooltip(tooltip, event);
}

function attachTrendTooltipHandlers(chart = els.trendChart) {
  const tooltip = chart.querySelector(".trend-tooltip");
  if (!tooltip) return;

  chart.querySelectorAll(".trend-hover-target").forEach((point) => {
    point.addEventListener("mouseenter", (event) => showTrendTooltip(point, tooltip, event));
    point.addEventListener("mousemove", (event) => positionTrendTooltip(tooltip, event));
    point.addEventListener("mouseleave", () => {
      tooltip.hidden = true;
    });
    point.addEventListener("focus", (event) => showTrendTooltip(point, tooltip, event));
    point.addEventListener("blur", () => {
      tooltip.hidden = true;
    });
  });
}

function periodLabel(dates) {
  if (!dates.length) return "";
  if (dates.length === 1) return dates[0];
  return `${dates[0]} to ${dates[dates.length - 1]}`;
}

function isAllTimeView(dates) {
  if (!dates.length || !state.dates?.length) return false;
  const allDates = [...state.dates].sort((a, b) => a.localeCompare(b));
  return dates.length === allDates.length
    && dates[0] === allDates[0]
    && dates[dates.length - 1] === allDates[allDates.length - 1];
}

async function loadPeriodDates(dates) {
  const dateSet = new Set(dates);
  const months = monthsForDates(dates);
  els.loadStatus.textContent = `Loading ${whole.format(months.length)} month file${months.length === 1 ? "" : "s"}...`;
  const rowSets = await Promise.all(months.map((month) => loadMonth(month)));
  return rowSets.flat().filter((row) => dateSet.has(row.date));
}

async function loadPeriodItems(dates) {
  const dateSet = new Set(dates);
  const months = monthsForDates(dates);
  const rowSets = await Promise.all(months.map((month) => loadItemMonth(month)));
  return rowSets.flat().filter((row) => dateSet.has(row.date));
}

async function loadPeriodShopEstimates(dates) {
  const dateSet = new Set(dates);
  const months = monthsForDates(dates);
  const rowSets = await Promise.all(months.map((month) => loadShopEstimateMonth(month)));
  return rowSets.flat().filter((row) => dateSet.has(row.date));
}

async function loadPeriodRankGaps(dates) {
  const months = monthsForDates(dates);
  const rowSets = await Promise.all(months.map((month) => loadRankGapMonth(month)));
  return rowSets.flat();
}

async function update() {
  const genre = els.genreSelect.value;
  const shop = els.shopSelect.value;
  const periodDates = selectedPeriodDates();
  const currentLabel = periodLabel(periodDates);
  const compareDate = selectedCompareDate();

  if (!periodDates.length) {
    renderEmptyState();
    renderEvents(periodDates);
    return;
  }

  if (isAllTimeView(periodDates)) {
    const allTimeData = await loadAllTimeData();
    const monthlyDates = [...new Set(allTimeData.monthlyRows.map((row) => row.date))]
      .sort((a, b) => a.localeCompare(b));
    const baseRows = filterRows(allTimeData.summaryRows, { genre, shop });
    const baseItems = filterRows(allTimeData.itemRows, { genre, shop });
    const trendRows = filterRows(allTimeData.monthlyRows, { genre, shop });
    const shopProjectionRows = shopProjectionRowsForChart(allTimeData.shopEstimateRows, monthlyDates, { genre, shop });
    const compareRows = compareDate && state.availableDates.has(compareDate)
      ? filterRows(await loadPeriodDates([compareDate]), { genre, shop })
      : [];

    renderSummary(baseRows);
    renderTrendChart(trendRows, monthlyDates, currentLabel, "monthly");
    renderShopProjectionChart(shopProjectionRows, monthlyDates, currentLabel, "monthly");
    renderShopComparison(baseRows);
    renderDayComparison(baseRows, compareRows, currentLabel, compareDate);
    renderTopItems(baseItems);
    renderRankGapEstimates(allTimeData.rankRows, periodDates);
    renderEvents(periodDates);
    els.loadStatus.textContent = `Compact all-time view loaded for ${currentLabel}`;
    return;
  }

  const chartDates = trendDatesForPeriod(periodDates);
  const [dateRows, itemRows, chartRows, shopEstimateRows, rankGapRows] = await Promise.all([
    loadPeriodDates(periodDates),
    loadPeriodItems(periodDates),
    loadPeriodDates(chartDates),
    loadPeriodShopEstimates(chartDates),
    loadPeriodRankGaps(periodDates)
  ]);
  const baseRows = filterRows(dateRows, { genre, shop });
  const baseItems = filterRows(itemRows, { genre, shop });
  const trendRows = filterRows(chartRows, { genre, shop });
  const shopProjectionRows = shopProjectionRowsForChart(shopEstimateRows, chartDates, { genre, shop });
  const compareRows = compareDate && state.availableDates.has(compareDate)
    ? filterRows(await loadPeriodDates([compareDate]), { genre, shop })
    : [];

  renderSummary(baseRows);
  renderTrendChart(trendRows, chartDates, currentLabel);
  renderShopProjectionChart(shopProjectionRows, chartDates, currentLabel);
  renderShopComparison(baseRows);
  renderDayComparison(baseRows, compareRows, currentLabel, compareDate);
  renderTopItems(baseItems);
  renderRankGapEstimates(rankGapRows, periodDates);
  renderEvents(periodDates);
  els.loadStatus.textContent = periodDates.length > 1
    ? `${whole.format(periodDates.length)} days loaded for ${currentLabel}`
    : `Ready for ${currentLabel}`;
}

function filterRows(rows, filters) {
  return rows.filter((row) => {
    if (filters.shop !== "all" && row.shop !== filters.shop) return false;
    if (filters.genre !== "all" && row.genre !== filters.genre) return false;
    return true;
  });
}

function filterEstimateRows(rows, dates, filters) {
  const dateSet = new Set(dates);
  return rows.filter((row) => {
    if (!dateSet.has(row.date)) return false;
    if (filters.genre !== "all" && row.genre !== filters.genre) return false;
    if (filters.shop !== "all" && row.shop && row.shop !== filters.shop) return false;
    return true;
  });
}

function shopProjectionRowsForChart(rows, dates, filters) {
  if (filters.genre === "all" && filters.shop === "all") return [];
  return filterEstimateRows(rows, dates, filters);
}

function renderEmptyState() {
  els.salesMetric.textContent = "-";
  els.unitsMetric.textContent = "-";
  els.pageViewsMetric.textContent = "-";
  els.trendSubtitle.textContent = "Choose a day or period";
  els.trendChart.innerHTML = `<div class="empty">${isRangeMode() ? "Choose a start and end day" : "Choose a day"} to see the sales trend.</div>`;
  els.shopProjectionSubtitle.textContent = "Choose one genre or shop";
  els.shopProjectionControls.innerHTML = "";
  els.shopProjectionChart.innerHTML = `<div class="empty">Choose one genre or shop to see TENKi shop projections.</div>`;
  const prompt = isRangeMode() ? "Choose a start and end day" : "Choose a day";
  els.shopCompareCount.textContent = prompt;
  els.shopCompareBody.innerHTML = `<tr><td colspan="5">${prompt} to compare shops.</td></tr>`;
  els.dayCompareStatus.textContent = prompt;
  els.dayCompareBody.innerHTML = `<div class="empty">${prompt} to compare sales by date.</div>`;
  els.topItemsCount.textContent = prompt;
  els.topItemsBody.innerHTML = `<tr><td colspan="6">${prompt} to see top items.</td></tr>`;
  els.rankGapCount.textContent = prompt;
  els.rankGapBody.innerHTML = `<tr><td colspan="4">${prompt} to see rank 1-20 estimates.</td></tr>`;
}

function monthsForDates(dates) {
  return [...new Set(dates.map((date) => date.slice(0, 7)))].sort((a, b) => a.localeCompare(b));
}

async function loadMonth(month) {
  if (state.loadedMonths.has(month)) return state.loadedMonths.get(month);
  els.loadStatus.textContent = `Loading ${month}...`;
  const text = await fetch(`${BY_MONTH_URL}/${month}.csv`).then((response) => response.text());
  const rows = parseCsv(text).map(rowFromCsv);
  state.loadedMonths.set(month, rows);
  els.loadStatus.textContent = `${whole.format(rows.length)} records loaded for ${month}`;
  return rows;
}

async function loadItemMonth(month) {
  if (state.loadedItemMonths.has(month)) return state.loadedItemMonths.get(month);
  const text = await fetch(`${ITEMS_BY_MONTH_URL}/${month}.csv`).then((response) => response.text());
  const rows = parseCsv(text).map(itemFromCsv);
  state.loadedItemMonths.set(month, rows);
  return rows;
}

async function loadShopEstimateMonth(month) {
  if (state.loadedShopEstimateMonths.has(month)) return state.loadedShopEstimateMonths.get(month);
  const response = await fetch(`${SHOP_ESTIMATES_BY_MONTH_URL}/${month}.csv?v=${SHOP_PROJECTION_VERSION}`);
  if (!response.ok) {
    state.loadedShopEstimateMonths.set(month, []);
    return [];
  }
  const text = await response.text();
  const rows = parseCsv(text).map(estimateFromCsv);
  state.loadedShopEstimateMonths.set(month, rows);
  return rows;
}

async function loadRankGapMonth(month) {
  if (state.loadedRankGapMonths.has(month)) return state.loadedRankGapMonths.get(month);
  const response = await fetch(`${RANK_GAP_URL}/${month}.csv?v=${RANK_DATA_VERSION}`);
  if (!response.ok) {
    state.loadedRankGapMonths.set(month, []);
    return [];
  }
  const text = await response.text();
  const rows = parseCsv(text).map(rankGapFromCsv);
  state.loadedRankGapMonths.set(month, rows);
  return rows;
}

async function loadAllTimeData() {
  if (state.allTimeData) return state.allTimeData;
  els.loadStatus.textContent = "Loading compact all-time data...";
  const [
    summaryText,
    monthlyText,
    itemsText,
    shopEstimatesText,
    rankRowsText
  ] = await Promise.all([
    fetch(`${ALL_TIME_URL}/summary.csv?v=${ALL_TIME_DATA_VERSION}`).then((response) => response.text()),
    fetch(`${ALL_TIME_URL}/monthly.csv?v=${ALL_TIME_DATA_VERSION}`).then((response) => response.text()),
    fetch(`${ALL_TIME_URL}/items.csv?v=${ALL_TIME_DATA_VERSION}`).then((response) => response.text()),
    fetch(`${ALL_TIME_URL}/shop_estimates_monthly.csv?v=${ALL_TIME_DATA_VERSION}`).then((response) => response.text()),
    fetch(`${ALL_TIME_URL}/ranked_shops_latest.csv?v=${ALL_TIME_DATA_VERSION}`).then((response) => response.text())
  ]);
  state.allTimeData = {
    summaryRows: parseCsv(summaryText).map(allTimeSummaryFromCsv),
    monthlyRows: parseCsv(monthlyText).map(allTimeMonthlyFromCsv),
    itemRows: parseCsv(itemsText).map(allTimeItemFromCsv),
    shopEstimateRows: parseCsv(shopEstimatesText).map(estimateFromCsv),
    rankRows: parseCsv(rankRowsText).map(rankGapFromCsv)
  };
  return state.allTimeData;
}

function renderSummary(rows) {
  const totals = rows.reduce((acc, row) => {
    acc.sales += row.sales;
    acc.units += row.units;
    acc.pageViews += row.pageViews;
    return acc;
  }, { sales: 0, units: 0, pageViews: 0 });

  els.salesMetric.textContent = yen.format(totals.sales);
  els.unitsMetric.textContent = whole.format(totals.units);
  els.pageViewsMetric.textContent = whole.format(totals.pageViews);
}

function renderTrendChart(rows, dates, label, forcedGranularity = "") {
  if (!dates.length) {
    els.trendSubtitle.textContent = "Choose a day or period";
    els.trendChart.innerHTML = `<div class="empty">Choose dates to see sales trends.</div>`;
    return;
  }

  const granularity = forcedGranularity || els.granularitySelect.value || "daily";
  const showEventMarkers = !forcedGranularity && !isAllTimeView(dates);
  const buckets = aggregateTrendRows(rows, dates, granularity);
  const values = buckets.map((bucket) => bucket.sales);
  const max = Math.max(...values, 1);
  const width = 760;
  const height = 230;
  const padX = 62;
  const padTop = 22;
  const padBottom = 44;
  const plotWidth = width - (padX * 2);
  const plotHeight = height - padTop - padBottom;
  const points = values.map((value, index) => {
    const x = buckets.length === 1 ? width / 2 : padX + (plotWidth * index) / (buckets.length - 1);
    const y = padTop + plotHeight - ((value / max) * plotHeight);
    return {
      x,
      y,
      value,
      label: buckets[index].label,
      key: buckets[index].key,
      dates: buckets[index].dates
    };
  });
  const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${padX},${height - padBottom} ${line} ${width - padX},${height - padBottom}`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: max * ratio,
    y: padTop + plotHeight - (plotHeight * ratio)
  }));
  const ticks = points.filter((_, index) => (
    index === 0 || index === points.length - 1 || index === Math.floor((points.length - 1) / 2)
  ));

  els.trendSubtitle.textContent = dates.length === 1
    ? `${label} sales`
    : `${dates[0]} to ${dates[dates.length - 1]} ${granularity} sales`;

  els.trendChart.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily sales trend chart">
      ${yTicks.map((tick) => `
        <line x1="${padX}" y1="${tick.y.toFixed(1)}" x2="${width - padX}" y2="${tick.y.toFixed(1)}" class="trend-grid"></line>
        <text x="${padX - 8}" y="${(tick.y + 4).toFixed(1)}" text-anchor="end" class="trend-y-label">${compactYen(tick.value)}</text>
      `).join("")}
      <polygon points="${area}" class="trend-area"></polygon>
      <polyline points="${line}" class="trend-line"></polyline>
      ${points.map((point) => {
        const hasEvent = showEventMarkers && eventsForDates(point.dates).length > 0;
        const tooltip = escapeHtml(pointTooltip(point));
        return `
          <circle
            cx="${point.x.toFixed(1)}"
            cy="${point.y.toFixed(1)}"
            r="${hasEvent ? 3 : 1.7}"
            class="trend-point${hasEvent ? " has-event" : ""}">
          </circle>
          <circle
            cx="${point.x.toFixed(1)}"
            cy="${point.y.toFixed(1)}"
            r="9"
            class="trend-hover-target${hasEvent ? " has-event" : ""}"
            fill="transparent"
            stroke="transparent"
            tabindex="0"
            data-tooltip="${tooltip}">
          </circle>
        `;
      }).join("")}
      ${ticks.map((point) => `
        <text x="${point.x.toFixed(1)}" y="${height - 16}" text-anchor="middle" class="trend-tick">${point.label}</text>
      `).join("")}
    </svg>
    <div class="trend-tooltip" hidden></div>
  `;
  attachTrendTooltipHandlers();
}

function renderShopProjectionChart(rows, dates, label, forcedGranularity = "", keepOpen = false) {
  if (!dates.length) {
    els.shopProjectionSubtitle.textContent = "Choose a day or period";
    els.shopProjectionControls.innerHTML = "";
    els.shopProjectionChart.innerHTML = `<div class="empty">Choose dates to see TENKi shop projections.</div>`;
    return;
  }

  if (!rows.length) {
    els.shopProjectionSubtitle.textContent = "Choose one genre or shop";
    els.shopProjectionControls.innerHTML = "";
    els.shopProjectionChart.innerHTML = `<div class="empty">Choose one product genre or shop to see separate TENKi shop projection lines.</div>`;
    return;
  }

  const granularity = forcedGranularity || els.granularitySelect.value || "daily";
  const buckets = aggregateTrendRows([], dates, granularity);
  const bucketIndexes = new Map(buckets.map((bucket, index) => [bucket.key, index]));
  const series = buildShopProjectionSeries(rows, dates, granularity);
  syncShopProjectionSelection(series.map((row) => row.shop));
  const width = 760;
  const height = 230;
  const padX = 62;
  const padTop = 22;
  const padBottom = 44;
  const plotWidth = width - (padX * 2);
  const plotHeight = height - padTop - padBottom;
  const allPointSets = series.map((row, seriesIndex) => {
    const color = shopProjectionColors[seriesIndex % shopProjectionColors.length];
    return { row, color };
  });
  const visibleSeries = allPointSets.filter((seriesRow) => state.shopProjectionSelected.has(seriesRow.row.shop));
  const values = visibleSeries.flatMap((seriesRow) => seriesRow.row.buckets.map((bucket) => bucket.sales));
  const max = Math.max(...values, 1);
  const pointSets = allPointSets.map(({ row, color }) => {
    const points = row.buckets.map((bucket) => {
      const index = bucketIndexes.get(bucket.key) || 0;
      const value = bucket.sales;
      const x = buckets.length === 1 ? width / 2 : padX + (plotWidth * index) / (buckets.length - 1);
      const y = padTop + plotHeight - ((value / max) * plotHeight);
      return {
        x,
        y,
        value,
        label: bucket.label
      };
    });
    return {
      shop: row.shop,
      color,
      points,
      line: points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")
    };
  }).filter((row) => state.shopProjectionSelected.has(row.shop));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: max * ratio,
    y: padTop + plotHeight - (plotHeight * ratio)
  }));
  const ticks = buckets.filter((_, index) => (
    index === 0 || index === buckets.length - 1 || index === Math.floor((buckets.length - 1) / 2)
  ));
  els.shopProjectionSubtitle.textContent = `${label} ${granularity} projection by shop`;
  const controlPointSets = allPointSets.map(({ row, color }) => ({ shop: row.shop, color }));
  renderShopProjectionControls(controlPointSets, (nextKeepOpen = false) => {
    renderShopProjectionChart(rows, dates, label, forcedGranularity, nextKeepOpen);
  }, keepOpen);

  if (!pointSets.length) {
    els.shopProjectionChart.innerHTML = `<div class="empty">Select at least one shop from the dropdown.</div>`;
    return;
  }

  els.shopProjectionChart.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="TENKi shop projection chart">
      ${yTicks.map((tick) => `
        <line x1="${padX}" y1="${tick.y.toFixed(1)}" x2="${width - padX}" y2="${tick.y.toFixed(1)}" class="trend-grid"></line>
        <text x="${padX - 8}" y="${(tick.y + 4).toFixed(1)}" text-anchor="end" class="trend-y-label">${compactYen(tick.value)}</text>
      `).join("")}
      ${pointSets.map((row) => `
        <polyline points="${row.line}" class="trend-shop-projection-line" style="stroke: ${row.color}"></polyline>
      `).join("")}
      ${pointSets.flatMap((row) => row.points.map((point) => {
        const tooltip = escapeHtml(`${point.label}\nShop ${row.shop}\n${yen.format(point.value)}`);
        return `
          <circle
            cx="${point.x.toFixed(1)}"
            cy="${point.y.toFixed(1)}"
            r="7"
            class="trend-hover-target shop-projection-target"
            fill="transparent"
            stroke="transparent"
            tabindex="0"
            data-tooltip="${tooltip}">
          </circle>
        `;
      })).join("")}
      ${ticks.map((point) => `
        <text x="${(buckets.length === 1 ? width / 2 : padX + (plotWidth * bucketIndexes.get(point.key)) / (buckets.length - 1)).toFixed(1)}" y="${height - 16}" text-anchor="middle" class="trend-tick">${point.label}</text>
      `).join("")}
    </svg>
    <div class="shop-projection-legend">
      ${pointSets.map((row) => `
        <span class="shop-projection-key">
          <i style="background: ${row.color}"></i>
          Shop ${row.shop}
        </span>
      `).join("")}
    </div>
    <div class="trend-tooltip" hidden></div>
  `;
  attachTrendTooltipHandlers(els.shopProjectionChart);
}

function renderTopItems(rows) {
  const itemTotals = new Map();
  rows.forEach((row) => {
    const key = `${row.item}|${row.shop}|${row.genre}`;
    const current = itemTotals.get(key) || { item: row.item, shop: row.shop, genre: row.genre, sales: 0, units: 0 };
    current.sales += row.sales;
    current.units += row.units;
    itemTotals.set(key, current);
  });
  const allItems = [...itemTotals.values()];
  const topItems = allItems.sort((a, b) => b.units - a.units || b.sales - a.sales).slice(0, 25);
  els.topItemsCount.textContent = `${whole.format(allItems.length)} sold items`;
  if (!topItems.length) {
    els.topItemsBody.innerHTML = `<tr><td colspan="6">No sold items found for this search.</td></tr>`;
    return;
  }

  els.topItemsBody.innerHTML = topItems.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>Item ${row.item}</td>
      <td>Shop ${row.shop}</td>
      <td>${genreLabel(row.genre)}</td>
      <td>${yen.format(row.sales)}</td>
      <td>${whole.format(row.units)}</td>
    </tr>
  `).join("");
}

function renderRankGapEstimates(rows, dates) {
  const genre = els.genreSelect.value;
  if (genre === "all") {
    els.rankGapCount.textContent = "Choose one genre";
    els.rankGapBody.innerHTML = `<tr><td colspan="4">Choose one product genre to see a rank 1-20 table.</td></tr>`;
    return;
  }
  if (GENRES_WITHOUT_RANK_DATA.has(genre)) {
    els.rankGapCount.textContent = "No rank file";
    els.rankGapBody.innerHTML = `<tr><td colspan="4">The local TENKi files do not include a ranking file for ${genreLabel(genre)}.</td></tr>`;
    return;
  }

  const availableRankDates = new Set(rows
    .filter((row) => row.genre === genre && row.rank >= 1 && row.rank <= 20)
    .map((row) => row.date));
  const rankDate = [...dates].reverse().find((date) => availableRankDates.has(date));
  if (!rankDate) {
    els.rankGapCount.textContent = "No rank data";
    els.rankGapBody.innerHTML = `<tr><td colspan="4">No rank data found for ${periodLabel(dates)} and ${genreLabel(genre)}.</td></tr>`;
    return;
  }

  const filtered = rows.filter((row) => row.date === rankDate && row.genre === genre && row.rank >= 1 && row.rank <= 20);
  if (!filtered.length) {
    els.rankGapCount.textContent = "No rank data";
    els.rankGapBody.innerHTML = `<tr><td colspan="4">No rank data found for ${rankDate} and ${genreLabel(genre)}.</td></tr>`;
    return;
  }

  const fallbackByRank = new Map();
  rows
    .filter((row) => row.genre === genre && row.rank >= 1 && row.rank <= 20 && row.salesKnown)
    .forEach((row) => {
      const values = fallbackByRank.get(row.rank) || [];
      values.push(row.sales);
      fallbackByRank.set(row.rank, values);
    });
  fallbackByRank.forEach((values, rank) => {
    values.sort((a, b) => a - b);
    fallbackByRank.set(rank, values[Math.floor(values.length / 2)]);
  });
  const curveByRank = state.rankCurves.get(genre) || new Map();

  const estimateForRank = (rank) => {
    const rankRows = filtered.filter((row) => row.rank === rank);
    const actualWithSales = rankRows.find((row) => row.source === "actual" && row.salesKnown);
    if (actualWithSales) return { sales: actualWithSales.sales, source: "actual" };

    const sameDayEstimate = rankRows.find((row) => row.source === "estimated" && row.salesKnown);
    if (sameDayEstimate) return { sales: sameDayEstimate.sales, source: "estimated" };

    const curveSales = curveByRank.get(rank);
    if (Number.isFinite(curveSales)) return { sales: curveSales, source: "estimated" };

    const fallbackSales = fallbackByRank.get(rank);
    if (Number.isFinite(fallbackSales)) return { sales: fallbackSales, source: "estimated" };

    return { sales: 0, source: "missing" };
  };

  const displayRows = [];
  const byShop = new Map();
  filtered.forEach((row) => {
    if (row.source !== "actual" || !row.shop) return;
    const estimate = estimateForRank(row.rank);
    if (estimate.source === "actual") {
      const current = byShop.get(row.shop) || {
        shop: row.shop,
        sales: 0,
        ranks: new Set()
      };
      current.sales += estimate.sales;
      current.ranks.add(row.rank);
      byShop.set(row.shop, current);
      return;
    }

    displayRows.push({
      label: `Estimated shop (rank #${whole.format(row.rank)})`,
      sales: estimate.sales,
      source: "estimated"
    });
  });

  byShop.forEach((row) => {
    displayRows.push({
      label: `Shop ${row.shop}`,
      sales: row.sales,
      source: "actual"
    });
  });

  const topRows = displayRows
    .sort((a, b) => b.sales - a.sales || a.label.localeCompare(b.label))
    .slice(0, 20);

  els.rankGapCount.textContent = `Top shop totals for ${rankDate}`;
  els.rankGapBody.innerHTML = topRows.map((row, index) => {
    const source = row.source === "actual"
      ? `<span class="source-pill actual">TENKi actual</span>`
      : `<span class="source-pill estimated">Estimated</span>`;
    return `
      <tr class="${row.source === "estimated" ? "estimated-rank-row" : "actual-rank-row"}">
        <td>#${whole.format(index + 1)}</td>
        <td>${row.label}</td>
        <td>${yen.format(row.sales)}</td>
        <td>${source}</td>
      </tr>
    `;
  }).join("");
}

function totalsFor(rows) {
  return rows.reduce((acc, row) => {
    acc.sales += row.sales;
    acc.units += row.units;
    return acc;
  }, { sales: 0, units: 0 });
}

function renderShopComparison(rows) {
  const totalSales = rows.reduce((sum, row) => sum + row.sales, 0);
  const shops = new Map();

  rows.forEach((row) => {
    const current = shops.get(row.shop) || { shop: row.shop, sales: 0, units: 0 };
    current.sales += row.sales;
    current.units += row.units;
    shops.set(row.shop, current);
  });

  const ranked = [...shops.values()].sort((a, b) => b.sales - a.sales || b.units - a.units).slice(0, 20);
  els.shopCompareCount.textContent = `${whole.format(shops.size)} shops`;

  if (!ranked.length) {
    els.shopCompareBody.innerHTML = `<tr><td colspan="5">No shops found for this search.</td></tr>`;
    return;
  }

  els.shopCompareBody.innerHTML = ranked.map((row, index) => {
    const share = totalSales ? `${((row.sales / totalSales) * 100).toFixed(1)}%` : "-";
    return `
      <tr>
        <td>${index + 1}</td>
        <td>Shop ${row.shop}</td>
        <td>${yen.format(row.sales)}</td>
        <td>${whole.format(row.units)}</td>
        <td>${share}</td>
      </tr>
    `;
  }).join("");
}

function formatChange(current, comparison, formatter) {
  const difference = current - comparison;
  const sign = difference > 0 ? "+" : "";
  return `${sign}${formatter.format(difference)}`;
}

function formatPercentChange(current, comparison) {
  if (!comparison) return current ? "+100%" : "0%";
  const percent = ((current - comparison) / comparison) * 100;
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(1)}%`;
}

function changeTone(current, comparison) {
  if (current > comparison) return "positive";
  if (current < comparison) return "negative";
  return "neutral";
}

function changeLabel(current, comparison) {
  if (current > comparison) return "Higher";
  if (current < comparison) return "Lower";
  return "Same";
}

function renderDayComparison(currentRows, compareRows, date, compareDate) {
  if (!compareDate || !state.availableDates.has(compareDate)) {
    els.dayCompareStatus.textContent = "Choose another day";
    els.dayCompareBody.innerHTML = `<div class="empty">Choose another day to compare against ${date}.</div>`;
    return;
  }

  const current = totalsFor(currentRows);
  const comparison = totalsFor(compareRows);
  const salesTone = changeTone(current.sales, comparison.sales);
  const unitsTone = changeTone(current.units, comparison.units);
  els.dayCompareStatus.textContent = `${date} vs ${compareDate}`;

  els.dayCompareBody.innerHTML = `
    <div class="compare-day-card selected-day">
      <span>${isRangeMode() ? "Selected period" : "Selected day"}</span>
      <strong>${date}</strong>
      <div>${yen.format(current.sales)}</div>
      <small>${whole.format(current.units)} units</small>
    </div>
    <div class="compare-day-card">
      <span>Comparison day</span>
      <strong>${compareDate}</strong>
      <div>${yen.format(comparison.sales)}</div>
      <small>${whole.format(comparison.units)} units</small>
    </div>
    <div class="change-summary">
      <div class="change-line ${salesTone}">
        <span>Sales</span>
        <strong>${changeLabel(current.sales, comparison.sales)} by ${formatChange(current.sales, comparison.sales, yen)}</strong>
        <small>${formatPercentChange(current.sales, comparison.sales)} vs comparison day</small>
      </div>
      <div class="change-line ${unitsTone}">
        <span>Units</span>
        <strong>${changeLabel(current.units, comparison.units)} by ${formatChange(current.units, comparison.units, whole)}</strong>
        <small>${formatPercentChange(current.units, comparison.units)} vs comparison day</small>
      </div>
    </div>
  `;
}

function renderEvents(date) {
  const dates = Array.isArray(date) ? date : (date ? [date] : []);
  els.eventsTitle.textContent = dates.length > 1 ? "Events During Selected Period" : "Events On Selected Day";
  if (!dates.length) {
    els.eventCount.textContent = isRangeMode() ? "Choose a period" : "Choose a day";
    els.eventList.innerHTML = `<div class="empty">${isRangeMode() ? "Choose a start and end day" : "Choose a specific day"} to see calendar events.</div>`;
    return;
  }

  const first = dates[0];
  const last = dates[dates.length - 1];
  const matches = state.events.filter((event) => event.start_date <= last && event.end_date >= first);
  const uniqueEvents = [...new Set(matches.map((event) => event.name))].sort((a, b) => a.localeCompare(b));
  els.eventCount.textContent = `${uniqueEvents.length} events`;
  els.eventList.innerHTML = uniqueEvents.length
    ? uniqueEvents.map((name) => `<span class="event-chip">${name}</span>`).join("")
    : `<div class="empty">No listed events for ${periodLabel(dates)}.</div>`;
}

async function init() {
  try {
    const [optionsText, eventsText, rankCurvesText] = await Promise.all([
      fetch(OPTIONS_URL).then((response) => response.text()),
      fetch(EVENTS_URL).then((response) => response.text()),
      fetch(RANK_CURVES_URL).then((response) => response.text())
    ]);

    const options = parseCsv(optionsText);
    const genreOptions = options
      .filter((row) => row.type === "genre")
      .sort((a, b) => (Number(b.sales) || 0) - (Number(a.sales) || 0) || a.label.localeCompare(b.label));
    state.genreLabels = new Map(genreOptions.map((row) => [row.id, row.label]));
    addOptions(els.genreSelect, genreOptions);
    addOptions(els.shopSelect, options.filter((row) => row.type === "shop"));
    const dateRows = options.filter((row) => row.type === "date");
    buildDateControls(dateRows);

    state.events = parseCsv(eventsText);
    state.rankCurves = parseCsv(rankCurvesText).map(rankCurveFromCsv).reduce((map, row) => {
      if (!map.has(row.genre)) map.set(row.genre, new Map());
      map.get(row.genre).set(row.rank, row.estimatedSales);
      return map;
    }, new Map());
    const defaultPreset = [...els.datePresetButtons].find((button) => button.dataset.preset === "183");
    if (defaultPreset) defaultPreset.classList.add("active");
    applyDatePreset("183", false);
    setCompareDateParts(nearestComparisonDate(selectedDate()));
    syncRangeControls();
    syncDateRangeLabel();
    els.loadStatus.textContent = "Ready";
    setEnabled(true);
    await update();
  } catch (error) {
    els.loadStatus.textContent = "Could not load data files";
    els.topItemsBody.innerHTML = `<tr><td colspan="6">Open this site through a local web server so the CSV files can load.</td></tr>`;
    console.error(error);
  }
}

[els.genreSelect, els.shopSelect].forEach((el) => {
  el.addEventListener("input", () => update());
});

els.dateModeSelect.addEventListener("input", () => {
  syncRangeControls();
  syncDateRangeLabel();
  update();
});

els.yearSelect.addEventListener("input", () => {
  refreshMonthOptions(false);
  refreshDayOptions(false);
  syncCalendarInputs();
  clearActivePreset();
  syncDateRangeLabel();
  keepComparisonDateDifferent();
  update();
});

els.monthSelect.addEventListener("input", () => {
  refreshDayOptions(false);
  syncCalendarInputs();
  clearActivePreset();
  syncDateRangeLabel();
  keepComparisonDateDifferent();
  update();
});

els.daySelect.addEventListener("input", () => {
  syncCalendarInputs();
  clearActivePreset();
  syncDateRangeLabel();
  keepComparisonDateDifferent();
  update();
});

els.endYearSelect.addEventListener("input", () => {
  refreshEndMonthOptions(false);
  refreshEndDayOptions(false);
  syncCalendarInputs();
  clearActivePreset();
  syncDateRangeLabel();
  update();
});

els.endMonthSelect.addEventListener("input", () => {
  refreshEndDayOptions(false);
  syncCalendarInputs();
  clearActivePreset();
  syncDateRangeLabel();
  update();
});

els.endDaySelect.addEventListener("input", () => {
  syncCalendarInputs();
  clearActivePreset();
  syncDateRangeLabel();
  update();
});

els.startDateInput.addEventListener("input", () => {
  const date = nearestAvailableDate(els.startDateInput.value);
  if (!date) return;
  setDateParts(date);
  setEndDateParts("");
  clearActivePreset();
  syncDateRangeLabel();
});

els.endDateInput.addEventListener("input", () => {
  const date = nearestAvailableDate(els.endDateInput.value);
  if (!date) return;
  if (!isRangeMode()) {
    els.dateModeSelect.value = "range";
    syncRangeControls();
  }
  setEndDateParts(date);
  clearActivePreset();
  syncDateRangeLabel();
});

els.dateRangeButton.addEventListener("click", (event) => {
  event.stopPropagation();
  setDatePopoverOpen(els.datePopover.hidden);
});

els.datePopover.addEventListener("click", (event) => {
  event.stopPropagation();
});

els.clearDateButton.addEventListener("click", () => {
  clearActivePreset();
  setDateParts("");
  setEndDateParts("");
  syncDateRangeLabel();
  update();
});

els.applyDateButton.addEventListener("click", () => {
  const start = nearestAvailableDate(els.startDateInput.value);
  const end = nearestAvailableDate(els.endDateInput.value || els.startDateInput.value);
  const dates = datesBetween(start, end);
  clearActivePreset();
  applyPeriodDates(dates);
  setDatePopoverOpen(false);
});

els.dateCalendarGrid.addEventListener("click", (event) => {
  event.stopPropagation();
  const button = event.target.closest(".calendar-day");
  if (!button || button.disabled) return;
  stageCalendarDate(button.dataset.date);
});

els.compareYearSelect.addEventListener("input", () => {
  refreshCompareMonthOptions(false);
  refreshCompareDayOptions(false);
  update();
});

els.compareMonthSelect.addEventListener("input", () => {
  refreshCompareDayOptions(false);
  update();
});

els.compareDaySelect.addEventListener("input", () => update());

els.resetButton.addEventListener("click", () => {
  resetFilters();
  update();
});

els.datePresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    clearActivePreset();
    button.classList.add("active");
    applyDatePreset(button.dataset.preset);
  });
});

els.granularitySelect.addEventListener("input", () => update());

document.addEventListener("click", (event) => {
  if (els.datePopover.hidden) return;
  if (els.datePopover.contains(event.target) || els.dateRangeButton.contains(event.target)) return;
  setDatePopoverOpen(false);
});

init();
