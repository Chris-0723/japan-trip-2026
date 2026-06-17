const tripPayload = window.TRIP_DATA;

if (
  !tripPayload ||
  !Array.isArray(tripPayload.days) ||
  !Array.isArray(tripPayload.restaurants) ||
  !Array.isArray(tripPayload.places)
) {
  throw new Error("找不到有效的行程資料，請先執行 scripts/build_web_data.py 產生 web/data.js。");
}

const tripData = {
  project: tripPayload.project,
  days: tripPayload.days,
};

const restaurants = tripPayload.restaurants;
const places = tripPayload.places;

const restaurantMap = new Map(restaurants.map((item) => [item.id, item]));
const placeMap = new Map(places.map((item) => [item.id, item]));

const modeNav = document.getElementById("mode-nav");
const dayNav = document.getElementById("day-nav");
const app = document.getElementById("app");

const state = {
  mode: "itinerary",
  view: "overview",
  mapQuery: "",
  mapCategory: "all",
};

const CATEGORY_META = {
  all: "全部",
  sight: "景點",
  restaurant: "餐廳",
  stay: "住宿",
  transport: "交通",
};

function formatDate(date) {
  return String(date).replaceAll("-", "/");
}

function formatTime(startTime, endTime) {
  if (startTime && endTime) return `${startTime}–${endTime}`;
  if (startTime && !endTime) return `${startTime} 起`;
  if (!startTime && endTime) return `至 ${endTime}`;
  return "未設定";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function mapCategoryToFilter(category) {
  if (category === "餐廳") return "restaurant";
  if (category === "住宿") return "stay";
  if (category === "交通") return "transport";
  if (category === "區域") return "sight";
  return "sight";
}

function mapCategoryToLabel(category) {
  if (category === "餐廳") return "餐廳";
  if (category === "住宿") return "住宿";
  if (category === "交通") return "交通節點";
  if (category === "區域") return "景點";
  return "景點";
}

function createMapActions(ids = []) {
  const seen = new Set();
  const actions = [];

  ids.forEach((id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);

    const place = placeMap.get(id);
    if (place?.google_maps_url) {
      actions.push(`
        <a class="map-button secondary" href="${escapeHtml(place.google_maps_url)}" target="_blank" rel="noreferrer">
          開啟地圖・${escapeHtml(place.name)}
        </a>
      `);
      return;
    }

    const restaurant = restaurantMap.get(id);
    if (restaurant?.google_maps_url) {
      actions.push(`
        <a class="map-button secondary" href="${escapeHtml(restaurant.google_maps_url)}" target="_blank" rel="noreferrer">
          開啟地圖・${escapeHtml(restaurant.name)}
        </a>
      `);
    }
  });

  return actions.join("");
}

function renderMealRestaurants(ids = []) {
  if (!ids.length) {
    return `<p class="restaurant-note">未提供特定餐廳，依當天動線彈性安排。</p>`;
  }

  return ids
    .map((id) => {
      const restaurant = restaurantMap.get(id);
      if (!restaurant) return "";
      return `
        <div class="meal-group">
          <span class="restaurant-name">${escapeHtml(restaurant.name)}</span>
          ${restaurant.notes ? `<p class="restaurant-note">${escapeHtml(restaurant.notes)}</p>` : ""}
          ${restaurant.google_maps_url ? `<div class="action-row"><a class="map-button" href="${escapeHtml(restaurant.google_maps_url)}" target="_blank" rel="noreferrer">Google Maps</a></div>` : ""}
        </div>
      `;
    })
    .join("");
}

