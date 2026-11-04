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

## النشر على خادم

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8088
```

أو عبر Docker:

```bash
docker build -t phd-amirkabir .
docker run -p 8088:8088 -v phd_data:/app/data -v phd_uploads:/app/uploads phd-amirkabir
```

## ملاحظات

- البيانات في `data/phd_hub.db`
- الملفات في `uploads/`
- لا تنشر على الإنترنت دون حماية إذا كانت الوثائق شخصية
