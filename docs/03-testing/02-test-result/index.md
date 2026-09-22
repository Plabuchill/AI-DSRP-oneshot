# 02 - Test Result

เก็บ **ผลการทดสอบจริง** ตาม test case ที่วางไว้ใน [[../01-test-plan/index|01-test-plan]] เช่น

- ผล pass/fail ของแต่ละ test case
- บั๊ก (bug) ที่พบ พร้อมรายละเอียดและความรุนแรง
- สถานะการแก้ไขบั๊ก

ผลลัพธ์และปัญหาที่พบในโฟลเดอร์นี้จะถูกนำไปสรุปบทเรียนต่อใน [[../../04-retrospectives/index|04-retrospectives]]

## เอกสารในโฟลเดอร์นี้

- [[./test-results|test-results.md]] — ผลทดสอบมือ (ad-hoc) ผ่านเบราว์เซอร์จริงบน production (`ai-dsrp.web.app`) รอบ 2026-09-22: flow ยืนยัน/ไม่ยืนยัน รง.506 และ security case พื้นฐาน — พบบั๊ก race condition ใน auth state ที่กระทบทั้งการบันทึกผู้อนุมัติและการเข้าหน้า `new-506-request.html`
