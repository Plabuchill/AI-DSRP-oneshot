# Feature List — AI-DSRP

รวบรวมจาก 2 แหล่ง ตามที่ [[../../../ROADMAP.md|ROADMAP.md]] ระบุไว้เป็นต้นทางอยู่แล้ว:

- **Requirement** — pain point 5 ข้อจากทีมงานจริง (โรงพยาบาล/เทศบาล, ทีมสอบสวนโรค, ทีมควบคุมโรค/ทีมพ่น, ทีม อสม., ผู้บริหาร) ที่รวบรวมไว้ใน ROADMAP.md
- **Product Backlog** — ROADMAP.md Phase 0-8 (feature ที่ทำเป็น prototype แล้ว + feature ที่ยังต้องเชื่อมต่อจริงในอนาคต)

Feature ID ในเอกสารนี้เป็นการตั้งขึ้นใหม่เพื่อ traceability (ไม่เคยมีมาก่อน) — ใช้ prefix `FEAT-<โมดูล>` สำหรับฟีเจอร์ระดับหน้า/โมดูล และ `FEAT-<โมดูล>-NN` สำหรับฟีเจอร์ย่อยระดับ UI section (ที่ตรงกับ `FR-DASH-NN` ที่มีอยู่แล้วใน [[../../03-testing/01-test-plan/v1/ACCEPTANCE-CRITERIA|ACCEPTANCE-CRITERIA.md]] สำหรับโมดูล Dashboard — ตั้งใจให้ตรง 1:1 กับของเดิม ไม่ใช่สร้างเลขใหม่ซ้อน)

## สถานะ

- ✅ **Prototype แล้ว** — มี UI คลิกได้จริงใน `prototypes/v1/` (mock data ทั้งหมด ไม่มี backend จริง)
- 🔲 **Backlog** — ยังไม่ได้ทำ ระบุไว้เป็นแผนใน ROADMAP.md

## FEAT-DASH — Outbreak Dashboard

หน้า: `prototypes/v1/index.html` · Requirement ต้นทาง: ภาพรวมสถานการณ์ระบาดสำหรับผู้บริหาร/เจ้าหน้าที่เฝ้าระวัง

| Feature ID | ชื่อฟีเจอร์ | คำอธิบาย | สถานะ |
|---|---|---|---|
| FEAT-DASH-01 | Navigation (Left Rail) | wordmark, active state, เมนู placeholder ของหน้าอื่นที่ยังไม่เปิดใช้ | ✅ |
| FEAT-DASH-02 | Stat Tiles | รายใหม่วันนี้, รายใหม่นอกพื้นที่, ในพื้นที่สะสม, นอกพื้นที่สะสม, รวมผู้ป่วยสะสม (5 การ์ด แทน KPI Cards เดิม 4 การ์ด) | ✅ |
| FEAT-DASH-03 | Zone Risk Grid | 4 เขตบริการ (ครอบคลุมชุมชนย่อยรวม 63 ชุมชน) ระบายสีตามระดับความเสี่ยง (ปกติ/เฝ้าระวัง/วิกฤต) พร้อม accordion ขยายดูรายชื่อชุมชน/ทีมสอบสวนโรคที่รับผิดชอบต่อเขต | ✅ |
| FEAT-DASH-04 | Trend Chart | กราฟแนวโน้มรายสัปดาห์ทั้งปีเทียบค่ามัธยฐานปีก่อน + กราฟแนวโน้มเคสรายวัน (7/14/30 วันล่าสุด) พร้อมเส้นค่าเฉลี่ยเคลื่อนที่ 3 วัน (2 กราฟ) | ✅ |
| FEAT-DASH-05 | Recent Alerts Panel | รายการแจ้งเตือนล่าสุด พร้อม severity badge | ✅ |
| FEAT-DASH-06 | Filter | กรองตามโรค/เขตบริการ/ช่วงวันที่ ทุก panel ในหน้า (FEAT-DASH-02, 03, 04, 05, 07 ถึง 15) อัปเดตพร้อมกัน | ✅ |
| FEAT-DASH-07 | อัตราป่วยต่อแสนประชากร | การ์ดคำนวณจาก mock population ต่อเขตบริการ เทียบเคสสะสมในช่วงที่กรอง | ✅ |
| FEAT-DASH-08 | ตารางแยกตามเพศ | จำนวนเคส/ร้อยละ/สัดส่วน (progress bar) แยกชาย-หญิง | ✅ |
| FEAT-DASH-09 | ตารางกลุ่มอายุ | 5 ช่วงอายุ พร้อมจำนวนเคส/ร้อยละ/อัตราป่วยต่อแสนปกครองต่อช่วงอายุ | ✅ |
| FEAT-DASH-10 | สถิติอายุผู้ป่วย | การ์ดอายุมากที่สุด/มัธยฐาน/น้อยที่สุด | ✅ |
| FEAT-DASH-11 | การวินิจฉัยโรค (DF/DHF) | Donut chart สัดส่วน DF/DHF — แสดงเฉพาะเมื่อกรองโรค = ไข้เลือดออก | ✅ |
| FEAT-DASH-12 | ตารางอาชีพ | จำนวนเคส/ร้อยละแยกตามหมวดอาชีพ | ✅ |
| FEAT-DASH-13 | ตารางชุมชนที่มีจำนวนเคสสูงสุด | Top 8 ชุมชนตามจำนวนเคสสะสม พร้อมเขตบริการ/ทีมสอบสวนโรค/ร้อยละ | ✅ |
| FEAT-DASH-14 | ตารางเขตบริการเรียงตามอัตราป่วย | 4 เขตบริการ พร้อมจำนวนเคส/ประชากร/อัตราป่วยต่อแสนประชากร เรียงจากสูงไปต่ำ | ✅ |
| FEAT-DASH-15 | ตารางป่วยจาก | เริ่มป่วยจากนอกพื้นที่ (สะสม) และรายใหม่ไม่อยู่ในพื้นที่เกิน 100 เมตร พร้อมจำนวน/ร้อยละ | ✅ |

