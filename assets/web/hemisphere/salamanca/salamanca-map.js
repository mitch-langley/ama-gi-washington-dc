(() => {
  "use strict";

  const DATA_URL = "assets/web/hemisphere/salamanca/school_of_salamanca_cities.json";
  const MAIN = { minLon: -110, maxLon: 10, minLat: -40, maxLat: 50, x: 0, y: 0, width: 1200, height: 900 };
  const INSET = { minLon: -10.5, maxLon: -1.0, minLat: 35.5, maxLat: 43.5, x: 470, y: 45, width: 350, height: 260 };
  const NS = "http://www.w3.org/2000/svg";
  const labelPositions = {
    inset: {
      salamanca: { dx: -16, dy: -22, anchor: "end", mobile: true },
      valladolid: { dx: 14, dy: -22, anchor: "start" },
      coimbra: { dx: -55, dy: 34, anchor: "start" },
      "alcala-de-henares": { dx: 65, dy: 48, anchor: "end" }
    },
    main: {
      "mexico-city": { dx: 34, dy: -6, anchor: "start", mobile: true },
      tiripetio: { dx: 18, dy: -24, anchor: "start" },
      lima: { dx: -18, dy: 6, anchor: "end", mobile: true }
    }
  };

  const groupMeta = {
    all: { label: "All" },
    core: { label: "Core centers" },
    major: { label: "Major extensions" },
    secondary: { label: "Secondary centers" },
    biographical: { label: "Biographical / peripheral" },
    precursor: { label: "American precursors" },
    reception: { label: "Later reception" }
  };

  const groupFor = (classification) => {
    const s = classification.toLowerCase();
    if (s.includes("core institutional")) return "core";
    if (s.includes("precursor")) return "precursor";
    if (s.includes("later")) return "reception";
    if (s.includes("biographical") || s.includes("peripheral")) return "biographical";
    if (s.includes("major") || s.includes("direct american transplant")) return "major";
    return "secondary";
  };

  const project = (lon, lat, cfg) => ({
    x: cfg.x + ((lon - cfg.minLon) / (cfg.maxLon - cfg.minLon)) * cfg.width,
    y: cfg.y + ((cfg.maxLat - lat) / (cfg.maxLat - cfg.minLat)) * cfg.height
  });

  const esc = (s) => String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const svg = document.querySelector("#salamanca-map-svg");
  const mainLayer = document.querySelector("#sal-map-city-layer");
  const insetLayer = document.querySelector("#sal-map-inset-city-layer");
  const tooltip = document.querySelector("#sal-map-tooltip");
  const detailContent = document.querySelector("#sal-map-detail-content");
  const emptyDetails = detailContent.innerHTML;
  const compactLayout = window.matchMedia("(max-width: 64rem)");
  const shell = document.querySelector(".sal-map-shell");
  const filters = document.querySelector("#sal-map-filter-pills");
  const status = document.querySelector("#sal-map-filter-status");
  const index = document.querySelector("#sal-map-city-index");
  const viewSwitch = document.querySelector("#sal-map-view-switch");
  const mapDescription = document.querySelector("#sal-map-desc");
  const desktopDescription = mapDescription.textContent;
  const countryShapes = [...svg.querySelectorAll(".sal-map__country")];
  const countryNames = { "Dominican Rep.": "Dominican Republic" };

  let cities = [];
  let pinnedCityId = null;
  let activeGroup = "all";
  let mobileView = "atlantic";

  function currentView() {
    return compactLayout.matches ? mobileView : "desktop";
  }

  function updateMapVisibility() {
    const view = currentView();
    document.querySelectorAll(".sal-map__marker-set").forEach(marker => {
      const wrongGroup = activeGroup !== "all" && marker.dataset.group !== activeGroup;
      const wrongView = view === "iberia"
        ? marker.parentElement !== insetLayer
        : view === "atlantic" && marker.parentElement === insetLayer;
      const shouldHide = wrongGroup || wrongView;
      marker.toggleAttribute("hidden", shouldHide);
      marker.setAttribute("aria-hidden", String(shouldHide));
      marker.setAttribute("tabindex", shouldHide ? "-1" : "0");
    });
    const filteredCities = cities.filter(city => activeGroup === "all" || groupFor(city.classification_category) === activeGroup);
    const countries = new Set(filteredCities.map(city => city.country));
    countryShapes.forEach(shape => {
      const name = shape.getAttribute("aria-label");
      shape.classList.toggle("has-cities", countries.has(countryNames[name] || name));
    });
    const count = filteredCities.filter(city => view !== "iberia" || city.region === "Iberia").length;
    status.textContent = view === "iberia"
      ? `${count} ${count === 1 ? "city" : "cities"} in Iberia · ${filteredCities.length} in the city index`
      : `${count} ${count === 1 ? "city" : "cities"} shown`;
  }

  function syncMapView() {
    const view = currentView();
    shell.dataset.view = view;
    svg.setAttribute("viewBox", view === "iberia"
      ? `${INSET.x} ${INSET.y - 35} ${INSET.width} ${INSET.height + 35}`
      : `${MAIN.x} ${MAIN.y} ${MAIN.width} ${MAIN.height}`);
    mapDescription.textContent = view === "desktop" ? desktopDescription
      : view === "iberia" ? "Enlarged interactive map of cities in Iberia. Switch to Atlantic for the transatlantic overview."
      : "Interactive Atlantic map showing cities in Iberia and the Americas. Switch to Iberia for an enlarged view.";
    viewSwitch.querySelectorAll("button").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.view === mobileView));
    });
    updateMapVisibility();
  }

  function selectMapView(view) {
    if (mobileView !== view) unpinCity();
    mobileView = view;
    syncMapView();
  }

  function markerRadius(group, inset = false) {
    const base = { core: 7, major: 6, secondary: 5.5, biographical: 4.5, precursor: 5.5, reception: 5 }[group] || 5;
    return inset ? base + 1 : base;
  }

  function positionInsetLocator() {
    const topLeft = project(INSET.minLon, INSET.maxLat, MAIN);
    const bottomRight = project(INSET.maxLon, INSET.minLat, MAIN);
    const locator = document.querySelector("#sal-map-inset-locator");
    locator.setAttribute("x", topLeft.x);
    locator.setAttribute("y", topLeft.y);
    locator.setAttribute("width", bottomRight.x - topLeft.x);
    locator.setAttribute("height", bottomRight.y - topLeft.y);
    document.querySelector("#sal-map-inset-connector").setAttribute("d",
      `M${topLeft.x},${(topLeft.y + bottomRight.y) / 2} L${INSET.x + INSET.width},${INSET.y + INSET.height / 2}`);
  }

  function createCityLabel(city, p, cfg, isInset, set) {
    const permanent = labelPositions[isInset ? "inset" : "main"][city.id];
    const alignLeft = p.x > cfg.x + cfg.width / 2;
    const placement = permanent || {
      dx: alignLeft ? -16 : 16,
      dy: -17,
      anchor: alignLeft ? "end" : "start"
    };
    set.dataset.labelPermanent = String(Boolean(permanent));
    set.dataset.labelMobile = String(Boolean(permanent?.mobile));

    const labels = document.createElementNS(NS, "g");
    labels.setAttribute("class", "sal-map__city-label-set");
    labels.setAttribute("aria-hidden", "true");
    if (permanent && Math.hypot(placement.dx, placement.dy) > 25) {
      const leader = document.createElementNS(NS, "path");
      const length = Math.hypot(placement.dx, placement.dy);
      const clearance = markerRadius(groupFor(city.classification_category), isInset) + 5;
      const startX = p.x + placement.dx / length * clearance;
      const startY = p.y + placement.dy / length * clearance;
      const endX = p.x + placement.dx + (placement.anchor === "end" ? 4 : -4);
      leader.setAttribute("class", "sal-map__label-leader");
      leader.setAttribute("d", `M${startX},${startY} L${endX},${p.y + placement.dy - 5}`);
      labels.appendChild(leader);
    }
    const label = document.createElementNS(NS, "text");
    label.setAttribute("class", "sal-map__city-label");
    label.setAttribute("x", p.x + placement.dx);
    label.setAttribute("y", p.y + placement.dy);
    label.setAttribute("text-anchor", placement.anchor);
    label.textContent = city.current_name;
    labels.appendChild(label);
    set.appendChild(labels);
  }

  function createMarker(city, cfg, layer, isInset = false) {
    const group = groupFor(city.classification_category);
    const p = project(city.x, city.y, cfg);
    const set = document.createElementNS(NS, "g");
    set.setAttribute("class", "sal-map__marker-set");
    set.dataset.cityId = city.id;
    set.dataset.group = group;
    set.dataset.region = city.region;
    set.setAttribute("tabindex", "0");
    set.setAttribute("role", "button");
    set.setAttribute("aria-controls", "sal-map-tooltip");
    set.setAttribute("aria-pressed", "false");
    set.setAttribute("aria-label", `${city.current_name}, ${city.country}. ${city.classification_category}`);

    const hit = document.createElementNS(NS, "circle");
    hit.setAttribute("class", "sal-map__marker-hit");
    hit.setAttribute("cx", p.x);
    hit.setAttribute("cy", p.y);
    hit.setAttribute("r", isInset ? 15 : 13);

    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("class", "sal-map__marker");
    dot.setAttribute("cx", p.x);
    dot.setAttribute("cy", p.y);
    dot.setAttribute("r", markerRadius(group, isInset));

    if (city.id === "salamanca") {
      [4, 8].forEach((offset, i) => {
        const ring = document.createElementNS(NS, "circle");
        ring.setAttribute("class", `sal-map__core-ring${i ? " sal-map__core-ring--outer" : ""}`);
        ring.setAttribute("cx", p.x);
        ring.setAttribute("cy", p.y);
        ring.setAttribute("r", markerRadius(group, isInset) + offset);
        ring.setAttribute("aria-hidden", "true");
        set.appendChild(ring);
      });
    }
    set.append(hit, dot);
    createCityLabel(city, p, cfg, isInset, set);
    set.addEventListener("mouseenter", () => showCity(city, set, false));
    set.addEventListener("mouseleave", () => { if (!pinnedCityId) hideTooltip(); });
    set.addEventListener("focus", () => showCity(city, set, false));
    set.addEventListener("blur", () => { if (!pinnedCityId) hideTooltip(); });
    set.addEventListener("click", (event) => {
      event.stopPropagation();
      pinCity(city, set);
    });
    set.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        pinCity(city, set);
      }
    });
    layer.appendChild(set);
  }

  function tooltipHtml(city, pinned) {
    const former = city.former_name
      ? `<p class="sal-map__former-name">Historically: ${esc(city.former_name)}</p>`
      : "";
    return `
      <button class="sal-map__tooltip-close" type="button" aria-label="Close city information">×</button>
      <p class="sal-map__tooltip-kicker">${esc(city.region)} · ${esc(city.classification_category)}</p>
      <h2 id="sal-map-detail-title">${esc(city.current_name)}</h2>
      ${former}
      <p class="sal-map__tooltip-description">${esc(city.short_description)}</p>
      <p class="sal-map__tooltip-associations"><strong>Associated:</strong> ${city.associated_scholars_etc.map(esc).join(" · ")}</p>
      <p class="sal-map__tooltip-state">${pinned ? "Pinned. Select another city to switch, or close to clear." : "Click a city marker to keep its details open."}</p>`;
  }

  function setActiveMarkers(cityId) {
    document.querySelectorAll(".sal-map__marker-set").forEach(el => {
      el.classList.toggle("is-active", el.dataset.cityId === cityId);
      el.setAttribute("aria-pressed", String(el.dataset.cityId === pinnedCityId));
    });
  }

  function showCity(city, marker, pinned) {
    if (pinnedCityId && !pinned) return;
    if (tooltip.dataset.cityId === city.id && tooltip.dataset.pinned === String(pinned)) return;
    detailContent.innerHTML = tooltipHtml(city, pinned);
    tooltip.dataset.empty = "false";
    tooltip.dataset.cityId = city.id;
    tooltip.dataset.pinned = pinned ? "true" : "false";
    detailContent.scrollTop = 0;
    tooltip.scrollTop = 0;
    setActiveMarkers(city.id);
    tooltip.querySelector(".sal-map__tooltip-close").addEventListener("click", unpinCity, { once: true });
  }

  function hideTooltip() {
    if (pinnedCityId || !compactLayout.matches) return;
    unpinCity();
  }

  function pinCity(city, marker) {
    if (pinnedCityId === city.id) {
      unpinCity();
      return;
    }
    pinnedCityId = city.id;
    showCity(city, marker, true);
  }

  function unpinCity() {
    pinnedCityId = null;
    tooltip.dataset.empty = "true";
    delete tooltip.dataset.cityId;
    tooltip.removeAttribute("data-pinned");
    detailContent.innerHTML = emptyDetails;
    detailContent.scrollTop = 0;
    tooltip.scrollTop = 0;
    setActiveMarkers("");
  }

  function buildFilters() {
    Object.entries(groupMeta).forEach(([key, meta]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "topic-pill";
      button.dataset.group = key;
      button.setAttribute("aria-pressed", key === "all" ? "true" : "false");
      if (key !== "all") {
        const symbol = document.createElementNS(NS, "svg");
        symbol.setAttribute("class", "sal-map-filter-symbol");
        symbol.setAttribute("viewBox", "-17 -17 34 34");
        symbol.setAttribute("aria-hidden", "true");
        symbol.setAttribute("focusable", "false");
        symbol.dataset.group = key;
        if (key === "core") {
          [4, 8].forEach((offset, i) => {
            const ring = document.createElementNS(NS, "circle");
            ring.setAttribute("class", `sal-map__core-ring${i ? " sal-map__core-ring--outer" : ""}`);
            ring.setAttribute("r", markerRadius(key) + offset);
            symbol.appendChild(ring);
          });
        }
        const dot = document.createElementNS(NS, "circle");
        dot.setAttribute("class", "sal-map__marker");
        dot.setAttribute("r", markerRadius(key));
        symbol.appendChild(dot);
        button.appendChild(symbol);
      }
      button.appendChild(document.createTextNode(meta.label));
      button.addEventListener("click", () => applyFilter(key));
      filters.appendChild(button);
    });
  }

  function applyFilter(group) {
    activeGroup = group;
    unpinCity();
    document.querySelectorAll("#sal-map-filter-pills .topic-pill").forEach(btn => {
      btn.setAttribute("aria-pressed", btn.dataset.group === group ? "true" : "false");
    });
    document.querySelectorAll("#sal-map-city-index li").forEach(item => {
      const shouldHide = group !== "all" && item.dataset.group !== group;
      item.toggleAttribute("hidden", shouldHide);
    });
    updateMapVisibility();
  }

  function buildIndex() {
    const sorted = [...cities].sort((a, b) => a.current_name.localeCompare(b.current_name, "en"));
    sorted.forEach(city => {
      const li = document.createElement("li");
      li.dataset.group = groupFor(city.classification_category);
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `<strong>${esc(city.current_name)}</strong><span>${esc(city.region)} · ${esc(city.classification_category)}</span>`;
      button.addEventListener("click", () => {
        if (compactLayout.matches) selectMapView(city.region === "Iberia" ? "iberia" : "atlantic");
        const layer = city.region === "Iberia" ? insetLayer : mainLayer;
        const marker = layer.querySelector(`.sal-map__marker-set[data-city-id="${CSS.escape(city.id)}"]`);
        if (!marker) return;
        marker.focus({ preventScroll: true });
        pinCity(city, marker);
        shell.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      });
      li.appendChild(button);
      index.appendChild(li);
    });
  }

  async function init() {
    positionInsetLocator();
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      cities = payload.cities || [];
      cities.forEach(city => {
        createMarker(city, MAIN, mainLayer, false);
        if (city.region === "Iberia") createMarker(city, INSET, insetLayer, true);
      });
      buildFilters();
      buildIndex();
      applyFilter("all");
      syncMapView();
      viewSwitch.hidden = false;
    } catch (error) {
      console.error("Unable to load Salamanca map data:", error);
      status.textContent = "Map data could not be loaded.";
      status.setAttribute("role", "alert");
    }
  }

  shell.addEventListener("click", (event) => {
    if (!event.target.closest(".sal-map__marker-set") && !event.target.closest(".sal-map__tooltip")) unpinCity();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") unpinCity();
  });
  viewSwitch.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => selectMapView(button.dataset.view));
  });
  compactLayout.addEventListener("change", () => {
    if (compactLayout.matches && pinnedCityId) {
      const city = cities.find(item => item.id === pinnedCityId);
      mobileView = city?.region === "Iberia" ? "iberia" : "atlantic";
    } else if (compactLayout.matches) {
      unpinCity();
    }
    if (cities.length) syncMapView();
  });

  init();
})();
