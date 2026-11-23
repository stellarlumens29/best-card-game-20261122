// Ember Sigil Duel — screenshot runner (run in Colab / any machine with a
// working Chromium; this VM's local Chrome is dead, so screenshots are a
// BUTUH COLAB step, not a here step).
//
//   1. npm install -D playwright   (once; free, no account)
//   2. npx playwright install chromium   (once)
//   3. node serve.ts &            (serves game/ on http://localhost:8080)
//   4. node scripts/screenshot.mjs
//
// Takes the 4 shots from shots.json at 1280x720, as JPEG quality 80
// (each must stay under the 256 KiB dossier cap), into screenshots/.
// Verifies each shot's file size and prints a PASS/FAIL line per shot.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('..', import.meta.url));
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log(`CONSOLE ERROR: ${msg.text()}`);
});
page.on('pageerror', (err) => console.log(`PAGE ERROR: ${err.message}`));

let ok = true;
for (const shot of shots) {
  const url = `http://localhost:8080/index.html${shot.query}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const out = join(here, 'screenshots', shot.name);
  await page.screenshot({ path: out, type: 'jpeg', quality: 80 });
  const bytes = statSync(out).size;
  const pass = bytes <= 262144;
  if (!pass) ok = false;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${shot.name} — ${url} — ${bytes} bytes${pass ? '' : ' (over 256 KiB cap!)'}`);
}
await browser.close();
console.log(ok ? '\nAll 4 screenshots OK.' : '\nSome screenshots failed — see above.');
process.exit(ok ? 0 : 1);
