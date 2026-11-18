/**
 * AI-DSRP — บันทึกเคสที่ยืนยันแล้วจากหน้า Case Intake ลง Google Sheet + เก็บไฟล์ต้นฉบับลง Google Drive
 * (FEAT-INTAKE-06) — ไฟล์ไปอยู่ในโฟลเดอร์ "AI-DSRP ไฟล์ต้นฉบับ Case Intake" ใน Drive ของเจ้าของสคริปต์
 * และลิงก์ไฟล์ถูกใส่ไว้ในคอลัมน์ "ลิงก์ไฟล์ต้นฉบับ (Drive)" ของแถวนั้น
 *
 * รูปแบบตาราง: 58 คอลัมน์ตามแบบทะเบียนผู้ป่วยของหน่วยงาน + คอลัมน์ของระบบต่อท้าย (Case ID ฯลฯ)
 * ระบบเขียนเฉพาะคอลัมน์ที่มีข้อมูลจาก Case Intake — คอลัมน์อื่น (เบอร์โทร เพศ อายุ Lab ควบคุมโรค น้ำมัน ฯลฯ)
 * เจ้าหน้าที่กรอกในชีตเอง และระบบไม่เขียนทับเมื่อยืนยันเคสซ้ำ
 * หาคอลัมน์จากชื่อหัวตาราง (ไม่ผูกตำแหน่ง) — ย้าย/แทรกคอลัมน์ในชีตได้ ตราบใดที่ไม่เปลี่ยนชื่อหัวคอลัมน์
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
// แท็บใหม่ตามแบบทะเบียนของหน่วยงาน (แท็บ "Cases" จากสคริปต์รุ่นก่อนถูกเก็บไว้เฉยๆ ไม่ถูกแก้)
var SHEET_NAME = "ทะเบียนผู้ป่วย";
var DRIVE_FOLDER_NAME = "AI-DSRP ไฟล์ต้นฉบับ Case Intake";
var ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];

// คอลัมน์ตามลำดับในชีต — key = ค่าที่ระบบเขียน (ไม่มี key = เจ้าหน้าที่กรอกเอง ระบบไม่แตะ)
// mode: "insert" = เขียนตอนเพิ่มแถวใหม่ครั้งเดียว, ไม่ระบุ = เขียนทุกครั้งที่ยืนยัน (ข้ามถ้าค่าว่าง ไม่ลบที่คนกรอกไว้)
var COLUMNS = [
  { label: "ลำดับ", key: "seq", mode: "insert" },
  { label: "เดือน", key: "month" },
  { label: "สัปดาห์ที่", key: "epiWeek" },
  { label: "ชื่อ-สกุล", key: "patientName" },
  { label: "เลขบัตร ปชช.", key: "nationalId" },
  { label: "เบอร์โทร" },
  { label: "sex" },
  { label: "เพศ" },
  { label: "อายุ" },
  { label: "กลุ่มอายุ" },
  { label: "OCCUPAT" },
  { label: "อาชีพ" },
  { label: "วันที่รับแจ้ง", key: "receivedDate", mode: "insert" },
  { label: "พิกัด ละติจูด \nลองติจูด", key: "homeCoords" },
  { label: "ชุมชน\n(ที่อยู่)" },
  { label: "ที่อยู่", key: "address" },
  { label: "ตำบล\n(ที่อยู่)", key: "subdistrict" },
  { label: "พิกัด ละติจูด \nลองติจูด\n(ทำงาน)" },
  { label: "ชุมชน\n(ที่ทำงาน)" },
  { label: "สถานที่ทำงาน/เรียน" },
  { label: "ตำบล\n(ทำงาน/เรียน)" },
  { label: "ควบคุมโรค\n(แห่ง)" },
  { label: "วันที่\nเริ่มป่วย", key: "onsetDate" },
  { label: "วันพบ\nผู้ป่วย" },
  { label: "Hospi" },
  { label: "สถานที่รักษา" },
  { label: "รหัสโรค", key: "diseaseId" },
  { label: "DX.", key: "diseaseName" },
  { label: "WBC" },
  { label: "Hb" },
  { label: "Hct" },
  { label: "Plt" },
  { label: "สาเหตุ\nการป่วย \n14 วัน" },
  { label: "ป่วยจาก" },
  { label: "วันที่ควบคุมโรค" },
  { label: "วันที่ 0" },
  { label: "HI-0" },
  { label: "CI-0" },
  { label: "วันที่ 1" },
  { label: "HI-1" },
  { label: "CI-1" },
  { label: "วันที่ 3" },
  { label: "CI-3" },
  { label: "HI-3" },
  { label: "วันที่ 7" },
  { label: "HI-7" },
  { label: "CI-7" },
  { label: "1. ดีเซล\n(ลิตร)" },
  { label: "1. แก๊สฯ\n95\n(ลิตร)" },
  { label: "1. น้ำยา\nเคมี\n(ml)" },
  { label: "2.ดีเซล\n(ลิตร)" },
  { label: "2. แก๊สฯ\n95\n(ลิตร)" },
  { label: "2. น้ำยา\nเคมี\n(ml)" },
  { label: "รวม\nดีเซล\n(ลิตร)" },
  { label: "รวม\nแก๊สฯ95\n(ลิตร)" },
  { label: "รวมน้ำยา\nเคมี\n(ml)" },
  { label: "มาตรฐานการควบคุมโรค(Day1)" },
  { label: "การควบคุมโรค" },
  // คอลัมน์ของระบบ (ต่อท้าย)
  { label: "Case ID", key: "caseId" },
  { label: "ทีมรับผิดชอบ", key: "team" },
  { label: "ผู้บันทึก", key: "savedBy" },
  { label: "บันทึกเมื่อ", key: "savedAt" },
  { label: "ลิงก์ไฟล์ต้นฉบับ (Drive)", key: "fileUrl" }
];

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var user = verifyFirebaseUser_(body.idToken);
    if (!user) return json_({ ok: false, error: "ต้องเข้าสู่ระบบเว็บ ai-dsrp ก่อน" });

    if (body.action === "list") return json_({ ok: true, rows: listRows_() });
    if (body.action === "upsert") return json_(upsertRow_(body.record || {}, user.email || "", body.file));
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

// ชื่อหัวคอลัมน์เทียบแบบไม่สนช่องว่าง/ขึ้นบรรทัดใหม่ ("วันที่\nเริ่มป่วย" = "วันที่ เริ่มป่วย")
function norm_(label) {
  return String(label || "").replace(/\s+/g, "");
}

// คืน { sheet, colOf: key|label(norm) -> เลขคอลัมน์ (1-based) } — สร้างแท็บ/หัวตารางให้ถ้ายังไม่มี
// และเพิ่มคอลัมน์ที่ขาด (เช่นคอลัมน์ระบบ) ต่อท้ายโดยไม่ยุ่งคอลัมน์ที่มีอยู่
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    var labels = COLUMNS.map(function (c) { return c.label; });
    sheet.getRange(1, 1, 1, labels.length).setValues([labels]).setFontWeight("bold").setWrap(true).setVerticalAlignment("middle");
    sheet.setFrozenRows(1);
    // เก็บเป็นข้อความ ไม่ให้ชีตแปลงเลขบัตร/วันที่/Case ID เป็นตัวเลขหรือวันที่เอง
    sheet.getRange(1, 1, sheet.getMaxRows(), labels.length).setNumberFormat("@");
  }

  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var header = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var index = {};
  header.forEach(function (h, i) { if (h && !index[norm_(h)]) index[norm_(h)] = i + 1; });

  var colOf = {};
  COLUMNS.forEach(function (c) {
    var col = index[norm_(c.label)];
    if (!col) {
      col = sheet.getLastColumn() + 1;
      sheet.getRange(1, col).setValue(c.label).setFontWeight("bold").setWrap(true);
      sheet.getRange(1, col, sheet.getMaxRows(), 1).setNumberFormat("@");
      index[norm_(c.label)] = col;
    }
    if (c.key) colOf[c.key] = col;
  });
  return { sheet: sheet, colOf: colOf };
}

// โฟลเดอร์เก็บไฟล์ต้นฉบับใน Drive ของเจ้าของสคริปต์ — สร้างครั้งแรกแล้วจำ id ไว้ใน Script Properties
function getFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("DRIVE_FOLDER_ID");
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* โฟลเดอร์ถูกลบ -> สร้างใหม่ */ }
  }
  var folder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
  props.setProperty("DRIVE_FOLDER_ID", folder.getId());
  return folder;
}