> **อัปเดต 2026-08-23**: `FEAT-DASH-02`/`04` แก้คำอธิบายให้ตรงกับ Dashboard เวอร์ชันปัจจุบัน (เดิมยังบรรยายตาม KPI Cards/กราฟรายวันเวอร์ชันก่อนปรับ) และเพิ่ม `FEAT-DASH-07` ถึง `15` สำหรับ panel วิเคราะห์เชิงลึกที่เพิ่มเข้ามาใหม่ — **panel เหล่านี้ยังไม่มี test case ใน Test Spec ด้านล่าง** (FR-DASH มีแค่ 01 ถึง 06) ต้องปรับปรุง Test Spec แยกเป็นงานต่างหาก
>
> Test Spec ของโมดูลนี้: [[../../03-testing/01-test-plan/v1/TEST-PLAN|TEST-PLAN.md]] / [[../../03-testing/01-test-plan/v1/ACCEPTANCE-CRITERIA|ACCEPTANCE-CRITERIA.md]] — FR-DASH-01 ถึง 06 ตรงกับ FEAT-DASH-01 ถึง 06 ข้างต้นแบบ 1:1 (FEAT-DASH-07 ถึง 15 ยังไม่มี FR- คู่กัน)
> User Journey ของโมดูลนี้: [[../../02-design/01-prototypes/USER-JOURNEY-outbreak-dashboard|USER-JOURNEY-outbreak-dashboard.md]]

## FEAT-INTAKE — Case Intake

หน้า: `prototypes/v1/case-intake.html` · Requirement ต้นทาง: ข้อมูลรายงานโรคจากโรงพยาบาลอยู่ในรูป PDF/JPEG จำนวนมาก ต้องแปลงเป็นข้อมูลใช้งานได้เร็วขึ้น

