# Detailed Design — AI-DSRP (ทั้งระบบ 8 โมดูล)

เอกสารนี้เป็น**conceptual detailed design** — ขยายรายละเอียด*ภายใน* 1 journey step (โมดูล Dashboard) หรือ 1 operation (อีก 7 โมดูล) ที่มีอยู่แล้วใน [[./HIGH-LEVEL-ARCHITECTURE|HIGH-LEVEL-ARCHITECTURE.md]]/[[../01-prototypes/USER-JOURNEY-outbreak-dashboard|USER-JOURNEY-outbreak-dashboard.md]] ให้เห็น decision point/validation/error handling ที่ไดอะแกรมหยาบเดิมไม่ได้ลงถึง — ไม่ใช่การคัดลอก diagram เดิมมาวางซ้ำ ตามโครงจาก skill `detailed-design-builder` (`references/detailed-design-template.md`)

ขอบเขต: ครอบคลุมทั้ง 8 โมดูล — Feature ID อ้างจาก [[../../01-requirements/01-spec/FEATURE-LIST|FEATURE-LIST.md]], entity จาก [[./DATA-MODEL|DATA-MODEL.md]], operation จาก [[./API-SPEC|API-SPEC.md]]

## 0. หลักการอ่านเอกสารนี้ (ยืนยันแล้วใน Build Plan)

- **ระดับความละเอียด Sequence Flow**: ทุก flow เป็น **coarse** (decision point หลัก + ผลสำเร็จ/ไม่สำเร็จ 2 ทาง) ยกเว้น **4 flow เสี่ยงสูง** ที่ทำแบบ **step-by-step ละเอียด** (มี validation/error/retry branch เต็ม): OCR Review & Confirm Flow, Case Clustering Confirm & Report Flow, Control Plan Approval Flow, Alert Assign & Close Flow
- **State/Status Diagram**: ส่วนใหญ่ไม่ทำแยก (ALERT/TEAM มี 3 สถานะ, CASE/CASE_CLUSTER มี 2 สถานะ — ใช้ `Note` ใน sequence diagram แทน) **ยกเว้น `APPROVAL_REQUEST`** ที่ข้าม threshold ≥4 สถานะจริงหลังเพิ่ม `rejected` (draft/sent/approved/rejected) — มี `stateDiagram-v2` แยกใน Flow 8 (ดูด้านล่าง)
- **Error & Exception Handling** ครอบเฉพาะ error ที่กระทบ business-critical/ข้อมูลสุขภาพ: **เคสซ้ำ, cluster ผิดพื้นที่, แจ้งเตือนผิดทีม, อนุมัติซ้ำซ้อน, ปิด alert โดยไม่มี note** — flow ที่ไม่มี error ประเภทนี้เกี่ยวข้องจะระบุไว้ชัดเจนว่า "ไม่มี" แทนการยัดตารางที่ไม่จำเป็น ไม่ครอบ error ทั่วไป (network fail, timeout ฯลฯ)
- **Tech Stack**: [[./TECH-STACK|TECH-STACK.md]] ยืนยัน Frontend (Vanilla JS + Node.js/EJS partials), Backend/API runtime (Node.js + Express/Fastify), **OCR/Document AI vendor (Claude Vision — Anthropic, ยืนยัน 2026-09-08)**, **Geocoding vendor (Google Maps Geocoding API, ยืนยัน 2026-09-08)** — **อัปเดต 2026-10-24**: runtime ปัจจุบันของ Flow 1 ใช้ OCR ฝั่งเบราว์เซอร์ (Tesseract.js ภาษา tha+eng + pdf.js) แทน Claude Vision ตามที่ผู้ใช้ยืนยัน (ฟรี ไม่ต้องอัปเกรด Firebase Blaze) — Claude Vision (Cloud Function `extractCaseReport`) ยังอยู่ในโค้ดแต่ UI ไม่เรียก จึงระบุเป็น backlog ใน Flow 1 ส่วน Geocoding (Flow 2) ยังไม่เชื่อมจริง (พิกัดกรอกด้วยมือ) — ส่วน component อื่นที่ flow อื่นในไฟล์นี้เรียกใช้ (Case Clustering, AI Vision QC) **ยังไม่ยืนยัน vendor จริง** จึง participant ยังเป็นชื่อ capability-level ตาม `HIGH-LEVEL-ARCHITECTURE.md` หัวข้อ 6 เหมือนเดิม (mixed state ตามปกติของเอกสารนี้)
- **แกนอ้างอิงหลัก**: Dashboard ยึด [[../01-prototypes/USER-JOURNEY-outbreak-dashboard|USER-JOURNEY-outbreak-dashboard.md]] เป็นแกน — อีก 7 โมดูลยึด operation ใน `API-SPEC.md` เป็นแกน
- Diagram ส่วนใหญ่ใช้ `sequenceDiagram` (Mermaid) — มี `stateDiagram-v2` เพิ่ม 1 diagram เฉพาะ Flow 8 (`APPROVAL_REQUEST`) ตามเหตุผลข้างต้น

---

# โมดูล: Case Intake (`FEAT-INTAKE-*`)

## Flow 1 — OCR Review & Confirm Flow (step-by-step ละเอียด) — `FEAT-INTAKE-01`/`02`/`03`/`05`/`10`/`11`

> **สถานะการ sync กับโค้ด (2026-10-24)**: Flow นี้ปรับให้ตรงกับพฤติกรรมจริงของ `prototypes/v1` — **OCR ทำฝั่ง client ในเบราว์เซอร์ ไม่มีการเรียก API Server/Cloud Function/Claude Vision ใน runtime ปัจจุบัน** และข้อมูลเคสทั้งหมดเป็น in-memory ของหน้า (ไม่ persist) เส้นทาง Claude Vision + การบันทึกลง entity ถาวร (`CASE` ฯลฯ) คงไว้เป็น **backlog** ตามที่ระบุใน diagram

### 1. Flow Overview

| หัวข้อ | รายละเอียด |
|---|---|
| Trigger | เจ้าหน้าที่ รพ./เทศบาล อัปโหลดไฟล์รายงานเคส (PDF/JPEG/PNG ขนาดไม่เกิน 7MB) |
| Actor หลัก | เจ้าหน้าที่ รพ./เทศบาล (อัปโหลด/ตรวจสอบ/แก้ไข/ยืนยัน), ระบบ (OCR ฝั่งเบราว์เซอร์, แยกช่องข้อมูล, กำหนดทีมรับผิดชอบเริ่มต้น) |
| Precondition | ไฟล์เป็น PDF/JPEG/PNG ขนาดไม่เกิน 7MB; ครั้งแรกต้องมีอินเทอร์เน็ตเพื่อโหลดโมดูล OCR ภาษาไทย/อังกฤษ (ผู้ใช้ต้องเปิดหน้าด้วยบัญชีที่ผ่าน auth-guard ตามปกติ) |
| Postcondition | เคสในตาราง OCR Review เปลี่ยนเป็น `ยืนยันแล้ว`, มีรายการแจ้งเตือนทีมรับผิดชอบเพิ่ม 1 รายการ, หมุดเคสปรากฏบน Spot Map — **ทั้งหมดอยู่ใน memory ของหน้า ไม่ persist (หายเมื่อ reload)** |
| Reference | Journey/operation ระดับแนวคิด: Operation 1, 2, 3, 5, 6 (`API-SPEC.md` หัวข้อ 2 — ยังไม่ถูกเรียกจริงใน runtime ปัจจุบัน) · Entity เป้าหมายเมื่อ persist: `CASE`/`CASE_OCR_SNAPSHOT`/`CASE_ATTACHMENT`/`CASE_NOTIFICATION_LOG`/`TEAM`/`SUBDISTRICT_ROUTING_RULE` (`DATA-MODEL.md`) · Component: "OCR ฝั่งเบราว์เซอร์ (Tesseract.js + pdf.js)" (runtime ปัจจุบัน), "บริการ OCR/Document AI (Claude Vision)" (backlog), "Web App (Case Intake)", "AI ช่วยตรวจสอบเคส (Claude)" (FEAT-INTAKE-10) |

### 2. Sequence Flow

```mermaid
sequenceDiagram
  participant จนท as เจ้าหน้าที่ รพ./เทศบาล
  participant UI as Web App (Case Intake)
  participant OCR as OCR ฝั่งเบราว์เซอร์ (Tesseract.js tha+eng + pdf.js)
  participant Parse as ตัวแยกช่องข้อมูล (parser)
  participant Mem as ข้อมูลเคส/แจ้งเตือน (in-memory ของหน้า)
  participant AI as AI ช่วยตรวจสอบ (Claude — FEAT-INTAKE-10)

  Note over OCR,Mem: runtime ปัจจุบัน: ไฟล์ไม่ออกนอกเครื่อง ไม่มี API Server/Cloud Function ในขั้น OCR และไม่ persist ข้อมูลเคส

  จนท->>UI: อัปโหลดไฟล์รายงานเคส (เลือกไฟล์/ลากวาง)
  UI->>UI: ตรวจชนิดไฟล์ (PDF/JPEG/PNG) และขนาด (ไม่เกิน 7MB)
  alt ชนิดไฟล์ไม่รองรับ
    UI-->>จนท: "รองรับเฉพาะไฟล์ PDF, JPEG, PNG เท่านั้น" (หยุด)
  else ไฟล์ใหญ่เกิน 7MB
    UI-->>จนท: "ไฟล์ใหญ่เกินไป (จำกัดไม่เกิน 7MB)" (หยุด)
  else ไฟล์ถูกต้อง
    UI->>OCR: ส่งไฟล์ให้อ่านข้อความ (ปุ่มเลือกไฟล์ถูกปิดระหว่างประมวลผล)
    OCR-->>UI: ข้อความสถานะ (โหลดโมดูลภาษาไทย / แปลงหน้า PDF / % การอ่าน)
    opt ไฟล์เป็น PDF
      OCR->>OCR: แปลงหน้า PDF เป็นภาพก่อน (สูงสุด 3 หน้าแรก)
    end
    alt โหลดโมดูล OCR ไม่ได้ หรืออ่านข้อความไม่ได้เลย หรือเกิดข้อผิดพลาดอื่น
      OCR-->>UI: error พร้อมสาเหตุ
      UI-->>จนท: "แปลงเอกสารไม่สำเร็จ: ตามด้วยสาเหตุ" (ไม่สร้างแถวใหม่ ปุ่มกลับมาใช้งานได้)
    else อ่านข้อความได้
      OCR-->>Parse: ข้อความดิบจากทุกหน้า
      Parse->>Parse: จับคู่ label -> ช่องข้อมูล (ชื่อ/เลขบัตร/HN/ที่อยู่/วันที่เริ่มป่วย/ผลตรวจ/พิกัดถ้ามี)
      Parse->>Parse: ข้ามบรรทัด "ชื่อบิดา/มารดา/ผู้ปกครอง/ผู้รายงาน" (ไม่นับเป็นชื่อผู้ป่วย)
      Parse->>Parse: ทิ้งค่าที่อ่านเป็นขยะ (ตัวอักษรน้อย/สัญลักษณ์ปนเกินครึ่ง) ให้เป็นค่าว่าง
      Parse-->>UI: ช่องข้อมูลที่แยกได้
      UI->>UI: เดาโรคจากข้อความ OCR (รหัสรง.506/คำสำคัญ) เป็นค่าเริ่มต้นถ้าเจอ
      UI->>UI: หาตำบลจากที่อยู่ -> กำหนดทีมรับผิดชอบเริ่มต้น (ตำบลไม่รู้จัก -> ทีม เขต 1 ไปก่อน)
      UI->>Mem: เพิ่มเคส status=รอตรวจสอบ (มีพิกัดจากเอกสาร=แม่นยำสูง, ไม่มี=แม่นยำต่ำ) + เก็บ preview ไฟล์ต้นฉบับฝั่ง client
      UI-->>จนท: แสดงแถวใหม่ในตาราง OCR Review + แผง "ภาพเอกสารต้นฉบับ" เหนือตาราง
      opt อ่านช่องหลักได้ < 2 ช่อง (ชื่อ / เลขบัตร 13 หลัก / ที่อยู่ / วันที่เริ่มป่วย) = weak OCR
        UI-->>จนท: ข้อความเตือน "ระบบอ่านข้อมูลจากเอกสารนี้ได้น้อยมาก (มักเป็นลายมือ) กรุณาดูภาพต้นฉบับแล้วกรอกข้อมูลในตารางเอง"
        UI->>UI: เปิดโหมดแก้ไขแถวนั้นอัตโนมัติ
      end
    end
  end

  Note over จนท,UI: เจ้าหน้าที่เทียบค่าในตารางกับภาพต้นฉบับทีละแถว (human-in-the-loop) — OCR ฟรีอ่านตัวพิมพ์ได้ แต่อ่านลายมือไทย/ช่องติ๊กโรคไม่ได้

  opt เจ้าหน้าที่พบข้อมูลผิด ต้องแก้ไขก่อนยืนยัน
    จนท->>UI: กด "แก้ไข" (ปุ่มมีเฉพาะแถวที่ยังไม่ยืนยัน แก้ได้ทีละ 1 แถว)
    UI-->>จนท: ช่องแก้ไขได้: ชื่อผู้ป่วย / เลขประจำตัวประชาชน / ที่อยู่ขณะป่วย / วันที่เริ่มป่วย
    จนท->>UI: แก้ไขค่า แล้วกด "บันทึก"
    UI->>UI: หาตำบลจากที่อยู่ที่แก้
    alt ตำบลตรงกับพื้นที่ที่ระบบรู้จัก
      UI->>Mem: อัปเดตเคส + เปลี่ยนทีมรับผิดชอบตามตำบลใหม่
    else ตำบลไม่ตรงพื้นที่ที่รู้จัก/ไม่พบตำบล
      UI->>Mem: อัปเดตเคส คงทีมรับผิดชอบเดิมไว้ (ไม่มีข้อความเตือนว่าทีมไม่เปลี่ยน)
    end
    UI-->>จนท: แสดงค่าที่แก้แล้ว (ยังเป็น รอตรวจสอบ) — ปุ่ม "ยกเลิก" ออกจากโหมดแก้ไขโดยไม่เปลี่ยนค่า
  end

  opt เจ้าหน้าที่เลือก/แก้โรค (dropdown รหัสโรค รง.506 แบบ static)
    จนท->>UI: เลือกโรคจากรายการ (เปลี่ยนค่าที่ระบบเดาไว้ได้เสมอ)
    UI->>Mem: เก็บโรคที่เลือก (ล้างป้าย "เลือกจากข้อความในเอกสาร")
  end

  opt เจ้าหน้าที่ขอให้ AI ช่วยตรวจสอบ (advisory เท่านั้น)
    จนท->>UI: กด "ให้ AI ช่วยตรวจสอบ"
    UI->>AI: ส่งชื่อ/ที่อยู่/วันที่เริ่มป่วย/โรค/ผลตรวจ (ไม่ส่งเลขประจำตัวประชาชน และไม่ส่งไฟล์)
    alt AI ตอบกลับ
      AI-->>UI: ok หรือรายการจุดน่าสงสัย
      UI-->>จนท: แสดงผลใต้แถว (ไม่แก้ข้อมูลอัตโนมัติ)
    else เรียก AI ไม่สำเร็จ
      UI-->>จนท: แสดงข้อความ error ใต้แถว (ไม่กระทบการยืนยัน)
    end
  end

  จนท->>UI: กด "ยืนยัน"
  UI->>UI: ตรวจช่องจำเป็น: ชื่อผู้ป่วย, เลขประจำตัว 13 หลัก, ที่อยู่ขณะป่วย, วันที่เริ่มป่วย, โรค
  alt ช่องจำเป็นขาด
    UI-->>จนท: "ยังยืนยันไม่ได้ กรุณากรอก/เลือกให้ครบ: ตามด้วยรายการช่องที่ขาด" (สถานะคงเดิม)
  else ครบ
    UI->>Mem: เปลี่ยนสถานะ รอตรวจสอบ -> ยืนยันแล้ว
    UI->>Mem: เพิ่มรายการแจ้งเตือนทีมรับผิดชอบปัจจุบัน (พร้อมเวลา)
    Note over UI,Mem: ทางเดียว ไม่มี reopen/unlock ในรอบนี้ (FEAT-INTAKE-09 backlog) และปุ่มยืนยัน/แก้ไขไม่ปรากฏบนแถวที่ยืนยันแล้ว
    UI-->>จนท: แสดง "ยืนยันแล้ว" + อัปเดต Notification Log และ Spot Map
  end

  Note over UI,Mem: Backlog (ไม่ใช่เส้นทางหลักปัจจุบัน): ส่งไฟล์ให้ Claude Vision ผ่าน API Server/Cloud Function แทน OCR ฝั่งเบราว์เซอร์ + บันทึก CASE/CASE_OCR_SNAPSHOT/CASE_ATTACHMENT/CASE_NOTIFICATION_LOG แบบ persist + ตรวจ status ฝั่ง server ก่อนแก้ไข/ยืนยัน
```

