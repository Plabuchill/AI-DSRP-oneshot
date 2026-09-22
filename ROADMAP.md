# Roadmap — AI-DSRP

รวบรวมจาก 2 แหล่ง: (1) ขอบเขตที่ยังไม่ได้ทำซึ่งระบุไว้แล้วใน [`prototypes/v1/BUILD-PLAN.md`](./prototypes/v1/BUILD-PLAN.md) และ [`test-docs/v1/TEST-PLAN.md`](./test-docs/v1/TEST-PLAN.md) ระหว่างที่สร้าง prototype, และ (2) pain point 5 ข้อที่รวบรวมจากทีมงานจริง (โรงพยาบาล/เทศบาล, ทีมสอบสวนโรค, ทีมควบคุมโรค/ทีมพ่น, ทีม อสม., ผู้บริหาร) — จัดกลุ่มเป็นเฟสตามลำดับที่ควรทำก่อน-หลัง ยังไม่ใช่ commitment ด้านเวลา เป็นแนวทางลำดับความสำคัญเท่านั้น

**Deadline ตายตัว (ยืนยันแล้ว 2026-09-21)**: ต้องขึ้นใช้งานจริงก่อนช่วงระบาดหนักปีหน้า (ประมาณ พ.ค.-ต.ค.) — เป็น cross-cutting constraint ไม่ผูก Phase เดียว กระทบการจัดลำดับความสำคัญของ Phase 1-7 ที่ยังไม่เสร็จทั้งหมด (ดู `TECH-STACK.md` หัวข้อ 1 ข้อ 8) — ยังไม่ได้แปลงเป็นการจัดลำดับ Phase ใหม่/ตาราง milestone ในรอบนี้ เป็นการบันทึกข้อเท็จจริงเท่านั้น

## Phase 0 — Prototype (เสร็จแล้ว)

- [x] Design system (`DESIGN.md`) — Earth Tone + Minimalist + Muji
- [x] Outbreak Dashboard — KPI, แผนที่ความเสี่ยงตามภูมิภาค, กราฟแนวโน้ม, การแจ้งเตือนล่าสุด, ตัวกรอง (ครอบคลุม FEAT-DASH-01 ถึง 15 ตาม `FEATURE-LIST.md`/`TEST-PLAN.md` ที่อัปเดตแล้ว)
- [x] Case Intake — mock OCR review table, human-in-the-loop confirm + แก้ไขข้อมูลก่อนยืนยัน, notification log, spot map + วงรัศมี 100 เมตร
- [x] Case Analysis — case cluster map, ร่างรายงานสอบสวนโรค, chatbot ประสานงาน อสม. (mock)
- [x] Control Plan — ร่างใบขออนุมัติเบิกน้ำมัน/น้ำยาเคมี, ร่างแผนปฏิบัติงานควบคุมโรค (mock)
- [x] Field Tracking — tracking ทีมพ่นบน spot map, AI vision QC รูปถ่ายภาคสนาม (mock)
- [x] ASM Coordination — photo intake จาก อสม., ตารางคิวแจ้งเตือนล่วงหน้าผ่าน LINE (mock)
- [x] Reports — KPI สรุปผู้บริหาร, สร้าง/ส่งรายงานรายวัน-รายสัปดาห์ (mock)
- [x] Alerts — workflow มอบหมายงาน/อัปเดตสถานะ/ปิดเคส (mock)
- [x] เอกสาร QA รอบแรก (Test Plan, Acceptance Criteria, Test Cases) สำหรับ Outbreak Dashboard

ทั้งหมดเป็น static HTML/CSS/JS ใช้ mock data ไม่มี backend จริง — เมนู left rail ทั้ง 8 อันตอนนี้ชี้ไปหน้าจริงครบแล้ว (prototype ครอบคลุม UI ของ pain point ทั้ง 5 ข้อ + Alert Management) — Phase 1-5/7 ด้านล่างคือการเชื่อมต่อ AI/backend/API **จริง** แทนที่ mock ซึ่งยังไม่ได้ทำ

## Phase 1 — Case Intake: เชื่อมต่อจริง (โรงพยาบาล → เทศบาล)

เปลี่ยนส่วนที่ยัง mock อยู่ในหน้า Case Intake ให้ทำงานกับระบบจริง:

