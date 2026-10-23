// Headless end-to-end check (iPhone-sized viewport). Run: PW_DIR=/tmp/pw node tests/e2e.mjs http://127.0.0.1:8765/
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire((process.env.PW_DIR || '/tmp/pw') + '/');
const { chromium } = require('playwright-core');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fa-IR', timezoneId: 'Asia/Tehran',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  acceptDownloads: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const external = [];
page.on('request', (r) => { if (!r.url().startsWith(BASE)) external.push(r.url()); });

await page.goto(BASE, { waitUntil: 'networkidle' });
check('page loads with title', (await page.title()) === 'تقویم مواعد هوشمند');
check('welcome/disclaimer shown on first run', await page.isVisible('#welcome[open]'));
await page.click('#ack');
const fontOk = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Vazirmatn'); });
check('Vazirmatn font loaded locally', fontOk);

// --- calculate: Edalatsara example 25 Mordad 1405 -> 15 Shahrivar 1405
await page.selectOption('#rule', 'civ-appeal');
await page.click('#notify-btn');
await page.fill('#typed-date', '۱۴۰۵/۰۵/۲۵');
await page.click('[data-typed]');
await page.click('#calc-btn');
await page.waitForSelector('#result-date');
const d1 = await page.textContent('#result-date');
check('calc civ-appeal 1405/05/25 → ۱۵ شهریور ۱۴۰۵', d1.includes('۱۵ شهریور ۱۴۰۵'), d1);

// --- calculate a roll-over case: notify 1405/03/23 (+11 = 4/3 Tasua) for رفع نقص → Sat 1405/04/06
await page.selectOption('#rule', 'civ-petition-defect');
await page.click('#notify-btn');
await page.fill('#typed-date', '1405/03/23');
await page.click('[data-typed]');
await page.click('#calc-btn');
await page.waitForFunction(() => document.querySelector('#result-date')?.textContent.includes('۶ تیر'));
const d2 = await page.textContent('#result-date');
check('holiday roll-over Tasua/Ashura/Friday → شنبه ۶ تیر ۱۴۰۵', d2.includes('شنبه ۶ تیر ۱۴۰۵'), d2);
check('article chips shown (۴۴۴ & ۵۴)', (await page.textContent('#result .chips')).includes('ماده ۴۴۴') && (await page.textContent('#result .chips')).includes('ماده ۵۴'));

// --- abroad, cassation with today-relative date for a nice screenshot
await page.selectOption('#rule', 'civ-appeal');
await page.click('#residence button[data-val=inside]');
await page.click('#notify-btn');
await page.click('[data-today]');
await page.click('#calc-btn');
await page.waitForTimeout(400);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: SHOTS + '01-calculator.png' });

// --- ICS download
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#ics-now')]);
const icsPath = await dl.path();
const ics = fs.readFileSync(icsPath, 'utf8');
check('.ics download has 2 alarms', (ics.match(/BEGIN:VALARM/g) || []).length === 2, dl.suggestedFilename());

// --- save cases
await page.click('#save-case');
await page.fill('#case-form [name=title]', 'تجدیدنظر — مطالبه وجه چک');
await page.fill('#case-form [name=branch]', 'شعبه ۵ دادگاه حقوقی کرمان');
await page.fill('#case-form [name=caseNo]', '140531900012345');
await page.fill('#case-form [name=client]', 'آقای الف');
await page.click('#case-form button[type=submit]');
await page.waitForSelector('.case');
await page.click('#new-case');
await page.fill('#case-form [name=title]', 'واخواهی — دعوای تخلیه');
await page.fill('#case-form [name=branch]', 'شعبه ۲ شورای حل اختلاف');
await page.fill('#case-form [name=client]', 'خانم ب');
await page.selectOption('#case-rule', 'civ-petition-defect');
await page.click('#case-notify');
// 10-day rule: notify 9 days ago -> raw last = today + 2
const nineAgo = await page.evaluate(() => {
  const d = new Date(); d.setDate(d.getDate() - 9);
  return d.toISOString().slice(0, 10);
});
await page.evaluate(async (iso) => {
  const m = await import('./js/jalali.js');
  const [y, mo, da] = iso.split('-').map(Number);
  document.querySelector('#typed-date').value = m.keyFromJdn(m.g2d(y, mo, da)).replace(/-/g, '/');
}, nineAgo);
await page.click('[data-typed]');
await page.click('#case-form button[type=submit]');
await page.waitForFunction(() => document.querySelectorAll('.case').length === 2);
const order = await page.$$eval('.case h3', (els) => els.map((e) => e.textContent));
check('cases sorted by days remaining', order[0].startsWith('واخواهی'), order.join(' | '));
check('urgent case coloured red', await page.$eval('.case', (el) => el.classList.contains('u-red-b')));
check('badge shows urgent count', await page.isVisible('#badge'));
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: SHOTS + '02-cases.png' });

// --- mark done + edit
await page.click('.case:nth-child(2) [data-act=done]');
check('mark done hides case', (await page.$$('.case')).length === 1);

// --- offline
await page.evaluate(async () => { await navigator.serviceWorker.ready; });
await page.reload({ waitUntil: 'networkidle' }); // ensure SW controls the page
check('service worker controls page', await page.evaluate(() => !!navigator.serviceWorker.controller));
await ctx.setOffline(true);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#tabbar');
check('app loads offline', (await page.title()) === 'تقویم مواعد هوشمند');
check('data persisted after offline reload', await page.evaluate(() => window.__mavaed.store.listCases().length === 2));
await page.click('#tabbar [data-tab=calc]');
await page.selectOption('#rule', 'crim-appeal');
await page.click('#notify-btn'); await page.fill('#typed-date', '1405/12/01'); await page.click('[data-typed]');
await page.click('#calc-btn');
await page.waitForSelector('#result-date');
check('calculates offline (crim appeal 1405/12/01 → شنبه ۲۲ اسفند ۱۴۰۵)', (await page.textContent('#result-date')).includes('شنبه ۲۲ اسفند ۱۴۰۵'), await page.textContent('#result-date'));
check('offline pill visible', await page.isVisible('#net-pill'));
await page.click('#notify-btn');
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '04-date-picker.png' });
await page.click('#picker [data-close]');
await page.click('#tabbar [data-tab=holidays]');
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '03-holidays-offline.png', fullPage: false });

check('no console errors', errors.length === 0, errors.join(' || '));
check('no external network requests', external.length === 0, external.join(', '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
