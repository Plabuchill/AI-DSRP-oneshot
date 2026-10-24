# Task List — AI-DSRP

อ้างอิงโครงจาก [[../../../ROADMAP.md|ROADMAP.md]] — เอกสารนี้แตก task จาก 13 รายการงานใหม่ที่พบระหว่างวิเคราะห์เอกสารทั้งหมด (FEATURE-LIST.md, HIGH-LEVEL-ARCHITECTURE.md, DATA-MODEL.md/API-SPEC.md, TECH-STACK.md, TEST-PLAN.md/ACCEPTANCE-CRITERIA.md) เทียบกับ `ROADMAP.md` ปัจจุบัน — 9 รายการแรกมาจากรอบสแกนแรก (ตาราง Component ↔ เทคโนโลยี ของ TECH-STACK.md) และ 4 รายการเพิ่มเติมมาจากรอบสแกนซ้ำที่พบใน Interview Summary ของ `TECH-STACK.md` และ scope note ของ `API-SPEC.md`/`DATA-MODEL.md`

## 1. ภาพรวม

- **Scope**: รวม 13 task ใหม่ (9 เดิม + 4 ใหม่จากรอบสแกนซ้ำ) — ไม่ใช่การแตก task ของ `ROADMAP.md` ทั้งฉบับ กระจายอยู่ใน Phase 1, 2, 3, 5, 7 ของโครง Phase 0-8 เดิม — ไม่มีการสร้าง Phase ใหม่
- **Granularity**: 1 รายการงานใหม่ต่อ 1 task (ไม่แตกย่อยกว่านี้ในรอบนี้)
- **วิธี prioritize**: ตามลำดับ Phase เดิมของ `ROADMAP.md` (ไม่ใช้ MoSCoW/weighted scoring)
- **ขอบเขตคอลัมน์**: task + Feature ID + สถานะ เท่านั้นที่มีข้อมูลจริง — คอลัมน์ผู้รับผิดชอบ/Deadline เว้นเป็น `—` ทุกแถวเพราะไม่มีข้อมูลมา (ห้ามเดา)
- สถานะทุก task ในรอบนี้ = "ยังไม่เริ่ม" เพราะเป็น task ใหม่ทั้งหมด (รวมทั้ง 4 รายการที่เพิ่งเพิ่ม)

> หมายเหตุ: รายการ "แก้ bullet Phase 0 ให้ระบุ FEAT-DASH-07..15" ไม่รวมอยู่ในตารางนี้ เพราะเป็นการแก้ไขคำบรรยายเดิมของ `ROADMAP.md` (doc correction) ไม่ใช่ task งานใหม่ — ดูรายละเอียดที่ `ROADMAP.md` Phase 0 โดยตรง

## 2. Task Table ต่อ Phase

### Phase 1 — Case Intake: เชื่อมต่อจริง (โรงพยาบาล → เทศบาล)

| Task | Feature ID | สถานะ | ผู้รับผิดชอบ | Deadline | หมายเหตุ |
|---|---|---|---|---|---|
| ยืนยัน OCR/Document AI vendor และ Geocoding vendor ผ่านการสัมภาษณ์ `tech-stack-builder` รอบ 2 | FEAT-INTAKE-05, FEAT-INTAKE-07 | ยังไม่เริ่ม | — | — | อ้างจาก `TECH-STACK.md` ตารางหัวข้อ 3 (สถานะ "ยังไม่สัมภาษณ์") — อัปเดต 2026-10-24: OCR ที่ใช้อยู่จริงตอนนี้คือ Tesseract.js ในเบราว์เซอร์ (ฟรี) ซึ่งยังไม่ผ่านการสัมภาษณ์/ยืนยันใน `TECH-STACK.md` ส่วนการอ่านลายมือด้วย vision model เป็น task backlog แยกด้านล่าง |
| สร้าง `DETAILED-DESIGN.md` สำหรับ flow OCR Review (human-in-the-loop) ก่อนเริ่ม implement จริง | FEAT-INTAKE-02, FEAT-INTAKE-05 | ยังไม่เริ่ม | — | — | ยังไม่มีไฟล์ `DETAILED-DESIGN.md` เลย ใช้ skill `detailed-design-builder` — อัปเดต 2026-10-24: flow ต้องสะท้อนโค้ดจริง (OCR ในเบราว์เซอร์ → OCR Review ฟิลด์ปัจจุบัน + แผงภาพต้นฉบับ → weak-OCR เปิดโหมดแก้ไขอัตโนมัติ → เจ้าหน้าที่ยืนยัน) |
| อัปเกรด Firebase เป็น Blaze + เปิดใช้ Claude Vision อ่านลายมือ/ช่องติ๊กใน Case Intake (Cloud Function `extractCaseReport` มีอยู่แล้วใน `functions/` แต่ UI ไม่เรียก) — ต้องประเมิน PDPA ก่อน เพราะไฟล์ต้นฉบับจะถูกส่งออกนอกเครื่อง | FEAT-INTAKE-05 | ยังไม่เริ่ม (backlog) | — | — | เพิ่ม 2026-10-24 ตามผู้ใช้ยืนยัน: ปัจจุบัน OCR = Tesseract.js ฟรีในเบราว์เซอร์ อ่านลายมือ/ช่องติ๊กไม่ได้ จึงต้องมีคนกรอกต่อเสมอ |
| เพิ่ม Error/Validation case แบบละเอียดใน `API-SPEC.md` | FEAT-INTAKE-* | ยังไม่เริ่ม | — | — | `API-SPEC.md` หัวข้อ 4 ระบุ "ไม่รวมในรอบนี้ตามที่ยืนยันไว้ในขอบเขตของ Build Plan" |

