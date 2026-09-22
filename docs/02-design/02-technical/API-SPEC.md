# API Spec — AI-DSRP (ทั้งระบบ 8 โมดูล)

เอกสารนี้เป็น**conceptual API spec เท่านั้น** — ระบุ *operation* (การกระทำที่ระบบต้องรองรับ) ไม่ใช่ endpoint จริง ยังไม่ตัดสินว่าเป็น REST/GraphQL/RPC และไม่ระบุ auth mechanism เจาะจง เพราะยังไม่มีการยืนยันเทคโนโลยีมาในรอบนี้ อ้างอิงโครงจาก skill `data-contract-builder` (`references/data-contract-templates.md`) และ entity ตาม [[./DATA-MODEL|DATA-MODEL.md]]

ขอบเขต: ครอบคลุมทั้ง 8 โมดูลของระบบ — **Case Intake** (`FEAT-INTAKE-*`, เขียนไว้ก่อนหน้ารอบนี้ ไม่แก้เนื้อหาเดิม) มีระดับรายละเอียด Operation list + payload ตัวอย่างระดับ field (conceptual type) + **error/validation case แบบละเอียด (เพิ่มเข้ามา 2026-09-22 — ดูหัวข้อ 4)** — ส่วน **7 โมดูลใหม่** (Dashboard, Case Analysis, Control Plan, Field Tracking, ASM Coordination, Reports, Alerts) ขอบเขตที่ยืนยันแล้วมีเฉพาะ **Operation list** (Operation/Actor/วัตถุประสงค์/Input-Output เชิงแนวคิด) **ไม่รวม** payload ตัวอย่างระดับ field และ**ไม่รวม** error/validation case แบบละเอียดในรอบนี้

## 1. หลักการ Conceptual API

ทุก operation ระบุแบบ "actor ทำอะไรกับอะไร" — ยังไม่ผูกกับ HTTP verb, path, หรือ transport protocol ใดๆ

## 2. Operation List — Module: Case Intake (`FEAT-INTAKE-*`)

| Operation | Actor | วัตถุประสงค์ | Input (conceptual) | Output (conceptual) |
|---|---|---|---|---|
| 1. อัปโหลดไฟล์รายงานเคส | เจ้าหน้าที่ รพ./เทศบาล | สร้างเคสใหม่จากไฟล์รายงาน + ให้ OCR ดึงข้อมูลเติมเป็นค่าเริ่มต้น | ไฟล์ (PDF/JPEG), file_name, file_type | `CASE` ใหม่ (status = รอตรวจสอบ) + `CASE_ATTACHMENT` + `CASE_OCR_SNAPSHOT` |
| 2. ดึงรายการเคส (filter ตามสถานะ) | เจ้าหน้าที่ | แสดงตาราง OCR Review | filter: status (รอตรวจสอบ/ยืนยันแล้ว/ทั้งหมด), ช่วงวันที่ (optional) | list ของ `CASE` ที่ตรงตาม filter พร้อมข้อมูล `responsible_team`/`CASE_ATTACHMENT` แบบสรุป |
| 3. แก้ไขข้อมูลเคสก่อนยืนยัน | เจ้าหน้าที่ | แก้ค่าที่ OCR ดึงผิด ก่อนยืนยันเข้าระบบ | case_id, field ที่แก้ + ค่าใหม่ (จำกัดเฉพาะ patient_name, hn, house_no, village_no, village, subdistrict, onset_date, lab_result) | `CASE` ที่อัปเดตแล้ว — `responsible_team` reassign อัตโนมัติถ้า subdistrict ที่แก้ตรงกับ `SUBDISTRICT_ROUTING_RULE` (ถ้าไม่ตรง ทีมเดิมไม่เปลี่ยน) |
| 4. ปรับพิกัดด้วยมือ | เจ้าหน้าที่ | fallback ปรับพิกัดเมื่อความแม่นยำต่ำ | case_id | `CASE.geo_adjusted` toggle (มีผลเฉพาะเคสที่ geo_accuracy = low) |
| 5. ยืนยันเคส | เจ้าหน้าที่ | ปิดขั้นตอนตรวจสอบ + แจ้งเตือนทีมสอบสวนโรค | case_id | `CASE.status` → ยืนยันแล้ว + สร้าง `CASE_NOTIFICATION_LOG` ใหม่ (team = responsible_team ปัจจุบัน) |
| 6. ดึงประวัติการแจ้งเตือน | เจ้าหน้าที่ / ทีมสอบสวนโรค | ตรวจสอบว่าแจ้งเตือนไปแล้วหรือยัง/ไปที่ทีมไหน | filter: case_id (optional), team (optional) | list ของ `CASE_NOTIFICATION_LOG` |
| 7. ดึงข้อมูลสำหรับ Spot Map | เจ้าหน้าที่ / ทีมสอบสวนโรค | แสดงหมุด + วงรัศมี 100 เมตรของเคสที่ยืนยันแล้ว | filter: team (optional) | list ของ `CASE` ที่ status = ยืนยันแล้ว พร้อม map_position, geo_accuracy, geo_adjusted, responsible_team |

