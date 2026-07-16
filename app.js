const DATA_BASE_URL = (window.TENKI_DATA_BASE_URL || "https://172.237.20.132.sslip.io/api/data").replace(/\/$/, "");
const API_BASE_URL = DATA_BASE_URL.replace(/\/api\/data$/, "/api");
const dataUrl = (path) => `${DATA_BASE_URL}/${path.replace(/^\//, "")}`;
const OPTIONS_URL = dataUrl("filter_options.csv?v=20260715-bilingual-genre-paths");
const GENRE_NAMES_URL = dataUrl("genre_names.csv?v=20260715-shop-genre-labels");
const SHOP_OPTIONS_URL = dataUrl("shop_options.csv?v=20260623-shop-sort");
const SHOP_GENRE_MIX_URL = dataUrl("shop_genre_mix.csv?v=20260623-shop-fallback");
const EVENTS_URL = dataUrl("events.csv");
const RANK_CURVES_URL = dataUrl("rank_curves.csv?v=20260611-gbt-rakuten-rank");
const RANK_EVENT_FACTORS_URL = dataUrl("rank_event_factors.csv?v=20260611-gbt-rakuten-rank");
const BY_MONTH_URL = dataUrl("by-month");
const ITEMS_BY_MONTH_URL = dataUrl("items-by-month");
const TOP_ITEMS_URL = dataUrl("top-items.csv");
const TOP_SHOPS_JSON_URL = `${API_BASE_URL}/top-shops`;
const TOP_ITEMS_JSON_URL = `${API_BASE_URL}/top-items`;
const SHOP_DAILY_JSON_URL = `${API_BASE_URL}/shop/daily`;
const SHOP_GENRE_DAILY_JSON_URL = `${API_BASE_URL}/shop/genre-daily`;
const MODEL_VALIDATION_JSON_URL = `${API_BASE_URL}/model-validation`;
const SHOP_ESTIMATES_BY_MONTH_URL = dataUrl("shop-estimates-by-month");
const SHOP_SUMMARY_BY_MONTH_URL = dataUrl("shop-summary-by-month");
const TREND_ESTIMATES_BY_MONTH_URL = dataUrl("trend-estimates-by-month");
const RANK_GAP_URL = dataUrl("ranked-shops-by-genre");
const RANK_ROWS_JSON_URL = `${API_BASE_URL}/genre/rank-rows`;
const GENRE_TREND_JSON_URL = `${API_BASE_URL}/genre/trend`;
const RANK_SUMMARY_URL = dataUrl("rank-summary-by-month");
const ALL_TIME_URL = dataUrl("all-time");
const RANK_DATA_VERSION = "20260714-all-items-rank-feed";
const SHOP_PROJECTION_VERSION = "20260624-shop-blend-sales-units";
const ALL_TIME_DATA_VERSION = "20260714-rank-identities";
const GENRES_WITHOUT_RANK_DATA = new Set();
const HIDDEN_EVENTS = new Set(["fashionthesale", "fathers-day"]);
const RANK_DISPLAY_LIMIT = 80;
const GENRE_PATH_LABELS = new Map([
  ["100181", "家電 > 生活家電 > 掃除機・クリーナー > その他 (Home Appliances > Household Appliances > Vacuum Cleaners > Other)"],
  ["100895", "花・ガーデン・DIY > 木材・建築資材・設備 > 床材 > その他 (Garden/DIY > Building Materials > Flooring > Other)"],
  ["101020", "ダイエット・健康 > サプリメント > プロバイオティクス > その他 (Diet/Health > Supplements > Probiotics > Other)"],
  ["101146", "車用品・バイク用品 > 車用品 > メンテナンス用品 > ボディ洗浄・ケア用品 > その他 (Car/Bike > Car Supplies > Maintenance > Body Wash/Care > Other)"],
  ["101765", "家電 > 美容・健康家電 > その他美容・健康家電 (Home Appliances > Beauty/Health Appliances > Other)"],
  ["101954", "カタログギフト・チケット > その他 (Catalog Gifts/Tickets > Other)"],
  ["111908", "ダイエット・健康 > ダイエット > ダイエットフード > 食事セット > その他 (Diet/Health > Diet Food > Meal Sets > Other)"],
  ["112666", "食品 > 精肉・肉加工品 > 牛肉 > その他 (Food > Meat/Processed Meat > Beef > Other)"],
  ["200181", "スポーツ・アウトドア > フィットネス・トレーニング > スポーツ器具 > その他 (Sports/Outdoors > Fitness/Training > Sports Equipment > Other)"],
  ["210413", "花・ガーデン・DIY > DIY・工具 > 電動工具本体 > 発電機・ポータブル電源 > その他 (Garden/DIY > Power Tools > Generators/Portable Power > Other)"],
  ["550091", "ダイエット・健康 > サプリメント > その他 (Diet/Health > Supplements > Other)"],
  ["553282", "カタログギフト・チケット > 金券 > 施設利用券 > その他 (Catalog Gifts/Tickets > Gift Certificates > Facility Vouchers > Other)"],
  ["560287", "スマートフォン・タブレット > スマートフォン・携帯電話アクセサリー > その他 (Smartphones/Tablets > Phone Accessories > Other)"],
  ["565864", "スポーツ・アウトドア > フィットネス・トレーニング > フィットネスマシン > その他 (Sports/Outdoors > Fitness/Training > Fitness Machines > Other)"],
  ["567623", "ダイエット・健康 > サプリメント > アミノ酸 > その他 (Diet/Health > Supplements > Amino Acids > Other)"],
  ["567686", "水・ソフトドリンク > 植物性ミルク > その他 (Water/Soft Drinks > Plant-Based Milk > Other)"],
  ["566403", "テレビゲーム > Nintendo Switch > 本体 (Video Games > Nintendo Switch > Consoles)"],
  ["568376", "テレビゲーム > PlayStation 5 > 本体 (Video Games > PlayStation 5 > Consoles)"]
]);

const state = {
  pageMode: "dashboard",
  viewMode: "genre",
  rows: [],
  filtered: [],
  events: [],
  rankCurves: new Map(),
  rankEventFactors: new Map(),
  globalRankEventFactors: new Map(),
  loadedMonths: new Map(),
  loadedItemMonths: new Map(),
  loadedShopEstimateMonths: new Map(),
  loadedShopSummaryMonths: new Map(),
  loadedShopApiRanges: new Map(),
  loadedTopItemsRanges: new Map(),
  loadedTrendEstimateMonths: new Map(),
  loadedGenreTrendRanges: new Map(),
  loadedRankGapMonths: new Map(),
  loadedRankGapRanges: new Map(),
  loadedRankIdentityFallbacks: new Map(),
  loadedRankSummaryMonths: new Map(),
  controlsEnabled: false,
  allTimeData: null,
  allTimeItems: null,
  allTimeShopEstimateRows: null,
  allTimeShopSummaryRows: null,
  genreLabels: new Map(),
  allShopIds: [],
  shopGenreMix: new Map(),
  genreShopMix: new Map(),
  byDate: new Map(),
  byShop: new Map(),
  byGenre: new Map(),
  shopProjectionSelected: new Set(),
  shopProjectionSelectionKey: "",
  shopPickerOpensAbove: false,
  validationMetrics: null,
  updateTimer: null,
  updateRun: 0,
  backgroundPreloadStarted: false
};

const els = {
  loadStatus: document.getElementById("loadStatus"),
  dashboardPage: document.getElementById("dashboardPage"),
  modelVerificationPage: document.getElementById("modelVerificationPage"),
  dashboardPageButton: document.getElementById("dashboardPageButton"),
  verificationPageButton: document.getElementById("verificationPageButton"),
  genreViewButton: document.getElementById("genreViewButton"),
  shopViewButton: document.getElementById("shopViewButton"),
  genreFilterLabel: document.getElementById("genreFilterLabel"),
  selectedGenrePath: document.getElementById("selectedGenrePath"),
  shopFilterLabel: document.getElementById("shopFilterLabel"),
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
  dateRangeCaption: document.getElementById("dateRangeCaption"),
  dateRangeLabel: document.getElementById("dateRangeLabel"),
  datePopover: document.getElementById("datePopover"),
  datePresetButtons: document.querySelectorAll(".date-preset-button"),
  clearDateButton: document.getElementById("clearDateButton"),
  applyDateButton: document.getElementById("applyDateButton"),
  prevDateButton: document.getElementById("prevDateButton"),
  nextDateButton: document.getElementById("nextDateButton"),
  dateCalendarGrid: document.getElementById("dateCalendarGrid"),
  granularitySelect: document.getElementById("granularitySelect"),
  compareYearSelect: document.getElementById("compareYearSelect"),
  compareMonthSelect: document.getElementById("compareMonthSelect"),
  compareDaySelect: document.getElementById("compareDaySelect"),
  resetButton: document.getElementById("resetButton"),
  salesMetricLabel: document.getElementById("salesMetricLabel"),
  salesMetric: document.getElementById("salesMetric"),
  salesMetricInterval: document.getElementById("salesMetricInterval"),
  unitsMetricLabel: document.getElementById("unitsMetricLabel"),
  unitsMetric: document.getElementById("unitsMetric"),
  unitsMetricInterval: document.getElementById("unitsMetricInterval"),
  pageViewsMetricLabel: document.getElementById("pageViewsMetricLabel"),
  pageViewsMetric: document.getElementById("pageViewsMetric"),
  pageViewsMetricInterval: document.getElementById("pageViewsMetricInterval"),
  trendPanel: document.getElementById("trendPanel"),
  trendChart: document.getElementById("trendChart"),
  trendSubtitle: document.getElementById("trendSubtitle"),
  rankProjectionPanel: document.querySelector(".rank-projection-panel"),
  shopProjectionChart: document.getElementById("shopProjectionChart"),
  shopProjectionSubtitle: document.getElementById("shopProjectionSubtitle"),
  shopProjectionControls: document.getElementById("shopProjectionControls"),
  shopCompareBody: document.getElementById("shopCompareBody"),
  shopCompareCount: document.getElementById("shopCompareCount"),
  dayCompareBody: document.getElementById("dayCompareBody"),
  dayCompareStatus: document.getElementById("dayCompareStatus"),
  topItemsBody: document.getElementById("topItemsBody"),
  topItemsCount: document.getElementById("topItemsCount"),
  rankGapChart: document.getElementById("rankGapChart"),
  rankGapBody: document.getElementById("rankGapBody"),
  rankGapCount: document.getElementById("rankGapCount"),
  rankProjectionSelect: document.getElementById("rankProjectionSelect"),
  rankProjectionSubtitle: document.getElementById("rankProjectionSubtitle"),
  rankProjectionChart: document.getElementById("rankProjectionChart"),
  moversCount: document.getElementById("moversCount"),
  moversList: document.getElementById("moversList"),
  eventsTitle: document.getElementById("eventsTitle"),
  eventList: document.getElementById("eventList"),
  eventCount: document.getElementById("eventCount"),
  verificationStatus: document.getElementById("verificationStatus"),
  verificationTypeSelect: document.getElementById("verificationTypeSelect"),
  verificationGenreLabel: document.getElementById("verificationGenreLabel"),
  verificationGenreSelect: document.getElementById("verificationGenreSelect"),
  verificationShopLabel: document.getElementById("verificationShopLabel"),
  verificationShopSelect: document.getElementById("verificationShopSelect"),
  verificationDetails: document.getElementById("verificationDetails")
};

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const sharePercent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const shopProjectionColors = ["#0f766e", "#2563eb", "#db2777", "#f97316", "#7c3aed", "#16a34a", "#dc2626", "#0891b2"];

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const parseLine = (line) => {
    const values = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && quoted && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        values.push(value);
        value = "";
      } else {
        value += char;
      }
    }
    values.push(value);
    return values;
  };
  const headers = parseLine(lines.shift());
  return lines.map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function addOptions(select, rows) {
  rows.forEach((row) => {
    const option = document.createElement("option");
    option.value = row.id;
    option.textContent = row.displayLabel || row.label;
    if (row.fullLabel || row.label) option.title = row.fullLabel || row.label;
    select.appendChild(option);
  });
}

function copySelectOptions(source, target) {
  if (!source || !target) return;
  target.innerHTML = source.innerHTML;
  target.disabled = false;
}

function ensureRankProjectionOptions(maxRank = 80) {
  if (!els.rankProjectionSelect) return;
  const existing = new Set([...els.rankProjectionSelect.options].map((option) => option.value));
  for (let rank = 1; rank <= maxRank; rank += 1) {
    if (existing.has(String(rank))) continue;
    const option = document.createElement("option");
    option.value = String(rank);
    option.textContent = `#${rank}`;
    els.rankProjectionSelect.appendChild(option);
  }
}

function optionSales(row) {
  return Number(String(row.sales || "0").replaceAll(",", "")) || 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setEnabled(enabled) {
  state.controlsEnabled = enabled;
  [
    els.genreViewButton, els.shopViewButton,
    els.genreSelect, els.shopSelect, els.dateModeSelect, els.yearSelect, els.monthSelect, els.daySelect,
    els.endYearSelect, els.endMonthSelect, els.endDaySelect,
    els.startDateInput, els.endDateInput, els.dateRangeButton, els.clearDateButton, els.applyDateButton,
    els.prevDateButton, els.nextDateButton,
    els.granularitySelect,
    els.compareYearSelect, els.compareMonthSelect, els.compareDaySelect,
    els.rankProjectionSelect,
    els.resetButton
  ].filter(Boolean).forEach((el) => {
    el.disabled = !enabled;
  });
  els.datePresetButtons.forEach((button) => {
    button.disabled = !enabled;
  });
}

function isShopMode() {
  return state.viewMode === "shop";
}

function syncViewMode() {
  const shopMode = isShopMode();
  document.body.classList.toggle("shop-mode", shopMode);
  document.body.classList.toggle("genre-mode", !shopMode);
  if (els.genreFilterLabel) els.genreFilterLabel.hidden = shopMode;
  if (els.shopFilterLabel) els.shopFilterLabel.hidden = !shopMode;
  if (els.genreSelect) {
    els.genreSelect.disabled = shopMode || !state.controlsEnabled;
    if (shopMode) els.genreSelect.value = "all";
  }
  if (els.shopSelect) {
    els.shopSelect.disabled = !shopMode || !state.controlsEnabled;
    if (!shopMode) els.shopSelect.value = "all";
  }
  if (els.genreViewButton) {
    els.genreViewButton.classList.toggle("active", !shopMode);
    els.genreViewButton.setAttribute("aria-selected", String(!shopMode));
  }
  if (els.shopViewButton) {
    els.shopViewButton.classList.toggle("active", shopMode);
    els.shopViewButton.setAttribute("aria-selected", String(shopMode));
  }
  syncSelectedGenrePath();
  syncRankPanelCopy();
  syncTopItemsPanelCopy();
}

function syncRankPanelCopy() {
  const title = document.querySelector(".rank-gap-heading h2");
  const description = document.querySelector(".rank-gap-heading .chart-description");
  const headers = document.querySelectorAll(".rank-gap-panel thead th");
  const allShops = isShopMode() && (els.shopSelect?.value || "all") === "all";
  if (title) title.textContent = isShopMode() ? "Sales by Genre" : "Sales by Item";
  if (description) description.textContent = allShops
    ? "WMAPE: 49.7%"
    : isShopMode()
      ? "WMAPE: 49.7%"
      : "WMAPE: 28.7%";
  const tableHeaders = allShops
    ? ["Rank", "Shop", "Top Item ID", "Sales", "Model"]
    : isShopMode()
      ? ["Rank", "Genre", "Units sold", "Sales", "Model"]
      : ["Rank", "Item ID", "Shop ID", "Sales", "Model"];
  headers.forEach((header, index) => {
    header.textContent = tableHeaders[index] || header.textContent;
  });
}

function setViewMode(mode) {
  state.viewMode = mode === "shop" ? "shop" : "genre";
  syncViewMode();
  requestUpdate();
}

function setPageMode(mode) {
  state.pageMode = mode === "verification" ? "verification" : "dashboard";
  const verificationMode = state.pageMode === "verification";
  if (els.dashboardPage) els.dashboardPage.hidden = verificationMode;
  if (els.modelVerificationPage) els.modelVerificationPage.hidden = !verificationMode;
  if (els.dashboardPageButton) {
    els.dashboardPageButton.classList.toggle("active", !verificationMode);
    els.dashboardPageButton.setAttribute("aria-current", verificationMode ? "false" : "page");
  }
  if (els.verificationPageButton) {
    els.verificationPageButton.classList.toggle("active", verificationMode);
    els.verificationPageButton.setAttribute("aria-current", verificationMode ? "page" : "false");
  }
  if (verificationMode) renderModelVerification();
}

function requestUpdate(delay = 60) {
  state.updateRun += 1;
  const updateId = state.updateRun;
  window.clearTimeout(state.updateTimer);
  state.updateTimer = window.setTimeout(() => {
    update(updateId);
  }, delay);
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
  syncDateStepButtons();
}

function orderedDates() {
  return [...(state.dates || [])].sort((a, b) => a.localeCompare(b));
}

function syncDateStepButtons() {
  if (!els.prevDateButton || !els.nextDateButton || !state.dates?.length) return;
  const dates = orderedDates();
  const selectedDates = selectedPeriodDates();
  if (!selectedDates.length) {
    els.prevDateButton.disabled = true;
    els.nextDateButton.disabled = true;
    return;
  }

  const firstIndex = dates.indexOf(selectedDates[0]);
  const lastIndex = dates.indexOf(selectedDates[selectedDates.length - 1]);
  els.prevDateButton.disabled = firstIndex <= 0;
  els.nextDateButton.disabled = lastIndex < 0 || lastIndex >= dates.length - 1;
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
  if (!els.compareYearSelect || !els.compareMonthSelect || !els.compareDaySelect) return "";
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
  if (els.compareYearSelect) els.compareYearSelect.innerHTML = `<option value="">Year</option>`;
  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    els.yearSelect.appendChild(option);
    els.endYearSelect.appendChild(option.cloneNode(true));
    if (els.compareYearSelect) els.compareYearSelect.appendChild(option.cloneNode(true));
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
  if (!els.compareYearSelect || !els.compareMonthSelect) return;
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
  if (!els.compareYearSelect || !els.compareMonthSelect || !els.compareDaySelect) return;
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
  if (!els.compareYearSelect || !els.compareMonthSelect || !els.compareDaySelect) return;
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
  if (els.shopSelect) els.shopSelect.value = "all";
  els.granularitySelect.value = "daily";
  clearActivePreset();
  const defaultPreset = [...els.datePresetButtons].find((button) => button.dataset.preset === "today");
  if (defaultPreset) defaultPreset.classList.add("active");
  applyDatePreset("today", false);
  setCompareDateParts("");
  syncDateRangeLabel();
  syncSelectedGenrePath();
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
    units: Number(row.units) || 0,
    pageViews: Number(row.page_views) || 0,
    days: Number(row.days) || 0
  };
}

function topShopFromJson(row) {
  const item = row.top_item ? String(row.top_item) : "";
  return {
    topShopSummary: true,
    shop: row.shop ? String(row.shop) : "",
    item,
    sales: Number(row.total_shop_sales) || 0,
    salesShare: Number(row.sales_share) || 0,
    knownRows: Number(row.known_rows) || 0,
    topItem: item ? { item, sales: 0, units: 0 } : null
  };
}

function topItemFromJson(row) {
  return {
    date: String(row.date || ""),
    shop: row.shop || row.shop_id ? String(row.shop || row.shop_id) : "",
    genre: row.genre || row.genre_id ? String(row.genre || row.genre_id) : "",
    item: row.item || row.item_id || row.top_item ? String(row.item || row.item_id || row.top_item) : "",
    sales: Number(row.sales ?? row.estimated_sales_yen ?? row.total_item_sales) || 0,
    salesLow: Number(row.sales_low ?? row.sales_low_95) || 0,
    salesHigh: Number(row.sales_high ?? row.sales_high_95) || 0,
    units: Number(row.units ?? row.estimated_units ?? row.units_sold) || 0,
    rankRows: Number(row.rank_rows) || 0,
    bestRank: Number(row.best_rank) || 0,
    salesShare: Number(row.sales_share) || 0
  };
}

