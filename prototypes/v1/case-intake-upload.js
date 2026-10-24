// อัปโหลดเอกสารรายงานผู้ป่วยจริง (FEAT-INTAKE-05) — OCR ในเบราว์เซอร์ด้วย Tesseract.js
// (case-intake-ocr.js) ไม่ใช้ Cloud Function/Blaze/คีย์ AI และไฟล์ไม่ออกนอกเครื่องผู้ใช้
// (Cloud Function extractCaseReport + Claude Vision ยังอยู่ใน functions/ เผื่อกลับไปใช้ตอนอัปเกรด Blaze)
// ต่างจาก case-intake.js (classic script, mock CASES array) — ไฟล์นี้เป็น type="module" ที่ส่งผลลัพธ์
// กลับไปให้ case-intake.js ผ่าน CustomEvent "case-intake:ocr-result"
// (ตาม pattern เดียวกับ case-analysis.js + case-analysis-506.js)

import { extractCaseReportLocal } from "./case-intake-ocr.js";
import { AI_OCR_URL } from "./ocr-config.js";
import { auth } from "./firebase-init.js";

const MAX_FILE_BYTES = 7 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () { resolve(String(reader.result).split(",")[1] || ""); };
    reader.onerror = function () { reject(new Error("อ่านไฟล์ไม่ได้")); };
    reader.readAsDataURL(file);
  });
}

// ส่งไฟล์ไปตัวกลาง AI (Cloudflare Worker -> Gemini) — ผู้ใช้ต้องล็อกอิน และติ๊กยอมรับเองทุกครั้ง
async function extractCaseReportAI(file) {
  const user = auth.currentUser;
  if (!user) throw new Error("ต้องเข้าสู่ระบบก่อนใช้ AI อ่านลายมือ");
  const token = await user.getIdToken();
  const res = await fetch(AI_OCR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
    body: JSON.stringify({ mimeType: file.type, data: await fileToBase64(file) })
  });
  const body = await res.json().catch(function () { return {}; });
  if (!res.ok) throw new Error(body.error || ("บริการ AI ตอบกลับผิดพลาด (" + res.status + ")"));
  const f = body.fields || {};
  return {
    fields: {
      patientName: f.patientName || "", nationalId: f.nationalId || "", hn: "", address: f.address || "",
      houseNo: "", villageNo: "", village: "", subdistrict: "", district: "", province: "",
      onsetDate: f.onsetDate || "", labResult: "", coordinates: f.coordinates || "", diseaseId: f.diseaseId || ""
    }
  };
}

function init() {
  const selectBtn = document.getElementById("btn-select-file");
  const fileInput = document.getElementById("file-input");
  const dropzone = document.getElementById("dropzone");
  const statusEl = document.getElementById("upload-ocr-status");
  const aiOption = document.getElementById("ai-ocr-option");
  const aiCheckbox = document.getElementById("use-ai-ocr");
  if (aiOption && AI_OCR_URL) aiOption.style.display = "block"; // ไม่ตั้ง URL = ซ่อนตัวเลือก ใช้ OCR ในเครื่องอย่างเดียว
  if (!selectBtn || !fileInput) return; // หน้าอื่นไม่มี element นี้

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.style.display = message ? "block" : "none";
    statusEl.className = "body-secondary" + (isError ? " upload-ocr-status-error" : "");
  }

  // แถบความคืบหน้า 0-100% — percent = null ซ่อนแถบ
  const progressEl = document.getElementById("upload-ocr-progress");
  const progressFill = document.getElementById("upload-ocr-progress-fill");
  const progressPct = document.getElementById("upload-ocr-progress-pct");
  let progressTimer = null;
  let hideTimer = null;
  function setProgress(percent) {
    if (!progressEl) return;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (percent == null) { progressEl.style.display = "none"; return; }
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    progressEl.style.display = "flex";
    progressFill.style.width = p + "%";
    progressPct.textContent = p + "%";
    progressEl.setAttribute("aria-valuenow", String(p));
  }

  // AI ไม่รายงานความคืบหน้าจริง — ประมาณจากเวลาที่ผ่านไป (ปกติ ~10-15 วินาที) วิ่งเข้าหา 90% แต่ไม่ถึง
  // จนกว่าผลจริงจะกลับมา
  function startEstimatedProgress() {
    const start = Date.now();
    setProgress(5);
    progressTimer = setInterval(function () {
      setProgress(5 + 85 * (1 - Math.exp(-(Date.now() - start) / 6000)));
    }, 250);
  }
  function stopEstimatedProgress() {
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = null;
  }

  async function handleFile(file) {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setStatus("รองรับเฉพาะไฟล์ PDF, JPEG, PNG เท่านั้น", true);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setStatus("ไฟล์ใหญ่เกินไป (จำกัดไม่เกิน 7MB)", true);
      return;
    }

    selectBtn.disabled = true;

    try {
      let result = null; let aiNote = "";
      if (AI_OCR_URL && aiCheckbox && aiCheckbox.checked) {
        setStatus("กำลังให้ AI อ่านเอกสาร (เปอร์เซ็นต์โดยประมาณ ปกติใช้เวลา 10-15 วินาที)...", false);
        startEstimatedProgress();
        try {
          result = await extractCaseReportAI(file);
        } catch (aiErr) {
          aiNote = "AI ใช้ไม่ได้ (" + (aiErr && aiErr.message ? aiErr.message : "เกิดข้อผิดพลาด") + ") — ใช้ OCR ในเครื่องแทน (ลายมืออาจอ่านไม่ได้)"; setStatus(aiNote, true);
        } finally {
          stopEstimatedProgress();
        }
      }
      if (!result) {
        if (!(aiCheckbox && aiCheckbox.checked)) setStatus("กำลังเริ่มอ่านเอกสารด้วย OCR...", false);
        setProgress(0);
        result = await extractCaseReportLocal(file, function (message, percent) {
          // ถ้า AI ล้มเหลวมาก่อน ให้คงข้อความแจ้งเตือนไว้ แสดงความคืบหน้าผ่านแถบอย่างเดียว
          if (!aiNote) setStatus(message, false);
          if (percent != null) setProgress(percent);
        });
      }

      setProgress(100);
      setStatus(aiNote, !!aiNote);
      document.dispatchEvent(new CustomEvent("case-intake:ocr-result", {
        detail: {
          fields: result.fields,
          file: file,
          fileName: file.name,
          fileType: file.type === "application/pdf" ? "PDF" : (file.type === "image/png" ? "PNG" : "JPEG"),
          fileSize: Math.max(1, Math.round(file.size / 1024)) + " KB"
        }
      }));
    } catch (err) {
      setStatus("แปลงเอกสารไม่สำเร็จ: " + (err && err.message ? err.message : "เกิดข้อผิดพลาด"), true);
      setProgress(null);
    } finally {
      selectBtn.disabled = false;
      // ค้าง 100% ไว้ครู่หนึ่งให้เห็นว่าเสร็จ แล้วซ่อนแถบ
      if (progressEl && progressEl.style.display !== "none") hideTimer = setTimeout(function () { setProgress(null); }, 1500);
    }
  }

  selectBtn.addEventListener("click", function () {
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    if (fileInput.files && fileInput.files[0]) {
      handleFile(fileInput.files[0]);
      fileInput.value = "";
    }
  });

  // dropzone มี visual-only drag/drop handler อยู่แล้วใน case-intake.js (dragover/dragleave/drop
  // แค่ toggle class "dragover") — เพิ่ม listener แยกสำหรับ "drop" จริงที่นี่โดยไม่ชนกัน
  if (dropzone) {
    dropzone.addEventListener("drop", function (e) {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