Traceability: operation 1 → `FEAT-INTAKE-01` (+ ฐานรองรับ `FEAT-INTAKE-05`/`06` ในอนาคต) · operation 2-3 → `FEAT-INTAKE-02` · operation 4 → `FEAT-INTAKE-04` (+ ฐานรองรับ `FEAT-INTAKE-07`) · operation 5-6 → `FEAT-INTAKE-03` (+ ฐานรองรับ `FEAT-INTAKE-08`) · operation 7 → `FEAT-INTAKE-04`

## 2B. Operation List — Module: Dashboard (`FEAT-DASH-*`)

> ระดับรายละเอียดที่ยืนยันแล้วสำหรับ 7 โมดูลใหม่ (2B ถึง 2H): **Operation list เท่านั้น** — ไม่มี payload ตัวอย่างระดับ field (ต่างจาก Case Intake ด้านบน)

| Operation | Actor | วัตถุประสงค์ | Input (conceptual) | Output (conceptual) |
|---|---|---|---|---|
| 1. ดึงข้อมูลภาพรวม Stat tiles + อัตราป่วยต่อแสนประชากร | เจ้าหน้าที่เฝ้าระวังโรค / ผู้บริหาร | แสดงจำนวนเคสวันนี้/นอกพื้นที่/สะสม และอัตราป่วยต่อแสนประชากร | filter: โรค, เขตบริการ, ช่วงวันที่ | ค่าสรุปที่คำนวณสดจาก `CASE`, ประชากรจาก `SERVICE_ZONE` |
| 2. ดึงข้อมูลแผนที่ความเสี่ยงตามเขตบริการ | เจ้าหน้าที่เฝ้าระวังโรค | แสดงระดับความเสี่ยงต่อเขต พร้อมรายชื่อชุมชน/ทีมที่รับผิดชอบ | filter เดียวกับข้างต้น | ระดับความเสี่ยงต่อ `SERVICE_ZONE` + list `COMMUNITY` พร้อม `TEAM` ที่รับผิดชอบ |
| 3. ดึงข้อมูลกราฟแนวโน้ม (รายสัปดาห์เทียบปีก่อน + รายวัน) | เจ้าหน้าที่เฝ้าระวังโรค | แสดงแนวโน้มจำนวนเคส | filter เดียวกับข้างต้น | series จำนวนเคสตามช่วงเวลาที่คำนวณจาก `CASE` |
| 4. ดึงรายการแจ้งเตือนล่าสุด | เจ้าหน้าที่เฝ้าระวังโรค | แสดง Recent Alerts Panel | filter เดียวกับข้างต้น | list `ALERT` ที่ตรงเงื่อนไข |
| 5. ดึงตารางวิเคราะห์เชิงลึก (เพศ/กลุ่มอายุ/สถิติอายุ/วินิจฉัย DF-DHF/อาชีพ/ชุมชนเคสสูงสุด/เขตบริการเรียงอัตราป่วย/ป่วยจากนอกพื้นที่) | เจ้าหน้าที่เฝ้าระวังโรค | แสดง panel วิเคราะห์เชิงลึกเพิ่มเติม | filter เดียวกับข้างต้น | breakdown ต่างๆ ที่คำนวณสดจาก `CASE` (ดู gap เรื่อง field demographic ท้ายผลลัพธ์) |

