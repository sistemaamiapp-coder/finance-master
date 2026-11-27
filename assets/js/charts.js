/* =========================================================
   LIVIS FINANCE — gráficos SVG (offline, sem dependências)
   ========================================================= */
(function () {
  "use strict";
  const FM = window.FM || (window.FM = {});
  const U = FM.utils;
  const { num, money, moneyShort, pct, esc } = U;

  const palette = ["#d96faa", "#48ad8c", "#79b9cc", "#e0ad57", "#aa88cf", "#e27c94", "#eaa0c0", "#76c4b4", "#a9a0dd"];
  let uidc = 0;
  const uid = (p) => `c${p}${++uidc}`;

  function empty(msg) {
    return `<div class="chart-empty">${esc(msg || "Sem dados para exibir.")}</div>`;
  }

  function smoothPath(pts) {
    if (!pts.length) return "";
    if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const t = 0.16;
      const c1x = p1[0] + (p2[0] - p0[0]) * t;
      const c1y = p1[1] + (p2[1] - p0[1]) * t;
      const c2x = p2[0] - (p3[0] - p1[0]) * t;
      const c2y = p2[1] - (p3[1] - p1[1]) * t;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  function tipAttr(title, rows) {
    const html = `<strong>${esc(title)}</strong>` + rows.map((r) => `<div class="tip-row"><span>${r.color ? `<i style="background:${r.color}"></i>` : ""}${esc(r.name)}</span><b>${esc(r.value)}</b></div>`).join("");
    return `data-tip="${esc(html)}"`;
  }

  function axisTicks(min, max) {
    const span = max - min || 1;
    return [0, 1, 2, 3, 4].map((i) => min + (span * i) / 4);
  }

  function area(opts) {
    const labels = opts.labels || [];
    const series = (opts.series || []).filter((s) => Array.isArray(s.values));
    const height = opts.height || 230;
    const format = opts.format || moneyShort;
    if (!labels.length || !series.length || !series.some((s) => s.values.some((v) => num(v) !== 0))) {
      return empty(opts.emptyText);
    }
    const W = 760;
    const H = height;
    const P = { t: 18, r: 14, b: 26, l: 54 };
    const plotW = W - P.l - P.r;
    const plotH = H - P.t - P.b;

    let minV, maxV;
    if (opts.zero === false) {
      minV = Math.min(...series.flatMap((s) => s.values.map(num)));
      maxV = Math.max(...series.flatMap((s) => s.values.map(num)));
      const range = maxV - minV;
      const pad = range === 0 ? Math.abs(maxV || 1) * 0.08 : range * 0.18;
      minV -= pad;
      maxV += pad;
    } else {
      minV = 0;
      maxV = Math.max(...series.flatMap((s) => s.values.map(num)));
      maxV = maxV === 0 ? 1 : maxV * 1.12;
    }
    if (maxV === minV) maxV = minV + 1;
    const ticks = axisTicks(minV, maxV);
    const yOf = (v) => P.t + plotH - ((num(v) - minV) / (maxV - minV)) * plotH;
    const xOf = (i) => P.l + (labels.length === 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);

    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de evolução">`;
    ticks.forEach((tick) => {
      const y = yOf(tick);
      svg += `<line class="chart-grid-line" x1="${P.l}" y1="${y.toFixed(1)}" x2="${W - P.r}" y2="${y.toFixed(1)}"/>`;
      svg += `<text class="chart-axis-label" x="${P.l - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end">${esc(format(tick))}</text>`;
    });
    labels.forEach((lab, i) => {
      svg += `<text class="chart-axis-label" x="${xOf(i).toFixed(1)}" y="${H - 7}" text-anchor="middle">${esc(lab)}</text>`;
    });

    series.forEach((s, si) => {
      const color = s.color || palette[si % palette.length];
      const pts = s.values.map((v, i) => [xOf(i), yOf(v)]);
      const line = smoothPath(pts);
      if (s.fill !== false) {
        const gid = uid("ag");
        const areaPath = `${line} L${xOf(pts.length - 1)},${P.t + plotH} L${xOf(0)},${P.t + plotH} Z`;
        svg += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity=".28"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient></defs>`;
        svg += `<path d="${areaPath}" fill="url(#${gid})" stroke="none"/>`;
      }
      svg += `<path d="${line}" fill="none" stroke="${color}" stroke-width="${s.width || 2.4}" stroke-linecap="round" stroke-linejoin="round"/>`;
      pts.forEach((pt, i) => {
        svg += `<circle class="chart-dot" cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="${s.dot === false ? 0 : 3}" fill="${color}"/>`;
      });
    });

    // faixas de hover
    labels.forEach((lab, i) => {
      const bandW = plotW / Math.max(labels.length - 1, 1);
      const x = i === 0 ? P.l : xOf(i) - bandW / 2;
      const w = i === 0 || i === labels.length - 1 ? bandW / 2 + (i === 0 ? 0 : 0) : bandW;
      const left = i === 0 ? P.l : xOf(i) - bandW / 2;
      const right = i === labels.length - 1 ? W - P.r : xOf(i) + bandW / 2;
      const rows = series.map((s, si) => ({ name: s.name, value: money(s.values[i]), color: s.color || palette[si % palette.length] }));
      svg += `<rect x="${left.toFixed(1)}" y="${P.t}" width="${Math.max(right - left, 1).toFixed(1)}" height="${plotH}" fill="transparent" pointer-events="all" ${tipAttr(lab, rows)}/>`;
    });

    svg += `</svg>`;
    return `<div class="chart">${svg}</div>`;
  }

  function bars(opts) {
    const labels = opts.labels || [];
    const series = (opts.series || []).filter((s) => Array.isArray(s.values));
    const height = opts.height || 240;
    const format = opts.format || moneyShort;
    if (!labels.length || !series.length || !series.some((s) => s.values.some((v) => num(v) !== 0))) {
      return empty(opts.emptyText);
    }
    const W = 760;
    const H = height;
    const P = { t: 18, r: 12, b: 28, l: 54 };
    const plotW = W - P.l - P.r;
    const plotH = H - P.t - P.b;
    const maxV = Math.max(...series.flatMap((s) => s.values.map(num)), 1) * 1.14;
    const ticks = axisTicks(0, maxV);
    const yOf = (v) => P.t + plotH - (num(v) / maxV) * plotH;
    const slot = plotW / labels.length;
    const groupW = Math.min(slot * 0.64, series.length * 30);
    const barW = Math.max(6, Math.min(24, groupW / series.length - 4));
    const gap = 4;

    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras">`;
    ticks.forEach((tick) => {
      const y = yOf(tick);
      svg += `<line class="chart-grid-line" x1="${P.l}" y1="${y.toFixed(1)}" x2="${W - P.r}" y2="${y.toFixed(1)}"/>`;
      svg += `<text class="chart-axis-label" x="${P.l - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end">${esc(format(tick))}</text>`;
    });
    labels.forEach((lab, i) => {
      const cx = P.l + slot * i + slot / 2;
      svg += `<text class="chart-axis-label" x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(lab)}</text>`;
      const totalW = series.length * barW + (series.length - 1) * gap;
      series.forEach((s, si) => {
        const value = num(s.values[i]);
        const x = cx - totalW / 2 + si * (barW + gap);
        const y = yOf(value);
        const h = Math.max(value > 0 ? 2 : 0, P.t + plotH - y);
        const color = s.color || palette[si % palette.length];
        svg += `<rect class="chart-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${color}" ${tipAttr(lab, [{ name: s.name, value: money(value), color }])}/>`;
      });
    });
    svg += `</svg>`;
    return `<div class="chart">${svg}</div>`;
  }

  function donut(opts) {
    const items = (opts.items || []).filter((i) => num(i.value) > 0);
    const total = items.reduce((s, i) => s + num(i.value), 0);
    const centerLabel = opts.centerLabel || "Total";
    const centerValue = opts.centerValue || (total ? moneyShort(total) : "—");
    const R = 54;
    const C = 2 * Math.PI * R;
    let svg = `<svg viewBox="0 0 140 140" role="img" aria-label="Gráfico de categorias">`;
    svg += `<circle cx="70" cy="70" r="${R}" fill="none" stroke="var(--card-2)" stroke-width="15"/>`;
    let acc = 0;
    items.forEach((item, i) => {
      const color = item.color || palette[i % palette.length];
      const frac = num(item.value) / total;
      const len = Math.max(frac * C - 2.5, 0.8);
      const dash = `${len.toFixed(2)} ${(C - len).toFixed(2)}`;
      const offset = -(acc * C);
      svg += `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${color}" stroke-width="15" stroke-dasharray="${dash}" stroke-dashoffset="${offset.toFixed(2)}" transform="rotate(-90 70 70)" ${tipAttr(item.label, [{ name: pct(frac, 1) + " do total", value: money(item.value), color }])} style="cursor:default"/>`;
      acc += frac;
    });
    svg += `<text x="70" y="67" text-anchor="middle" fill="var(--text)" font-size="15" font-weight="700" style="font-variant-numeric:tabular-nums">${esc(centerValue)}</text>`;
    svg += `<text x="70" y="83" text-anchor="middle" fill="var(--text-3)" font-size="8.5" letter-spacing=".06em" style="text-transform:uppercase">${esc(centerLabel)}</text>`;
    svg += `</svg>`;

    const legend = items.length
      ? items.map((item, i) => {
          const color = item.color || palette[i % palette.length];
          return `<div class="donut-legend-row"><span class="swatch" style="background:${color}"></span><span class="name">${esc(item.label)}</span><span class="val">${esc(moneyShort(item.value))}</span><span class="pct">${pct(num(item.value) / total)}</span></div>`;
        }).join("")
      : `<div class="small muted">Sem despesas pagas no período.</div>`;

    return `<div class="donut-wrap"><div class="donut-chart">${svg}</div><div class="donut-legend">${legend}</div></div>`;
  }

  function spark(values, color) {
    const vals = (values || []).map(num);
    if (vals.length < 2) return "";
    const W = 92, H = 30, pad = 3;
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const pts = vals.map((v, i) => [pad + (i / (vals.length - 1)) * (W - pad * 2), H - pad - ((v - min) / range) * (H - pad * 2)]);
    const line = smoothPath(pts);
    const areaPath = `${line} L${W - pad},${H} L${pad},${H} Z`;
    const gid = uid("sg");
    const c = color || "var(--green)";
    return `<svg class="kpi-spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".28"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>
      <path d="${areaPath}" fill="url(#${gid})"/>
      <path d="${line}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
  }

  function legend(items) {
    if (!items || !items.length) return "";
    return `<div class="legend">${items.map((it) => `<span class="legend-item"><i style="background:${it.color || "var(--primary)"}"></i>${esc(it.name)}${it.value ? ` <b>${esc(it.value)}</b>` : ""}</span>`).join("")}</div>`;
  }

  FM.charts = { area, bars, donut, spark, legend, palette, empty };
})();
