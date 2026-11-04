from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class StudentProfile(Base):
    __tablename__ = "student_profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(200), default="")
    full_name_en: Mapped[str] = mapped_column(String(200), default="")
    email: Mapped[str] = mapped_column(String(200), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    university: Mapped[str] = mapped_column(String(250), default="")
    faculty: Mapped[str] = mapped_column(String(250), default="")
    department: Mapped[str] = mapped_column(String(250), default="")
    specialization: Mapped[str] = mapped_column(String(250), default="")
    thesis_title: Mapped[str] = mapped_column(Text, default="")
    thesis_title_en: Mapped[str] = mapped_column(Text, default="")
    supervisor_name: Mapped[str] = mapped_column(String(200), default="")
    supervisor_email: Mapped[str] = mapped_column(String(200), default="")
    co_supervisor: Mapped[str] = mapped_column(String(200), default="")
    study_country: Mapped[str] = mapped_column(String(100), default="")
    study_city: Mapped[str] = mapped_column(String(100), default="")
    passport_number: Mapped[str] = mapped_column(String(50), default="")
    scholarship_body: Mapped[str] = mapped_column(String(200), default="وزارة التعليم العالي والبحث العلمي — العراق")
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    residence_required_months: Mapped[int] = mapped_column(Integer, default=6)
    notes: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ResearchItem(Base):
    __tablename__ = "research_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    category: Mapped[str] = mapped_column(String(80), default="ورقة بحثية")
    description: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[str] = mapped_column(String(300), default="")
    authors: Mapped[str] = mapped_column(String(300), default="")
    year: Mapped[str] = mapped_column(String(10), default="")
    filename: Mapped[str] = mapped_column(String(300), default="")
    original_name: Mapped[str] = mapped_column(String(300), default="")
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Presentation(Base):
    __tablename__ = "presentations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    event_name: Mapped[str] = mapped_column(String(300), default="")
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    venue: Mapped[str] = mapped_column(String(250), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    filename: Mapped[str] = mapped_column(String(300), default="")
    original_name: Mapped[str] = mapped_column(String(300), default="")
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AcademicDocument(Base):
    __tablename__ = "academic_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    doc_type: Mapped[str] = mapped_column(String(100), default="أخرى")
    issuer: Mapped[str] = mapped_column(String(250), default="")
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    filename: Mapped[str] = mapped_column(String(300), default="")
    original_name: Mapped[str] = mapped_column(String(300), default="")
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ResidenceStay(Base):
    """فترة إقامة داخل بلد الدراسة."""

    __tablename__ = "residence_stays"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_date: Mapped[date] = mapped_column(Date)
    exit_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)
    country: Mapped[str] = mapped_column(String(100), default="")
    city: Mapped[str] = mapped_column(String(100), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ThesisChapter(Base):
    __tablename__ = "thesis_chapters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chapter_number: Mapped[int] = mapped_column(Integer, default=1)
    title: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(50), default="لم يبدأ")
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    target_words: Mapped[int] = mapped_column(Integer, default=0)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SupervisorMeeting(Base):
    __tablename__ = "supervisor_meetings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meeting_date: Mapped[date] = mapped_column(Date)
    meeting_type: Mapped[str] = mapped_column(String(80), default="حضوري")
    topics: Mapped[str] = mapped_column(Text, default="")
    decisions: Mapped[str] = mapped_column(Text, default="")
    next_actions: Mapped[str] = mapped_column(Text, default="")
    next_meeting: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Publication(Base):
    __tablename__ = "publications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(400))
    authors: Mapped[str] = mapped_column(String(400), default="")
    venue: Mapped[str] = mapped_column(String(300), default="")
    pub_type: Mapped[str] = mapped_column(String(80), default="مجلة")
    status: Mapped[str] = mapped_column(String(80), default="مسودة")
    year: Mapped[str] = mapped_column(String(10), default="")
    doi: Mapped[str] = mapped_column(String(200), default="")
    url: Mapped[str] = mapped_column(String(400), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AcademicTask(Base):
    __tablename__ = "academic_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    category: Mapped[str] = mapped_column(String(80), default="بحث")
    priority: Mapped[str] = mapped_column(String(40), default="متوسط")
    status: Mapped[str] = mapped_column(String(40), default="قيد التنفيذ")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ResearchNote(Base):
    __tablename__ = "research_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    content: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[str] = mapped_column(String(300), default="")
    mood: Mapped[str] = mapped_column(String(40), default="محايد")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
