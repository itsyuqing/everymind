import { geoContains, geoMercator, geoPath } from 'd3-geo';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve('us-atlas/counties-10m.json'), 'utf8'));
const all = feature(topo, topo.objects.counties).features;
const md = all.filter((f) => String(f.id).startsWith('24'));
const nameOf = (f) => (f.id === '24510' ? 'Baltimore City' : f.id === '24005' ? 'Baltimore County' : f.properties.name);

const W = 640, H = 340, STEP = 7;
const fc = { type: 'FeatureCollection', features: md };
const proj = geoMercator().fitExtent([[10, 10], [W - 10, H - 10]], fc);
const path = geoPath(proj);
const counties = md.map((f) => ({ name: nameOf(f), c: path.centroid(f).map((v) => Math.round(v)) }));
const dots = [];
for (let y = STEP / 2; y < H; y += STEP) {
  for (let x = STEP / 2; x < W; x += STEP) {
    const ll = proj.invert([x, y]);
    const i = md.findIndex((f) => geoContains(f, ll));
    if (i >= 0) dots.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10, i]);
  }
}
mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/data/md-dots.json', import.meta.url), JSON.stringify({ w: W, h: H, step: STEP, counties, dots }));
console.log(`Wrote ${dots.length} dots for ${counties.length} jurisdictions`);2