Traceability: operation 1 → `FEAT-DASH-02`, `FEAT-DASH-07` · operation 2 → `FEAT-DASH-03` · operation 3 → `FEAT-DASH-04` · operation 4 → `FEAT-DASH-05` · operation 5 → `FEAT-DASH-08` ถึง `FEAT-DASH-15` · ทุก operation → `FEAT-DASH-06` (filter ร่วม)

## 2C. Operation List — Module: Case Analysis (`FEAT-ANALYSIS-*`)

| Operation | Actor | วัตถุประสงค์ | Input (conceptual) | Output (conceptual) |
|---|---|---|---|---|
| 1. ดึงข้อมูล Case Cluster Map | ทีมสอบสวนโรค | แสดงกลุ่มเคสที่ AI เสนอพร้อมเคสที่เกี่ยวข้อง | - | list `CASE_CLUSTER` พร้อม `CASE` ที่เกี่ยวข้อง |
| 2. ยืนยัน cluster | ทีมสอบสวนโรค (นักระบาดวิทยา) | ยืนยันกลุ่มเคสที่ AI เสนอ (human-in-the-loop) | cluster_id | `CASE_CLUSTER.status` → confirmed |
| 3. สร้างร่างรายงานสอบสวนโรค | ทีมสอบสวนโรค | ร่างรายงานจากข้อมูล cluster ที่ยืนยันแล้ว | cluster_id (ต้อง confirmed แล้ว) | `INVESTIGATION_REPORT` ใหม่ (status = draft) |
| 4. ส่งรายงานสอบสวนโรค | ทีมสอบสวนโรค | ส่งรายงานให้ผู้บริหาร | report_id, content (ไม่ว่าง) | `INVESTIGATION_REPORT.status` → sent |
| 5. สนทนากับ chatbot ประสานงาน อสม. (scripted demo) | ทีมสอบสวนโรค / อสม. | นัดหมาย/แจ้งพื้นที่เบื้องต้น | - | ข้อความถัดไปในสคริปต์ที่กำหนดไว้ (ยังไม่ persist บทสนทนา) |

Traceability: operation 1-2 → `FEAT-ANALYSIS-01` (+ ฐานรองรับ `FEAT-ANALYSIS-04`) · operation 3-4 → `FEAT-ANALYSIS-02` (+ ฐานรองรับ `FEAT-ANALYSIS-05`) · operation 5 → `FEAT-ANALYSIS-03` (+ ฐานรองรับ `FEAT-ANALYSIS-06`)

## 2D. Operation List — Module: Control Plan (`FEAT-CONTROL-*`)

