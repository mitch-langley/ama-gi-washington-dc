(() => {
  "use strict";

  const DATA_URL = "assets/web/hemisphere/salamanca/school_of_salamanca_cities.json";
  const MAIN = { minLon: -110, maxLon: 10, minLat: -40, maxLat: 50, x: 0, y: 0, width: 1200, height: 900 };
  const INSET = { minLon: -10.5, maxLon: -1.0, minLat: 35.5, maxLat: 43.5, x: 470, y: 45, width: 350, height: 260 };
  const NS = "http://www.w3.org/2000/svg";

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
  const tooltipClose = tooltip.querySelector(".sal-map__tooltip-close");
  const shell = document.querySelector(".sal-map-shell");
  const filters = document.querySelector("#sal-map-filter-pills");
  const status = document.querySelector("#sal-map-filter-status");
  const index = document.querySelector("#sal-map-city-index");

  let cities = [];
  let pinnedCityId = null;
  let activeGroup = "all";

  function markerRadius(group, inset = false) {
    const base = { core: 7, major: 6, secondary: 5.5, biographical: 4.5, precursor: 5.5, reception: 5 }[group] || 5;
    return inset ? base + 1 : base;
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

    set.append(hit, dot);
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

  function tooltipHtml(city) {
    const former = city.former_name
      ? `<p class="sal-map__former-name">Historically: ${esc(city.former_name)}</p>`
      : "";
    return `
      <button class="sal-map__tooltip-close" type="button" aria-label="Close city information">×</button>
      <p class="sal-map__tooltip-kicker">${esc(city.region)} · ${esc(city.classification_category)}</p>
      <h2>${esc(city.current_name)}</h2>
      ${former}
      <p class="sal-map__tooltip-description">${esc(city.short_description)}</p>
      <p class="sal-map__tooltip-associations"><strong>Associated:</strong> ${city.associated_scholars_etc.map(esc).join(" · ")}</p>`;
  }

  function setActiveMarkers(cityId) {
    document.querySelectorAll(".sal-map__marker-set").forEach(el => {
      el.classList.toggle("is-active", el.dataset.cityId === cityId);
    });
  }

  function showCity(city, marker, pinned) {
    if (pinnedCityId && !pinned && pinnedCityId !== city.id) return;
    tooltip.innerHTML = tooltipHtml(city);
    tooltip.hidden = false;
    tooltip.dataset.pinned = pinned ? "true" : "false";
    setActiveMarkers(city.id);
    positionTooltip(marker);
    tooltip.querySelector(".sal-map__tooltip-close").addEventListener("click", unpinCity, { once: true });
  }

  function positionTooltip(marker) {
    if (window.matchMedia("(max-width: 44rem)").matches) {
      tooltip.style.left = "";
      tooltip.style.top = "";
      return;
    }
    const shellRect = shell.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    let left = markerRect.left - shellRect.left + markerRect.width / 2;
    let top = markerRect.top - shellRect.top + markerRect.height / 2;
    const half = Math.min(184, (shellRect.width - 32) / 2);
    left = Math.max(half + 16, Math.min(shellRect.width - half - 16, left));
    if (top < 235) {
      tooltip.style.transform = "translate(-50%, 1.25rem)";
    } else {
      tooltip.style.transform = "translate(-50%, calc(-100% - .85rem))";
    }
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function hideTooltip() {
    if (pinnedCityId) return;
    tooltip.hidden = true;
    tooltip.removeAttribute("data-pinned");
    setActiveMarkers("");
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
    tooltip.hidden = true;
    tooltip.removeAttribute("data-pinned");
    setActiveMarkers("");
  }

  function buildFilters() {
    Object.entries(groupMeta).forEach(([key, meta]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "topic-pill";
      button.dataset.group = key;
      button.setAttribute("aria-pressed", key === "all" ? "true" : "false");
      button.textContent = meta.label;
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
    document.querySelectorAll(".sal-map__marker-set").forEach(marker => {
      const shouldHide = group !== "all" && marker.dataset.group !== group;
      marker.toggleAttribute("hidden", shouldHide);
      marker.setAttribute("aria-hidden", shouldHide ? "true" : "false");
    });
    document.querySelectorAll("#sal-map-city-index li").forEach(item => {
      const shouldHide = group !== "all" && item.dataset.group !== group;
      item.toggleAttribute("hidden", shouldHide);
    });
    const count = cities.filter(c => group === "all" || groupFor(c.classification_category) === group).length;
    status.textContent = `${count} ${count === 1 ? "city" : "cities"} shown`;
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
        const marker = document.querySelector(`.sal-map__marker-set[data-city-id="${CSS.escape(city.id)}"]`);
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
  window.addEventListener("resize", () => {
    if (!pinnedCityId || tooltip.hidden) return;
    const marker = document.querySelector(`.sal-map__marker-set[data-city-id="${CSS.escape(pinnedCityId)}"].is-active`);
    if (marker) positionTooltip(marker);
  });

  init();
})();
