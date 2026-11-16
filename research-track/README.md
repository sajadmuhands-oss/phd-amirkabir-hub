# جامعة العين العراقية — نظام متابعة المسار البحثي

نظام مؤسسي لمراقبة المسار البحثي عبر **Scopus API الرسمي فقط** (بدون scraping)، مع لوحة تحكم عربية RTL، اكتشاف التغييرات، وتنبيهات/تقارير واتساب بتوقيت `Asia/Baghdad`.

- Scopus Affiliation ID: **60118739**
- الصفحة الرسمية: https://www.scopus.com/pages/organization/60118739?origin=AffiliationNamesList
- فاصل الفحص الافتراضي: **كل 15 دقيقة** (`monitor.intervalMinutes=15`)

## المتطلبات

- Node.js 20+
- PostgreSQL 16+ و Redis 7+ (عبر Docker Compose أو تثبيت محلي)
- مفتاح Elsevier Scopus API
- (اختياري) Meta WhatsApp Business Cloud API

## التشغيل السريع

```bash
cd research-track
cp .env.example .env

# 1) قواعد البيانات — اختر أحد المسارين:
docker compose up -d
# أو بدون Docker: شغّل PostgreSQL على المنفذ 5432 و Redis على 6379
# ثم عدّل DATABASE_URL في .env إلى المنفذ 5432 بدل 5433

# 2) تثبيت وتهيئة
npm install
npm run setup          # prisma generate + db push + seed

# 3) التطبيق
npm run dev            # http://localhost:3000

# 4) الجدولة (فحص مجدول + تقارير يومية/أسبوعية/شهرية)
npm run worker
```

أو تطبيق الهجرات:

```bash
npx prisma migrate deploy
npm run db:seed
```

## حساب المدير

عيّن `ADMIN_EMAIL` و`ADMIN_PASSWORD` (12 حرفاً على الأقل) في `.env` قبل `npm run db:seed`.  
لا تُستخدم كلمة مرور افتراضية معروفة، ولا تُوثَّق بيانات دخول جاهزة في المستودع.

## أرقام واتساب للطوارئ (متعددة)

1. من الواجهة: **الإعدادات → أرقام واتساب للطوارئ والتقارير**
2. أو في `.env`:

```env
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_RECIPIENTS=9647xxxxxxxx,9647yyyyyyyy
```

الأرقام بصيغة دولية **بدون +** ومفصولة بفاصلة. تُستخدم للتنبيهات الاضطرارية (نشاط مريب) وللتقارير المجدولة.

عتبات التنبيه قابلة للضبط من الإعدادات (`alerts.*`).

## المزايا

- فحص Scopus مجدول عبر BullMQ + Redis (افتراضي كل **15 دقيقة**؛ الفحص اليدوي = مزامنة كاملة)
- الفحوص المجدولة تزايدية (سنوات حديثة) لحماية حصة Elsevier؛ إزالة البحوث فقط عند المزامنة الكاملة
- أول فحص ناجح يُعامل كـ baseline و**لا** يطلق تنبيه طوارئ بسبب كثرة الإضافات
- منع التكرار بـ `eid` / `doi` فريدين لكل مؤسسة
- سجل تغييرات + لقطات مؤشرات + تنبيهات `SUSPICIOUS_ACTIVITY` / `EMERGENCY`
- تقارير واتساب يومية/أسبوعية/شهرية + PDF للأسبوعي والشهري (تحميل من الواجهة)
- مصادر قابلة للتوسع (`SourceAdapter`) — Scopus مفعّل، الباقي stubs
- مصادقة NextAuth (Credentials) + bcrypt
- واجهة عربية RTL مع تبديل اختياري إلى الإنجليزية

> **واتساب:** الرسائل النصية الحرة تعمل داخل نافذة 24 ساعة أو للاختبار. للتقارير المجدولة خارج النافذة تحتاج قوالب Meta Cloud API معتمدة.
>
> **PDF:** ملخص التقارير الأسبوعية/الشهرية يُولَّد بخط لاتيني موثوق للعرض؛ النص العربي الكامل يبقى في رسالة واتساب وأرشيف التقارير داخل الواجهة.

## هيكل مهم

```
research-track/
  prisma/                 # schema + migrations + seed
  src/app/(dashboard)/    # لوحة التحكم
  src/app/login/          # تسجيل الدخول
  src/app/api/            # auth, scan, settings, reports, whatsapp
  src/lib/scopus/         # عميل Elsevier الرسمي
  src/lib/monitoring/     # محرك الفحص والتنبيهات
  src/lib/reports/        # بناء التقارير + PDF
  src/lib/whatsapp/       # Cloud API متعدد المستلمين
  src/workers/            # BullMQ workers + cron بغداد
  scripts/backup-db.sh
```

## أوامر مفيدة

| الأمر | الوظيفة |
|------|---------|
| `npm run dev` | خادم التطوير |
| `npm run build` / `npm start` | الإنتاج |
| `npm run worker` | عامل الفحص والتقارير |
| `npm run db:seed` | بذر المدير والإعدادات |
| `npm run db:studio` | Prisma Studio |
| `./scripts/backup-db.sh` | نسخة احتياطية PostgreSQL |

## ملاحظات أمنية

- لا تضع أسراراً في Git (`.env` مستثنى؛ استخدم `.env.example`)
- الأسرار المحفوظة في الإعدادات تُعرض مقنّعة بعد الحفظ
- بدون مفتاح Scopus: النظام يعمل والواجهة تظهر حالة فشل الفحص بوضوح — **لا تُختلق بيانات**
