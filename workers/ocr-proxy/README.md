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
4. `GEMINI_MODEL` ใน `wrangler.toml` เป็นรายชื่อรุ่นคั่นด้วย `,` — รุ่นแรกไม่ว่าง (503/500) หรือไม่มีแล้ว (404) จะลองรุ่นถัดไปเอง ถ้าทุกรุ่นใช้ไม่ได้ ตรวจรายชื่อรุ่นใน AI Studio แล้วแก้รายการนี้
5. ทดสอบในเครื่อง: เพิ่ม `http://localhost:8743` ใน `ALLOWED_ORIGINS`

รหัสโรคใน `src/index.js` (`DISEASES`) ต้องตรงกับ `DISEASE_TYPES` ใน `prototypes/v1/case-intake.js`

## LINE OA — แจ้งเตือนทีมสอบสวนโรค (src/line.js)

Worker ตัวเดียวกันมี endpoint ของ LINE ด้วย:

| Path | ผู้เรียก | หน้าที่ |
|---|---|---|
| `/line/webhook` | LINE | รับคำสั่งในกลุ่ม: `ผูกทีม 1`–`ผูกทีม 5`, `ทีมนี้`, `ยกเลิกผูกทีม` (ตรวจลายเซ็น `X-Line-Signature`) |
| `/line/notify` | หน้า Case Intake (ล็อกอิน Firebase) | กดยืนยันเคส → ส่งข้อความเข้ากลุ่มของทีมที่รับผิดชอบ |
| `/line/status` | หน้าเว็บ (ล็อกอิน Firebase) | ทีมไหนผูกกลุ่มแล้ว |

ข้อความไม่ระบุตัวผู้ป่วย (PDPA): Case ID, โรค, ชุมชน/ตำบล, วันเริ่มป่วย, ลิงก์ Google Maps และลิงก์เข้าเว็บ (ต้องล็อกอิน)
— Worker ประกอบข้อความเองจากช่องที่กำหนด ไม่ส่งชื่อ/เลขบัตร/ที่อยู่เต็มแม้หน้าเว็บจะส่งมา

กลุ่มของแต่ละทีมเก็บใน KV namespace `LINE_GROUPS` (`team:<n>` → groupId)

### ตั้งค่า (ทำครั้งเดียว)

1. สร้าง LINE Official Account ที่ https://manager.line.biz → Settings → **Messaging API** → Enable (ได้ channel ใน LINE Developers)
2. LINE Official Account Manager → Settings → **Response settings**: เปิด *Webhooks*, ปิด *Auto-response* และ *Greeting message*
   และเปิด **Allow bot to join group chats** (Settings → Account settings)
3. https://developers.line.biz → channel นั้น:
   - **Basic settings** → คัดลอก *Channel secret*
   - **Messaging API** → *Channel access token (long-lived)* → Issue → คัดลอก
   - **Messaging API** → *Webhook URL* = `https://ai-dsrp-ocr-proxy.ai-dsrp.workers.dev/line/webhook` → Verify → เปิด *Use webhook*
4. ในโฟลเดอร์นี้ (วางค่าเองเมื่อถูกถาม ห้าม commit):
   ```bash
   npx wrangler secret put LINE_CHANNEL_SECRET
   npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
   ```
5. เชิญ LINE OA เข้ากลุ่ม LINE ของแต่ละทีม แล้วพิมพ์ `ผูกทีม 1` (เลขตามเขตของทีม) ในกลุ่มนั้น — บอทจะตอบยืนยัน

⚠️ แผนฟรีของ LINE OA จำกัดจำนวนข้อความ push ต่อเดือน (ข้อความตอบกลับคำสั่งในกลุ่มไม่นับ) — ดูโควตาปัจจุบันใน LINE OA Manager
