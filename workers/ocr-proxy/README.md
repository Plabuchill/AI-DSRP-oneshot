# ocr-proxy — ตัวกลางอ่านลายมือ รง.506 ด้วย Gemini (Cloudflare Workers แผนฟรี)

รับไฟล์ PDF/JPEG/PNG จากหน้า Case Intake → ส่งให้ Google Gemini อ่าน → คืน JSON ช่องข้อมูล (ชื่อ, เลขบัตร, ที่อยู่, วันเริ่มป่วย, รหัสโรค, พิกัด) ให้ตารางตรวจสอบ OCR Review (FEAT-INTAKE-05)

- เก็บ `GEMINI_API_KEY` เป็น secret ที่นี่เท่านั้น (ไม่ใส่ในไฟล์ฝั่งเว็บ/ไม่ commit)
- ให้เฉพาะผู้ใช้ที่ล็อกอิน Firebase ของโปรเจกต์ `ai-dsrp` เรียกได้ และจำกัด origin ผ่าน `ALLOWED_ORIGINS`
- ไม่เก็บ/ไม่ log ภาพหรือผลลัพธ์
- ⚠️ PDPA: ภาพถูกส่งไปที่ Google แผนฟรีอาจถูกนำไปพัฒนาผลิตภัณฑ์ — ใช้กับเอกสารทดสอบเท่านั้น

## Deploy

1. สมัคร Cloudflare (ฟรี) และสร้าง API key ที่ Google AI Studio (ฟรี)
2. ในโฟลเดอร์นี้
   ```bash
   npx wrangler login
   npx wrangler secret put GEMINI_API_KEY   # พิมพ์/วาง key เอง
   npx wrangler deploy
   ```
3. นำ URL ที่ได้ (`https://ai-dsrp-ocr-proxy.<บัญชี>.workers.dev`) ใส่ใน `prototypes/v1/ocr-config.js` (`AI_OCR_URL`) แล้ว `firebase deploy --only hosting`
4. ถ้าโมเดลเริ่มต้นใช้ไม่ได้/ไม่ฟรี ตรวจรายชื่อรุ่นใน AI Studio แล้วแก้ `GEMINI_MODEL` ใน `wrangler.toml`
5. ทดสอบในเครื่อง: เพิ่ม `http://localhost:8743` ใน `ALLOWED_ORIGINS`

รหัสโรคใน `src/index.js` (`DISEASES`) ต้องตรงกับ `DISEASE_TYPES` ใน `prototypes/v1/case-intake.js`