function estimateFromCsv(row) {
  const predictedSales = Number(row.predicted_sales) || 0;
  const predictedUnits = Number(row.predicted_units) || 0;
  const predictedPageViews = Number(row.predicted_page_views) || 0;
  return {
    date: row.date,
    shop: row.shop || "",
    genre: row.genre_id || row.genre,
    predictedSales,
    predictedSalesLow: row.predicted_sales_low === undefined || row.predicted_sales_low === "" ? predictedSales : Number(row.predicted_sales_low) || 0,
    predictedSalesHigh: row.predicted_sales_high === undefined || row.predicted_sales_high === "" ? predictedSales : Number(row.predicted_sales_high) || 0,
    predictedUnits,
    predictedUnitsLow: row.predicted_units_low === undefined || row.predicted_units_low === "" ? predictedUnits : Number(row.predicted_units_low) || 0,
    predictedUnitsHigh: row.predicted_units_high === undefined || row.predicted_units_high === "" ? predictedUnits : Number(row.predicted_units_high) || 0,
    predictedPageViews,
    predictedPageViewsLow: row.predicted_page_views_low === undefined || row.predicted_page_views_low === "" ? predictedPageViews : Number(row.predicted_page_views_low) || 0,
    predictedPageViewsHigh: row.predicted_page_views_high === undefined || row.predicted_page_views_high === "" ? predictedPageViews : Number(row.predicted_page_views_high) || 0
  };
}

function estimateFromTrendJson(row, genre) {
  const predictedSales = Number(row.estimated_sales_yen) || 0;
  const predictedUnits = Number(row.estimated_units) || 0;
  return {
    date: String(row.date || "").slice(0, 10),
    shop: "",
    genre: genre || "all",
    predictedSales,
    predictedSalesLow: row.sales_low_95 === undefined || row.sales_low_95 === null ? predictedSales : Number(row.sales_low_95) || 0,
    predictedSalesHigh: row.sales_high_95 === undefined || row.sales_high_95 === null ? predictedSales : Number(row.sales_high_95) || 0,
    predictedUnits,
    predictedUnitsLow: predictedUnits,
    predictedUnitsHigh: predictedUnits,
    predictedPageViews: 0,
    predictedPageViewsLow: 0,
    predictedPageViewsHigh: 0,
    source: row.source_kind || "model"
  };
}

function shopGenreMixFromCsv(row) {
  return {
    shop: row.shop || "",
    genre: row.genre || "",
    shopRank: Number(row.shop_rank) || 0,
    sales: Number(row.sales) || 0,
    units: Number(row.units) || 0,
    genreShare: Number(row.genre_share) || 0,
    shopMixShare: Number(row.shop_mix_share) || 0,
    unitRate: Number(row.unit_rate) || 0
  };
}

function estimateFromActualRow(row) {
  return {
    date: row.date,
    shop: row.shop || "",
    genre: row.genre || "all",
    predictedSales: row.sales || 0,
    predictedSalesLow: row.sales || 0,
    predictedSalesHigh: row.sales || 0,
    predictedUnits: row.units || 0,
    predictedUnitsLow: row.units || 0,
    predictedUnitsHigh: row.units || 0,
    predictedPageViews: row.pageViews || 0,
    predictedPageViewsLow: row.pageViews || 0,
    predictedPageViewsHigh: row.pageViews || 0,
    source: "actual"
  };
}

function rankGapFromCsv(row) {
  return {
    date: row.date,
    genre: row.genre,
    rank: Number(row.rank) || 0,
    shop: row.shop || "",
    item: row.item || "",
    source: row.source || "estimated",
    sales: row.sales === "" ? null : Number(row.sales) || 0,
    salesKnown: row.sales !== "",
    salesLow: row.sales_low === "" ? null : Number(row.sales_low) || 0,
    salesHigh: row.sales_high === "" ? null : Number(row.sales_high) || 0,
    lowerRank: Number(row.lower_rank) || 0,
    upperRank: Number(row.upper_rank) || 0,
    lowerSales: Number(row.lower_sales) || 0,
    upperSales: Number(row.upper_sales) || 0
  };
}

function rankGapFromJson(row) {
  return {
    date: String(row.date || "").slice(0, 10),
    genre: String(row.genre || ""),
    rank: Number(row.rank) || 0,
    shop: row.shop ? String(row.shop) : "",
    item: row.item ? String(row.item) : "",
    source: row.source || "estimated",
    sales: row.sales === null || row.sales === "" ? null : Number(row.sales) || 0,
    salesKnown: row.sales !== null && row.sales !== "",
    salesLow: row.sales_low === null || row.sales_low === "" ? null : Number(row.sales_low) || 0,
    salesHigh: row.sales_high === null || row.sales_high === "" ? null : Number(row.sales_high) || 0,
    lowerRank: Number(row.lower_rank) || 0,
    upperRank: Number(row.upper_rank) || 0,
    lowerSales: Number(row.lower_sales) || 0,
    upperSales: Number(row.upper_sales) || 0
  };
}

function rankSummaryFromCsv(row) {
  return {
    date: row.date,
    genre: row.genre,
    sales: Number(row.sales) || 0,
    salesLow: Number(row.sales_low) || 0,
    salesHigh: Number(row.sales_high) || 0,
    units: Number(row.units) || 0,
    unitsLow: Number(row.units_low) || 0,
    unitsHigh: Number(row.units_high) || 0,
    avgPrice: Number(row.avg_price) || 0
  };
}

function rankSummaryAsEstimateRows(rows) {
  return rows.map((row) => ({
    date: row.date,
    shop: "",
    genre: row.genre,
    predictedSales: row.sales,
    predictedSalesLow: row.salesLow,
    predictedSalesHigh: row.salesHigh,
    predictedUnits: row.units,
    predictedUnitsLow: row.unitsLow,
    predictedUnitsHigh: row.unitsHigh,
    predictedPageViews: 0,
    predictedPageViewsLow: 0,
    predictedPageViewsHigh: 0
  }));
}

function rankCurveFromCsv(row) {
  return {
    genre: row.genre,
    rank: Number(row.rank) || 0,
    estimatedSales: Number(row.estimated_sales) || 0
  };
}

