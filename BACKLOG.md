# Backlog — AI-DSRP

รายการงานค้างที่ต้องทำต่อ เรียงตามความสำคัญ — สำหรับแผนงานเต็มทุกเฟส ดู [ROADMAP.md](./ROADMAP.md), สำหรับรายละเอียดบั๊ก/ผลทดสอบ ดู [test-results.md](./docs/03-testing/02-test-result/test-results.md)

## 🔴 บั๊กที่ต้องแก้ (พบจากการทดสอบจริง 2026-09-22)

- **Session/Auth หลุดเอง (TC-06)** — ผู้ใช้ที่ login อยู่จริงถูกเด้งกลับหน้า login เองแบบสุ่ม (ทั้งตอนโหลดหน้าและตอน idle เฉยๆ) เกิดซ้ำได้แม้เป็นโค้ดต้นฉบับที่ยังไม่ถูกแก้ — ลองแก้ 2 วิธีแล้วไม่สำเร็จ (revert ไปแล้ว) ต้องมีคนสืบด้วย Chrome DevTools จริง (Network tab ดู `securetoken.googleapis.com`, Application tab ดู IndexedDB ของ Firebase Auth)
- **ยืนยัน/ไม่ยืนยัน รง.506 จากหน้ารายละเอียดอาจไม่บันทึกผู้พิจารณา (TC-02)** — แก้โค้ดแล้ว (`506-request-detail.js`) แต่ verify ไม่สำเร็จเพราะติดปัญหา browser cache ระหว่างทดสอบ ต้อง re-test ในเบราว์เซอร์ที่ไม่มี cache เก่าปนก่อนสรุปว่าใช้ได้จริงหรือไม่
- **`new-506-request.js` ไม่มี role check ของตัวเอง** — Director เข้าหน้านี้ตรงผ่าน URL แล้วยังสร้างรายงานได้อยู่ แม้ UI จะซ่อนลิงก์ทางเข้าไว้แล้วก็ตาม (ดู [ACL.md](./docs/02-design/02-technical/ACL.md) หัวข้อ 4)
- **Firestore Security Rules ยังไม่บังคับตาม role** — ปัจจุบัน `allow read, write: if request.auth != null;` เปิดกว้างให้ทุกคนที่ login เขียนข้อมูลข้ามสิทธิ์ได้ ต้องเขียน rule ตรวจ role จริงตามตารางใน ACL.md

## 🟡 ต้องทำความสะอาด

- ลบ collection ขยะใน Firestore ที่ทิ้งค้างจาก draft แรก (ระบบขอลา) ที่เลิกใช้แล้ว: `User`, `leaveRequests`, `leaveTypes` — เช็คแล้วไม่มีโค้ดไหนอ้างอิง ปลอดภัยที่จะลบ
- ลบข้อมูลทดสอบใน collection `506Requests` ที่สร้างไว้ระหว่าง QA: `YTZc2J1lPTZfEwa0emE9`, `V8TyCZdGkgxlmLETkqtB`, `nzbDNagVtjjHvBrZQnwH`, `N9ZmceDvomHpNyeoz25D`, `MPsIWLepEZDjxCBB71gz`, `mFRbeLleO0AeM0hWU7y7` (ทุกรายการขึ้นต้นด้วย `[TEST-QA`)

## 🟢 งานที่ยังไม่ได้ทำ

- **QA docs สำหรับ 7 โมดูลที่เหลือ** (Test Plan / Acceptance Criteria / Test Cases) — มีแค่ Outbreak Dashboard ใน `docs/03-testing/01-test-plan/v1/` ยังขาด Case Intake, Case Analysis, Control Plan, Field Tracking, ASM Coordination, Reports, Alerts
- **Security test: บัญชีที่สองเปิดข้อมูลบัญชีแรก (TC-05)** — ยังไม่ได้รัน ต้องยืนยัน scope ก่อนว่า "ข้อมูลของบัญชีแรก" หมายถึงอะไรในระบบนี้ (รง.506 ออกแบบให้ทุก role เห็นของกันได้ตาม ACL.md อยู่แล้ว)
- ดู [ROADMAP.md](./ROADMAP.md) สำหรับ backlog เต็มทุกเฟส (Phase 1-8) — โดยเฉพาะ Phase 7 (Compliance เจาะจง ยังรอหน่วยงานตอบ) และ Phase 1-5 (เชื่อมต่อ Google Sheet/Drive/LINE OA/Geocoding อัตโนมัติจริง)

---

*อัปเดตล่าสุด: 2026-09-22*
