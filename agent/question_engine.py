from __future__ import annotations

import json
import structlog
import httpx

from app.core.config import get_settings

logger = structlog.get_logger()

SYSTEM_PROMPT_TEMPLATE = """You are an expert AI technical interviewer conducting a live interview.

## Your Role
- You are interviewing a candidate for: {job_title}
- Be professional, warm, and structured
- Ask one question at a time, wait for the response
- Follow up on interesting points — dig deeper when answers are vague
- Adjust difficulty based on the candidate's responses

## Job Description
{jd_text}

## Requirements
{requirements}

## Candidate Resume
{resume_text}

## Interview Structure
1. INTRODUCTION (1 min): Greet the candidate, explain the process
2. BACKGROUND (3 min): Ask about relevant experience from their resume
3. TECHNICAL QUESTIONS (15-20 min): {max_questions} questions covering the requirements
4. SCENARIO/PROBLEM-SOLVING (5-7 min): Present a practical scenario
5. CANDIDATE QUESTIONS (2 min): Let them ask questions
6. CLOSING (1 min): Thank them, explain next steps

## Rules
- Never reveal you are an AI unless directly asked
- If asked, be honest that you are an AI interviewer
- Keep responses concise — this is a conversation, not a lecture
- Score internally but never share scores with the candidate
- If the candidate struggles, offer a simpler version of the question
- Track time — wrap up after {duration} minutes

## Output Format for Each Response
Respond conversationally. The system will handle transcription and scoring separately."""


def build_interview_system_prompt(
    job_title: str,
    jd_text: str,
    requirements: str,
    resume_text: str,
    max_questions: int = 10,
    duration: int = 30,
) -> str:
    """Build the system prompt for the AI interviewer."""
    return SYSTEM_PROMPT_TEMPLATE.format(
        job_title=job_title,
        jd_text=jd_text[:3000],
        requirements=requirements[:1500],
        resume_text=resume_text[:2000],
        max_questions=max_questions,
        duration=duration,
    )


def generate_initial_questions(
    job_title: str,
    jd_text: str,
    requirements: str,
    resume_text: str,
    count: int = 10,
) -> list[dict]:
    """Pre-generate a set of interview questions using the LLM.

    These serve as a fallback if the agent needs structured questions
    instead of purely conversational flow.
    """
    settings = get_settings()

    if not settings.llm_api_key:
        return _default_questions(job_title, count)

    prompt = f"""Generate {count} technical interview questions for: {job_title}

Job Description: {jd_text[:2000]}
Requirements: {requirements[:1000]}
Candidate Resume: {resume_text[:1500]}

For each question provide:
- question: the actual question text
- category: "technical", "behavioral", "problem_solving", or "experience"
- difficulty: "easy", "medium", or "hard"
- expected_topics: list of topics a good answer should cover

Return ONLY valid JSON array, no markdown."""

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
                "max_tokens": 2000,
                "temperature": 0.7,
            },
            timeout=30.0,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        content = content.strip().removeprefix("```json").removesuffix("```").strip()
        return json.loads(content)
    except Exception as exc:
        logger.error("question_generation_failed", error=str(exc))
        return _default_questions(job_title, count)


def _default_questions(job_title: str, count: int) -> list[dict]:
    """Fallback questions when LLM is unavailable."""
    defaults = [
        {"question": f"Tell me about your experience relevant to {job_title}.", "category": "experience", "difficulty": "easy", "expected_topics": ["relevant experience"]},
        {"question": "Walk me through a challenging technical problem you solved recently.", "category": "problem_solving", "difficulty": "medium", "expected_topics": ["problem identification", "approach", "outcome"]},
        {"question": "How do you approach learning new technologies or frameworks?", "category": "behavioral", "difficulty": "easy", "expected_topics": ["learning strategy", "adaptability"]},
        {"question": "Describe a project where you had to make significant architectural decisions.", "category": "technical", "difficulty": "hard", "expected_topics": ["trade-offs", "scalability", "maintainability"]},
        {"question": "How do you handle disagreements with team members about technical approaches?", "category": "behavioral", "difficulty": "medium", "expected_topics": ["communication", "collaboration"]},
        {"question": "What's your approach to testing and ensuring code quality?", "category": "technical", "difficulty": "medium", "expected_topics": ["testing strategy", "CI/CD", "code review"]},
        {"question": "Tell me about a time you had to optimize performance in a system.", "category": "problem_solving", "difficulty": "hard", "expected_topics": ["profiling", "bottleneck identification", "results"]},
        {"question": "How do you prioritize tasks when working on multiple features?", "category": "behavioral", "difficulty": "easy", "expected_topics": ["prioritization", "time management"]},
        {"question": "Describe your ideal development workflow from feature request to deployment.", "category": "technical", "difficulty": "medium", "expected_topics": ["SDLC", "agile", "deployment"]},
        {"question": "Do you have any questions about the role or the team?", "category": "experience", "difficulty": "easy", "expected_topics": ["engagement", "curiosity"]},
    ]
    return defaults[:count]