| Feature ID | ชื่อฟีเจอร์ | คำอธิบาย | สถานะ |
|---|---|---|---|
| FEAT-INTAKE-01 | Upload Panel | mock drag-drop อัปโหลด PDF/JPEG | ✅ |
| FEAT-INTAKE-02 | OCR Review Table | ตรวจสอบ/แก้ไขผล OCR ก่อนยืนยัน (human-in-the-loop) | ✅ |
| FEAT-INTAKE-03 | Notification Log | แจ้งเตือนทีมสอบสวนโรค 5 เขตตามพื้นที่ | ✅ |
| FEAT-INTAKE-04 | Spot Map | ปักหมุด + วงรัศมี 100 เมตรจากพิกัด | ✅ |
| FEAT-INTAKE-05 | OCR/AI extraction เชื่อมต่อจริง | แทน mock ด้วย Document AI/vision model จริง | 🔲 (Phase 1) |
| FEAT-INTAKE-06 | Google Sheet/Drive เชื่อมต่อจริง | เขียนข้อมูล+ไฟล์ต้นฉบับอัตโนมัติ | 🔲 (Phase 1) |
| FEAT-INTAKE-07 | Geocoding API จริง | แปลงที่อยู่เป็นพิกัดจริง | 🔲 (Phase 1) |
| FEAT-INTAKE-08 | LINE OA แจ้งเตือนจริง | แทน mock notification log | 🔲 (Phase 1) |
| FEAT-INTAKE-09 | แก้ไขแถวที่ยืนยันแล้ว | unlock/ขอสิทธิ์แก้ไขข้อมูลที่ confirm ไปแล้ว | 🔲 (Phase 1) |
| FEAT-INTAKE-10 | AI Consistency Check | ปุ่มระดับแถวใน OCR Review Table ส่งข้อมูลที่ OCR ดึงได้ (ชื่อ/HN/ที่อยู่/วันป่วย/ผลตรวจ — ไม่ใช่ไฟล์ต้นฉบับ) ให้ AI (Claude) ช่วยตรวจสอบความสมเหตุสมผลก่อนเจ้าหน้าที่กดยืนยัน เป็น advisory เท่านั้น ไม่แก้ข้อมูลอัตโนมัติ (human-in-the-loop) | 🔲 (Phase 1) |
| FEAT-INTAKE-11 | AI ช่วยจัดประเภทโรคติดต่อ | ปุ่มระดับแถวใน OCR Review Table (เพิ่มจากปุ่ม FEAT-INTAKE-10) ส่งค่าที่กรอก/OCR ได้ (เช่น ผลตรวจ) ไปพร้อมรายชื่อประเภทโรคติดต่อจริงจาก 506Types ให้ AI แนะนำ/เลือกประเภทที่ตรงที่สุด กรอกลง field ใหม่ "ประเภทโรคติดต่อ" (dropdown ผูก 506Types) เป็น advisory เท่านั้น แบบ in-memory ไม่ persist ลง Firestore (Case Intake ยังไม่มี Firestore backing สำหรับเคส) | 🔲 (Phase 1) |

## FEAT-ANALYSIS — Case Analysis

หน้า: `prototypes/v1/case-analysis.html` · Requirement ต้นทาง: ทีมสอบสวนโรคต้องการ AI ช่วยเชื่อมโยงเคสและร่างรายงาน