| Operation | Actor | วัตถุประสงค์ | Input (conceptual) | Output (conceptual) |
|---|---|---|---|---|
| 1. ดึงรายการเคส/ตำแหน่งที่ต้องควบคุมโรค | ทีมควบคุมโรค | แสดงรายการเคสและตำแหน่ง (บ้าน/ที่ทำงาน) ที่ต้องควบคุมโรค | - | list `CASE` พร้อม `CONTROL_LOCATION` |
| 2. แก้ไขตำแหน่ง/รัศมีควบคุมโรค | ทีมควบคุมโรค | ปรับที่อยู่/รัศมีพ่นสารเคมี และเปิด/ปิดตำแหน่ง active | location_id, ที่อยู่/ชื่อสถานที่, default_radius, active | `CONTROL_LOCATION` ที่อัปเดตแล้ว (ต้องมี active ≥ 1 ต่อเคสเสมอ) |
| 3. กำหนด/แก้ไขแผนปฏิบัติงานพ่น | ทีมควบคุมโรค | มอบหมายทีมพ่น + กำหนดวัน/เวลา (Day 0/1/7) | location_id, assigned_team_id, day_offset, scheduled_time | `SPRAY_ASSIGNMENT` ที่อัปเดตแล้ว |
| 4. อัปเดตสถานะพ่นแล้ว (Day 0/1/7) | ทีมควบคุมโรค | บันทึกว่าพ่นแล้วในแต่ละวัน | assignment_id, วันที่ทำเครื่องหมาย | `SPRAY_ASSIGNMENT.day{N}_done` → true |
| 5. สร้างร่างคำขออนุมัติเบิกน้ำมัน/น้ำยาเคมี | ทีมควบคุมโรค | เริ่มคำขออนุมัติรอบใหม่จากเคส active ขณะนั้น | รายการ (case_id, fuel_type) ที่ active ขณะนั้น, created_by_team_id | `APPROVAL_REQUEST` ใหม่ (status = draft, created_by_team_id) + `APPROVAL_REQUEST_CASE` (พร้อม fuel_type ต่อแถว) |
| 6. ส่งคำขออนุมัติ | ทีมควบคุมโรค | ส่งคำขอให้ผู้บริหารพิจารณา | request_id (ต้องมีเคสรวมอยู่ไม่ว่าง) | `APPROVAL_REQUEST.status` → sent |
| 7. อนุมัติคำขอ | ผู้บริหาร/หัวหน้างาน | อนุมัติคำขอเบิกน้ำมัน/น้ำยาเคมี | request_id (ต้องเป็น sent แล้ว), decided_by_name | `APPROVAL_REQUEST.status` → approved + `approved_at` + `decided_by_name` |
| 8. ไม่อนุมัติคำขอ | ผู้บริหาร/หัวหน้างาน | ไม่อนุมัติคำขอเบิกน้ำมัน/น้ำยาเคมี | request_id (ต้องเป็น sent แล้ว), decided_by_name | `APPROVAL_REQUEST.status` → rejected + `rejected_at` + `decided_by_name` |
| 9. ดึงประวัติคำขออนุมัติ | ทีมควบคุมโรค / ผู้บริหาร | ตรวจสอบประวัติคำขอแต่ละรอบ | filter: ช่วงวันที่ (optional) | list `APPROVAL_REQUEST` พร้อม `APPROVAL_REQUEST_CASE` |

Traceability: operation 1-4 → `FEAT-CONTROL-01` (+ ฐานรองรับ `FEAT-CONTROL-04`/`05`) · operation 5-9 → `FEAT-CONTROL-02` (+ ฐานรองรับ `FEAT-CONTROL-03`)

## 2E. Operation List — Module: Field Tracking (`FEAT-TRACK-*`)

| Operation | Actor | วัตถุประสงค์ | Input (conceptual) | Output (conceptual) |
|---|---|---|---|---|
| 1. ดึงตำแหน่ง/สถานะทีมพ่นปัจจุบัน | ทีมควบคุมโรค / ผู้บริหาร | แสดงแผนที่ติดตามทีมพ่นเทียบกับโซนที่วางแผนไว้ | - | list `TEAM` (team_type = control) พร้อม status/last_update_at |
| 2. อัปเดตสถานะทีมพ่น | ทีมพ่น | เปลี่ยนสถานะปฏิบัติงาน (ยังไม่ถึง → กำลังพ่น → พ่นแล้ว) | team_id | `TEAM.status` เปลี่ยนไปสถานะถัดไป |
| 3. ดึงรูปภาคสนามพร้อมผลตรวจ AI Vision QC | ทีมควบคุมโรค | ตรวจสอบว่ารูปถ่ายตรงพื้นที่/เวลาที่วางแผนหรือไม่ | filter: team_id (optional) | list `FIELD_PHOTO` |
| 4. ตรวจสอบรูปด้วยมือ | ทีมควบคุมโรค | ยืนยันด้วยมือสำหรับรูปที่ AI ตรวจไม่ผ่าน | photo_id (ต้อง location_match หรือ time_match = false) | `FIELD_PHOTO.manual_checked` → true |

