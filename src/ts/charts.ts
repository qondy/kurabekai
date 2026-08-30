const SVG_NS = 'http://www.w3.org/2000/svg';

export interface RankBarItem {
  label: string;
  value: number;
  max: number;
  first: boolean;
}

export function renderRankingBars(items: RankBarItem[]): HTMLElement {
  const list = document.createElement('div');
  list.className = 'rank-list';

  items.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'rank-row' + (item.first ? ' is-first' : '');

    const pos = document.createElement('span');
    pos.className = 'rank-row__pos';
    pos.textContent = item.first ? '🏆' : String(i + 1);

    const label = document.createElement('span');
    label.className = 'rank-row__label';
    label.textContent = item.label;

    const track = document.createElement('div');
    track.className = 'rank-row__track';
    const fill = document.createElement('div');
    fill.className = 'rank-row__fill';
    const pct = item.max > 0 ? (item.value / item.max) * 100 : 0;
    fill.style.width = `${Math.max(pct, 2)}%`;
    track.append(fill);

    const val = document.createElement('span');
    val.className = 'rank-row__val';
    val.textContent = String(Math.round(item.value * 10) / 10);

    row.append(pos, label, track, val);
    list.append(row);
  });

  return list;
}

// ============================================================
// レーダーチャート（軸が3つ以上のときだけ意味を持つ）
// ============================================================
export interface RadarSeries {
  label: string;
  color: string;
  values: number[];
}

function polarPoint(cx: number, cy: number, radius: number, angleDeg: number): [number, number] {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
}

export function renderRadar(axes: string[], series: RadarSeries[], maxValue: number): SVGSVGElement | null {
  if (axes.length < 3) return null;

  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 92;
  const n = axes.length;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', 'auto');
  svg.style.maxWidth = `${size}px`;

  // grid rings
  for (let ring = 1; ring <= maxValue; ring += 1) {
    const r = (radius * ring) / maxValue;
    const pts: string[] = [];
    for (let i = 0; i < n; i += 1) {
      const [x, y] = polarPoint(cx, cy, r, (360 / n) * i);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', pts.join(' '));
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', '#e6ddd0');
    poly.setAttribute('stroke-width', '1');
    svg.append(poly);
  }

  // spokes + labels
  for (let i = 0; i < n; i += 1) {
    const angle = (360 / n) * i;
    const [ex, ey] = polarPoint(cx, cy, radius, angle);
    const spoke = document.createElementNS(SVG_NS, 'line');
    spoke.setAttribute('x1', String(cx));
    spoke.setAttribute('y1', String(cy));
    spoke.setAttribute('x2', ex.toFixed(1));
    spoke.setAttribute('y2', ey.toFixed(1));
    spoke.setAttribute('stroke', '#e6ddd0');
    spoke.setAttribute('stroke-width', '1');
    svg.append(spoke);

    const [lx, ly] = polarPoint(cx, cy, radius + 16, angle);
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', lx.toFixed(1));
    text.setAttribute('y', ly.toFixed(1));
    text.setAttribute('font-size', '10');
    text.setAttribute('fill', '#8a8177');
    text.setAttribute('text-anchor', lx < cx - 4 ? 'end' : lx > cx + 4 ? 'start' : 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.textContent = axes[i];
    svg.append(text);
  }

  // series polygons
  series.forEach((s) => {
    const pts: string[] = [];
    for (let i = 0; i < n; i += 1) {
      const v = Math.max(0, Math.min(maxValue, s.values[i] || 0));
      const r = (radius * v) / maxValue;
      const [x, y] = polarPoint(cx, cy, r, (360 / n) * i);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', pts.join(' '));
    poly.setAttribute('fill', s.color);
    poly.setAttribute('fill-opacity', '0.14');
    poly.setAttribute('stroke', s.color);
    poly.setAttribute('stroke-width', '2');
    poly.setAttribute('stroke-linejoin', 'round');
    svg.append(poly);
  });

  return svg;
}

export function renderRadarLegend(series: RadarSeries[]): HTMLElement {
  const legend = document.createElement('div');
  legend.className = 'radar-legend';
  series.forEach((s) => {
    const item = document.createElement('span');
    item.className = 'radar-legend__item';
    const sw = document.createElement('span');
    sw.className = 'radar-legend__swatch';
    sw.style.background = s.color;
    const name = document.createElement('span');
    name.textContent = s.label;
    item.append(sw, name);
    legend.append(item);
  });
  return legend;
}