function rankEventFactorFromCsv(row) {
  return {
    genre: row.genre,
    event: row.event,
    factor: Number(row.factor) || 1
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
  const key = String(id || "").trim();
  const label = state.genreLabels.get(key) || `Genre ${key || "unknown"}`;
  if (/本体\s*\(Main units\)/i.test(label)) return `${label} - Genre ${key}`;
  return label;
}

const DEFAULT_VALIDATION_METRICS = [
  {
    modelName: "Total sales model",
    entityType: "genre",
    entityId: "all",
    metricName: "WMAPE",
    metricValue: 28.7,
    sampleSize: null,
    description: "Used for total sales estimates, Sales by Item, and genre-level totals."
  },
  {
    modelName: "Units sold model",
    entityType: "genre",
    entityId: "all",
    metricName: "WMAPE",
    metricValue: 17.4,
    sampleSize: null,
    description: "Used for units sold estimates in the top metric card."
  },
  {
    modelName: "Shop sales model",
    entityType: "shop",
    entityId: "all",
    metricName: "WMAPE",
    metricValue: 49.7,
    sampleSize: null,
    description: "Used for the By shop tab and shop-level genre breakdowns."
  }
];

function metricValueText(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${number.toFixed(number >= 10 ? 1 : 2)}%`;
}

function validationRowsForSelection(type, id) {
  const metrics = Array.isArray(state.validationMetrics) && state.validationMetrics.length
    ? state.validationMetrics
    : DEFAULT_VALIDATION_METRICS;
  if (type === "overall") return metrics.filter((row) => String(row.entityId || row.entity_id || "all") === "all");
  return metrics.filter((row) => {
    const rowType = String(row.entityType || row.entity_type || "").toLowerCase();
    const rowId = String(row.entityId || row.entity_id || row.genreId || row.genre_id || row.shopId || row.shop_id || "all");
    return rowType === type && (rowId === String(id) || rowId === "all");
  });
}

function selectedVerificationLabel(type, id) {
  if (type === "shop") return id === "all" ? "All shops" : `Shop ${id}`;
  if (type === "genre") return id === "all" ? "All product genres" : genreLabel(id);
  return "Overall models";
}

function renderModelVerification() {
  if (!els.verificationDetails) return;
  const type = els.verificationTypeSelect?.value || "genre";
  const entitySelect = type === "shop" ? els.verificationShopSelect : els.verificationGenreSelect;
  const entityId = type === "overall" ? "all" : (entitySelect?.value || "all");
  const rows = validationRowsForSelection(type, entityId);
  const title = selectedVerificationLabel(type, entityId);
  if (els.verificationGenreLabel) els.verificationGenreLabel.hidden = type !== "genre";
  if (els.verificationShopLabel) els.verificationShopLabel.hidden = type !== "shop";
  if (els.verificationStatus) els.verificationStatus.textContent = rows.length ? `${rows.length} metric${rows.length === 1 ? "" : "s"}` : "Fallback metrics";

  const metricCards = rows.length ? rows : DEFAULT_VALIDATION_METRICS.filter((row) => row.entityType === type || type === "overall");
  els.verificationDetails.innerHTML = `
    <div class="verification-selection-summary">
      <span>Selected</span>
      <strong>${escapeHtml(title)}</strong>
    </div>
    <div class="verification-metric-grid">
      ${metricCards.map((row) => {
        const modelName = row.modelName || row.model_name || "Model";
        const metricName = row.metricName || row.metric_name || "WMAPE";
        const value = row.metricValue ?? row.metric_value;
        const sampleSize = row.sampleSize ?? row.sample_size;
        const description = row.description || (sampleSize ? `${whole.format(sampleSize)} hidden validation rows.` : "Current dashboard validation score.");
        return `
          <article class="verification-result-card">
            <span>${escapeHtml(modelName)}</span>
            <strong>${escapeHtml(metricValueText(value))}</strong>
            <small>${escapeHtml(metricName)}</small>
            <p>${escapeHtml(description)}</p>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

async function loadValidationMetrics() {
  try {
    const response = await fetch(MODEL_VALIDATION_JSON_URL);
    if (!response.ok) throw new Error(`validation_${response.status}`);
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : payload.rows;
    state.validationMetrics = rows?.map((row) => ({
      modelName: row.model_name || row.modelName,
      entityType: row.entity_type || row.entityType,
      entityId: row.genre_id || row.shop_id || row.entity_id || row.entityId || "all",
      metricName: row.metric_name || row.metricName || "WMAPE",
      metricValue: Number(row.metric_value ?? row.metricValue),
      sampleSize: Number(row.sample_size ?? row.sampleSize) || null,
      description: row.description || ""
    })).filter((row) => Number.isFinite(row.metricValue)) || null;
  } catch (error) {
    state.validationMetrics = null;
  }
  renderModelVerification();
}

function syncTopItemsPanelCopy() {
  const panel = document.querySelector(".top-items-panel");
  if (!panel) return;
  const title = panel.querySelector("h2");
  const description = panel.querySelector(".chart-description");
  const headers = panel.querySelectorAll("thead th");
  const shopMode = isShopMode();
  if (title) title.textContent = shopMode ? "Top Items" : "Top Shops";
  if (description) {
    description.textContent = shopMode
      ? "Items ranked by estimated sales for the selected shop/date range."
      : "Shops summarized from the Sales by Item rows for the selected date, genre, or shop.";
  }
  const labels = shopMode
    ? ["#", "Item ID", "Shop ID", "Genre", "Estimated item sales", "Rank rows"]
    : ["#", "Shop ID", "Total shop sales", "% of total sales", "Rank rows", "Top item"];
  headers.forEach((header, index) => {
    header.textContent = labels[index] || header.textContent;
  });
}

function syncRangeControls() {
  document.body.classList.toggle("range-mode", isRangeMode());
  const isRange = isRangeMode();
  if (els.dateRangeCaption) {
    els.dateRangeCaption.textContent = isRange ? "Date range" : "Date";
  }
  const startLabel = els.startDateInput.closest("label");
  if (startLabel) {
    startLabel.firstChild.nodeValue = isRange ? "Start" : "Date";
  }
  if (!isRange) {
    setEndDateParts("");
    clearActivePreset();
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

function previousEqualPeriodDates(dates) {
  if (!dates.length || !state.dates?.length) return [];
  const sortedDates = [...state.dates].sort((a, b) => a.localeCompare(b));
  const firstIndex = sortedDates.indexOf(dates[0]);
  if (firstIndex <= 0) return [];
  return sortedDates.slice(Math.max(0, firstIndex - dates.length), firstIndex);
}

function shiftIsoDate(date, offsetDays) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offsetDays);
  return shifted.toISOString().slice(0, 10);
}

function calendarDateWindow(centerDate, radiusDays = 3) {
  return Array.from({ length: (radiusDays * 2) + 1 }, (_, index) => shiftIsoDate(centerDate, index - radiusDays));
}

function syncTrendPanelVisibility() {
  const showRangeCharts = isRangeMode();
  if (els.rankProjectionPanel) els.rankProjectionPanel.hidden = !showRangeCharts;
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
    requestUpdate();
    return;
  }

  els.dateModeSelect.value = "range";
  syncRangeControls();
  setDateParts(dates[0]);
  setEndDateParts(dates[dates.length - 1]);
  keepComparisonDateDifferent();
  syncDateRangeLabel();
  requestUpdate();
}

function shiftSelectedPeriod(direction) {
  const dates = orderedDates();
  const selectedDates = selectedPeriodDates();
  if (!dates.length || !selectedDates.length) return;

  const firstIndex = dates.indexOf(selectedDates[0]);
  const lastIndex = dates.indexOf(selectedDates[selectedDates.length - 1]);
  if (firstIndex < 0 || lastIndex < 0) return;

  const nextFirstIndex = firstIndex + direction;
  const nextLastIndex = lastIndex + direction;
  if (nextFirstIndex < 0 || nextLastIndex >= dates.length) return;

  clearActivePreset();
  if (!isRangeMode()) {
    applyPeriodDates([dates[nextFirstIndex]]);
    return;
  }

  applyPeriodDates(dates.slice(nextFirstIndex, nextLastIndex + 1));
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
  if (shouldUpdate) requestUpdate();
}

function stageCalendarDate(date) {
  const start = selectedDate();
  const end = selectedEndDate();
  clearActivePreset();

  if (!isRangeMode()) {
    setDateParts(date);
    setEndDateParts("");
    syncDateRangeLabel();
    return;
  }

  if (!start || end) {
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

function aggregateEstimateTrendRows(rows, dates, granularity) {
  const buckets = new Map();
  dates.forEach((date) => {
    const key = bucketKeyForDate(date, granularity);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: bucketLabel(key, granularity),
        dates: [],
        sales: 0,
        salesLow: 0,
        salesHigh: 0,
        actualCount: 0,
        modelCount: 0,
        rowCount: 0
      });
    }
    buckets.get(key).dates.push(date);
  });
  rows.forEach((row) => {
    const key = bucketKeyForDate(row.date, granularity);
    const bucket = buckets.get(key);
    if (!bucket) return;
    const sales = row.predictedSales || 0;
    bucket.sales += sales;
    bucket.salesLow += Number.isFinite(row.predictedSalesLow) ? row.predictedSalesLow : sales;
    bucket.salesHigh += Number.isFinite(row.predictedSalesHigh) ? row.predictedSalesHigh : sales;
    if (row.source === "actual") {
      bucket.actualCount += 1;
    } else {
      bucket.modelCount += 1;
    }
    bucket.rowCount += 1;
  });
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function hybridActualAndModelRows(actualRows, modelRows, dates) {
  const dateSet = new Set(dates);
  const actualEstimateRows = actualRows
    .filter((row) => dateSet.has(row.date))
    .map(estimateFromActualRow);
  const actualDates = new Set(actualEstimateRows.map((row) => row.date));
  const modelEstimateRows = modelRows
    .filter((row) => dateSet.has(row.date) && !actualDates.has(row.date))
    .map((row) => ({ ...row, source: row.source || "model" }));
  return [...actualEstimateRows, ...modelEstimateRows];
}

function trendLineSegments(points) {
  if (points.length < 2) {
    return points.map((point) => ({
      source: point.source,
      points: `${point.x.toFixed(1)},${point.y.toFixed(1)}`
    }));
  }
  return points.slice(1).map((point, index) => {
    const previous = points[index];
    const source = previous.source === point.source ? point.source : "hybrid";
    return {
      source,
      points: [
        `${previous.x.toFixed(1)},${previous.y.toFixed(1)}`,
        `${point.x.toFixed(1)},${point.y.toFixed(1)}`
      ].join(" ")
    };
  });
}

function smoothedVisualValues(points, valueKey = "value") {
  if (points.length < 4) return points.map((point) => point[valueKey] || 0);
  return points.map((point, index) => {
    const weights = [
      { offset: -2, weight: 1 },
      { offset: -1, weight: 2 },
      { offset: 0, weight: 4 },
      { offset: 1, weight: 2 },
      { offset: 2, weight: 1 }
    ];
    let weighted = 0;
    let totalWeight = 0;
    weights.forEach(({ offset, weight }) => {
      const neighbor = points[index + offset];
      if (!neighbor) return;
      weighted += (neighbor[valueKey] || 0) * weight;
      totalWeight += weight;
    });
    const smoothed = totalWeight > 0 ? weighted / totalWeight : point[valueKey] || 0;
    return ((point[valueKey] || 0) * 0.55) + (smoothed * 0.45);
  });
}

function curvedSvgPath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  const path = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const nextNext = points[Math.min(points.length - 1, index + 2)];
    const control1X = current.x + ((next.x - previous.x) / 6);
    const control1Y = current.y + ((next.y - previous.y) / 6);
    const control2X = next.x - ((nextNext.x - current.x) / 6);
    const control2Y = next.y - ((nextNext.y - current.y) / 6);
    path.push(`C ${control1X.toFixed(1)} ${control1Y.toFixed(1)}, ${control2X.toFixed(1)} ${control2Y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`);
  }
  return path.join(" ");
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

function sizeShopPickerMenu(picker, forceDirection = false) {
  const menu = picker?.querySelector(".shop-picker-menu");
  const summary = picker?.querySelector("summary");
  if (!menu || !summary) return;

  const margin = 16;
  const minHeight = 170;
  const maxHeight = 360;
  const summaryRect = summary.getBoundingClientRect();
  const spaceBelow = window.innerHeight - summaryRect.bottom - margin;
  const spaceAbove = summaryRect.top - margin;
  const shouldOpenAbove = forceDirection
    ? state.shopPickerOpensAbove
    : spaceBelow < minHeight && spaceAbove > spaceBelow;
  const availableSpace = (shouldOpenAbove ? spaceAbove : spaceBelow) - 8;
  const cappedHeight = Math.max(minHeight, Math.min(maxHeight, availableSpace));

  state.shopPickerOpensAbove = shouldOpenAbove;
  picker.classList.toggle("is-above", shouldOpenAbove);
  menu.style.setProperty("--shop-picker-max-height", `${Math.round(cappedHeight)}px`);
}

function sizeOpenShopPickerMenu() {
  if (!els.shopProjectionControls) return;
  const picker = els.shopProjectionControls.querySelector(".shop-picker[open]");
  if (picker) sizeShopPickerMenu(picker);
}

function renderShopProjectionControls(pointSets, renderAgain, keepOpen = false) {
  if (!els.shopProjectionControls) return;
  if (!pointSets.length) {
    els.shopProjectionControls.innerHTML = "";
    return;
  }

  const allSelected = pointSets.every((row) => state.shopProjectionSelected.has(row.shop));
  els.shopProjectionControls.innerHTML = `
    <details class="shop-picker${keepOpen && state.shopPickerOpensAbove ? " is-above" : ""}" ${keepOpen ? "open" : ""}>
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

  const picker = els.shopProjectionControls.querySelector(".shop-picker");
  picker?.addEventListener("toggle", () => {
    if (picker.open) requestAnimationFrame(() => sizeShopPickerMenu(picker));
  });
  if (keepOpen) {
    requestAnimationFrame(() => {
      sizeShopPickerMenu(picker, true);
      requestAnimationFrame(() => sizeShopPickerMenu(picker, true));
    });
  }

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

window.addEventListener("resize", sizeOpenShopPickerMenu);

function eventsForDates(dates) {
  if (!dates.length) return [];
  const first = dates[0];
  const last = dates[dates.length - 1];
  return state.events
    .filter((event) => !HIDDEN_EVENTS.has(event.name) && event.start_date <= last && event.end_date >= first)
    .map((event) => event.name);
}

function pointTooltip(point) {
  const events = eventsForDates(point.dates);
  const promotionLine = events.length
    ? `Promotion: ${events.join(", ")}`
    : "Promotion: No promotion listed";
  const intervalLine = point.source !== "actual" && Number.isFinite(point.low) && Number.isFinite(point.high)
    ? `95% estimate: ${yen.format(point.low)} to ${yen.format(point.high)}`
    : "";
  const valueLabel = point.source === "actual"
    ? "Known TENKI actual"
    : point.source === "hybrid"
      ? "TENKI actual + model"
      : "Model estimate";
  return `${point.label}\n${valueLabel}: ${yen.format(point.value)}${intervalLine ? `\n${intervalLine}` : ""}\n${promotionLine}`;
}

function compactYen(value) {
  if (value >= 1000000000) return `JPY ${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `JPY ${(value / 1000000).toFixed(0)}M`;
  if (value >= 1000) return `JPY ${(value / 1000).toFixed(0)}K`;
  return yen.format(value);
}

function cleanOptionLabel(label) {
  return String(label || "")
    .replace(/^\s*\/+\s*/, "")
    .replace(/\s+\/\s*$/, "")
    .trim();
}

function splitBilingualPath(label) {
  const cleaned = cleanOptionLabel(label);
  const [jaPath, enPath] = cleaned.split(/\s+\/\s+(.+)/).filter(Boolean);
  return {
    jaPath: jaPath || cleaned,
    enPath: enPath || "",
    fullLabel: cleaned
  };
}

function compactPath(path, maxParents = 2) {
  const parts = String(path || "").split(/\s*>\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return { leaf: parts[0] || "", parents: "" };
  return {
    leaf: parts[parts.length - 1],
    parents: parts.slice(Math.max(0, parts.length - 1 - maxParents), -1).join(" > ")
  };
}

function compactGenreName(label) {
  const { jaPath, enPath, fullLabel } = splitBilingualPath(label);
  const ja = compactPath(jaPath, 2);
  const en = compactPath(enPath, 2);
  const primary = en.leaf && en.leaf !== ja.leaf ? `${ja.leaf} / ${en.leaf}` : ja.leaf;
  const parent = en.parents || ja.parents;
  return parent ? `${primary} (${parent})` : primary || fullLabel;
}

function genreOptionLabel(row) {
  const sales = optionSales(row);
  const key = String(row.id || "").trim();
  const label = compactGenreName(row.label);
  return sales > 0 ? `${label} - ${compactYen(sales)}` : label;
}

function shopOptionLabel(row) {
  const sales = optionSales(row);
  const label = cleanOptionLabel(row.label);
  return sales > 0 ? `${label} - ${compactYen(sales)}` : label;
}

function syncSelectedGenrePath() {
  if (!els.selectedGenrePath || !els.genreSelect) return;
  const genre = els.genreSelect.value || "all";
  const shopMode = isShopMode();
  if (shopMode || genre === "all") {
    els.selectedGenrePath.hidden = true;
    els.selectedGenrePath.textContent = "";
    return;
  }
  const fullLabel = state.genreLabels.get(String(genre)) || "";
  if (!fullLabel) {
    els.selectedGenrePath.hidden = true;
    els.selectedGenrePath.textContent = "";
    return;
  }
  els.selectedGenrePath.hidden = false;
  els.selectedGenrePath.textContent = `Selected category: ${fullLabel}`;
}

function positionTrendTooltip(tooltip, event) {
  const chart = tooltip.closest(".trend-chart, .event-list, .rank-gap-chart") || els.trendChart;
  const chartRect = chart.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const targetRect = event.currentTarget?.getBoundingClientRect();
  const clientX = event.clientX || (targetRect ? targetRect.left + targetRect.width / 2 : chartRect.left + 20);
  const clientY = event.clientY || (targetRect ? targetRect.top + targetRect.height / 2 : chartRect.top + 20);
  const isRankChart = chart.classList.contains("rank-gap-chart");
  const xOffset = isRankChart ? 18 : 14;
  const yOffset = isRankChart ? 12 : -tooltipRect.height - 10;
  let x = clientX - chartRect.left + xOffset;
  if (x + tooltipRect.width > chartRect.width - 12) {
    x = clientX - chartRect.left - tooltipRect.width - xOffset;
  }
  const y = Math.min(chartRect.height - tooltipRect.height - 12, Math.max(12, clientY - chartRect.top + yOffset));
  x = Math.min(chartRect.width - tooltipRect.width - 12, Math.max(12, x));
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function showTrendTooltip(point, tooltip, event) {
  const lines = point.dataset.tooltip.split("\n");
  tooltip.innerHTML = `
    <strong>${escapeHtml(lines[0] || "")}</strong>
    ${lines.slice(1).map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
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

function filterItemRows(rows, filters) {
  return rows.filter((row) => {
    if (filters.shop !== "all" && row.shop !== filters.shop) return false;
    if (filters.genre !== "all" && row.genre !== filters.genre) return false;
    return true;
  });
}

function isRealShopId(shop) {
  return Boolean(shop) && String(shop).toLowerCase() !== "all";
}

async function loadPeriodShopEstimates(dates, options = {}) {
  const uniqueDates = [...new Set(dates)].sort((a, b) => a.localeCompare(b));
  if (!uniqueDates.length) return [];
  const shop = els.shopSelect?.value || "all";
  const rangeKey = `shop-genres|${shop}|${uniqueDates[0]}|${uniqueDates[uniqueDates.length - 1]}|${options.aggregate ? "aggregate" : "daily"}`;
  if (state.loadedShopApiRanges.has(rangeKey)) return state.loadedShopApiRanges.get(rangeKey);

  try {
    const params = new URLSearchParams({
      shopId: shop,
      start: uniqueDates[0],
      end: uniqueDates[uniqueDates.length - 1]
    });
    if (options.aggregate) params.set("aggregate", "1");
    const response = await fetch(`${SHOP_GENRE_DAILY_JSON_URL}?${params.toString()}`);
    if (!response.ok) throw new Error(`shop_genre_json_${response.status}`);
    const payload = await response.json();
    const dateSet = new Set(uniqueDates);
    const rows = (payload.rows || []).map(estimateFromCsv).filter((row) => options.aggregate || dateSet.has(row.date));
    state.loadedShopApiRanges.set(rangeKey, rows);
    return rows;
  } catch (error) {
    console.warn("Falling back to shop estimate CSV chunks", error);
  }

  const dateSet = new Set(dates);
  const months = monthsForDates(dates);
  const rowSets = await Promise.all(months.map((month) => loadShopEstimateMonth(month)));
  return rowSets.flat().filter((row) => dateSet.has(row.date));
}

async function loadPeriodShopSummaries(dates, options = {}) {
  const uniqueDates = [...new Set(dates)].sort((a, b) => a.localeCompare(b));
  if (!uniqueDates.length) return [];
  const rangeKey = `shops|all|${uniqueDates[0]}|${uniqueDates[uniqueDates.length - 1]}|${options.aggregate ? "aggregate" : "daily"}`;
  if (state.loadedShopApiRanges.has(rangeKey)) return state.loadedShopApiRanges.get(rangeKey);

  try {
    const params = new URLSearchParams({
      shopId: "all",
      start: uniqueDates[0],
      end: uniqueDates[uniqueDates.length - 1]
    });
    if (options.aggregate) params.set("aggregate", "1");
    const response = await fetch(`${SHOP_GENRE_DAILY_JSON_URL}?${params.toString()}`);
    if (!response.ok) throw new Error(`shop_summary_json_${response.status}`);
    const payload = await response.json();
    const dateSet = new Set(uniqueDates);
    const rows = (payload.rows || []).map(estimateFromCsv).filter((row) => options.aggregate || dateSet.has(row.date));
    state.loadedShopApiRanges.set(rangeKey, rows);
    return rows;
  } catch (error) {
    console.warn("Falling back to shop summary CSV chunks", error);
  }

  const dateSet = new Set(dates);
  const months = monthsForDates(dates);
  const rowSets = await Promise.all(months.map((month) => loadShopSummaryMonth(month)));
  return rowSets.flat().filter((row) => dateSet.has(row.date));
}

async function loadPeriodTrendEstimates(dates) {
  const dateSet = new Set(dates);
  const months = monthsForDates(dates);
  const rowSets = await Promise.all(months.map((month) => loadTrendEstimateMonth(month)));
  return rowSets.flat().filter((row) => dateSet.has(row.date));
}

async function loadGenreTrendRows(genre, dates) {
  const uniqueDates = [...new Set(dates)].sort((a, b) => a.localeCompare(b));
  const dateSet = new Set(uniqueDates);
  if (!uniqueDates.length) return [];
  const trendGenre = genre || "all";
  const rangeKey = `${trendGenre}|${uniqueDates[0]}|${uniqueDates[uniqueDates.length - 1]}`;
  if (state.loadedGenreTrendRanges.has(rangeKey)) return state.loadedGenreTrendRanges.get(rangeKey);

  const params = new URLSearchParams({
    genreId: trendGenre,
    start: uniqueDates[0],
    end: uniqueDates[uniqueDates.length - 1]
  });
  const response = await fetch(`${GENRE_TREND_JSON_URL}?${params.toString()}`);
  if (!response.ok) throw new Error(`trend_json_${response.status}`);
  const payload = await response.json();
  const rows = (payload.rows || []).map((row) => estimateFromTrendJson(row, trendGenre)).filter((row) => dateSet.has(row.date));
  state.loadedGenreTrendRanges.set(rangeKey, rows);
  return rows;
}

async function loadPeriodRankGaps(genre, dates, options = {}) {
  const uniqueDates = [...new Set(dates)].sort((a, b) => a.localeCompare(b));
  const dateSet = new Set(uniqueDates);
  if (!uniqueDates.length) return [];
  const rangeKey = `${genre || "all"}|${uniqueDates[0]}|${uniqueDates[uniqueDates.length - 1]}|${options.aggregate ? "aggregate" : "daily"}`;
  if (state.loadedRankGapRanges.has(rangeKey)) return state.loadedRankGapRanges.get(rangeKey);

  try {
    const params = new URLSearchParams({
      genreId: genre || "all",
      start: uniqueDates[0],
      end: uniqueDates[uniqueDates.length - 1],
      limit: String(RANK_DISPLAY_LIMIT)
    });
    if (options.aggregate) params.set("aggregate", "1");
    const response = await fetch(`${RANK_ROWS_JSON_URL}?${params.toString()}`);
    if (!response.ok) throw new Error(`rank_json_${response.status}`);
    const payload = await response.json();
    const rows = (payload.rows || []).map(rankGapFromJson).filter((row) => options.aggregate || dateSet.has(row.date));
    if (!rows.length) throw new Error("rank_json_empty");
    state.loadedRankGapRanges.set(rangeKey, rows);
    return rows;
  } catch (error) {
    console.warn("Falling back to rank CSV chunks", error);
  }

  const months = monthsForDates(dates);
  const rowSets = await Promise.all(months.map((month) => loadRankGapMonth(genre, month)));
  const rows = rowSets.flat();
  state.loadedRankGapRanges.set(rangeKey, rows);
  return rows;
}

async function loadNearestRankIdentities(genre, date) {
  if (!genre || genre === "all" || !date) return new Map();
  const cacheKey = `${genre}|${date}`;
  if (state.loadedRankIdentityFallbacks.has(cacheKey)) return state.loadedRankIdentityFallbacks.get(cacheKey);

  const fallbackDates = calendarDateWindow(date, 3);
  const rows = await loadPeriodRankGaps(genre, fallbackDates);
  const targetTime = Date.parse(`${date}T00:00:00Z`);
  const identities = new Map();
  rows.forEach((row) => {
    if (row.date === date || row.genre !== genre || row.rank < 1 || row.rank > RANK_DISPLAY_LIMIT) return;
    if (!isRealShopId(row.shop) && !row.item) return;
    const distance = Math.abs(Date.parse(`${row.date}T00:00:00Z`) - targetTime);
    const current = identities.get(row.rank);
    if (!current || distance < current.distance) {
      identities.set(row.rank, {
        shop: row.shop || "",
        item: row.item || "",
        date: row.date,
        distance
      });
    }
  });
  state.loadedRankIdentityFallbacks.set(cacheKey, identities);
  return identities;
}

async function hydrateRankRowIdentities(genre, dates, rows) {
  if (genre === "all" || dates.length !== 1) {
    return rows;
  }
  const identities = await loadNearestRankIdentities(genre, dates[0]);
  if (!identities.size) return rows;
  const hydrated = rows.map((row) => {
    if (isRealShopId(row.shop) && row.item) return row;
    const identity = identities.get(row.rank);
    if (!identity) return row;
    return {
      ...row,
      shop: isRealShopId(row.shop) ? row.shop : identity.shop,
      item: row.item || identity.item,
      identityFallbackDate: identity.date,
      tooltipLabel: `${row.tooltipLabel || `Rank #${row.rank}`} - item/shop from ${identity.date}`
    };
  });
  const existingRanks = new Set(hydrated.map((row) => row.rank).filter(Boolean));
  identities.forEach((identity, rank) => {
    if (existingRanks.has(rank)) return;
    hydrated.push({
      date: dates[0],
      genre,
      rank,
      shop: identity.shop,
      item: identity.item,
      source: "estimated",
      sales: null,
      salesKnown: false,
      salesLow: null,
      salesHigh: null,
      lowerRank: 0,
      upperRank: 0,
      lowerSales: 0,
      upperSales: 0,
      identityFallbackDate: identity.date,
      tooltipLabel: `Rank #${rank} - item/shop from ${identity.date}`
    });
  });
  return hydrated;
}

async function loadPeriodRankSummaries(dates) {
  const dateSet = new Set(dates);
  const months = monthsForDates(dates);
  const rowSets = await Promise.all(months.map((month) => loadRankSummaryMonth(month)));
  return rowSets.flat().filter((row) => dateSet.has(row.date));
}

async function update(updateId = ++state.updateRun) {
  const genre = els.genreSelect.value;
  const shop = els.shopSelect?.value || "all";
  const filters = isShopMode() ? { genre: "all", shop } : { genre, shop: "all" };
  const periodDates = selectedPeriodDates();
  const currentLabel = periodLabel(periodDates);
  const compareDate = selectedCompareDate();
  syncTrendPanelVisibility();

  if (!periodDates.length) {
    renderEmptyState();
    renderEvents(periodDates, []);
    return;
  }

  if (isAllTimeView(periodDates)) {
    const allTimeData = await loadAllTimeData();
    if (updateId !== state.updateRun) return;
    const shopEstimateSourceRows = isShopMode()
      ? (shop === "all" ? await loadAllTimeShopSummary() : await loadAllTimeShopEstimates())
      : await loadAllTimeShopEstimates();
    if (updateId !== state.updateRun) return;
    const monthlyDates = [...new Set(allTimeData.monthlyRows.map((row) => row.date))]
      .sort((a, b) => a.localeCompare(b));
    const baseRows = isShopMode()
      ? filterRows(allTimeData.monthlyRows, filters)
      : [];
    const summaryEstimateRows = [];
    const rankSummaryRows = !isShopMode()
      ? allTimeData.rankSummaryRows.filter((row) => row.genre === genre)
      : [];
    const directShopEstimateRows = isShopMode()
      ? filterEstimateRows(shopEstimateSourceRows, monthlyDates, filters)
      : [];
    const shopEstimateRows = isShopMode()
      ? withShopFallbackRows(directShopEstimateRows, shop, allTimeData.rankSummaryRows, monthlyDates)
      : [];
    const modelTrendRows = isShopMode()
      ? shopEstimateRows
      : rankSummaryAsEstimateRows(rankSummaryRows);
    const actualTrendRows = isShopMode()
      ? baseRows
      : [];
    const trendRows = hybridActualAndModelRows(actualTrendRows, modelTrendRows, monthlyDates);
    const compareRows = [];
    const [topItemRows, rankItemRows] = await Promise.all([
      Promise.resolve([]),
      Promise.resolve([])
    ]);
    if (updateId !== state.updateRun) return;

    renderSummary(baseRows, shopEstimateRows.length ? shopEstimateRows : summaryEstimateRows, rankSummaryRows, monthlyDates, isShopMode() ? "all" : genre);
    renderTrendChart(trendRows, monthlyDates, currentLabel, "monthly");
    renderShopComparison(baseRows);
    renderDayComparison(baseRows, compareRows, currentLabel, compareDate);
    if (isShopMode()) {
      renderShopGenreRankEstimates(shopEstimateRows, monthlyDates, rankItemRows, rankItemRows);
    } else {
      renderRankGapEstimates(allTimeData.rankRows, monthlyDates, allTimeData.rankSummaryRows, shopEstimateSourceRows, rankItemRows, rankItemRows);
      renderGenreSalesChart(filterEstimateRows(trendRows, monthlyDates, filters), monthlyDates, currentLabel, "monthly");
    }
    renderTopItems(isShopMode() ? rankItemRows : topItemRows);
    renderTopMovers([], [], monthlyDates, []);
    renderEvents(periodDates, trendRows);
    els.loadStatus.textContent = `Compact all-time view loaded for ${currentLabel}`;
    return;
  }

  const chartDates = trendDatesForPeriod(periodDates);
  const previousDates = previousEqualPeriodDates(periodDates);
  if (isShopMode()) {
    const allShops = shop === "all";
    const [periodShopRows, chartShopRows, previousShopRows, topItemRows] = await Promise.all([
      allShops ? loadPeriodShopSummaries(periodDates, { aggregate: true }) : loadPeriodShopEstimates(periodDates, { aggregate: true }),
      allShops ? loadPeriodShopSummaries(chartDates) : loadPeriodShopEstimates(chartDates),
      previousDates.length ? (allShops ? loadPeriodShopSummaries(previousDates, { aggregate: true }) : loadPeriodShopEstimates(previousDates, { aggregate: true })) : Promise.resolve([]),
      loadTopItemsForSelection(periodDates, filters, 1000),
    ]);
    if (updateId !== state.updateRun) return;
    const directSummaryRows = filterEstimateRows(periodShopRows, periodDates, filters);
    const directTrendRows = filterEstimateRows(chartShopRows, chartDates, filters);
    const directPreviousRows = filterEstimateRows(previousShopRows, previousDates, filters);
    let summaryEstimateRows = directSummaryRows;
    let modelTrendRows = directTrendRows;
    let previousEstimateRows = directPreviousRows;
    if (!allShops && (!summaryEstimateRows.length || !modelTrendRows.length)) {
      const [periodRankSummaryRows, chartRankSummaryRows, previousRankSummaryRows] = await Promise.all([
        !summaryEstimateRows.length ? loadPeriodRankSummaries(periodDates) : Promise.resolve([]),
        !modelTrendRows.length ? loadPeriodRankSummaries(chartDates) : Promise.resolve([]),
        previousDates.length && !previousEstimateRows.length ? loadPeriodRankSummaries(previousDates) : Promise.resolve([])
      ]);
      if (updateId !== state.updateRun) return;
      summaryEstimateRows = withShopFallbackRows(summaryEstimateRows, shop, periodRankSummaryRows, periodDates);
      modelTrendRows = withShopFallbackRows(modelTrendRows, shop, chartRankSummaryRows, chartDates);
      previousEstimateRows = withShopFallbackRows(previousEstimateRows, shop, previousRankSummaryRows, previousDates);
    }
    const trendRows = modelTrendRows;
    const baseRows = [];
    const compareRows = [];

    renderSummary(baseRows, summaryEstimateRows, [], periodDates, "all");
    if (isRangeMode()) {
      renderTrendChart(trendRows, chartDates, currentLabel);
    }
    renderShopComparison(baseRows);
    renderDayComparison(baseRows, compareRows, currentLabel, compareDate);
    renderShopGenreRankEstimates(summaryEstimateRows, periodDates, topItemRows, topItemRows);
    renderTopItems(topItemRows);
    renderTopMovers(shopMoverRows(summaryEstimateRows, shop), shopMoverRows(previousEstimateRows, shop), periodDates, previousDates);
    renderEvents(periodDates, trendRows);
    els.loadStatus.textContent = periodDates.length > 1
      ? `${whole.format(periodDates.length)} days loaded for ${currentLabel}`
      : `Ready for ${currentLabel}`;
    return;
  }

  const [rankGapRows, previousRankGapRows, rankSummaryRows, topItemRows, previousTopItemRows, rankItemRows, allTimeItemRows] = await Promise.all([
    loadPeriodRankGaps(genre, periodDates, { aggregate: true }),
    previousDates.length ? loadPeriodRankGaps(genre, previousDates, { aggregate: true }) : Promise.resolve([]),
    loadPeriodRankSummaries(periodDates),
    loadTopItemsForSelection(periodDates, filters, 1000),
    previousDates.length ? loadTopItemsForSelection(previousDates, filters, 1000) : Promise.resolve([]),
    Promise.resolve([]),
    Promise.resolve([])
  ]);
  if (updateId !== state.updateRun) return;
  const displayRankGapRows = await hydrateRankRowIdentities(genre, periodDates, rankGapRows);
  const displayPreviousRankGapRows = await hydrateRankRowIdentities(genre, previousDates, previousRankGapRows);
  if (updateId !== state.updateRun) return;
  const topShopRows = topItemRows.length ? topItemRows : displayRankGapRows;
  const previousTopShopRows = previousTopItemRows.length ? previousTopItemRows : displayPreviousRankGapRows;
  const baseRows = [];
  const trendRows = rankSummaryAsEstimateRows(rankSummaryRows);
  const summaryEstimateRows = [];
  const compareRows = [];

  renderSummary(baseRows, summaryEstimateRows, rankSummaryRows, periodDates, genre);
  if (isRangeMode()) {
    renderTrendChart(trendRows, chartDates, currentLabel);
  }
  renderShopComparison(baseRows);
  renderDayComparison(baseRows, compareRows, currentLabel, compareDate);
  renderRankGapEstimates(displayRankGapRows, periodDates, rankSummaryRows, [], rankItemRows, allTimeItemRows);
  if (isRangeMode()) {
    renderGenreSalesChart(filterEstimateRows(trendRows, periodDates, filters), periodDates, currentLabel);
  } else {
    renderGenreSalesChart([], periodDates, currentLabel);
  }
  renderTopItems(topShopRows);
  renderTopMovers(
    topShopMoverRows(topShopRows),
    topShopMoverRows(previousTopShopRows),
    periodDates,
    previousDates
  );
  renderEvents(periodDates, trendRows);
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

function shopFallbackEstimateRows(shop, rankRows, dates, existingRows = []) {
  if (!shop || shop === "all") return [];
  const mixRows = state.shopGenreMix.get(String(shop)) || [];
  if (!mixRows.length || !rankRows.length || !dates.length) return [];

  const dateSet = new Set(dates);
  const existingKeys = new Set(existingRows.map((row) => `${row.date}|${row.genre}`));
  const mixByGenre = new Map(mixRows.map((row) => [row.genre, row]));
  const fallbackRows = [];
  rankRows.forEach((row) => {
    if (!dateSet.has(row.date) || row.genre === "all") return;
    const mix = mixByGenre.get(row.genre);
    if (!mix || existingKeys.has(`${row.date}|${row.genre}`)) return;
    const share = mix.genreShare || 0;
    if (!share) return;
    const predictedSales = (row.sales || 0) * share;
    const predictedSalesLow = (Number.isFinite(row.salesLow) ? row.salesLow : row.sales || 0) * share;
    const predictedSalesHigh = (Number.isFinite(row.salesHigh) ? row.salesHigh : row.sales || 0) * share;
    const predictedUnits = mix.unitRate > 0
      ? predictedSales * mix.unitRate
      : (row.units || 0) * share;
    const predictedUnitsLow = mix.unitRate > 0
      ? predictedSalesLow * mix.unitRate
      : (Number.isFinite(row.unitsLow) ? row.unitsLow : row.units || 0) * share;
    const predictedUnitsHigh = mix.unitRate > 0
      ? predictedSalesHigh * mix.unitRate
      : (Number.isFinite(row.unitsHigh) ? row.unitsHigh : row.units || 0) * share;
    fallbackRows.push({
      date: row.date,
      shop,
      genre: row.genre,
      predictedSales,
      predictedSalesLow,
      predictedSalesHigh,
      predictedUnits,
      predictedUnitsLow,
      predictedUnitsHigh,
      predictedPageViews: 0,
      predictedPageViewsLow: 0,
      predictedPageViewsHigh: 0,
      fallback: true
    });
  });
  return fallbackRows;
}

function withShopFallbackRows(rows, shop, rankRows, dates) {
  if (!shop || shop === "all") return rows;
  return [...rows, ...shopFallbackEstimateRows(shop, rankRows, dates, rows)];
}

function filterTrendEstimateRows(rows, dates, filters) {
  if (filters.shop !== "all") return filterEstimateRows(rows, dates, filters);
  const dateSet = new Set(dates);
  return rows.filter((row) => dateSet.has(row.date) && row.genre === filters.genre);
}

function shopProjectionRowsForChart(rows, dates, filters) {
  if (filters.genre === "all" && filters.shop === "all") return [];
  return filterEstimateRows(rows, dates, filters);
}

function renderEmptyState() {
  els.salesMetricLabel.textContent = "Total sales";
  els.salesMetric.textContent = "-";
  els.salesMetricInterval.innerHTML = "";
  els.unitsMetricLabel.textContent = "Units sold";
  els.unitsMetric.textContent = "-";
  els.unitsMetricInterval.innerHTML = "";
  if (els.pageViewsMetricLabel) els.pageViewsMetricLabel.textContent = "Page views";
  if (els.pageViewsMetric) els.pageViewsMetric.textContent = "-";
  if (els.pageViewsMetricInterval) els.pageViewsMetricInterval.innerHTML = "";
  if (els.trendSubtitle) els.trendSubtitle.textContent = "Choose a day or period";
  if (els.trendChart) els.trendChart.innerHTML = `<div class="empty">${isRangeMode() ? "Choose a start and end day" : "Choose a day"} to see the sales trend.</div>`;
  if (els.shopProjectionSubtitle) els.shopProjectionSubtitle.textContent = "Choose one genre or shop";
  if (els.shopProjectionControls) els.shopProjectionControls.innerHTML = "";
  if (els.shopProjectionChart) els.shopProjectionChart.innerHTML = `<div class="empty">Choose one genre or shop to see TENKi shop projections.</div>`;
  const prompt = isRangeMode() ? "Choose a start and end day" : "Choose a day";
  if (els.shopCompareCount && els.shopCompareBody) {
    els.shopCompareCount.textContent = prompt;
    els.shopCompareBody.innerHTML = `<tr><td colspan="5">${prompt} to compare shops.</td></tr>`;
  }
  if (els.dayCompareStatus && els.dayCompareBody) {
    els.dayCompareStatus.textContent = prompt;
    els.dayCompareBody.innerHTML = `<div class="empty">${prompt} to compare sales by date.</div>`;
  }
  if (els.topItemsCount) els.topItemsCount.textContent = prompt;
  if (els.topItemsBody) els.topItemsBody.innerHTML = `<tr><td colspan="6">${prompt} to see top items.</td></tr>`;
  els.rankGapCount.textContent = prompt;
  els.rankGapChart.innerHTML = `<div class="empty">${prompt} to see rank estimates.</div>`;
  els.rankGapBody.innerHTML = `<tr><td colspan="5">${prompt} to see rank 1-${RANK_DISPLAY_LIMIT} estimates.</td></tr>`;
  if (els.rankProjectionSubtitle) els.rankProjectionSubtitle.textContent = prompt;
  if (els.rankProjectionChart) {
    els.rankProjectionChart.innerHTML = `<div class="empty">${prompt} to see genre sales.</div>`;
  }
  if (els.moversCount) els.moversCount.textContent = prompt;
  if (els.moversList) els.moversList.innerHTML = `<div class="empty">${prompt} to see top movers.</div>`;
}

function metricIntervalHtml(low, exact, high, formatter) {
  return `
    <span><em>Low</em><strong>${formatter.format(low)}</strong></span>
    <span><em>Exact</em><strong>${formatter.format(exact)}</strong></span>
    <span><em>High</em><strong>${formatter.format(high)}</strong></span>
  `;
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

async function loadTopItemsForSelection(dates, filters, limit = 50) {
  if (!dates.length) return [];
  if (isAllTimeView(dates) && filters.genre === "all" && filters.shop === "all") return [];
  const uniqueDates = [...new Set(dates)].sort((a, b) => a.localeCompare(b));
  const cacheKey = [
    isShopMode() ? "shop" : "genre",
    uniqueDates[0],
    uniqueDates[uniqueDates.length - 1],
    filters.genre || "all",
    filters.shop || "all",
    Math.min(limit, 100)
  ].join("|");
  if (state.loadedTopItemsRanges.has(cacheKey)) return state.loadedTopItemsRanges.get(cacheKey);
  if (isShopMode()) {
    try {
      const itemParams = new URLSearchParams({
        start: uniqueDates[0],
        end: uniqueDates[uniqueDates.length - 1],
        genreId: filters.genre || "all",
        shopId: filters.shop || "all",
        limit: String(Math.min(limit, 100))
      });
      const itemResponse = await fetch(`${TOP_ITEMS_JSON_URL}?${itemParams.toString()}`);
      if (!itemResponse.ok) throw new Error(`top_items_json_${itemResponse.status}`);
      const payload = await itemResponse.json();
      const rows = (payload.rows || []).map(topItemFromJson);
      if (!rows.some((row) => row.item && isRealShopId(row.shop))) throw new Error("top_items_json_empty");
      state.loadedTopItemsRanges.set(cacheKey, rows);
      return rows;
    } catch (error) {
      console.warn("Falling back to top item CSV", error);
    }
  }
  if (!isShopMode()) {
    try {
      const jsonParams = new URLSearchParams({
        start: uniqueDates[0],
        end: uniqueDates[uniqueDates.length - 1],
        genreId: filters.genre || "all",
        shopId: filters.shop || "all",
        limit: String(Math.min(limit, 100))
      });
      const jsonResponse = await fetch(`${TOP_SHOPS_JSON_URL}?${jsonParams.toString()}`);
      if (jsonResponse.ok) {
        const payload = await jsonResponse.json();
        const rows = (payload.rows || []).map(topShopFromJson);
        state.loadedTopItemsRanges.set(cacheKey, rows);
        return rows;
      }
    } catch (error) {
      console.warn("Falling back to top item CSV", error);
    }
  }
  const params = new URLSearchParams({
    start: uniqueDates[0],
    end: uniqueDates[uniqueDates.length - 1],
    genre: filters.genre || "all",
    shop: filters.shop || "all",
    limit: String(limit)
  });
  const response = await fetch(`${TOP_ITEMS_URL}?${params.toString()}`);
  const rows = response.ok ? parseCsv(await response.text()).map(itemFromCsv) : [];
  if (isShopMode() && !rows.some((row) => row.item && isRealShopId(row.shop))) {
    const itemRows = filterItemRows(await loadPeriodItems(uniqueDates), filters);
    const grouped = new Map();
    itemRows.forEach((row) => {
      if (!row.item || !isRealShopId(row.shop)) return;
      const key = `${row.shop}|${row.genre}|${row.item}`;
      const current = grouped.get(key) || {
        date: uniqueDates[0],
        shop: row.shop,
        genre: row.genre,
        item: row.item,
        sales: 0,
        units: 0,
        rankRows: 0,
        bestRank: 999
      };
      current.sales += row.sales || 0;
      current.units += row.units || 0;
      current.rankRows += 1;
      grouped.set(key, current);
    });
    const fallbackRows = [...grouped.values()]
      .sort((a, b) => b.sales - a.sales || b.units - a.units || a.item.localeCompare(b.item))
      .slice(0, Math.min(limit, 100));
    state.loadedTopItemsRanges.set(cacheKey, fallbackRows);
    return fallbackRows;
  }
  state.loadedTopItemsRanges.set(cacheKey, rows);
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

async function loadShopSummaryMonth(month) {
  if (state.loadedShopSummaryMonths.has(month)) return state.loadedShopSummaryMonths.get(month);
  const response = await fetch(`${SHOP_SUMMARY_BY_MONTH_URL}/${month}.csv?v=${SHOP_PROJECTION_VERSION}`);
  if (!response.ok) {
    state.loadedShopSummaryMonths.set(month, []);
    return [];
  }
  const text = await response.text();
  const rows = parseCsv(text).map(estimateFromCsv);
  state.loadedShopSummaryMonths.set(month, rows);
  return rows;
}

async function loadTrendEstimateMonth(month) {
  if (state.loadedTrendEstimateMonths.has(month)) return state.loadedTrendEstimateMonths.get(month);
  const response = await fetch(`${TREND_ESTIMATES_BY_MONTH_URL}/${month}.csv?v=${SHOP_PROJECTION_VERSION}`);
  if (!response.ok) {
    state.loadedTrendEstimateMonths.set(month, []);
    return [];
  }
  const text = await response.text();
  const rows = parseCsv(text).map(estimateFromCsv);
  state.loadedTrendEstimateMonths.set(month, rows);
  return rows;
}

async function loadRankGapMonth(genre, month) {
  const rankGenre = !genre || genre === "all" ? "all-items" : genre;
  const cacheKey = `${rankGenre}|${month}`;
  if (state.loadedRankGapMonths.has(cacheKey)) return state.loadedRankGapMonths.get(cacheKey);
  const response = await fetch(`${RANK_GAP_URL}/${encodeURIComponent(rankGenre)}/${month}.csv?v=${RANK_DATA_VERSION}`);
  if (!response.ok) {
    state.loadedRankGapMonths.set(cacheKey, []);
    return [];
  }
  const text = await response.text();
  const rows = parseCsv(text).map(rankGapFromCsv);
  state.loadedRankGapMonths.set(cacheKey, rows);
  return rows;
}

async function loadRankSummaryMonth(month) {
  if (state.loadedRankSummaryMonths.has(month)) return state.loadedRankSummaryMonths.get(month);
  const response = await fetch(`${RANK_SUMMARY_URL}/${month}.csv?v=${RANK_DATA_VERSION}`);
  if (!response.ok) {
    state.loadedRankSummaryMonths.set(month, []);
    return [];
  }
  const text = await response.text();
  const rows = parseCsv(text).map(rankSummaryFromCsv);
  state.loadedRankSummaryMonths.set(month, rows);
  return rows;
}

async function loadAllTimeData(options = {}) {
  if (state.allTimeData) return state.allTimeData;
  if (!options.silent) els.loadStatus.textContent = "Loading compact all-time data...";
  const [
    summaryText,
    monthlyText,
    trendEstimatesText,
    rankSummaryText,
    rankRowsText
  ] = await Promise.all([
    fetch(`${ALL_TIME_URL}/summary.csv?v=${ALL_TIME_DATA_VERSION}`).then((response) => response.text()),
    fetch(`${ALL_TIME_URL}/monthly.csv?v=${ALL_TIME_DATA_VERSION}`).then((response) => response.text()),
    fetch(`${ALL_TIME_URL}/trend_estimates_monthly.csv?v=${ALL_TIME_DATA_VERSION}`).then((response) => response.text()),
    fetch(`${ALL_TIME_URL}/rank_summary_monthly.csv?v=${RANK_DATA_VERSION}`).then((response) => response.text()),
    fetch(`${ALL_TIME_URL}/ranked_shops_latest.csv?v=${ALL_TIME_DATA_VERSION}`).then((response) => response.text())
  ]);
  state.allTimeData = {
    summaryRows: parseCsv(summaryText).map(allTimeSummaryFromCsv),
    monthlyRows: parseCsv(monthlyText).map(allTimeMonthlyFromCsv),
    trendEstimateRows: parseCsv(trendEstimatesText).map(estimateFromCsv),
    rankSummaryRows: parseCsv(rankSummaryText).map(rankSummaryFromCsv),
    rankRows: parseCsv(rankRowsText).map(rankGapFromCsv)
  };
  return state.allTimeData;
}

async function loadAllTimeItems() {
  if (state.allTimeItems) return state.allTimeItems;
  const response = await fetch(`${ALL_TIME_URL}/items.csv?v=${ALL_TIME_DATA_VERSION}`);
  if (!response.ok) {
    state.allTimeItems = [];
    return state.allTimeItems;
  }
  state.allTimeItems = parseCsv(await response.text()).map(itemFromCsv);
  return state.allTimeItems;
}

async function loadAllTimeShopEstimates(options = {}) {
  if (state.allTimeShopEstimateRows) return state.allTimeShopEstimateRows;
  if (!options.silent) els.loadStatus.textContent = "Loading shop genre estimates...";
  const text = await fetch(`${ALL_TIME_URL}/shop_estimates_monthly.csv?v=${ALL_TIME_DATA_VERSION}`).then((response) => response.text());
  state.allTimeShopEstimateRows = parseCsv(text).map(estimateFromCsv);
  return state.allTimeShopEstimateRows;
}

async function loadAllTimeShopSummary(options = {}) {
  if (state.allTimeShopSummaryRows) return state.allTimeShopSummaryRows;
  if (!options.silent) els.loadStatus.textContent = "Loading compact shop totals...";
  const text = await fetch(`${ALL_TIME_URL}/shop_summary_monthly.csv?v=${ALL_TIME_DATA_VERSION}`).then((response) => response.text());
  state.allTimeShopSummaryRows = parseCsv(text).map(estimateFromCsv);
  return state.allTimeShopSummaryRows;
}

function runWhenIdle(task, delay = 900) {
  window.setTimeout(() => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => task(), { timeout: 4000 });
      return;
    }
    task();
  }, delay);
}

function scheduleBackgroundPreload() {
  if (state.backgroundPreloadStarted) return;
  state.backgroundPreloadStarted = true;
  runWhenIdle(async () => {
    try {
      const latest = state.latestDate;
      const currentGenre = els.genreSelect?.value || "all";
      const recentDates = datesEndingOn(latest, 30);
      const recentMonths = monthsForDates(recentDates);
      await Promise.all([
        loadAllTimeData({ silent: true }),
        ...recentMonths.map((month) => loadRankSummaryMonth(month)),
        ...recentMonths.map((month) => loadTrendEstimateMonth(month)),
        ...recentMonths.map((month) => loadRankGapMonth(currentGenre, month))
      ]);
      runWhenIdle(() => {
        loadAllTimeShopSummary({ silent: true }).catch(() => {});
        loadAllTimeShopEstimates({ silent: true }).catch(() => {});
      }, 1200);
    } catch (error) {
      console.warn("Background preload skipped", error);
    }
  });
}

function rankSummaryForMetric(rankRows, dates, genre) {
  if (!dates.length) return null;
  const dateSet = new Set(dates);
  const rows = rankRows.filter((row) =>
    dateSet.has(row.date) &&
    row.genre === genre
  );
  if (!rows.length) return null;
  return rows.reduce((acc, row) => {
    acc.sales += row.sales;
    acc.salesLow += Number.isFinite(row.salesLow) ? row.salesLow : row.sales;
    acc.salesHigh += Number.isFinite(row.salesHigh) ? row.salesHigh : row.sales;
    acc.units += row.units || 0;
    acc.unitsLow += Number.isFinite(row.unitsLow) ? row.unitsLow : row.units;
    acc.unitsHigh += Number.isFinite(row.unitsHigh) ? row.unitsHigh : row.units;
    return acc;
  }, { sales: 0, salesLow: 0, salesHigh: 0, units: 0, unitsLow: 0, unitsHigh: 0 });
}

function renderSummary(rows, estimateRows = [], rankRows = [], dates = [], genre = "all") {
  const totals = rows.reduce((acc, row) => {
    acc.sales += row.sales;
    acc.units += row.units;
    acc.pageViews += row.pageViews;
    return acc;
  }, { sales: 0, units: 0, pageViews: 0 });
  const estimatedSales = estimateRows.reduce((sum, row) => sum + row.predictedSales, 0);
  const estimatedSalesLow = estimateRows.reduce((sum, row) => sum + row.predictedSalesLow, 0);
  const estimatedSalesHigh = estimateRows.reduce((sum, row) => sum + row.predictedSalesHigh, 0);
  const estimatedUnits = estimateRows.reduce((sum, row) => sum + row.predictedUnits, 0);
  const estimatedUnitsLow = estimateRows.reduce((sum, row) => sum + row.predictedUnitsLow, 0);
  const estimatedUnitsHigh = estimateRows.reduce((sum, row) => sum + row.predictedUnitsHigh, 0);
  const estimatedPageViews = estimateRows.reduce((sum, row) => sum + row.predictedPageViews, 0);
  const estimatedPageViewsLow = estimateRows.reduce((sum, row) => sum + row.predictedPageViewsLow, 0);
  const estimatedPageViewsHigh = estimateRows.reduce((sum, row) => sum + row.predictedPageViewsHigh, 0);
  const hasEstimateRows = estimateRows.length > 0;
  const rankSummary = rankSummaryForMetric(rankRows, dates, genre);
  const estimatedAveragePrice = estimatedUnits > 0 ? estimatedSales / estimatedUnits : 0;
  const rankEstimatedUnits = rankSummary?.units || (rankSummary && estimatedAveragePrice > 0 ? rankSummary.sales / estimatedAveragePrice : 0);
  const rankEstimatedUnitsLow = rankSummary?.unitsLow || (rankSummary && estimatedAveragePrice > 0 ? rankSummary.salesLow / estimatedAveragePrice : 0);
  const rankEstimatedUnitsHigh = rankSummary?.unitsHigh || (rankSummary && estimatedAveragePrice > 0 ? rankSummary.salesHigh / estimatedAveragePrice : 0);
  const useEstimatedSales = Boolean((rankSummary && rankSummary.sales > 0) || (hasEstimateRows && estimatedSales > 0));
  const useEstimatedUnits = Boolean((rankEstimatedUnits > 0) || (hasEstimateRows && estimatedUnits > 0));
  const useEstimatedPageViews = hasEstimateRows && estimatedPageViews > 0;
  const displaySales = rankSummary?.sales || estimatedSales;
  const displaySalesLow = rankSummary?.salesLow || estimatedSalesLow;
  const displaySalesHigh = rankSummary?.salesHigh || estimatedSalesHigh;
  const displayUnits = rankEstimatedUnits || estimatedUnits;
  const displayUnitsLow = rankEstimatedUnitsLow || estimatedUnitsLow;
  const displayUnitsHigh = rankEstimatedUnitsHigh || estimatedUnitsHigh;

  els.salesMetricLabel.textContent = useEstimatedSales ? "Total sales (est.)" : "Total sales";
  els.salesMetric.textContent = yen.format(useEstimatedSales ? displaySales : totals.sales);
  els.salesMetricInterval.innerHTML = useEstimatedSales
    ? metricIntervalHtml(displaySalesLow, displaySales, displaySalesHigh, yen)
    : "";
  els.unitsMetricLabel.textContent = useEstimatedUnits ? "Units sold (est.)" : "Units sold";
  els.unitsMetric.textContent = whole.format(useEstimatedUnits ? displayUnits : totals.units);
  els.unitsMetricInterval.innerHTML = useEstimatedUnits
    ? metricIntervalHtml(displayUnitsLow, displayUnits, displayUnitsHigh, whole)
    : "";
  if (els.pageViewsMetricLabel) {
    els.pageViewsMetricLabel.textContent = useEstimatedPageViews ? "Page views (est.)" : "Page views";
  }
  if (els.pageViewsMetric) {
    els.pageViewsMetric.textContent = whole.format(useEstimatedPageViews ? estimatedPageViews : totals.pageViews);
  }
  if (els.pageViewsMetricInterval) {
    els.pageViewsMetricInterval.innerHTML = useEstimatedPageViews
      ? metricIntervalHtml(estimatedPageViewsLow, estimatedPageViews, estimatedPageViewsHigh, whole)
      : "";
  }
}

function renderTrendChart(rows, dates, label, forcedGranularity = "") {
  if (!els.trendChart) return;
  if (!dates.length) {
    if (els.trendSubtitle) els.trendSubtitle.textContent = "Choose a day or period";
    els.trendChart.innerHTML = `<div class="empty">Choose dates to see sales trends.</div>`;
    return;
  }

  const granularity = forcedGranularity || els.granularitySelect.value || "daily";
  if (!rows.length) {
    if (els.trendSubtitle) els.trendSubtitle.textContent = "No model estimate found";
    els.trendChart.innerHTML = `<div class="empty">No Rakuten model estimate found for this period.</div>`;
    return;
  }
  const showEventMarkers = !forcedGranularity && !isAllTimeView(dates);
  const buckets = aggregateEstimateTrendRows(rows, dates, granularity);
  const values = buckets.map((bucket) => bucket.sales);
  const intervalValues = buckets.flatMap((bucket) => [
    bucket.salesLow || bucket.sales,
    bucket.sales,
    bucket.salesHigh || bucket.sales
  ]);
  const scaleValues = values.length ? values : intervalValues;
  const rawMin = Math.min(...scaleValues);
  const rawMax = Math.max(...scaleValues, 1);
  const rawRange = Math.max(rawMax - rawMin, rawMax * 0.03, 1);
  const min = Math.max(0, rawMin - (rawRange * 0.12));
  const max = rawMax * 1.3;
  const scaleRange = Math.max(max - min, 1);
  const width = 1040;
  const height = 230;
  const padX = 54;
  const padTop = 22;
  const padBottom = 44;
  const plotWidth = width - (padX * 2);
  const plotHeight = height - padTop - padBottom;
  const yForValue = (value) => {
    const boundedValue = Math.min(max, Math.max(min, value));
    return padTop + plotHeight - (((boundedValue - min) / scaleRange) * plotHeight);
  };
  const points = values.map((value, index) => {
    const x = buckets.length === 1 ? width / 2 : padX + (plotWidth * index) / (buckets.length - 1);
    const y = yForValue(value);
    return {
      x,
      y,
      value,
      low: buckets[index].salesLow,
      high: buckets[index].salesHigh,
      label: buckets[index].label,
      key: buckets[index].key,
      dates: buckets[index].dates,
      source: buckets[index].actualCount > 0 && buckets[index].modelCount > 0
        ? "hybrid"
        : buckets[index].actualCount > 0
          ? "actual"
          : "model"
    };
  });
  const highPoints = points.map((point) => ({
    x: point.x,
    y: yForValue(point.high || point.value)
  }));
  const lowPoints = points.map((point) => ({
    x: point.x,
    y: yForValue(point.low || point.value)
  }));
  const lineSegments = trendLineSegments(points);
  const intervalArea = [
    ...highPoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`),
    ...lowPoints.slice().reverse().map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
  ].join(" ");
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: min + (scaleRange * ratio),
    y: padTop + plotHeight - (plotHeight * ratio)
  }));
  const ticks = points.filter((_, index) => (
    index === 0 || index === points.length - 1 || index === Math.floor((points.length - 1) / 2)
  ));

  const hasActual = buckets.some((bucket) => bucket.actualCount > 0);
  const hasModel = buckets.some((bucket) => bucket.modelCount > 0);
  const estimateLabel = hasActual && hasModel
    ? "TENKI actual + model fill"
    : hasActual
      ? "known TENKI actual"
      : isShopMode()
        ? "shop estimate"
        : "Rakuten estimate";
  if (els.trendSubtitle) {
    els.trendSubtitle.textContent = dates.length === 1
      ? `${label} ${estimateLabel}`
      : `${dates[0]} to ${dates[dates.length - 1]} ${granularity} ${estimateLabel}`;
  }

  els.trendChart.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily sales trend chart">
      ${yTicks.map((tick) => `
        <line x1="${padX}" y1="${tick.y.toFixed(1)}" x2="${width - padX}" y2="${tick.y.toFixed(1)}" class="trend-grid"></line>
        <text x="${padX - 8}" y="${(tick.y + 4).toFixed(1)}" text-anchor="end" class="trend-y-label">${compactYen(tick.value)}</text>
      `).join("")}
      <polygon points="${intervalArea}" class="trend-interval-area"></polygon>
      ${lineSegments.map((segment) => `
        <polyline points="${segment.points}" class="trend-line ${segment.source}"></polyline>
      `).join("")}
      ${points.map((point) => {
        const hasEvent = showEventMarkers && eventsForDates(point.dates).length > 0;
        const tooltip = escapeHtml(pointTooltip(point));
        return `
          <circle
            cx="${point.x.toFixed(1)}"
            cy="${point.y.toFixed(1)}"
            r="${hasEvent ? 3 : 1.7}"
            class="trend-point ${point.source}${hasEvent ? " has-event" : ""}">
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
  if (!els.shopProjectionChart || !els.shopProjectionControls || !els.shopProjectionSubtitle) return;
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
  if (!els.topItemsCount || !els.topItemsBody) return;
  syncTopItemsPanelCopy();
  if (isShopMode() && rows.some((row) => row.item && isRealShopId(row.shop))) {
    const items = rows
      .filter((row) => row.item && isRealShopId(row.shop))
      .sort((a, b) => (b.sales || 0) - (a.sales || 0) || (a.bestRank || 999) - (b.bestRank || 999))
      .slice(0, 25);
    els.topItemsCount.textContent = `${whole.format(items.length)} items`;
    if (!items.length) {
      els.topItemsBody.innerHTML = `<tr><td colspan="6">No item rows found for this search.</td></tr>`;
      return;
    }
    els.topItemsBody.innerHTML = items.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.item)}</td>
        <td>Shop ${escapeHtml(row.shop)}</td>
        <td>${genreLabel(row.genre)}</td>
        <td>${yen.format(row.sales)}</td>
        <td>${whole.format(row.rankRows || 0)}</td>
      </tr>
    `).join("");
    return;
  }
  if (rows.some((row) => row.topShopSummary)) {
    const topShops = rows.filter((row) => row.topShopSummary && isRealShopId(row.shop));
    els.topItemsCount.textContent = `${whole.format(topShops.length)} shops`;
    if (!topShops.length) {
      els.topItemsBody.innerHTML = `<tr><td colspan="6">No shop rows found for this search.</td></tr>`;
      return;
    }
    els.topItemsBody.innerHTML = topShops.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>Shop ${row.shop}</td>
        <td>${yen.format(row.sales)}</td>
        <td>${sharePercent.format(row.salesShare || 0)}</td>
        <td>${whole.format(row.knownRows)}</td>
        <td>${row.topItem?.item ? escapeHtml(row.topItem.item) : "No item data"}</td>
      </tr>
    `).join("");
    return;
  }

  const shopTotals = new Map();
  rows.forEach((row) => {
    if (!isRealShopId(row.shop)) return;
    const shop = String(row.shop);
    const current = shopTotals.get(shop) || {
      shop,
      sales: 0,
      knownRows: 0,
      topItem: null
    };
    const sales = Number(row.sales) || 0;
    current.sales += sales;
    current.knownRows += 1;
    if (row.item) {
      const candidate = {
        item: String(row.item),
        sales,
        units: Number(row.units) || 0
      };
      if (!current.topItem || candidate.sales > current.topItem.sales || (candidate.sales === current.topItem.sales && candidate.units > current.topItem.units)) {
        current.topItem = candidate;
      }
    }
    shopTotals.set(shop, current);
  });
  const allShops = [...shopTotals.values()];
  const totalSales = allShops.reduce((sum, row) => sum + row.sales, 0);
  const topShops = allShops.sort((a, b) => b.sales - a.sales || b.knownRows - a.knownRows || a.shop.localeCompare(b.shop)).slice(0, 25);
  els.topItemsCount.textContent = `${whole.format(allShops.length)} shops`;
  if (!topShops.length) {
    els.topItemsBody.innerHTML = `<tr><td colspan="6">No shop rows found for this search.</td></tr>`;
    return;
  }

  els.topItemsBody.innerHTML = topShops.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>Shop ${row.shop}</td>
      <td>${yen.format(row.sales)}</td>
      <td>${totalSales > 0 ? sharePercent.format(row.sales / totalSales) : "0%"}</td>
      <td>${whole.format(row.knownRows)}</td>
      <td>${row.topItem?.item ? escapeHtml(row.topItem.item) : "No item data"}</td>
    </tr>
  `).join("");
}

function bestItemForRankRow(row, itemRows = [], requireGenre = true) {
  if (!itemRows.length) return null;
  const rowShop = row.shop ? String(row.shop) : "";
  if (!isRealShopId(rowShop)) return null;
  const rowGenre = row.genre && row.genre !== "all" ? String(row.genre) : "";
  const candidates = itemRows.filter((item) => {
    if (rowShop && String(item.shop) !== rowShop) return false;
    if (requireGenre && rowGenre && String(item.genre) !== rowGenre) return false;
    return true;
  });
  if (!candidates.length) return null;
  return [...candidates]
    .sort((a, b) => (b.units || 0) - (a.units || 0) || (b.sales || 0) - (a.sales || 0))[0];
}

function topItemIdForRankRow(row, periodItemRows = [], allTimeItemRows = []) {
  const item = bestItemForRankRow(row, periodItemRows, true)
    || bestItemForRankRow(row, allTimeItemRows, true)
    || bestItemForRankRow(row, periodItemRows, false)
    || bestItemForRankRow(row, allTimeItemRows, false);
  return item?.item ? `Item ${escapeHtml(item.item)}` : "No item data";
}

function itemIdForRankRow(row, periodItemRows = [], allTimeItemRows = []) {
  if (row.item) return escapeHtml(row.item);
  const itemLabel = topItemIdForRankRow(row, periodItemRows, allTimeItemRows);
  return itemLabel.startsWith("Item ") ? itemLabel.slice(5) : itemLabel;
}

function bestRankRow(rows, rank) {
  const sameRank = rows.filter((row) => row.rank === rank);
  return sameRank.find((row) => row.source === "actual" && row.salesKnown)
    || sameRank.find((row) => row.source === "estimated" && row.salesKnown)
    || sameRank.find((row) => row.salesKnown)
    || null;
}

function aggregateRankRows(rows, rank) {
  if (!rows.length) return null;
  const sales = rows.reduce((sum, row) => sum + (row.sales || 0), 0);
  const salesLow = rows.reduce((sum, row) => sum + (row.salesLow || row.sales || 0), 0);
  const salesHigh = rows.reduce((sum, row) => sum + (row.salesHigh || row.sales || 0), 0);
  const allActual = rows.every((row) => row.source === "actual");
  const identityTotals = new Map();
  rows.forEach((row) => {
    if (!isRealShopId(row.shop)) return;
    const shop = String(row.shop);
    const item = row.item ? String(row.item) : "";
    const key = `${shop}|${item}`;
    const current = identityTotals.get(key) || { shop, item, sales: 0, count: 0 };
    current.sales += row.sales || 0;
    current.count += 1;
    identityTotals.set(key, current);
  });
  const topIdentity = [...identityTotals.values()]
    .sort((a, b) => b.count - a.count || b.sales - a.sales || a.shop.localeCompare(b.shop) || a.item.localeCompare(b.item))[0];
  return {
    rank,
    shop: topIdentity?.shop || "",
    item: topIdentity?.item || "",
    sales,
    salesLow,
    salesHigh,
    source: allActual ? "actual" : "estimated",
    salesKnown: true
  };
}

function shopLabelForRankEstimate(row, rank, genre) {
  const shop = shopIdForRankEstimate(row, rank, genre);
  if (shop) return `Shop ${shop}`;
  return `Rank #${rank}`;
}

function shopIdForRankEstimate(row, rank, genre) {
  if (isRealShopId(row?.shop)) return String(row.shop);
  return "";
}

function rankEstimateForRows(rows, rank, genre) {
  if (genre === "all") return aggregateRankRows(rows.filter((row) => row.rank === rank), rank);
  return bestRankRow(rows, rank);
}

function rankCurveEstimate(genre, rank) {
  return (state.rankCurves.get(genre)?.get(rank))
    || (state.rankCurves.get("all")?.get(rank))
    || null;
}

function nearbyRankSales(rows, index, genre) {
  const current = rows[index];
  const curveSales = rankCurveEstimate(genre, current?.rank || index + 1);
  if (Number.isFinite(curveSales) && curveSales > 0) return curveSales;

  let previous = null;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const row = rows[cursor];
    if (row?.sales > 0) {
      previous = { index: cursor, sales: row.sales };
      break;
    }
  }

  let next = null;
  for (let cursor = index + 1; cursor < rows.length; cursor += 1) {
    const row = rows[cursor];
    if (row?.sales > 0) {
      next = { index: cursor, sales: row.sales };
      break;
    }
  }

  if (previous && next) {
    const progress = (index - previous.index) / Math.max(1, next.index - previous.index);
    return previous.sales + ((next.sales - previous.sales) * progress);
  }
  if (previous) {
    const rankGap = index - previous.index;
    return previous.sales * Math.pow(0.92, rankGap);
  }
  if (next) {
    const rankGap = next.index - index;
    return next.sales / Math.pow(0.92, rankGap);
  }
  return 0;
}

function cleanRankDisplayRows(rows, genre) {
  const sorted = [...rows].sort((a, b) => (a.rank || 0) - (b.rank || 0));
  const cleanedRows = sorted.map((row, index) => {
    const cleaned = { ...row };
    const curveSales = rankCurveEstimate(genre, cleaned.rank);
    const hasCurve = Number.isFinite(curveSales) && curveSales > 0;
    const likelyBadKnownSales = cleaned.source === "actual" && hasCurve && cleaned.sales > curveSales * 6;
    if (likelyBadKnownSales) {
      cleaned.sales = curveSales;
      cleaned.salesLow = curveSales * 0.75;
      cleaned.salesHigh = curveSales * 1.25;
      cleaned.source = "estimated";
      cleaned.cleaned = true;
    }
    if (!cleaned.sales || cleaned.sales <= 0) {
      const fallbackSales = hasCurve ? curveSales : nearbyRankSales(sorted, index, genre);
      cleaned.sales = fallbackSales;
      cleaned.salesLow = fallbackSales * 0.75;
      cleaned.salesHigh = fallbackSales * 1.25;
      cleaned.source = "estimated";
      cleaned.cleaned = true;
    }
    if (index > 0 && sorted[index - 1]) {
      const previous = sorted[index - 1].sales || cleaned.sales || 0;
      const maxAllowed = previous * 0.985;
      if (cleaned.sales > maxAllowed && maxAllowed > 0) {
        cleaned.sales = maxAllowed;
        cleaned.source = cleaned.source === "actual" ? "estimated" : cleaned.source;
        cleaned.cleaned = true;
      }
    }
    const interval = centeredSalesInterval(cleaned.sales, cleaned.salesLow, cleaned.salesHigh);
    cleaned.salesLow = Math.min(interval.salesLow, cleaned.sales);
    cleaned.salesHigh = Math.max(interval.salesHigh, cleaned.sales);
    if (cleaned.cleaned) {
      cleaned.tooltipLabel = `${cleaned.tooltipLabel || `Rank #${cleaned.rank}`} - cleaned estimate`;
    }
    sorted[index] = cleaned;
    return cleaned;
  });

  for (let index = 1; index < cleanedRows.length; index += 1) {
    const previous = cleanedRows[index - 1];
    const current = cleanedRows[index];
    if (!previous?.sales || !current?.sales) continue;
    const rank = current.rank || index + 1;
    const minRatio = rank <= 5 ? 0.62 : rank <= 20 ? 0.72 : 0.82;
    const minAllowed = previous.sales * minRatio;
    if (current.sales < minAllowed && current.source !== "actual") {
      current.sales = minAllowed;
      current.salesLow = minAllowed * 0.75;
      current.salesHigh = minAllowed * 1.25;
      current.cleaned = true;
      current.tooltipLabel = `${current.tooltipLabel || `Rank #${current.rank}`} - smoothed estimate`;
    }
  }

  for (let index = 1; index < cleanedRows.length; index += 1) {
    const previous = cleanedRows[index - 1];
    const current = cleanedRows[index];
    if (!previous?.sales || !current?.sales) continue;
    const rank = current.rank || index + 1;
    const maxRatio = rank <= 10 ? 0.975 : rank <= 30 ? 0.985 : 0.992;
    const maxAllowed = previous.sales * maxRatio;
    if (current.sales >= maxAllowed && maxAllowed > 0) {
      const oldSales = current.sales;
      current.sales = maxAllowed;
      current.salesLow = Math.min(current.sales, (Number.isFinite(current.salesLow) ? current.salesLow : oldSales * 0.75) * (current.sales / Math.max(oldSales, 1)));
      current.salesHigh = Math.max(current.sales, (Number.isFinite(current.salesHigh) ? current.salesHigh : oldSales * 1.25) * (current.sales / Math.max(oldSales, 1)));
      current.source = current.source === "actual" ? "estimated" : current.source;
      current.cleaned = true;
      current.tooltipLabel = `${current.tooltipLabel || `Rank #${current.rank}`} - smoothed estimate`;
    }
  }

  return cleanedRows.map((row) => {
    const interval = centeredSalesInterval(row.sales, row.salesLow, row.salesHigh);
    return {
      ...row,
      salesLow: Math.min(interval.salesLow, row.sales),
      salesHigh: Math.max(interval.salesHigh, row.sales)
    };
  });
}

function rankGenreLabel(genre) {
  return genre === "all" ? "All product genres" : genreLabel(genre);
}

function renderGenreSalesChart(rows, dates, label, forcedGranularity = "") {
  if (!els.rankProjectionChart || !els.rankProjectionSubtitle) return;
  if (!dates.length || !isRangeMode()) {
    els.rankProjectionSubtitle.textContent = "Choose a date range";
    els.rankProjectionChart.innerHTML = `<div class="empty">Choose a date range to see genre sales.</div>`;
    return;
  }

  const granularity = forcedGranularity || "daily";
  if (!rows.length) {
    els.rankProjectionSubtitle.textContent = "No model estimate found";
    els.rankProjectionChart.innerHTML = `<div class="empty">No genre sales estimate found for this period.</div>`;
    return;
  }

  const genre = els.genreSelect.value || "all";
  const buckets = aggregateEstimateTrendRows(rows, dates, granularity);
  const pointsData = buckets.filter((bucket) => bucket.rowCount > 0);
  if (!pointsData.length) {
    els.rankProjectionSubtitle.textContent = "No model estimate found";
    els.rankProjectionChart.innerHTML = `<div class="empty">No genre sales estimate found for this period.</div>`;
    return;
  }

  const width = 1040;
  const height = 230;
  const padX = 54;
  const padTop = 22;
  const padBottom = 44;
  const plotWidth = width - (padX * 2);
  const plotHeight = height - padTop - padBottom;
  const intervalValues = pointsData.flatMap((point) => [
    point.sales,
    point.salesLow || point.sales,
    point.salesHigh || point.sales
  ].filter((value) => Number.isFinite(value) && value >= 0));
  const rawMin = Math.min(...intervalValues);
  const rawMax = Math.max(...intervalValues, 1);
  const rawRange = Math.max(rawMax - rawMin, rawMax * 0.03, 1);
  const min = Math.max(0, rawMin - (rawRange * 0.12));
  const max = rawMax * 1.3;
  const scaleRange = Math.max(max - min, 1);
  const yForValue = (value) => padTop + plotHeight - (((Math.min(max, Math.max(min, value)) - min) / scaleRange) * plotHeight);
  const points = pointsData.map((bucket, index) => {
    const x = pointsData.length === 1 ? width / 2 : padX + (plotWidth * index) / (pointsData.length - 1);
    return {
      ...bucket,
      x,
      y: yForValue(bucket.sales),
      value: bucket.sales,
      low: bucket.salesLow || bucket.sales,
      high: bucket.salesHigh || bucket.sales,
      source: bucket.actualCount > 0 ? "actual" : "model"
    };
  });
  const visualValues = smoothedVisualValues(points, "value");
  const visualLowValues = smoothedVisualValues(points, "low");
  const visualHighValues = smoothedVisualValues(points, "high");
  const visualPoints = points.map((point, index) => ({
    ...point,
    visualValue: visualValues[index],
    visualLow: Math.min(visualLowValues[index], visualValues[index]),
    visualHigh: Math.max(visualHighValues[index], visualValues[index]),
    y: yForValue(visualValues[index])
  }));
  const highPoints = visualPoints.map((point) => `${point.x.toFixed(1)},${yForValue(point.visualHigh).toFixed(1)}`);
  const lowPoints = visualPoints.slice().reverse().map((point) => `${point.x.toFixed(1)},${yForValue(point.visualLow).toFixed(1)}`);
  const intervalArea = [...highPoints, ...lowPoints].join(" ");
  const line = curvedSvgPath(visualPoints);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: min + (scaleRange * ratio),
    y: padTop + plotHeight - (plotHeight * ratio)
  }));
  const ticks = points.filter((_, index) => (
    index === 0 || index === points.length - 1 || index === Math.floor((points.length - 1) / 2)
  ));

  els.rankProjectionSubtitle.textContent = `${rankGenreLabel(genre)} total sales for ${label}`;
  els.rankProjectionChart.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Genre sales chart">
      ${yTicks.map((tick) => `
        <line x1="${padX}" y1="${tick.y.toFixed(1)}" x2="${width - padX}" y2="${tick.y.toFixed(1)}" class="trend-grid"></line>
        <text x="${padX - 8}" y="${(tick.y + 4).toFixed(1)}" text-anchor="end" class="trend-y-label">${compactYen(tick.value)}</text>
      `).join("")}
      <polygon points="${intervalArea}" class="trend-interval-area"></polygon>
      <path d="${line}" class="trend-line model"></path>
      ${visualPoints.map((point) => {
        const promotions = eventsForDates(point.dates || []);
        const tooltip = escapeHtml([
          `${point.key} - ${rankGenreLabel(genre)}`,
          "Total genre sales",
          `Exact: ${yen.format(point.value)}`,
          `95% estimate: ${yen.format(point.low)} to ${yen.format(point.high)}`,
          promotions.length ? `Promotion: ${promotions.join(", ")}` : "Promotion: No promotion listed"
        ].join("\n"));
        return `
          <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2.5" class="trend-point${promotions.length ? " has-event" : ""}"></circle>
          <circle
            cx="${point.x.toFixed(1)}"
            cy="${point.y.toFixed(1)}"
            r="9"
            fill="transparent"
            stroke="transparent"
            tabindex="0"
            class="trend-hover-target"
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
  attachTrendTooltipHandlers(els.rankProjectionChart);
}

function renderRankProjection(rows, dates) {
  if (!els.rankProjectionChart || !els.rankProjectionSubtitle || !els.rankProjectionSelect) return;
  const genre = els.genreSelect.value;
  const rank = Number(els.rankProjectionSelect.value) || 1;

  if (!dates.length) {
    els.rankProjectionSubtitle.textContent = "Choose a date";
    els.rankProjectionChart.innerHTML = `<div class="empty">Choose a date or period to see a rank projection.</div>`;
    return;
  }

  if (GENRES_WITHOUT_RANK_DATA.has(genre)) {
    els.rankProjectionSubtitle.textContent = "No model file";
    els.rankProjectionChart.innerHTML = `<div class="empty">No rank model output is available for ${genreLabel(genre)}.</div>`;
    return;
  }

  if (isAllTimeView(dates)) {
    els.rankProjectionSubtitle.textContent = "Choose a shorter range";
    els.rankProjectionChart.innerHTML = `<div class="empty">Choose a day or date range to see the rank #${rank} projection.</div>`;
    return;
  }

  const dateSet = new Set(dates);
  const byDate = new Map();
  const scaleRowsByDateRank = new Map();
  rows
    .filter((row) => dateSet.has(row.date) && (genre === "all" || row.genre === genre) && row.rank >= 1 && row.rank <= 80)
    .forEach((row) => {
      const scaleKey = `${row.date}|${row.rank}`;
      if (!scaleRowsByDateRank.has(scaleKey)) scaleRowsByDateRank.set(scaleKey, []);
      scaleRowsByDateRank.get(scaleKey).push(row);
      if (row.rank !== rank) return;
      if (!byDate.has(row.date)) byDate.set(row.date, []);
      byDate.get(row.date).push(row);
    });

  const points = dates.map((date) => {
    const row = rankEstimateForRows(byDate.get(date) || [], rank, genre);
    const curveSales = rankCurveEstimate(genre, rank);
    if (!row && (!Number.isFinite(curveSales) || curveSales <= 0)) return null;
    const sales = row?.sales || curveSales || 0;
    const fallbackLow = sales * 0.75;
    const fallbackHigh = sales * 1.25;
    const interval = centeredSalesInterval(sales, row?.salesLow || fallbackLow, row?.salesHigh || fallbackHigh);
    return {
      date,
      label: date.slice(5),
      value: sales,
      low: Math.min(interval.salesLow, sales),
      high: Math.max(interval.salesHigh, sales),
      source: row?.source || "estimated"
    };
  }).filter(Boolean);

  if (!points.length) {
    els.rankProjectionSubtitle.textContent = `Rank #${rank}`;
    els.rankProjectionChart.innerHTML = `<div class="empty">No rank #${rank} projection found for ${periodLabel(dates)} and ${rankGenreLabel(genre)}.</div>`;
    return;
  }

  const width = 1040;
  const height = 230;
  const padX = 54;
  const padTop = 22;
  const padBottom = 44;
  const plotWidth = width - (padX * 2);
  const plotHeight = height - padTop - padBottom;
  const intervalValues = points.flatMap((point) => [
    point.value,
    point.low,
    point.high
  ].filter((value) => Number.isFinite(value) && value >= 0));
  const rawMin = Math.min(...intervalValues);
  const rawMax = Math.max(...intervalValues, 1);
  const rawRange = Math.max(rawMax - rawMin, rawMax * 0.03, 1);
  const min = Math.max(0, rawMin - (rawRange * 0.12));
  const max = rawMax * 1.3;
  const scaleRange = Math.max(max - min, 1);
  const yForValue = (value) => padTop + plotHeight - (((Math.min(max, Math.max(min, value)) - min) / scaleRange) * plotHeight);
  const chartPoints = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : padX + (plotWidth * index) / (points.length - 1);
    return {
      ...point,
      x,
      y: yForValue(point.value)
    };
  });
  const line = chartPoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const highPoints = chartPoints.map((point) => `${point.x.toFixed(1)},${yForValue(point.high).toFixed(1)}`);
  const lowPoints = chartPoints.slice().reverse().map((point) => `${point.x.toFixed(1)},${yForValue(point.low).toFixed(1)}`);
  const intervalArea = [...highPoints, ...lowPoints].join(" ");
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: min + (scaleRange * ratio),
    y: padTop + plotHeight - (plotHeight * ratio)
  }));
  const ticks = chartPoints.filter((_, index) => (
    index === 0 || index === chartPoints.length - 1 || index === Math.floor((chartPoints.length - 1) / 2)
  ));

  els.rankProjectionSubtitle.textContent = `${rankGenreLabel(genre)} rank #${rank} projection`;
  els.rankProjectionChart.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Rank #${rank} projection chart">
      ${yTicks.map((tick) => `
        <line x1="${padX}" y1="${tick.y.toFixed(1)}" x2="${width - padX}" y2="${tick.y.toFixed(1)}" class="trend-grid"></line>
        <text x="${padX - 8}" y="${(tick.y + 4).toFixed(1)}" text-anchor="end" class="trend-y-label">${compactYen(tick.value)}</text>
      `).join("")}
      <polygon points="${intervalArea}" class="trend-interval-area"></polygon>
      <polyline points="${line}" class="trend-line"></polyline>
      ${chartPoints.map((point) => {
        const promotions = eventsForDates([point.date]);
        const tooltipLines = [
          `${point.date} - Rank #${rank}`,
          point.source === "actual" ? "Known TENKI actual" : "Model estimate",
          `Exact: ${yen.format(point.value)}`
        ];
        if (point.source !== "actual") {
          tooltipLines.push(`95% estimate: ${yen.format(point.low)} to ${yen.format(point.high)}`);
        }
        tooltipLines.push(promotions.length ? `Promotion: ${promotions.join(", ")}` : "Promotion: No promotion listed");
        const tooltip = escapeHtml([
          ...tooltipLines
        ].join("\n"));
        return `
          <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${point.source === "actual" ? 3 : 2}" class="trend-point${promotions.length ? " has-event" : ""}"></circle>
          <circle
            cx="${point.x.toFixed(1)}"
            cy="${point.y.toFixed(1)}"
            r="9"
            fill="transparent"
            stroke="transparent"
            tabindex="0"
            class="trend-hover-target"
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
  attachTrendTooltipHandlers(els.rankProjectionChart);
}

function renderRankGapChart(rows, rankDate) {
  els.rankGapChart.classList.remove("horizontal-rank-chart");
  if (!rows.length) {
    els.rankGapChart.innerHTML = `<div class="empty">No rank estimates to chart.</div>`;
    return;
  }

  const width = 1120;
  const height = 260;
  const padLeft = 64;
  const padRight = 26;
  const padTop = 22;
  const padBottom = 42;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const maxValue = Math.max(...rows.map((row) => Math.max(row.salesHigh || row.sales, row.sales || 0)), 1) * 1.3;
  const rankSlot = plotWidth / rows.length;
  const barWidth = Math.max(3, Math.min(9, rankSlot * 0.38));
  const ciCapWidth = Math.max(2, Math.min(5, barWidth * 0.55));
  const scaleY = (value) => padTop + plotHeight - ((value / maxValue) * plotHeight);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: maxValue * ratio,
    y: scaleY(maxValue * ratio)
  }));

  els.rankGapChart.innerHTML = `
    <svg class="rank-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Estimated sales by rank for ${rankDate}">
      ${yTicks.map((tick) => `
        <line x1="${padLeft}" y1="${tick.y.toFixed(1)}" x2="${width - padRight}" y2="${tick.y.toFixed(1)}" class="trend-grid"></line>
        <text x="${padLeft - 8}" y="${(tick.y + 4).toFixed(1)}" text-anchor="end" class="trend-y-label">${compactYen(tick.value)}</text>
      `).join("")}
      ${rows.map((row, index) => {
        const centerX = padLeft + (index * rankSlot) + (rankSlot / 2);
        const x = centerX - (barWidth / 2);
        const y = scaleY(row.sales);
        const lowY = scaleY(row.salesLow || row.sales);
        const highY = scaleY(row.salesHigh || row.sales);
        const barHeight = Math.max(2, padTop + plotHeight - y);
        const isActual = row.source === "actual";
        const tooltipTitle = row.tooltipLabel || `Rank #${row.rank}`;
        const tooltip = escapeHtml(`${tooltipTitle}\n${isActual ? "Known value" : "Model estimate"}\nExact: ${yen.format(row.sales)}\n95% low: ${yen.format(row.salesLow || row.sales)}\n95% high: ${yen.format(row.salesHigh || row.sales)}`);
        return `
          <rect
            x="${x.toFixed(1)}"
            y="${y.toFixed(1)}"
            width="${barWidth.toFixed(1)}"
            height="${barHeight.toFixed(1)}"
            rx="4"
            class="rank-bar ${isActual ? "actual" : "estimated"}">
          </rect>
          <line x1="${centerX.toFixed(1)}" y1="${highY.toFixed(1)}" x2="${centerX.toFixed(1)}" y2="${lowY.toFixed(1)}" class="rank-ci-line"></line>
          <line x1="${(centerX - ciCapWidth).toFixed(1)}" y1="${highY.toFixed(1)}" x2="${(centerX + ciCapWidth).toFixed(1)}" y2="${highY.toFixed(1)}" class="rank-ci-line"></line>
          <line x1="${(centerX - ciCapWidth).toFixed(1)}" y1="${lowY.toFixed(1)}" x2="${(centerX + ciCapWidth).toFixed(1)}" y2="${lowY.toFixed(1)}" class="rank-ci-line"></line>
          <rect
            x="${(centerX - (rankSlot / 2)).toFixed(1)}"
            y="${Math.min(highY, y).toFixed(1)}"
            width="${rankSlot.toFixed(1)}"
            height="${Math.max(16, (padTop + plotHeight - Math.min(highY, y))).toFixed(1)}"
            fill="transparent"
            tabindex="0"
            class="trend-hover-target"
            data-tooltip="${tooltip}">
          </rect>
        `;
      }).join("")}
      ${rows.map((row, index) => {
        const x = padLeft + (index * rankSlot) + (rankSlot / 2);
        const label = row.chartLabel || row.rank;
        if (rows.length > 30 && row.rank !== 1 && row.rank % 5 !== 0 && row.rank !== rows.length) return "";
        return `<text x="${x.toFixed(1)}" y="${height - 16}" text-anchor="middle" class="trend-tick">${label}</text>`;
      }).join("")}
    </svg>
    <div class="rank-chart-legend">
      <span><i class="rank-key estimated"></i>Model estimate</span>
      <span><i class="rank-key actual"></i>Known value</span>
      <span><i class="rank-ci-key"></i>95% CI</span>
    </div>
    <div class="trend-tooltip" hidden></div>
  `;
  attachTrendTooltipHandlers(els.rankGapChart);
}

function renderHorizontalRankGapChart(rows, rankDate) {
  els.rankGapChart.classList.add("horizontal-rank-chart");
  if (!rows.length) {
    els.rankGapChart.innerHTML = `<div class="empty">No estimates to chart.</div>`;
    return;
  }

  const width = 1120;
  const rowSlot = 38;
  const height = Math.max(150, 76 + (rows.length * rowSlot));
  const padLeft = 250;
  const padRight = 34;
  const padTop = 24;
  const padBottom = 38;
  const plotWidth = width - padLeft - padRight;
  const maxValue = Math.max(...rows.map((row) => Math.max(row.salesHigh || row.sales, row.sales || 0)), 1) * 1.3;
  const scaleX = (value) => padLeft + ((value / maxValue) * plotWidth);
  const barHeight = 14;
  const ciCapHeight = 5;
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: maxValue * ratio,
    x: scaleX(maxValue * ratio)
  }));

  els.rankGapChart.innerHTML = `
    <svg class="rank-chart-svg horizontal" viewBox="0 0 ${width} ${height}" role="img" aria-label="Estimated sales by genre for ${rankDate}">
      ${xTicks.map((tick) => `
        <line x1="${tick.x.toFixed(1)}" y1="${padTop}" x2="${tick.x.toFixed(1)}" y2="${height - padBottom}" class="trend-grid"></line>
        <text x="${tick.x.toFixed(1)}" y="${height - 14}" text-anchor="middle" class="trend-tick">${compactYen(tick.value)}</text>
      `).join("")}
      ${rows.map((row, index) => {
        const centerY = padTop + (index * rowSlot) + (rowSlot / 2);
        const y = centerY - (barHeight / 2);
        const barWidth = Math.max(2, scaleX(row.sales) - padLeft);
        const lowX = scaleX(row.salesLow || row.sales);
        const highX = scaleX(row.salesHigh || row.sales);
        const isActual = row.source === "actual";
        const label = row.label || `#${row.rank}`;
        const tooltipTitle = row.tooltipLabel || label;
        const tooltip = escapeHtml(`${tooltipTitle}\n${isActual ? "Known value" : "Model estimate"}\nSales: ${yen.format(row.sales)}\nUnits sold: ${whole.format(row.units || 0)}\n95% low: ${yen.format(row.salesLow || row.sales)}\n95% high: ${yen.format(row.salesHigh || row.sales)}`);
        return `
          <text x="${padLeft - 12}" y="${(centerY + 4).toFixed(1)}" text-anchor="end" class="trend-y-label">${escapeHtml(label)}</text>
          <rect
            x="${padLeft}"
            y="${y.toFixed(1)}"
            width="${barWidth.toFixed(1)}"
            height="${barHeight}"
            rx="5"
            class="rank-bar ${isActual ? "actual" : "estimated"}">
          </rect>
          <line x1="${lowX.toFixed(1)}" y1="${centerY.toFixed(1)}" x2="${highX.toFixed(1)}" y2="${centerY.toFixed(1)}" class="rank-ci-line"></line>
          <line x1="${lowX.toFixed(1)}" y1="${(centerY - ciCapHeight).toFixed(1)}" x2="${lowX.toFixed(1)}" y2="${(centerY + ciCapHeight).toFixed(1)}" class="rank-ci-line"></line>
          <line x1="${highX.toFixed(1)}" y1="${(centerY - ciCapHeight).toFixed(1)}" x2="${highX.toFixed(1)}" y2="${(centerY + ciCapHeight).toFixed(1)}" class="rank-ci-line"></line>
          <rect
            x="${padLeft}"
            y="${(centerY - (rowSlot / 2)).toFixed(1)}"
            width="${plotWidth}"
            height="${rowSlot}"
            fill="transparent"
            tabindex="0"
            class="trend-hover-target"
            data-tooltip="${tooltip}">
          </rect>
        `;
      }).join("")}
    </svg>
    <div class="rank-chart-legend">
      <span><i class="rank-key estimated"></i>Model estimate</span>
      <span><i class="rank-ci-key"></i>95% CI</span>
    </div>
    <div class="trend-tooltip" hidden></div>
  `;
  attachTrendTooltipHandlers(els.rankGapChart);
}

function centeredSalesInterval(sales, low, high) {
  const exact = Number(sales) || 0;
  if (!exact) return { salesLow: 0, salesHigh: 0 };
  const lower = Number.isFinite(low) && low > 0 ? low : exact * 0.75;
  const upper = Number.isFinite(high) && high > 0 ? high : exact * 1.25;
  const validBand = upper > lower && lower <= exact && upper >= exact;
  const halfWidth = validBand
    ? Math.max(exact - lower, upper - exact)
    : exact * 0.25;
  return {
    salesLow: Math.max(0, exact - halfWidth),
    salesHigh: exact + halfWidth
  };
}

function estimatedShopRowsForGenre(genre, dates, rankRows, rankSummaryRows = [], directShopRows = []) {
  if (!genre) return [];
  const isAllGenres = genre === "all";
  const dateSet = new Set(dates);
  const summary = isAllGenres
    ? rankSummaryForMetric(rankSummaryRows, dates, "all")
    : rankSummaryForMetric(rankSummaryRows, dates, genre);
  let sales = summary?.sales || 0;
  let salesLow = summary?.salesLow || 0;
  let salesHigh = summary?.salesHigh || 0;

  if (!sales) {
    const rows = rankRows.filter((row) =>
      dateSet.has(row.date) &&
      (isAllGenres || row.genre === genre) &&
      row.rank >= 1 &&
      row.rank <= 80
    );
    sales = rows.reduce((sum, row) => sum + (row.sales || 0), 0);
    salesLow = rows.reduce((sum, row) => sum + (row.salesLow || row.sales || 0), 0);
    salesHigh = rows.reduce((sum, row) => sum + (row.salesHigh || row.sales || 0), 0);
  }

  const byShop = new Map();
  directShopRows.forEach((row) => {
    if (!dateSet.has(row.date) || (!isAllGenres && row.genre !== genre) || !row.shop) return;
    const current = byShop.get(row.shop) || {
      shop: row.shop,
      sales: 0,
      salesLow: 0,
      salesHigh: 0,
      units: 0
    };
    current.sales += row.predictedSales || 0;
    current.salesLow += Number.isFinite(row.predictedSalesLow) ? row.predictedSalesLow : row.predictedSales || 0;
    current.salesHigh += Number.isFinite(row.predictedSalesHigh) ? row.predictedSalesHigh : row.predictedSales || 0;
    current.units += row.predictedUnits || 0;
    byShop.set(row.shop, current);
  });

  const mixRows = isAllGenres
    ? [...state.shopGenreMix.entries()].map(([shop, rows]) => ({
      shop,
      sales: rows.reduce((sum, row) => sum + (row.sales || 0), 0)
    }))
    : state.genreShopMix.get(String(genre)) || [];
  const totalMixSales = mixRows.reduce((sum, row) => sum + (row.sales || 0), 0);
  if (sales && totalMixSales) {
    mixRows.forEach((row) => {
      if (!row.shop || byShop.has(row.shop)) return;
      const share = (row.sales || 0) / totalMixSales;
      byShop.set(row.shop, {
        shop: row.shop,
        sales: sales * share,
        salesLow: salesLow * share,
        salesHigh: salesHigh * share,
        units: 0
      });
    });
  }
  if (isAllGenres && sales && byShop.size < RANK_DISPLAY_LIMIT && state.allShopIds.length) {
    const existingSales = [...byShop.values()].reduce((sum, row) => sum + (row.sales || 0), 0);
    const remainingSales = Math.max(0, sales - existingSales);
    const fallbackIds = state.allShopIds.filter((shop) => !byShop.has(shop)).slice(0, RANK_DISPLAY_LIMIT - byShop.size);
    const fallbackSales = fallbackIds.length ? remainingSales / fallbackIds.length : 0;
    fallbackIds.forEach((shop) => {
      byShop.set(shop, {
        shop,
        sales: fallbackSales,
        salesLow: fallbackSales,
        salesHigh: fallbackSales,
        units: 0
      });
    });
  }

  return [...byShop.values()]
    .filter((row) => row.shop && row.sales > 0)
    .sort((a, b) => b.sales - a.sales || b.units - a.units || String(a.shop).localeCompare(String(b.shop)))
    .slice(0, RANK_DISPLAY_LIMIT)
    .map((row, index) => ({
      rank: index + 1,
      chartLabel: index + 1,
      label: `Shop ${row.shop}`,
      tooltipLabel: `#${index + 1} - Shop ${row.shop}`,
      shop: row.shop,
      genre,
      sales: row.sales,
      salesLow: row.salesLow || row.sales,
      salesHigh: row.salesHigh || row.sales,
      source: "estimated",
      salesKnown: true
    }));
}

