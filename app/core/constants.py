from __future__ import annotations

from enum import StrEnum


# ── Interview Lifecycle ──


class InterviewStatus(StrEnum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"
    FAILED = "failed"


# ── Candidate Pipeline ──


class CandidateStatus(StrEnum):
    INVITED = "invited"
    SCHEDULED = "scheduled"
    INTERVIEWED = "interviewed"
    REPORT_READY = "report_ready"
    REJECTED = "rejected"
    SHORTLISTED = "shortlisted"


# ── Job Lifecycle ──


class JobStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"


# ── Report Verdicts ──


class ReportVerdict(StrEnum):
    STRONG_YES = "strong_yes"
    YES = "yes"
    MAYBE = "maybe"
    NO = "no"
    STRONG_NO = "strong_no"


# ── Proctoring (all 8 monitored events) ──


class ProctorEventType(StrEnum):
    TAB_SWITCH = "tab_switch"
    COPY_PASTE = "copy_paste"
    RIGHT_CLICK = "right_click"
    DEVTOOLS_OPEN = "devtools_open"
    VIEW_SOURCE = "view_source"
    WINDOW_BLUR = "window_blur"
    FULLSCREEN_EXIT = "fullscreen_exit"
    WINDOW_RESIZE = "window_resize"
    FACE_NOT_DETECTED = "face_not_detected"
    MULTIPLE_FACES = "multiple_faces"
    AUDIO_ANOMALY = "audio_anomaly"


# ── Shift Options (single source of truth — used by frontend dropdown + AI prompt) ──


class ShiftOption(StrEnum):
    ANY = "any shift"
    DAY_IST = "day shift (9 AM to 6 PM IST)"
    NIGHT_US = "night shift supporting US timezone"
    NIGHT_EU = "night shift supporting EU timezone"
    ROTATIONAL = "rotational shift timings"


# ── Upload Limits ──
MAX_RESUME_SIZE_MB: int = 10
MAX_JD_SIZE_MB: int = 5
ALLOWED_RESUME_EXTENSIONS: frozenset[str] = frozenset({".pdf", ".docx", ".doc"})
ALLOWED_JD_EXTENSIONS: frozenset[str] = frozenset({".pdf", ".docx", ".doc", ".txt"})

# ── Interview Defaults ──
DEFAULT_INTERVIEW_DURATION_MINUTES: int = 30
MAX_INTERVIEW_DURATION_MINUTES: int = 60
INTERVIEW_ROOM_PREFIX: str = "geply-interview"

# ── Scheduling ──
MIN_SCHEDULE_LEAD_TIME_HOURS: int = 2
MAX_SCHEDULE_DAYS_AHEAD: int = 14
SLOT_DURATION_MINUTES: int = 45

# ── Proctoring ──
MAX_SCREENSHOTS_PER_INTERVIEW: int = 15
SCREENSHOT_QUALITY_PERCENT: int = 40

# ── AI Limits ──
CHAT_MAX_TOKENS: int = 80
CHAT_TEMPERATURE: float = 0.3
CHAT_HISTORY_WINDOW: int = 14  # 7 full exchange pairs

# ── Company (single source of truth for AI prompts) ──
COMPANY_NAME: str = "G-E-P"
