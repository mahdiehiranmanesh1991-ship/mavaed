# منابع و وضعیت راستی‌آزمایی (Sources & verification)

Every rule below was checked against the article text. Pages were fetched on 1405/08/01 (2026-10-23) and copies are kept in `research/`.
Article texts come from lawlex.ir and were cross-checked against vakilik.com.

## Counting rules (قواعد احتساب) — ق.آ.د.م ۱۳۷۹
| Rule | Source |
|---|---|
| ماده ۴۴۳: a month counts as 30 days, so «دو ماه» = 60 days and «یک ماه» = 30 days | https://lawlex.ir/laws/aeen-madani/443 |
| ماده ۴۴۴: if the last day falls on an office holiday, the deadline moves to the next day offices are open | https://lawlex.ir/laws/aeen-madani/444 |
| ماده ۴۴۵: neither the ابلاغ day nor the action day counts toward the period | https://lawlex.ir/laws/aeen-madani/445 |
| ماده ۴۴۶: every deadline in the CPC is two months from ابلاغ for residents abroad | https://lawlex.ir/laws/aeen-madani/446 |
| نظریه مشورتی ۷/۱۴۰۰/۱۰۵۲ (1400/09/22): a 20-day period spans 22 days once you count the ابلاغ day and the action day. Example: ابلاغ 1400/4/10 gives a last day of 1400/4/31. **The formula used is last day = ابلاغ + N + 1, then rolled forward under ماده ۴۴۴.** | https://lawlex.ir/opinions/opinion-7-1400-1052 |
| نظریه مشورتی ۷/۱۴۰۰/۶۲۷: an electronic ابلاغ made on a holiday counts as made on the first working day after it. This is an optional toggle and is **off** by default. | https://lawlex.ir/opinions/opinion-7-1400-627 |
| Test case from the Edalatsara example: ابلاغ 25 مرداد + 20 days gives 15 شهریور | (unit test + e2e) |

## Deadlines implemented
| Action | Inside Iran | Abroad | Article | Source |
|---|---|---|---|---|
| تجدیدنظرخواهی حقوقی (civil appeal) | 20 | 60 | ۳۳۶ | lawlex aeen-madani/336 |
| واخواهی حقوقی (default-judgment objection; runs from ابلاغ واقعی) | 20 | 60 | ۳۰۶ | aeen-madani/306 |
| فرجام‌خواهی حقوقی (civil cassation) | 20 | 60 | ۳۹۷ | aeen-madani/397 |
| اعاده دادرسی حقوقی (retrial of a final contradictory ruling) | 20 | 60 | ۴۲۷ بند ۱ | aeen-madani/427 |
| رفع نقص دادخواست بدوی (cure defects in a first-instance petition) | 10 | 60 (۴۴۶) | ۵۴ | aeen-madani/54, /446 |
| شکایت از قرار رد دادخواست مدیر دفتر (complaint against the registry's rejection) | 10 | 60 (۴۴۶) | ۵۴ | aeen-madani/54, /446 |
| اعتراض به قرار رد دادخواست تجدیدنظر (objection to rejection of an appeal petition) | 20 | 60 (۴۴۶) | تبصره ۲ م ۳۳۹ | aeen-madani/339 |
| تجدیدنظر / فرجام کیفری (criminal appeal / cassation) | 20 | 60 | ۴۳۱ ق.آ.د.ک | aeen-keyfari/431 |
| واخواهی کیفری (criminal default-judgment objection; runs from ابلاغ واقعی) | 20 | 60 | ۴۰۶ ق.آ.د.ک | aeen-keyfari/406 |
| اعتراض به قرارهای قابل اعتراض بازپرس (objection to appealable investigator orders) | 10 | 30 | تبصره م ۲۷۰ ق.آ.د.ک | aeen-keyfari/270 |
| رفع نقص تجدیدنظر/فرجام کیفری (cure defects in a criminal appeal or cassation filing) | 10 | 10* | ۴۴۰ ق.آ.د.ک | aeen-keyfari/440 |

\* ماده ۴۴۰ gives no separate period for residents abroad, so the app uses 10 days and shows a warning.

**Interpretive assumption:** the Criminal Procedure Code 1392 has no counting article of its own, so the app applies CPC ۴۴۳–۴۴۵ to criminal deadlines as general rules, following court practice.

## Holidays
- **1405: VERIFIED.** All 26 rows come from the official table published by the University of Tehran Geophysics Institute Calendar Center:
  https://calendar.ut.ac.ir/documents/2139738/7092644/Holiday-1405.pdf/2d0fc5b3-4a8a-67e4-041a-a883b162ab8e?t=1761990093314
  A copy is saved at `research/Holiday-1405.pdf`.
- **1406: COMPUTED / PROVISIONAL.** No official table has been published yet.
  - Solar holidays are fixed dates.
  - Lunar holidays are derived from the official anchor 1 Shawwal 1448 = 19 Esfand 1405 and cross-checked with https://timestamp.ir/holidays-list/1406.
  - Lunar holidays may shift by ±1 day. The app shows a warning whenever a 1406 date affects a result.
- Every Friday is treated as a holiday.
- Thursdays are **not** treated as holidays unless the user turns on the per-court toggle, since art. 444 refers to «روز تعطیل ادارات».

## Deliberately NOT implemented
These were left out because the rule could not be verified, the deadline has a variable start point, or the area falls outside this app's scope:
- Deadlines that run from a variable start point:
  - اعاده دادرسی on special grounds such as forgery or discovery of a document
  - واخواهی after ابلاغ قانونی, which runs from the date of awareness
- Administrative Court of Justice (دیوان عدالت اداری) deadlines, enforcement-of-judgments deadlines, arbitration, and labour or tax tribunals.
- Thursday closures in specific provinces, sudden closures (air pollution, provincial holidays), and court-specific closures. The user has to check these.
- Any official holiday data beyond 1406. The app falls back to Fridays only and shows a warning.