### 3. Business Rule / Validation Logic

| Rule | เงื่อนไข | ผลถ้าไม่ผ่าน | Feature ID |
|---|---|---|---|
| ชนิดไฟล์ที่รับอัปโหลด | MIME เป็น PDF, JPEG หรือ PNG | แสดง "รองรับเฉพาะไฟล์ PDF, JPEG, PNG เท่านั้น" ไม่เริ่ม OCR | FEAT-INTAKE-01 |
| ขนาดไฟล์สูงสุด | ไม่เกิน 7MB | แสดง "ไฟล์ใหญ่เกินไป (จำกัดไม่เกิน 7MB)" ไม่เริ่ม OCR | FEAT-INTAKE-01 |
| PDF อ่านเฉพาะหน้าแรกๆ | PDF ถูกแปลงเป็นภาพ สูงสุด 3 หน้า | หน้าที่เกินไม่ถูกอ่าน | FEAT-INTAKE-05 |
| ไฟล์ไม่ออกนอกเครื่อง | OCR ทำในเบราว์เซอร์ (ครั้งแรกต้องโหลดโมดูลภาษาไทย/อังกฤษจากอินเทอร์เน็ต) | ถ้าโหลดโมดูลไม่ได้ แสดง error ตามหัวข้อ 4 | FEAT-INTAKE-05 |
| ค่าที่ OCR อ่านเป็นขยะถูกทิ้ง | ชื่อ/ที่อยู่ มีตัวอักษรน้อยเกินไป หรือสัญลักษณ์ปนเกินครึ่ง | ปล่อยเป็นค่าว่างให้เจ้าหน้าที่กรอกเอง (ดีกว่าเดาใส่) | FEAT-INTAKE-05 |
| บรรทัดชื่อบิดา/มารดา/ผู้ปกครอง/ผู้รายงาน ไม่นับเป็นชื่อผู้ป่วย | บรรทัดที่มีคำเหล่านี้ | ไม่ดึงเป็นชื่อผู้ป่วย | FEAT-INTAKE-05 |
| Weak OCR | อ่านช่องหลักได้ < 2 ช่อง จาก ชื่อ / เลขบัตร 13 หลัก / ที่อยู่ / วันที่เริ่มป่วย | แสดงข้อความเตือน + เปิดโหมดแก้ไขแถวนั้นอัตโนมัติ ให้กรอกเองจากแผง "ภาพเอกสารต้นฉบับ" | FEAT-INTAKE-02, FEAT-INTAKE-05 |
| แก้ไขข้อมูลได้เฉพาะเคสที่ยังไม่ยืนยัน (และทีละ 1 แถว) | status = รอตรวจสอบ | แถวที่ยืนยันแล้วไม่มีปุ่ม "แก้ไข"/"ยืนยัน" | FEAT-INTAKE-02 |
| ช่องที่แก้ไขได้ในโหมดแก้ไข | ชื่อผู้ป่วย, เลขประจำตัวประชาชน, ที่อยู่ขณะป่วย, วันที่เริ่มป่วย (โรคเลือกผ่าน dropdown, พิกัดแก้ผ่านช่องพิกัด — ดู Flow 2) | ไม่มีช่องแยก district/province (รวมอยู่ในที่อยู่ช่องเดียว) | FEAT-INTAKE-02 |
| เลขประจำตัวประชาชน | ต้องครบ 13 หลักจึงยืนยันได้ ส่วน checksum ไม่ผ่านเป็นเพียงป้ายเตือน "เลขอาจอ่านผิด" (advisory ไม่บล็อก) | ไม่ครบ 13 หลัก -> ยืนยันไม่ได้ / checksum ไม่ผ่าน -> เตือนแต่ยืนยันได้ | FEAT-INTAKE-02 |
| โรคต้องเลือกก่อนยืนยัน | เลือกจาก dropdown รหัสโรค รง.506 (รายการ static) — ระบบเดาจากข้อความ OCR ให้เป็นค่าเริ่มต้นได้ พร้อมป้าย "เลือกจากข้อความในเอกสาร โปรดตรวจสอบ" | ไม่เลือกโรค -> ยืนยันไม่ได้ | FEAT-INTAKE-02, FEAT-INTAKE-11 |
| Auto-route ทีมรับผิดชอบตามตำบลในที่อยู่ | หาตำบลจากข้อความที่อยู่ (ตำบลที่ระบบรู้จักก่อน ไม่เจอลองจับ "ต./ตำบล ชื่อ") แล้วเทียบกับพื้นที่ที่ระบบรู้จัก | ตรงพื้นที่ที่รู้จัก -> กำหนด/เปลี่ยนทีมตามตำบล / ไม่ตรง -> ตอนสร้างเคสใหม่เข้า "ทีมสอบสวนโรค เขต 1" เป็นค่าเริ่มต้น, ตอนแก้ไขคงทีมเดิม | FEAT-INTAKE-02, FEAT-INTAKE-03 |
| ช่องจำเป็นก่อนยืนยัน (confirm validation) | ชื่อผู้ป่วย, เลขประจำตัวประชาชน 13 หลัก, ที่อยู่ขณะป่วย, วันที่เริ่มป่วย, โรค — พิกัดไม่บังคับ | alert "ยังยืนยันไม่ได้ กรุณากรอก/เลือกให้ครบ: ..." ระบุช่องที่ขาด สถานะคงเดิม | FEAT-INTAKE-02 |
| ยืนยันเคสได้ครั้งเดียว | แถวที่ยืนยันแล้วถูกข้าม (ไม่ทำซ้ำ) | ไม่สร้างรายการแจ้งเตือนซ้ำ | FEAT-INTAKE-02 |
| ยืนยันเคสสร้างรายการแจ้งเตือนใหม่ | ทุกครั้งที่ยืนยันสำเร็จ | ส่งไปยังทีมรับผิดชอบปัจจุบันของเคส (บันทึกใน Notification Log ของหน้า) | FEAT-INTAKE-03 |
| AI ช่วยตรวจสอบเป็น advisory | ปุ่มระดับแถว ส่งชื่อ/ที่อยู่/วันที่เริ่มป่วย/โรค/ผลตรวจ — **ไม่ส่งเลขประจำตัวประชาชนและไม่ส่งไฟล์** | ไม่แก้ข้อมูล/ไม่ยืนยันแทนเจ้าหน้าที่; ผล error แสดงใต้แถว | FEAT-INTAKE-10 |
| การเปลี่ยนสถานะเคสทำได้จากปุ่ม "ยืนยัน" ของคนเท่านั้น | AI/OCR ห้ามเปลี่ยนสถานะเอง | human-in-the-loop เสมอ | FEAT-INTAKE-02, FEAT-INTAKE-10, FEAT-INTAKE-11 |
| ข้อมูลเคสยังไม่ persist | ข้อมูลอยู่ใน memory ของหน้า | หายเมื่อ reload (backlog: บันทึกลง entity ถาวร) | FEAT-INTAKE-02, FEAT-INTAKE-05 |

### 4. Error & Exception Handling

| กรณี | จุดที่เกิด (อ้างจาก step ใน diagram) | การจัดการ | ผลกระทบต่อผู้ใช้/ข้อมูล |
|---|---|---|---|
| เคสซ้ำ | ตอนอัปโหลดไฟล์/เพิ่มเคสใหม่ในตาราง | **ไม่มี dedup rule ที่ยืนยันในแผนรอบนี้** — ระบบไม่ตรวจสอบไฟล์/HN/เลขประจำตัวประชาชนซ้ำอัตโนมัติ (อัปโหลดไฟล์เดิมซ้ำจะได้แถวใหม่ทุกครั้ง) — ถือเป็น **gap** ที่ต้องยืนยันเพิ่มก่อน implement จริง | อาจเกิดเคสซ้ำในระบบ ต้องตรวจด้วยมือ |
| แจ้งเตือนผิดทีม | ตอนสร้างเคสใหม่จาก OCR (กำหนดทีมเริ่มต้น), ตอนบันทึกการแก้ไขที่อยู่, ตอนยืนยันเคส (เพิ่มรายการแจ้งเตือน) | ระบบส่งแจ้งเตือนไปยังทีมรับผิดชอบปัจจุบันของเคสเสมอ — ตอนสร้างเคสถ้าตำบลไม่ตรงพื้นที่ที่ระบบรู้จัก (หรืออ่านที่อยู่ไม่ได้) เคสจะเข้า "ทีมสอบสวนโรค เขต 1" เป็นค่าเริ่มต้นแบบเงียบ และตอนแก้ไขถ้าตำบลไม่ตรงจะคงทีมเดิมแบบเงียบ (silent no-op) โดยไม่มีการเตือนผู้ใช้ว่าทีมไม่ถูก reassign — ถือเป็น **risk ที่ flag ไว้**: UI ควรแสดงข้อความชัดเจนว่าทีมเปลี่ยน/ไม่เปลี่ยน/เป็นค่าเริ่มต้น | เคสอาจถูกแจ้งเตือนไปยังทีมที่ไม่ตรงพื้นที่จริง |
| OCR แปลงเอกสารไม่สำเร็จ | ขั้นอ่านข้อความด้วย OCR ฝั่งเบราว์เซอร์ | แสดง "แปลงเอกสารไม่สำเร็จ: ตามด้วยสาเหตุ" เช่น "โหลดโมดูล OCR ไม่สำเร็จ (ต้องมีอินเทอร์เน็ตครั้งแรก)" หรือ "อ่านข้อความจากเอกสารไม่ได้ กรุณาตรวจสอบว่าไฟล์ชัดเจน หรือกรอกข้อมูลด้วยมือแทน" — ไม่สร้างแถวใหม่ และปุ่มเลือกไฟล์กลับมาใช้งานได้ (ไม่มี retry อัตโนมัติ ผู้ใช้อัปโหลดใหม่เอง) | ไม่มีข้อมูลเข้าตาราง ไม่กระทบเคสเดิม |
| OCR อ่านได้แต่ไม่ครบ/ผิด (ลายมือ, ช่องติ๊กโรค) | หลัง parser แยกช่องข้อมูล | อ่านลายมือไทยและช่องติ๊กโรคไม่ได้ (ทดสอบกับใบ รง.506 จริง) — ค่าขยะถูกทิ้งเป็นว่าง, weak OCR เปิดโหมดแก้ไขอัตโนมัติ, เลขบัตรที่ checksum ไม่ผ่านมีป้ายเตือน, ต้องเลือกโรคเองก่อนยืนยัน | ข้อมูลผิดที่ไม่ถูกจับได้อาจหลุดถึงขั้นยืนยันถ้าเจ้าหน้าที่ไม่เทียบกับภาพต้นฉบับ — จึงต้องเป็น human-in-the-loop เสมอ |
| ยืนยันเคสที่ข้อมูลไม่ครบ | ตอนกด "ยืนยัน" | ปฏิเสธด้วย alert ระบุช่องที่ขาด (ดูหัวข้อ 3) | เคสคงสถานะ รอตรวจสอบ ไม่มีรายการแจ้งเตือนเกิดขึ้น |
| AI ช่วยตรวจสอบล้มเหลว | ตอนกด "ให้ AI ช่วยตรวจสอบ" | แสดงข้อความ error ใต้แถว ไม่แก้ข้อมูล ไม่ block การยืนยัน (รายละเอียด retry/rate limit ของ Claude ไม่ได้ระบุมาใน context — คงเป็นเชิงแนวคิด) | เจ้าหน้าที่ตรวจเองต่อได้ |

