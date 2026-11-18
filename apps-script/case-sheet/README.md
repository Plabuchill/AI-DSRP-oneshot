# case-sheet — บันทึกเคสจาก Case Intake ลง Google Sheet (FEAT-INTAKE-06)

Apps Script web app ที่ผูกกับ Google Sheet หนึ่งไฟล์ หน้า Case Intake เรียกเมื่อเจ้าหน้าที่กด **ยืนยัน** เคส
(เขียนทับแถวเดิมถ้า Case ID ซ้ำ — เช่นแก้แถวที่ยืนยันแล้วแล้วยืนยันใหม่) และดึงทุกแถวมาแสดงเป็นตาราง
"ข้อมูลที่บันทึกใน Google Sheet" บนหน้าเว็บ

- รับเฉพาะคำขอที่แนบ Firebase ID token ของผู้ที่ล็อกอินเว็บ ai-dsrp (ตรวจกับ Firebase ทุกครั้ง)
- ไม่ต้องสร้าง API key/Service Account และไม่มีค่าใช้จ่าย (อยู่ในโควตาฟรีของ Apps Script)
- ⚠️ PDPA: ชีตมีชื่อ เลขประจำตัวประชาชน และที่อยู่ผู้ป่วย — แชร์ชีตเฉพาะเจ้าหน้าที่ที่จำเป็น

## ติดตั้ง (ทำครั้งเดียว ~5 นาที)

1. สร้าง Google Sheet ใหม่ (ตั้งชื่ออะไรก็ได้ เช่น `AI-DSRP Case Intake`)
2. เมนู **ส่วนขยาย (Extensions) → Apps Script**
3. ลบโค้ดเดิมในไฟล์ `Code.gs` แล้ววางเนื้อหาจาก [`Code.gs`](./Code.gs) ในโฟลเดอร์นี้ → กด 💾 บันทึก
4. ปุ่ม **Deploy → New deployment** → ไอคอนเฟือง เลือก **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - กด **Deploy** → Google จะขอสิทธิ์ (Authorize access) ให้เลือกบัญชีตัวเองแล้วกดอนุญาต
     (ถ้าขึ้น "Google hasn't verified this app" ให้กด Advanced → Go to ... (unsafe) — เป็นสคริปต์ของคุณเอง)
5. คัดลอก **Web app URL** (ลงท้าย `/exec`) ไปใส่ใน [`prototypes/v1/sheet-config.js`](../../prototypes/v1/sheet-config.js) ที่ `CASE_SHEET_URL`
   และ (ไม่บังคับ) ใส่ลิงก์ของตัวชีตที่ `CASE_SHEET_VIEW_URL` เพื่อให้มีปุ่ม "เปิด Google Sheet"
6. `firebase deploy --only hosting`

ทดสอบว่า deploy แล้ว: เปิด Web app URL ในเบราว์เซอร์ ต้องเห็น `{"ok":true,"service":"AI-DSRP case sheet",...}`

## แก้สคริปต์ภายหลัง

แก้ `Code.gs` ใน Apps Script แล้ว **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**
(URL เดิมใช้ต่อได้ — ถ้ากด New deployment จะได้ URL ใหม่ ต้องแก้ `sheet-config.js` ตาม)

## คอลัมน์ในชีต (แท็บ `Cases`)

Case ID · บันทึกเมื่อ · ผู้บันทึก · ชื่อผู้ป่วย · เลขประจำตัวประชาชน · ที่อยู่ขณะป่วย · ตำบล · วันที่เริ่มป่วย ·
รหัสโรค · โรค · ละติจูด · ลองจิจูด · ทีมรับผิดชอบ · ไฟล์ต้นฉบับ

Case ID ขึ้นต้น `CI-` = เคสจากเอกสารที่อัปโหลดจริง, `DEMO-` = เคสตัวอย่างที่ฝังในหน้าเว็บ
ไฟล์ต้นฉบับเก็บเป็นชื่อไฟล์เท่านั้น — การเก็บไฟล์ลง Google Drive ยังไม่ได้ทำ
