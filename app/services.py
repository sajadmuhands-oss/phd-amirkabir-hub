from __future__ import annotations

import re
import uuid
from datetime import date, datetime
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from .database import UPLOADS_DIR
from .models import ResidenceStay, StudentProfile, ThesisChapter

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".txt",
    ".md",
    ".csv",
    ".zip",
    ".rar",
    ".7z",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".tif",
    ".tiff",
    ".odt",
    ".odp",
    ".ods",
    ".bib",
    ".ris",
    ".epub",
}

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    value = value.strip()
    if not value:
        return None
    return date.fromisoformat(value)


def format_bytes(size: int) -> str:
    if size < 1024:
        return f"{size} ب"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f} ك.ب"
    return f"{size / (1024 * 1024):.1f} م.ب"


def safe_filename(name: str) -> str:
    stem = Path(name).stem
    suffix = Path(name).suffix.lower()
    cleaned = re.sub(r"[^\w\u0600-\u06FF\-]+", "_", stem, flags=re.UNICODE).strip("_")
    cleaned = cleaned[:80] or "file"
    return f"{cleaned}_{uuid.uuid4().hex[:10]}{suffix}"


async def save_upload(file: UploadFile, category: str) -> tuple[str, str, int]:
    if not file.filename:
        raise ValueError("لم يتم اختيار ملف.")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise ValueError(f"نوع الملف غير مدعوم: {suffix or 'بدون امتداد'}")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError("حجم الملف يتجاوز 50 ميجابايت.")

    stored = safe_filename(file.filename)
    target = UPLOADS_DIR / category / stored
    target.write_bytes(content)
    return stored, file.filename, len(content)


def delete_upload(category: str, filename: str) -> None:
    if not filename:
        return
    path = UPLOADS_DIR / category / filename
    if path.exists() and path.is_file():
        path.unlink()


def get_or_create_profile(db: Session) -> StudentProfile:
    profile = db.query(StudentProfile).first()
    if profile is None:
        profile = StudentProfile(
            full_name="الطالب الباحث",
            scholarship_body="وزارة التعليم العالي والبحث العلمي — العراق",
            residence_required_months=6,
            study_country="",
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def stay_days(stay: ResidenceStay, today: date | None = None) -> int:
    today = today or date.today()
    end = stay.exit_date or today
    if end < stay.entry_date:
        return 0
    return (end - stay.entry_date).days + 1


def residence_summary(db: Session, profile: StudentProfile | None = None) -> dict:
    profile = profile or get_or_create_profile(db)
    stays = (
        db.query(ResidenceStay)
        .order_by(ResidenceStay.entry_date.asc())
        .all()
    )
    today = date.today()
    required_months = profile.residence_required_months or 6
    required_days = int(required_months * 30.4375)  # متوسط أيام الشهر

    periods = []
    total_days = 0
    current_streak = 0
    has_open = False

    for stay in stays:
        days = stay_days(stay, today)
        total_days += days
        if stay.is_current or stay.exit_date is None:
            has_open = True
            current_streak = days
        periods.append(
            {
                "id": stay.id,
                "entry_date": stay.entry_date,
                "exit_date": stay.exit_date,
                "is_current": stay.is_current or stay.exit_date is None,
                "country": stay.country or profile.study_country,
                "city": stay.city or profile.study_city,
                "notes": stay.notes,
                "days": days,
            }
        )

    remaining = max(required_days - total_days, 0)
    progress = min(100.0, (total_days / required_days) * 100) if required_days else 0
    completed = remaining == 0

    # تقدير تاريخ الاستيفاء إن وُجدت إقامة جارية
    projected_date = None
    if not completed and has_open and remaining > 0:
        from datetime import timedelta

        projected_date = today + timedelta(days=remaining)

    months_equiv = round(total_days / 30.4375, 2)

    return {
        "required_months": required_months,
        "required_days": required_days,
        "total_days": total_days,
        "months_equiv": months_equiv,
        "remaining_days": remaining,
        "progress_percent": round(progress, 1),
        "completed": completed,
        "has_open_stay": has_open,
        "current_streak_days": current_streak,
        "projected_completion": projected_date,
        "periods": periods,
        "study_country": profile.study_country,
    }


def thesis_progress(db: Session) -> dict:
    chapters = (
        db.query(ThesisChapter)
        .order_by(ThesisChapter.chapter_number.asc())
        .all()
    )
    if not chapters:
        return {"average": 0, "count": 0, "done": 0}
    average = sum(c.progress_percent for c in chapters) / len(chapters)
    done = sum(1 for c in chapters if c.status == "مكتمل" or c.progress_percent >= 100)
    return {"average": round(average, 1), "count": len(chapters), "done": done}


def seed_default_chapters(db: Session) -> None:
    if db.query(ThesisChapter).count() > 0:
        return
    defaults = [
        (1, "المقدمة والإطار العام", 8000),
        (2, "مراجعة الأدبيات", 12000),
        (3, "المنهجية", 10000),
        (4, "النتائج والتحليل", 12000),
        (5, "المناقشة", 8000),
        (6, "الخاتمة والتوصيات", 5000),
    ]
    for num, title, words in defaults:
        db.add(
            ThesisChapter(
                chapter_number=num,
                title=title,
                status="لم يبدأ",
                progress_percent=0,
                target_words=words,
            )
        )
    db.commit()


def study_duration_label(profile: StudentProfile) -> str:
    if not profile.start_date:
        return "—"
    end = profile.expected_end_date or date.today()
    days = (end - profile.start_date).days
    if days < 0:
        return "—"
    years = days // 365
    months = (days % 365) // 30
    if years and months:
        return f"{years} سنة و {months} شهر"
    if years:
        return f"{years} سنة"
    return f"{months} شهر"


def now_stamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")
