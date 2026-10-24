# NFR Review — AI-DSRP (ทั้งระบบ 8 โมดูล)

เอกสารนี้เป็น**การทวนสอบ (review) เท่านั้น** — เทียบเอกสาร design ที่มีอยู่แล้ว (`HIGH-LEVEL-ARCHITECTURE.md`, `DATA-MODEL.md`, `API-SPEC.md`, `DETAILED-DESIGN.md`) กับ NFR ต้นทางที่ยืนยันไว้แล้วในเอกสารอื่น (`TECH-STACK.md`, `ROADMAP.md` Phase 8, `DESIGN.md`, `HIGH-LEVEL-ARCHITECTURE.md` หัวข้อ 4) — **ไม่เสนอ/แก้ architecture, data model, หรือ detailed design ใหม่** ตามโครงจาก skill `nfr-review-builder` (`references/nfr-review-template.md`)

## 1. ขอบเขตการ Review

- **Scope**: ทั้งระบบ (ทุก Feature ID ทุกโมดูล — Case Intake, Dashboard, Case Analysis, Control Plan, Field Tracking, ASM Coordination, Reports, Alerts, Platform Foundations)
- **หมวด NFR ที่ครอบ**: ครอบทุกหมวดมาตรฐานตาม Build Plan ที่ยืนยันแล้ว — Performance, Security, Scalability, Availability/Reliability, Maintainability, Compliance, Accessibility, Usability (บางหมวดออกมาเป็น Gap ทั้งหมวด ระบุไว้ตามจริง ไม่ข้าม)
- **เอกสารที่ใช้เทียบ**: `HIGH-LEVEL-ARCHITECTURE.md` (มี — ทั้งไฟล์), `DATA-MODEL.md` (มี — ทั้งไฟล์ ครบ 8 โมดูล), `API-SPEC.md` (มี — ทั้งไฟล์), `DETAILED-DESIGN.md` (มี — ทั้งไฟล์ 16 flow)
- **NFR ต้นทางที่ใช้**: `TECH-STACK.md` (Scale/Performance, Compliance, Hosting, Maturity/Thai talent), `ROADMAP.md` Phase 8 (Performance/Security/Accessibility testing), `DESIGN.md` (accessibility guideline), `HIGH-LEVEL-ARCHITECTURE.md` หัวข้อ 4 (ข้อจำกัดทางเทคนิค: LINE quota, EXIF, human-in-the-loop)
- **ความละเอียดของ Gap**: ต่อ Gap ที่พบ ให้อย่างน้อย 1 ข้อเสนอแนะ — เป็น "ข้อเสนอแนะ" เท่านั้น ผู้ใช้ต้องตัดสินใจ/สัมภาษณ์เพิ่มเองถ้าจะปิด gap จริง

---

## 2. ผลการ Review ต่อหมวด NFR

### Performance

| จุดที่ตรวจ | NFR ต้นทาง (อ้างอิงแหล่ง) | สถานะ | รายละเอียด |
|---|---|---|---|
| ขนาด scale เป้าหมาย (<100 concurrent users, เทศบาลเดียว 4 เขตบริการ) | `TECH-STACK.md` §1 ข้อ 5 (Scale/Performance) | ✅ สอดคล้อง | `HIGH-LEVEL-ARCHITECTURE.md` หัวข้อ 2/6 ออกแบบ API Server + Database เดี่ยว ไม่มี clustering/load-balancing ที่ over-engineer เกินความจำเป็น เข้ากับ scale เป้าหมายที่เล็ก |
| Real-time sync ของ Dashboard/Alerts ใช้ polling/refresh 5-30 วินาที (ไม่ใช้ WebSocket/SSE) | `TECH-STACK.md` §1 ข้อ 5 อ้าง FEAT-ALERT-03, FEAT-REPORT-03 | ⚠️ ความเสี่ยง | `DETAILED-DESIGN.md` Flow 4 (Dashboard) ออกแบบการ recompute เฉพาะตอนผู้ใช้เปลี่ยน Filter ด้วยมือเท่านั้น ไม่มีกลไก polling/refresh อัตโนมัติปรากฏในไดอะแกรม; FEAT-ALERT-03 (การเชื่อมข้อมูล real-time ระหว่าง Alert กับ Dashboard) ยังเป็น backlog ไม่มี flow ของตัวเองใน `DETAILED-DESIGN.md` เลย — กลไก polling 5-30 วินาทีที่ยืนยันไว้ใน `TECH-STACK.md` ยังไม่ถูก sync เข้าเอกสาร conceptual ใดๆ |
| Response time / throughput ที่วัดผลได้ (เช่น p95 latency) | — | 🔲 Gap | ไม่มีเอกสารใดในโปรเจกต์ระบุตัวเลขเป้าหมายเจาะจง (มีแค่จำนวน concurrent user และ polling interval) |
| Performance testing execution | `ROADMAP.md` Phase 8 ("Performance testing — ยังไม่ทำในรอบ prototype เพราะไม่มี backend/โหลดจริงให้ทดสอบ") | 🔲 Gap | ยังไม่มี test plan/metric ที่วัดผลได้สำหรับขั้นตอนนี้ — รอ Phase 7 (Backend จริง) เสร็จก่อน |

