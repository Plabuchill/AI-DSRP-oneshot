// ให้ AI ช่วยจัดประเภทโรคติดต่อ (FEAT-INTAKE-11) — เชื่อมต่อ Cloud Function
// "suggestDiseaseType" ตัวเดียวกับที่ใช้ในหน้า รง.506 (FEAT-ANALYSIS-08) โดยส่ง clinicalText
// (ค่าช่อง "ผลตรวจ" ของแถวนั้น) แทน title/reason — ฟังก์ชันฝั่ง server ดึงรายชื่อ 506Types จริง
// จาก Firestore เองและตรวจซ้ำผลลัพธ์เสมอ ไม่เชื่อค่าที่โมเดลเลือกมาตรงๆ
// เป็น advisory เท่านั้น (human-in-the-loop เหมือน case-intake-assist.js) — เติมลง dropdown
// "ประเภทโรคติดต่อ" ให้อัตโนมัติเมื่อจัดหมวดหมู่ได้ แต่เจ้าหน้าที่แก้ไขเองได้เสมอก่อนยืนยัน
// ผลลัพธ์ส่งกลับให้ case-intake.js ผ่าน CustomEvent (ตาม pattern เดียวกับไฟล์อื่นในกลุ่มนี้)

import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-functions.js";
import { db, functions } from "./firebase-init.js";

const AI_SUGGEST_TIMEOUT_MS = 15000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error("TIMEOUT")); }, ms);
    })
  ]);
}

function init() {
  const tableBody = document.getElementById("ocr-table-body");
  if (!tableBody) return; // หน้าอื่นไม่มี element นี้

  // 506Types → ส่งรายชื่อโรคติดต่อจริงให้ case-intake.js เติม dropdown ต่อแถว
  // (case-intake.js เป็น classic script ไม่ใช่ module จึงอ่าน Firestore เองไม่ได้ — ดู
  // case-intake-upload.js/case-intake-assist.js สำหรับ pattern เดียวกันนี้)
  onSnapshot(
    collection(db, "506Types"),
    function (snapshot) {
      const types = snapshot.docs.map(function (d) { return { id: d.id, name: d.data().name }; });
      document.dispatchEvent(new CustomEvent("case-intake:disease-types", { detail: { types: types } }));
    },
    function (err) {
      document.dispatchEvent(new CustomEvent("case-intake:disease-types", { detail: { types: [], error: err.message } }));
    }
  );

  const suggestDiseaseType = httpsCallable(functions, "suggestDiseaseType");

  tableBody.addEventListener("click", async function (e) {
    const btn = e.target.closest(".btn-ai-diagnose");
    if (!btn) return;

    const id = parseInt(btn.getAttribute("data-id"), 10);
    const clinicalText = btn.getAttribute("data-text") || "";

    document.dispatchEvent(new CustomEvent("case-intake:diagnose-result", {
      detail: { id: id, loading: true }
    }));

    try {
      const result = await withTimeout(suggestDiseaseType({ clinicalText: clinicalText }), AI_SUGGEST_TIMEOUT_MS);
      const data = result.data;
      document.dispatchEvent(new CustomEvent("case-intake:diagnose-result", {
        detail: {
          id: id,
          loading: false,
          matched: data.matched,
          diseaseId: data.diseaseId,
          diseaseName: data.diseaseName,
          reason: data.reason || ""
        }
      }));
    } catch (err) {
      const timedOut = err && err.message === "TIMEOUT";
      document.dispatchEvent(new CustomEvent("case-intake:diagnose-result", {
        detail: {
          id: id,
          loading: false,
          error: timedOut ? "ไม่ได้รับคำตอบจาก AI ภายใน 15 วินาที" : ((err && err.message) || "เกิดข้อผิดพลาด")
        }
      }));
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