function allGenreTopRankRows(rows) {
  const itemTotals = new Map();
  rows.forEach((row) => {
    if (!row || row.rank < 1 || row.rank > RANK_DISPLAY_LIMIT || !(row.sales > 0)) return;
    const shop = isRealShopId(row.shop) ? String(row.shop) : "";
    const item = row.item ? String(row.item) : "";
    const rowGenre = row.genre ? String(row.genre) : "all";
    const key = shop || item
      ? `${rowGenre}|${shop}|${item}`
      : `${rowGenre}|rank-${row.rank}`;
    const current = itemTotals.get(key) || {
      sourceRank: row.rank,
      sourceGenre: rowGenre,
      shop,
      item,
      sales: 0,
      salesLow: 0,
      salesHigh: 0,
      actualCount: 0,
      rows: 0
    };
    current.sourceRank = Math.min(current.sourceRank, row.rank || current.sourceRank);
    current.sales += row.sales || 0;
    current.salesLow += Number.isFinite(row.salesLow) ? row.salesLow : row.sales || 0;
    current.salesHigh += Number.isFinite(row.salesHigh) ? row.salesHigh : row.sales || 0;
    current.actualCount += row.source === "actual" ? 1 : 0;
    current.rows += 1;
    itemTotals.set(key, current);
  });

  return [...itemTotals.values()]
    .sort((a, b) => b.sales - a.sales || a.sourceRank - b.sourceRank || genreLabel(a.sourceGenre).localeCompare(genreLabel(b.sourceGenre)))
    .slice(0, RANK_DISPLAY_LIMIT)
    .map((row, index) => ({
      rank: index + 1,
      chartLabel: index + 1,
      sourceRank: row.sourceRank,
      sourceGenre: row.sourceGenre,
      label: row.shop ? `Shop ${row.shop}` : genreLabel(row.sourceGenre),
      tooltipLabel: `#${index + 1} - ${genreLabel(row.sourceGenre)} rank #${row.sourceRank}`,
      shop: row.shop,
      item: row.item,
      genre: row.sourceGenre,
      sales: row.sales,
      salesLow: row.salesLow || row.sales,
      salesHigh: row.salesHigh || row.sales,
      source: row.actualCount === row.rows ? "actual" : "estimated",
      salesKnown: true
    }));
}

