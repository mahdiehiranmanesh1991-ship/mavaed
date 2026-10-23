import { d2j, j2d, d2g, monthLength, weekdayIndex, keyFromJdn, jdnFromKey, todayJdn, formatLong, formatShort,
  fa, toLatinDigits, MONTHS, WEEKDAYS, isValidJalali } from './jalali.js';
import { HOLIDAYS, HOLIDAY_SOURCES, getHoliday } from './holidays.js';
import { RULES, COUNTING_RULES, getRule } from './rules.js';
import { computeDeadline, closureReason, daysRemaining, urgency } from './calc.js';
import { createStore } from './storage.js';
import { buildICS } from './ics.js';

export const APP_VERSION = '1.0.0';
const store = createStore();
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GM = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
const gregLabel = (jdn) => { const g = d2g(jdn); return `${fa(g.gd)} ${GM[g.gm - 1]} ${fa(g.gy)}`; };

const DISCLAIMER = 'این برنامه ابزار کمکی است و جایگزین بررسی شخصی قانون، رویه دادگاه و تقویم رسمی نیست. ' +
  'مهلت‌ها بر اساس متن مواد قانونی ذکرشده و تعطیلات رسمی اعلامی محاسبه می‌شود؛ تعطیلی‌های ناگهانی (آلودگی هوا، تعطیلات استانی، تعطیلی واحد قضایی و…) در آن لحاظ نشده است. ' +
  'تعطیلات ۱۴۰۶ محاسباتی است و ممکن است تغییر کند. در موارد خاص (قوانین خاص، دیوان عدالت اداری، داوری، اجرای احکام و…) مهلت متفاوت است. ' +
  'مسئولیت کنترل نهایی مهلت بر عهده کاربر است؛ همیشه یکی دو روز زودتر اقدام کنید.';

let state = { ruleId: RULES[0].id, residence: store.settings().residence || 'inside', notifyKey: null, lastResult: null };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
}
function remainingLabel(rem) {
  if (rem < 0) return `${fa(-rem)} روز گذشته`;
  if (rem === 0) return 'امروز آخرین روز است';
  if (rem === 1) return 'فردا آخرین روز است';
  return `${fa(rem)} روز مانده`;
}

/* ---------------- Tabs ---------------- */
function showTab(name) {
  $$('.view').forEach((v) => (v.hidden = v.dataset.view !== name));
  $$('#tabbar button').forEach((b) => (b.dataset.tab === name ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  if (name === 'cases') renderCases();
  if (name === 'holidays') renderHolidays();
  window.scrollTo({ top: 0 });
  history.replaceState(null, '', '#' + name);
}

/* ---------------- Segmented controls ---------------- */
function bindSeg(el, onChange) {
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', el).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    onChange(b.dataset.val);
  });
}
const setSeg = (el, val) => $$('button', el).forEach((x) => x.setAttribute('aria-checked', String(x.dataset.val === val)));

/* ---------------- Rule select ---------------- */
function fillRuleSelect(sel, selected) {
  const groups = [...new Set(RULES.map((r) => r.group))];
  sel.innerHTML = groups.map((g) => `<optgroup label="${esc(g)}">${RULES.filter((r) => r.group === g)
    .map((r) => `<option value="${r.id}" ${r.id === selected ? 'selected' : ''}>${esc(r.title)} — ${fa(r.inside)} روز</option>`).join('')}</optgroup>`).join('');
}