- **OCR/AI extraction จริง** — เชื่อม Google Document AI หรือโมเดล vision (Claude/GPT) แทนตาราง mock
- **Google Sheet + Google Drive จริง** — เขียนข้อมูลที่ยืนยันแล้วเข้าชีทอัตโนมัติ พร้อมลิงก์ไฟล์ต้นฉบับใน Drive คู่กับแถวข้อมูล
- **Geocoding API จริง** — แปลงที่อยู่เป็นพิกัดจริง แทน mock coordinate พร้อม fallback ปักหมุดด้วยมือเมื่อความแม่นยำต่ำ (UI ส่วนนี้ทำไว้ใน prototype แล้ว รอเชื่อม API)
- **LINE OA API จริง** — ส่งแจ้งเตือนไปยังทีมสอบสวนโรคจริงตาม field ตำบล/หมู่บ้าน แทน mock notification log
- **แก้ไขแถวที่ยืนยันแล้ว** — เพิ่ม flow unlock/ขอสิทธิ์แก้ไขข้อมูลที่ยืนยันไปแล้ว (ปัจจุบันแก้ได้เฉพาะแถว "รอตรวจสอบ")
- [ ] ยืนยัน OCR/Document AI vendor และ Geocoding vendor ผ่านการสัมภาษณ์ `tech-stack-builder` รอบ 2 (FEAT-INTAKE-05, FEAT-INTAKE-07) — `TECH-STACK.md` ระบุสถานะ "ยังไม่สัมภาษณ์"
- [ ] สร้าง `DETAILED-DESIGN.md` สำหรับ flow OCR Review (human-in-the-loop) ก่อนเริ่ม implement จริง (FEAT-INTAKE-02, FEAT-INTAKE-05)
- [ ] เพิ่ม Error/Validation case แบบละเอียดใน `API-SPEC.md` (FEAT-INTAKE-*) — `API-SPEC.md` หัวข้อ 4 ระบุ "ไม่รวมในรอบนี้ตามที่ยืนยันไว้ในขอบเขตของ Build Plan"

## Phase 2 — ทีมสอบสวนโรค: วิเคราะห์เคสและร่างรายงาน

- **วิเคราะห์การเชื่อมโยงเคส (case clustering)** — clustering ตามเวลา/พื้นที่/ความสัมพันธ์ผู้สัมผัส เพื่อช่วยดูว่าเคสไหนน่าจะเป็น cluster เดียวกัน — เป็นงาน statistical/spatial-temporal clustering จริง (ไม่ใช่แค่ LLM สรุปข้อความ) ต้องมีข้อมูลไทม์ไลน์/พิกัด/ผู้สัมผัสที่แม่นยำพอ และให้ AI เสนอเป็น "cluster ที่เป็นไปได้" เท่านั้น ให้นักระบาดวิทยายืนยันก่อนทุกครั้ง (human-in-the-loop เหมือน Case Intake) — cluster ผิดอาจทำให้ทุ่มทรัพยากรผิดพื้นที่
- **ร่างรายงานสอบสวนโรค** — AI ดึงข้อมูลดิบ (จำนวนผู้สัมผัส, ไทม์ไลน์, ผลสอบสวน) มาร่างเป็นรายงานฉบับส่งผู้บริหาร ให้นักวิชาการแก้ไข/เติมรายละเอียดต่อ (เสี่ยงต่ำ เพราะมีคนตรวจทานก่อนใช้จริงอยู่แล้ว)
- **Chatbot ช่วยประสานงาน อสม. เบื้องต้น** — นัดหมาย/แจ้งพื้นที่ก่อนโทรจริง — ต้องจำกัดสิทธิ์ให้ใช้ได้แค่นัดหมาย/แจ้งพื้นที่เบื้องต้นเท่านั้น ห้ามส่งข้อมูลเคสละเอียดผ่าน chatbot (ความเสี่ยง PDPA) และต้องมี fallback ให้โทรจริงได้เสมอสำหรับเคสเร่งด่วน
- [ ] ยืนยัน Case Clustering library/service ผ่าน `tech-stack-builder` รอบ 2 (FEAT-ANALYSIS-04) — อ้างจาก `TECH-STACK.md`
- [ ] สร้าง `DETAILED-DESIGN.md` สำหรับ flow Case Clustering decision (human-in-the-loop) (FEAT-ANALYSIS-01, FEAT-ANALYSIS-04)

## Phase 3 — ทีมควบคุมโรค (ทีมพ่น)

