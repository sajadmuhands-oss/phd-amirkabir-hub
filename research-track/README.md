# جامعة العين العراقية — نظام متابعة المسار البحثي

نظام مؤسسي لمراقبة المسار البحثي عبر **Scopus API الرسمي فقط** (بدون scraping)، مع لوحة تحكم عربية RTL، اكتشاف التغييرات، وتنبيهات/تقارير واتساب بتوقيت `Asia/Baghdad`.

- Scopus Affiliation ID: **60118739**
- الصفحة الرسمية: https://www.scopus.com/pages/organization/60118739?origin=AffiliationNamesList
- فاصل الفحص الافتراضي: **كل دقيقة** (`monitor.intervalMinutes=1`)

## المتطلبات

- Node.js 20+
- Docker + Docker Compose (لـ PostgreSQL و Redis)
- مفتاح Elsevier Scopus API
- (اختياري) Meta WhatsApp Business Cloud API

> في بيئة التطوير الحالية قد لا يتوفر Docker؛ الكود كامل وجاهز، وشغّل `docker compose up -d` على جهازك المحلي.

## التشغيل السريع

```bash
cd research-track
cp .env.example .env

# 1) قواعد البيانات
docker compose up -d

# 2) تثبيت وتهيئة
npm install
npm run setup          # prisma generate + db push/migrate + seed

# 3) التطبيق
npm run dev            # http://localhost:3000 → يحوّل إلى /ar

# 4) الجدولة (فحص كل دقيقة + تقارير)
npm run worker
```

أو تطبيق الهجرات صراحةً:

```bash
npx prisma migrate deploy
npm run db:seed
```

## بيانات المدير الافتراضية

| الحقل | القيمة |
|------|--------|
| البريد | `admin@alayen.edu.iq` |
| كلمة المرور | `ChangeMe123!` |

يمكن تغييرها عبر `ADMIN_EMAIL` / `ADMIN_PASSWORD` في `.env` قبل `npm run db:seed`.

## أرقام واتساب للطوارئ (متعددة)

1. من الواجهة: **الإعدادات → واتساب والتنبيهات → أرقام واتساب للطوارئ والتقارير**
2. أو في `.env`:

```env
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_RECIPIENTS=9647xxxxxxxx,9647yyyyyyyy
```

الأرقام بصيغة دولية **بدون +** ومفصولة بفاصلة. تُستخدم للتنبيهات الاضطرارية (نشاط مريب) وللتقارير اليومية/الأسبوعية/الشهرية.

عتبات التنبيه قابلة للضبط من الإعدادات (`alerts.*`).

## المزايا

- فحص Scopus كل دقيقة عبر BullMQ + Redis
- منع التكرار بـ `eid` / `doi` فريدين لكل مؤسسة
- سجل تغييرات + لقطات مؤشرات + تنبيهات `SUSPICIOUS_ACTIVITY` / `EMERGENCY`
- تقارير واتساب يومية/أسبوعية/شهرية + PDF للأسبوعي والشهري
- مصادر قابلة للتوسع (`SourceAdapter`) — Scopus مفعّل، الباقي stubs
- مصادقة NextAuth (Credentials) + bcrypt

## هيكل مهم

```
research-track/
  prisma/                 # schema + migrations + seed
  src/app/[locale]/...    # لوحة عربية RTL (+ en)
  src/app/api/            # auth, monitor, settings, reports, whatsapp
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
