const API_URL = "https://api.esios.ree.es/archives/70/download_json";
const MADRID_TIMEZONE = "Europe/Madrid";
const state = {
  prices: [],
  selectedDate: "",
  zone: "PCB",
};

const elements = {
  dateInput: document.querySelector("#date-input"),
  todayButton: document.querySelector("#today-button"),
  tomorrowButton: document.querySelector("#tomorrow-button"),
  refreshButton: document.querySelector("#refresh-button"),
  zoneInput: document.querySelector("#zone-input"),
  status: document.querySelector("#status"),
  minPrice: document.querySelector("#min-price"),
  minHour: document.querySelector("#min-hour"),
  avgPrice: document.querySelector("#avg-price"),
  maxPrice: document.querySelector("#max-price"),
  maxHour: document.querySelector("#max-hour"),
  bestWindow: document.querySelector("#best-window"),
  bestWindowPrice: document.querySelector("#best-window-price"),
  selectedDateLabel: document.querySelector("#selected-date-label"),
  durationInput: document.querySelector("#duration-input"),
  energyInput: document.querySelector("#energy-input"),
  recommendationCopy: document.querySelector("#recommendation-copy"),
  costEstimate: document.querySelector("#cost-estimate"),
  topWindows: document.querySelector("#top-windows"),
  lineChart: document.querySelector("#line-chart"),
  barChart: document.querySelector("#bar-chart"),
  heatmap: document.querySelector("#heatmap"),
  priceTable: document.querySelector("#price-table"),
  usecases: [...document.querySelectorAll(".usecase")],
};

function madridDate(offset = 0) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: MADRID_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = new Date(`${formatter.format(new Date())}T12:00:00`);
  today.setDate(today.getDate() + offset);
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatSelectedDate(date) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "full",
    timeZone: MADRID_TIMEZONE,
  }).format(new Date(`${date}T12:00:00`));
}

function parsePrice(value) {
  return Number(String(value).replaceAll(".", "").replace(",", ".")) / 1000;
}

function formatPrice(value) {
  return `${value.toLocaleString("es-ES", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })} EUR/kWh`;
}