### 5. Traceability

| อ้างอิง | ID/ชื่อ |
|---|---|
| Feature | FEAT-INTAKE-01, FEAT-INTAKE-02, FEAT-INTAKE-03, FEAT-INTAKE-05 (runtime ปัจจุบัน = OCR ฝั่งเบราว์เซอร์ Tesseract.js, Claude Vision = backlog), FEAT-INTAKE-10 (AI ช่วยตรวจสอบ), FEAT-INTAKE-11 (เลือก/เดาประเภทโรค — ดู gap ด้านล่าง), FEAT-INTAKE-08 (backlog), FEAT-INTAKE-09 (backlog) |
| Entity | `CASE`, `CASE_OCR_SNAPSHOT`, `CASE_ATTACHMENT`, `CASE_NOTIFICATION_LOG`, `TEAM`, `SUBDISTRICT_ROUTING_RULE` (เป็น entity เป้าหมายเมื่อ persist — runtime ปัจจุบันเป็น in-memory) |
| Operation | API-SPEC.md operation 1, 2, 3, 5, 6 (ระดับแนวคิด ยังไม่ถูกเรียกจริง) |
| Component | Web App (Case Intake), OCR ฝั่งเบราว์เซอร์ (Tesseract.js + pdf.js), AI ช่วยตรวจสอบเคส (Claude), API Server + บริการ OCR/Document AI (Claude Vision) (backlog), LINE OA (backlog) |

---

## Flow 2 — Manual Geo Adjustment (coarse) — `FEAT-INTAKE-04`

### 1. Flow Overview

| หัวข้อ | รายละเอียด |
|---|---|
| Trigger | เจ้าหน้าที่เห็นเคสที่ไม่มีพิกัด/พิกัดแม่นยำต่ำ (หรือต้องการแก้พิกัด) และกด "ระบุพิกัด"/"แก้ไขพิกัด" ในแถวเคส (fallback ด้วยมือ) |
| Actor หลัก | เจ้าหน้าที่ รพ./เทศบาล |
| Precondition | มีเคสในตาราง OCR Review (ปุ่มพิกัดมีทุกแถว ไม่จำกัดเฉพาะ `geo_accuracy = low`) — เคสจาก OCR จะมีพิกัดก็ต่อเมื่อเอกสารมีค่า "ละติจูด, ลองจิจูด" ซึ่งฟอร์ม รง.506 มาตรฐานไม่มีช่องนี้ ส่วนใหญ่จึงเว้นว่าง |
| Postcondition | ได้พิกัดช่องเดียวรูปแบบ "ละติจูด, ลองจิจูด" (ในกรอบประเทศไทย) และแถวถูกทำเครื่องหมาย "ปรับพิกัดด้วยมือแล้ว" หรือกลับเป็นค่าเดิมเมื่อกด "เลิกทำ" (in-memory ไม่ persist) |
| Reference | Operation 4 (`API-SPEC.md` ระดับแนวคิด) · Entity `CASE` (`geo_accuracy`, `geo_adjusted`, พิกัด) · Component Web App (Case Intake), บริการ Geocoding (Google Maps Geocoding API — backlog `FEAT-INTAKE-07`) |

### 2. Sequence Flow

```mermaid
sequenceDiagram
  participant จนท as เจ้าหน้าที่
  participant UI as Web App (Case Intake)
  participant Mem as ข้อมูลเคส (in-memory ของหน้า)

  จนท->>UI: กด "ระบุพิกัด" (ไม่มีพิกัด) หรือ "แก้ไขพิกัด" (มีพิกัดแล้ว)
  UI-->>จนท: แสดงช่องพิกัดช่องเดียว "ละติจูด, ลองจิจูด" (เติมค่าเดิมให้ถ้ามี)
  alt เจ้าหน้าที่กด "ยกเลิก"
    UI-->>จนท: ปิดช่องกรอก ไม่เปลี่ยนข้อมูล
  else เจ้าหน้าที่กด "บันทึกพิกัด"
    UI->>UI: แยกค่าละติจูด/ลองจิจูดจากข้อความ และตรวจว่าอยู่ในกรอบประเทศไทย
    alt รูปแบบผิดหรือนอกกรอบประเทศไทย
      UI-->>จนท: เตือนให้กรอกเป็น "ละติจูด, ลองจิจูด" ช่องเดียว (ตัวอย่างและช่วงค่าที่ยอมรับ) ไม่บันทึก
    else ถูกต้อง
      UI->>Mem: เก็บพิกัด + คำนวณตำแหน่งหมุด + ตั้งสถานะ "ปรับพิกัดด้วยมือแล้ว"
      UI-->>จนท: แสดงพิกัดใหม่ในแถว และอัปเดตหมุดบน Spot Map (เฉพาะเคสที่ยืนยันแล้ว)
    end
  end

  opt เคยปรับพิกัดด้วยมือแล้ว
    จนท->>UI: กด "เลิกทำ"
    UI->>Mem: คืนพิกัด/ตำแหน่งหมุดเดิมก่อนปรับ และยกเลิกสถานะ "ปรับพิกัดด้วยมือแล้ว"
    UI-->>จนท: แสดงพิกัดเดิม
  end
```

### 3. Business Rule / Validation Logic

| Rule | เงื่อนไข | ผลถ้าไม่ผ่าน | Feature ID |
|---|---|---|---|
| พิกัดกรอกเป็นช่องเดียว | รูปแบบ "ละติจูด, ลองจิจูด" เช่น `19.8963, 99.8280` | เตือนและไม่บันทึกพิกัด | FEAT-INTAKE-04 |
| พิกัดต้องอยู่ในกรอบประเทศไทย | ละติจูด 5.5–21, ลองจิจูด 97–106 | เตือนและไม่บันทึกพิกัด | FEAT-INTAKE-04 |
| ระบุ/แก้ไขพิกัดได้ทุกแถว (ปุ่มพิกัดแสดงทุกแถว รวมแถวที่ยืนยันแล้ว) | ไม่ผูกกับ `geo_accuracy` หรือสถานะเคส | — | FEAT-INTAKE-04 |
| พิกัดไม่บังคับก่อนยืนยันเคส | ไม่อยู่ในรายการช่องจำเป็นของ Flow 1 | เคสยืนยันได้แม้ไม่มีพิกัด (หมุดจะอยู่ตำแหน่งกลางแผนที่จำลอง) | FEAT-INTAKE-04 |
| "เลิกทำ" คืนค่าเดิม | เคยปรับด้วยมือแล้ว | คืนพิกัดเดิมที่บันทึกไว้ก่อนปรับครั้งแรก | FEAT-INTAKE-04 |
| เคสจาก OCR | พิกัดจากเอกสาร (ถ้ามี) -> `geo_accuracy = high`, ไม่มี -> `low` | — | FEAT-INTAKE-04, FEAT-INTAKE-05 |

### 4. Error & Exception Handling

ไม่มี error ระดับ business-critical เฉพาะสำหรับ flow นี้ตามขอบเขตที่ยืนยันใน Build Plan (ครอบเฉพาะ 5 ประเภทที่ระบุในหัวข้อ 0) — การเตือนรูปแบบพิกัดผิดสรุปไว้ในหัวข้อ 3

### 5. Traceability

| อ้างอิง | ID/ชื่อ |
|---|---|
| Feature | FEAT-INTAKE-04, FEAT-INTAKE-05, FEAT-INTAKE-07 (backlog) |
| Entity | `CASE` |
| Operation | API-SPEC.md operation 4 (ระดับแนวคิด ยังไม่ถูกเรียกจริง) |
| Component | Web App (Case Intake), บริการ Geocoding (Google Maps Geocoding API — backlog) |

---

## Flow 3 — Notification & Spot Map Query (coarse) — `FEAT-INTAKE-03`/`04`

### 1. Flow Overview

| หัวข้อ | รายละเอียด |
|---|---|
| Trigger | ทีมสอบสวนโรค/เจ้าหน้าที่ต้องการตรวจสอบประวัติการแจ้งเตือน หรือดู Spot Map ของเคสที่ยืนยันแล้ว |
| Actor หลัก | ทีมสอบสวนโรค, เจ้าหน้าที่ |
| Precondition | มีเคสที่ยืนยันแล้วอย่างน้อย 1 รายการ (สำหรับ Spot Map) |
| Postcondition | ผู้ใช้เห็นประวัติแจ้งเตือน/แผนที่จุดเกิดเหตุล่าสุด |
| Reference | Operation 6, 7 (`API-SPEC.md`) · Entity `CASE_NOTIFICATION_LOG`, `CASE` · Component Web App (Case Intake), API Server |

### 2. Sequence Flow

```mermaid
sequenceDiagram
  participant ทีม as ทีมสอบสวนโรค / เจ้าหน้าที่
  participant UI as Web App (Case Intake)
  participant API as API Server

  ทีม->>UI: เปิดดูประวัติการแจ้งเตือน / Spot Map
  UI->>API: ดึงประวัติการแจ้งเตือน (filter: case_id/team) + ดึงข้อมูลสำหรับ Spot Map (filter: team)
  alt มีเคสที่ยืนยันแล้ว/มีประวัติแจ้งเตือนตรงเงื่อนไข
    API-->>UI: แสดงประวัติแจ้งเตือน + หมุด/วงรัศมี 100 เมตรของเคสที่ยืนยันแล้ว
  else ไม่พบข้อมูลตรงเงื่อนไข
    API-->>UI: แสดง empty state
  end
```

### 3. Business Rule / Validation Logic

| Rule | เงื่อนไข | ผลถ้าไม่ผ่าน | Feature ID |
|---|---|---|---|
| Spot Map แสดงเฉพาะเคสยืนยันแล้ว | `CASE.status = ยืนยันแล้ว` | เคส `รอตรวจสอบ` ไม่ปรากฏบนแผนที่ | FEAT-INTAKE-04 |

### 4. Error & Exception Handling

ไม่มี error ระดับ business-critical เฉพาะสำหรับ flow นี้ตามขอบเขตที่ยืนยันใน Build Plan

### 5. Traceability

| อ้างอิง | ID/ชื่อ |
|---|---|
| Feature | FEAT-INTAKE-03, FEAT-INTAKE-04, FEAT-INTAKE-08 (backlog) |
| Entity | `CASE_NOTIFICATION_LOG`, `CASE` |
| Operation | API-SPEC.md operation 6, 7 |
| Component | Web App (Case Intake), API Server |

---

# โมดูล: Dashboard (`FEAT-DASH-*`)

## Flow 4 — Dashboard View & Filter Recompute (coarse) — `FEAT-DASH-01` ถึง `15`

ยึด [[../01-prototypes/USER-JOURNEY-outbreak-dashboard|USER-JOURNEY-outbreak-dashboard.md]] Step 1-7b เป็นแกน — ขยายรายละเอียดตรงที่ `HIGH-LEVEL-ARCHITECTURE.md` หัวข้อ 3B ยังทำไว้แค่หยาบ (แต่ละ `Dash-->>จนท` เป็น 1 บรรทัด) ให้เห็น recompute logic ตอน filter เปลี่ยน และจุดที่ยังมี gap เรื่องเกณฑ์คำนวณระดับความเสี่ยง

### 1. Flow Overview