### Security

| จุดที่ตรวจ | NFR ต้นทาง (อ้างอิงแหล่ง) | สถานะ | รายละเอียด |
|---|---|---|---|
| Chatbot ประสานงาน อสม. จำกัดสิทธิ์แค่นัดหมาย/แจ้งพื้นที่ ห้ามส่งข้อมูลเคสละเอียด | `HIGH-LEVEL-ARCHITECTURE.md` หัวข้อ 4 (PDPA); `ROADMAP.md` Phase 2 | ✅ สอดคล้อง | `DETAILED-DESIGN.md` Flow 7 ระบุ business rule ชัดเจนว่า "จำกัดสิทธิ์แค่นัดหมาย/แจ้งพื้นที่ (PDPA)" สำหรับ `FEAT-ANALYSIS-06` ในอนาคต ตรงกับข้อจำกัดต้นทาง |
| รูปภาคสนามผ่าน LINE ถูกล้าง EXIF — ต้องเก็บพิกัด/เวลาจากแอปตอนถ่าย ไม่ใช่ metadata ไฟล์ | `HIGH-LEVEL-ARCHITECTURE.md` หัวข้อ 4 + Decision Log ข้อ 6 | ✅ สอดคล้อง | `DATA-MODEL.md` entity `FIELD_PHOTO` ไม่มี field ที่พึ่งพา EXIF ของไฟล์ ใช้ `location_match`/`time_match` ที่มาจากบริการ AI Vision QC ที่ประมวลผลจากพิกัด/เวลาที่เก็บแยกแทน — ตรงกับแนวทางที่ยืนยันไว้ |
| Auth/Role-based Access (6 บทบาทผู้ใช้) | `ROADMAP.md` Phase 7 ("ระบบ login และสิทธิ์ผู้ใช้ role-based access"); `HIGH-LEVEL-ARCHITECTURE.md` หัวข้อ 2/6 (FEAT-PLATFORM-02, 6 บทบาท) | ⚠️ ความเสี่ยง | `HIGH-LEVEL-ARCHITECTURE.md` อ้างถึง component "Auth / Role-based Access" และ 6 บทบาทผู้ใช้ชัดเจน แต่ `DATA-MODEL.md` **ไม่มี entity ใดรองรับ User/Role/Permission เลย** (ไม่มี `USER`, `ROLE` ปรากฏในทั้ง 8 ER Diagram) — เมื่อถึงตอน implement จริงจะไม่มีฐานข้อมูล conceptual ให้ต่อยอด ต้องออกแบบเพิ่มก่อน Phase 7 ตัวอย่างรูปธรรมของ gap นี้ที่เพิ่งเกิดจริง: `APPROVAL_REQUEST.decided_by_name` (`FEAT-CONTROL-02`) ต้องเก็บเป็น free-text ชั่วคราวแทนที่จะ reference ไปยัง USER entity เพราะยังไม่มี entity นั้นให้ผูก |
| Encryption at rest, การเข้าถึงข้อมูลสุขภาพ | `TECH-STACK.md` §1 ข้อ 4 ("ยังไม่สัมภาษณ์รายละเอียดเจาะจง") | 🔲 Gap | ไม่มีเป้าหมายเจาะจงในเอกสารใดของโปรเจกต์ |
| ข้อมูลสุขภาพที่ส่งผ่าน 3rd-party API (Google/LINE) — field ไหนที่ถือว่า sensitive และควรจำกัดการส่ง | `ROADMAP.md` Phase 8 (Security testing: ทบทวนข้อมูลสุขภาพผ่าน 3rd-party API) | ⚠️ ความเสี่ยง | `API-SPEC.md` หัวข้อ 4 ระบุชัดว่า "ไม่รวม Error/Validation case แบบละเอียดในรอบนี้" และไม่มีเอกสารใดจำแนกว่า field ไหนใน payload ที่ส่งออกไป Google Sheet/LINE ถือเป็นข้อมูลสุขภาพอ่อนไหวที่ต้องจำกัดเป็นพิเศษ — ยังต้องรอ Security testing ตาม Phase 8 |

