from __future__ import annotations

import json
import structlog
import httpx

from app.core.config import get_settings

logger = structlog.get_logger()


def score_answer(
    question: str,
    answer: str,
    job_context: str,
    expected_topics: list[str] | None = None,
) -> dict:
    """Score a single Q&A pair using the LLM.

    Returns: {score: float (0-10), feedback: str, topics_covered: list}
    """
    settings = get_settings()

    if not settings.llm_api_key:
        return {"score": 5.0, "feedback": "Scoring unavailable", "topics_covered": []}

    prompt = f"""Score this interview answer on a scale of 0-10.

Question: {question}
Answer: {answer}
Job Context: {job_context[:500]}
Expected Topics: {', '.join(expected_topics or ['general competence'])}

Return JSON with:
- score: number 0-10
- feedback: brief assessment (1-2 sentences)
- topics_covered: list of topics the candidate addressed

ONLY valid JSON, no markdown."""

    try:
        response = httpx.post(
            f"{settings.llm_base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.llm_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.llm_model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 300,
                "temperature": 0.2,
            },
            timeout=15.0,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        content = content.strip().removeprefix("```json").removesuffix("```").strip()
        return json.loads(content)
    except Exception as exc:
        logger.error("scoring_failed", error=str(exc))
        return {"score": 5.0, "feedback": "Scoring error", "topics_covered": []}


def compute_final_scores(qa_pairs: list[dict]) -> dict:
    """Compute aggregate scores from individual Q&A scores.

    qa_pairs: list of {question, answer, score, category, ...}
    Returns: {overall, technical, communication, problem_solving}
    """
    if not qa_pairs:
        return {
            "overall": 0.0,
            "technical": 0.0,
            "communication": 0.0,
            "problem_solving": 0.0,
        }

    category_scores: dict[str, list[float]] = {
        "technical": [],
        "behavioral": [],
        "problem_solving": [],
        "experience": [],
    }

    for pair in qa_pairs:
        score = pair.get("score", 0.0)
        category = pair.get("category", "technical")
        if category in category_scores:
            category_scores[category].append(score)
        else:
            category_scores["technical"].append(score)

    def avg(scores: list[float]) -> float:
        return round(sum(scores) / len(scores) * 10, 1) if scores else 0.0

    technical = avg(category_scores["technical"])
    communication = avg(category_scores["behavioral"] + category_scores["experience"])
    problem_solving = avg(category_scores["problem_solving"])

    # Weighted overall: 40% technical, 30% communication, 30% problem solving
    all_scores = [s for scores in category_scores.values() for s in scores]
    overall = round(sum(all_scores) / len(all_scores) * 10, 1) if all_scores else 0.0

    return {
        "overall": min(overall, 100.0),
        "technical": min(technical, 100.0),
        "communication": min(communication, 100.0),
        "problem_solving": min(problem_solving, 100.0),
    }