function formatMoney(value) {
  return `${value.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function hourStart(label) {
  return Number(label.split("-")[0]);
}

function bandFor(index, length) {
  if (index < Math.ceil(length / 3)) {
    return "cheap";
  }
  if (index >= Math.floor((length * 2) / 3)) {
    return "expensive";
  }
  return "mid";
}

function classifyPrices(prices) {
  const ranks = [...prices].sort((left, right) => left.value - right.value);
  const bandByHour = new Map(
    ranks.map((price, index) => [price.hour, bandFor(index, ranks.length)]),
  );
  return prices.map((price) => ({ ...price, band: bandByHour.get(price.hour) }));
}

function setStatus(message, tone = "ok") {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", tone === "error");
}

function emptyVisual(target, message) {
  target.innerHTML = `<div class="empty">${message}</div>`;
}

async function fetchPrices(date, zone) {
  const url = new URL(API_URL);
  url.searchParams.set("locale", "es");
  url.searchParams.set("date", date);

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`eSIOS respondio con HTTP ${response.status}.`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.PVPC) || payload.PVPC.length === 0) {
    throw new Error("Todavia no hay precios PVPC para ese dia.");
  }

  const prices = payload.PVPC.map((item) => ({
    date: item.Dia,
    hour: item.Hora,
    start: hourStart(item.Hora),
    value: parsePrice(item[zone] || item.PCB),
  }))
    .filter((item) => Number.isFinite(item.value))
    .sort((left, right) => left.start - right.start);

  if (!prices.length) {
    throw new Error("La respuesta no incluye precios validos.");
  }

  return classifyPrices(prices);
}

function average(prices) {
  return prices.reduce((total, item) => total + item.value, 0) / prices.length;
}

function windowsForDuration(prices, duration) {
  if (!prices.length || duration > prices.length) {
    return [];
  }

  return prices.slice(0, prices.length - duration + 1).map((_, index) => {
    const items = prices.slice(index, index + duration);
    const total = items.reduce((sum, item) => sum + item.value, 0);
    return {
      start: items[0].hour.split("-")[0],
      end: items.at(-1).hour.split("-")[1],
      average: total / items.length,
      items,
    };
  }).sort((left, right) => left.average - right.average);
}

function renderSummary(prices) {
  const cheapest = [...prices].sort((left, right) => left.value - right.value)[0];
  const priciest = [...prices].sort((left, right) => right.value - left.value)[0];

  elements.minPrice.textContent = formatPrice(cheapest.value);
  elements.minHour.textContent = cheapest.hour;
  elements.avgPrice.textContent = formatPrice(average(prices));
  elements.maxPrice.textContent = formatPrice(priciest.value);
  elements.maxHour.textContent = priciest.hour;
  elements.selectedDateLabel.textContent = formatSelectedDate(state.selectedDate);
}

function renderPlanner(prices) {
  const duration = Math.min(Math.max(Number(elements.durationInput.value) || 1, 1), 8);
  const energy = Math.max(Number(elements.energyInput.value) || 0, 0);
  elements.durationInput.value = duration;
  elements.energyInput.value = energy;

  const windows = windowsForDuration(prices, duration);
  const best = windows[0];
  if (!best) {
    elements.bestWindow.textContent = "--";
    elements.bestWindowPrice.textContent = "sin datos";
    elements.recommendationCopy.textContent = "No hay datos suficientes para esa duracion.";
    elements.costEstimate.textContent = "--";
    elements.topWindows.innerHTML = "";
    return;
  }

  elements.bestWindow.textContent = `${best.start}:00-${best.end}:00`;
  elements.bestWindowPrice.textContent = `media ${formatPrice(best.average)}`;
  elements.recommendationCopy.textContent =
    `Mejor franja continua de ${duration} h: ${best.start}:00-${best.end}:00.`;
  elements.costEstimate.textContent = energy ? formatMoney(best.average * energy) : "--";
  elements.topWindows.innerHTML = windows.slice(0, 4).map((window, index) => `
    <li>
      <b>#${index + 1}</b>
      <strong>${window.start}:00-${window.end}:00</strong>
      <span>${formatPrice(window.average)}</span>
    </li>
  `).join("");
}

function renderLineChart(prices) {
  const width = 920;
  const height = 360;
  const padding = { top: 28, right: 28, bottom: 46, left: 66 };
  const min = Math.min(...prices.map((item) => item.value));
  const max = Math.max(...prices.map((item) => item.value));
  const spread = Math.max(max - min, 0.01);
  const floor = Math.max(min - spread * 0.16, 0);
  const ceiling = max + spread * 0.18;

  const xFor = (index) =>
    padding.left + (index / (prices.length - 1)) * (width - padding.left - padding.right);
  const yFor = (value) =>
    padding.top + ((ceiling - value) / (ceiling - floor)) * (height - padding.top - padding.bottom);
  const points = prices.map((item, index) => `${xFor(index)},${yFor(item.value)}`);
  const axisValues = Array.from({ length: 4 }, (_, index) =>
    floor + ((ceiling - floor) / 3) * index,
  ).reverse();

  elements.lineChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Curva diaria PVPC">
      <defs>
        <linearGradient id="price-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(15, 118, 110, 0.32)" />
          <stop offset="100%" stop-color="rgba(15, 118, 110, 0.02)" />
        </linearGradient>
      </defs>
      ${axisValues.map((value) => `
        <g>
          <line class="chart-grid-line" x1="${padding.left}" x2="${width - padding.right}" y1="${yFor(value)}" y2="${yFor(value)}" />
          <text class="chart-axis-label" x="8" y="${yFor(value) + 4}">${value.toFixed(3)}</text>
        </g>
      `).join("")}
      <path class="price-area" d="M ${points[0]} L ${points.join(" L ")} L ${xFor(prices.length - 1)},${height - padding.bottom} L ${xFor(0)},${height - padding.bottom} Z" />
      <path class="price-path" d="M ${points.join(" L ")}" />
      ${prices.map((item, index) => `
        <g>
          <circle class="price-dot ${item.band === "cheap" ? "best-dot" : ""}" cx="${xFor(index)}" cy="${yFor(item.value)}" r="5" />
          ${index % 3 === 0 ? `
            <text class="chart-axis-label" text-anchor="middle" x="${xFor(index)}" y="${height - 18}">${item.hour.split("-")[0]}h</text>
          ` : ""}
        </g>
      `).join("")}
    </svg>
  `;
}

