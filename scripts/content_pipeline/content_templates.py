from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from html import escape


@dataclass(frozen=True)
class ContentEvent:
    id: int
    provider_slug: str
    ticker: str
    fund_name: str | None
    distribution_per_share: str
    currency: str
    declared_date: str
    ex_date: str
    payable_date: str | None
    official_url: str
    verification_status: str
    previous_distribution: str | None = None

    @property
    def amount_display(self) -> str:
        value = Decimal(self.distribution_per_share)
        return format(value.normalize(), "f")

    @property
    def change_percent(self) -> Decimal | None:
        if not self.previous_distribution:
            return None
        previous = Decimal(self.previous_distribution)
        if previous == 0:
            return None
        return ((Decimal(self.distribution_per_share) - previous) / previous * 100).quantize(
            Decimal("0.1")
        )

    @property
    def change_label(self) -> str:
        change = self.change_percent
        if change is None:
            return "이전 기록 없음"
        if change > 0:
            return f"직전 대비 +{change}%"
        if change < 0:
            return f"직전 대비 {change}%"
        return "직전과 동일"


def toss_text(event: ContentEvent) -> str:
    payable = event.payable_date or "공식 원문 확인"
    return "\n".join(
        [
            f"📢 {event.ticker} 배당 발표",
            f"주당 ${event.amount_display} · {event.change_label}",
            f"배당락 {event.ex_date} · 지급 {payable}",
            "",
            f"{event.provider_slug.upper()} 공식 발표를 기준으로 정리했습니다.",
            "투자 판단과 세금 적용은 개인 상황에 따라 달라질 수 있습니다.",
            f"원문: {event.official_url}",
        ]
    )


def naver_markdown(event: ContentEvent) -> str:
    name = event.fund_name or event.ticker
    payable = event.payable_date or "공식 원문에서 확인 필요"
    return f"""# {event.ticker} 배당 발표: 주당 ${event.amount_display}

{event.provider_slug.upper()}가 **{name}({event.ticker})**의 배당 정보를 공식 발표했습니다.

## 핵심 일정

- 주당 배당금: **${event.amount_display} {event.currency}**
- 직전 배당 대비: **{event.change_label}**
- 선언일: **{event.declared_date}**
- 배당락일: **{event.ex_date}**
- 지급일: **{payable}**
- 검증 상태: **{event.verification_status}**

## 한 줄 해석

이번 발표는 직전 지급 기록과 비교해 `{event.change_label}`입니다. 배당금만으로 수익성을 판단하지 말고 기준가 변동, 총수익률, ROC 여부와 세금을 함께 확인하는 편이 좋습니다.

## 공식 출처

{event.official_url}

> 이 글은 공식 발표를 빠르게 정리한 정보성 콘텐츠이며 투자 권유가 아닙니다. 실제 매매 전 운용사 원문을 다시 확인하세요.
"""


def _card_html(event: ContentEvent, *, width: int, height: int, variant: str) -> str:
    amount = escape(event.amount_display)
    ticker = escape(event.ticker)
    provider = escape(event.provider_slug.upper())
    change = escape(event.change_label)
    ex_date = escape(event.ex_date)
    payable = escape(event.payable_date or "확인 필요")
    compact = variant == "blog"
    eyebrow = "OFFICIAL DISTRIBUTION" if not compact else "DIVIDEND BRIEF"
    return f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{ticker} 배당 카드</title>
<style>
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; width: {width}px; height: {height}px; overflow: hidden; }}
body {{ font-family: Pretendard, "Noto Sans KR", Arial, sans-serif; background: #081321; color: #f7f9fc; }}
.card {{ position: relative; display: grid; grid-template-rows: auto 1fr auto; width: 100%; height: 100%; padding: {round(width * .065)}px; background: radial-gradient(circle at 90% 4%, #244b68 0, transparent 34%), linear-gradient(145deg, #081321 0%, #10283b 100%); }}
.card::after {{ content: ""; position: absolute; right: -9%; bottom: -20%; width: 48%; aspect-ratio: 1; border: {max(3, round(width * .006))}px solid rgba(255,190,82,.22); border-radius: 50%; }}
.top {{ display: flex; justify-content: space-between; align-items: center; font-size: {round(width * .024)}px; font-weight: 800; letter-spacing: .12em; color: #ffbd52; }}
.provider {{ color: #b9c8d7; letter-spacing: .04em; }}
.main {{ align-self: center; }}
.ticker {{ margin: 0 0 {round(height * .025)}px; font-size: {round(width * (.13 if not compact else .095))}px; line-height: .9; letter-spacing: -.05em; }}
.label {{ margin: 0 0 {round(height * .018)}px; font-size: {round(width * .038)}px; color: #b9c8d7; }}
.amount {{ margin: 0; color: #fff; font-size: {round(width * (.12 if not compact else .092))}px; font-weight: 900; letter-spacing: -.055em; }}
.change {{ display: inline-block; margin-top: {round(height * .025)}px; padding: {round(width * .015)}px {round(width * .025)}px; border: 1px solid rgba(255,189,82,.45); border-radius: 999px; color: #ffd78f; font-size: {round(width * .025)}px; font-weight: 800; }}
.bottom {{ display: grid; grid-template-columns: 1fr 1fr; gap: {round(width * .03)}px; padding-top: {round(height * .035)}px; border-top: 1px solid rgba(255,255,255,.16); }}
.date span {{ display: block; margin-bottom: {round(height * .008)}px; color: #8fa5b7; font-size: {round(width * .019)}px; }}
.date strong {{ font-size: {round(width * .027)}px; }}
</style>
</head>
<body>
<main class="card" data-content-card>
  <header class="top"><span>{eyebrow}</span><span class="provider">{provider}</span></header>
  <section class="main"><h1 class="ticker">{ticker}</h1><p class="label">주당 배당금</p><p class="amount">${amount}</p><span class="change">{change}</span></section>
  <footer class="bottom"><div class="date"><span>배당락일</span><strong>{ex_date}</strong></div><div class="date"><span>지급일</span><strong>{payable}</strong></div></footer>
</main>
</body>
</html>"""


def social_square_html(event: ContentEvent) -> str:
    return _card_html(event, width=1080, height=1080, variant="social")


def blog_cover_html(event: ContentEvent) -> str:
    return _card_html(event, width=1200, height=630, variant="blog")