function renderRankGapEstimates(rows, dates, rankSummaryRows = [], directShopRows = [], periodItemRows = [], allTimeItemRows = []) {
  const genre = els.genreSelect.value;
  const allTime = isAllTimeView(dates);
  const isPeriod = dates.length > 1;
  const rankLabel = periodLabel(dates);
  if (GENRES_WITHOUT_RANK_DATA.has(genre)) {
    els.rankGapCount.textContent = "No model file";
    els.rankGapChart.innerHTML = `<div class="empty">No rank model output is available for ${genreLabel(genre)}.</div>`;
    els.rankGapBody.innerHTML = `<tr><td colspan="5">No rank model output is available for ${genreLabel(genre)}.</td></tr>`;
    return;
  }

  const dateSet = new Set(dates);
  const availableRankDates = new Set(rows
    .filter((row) =>
      (allTime || dateSet.has(row.date)) &&
      (genre === "all" || row.genre === genre) &&
      row.rank >= 1 &&
      row.rank <= RANK_DISPLAY_LIMIT
    )
    .map((row) => row.date));
  if (!availableRankDates.size) {
    els.rankGapCount.textContent = "No rank data";
    els.rankGapChart.innerHTML = `<div class="empty">No rank data found for ${periodLabel(dates)} and ${rankGenreLabel(genre)}.</div>`;
    els.rankGapBody.innerHTML = `<tr><td colspan="5">No rank data found for ${periodLabel(dates)} and ${rankGenreLabel(genre)}.</td></tr>`;
    return;
  }

  const filtered = rows.filter((row) =>
    (allTime || dateSet.has(row.date)) &&
    (genre === "all" || row.genre === genre) &&
    row.rank >= 1 &&
    row.rank <= RANK_DISPLAY_LIMIT
  );
  if (!filtered.length) {
    els.rankGapCount.textContent = "No rank data";
    els.rankGapChart.innerHTML = `<div class="empty">No rank data found for ${rankLabel} and ${rankGenreLabel(genre)}.</div>`;
    els.rankGapBody.innerHTML = `<tr><td colspan="5">No rank data found for ${rankLabel} and ${rankGenreLabel(genre)}.</td></tr>`;
    return;
  }

  const curveByRank = state.rankCurves.get(genre) || new Map();
  const identityForRank = (rank) => {
    const identityCounts = new Map();
    filtered
      .filter((row) => row.rank === rank && isRealShopId(row.shop))
      .forEach((row) => {
        const shop = String(row.shop);
        const item = row.item ? String(row.item) : "";
        const key = `${shop}|${item}`;
        const current = identityCounts.get(key) || { shop, item, count: 0, sales: 0 };
        current.count += item ? 2 : 1;
        current.sales += row.sales || 0;
        identityCounts.set(key, current);
      });
    return [...identityCounts.values()]
      .sort((a, b) => b.count - a.count || b.sales - a.sales || a.shop.localeCompare(b.shop) || a.item.localeCompare(b.item))[0] || null;
  };
  const withRankIdentity = (row, rank) => {
    if (!row) return row;
    if (isRealShopId(row.shop) && row.item) return row;
    const identity = identityForRank(rank);
    if (!identity) return row;
    return {
      ...row,
      shop: isRealShopId(row.shop) ? row.shop : identity.shop,
      item: row.item || identity.item
    };
  };
  const rankedIdentityForRank = (rank) => {
    const identityCounts = new Map();
    filtered
      .filter((row) => row.rank === rank && isRealShopId(row.shop))
      .forEach((row) => {
        const shop = String(row.shop);
        const item = row.item ? String(row.item) : "";
        const key = `${shop}|${item}`;
        const current = identityCounts.get(key) || { shop, item, count: 0, sales: 0 };
        current.count += 1;
        current.sales += row.sales || 0;
        identityCounts.set(key, current);
      });
    return [...identityCounts.values()]
      .sort((a, b) => b.count - a.count || b.sales - a.sales || a.shop.localeCompare(b.shop) || a.item.localeCompare(b.item))[0] || null;
  };

  const estimateForRank = (rank) => {
    const rankRows = filtered.filter((row) => row.rank === rank);
    if (genre === "all" || isPeriod) {
      const aggregated = aggregateRankRows(rankRows, rank);
      if (aggregated) return withRankIdentity(aggregated, rank);
    }
    const sameDayKnown = rankRows.find((row) => row.source === "actual" && row.salesKnown);
    if (sameDayKnown) return withRankIdentity(sameDayKnown, rank);
    const sameDayEstimate = rankRows.find((row) => row.source === "estimated" && row.salesKnown);
    if (sameDayEstimate) return withRankIdentity(sameDayEstimate, rank);

    const curveSales = curveByRank.get(rank);
    if (Number.isFinite(curveSales)) {
      const multiplier = isPeriod ? availableRankDates.size : 1;
      const identity = rankedIdentityForRank(rank);
      return {
        rank,
        shop: identity?.shop || "",
        item: identity?.item || "",
        sales: curveSales * multiplier,
        salesLow: curveSales * multiplier,
        salesHigh: curveSales * multiplier,
        source: "estimated"
      };
    }
    return { rank, sales: 0, salesLow: 0, salesHigh: 0, source: "estimated" };
  };

  let topRows = genre === "all"
    ? allGenreTopRankRows(filtered)
    : Array.from({ length: RANK_DISPLAY_LIMIT }, (_, index) => {
      const rank = index + 1;
      const estimate = estimateForRank(rank);
      const shopId = shopIdForRankEstimate(estimate, rank, genre);
      const shopLabel = shopLabelForRankEstimate(estimate, rank, genre);
      return {
        rank,
        chartLabel: rank,
        label: shopLabel,
        tooltipLabel: `Rank #${whole.format(rank)} - ${shopLabel}`,
        ...estimate,
        shop: estimate?.shop || shopId,
        genre
      };
    });

  if (allTime) {
    const allTimeSummary = rankSummaryForMetric(rankSummaryRows, dates, genre);
    const totalSales = topRows.reduce((sum, row) => sum + (row.sales || 0), 0);
    const totalLow = topRows.reduce((sum, row) => sum + (row.salesLow || row.sales || 0), 0);
    const totalHigh = topRows.reduce((sum, row) => sum + (row.salesHigh || row.sales || 0), 0);
    if (allTimeSummary?.sales > 0 && totalSales > 0) {
      const salesScale = allTimeSummary.sales / totalSales;
      const lowScale = allTimeSummary.salesLow > 0 && totalLow > 0 ? allTimeSummary.salesLow / totalLow : salesScale;
      const highScale = allTimeSummary.salesHigh > 0 && totalHigh > 0 ? allTimeSummary.salesHigh / totalHigh : salesScale;
      topRows = topRows.map((row) => ({
        ...row,
        sales: (row.sales || 0) * salesScale,
        salesLow: (row.salesLow || row.sales || 0) * lowScale,
        salesHigh: (row.salesHigh || row.sales || 0) * highScale,
        source: row.source === "actual" ? "estimated" : row.source,
        tooltipLabel: `${row.tooltipLabel || `Rank #${row.rank}`} - all-time estimate`
      }));
    }
  }

  topRows = cleanRankDisplayRows(topRows, genre);

  els.rankGapCount.textContent = `${rankGenreLabel(genre)} estimates for ${rankLabel}`;
  renderRankGapChart(topRows, rankLabel);
  els.rankGapBody.innerHTML = topRows.map((row, index) => {
    const isActual = row.source === "actual";
    return `
      <tr class="${isActual ? "actual-rank-row" : "estimated-rank-row"}">
        <td>#${whole.format(row.rank || index + 1)}</td>
        <td>${itemIdForRankRow(row, periodItemRows, allTimeItemRows)}</td>
        <td>${isRealShopId(row.shop) ? escapeHtml(row.shop) : "-"}</td>
        <td>${yen.format(row.sales)}</td>
        <td><span class="source-pill ${isActual ? "actual" : "estimated"}">${isActual ? "Known value" : "Model estimate"}</span></td>
      </tr>
    `;
  }).join("");
}