### Scalability

| จุดที่ตรวจ | NFR ต้นทาง (อ้างอิงแหล่ง) | สถานะ | รายละเอียด |
|---|---|---|---|
| Multi-tenancy ไม่อยู่ใน scope รอบนี้ | `TECH-STACK.md` §1 ข้อ 9 ("ยังไม่สัมภาษณ์รายละเอียด multi-tenancy") | ✅ สอดคล้อง | `DATA-MODEL.md` หัวข้อ 3 Cross-cutting concerns ระบุตรงกันว่า "Multi-tenancy: ไม่อยู่ใน scope ของ Build Plan รอบนี้" — เอกสารทั้งสองสอดคล้องกัน ไม่มีข้อขัดแย้ง |
| ความง่ายของ architecture เข้ากับ scale เล็ก (เทศบาลเดียว) | `TECH-STACK.md` §1 ข้อ 5 | ✅ สอดคล้อง | เช่นเดียวกับหัวข้อ Performance — ไม่มีความซับซ้อนเกินจำเป็นที่จะเป็นความเสี่ยงด้าน scalability สำหรับ scale ปัจจุบัน |
| วิสัยทัศน์ระยะยาว (ขยายไปหลายเทศบาล/multi-tenancy ในอนาคต) | `TECH-STACK.md` §1 ข้อ 9 | 🔲 Gap | ยังไม่สัมภาษณ์รายละเอียด — `ROADMAP.md` Phase 7 มี checklist item ค้างไว้แล้วให้สัมภาษณ์เพิ่ม |
| Hosting/Infrastructure platform เจาะจง (รองรับ scale ได้จริงหรือไม่) | `TECH-STACK.md` หัวข้อ 3 (สถานะ "ยังไม่สัมภาษณ์ — backlog") | 🔲 Gap | ทราบเพียงทิศทางกว้าง (self-host on-prem/ศูนย์ข้อมูลราชการ) ยังไม่ยืนยันแพลตฟอร์มจริงที่จะบอกได้ว่ารองรับ scale ได้เพียงพอ |

### Availability / Reliability

| จุดที่ตรวจ | NFR ต้นทาง (อ้างอิงแหล่ง) | สถานะ | รายละเอียด |
|---|---|---|---|
| Uptime/SLA เป้าหมาย | — | 🔲 Gap | ไม่มีเอกสารใดในโปรเจกต์ระบุเป้าหมาย uptime/SLA เลย |
| Backup / Disaster Recovery (RTO/RPO) | `TECH-STACK.md` §1 ข้อ 1 กล่าวถึงกว้างๆ ว่า "มีทีม IT/DevOps ของโรงพยาบาล/เทศบาลดูแล infra เองอยู่แล้ว (ดูแล server/patch/backup ได้)" | 🔲 Gap | เป็นการกล่าวถึงศักยภาพทีมดูแล ไม่ใช่เป้าหมาย RTO/RPO เชิงตัวเลข — ไม่มีเกณฑ์ให้เทียบ |
| ความทนทานของ Database (replication/failover) | `TECH-STACK.md` หัวข้อ 3 (Database engine "ยังไม่สัมภาษณ์ — backlog") | 🔲 Gap | `DATA-MODEL.md` เป็น conceptual ไม่ผูก engine จึงยังออกแบบ resilience strategy ไม่ได้ — ต้องรอผลสัมภาษณ์รอบหน้า |
| การจัดการเมื่อบริการภายนอกล่ม (OCR/Geocoding/LINE/Google API ไม่ตอบสนอง) | — | 🔲 Gap | `DETAILED-DESIGN.md` หัวข้อ 0 ระบุชัดว่า "ไม่ครอบ error ทั่วไป (network fail, timeout ฯลฯ)" ตามขอบเขตที่ยืนยันไว้ในรอบนั้น — จึงไม่มี retry/fallback behavior ที่ระบุไว้เมื่อบริการภายนอกล่ม (หมายเหตุ 2026-10-24: OCR ของ Case Intake ปัจจุบันรันในเบราว์เซอร์ผู้ใช้ ไม่พึ่งบริการภายนอก จึงไม่เข้าข่ายจุดนี้ในปัจจุบัน — เส้นทาง Claude Vision ผ่านเซิร์ฟเวอร์ที่เป็น backlog จะกลับมาเข้าข่ายเมื่อทำจริง) |

