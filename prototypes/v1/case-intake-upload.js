// อัปโหลดเอกสารรายงานผู้ป่วยจริง (FEAT-INTAKE-05) — OCR ในเบราว์เซอร์ด้วย Tesseract.js
// (case-intake-ocr.js) ไม่ใช้ Cloud Function/Blaze/คีย์ AI และไฟล์ไม่ออกนอกเครื่องผู้ใช้
// (Cloud Function extractCaseReport + Claude Vision ยังอยู่ใน functions/ เผื่อกลับไปใช้ตอนอัปเกรด Blaze)
// ต่างจาก case-intake.js (classic script, mock CASES array) — ไฟล์นี้เป็น type="module" ที่ส่งผลลัพธ์
// กลับไปให้ case-intake.js ผ่าน CustomEvent "case-intake:ocr-result"
// (ตาม pattern เดียวกับ case-analysis.js + case-analysis-506.js)

import { extractCaseReportLocal } from "./case-intake-ocr.js";

const MAX_FILE_BYTES = 7 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function init() {
  const selectBtn = document.getElementById("btn-select-file");
  const fileInput = document.getElementById("file-input");
  const dropzone = document.getElementById("dropzone");
  const statusEl = document.getElementById("upload-ocr-status");
  if (!selectBtn || !fileInput) return; // หน้าอื่นไม่มี element นี้

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.style.display = message ? "block" : "none";
    statusEl.className = "body-secondary" + (isError ? " upload-ocr-status-error" : "");
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
    setStatus("กำลังเริ่มอ่านเอกสารด้วย OCR...", false);

    try {
      const result = await extractCaseReportLocal(file, function (message) {
        setStatus(message, false);
      });

      setStatus("", false);
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
    } finally {
      selectBtn.disabled = false;
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