| หัวข้อ | รายละเอียด |
|---|---|
| Trigger | เจ้าหน้าที่เฝ้าระวังโรคเปิดหน้า Dashboard ตอนเริ่มกะงาน หรือได้รับแจ้งว่ามีสัญญาณผิดปกติ |
| Actor หลัก | เจ้าหน้าที่เฝ้าระวังโรค / ผู้บริหาร |
| Precondition | มีข้อมูล `CASE`/`ALERT` อยู่ในระบบ |
| Postcondition | เจ้าหน้าที่เห็นภาพรวมสถานการณ์ตามเงื่อนไขกรองปัจจุบัน และตัดสินใจ escalate หรือไม่ escalate |
| Reference | Journey Step 1-7b (`USER-JOURNEY-outbreak-dashboard.md`) · Operation 1-5 (`API-SPEC.md` หัวข้อ 2B) · Entity `CASE`, `ALERT`, `SERVICE_ZONE`, `COMMUNITY`, `DISEASE` · Component Web App (Dashboard), API Server |

### 2. Sequence Flow

```mermaid
sequenceDiagram
  participant จนท as เจ้าหน้าที่เฝ้าระวังโรค
  participant Dash as Outbreak Dashboard UI
  participant API as API Server
  participant Data as CASE / ALERT / SERVICE_ZONE / COMMUNITY

  จนท->>Dash: เปิดหน้า Dashboard (ค่าเริ่มต้น: ทุกโรค/ทุกเขต/14 วันล่าสุด)
  Dash->>API: ดึงข้อมูล Stat tiles + อัตราป่วยต่อแสนประชากร + แผนที่ความเสี่ยง + กราฟแนวโน้ม + Recent Alerts + ตารางวิเคราะห์เชิงลึก (operation 1-5)
  API->>Data: อ่าน/รวมข้อมูลตามช่วงกรองปัจจุบัน
  Data-->>API: ผลลัพธ์ดิบ
  API->>API: คำนวณ stat tiles, อัตราป่วยต่อแสนประชากร (เคสสะสม/ประชากรเขตจาก SERVICE_ZONE), ระดับความเสี่ยงต่อเขต, แนวโน้ม, breakdown ตารางต่างๆ
  API-->>Dash: ผลลัพธ์ทุก panel
  Dash-->>จนท: แสดง Stat tiles, ตารางเพศ, แผนที่ความเสี่ยงตามเขตบริการ, กราฟแนวโน้ม 2 กราฟ, Recent Alerts

  opt เจ้าหน้าที่ยังตัดสินใจไม่ได้ เลื่อนดู panel เพิ่ม
    Dash-->>จนท: แสดงตารางกลุ่มอายุ/สถิติอายุ/DF-DHF/อาชีพ/ชุมชนเคสสูงสุด/เขตบริการเรียงอัตราป่วย/ป่วยจาก
  end

  loop ทุกครั้งที่เจ้าหน้าที่เปลี่ยน Filter (โรค/เขตบริการ/ช่วงวันที่)
    จนท->>Dash: ตั้งค่า Filter ใหม่
    Dash->>API: ส่งเงื่อนไข AND ใหม่ (operation 1-5 ซ้ำ)
    API->>Data: อ่าน/รวมข้อมูลตามเงื่อนไขใหม่
    Data-->>API: ผลลัพธ์ใหม่
    API-->>Dash: ผลลัพธ์ทุก panel (recompute ใหม่ทั้งหมด พร้อมกัน)
    Dash-->>จนท: ทุก panel อัปเดตพร้อมกันทันที
  end

  alt เห็นสัญญาณชัดเจน (เขตวิกฤต + แนวโน้มเพิ่มขึ้นต่อเนื่อง)
    จนท->>จนท: ตัดสินใจ escalate ผ่านช่องทางนอกระบบ (โทร/LINE)
    Note over จนท,Dash: เมนู Cases/Alerts ยังไม่เชื่อมจากหน้านี้โดยตรง (backlog FEAT-INTAKE-08, FEAT-ALERT-03)
  else ไม่พบสัญญาณผิดปกติ
    จนท->>Dash: กด "ล้างตัวกรอง"
    Dash->>API: คืนเงื่อนไขเป็นค่าเริ่มต้น
    API-->>Dash: ผลลัพธ์ค่าเริ่มต้น
    Dash-->>จนท: ทุก panel กลับสู่มุมมองภาพรวม
  end
```

### 3. Business Rule / Validation Logic

| Rule | เงื่อนไข | ผลถ้าไม่ผ่าน | Feature ID |
|---|---|---|---|
| Filter ทำงานแบบ AND ร่วมกันทั้งหมด | โรค + เขตบริการ + ช่วงวันที่ | ทุก panel (FEAT-DASH-02, 03, 04, 05, 07-15) recompute พร้อมกันทันที | FEAT-DASH-06 |
| อัตราป่วยต่อแสนประชากรคำนวณจากเคสสะสม/ประชากรเขต | ใช้ `SERVICE_ZONE.population` | — | FEAT-DASH-07 |
| ระดับความเสี่ยงต่อเขต (ปกติ/เฝ้าระวัง/วิกฤต) | คำนวณจากจำนวนเคส/อัตราป่วยเทียบเกณฑ์ | **เกณฑ์ตัวเลขที่แน่นอนยังไม่ระบุในเอกสาร conceptual ชุดนี้ — ถือเป็น gap ที่ flag ไว้** ต้องยืนยันเพิ่มก่อน implement จริง | FEAT-DASH-03 |
| ตารางวิเคราะห์เชิงลึกด้านประชากร (เพศ/อายุ/อาชีพ/DF-DHF) | ต้องมี field demographic ใน `CASE` | `CASE` ในรอบนี้ยังไม่มี field เพศ/อายุ/อาชีพ/disease_id ที่ยืนยันแล้ว — **gap ที่มีอยู่แล้วใน DATA-MODEL.md** (ไม่ใช่จุดที่ Build Plan รอบนี้อนุมัติให้แก้ `CASE`) | FEAT-DASH-08 ถึง 11 |

### 4. Error & Exception Handling

ไม่มี error ระดับ business-critical เฉพาะสำหรับ flow นี้ตามขอบเขตที่ยืนยันใน Build Plan (Dashboard เป็น read-only, ไม่มีการเขียนข้อมูล) — ความเสี่ยงเดียวที่เกี่ยวข้องคือ escalate ช้าเพราะยังไม่เชื่อม Cases/Alerts จากหน้านี้ (เป็น functional gap ที่ ROADMAP.md Phase 6 ระบุไว้แล้ว ไม่ใช่ error case)

### 5. Traceability

| อ้างอิง | ID/ชื่อ |
|---|---|
| Feature | FEAT-DASH-01 ถึง FEAT-DASH-15 |
| Journey Step | USER-JOURNEY-outbreak-dashboard.md Step 1-7b |
| Entity | `CASE`, `ALERT`, `SERVICE_ZONE`, `COMMUNITY`, `DISEASE` |
| Operation | API-SPEC.md operation 1-5 (หัวข้อ 2B) |
| Component | Web App (Dashboard), API Server |

---

# โมดูล: Case Analysis (`FEAT-ANALYSIS-*`)

## Flow 5 — Case Clustering Confirm & Report Flow (step-by-step ละเอียด) — `FEAT-ANALYSIS-01`/`02`/`04`

### 1. Flow Overview

| หัวข้อ | รายละเอียด |
|---|---|
| Trigger | ทีมสอบสวนโรค (นักระบาดวิทยา) เปิดหน้า Case Analysis เพื่อตรวจสอบ cluster ที่ AI เสนอ |
| Actor หลัก | ทีมสอบสวนโรค (นักระบาดวิทยา) |
| Precondition | มี `CASE_CLUSTER` อย่างน้อย 1 กลุ่มที่ AI เสนอไว้แล้ว (`status = pending`) |
| Postcondition | Cluster ที่เห็นด้วยถูกยืนยัน (`confirmed`) และอาจมี `INVESTIGATION_REPORT` ที่ถูกส่งแล้ว |
| Reference | Operation 1-4 (`API-SPEC.md` หัวข้อ 2C) · Entity `CASE_CLUSTER`, `INVESTIGATION_REPORT`, `CASE` · Component Web App (Case Analysis), API Server, บริการ Case Clustering (backlog `FEAT-ANALYSIS-04`) |

### 2. Sequence Flow

```mermaid
sequenceDiagram
  participant นรพ as ทีมสอบสวนโรค (นักระบาดวิทยา)
  participant UI as Web App (Case Analysis)
  participant API as API Server
  participant Data as CASE_CLUSTER / INVESTIGATION_REPORT / CASE

  นรพ->>UI: เปิดหน้า Case Cluster Map
  UI->>API: ดึงข้อมูล Case Cluster Map (operation 1)
  API->>Data: อ่าน CASE_CLUSTER พร้อม CASE ที่เกี่ยวข้อง
  Data-->>API: รายการ cluster (pending/confirmed)
  API-->>UI: แสดงแผนที่ + รายการ cluster พร้อม confidence_pct/close_contacts_estimate

  นรพ->>UI: ตรวจสอบรายละเอียด cluster ที่ status = pending
  alt เห็นด้วยกับกลุ่มที่ AI เสนอ
    นรพ->>UI: กด "ยืนยัน cluster นี้"
    UI->>API: ยืนยัน cluster (cluster_id)
    API->>API: ตรวจสอบ status ต้อง = pending
    alt status = pending
      API->>Data: CASE_CLUSTER.status -> confirmed, confirmed_at = now
      Note over API,Data: สถานะเปลี่ยน: pending -> confirmed (ทางเดียว ไม่มี reopen)
      Data-->>API: บันทึกสำเร็จ
      API-->>UI: แสดง "ยืนยันแล้ว" + เปิดตัวเลือกกลุ่มนี้ในช่องสร้างรายงาน
    else status = confirmed อยู่แล้ว
      API-->>UI: ปฏิเสธ (ป้องกันยืนยันซ้ำ)
    end
  else ไม่เห็นด้วย/ยังไม่แน่ใจว่า cluster ผิดพื้นที่หรือไม่
    Note over นรพ,UI: ไม่กดยืนยัน — cluster ค้างสถานะ pending (รอบนี้ยังไม่มี operation "ปฏิเสธ/แก้ไของค์ประกอบ cluster" — ดู gap หัวข้อ 4)
  end

  opt นักระบาดวิทยาต้องการร่างรายงานจากกลุ่มที่ยืนยันแล้ว
    นรพ->>UI: เลือก cluster (เฉพาะที่ status = confirmed) แล้วกด "สร้างร่างรายงาน"
    UI->>API: สร้างร่างรายงาน (cluster_id)
    API->>API: ตรวจสอบ cluster.status ต้อง = confirmed
    alt confirmed
      API->>Data: สร้าง INVESTIGATION_REPORT ใหม่ (status=draft, content=ร่างจากข้อมูล cluster+เคส)
      Data-->>API: บันทึกสำเร็จ
      API-->>UI: แสดงเนื้อหาร่างในกล่องข้อความ (แก้ไขต่อได้)
    else ยังไม่ confirmed
      API-->>UI: ปฏิเสธ (ตัวเลือกกลุ่มนี้ไม่ปรากฏในช่องเลือกอยู่แล้ว)
    end

    นรพ->>UI: แก้ไขเนื้อหารายงานตามความเหมาะสม แล้วกด "ส่งรายงาน"
    UI->>API: ส่งรายงาน (report_id, content)
    alt content ไม่ว่าง
      API->>Data: INVESTIGATION_REPORT.status -> sent, sent_at = now
      API-->>UI: แสดงสถานะ "ส่งแล้ว"
    else content ว่าง
      API-->>UI: ปฏิเสธ (ปุ่มส่งไม่ทำงานถ้าเนื้อหาว่าง)
    end
  end
```

### 3. Business Rule / Validation Logic

| Rule | เงื่อนไข | ผลถ้าไม่ผ่าน | Feature ID |
|---|---|---|---|
| ยืนยัน cluster เป็น one-way | `status = pending` เท่านั้น | ปฏิเสธถ้า confirmed อยู่แล้ว ไม่มี reopen | FEAT-ANALYSIS-01 |
| สร้างรายงานได้เฉพาะ cluster ที่ยืนยันแล้ว | `CASE_CLUSTER.status = confirmed` | ตัวเลือกไม่ปรากฏในช่องเลือก | FEAT-ANALYSIS-02 |
| ส่งรายงานได้ต่อเมื่อเนื้อหาไม่ว่าง | `content` ไม่ว่าง | ปุ่มส่งไม่ทำงาน | FEAT-ANALYSIS-02 |
| 1 cluster มีรายงานได้อย่างมาก 1 ฉบับ | `CASE_CLUSTER` ↔ `INVESTIGATION_REPORT` = 1:1 optional | — | DATA-MODEL.md |

### 4. Error & Exception Handling

