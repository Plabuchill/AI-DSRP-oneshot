// ตั้งค่าตัวกลาง AI อ่านลายมือ (Cloudflare Worker ใน workers/ocr-proxy) — ใส่ URL หลัง deploy Worker เสร็จ
// เว้นว่าง = ปิดตัวเลือก "ใช้ AI อ่านลายมือ" ในหน้า Case Intake (ใช้ OCR ในเครื่องอย่างเดียว)
// ตัวอย่าง: "https://ai-dsrp-ocr-proxy.<ชื่อบัญชี>.workers.dev"
// URL นี้เป็นค่าสาธารณะ (ไม่ใช่ secret) — API key ของ Gemini เก็บใน Worker เท่านั้น ห้ามใส่ในไฟล์ฝั่งเว็บ
export const AI_OCR_URL = "";
