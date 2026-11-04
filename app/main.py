from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

load_dotenv()

from .database import UPLOADS_DIR, Base, engine, get_db
from .models import (
    AcademicDocument,
    AcademicTask,
    Presentation,
    Publication,
    ResearchItem,
    ResearchNote,
    ResidenceStay,
    SupervisorMeeting,
    ThesisChapter,
)
from .services import (
    delete_upload,
    format_bytes,
    get_or_create_profile,
    parse_date,
    residence_summary,
    save_upload,
    seed_default_chapters,
    study_duration_label,
    thesis_progress,
)

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(
    title="طلاب الدكتوراه البحثية في جامعة أمير كبير",
    docs_url=None,
    redoc_url=None,
)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
templates.env.globals["format_bytes"] = format_bytes


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        get_or_create_profile(db)
        seed_default_chapters(db)
    finally:
        db.close()


def flash_redirect(url: str, message: str = "", error: str = "") -> RedirectResponse:
    sep = "&" if "?" in url else "?"
    if message:
        url = f"{url}{sep}ok={message}"
    elif error:
        url = f"{url}{sep}err={error}"
    return RedirectResponse(url, status_code=303)


# ─── Dashboard ───────────────────────────────────────────────


@app.get("/")
def dashboard(request: Request, db: Session = Depends(get_db)):
    profile = get_or_create_profile(db)
    residence = residence_summary(db, profile)
    thesis = thesis_progress(db)
    tasks = (
        db.query(AcademicTask)
        .filter(AcademicTask.status != "مكتمل")
        .order_by(AcademicTask.due_date.asc())
        .limit(6)
        .all()
    )
    meetings = (
        db.query(SupervisorMeeting)
        .order_by(SupervisorMeeting.meeting_date.desc())
        .limit(3)
        .all()
    )
    notes = (
        db.query(ResearchNote)
        .order_by(ResearchNote.updated_at.desc())
        .limit(3)
        .all()
    )
    pubs = db.query(Publication).order_by(Publication.created_at.desc()).limit(4).all()
    counts = {
        "research": db.query(ResearchItem).count(),
        "presentations": db.query(Presentation).count(),
        "documents": db.query(AcademicDocument).count(),
        "publications": db.query(Publication).count(),
        "tasks_open": db.query(AcademicTask).filter(AcademicTask.status != "مكتمل").count(),
    }
    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "active": "dashboard",
            "profile": profile,
            "residence": residence,
            "thesis": thesis,
            "tasks": tasks,
            "meetings": meetings,
            "notes": notes,
            "pubs": pubs,
            "counts": counts,
            "study_duration": study_duration_label(profile),
            "ok": request.query_params.get("ok"),
            "err": request.query_params.get("err"),
        },
    )


# ─── Profile ─────────────────────────────────────────────────


@app.get("/profile")
def profile_page(request: Request, db: Session = Depends(get_db)):
    profile = get_or_create_profile(db)
    return templates.TemplateResponse(
        "profile.html",
        {
            "request": request,
            "active": "profile",
            "profile": profile,
            "ok": request.query_params.get("ok"),
            "err": request.query_params.get("err"),
        },
    )


@app.post("/profile")
def profile_save(
    full_name: str = Form(""),
    full_name_en: str = Form(""),
    email: str = Form(""),
    phone: str = Form(""),
    university: str = Form(""),
    faculty: str = Form(""),
    department: str = Form(""),
    specialization: str = Form(""),
    thesis_title: str = Form(""),
    thesis_title_en: str = Form(""),
    supervisor_name: str = Form(""),
    supervisor_email: str = Form(""),
    co_supervisor: str = Form(""),
    study_country: str = Form(""),
    study_city: str = Form(""),
    passport_number: str = Form(""),
    scholarship_body: str = Form(""),
    start_date: str = Form(""),
    expected_end_date: str = Form(""),
    residence_required_months: int = Form(6),
    notes: str = Form(""),
    db: Session = Depends(get_db),
):
    from datetime import datetime

    profile = get_or_create_profile(db)
    profile.full_name = full_name.strip()
    profile.full_name_en = full_name_en.strip()
    profile.email = email.strip()
    profile.phone = phone.strip()
    profile.university = university.strip()
    profile.faculty = faculty.strip()
    profile.department = department.strip()
    profile.specialization = specialization.strip()
    profile.thesis_title = thesis_title.strip()
    profile.thesis_title_en = thesis_title_en.strip()
    profile.supervisor_name = supervisor_name.strip()
    profile.supervisor_email = supervisor_email.strip()
    profile.co_supervisor = co_supervisor.strip()
    profile.study_country = study_country.strip()
    profile.study_city = study_city.strip()
    profile.passport_number = passport_number.strip()
    profile.scholarship_body = scholarship_body.strip()
    profile.start_date = parse_date(start_date)
    profile.expected_end_date = parse_date(expected_end_date)
    profile.residence_required_months = max(1, residence_required_months)
    profile.notes = notes.strip()
    profile.updated_at = datetime.utcnow()
    db.commit()
    return flash_redirect("/profile", "تم حفظ الملف الأكاديمي.")