Traceability: operation 1-2 → `FEAT-TRACK-01` (+ ฐานรองรับ `FEAT-CONTROL-04`) · operation 3-4 → `FEAT-TRACK-02` (+ ฐานรองรับ `FEAT-CONTROL-05`)

## 2F. Operation List — Module: ASM Coordination (`FEAT-ASM-*`)

| Operation | Actor | วัตถุประสงค์ | Input (conceptual) | Output (conceptual) |
|---|---|---|---|---|
| 1. ดึงรูปยืนยันพ่นจาก อสม. | ทีมควบคุมโรค | แสดงรูปที่ อสม. ส่งเข้ามา พร้อมสถานะสรุปโดย AI vision | filter: พื้นที่ (optional), ช่วงวันที่ | list `ASM_PHOTO_INTAKE` |
| 2. ดึงคิวแจ้งเตือนล่วงหน้า | ทีมควบคุมโรค | แสดงคิวแจ้งเตือนก่อนวันพ่น (รอบ 1/รอบ 2) | - | list `ADVANCE_NOTICE_QUEUE` |
| 3. ดูตัวอย่างข้อความแจ้งเตือน | ทีมควบคุมโรค | ตรวจสอบเนื้อหาก่อนส่งจริง | queue_id | ข้อความตัวอย่างแจ้งเตือนรอบ 1/รอบ 2 |
| 4. รับรูปจาก LINE OA จริง (backlog) | อสม. | ส่งรูปยืนยันพ่นเข้าระบบผ่าน LINE OA จริง | รูปภาพผ่าน LINE | `ASM_PHOTO_INTAKE` ใหม่ |
| 5. ส่งแจ้งเตือน LINE จริง (backlog) | ระบบ (scheduled) | ส่งข้อความแจ้งเตือนล่วงหน้าอัตโนมัติจริง | queue_id | `ADVANCE_NOTICE_QUEUE.reminderN_status` → sent |

Traceability: operation 1 → `FEAT-ASM-01` (+ ฐานรองรับ `FEAT-ASM-03`) · operation 2-3 → `FEAT-ASM-02` (+ ฐานรองรับ `FEAT-ASM-04`) · operation 4 → `FEAT-ASM-03` · operation 5 → `FEAT-ASM-04`

## 2G. Operation List — Module: Reports (`FEAT-REPORT-*`)

| Operation | Actor | วัตถุประสงค์ | Input (conceptual) | Output (conceptual) |
|---|---|---|---|---|
| 1. ดึง KPI สรุปตามช่วงเวลา | ผู้บริหาร | แสดง KPI card (จำนวนเคส, % พ่นแล้ว, % QC ผ่าน, HI/CI, จำนวนรายงานที่ส่งแล้ว) | period_type (daily/weekly) | ค่า KPI คำนวณสดจาก `CASE`/`SPRAY_ASSIGNMENT`/`FIELD_PHOTO`/`INVESTIGATION_REPORT` |
| 2. สร้างสรุปรายงานสถานการณ์ | ผู้บริหาร / เจ้าหน้าที่ | ร่างเนื้อหาสรุปจาก KPI ปัจจุบัน | period_type | เนื้อหาสรุป (template ที่แก้ไขต่อได้ก่อนส่ง) |
| 3. ส่งรายงานผ่าน LINE/ดาวน์โหลด PDF | ผู้บริหาร / เจ้าหน้าที่ | ส่งรายงานสรุปให้ผู้บริหาร/หน่วยงานที่เกี่ยวข้อง | เนื้อหาสรุป (ไม่ว่าง), channel | `REPORT_SEND_LOG` ใหม่ |
| 4. ดึงประวัติการส่งรายงาน | ผู้บริหาร | ตรวจสอบว่าส่งอะไรไปเมื่อไหร่ | - | list `REPORT_SEND_LOG` |