function renderOverview() {
  return `
    <section class="card overview-card">
      <div class="overview-head">
        <div>
          <h2>${escapeHtml(tripData.project.startDate)}–${escapeHtml(tripData.project.endDate)} 行程總覽</h2>
          <p>主軸地區為${escapeHtml(tripData.project.routeFocus.join("、"))}，依旅行動線整理成手機優先的每日頁面。</p>
        </div>
        <div class="hero-badge">離線穩定版</div>
      </div>

      <div class="route-tags">
        ${tripData.project.routeFocus.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
      </div>

      <div class="overview-grid">
        ${tripData.days
          .map(
            (day, index) => `
              <article class="overview-day">
                <div class="overview-day-top">
                  <div>
                    <p class="mini-date">${formatDate(day.date)}・星期${escapeHtml(day.weekday)}</p>
                    <h3>${escapeHtml(day.title)}</h3>
                  </div>
                  <button class="inline-button secondary" data-day-index="${index}">查看</button>
                </div>
                <div class="overview-meta">
                  <span>地區：${escapeHtml(day.area)}</span>
                  <span>住宿：${escapeHtml(day.accommodation ?? "無")}</span>
                  <span>主軸：${escapeHtml(day.theme)}</span>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderDay(day) {
  const timelineHtml = day.timeline
    .map((item) => {
      const mapActions = createMapActions([
        ...(item.related_place_ids || []),
        ...(item.related_restaurant_ids || []),
      ]);

      return `
        <article class="timeline-item">
          <div class="timeline-top">
            <div class="timeline-time">${escapeHtml(formatTime(item.start_time, item.end_time))}</div>
            <div class="timeline-content">
              <h4>${escapeHtml(item.title)}</h4>
              <p class="timeline-meta">地點：${escapeHtml(item.location)}</p>
              <p class="timeline-meta">交通：${escapeHtml(item.transport ?? "依現場安排")}</p>
              <p class="timeline-description">${escapeHtml(item.description)}</p>
            </div>
          </div>
          ${mapActions ? `<div class="action-row">${mapActions}</div>` : ""}
        </article>
      `;
    })
    .join("");

  const transportationHtml = day.transportation.length
    ? day.transportation
        .map(
          (item) => `
            <article class="mini-card">
              <strong>${escapeHtml(item.segment)}</strong>
              <p>${escapeHtml(item.mode)}${item.notes ? `｜${escapeHtml(item.notes)}` : ""}</p>
            </article>
          `
        )
        .join("")
    : `<div class="empty-state">本日交通以現場動線調整為主。</div>`;

  const mealsHtml = day.meals.length
    ? day.meals
        .map(
          (meal) => `
            <article class="meal-card">
              <h4>${escapeHtml(meal.meal_type)}</h4>
              <span class="meal-label">第一順位</span>
              ${renderMealRestaurants(meal.primary_restaurant_ids)}
              <span class="meal-label">備案</span>
              ${renderMealRestaurants(meal.backup_restaurant_ids)}
              ${meal.notes ? `<p class="restaurant-note">${escapeHtml(meal.notes)}</p>` : ""}
            </article>
          `
        )
        .join("")
    : `<div class="empty-state">本日沒有餐廳資料。</div>`;

  const backupHtml = day.backup_plan.length
    ? day.backup_plan.map((item) => `<article class="mini-card"><strong>備案</strong><p>${escapeHtml(item)}</p></article>`).join("")
    : `<div class="empty-state">本日無額外備案，以現場狀況彈性調整。</div>`;

  const notesHtml = day.notes.length
    ? day.notes.map((item) => `<article class="mini-card"><strong>注意事項</strong><p>${escapeHtml(item)}</p></article>`).join("")
    : `<div class="empty-state">本日無額外注意事項。</div>`;

  return `
    <section class="card day-view">
      <div class="day-view-head">
        <div>
          <h2>${escapeHtml(day.title)}</h2>
          <p>${escapeHtml(formatDate(day.date))}・星期${escapeHtml(day.weekday)}</p>
        </div>
        <div class="day-badge">${escapeHtml(day.weekday)}</div>
      </div>

      <div class="summary-grid">
        <div class="summary-box">
          <span class="summary-label">地區</span>
          <span class="summary-value">${escapeHtml(day.area)}</span>
        </div>
        <div class="summary-box">
          <span class="summary-label">住宿</span>
          <span class="summary-value">${escapeHtml(day.accommodation ?? "無")}</span>
        </div>
        <div class="summary-box full">
          <span class="summary-label">主軸</span>
          <span class="summary-value">${escapeHtml(day.theme)}</span>
        </div>
      </div>
    </section>

    <section class="card section-card">
      <h3 class="section-title">時間軸</h3>
      <div class="timeline-list">${timelineHtml}</div>
    </section>

    <section class="card section-card">
      <h3 class="section-title">交通</h3>
      <div class="transport-list">${transportationHtml}</div>
    </section>

    <section class="card section-card">
      <h3 class="section-title">餐廳</h3>
      <div class="meal-list">${mealsHtml}</div>
    </section>

    <section class="card section-card">
      <h3 class="section-title">備案</h3>
      <div class="backup-list">${backupHtml}</div>
    </section>

    <section class="card section-card">
      <h3 class="section-title">注意事項</h3>
      <div class="note-list">${notesHtml}</div>
    </section>
  `;
}

function buildNavigationIndex() {
  return tripData.days.map((day) => {
    const itemMap = new Map();

    const addPlaceItem = (placeId) => {
      const place = placeMap.get(placeId);
      if (!place || itemMap.has(placeId)) return;
      itemMap.set(placeId, {
        id: place.id,
        name: place.name,
        filterKey: mapCategoryToFilter(place.category),
        typeLabel: mapCategoryToLabel(place.category),
        area: place.area,
        date: day.date,
        weekday: day.weekday,
        googleMapsUrl: place.google_maps_url,
        mealType: null,
        priorityLabel: null,
      });
    };

    const addRestaurantItem = (restaurantId, mealType, priorityLabel) => {
      const restaurant = restaurantMap.get(restaurantId);
      if (!restaurant) return;
      const existing = itemMap.get(restaurantId);
      if (existing) {
        if (!existing.mealType && mealType) existing.mealType = mealType;
        if (!existing.priorityLabel && priorityLabel) existing.priorityLabel = priorityLabel;
        return;
      }
      itemMap.set(restaurantId, {
        id: restaurant.id,
        name: restaurant.name,
        filterKey: "restaurant",
        typeLabel: "餐廳",
        area: restaurant.area,
        date: day.date,
        weekday: day.weekday,
        googleMapsUrl: restaurant.google_maps_url,
        mealType: mealType ?? restaurant.meal_type,
        priorityLabel: priorityLabel ?? (restaurant.priority === 1 ? "第一順位" : "備案"),
      });
    };

    day.timeline.forEach((item) => {
      (item.related_place_ids || []).forEach(addPlaceItem);
      (item.related_restaurant_ids || []).forEach((restaurantId) => addRestaurantItem(restaurantId, null, null));
    });

    day.meals.forEach((meal) => {
      (meal.primary_restaurant_ids || []).forEach((restaurantId) =>
        addRestaurantItem(restaurantId, meal.meal_type, "第一順位")
      );
      (meal.backup_restaurant_ids || []).forEach((restaurantId) =>
        addRestaurantItem(restaurantId, meal.meal_type, "備案")
      );
    });

    return {
      date: day.date,
      weekday: day.weekday,
      title: day.title,
      items: Array.from(itemMap.values()),
    };
  });
}

const navigationGroups = buildNavigationIndex();

function filterNavigationItems(items) {
  return items.filter((item) => {
    const matchesCategory = state.mapCategory === "all" || item.filterKey === state.mapCategory;
    const keyword = state.mapQuery.trim().toLowerCase();
    const haystack = `${item.name} ${item.area}`.toLowerCase();
    const matchesQuery = !keyword || haystack.includes(keyword);
    return matchesCategory && matchesQuery;
  });
}

function renderMapIndex() {
  const groups = navigationGroups
    .map((group) => ({
      ...group,
      items: filterNavigationItems(group.items),
    }))
    .filter((group) => group.items.length > 0);

  return `
    <section class="card section-card">
      <h3 class="section-title">地圖／導航索引</h3>
      <div class="map-tools">
        <input
          id="map-search"
          class="search-input"
          type="search"
          placeholder="搜尋名稱或區域，例如：修善寺、箱根、東京站"
          value="${escapeHtml(state.mapQuery)}"
        />
        <div class="filter-row">
          ${Object.entries(CATEGORY_META)
            .map(
              ([key, label]) => `
                <button class="filter-chip ${state.mapCategory === key ? "is-active" : ""}" data-filter="${key}">
                  ${escapeHtml(label)}
                </button>
              `
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="card section-card">
      <h3 class="section-title">依日期查看</h3>
      ${
        groups.length
          ? `<div class="map-group-list">
              ${groups
                .map(
                  (group) => `
                    <article class="map-day-group">
                      <div class="map-day-head">
                        <div>
                          <h4>${escapeHtml(group.title)}</h4>
                          <p>${escapeHtml(formatDate(group.date))}・星期${escapeHtml(group.weekday)}</p>
                        </div>
                        <div class="day-badge">${group.items.length} 筆</div>
                      </div>
                      <div class="map-item-list">
                        ${group.items
                          .map(
                            (item) => `
                              <article class="map-item-card">
                                <div class="map-item-top">
                                  <h5>${escapeHtml(item.name)}</h5>
                                  <span class="type-pill">${escapeHtml(item.typeLabel)}</span>
                                </div>
                                <div class="map-meta">
                                  <span><strong>所在區域：</strong>${escapeHtml(item.area)}</span>
                                  <span><strong>所屬日期：</strong>${escapeHtml(formatDate(item.date))}</span>
                                  ${
                                    item.filterKey === "restaurant"
                                      ? `<span><strong>餐廳資訊：</strong>${escapeHtml(item.mealType ?? "未分類")}・${escapeHtml(item.priorityLabel ?? "未標記")}</span>`
                                      : ""
                                  }
                                </div>
                                <div class="action-row">
                                  ${
                                    item.googleMapsUrl
                                      ? `<a class="map-button" href="${escapeHtml(item.googleMapsUrl)}" target="_blank" rel="noreferrer">Google Maps</a>`
                                      : `<span class="map-missing">尚未提供地圖連結</span>`
                                  }
                                </div>
                              </article>
                            `
                          )
                          .join("")}
                      </div>
                    </article>
                  `
                )
                .join("")}
            </div>`
          : `<div class="empty-state">目前沒有符合搜尋或篩選條件的項目。</div>`
      }
    </section>
  `;
}

function renderModeTabs() {
  modeNav.innerHTML = `
    <button class="mode-tab ${state.mode === "itinerary" ? "is-active" : ""}" data-mode="itinerary">行程</button>
    <button class="mode-tab ${state.mode === "maps" ? "is-active" : ""}" data-mode="maps">地圖／導航</button>
  `;

  modeNav.querySelectorAll(".mode-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      renderApp();
    });
  });
}

