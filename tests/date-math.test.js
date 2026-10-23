import test from 'node:test';
import assert from 'node:assert/strict';
import { j2d, d2j, g2d, d2g, jdnFromKey, keyFromJdn, isLeapJalali, monthLength, weekdayIndex, isValidJalali } from '../js/jalali.js';
import { computeDeadline, closureReason, rollForward, urgency } from '../js/calc.js';
import { HOLIDAYS } from '../js/holidays.js';
import { RULES } from '../js/rules.js';
import { createStore } from '../js/storage.js';
import { buildICS } from '../js/ics.js';

const G = (y, m, d) => g2d(y, m, d);
const calc = (ruleId, notifyKey, extra = {}) => computeDeadline({ ruleId, notifyKey, residence: 'inside', ...extra });

test('Jalali <-> Gregorian anchors', () => {
  assert.equal(j2d(1405, 1, 1), G(2026, 3, 21));   // Nowruz 1405 = Sat 21 Mar 2026
  assert.equal(j2d(1406, 1, 1), G(2027, 3, 21));   // Nowruz 1406 = Sun 21 Mar 2027
  assert.equal(j2d(1404, 1, 1), G(2025, 3, 21));
  assert.equal(j2d(1403, 12, 30), G(2025, 3, 20)); // 1403 is leap
  assert.equal(j2d(1357, 11, 22), G(1979, 2, 11)); // 22 Bahman 1357
  assert.deepEqual(d2j(G(2026, 10, 23)), { jy: 1405, jm: 8, jd: 1 }); // today 1 Aban 1405
  assert.deepEqual(d2g(j2d(1405, 6, 31)), { gy: 2026, gm: 9, gd: 22 });
});

test('round-trip every day 1400..1410', () => {
  for (let d = j2d(1400, 1, 1); d < j2d(1411, 1, 1); d++) {
    const j = d2j(d);
    assert.equal(j2d(j.jy, j.jm, j.jd), d);
    assert.ok(isValidJalali(j.jy, j.jm, j.jd));
  }
});

test('leap years and month lengths', () => {
  assert.equal(isLeapJalali(1403), true);
  assert.equal(isLeapJalali(1404), false);
  assert.equal(isLeapJalali(1405), false);
  assert.equal(isLeapJalali(1406), false);
  assert.equal(isLeapJalali(1408), true);
  assert.equal(monthLength(1405, 6), 31);
  assert.equal(monthLength(1405, 7), 30);
  assert.equal(monthLength(1406, 12), 29);
  assert.throws(() => jdnFromKey('1406-12-30'));
});

test('weekdays match the official holiday table', () => {
  const wd = (k) => weekdayIndex(jdnFromKey(k)); // 0=Sat .. 6=Fri
  assert.equal(wd('1405-01-01'), 0); // شنبه
  assert.equal(wd('1405-03-15'), 6); // جمعه
  assert.equal(wd('1405-08-22'), 6); // جمعه
  assert.equal(wd('1405-11-22'), 5); // پنجشنبه
  assert.equal(wd('1405-12-29'), 0); // شنبه
  assert.equal(wd('1406-01-01'), 1); // یکشنبه
});

test('holiday dataset sanity', () => {
  const v = HOLIDAYS.filter((h) => h.status === 'verified');
  assert.equal(v.length, 26); // official 1405 table has 26 rows
  for (const h of HOLIDAYS) assert.doesNotThrow(() => jdnFromKey(h.date), h.date);
  assert.equal(new Set(HOLIDAYS.map((h) => h.date)).size, HOLIDAYS.length);
  assert.ok(HOLIDAYS.filter((h) => h.date.startsWith('1406')).every((h) => h.status === 'computed'));
});

test('art. 445: advisory opinion 7/1400/1052 — 1400/4/10 + 20 days => 1400/4/31', () => {
  const r = calc('civ-appeal', '1400-04-10');
  assert.equal(r.rawLastKey, '1400-04-31');
});

test('Edalatsara example: 25 Mordad 1405 + 20 days => 15 Shahrivar 1405', () => {
  const r = calc('civ-appeal', '1405-05-25');
  assert.equal(r.lastKey, '1405-06-15');
  assert.equal(r.skipped.length, 0);
});

test('every rule: inside / abroad durations', () => {
  const n = '1405-08-03'; // Sat
  const base = jdnFromKey(n);
  for (const rule of RULES) {
    const r = calc(rule.id, n);
    assert.equal(r.days, rule.inside, rule.id);
    assert.ok(r.lastJdn >= base + rule.inside + 1, rule.id);
    assert.ok(r.basis.includes(rule.article), rule.id);
    const a = calc(rule.id, n, { residence: 'abroad' });
    assert.equal(a.days, rule.abroad ?? rule.inside, rule.id + ' abroad');
    if (rule.abroad == null) assert.ok(a.warnings.length > 0);
  }
});

test('specific rule values', () => {
  const k = (id, res = 'inside') => calc(id, '1405-08-03', { residence: res });
  assert.equal(k('civ-appeal').rawLastKey, '1405-08-24');           // +21
  assert.equal(k('civ-petition-defect').rawLastKey, '1405-08-14');  // +11
  assert.equal(k('civ-reject-complaint').days, 10);
  assert.equal(k('civ-appeal-reject-objection').days, 20);
  assert.equal(k('crim-order-objection', 'abroad').days, 30);       // "one month" = 30 days (art. 443)
  assert.equal(k('civ-cassation', 'abroad').days, 60);              // "two months" = 60 days (art. 443)
  assert.equal(k('civ-petition-defect', 'abroad').days, 60);        // art. 446
});