| Feature ID | ชื่อฟีเจอร์ | คำอธิบาย | สถานะ |
|---|---|---|---|
| FEAT-ANALYSIS-01 | Case Cluster Map | แสดง cluster ที่ AI เสนอ พร้อมยืนยัน (human-in-the-loop) | ✅ |
| FEAT-ANALYSIS-02 | ร่างรายงานสอบสวนโรค | generate จากข้อมูล cluster ให้แก้ไขต่อ | ✅ |
| FEAT-ANALYSIS-03 | Chatbot ประสานงาน อสม. | บทสนทนาตัวอย่าง (scripted demo) | ✅ |
| FEAT-ANALYSIS-04 | Case clustering จริง | statistical/spatial-temporal clustering แทน pre-group mock | 🔲 (Phase 2) |
| FEAT-ANALYSIS-05 | AI ร่างรายงานจริง | ดึงข้อมูลดิบจริงมาร่าง แทน template คงที่ | 🔲 (Phase 2) |
| FEAT-ANALYSIS-06 | Chatbot จริง (จำกัดสิทธิ์) | นัดหมาย/แจ้งพื้นที่เท่านั้น ห้ามส่งข้อมูลเคสละเอียด (PDPA) | 🔲 (Phase 2) |
| FEAT-ANALYSIS-07 | บันทึกและยืนยัน รง.506 | เจ้าหน้าที่สอบสวนโรคสร้างรายการ "รง.506" (รายงานผู้ป่วยเฝ้าระวังโรค) เลือก "โรคติดต่อ" ได้ต่อรายการ มีสถานะ "รอพิจารณา" → "ยืนยัน"/"ไม่ยืนยัน" โดยเจ้าหน้าที่สอบสวนโรคเป็นผู้กดเปลี่ยนสถานะเอง | 🔲 (Phase 2) |
| FEAT-ANALYSIS-08 | AI ช่วยเลือกโรคติดต่อ | ตอนสร้างรายงาน รง.506 วิเคราะห์ข้อความหัวเรื่อง/เหตุผลที่กรอก แล้วเสนอโรคติดต่อที่ตรงที่สุดจากลิสต์ 506Types จริงเท่านั้น (ไม่ตรงเลยแจ้งว่าจัดหมวดหมู่ให้ไม่ได้ ไม่เปลี่ยนค่าเดิม) ผู้ใช้ตรวจสอบ/แก้ไขได้เสมอก่อนบันทึก เรียกไม่สำเร็จ/timeout ไม่บล็อกการบันทึกด้วยมือ | 🔲 (Phase 2) |
| FEAT-ANALYSIS-09 | AI สรุปแนวโน้มโรค | ในหน้ารายละเอียด รง.506 (506-request-detail.html) เฉพาะ Manager เห็นปุ่ม กดแล้วนับจำนวนรายงาน รง.506 ที่เป็นโรคเดียวกันในช่วง 7 วันย้อนหลังจาก startDate ของรายงานนี้ แล้วให้ AI (Claude) เขียนสรุปสั้นๆ กลับเป็น field ใหม่ในเอกสารนั้น (`aiSummary`) ให้ Manager อ่านประกอบการตัดสินใจก่อนกดยืนยัน/ไม่ยืนยัน | 🔲 (Phase 2) |

> **อัปเดต 2026-09-06**: เพิ่ม `FEAT-ANALYSIS-07` จาก `PAIN-INVESTIGATION-01` ใน REQUIREMENTS.md — ยังไม่มี UI ใน `prototypes/v1/case-analysis.html` และยังไม่มี FR-ANALYSIS test spec คู่กัน (รอ qa-doc-builder)

## FEAT-CONTROL — Control Plan

หน้า: `prototypes/v1/control-plan.html` · Requirement ต้นทาง: ทีมควบคุมโรคต้องการ auto-generate เอกสารขออนุมัติ + แผนปฏิบัติงาน

| Feature ID | ชื่อฟีเจอร์ | คำอธิบาย | สถานะ |
|---|---|---|---|
| FEAT-CONTROL-01 | ร่างแผนปฏิบัติงานควบคุมโรค | มอบหมายทีมพ่น, Day 0/1/7, ติดตามสถานะพ่นแล้ว | ✅ |
| FEAT-CONTROL-02 | ร่างใบขออนุมัติเบิกน้ำมัน/น้ำยาเคมี | ตรงฟอร์มจริงของหน่วยงาน, ส่ง/อนุมัติ/พิมพ์ PDF | ✅ |
| FEAT-CONTROL-03 | Auto-generate ผูก workflow อนุมัติจริง | ผู้บริหารเซ็นได้เลยจากระบบ | 🔲 (Phase 3) |
| FEAT-CONTROL-04 | Real-time tracking ทีมพ่น | เทียบ spot map วางแผนไว้ (ต้องใช้แอป LIFF แยก) | 🔲 (Phase 3) |
| FEAT-CONTROL-05 | AI vision QC รูปภาคสนามจริง | ตรวจพื้นที่/เวลาจริงจากภาพ (ต้องเก็บพิกัดตอนถ่ายผ่านแอป) | 🔲 (Phase 3) |

## FEAT-TRACK — Field Tracking

หน้า: `prototypes/v1/field-tracking.html`

| Feature ID | ชื่อฟีเจอร์ | คำอธิบาย | สถานะ |
|---|---|---|---|
| FEAT-TRACK-01 | Real-time Tracking (mock) | ตำแหน่ง/สถานะทีมพ่นบน spot map | ✅ |
| FEAT-TRACK-02 | AI Vision QC (mock) | badge ผลตรวจพิกัด/เวลา | ✅ |