### Maintainability

| จุดที่ตรวจ | NFR ต้นทาง (อ้างอิงแหล่ง) | สถานะ | รายละเอียด |
|---|---|---|---|
| ต้องการเทคโนโลยีเก่า/เสถียร หา developer ทดแทนง่าย มีเอกสาร/community ไทยเยอะ | `TECH-STACK.md` §1 ข้อ 9 (Maturity/Thai talent preference) | ✅ สอดคล้อง | `TECH-STACK.md` หัวข้อ 4.1/4.2 มี Weighted Scoring Model ที่ให้น้ำหนัก "Maturity/Thai talent" ชัดเจนในการเลือก Node.js+Express และ Vanilla JS+EJS |
| ลดการ copy-paste HTML/JS ซ้ำ 8 หน้า ด้วย component/partial reuse | `TECH-STACK.md` §1 ข้อ 7 | ✅ สอดคล้อง | `TECH-STACK.md` หัวข้อ 4.2 เลือก EJS/Handlebars partials ตอบโจทย์นี้โดยตรง (แม้ยังมี trade-off เรื่อง reuse หยาบกว่า framework จริงที่บันทึกไว้แล้วในเอกสารเดียวกัน) |
| แผนส่งต่อให้ผู้รับเหมาภายนอกดูแลในอนาคต (กระทบความเหมาะสมของ stack ที่เลือก) | `TECH-STACK.md` หัวข้อ 4.1 Decision Rationale (open question) | ⚠️ ความเสี่ยง | ยังเป็น open question ที่ยืนยันไว้แล้วว่ายังไม่ปิด — `ROADMAP.md` Phase 7 มี checklist item ค้างไว้ให้ปิดคำถามนี้ก่อน ("ปิด open question เรื่องแผนส่งต่อให้ผู้รับเหมาภายนอก") — ยังไม่มีผลสรุปที่ sync เข้า `HIGH-LEVEL-ARCHITECTURE.md`/`TECH-STACK.md` |
| Monitoring/Logging สำหรับดูแลระบบระยะยาว | `TECH-STACK.md` หัวข้อ 3 (สถานะ "ยังไม่สัมภาษณ์ — backlog") | 🔲 Gap | ไม่มี component/เครื่องมือที่ยืนยันแล้วสำหรับ monitoring/logging — กระทบความสามารถในการ maintain ระบบระยะยาว |

### Compliance