/* ---------------- Date picker ---------------- */
function openPicker(initialKey, onPick) {
  const dlg = $('#picker');
  const today = todayJdn();
  let sel = initialKey ? jdnFromKey(initialKey) : null;
  let view = d2j(sel ?? today);
  let vy = view.jy, vm = view.jm;
  const render = () => {
    const first = j2d(vy, vm, 1), len = monthLength(vy, vm), lead = weekdayIndex(first);
    let cells = WEEKDAYS.map((w) => `<div class="wd">${w === 'سه‌شنبه' ? 'س' : w === 'یکشنبه' ? 'ی' : w === 'دوشنبه' ? 'د' : w === 'چهارشنبه' ? 'چ' : w === 'پنجشنبه' ? 'پ' : w === 'جمعه' ? 'ج' : 'ش'}</div>`).join('');
    for (let i = 0; i < lead; i++) cells += '<span></span>';
    for (let d = 1; d <= len; d++) {
      const jdn = first + d - 1;
      const h = getHoliday(keyFromJdn(jdn));
      const off = h || weekdayIndex(jdn) === 6;
      const cls = [off && 'off', h?.status === 'computed' && 'computed', jdn === today && 'today', jdn === sel && 'sel'].filter(Boolean).join(' ');
      cells += `<button type="button" class="${cls}" data-jdn="${jdn}" title="${esc(h ? h.title : '')}" aria-label="${esc(formatLong(jdn))}${h ? ' — ' + esc(h.title) : ''}">${fa(d)}</button>`;
    }
    dlg.innerHTML = `<div class="sheet-inner">
      <div class="sheet-head"><h3>تاریخ ابلاغ</h3><button class="x" data-close aria-label="بستن">✕</button></div>
      <div class="cal-nav"><button type="button" data-nav="-1" aria-label="ماه قبل">›</button>
        <div class="title">${MONTHS[vm - 1]} ${fa(vy)}</div>
        <button type="button" data-nav="1" aria-label="ماه بعد">‹</button></div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-legend"><span><i class="l-off"></i>جمعه/تعطیل رسمی</span><span><i class="l-comp"></i>تعطیل محاسباتی</span><span><i class="l-today"></i>امروز</span></div>
      <div class="typed"><input type="text" inputmode="numeric" id="typed-date" placeholder="۱۴۰۵/۰۸/۰۱" aria-label="ورود دستی تاریخ" value="${sel ? formatShort(sel) : ''}">
        <button type="button" class="btn small" data-typed>تأیید</button><button type="button" class="btn small ghost" data-today>امروز</button></div>
    </div>`;
  };
  const pick = (jdn) => { onPick(keyFromJdn(jdn)); dlg.close(); };
  dlg.onclick = (e) => {
    if (e.target === dlg) return dlg.close();
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.close !== undefined) return dlg.close();
    if (t.dataset.nav) { vm += +t.dataset.nav; if (vm < 1) { vm = 12; vy--; } if (vm > 12) { vm = 1; vy++; } return render(); }
    if (t.dataset.today !== undefined) return pick(today);
    if (t.dataset.typed !== undefined) {
      const m = /^(\d{4})\D(\d{1,2})\D(\d{1,2})$/.exec(toLatinDigits($('#typed-date', dlg).value.trim()));
      if (!m || !isValidJalali(+m[1], +m[2], +m[3])) return toast('تاریخ نامعتبر است (مثال: ۱۴۰۵/۰۸/۰۱)');
      return pick(j2d(+m[1], +m[2], +m[3]));
    }
    if (t.dataset.jdn) pick(+t.dataset.jdn);
  };
  render();
  dlg.showModal();
}