| กรณี | จุดที่เกิด (อ้างจาก step ใน diagram) | การจัดการ | ผลกระทบต่อผู้ใช้/ข้อมูล |
|---|---|---|---|
| Cluster ผิดพื้นที่ (AI เสนอผิด) | ตอนนักระบาดวิทยาตรวจสอบ cluster ก่อนยืนยัน | Human-in-the-loop คือกลไกป้องกันหลัก (Decision Log ข้อ 3, `HIGH-LEVEL-ARCHITECTURE.md`) — นักระบาดวิทยาไม่กดยืนยันถ้าเห็นว่าผิด แต่ **รอบนี้ยังไม่มี operation "ปฏิเสธ/แก้ไของค์ประกอบ cluster"** ที่ยืนยันใน Build Plan — cluster ที่ผิดจะค้างสถานะ `pending` ตลอดไปโดยไม่มีทางแก้ไข/ยุบกลุ่มในระบบ — ถือเป็น **gap** ที่ flag ไว้ | เคสที่ AI จัดกลุ่มผิดจะไม่ถูกนำไปทำรายงาน (ปลอดภัยเพราะสร้างรายงานได้เฉพาะ confirmed) แต่ก็ไม่มีทางแก้ไของค์ประกอบกลุ่มให้ถูกต้องได้ในระบบเช่นกัน |
| ยืนยัน cluster ซ้ำ (double-confirm) | ตอนยืนยัน cluster | API ตรวจสอบ `status = pending` ก่อนเปลี่ยนทุกครั้ง | ปฏิเสธคำขอซ้ำ ไม่มีผลข้างเคียง |

### 5. Traceability

| อ้างอิง | ID/ชื่อ |
|---|---|
| Feature | FEAT-ANALYSIS-01, FEAT-ANALYSIS-02, FEAT-ANALYSIS-04 (backlog), FEAT-ANALYSIS-05 (backlog) |
| Entity | `CASE_CLUSTER`, `INVESTIGATION_REPORT`, `CASE` |
| Operation | API-SPEC.md operation 1-4 (หัวข้อ 2C) |
| Component | Web App (Case Analysis), API Server, บริการ Case Clustering (backlog) |

---

## Flow 6 — AI Cluster Suggestion Generation (coarse, system-to-system) — `FEAT-ANALYSIS-04`

### 1. Flow Overview

| หัวข้อ | รายละเอียด |
|---|---|
| Trigger | ระบบวิเคราะห์เชื่อมโยงเคสที่ยืนยันแล้วและยังไม่ถูกจัดกลุ่ม (เป็น system-to-system ไม่ใช่ human trigger โดยตรง) |
| Actor หลัก | ระบบ (API Server + บริการ Case Clustering) |
| Precondition | มีเคสที่ยืนยันแล้วและ `cluster_id = null` |
| Postcondition | อาจมี `CASE_CLUSTER` ใหม่ (`status = pending`) รอนักระบาดวิทยายืนยันต่อใน Flow 5 |
| Reference | ฐานรองรับ Operation 1 (`API-SPEC.md` หัวข้อ 2C) · Entity `CASE`, `CASE_CLUSTER` · Component บริการ Case Clustering (backlog) |

### 2. Sequence Flow

```mermaid
sequenceDiagram
  participant API as API Server
  participant Cluster as บริการ Case Clustering (statistical/spatial-temporal)
  participant Data as CASE / CASE_CLUSTER

  API->>Data: ดึงเคสที่ยืนยันแล้วและยังไม่ถูกจัดกลุ่ม (cluster_id = null)
  Data-->>API: รายการเคสที่ยังไม่จัดกลุ่ม
  API->>Cluster: วิเคราะห์เชื่อมโยงตามเวลา/พื้นที่/ผู้สัมผัส
  alt พบกลุ่มที่เป็นไปได้ (ตามเกณฑ์ของบริการ)
    Cluster-->>API: กลุ่มที่เสนอ + confidence_pct + close_contacts_estimate
    API->>Data: สร้าง CASE_CLUSTER ใหม่ (status=pending) + ผูก CASE.cluster_id
    Note over API,Data: เป็นเพียงข้อเสนอ (pending) เท่านั้น — ต้องรอนักระบาดวิทยายืนยันเสมอ (human-in-the-loop, ไม่มี auto-confirm)
  else ไม่พบกลุ่มที่ชัดเจนพอ
    Cluster-->>API: ไม่มีข้อเสนอในรอบนี้
    API->>API: เคสยังไม่ถูกจัดกลุ่ม รอวิเคราะห์รอบถัดไป
  end
```

### 3. Business Rule / Validation Logic

| Rule | เงื่อนไข | ผลถ้าไม่ผ่าน | Feature ID |
|---|---|---|---|
| AI เสนอเท่านั้น ไม่ auto-confirm | เสมอ | ต้องผ่าน Flow 5 (human-in-the-loop) ก่อนนำไปใช้จริง | FEAT-ANALYSIS-04 |

### 4. Error & Exception Handling

| กรณี | จุดที่เกิด (อ้างจาก step ใน diagram) | การจัดการ | ผลกระทบต่อผู้ใช้/ข้อมูล |
|---|---|---|---|
| Cluster ผิดพื้นที่ | ตอนบริการ Case Clustering วิเคราะห์ (เช่น ข้อมูลพิกัดไม่แม่นยำ `geo_accuracy = low` ที่ยังไม่ปรับ) | Mitigate ด้วย human-in-the-loop confirm ใน Flow 5 เสมอ — ไม่ auto-commit เข้าเคสจริง | Cluster ที่เสนอผิดจะไม่ถูกยืนยันถ้านักระบาดวิทยาตรวจพบ (ขึ้นกับความละเอียดของการตรวจ) |

### 5. Traceability

| อ้างอิง | ID/ชื่อ |
|---|---|
| Feature | FEAT-ANALYSIS-04 (backlog) |
| Entity | `CASE`, `CASE_CLUSTER` |
| Operation | API-SPEC.md operation 1 (ฐานรองรับ) |
| Component | API Server, บริการ Case Clustering (backlog) |

---

## Flow 7 — ASM Coordination Chat (coarse, scripted demo) — `FEAT-ANALYSIS-03`/`06`

### 1. Flow Overview

| หัวข้อ | รายละเอียด |
|---|---|
| Trigger | ทีมสอบสวนโรคเปิดหน้าต่างสนทนากับ อสม. |
| Actor หลัก | ทีมสอบสวนโรค / อสม. |
| Precondition | — |
| Postcondition | แสดงบทสนทนาตัวอย่างครบตามสคริปต์ (ไม่ persist ข้อมูลจริง) |
| Reference | Operation 5 (`API-SPEC.md` หัวข้อ 2C) · Component Web App (Case Analysis) |

**หมายเหตุสำคัญ**: เป็น **scripted demo แบบ fixed script เท่านั้น ไม่ persist บทสนทนาจริง** ในรอบนี้ (ตรงกับ `DATA-MODEL.md` ที่ระบุว่า `FEAT-ANALYSIS-03` ยังไม่มี entity ของตัวเอง) — ต้องรอ `FEAT-ANALYSIS-06` (chatbot จริง จำกัดสิทธิ์ตาม PDPA) จึงจะมี entity/operation รองรับจริง

### 2. Sequence Flow

```mermaid
sequenceDiagram
  participant ทีม as ทีมสอบสวนโรค / อสม.
  participant UI as Web App (Case Analysis — chatbot demo)

  Note over ทีม,UI: สคริปต์ตายตัว (fixed script) — ยังไม่ persist บทสนทนาจริง จนกว่า FEAT-ANALYSIS-06

  ทีม->>UI: เปิดหน้าต่างสนทนา (แสดงคู่บทสนทนาแรกเป็นค่าเริ่มต้น)
  loop จนกว่าจะถึงคู่บทสนทนาสุดท้ายในสคริปต์
    ทีม->>UI: กด "แสดงข้อความถัดไป"
    alt ยังไม่ถึงคู่บทสนทนาสุดท้าย
      UI-->>ทีม: เปิดเผยคู่บทสนทนาถัดไป (ข้อความบอท + คำตอบ อสม.)
    else ถึงคู่บทสนทนาสุดท้ายแล้ว
      UI-->>ทีม: ซ่อนปุ่ม แสดงข้อความจบบทสนทนา
    end
  end
```

### 3. Business Rule / Validation Logic

| Rule | เงื่อนไข | ผลถ้าไม่ผ่าน | Feature ID |
|---|---|---|---|
| จำกัดสิทธิ์แค่นัดหมาย/แจ้งพื้นที่ (PDPA) | เมื่อเป็น chatbot จริงในอนาคต (`FEAT-ANALYSIS-06`) | ห้ามส่งข้อมูลเคสละเอียดผ่าน chatbot | FEAT-ANALYSIS-06 (backlog) |

### 4. Error & Exception Handling

ไม่มี error ระดับ business-critical สำหรับ flow นี้ (ไม่มีการเขียนข้อมูล/persist ในรอบนี้)

### 5. Traceability

| อ้างอิง | ID/ชื่อ |
|---|---|
| Feature | FEAT-ANALYSIS-03, FEAT-ANALYSIS-06 (backlog) |
| Operation | API-SPEC.md operation 5 |
| Component | Web App (Case Analysis), LINE OA (ช่องทางในอนาคตตาม backlog) |

---

# โมดูล: Control Plan (`FEAT-CONTROL-*`)

## Flow 8 — Control Plan Approval Flow (step-by-step ละเอียด) — `FEAT-CONTROL-01`/`02`

### 1. Flow Overview

| หัวข้อ | รายละเอียด |
|---|---|
| Trigger | ทีมควบคุมโรคต้องการขออนุมัติเบิกน้ำมัน/น้ำยาเคมีสำหรับรอบปฏิบัติงานปัจจุบัน |
| Actor หลัก | ทีมควบคุมโรค (สร้าง/ส่งคำขอ), ผู้บริหาร/หัวหน้างาน (อนุมัติ) |
| Precondition | มีเคส/ตำแหน่งที่ `CONTROL_LOCATION.active = true` อย่างน้อย 1 รายการ |
| Postcondition | `APPROVAL_REQUEST.status = approved` หรือ `rejected` (terminal state ทั้งคู่ — แล้วแต่ผลการพิจารณาของผู้บริหาร) |
| Reference | Operation 5-9 (`API-SPEC.md` หัวข้อ 2D) · Entity `APPROVAL_REQUEST`, `APPROVAL_REQUEST_CASE`, `CASE` · Component Web App (Control Plan), API Server |

### 2. Sequence Flow

```mermaid
sequenceDiagram
  participant ทีม as ทีมควบคุมโรค
  participant ผบห as ผู้บริหาร/หัวหน้างาน
  participant UI as Web App (Control Plan)
  participant API as API Server
  participant Data as APPROVAL_REQUEST / APPROVAL_REQUEST_CASE / CASE

  ทีม->>UI: กด "สร้างร่างคำขออนุมัติ" (รอบใหม่)
  UI->>API: สร้างร่างคำขออนุมัติ (รายการ case_id ที่ active ขณะนั้น)
  API->>Data: สร้าง APPROVAL_REQUEST ใหม่ (status=draft, created_at=now) + APPROVAL_REQUEST_CASE (snapshot เคส active รอบนี้)
  Data-->>API: บันทึกสำเร็จ
  API-->>UI: แสดงร่างเอกสาร (ตามฟอร์มจริงของหน่วยงาน) ให้แก้ไขต่อได้

  ทีม->>UI: ตรวจ/แก้ไขเนื้อหาร่างตามจริง แล้วกด "ส่งคำขอ"
  UI->>API: ส่งคำขออนุมัติ (request_id)
  API->>API: ตรวจสอบว่ามีเคสรวมอยู่ในคำขอไม่ว่าง
  alt มีเคสรวมอยู่ (ไม่ว่าง)
    API->>Data: APPROVAL_REQUEST.status -> sent, sent_at = now
    Note over API,Data: สถานะเปลี่ยน: draft -> sent (ไม่มี fast-path ตรงไป approved)
    API-->>UI: แสดงสถานะ "รออนุมัติ"
  else ไม่มีเคสรวมอยู่เลย
    API-->>UI: ปฏิเสธ (ปุ่มส่งไม่ทำงานถ้าไม่มีรายการ)
  end

  ผบห->>UI: เปิดดูคำขอที่สถานะ "รออนุมัติ"
  alt ผู้บริหารกด "อนุมัติ"
    ผบห->>UI: กด "อนุมัติ"
    UI->>API: อนุมัติคำขอ (request_id, decided_by_name)
    API->>API: ตรวจสอบ request.status ต้อง = sent
    alt status = sent
      API->>Data: APPROVAL_REQUEST.status -> approved, approved_at = now, decided_by_name = ผู้บริหาร
      Note over API,Data: สถานะเปลี่ยน: sent -> approved (terminal state, ไม่มี reopen กลับ draft)
      API-->>UI: แสดงสถานะ "อนุมัติแล้ว" + เปิดปุ่ม "พิมพ์เป็น PDF"
    else status ไม่ใช่ sent (draft หรือ approved/rejected อยู่แล้ว)
      API-->>UI: ปฏิเสธ (ป้องกันอนุมัติซ้ำซ้อน หรืออนุมัติคำขอที่ยังไม่ถูกส่ง/ตัดสินใจไปแล้ว)
    end
  else ผู้บริหารกด "ไม่อนุมัติ"
    ผบห->>UI: กด "ไม่อนุมัติ"
    UI->>API: ไม่อนุมัติคำขอ (request_id, decided_by_name)
    API->>API: ตรวจสอบ request.status ต้อง = sent
    alt status = sent
      API->>Data: APPROVAL_REQUEST.status -> rejected, rejected_at = now, decided_by_name = ผู้บริหาร
      Note over API,Data: สถานะเปลี่ยน: sent -> rejected (terminal state เช่นเดียวกับ approved, ไม่มี reopen กลับ draft — ต้องสร้างคำขอรอบใหม่ถ้าต้องการยื่นใหม่)
      API-->>UI: แสดงสถานะ "ไม่อนุมัติแล้ว"
    else status ไม่ใช่ sent (draft หรือ approved/rejected อยู่แล้ว)
      API-->>UI: ปฏิเสธ (ป้องกันไม่อนุมัติซ้ำซ้อน หรือไม่อนุมัติคำขอที่ยังไม่ถูกส่ง/ตัดสินใจไปแล้ว)
    end
  end
```