test('art. 444: deadline on Friday rolls to Saturday', () => {
  // 1405-08-01 is Friday? find a notification so that +21 lands on a Friday
  const fri = jdnFromKey('1405-09-06'); assert.equal(weekdayIndex(fri), 6);
  const r = computeDeadline({ ruleId: 'civ-appeal', residence: 'inside', notifyKey: keyFromJdn(fri - 21) });
  assert.equal(r.rawLastKey, '1405-09-06');
  assert.equal(r.lastKey, '1405-09-07');
  assert.equal(r.skipped[0].reason.type, 'friday');
});

test('art. 444: chained holidays — Tasua/Ashura (Wed/Thu) + Friday => Saturday 1405-04-06', () => {
  const r = computeDeadline({ ruleId: 'civ-petition-defect', residence: 'inside', notifyKey: keyFromJdn(jdnFromKey('1405-04-03') - 11) });
  assert.equal(r.rawLastKey, '1405-04-03');
  assert.equal(r.lastKey, '1405-04-06');
  assert.deepEqual(r.skipped.map((s) => s.key), ['1405-04-03', '1405-04-04', '1405-04-05']);
});

test('art. 444: Nowruz chain into 1405', () => {
  const r = rollForward(jdnFromKey('1405-01-01'));
  assert.equal(keyFromJdn(r.jdn), '1405-01-05'); // Wed 5 Farvardin
});

test('Fitr 1448 + Friday: 19-20 Esfand 1405 (Wed/Thu) roll to Sat 22 Esfand', () => {
  assert.equal(keyFromJdn(rollForward(jdnFromKey('1405-12-19')).jdn), '1405-12-22');
});

test('Thursday toggle', () => {
  const thu = jdnFromKey('1405-08-07'); assert.equal(weekdayIndex(thu), 5);
  assert.equal(closureReason(thu), null);
  assert.equal(closureReason(thu, { thursdayOff: true }).type, 'thursday');
  const r = computeDeadline({ ruleId: 'civ-appeal', residence: 'inside', notifyKey: keyFromJdn(thu - 21), thursdayOff: true });
  assert.equal(r.lastKey, '1405-08-09'); // Thu, Fri skipped -> Sat
});

test('electronic notice on holiday (opinion 7/1400/627) shifts start only when enabled', () => {
  const off = calc('civ-appeal', '1405-01-25');             // Tuesday holiday (Imam Sadiq)
  assert.equal(off.startJdn, off.notifyJdn);
  assert.ok(off.notifyClosure);
  const on = calc('civ-appeal', '1405-01-25', { eNoticeShift: true });
  assert.equal(keyFromJdn(on.startJdn), '1405-01-26');
  assert.ok(on.lastJdn > off.lastJdn);
});

test('warnings: 1406 provisional and uncovered years', () => {
  assert.ok(calc('civ-appeal', '1406-02-01').warnings.some((w) => w.includes('۱۴۰۶')));
  assert.ok(calc('civ-appeal', '1407-02-01').warnings.some((w) => w.includes('1407')));
  assert.equal(calc('civ-appeal', '1405-05-25').warnings.length, 0);
});

test('1406 computed holiday roll (Tasua/Ashura 1406-03-24/25)', () => {
  const r = rollForward(jdnFromKey('1406-03-24'));
  assert.ok(r.skipped.every((s) => s.reason.type !== 'holiday' || s.reason.status === 'computed'));
  assert.ok(r.jdn > jdnFromKey('1406-03-25'));
});

test('urgency colours', () => {
  assert.equal(urgency(-1), 'passed');
  assert.equal(urgency(0), 'red');
  assert.equal(urgency(3), 'red');
  assert.equal(urgency(4), 'amber');
  assert.equal(urgency(8), 'green');
});

test('storage: CRUD + JSON export/import round-trip', () => {
  const mem = new Map();
  const backend = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const s = createStore(backend);
  const c = s.addCase({ title: 'الف', lastKey: '1405-08-24' });
  s.updateCase(c.id, { done: true });
  const json = s.exportJSON();
  s.deleteCase(c.id);
  assert.equal(s.listCases().length, 0);
  assert.equal(s.importJSON(json), 1);
  assert.equal(s.listCases()[0].done, true);
  assert.throws(() => s.importJSON('{"x":1}'));
  assert.equal(createStore(backend).listCases().length, 1); // persisted
});

test('ics: all-day event, two alarms, Gregorian date', () => {
  const ics = buildICS({ id: 'x1', title: 'پرونده', ruleTitle: 'تجدیدنظر', lastKey: '1405-06-15', notifyKey: '1405-05-25' }, new Date('2026-10-23T05:00:00Z'));
  assert.match(ics, /DTSTART;VALUE=DATE:20260906/);
  assert.match(ics, /DTEND;VALUE=DATE:20260907/);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 2);
  assert.match(ics, /TRIGGER:-P2DT15H/);
  assert.match(ics, /TRIGGER:-PT15H/);
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75);
});