## FEAT-ASM — ASM Coordination

หน้า: `prototypes/v1/asm-coordination.html` · Requirement ต้นทาง: ทีม อสม. ต้องการ AI vision จัดหมวดหมู่รูป + แจ้งเตือนล่วงหน้าอัตโนมัติ

| Feature ID | ชื่อฟีเจอร์ | คำอธิบาย | สถานะ |
|---|---|---|---|
| FEAT-ASM-01 | Photo Intake (mock) | AI จัดหมวดหมู่ตามพื้นที่/วันที่ | ✅ |
| FEAT-ASM-02 | คิวแจ้งเตือนล่วงหน้า (mock) | preview ข้อความ LINE ก่อนวันที่ 0/7 | ✅ |
| FEAT-ASM-03 | รับรูปจาก LINE OA จริง | เก็บลง Sheet/Drive อัตโนมัติ | 🔲 (Phase 4) |
| FEAT-ASM-04 | ส่งแจ้งเตือน LINE จริง | scheduled message ผ่าน LINE Messaging API | 🔲 (Phase 4) |

## FEAT-REPORT — Reports

หน้า: `prototypes/v1/reports.html`

| Feature ID | ชื่อฟีเจอร์ | คำอธิบาย | สถานะ |
|---|---|---|---|
| FEAT-REPORT-01 | KPI Summary (mock) | สรุปจำนวนเคส/HI-CI/สถานะควบคุมโรค | ✅ |
| FEAT-REPORT-02 | สร้าง/ส่งรายงาน (mock) | ส่งผ่าน LINE/ดาวน์โหลด PDF | ✅ |
| FEAT-REPORT-03 | รวมข้อมูล real-time จริงจากทุกทีม | ต้องรอ Phase 1-4 เสร็จก่อน | 🔲 (Phase 5) |

## FEAT-ALERT — Alerts

หน้า: `prototypes/v1/alerts.html`

| Feature ID | ชื่อฟีเจอร์ | คำอธิบาย | สถานะ |
|---|---|---|---|
| FEAT-ALERT-01 | ตารางแจ้งเตือน + มอบหมายงาน | ต่อยอดจาก mock alert 8 รายการ | ✅ |
| FEAT-ALERT-02 | อัปเดตสถานะ/ปิดเคส | ต้องบันทึกสรุปก่อนปิด (human-in-the-loop) | ✅ |
| FEAT-ALERT-03 | เชื่อมข้อมูล real-time กับ Dashboard | แทน mock data คนละชุด | 🔲 (Phase 6) |

## FEAT-PLATFORM — Platform Foundations

Requirement ต้นทาง: โครงสร้างพื้นฐานที่ทุกโมดูลต้องพึ่งพาก่อนใช้งานจริง

| Feature ID | ชื่อฟีเจอร์ | คำอธิบาย | สถานะ |
|---|---|---|---|
| FEAT-PLATFORM-01 | Backend/API จริง | แทนที่ mock data ที่ฝังในแต่ละหน้า | 🔲 (Phase 7) |
| FEAT-PLATFORM-02 | Login + Role-based Access | แยกสิทธิ์ 5 บทบาท (รพ./เทศบาล/สอบสวนโรค/ทีมพ่น/อสม./ผู้บริหาร) | 🔲 (Phase 7) |
| FEAT-PLATFORM-03 | Data Persistence/Database | เก็บประวัติเคส+ไฟล์ต้นฉบับระยะยาว | 🔲 (Phase 7) |
| FEAT-PLATFORM-04 | Performance Testing | หลังมี backend จริง | 🔲 (Phase 8) |
| FEAT-PLATFORM-05 | Security Testing (PDPA) | โดยเฉพาะ chatbot อสม. และรูปภาคสนาม | 🔲 (Phase 8) |
| FEAT-PLATFORM-06 | Accessibility Audit เต็มรูปแบบ | ตรวจสอบจริงด้วยเครื่องมือ (ปัจจุบันอ้างอิง DESIGN.md เท่านั้น) | 🔲 (Phase 8) |