function renderDayTabs() {
  dayNav.innerHTML = `
    <button class="day-tab ${state.view === "overview" ? "is-active" : ""}" data-view="overview">總覽</button>
    ${tripData.days
      .map(
        (day) => `
          <button class="day-tab ${state.view === day.date ? "is-active" : ""}" data-view="${escapeHtml(day.date)}">
            ${escapeHtml(day.date.slice(5).replace("-", "/"))}
          </button>
        `
      )
      .join("")}
  `;

  dayNav.querySelectorAll(".day-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      renderApp();
    });
  });
}

function bindOverviewButtons() {
  app.querySelectorAll("[data-day-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const day = tripData.days[Number(button.dataset.dayIndex)];
      if (day) {
        state.view = day.date;
        renderApp();
      }
    });
  });
}

function bindMapTools() {
  const searchInput = document.getElementById("map-search");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      state.mapQuery = event.target.value;
      app.innerHTML = renderMapIndex();
      bindMapTools();
    });
  }

  app.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mapCategory = button.dataset.filter;
      app.innerHTML = renderMapIndex();
      bindMapTools();
    });
  });
}

function resolveInitialState() {
  const hash = window.location.hash.replace("#", "");
  if (hash === "maps") {
    state.mode = "maps";
    return;
  }
  if (tripData.days.some((day) => day.date === hash)) {
    state.view = hash;
  }
}

function syncHash() {
  if (state.mode === "maps") {
    window.location.hash = "#maps";
    return;
  }
  window.location.hash = state.view === "overview" ? "#overview" : `#${state.view}`;
}

function renderApp() {
  renderModeTabs();

  if (state.mode === "maps") {
    dayNav.classList.add("is-hidden");
    app.innerHTML = renderMapIndex();
    bindMapTools();
    syncHash();
    return;
  }

  dayNav.classList.remove("is-hidden");
  renderDayTabs();

  if (state.view === "overview") {
    app.innerHTML = renderOverview();
    bindOverviewButtons();
    syncHash();
    return;
  }

  const day = tripData.days.find((item) => item.date === state.view);
  app.innerHTML = day ? `${renderDay(day)}<div class="footer-space"></div>` : renderOverview();
  if (!day) bindOverviewButtons();
  syncHash();
}

resolveInitialState();
renderApp();
