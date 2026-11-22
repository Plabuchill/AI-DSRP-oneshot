// แจ้งเคสเข้ากลุ่ม LINE ของทีมสอบสวนโรค ผ่าน Cloudflare Worker (workers/ocr-proxy/src/line.js) — ขั้น "AI Dispatch"
// case-intake.js (classic script) ส่งคำขอทาง CustomEvent "case-intake:line-notify" { notifyId, teamId, caseId, disease, area,
// onsetDate, coords, update } แล้วรับผลทาง "case-intake:line-result" { notifyId, ok, error }
// ส่งเฉพาะข้อมูลที่ไม่ระบุตัวผู้ป่วย — Worker ประกอบข้อความเองจากช่องที่กำหนด

import { auth } from "./firebase-init.js";
import { AI_OCR_URL } from "./ocr-config.js";

// ใช้ Worker ตัวเดียวกับ OCR (ตั้ง URL ไว้ใน ocr-config.js)
const WORKER_ORIGIN = AI_OCR_URL ? new URL(AI_OCR_URL).origin : "";

async function callLine(path, payload) {
  if (!WORKER_ORIGIN) throw new Error("ยังไม่ได้ตั้งค่า Worker (ocr-config.js)");
  const user = auth.currentUser;
  if (!user) throw new Error("ต้องเข้าสู่ระบบก่อน");
  const res = await fetch(WORKER_ORIGIN + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (await user.getIdToken()) },
    body: JSON.stringify(payload || {})
  });
  const body = await res.json().catch(function () { return {}; });
  if (!res.ok || !body.ok) throw new Error(body.error || ("ส่ง LINE ไม่สำเร็จ (" + res.status + ")"));
  return body;
}

document.addEventListener("case-intake:line-notify", async function (e) {
  const d = e.detail || {};
  let result;
  try {
    await callLine("/line/notify", {
      teamId: d.teamId, caseId: d.caseId, disease: d.disease, area: d.area,
      onsetDate: d.onsetDate, coords: d.coords, update: !!d.update
    });
    result = { notifyId: d.notifyId, ok: true };
  } catch (err) {
    result = { notifyId: d.notifyId, ok: false, error: err.message };
  }
  document.dispatchEvent(new CustomEvent("case-intake:line-result", { detail: result }));
});
