import { jdnFromKey, keyFromJdn, d2j, isFriday, isThursday } from './jalali.js';
import { getHoliday, isCoveredYear } from './holidays.js';
import { getRule } from './rules.js';

/**
 * Why is a given day non-working? Returns null for working days.
 * opts.thursdayOff: the judicial unit is closed on Thursdays (art. 444 "روز تعطیل ادارات").
 */
export function closureReason(jdn, opts = {}) {
  const key = keyFromJdn(jdn);
  const h = getHoliday(key);
  if (h) return { type: 'holiday', title: h.title, status: h.status };
  if (isFriday(jdn)) return { type: 'friday', title: 'جمعه' };
  if (opts.thursdayOff && isThursday(jdn)) return { type: 'thursday', title: 'پنجشنبه (تعطیلی واحد قضایی)' };
  return null;
}

/** First working day on or after jdn. Returns {jdn, skipped:[{jdn,reason}]} */
export function rollForward(jdn, opts = {}) {
  const skipped = [];
  let d = jdn, guard = 0;
  for (let r = closureReason(d, opts); r; r = closureReason(d, opts)) {
    skipped.push({ jdn: d, key: keyFromJdn(d), reason: r });
    d += 1;
    if (++guard > 60) throw new Error('rollForward runaway');
  }
  return { jdn: d, skipped };
}

/**
 * Compute the last valid day for an action.
 *  - art. 445 CPC: the notification day AND the action day are excluded, so for an N-day period the
 *    last valid day is notification + N + 1 (advisory opinion 7/1400/1052: 1400/4/10 + 20 days -> 1400/4/31).
 *  - art. 443 CPC: a month = 30 days, so "two months" = 60 days, "one month" = 30 days.
 *  - art. 444 CPC: if the last day is a holiday, it rolls to the next day offices are open.
 * input: { ruleId, residence: 'inside'|'abroad', notifyKey: 'YYYY-MM-DD', thursdayOff, eNoticeShift }
 */
export function computeDeadline(input) {
  const rule = getRule(input.ruleId);
  if (!rule) throw new Error('Unknown rule ' + input.ruleId);
  const opts = { thursdayOff: !!input.thursdayOff };
  const abroad = input.residence === 'abroad';
  const warnings = [];
  let days = rule.inside, basis = [rule.article];
  if (abroad) {
    if (rule.abroad == null) {
      warnings.push('برای مقیم خارج مهلت جداگانه‌ای در این ماده ذکر نشده؛ مهلت عادی محاسبه شد.');
    } else {
      days = rule.abroad;
      if (rule.abroadArticle) basis.push(rule.abroadArticle);
      basis.push('ماده ۴۴۳ ق.آ.د.م (ماه = ۳۰ روز)');
    }
  }
  const notifyJdn = jdnFromKey(input.notifyKey);
  let startJdn = notifyJdn;
  const notifyClosure = closureReason(notifyJdn, opts);
  let shiftedNotice = null;
  if (notifyClosure && input.eNoticeShift) {
    // Advisory opinion 7/1400/627: an electronic notice delivered on a holiday is deemed delivered
    // on the first following working day.
    const r = rollForward(notifyJdn, opts);
    startJdn = r.jdn;
    shiftedNotice = { from: notifyJdn, to: startJdn };
    basis.push('نظریه مشورتی ۷/۱۴۰۰/۶۲۷');
  }
  const rawLast = startJdn + days + 1; // art. 445
  const rolled = rollForward(rawLast, opts);
  if (rolled.skipped.length) basis.push('ماده ۴۴۴ ق.آ.د.م');
  basis.push('ماده ۴۴۵ ق.آ.د.م');

  const yearsTouched = new Set([d2j(startJdn).jy, d2j(rolled.jdn).jy, d2j(rawLast).jy]);
  for (const y of yearsTouched) {
    if (!isCoveredYear(y)) warnings.push(`تعطیلات رسمی سال ${y} در برنامه موجود نیست؛ فقط جمعه‌ها لحاظ شد. حتماً تقویم رسمی را بررسی کنید.`);
  }
  const usesComputed = rolled.skipped.some((s) => s.reason.status === 'computed') ||
    (d2j(rolled.jdn).jy === 1406);
  if (usesComputed) warnings.push('تعطیلات ۱۴۰۶ محاسباتی/موقت است (جدول رسمی هنوز منتشر نشده) و ممکن است مناسبت‌های قمری یک روز جابه‌جا شوند.');

  return {
    rule, days, abroad,
    notifyJdn, notifyKey: keyFromJdn(notifyJdn), notifyClosure,
    startJdn, shiftedNotice,
    rawLastJdn: rawLast, rawLastKey: keyFromJdn(rawLast),
    lastJdn: rolled.jdn, lastKey: keyFromJdn(rolled.jdn),
    skipped: rolled.skipped,
    basis: [...new Set(basis)],
    warnings,
  };
}

/** Days between today and the deadline (0 = today is the last day, negative = passed). */
export const daysRemaining = (lastJdn, todayJdn) => lastJdn - todayJdn;
export function urgency(rem) {
  if (rem < 0) return 'passed';
  if (rem <= 3) return 'red';
  if (rem <= 7) return 'amber';
  return 'green';
}