/* ---------------- Calculator ---------------- */
function setNotify(key) {
  state.notifyKey = key;
  const b = $('#notify-btn');
  b.classList.toggle('empty', !key);
  $('#notify-label').textContent = key ? formatLong(jdnFromKey(key)) : 'انتخاب تاریخ';
}
function calcInput() {
  return { ruleId: state.ruleId, residence: state.residence, notifyKey: state.notifyKey,
    thursdayOff: $('#thursday-off').checked, eNoticeShift: $('#enotice-shift').checked };
}
function renderResult(r) {
  const today = todayJdn(), rem = daysRemaining(r.lastJdn, today), u = urgency(rem);
  const steps = [];
  steps.push(`تاریخ ابلاغ: <b>${formatLong(r.notifyJdn)}</b>${r.notifyClosure ? ` <small>(${esc(r.notifyClosure.title)})</small>` : ''}`);
  if (r.shiftedNotice) steps.push(`ابلاغ الکترونیکی در روز تعطیل ← روز کاری بعد (${formatLong(r.startJdn)}) مبدأ محاسبه شد.`);
  steps.push(`مدت مهلت: <b>${fa(r.days)} روز</b>${r.abroad && r.rule.abroad ? ' (مقیم خارج)' : ''}؛ روز ابلاغ و روز اقدام شمرده نمی‌شوند (ماده ۴۴۵).`);
  steps.push(`آخرین روز پیش از اعمال تعطیلات: ${formatLong(r.rawLastJdn)}`);
  for (const s of r.skipped) steps.push(`${formatLong(s.jdn)} تعطیل است (${esc(s.reason.title)}${s.reason.status === 'computed' ? ' — محاسباتی' : ''}) ← یک روز تمدید (ماده ۴۴۴)`);
  const hintHoliday = r.notifyClosure && !r.shiftedNotice
    ? `<div class="info">روز ابلاغ تعطیل است. اگر ابلاغ <b>الکترونیکی</b> بوده، طبق نظریه مشورتی ۷/۱۴۰۰/۶۲۷ ابلاغ در اولین روز کاری بعد محقق می‌شود؛ می‌توانید گزینه مربوط را در «تنظیمات احتیاطی» فعال کنید. نتیجه فعلی محتاطانه است.</div>` : '';
  $('#result').innerHTML = `<article class="card result">
    <div class="result-head"><div class="lbl">آخرین روز مهلت — ${esc(r.rule.title)}</div>
      <div class="date" id="result-date">${formatLong(r.lastJdn)}</div>
      <div class="greg">${gregLabel(r.lastJdn)}</div>
      <span class="countdown u-${u}">${remainingLabel(rem)}</span></div>
    <div class="result-body">
      <div class="chips">${r.basis.map((b) => `<span class="chip">${esc(b)}</span>`).join('')}</div>
      ${r.warnings.map((w) => `<div class="warn">⚠️ ${esc(w)}</div>`).join('')}
      ${hintHoliday}
      <ul class="steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ul>
      <details><summary>متن ${esc(r.rule.article)} — مبدأ: ${esc(r.rule.start)}</summary>
        <blockquote>${esc(r.rule.text)}</blockquote>
        ${r.rule.note ? `<div class="info">${esc(r.rule.note)}</div>` : ''}
        <div class="src">منبع: ${r.rule.sources.map((s) => `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">${esc(s)}</a>`).join('<br>')}</div>
      </details>
      <div class="btn-row mt"></div>
    </div></article>`;
  const row = $('#result .btn-row');
  row.innerHTML = `<button class="btn gold" id="save-case">ذخیره در پرونده‌ها</button><button class="btn" id="ics-now">افزودن به تقویم</button>`;
  $('#save-case').onclick = () => openCaseDialog(null, r);
  $('#ics-now').onclick = () => downloadICS(caseFromResult(r, { title: r.rule.title }));
}
function onCalc(e) {
  e?.preventDefault();
  if (!state.notifyKey) { toast('ابتدا تاریخ ابلاغ را انتخاب کنید'); openPicker(null, (k) => { setNotify(k); onCalc(); }); return; }
  try {
    const r = computeDeadline(calcInput());
    state.lastResult = r;
    renderResult(r);
    $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) { toast('خطا: ' + err.message); }
}

/* ---------------- Cases ---------------- */
function caseFromResult(r, fields = {}) {
  return { ...fields, ruleId: r.rule.id, ruleTitle: r.rule.title, residence: r.abroad ? 'abroad' : 'inside',
    notifyKey: r.notifyKey, lastKey: r.lastKey, basis: r.basis.join('، '), warnings: r.warnings,
    thursdayOff: !!calcInput().thursdayOff, eNoticeShift: !!calcInput().eNoticeShift };
}
function openCaseDialog(existing, result) {
  const dlg = $('#case-dialog');
  const c = existing || {};
  const ruleId = c.ruleId || result?.rule.id || state.ruleId;
  const notifyKey = c.notifyKey || result?.notifyKey || state.notifyKey || keyFromJdn(todayJdn());
  const residence = c.residence || (result ? (result.abroad ? 'abroad' : 'inside') : state.residence);
  let nk = notifyKey;
  dlg.innerHTML = `<form class="sheet-inner" id="case-form" novalidate>
    <div class="sheet-head"><h3>${existing ? 'ویرایش پرونده' : 'پرونده جدید'}</h3><button type="button" class="x" data-close aria-label="بستن">✕</button></div>
    <label class="field"><span>عنوان *</span><input type="text" name="title" required maxlength="120" value="${esc(c.title || '')}" placeholder="مثلاً: تجدیدنظر — مطالبه وجه"></label>
    <label class="field"><span>شعبه</span><input type="text" name="branch" maxlength="80" value="${esc(c.branch || '')}" placeholder="شعبه ۳ دادگاه حقوقی کرمان"></label>
    <label class="field"><span>شماره پرونده</span><input type="text" name="caseNo" maxlength="40" inputmode="numeric" value="${esc(c.caseNo || '')}"></label>
    <label class="field"><span>موکل</span><input type="text" name="client" maxlength="80" value="${esc(c.client || '')}"></label>
    <label class="field"><span>نوع اقدام</span><select name="ruleId" id="case-rule"></select></label>
    <div class="field"><span>محل اقامت</span><div class="seg" id="case-res"><button type="button" data-val="inside">مقیم ایران</button><button type="button" data-val="abroad">مقیم خارج</button></div></div>
    <div class="field"><span>تاریخ ابلاغ</span><button type="button" class="date-btn" id="case-notify"></button></div>
    <label class="field"><span>یادداشت</span><textarea name="note" maxlength="1000">${esc(c.note || '')}</textarea></label>
    <div class="info" id="case-preview"></div>
    <div class="btn-row"><button class="btn primary" type="submit">ذخیره</button><button class="btn ghost" type="button" data-close>انصراف</button></div>
  </form>`;
  fillRuleSelect($('#case-rule', dlg), ruleId);
  let res = residence;
  setSeg($('#case-res', dlg), res);
  const opts = () => ({ thursdayOff: c.thursdayOff ?? $('#thursday-off').checked, eNoticeShift: c.eNoticeShift ?? $('#enotice-shift').checked });
  const preview = () => {
    $('#case-notify', dlg).textContent = formatLong(jdnFromKey(nk));
    const r = computeDeadline({ ruleId: $('#case-rule', dlg).value, residence: res, notifyKey: nk, ...opts() });
    $('#case-preview', dlg).innerHTML = `آخرین روز مهلت: <b>${formatLong(r.lastJdn)}</b><br><small>${esc(r.basis.join('، '))}</small>`;
    return r;
  };
  bindSeg($('#case-res', dlg), (v) => { res = v; preview(); });
  $('#case-rule', dlg).onchange = preview;
  // the picker is a second modal stacked on top of this one
  $('#case-notify', dlg).onclick = () => openPicker(nk, (k) => { nk = k; preview(); });
  dlg.onclick = (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); };
  $('#case-form', dlg).onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const title = String(f.get('title') || '').trim();
    if (!title) { toast('عنوان پرونده را وارد کنید'); return; }
    const r = preview();
    const data = { title, branch: String(f.get('branch') || '').trim(), caseNo: String(f.get('caseNo') || '').trim(),
      client: String(f.get('client') || '').trim(), note: String(f.get('note') || '').trim(), ...opts() };
    const full = { ...caseFromResult(r, data), ...opts() };
    if (existing) store.updateCase(existing.id, full); else store.addCase(full);
    dlg.close();
    toast(existing ? 'پرونده به‌روزرسانی شد' : 'پرونده ذخیره شد');
    updateBadge();
    if (!existing) showTab('cases'); else renderCases();
  };
  preview();
  dlg.showModal();
}
function sortedCases() {
  const t = todayJdn();
  return store.listCases().map((c) => ({ ...c, rem: daysRemaining(jdnFromKey(c.lastKey), t) }))
    .sort((a, b) => (a.done - b.done) || (a.rem - b.rem));
}
function renderCases() {
  const showDone = $('#show-done').checked;
  const list = sortedCases().filter((c) => showDone || !c.done);
  const el = $('#case-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M10 4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>
      <p>هنوز پرونده‌ای ثبت نشده است.<br>از تب «محاسبه» یک مهلت را محاسبه و ذخیره کنید.</p></div>`;
    return;
  }
  el.innerHTML = list.map((c) => {
    const u = c.done ? 'passed' : urgency(c.rem);
    return `<article class="card case u-${u}-b ${c.done ? 'done' : ''}" data-id="${esc(c.id)}">
      <div class="case-top"><div>
        <h3>${esc(c.title)}</h3>
        <div class="meta">${[c.ruleTitle, c.branch, c.caseNo && 'پرونده ' + fa(c.caseNo), c.client && 'موکل: ' + c.client].filter(Boolean).map(esc).join(' · ')}</div>
        <div class="deadline">آخرین مهلت: ${formatLong(jdnFromKey(c.lastKey))}</div>
        <div class="meta">ابلاغ: ${formatShort(jdnFromKey(c.notifyKey))} · ${esc(c.basis || '')}</div>
        ${c.note ? `<div class="meta">📝 ${esc(c.note)}</div>` : ''}
      </div>
      <div class="big u-${u}">${c.done ? '<b>✓</b><small>انجام شد</small>' : c.rem >= 0 ? `<b>${fa(c.rem)}</b><small>${c.rem === 0 ? 'امروز!' : 'روز مانده'}</small>` : `<b>${fa(-c.rem)}</b><small>روز گذشته</small>`}</div></div>
      <div class="actions">
        <button class="btn" data-act="done">${c.done ? 'بازگردانی' : 'انجام شد ✓'}</button>
        <button class="btn" data-act="ics">تقویم</button>
        <button class="btn" data-act="edit">ویرایش</button>
        <button class="btn danger" data-act="del">حذف</button>
      </div></article>`;
  }).join('');
}
function onCaseAction(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.closest('.case').dataset.id;
  const c = store.listCases().find((x) => x.id === id); if (!c) return;
  if (b.dataset.act === 'done') { store.updateCase(id, { done: !c.done }); renderCases(); updateBadge(); }
  if (b.dataset.act === 'ics') downloadICS(c);
  if (b.dataset.act === 'edit') openCaseDialog(c);
  if (b.dataset.act === 'del' && confirm(`پرونده «${c.title}» حذف شود؟`)) { store.deleteCase(id); renderCases(); updateBadge(); toast('حذف شد'); }
}
function updateBadge() {
  const n = sortedCases().filter((c) => !c.done && c.rem >= 0 && c.rem <= 3).length;
  const b = $('#badge'); b.hidden = !n; b.textContent = fa(n);
}