| จุดที่ตรวจ | NFR ต้นทาง (อ้างอิงแหล่ง) | สถานะ | รายละเอียด |
|---|---|---|---|
| Human-in-the-loop บังคับสำหรับ OCR extraction, case clustering, ปิด alert | `ROADMAP.md`; `HIGH-LEVEL-ARCHITECTURE.md` หัวข้อ 4 + Decision Log ข้อ 3 | ✅ สอดคล้อง | `DETAILED-DESIGN.md` Flow 1 (OCR Review), Flow 5 (Cluster Confirm), Flow 16 (Alert Close) ทั้ง 3 flow มี explicit human-confirm gate ก่อน commit ข้อมูลจริงทุกจุด ตรงกับ decision ต้นทาง |
| ข้อมูลต้องอยู่ในประเทศไทยเท่านั้น (PDPA data residency) เทียบกับการใช้ Google Sheet/Drive เก็บข้อมูลยืนยันแล้ว+ไฟล์ต้นฉบับ | `TECH-STACK.md` หัวข้อ 2 (constraint table) + §1 ข้อ 3; เทียบกับ `HIGH-LEVEL-ARCHITECTURE.md` Decision Log ข้อ 1 (เลือกใช้ Google Sheet/Drive ก่อนมี Database จริง) | ⚠️ ความเสี่ยง (สำคัญ) | Google Sheet/Drive เป็นบริการของ Google ซึ่งโดยค่าเริ่มต้นไม่ได้ยืนยันว่าข้อมูลจะถูกเก็บในศูนย์ข้อมูลประเทศไทยเสมอ (ขึ้นกับการตั้งค่าระดับองค์กรที่ยังไม่ได้ยืนยัน) — การใช้ Google Sheet/Drive เก็บ "ข้อมูลที่ยืนยันแล้ว" (รวมข้อมูลสุขภาพ) ในช่วง Phase 1-6 (ก่อนมี Database จริงใน Phase 7) **อาจขัดแย้งโดยตรง**กับเงื่อนไข PDPA data residency ที่ยืนยันไว้แล้วใน `TECH-STACK.md` — ยังไม่มีเอกสารใดยืนยันว่า Google Workspace ที่จะใช้มี data residency guarantee ในไทยหรือไม่ ก่อนนำไปใช้กับข้อมูลสุขภาพจริง |
| Hosting/Infrastructure จริงต้องอยู่ในประเทศไทย | `TECH-STACK.md` §1 ข้อ 3 (ยืนยันทิศทางกว้าง) เทียบกับหัวข้อ 3 (สถานะ "ยังไม่สัมภาษณ์เจาะจง — backlog") | ⚠️ ความเสี่ยง | ทิศทางกว้าง (self-host on-prem/ศูนย์ข้อมูลราชการ) ตรงกับเงื่อนไข PDPA แล้ว แต่ยังไม่ได้ยืนยันแพลตฟอร์มจริงเจาะจง — ความเสี่ยงคือถ้าเลือกผิดตอนสัมภาษณ์รอบหน้าอาจขัดกับเงื่อนไขนี้ ต้องตรวจซ้ำตอนยืนยัน |
| PDPA review ของข้อมูลสุขภาพผ่าน 3rd-party API (โดยเฉพาะ chatbot อสม., รูปภาคสนาม) | `ROADMAP.md` Phase 8 (Security testing) | 🔲 Gap | ยังไม่มีการทดสอบ/ตรวจสอบจริง — มีแค่ business rule เชิง design (จำกัดสิทธิ์ chatbot) แต่ยังไม่ผ่านการตรวจสอบ compliance อย่างเป็นทางการ — หมายเหตุ 2026-10-24 (OCR ของ Case Intake `FEAT-INTAKE-05`): OCR ปัจจุบันทำฝั่ง client (Tesseract.js + pdf.js ในเบราว์เซอร์ผู้ใช้) ไฟล์ไม่ถูกส่งออกนอกเครื่องไป AI/บริการภายนอก จึงลดความเสี่ยง PDPA ของเส้นทาง OCR; ฟิลด์เลขประจำตัวประชาชนใน OCR Review เป็นข้อมูลอ่อนไหวและไม่ส่งให้ AI assist; ส่วนเส้นทาง Claude Vision ผ่านบริการเซิร์ฟเวอร์ (backlog) เมื่อทำจริงจะส่งไฟล์เคสไปบริการ AI ภายนอก ต้องประเมิน NFR/PDPA ใหม่ก่อนใช้งาน (ยังไม่มี NFR ต้นทางรองรับ — ไม่ตั้งเป้าใหม่ในรอบนี้) |
| Retention period ของข้อมูลสุขภาพ | `TECH-STACK.md` §1 ข้อ 4 ("ยังไม่สัมภาษณ์รายละเอียดเจาะจง") | 🔲 Gap | ไม่มีเป้าหมายเจาะจงในเอกสารใดของโปรเจกต์ |

### Accessibility

| จุดที่ตรวจ | NFR ต้นทาง (อ้างอิงแหล่ง) | สถานะ | รายละเอียด |
|---|---|---|---|
| WCAG AA contrast ratio (4.5:1 body text, 3:1 heading ใหญ่) | `DESIGN.md` หัวข้อ 2.1 | 🔲 Gap (ในขอบเขตเอกสารที่ทวนสอบรอบนี้) | เป้าหมายนี้มีต้นทางชัดเจนใน `DESIGN.md` แต่ **ไม่มีข้อความใดในทั้ง 4 เอกสาร** (`HIGH-LEVEL-ARCHITECTURE.md`/`DATA-MODEL.md`/`API-SPEC.md`/`DETAILED-DESIGN.md`) อ้างอิงหรือยืนยันการปฏิบัติตามเลย — เอกสารทั้ง 4 ฉบับเป็นระดับ backend/conceptual ไม่ใช่ UI design จึงไม่มีจุดให้เทียบโดยตรง ต้องตรวจสอบแยกกับ `prototypes/v1/` และ `DESIGN.md` เอง (นอกขอบเขตของเอกสาร 4 ฉบับนี้) |
| Accessibility audit เต็มรูปแบบด้วยเครื่องมือจริง | `ROADMAP.md` Phase 8 ("ปัจจุบันอ้างอิงตาม guideline ใน DESIGN.md แต่ยังไม่ได้ตรวจสอบจริงด้วยเครื่องมือ") | 🔲 Gap | ยังไม่ดำเนินการ ไม่มี tool/scope/timeline ที่ยืนยันแล้ว |

### Usability