function renderShopGenreRankEstimates(rows, dates, periodItemRows = [], allTimeItemRows = []) {
  if (!els.rankGapChart || !els.rankGapBody || !els.rankGapCount) return;
  const shop = els.shopSelect?.value || "all";
  const rankLabel = periodLabel(dates);
  syncRankPanelCopy();

  if (shop === "all") {
    const byShop = new Map();
    rows.forEach((row) => {
      if (!isRealShopId(row.shop)) return;
      const current = byShop.get(row.shop) || {
        shop: row.shop,
        sales: 0,
        salesLow: 0,
        salesHigh: 0,
        units: 0
      };
      current.sales += row.predictedSales || 0;
      current.salesLow += Number.isFinite(row.predictedSalesLow) ? row.predictedSalesLow : row.predictedSales || 0;
      current.salesHigh += Number.isFinite(row.predictedSalesHigh) ? row.predictedSalesHigh : row.predictedSales || 0;
      current.units += row.predictedUnits || 0;
      byShop.set(row.shop, current);
    });
    const shopRows = cleanRankDisplayRows([...byShop.values()]
      .filter((row) => row.sales > 0 || row.units > 0)
      .sort((a, b) => b.sales - a.sales || b.units - a.units || String(a.shop).localeCompare(String(b.shop)))
      .slice(0, RANK_DISPLAY_LIMIT)
      .map((row, index) => {
        const interval = centeredSalesInterval(row.sales, row.salesLow, row.salesHigh);
        return {
          rank: index + 1,
          chartLabel: index + 1,
          label: `Shop ${row.shop}`,
          tooltipLabel: `#${index + 1} Shop ${row.shop}`,
          shop: row.shop,
          genre: "all",
          sales: row.sales,
          salesLow: interval.salesLow,
          salesHigh: interval.salesHigh,
          units: row.units,
          source: "estimated"
        };
      }), "all");
    if (!shopRows.length) {
      els.rankGapCount.textContent = "No shop estimates";
      els.rankGapChart.innerHTML = `<div class="empty">No shop estimates found for ${rankLabel}.</div>`;
      els.rankGapBody.innerHTML = `<tr><td colspan="5">No shop estimates found for ${rankLabel}.</td></tr>`;
      return;
    }
    els.rankGapCount.textContent = `All shop estimates for ${rankLabel}`;
    renderRankGapChart(shopRows, rankLabel);
    els.rankGapBody.innerHTML = shopRows.map((row) => `
      <tr class="estimated-rank-row">
        <td>#${whole.format(row.rank)}</td>
        <td>${row.label}</td>
        <td>${itemIdForRankRow(row, periodItemRows, allTimeItemRows)}</td>
        <td>${yen.format(row.sales)}</td>
        <td><span class="source-pill estimated">Model estimate</span></td>
      </tr>
    `).join("");
    return;
  }

  const byGenre = new Map();
  rows.forEach((row) => {
    if (!row.genre || row.genre === "all") return;
    const current = byGenre.get(row.genre) || {
      genre: row.genre,
      sales: 0,
      salesLow: 0,
      salesHigh: 0,
      units: 0
    };
    current.sales += row.predictedSales || 0;
    current.salesLow += Number.isFinite(row.predictedSalesLow) ? row.predictedSalesLow : row.predictedSales || 0;
    current.salesHigh += Number.isFinite(row.predictedSalesHigh) ? row.predictedSalesHigh : row.predictedSales || 0;
    current.units += row.predictedUnits || 0;
    byGenre.set(row.genre, current);
  });

  const topRows = cleanRankDisplayRows([...byGenre.values()]
    .filter((row) => row.sales > 0 || row.units > 0)
    .sort((a, b) => b.sales - a.sales || b.units - a.units || genreLabel(a.genre).localeCompare(genreLabel(b.genre)))
    .slice(0, RANK_DISPLAY_LIMIT)
    .map((row, index) => ({
      rank: index + 1,
      chartLabel: index + 1,
      label: genreLabel(row.genre),
      tooltipLabel: `#${index + 1} ${genreLabel(row.genre)}`,
      shop,
      genre: row.genre,
      sales: row.sales,
      salesLow: row.salesLow || row.sales,
      salesHigh: row.salesHigh || row.sales,
      units: row.units,
      source: "estimated"
    })), "all");

  if (!topRows.length) {
    els.rankGapCount.textContent = "No product estimates";
    els.rankGapChart.innerHTML = `<div class="empty">No genre estimates found for Shop ${escapeHtml(shop)} and ${rankLabel}.</div>`;
    els.rankGapBody.innerHTML = `<tr><td colspan="5">No genre estimates found for Shop ${escapeHtml(shop)} and ${rankLabel}.</td></tr>`;
    return;
  }

  els.rankGapCount.textContent = `Shop ${shop} product estimates for ${rankLabel}`;
  renderHorizontalRankGapChart(topRows, rankLabel);
  els.rankGapBody.innerHTML = topRows.map((row) => `
    <tr class="estimated-rank-row">
      <td>#${whole.format(row.rank)}</td>
      <td>${row.label}</td>
      <td>${whole.format(row.units || 0)}</td>
      <td>${yen.format(row.sales)}</td>
      <td><span class="source-pill estimated">Model estimate</span></td>
    </tr>
  `).join("");
}

