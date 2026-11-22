// เรียก Apps Script ของชีตทะเบียนผู้ป่วย (apps-script/case-sheet/Code.gs) — ใช้ร่วมกันทุกหน้าที่อ่าน/เขียนชีต
// แนบ Firebase ID token ของผู้ที่ล็อกอินทุกคำขอ (สคริปต์ตรวจกับ Firebase ก่อนทำงาน)

import { auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { CASE_SHEET_URL } from "./sheet-config.js";

export const sheetEnabled = !!CASE_SHEET_URL;

const currentUser = new Promise(function (resolve) {
  const stop = onAuthStateChanged(auth, function (user) { stop(); resolve(user); });
});

// Apps Script รับ body เป็นข้อความธรรมดา (ไม่ตั้ง Content-Type: application/json เพื่อไม่ให้เบราว์เซอร์ส่ง preflight
// ซึ่ง Apps Script ตอบไม่ได้) — token อยู่ใน body เพราะ Apps Script อ่าน header ของคำขอไม่ได้
export async function callSheet(action, extra) {
  if (!CASE_SHEET_URL) throw new Error("ยังไม่ได้เชื่อมต่อ Google Sheet (ตั้งค่าที่ sheet-config.js)");
  const user = await currentUser;
  if (!user) throw new Error("ต้องเข้าสู่ระบบก่อน");
  const idToken = await user.getIdToken();
  const res = await fetch(CASE_SHEET_URL, {
    method: "POST",
    body: JSON.stringify(Object.assign({ action: action, idToken: idToken }, extra || {}))
  });
  const body = await res.json().catch(function () { return null; });
  if (!res.ok || !body) throw new Error("ติดต่อ Google Sheet ไม่ได้ (" + res.status + ")");
  if (!body.ok) throw new Error(body.error || "Google Sheet ตอบกลับผิดพลาด");
  return body;
}
