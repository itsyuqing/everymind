import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../output/dashboard_data.json');
const dest = resolve(here, '../src/data/dashboard_data.json');
if (!existsSync(src)) {
  console.error(`\n  Missing ${src}\n  Run the pipeline first: python run_pipeline.py data/survey_raw.xlsx\n`);
  process.exit(1);
}
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log('  Synced survey data from output/dashboard_data.json');