### Phase 2 — ทีมสอบสวนโรค: วิเคราะห์เคสและร่างรายงาน

| Task | Feature ID | สถานะ | ผู้รับผิดชอบ | Deadline | หมายเหตุ |
|---|---|---|---|---|---|
| ยืนยัน Case Clustering library/service ผ่าน `tech-stack-builder` รอบ 2 | FEAT-ANALYSIS-04 | ยังไม่เริ่ม | — | — | อ้างจาก `TECH-STACK.md` |
| สร้าง `DETAILED-DESIGN.md` สำหรับ flow Case Clustering decision (human-in-the-loop) | FEAT-ANALYSIS-01, FEAT-ANALYSIS-04 | ยังไม่เริ่ม | — | — | ยังไม่มีไฟล์ `DETAILED-DESIGN.md` ส่วนนี้ |

### Phase 3 — ทีมควบคุมโรค (ทีมพ่น)

| Task | Feature ID | สถานะ | ผู้รับผิดชอบ | Deadline | หมายเหตุ |
|---|---|---|---|---|---|
| ยืนยัน AI Vision QC vendor และ Location tracking (LIFF app) tech ผ่าน `tech-stack-builder` รอบ 2 | FEAT-CONTROL-04, FEAT-CONTROL-05 | ยังไม่เริ่ม | — | — | อ้างจาก `TECH-STACK.md` |

### Phase 5 — รายงานสรุปผู้บริหารอัตโนมัติ

| Task | Feature ID | สถานะ | ผู้รับผิดชอบ | Deadline | หมายเหตุ |
|---|---|---|---|---|---|
| ยืนยัน Reporting/BI tool ผ่าน `tech-stack-builder` รอบ 2 | FEAT-REPORT-03 | ยังไม่เริ่ม | — | — | อ้างจาก `TECH-STACK.md` |

### Phase 7 — Platform Foundations

| Task | Feature ID | สถานะ | ผู้รับผิดชอบ | Deadline | หมายเหตุ |
|---|---|---|---|---|---|
| Sync `HIGH-LEVEL-ARCHITECTURE.md` หัวข้อ 6 (Component Breakdown) ให้ระบุเทคโนโลยีจริงตาม `TECH-STACK.md` (แถว Web App/Frontend และ API Server/Backend) | FEAT-PLATFORM-01 | ยังไม่เริ่ม | — | — | อ้างจาก `TECH-STACK.md` หัวข้อ 5 ("เอกสาร Conceptual ที่ควร Sync ตาม") |
| ยืนยัน Database engine, Auth/Identity provider, Hosting/Infrastructure เจาะจง, Monitoring/Logging ผ่าน `tech-stack-builder` รอบ 2 | FEAT-PLATFORM-02, FEAT-PLATFORM-03 | ยังไม่เริ่ม | — | — | อ้างจาก `TECH-STACK.md` |
| ปิด open question เรื่องแผนส่งต่อให้ผู้รับเหมาภายนอกดูแลระบบในอนาคต (กระทบว่า Node.js+Express ที่ยืนยันไว้ยังเหมาะสมหรือควรเปลี่ยนไปทาง Laravel/.NET Core ที่ตลาดผู้รับเหมาไทยคุ้นเคยกว่า) | FEAT-PLATFORM-01 | ยังไม่เริ่ม | — | — | อ้างจาก `TECH-STACK.md` หัวข้อ 4.1 Decision Rationale (trade-off ที่บันทึกไว้) |
| สัมภาษณ์ `tech-stack-builder` เพิ่มเติม: Compliance/ความปลอดภัยเจาะจง (encryption at rest, retention period) | FEAT-PLATFORM-02, FEAT-PLATFORM-03 | ยังไม่เริ่ม | — | — | `TECH-STACK.md` หมวด 4 ของ Interview Summary ระบุ "ยังไม่สัมภาษณ์รายละเอียดเจาะจง" |
| สัมภาษณ์ `tech-stack-builder` เพิ่มเติม: Timeline/deadline ของโครงการ | — (cross-cutting/project-level ไม่มี Feature ID เฉพาะ) | ยังไม่เริ่ม | — | — | `TECH-STACK.md` หมวด 8 ของ Interview Summary ระบุ "ยังไม่สัมภาษณ์" |
| สัมภาษณ์ `tech-stack-builder` เพิ่มเติม: วิสัยทัศน์ระยะยาว (multi-tenancy) แล้วปรับขอบเขต Multi-tenancy ใน `DATA-MODEL.md` ตามผลที่ได้ | FEAT-PLATFORM-02, FEAT-PLATFORM-03 | ยังไม่เริ่ม | — | — | `TECH-STACK.md` หมวด 9 ("ยังไม่สัมภาษณ์รายละเอียด multi-tenancy") + `DATA-MODEL.md` หัวข้อ 3 Cross-cutting concerns ("Multi-tenancy: ไม่อยู่ใน scope ของ Build Plan รอบนี้") |

