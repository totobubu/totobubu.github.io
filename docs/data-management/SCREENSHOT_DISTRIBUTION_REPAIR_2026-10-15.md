# 2026-10-15 YieldMax screenshot distribution repair

## Cause

The weekly parser collected 43 amounts and zipped them with an old 43-symbol
roster before considering the tickers actually present in the image.
The October 15 table inserted MUY after MSTY, did not contain YRAM, and ended
with YBIT, YQQQ, YSPC. Equal row counts therefore concealed a changed roster.
NFLY through XYZY received a neighboring fund's amount; YSPC was also mapped
incorrectly and the YSPC amount was assigned to YRAM.

The error reproduces against the committed screenshot
`public/screenshot/YieldMax_2026-10-15.png` and the pre-repair parser.
Actions runs 38838623382 and 38892351074 accepted these values. Skipping missing
distribution dates did not validate ticker-to-amount identity.

## Data correction

The 15 existing October 15 amounts are corrected using the issuer's
[October 14 Group 2 announcement](https://www.globenewswire.com/news-release/2026/10/14/3380575/0/en/yieldmax-etfs-announces-weekly-distributions-for-group-2-etfs.html).
The complete 43-row amount map and its source are retained in
`tests/fixtures/yieldmax_2026-10-15-official.json`.

YRAM's erroneous October 15 dividend-only row is removed. Its October 14
distribution of $0.3877 is preserved, consistent with
[the official YRAM distribution history](https://yieldmaxetfs.com/our-etfs/yram/).
The October calendar mirrors the corrected records.

MUY is registered with underlying MU, YieldMax, weekly Thursday distributions,
and an explicitly marked automatic registration. Its first official event is
$0.1583 ex/record October 15, declared October 14, payable October 16.
Yahoo's rounded $0.158 remains supplemental; `amountFixed` is $0.1583.

The official fund page currently says NYSE Arca, but
[Nasdaq's listing notice](https://www.nasdaqtrader.com/TraderNews.aspx?id=ETP2026-159)
and its symbol directory identify Nasdaq Global Market and a September 29
listing. Registration uses NASDAQ and IPO date 2026-09-29. Fund inception
2026-09-23 is stored separately. CUSIP 88636Y466 is recorded from the fund
page; an unverified ISIN is not synthesized (`isinPending: true`).
Fourteen daily price rows through October 16 were obtained from Yahoo.

## Prevention

- Weekly amounts are paired with the ticker on the same OCR row; roster order
  and truncated column zipping are no longer used.
- YieldMax-only normalization handles *MUY, YQ0Q -> YQQQ, and CCVNY -> CVNY.
- Missing/ambiguous rows and conflicting duplicates are blocking diagnostics.
  Short sparse tables can recover using token coordinates only when every
  ticker/amount pairing is unique and covers the original identified rows.
- All screenshots and existing data rows are preflighted before data writes.
  Confirmed values are checked even if `expected: true` is also present.
- Diagnostics include source filename, date and OCR text. The existing
  `--skip-missing-distribution-row` flag cannot bypass mapping, extraction,
  unreadable-data, registration or confirmed-amount errors.
- The context-qualified Target 12 recovery remains separate.

## Verification

- Focused tests cover the real 43-row OCR, membership/order changes, missing
  cells, duplicate conflicts, scoped aliases, coordinate recovery, batch
  preflight, confirmed-value protection and MUY/navigation/calendar records.
- Before cleanup, all 11 stored screenshots were replayed in temporary data:
  130 rows were already applied and 3 Target 25 rows were safely recovered.
  A second replay reported all 133 rows already applied with no blockers.
  Hashes verified that all 88 original ticker files used by the replay were
  unchanged. The three Target 25 confirmations occurred only in temporary
  test data, not in the repository.
- Screenshots dated before October 15 were subsequently removed at the user's
  request. The retained inputs are Roundhill October 15/16 and YieldMax October 15.
- R2 upload, workflow dispatch, commit and push were not performed.