Traceability: operation 1-2 → `FEAT-REPORT-01` · operation 3-4 → `FEAT-REPORT-02` (+ ฐานรองรับ `FEAT-REPORT-03`)

## 2H. Operation List — Module: Alerts (`FEAT-ALERT-*`)

| Operation | Actor | วัตถุประสงค์ | Input (conceptual) | Output (conceptual) |
|---|---|---|---|---|
| 1. ดึงรายการแจ้งเตือน (filter สถานะ/ความรุนแรง) | เจ้าหน้าที่เฝ้าระวังโรค | แสดงตารางแจ้งเตือนทั้งหมด | filter: status, severity | list `ALERT` |
| 2. มอบหมายทีมรับผิดชอบ | เจ้าหน้าที่เฝ้าระวังโรค | มอบหมายทีมสอบสวนโรค/ทีมพ่นให้ไปดำเนินการ | alert_id, assigned_team_id (ต้องเลือกก่อน) | `ALERT.status` → in_progress |
| 3. ปิดเคสแจ้งเตือน | ทีมที่ได้รับมอบหมาย | ปิดเคสพร้อมบันทึกสรุปผล (human-in-the-loop) | alert_id, close_note (ไม่ว่าง) | `ALERT.status` → closed |

Traceability: operation 1 → `FEAT-ALERT-01` (+ ฐานรองรับ `FEAT-ALERT-03`) · operation 2-3 → `FEAT-ALERT-02`

## 3. Payload ตัวอย่าง (pseudo-schema)

> หัวข้อนี้ครอบเฉพาะโมดูล Case Intake ตามขอบเขตที่ยืนยันแล้ว — 7 โมดูลใหม่ (2B ถึง 2H ด้านบน) ไม่รวม payload ตัวอย่างระดับ field ในรอบนี้

### Operation 1 — อัปโหลดไฟล์รายงานเคส

```
UploadCaseFileRequest {
  file: binary
  file_name: string
  file_type: enum(PDF, JPEG)
}

UploadCaseFileResponse {
  case: {
    case_id: string
    patient_name: string
    hn: string
    house_no: string
    village_no: string
    village: string
    subdistrict: string
    district: string
    province: string
    onset_date: date
    lab_result: string
    status: enum        // = "รอตรวจสอบ"
    geo_accuracy: enum
    geo_adjusted: boolean
    map_position: string
    responsible_team: reference<INVESTIGATION_TEAM>
  }
  attachment: {
    attachment_id: string
    file_name: string
    file_type: enum
    file_size: string
    uploaded_at: date
    storage_reference: string
  }
  ocr_snapshot: {
    snapshot_id: string
    patient_name: string
    hn: string
    house_no: string
    village_no: string
    village: string
    subdistrict: string
    onset_date: date
    lab_result: string
    captured_at: date
  }
}
```

### Operation 2 — ดึงรายการเคส

```
ListCasesRequest {
  status?: enum(รอตรวจสอบ, ยืนยันแล้ว, ทั้งหมด)
  date_from?: date
  date_to?: date
}

ListCasesResponse {
  cases: list<CASE>   // ดูโครง CASE เต็มใน DATA-MODEL.md
}
```

### Operation 3 — แก้ไขข้อมูลเคสก่อนยืนยัน