### 2b. State Diagram — `APPROVAL_REQUEST`

> เพิ่มใหม่ในรอบนี้ — `APPROVAL_REQUEST` ข้าม threshold ≥4 สถานะจริงหลังเพิ่ม `rejected` (ดูหัวข้อ 0 ต้นไฟล์)

```mermaid
stateDiagram-v2
  [*] --> draft : สร้างร่างคำขอ
  draft --> sent : ส่งคำขอ (ต้องมีเคสรวมอยู่ไม่ว่าง)
  sent --> approved : ผู้บริหารกด "อนุมัติ"
  sent --> rejected : ผู้บริหารกด "ไม่อนุมัติ"
  approved --> [*]
  rejected --> [*]
```

**หมายเหตุ**: `approved` และ `rejected` เป็น terminal state ทั้งคู่ — ไม่มี transition ย้อนกลับ `draft` จากสถานะใดเลย (ต้องสร้าง `APPROVAL_REQUEST` ใหม่ทั้งรายการถ้าต้องการยื่นคำขอรอบใหม่)

### 3. Business Rule / Validation Logic

| Rule | เงื่อนไข | ผลถ้าไม่ผ่าน | Feature ID |
|---|---|---|---|
| draft -> sent ต้องมีเนื้อหาไม่ว่าง | มีเคสรวมอยู่ในคำขออย่างน้อย 1 รายการ | ปุ่มส่งไม่ทำงาน | FEAT-CONTROL-02 |
| sent -> approved เท่านั้น | ไม่มี fast-path จาก draft | ปฏิเสธ ต้องผ่านสถานะ sent ก่อน | FEAT-CONTROL-02 |
| ไม่มี reopen กลับ draft | เสมอ | คำขอที่ approved แล้วคงสถานะตลอดไป | FEAT-CONTROL-02 |
| sent -> rejected เท่านั้น | ไม่มี fast-path จาก draft, เป็น terminal state เช่นเดียวกับ sent -> approved | ปฏิเสธ ต้องผ่านสถานะ sent ก่อน, ไม่มี reopen กลับ draft | FEAT-CONTROL-02 |
| 1 คำขอ = 1 รอบ (batch snapshot) | เก็บเป็น log ประวัติทุกรอบ | เคสเดียวกันปรากฏได้หลายคำขอ/หลายรอบ | DATA-MODEL.md |

### 4. Error & Exception Handling

| กรณี | จุดที่เกิด (อ้างจาก step ใน diagram) | การจัดการ | ผลกระทบต่อผู้ใช้/ข้อมูล |
|---|---|---|---|
| อนุมัติซ้ำซ้อน | ตอนผู้บริหารกด "อนุมัติ" | API ตรวจสอบ `request.status = sent` ก่อนเปลี่ยนเป็น `approved` ทุกครั้ง — ปฏิเสธถ้าเป็น `draft` (ยังไม่ส่ง) หรือ `approved` อยู่แล้ว (อนุมัติซ้ำ) | ป้องกันการเบิกจ่ายซ้ำซ้อนจากคำขอเดียวกัน |
| ไม่อนุมัติซ้ำซ้อน/ไม่อนุมัติคำขอที่ยังไม่ส่ง | ตอนผู้บริหารกด "ไม่อนุมัติ" | API ตรวจสอบ `request.status = sent` ก่อนเปลี่ยนเป็น `rejected` ทุกครั้ง — ปฏิเสธถ้าเป็น `draft` (ยังไม่ส่ง) หรือ `approved`/`rejected` อยู่แล้ว (ตัดสินใจไปแล้ว) | ป้องกันการเปลี่ยนผลการพิจารณาซ้ำซ้อนจากคำขอเดียวกัน |
| ส่งคำขอที่ไม่มีเคสรวมอยู่ | ตอนกด "ส่งคำขอ" | API ตรวจสอบเนื้อหาไม่ว่างก่อนเปลี่ยนเป็น `sent` | ปฏิเสธการส่ง ป้องกันคำขอเปล่า |

### 5. Traceability

| อ้างอิง | ID/ชื่อ |
|---|---|
| Feature | FEAT-CONTROL-01, FEAT-CONTROL-02, FEAT-CONTROL-03 (backlog) |
| Entity | `APPROVAL_REQUEST`, `APPROVAL_REQUEST_CASE`, `CASE` |
| Operation | API-SPEC.md operation 5-9 (หัวข้อ 2D) |
| Component | Web App (Control Plan), API Server |

---

## Flow 9 — Spray Workplan Assignment (coarse) — `FEAT-CONTROL-01`

### 1. Flow Overview

| หัวข้อ | รายละเอียด |
|---|---|
| Trigger | ทีมควบคุมโรคกำหนด/แก้ไขแผนปฏิบัติงานพ่น (มอบหมายทีม+Day 0/1/7+เวลา) และทำเครื่องหมายว่าพ่นแล้ว |
| Actor หลัก | ทีมควบคุมโรค |
| Precondition | มี `CONTROL_LOCATION.active = true` |
| Postcondition | `SPRAY_ASSIGNMENT` ถูกสร้าง/อัปเดต และอาจถูกซ่อนจากตารางเมื่อพ่นครบ Day 0/1/7 |
| Reference | Operation 3, 4 (`API-SPEC.md` หัวข้อ 2D) · Entity `CONTROL_LOCATION`, `SPRAY_ASSIGNMENT` |

### 2. Sequence Flow

```mermaid
sequenceDiagram
  participant ทีม as ทีมควบคุมโรค
  participant UI as Web App (Control Plan)
  participant API as API Server
  participant Data as CONTROL_LOCATION / SPRAY_ASSIGNMENT

  ทีม->>UI: เลือกทีมพ่น + Day (0/1/7) + เวลา สำหรับตำแหน่งที่ active
  UI->>API: กำหนด/แก้ไขแผนปฏิบัติงานพ่น (location_id, assigned_team_id, day_offset, scheduled_time)
  alt location.active = true
    API->>Data: อัปเดต/สร้าง SPRAY_ASSIGNMENT
    API-->>UI: แสดงแถวแผนปฏิบัติงานที่อัปเดตแล้ว
  else location.active = false
    API-->>UI: ปฏิเสธ (ต้องเปิด active ที่ตำแหน่งนี้ก่อน)
  end

  ทีม->>UI: ทำเครื่องหมาย "พ่นแล้ว" ต่อวัน (Day 0/1/7)
  UI->>API: อัปเดตสถานะพ่นแล้ว (assignment_id, วันที่ทำเครื่องหมาย)
  API->>Data: SPRAY_ASSIGNMENT.day{N}_done -> true
  alt ครบทั้ง Day 0/1/7 แล้ว
    API-->>UI: ซ่อนแถวนี้จากตารางแผนปฏิบัติงาน (ยังไม่ลบข้อมูล)
  else ยังไม่ครบทุกวัน
    API-->>UI: แสดงแถวต่อไปตามปกติ
  end
```

### 3. Business Rule / Validation Logic

| Rule | เงื่อนไข | ผลถ้าไม่ผ่าน | Feature ID |
|---|---|---|---|
| สร้างแผนปฏิบัติงานได้เฉพาะตำแหน่ง active | `CONTROL_LOCATION.active = true` | ปฏิเสธ | FEAT-CONTROL-01 |
| แถวที่พ่นครบ Day 0/1/7 ถูกซ่อนจากตาราง (ไม่ลบ) | `day0_done`/`day1_done`/`day7_done` = true ทั้งหมด | แถวยังอยู่ใน entity แต่ไม่แสดงในตาราง | FEAT-CONTROL-01 |

### 4. Error & Exception Handling

ไม่มี error ระดับ business-critical เฉพาะสำหรับ flow นี้ตามขอบเขตที่ยืนยันใน Build Plan

### 5. Traceability

| อ้างอิง | ID/ชื่อ |
|---|---|
| Feature | FEAT-CONTROL-01, FEAT-CONTROL-04 (backlog), FEAT-CONTROL-05 (backlog) |
| Entity | `CONTROL_LOCATION`, `SPRAY_ASSIGNMENT` |
| Operation | API-SPEC.md operation 3, 4 |
| Component | Web App (Control Plan), API Server |

---

## Flow 10 — Location Management (coarse) — `FEAT-CONTROL-01`/`02`

### 1. Flow Overview

| หัวข้อ | รายละเอียด |
|---|---|
| Trigger | ทีมควบคุมโรคแก้ไขที่อยู่/ชื่อสถานที่/รัศมี หรือเปิด-ปิด active ของตำแหน่งควบคุมโรค |
| Actor หลัก | ทีมควบคุมโรค |
| Precondition | เคสมีตำแหน่งควบคุมโรค (`CONTROL_LOCATION`) อย่างน้อย 1 แห่ง |
| Postcondition | `CONTROL_LOCATION` ที่แก้ไขแล้ว โดยยังคง active อย่างน้อย 1 แห่งต่อเคสเสมอ |
| Reference | Operation 2 (`API-SPEC.md` หัวข้อ 2D) · Entity `CONTROL_LOCATION` |

### 2. Sequence Flow

```mermaid
sequenceDiagram
  participant ทีม as ทีมควบคุมโรค
  participant UI as Web App (Control Plan)
  participant API as API Server
  participant Data as CONTROL_LOCATION

  ทีม->>UI: แก้ไขที่อยู่/ชื่อสถานที่/รัศมี หรือ เปิด-ปิด active ของตำแหน่ง
  UI->>API: แก้ไขตำแหน่ง/รัศมีควบคุมโรค (location_id, ...)
  alt เคสยังมีตำแหน่ง active อย่างน้อย 1 แห่งหลังการแก้ไข
    API->>Data: อัปเดต CONTROL_LOCATION
    API-->>UI: แสดงค่าที่แก้ไขแล้ว (ที่อยู่/รัศมี/จำนวนหลังคาเรือนประมาณการใหม่)
  else การแก้ไขจะทำให้เคสนี้ไม่มีตำแหน่ง active เหลือเลย
    API-->>UI: ปฏิเสธ (ต้องมีตำแหน่ง active อย่างน้อย 1 แห่งต่อเคสเสมอ)
  end
```

### 3. Business Rule / Validation Logic

| Rule | เงื่อนไข | ผลถ้าไม่ผ่าน | Feature ID |
|---|---|---|---|
| ต้องมีตำแหน่ง active อย่างน้อย 1 แห่งต่อเคสเสมอ | ตรวจก่อนบันทึกทุกครั้ง | ปฏิเสธการปิด active ตำแหน่งสุดท้าย | FEAT-CONTROL-01 |

### 4. Error & Exception Handling

ไม่มี error ระดับ business-critical เฉพาะสำหรับ flow นี้นอกเหนือจาก business rule ข้างต้น (ครอบคลุมแล้วในหัวข้อ 3)

### 5. Traceability

| อ้างอิง | ID/ชื่อ |
|---|---|
| Feature | FEAT-CONTROL-01, FEAT-CONTROL-02 |
| Entity | `CONTROL_LOCATION` |
| Operation | API-SPEC.md operation 2 |
| Component | Web App (Control Plan), API Server |

---

# โมดูล: Field Tracking (`FEAT-TRACK-*`)

## Flow 11 — Team Status Update (coarse) — `FEAT-TRACK-01`

### 1. Flow Overview

| หัวข้อ | รายละเอียด |
|---|---|
| Trigger | ทีมพ่นอัปเดตสถานะปฏิบัติงานภาคสนาม |
| Actor หลัก | ทีมพ่น |
| Precondition | `TEAM.team_type = control` |
| Postcondition | `TEAM.status` เปลี่ยนไปสถานะถัดไป, `last_update_at` อัปเดต |
| Reference | Operation 1, 2 (`API-SPEC.md` หัวข้อ 2E) · Entity `TEAM` |

### 2. Sequence Flow

```mermaid
sequenceDiagram
  participant ทีมพ่น as ทีมพ่น
  participant UI as Web App (Field Tracking)
  participant API as API Server
  participant Data as TEAM (team_type=control)

  ทีมพ่น->>UI: กดอัปเดตสถานะปฏิบัติงาน
  UI->>API: อัปเดตสถานะทีมพ่น (team_id)
  alt สถานะปัจจุบัน = ยังไม่ถึง หรือ กำลังพ่น
    API->>Data: TEAM.status -> สถานะถัดไป (ยังไม่ถึง -> กำลังพ่น -> พ่นแล้ว), last_update_at = now
    Note over API,Data: เก็บเฉพาะสถานะปัจจุบัน ไม่เก็บประวัติการเคลื่อนที่ (assumption: เปลี่ยนตามลำดับทีละขั้น ไม่ข้าม/ย้อนกลับ — ดู assumption ท้ายผลลัพธ์)
    API-->>UI: แสดงสถานะใหม่บนแผนที่ติดตาม
  else สถานะปัจจุบัน = พ่นแล้ว (ขั้นสุดท้าย)
    API-->>UI: ไม่มีสถานะถัดไปให้เปลี่ยน (ปุ่มอัปเดตไม่ทำงานต่อ)
  end
```

