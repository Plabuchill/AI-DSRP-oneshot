// บันทึกเคสที่ยืนยันแล้วลง Google Sheet + แสดงข้อมูลในชีตเป็นตารางบนหน้า Case Intake (FEAT-INTAKE-06)
// คุยกับ Apps Script web app (apps-script/case-sheet/Code.gs) — แนบ Firebase ID token ของผู้ที่ล็อกอินทุกคำขอ
// case-intake.js (classic script) ส่งคำขอบันทึกมาทาง CustomEvent "case-intake:save-to-sheet" และรับผลกลับทาง
// "case-intake:sheet-result" (pattern เดียวกับ case-intake-upload.js) — ไฟล์นี้ไม่แก้สถานะเคสเอง

import { auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { CASE_SHEET_URL, CASE_SHEET_VIEW_URL } from "./sheet-config.js";

// case-intake.js อ่านค่านี้ตอน render เพื่อแสดง/ซ่อนสถานะ "บันทึกลง Google Sheet" ของแถวที่ยืนยันแล้ว
window.AidsrpCaseSheet = { enabled: !!CASE_SHEET_URL };

const currentUser = new Promise(function (resolve) {
  const stop = onAuthStateChanged(auth, function (user) { stop(); resolve(user); });
});

// Apps Script รับ body เป็นข้อความธรรมดา (ไม่ตั้ง Content-Type: application/json เพื่อไม่ให้เบราว์เซอร์ส่ง preflight
// ซึ่ง Apps Script ตอบไม่ได้) — token อยู่ใน body เพราะ Apps Script อ่าน header ของคำขอไม่ได้
async function callSheet(action, extra) {
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

// ไฟล์ -> base64 (ไม่มี prefix data:) สำหรับส่งให้ Apps Script บันทึกลง Drive
function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () { resolve(String(reader.result).split(",")[1] || ""); };
    reader.onerror = function () { reject(new Error("อ่านไฟล์ต้นฉบับไม่ได้")); };
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatNationalId(digits) {
  const d = String(digits || "");
  return d.length === 13 ? d[0] + "-" + d.slice(1, 5) + "-" + d.slice(5, 10) + "-" + d.slice(10, 12) + "-" + d[12] : d;
}

function init() {
  const tbody = document.getElementById("sheet-table-body");
  const statusEl = document.getElementById("sheet-panel-status");
  const subtitleEl = document.getElementById("sheet-panel-subtitle");
  const refreshBtn = document.getElementById("btn-sheet-refresh");
  const openLink = document.getElementById("link-open-sheet");
  if (!tbody) return; // หน้าอื่นไม่มีตารางนี้

  function setStatus(message, isError) {
    statusEl.textContent = message || "";
    statusEl.style.display = message ? "block" : "none";
    statusEl.className = "body-secondary" + (isError ? " upload-ocr-status-error" : "");
  }

  if (!CASE_SHEET_URL) {
    refreshBtn.style.display = "none";
    subtitleEl.textContent = "ยังไม่ได้เชื่อมต่อ";
    setStatus("ยังไม่ได้เชื่อมต่อ Google Sheet — ข้อมูลที่ยืนยันแล้วยังอยู่ในหน้าเว็บเท่านั้น (ผู้ดูแลระบบตั้งค่าได้ที่ sheet-config.js)", false);
    return;
  }
  if (CASE_SHEET_VIEW_URL) {
    openLink.href = CASE_SHEET_VIEW_URL;
    openLink.style.display = "";
  }

  function renderRows(rows) {
    subtitleEl.textContent = rows.length + " รายการ";
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="body-secondary">ยังไม่มีข้อมูลในชีต — กดยืนยันเคสในตารางตรวจสอบด้านบนเพื่อบันทึก</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (r) {
      const coords = r.homeCoords ? escapeHtml(r.homeCoords) : "-";
      return "<tr>" +
        "<td><strong>" + escapeHtml(r.seq ? r.seq + ". " : "") + escapeHtml(r.caseId) + "</strong><span class=\"cell-secondary\">" +
          (r.fileUrl && /^https:\/\//.test(r.fileUrl)
            ? '<a href="' + escapeHtml(r.fileUrl) + '" target="_blank" rel="noopener">เปิดไฟล์ต้นฉบับ</a>'
            : "ไม่มีไฟล์ต้นฉบับ") +
        "</span></td>" +
        "<td>" + escapeHtml(r.patientName) + "<span class=\"cell-secondary\">" + escapeHtml(formatNationalId(r.nationalId)) + "</span></td>" +
        "<td>" + escapeHtml(r.address) + "</td>" +
        "<td>" + escapeHtml(r.onsetDate) +
          (r.epiWeek ? "<span class=\"cell-secondary\">สัปดาห์ที่ " + escapeHtml(r.epiWeek) + " · " + escapeHtml(r.month) + "</span>" : "") +
        "</td>" +
        "<td>" + escapeHtml(r.diseaseId ? r.diseaseId + " " + r.diseaseName : "-") + "</td>" +
        "<td>" + coords + "</td>" +
        "<td>" + escapeHtml(r.team) + "</td>" +
        "<td>" + escapeHtml(r.savedAt) + "<span class=\"cell-secondary\">" + escapeHtml(r.savedBy) + "</span></td>" +
        "</tr>";
    }).join("");
  }

  async function loadRows() {
    refreshBtn.disabled = true;
    setStatus("กำลังโหลดข้อมูลจาก Google Sheet...", false);
    try {
      const body = await callSheet("list");
      renderRows(body.rows || []);
      setStatus("", false);
    } catch (err) {
      setStatus("โหลดข้อมูลจาก Google Sheet ไม่สำเร็จ: " + err.message, true);
    } finally {
      refreshBtn.disabled = false;
    }
  }

  document.addEventListener("case-intake:save-to-sheet", async function (e) {
    const record = e.detail.record;
    const file = e.detail.file;
    let result;
    try {
      const extra = { record: record };
      if (file) extra.file = { name: file.name, mimeType: file.type, data: await fileToBase64(file) };
      const body = await callSheet("upsert", extra);
      result = { caseId: record.caseId, ok: true, fileUrl: body.fileUrl || "" };
    } catch (err) {
      result = { caseId: record.caseId, ok: false, error: err.message };
    }
    document.dispatchEvent(new CustomEvent("case-intake:sheet-result", { detail: result }));
    if (result.ok) loadRows();
  });

  refreshBtn.addEventListener("click", loadRows);
  loadRows();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