| จุดที่ตรวจ | NFR ต้นทาง (อ้างอิงแหล่ง) | สถานะ | รายละเอียด |
|---|---|---|---|
| เกณฑ์ Usability เชิงวัดผลได้ (เช่น task success rate, เวลาที่ใช้เรียนรู้ระบบของ อสม./เจ้าหน้าที่, อัตราข้อผิดพลาดของผู้ใช้) | — | 🔲 Gap (ทั้งหมวด) | ไม่มีเอกสารใดในโปรเจกต์กำหนดเกณฑ์ Usability เชิงตัวเลข/วัดผลได้เลย — `DESIGN.md` หัวข้อ 4 มี "UX Guidelines & Rules" (เช่น หนึ่งหน้าจอเน้นหนึ่งเป้าหมาย, สีสถานะต้องคงความหมายเดียว) แต่เป็น**แนวทางออกแบบเชิงคุณภาพ (design guideline)** ไม่ใช่ NFR เชิงวัดผลได้ที่จะใช้ตัดสิน pass/fail — ไม่นับเป็นต้นทางของหมวดนี้โดยตรง |

---

## 3. สรุปตาม Feature ID / Component

| Feature ID / Component | หมวด NFR ที่กระทบ | สถานะโดยรวม |
|---|---|---|
| FEAT-PLATFORM-01 (Backend/API Server + Hosting) | Performance, Scalability, Compliance, Maintainability | ⚠️ ผสม — architecture เหมาะกับ scale เป้าหมาย แต่ hosting/scale ระยะยาว/contractor handover ยังเป็น open question |
| FEAT-PLATFORM-02 (Auth / Role-based Access) | Security | ⚠️ ความเสี่ยง — ไม่มี entity รองรับใน `DATA-MODEL.md` เลย ทั้งที่ `HIGH-LEVEL-ARCHITECTURE.md` อ้างถึง 6 บทบาทชัดเจน |
| FEAT-CONTROL-02 (Approval Request — decided_by_name) | Security | ⚠️ ความเสี่ยง — `decided_by_name` เก็บเป็น free-text ชั่วคราวแทน reference ไปยัง USER entity (gap เดียวกับ FEAT-PLATFORM-02 ด้านบน — รอ backlog ระบบ login/role ที่ `ROADMAP.md` บรรทัด 70) |
| FEAT-PLATFORM-03 (Database) | Availability/Reliability, Compliance | 🔲 Gap — engine ยังไม่ยืนยัน กระทบทั้ง resilience strategy และ data residency ที่ต้องตรวจซ้ำ |
| FEAT-INTAKE-06 (Google Sheet/Drive interim storage) | Compliance | ⚠️ ความเสี่ยง (สำคัญ) — อาจขัดแย้งกับ PDPA data residency |
| FEAT-INTAKE-08 / FEAT-ASM-04 (LINE OA notification) | Compliance, Performance | ⚠️ ความเสี่ยง — quota + PDPA data transmission ยังไม่ผ่านการทบทวน |
| FEAT-ANALYSIS-03 / FEAT-ANALYSIS-06 (Chatbot อสม.) | Security, Compliance | ✅ สอดคล้อง — ข้อจำกัดสิทธิ์ระบุชัดตรงกันทุกเอกสาร |
| FEAT-CONTROL-04 / FEAT-CONTROL-05 (LIFF tracking, AI Vision QC) | Compliance | ✅ สอดคล้อง — วิธีจัดการ EXIF/geotag ตรงกับ Decision Log |
| FEAT-DASH-*, FEAT-ALERT-03, FEAT-REPORT-03 (real-time sync) | Performance | ⚠️ ความเสี่ยง — กลไก polling 5-30 วินาทียังไม่ถูก sync เข้า `DETAILED-DESIGN.md` |
| FEAT-ALERT-01/02 (Alert assign & close) | Compliance (audit trail) | ✅ สอดคล้อง — human-in-the-loop + close_note บังคับตรงตามหลักการ |
| ทั้งระบบ (cross-cutting) | Accessibility, Usability, Availability/Reliability, Maintainability (monitoring) | 🔲 Gap — ไม่มีเป้าหมายเชิงเทคนิค/ตัวเลขในเอกสารที่ทวนสอบได้ ต้องสัมภาษณ์เพิ่ม |

---

## 4. รายชื่อ Gap ที่ต้องปิดเพิ่ม

