# 01 - Prototypes

เก็บ **ต้นแบบหน้าตาของระบบ (UI/UX Prototype)** เช่น

- Wireframe / mockup ของแต่ละหน้าจอ
- User flow และ navigation flow
- Design system เบื้องต้น เช่น สี ฟอนต์ คอมโพเนนต์หลัก

ใช้สำหรับสื่อสารและตกลงหน้าตาของระบบก่อนลงมือพัฒนาจริง โดยอ้างอิงความต้องการจาก [[../../01-requirements/01-spec/index|01-spec]] และส่งต่อรายละเอียดเชิงระบบให้ [[../02-technical/index|02-technical]]

> **โค้ด Prototype จริง (คลิกดูได้)** อยู่ที่ [`/prototypes/v1/`](../../../prototypes/v1/) ที่ root ของโปรเจกต์ (ไม่ได้ก็อปปี้มาไว้ในนี้ เพื่อไม่ให้มี 2 ชุดที่อาจไม่ตรงกัน) — เปิด `index.html` ในเบราว์เซอร์ หรือดู `BUILD-PLAN.md` ในโฟลเดอร์เดียวกันสำหรับประวัติการตัดสินใจแต่ละรอบ

## เอกสารที่มีอยู่

- [`USER-JOURNEY-outbreak-dashboard.md`](./USER-JOURNEY-outbreak-dashboard.md) — journey แรกของโปรเจกต์ (เจ้าหน้าที่เฝ้าระวังโรคใช้ Outbreak Dashboard) อ้างอิง [[../../01-requirements/01-spec/FEATURE-LIST|FEATURE-LIST.md]] และตรงกับ Test Spec ที่มีอยู่แล้วใน [[../../03-testing/01-test-plan/index|03-testing/01-test-plan]]
- [`USER-JOURNEY-case-intake.md`](./USER-JOURNEY-case-intake.md) — เจ้าหน้าที่ รพ./เทศบาล อัปโหลด/ตรวจสอบ/ยืนยันเคสผ่าน Case Intake (persona รอง: ทีมสอบสวนโรคผู้รับแจ้งเตือนปลายทาง) อ้างอิง [[../../01-requirements/01-spec/FEATURE-LIST|FEATURE-LIST.md]] หมวด `FEAT-INTAKE` และ [[../02-technical/DETAILED-DESIGN|DETAILED-DESIGN.md]] Flow 1-3 — โมดูลนี้ยังไม่มี Test Spec คู่กัน
- [`USER-JOURNEY-case-analysis.md`](./USER-JOURNEY-case-analysis.md) — ทีมสอบสวนโรค (นักระบาดวิทยา) ตรวจสอบ Case Cluster + ร่างรายงานสอบสวนโรค (สาย A, ยังเป็น mock) และบันทึก/พิจารณา รง.506 (สาย B, เชื่อม Firestore/Cloud Function จริง — persona รอง: ผู้บริหารผู้พิจารณา + เห็น AI สรุปแนวโน้มโรค) อ้างอิง [[../../01-requirements/01-spec/FEATURE-LIST|FEATURE-LIST.md]] หมวด `FEAT-ANALYSIS` และ [[../02-technical/DETAILED-DESIGN|DETAILED-DESIGN.md]] Flow 5-7 (เฉพาะสาย A — สาย B ยังไม่มี Flow คู่กัน) — โมดูลนี้ยังไม่มี Test Spec คู่กัน
- [`USER-JOURNEY-control-plan.md`](./USER-JOURNEY-control-plan.md) — ทีมควบคุมโรค (ทีมพ่น) ร่างแผนปฏิบัติงานควบคุมโรค (Day 0/1/7) และร่างใบขออนุมัติเบิกน้ำมัน/น้ำยาเคมีตรงฟอร์มจริงของหน่วยงาน (persona รอง: ผู้บริหาร/หัวหน้างานผู้อนุมัติ/ไม่อนุมัติ — ปุ่มจำลองในหน้าเดียวกัน) อ้างอิง [[../../01-requirements/01-spec/FEATURE-LIST|FEATURE-LIST.md]] หมวด `FEAT-CONTROL` และ [[../02-technical/DETAILED-DESIGN|DETAILED-DESIGN.md]] Flow 8-10 — โมดูลนี้ยังเป็น mock ล้วนทั้งหมดและยังไม่มี Test Spec คู่กัน
- [`USER-JOURNEY-asm-coordination.md`](./USER-JOURNEY-asm-coordination.md) — อสม. (persona หลัก แต่ยังไม่มี UI ฝั่ง อสม. เลยในรุ่นนี้) ส่งรูปยืนยันพ่นสารเคมีผ่าน LINE OA และทีมควบคุมโรค (persona รอง ผู้ใช้งานจริงเพียงฝ่ายเดียวใน prototype) ดูรูปที่จัดหมวดหมู่โดย AI vision + ตรวจสอบคิวแจ้งเตือนล่วงหน้าก่อนวันพ่น อ้างอิง [[../../01-requirements/01-spec/FEATURE-LIST|FEATURE-LIST.md]] หมวด `FEAT-ASM` และ [[../02-technical/DETAILED-DESIGN|DETAILED-DESIGN.md]] Flow 13-14 — โมดูลนี้ยังเป็น mock ล้วนทั้งหมดและยังไม่มี Test Spec คู่กัน