// file = { name, mimeType, data(base64) } — ชื่อไฟล์ขึ้นต้นด้วย Case ID ให้หาคู่กับแถวในชีตได้
function saveFile_(caseId, file) {
  if (ALLOWED_MIME.indexOf(file.mimeType) === -1) throw new Error("รองรับเฉพาะไฟล์ PDF, JPEG, PNG");
  var blob = Utilities.newBlob(Utilities.base64Decode(file.data), file.mimeType, caseId + "_" + (file.name || "original"));
  return getFolder_().createFile(blob).getUrl();
}

// แถวที่มี Case ID ตรงกันถูกอัปเดต (แก้แถวที่ยืนยันแล้วแล้วยืนยันใหม่) ไม่งั้นเพิ่มแถวใหม่ต่อท้าย
// อัปเดตเขียนเฉพาะคอลัมน์ของระบบที่มีค่า — คอลัมน์ที่เจ้าหน้าที่กรอกเองในชีตไม่ถูกแตะ
// ไฟล์ต้นฉบับอัปโหลดครั้งเดียวต่อ Case ID — ยืนยันซ้ำจะคงลิงก์ไฟล์เดิมไว้ ไม่สร้างไฟล์ซ้ำใน Drive
function upsertRow_(record, email, file) {
  if (!record.caseId) return { ok: false, error: "ไม่มี Case ID" };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var s = getSheet_();
    var sheet = s.sheet, colOf = s.colOf;
    var lastRow = sheet.getLastRow();
    var rowIndex = -1;
    if (lastRow > 1) {
      var ids = sheet.getRange(2, colOf.caseId, lastRow - 1, 1).getDisplayValues();
      for (var i = 0; i < ids.length; i++) {
        if (ids[i][0] === String(record.caseId)) { rowIndex = i + 2; break; }
      }
    }
    var isNew = rowIndex < 0;
    if (isNew) rowIndex = lastRow + 1;

    var existingFileUrl = isNew ? "" : sheet.getRange(rowIndex, colOf.fileUrl).getDisplayValue();
    record.fileUrl = existingFileUrl || (file && file.data ? saveFile_(record.caseId, file) : "");
    record.savedAt = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
    record.savedBy = email;
    if (isNew) record.seq = nextSeq_(sheet, colOf.seq, lastRow);

    COLUMNS.forEach(function (c) {
      if (!c.key) return;
      if (c.mode === "insert" && !isNew) return;
      var value = record[c.key] == null ? "" : String(record[c.key]);
      if (value === "") return;
      sheet.getRange(rowIndex, colOf[c.key]).setNumberFormat("@").setValue(value);
    });
    return { ok: true, caseId: record.caseId, updated: !isNew, savedAt: record.savedAt, fileUrl: record.fileUrl };
  } finally {
    lock.releaseLock();
  }
}