- **Auto-generate ใบขออนุมัติเบิกน้ำมัน/น้ำยาเคมี** — จากข้อมูลเคส (พื้นที่, จำนวนหลังคาเรือน, รัศมี) ให้ AI ร่างเอกสารสำเร็จรูป ผู้บริหารเซ็นได้เลย
- **AI ร่างแผนปฏิบัติงานควบคุมโรค** ให้มีประสิทธิภาพ
- **Real-time tracking ทีมพ่น** เทียบกับ spot map ที่วางแผนไว้ (Looker Studio/Power BI) — ⚠️ ข้อจำกัดทางเทคนิค: LINE ไม่มี API สำหรับติดตามตำแหน่งต่อเนื่องอัตโนมัติ ("location sharing" ของ LINE เป็นการแชร์ครั้งเดียว) ต้องทำผ่านแอป LIFF/แอปมือถือแยกที่ขอสิทธิ์ตำแหน่งต่อเนื่อง และต้องพิจารณาความสมัครใจ/กฎหมายแรงงานเรื่องการติดตามตำแหน่งพนักงานภาคสนามด้วย
- **AI vision ตรวจสอบรูปถ่ายภาคสนาม** ว่าตรงกับพื้นที่/เวลาที่ต้องพ่นจริงไหม (QC แทนคนไล่ดูทีละรูป) — ⚠️ รูปที่ส่งผ่าน LINE มักถูกล้าง EXIF/geotag ออกไปแล้ว ต้องเก็บพิกัด/เวลาแยกตอนถ่ายภาพผ่านแอป (LIFF ขอสิทธิ์ตำแหน่ง) ไม่ใช่ดึงจาก metadata ของไฟล์ที่ส่งมา
- [ ] ยืนยัน AI Vision QC vendor และ Location tracking (LIFF app) tech ผ่าน `tech-stack-builder` รอบ 2 (FEAT-CONTROL-04, FEAT-CONTROL-05) — อ้างจาก `TECH-STACK.md`

## Phase 4 — ทีม อสม.

- **รับรูปผ่าน LINE OA → AI vision จัดเก็บอัตโนมัติ** — จัดหมวดหมู่ตามพื้นที่/วันที่ พร้อมสรุปสถานะ (พ่นแล้ว/ยังไม่พ่น) เก็บลง Sheet/Drive อัตโนมัติ — ติดปัญหา EXIF เดียวกับ Phase 3 (ต้องแก้ด้วยแนวทางเดียวกัน)
- **แจ้งเตือน spot map ล่วงหน้า 1 วันแบบอัตโนมัติผ่าน LINE** (scheduled message) ตามวันที่ 0 และวันที่ 7 ที่กำหนดไว้แล้วในระบบ — ต้องเช็ค quota ของ LINE Messaging API (free tier จำกัดจำนวนข้อความ/เดือน) ก่อน scale

## Phase 5 — รายงานสรุปผู้บริหารอัตโนมัติ

รวมข้อมูลจากทุกทีม (จำนวนเคส, สถานะควบคุมโรค, รูปถ่ายยืนยัน, HI/CI, รายงานสอบสวน) มาสรุปอัตโนมัติเป็นรายงานประจำวัน/สัปดาห์ ส่งผู้บริหารผ่าน LINE หรือ PDF โดยไม่ต้องรอคนรวบรวมมือ

> เป็นจุดที่ AI มีค่ามากที่สุด แต่**ขึ้นอยู่กับคุณภาพและความครบถ้วนของข้อมูลจาก Phase 1-4 ทั้งหมด** — ควรทำเป็นเฟสสุดท้ายต่อยอดจากของ Phase 1-4 มากกว่าจะทำแยกก่อน ถ้าระบบต้นทางยังเป็น manual/ครึ่งๆกลางๆ รายงานสรุปจะไม่ครบ

- [ ] ยืนยัน Reporting/BI tool ผ่าน `tech-stack-builder` รอบ 2 (FEAT-REPORT-03) — อ้างจาก `TECH-STACK.md`

## Phase 6 — Alert & Response Management แบบเต็ม

- [x] หน้า Alert & Response Management (`alerts.html`) — workflow มอบหมายงาน/อัปเดตสถานะ/ปิดเคส (ต้องบันทึกสรุปก่อนปิด) พร้อมตัวกรองสถานะ/ความรุนแรง — **prototype UI เสร็จแล้ว (mock data)**
- [ ] เชื่อมข้อมูลจาก Case Intake / โมดูลทีมต่างๆ เข้ากับ Outbreak Dashboard แบบ real-time แทน mock data คนละชุด (ยังไม่ทำ — ต้องมี backend จริงตาม Phase 7)

## Phase 7 — Platform Foundations

