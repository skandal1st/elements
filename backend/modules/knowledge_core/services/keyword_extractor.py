"""
Извлечение ключевых слов из текста статьи (TF-based).
"""

import math
import re
from collections import Counter

# Russian + English stopwords (compact set)
_STOPWORDS = frozenset(
    # Russian
    "и в не на с что по это как он она они его её их мы вы от за из но да то же ещё"
    " бы ли уже все так ну ни при этот эта это эти тот та те того был была было были"
    " быть будет может можно надо нет есть для где тут там здесь когда тогда если"
    " только между потому через после перед более менее очень также однако".split()
    +
    # English
    "the a an and or but is was were be been being have has had do does did will"
    " would shall should may might can could not no nor for at to from by on in of"
    " with that this these those it its he she they them their we our you your"
    " what which who whom how when where why all each every both few more most some"
    " any such than too very just about also again".split()
)


def _tokenize(text: str) -> list[str]:
    """Разбивает текст на слова (буквы + цифры), переводит в lowercase."""
    return re.findall(r"[a-zA-Zа-яА-ЯёЁ0-9]{3,}", text.lower())


def extract_keywords(text: str, max_keywords: int = 15) -> list[tuple[str, float]]:
    """
    Извлекает ключевые слова из текста (TF-based).

    Returns:
        Список кортежей (keyword, relevance) отсортированных по убыванию relevance.
        relevance — нормализованный TF (0..1).
    """
    if not text or not text.strip():
        return []

    tokens = _tokenize(text)
    if not tokens:
        return []

    filtered = [t for t in tokens if t not in _STOPWORDS and len(t) >= 3]
    if not filtered:
        return []

    counter = Counter(filtered)
    max_count = counter.most_common(1)[0][1] if counter else 1

    scored: list[tuple[str, float]] = []
    for word, count in counter.most_common(max_keywords * 3):
        tf = count / max_count
        # Boost longer words slightly
        length_bonus = min(len(word) / 10, 0.3)
        score = tf + length_bonus
        scored.append((word, round(score, 4)))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:max_keywords]


def estimate_reading_time(text: str, wpm: int = 200) -> int:
    """Оценка времени чтения в минутах (минимум 1)."""
    if not text:
        return 1
    word_count = len(text.split())
    minutes = math.ceil(word_count / wpm)
    return max(1, minutes)