### 3. Business Rule / Validation Logic

| Rule | เงื่อนไข | ผลถ้าไม่ผ่าน | Feature ID |
|---|---|---|---|
| สถานะเปลี่ยนตามลำดับทีละขั้น (ยังไม่ถึง→กำลังพ่น→พ่นแล้ว) | ทุกครั้งที่อัปเดต | ไม่มีสถานะถัดไปเมื่อถึง "พ่นแล้ว" | FEAT-TRACK-01 |
| เก็บเฉพาะสถานะปัจจุบัน ไม่เก็บประวัติการเคลื่อนที่ | เสมอ | — | FEAT-TRACK-01 (DATA-MODEL.md) |

### 4. Error & Exception Handling

ไม่มี error ระดับ business-critical เฉพาะสำหรับ flow นี้ตามขอบเขตที่ยืนยันใน Build Plan

### 5. Traceability

| อ้างอิง | ID/ชื่อ |
|---|---|
| Feature | FEAT-TRACK-01, FEAT-CONTROL-04 (backlog) |
| Entity | `TEAM` |
| Operation | API-SPEC.md operation 1, 2 (หัวข้อ 2E) |
| Component | Web App (Field Tracking), API Server, บริการติดตามตำแหน่งทีมพ่น (backlog) |

---

## Flow 12 — AI Vision QC + Manual Check (coarse) — `FEAT-TRACK-02`

### 1. Flow Overview

| หัวข้อ | รายละเอียด |
|---|---|
| Trigger | ทีมควบคุมโรคเปิดดูรูปภาคสนามพร้อมผลตรวจ AI Vision QC |
| Actor หลัก | ทีมควบคุมโรค |
| Precondition | มี `FIELD_PHOTO` ที่ผ่านการประเมินจากบริการ AI Vision QC แล้ว |
| Postcondition | รูปที่ AI ตรวจไม่ผ่านอาจถูกตรวจสอบด้วยมือ (`manual_checked = true`) |
| Reference | Operation 3, 4 (`API-SPEC.md` หัวข้อ 2E) · Entity `FIELD_PHOTO` · Component บริการ AI Vision QC (backlog `FEAT-CONTROL-05`) |

### 2. Sequence Flow

```mermaid
sequenceDiagram
  participant ทีม as ทีมควบคุมโรค
  participant UI as Web App (Field Tracking)
  participant API as API Server
  participant Data as FIELD_PHOTO

  Note over API,Data: ผล location_match/time_match มาจากบริการ AI Vision QC ที่ประมวลผลไว้ล่วงหน้าแล้ว (backlog FEAT-CONTROL-05 สำหรับ vendor จริง)

  ทีม->>UI: เปิดดูรูปภาคสนามพร้อมผลตรวจ
  UI->>API: ดึงรูปภาคสนามพร้อมผลตรวจ AI Vision QC (filter: team_id)
  API->>Data: อ่าน FIELD_PHOTO
  Data-->>API: รายการรูปพร้อมผลตรวจ
  API-->>UI: แสดงรูปพร้อม badge ผลตรวจ

  alt location_match = false หรือ time_match = false
    UI-->>ทีม: แสดงปุ่ม "ตรวจสอบด้วยมือ"
    ทีม->>UI: กด "ตรวจสอบด้วยมือ" (photo_id)
    UI->>API: ตรวจสอบรูปด้วยมือ (photo_id)
    API->>Data: FIELD_PHOTO.manual_checked -> true
    API-->>UI: แสดงสถานะ "ตรวจสอบด้วยมือแล้ว"
  else location_match = true และ time_match = true
    UI-->>ทีม: ไม่ต้องตรวจเพิ่มเติม (ปุ่มไม่ปรากฏ)
  end
```

### 3. Business Rule / Validation Logic

| Rule | เงื่อนไข | ผลถ้าไม่ผ่าน | Feature ID |
|---|---|---|---|
| ตรวจสอบด้วยมือได้เฉพาะรูปที่ AI ตรวจไม่ผ่านอย่างน้อย 1 ด้าน | `location_match = false` หรือ `time_match = false` | ปุ่ม "ตรวจสอบด้วยมือ" ไม่ปรากฏ | FEAT-TRACK-02 |

### 4. Error & Exception Handling

ไม่มี error ระดับ business-critical เฉพาะสำหรับ flow นี้ตามขอบเขตที่ยืนยันใน Build Plan

### 5. Traceability

| อ้างอิง | ID/ชื่อ |
|---|---|
| Feature | FEAT-TRACK-02, FEAT-CONTROL-05 (backlog) |
| Entity | `FIELD_PHOTO` |
| Operation | API-SPEC.md operation 3, 4 |
| Component | Web App (Field Tracking), API Server, บริการ AI Vision QC (backlog) |

---

# โมดูล: ASM Coordination (`FEAT-ASM-*`)

## Flow 13 — Photo Intake Query/Filter (coarse) — `FEAT-ASM-01`

### 1. Flow Overview

| หัวข้อ | รายละเอียด |
|---|---|
| Trigger | ทีมควบคุมโรคเปิดหน้าเพื่อดูรูปยืนยันพ่นที่ อสม. ส่งเข้ามา |
| Actor หลัก | ทีมควบคุมโรค |
| Precondition | มี `ASM_PHOTO_INTAKE` ในระบบ |
| Postcondition | เห็นรายการรูปพร้อมสถานะสรุปโดย AI (พ่นแล้ว/ยังไม่พ่น) |
| Reference | Operation 1 (`API-SPEC.md` หัวข้อ 2F) · Entity `ASM_PHOTO_INTAKE` |

### 2. Sequence Flow

```mermaid
sequenceDiagram
  participant ทีม as ทีมควบคุมโรค
  participant UI as Web App (ASM Coordination)
  participant API as API Server
  participant Data as ASM_PHOTO_INTAKE

  ทีม->>UI: ตั้งค่า filter (พื้นที่/ช่วงวันที่)
  UI->>API: ดึงรูปยืนยันพ่นจาก อสม. (filter: พื้นที่, ช่วงวันที่)
  API->>Data: อ่าน ASM_PHOTO_INTAKE ตามเงื่อนไข
  Data-->>API: ผลลัพธ์
  alt พบรูปตรงเงื่อนไข
    API-->>UI: แสดงรายการรูปพร้อมสถานะสรุปโดย AI (พ่นแล้ว/ยังไม่พ่น)
  else ไม่พบข้อมูลตรงเงื่อนไข
    API-->>UI: แสดง empty state
  end
```

### 3. Business Rule / Validation Logic

| Rule | เงื่อนไข | ผลถ้าไม่ผ่าน | Feature ID |
|---|---|---|---|
| สถานะพ่นแล้ว/ยังไม่พ่น เป็น read-only ผลจาก AI | รอบนี้ยังไม่มี manual override ที่ยืนยัน | ผู้ใช้แก้ไขสถานะไม่ได้ในรอบนี้ | FEAT-ASM-01 |

### 4. Error & Exception Handling

ไม่มี error ระดับ business-critical เฉพาะสำหรับ flow นี้ตามขอบเขตที่ยืนยันใน Build Plan

### 5. Traceability

| อ้างอิง | ID/ชื่อ |
|---|---|
| Feature | FEAT-ASM-01, FEAT-ASM-03 (backlog) |
| Entity | `ASM_PHOTO_INTAKE` |
| Operation | API-SPEC.md operation 1 |
| Component | Web App (ASM Coordination), API Server, LINE OA (backlog) |

---

## Flow 14 — Advance Notice Queue (coarse) — `FEAT-ASM-02`

### 1. Flow Overview

| หัวข้อ | รายละเอียด |
|---|---|
| Trigger | ทีมควบคุมโรคเปิดดูคิวแจ้งเตือนล่วงหน้าก่อนวันพ่น (รอบ 1 ก่อน Day 0, รอบ 2 ก่อน Day 0+7) |
| Actor หลัก | ทีมควบคุมโรค |
| Precondition | มี `ADVANCE_NOTICE_QUEUE` ในระบบ |
| Postcondition | เห็นตัวอย่างข้อความ/สถานะการส่งของแต่ละรอบแจ้งเตือน |
| Reference | Operation 2, 3 (`API-SPEC.md` หัวข้อ 2F) · Entity `ADVANCE_NOTICE_QUEUE` |

### 2. Sequence Flow

```mermaid
sequenceDiagram
  participant ทีม as ทีมควบคุมโรค
  participant UI as Web App (ASM Coordination)
  participant API as API Server
  participant Data as ADVANCE_NOTICE_QUEUE

  ทีม->>UI: เปิดดูคิวแจ้งเตือนล่วงหน้า
  UI->>API: ดึงคิวแจ้งเตือนล่วงหน้า
  API->>Data: อ่าน ADVANCE_NOTICE_QUEUE
  Data-->>API: รายการคิว (รอบ 1 ก่อน Day 0, รอบ 2 ก่อน Day 0+7)
  API-->>UI: แสดงตารางคิว พร้อมสถานะ reminder1/reminder2 (sent/pending)

  ทีม->>UI: เลือกดูตัวอย่างข้อความ (queue_id)
  UI->>API: ดูตัวอย่างข้อความแจ้งเตือน (queue_id)
  alt reminder อยู่ในสถานะ pending
    API-->>UI: แสดงข้อความตัวอย่างก่อนส่งจริง (ยังไม่ส่งจริง — backlog FEAT-ASM-04)
  else reminder อยู่ในสถานะ sent แล้ว
    API-->>UI: แสดงสถานะ "ส่งแล้ว" แทนตัวอย่าง
  end
```

### 3. Business Rule / Validation Logic

| Rule | เงื่อนไข | ผลถ้าไม่ผ่าน | Feature ID |
|---|---|---|---|
| 2 รอบแจ้งเตือนต่อพื้นที่ (ก่อน Day 0 / ก่อน Day 0+7) | เก็บแบบ embedded ต่อแถว | — | FEAT-ASM-02 |

### 4. Error & Exception Handling

ไม่มี error ระดับ business-critical เฉพาะสำหรับ flow นี้ตามขอบเขตที่ยืนยันใน Build Plan — ข้อจำกัดเรื่อง quota ของ LINE Messaging API (`HIGH-LEVEL-ARCHITECTURE.md` หัวข้อ 4) เป็นข้อจำกัดทางเทคนิคทั่วไป ไม่ใช่ 1 ใน 5 ประเภท error ที่ยืนยันในขอบเขตรอบนี้

### 5. Traceability

| อ้างอิง | ID/ชื่อ |
|---|---|
| Feature | FEAT-ASM-02, FEAT-ASM-04 (backlog) |
| Entity | `ADVANCE_NOTICE_QUEUE` |
| Operation | API-SPEC.md operation 2, 3 |
| Component | Web App (ASM Coordination), API Server, LINE OA (backlog) |

---

# โมดูล: Reports (`FEAT-REPORT-*`)

## Flow 15 — Generate & Send Summary Report (coarse) — `FEAT-REPORT-01`/`02`

### 1. Flow Overview

| หัวข้อ | รายละเอียด |
|---|---|
| Trigger | ผู้บริหาร/เจ้าหน้าที่ต้องการสรุปสถานการณ์ประจำวัน/สัปดาห์ |
| Actor หลัก | ผู้บริหาร / เจ้าหน้าที่ |
| Precondition | — |
| Postcondition | `REPORT_SEND_LOG` ใหม่ถูกสร้าง (เมื่อส่งสำเร็จ) |
| Reference | Operation 1-3 (`API-SPEC.md` หัวข้อ 2G) · Entity `REPORT_SEND_LOG`, `CASE`, `SPRAY_ASSIGNMENT`, `FIELD_PHOTO`, `INVESTIGATION_REPORT` |

### 2. Sequence Flow

```mermaid
sequenceDiagram
  participant ผบห as ผู้บริหาร/เจ้าหน้าที่
  participant UI as Web App (Reports)
  participant API as API Server
  participant Data as CASE / SPRAY_ASSIGNMENT / FIELD_PHOTO / INVESTIGATION_REPORT

  ผบห->>UI: เลือกช่วงเวลา (daily/weekly)
  UI->>API: ดึง KPI สรุปตามช่วงเวลา (period_type)
  API->>Data: คำนวณ KPI สดจากข้อมูลปัจจุบัน (จำนวนเคส, % พ่นแล้ว, % QC ผ่าน, HI/CI, รายงานที่ส่งแล้ว)
  Data-->>API: ค่าดิบ
  API-->>UI: แสดง KPI card + สร้างเนื้อหาสรุป (template)

  ผบห->>UI: แก้ไขเนื้อหาสรุปตามจริง แล้วกด "ส่ง"
  UI->>API: ส่งรายงาน (เนื้อหาสรุป, channel)
  alt เนื้อหาไม่ว่าง
    API->>Data: สร้าง REPORT_SEND_LOG ใหม่ (status=sent, sent_at=now, channel=LINE/PDF)
    API-->>UI: แสดงสถานะ "ส่งแล้ว"
  else เนื้อหาว่าง
    API-->>UI: ปฏิเสธ (ปุ่มส่งไม่ทำงานถ้าเนื้อหาว่าง)
  end
```