/* ---------------- Files (ICS / JSON) ---------------- */
async function saveFile(name, text, type) {
  const blob = new Blob([text], { type });
  const file = typeof File === 'function' ? new File([blob], name, { type }) : null;
  // iOS standalone mode handles the share sheet better than downloads.
  if (file && navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function downloadICS(c) {
  const safe = (c.caseNo || c.lastKey).replace(/[^\w\-]+/g, '_');
  saveFile(`mohlat-${safe}.ics`, buildICS(c), 'text/calendar;charset=utf-8');
  toast('فایل تقویم آماده شد — یادآور ۳ روز و ۱ روز قبل');
}

/* ---------------- Holidays view ---------------- */
let holYear = 1405;
function renderHolidays() {
  const src = HOLIDAY_SOURCES[holYear];
  const t = todayJdn();
  $('#hol-source').innerHTML = `<div class="${src.status === 'verified' ? 'info' : 'warn'}">
    ${src.status === 'verified' ? '✅ رسمی و تأییدشده' : '⚠️ محاسباتی / موقت'} — ${esc(src.title)}<br>
    <a class="src" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">مشاهده منبع</a> · جمعه‌ها همیشه تعطیل محسوب می‌شوند.</div>`;
  $('#hol-list').innerHTML = HOLIDAYS.filter((h) => h.date.startsWith(String(holYear))).map((h) => {
    const j = jdnFromKey(h.date);
    return `<li class="${j < t ? 'past' : ''}"><span class="d">${fa(d2j(j).jd)} ${MONTHS[d2j(j).jm - 1]}<span class="wd">${WEEKDAYS[weekdayIndex(j)]}</span></span>
      <span class="t">${esc(h.title)}</span><span class="badge-s ${h.status}">${h.status === 'verified' ? 'رسمی' : 'محاسباتی'}</span></li>`;
  }).join('');
}

/* ---------------- Info view ---------------- */
function renderInfo() {
  $('#counting-rules').innerHTML = COUNTING_RULES.map((r) => `<li><b>${esc(r.article)}:</b> ${esc(r.text)} <a class="src" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">منبع</a></li>`).join('') +
    '<li><b>آیین دادرسی کیفری:</b> قانون ۱۳۹۲ ماده خاصی درباره نحوه شمارش مواعد ندارد؛ برنامه همان قواعد مواد ۴۴۳ تا ۴۴۵ ق.آ.د.م را (طبق رویه) اعمال می‌کند.</li>';
  $('#all-rules').innerHTML = RULES.map((r) => `<li><b>${esc(r.title)}</b> — ${fa(r.inside)} روز${r.abroad ? ` / مقیم خارج ${fa(r.abroad)} روز` : ''} · ${esc(r.article)}${r.abroadArticle ? ' و ' + esc(r.abroadArticle) : ''} · ${esc(r.start)}</li>`).join('');
  $('#disclaimer-text').textContent = DISCLAIMER;
  $('#app-ver').textContent = fa(APP_VERSION);
}

/* ---------------- Backup ---------------- */
function exportJSON() {
  saveFile(`mavaed-backup-${keyFromJdn(todayJdn())}.json`, store.exportJSON(), 'application/json');
  toast('فایل پشتیبان ساخته شد');
}
async function importJSON(e) {
  const f = e.target.files[0]; if (!f) return;
  try {
    const text = await f.text();
    const merge = store.listCases().length > 0 && confirm('پرونده‌های فعلی حفظ شوند و موارد فایل به آن‌ها اضافه شوند؟\n(«لغو» = جایگزینی کامل)');
    const n = store.importJSON(text, { merge });
    toast(`${fa(n)} پرونده بازیابی شد`);
    updateBadge(); applySettings();
  } catch (err) { toast('خطا در بازیابی: ' + err.message); }
  e.target.value = '';
}

/* ---------------- Welcome / disclaimer ---------------- */
function maybeWelcome() {
  if (localStorage.getItem('mavaed.ack') === '1') return;
  const d = $('#welcome');
  d.innerHTML = `<div class="sheet-inner"><h3>به تقویم مواعد خوش آمدید</h3>
    <p>محاسبه آخرین مهلت قانونی بر اساس مواد ۴۴۳ تا ۴۴۶ قانون آیین دادرسی مدنی و تعطیلات رسمی. همه اطلاعات فقط روی همین دستگاه می‌ماند.</p>
    <div class="info">${esc(DISCLAIMER)}</div>
    <button class="btn primary block" id="ack">متوجه شدم</button></div>`;
  d.showModal();
  $('#ack').onclick = () => { localStorage.setItem('mavaed.ack', '1'); d.close(); };
}

function applySettings() {
  const s = store.settings();
  $('#thursday-off').checked = !!s.thursdayOff;
  $('#enotice-shift').checked = !!s.eNoticeShift;
  state.residence = s.residence || 'inside';
  setSeg($('#residence'), state.residence);
}
function updateNet() { $('#net-pill').hidden = navigator.onLine; }

/* ---------------- Init ---------------- */
function init() {
  $('#today-label').textContent = 'امروز ' + formatLong(todayJdn());
  fillRuleSelect($('#rule'), state.ruleId);
  $('#rule').onchange = (e) => { state.ruleId = e.target.value; if (state.lastResult) onCalc(); };
  bindSeg($('#residence'), (v) => { state.residence = v; store.setSetting('residence', v); if (state.lastResult) onCalc(); });
  bindSeg($('#hol-year'), (v) => { holYear = +v; renderHolidays(); });
  $('#notify-btn').onclick = () => openPicker(state.notifyKey, setNotify);
  $('#calc-form').onsubmit = onCalc;
  $('#thursday-off').onchange = (e) => { store.setSetting('thursdayOff', e.target.checked); if (state.lastResult) onCalc(); };
  $('#enotice-shift').onchange = (e) => { store.setSetting('eNoticeShift', e.target.checked); if (state.lastResult) onCalc(); };
  $('#tabbar').onclick = (e) => { const b = e.target.closest('button'); if (b) showTab(b.dataset.tab); };
  $('#case-list').onclick = onCaseAction;
  $('#show-done').onchange = renderCases;
  $('#new-case').onclick = () => openCaseDialog(null, null);
  $('#export-json').onclick = exportJSON;
  $('#import-json').onchange = importJSON;
  addEventListener('online', updateNet); addEventListener('offline', updateNet);
  applySettings(); setNotify(null); renderInfo(); updateBadge(); updateNet();
  const tab = location.hash.slice(1);
  showTab(['calc', 'cases', 'holidays', 'more'].includes(tab) ? tab : 'calc');
  maybeWelcome();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  window.__mavaed = { store, computeDeadline }; // for automated tests
}
init();