## 3. Estimation

ไม่รวมหัวข้อนี้ในรอบนี้ — Build Plan ไม่ได้ยืนยันขอบเขต estimation มา (ห้ามเดา)

## 4. Dependency ระหว่าง Task/Phase

| Task/Phase | ขึ้นกับ | เหตุผล |
|---|---|---|
| สร้าง `DETAILED-DESIGN.md` สำหรับ flow OCR Review (Phase 1) | ยืนยัน OCR/Document AI vendor และ Geocoding vendor (Phase 1) | `detailed-design-builder` อาจต้องอ้าง vendor จริงถ้ายืนยันแล้ว (Tech Stack Integration) |
| สร้าง `DETAILED-DESIGN.md` สำหรับ flow Case Clustering decision (Phase 2) | ยืนยัน Case Clustering library/service (Phase 2) | เหตุผลเดียวกัน — detailed design อ้าง vendor/library จริงได้แม่นยำกว่าถ้ายืนยันก่อน |
| Sync `HIGH-LEVEL-ARCHITECTURE.md` หัวข้อ 6 Component Breakdown (Phase 7) | ยืนยัน Database engine, Auth/Identity provider, Hosting/Infrastructure, Monitoring/Logging (Phase 7); สัมภาษณ์วิสัยทัศน์ระยะยาว (multi-tenancy) (Phase 7) | เพื่อให้ sync Component Breakdown ได้ครบทุกแถวในครั้งเดียว รวมผลกระทบจาก multi-tenancy (ถ้ามี) แทนที่จะต้อง sync ซ้ำหลายรอบ |

## 5. Traceability

| Phase | Feature ID ที่ครอบ | จำนวน Task |
|---|---|---|
| Phase 1 | FEAT-INTAKE-02, FEAT-INTAKE-05, FEAT-INTAKE-07, FEAT-INTAKE-* | 4 |
| Phase 2 | FEAT-ANALYSIS-01, FEAT-ANALYSIS-04 | 2 |
| Phase 3 | FEAT-CONTROL-04, FEAT-CONTROL-05 | 1 |
| Phase 5 | FEAT-REPORT-03 | 1 |
| Phase 7 | FEAT-PLATFORM-01, FEAT-PLATFORM-02, FEAT-PLATFORM-03 | 6 |

**รวม**: 14 task ใหม่ (9 เดิม + 4 ใหม่ + 1 backlog เพิ่ม 2026-10-24) ครอบ 5 Phase (1, 2, 3, 5, 7)

> **อัปเดต 2026-10-24**: sync Phase 1 ให้ตรงโค้ด Case Intake จริง — ปรับหมายเหตุ 2 task เดิม (OCR vendor, DETAILED-DESIGN OCR Review) และเพิ่ม 1 task backlog "อัปเกรด Blaze + เปิดใช้ Claude Vision อ่านลายมือ" (ผู้รับผิดชอบ/Deadline เว้น `—` ตามเดิม) — ตัวเลข "13 task" ในหัวข้อ 1 ด้านบนยังเป็นของรอบก่อน ไม่ได้ปรับ (ดูยอดรวมล่าสุดที่บรรทัดนี้)