| Gap | หมวด NFR | ข้อเสนอแนะ |
|---|---|---|
| ไม่มี response time/throughput target เจาะจง | Performance | (ข้อเสนอแนะ) กำหนดเกณฑ์ตอนเริ่มทำ Performance testing จริงใน Phase 8 หรือสัมภาษณ์เพิ่มผ่าน `tech-stack-builder` รอบ 2 |
| Performance testing ยังไม่ได้ดำเนินการ | Performance | (ข้อเสนอแนะ) ดำเนินการตาม `ROADMAP.md` Phase 8 หลัง Backend จริง (Phase 7) เสร็จ กำหนด metric ที่วัดได้ก่อนเริ่ม (เช่น response time ต่อ operation หลัก) |
| Encryption at rest / การเข้าถึงข้อมูลสุขภาพยังไม่ยืนยัน | Security, Compliance | (ข้อเสนอแนะ) สัมภาษณ์ผ่าน `tech-stack-builder` รอบ 2 หมวด Compliance/ความปลอดภัยที่ระบุไว้แล้วว่ายังไม่ถาม (`TECH-STACK.md` §1 ข้อ 4) |
| วิสัยทัศน์ระยะยาว (multi-tenancy) ยังไม่สัมภาษณ์ | Scalability | (ข้อเสนอแนะ) สัมภาษณ์ผ่าน `tech-stack-builder` รอบ 2 ตาม checklist ที่ค้างไว้แล้วใน `ROADMAP.md` Phase 7 แล้วปรับ `DATA-MODEL.md` ตามผล |
| Hosting/Infrastructure platform เจาะจงยังไม่ยืนยัน | Scalability, Compliance | (ข้อเสนอแนะ) สัมภาษณ์ผ่าน `tech-stack-builder` รอบ 2 — ต้องตรวจสอบด้วยว่าตัวเลือกที่ได้ยังคงตอบโจทย์ PDPA data residency |
| ไม่มี Uptime/SLA target | Availability/Reliability | (ข้อเสนอแนะ) สัมภาษณ์เพิ่มผ่าน `tech-stack-builder` รอบ 2 เนื่องจากยังไม่เคยถามหัวข้อนี้เลยในทุกรอบที่ผ่านมา |
| ไม่มี Backup/Disaster Recovery (RTO/RPO) target เจาะจง | Availability/Reliability | (ข้อเสนอแนะ) สัมภาษณ์เพิ่มคู่กับหัวข้อ Compliance/retention period ใน `tech-stack-builder` รอบ 2 |
| Database resilience/replication strategy ยังออกแบบไม่ได้ | Availability/Reliability | (ข้อเสนอแนะ) รอผล `tech-stack-builder` รอบ 2 (ยืนยัน Database engine ก่อน) แล้วจึงออกแบบ resilience strategy เป็นงานแยก |
| ไม่มี error handling สำหรับบริการภายนอกล่ม (network/timeout) ใน `DETAILED-DESIGN.md` | Availability/Reliability | (ข้อเสนอแนะ) ถ้าต้องการครอบคลุมเพิ่ม ให้ขยายขอบเขต Build Plan ของ `detailed-design-builder` รอบถัดไปให้รวม error ทั่วไปที่ปัจจุบันถูกยกเว้นไว้ตามหัวข้อ 0 ของเอกสารนั้น |
| Monitoring/Logging ยังไม่ยืนยัน | Maintainability | (ข้อเสนอแนะ) สัมภาษณ์ผ่าน `tech-stack-builder` รอบ 2 (ระบุใน `TECH-STACK.md` หัวข้อ 3 ว่าเป็น backlog) |
| PDPA review ของข้อมูลสุขภาพผ่าน 3rd-party API ยังไม่ดำเนินการจริง | Compliance | (ข้อเสนอแนะ) ดำเนินการ Security testing ตาม `ROADMAP.md` Phase 8 โดยเฉพาะ chatbot อสม. (Phase 2) และรูปภาคสนาม (Phase 3-4) ก่อนใช้งานจริง — และเพิ่มเส้นทาง OCR ด้วย Claude Vision ผ่านเซิร์ฟเวอร์ (`FEAT-INTAKE-05`, backlog) เข้าขอบเขตทบทวนเมื่อเริ่มทำจริง (OCR ฝั่ง client ปัจจุบันไม่ส่งไฟล์ออกนอกเครื่อง) |
| Retention period ของข้อมูลสุขภาพยังไม่ยืนยัน | Compliance | (ข้อเสนอแนะ) สัมภาษณ์ผ่าน `tech-stack-builder` รอบ 2 ควบคู่กับหัวข้อ encryption at rest |
| WCAG AA contrast ยังไม่ถูกตรวจสอบ/อ้างอิงในเอกสาร technical design ที่ทวนสอบ | Accessibility | (ข้อเสนอแนะ) ตรวจสอบแยกกับ `prototypes/v1/` เทียบ `DESIGN.md` โดยตรง (อยู่นอกขอบเขตของ 4 เอกสารนี้) แล้วอัปเดตผลผ่านช่องทางที่เหมาะสม |
| Accessibility audit เต็มรูปแบบยังไม่ดำเนินการ | Accessibility | (ข้อเสนอแนะ) ดำเนินการตาม `ROADMAP.md` Phase 8 ด้วยเครื่องมือตรวจสอบจริง (เช่น axe, WAVE) กำหนด scope/timeline ให้ชัดก่อนเริ่ม |
| ไม่มี Usability NFR เชิงวัดผลได้ทั้งหมวด | Usability | (ข้อเสนอแนะ) สัมภาษณ์เพิ่มผ่าน `tech-stack-builder` หรือ `release-plan-builder` รอบหน้าเพื่อกำหนดเกณฑ์ที่วัดผลได้ (เช่น task success rate ของ อสม./เจ้าหน้าที่, เวลาเรียนรู้ระบบ) |