function renderBarChart(prices) {
  const max = Math.max(...prices.map((item) => item.value));
  elements.barChart.innerHTML = prices.map((item) => `
    <div class="bar" title="${item.hour}: ${formatPrice(item.value)}">
      <div class="bar-fill ${item.band}" style="height: ${Math.max((item.value / max) * 100, 8)}%">
        <strong>${item.value.toFixed(3)}</strong>
      </div>
      <small>${item.hour.split("-")[0]}</small>
    </div>
  `).join("");
}

function renderHeatmap(prices) {
  elements.heatmap.innerHTML = prices.map((item) => `
    <div class="heat-cell ${item.band}" title="${item.hour}: ${formatPrice(item.value)}">
      <small>${item.hour}</small>
      <strong>${item.value.toFixed(4)}</strong>
    </div>
  `).join("");
}

function labelForBand(band) {
  if (band === "cheap") {
    return "Buena";
  }
  if (band === "expensive") {
    return "Cara";
  }
  return "Media";
}

function renderTable(prices) {
  elements.priceTable.innerHTML = prices.map((item) => `
    <tr>
      <td>${item.hour}</td>
      <td>${formatPrice(item.value)}</td>
      <td><span class="level-pill ${item.band}">${labelForBand(item.band)}</span></td>
    </tr>
  `).join("");
}

function renderAll(prices) {
  renderSummary(prices);
  renderPlanner(prices);
  renderLineChart(prices);
  renderBarChart(prices);
  renderHeatmap(prices);
  renderTable(prices);
}

function renderEmpty(message) {
  elements.minPrice.textContent = "--";
  elements.minHour.textContent = "--";
  elements.avgPrice.textContent = "--";
  elements.maxPrice.textContent = "--";
  elements.maxHour.textContent = "--";
  elements.bestWindow.textContent = "--";
  elements.bestWindowPrice.textContent = "sin datos";
  elements.recommendationCopy.textContent = message;
  elements.costEstimate.textContent = "--";
  elements.selectedDateLabel.textContent = state.selectedDate
    ? formatSelectedDate(state.selectedDate)
    : "--";
  emptyVisual(elements.lineChart, message);
  emptyVisual(elements.barChart, message);
  emptyVisual(elements.heatmap, message);
  elements.priceTable.innerHTML = `<tr><td colspan="3">${message}</td></tr>`;
  elements.topWindows.innerHTML = "";
}

async function loadSelectedDay() {
  state.selectedDate = elements.dateInput.value;
  state.zone = elements.zoneInput.value;
  setStatus("Consultando el archivo diario de eSIOS...");

  try {
    state.prices = await fetchPrices(state.selectedDate, state.zone);
    renderAll(state.prices);
    setStatus(`Precios cargados para ${formatSelectedDate(state.selectedDate)}.`);
  } catch (error) {
    state.prices = [];
    renderEmpty(error.message);
    setStatus(
      `${error.message} Para manana suelen aparecer cuando eSIOS publica el archivo diario.`,
      "error",
    );
  }
}

function setDate(date) {
  elements.dateInput.value = date;
  loadSelectedDay();
}

elements.refreshButton.addEventListener("click", loadSelectedDay);
elements.dateInput.addEventListener("change", loadSelectedDay);
elements.zoneInput.addEventListener("change", loadSelectedDay);
elements.todayButton.addEventListener("click", () => setDate(madridDate()));
elements.tomorrowButton.addEventListener("click", () => setDate(madridDate(1)));
elements.durationInput.addEventListener("input", () => renderPlanner(state.prices));
elements.energyInput.addEventListener("input", () => renderPlanner(state.prices));
elements.usecases.forEach((button) => {
  button.addEventListener("click", () => {
    elements.usecases.forEach((item) => item.classList.toggle("active", item === button));
    elements.durationInput.value = button.dataset.hours;
    elements.energyInput.value = button.dataset.kwh;
    renderPlanner(state.prices);
  });
});

setDate(madridDate());
