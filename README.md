# AI-DSRP — AI Disease Surveillance & Response Platform

🔗 **เว็บออนไลน์**: https://ai-dsrp.web.app
🧪 **ผลทดสอบล่าสุด**: [test-results.md](./docs/03-testing/02-test-result/test-results.md)

ระบบเฝ้าระวังและตอบสนองต่อการระบาดของโรค ที่ช่วยให้เจ้าหน้าที่สาธารณสุข (โรงพยาบาล → เทศบาล → ทีมสอบสวนโรค) รับ ตรวจสอบ และติดตามเคสรายงานโรคได้เร็วขึ้น โดยลดขั้นตอนคีย์ข้อมูลมือด้วย OCR/AI extraction และ auto-route การแจ้งเตือนไปยังทีมที่รับผิดชอบพื้นที่

> **สถานะ**: อยู่ในขั้นตอน Prototype — ส่วนใหญ่ยังเป็น static HTML/CSS/JS ที่ใช้ mock data แต่ระบบ Login/สิทธิ์ผู้ใช้ (Firebase Authentication) และฟีเจอร์ "บันทึกและยืนยัน รง.506" เชื่อมต่อ Firebase Firestore จริงแล้ว — ดูหัวข้อ [Prototype ออนไลน์](#prototype-ออนไลน์) ด้านล่าง

## Prototype ออนไลน์

เข้าใช้งานจริงได้ที่ **[https://ai-dsrp.web.app](https://ai-dsrp.web.app)** (Firebase Hosting) — ต้อง login ก่อนถึงจะเข้าหน้าไหนได้ (Firestore Security Rules บังคับ `request.auth != null` ทุก collection)

## โครงสร้างโปรเจกต์

```
├── DESIGN.md              # Design system หลัก (Earth Tone + Minimalist + Muji) ทุก prototype ต้องอ้างอิงไฟล์นี้
├── ROADMAP.md             # แผนงานเต็มแบ่งเป็นเฟส
├── firebase.json          # Hosting (public: prototypes/v1) + ผูก Firestore Security Rules
├── firestore.rules        # กฎ Firestore: ต้อง login ก่อนถึงจะอ่าน/เขียนได้
├── prototypes/
│   └── v1/                # Prototype ปัจจุบัน — 13 หน้า: 8 หน้าโมดูลหลัก (index/case-intake/case-analysis/
│                          #   control-plan/field-tracking/asm-coordination/reports/alerts) ใช้ mock data
│                          #   + login/signup/user-approval/new-506-request/506-request-detail ที่เชื่อมต่อ
│                          #   Firebase Authentication/Firestore จริง + BUILD-PLAN.md ประวัติการตัดสินใจ
└── docs/                  # Index vault (Obsidian) — สารบัญ/เอกสารที่ไม่ได้อยู่ที่ root โดยตรง
    ├── 01-requirements/01-spec/FEATURE-LIST.md      # Feature List ทั้งระบบ
    ├── 02-design/01-prototypes/USER-JOURNEY-*.md    # User Journey แต่ละโมดูล
    ├── 02-design/02-technical/ACL.md                # ตารางสิทธิ์ 3 role ของฟีเจอร์ รง.506
    └── 03-testing/01-test-plan/v1/                  # TEST-PLAN.md, ACCEPTANCE-CRITERIA.md, TEST-CASES.xlsx
```

`docs/` เป็นแค่สารบัญที่ชี้กลับมาที่ root — `DESIGN.md`, `ROADMAP.md`, `prototypes/` ที่ root คือของจริงชุดเดียว (ไม่มีสำเนาซ้ำใน `docs/`) เพื่อไม่ให้ 2 ชุดไม่ตรงกัน

## ฟีเจอร์หลักใน Prototype v1

ดูรายละเอียดครบทุกฟีเจอร์/สถานะได้ที่ [Feature List](./docs/01-requirements/01-spec/FEATURE-LIST.md) — สรุปสั้นๆ 8 โมดูลหลัก:

- **Outbreak Dashboard** — ภาพรวมสถานการณ์การระบาด: จำนวนเคส, พื้นที่เสี่ยง, แนวโน้ม, การแจ้งเตือนล่าสุด พร้อมตัวกรองตามโรค/ภูมิภาค/ช่วงวันที่
- **Case Intake** — รับเคสจากโรงพยาบาล (PDF/JPEG) → จำลองผล OCR/AI extraction เป็นตาราง → ตรวจสอบและแก้ไขข้อมูลที่ผิดพลาดได้ก่อนยืนยัน (human-in-the-loop) → เมื่อยืนยันแล้วระบบ auto-route แจ้งเตือนไปยังทีมสอบสวนโรคตามพื้นที่ พร้อมปักหมุด + วงรัศมี 100 เมตรบน spot map (แก้พิกัดด้วยมือได้ทุกแถว)
- **Case Analysis**, **Control Plan**, **Field Tracking**, **ASM Coordination**, **Reports**, **Alerts** — ดูรายละเอียดใน Feature List ด้านบน

โมดูลข้างบนใช้ mock data บริบทประเทศไทย ออกแบบให้เปิดใช้งานแบบออฟไลน์ได้ (ไม่พึ่งพา CDN หรือ map tile ภายนอก) **ยกเว้น** ส่วน "บันทึกและยืนยัน รง.506" ใน `case-analysis.html` (`FEAT-ANALYSIS-07`)

**ระบบ Login/สิทธิ์ผู้ใช้และ รง.506 เชื่อมต่อ Firebase จริง** (project `ai-dsrp`) — ต้องมีอินเทอร์เน็ต:

- **เข้าสู่ระบบ/สมัครสมาชิก** (`login.html`, `signup.html`) — Firebase Authentication (Email/Password), ล็อกบัญชีชั่วคราว 15 นาทีหลังกรอกรหัสผิดครบ 5 ครั้ง, สมัครสมาชิกใหม่ต้องรอ Manager อนุมัติที่ `user-approval.html`
- **รง.506** (`new-506-request.html`, `case-analysis.html`, `506-request-detail.html`) — สร้าง/ดู/ยืนยัน-ไม่ยืนยัน/ลบ (มีถามยืนยันก่อนลบ) รายงานผู้ป่วยเฝ้าระวังโรค ข้อมูลอยู่ใน Firestore จริง ไม่ใช่ mock
- **สิทธิ์ตาม role** (พนักงาน SRRT / หัวหน้า Manager / ผู้อำนวยการ) — ปุ่ม/เมนูบนหน้าจอเปลี่ยนตาม role ที่ login อยู่ ตามตารางใน [ACL.md](./docs/02-design/02-technical/ACL.md)
- **Firestore Security Rules** บังคับต้อง login ก่อนถึงจะอ่าน/เขียนได้ ([firestore.rules](./firestore.rules))

## วิธีเปิดดู Prototype

**ออนไลน์**: เข้า [https://ai-dsrp.web.app](https://ai-dsrp.web.app) ได้เลย (ต้องมีบัญชีที่ผู้ดูแลระบบสร้าง/อนุมัติให้แล้วถึงจะ login ได้)

**รันในเครื่องเอง**:

```bash
npx http-server prototypes/v1 -p 8743 -c-1
```

แล้วเข้า `http://localhost:8743` — หรือเปิดไฟล์ `prototypes/v1/index.html` ตรงๆ ในเบราว์เซอร์ก็ได้ (หน้าที่ไม่ใช่ mock อย่าง login/รง.506 ยังต้องมีอินเทอร์เน็ตเชื่อม Firebase project `ai-dsrp` อยู่ดี)

**Deploy ขึ้น Firebase Hosting เอง** (ต้อง login `firebase login` ด้วยบัญชีที่มีสิทธิ์เข้าโปรเจกต์ก่อน):

```bash
firebase deploy --only hosting,firestore:rules
```

## ผู้ช่วย AI ที่ใช้พัฒนาเอกสารโปรเจกต์นี้

โปรเจกต์นี้ใช้ subagent เฉพาะทางหลายตัวช่วยเขียน/ปรับปรุงเอกสาร (นิยามอยู่ที่ `.claude/agents/`) — 3 ตัวที่ใช้งานมากที่สุด:

- **`user-journey-writer`** — เขียน User Journey ต่อโมดูล (`docs/02-design/01-prototypes/USER-JOURNEY-*.md`) ทั้ง 5 โมดูลของระบบ
- **`data-contract-writer`** — เขียน/ปรับปรุง Data Model และ API Spec เชิง conceptual (`DATA-MODEL.md`, `API-SPEC.md`)
- **`release-plan-writer`** — ปรับ `ROADMAP.md` และ task breakdown ตามผลสัมภาษณ์/ข้อมูลที่ยืนยันแล้ว

## เอกสารประกอบ

- [DESIGN.md](./DESIGN.md) — Design system (สี, typography, spacing, component guideline)
- [prototypes/v1/BUILD-PLAN.md](./prototypes/v1/BUILD-PLAN.md) — แผนและ requirement ต้นทางของแต่ละฟีเจอร์
- [docs/01-requirements/01-spec/FEATURE-LIST.md](./docs/01-requirements/01-spec/FEATURE-LIST.md) — Feature List ทั้งระบบ
- [docs/02-design/01-prototypes/USER-JOURNEY-outbreak-dashboard.md](./docs/02-design/01-prototypes/USER-JOURNEY-outbreak-dashboard.md) — User Journey ตัวอย่าง
- [docs/02-design/02-technical/ACL.md](./docs/02-design/02-technical/ACL.md) — ตารางสิทธิ์ 3 role ของฟีเจอร์ รง.506
- [docs/03-testing/01-test-plan/v1/](./docs/03-testing/01-test-plan/v1/) — TEST-PLAN.md, ACCEPTANCE-CRITERIA.md, TEST-CASES.xlsx (แผนทดสอบและเกณฑ์การยอมรับของ prototype v1)
- [test-results.md](./docs/03-testing/02-test-result/test-results.md) — ผลทดสอบจริงล่าสุดบน production
- [BACKLOG.md](./BACKLOG.md) — งานค้าง/บั๊กที่ต้องแก้ต่อ เรียงตามความสำคัญ

## Roadmap

ดู [ROADMAP.md](./ROADMAP.md) สำหรับแผนงานเต็ม แบ่งเป็นเฟส — ตั้งแต่การเชื่อมต่อ Google Sheet/Drive/LINE OA/Geocoding จริง, Alert & Response Management แบบเต็ม, ไปจนถึง backend/authentication และ hardening ก่อนใช้งานจริง

## ผู้จัดทำ

Suchavadee Chaiwanna
