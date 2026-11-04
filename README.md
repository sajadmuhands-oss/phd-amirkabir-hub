# طلاب الدكتوراه البحثية في جامعة أمير كبير

منصة محلية لإدارة شؤون طالب الدكتوراه البحثية الموفد — الأرشيف العلمي، الوثائق، الأطروحة، ومتطلب الإقامة.

تم التصميم بواسطة سجاد زيارة |

## التشغيل (Windows)

1. انقر مرتين على `start.bat`
2. افتح: [http://127.0.0.1:8088](http://127.0.0.1:8088)

أو:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8088 --reload
```

## قاعدة البيانات

- محلياً: SQLite في `data/phd_hub.db`
- على السحابة: عيّن `DATABASE_URL` لـ PostgreSQL (Render يضبطها تلقائياً)

## نشر دائم على Render (رابط + Postgres)

1. ارفع المشروع إلى GitHub
2. من [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**
3. اختر المستودع → طبّق `render.yaml`
4. بعد النشر يكون الرابط مثل: `https://phd-amirkabir.onrender.com`

الخطة المجانية: Postgres لمدة 30 يوماً (يمكن الترقية)، والخدمة قد تدخل سكون بعد الخمول.

## ملاحظات

- الملفات المرفوعة محلياً في `uploads/`
- على الخطة المجانية لـ Render الملفات غير دائمة بعد إعادة التشغيل (البيانات النصية محفوظة في Postgres)
