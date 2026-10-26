/* ==========================================================================
   FanDuel Player Board • Google Analytics (GA4) Telemetry Dashboard
   100% CSV-Driven Runtime — Zero Hardcoded Analytics Data in Code
   All Metrics, Tables, Charts & Metadata Loaded Dynamically from data/*.csv
   ========================================================================== */

(function () {
  "use strict";

  const CSV_MANIFEST = [
    { key: "meta", path: "data/meta.csv", desc: "GA4 property metadata, measurement ID, build ID & refresh cadence" },
    { key: "kpiSummary", path: "data/kpi_summary.csv", desc: "Executive KPI summary cards across Realtime & Standard GA4 reports" },
    { key: "realtimeSnapshot", path: "data/realtime_snapshot.csv", desc: "Live 30-min & 5-min GA4 Realtime stream metrics" },
    { key: "dailyTraffic", path: "data/daily_traffic.csv", desc: "Daily users, sessions, pageviews, events & NFL slate context" },
    { key: "pagesScreens", path: "data/pages_screens.csv", desc: "Page path & screen title views, active users & event counts" },
    { key: "eventsBreakdown", path: "data/events_breakdown.csv", desc: "GA4 event name counts, user reach, share % & trigger definitions" },
    { key: "trafficSources", path: "data/traffic_sources.csv", desc: "Acquisition channels, source/medium & GA4 audience segments" },
    { key: "devicesTech", path: "data/devices_tech.csv", desc: "Web data stream, gtag.js implementation & device/tech breakdown" },
    { key: "geography", path: "data/geography.csv", desc: "Geographic distribution by country, region & report stream" }
  ];

  const state = {
    meta: {},
    metaRows: [],
    kpiSummary: [],
    realtimeSnapshot: [],
    dailyTraffic: [],
    pagesScreens: [],
    eventsBreakdown: [],
    trafficSources: [],
    devicesTech: [],
    geography: [],
    csvStats: {},
    activeTab: "overview",
    kpiCategoryFilter: "ALL",
    dailyReportFilter: "ALL",
    dailySearchQuery: "",
    eventsSearchQuery: ""
  };

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    const len = text.length;

    for (let i = 0; i < len; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          row.push(field);
          field = "";
        } else if (ch === "\r" && next === "\n") {
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
          i++;
        } else if (ch === "\n" || ch === "\r") {
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
        } else {
          field += ch;
        }
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    if (rows.length === 0) return { headers: [], rows: [] };
    const headers = rows[0].map((h) => h.trim());
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const rawRow = rows[r];
      if (rawRow.length === 1 && rawRow[0].trim() === "") continue;
      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        obj[headers[c]] = rawRow[c] !== undefined ? rawRow[c].trim() : "";
      }
      out.push(obj);
    }
    return { headers, rows: out };
  }

  async function fetchCSVFile(path, cacheToken) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${path}${sep}v=${encodeURIComponent(cacheToken)}`, {
      cache: "no-store"
    });
    if (!res.ok) {
      throw new Error(`Failed to load ${path} (HTTP ${res.status})`);
    }
    const text = await res.text();
    return parseCSV(text);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function loadAllAnalyticsCSVs() {
    const bust = Date.now().toString();
    const metaParsed = await fetchCSVFile("data/meta.csv", bust);
    state.metaRows = metaParsed.rows;
    state.meta = {};
    metaParsed.rows.forEach((r) => {
      state.meta[r.key] = r.value;
    });
    state.csvStats["meta"] = {
      rowCount: metaParsed.rows.length,
      headers: metaParsed.headers
    };

    const buildToken = (state.meta.build_id || bust) + "-" + bust;
    const otherFiles = CSV_MANIFEST.filter((m) => m.key !== "meta");

    const results = await Promise.all(
      otherFiles.map((item) => fetchCSVFile(item.path, buildToken))
    );

    otherFiles.forEach((item, idx) => {
      const parsed = results[idx];
      state[item.key] = parsed.rows;
      state.csvStats[item.key] = {
        rowCount: parsed.rows.length,
        headers: parsed.headers
      };
    });
  }

  function renderHeaderAndMeta() {
    const m = state.meta;
    document.getElementById("hdr-measurement-badge").textContent =
      m.measurement_id || "GA4";
    document.getElementById("hdr-property-badge").textContent =
      m.property_id ? `PROP #${m.property_id}` : "GA4 PROPERTY";
    document.getElementById("hdr-subtitle").textContent =
      `${m.data_source || ""} • ${m.refresh_schedule || ""}`;

    const monLink = document.getElementById("hdr-monitored-link");
    if (m.monitored_site_url) {
      monLink.href = m.monitored_site_url;
      monLink.title = `Open monitored site: ${m.monitored_site_url}`;
    }

    document.getElementById("hdr-build-pill").textContent =
      `Build: ${m.build_id || "—"}`;

    document.getElementById("meta-prop-name").textContent =
      `${m.property_name || "—"} (Acct: ${m.account_name || "—"} #${m.account_id || "—"})`;
    document.getElementById("meta-measurement-id").textContent =
      `${m.measurement_id || "—"} (Prop #${m.property_id || "—"})`;
    document.getElementById("meta-date-range").textContent =
      m.date_range || "—";
    document.getElementById("meta-generated-at").textContent =
      m.generated_at || "—";
    document.getElementById("meta-std-status").textContent =
      m.standard_reports_status || "—";
  }

  function populateFilterDropdowns() {
    // KPI Category Filter
    const kpiSelect = document.getElementById("kpi-cat-filter");
    const cats = Array.from(
      new Set(state.kpiSummary.map((r) => r.category).filter(Boolean))
    );
    kpiSelect.innerHTML =
      `<option value="ALL">All Categories (${state.kpiSummary.length})</option>` +
      cats
        .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
        .join("");
    kpiSelect.value = state.kpiCategoryFilter;

    // Daily Report Filter
    const dailySelect = document.getElementById("daily-report-filter");
    const rTypes = Array.from(
      new Set(state.dailyTraffic.map((r) => r.report_type).filter(Boolean))
    );
    dailySelect.innerHTML =
      `<option value="ALL">All Days (${state.dailyTraffic.length})</option>` +
      rTypes
        .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
        .join("");
    dailySelect.value = state.dailyReportFilter;
  }

  function renderKpiSummary() {
    const grid = document.getElementById("kpi-grid");
    const rows = state.kpiSummary.filter(
      (r) =>
        state.kpiCategoryFilter === "ALL" ||
        r.category === state.kpiCategoryFilter
    );

    grid.innerHTML = rows
      .map((r) => {
        const isPending = String(r.delta_pct || "")
          .toUpperCase()
          .includes("PENDING");
        return `
          <article class="kpi-card">
            <div class="kpi-card-top">
              <span class="kpi-label">${escapeHtml(r.label)}</span>
              <span class="kpi-cat-tag">${escapeHtml(r.category)}</span>
            </div>
            <div class="kpi-value">${escapeHtml(r.formatted_value || r.value)}</div>
            <div class="kpi-meta-row">
              <span class="kpi-delta ${isPending ? "pending" : ""}">${escapeHtml(r.delta_pct)}</span>
              <span class="kpi-period">${escapeHtml(r.period)}</span>
            </div>
            <p class="kpi-desc">${escapeHtml(r.description)}</p>
          </article>
        `;
      })
      .join("");
  }

  function renderRealtimePulseAndEventsMix() {
    const rtContainer = document.getElementById("realtime-cards-list");
    rtContainer.innerHTML = state.realtimeSnapshot
      .map(
        (r) => `
        <div class="rt-item-card">
          <div>
            <div class="rt-item-title">${escapeHtml(r.metric)}</div>
            <div class="rt-item-detail">${escapeHtml(r.detail)}</div>
          </div>
          <div class="rt-item-right">
            <div class="rt-item-val">${escapeHtml(r.formatted_value || r.value)}</div>
            <div class="rt-item-win">${escapeHtml(r.window)}</div>
          </div>
        </div>
      `
      )
      .join("");

    const mixBox = document.getElementById("overview-events-chart");
    mixBox.innerHTML = state.eventsBreakdown
      .map((ev) => {
        const pct = Math.max(0, Math.min(100, parseFloat(ev.share_of_events_pct) || 0));
        return `
          <div class="hbar-row" style="margin-bottom:8px;">
            <div class="hbar-top">
              <span class="hbar-name">${escapeHtml(ev.event_name)} <small style="color:var(--fd-muted);">(${escapeHtml(ev.category)})</small></span>
              <span class="hbar-stats">${escapeHtml(ev.event_count)} events • ${pct.toFixed(1)}%</span>
            </div>
            <div class="hbar-track">
              <div class="hbar-fill" style="width:${pct}%;"></div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function buildDailySvgChart(rows, metricsConfig) {
    if (!rows.length) {
      return `<div style="padding:18px;color:var(--fd-muted);">No rows match filter.</div>`;
    }
    const width = 620;
    const height = 210;
    const padLeft = 42;
    const padRight = 18;
    const padTop = 22;
    const padBottom = 46;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    let maxVal = 1;
    rows.forEach((r) => {
      metricsConfig.forEach((m) => {
        const v = parseFloat(r[m.field]) || 0;
        if (v > maxVal) maxVal = v;
      });
    });

    const stepX = plotW / rows.length;
    const barGroupW = Math.min(48, stepX * 0.72);
    const singleBarW = Math.max(6, barGroupW / metricsConfig.length);

    let gridLines = "";
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((maxVal * i) / 4);
      const y = padTop + plotH - (plotH * i) / 4;
      gridLines += `
        <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#233354" stroke-dasharray="3,3" />
        <text x="${padLeft - 6}" y="${y + 4}" text-anchor="end" fill="#93a3c0" font-size="10" font-family="JetBrains Mono">${val}</text>
      `;
    }

    let barsSvg = "";
    rows.forEach((r, idx) => {
      const centerX = padLeft + idx * stepX + stepX / 2;
      const startX = centerX - barGroupW / 2;
      const shortDate = String(r.date || "").slice(5);

      metricsConfig.forEach((m, mIdx) => {
        const val = parseFloat(r[m.field]) || 0;
        const barH = Math.max(2, (val / maxVal) * plotH);
        const x = startX + mIdx * singleBarW;
        const y = padTop + plotH - barH;
        barsSvg += `
          <rect x="${x}" y="${y}" width="${singleBarW - 2}" height="${barH}" rx="2" fill="${m.color}">
            <title>${escapeHtml(r.date)} • ${escapeHtml(m.label)}: ${val}</title>
          </rect>
        `;
        if (val > 0) {
          barsSvg += `
            <text x="${x + (singleBarW - 2) / 2}" y="${y - 4}" text-anchor="middle" fill="${m.color}" font-size="10" font-family="JetBrains Mono" font-weight="700">${val}</text>
          `;
        }
      });

      barsSvg += `
        <text x="${centerX}" y="${height - 22}" text-anchor="middle" fill="#f3f6fc" font-size="10" font-family="JetBrains Mono">${escapeHtml(shortDate)}</text>
      `;
    });

    const legendSvg = metricsConfig
      .map(
        (m, i) => `
        <g transform="translate(${padLeft + i * 145}, ${height - 6})">
          <rect x="0" y="-8" width="9" height="9" rx="2" fill="${m.color}" />
          <text x="14" y="0" fill="#93a3c0" font-size="10.5" font-family="Inter">${escapeHtml(m.label)}</text>
        </g>
      `
      )
      .join("");

    return `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img">
        ${gridLines}
        ${barsSvg}
        ${legendSvg}
      </svg>
    `;
  }

  function renderDailyTrafficSection() {
    const q = state.dailySearchQuery.trim().toLowerCase();
    const filtered = state.dailyTraffic.filter((r) => {
      if (
        state.dailyReportFilter !== "ALL" &&
        r.report_type !== state.dailyReportFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        String(r.date).toLowerCase().includes(q) ||
        String(r.report_type).toLowerCase().includes(q) ||
        String(r.slate_context).toLowerCase().includes(q)
      );
    });

    document.getElementById("daily-row-count").textContent =
      `${filtered.length} of ${state.dailyTraffic.length} days`;

    document.getElementById("chart-daily-users").innerHTML = buildDailySvgChart(
      filtered,
      [
        { field: "active_users", label: "Active Users", color: "#1493ff" },
        { field: "new_users", label: "New Users", color: "#00d68f" },
        { field: "sessions", label: "Sessions", color: "#a78bfa" }
      ]
    );

    document.getElementById("chart-daily-events").innerHTML = buildDailySvgChart(
      filtered,
      [
        { field: "pageviews", label: "Pageviews", color: "#ffb800" },
        { field: "event_count", label: "Total GA4 Events", color: "#00d68f" }
      ]
    );

    const tbody = document.getElementById("daily-traffic-tbody");
    tbody.innerHTML = filtered
      .map((r) => {
        const isLive = String(r.report_type || "")
          .toLowerCase()
          .includes("realtime");
        return `
          <tr class="${isLive ? "row-live" : ""}">
            <td class="mono"><strong>${escapeHtml(r.date)}</strong></td>
            <td>
              <span class="stream-pill ${isLive ? "live" : "batch"}">${escapeHtml(r.report_type)}</span>
            </td>
            <td class="num">${escapeHtml(r.active_users)}</td>
            <td class="num">${escapeHtml(r.new_users)}</td>
            <td class="num">${escapeHtml(r.sessions)}</td>
            <td class="num">${escapeHtml(r.engaged_sessions)}</td>
            <td class="num">${escapeHtml(r.pageviews)}</td>
            <td class="num"><strong>${escapeHtml(r.event_count)}</strong></td>
            <td class="num">${escapeHtml(r.engagement_rate_pct)}%</td>
            <td>${escapeHtml(r.slate_context)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderPagesAndEventsTab() {
    // Pages bars + table
    const pagesBars = document.getElementById("pages-visual-bars");
    pagesBars.innerHTML = state.pagesScreens
      .map((p) => {
        const pct = Math.max(0, Math.min(100, parseFloat(p.share_of_views_pct) || 0));
        return `
          <div class="hbar-row">
            <div class="hbar-top">
              <span class="hbar-name">${escapeHtml(p.page_title)} <small style="color:var(--fd-muted);">(${escapeHtml(p.page_path)})</small></span>
              <span class="hbar-stats">${escapeHtml(p.views)} views • ${escapeHtml(p.active_users)} users • ${pct.toFixed(1)}%</span>
            </div>
            <div class="hbar-track">
              <div class="hbar-fill" style="width:${pct}%;"></div>
            </div>
          </div>
        `;
      })
      .join("");

    document.getElementById("pages-tbody").innerHTML = state.pagesScreens
      .map(
        (p) => `
        <tr>
          <td class="num">${escapeHtml(p.rank)}</td>
          <td class="mono">${escapeHtml(p.page_path)}</td>
          <td><strong>${escapeHtml(p.page_title)}</strong></td>
          <td><span class="stream-pill ${String(p.source_window).includes("Realtime") ? "live" : "batch"}">${escapeHtml(p.source_window)}</span></td>
          <td class="num">${escapeHtml(p.views)}</td>
          <td class="num">${escapeHtml(p.active_users)}</td>
          <td class="num">${escapeHtml(p.views_per_user)}</td>
          <td class="num">${escapeHtml(p.event_count)}</td>
          <td class="num">${escapeHtml(p.share_of_views_pct)}%</td>
        </tr>
      `
      )
      .join("");

    // Events bars + table
    const eq = state.eventsSearchQuery.trim().toLowerCase();
    const filteredEvents = state.eventsBreakdown.filter((e) => {
      if (!eq) return true;
      return (
        String(e.event_name).toLowerCase().includes(eq) ||
        String(e.category).toLowerCase().includes(eq) ||
        String(e.description).toLowerCase().includes(eq)
      );
    });

    document.getElementById("events-visual-bars").innerHTML = filteredEvents
      .map((e) => {
        const pct = Math.max(0, Math.min(100, parseFloat(e.share_of_events_pct) || 0));
        return `
          <div class="hbar-row">
            <div class="hbar-top">
              <span class="hbar-name">${escapeHtml(e.event_name)}</span>
              <span class="hbar-stats">${escapeHtml(e.event_count)} events • ${escapeHtml(e.total_users)} users (${pct.toFixed(1)}%)</span>
            </div>
            <div class="hbar-track">
              <div class="hbar-fill" style="width:${pct}%;"></div>
            </div>
          </div>
        `;
      })
      .join("");

    document.getElementById("events-tbody").innerHTML = filteredEvents
      .map(
        (e) => `
        <tr>
          <td class="num">${escapeHtml(e.rank)}</td>
          <td class="mono"><strong class="accent">${escapeHtml(e.event_name)}</strong></td>
          <td>${escapeHtml(e.category)}</td>
          <td class="num"><strong>${escapeHtml(e.event_count)}</strong></td>
          <td class="num">${escapeHtml(e.total_users)}</td>
          <td class="num">${escapeHtml(e.events_per_user)}</td>
          <td class="num">${escapeHtml(e.share_of_events_pct)}%</td>
          <td>${escapeHtml(e.description)}</td>
        </tr>
      `
      )
      .join("");
  }

  function renderAcquisitionTechGeoTab() {
    document.getElementById("traffic-sources-tbody").innerHTML =
      state.trafficSources
        .map(
          (r) => `
          <tr>
            <td class="num">${escapeHtml(r.rank)}</td>
            <td><strong>${escapeHtml(r.channel_group)}</strong></td>
            <td class="mono">${escapeHtml(r.source_medium)}</td>
            <td>${escapeHtml(r.audience_segment)}</td>
            <td class="num">${escapeHtml(r.active_users)}</td>
            <td class="num">${escapeHtml(r.new_users)}</td>
            <td class="num">${escapeHtml(r.sessions)}</td>
            <td class="num">${escapeHtml(r.engaged_sessions)}</td>
            <td class="num">${escapeHtml(r.engagement_rate_pct)}%</td>
            <td class="num">${escapeHtml(r.event_count)}</td>
            <td>${escapeHtml(r.status_note)}</td>
          </tr>
        `
        )
        .join("");

    document.getElementById("geo-visual-bars").innerHTML = state.geography
      .map((g) => {
        const pct = Math.max(0, Math.min(100, parseFloat(g.share_pct) || 0));
        return `
          <div class="hbar-row">
            <div class="hbar-top">
              <span class="hbar-name">${escapeHtml(g.country)}</span>
              <span class="hbar-stats">${escapeHtml(g.active_users)} users • ${pct.toFixed(1)}%</span>
            </div>
            <div class="hbar-track">
              <div class="hbar-fill" style="width:${pct}%;"></div>
            </div>
          </div>
        `;
      })
      .join("");

    document.getElementById("geography-tbody").innerHTML = state.geography
      .map(
        (g) => `
        <tr>
          <td class="num">${escapeHtml(g.rank)}</td>
          <td><strong>${escapeHtml(g.country)}</strong></td>
          <td>${escapeHtml(g.region)}</td>
          <td>${escapeHtml(g.source_window)}</td>
          <td class="num">${escapeHtml(g.active_users)}</td>
          <td class="num">${escapeHtml(g.sessions)}</td>
          <td class="num">${escapeHtml(g.pageviews)}</td>
          <td class="num">${escapeHtml(g.share_pct)}%</td>
        </tr>
      `
      )
      .join("");

    document.getElementById("devices-tech-tbody").innerHTML = state.devicesTech
      .map(
        (d) => `
        <tr>
          <td><strong>${escapeHtml(d.dimension_type)}</strong></td>
          <td class="mono">${escapeHtml(d.dimension_value)}</td>
          <td class="num">${escapeHtml(d.active_users)}</td>
          <td class="num">${escapeHtml(d.sessions)}</td>
          <td class="num">${escapeHtml(d.pageviews)}</td>
          <td class="num">${escapeHtml(d.share_pct)}%</td>
          <td>${escapeHtml(d.status_note)}</td>
        </tr>
      `
      )
      .join("");
  }

  function renderRawCsvInspectorTab() {
    const grid = document.getElementById("csv-files-grid");
    grid.innerHTML = CSV_MANIFEST.map((item) => {
      const st = state.csvStats[item.key] || { rowCount: 0, headers: [] };
      return `
        <div class="csv-file-card">
          <div class="csv-file-top">
            <span class="csv-file-name">${escapeHtml(item.path)}</span>
            <span class="csv-file-stats">${st.rowCount} rows • ${st.headers.length} cols</span>
          </div>
          <p class="panel-sub">${escapeHtml(item.desc)}</p>
          <div class="csv-file-cols">Columns: ${escapeHtml(st.headers.join(", "))}</div>
          <div>
            <a class="btn-csv-dl" href="${escapeHtml(item.path)}" download>📥 Download ${escapeHtml(item.path.replace("data/", ""))}</a>
          </div>
        </div>
      `;
    }).join("");

    document.getElementById("meta-dict-tbody").innerHTML = state.metaRows
      .map(
        (r) => `
        <tr>
          <td class="mono"><strong>${escapeHtml(r.key)}</strong></td>
          <td class="mono">${escapeHtml(r.value)}</td>
        </tr>
      `
      )
      .join("");
  }

  function renderAll() {
    renderHeaderAndMeta();
    populateFilterDropdowns();
    renderKpiSummary();
    renderRealtimePulseAndEventsMix();
    renderDailyTrafficSection();
    renderPagesAndEventsTab();
    renderAcquisitionTechGeoTab();
    renderRawCsvInspectorTab();
  }

  function bindEvents() {
    document.querySelectorAll(".fd-nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-tab");
        state.activeTab = target;
        document.querySelectorAll(".fd-nav-tab").forEach((b) => {
          const active = b.getAttribute("data-tab") === target;
          b.classList.toggle("active", active);
          b.setAttribute("aria-selected", active ? "true" : "false");
        });
        document.querySelectorAll(".fd-view").forEach((v) => {
          v.classList.toggle("active", v.id === `tab-${target}`);
        });
      });
    });

    document.getElementById("kpi-cat-filter").addEventListener("change", (e) => {
      state.kpiCategoryFilter = e.target.value;
      renderKpiSummary();
    });

    document
      .getElementById("daily-report-filter")
      .addEventListener("change", (e) => {
        state.dailyReportFilter = e.target.value;
        renderDailyTrafficSection();
      });

    document.getElementById("daily-search").addEventListener("input", (e) => {
      state.dailySearchQuery = e.target.value;
      renderDailyTrafficSection();
    });

    document.getElementById("events-search").addEventListener("input", (e) => {
      state.eventsSearchQuery = e.target.value;
      renderPagesAndEventsTab();
    });

    document
      .getElementById("btn-refresh-csv")
      .addEventListener("click", async () => {
        const btn = document.getElementById("btn-refresh-csv");
        const prev = btn.textContent;
        btn.textContent = "⏳ Fetching CSVs…";
        try {
          await loadAllAnalyticsCSVs();
          renderAll();
          btn.textContent = "✅ Refreshed!";
          setTimeout(() => {
            btn.textContent = prev;
          }, 1200);
        } catch (err) {
          console.error(err);
          btn.textContent = "⚠️ Refresh Error";
        }
      });
  }

  async function init() {
    bindEvents();
    try {
      await loadAllAnalyticsCSVs();
      renderAll();
    } catch (err) {
      console.error("Failed to load GA4 CSV files:", err);
      document.getElementById("hdr-subtitle").textContent =
        "Error loading data/*.csv: " + err.message;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