```
UpdateCaseRequest {
  case_id: string
  fields: {
    patient_name?: string
    hn?: string
    house_no?: string
    village_no?: string
    village?: string
    subdistrict?: string
    onset_date?: date
    lab_result?: string
  }
}

UpdateCaseResponse {
  case_id: string
  updated_fields: list<string>
  responsible_team: reference<INVESTIGATION_TEAM>   // อาจเปลี่ยนถ้า subdistrict ตรงกับ SUBDISTRICT_ROUTING_RULE
  status: enum   // ยังคงเป็น "รอตรวจสอบ"
}
```

### Operation 4 — ปรับพิกัดด้วยมือ

```
ToggleGeoAdjustRequest {
  case_id: string
}

ToggleGeoAdjustResponse {
  case_id: string
  geo_adjusted: boolean
}
```

### Operation 5 — ยืนยันเคส

```
ConfirmCaseRequest {
  case_id: string
}

ConfirmCaseResponse {
  case_id: string
  status: enum   // = "ยืนยันแล้ว"
  notification_log: {
    log_id: string
    team: reference<INVESTIGATION_TEAM>
    notified_at: date
  }
}
```

### Operation 6 — ดึงประวัติการแจ้งเตือน

```
ListNotificationLogRequest {
  case_id?: string
  team?: reference<INVESTIGATION_TEAM>
}

ListNotificationLogResponse {
  logs: list<{
    log_id: string
    case_id: reference<CASE>
    team: reference<INVESTIGATION_TEAM>
    notified_at: date
  }>
}
```

### Operation 7 — ดึงข้อมูลสำหรับ Spot Map

```
ListConfirmedCasesForMapRequest {
  team?: reference<INVESTIGATION_TEAM>
}

ListConfirmedCasesForMapResponse {
  cases: list<{
    case_id: string
    patient_name: string
    subdistrict: string
    district: string
    province: string
    map_position: string
    geo_accuracy: enum
    geo_adjusted: boolean
    responsible_team: reference<INVESTIGATION_TEAM>
  }>
}
```

## 4. Error / Validation case

> ระดับรายละเอียดที่ยืนยันแล้วในรอบนี้: เฉพาะ **Module Case Intake** (operation 1-7 ในหัวข้อ 2) — 7 โมดูลใหม่ (2B ถึง 2H) ยังไม่รวม error/validation case แบบละเอียดในรอบนี้

### Operation 1 — อัปโหลดไฟล์รายงานเคส (`FEAT-INTAKE-01`)

| เงื่อนไข error | ประเภท | ผลลัพธ์/Response ที่คาดหวัง |
|---|---|---|
| `file_type` ไม่ใช่ PDF/JPEG | validation error | ปฏิเสธการอัปโหลด — ไม่สร้าง `CASE`/`CASE_ATTACHMENT` |
| ไม่มีไฟล์แนบมา/ไฟล์ว่าง | validation error | ปฏิเสธการอัปโหลด — ไม่สร้าง `CASE`/`CASE_ATTACHMENT` |
| OCR extraction ล้มเหลวทั้งหมด (service ล่ม/timeout) | degraded path (ไม่ใช่ error ที่ปฏิเสธการอัปโหลด) | ยังคงสร้าง `CASE` ใหม่ (status = รอตรวจสอบ) และ `CASE_ATTACHMENT` ตามปกติ (ไฟล์ที่อัปโหลดไม่เสีย) — field ที่ปกติ OCR ดึงให้ (patient_name, hn, house_no, village_no, village, subdistrict, onset_date, lab_result) เป็นค่าว่าง/null ให้เจ้าหน้าที่กรอกมือแทนที่หน้า OCR Review — **ไม่สร้าง** `CASE_OCR_SNAPSHOT` (ไม่มีค่า OCR ให้ capture) — response เพิ่ม flag `ocr_status: enum(success, failed)` เพื่อให้ frontend เตือนผู้ใช้กรอกมือทั้งหมดเมื่อเป็น `failed` |