### ความเสี่ยงสำคัญที่ควรติดตามควบคู่กัน (ไม่ใช่ Gap แต่มีต้นทางชัดเจน — สรุปจากตารางหัวข้อ 2)

- **Google Sheet/Drive vs PDPA data residency** (Compliance) — เป็นข้อขัดแย้งที่มีนัยสำคัญที่สุดที่พบในรอบนี้ ควรตรวจสอบก่อนใช้งานจริงกับข้อมูลสุขภาพจริงใน Phase 1
- **RBAC/Auth ไม่มี entity รองรับใน `DATA-MODEL.md`** (Security) — ต้องออกแบบเพิ่มก่อนเริ่ม Phase 7
- **กลไก polling 5-30 วินาที ยังไม่ sync เข้า `DETAILED-DESIGN.md`** (Performance) — ต้องเรียก `detailed-design-builder` ซ้ำเพื่อ sync เมื่อพร้อม
- **Contractor handover open question** (Maintainability) — กระทบความเหมาะสมของ Node.js+Express ที่เลือกไว้ ถ้าตอบว่าจะส่งต่อผู้รับเหมาภายนอก

---

## Assumption ที่ผู้เขียนตัดสินใจเอง (ให้ผู้ใช้ตรวจทาน)

- ใช้เนื้อหาของ `HIGH-LEVEL-ARCHITECTURE.md` เอง (เช่น component breakdown, Decision Log) เป็นทั้ง "NFR ต้นทาง" (ตามที่ระบุไว้ชัดในหัวข้อ 4 ของไฟล์นั้น) และเป็น "เอกสาร design ที่ถูกทวนสอบ" ในบางจุด — จำเป็นเพื่อตรวจสอบความสอดคล้อง cross-document (เช่น เทียบ Decision Log ข้อ 1 กับ `TECH-STACK.md` เรื่อง data residency) ไม่ได้ถือเป็นการเดาเป้าหมาย NFR ขึ้นใหม่
- จัดหมวด "Real-time sync polling 5-30 วินาที" เป็น Performance ตามที่ `TECH-STACK.md` เขียนไว้ (แม้จะอ้าง Feature ID FEAT-REPORT-03 ซึ่งดูเหมือนเกี่ยวกับ Reporting aggregation มากกว่า real-time sync ตรงๆ) — ใช้ตามคำต่อคำที่ระบุไว้ในเอกสารต้นทางโดยไม่ตีความเพิ่ม
- ถือว่า Accessibility และ Usability ไม่มีจุดเปรียบเทียบโดยตรงในเอกสาร 4 ฉบับที่ทวนสอบ (เพราะเป็นเอกสาร backend/conceptual ไม่ใช่ UI design) จึงระบุเป็น Gap ในขอบเขตของเอกสารเหล่านี้ แทนที่จะข้ามหมวดไปเฉยๆ ตามที่ Build Plan กำหนดให้ครอบทุกหมวดแม้จะเป็น Gap ทั้งหมวด
- ไม่ได้นับ `DESIGN.md` หัวข้อ 4 (UX Guidelines & Rules) เป็นต้นทางของ Usability NFR เพราะเป็นแนวทางออกแบบเชิงคุณภาพ ไม่ใช่เกณฑ์ที่วัดผล pass/fail ได้ — ถ้าผู้ใช้เห็นว่าควรนับเป็นต้นทางบางส่วน แจ้งได้เพื่อปรับสถานะ
