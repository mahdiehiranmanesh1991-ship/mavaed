import { jdnFromKey, d2g } from './jalali.js';
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// RFC 5545 line folding at 75 octets (UTF-8 aware).
function fold(line) {
  const enc = new TextEncoder();
  const out = []; let cur = '', bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}
const gDate = (jdn) => { const g = d2g(jdn); return `${g.gy}${pad(g.gm)}${pad(g.gd)}`; };

/** Build an all-day VEVENT on the last valid day with alarms 3 days and 1 day before (09:00 local). */
export function buildICS(c, now = new Date()) {
  const day = jdnFromKey(c.lastKey);
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const summary = `آخرین مهلت: ${c.ruleTitle || ''} — ${c.title || ''}`;
  const desc = [
    c.caseNo && `شماره پرونده: ${c.caseNo}`, c.branch && `شعبه: ${c.branch}`, c.client && `موکل: ${c.client}`,
    c.notifyKey && `تاریخ ابلاغ: ${c.notifyKey.replace(/-/g, '/')}`, `آخرین روز مهلت: ${c.lastKey.replace(/-/g, '/')}`,
    c.basis && `مستند: ${c.basis}`, c.note && `یادداشت: ${c.note}`, 'محاسبه با تقویم مواعد — صحت را با قانون و تقویم رسمی کنترل کنید.',
  ].filter(Boolean).join('\n');
  const alarm = (trigger, text) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:${trigger}`, `DESCRIPTION:${esc(text)}`, 'END:VALARM'];
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mavaed PWA//FA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${c.id || stamp}@mavaed.local`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${gDate(day)}`, `DTEND;VALUE=DATE:${gDate(day + 1)}`,
    `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(desc)}`, 'TRANSP:TRANSPARENT',
    // relative to 00:00 of the event day: -P2DT15H = 09:00 three days before, -PT15H = 09:00 the day before
    ...alarm('-P2DT15H', '۳ روز تا پایان مهلت: ' + summary),
    ...alarm('-PT15H', 'فردا آخرین روز مهلت است: ' + summary),
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