- **Backend/API จริง** แทนที่ mock data ที่ฝังอยู่ใน JS ของแต่ละหน้า
- **ระบบ login และสิทธิ์ผู้ใช้** (role-based access) — แยกสิทธิ์ระหว่างเจ้าหน้าที่โรงพยาบาล/เทศบาล/ทีมสอบสวนโรค/ทีมพ่น/อสม./ผู้บริหาร
- **Data persistence/database** เก็บประวัติเคสและไฟล์ต้นฉบับระยะยาว
- [x] Sync `HIGH-LEVEL-ARCHITECTURE.md` หัวข้อ 6 (Component Breakdown) ให้ระบุเทคโนโลยีจริงตาม `TECH-STACK.md` (แถว Web App/Frontend และ API Server/Backend) (FEAT-PLATFORM-01) — sync เสร็จแล้ว (2026-09-22) ครบทุกแถวใน Component Breakdown
- [x] ยืนยัน Database engine, Auth/Identity provider, Hosting/Infrastructure เจาะจง, Monitoring/Logging ผ่าน `tech-stack-builder` รอบ 2 (FEAT-PLATFORM-02, FEAT-PLATFORM-03) — ยืนยันครบแล้ว (2026-09-21): Firebase Firestore, Firebase Authentication, Firebase Hosting/Cloud Run + Cloud Functions, Cloud Logging/Cloud Monitoring ดู `TECH-STACK.md` หัวข้อ 3
- [x] ปิด open question เรื่องแผนส่งต่อให้ผู้รับเหมาภายนอกดูแลระบบในอนาคต (กระทบว่า Node.js+Express ที่ยืนยันไว้ยังเหมาะสมหรือควรเปลี่ยนไปทาง Laravel/.NET Core ที่ตลาดผู้รับเหมาไทยคุ้นเคยกว่า) (FEAT-PLATFORM-01) — ปิดแล้ว (2026-09-21): ทีม IT เดิมดูแลต่อเนื่อง ไม่มีแผนส่งต่อผู้รับเหมาภายนอก ยืนยัน Node.js + Express (หรือ Fastify) ต่อ ดู `TECH-STACK.md` หัวข้อ 4.1
- [ ] สัมภาษณ์ `tech-stack-builder` เพิ่มเติม: Compliance/ความปลอดภัยเจาะจง (encryption at rest, retention period) (FEAT-PLATFORM-02, FEAT-PLATFORM-03) — `TECH-STACK.md` หมวด 4 ของ Interview Summary ระบุ "ยังไม่สัมภาษณ์รายละเอียดเจาะจง"
- [x] สัมภาษณ์ `tech-stack-builder` เพิ่มเติม: Timeline/deadline ของโครงการ (cross-cutting/project-level ไม่มี Feature ID เฉพาะ) — สัมภาษณ์เสร็จแล้ว (2026-09-21) ดู deadline ที่บันทึกไว้ในย่อหน้าเปิดของไฟล์นี้ และ `TECH-STACK.md` หัวข้อ 1 ข้อ 8
- [x] สัมภาษณ์ `tech-stack-builder` เพิ่มเติม: วิสัยทัศน์ระยะยาว (multi-tenancy) แล้วปรับขอบเขต Multi-tenancy ใน `DATA-MODEL.md` ตามผลที่ได้ (FEAT-PLATFORM-02, FEAT-PLATFORM-03) — สัมภาษณ์เสร็จแล้ว (2026-09-21): ยืนยัน single-tenant เท่านั้น ไม่มีแผนขยาย และ sync เข้า `DATA-MODEL.md` หัวข้อ 3 Cross-cutting concerns แล้ว (2026-09-22)

## Phase 8 — Hardening ก่อนใช้งานจริง

- **Performance testing** — ยังไม่ทำในรอบ prototype เพราะไม่มี backend/โหลดจริงให้ทดสอบ
- **Security testing** — รวมถึงทบทวนการส่งข้อมูลสุขภาพผ่าน 3rd-party API (Google/LINE) ให้สอดคล้อง PDPA (โดยเฉพาะ chatbot อสม. ใน Phase 2 และรูปภาคสนามใน Phase 3-4)
- **Accessibility audit** เต็มรูปแบบ (ปัจจุบันอ้างอิงตาม guideline ใน `DESIGN.md` แต่ยังไม่ได้ตรวจสอบจริงด้วยเครื่องมือ)

---

หมายเหตุ: ถ้ามี pain point เพิ่มเติมนอกเหนือจาก 5 ข้อนี้ ให้เพิ่มเข้ามาต่อท้ายไฟล์นี้ตามลำดับความสำคัญที่ตกลงกัน
