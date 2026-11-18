/**
 * AI-DSRP — บันทึกเคสที่ยืนยันแล้วจากหน้า Case Intake ลง Google Sheet (FEAT-INTAKE-06)
 *
 * วิธีใช้: เปิด Google Sheet ที่จะเก็บข้อมูล → ส่วนขยาย (Extensions) → Apps Script → วางไฟล์นี้
 * → Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone)
 * แล้วนำ URL ที่ได้ไปใส่ใน prototypes/v1/sheet-config.js (ดู README.md ในโฟลเดอร์นี้)
 *
 * ความปลอดภัย: "Anyone" แปลว่าใครก็ยิงมาที่ URL ได้ สคริปต์จึงรับเฉพาะคำขอที่แนบ Firebase ID token
 * ของผู้ที่ล็อกอินเว็บ ai-dsrp อยู่ (ตรวจกับ Firebase ทุกครั้ง) — ตัวชีตยังเป็นของคุณ แชร์ให้ใครเห็นได้ตามปกติ
 * ⚠️ ชีตมีชื่อ/เลขประจำตัวประชาชน/ที่อยู่ผู้ป่วย (ข้อมูลส่วนบุคคลอ่อนไหว PDPA) — แชร์เฉพาะเจ้าหน้าที่ที่จำเป็น
 */

// Firebase web API key ของโปรเจกต์ ai-dsrp (ค่าสาธารณะ ตัวเดียวกับใน prototypes/v1/firebase-init.js) ใช้ตรวจ ID token
var FIREBASE_API_KEY = "AIzaSyCURDU09t4XimMJJS3-2tMJ03R_UG3eHHA";
var SHEET_NAME = "Cases";

// ลำดับคอลัมน์ในชีต — key ตรงกับ record ที่หน้าเว็บส่งมา (case-intake-sheet.js)
var COLUMNS = [
  { key: "caseId", label: "Case ID" },
  { key: "savedAt", label: "บันทึกเมื่อ" },
  { key: "savedBy", label: "ผู้บันทึก" },
  { key: "patientName", label: "ชื่อผู้ป่วย" },
  { key: "nationalId", label: "เลขประจำตัวประชาชน" },
  { key: "address", label: "ที่อยู่ขณะป่วย" },
  { key: "subdistrict", label: "ตำบล" },
  { key: "onsetDate", label: "วันที่เริ่มป่วย" },
  { key: "diseaseId", label: "รหัสโรค" },
  { key: "diseaseName", label: "โรค" },
  { key: "latitude", label: "ละติจูด" },
  { key: "longitude", label: "ลองจิจูด" },
  { key: "team", label: "ทีมรับผิดชอบ" },
  { key: "fileName", label: "ไฟล์ต้นฉบับ" }
];

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var user = verifyFirebaseUser_(body.idToken);
    if (!user) return json_({ ok: false, error: "ต้องเข้าสู่ระบบเว็บ ai-dsrp ก่อน" });

    if (body.action === "list") return json_({ ok: true, rows: listRows_() });
    if (body.action === "upsert") return json_(upsertRow_(body.record || {}, user.email || ""));
    return json_({ ok: false, error: "action ไม่ถูกต้อง" });
  } catch (err) {
    return json_({ ok: false, error: "เกิดข้อผิดพลาดในสคริปต์: " + err.message });
  }
}

// เปิด URL ตรงๆ ในเบราว์เซอร์ = เช็กว่า deploy แล้ว (ไม่คืนข้อมูลผู้ป่วย)
function doGet() {
  return json_({ ok: true, service: "AI-DSRP case sheet", sheet: SHEET_NAME });
}

// ตรวจ ID token กับ Firebase — คืน { email } ถ้าถูกต้อง, null ถ้าไม่ถูกต้อง/หมดอายุ
function verifyFirebaseUser_(idToken) {
  if (!idToken) return null;
  var res = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(FIREBASE_API_KEY),
    { method: "post", contentType: "application/json", payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) return null;
  var users = JSON.parse(res.getContentText()).users || [];
  return users.length ? { email: users[0].email } : null;
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS.map(function (c) { return c.label; }));
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight("bold");
    // เก็บเป็นข้อความ ไม่ให้ชีตแปลงเลขบัตร/วันที่/Case ID เป็นตัวเลขหรือวันที่เอง
    sheet.getRange(1, 1, sheet.getMaxRows(), COLUMNS.length).setNumberFormat("@");
  }
  return sheet;
}

// แถวที่มี Case ID ตรงกันจะถูกเขียนทับ (แก้แถวที่ยืนยันแล้วแล้วยืนยันใหม่) ไม่งั้นต่อท้าย
function upsertRow_(record, email) {
  if (!record.caseId) return { ok: false, error: "ไม่มี Case ID" };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_();
    record.savedAt = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
    record.savedBy = email;
    var values = COLUMNS.map(function (c) { return record[c.key] == null ? "" : String(record[c.key]); });

    var lastRow = sheet.getLastRow();
    var ids = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(record.caseId)) {
        sheet.getRange(i + 2, 1, 1, values.length).setValues([values]);
        return { ok: true, caseId: record.caseId, updated: true, savedAt: record.savedAt };
      }
    }
    sheet.appendRow(values);
    return { ok: true, caseId: record.caseId, updated: false, savedAt: record.savedAt };
  } finally {
    lock.releaseLock();
  }
}

// ทุกแถวในชีต (ใหม่สุดก่อน) เป็น object ตาม COLUMNS key
function listRows_() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var data = sheet.getRange(2, 1, lastRow - 1, COLUMNS.length).getDisplayValues();
  return data.map(function (row) {
    var obj = {};
    COLUMNS.forEach(function (c, i) { obj[c.key] = row[i]; });
    return obj;
  }).reverse();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