### Operation 2 — ดึงรายการเคส (`FEAT-INTAKE-02`)

| เงื่อนไข error | ประเภท | ผลลัพธ์/Response ที่คาดหวัง |
|---|---|---|
| `status` ที่ส่งมาไม่ใช่ค่าที่กำหนดไว้ (รอตรวจสอบ/ยืนยันแล้ว/ทั้งหมด) | validation error | ปฏิเสธ request |
| `date_from` > `date_to` | validation error | ปฏิเสธ request |
| ไม่มีเคสตรงกับ filter | ไม่ใช่ error | คืน list ว่างเปล่า |

### Operation 3 — แก้ไขข้อมูลเคสก่อนยืนยัน (`FEAT-INTAKE-02`)

| เงื่อนไข error | ประเภท | ผลลัพธ์/Response ที่คาดหวัง |
|---|---|---|
| `case_id` ไม่พบ | not found | ปฏิเสธ request |
| `CASE.status` ไม่ใช่ "รอตรวจสอบ" (เช่นยืนยันแล้ว) | validation error (business rule ตาม `DATA-MODEL.md`) | ปฏิเสธการแก้ไขทั้งหมด |
| ส่ง field ที่ไม่อยู่ในรายการที่แก้ไขได้มาด้วย (เช่น `district`, `province`) | validation error | ปฏิเสธ request ทั้งหมด (ไม่ใช่แค่เพิกเฉย field นั้น) — response ระบุชื่อ field ที่ไม่อนุญาตทั้งหมด |
| ทุก field ที่ส่งมาเป็นค่าว่าง (ไม่มีอะไรจะอัปเดตเลย) | validation error | ปฏิเสธ request (ไม่มี field ให้แก้) |

### Operation 4 — ปรับพิกัดด้วยมือ (`FEAT-INTAKE-04`)

| เงื่อนไข error | ประเภท | ผลลัพธ์/Response ที่คาดหวัง |
|---|---|---|
| `case_id` ไม่พบ | not found | ปฏิเสธ request |
| เรียกตอน `geo_accuracy = high` อยู่แล้ว | validation error | ปฏิเสธ request — action นี้มีผลเฉพาะเมื่อ `geo_accuracy = low` เท่านั้น (ตาม `DATA-MODEL.md`) |

### Operation 5 — ยืนยันเคส (`FEAT-INTAKE-03`)

| เงื่อนไข error | ประเภท | ผลลัพธ์/Response ที่คาดหวัง |
|---|---|---|
| `case_id` ไม่พบ | not found | ปฏิเสธ request |
| `CASE.status` เป็น "ยืนยันแล้ว" อยู่ก่อนแล้ว (confirm ซ้ำ) | validation error | ปฏิเสธ request |
| field ที่ "จำเป็นต้องมี = ใช่" ใน `DATA-MODEL.md` ของ `CASE` (patient_name, hn, house_no, village_no, village, subdistrict, district, province, onset_date, lab_result) เป็นค่าว่างอยู่อย่างน้อย 1 field | validation error | ปฏิเสธการยืนยัน — response ระบุรายชื่อ field ที่ยังว่างอยู่ ต้องกรอกให้ครบก่อนจึงจะยืนยันได้ |

### Operation 6 — ดึงประวัติการแจ้งเตือน (`FEAT-INTAKE-03`)

| เงื่อนไข error | ประเภท | ผลลัพธ์/Response ที่คาดหวัง |
|---|---|---|
| `case_id`/`team` filter ไม่พบข้อมูล | ไม่ใช่ error | คืน list ว่างเปล่า |

### Operation 7 — ดึงข้อมูลสำหรับ Spot Map (`FEAT-INTAKE-04`)

ไม่มี error case พิเศษนอกเหนือจาก filter ที่ไม่พบข้อมูล (`team` ไม่พบเคสตรงเงื่อนไข) → คืน list ว่างเปล่า (ไม่ใช่ error)
