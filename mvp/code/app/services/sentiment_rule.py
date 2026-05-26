"""VN keyword-based sentiment classifier (TAD c04 §1.1 MVP).

GUARD-08 (PRD §7.11):
- Output ∈ {POSITIVE, NEUTRAL, NEGATIVE}
- Score [-1.0, +1.0], 2 decimal places
- Reason: cite title + source + date (KHÔNG generic). "unavailable" hợp lệ ≤5% bài.

Algorithm:
1. Tokenize title+snippet (lowercase + diacritics-sensitive Vietnamese)
2. Count POS / NEG keyword hits
3. Score = (pos_hits - neg_hits) / max(pos_hits + neg_hits, 1), clamp [-1, +1]
4. Label = POS if score >= 0.2; NEG if score <= -0.2; else NEUTRAL

Phase 2 target: PhoBERT fine-tune (TAD c04 §1.1).
"""

from __future__ import annotations

from datetime import datetime
from typing import Final

# Wordlist từ corpus tin tức tài chính VN. Mở rộng dần qua quan sát.
POSITIVE_KEYWORDS: Final[tuple[str, ...]] = (
    "tăng", "lợi nhuận", "lãi", "bứt phá", "khởi sắc", "tích cực",
    "vượt kỳ vọng", "mở bán", "ký hợp đồng", "huy động", "kỷ lục",
    "đột phá", "phát triển", "mở rộng", "khả quan", "lạc quan",
    "đầu tư", "triển vọng tốt", "hoàn thành", "ra mắt", "thành công",
    "tăng trưởng", "khuyến nghị mua", "khuyến nghị nắm giữ", "hỗ trợ",
    "thuận lợi", "tăng giá", "lập đỉnh", "lãi đậm", "ngoạn mục",
    "ấn tượng", "vượt trội", "bùng nổ", "thu hút", "đẩy mạnh",
)

NEGATIVE_KEYWORDS: Final[tuple[str, ...]] = (
    "giảm", "sụt giảm", "lỗ", "thua lỗ", "phạt", "vướng mắc",
    "rủi ro", "nợ xấu", "thoái vốn", "giảm sàn", "bán mạnh",
    "khó khăn", "sụp đổ", "cảnh báo", "thận trọng", "ảm đạm",
    "lao dốc", "trượt giá", "mất giá", "khủng hoảng", "tiêu cực",
    "đình trệ", "trì hoãn", "kiện tụng", "tranh chấp", "vi phạm",
    "bồi thường", "phong tỏa", "thu hồi", "đóng cửa", "phá sản",
    "giảm điểm", "bán tháo", "đáy", "suy giảm", "căng thẳng",
    "không khả thi", "tổn thất", "thiệt hại",
)

# Negation prefix — phủ định khiến polarity bị đảo (đơn giản v1).
NEGATIONS: Final[tuple[str, ...]] = ("không", "chẳng", "chưa", "không thể")

NEUTRAL_THRESHOLD: Final[float] = 0.2


def _count_hits(text_lower: str, keywords: tuple[str, ...]) -> int:
    """Đếm số lần keyword xuất hiện. Substring match — đủ với corpus VN."""
    return sum(1 for kw in keywords if kw in text_lower)


def classify(
    title: str,
    snippet: str,
    *,
    source: str,
    published_at: datetime | None,
) -> tuple[str, float, str]:
    """Returns (label, score, reason).

    Reason format per GUARD-08: cite title + source + date — không generic.
    """
    text = f"{title} {snippet}".lower()
    pos = _count_hits(text, POSITIVE_KEYWORDS)
    neg = _count_hits(text, NEGATIVE_KEYWORDS)

    total = pos + neg
    score = 0.0 if total == 0 else (pos - neg) / total

    score = max(-1.0, min(1.0, score))
    score = round(score, 2)

    if score >= NEUTRAL_THRESHOLD:
        label = "POSITIVE"
    elif score <= -NEUTRAL_THRESHOLD:
        label = "NEGATIVE"
    else:
        label = "NEUTRAL"

    # GUARD-08: cite title + source + date
    date_str = published_at.strftime("%Y-%m-%d") if published_at else "unknown-date"
    reason = (
        f'Title "{title[:80]}{"…" if len(title) > 80 else ""}" '
        f"từ {source} ngày {date_str} "
        f"(pos={pos}, neg={neg}, score={score:.2f})"
    )

    return label, score, reason