# ─── Research materials ──────────────────────────────────────


@app.get("/research")
def research_list(request: Request, db: Session = Depends(get_db)):
    items = db.query(ResearchItem).order_by(ResearchItem.created_at.desc()).all()
    return templates.TemplateResponse(
        "research.html",
        {
            "request": request,
            "active": "research",
            "items": items,
            "ok": request.query_params.get("ok"),
            "err": request.query_params.get("err"),
        },
    )


@app.post("/research")
async def research_upload(
    title: str = Form(...),
    category: str = Form("ورقة بحثية"),
    description: str = Form(""),
    tags: str = Form(""),
    authors: str = Form(""),
    year: str = Form(""),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    stored, original, size = "", "", 0
    if file and file.filename:
        try:
            stored, original, size = await save_upload(file, "research")
        except ValueError as exc:
            return flash_redirect("/research", error=str(exc))

    db.add(
        ResearchItem(
            title=title.strip(),
            category=category.strip(),
            description=description.strip(),
            tags=tags.strip(),
            authors=authors.strip(),
            year=year.strip(),
            filename=stored,
            original_name=original,
            file_size=size,
        )
    )
    db.commit()
    return flash_redirect("/research", "أُضيفت المادة البحثية.")


@app.post("/research/{item_id}/delete")
def research_delete(item_id: int, db: Session = Depends(get_db)):
    item = db.get(ResearchItem, item_id)
    if item:
        delete_upload("research", item.filename)
        db.delete(item)
        db.commit()
    return flash_redirect("/research", "حُذفت المادة.")


# ─── Presentations ───────────────────────────────────────────


@app.get("/presentations")
def presentations_list(request: Request, db: Session = Depends(get_db)):
    items = db.query(Presentation).order_by(Presentation.created_at.desc()).all()
    return templates.TemplateResponse(
        "presentations.html",
        {
            "request": request,
            "active": "presentations",
            "items": items,
            "ok": request.query_params.get("ok"),
            "err": request.query_params.get("err"),
        },
    )


@app.post("/presentations")
async def presentations_upload(
    title: str = Form(...),
    event_name: str = Form(""),
    event_date: str = Form(""),
    venue: str = Form(""),
    description: str = Form(""),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    stored, original, size = "", "", 0
    if file and file.filename:
        try:
            stored, original, size = await save_upload(file, "presentations")
        except ValueError as exc:
            return flash_redirect("/presentations", error=str(exc))

    db.add(
        Presentation(
            title=title.strip(),
            event_name=event_name.strip(),
            event_date=parse_date(event_date),
            venue=venue.strip(),
            description=description.strip(),
            filename=stored,
            original_name=original,
            file_size=size,
        )
    )
    db.commit()
    return flash_redirect("/presentations", "أُضيف العرض التقديمي.")


@app.post("/presentations/{item_id}/delete")
def presentations_delete(item_id: int, db: Session = Depends(get_db)):
    item = db.get(Presentation, item_id)
    if item:
        delete_upload("presentations", item.filename)
        db.delete(item)
        db.commit()
    return flash_redirect("/presentations", "حُذف العرض.")


# ─── Documents ───────────────────────────────────────────────


@app.get("/documents")
def documents_list(request: Request, db: Session = Depends(get_db)):
    items = db.query(AcademicDocument).order_by(AcademicDocument.created_at.desc()).all()
    return templates.TemplateResponse(
        "documents.html",
        {
            "request": request,
            "active": "documents",
            "items": items,
            "ok": request.query_params.get("ok"),
            "err": request.query_params.get("err"),
        },
    )


@app.post("/documents")
async def documents_upload(
    title: str = Form(...),
    doc_type: str = Form("أخرى"),
    issuer: str = Form(""),
    issue_date: str = Form(""),
    expiry_date: str = Form(""),
    description: str = Form(""),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    stored, original, size = "", "", 0
    if file and file.filename:
        try:
            stored, original, size = await save_upload(file, "documents")
        except ValueError as exc:
            return flash_redirect("/documents", error=str(exc))

    db.add(
        AcademicDocument(
            title=title.strip(),
            doc_type=doc_type.strip(),
            issuer=issuer.strip(),
            issue_date=parse_date(issue_date),
            expiry_date=parse_date(expiry_date),
            description=description.strip(),
            filename=stored,
            original_name=original,
            file_size=size,
        )
    )
    db.commit()
    return flash_redirect("/documents", "أُضيفت الوثيقة.")


@app.post("/documents/{item_id}/delete")
def documents_delete(item_id: int, db: Session = Depends(get_db)):
    item = db.get(AcademicDocument, item_id)
    if item:
        delete_upload("documents", item.filename)
        db.delete(item)
        db.commit()
    return flash_redirect("/documents", "حُذفت الوثيقة.")


# ─── File download ───────────────────────────────────────────


@app.get("/files/{category}/{filename}")
def download_file(category: str, filename: str):
    if category not in {"research", "presentations", "documents", "misc"}:
        raise HTTPException(404)
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(400)
    path = UPLOADS_DIR / category / filename
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path, filename=filename)


# ─── Residence ───────────────────────────────────────────────


@app.get("/residence")
def residence_page(request: Request, db: Session = Depends(get_db)):
    profile = get_or_create_profile(db)
    summary = residence_summary(db, profile)
    return templates.TemplateResponse(
        "residence.html",
        {
            "request": request,
            "active": "residence",
            "profile": profile,
            "residence": summary,
            "ok": request.query_params.get("ok"),
            "err": request.query_params.get("err"),
        },
    )


@app.post("/residence")
def residence_add(
    entry_date: str = Form(...),
    exit_date: str = Form(""),
    is_current: str = Form(""),
    country: str = Form(""),
    city: str = Form(""),
    notes: str = Form(""),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db)
    entry = parse_date(entry_date)
    if not entry:
        return flash_redirect("/residence", error="تاريخ الدخول مطلوب.")

    current = is_current == "on"
    exit_d = None if current else parse_date(exit_date)

    if current:
        # أغلق أي إقامة جارية سابقة
        open_stays = (
            db.query(ResidenceStay)
            .filter((ResidenceStay.is_current == True) | (ResidenceStay.exit_date.is_(None)))  # noqa: E712
            .all()
        )
        for stay in open_stays:
            stay.is_current = False
            if stay.exit_date is None:
                stay.exit_date = entry

    db.add(
        ResidenceStay(
            entry_date=entry,
            exit_date=exit_d,
            is_current=current,
            country=country.strip() or profile.study_country,
            city=city.strip() or profile.study_city,
            notes=notes.strip(),
        )
    )
    db.commit()
    return flash_redirect("/residence", "سُجّلت فترة الإقامة.")


@app.post("/residence/{stay_id}/close")
def residence_close(
    stay_id: int,
    exit_date: str = Form(...),
    db: Session = Depends(get_db),
):
    stay = db.get(ResidenceStay, stay_id)
    if not stay:
        return flash_redirect("/residence", error="الفترة غير موجودة.")
    exit_d = parse_date(exit_date)
    if not exit_d:
        return flash_redirect("/residence", error="تاريخ المغادرة مطلوب.")
    if exit_d < stay.entry_date:
        return flash_redirect("/residence", error="تاريخ المغادرة قبل الدخول.")
    stay.exit_date = exit_d
    stay.is_current = False
    db.commit()
    return flash_redirect("/residence", "أُغلقت فترة الإقامة.")


@app.post("/residence/{stay_id}/delete")
def residence_delete(stay_id: int, db: Session = Depends(get_db)):
    stay = db.get(ResidenceStay, stay_id)
    if stay:
        db.delete(stay)
        db.commit()
    return flash_redirect("/residence", "حُذفت الفترة.")


# ─── Thesis ──────────────────────────────────────────────────


@app.get("/thesis")
def thesis_page(request: Request, db: Session = Depends(get_db)):
    chapters = db.query(ThesisChapter).order_by(ThesisChapter.chapter_number.asc()).all()
    progress = thesis_progress(db)
    return templates.TemplateResponse(
        "thesis.html",
        {
            "request": request,
            "active": "thesis",
            "chapters": chapters,
            "progress": progress,
            "ok": request.query_params.get("ok"),
            "err": request.query_params.get("err"),
        },
    )


@app.post("/thesis")
def thesis_add(
    chapter_number: int = Form(1),
    title: str = Form(...),
    status: str = Form("لم يبدأ"),
    progress_percent: int = Form(0),
    word_count: int = Form(0),
    target_words: int = Form(0),
    due_date: str = Form(""),
    notes: str = Form(""),
    db: Session = Depends(get_db),
):
    from datetime import datetime

    db.add(
        ThesisChapter(
            chapter_number=chapter_number,
            title=title.strip(),
            status=status,
            progress_percent=max(0, min(100, progress_percent)),
            word_count=max(0, word_count),
            target_words=max(0, target_words),
            due_date=parse_date(due_date),
            notes=notes.strip(),
            updated_at=datetime.utcnow(),
        )
    )
    db.commit()
    return flash_redirect("/thesis", "أُضيف الفصل.")


@app.post("/thesis/{chapter_id}")
def thesis_update(
    chapter_id: int,
    chapter_number: int = Form(1),
    title: str = Form(...),
    status: str = Form("لم يبدأ"),
    progress_percent: int = Form(0),
    word_count: int = Form(0),
    target_words: int = Form(0),
    due_date: str = Form(""),
    notes: str = Form(""),
    db: Session = Depends(get_db),
):
    from datetime import datetime

    chapter = db.get(ThesisChapter, chapter_id)
    if not chapter:
        return flash_redirect("/thesis", error="الفصل غير موجود.")
    chapter.chapter_number = chapter_number
    chapter.title = title.strip()
    chapter.status = status
    chapter.progress_percent = max(0, min(100, progress_percent))
    chapter.word_count = max(0, word_count)
    chapter.target_words = max(0, target_words)
    chapter.due_date = parse_date(due_date)
    chapter.notes = notes.strip()
    chapter.updated_at = datetime.utcnow()
    db.commit()
    return flash_redirect("/thesis", "حُدّث الفصل.")


@app.post("/thesis/{chapter_id}/delete")
def thesis_delete(chapter_id: int, db: Session = Depends(get_db)):
    chapter = db.get(ThesisChapter, chapter_id)
    if chapter:
        db.delete(chapter)
        db.commit()
    return flash_redirect("/thesis", "حُذف الفصل.")


# ─── Meetings ────────────────────────────────────────────────


@app.get("/meetings")
def meetings_page(request: Request, db: Session = Depends(get_db)):
    items = db.query(SupervisorMeeting).order_by(SupervisorMeeting.meeting_date.desc()).all()
    profile = get_or_create_profile(db)
    return templates.TemplateResponse(
        "meetings.html",
        {
            "request": request,
            "active": "meetings",
            "items": items,
            "profile": profile,
            "ok": request.query_params.get("ok"),
            "err": request.query_params.get("err"),
        },
    )


@app.post("/meetings")
def meetings_add(
    meeting_date: str = Form(...),
    meeting_type: str = Form("حضوري"),
    topics: str = Form(""),
    decisions: str = Form(""),
    next_actions: str = Form(""),
    next_meeting: str = Form(""),
    db: Session = Depends(get_db),
):
    md = parse_date(meeting_date)
    if not md:
        return flash_redirect("/meetings", error="تاريخ اللقاء مطلوب.")
    db.add(
        SupervisorMeeting(
            meeting_date=md,
            meeting_type=meeting_type.strip(),
            topics=topics.strip(),
            decisions=decisions.strip(),
            next_actions=next_actions.strip(),
            next_meeting=parse_date(next_meeting),
        )
    )
    db.commit()
    return flash_redirect("/meetings", "سُجّل اللقاء.")


@app.post("/meetings/{item_id}/delete")
def meetings_delete(item_id: int, db: Session = Depends(get_db)):
    item = db.get(SupervisorMeeting, item_id)
    if item:
        db.delete(item)
        db.commit()
    return flash_redirect("/meetings", "حُذف اللقاء.")


# ─── Publications ────────────────────────────────────────────


@app.get("/publications")
def publications_page(request: Request, db: Session = Depends(get_db)):
    items = db.query(Publication).order_by(Publication.created_at.desc()).all()
    return templates.TemplateResponse(
        "publications.html",
        {
            "request": request,
            "active": "publications",
            "items": items,
            "ok": request.query_params.get("ok"),
            "err": request.query_params.get("err"),
        },
    )


@app.post("/publications")
def publications_add(
    title: str = Form(...),
    authors: str = Form(""),
    venue: str = Form(""),
    pub_type: str = Form("مجلة"),
    status: str = Form("مسودة"),
    year: str = Form(""),
    doi: str = Form(""),
    url: str = Form(""),
    notes: str = Form(""),
    db: Session = Depends(get_db),
):
    db.add(
        Publication(
            title=title.strip(),
            authors=authors.strip(),
            venue=venue.strip(),
            pub_type=pub_type.strip(),
            status=status.strip(),
            year=year.strip(),
            doi=doi.strip(),
            url=url.strip(),
            notes=notes.strip(),
        )
    )
    db.commit()
    return flash_redirect("/publications", "أُضيف المنشور.")


@app.post("/publications/{item_id}/delete")
def publications_delete(item_id: int, db: Session = Depends(get_db)):
    item = db.get(Publication, item_id)
    if item:
        db.delete(item)
        db.commit()
    return flash_redirect("/publications", "حُذف المنشور.")


# ─── Tasks ───────────────────────────────────────────────────


@app.get("/tasks")
def tasks_page(request: Request, db: Session = Depends(get_db)):
    items = db.query(AcademicTask).order_by(AcademicTask.due_date.asc()).all()
    return templates.TemplateResponse(
        "tasks.html",
        {
            "request": request,
            "active": "tasks",
            "items": items,
            "ok": request.query_params.get("ok"),
            "err": request.query_params.get("err"),
        },
    )


@app.post("/tasks")
def tasks_add(
    title: str = Form(...),
    category: str = Form("بحث"),
    priority: str = Form("متوسط"),
    status: str = Form("قيد التنفيذ"),
    due_date: str = Form(""),
    description: str = Form(""),
    db: Session = Depends(get_db),
):
    db.add(
        AcademicTask(
            title=title.strip(),
            category=category.strip(),
            priority=priority.strip(),
            status=status.strip(),
            due_date=parse_date(due_date),
            description=description.strip(),
        )
    )
    db.commit()
    return flash_redirect("/tasks", "أُضيفت المهمة.")


@app.post("/tasks/{item_id}/toggle")
def tasks_toggle(item_id: int, db: Session = Depends(get_db)):
    item = db.get(AcademicTask, item_id)
    if item:
        item.status = "مكتمل" if item.status != "مكتمل" else "قيد التنفيذ"
        db.commit()
    return flash_redirect("/tasks", "حُدّثت المهمة.")


@app.post("/tasks/{item_id}/delete")
def tasks_delete(item_id: int, db: Session = Depends(get_db)):
    item = db.get(AcademicTask, item_id)
    if item:
        db.delete(item)
        db.commit()
    return flash_redirect("/tasks", "حُذفت المهمة.")


# ─── Notes / Journal ─────────────────────────────────────────


@app.get("/notes")
def notes_page(request: Request, db: Session = Depends(get_db)):
    items = db.query(ResearchNote).order_by(ResearchNote.updated_at.desc()).all()
    return templates.TemplateResponse(
        "notes.html",
        {
            "request": request,
            "active": "notes",
            "items": items,
            "ok": request.query_params.get("ok"),
            "err": request.query_params.get("err"),
        },
    )


@app.post("/notes")
def notes_add(
    title: str = Form(...),
    content: str = Form(""),
    tags: str = Form(""),
    mood: str = Form("محايد"),
    db: Session = Depends(get_db),
):
    from datetime import datetime

    now = datetime.utcnow()
    db.add(
        ResearchNote(
            title=title.strip(),
            content=content.strip(),
            tags=tags.strip(),
            mood=mood.strip(),
            created_at=now,
            updated_at=now,
        )
    )
    db.commit()
    return flash_redirect("/notes", "أُضيفت المذكرة.")


@app.post("/notes/{item_id}/delete")
def notes_delete(item_id: int, db: Session = Depends(get_db)):
    item = db.get(ResearchNote, item_id)
    if item:
        db.delete(item)
        db.commit()
    return flash_redirect("/notes", "حُذفت المذكرة.")