function totalsFor(rows) {
  return rows.reduce((acc, row) => {
    acc.sales += row.sales;
    acc.units += row.units;
    return acc;
  }, { sales: 0, units: 0 });
}

function renderShopComparison(rows) {
  if (!els.shopCompareCount || !els.shopCompareBody) return;
  const totalSales = rows.reduce((sum, row) => sum + row.sales, 0);
  const shops = new Map();

  rows.forEach((row) => {
    const current = shops.get(row.shop) || { shop: row.shop, sales: 0, units: 0 };
    current.sales += row.sales;
    current.units += row.units;
    shops.set(row.shop, current);
  });

  const ranked = [...shops.values()].sort((a, b) => b.sales - a.sales || b.units - a.units).slice(0, RANK_DISPLAY_LIMIT);
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
  if (!els.dayCompareStatus || !els.dayCompareBody) return;
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

function shopMoverRows(rows, shop) {
  const groupByShop = !shop || shop === "all";
  const grouped = new Map();
  rows.forEach((row) => {
    const key = groupByShop ? row.shop : row.genre;
    if (!key || key === "all") return;
    const current = grouped.get(key) || {
      label: groupByShop ? `Shop ${key}` : genreLabel(key),
      sales: 0,
      units: 0
    };
    current.sales += row.predictedSales || row.sales || 0;
    current.units += row.predictedUnits || row.units || 0;
    grouped.set(key, current);
  });
  return [...grouped.values()];
}

function topShopMoverRows(rows) {
  if (rows.some((row) => row.topShopSummary)) {
    return rows
      .filter((row) => row.topShopSummary && isRealShopId(row.shop))
      .map((row) => ({
        label: `Shop ${row.shop}`,
        sales: row.sales || 0,
        units: 0
      }));
  }
  const grouped = new Map();
  rows.forEach((row) => {
    if (!isRealShopId(row.shop)) return;
    const shop = String(row.shop);
    const current = grouped.get(shop) || {
      label: `Shop ${row.shop}`,
      sales: 0,
      units: 0
    };
    current.sales += row.sales || 0;
    grouped.set(shop, current);
  });
  return [...grouped.values()];
}

function moverKey(row) {
  return row.label || row.tooltipLabel || "";
}

function formatMoverPercent(current, previous) {
  if (!previous) return current ? "New" : "0.0%";
  const percent = ((current - previous) / previous) * 100;
  return `${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`;
}

function renderMoverGroup(title, rows, tone) {
  if (!rows.length) {
    return `
      <article class="mover-card">
        <h3>${title}</h3>
        <div class="empty">Not enough data.</div>
      </article>
    `;
  }
  return `
    <article class="mover-card">
      <h3>${title}</h3>
      ${rows.map((row) => `
        <div class="mover-row ${tone}">
          <span>${escapeHtml(row.label)}</span>
          <strong>${yen.format(row.change)}</strong>
          <small>${formatMoverPercent(row.sales, row.previousSales)} vs previous period</small>
        </div>
      `).join("")}
    </article>
  `;
}

function renderTopMovers(currentRows = [], previousRows = [], currentDates = [], previousDates = []) {
  if (!els.moversCount || !els.moversList) return;
  if (!currentDates.length) {
    els.moversCount.textContent = "Choose dates";
    els.moversList.innerHTML = `<div class="empty">Choose dates to see what rose or fell the most.</div>`;
    return;
  }
  if (!previousDates.length) {
    els.moversCount.textContent = "No previous period";
    els.moversList.innerHTML = `<div class="empty">There is no earlier matching period in the data.</div>`;
    return;
  }

  const currentByKey = new Map(currentRows.map((row) => [moverKey(row), row]).filter(([key]) => key));
  const previousByKey = new Map(previousRows.map((row) => [moverKey(row), row]).filter(([key]) => key));
  const moverKeys = new Set([...currentByKey.keys(), ...previousByKey.keys()]);
  const movers = [...moverKeys]
    .map((key) => {
      const row = currentByKey.get(key);
      const previous = previousByKey.get(key);
      return {
        label: key,
        sales: row?.sales || 0,
        previousSales: previous?.sales || 0,
        change: (row?.sales || 0) - (previous?.sales || 0)
      };
    })
    .filter((row) => row.label && (row.sales > 0 || row.previousSales > 0));

  const risers = [...movers].filter((row) => row.change > 0).sort((a, b) => b.change - a.change).slice(0, 5);
  const fallers = [...movers].filter((row) => row.change < 0).sort((a, b) => a.change - b.change).slice(0, 5);
  els.moversCount.textContent = `${periodLabel(currentDates)} vs ${periodLabel(previousDates)}`;
  els.moversList.innerHTML = movers.length
    ? `${renderMoverGroup("Top risers", risers, "positive")}${renderMoverGroup("Top fallers", fallers, "negative")}`
    : `<div class="empty">No comparable estimates found for the previous period.</div>`;
}

function eventIsActiveOnDate(eventName, date) {
  return state.events.some((event) =>
    event.name === eventName &&
    !HIDDEN_EVENTS.has(event.name) &&
    event.start_date <= date &&
    event.end_date >= date
  );
}

function hasVisibleEventOnDate(date) {
  return state.events.some((event) =>
    !HIDDEN_EVENTS.has(event.name) &&
    event.start_date <= date &&
    event.end_date >= date
  );
}

function salesValueForEventRow(row) {
  return row.predictedSales ?? row.sales ?? 0;
}

function dailySalesTotals(rows, dates) {
  const totals = new Map(dates.map((day) => [day, 0]));
  rows.forEach((row) => {
    if (!totals.has(row.date)) return;
    totals.set(row.date, totals.get(row.date) + salesValueForEventRow(row));
  });
  return totals;
}

function averageForDates(totals, dates) {
  if (!dates.length) return null;
  const total = dates.reduce((sum, day) => sum + (totals.get(day) || 0), 0);
  return total / dates.length;
}

function uniqueDatesFromRows(rows) {
  return [...new Set(rows.map((row) => row.date).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function formatEventComparison(eventAverage, comparisonAverage, label) {
  if (!Number.isFinite(eventAverage) || !Number.isFinite(comparisonAverage) || comparisonAverage <= 0) {
    return `${label}: no comparison`;
  }
  const change = formatPercentChange(eventAverage, comparisonAverage);
  if (change === "0.0%") return `Same as ${label}`;
  return `${change} vs ${label}`;
}

function eventTooltip(name, dates, salesRows) {
  const impact = eventImpact(name, dates, salesRows);
  const lines = [
    name,
    `Event days: ${whole.format(impact.eventDates)}`,
    `Average sales: ${impact.eventAverage === null ? "No sales estimate" : yen.format(impact.eventAverage)}`,
    `Normal day avg: ${impact.normalAverage === null ? "No comparison" : yen.format(impact.normalAverage)}`,
    `Sales lift: ${impact.lift}`
  ];
  if (impact.otherEventAverage !== null) {
    lines.push(`Other ${name} day avg: ${yen.format(impact.otherEventAverage)}`);
    lines.push(`Vs other ${name} days: ${impact.otherEventLift}`);
  }
  return lines.join("\n");
}

function eventImpact(name, dates, salesRows) {
  const contextDates = uniqueDatesFromRows(salesRows);
  const comparisonDates = contextDates.length ? contextDates : dates;
  const totals = dailySalesTotals(salesRows, [...new Set([...dates, ...comparisonDates])]);
  const eventDates = dates.filter((day) => eventIsActiveOnDate(name, day));
  const selectedSet = new Set(dates);
  const normalDates = comparisonDates.filter((day) => !hasVisibleEventOnDate(day));
  const otherEventDates = comparisonDates.filter((day) => eventIsActiveOnDate(name, day) && !selectedSet.has(day));
  const eventAverage = averageForDates(totals, eventDates);
  const normalAverage = averageForDates(totals, normalDates);
  const otherEventAverage = averageForDates(totals, otherEventDates);
  return {
    name,
    eventDates: eventDates.length,
    eventAverage,
    normalAverage,
    otherEventAverage,
    lift: formatEventComparison(eventAverage, normalAverage, "normal day"),
    otherEventLift: formatEventComparison(eventAverage, otherEventAverage, `other ${name} days`)
  };
}

function showEventTooltip(chip, tooltip, event) {
  const lines = chip.dataset.tooltip.split("\n");
  tooltip.innerHTML = `
    <strong>${escapeHtml(lines[0] || "")}</strong>
    ${lines.slice(1).map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
  `;
  tooltip.hidden = false;
  positionTrendTooltip(tooltip, event);
}

function attachEventTooltipHandlers() {
  const tooltip = els.eventList.querySelector(".trend-tooltip");
  if (!tooltip) return;
  els.eventList.querySelectorAll(".event-chip[data-tooltip], .event-impact-card[data-tooltip]").forEach((chip) => {
    chip.addEventListener("mouseenter", (event) => showEventTooltip(chip, tooltip, event));
    chip.addEventListener("mousemove", (event) => positionTrendTooltip(tooltip, event));
    chip.addEventListener("mouseleave", () => {
      tooltip.hidden = true;
    });
    chip.addEventListener("focus", (event) => showEventTooltip(chip, tooltip, event));
    chip.addEventListener("blur", () => {
      tooltip.hidden = true;
    });
  });
}

function renderEvents(date, salesRows = []) {
  const dates = Array.isArray(date) ? date : (date ? [date] : []);
  els.eventsTitle.textContent = "Promotion Impact";
  if (!dates.length) {
    els.eventCount.textContent = isRangeMode() ? "Choose a period" : "Choose a day";
    els.eventList.innerHTML = `<div class="empty">${isRangeMode() ? "Choose a start and end day" : "Choose a specific day"} to see calendar events.</div>`;
    return;
  }

  const first = dates[0];
  const last = dates[dates.length - 1];
  const matches = state.events.filter((event) =>
    !HIDDEN_EVENTS.has(event.name) &&
    event.start_date <= last &&
    event.end_date >= first
  );
  const uniqueEvents = [...new Set(matches.map((event) => event.name))].sort((a, b) => a.localeCompare(b));
  els.eventCount.textContent = `${uniqueEvents.length} events`;
  const impacts = uniqueEvents.map((name) => eventImpact(name, dates, salesRows));
  els.eventList.innerHTML = impacts.length
    ? `${impacts.map((impact) => `
      <article class="event-impact-card" tabindex="0" data-tooltip="${escapeHtml(eventTooltip(impact.name, dates, salesRows))}">
        <strong>${escapeHtml(impact.name)}</strong>
        <span>Avg sales ${impact.eventAverage === null ? "-" : yen.format(impact.eventAverage)}</span>
        <small>${escapeHtml(impact.lift)}</small>
      </article>
    `).join("")}<div class="trend-tooltip" hidden></div>`
    : `<div class="empty">No listed events for ${periodLabel(dates)}.</div>`;
  attachEventTooltipHandlers();
}

async function init() {
  try {
    ensureRankProjectionOptions(80);
    const [optionsText, genreNamesText, shopOptionsText, shopGenreMixText, eventsText, rankCurvesText, rankEventFactorsText] = await Promise.all([
      fetch(OPTIONS_URL).then((response) => response.text()),
      fetch(GENRE_NAMES_URL).then((response) => response.text()),
      fetch(SHOP_OPTIONS_URL).then((response) => response.text()),
      fetch(SHOP_GENRE_MIX_URL).then((response) => response.text()),
      fetch(EVENTS_URL).then((response) => response.text()),
      fetch(RANK_CURVES_URL).then((response) => response.text()),
      fetch(RANK_EVENT_FACTORS_URL).then((response) => response.text())
    ]);

    const options = parseCsv(optionsText);
    const genreOptions = options
      .filter((row) => row.type === "genre")
      .sort((a, b) => optionSales(b) - optionSales(a) || a.label.localeCompare(b.label))
      .map((row) => {
        const label = cleanOptionLabel(row.label);
        return { ...row, label, fullLabel: label, displayLabel: genreOptionLabel({ ...row, label }) };
      });
    state.genreLabels = new Map(parseCsv(genreNamesText)
      .filter((row) => row.genre_id && row.genre_name)
      .map((row) => [String(row.genre_id).trim(), cleanOptionLabel(row.genre_name)]));
    genreOptions.forEach((row) => state.genreLabels.set(String(row.id).trim(), row.label));
    addOptions(els.genreSelect, genreOptions);
    const shopOptions = parseCsv(shopOptionsText)
      .sort((a, b) => optionSales(b) - optionSales(a) || Number(a.id) - Number(b.id))
      .map((row) => ({ ...row, displayLabel: shopOptionLabel(row) }));
    state.allShopIds = shopOptions.map((row) => row.id).filter(Boolean);
    if (els.shopSelect) {
      addOptions(els.shopSelect, shopOptions);
    }
    copySelectOptions(els.genreSelect, els.verificationGenreSelect);
    copySelectOptions(els.shopSelect, els.verificationShopSelect);
    const dateRows = options.filter((row) => row.type === "date");
    buildDateControls(dateRows);

    state.shopGenreMix = parseCsv(shopGenreMixText).map(shopGenreMixFromCsv).reduce((map, row) => {
      if (!row.shop || !row.genre) return map;
      if (!map.has(row.shop)) map.set(row.shop, []);
      map.get(row.shop).push(row);
      return map;
    }, new Map());
    state.genreShopMix = new Map();
    state.shopGenreMix.forEach((rows) => {
      rows.forEach((row) => {
        if (!state.genreShopMix.has(row.genre)) state.genreShopMix.set(row.genre, []);
        state.genreShopMix.get(row.genre).push(row);
      });
    });
    state.genreShopMix.forEach((rows) => {
      rows.sort((a, b) => b.sales - a.sales || b.units - a.units || String(a.shop).localeCompare(String(b.shop)));
    });
    state.events = parseCsv(eventsText);
    state.rankCurves = parseCsv(rankCurvesText).map(rankCurveFromCsv).reduce((map, row) => {
      if (!map.has(row.genre)) map.set(row.genre, new Map());
      map.get(row.genre).set(row.rank, row.estimatedSales);
      return map;
    }, new Map());
    state.rankEventFactors = new Map();
    state.globalRankEventFactors = new Map();
    parseCsv(rankEventFactorsText).map(rankEventFactorFromCsv).forEach((row) => {
      if (!row.event) return;
      if (row.genre === "__global__") {
        state.globalRankEventFactors.set(row.event, row.factor);
        return;
      }
      if (!state.rankEventFactors.has(row.genre)) state.rankEventFactors.set(row.genre, new Map());
      state.rankEventFactors.get(row.genre).set(row.event, row.factor);
    });
    const defaultPreset = [...els.datePresetButtons].find((button) => button.dataset.preset === "today");
    if (defaultPreset) defaultPreset.classList.add("active");
    applyDatePreset("today", false);
    setCompareDateParts(nearestComparisonDate(selectedDate()));
    syncRangeControls();
    syncDateRangeLabel();
    els.loadStatus.textContent = "Ready";
    setEnabled(true);
    syncViewMode();
    syncSelectedGenrePath();
    renderModelVerification();
    loadValidationMetrics();
    await update();
    scheduleBackgroundPreload();
  } catch (error) {
    els.loadStatus.textContent = "Could not load data files";
    if (els.topItemsBody) {
      els.topItemsBody.innerHTML = `<tr><td colspan="6">Open this site through a local web server so the CSV files can load.</td></tr>`;
    }
    console.error(error);
  }
}

[els.genreSelect, els.shopSelect].filter(Boolean).forEach((el) => {
  el.addEventListener("input", () => {
    syncSelectedGenrePath();
    requestUpdate();
  });
});

[els.genreViewButton, els.shopViewButton].filter(Boolean).forEach((button) => {
  button.addEventListener("click", () => setViewMode(button.dataset.viewMode));
});

[els.dashboardPageButton, els.verificationPageButton].filter(Boolean).forEach((button) => {
  button.addEventListener("click", () => {
    setPageMode(button === els.verificationPageButton ? "verification" : "dashboard");
  });
});

[els.verificationTypeSelect, els.verificationGenreSelect, els.verificationShopSelect].filter(Boolean).forEach((el) => {
  el.addEventListener("input", renderModelVerification);
});

els.rankProjectionSelect?.addEventListener("input", () => requestUpdate());

els.dateModeSelect.addEventListener("input", () => {
  if (isRangeMode()) {
    const currentDate = selectedDate();
    const currentEndDate = selectedEndDate();
    if (!currentEndDate || currentEndDate === currentDate) {
      const dates = datesEndingOn(currentDate, 7);
      if (dates.length > 1) {
        setDateParts(dates[0]);
        setEndDateParts(dates[dates.length - 1]);
      } else if (currentDate) {
        setEndDateParts(currentDate);
      }
    }
  }
  syncRangeControls();
  syncDateRangeLabel();
  requestUpdate();
});

els.yearSelect.addEventListener("input", () => {
  refreshMonthOptions(false);
  refreshDayOptions(false);
  syncCalendarInputs();
  clearActivePreset();
  syncDateRangeLabel();
  keepComparisonDateDifferent();
  requestUpdate();
});

els.monthSelect.addEventListener("input", () => {
  refreshDayOptions(false);
  syncCalendarInputs();
  clearActivePreset();
  syncDateRangeLabel();
  keepComparisonDateDifferent();
  requestUpdate();
});

els.daySelect.addEventListener("input", () => {
  syncCalendarInputs();
  clearActivePreset();
  syncDateRangeLabel();
  keepComparisonDateDifferent();
  requestUpdate();
});

els.endYearSelect.addEventListener("input", () => {
  refreshEndMonthOptions(false);
  refreshEndDayOptions(false);
  syncCalendarInputs();
  clearActivePreset();
  syncDateRangeLabel();
  requestUpdate();
});

els.endMonthSelect.addEventListener("input", () => {
  refreshEndDayOptions(false);
  syncCalendarInputs();
  clearActivePreset();
  syncDateRangeLabel();
  requestUpdate();
});

els.endDaySelect.addEventListener("input", () => {
  syncCalendarInputs();
  clearActivePreset();
  syncDateRangeLabel();
  requestUpdate();
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
  if (!isRangeMode()) return;
  setEndDateParts(date);
  clearActivePreset();
  syncDateRangeLabel();
});

els.dateRangeButton.addEventListener("click", (event) => {
  event.stopPropagation();
  setDatePopoverOpen(els.datePopover.hidden);
});

els.prevDateButton?.addEventListener("click", () => {
  if (isRangeMode()) return;
  shiftSelectedPeriod(-1);
});

els.nextDateButton?.addEventListener("click", () => {
  if (isRangeMode()) return;
  shiftSelectedPeriod(1);
});

els.datePopover.addEventListener("click", (event) => {
  event.stopPropagation();
});

els.clearDateButton.addEventListener("click", () => {
  clearActivePreset();
  setDateParts("");
  setEndDateParts("");
  syncDateRangeLabel();
  requestUpdate();
});

els.applyDateButton.addEventListener("click", () => {
  const start = nearestAvailableDate(els.startDateInput.value);
  const end = isRangeMode()
    ? nearestAvailableDate(els.endDateInput.value || els.startDateInput.value)
    : start;
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

if (els.compareYearSelect) {
  els.compareYearSelect.addEventListener("input", () => {
    refreshCompareMonthOptions(false);
    refreshCompareDayOptions(false);
    requestUpdate();
  });
}

if (els.compareMonthSelect) {
  els.compareMonthSelect.addEventListener("input", () => {
    refreshCompareDayOptions(false);
    requestUpdate();
  });
}

if (els.compareDaySelect) {
  els.compareDaySelect.addEventListener("input", () => requestUpdate());
}

els.resetButton.addEventListener("click", () => {
  resetFilters();
  requestUpdate();
});

els.datePresetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    clearActivePreset();
    button.classList.add("active");
    applyDatePreset(button.dataset.preset);
  });
});

els.granularitySelect.addEventListener("input", () => requestUpdate());

document.addEventListener("click", (event) => {
  if (els.datePopover.hidden) return;
  if (els.datePopover.contains(event.target) || els.dateRangeButton.contains(event.target)) return;
  setDatePopoverOpen(false);
});

init();