### 3. Business Rule / Validation Logic

| Rule | เงื่อนไข | ผลถ้าไม่ผ่าน | Feature ID |
|---|---|---|---|
| ส่งรายงานได้ต่อเมื่อเนื้อหาไม่ว่าง | `content` ไม่ว่าง | ปุ่มส่งไม่ทำงาน | FEAT-REPORT-02 |
| KPI เป็นค่าคำนวณสด ไม่ persist แยก | เสมอ | — (`REPORT_SEND_LOG` เก็บเฉพาะ snapshot ตอนส่ง) | FEAT-REPORT-01 |

### 4. Error & Exception Handling

ไม่มี error ระดับ business-critical เฉพาะสำหรับ flow นี้ตามขอบเขตที่ยืนยันใน Build Plan — ความเสี่ยงที่ข้อมูลสรุปไม่ครบถ้วนเพราะพึ่งพาคุณภาพข้อมูล Phase 1-4 เป็นข้อจำกัดที่ ROADMAP.md ระบุไว้แล้ว ไม่ใช่ error case ที่ต้อง handle ในระบบ

### 5. Traceability

| อ้างอิง | ID/ชื่อ |
|---|---|
| Feature | FEAT-REPORT-01, FEAT-REPORT-02, FEAT-REPORT-03 (backlog) |
| Entity | `REPORT_SEND_LOG`, `CASE`, `SPRAY_ASSIGNMENT`, `FIELD_PHOTO`, `INVESTIGATION_REPORT` |
| Operation | API-SPEC.md operation 1-3 (หัวข้อ 2G) |
| Component | Web App (Reports), API Server |

---

# โมดูล: Alerts (`FEAT-ALERT-*`)

## Flow 16 — Alert Assign & Close Flow (step-by-step ละเอียด) — `FEAT-ALERT-01`/`02`

### 1. Flow Overview

| หัวข้อ | รายละเอียด |
|---|---|
| Trigger | เจ้าหน้าที่เฝ้าระวังโรคเห็นแจ้งเตือนสถานะ "ใหม่" (`new`) ต้องมอบหมายทีมไปดำเนินการ |
| Actor หลัก | เจ้าหน้าที่เฝ้าระวังโรค (มอบหมาย), ทีมที่ได้รับมอบหมาย (ปิดเคส) |
| Precondition | `ALERT.status = new` |
| Postcondition | `ALERT.status = closed` พร้อม `close_note` (ถ้าดำเนินการครบ flow) |
| Reference | Operation 1-3 (`API-SPEC.md` หัวข้อ 2H) · Entity `ALERT`, `TEAM`, `DISEASE`, `SERVICE_ZONE` |

### 2. Sequence Flow

```mermaid
sequenceDiagram
  participant จนท as เจ้าหน้าที่เฝ้าระวังโรค
  participant ทีม as ทีมที่ได้รับมอบหมาย
  participant UI as Web App (Alerts)
  participant API as API Server
  participant Data as ALERT

  จนท->>UI: เลือกทีมจาก dropdown (ทีมสอบสวนโรคหรือทีมพ่น)
  alt ยังไม่เลือกทีม
    UI-->>จนท: ปุ่ม "มอบหมาย" ยัง disabled
  else เลือกทีมแล้ว
    UI-->>จนท: ปุ่ม "มอบหมาย" เปิดใช้งาน
    จนท->>UI: กด "มอบหมาย"
    UI->>API: มอบหมายทีมรับผิดชอบ (alert_id, assigned_team_id)
    API->>API: ตรวจสอบ assigned_team_id ไม่ว่าง
    API->>Data: ALERT.status -> in_progress, assigned_team_id = ทีมที่เลือก, assigned_at = now
    Note over API,Data: สถานะเปลี่ยน: new -> in_progress (ต้องเลือกทีมก่อนเสมอ)
    Data-->>API: บันทึกสำเร็จ
    API-->>UI: แสดงทีมที่มอบหมาย + เวลา + ปุ่ม "ปิดเคส"
  end

  ทีม->>ทีม: ดำเนินการภาคสนามตามที่ได้รับมอบหมาย (นอกระบบ)

  จนท->>UI: กด "ปิดเคส"
  UI-->>จนท: เปิดกล่องข้อความบันทึกสรุปผล (close_note)
  loop จนกว่าจะพิมพ์ข้อความ
    จนท->>UI: พิมพ์ข้อความสรุปผล
    alt close_note ยังว่าง
      UI-->>จนท: ปุ่ม "ยืนยันปิดเคส" ยัง disabled
    else close_note ไม่ว่างแล้ว
      UI-->>จนท: ปุ่ม "ยืนยันปิดเคส" เปิดใช้งาน
    end
  end

  alt จนท กด "ยืนยันปิดเคส" (close_note ไม่ว่าง)
    จนท->>UI: กด "ยืนยันปิดเคส"
    UI->>API: ปิดเคสแจ้งเตือน (alert_id, close_note)
    API->>API: ตรวจสอบ close_note ไม่ว่าง
    API->>Data: ALERT.status -> closed, close_note = ข้อความ, closed_at = now
    Note over API,Data: สถานะเปลี่ยน: in_progress -> closed (ทางเดียว ไม่มี reopen/unassign)
    Data-->>API: บันทึกสำเร็จ
    API-->>UI: แสดงสถานะ "ปิดเคสแล้ว" พร้อมบันทึกสรุปผล
  else จนท กด "ยกเลิก"
    จนท->>UI: กด "ยกเลิก"
    UI-->>จนท: ปิดกล่องข้อความ กลับสู่มุมมองปกติ (ALERT ยังเป็น in_progress)
  end
```

### 3. Business Rule / Validation Logic

| Rule | เงื่อนไข | ผลถ้าไม่ผ่าน | Feature ID |
|---|---|---|---|
| มอบหมายทีมต้องเลือกทีมก่อนเปลี่ยนเป็น in_progress | `assigned_team_id` ไม่ว่าง | ปุ่ม "มอบหมาย" disabled | FEAT-ALERT-02 |
| ปิดเคสต้องมี close_note ไม่ว่างก่อนเปลี่ยนเป็น closed | `close_note` ไม่ว่าง | ปุ่ม "ยืนยันปิดเคส" disabled | FEAT-ALERT-02 |
| ไม่มี reopen/unassign ในรอบนี้ | เสมอ | เคสที่ `closed` คงสถานะตลอดไป | FEAT-ALERT-02 |

### 4. Error & Exception Handling

| กรณี | จุดที่เกิด (อ้างจาก step ใน diagram) | การจัดการ | ผลกระทบต่อผู้ใช้/ข้อมูล |
|---|---|---|---|
| ปิด alert โดยไม่มี note | ตอนกด "ยืนยันปิดเคส" | UI disable ปุ่มตั้งแต่ `close_note` ยังว่าง (client-side) + API ต้อง reject ซ้ำอีกชั้นถ้าเรียกตรงโดยไม่ผ่าน UI (server-side validation) | ป้องกัน `ALERT.status = closed` ที่ไม่มีบันทึกสรุปผล ซึ่งจะทำให้ตรวจสอบย้อนหลังไม่ได้ |
| แจ้งเตือนผิดทีม (มอบหมายไม่มีทีม/ทีมว่าง) | ตอนกด "มอบหมาย" | UI disable ปุ่ม "มอบหมาย" จนกว่าจะเลือกทีมจาก dropdown | ป้องกัน `ALERT.status = in_progress` ที่ไม่มีทีมรับผิดชอบชัดเจน |

### 5. Traceability

| อ้างอิง | ID/ชื่อ |
|---|---|
| Feature | FEAT-ALERT-01, FEAT-ALERT-02, FEAT-ALERT-03 (backlog) |
| Entity | `ALERT`, `TEAM`, `DISEASE`, `SERVICE_ZONE` |
| Operation | API-SPEC.md operation 1-3 (หัวข้อ 2H) |
| Component | Web App (Alerts), API Server |

---

## สรุป Gap/Assumption ที่พบระหว่างเขียนเอกสารนี้

- **[Gap] เกณฑ์คำนวณระดับความเสี่ยงต่อเขต (ปกติ/เฝ้าระวัง/วิกฤต)** ยังไม่ระบุตัวเลขที่แน่นอนใน `DATA-MODEL.md`/`API-SPEC.md` — Flow 4 (Dashboard) จึงระบุแค่ "คำนวณจากจำนวนเคส/อัตราป่วยเทียบเกณฑ์" แบบ conceptual เท่านั้น
- **[Gap] Case Intake ไม่มี dedup rule สำหรับเคสซ้ำ** (อัปโหลดไฟล์/HN ซ้ำ) — Flow 1 flag ไว้เป็น error case ที่ยังไม่มีการจัดการ
- **[Gap] Case Analysis ไม่มี operation "ปฏิเสธ/แก้ไของค์ประกอบ cluster ที่ผิด"** — Flow 5 flag ไว้ว่า cluster ที่นักระบาดวิทยาเห็นว่าผิดพื้นที่จะค้างสถานะ `pending` ตลอดไปโดยไม่มีทางแก้ไขในระบบ
- **[Gap] Case Intake — การกำหนด `responsible_team` เริ่มต้นตอนสร้างเคสใหม่เมื่อ OCR ดึงตำบลที่ไม่ตรง `SUBDISTRICT_ROUTING_RULE` ใดเลย** ไม่มีการระบุ behavior ชัดเจนใน `API-SPEC.md`/`DATA-MODEL.md` (มีแต่ตอนแก้ไข) — **โค้ด prototype ปัจจุบัน (2026-10-24) เลือกให้เข้า "ทีมสอบสวนโรค เขต 1" เป็นค่าเริ่มต้นแบบเงียบ** (Flow 1 ระบุตามนี้แล้ว) แต่ยังไม่มีการยืนยันเชิง business ว่าเขต 1 เป็นค่าเริ่มต้นที่ถูกต้อง หรือควรปล่อยว่าง/ให้เลือกด้วยมือแทน — ต้องยืนยันเพิ่มก่อน implement จริง
- **[Gap] Case Intake — เอกสาร conceptual ต่างจากโค้ด/เอกสารอื่นหลัง sync Flow 1 (2026-10-24)**: (1) `DATA-MODEL.md` entity `CASE` ยังไม่มี field เลขประจำตัวประชาชน, รหัสโรค รง.506 (`disease_id`), ที่อยู่ช่องเดียว และพิกัดช่องเดียว (ยังมี `lab_result`/`hn` ซึ่งถูกถอด/ไม่แสดงในตาราง OCR Review แล้ว) (2) `FEATURE-LIST.md` แถว `FEAT-INTAKE-05` ยังระบุ "Cloud Function `extractCaseReport`, Claude Vision ผ่าน OpenRouter" ซึ่งไม่ตรงกับ runtime ปัจจุบัน (OCR ฝั่งเบราว์เซอร์) และไม่ตรงกับ `TECH-STACK.md` (Claude Vision — Anthropic) (3) `TECH-STACK.md` ยังไม่สะท้อน Tesseract.js ฝั่ง client — ต้อง sync ผ่าน skill ของเอกสารนั้นๆ (เอกสารนี้ห้ามแก้เอง)
- **[Gap] FEAT-INTAKE-11 (AI ช่วยจัดประเภทโรค)** — ปุ่ม "ให้ AI ช่วยจัด" ไม่ปรากฏใน UI ตารางปัจจุบัน (dropdown โรคเป็นรายการ static + ระบบเดาจากข้อความ OCR ด้วย keyword/รหัส; เหลือเพียง listener/Cloud Function `suggestDiseaseType` ที่ไม่ถูกเรียก) — Flow 1 จึงอธิบายเฉพาะการเลือก/เดาโรค ไม่มี step เรียก AI จัดโรค ต้องยืนยันว่าจะคงปุ่มนี้กลับมาหรือถอด FEAT-INTAKE-11 ออก
- **[Assumption] Field Tracking — ลำดับการเปลี่ยนสถานะทีมพ่น (`not_arrived` → `spraying` → `done`)** สันนิษฐานว่าเป็นลำดับทางเดียวทีละขั้น ไม่ข้าม/ย้อนกลับ ตามรูปแบบ one-way transition ที่ใช้ทั่วทั้งระบบ (`CASE`, `CASE_CLUSTER`, `ALERT`, `APPROVAL_REQUEST`) — ไม่ได้ระบุไว้ชัดเจนเป็นคำต่อคำใน `DATA-MODEL.md`

---

หมายเหตุ: เอกสารนี้ไม่มี State/Status Diagram แยกตามที่ยืนยันใน Build Plan รอบนี้ — ถ้าในอนาคตมี entity ที่ขยายเป็น ≥4 สถานะ ควรทบทวนและเพิ่มหัวข้อ State/Status Diagram ต่อ flow ที่เกี่ยวข้อง