// ลำดับถัดไป = เลขลำดับมากสุดในคอลัมน์ + 1 (รองรับแถวที่เจ้าหน้าที่เพิ่มเองในชีต)
function nextSeq_(sheet, col, lastRow) {
  if (lastRow < 2) return 1;
  var max = 0;
  sheet.getRange(2, col, lastRow - 1, 1).getDisplayValues().forEach(function (r) {
    var n = parseInt(r[0], 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max + 1;
}

// ทุกแถวที่มาจากระบบ (มี Case ID) ใหม่สุดก่อน เป็น object ตาม key ของคอลัมน์ระบบ
function listRows_() {
  var s = getSheet_();
  var sheet = s.sheet, colOf = s.colOf;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getDisplayValues();
  return data.filter(function (row) { return row[colOf.caseId - 1]; }).map(function (row) {
    var obj = {};
    Object.keys(colOf).forEach(function (key) { obj[key] = row[colOf[key] - 1]; });
    return obj;
  }).reverse();
}

// กด ▶ Run ฟังก์ชันนี้ในหน้า Apps Script หนึ่งครั้งเพื่อให้ Google ขอสิทธิ์ Drive/Sheet
// (ฟังก์ชันที่ชื่อลงท้าย _ ไม่ขึ้นในเมนู Run จึงต้องมีตัวนี้แยกไว้)
function authorizeDrive() {
  Logger.log("โฟลเดอร์ไฟล์ต้นฉบับ: " + getFolder_().getUrl());
  Logger.log("แท็บชีต: " + getSheet_().sheet.getName());
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
