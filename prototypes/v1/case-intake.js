/* =========================================================
   AI Disease Surveillance & Response Platform
   Case Intake — mock OCR review / notification / spot map pipeline
   (separate script from script.js: this page has its own DOM/state,
   dashboard's script.js is not reused here to avoid id collisions)
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     Reference data — 5 investigation teams (เขต 1-5, mock)
     --------------------------------------------------------- */
  var TEAMS = {
    1: "ทีมสอบสวนโรค เขต 1",
    2: "ทีมสอบสวนโรค เขต 2",
    3: "ทีมสอบสวนโรค เขต 3",
    4: "ทีมสอบสวนโรค เขต 4",
    5: "ทีมสอบสวนโรค เขต 5"
  };

  /* ---------------------------------------------------------
     Subdistrict (ตำบล) -> investigation team (zone) mapping.
     Derived from the known service areas of each team (mock),
     used to re-route a case automatically when its subdistrict
     is corrected during inline edit. Unknown subdistrict values
     keep the case's existing team assignment unchanged.
     --------------------------------------------------------- */
  var SUBDISTRICT_TEAM_MAP = {
    "บ้านเป็ด": 3,
    "หนองบัว": 3,
    "ท่าช้าง": 2,
    "สันติสุข": 1,
    "คลองใหญ่": 4,
    "เกาะแก้ว": 5
  };

  /* ---------------------------------------------------------
     โรคตามแบบ รง.506 (รหัส + ชื่อ) — คัดจากตัวอย่างฟอร์มจริงที่ผู้ใช้ส่งมา เฉพาะรายการที่อ่านชัดเจน
     ใช้เป็นตัวเลือก dropdown "โรค" (ไม่พึ่ง Firestore) ควรตรวจกับรายการทางการอีกครั้ง
     --------------------------------------------------------- */
  var DISEASE_TYPES = [
    { id: "01", name: "อหิวาตกโรค" }, { id: "02", name: "อุจจาระร่วง" }, { id: "03", name: "อาหารเป็นพิษ" },
    { id: "04", name: "บิด (Dysentery, unspecified)" }, { id: "07", name: "Enteric fever" },
    { id: "10", name: "ตับอักเสบ (Hepatitis, unspecified)" }, { id: "11", name: "Hepatitis A" },
    { id: "12", name: "Hepatitis B" }, { id: "13", name: "Hepatitis C" }, { id: "14", name: "โรคตาแดง" },
    { id: "15", name: "ไข้หวัดใหญ่" }, { id: "16", name: "หัดเยอรมัน" }, { id: "17", name: "สุกใส" },
    { id: "18", name: "ไข้หรือไข้ไม่ทราบสาเหตุ" }, { id: "20", name: "โปลิโอมัยเอไลติส" }, { id: "21", name: "หัด" },
    { id: "23", name: "คอตีบ" }, { id: "24", name: "ไอกรน" }, { id: "25", name: "บาดทะยัก" },
    { id: "26", name: "ไข้เลือดออก (DHF)" }, { id: "27", name: "ไข้เลือดออกช็อก (DSS)" },
    { id: "28", name: "ไข้สมองอักเสบ (Encephalitis, unspecified)" }, { id: "29", name: "Japanese encephalitis" },
    { id: "30", name: "มาลาเรีย" }, { id: "31", name: "โรคปอดบวม (Pneumonia)" }, { id: "32", name: "วัณโรคปอด" },
    { id: "35", name: "โรคเรื้อน" }, { id: "42", name: "พิษสุนัขบ้า" }, { id: "43", name: "Leptospirosis" },
    { id: "44", name: "สครับไทฟัส" }, { id: "52", name: "คางทูม" }, { id: "65", name: "กล้ามเนื้ออ่อนปวกเปียกแบบเฉียบพลัน (AFP)" },
    { id: "66", name: "ไข้เด็งกี่ (Dengue fever)" }, { id: "71", name: "Hand Foot Mouth disease (HFM)" },
    { id: "72", name: "Melioidosis" }, { id: "84", name: "Chikungunya fever" }, { id: "85", name: "Botulism" },
    { id: "87", name: "Zika Virus" }, { id: "99", name: "โรคอื่นๆ (ระบุ)" }
  ];

  function diseaseNameById(id) {
    for (var i = 0; i < DISEASE_TYPES.length; i++) {
      if (DISEASE_TYPES[i].id === id) return DISEASE_TYPES[i].name;
    }
    return "";
  }

  function diseaseLabel(id) {
    return id ? (id + " " + diseaseNameById(id)) : "";
  }

  // เดาโรคจากข้อความที่ OCR อ่านได้ (รหัส 2 หลักตรงกับรายการ หรือคำสำคัญ) — เป็นข้อเสนอเท่านั้น ผู้ใช้เลือกแก้เองได้เสมอ
  var DISEASE_KEYWORDS = [
    { re: /dhf|เลือดออกรุนแรง/i, id: "26" },
    { re: /dss|ช็อก/i, id: "27" },
    { re: /dengue|เด็งกี|เดงกี|ไข้เลือดออก|ns1/i, id: "66" },
    { re: /hfmd|hand\s*foot|มือ\s*เท้า\s*ปาก/i, id: "71" },
    { re: /อาหารเป็นพิษ/, id: "03" },
    { re: /อุจจาระร่วง/, id: "02" },
    { re: /ไข้หวัดใหญ่|influenza/i, id: "15" },
    { re: /chikungunya|ชิคุนกุนยา/i, id: "84" },
    { re: /zika|ซิกา/i, id: "87" },
    { re: /malaria|มาลาเรีย/i, id: "30" },
    { re: /leptospirosis|เลปโต/i, id: "43" }
  ];

  function guessDiseaseId(text) {
    text = String(text || "");
    var codes = text.match(/(?:^|\D)(\d{2})(?!\d)/g) || [];
    for (var i = 0; i < codes.length; i++) {
      var code = codes[i].replace(/\D/g, "");
      if (diseaseNameById(code)) return code;
    }
    for (var k = 0; k < DISEASE_KEYWORDS.length; k++) {
      if (DISEASE_KEYWORDS[k].re.test(text)) return DISEASE_KEYWORDS[k].id;
    }
    return null;
  }

  // เลขประจำตัวประชาชน 13 หลัก: ตรวจ checksum (หลักที่ 13) — ใช้เตือนจุดที่ OCR น่าจะอ่านผิด ไม่บล็อกการบันทึก
  function nationalIdCheckDigit(first12) {
    var sum = 0;
    for (var i = 0; i < 12; i++) sum += parseInt(first12.charAt(i), 10) * (13 - i);
    return String((11 - (sum % 11)) % 10);
  }

  function isNationalIdChecksumValid(digits) {
    return /^\d{13}$/.test(digits) && nationalIdCheckDigit(digits.slice(0, 12)) === digits.charAt(12);
  }

  function formatNationalId(digits) {
    digits = String(digits || "");
    if (digits.length !== 13) return digits;
    return digits.charAt(0) + "-" + digits.slice(1, 5) + "-" + digits.slice(5, 10) + "-" + digits.slice(10, 12) + "-" + digits.charAt(12);
  }

  // เลขประจำตัวจำลองสำหรับเคสตัวอย่าง (ไม่ใช่เลขจริงของใคร)
  function mockNationalId(index) {
    var base = "11000000" + (index + 1 < 10 ? "000" : "00") + (index + 1);
    base = base.slice(0, 12);
    return base + nationalIdCheckDigit(base);
  }

  // พิกัด ละติจูด/ลองจิจูด <-> ตำแหน่งหมุดบนแผนที่จำลอง (กรอบประเทศไทยคร่าวๆ lat 5.5–21, lng 97–106)
  function mapToCoords(mapX, mapY) {
    return {
      lat: Math.round((21 - (mapY / 100) * 15.5) * 10000) / 10000,
      lng: Math.round((97 + (mapX / 100) * 9) * 10000) / 10000
    };
  }

  function coordsToMap(lat, lng) {
    return {
      x: Math.max(0, Math.min(100, ((lng - 97) / (106 - 97)) * 100)),
      y: Math.max(0, Math.min(100, ((21 - lat) / (21 - 5.5)) * 100))
    };
  }

  // แยก "ละติจูด, ลองจิจูด" จากข้อความช่องเดียว เช่น "19.8963, 99.8280" — คืน null ถ้ารูปแบบผิด/นอกประเทศไทย
  function parseCoordinateText(text) {
    var m = String(text || "").trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return null;
    var lat = parseFloat(m[1]);
    var lng = parseFloat(m[2]);
    if (isNaN(lat) || isNaN(lng) || lat < 5.5 || lat > 21 || lng < 97 || lng > 106) return null;
    return { lat: lat, lng: lng };
  }

  function composeAddress(c) {
    return [
      c.houseNo && "บ้านเลขที่ " + c.houseNo,
      c.villageNo && "หมู่ " + c.villageNo,
      c.village,
      c.subdistrict && "ต." + c.subdistrict,
      c.district && "อ." + c.district,
      c.province && "จ." + c.province
    ].filter(Boolean).join(" ");
  }

  // หาตำบลจากข้อความที่อยู่ช่องเดียว (ต้นทางส่งให้ทีมสอบสวนโรคตามตำบล) — ตำบลที่ระบบรู้จักก่อน ไม่เจอลองจับ "ต./ตำบล <ชื่อ>"
  function detectSubdistrict(address) {
    address = String(address || "");
    var known = Object.keys(SUBDISTRICT_TEAM_MAP);
    for (var i = 0; i < known.length; i++) {
      if (address.indexOf(known[i]) !== -1) return known[i];
    }
    var m = address.match(/(?:ต\.|ตำบล)\s*([^\s]+)/);
    return m ? m[1] : "";
  }

  /* ---------------------------------------------------------
     Mock cases — OCR-extracted data awaiting human review.
     Case #1 is pre-seeded as already confirmed, to show the
     "downstream" state (notification log + pinned on map) on load.
     --------------------------------------------------------- */
  var CASES = [
    {
      id: 1,
      fileName: "รพ.สต.บ้านเป็ด_290857_case01.pdf",
      fileType: "PDF",
      fileSize: "842 KB",
      uploadedLabel: "19 ส.ค. 2569, 13:40 น.",
      patientName: "กิตติ มั่นคง",
      hn: "HN-57765",
      houseNo: "45",
      villageNo: "3",
      village: "บ้านเป็ดใหม่",
      subdistrict: "บ้านเป็ด",
      district: "เมือง",
      province: "ขอนแก่น",
      onsetDate: "14 ส.ค. 2569",
      labResult: "มือ เท้า ปาก (HFMD) — Positive",
      zone: 3,
      geoAccuracy: "high",
      geoAdjusted: false,
      status: "confirmed",
      mapX: 22, mapY: 68,
      seedLogTimestamp: "19 ส.ค. 2569, 14:02 น."
    },
    {
      id: 2,
      fileName: "รพช.เมืองขอนแก่น_scan_0231.jpg",
      fileType: "JPEG",
      fileSize: "1.4 MB",
      uploadedLabel: "20 ส.ค. 2569, 08:05 น.",
      patientName: "สมหญิง ใจดี",
      hn: "HN-58231",
      houseNo: "12",
      villageNo: "4",
      village: "บ้านโนนสวรรค์",
      subdistrict: "หนองบัว",
      district: "เมือง",
      province: "ขอนแก่น",
      onsetDate: "15 ส.ค. 2569",
      labResult: "ไข้เลือดออก (Dengue NS1) — Positive",
      zone: 3,
      geoAccuracy: "low",
      geoAdjusted: false,
      status: "pending",
      mapX: 30, mapY: 45
    },
    {
      id: 3,
      fileName: "รพ.นครราชสีมา_report_60142.pdf",
      fileType: "PDF",
      fileSize: "763 KB",
      uploadedLabel: "20 ส.ค. 2569, 08:12 น.",
      patientName: "ประเสริฐ ศรีสุข",
      hn: "HN-60142",
      houseNo: "5",
      villageNo: "2",
      village: "บ้านท่าช้าง",
      subdistrict: "ท่าช้าง",
      district: "เมือง",
      province: "นครราชสีมา",
      onsetDate: "16 ส.ค. 2569",
      labResult: "ไข้หวัดใหญ่ (Influenza A) — Positive",
      zone: 2,
      geoAccuracy: "high",
      geoAdjusted: false,
      status: "pending",
      mapX: 55, mapY: 30
    },
    {
      id: 4,
      fileName: "รพ.แม่ริม_lab_59987.pdf",
      fileType: "PDF",
      fileSize: "690 KB",
      uploadedLabel: "20 ส.ค. 2569, 08:20 น.",
      patientName: "วาสนา บุญมี",
      hn: "HN-59987",
      houseNo: "33",
      villageNo: "7",
      village: "บ้านสันติสุข",
      subdistrict: "สันติสุข",
      district: "แม่ริม",
      province: "เชียงใหม่",
      onsetDate: "17 ส.ค. 2569",
      labResult: "โควิด-19 (RT-PCR) — Positive",
      zone: 1,
      geoAccuracy: "high",
      geoAdjusted: false,
      status: "pending",
      mapX: 78, mapY: 55
    },
    {
      id: 5,
      fileName: "รพ.บางละมุง_foodpoison_61200.jpg",
      fileType: "JPEG",
      fileSize: "1.1 MB",
      uploadedLabel: "20 ส.ค. 2569, 08:31 น.",
      patientName: "อนุชา ทองแท้",
      hn: "HN-61200",
      houseNo: "8",
      villageNo: "1",
      village: "บ้านคลองใหญ่",
      subdistrict: "คลองใหญ่",
      district: "บางละมุง",
      province: "ชลบุรี",
      onsetDate: "18 ส.ค. 2569",
      labResult: "อาหารเป็นพิษ — ยืนยันทางคลินิก",
      zone: 4,
      geoAccuracy: "low",
      geoAdjusted: false,
      status: "pending",
      mapX: 45, mapY: 80
    },
    {
      id: 6,
      fileName: "รพ.สต.เกาะแก้ว_dengue_58890.pdf",
      fileType: "PDF",
      fileSize: "905 KB",
      uploadedLabel: "20 ส.ค. 2569, 08:44 น.",
      patientName: "ละออ แสงจันทร์",
      hn: "HN-58890",
      houseNo: "21",
      villageNo: "5",
      village: "บ้านหาดทราย",
      subdistrict: "เกาะแก้ว",
      district: "เมือง",
      province: "สงขลา",
      onsetDate: "19 ส.ค. 2569",
      labResult: "ไข้เลือดออก (Dengue NS1) — Positive",
      zone: 5,
      geoAccuracy: "high",
      geoAdjusted: false,
      status: "pending",
      mapX: 65, mapY: 20
    }
  ];

  // Snapshot the original mock map position of every case *before* any
  // manual geo-adjustment can happen, so "เลิกทำ" (undo) can restore it
  // exactly. Also seed the editing-mode flag used by the manual
  // lat/long entry flow below.
  CASES.forEach(function (c, idx) {
    c._originalMapX = c.mapX;
    c._originalMapY = c.mapY;
    c._editingGeo = false;
    // โครงข้อมูลตามสเปค OCR Review: เลขประจำตัวประชาชน + ที่อยู่ช่องเดียว + พิกัดช่องเดียว + โรคแบบเลือกรหัส
    if (!c.nationalId) c.nationalId = mockNationalId(idx);
    if (!c.address) c.address = composeAddress(c);
    if (c.latitude === undefined) {
      var ll = mapToCoords(c.mapX, c.mapY);
      c.latitude = ll.lat;
      c.longitude = ll.lng;
    }
    c._originalLat = c.latitude;
    c._originalLng = c.longitude;
    if (!c.diseaseId) c.diseaseId = guessDiseaseId(c.labResult);
  });

  // Notification log — seeded with the log entry for the pre-confirmed case.
  var NOTIFICATIONS = [
    {
      caseId: 1,
      teamName: TEAMS[3],
      timestampLabel: CASES[0].seedLogTimestamp,
      patientName: CASES[0].patientName,
      subdistrict: CASES[0].subdistrict
    }
  ];


  function getCaseById(id) {
    for (var i = 0; i < CASES.length; i++) {
      if (CASES[i].id === id) return CASES[i];
    }
    return null;
  }

  // Id of the row currently in inline-edit mode (null = no row being edited).
  // Only one row can be edited at a time.
  var editingId = null;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------------------------------------------------------
     Thai date/time formatting for "now" timestamps
     --------------------------------------------------------- */
  var THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

  function pad2(n) { return n < 10 ? "0" + n : String(n); }

  function formatThaiDateTime(date) {
    var d = date.getDate();
    var m = THAI_MONTHS[date.getMonth()];
    var y = date.getFullYear() + 543;
    return d + " " + m + " " + y + ", " + pad2(date.getHours()) + ":" + pad2(date.getMinutes()) + " น.";
  }

  /* ---------------------------------------------------------
     Shared inline icons (thin-line, monochrome — matches DESIGN.md)
     --------------------------------------------------------- */
  var ICON_FILE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6l1 4H8l1-4Z"></path><path d="M6 6h12l1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L6 6Z"></path></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"></path><path d="M22 2 15 22l-4-9-9-4 20-7Z"></path></svg>';
  var ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"></path></svg>';

  /* ---------------------------------------------------------
     DOM refs
     --------------------------------------------------------- */
  var els = {
    dropzone: document.getElementById("dropzone"),
    uploadFileList: document.getElementById("upload-file-list"),
    ocrPanelSubtitle: document.getElementById("ocr-panel-subtitle"),
    ocrTableBody: document.getElementById("ocr-table-body"),
    spotmapWrap: document.getElementById("spotmap-wrap"),
    notifPanelSubtitle: document.getElementById("notif-panel-subtitle"),
    notificationLog: document.getElementById("notification-log")
  };

  /* ---------------------------------------------------------
     Render: Upload file list (sample data; status label reflects
     whether the row has since been confirmed by a human)
     --------------------------------------------------------- */
  function renderUploadList() {
    els.uploadFileList.innerHTML = "";
    CASES.forEach(function (c) {
      var confirmed = c.status === "confirmed";
      var statusHtml = confirmed
        ? '<span class="badge badge-confirmed upload-file-status">ประมวลผลและแจ้งเตือนแล้ว</span>'
        : '<span class="badge badge-neutral upload-file-status">แปลงข้อมูลสำเร็จ &middot; พร้อมตรวจสอบ</span>';

      var item = document.createElement("div");
      item.className = "upload-file-item";
      item.innerHTML =
        '<div class="upload-file-icon">' + ICON_FILE + "</div>" +
        '<div class="upload-file-info">' +
          '<span class="upload-file-name">' + c.fileName + "</span>" +
          '<span class="upload-file-meta">' +
            "<span>" + c.fileType + " &middot; " + c.fileSize + "</span>" +
            "<span>อัปโหลดเมื่อ " + c.uploadedLabel + "</span>" +
          "</span>" +
        "</div>" +
        statusHtml;
      els.uploadFileList.appendChild(item);
    });
  }

  /* ---------------------------------------------------------
     Render: OCR review table
     --------------------------------------------------------- */
  function coordText(c) {
    return (c.latitude !== undefined && c.latitude !== null && c.longitude !== undefined && c.longitude !== null)
      ? c.latitude.toFixed(4) + ", " + c.longitude.toFixed(4)
      : "";
  }

  // ตำแหน่งพิกัด: ช่องเดียว "ละติจูด, ลองจิจูด" เช่น 19.8963, 99.8280
  function geoCellHtml(c) {
    if (c._editingGeo) {
      return (
        '<div class="geo-cell">' +
          '<span class="geo-note">ละติจูด, ลองจิจูด เช่น 19.8963, 99.8280</span>' +
          '<input type="text" class="input-inline" id="geo-coord-input-' + c.id + '" placeholder="19.8963, 99.8280" aria-label="ตำแหน่งพิกัด (ละติจูด, ลองจิจูด)" value="' + escapeHtml(coordText(c)) + '">' +
          '<div class="row-actions">' +
            '<button type="button" class="btn btn-primary btn-sm btn-save-geo" data-id="' + c.id + '">บันทึกพิกัด</button>' +
            '<button type="button" class="btn btn-outline btn-sm btn-cancel-geo" data-id="' + c.id + '">ยกเลิก</button>' +
          "</div>" +
        "</div>"
      );
    }

    var text = coordText(c);
    var badge;
    if (c.geoAdjusted) badge = '<span class="badge badge-adjusted">ปรับพิกัดด้วยมือแล้ว</span>';
    else if (!text || c.geoAccuracy === "low") badge = '<span class="badge badge-flag">' + (text ? "พิกัดแม่นยำต่ำ" : "ยังไม่มีพิกัด") + "</span>";
    else badge = '<span class="geo-note">พิกัดแม่นยำสูง</span>';

    return (
      '<div class="geo-cell">' +
        (text ? '<span class="cell-primary">' + escapeHtml(text) + "</span>" : "") +
        badge +
        '<div class="row-actions">' +
          '<button type="button" class="btn btn-outline btn-sm btn-start-geo" data-id="' + c.id + '">' + (text ? "แก้ไขพิกัด" : "ระบุพิกัด") + "</button>" +
          (c.geoAdjusted ? '<button type="button" class="btn btn-outline btn-sm btn-toggle-geo" data-id="' + c.id + '">เลิกทำ</button>' : "") +
        "</div>" +
      "</div>"
    );
  }

  function actionCellHtml(c, editing) {
    if (c.status === "confirmed") {
      return '<span class="confirmed-check">' + ICON_CHECK + "ยืนยันแล้ว</span>";
    }
    if (editing) {
      return (
        '<div class="row-actions">' +
          '<button type="button" class="btn btn-primary btn-sm btn-save-edit" data-id="' + c.id + '">บันทึก</button>' +
          '<button type="button" class="btn btn-outline btn-sm btn-cancel-edit" data-id="' + c.id + '">ยกเลิก</button>' +
        "</div>"
      );
    }
    return (
      '<div class="row-actions">' +
        '<button type="button" class="btn btn-outline btn-sm btn-edit-row" data-id="' + c.id + '">' + ICON_EDIT + "แก้ไข</button>" +
        '<button type="button" class="btn btn-primary btn-sm btn-confirm" data-id="' + c.id + '">ยืนยัน</button>' +
        '<button type="button" class="btn btn-outline btn-sm btn-delete-row" data-id="' + c.id + '">ลบ</button>' +
      "</div>"
    );
  }

  /* -- Editable cells: ชื่อ-สกุล/HN, ที่อยู่/ตำบล-หมู่บ้าน, วันป่วย, ผลตรวจ.
     Each renders either plain text (default) or inline <input> fields
     (when the row is the one currently being edited). -- */
  function nameCellHtml(c, editing) {
    if (editing) {
      return (
        '<div class="edit-field-group">' +
          '<input type="text" class="input-inline" data-field="patientName" value="' + escapeHtml(c.patientName) + '" placeholder="ชื่อผู้ป่วย" aria-label="ชื่อผู้ป่วย">' +
          '<input type="text" class="input-inline" data-field="nationalId" inputmode="numeric" maxlength="17" value="' + escapeHtml(formatNationalId(c.nationalId)) + '" placeholder="เลขประจำตัวประชาชน 13 หลัก" aria-label="เลขประจำตัวประชาชน">' +
        "</div>"
      );
    }
    var digits = String(c.nationalId || "").replace(/\D/g, "");
    var idWarn = "";
    if (!digits) idWarn = '<span class="badge badge-flag">ยังไม่มีเลขประจำตัว</span>';
    else if (digits.length !== 13) idWarn = '<span class="badge badge-flag">เลขไม่ครบ 13 หลัก</span>';
    else if (!isNationalIdChecksumValid(digits)) idWarn = '<span class="badge badge-flag">เลขอาจอ่านผิด (checksum ไม่ผ่าน)</span>';
    return '<span class="cell-primary">' + escapeHtml(c.patientName) + '</span><span class="cell-secondary">' + escapeHtml(formatNationalId(digits)) + "</span>" + idWarn;
  }

  function addressCellHtml(c, editing) {
    if (editing) {
      return (
        '<div class="edit-field-group">' +
          '<input type="text" class="input-inline" data-field="address" value="' + escapeHtml(c.address) + '" placeholder="บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด" aria-label="ที่อยู่ขณะป่วย">' +
          '<span class="cell-secondary edit-hint">ทีมรับผิดชอบจะปรับอัตโนมัติเมื่อบันทึก ถ้าตำบลในที่อยู่ตรงกับพื้นที่ที่ระบบรู้จัก</span>' +
        "</div>"
      );
    }
    return (
      '<span class="cell-primary">' + escapeHtml(c.address) + "</span>" +
      '<span class="cell-secondary">ทีมรับผิดชอบ: ' + TEAMS[c.zone] + "</span>"
    );
  }

  function onsetCellHtml(c, editing) {
    if (editing) {
      return '<input type="text" class="input-inline" data-field="onsetDate" value="' + escapeHtml(c.onsetDate) + '" placeholder="วันที่เริ่มป่วย" aria-label="วันที่เริ่มป่วย">';
    }
    return escapeHtml(c.onsetDate);
  }

  // โรค — dropdown เลือกโรคตามรหัส รง.506 (เช่น 66 ไข้เด็งกี่ (Dengue fever)) เจ้าหน้าที่เลือก/แก้ได้เสมอ
  // ถ้าเดาจากข้อความ OCR ได้จะเลือกให้ก่อนพร้อมข้อความเตือนให้ตรวจสอบ (ไม่ persist ลง Firestore)
  function diseaseCellHtml(c) {
    if (c.status === "confirmed") {
      return '<span class="cell-primary">' + (c.diseaseId ? escapeHtml(diseaseLabel(c.diseaseId)) : "-") + "</span>";
    }

    var optionsHtml = '<option value="">-- เลือกโรค --</option>' +
      DISEASE_TYPES.map(function (t) {
        var selected = (c.diseaseId === t.id) ? " selected" : "";
        return '<option value="' + escapeHtml(t.id) + '"' + selected + '>' + escapeHtml(t.id + " " + t.name) + "</option>";
      }).join("");

    var hint = c._diseaseFromOcr && c.diseaseId
      ? '<span class="cell-secondary edit-hint">เลือกจากข้อความในเอกสาร โปรดตรวจสอบ</span>'
      : "";

    return '<div class="geo-cell"><select class="input-inline select-disease-type" data-id="' + c.id + '">' + optionsHtml + "</select>" + hint + "</div>";
  }

  function renderOCRTable() {
    els.ocrTableBody.innerHTML = "";

    CASES.forEach(function (c) {
      var confirmed = c.status === "confirmed";
      var editing = c.id === editingId;
      var tr = document.createElement("tr");
      tr.className = confirmed ? "row-confirmed" : (editing ? "row-editing" : "");
      tr.setAttribute("data-row-id", c.id);
      tr.innerHTML =
        "<td>" +
          '<a class="file-link" href="#" data-case-id="' + c.id + '" data-file="' + c.fileName + '" title="' + (c._fileUrl ? "ดูภาพเอกสารต้นฉบับที่อัปโหลด" : "เปิดไฟล์ต้นฉบับใน Google Drive (จำลอง)") + '">' +
            ICON_FILE + "ไฟล์ต้นฉบับ" +
          "</a>" +
        "</td>" +
        "<td>" + nameCellHtml(c, editing) + "</td>" +
        "<td>" + addressCellHtml(c, editing) + "</td>" +
        "<td>" + onsetCellHtml(c, editing) + "</td>" +
        "<td>" + diseaseCellHtml(c) + "</td>" +
        "<td>" + geoCellHtml(c) + "</td>" +
        "<td>" +
          (confirmed
            ? '<span class="badge badge-confirmed">ยืนยันแล้ว</span>'
            : '<span class="badge badge-neutral">รอตรวจสอบ</span>') +
        "</td>" +
        "<td>" + actionCellHtml(c, editing) + "</td>";
      els.ocrTableBody.appendChild(tr);
    });

    var pending = CASES.filter(function (c) { return c.status === "pending"; }).length;
    var doneCount = CASES.length - pending;
    els.ocrPanelSubtitle.textContent = "รอตรวจสอบ " + pending + " รายการ · ยืนยันแล้ว " + doneCount + " รายการ";
  }

  /* ---------------------------------------------------------
     Render: Notification log (reuses .alert-list/.alert-item
     visual pattern from the dashboard for consistency)
     --------------------------------------------------------- */
  function renderNotificationLog() {
    els.notifPanelSubtitle.textContent = "ส่งแจ้งเตือนแล้ว " + NOTIFICATIONS.length + " ครั้ง";
    els.notificationLog.innerHTML = "";

    if (NOTIFICATIONS.length === 0) {
      var empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "ยังไม่มีการแจ้งเตือนทีมสอบสวนโรค";
      els.notificationLog.appendChild(empty);
      return;
    }

    NOTIFICATIONS.forEach(function (n) {
      var item = document.createElement("div");
      item.className = "alert-item";
      item.innerHTML =
        '<div class="alert-icon badge-confirmed">' + ICON_SEND + "</div>" +
        '<div class="alert-body">' +
          '<div class="alert-top-row">' +
            '<span class="alert-title">' + n.teamName + "</span>" +
            '<span class="badge badge-confirmed">ส่งแล้ว</span>' +
          "</div>" +
          '<p class="body-secondary" style="font-size:14px;color:var(--color-text-primary)">' +
            "เคสผู้ป่วย " + n.patientName + " &middot; ต." + n.subdistrict +
          "</p>" +
          '<div class="alert-meta"><span>' + n.timestampLabel + "</span></div>" +
        "</div>";
      els.notificationLog.appendChild(item);
    });
  }

  /* ---------------------------------------------------------
     Render: Spot map (inline SVG — abstract village grid,
     pins for confirmed cases + 100m radius rings)
     --------------------------------------------------------- */
  function buildSpotMapSVG() {
    var W = 640, H = 380;
    var confirmed = CASES.filter(function (c) { return c.status === "confirmed"; });
    var parts = [];

    parts.push('<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="แผนที่จุดเกิดเหตุระดับตำบลหมู่บ้าน">');
    parts.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#F5F1EA" stroke="#DCD3C4" stroke-width="1"></rect>');

    var step = 64;
    for (var gx = step; gx < W; gx += step) {
      parts.push('<line x1="' + gx + '" y1="0" x2="' + gx + '" y2="' + H + '" stroke="#DCD3C4" stroke-width="1" stroke-opacity="0.6"></line>');
    }
    for (var gy = step; gy < H; gy += step) {
      parts.push('<line x1="0" y1="' + gy + '" x2="' + W + '" y2="' + gy + '" stroke="#DCD3C4" stroke-width="1" stroke-opacity="0.6"></line>');
    }

    // simple road line for visual orientation only (abstract, not geodata)
    parts.push('<line x1="0" y1="' + (H * 0.62) + '" x2="' + W + '" y2="' + (H * 0.5) + '" stroke="#B3A996" stroke-width="3" stroke-dasharray="10 8" stroke-opacity="0.6"></line>');
    parts.push('<text x="12" y="20" font-size="11" fill="#6E6355" font-family="Inter, system-ui, sans-serif">แผนที่จำลอง — ไม่อ้างอิงพิกัดจริง</text>');

    if (confirmed.length === 0) {
      parts.push('<text x="' + (W / 2) + '" y="' + (H / 2) + '" text-anchor="middle" font-size="13" fill="#6E6355" font-family="Inter, system-ui, sans-serif">ยังไม่มีเคสที่ยืนยันแล้วบนแผนที่</text>');
    }

    confirmed.forEach(function (c) {
      var px = (c.mapX / 100) * W;
      var py = (c.mapY / 100) * H;
      var flagged = c.geoAccuracy === "low" && !c.geoAdjusted;
      var adjusted = c.geoAdjusted; // ไม่ผูกกับ geoAccuracy อีกต่อไป — ปรับพิกัดด้วยมือได้ทุก accuracy tier
      var color = flagged ? "#C9A66B" : (adjusted ? "#7A6A53" : "#8A9A5B");
      var dash = flagged ? ' stroke-dasharray="5 4"' : "";
      var statusLabel = flagged ? "พิกัดแม่นยำต่ำ (ยังไม่ปรับ)" : (adjusted ? "ปรับพิกัดด้วยมือแล้ว" : "พิกัดแม่นยำสูง");

      parts.push('<g class="spot-pin-group">');
      parts.push('<circle cx="' + px + '" cy="' + py + '" r="30" fill="' + color + '" fill-opacity="0.14" stroke="' + color + '" stroke-width="1.5"' + dash + '></circle>');
      parts.push('<circle cx="' + px + '" cy="' + py + '" r="6" fill="' + color + '"></circle>');
      parts.push('<text x="' + px + '" y="' + (py - 14) + '" text-anchor="middle" font-size="11" font-weight="600" fill="#33291F" font-family="Inter, system-ui, sans-serif">' + c.patientName.split(" ")[0] + "</text>");
      parts.push('<text x="' + px + '" y="' + (py + 22) + '" text-anchor="middle" font-size="10" fill="#6E6355" font-family="Inter, system-ui, sans-serif">ต.' + c.subdistrict + "</text>");
      parts.push("<title>" + c.patientName + " — " + c.address + " · " + TEAMS[c.zone] + " · " + statusLabel + "</title>");
      parts.push("</g>");
    });

    parts.push("</svg>");
    return parts.join("");
  }

  function renderSpotMap() {
    els.spotmapWrap.innerHTML = buildSpotMapSVG();
  }

  /* ---------------------------------------------------------
     Actions
     --------------------------------------------------------- */
  // ⚠️ c.status เปลี่ยนได้จากฟังก์ชันนี้เท่านั้น และฟังก์ชันนี้ถูกเรียกจาก click handler ของ
  // ปุ่ม "ยืนยัน" (.btn-confirm) เท่านั้น — ห้าม AI (case-intake-diagnose.js/case-intake-upload.js)
  // เรียก confirmCase() หรือแก้ c.status ตรงๆ เด็ดขาด ต้องรอคนกดยืนยันเสมอ
  function confirmCase(id) {
    var c = getCaseById(id);
    if (!c || c.status === "confirmed") return;

    // ต้องกรอกช่องหลักให้ครบก่อนยืนยัน (ตรงกับ API-SPEC.md หัวข้อ 4: ยืนยันเคสที่ field จำเป็นว่าง → ปฏิเสธ)
    var missing = [];
    if (!String(c.patientName || "").trim()) missing.push("ชื่อผู้ป่วย");
    if (!/^\d{13}$/.test(String(c.nationalId || "").replace(/\D/g, ""))) missing.push("เลขประจำตัวประชาชน (13 หลัก)");
    if (!String(c.address || "").trim()) missing.push("ที่อยู่ขณะป่วย");
    if (!String(c.onsetDate || "").trim()) missing.push("วันที่เริ่มป่วย");
    if (!c.diseaseId) missing.push("โรค");
    if (missing.length) {
      alert("ยังยืนยันไม่ได้ กรุณากรอก/เลือกให้ครบ: " + missing.join(", "));
      return;
    }

    c.status = "confirmed";
    var now = new Date();
    NOTIFICATIONS.unshift({
      caseId: c.id,
      teamName: TEAMS[c.zone],
      timestampLabel: formatThaiDateTime(now),
      patientName: c.patientName,
      subdistrict: c.subdistrict
    });

    renderOCRTable();
    renderUploadList();
    renderNotificationLog();
    renderSpotMap();
  }

  // "เลิกทำ" — undo a manual adjustment and restore the original mock pin
  // position saved in c._originalMapX/Y before any edit ever happened.
  function toggleGeoAdjust(id) {
    var c = getCaseById(id);
    if (!c) return;
    c.geoAdjusted = false;
    c.latitude = c._originalLat;
    c.longitude = c._originalLng;
    c.mapX = c._originalMapX;
    c.mapY = c._originalMapY;
    c._editingGeo = false;
    renderOCRTable();
    renderSpotMap();
  }

  // Open the manual lat/long entry fields for a row (first time: blank
  // inputs; re-editing an already-adjusted row: pre-filled via geoCellHtml
  // reading c.latitude/c.longitude, which are left untouched here).
  function startGeoEdit(id) {
    var c = getCaseById(id);
    if (!c) return;
    c._editingGeo = true;
    renderOCRTable();
  }

  // "ยกเลิก" while entering coordinates — just closes the input fields,
  // no validation, no data changes.
  function cancelGeoEdit(id) {
    var c = getCaseById(id);
    if (!c) return;
    c._editingGeo = false;
    renderOCRTable();
  }

  // Validate and persist manually-entered coordinates, then recompute the
  // pin's SVG position (c.mapX/c.mapY) by normalizing lat/long within a
  // rough Thailand bounding box (lat 5.5–21, lng 97–106), clamped to 0-100
  // so the pin can never render outside the mock map's SVG viewport.
  function saveGeoCoordinates(id, text) {
    var c = getCaseById(id);
    if (!c) return;

    var parsed = parseCoordinateText(text);
    if (!parsed) {
      alert("กรุณากรอกพิกัดเป็น ละติจูด, ลองจิจูด ช่องเดียว เช่น 19.8963, 99.8280 (ต้องอยู่ในประเทศไทย: ละติจูด 5.5–21, ลองจิจูด 97–106)");
      return;
    }

    c.latitude = parsed.lat;
    c.longitude = parsed.lng;
    var pos = coordsToMap(parsed.lat, parsed.lng);
    c.mapX = pos.x;
    c.mapY = pos.y;
    c.geoAdjusted = true;
    c._editingGeo = false;

    renderOCRTable();
    renderSpotMap();
  }

  // เพิ่มเคสใหม่จากผลลัพธ์ OCR จริง (FEAT-INTAKE-05) — รับผ่าน CustomEvent จาก
  // case-intake-upload.js (module แยกที่คุยกับ Cloud Function/Claude Vision)
  // ยังเป็น in-memory ล้วนเหมือน CASES เดิม (ไม่ persist ข้ามการ reload หน้า —
  // ดูเหตุผลขอบเขตใน BUILD-PLAN.md), geoAccuracy ตั้งเป็น "low" เสมอเพราะ OCR
  // ไม่ได้คืนพิกัด ต้องพึ่ง fallback "ปรับพิกัดด้วยมือ" ที่มีอยู่แล้ว
  function addCaseFromOCR(detail) {
    var fields = detail.fields || {};
    var address = fields.address || composeAddress(fields);
    var subdistrict = detectSubdistrict(address) || fields.subdistrict || "";
    var nextId = CASES.reduce(function (max, c) { return Math.max(max, c.id); }, 0) + 1;
    var now = new Date();
    var coords = parseCoordinateText(fields.coordinates);
    // AI อ่านรหัสโรคจากช่องที่ติ๊กมาให้โดยตรง (ถ้ามีและอยู่ในรายการ) ไม่งั้นเดาจากข้อความ OCR
    var diseaseId = (fields.diseaseId && diseaseNameById(fields.diseaseId)) ? fields.diseaseId : guessDiseaseId(fields.labResult);

    var newCase = {
      id: nextId,
      fileName: detail.fileName,
      fileType: detail.fileType,
      fileSize: detail.fileSize,
      uploadedLabel: formatThaiDateTime(now),
      patientName: fields.patientName || "",
      nationalId: String(fields.nationalId || "").replace(/\D/g, ""),
      hn: fields.hn || "",
      address: address,
      subdistrict: subdistrict,
      onsetDate: fields.onsetDate || "",
      labResult: fields.labResult || "",
      diseaseId: diseaseId,
      _diseaseFromOcr: !!diseaseId,
      // ตำบลไม่ตรงกับพื้นที่ที่ระบบรู้จัก (mock) -> เข้าทีมสอบสวนโรค เขต 1 เป็นค่าเริ่มต้นไปก่อน
      zone: SUBDISTRICT_TEAM_MAP.hasOwnProperty(subdistrict) ? SUBDISTRICT_TEAM_MAP[subdistrict] : 1,
      geoAccuracy: coords ? "high" : "low",
      geoAdjusted: false,
      status: "pending",
      mapX: 50, mapY: 50
    };
    if (coords) {
      var pos = coordsToMap(coords.lat, coords.lng);
      newCase.latitude = coords.lat;
      newCase.longitude = coords.lng;
      newCase.mapX = pos.x;
      newCase.mapY = pos.y;
    }
    newCase._fileUrl = detail.file ? URL.createObjectURL(detail.file) : null;
    // OCR อ่านได้น้อยกว่า 2 ช่องหลัก (ชื่อ/เลขบัตร/ที่อยู่/วันที่เริ่มป่วย) = ถือว่าอ่านไม่ได้ (มักเป็นลายมือ)
    var filledMain = [newCase.patientName, newCase.nationalId.length === 13 ? "x" : "", newCase.address, newCase.onsetDate]
      .filter(Boolean).length;
    var weakOcr = filledMain < 2;
    newCase._originalMapX = newCase.mapX;
    newCase._originalMapY = newCase.mapY;
    newCase._originalLat = newCase.latitude;
    newCase._originalLng = newCase.longitude;
    newCase._editingGeo = false;

    CASES.unshift(newCase);
    if (weakOcr) editingId = newCase.id; // เปิดโหมดแก้ไขให้เลย เพราะต้องกรอกเองจากภาพต้นฉบับ
    renderUploadList();
    renderOCRTable();
    showSourcePreview(newCase, weakOcr);
  }

  // แสดงภาพ/PDF ต้นฉบับเหนือตาราง OCR Review เพื่อเทียบหรือกรอกเอง (human-in-the-loop)
  function showSourcePreview(c, weakOcr) {
    var panel = document.getElementById("source-preview-panel");
    if (!panel || !c || !c._fileUrl) return;
    document.getElementById("source-preview-name").textContent = c.fileName;
    document.getElementById("source-preview-hint").textContent = weakOcr
      ? "ระบบอ่านข้อมูลจากเอกสารนี้ได้น้อยมาก (มักเป็นลายมือ) กรุณาดูภาพต้นฉบับด้านล่างแล้วกรอกข้อมูลในตารางเอง"
      : "เทียบค่าในตารางกับภาพต้นฉบับก่อนกดยืนยัน (OCR ฟรีอ่านลายมือไม่แม่น)";
    var body = document.getElementById("source-preview-body");
    body.innerHTML = "";
    var node;
    if (c.fileType === "PDF") {
      node = document.createElement("iframe");
      node.style.cssText = "width:100%;height:500px;border:0;";
    } else {
      node = document.createElement("img");
      node.alt = "ภาพเอกสารต้นฉบับ " + c.fileName;
      node.style.cssText = "max-width:100%;display:block;cursor:zoom-in;";
      node.addEventListener("click", function () { window.open(c._fileUrl, "_blank", "noopener"); });
    }
    node.src = c._fileUrl;
    body.appendChild(node);
    panel.style.display = "";
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* -- Inline edit of an OCR row (pending rows only): start / cancel / save -- */
  function startEdit(id) {
    var c = getCaseById(id);
    if (!c || c.status === "confirmed") return;
    editingId = id;
    renderOCRTable();
  }

  function cancelEdit() {
    editingId = null;
    renderOCRTable();
  }

  function saveEdit(id, rowEl) {
    var c = getCaseById(id);
    if (!c || !rowEl) return;

    var inputs = rowEl.querySelectorAll("[data-field]");
    inputs.forEach(function (input) {
      var field = input.getAttribute("data-field");
      var value = input.value.trim();
      c[field] = field === "nationalId" ? value.replace(/\D/g, "") : value;
    });

    // Auto-route: if the subdistrict in the corrected address matches a known area, reassign
    // the responsible team. Unknown subdistrict values keep the current team.
    var newSubdistrict = detectSubdistrict(c.address);
    if (newSubdistrict) c.subdistrict = newSubdistrict;
    if (newSubdistrict && SUBDISTRICT_TEAM_MAP.hasOwnProperty(newSubdistrict)) {
      c.zone = SUBDISTRICT_TEAM_MAP[newSubdistrict];
    }

    editingId = null;
    renderOCRTable();
  }

  // ลบแถวที่ยังรอตรวจสอบ (เช่น อัปโหลดผิดไฟล์/ซ้ำ) — แถวที่ยืนยันแล้วลบไม่ได้ เพราะแจ้งเตือนทีมไปแล้ว
  function deleteCase(id) {
    var c = getCaseById(id);
    if (!c || c.status === "confirmed") return;
    if (!window.confirm("ลบรายการ \"" + (c.patientName || c.fileName || "ไม่มีชื่อ") + "\" ออกจากตารางตรวจสอบ?")) return;

    CASES.splice(CASES.indexOf(c), 1);
    if (editingId === id) editingId = null;
    var previewName = document.getElementById("source-preview-name");
    if (c._fileUrl) {
      if (previewName && previewName.textContent === c.fileName) {
        document.getElementById("source-preview-panel").style.display = "none";
        document.getElementById("source-preview-body").innerHTML = "";
      }
      URL.revokeObjectURL(c._fileUrl);
    }
    renderOCRTable();
    renderUploadList();
  }

  /* ---------------------------------------------------------
     Event wiring
     --------------------------------------------------------- */
  function initEvents() {
    // Event delegation for confirm / geo-toggle buttons and mock file links
    els.ocrTableBody.addEventListener("click", function (e) {
      var editBtn = e.target.closest(".btn-edit-row");
      if (editBtn) {
        startEdit(parseInt(editBtn.getAttribute("data-id"), 10));
        return;
      }
      var saveBtn = e.target.closest(".btn-save-edit");
      if (saveBtn) {
        saveEdit(parseInt(saveBtn.getAttribute("data-id"), 10), saveBtn.closest("tr"));
        return;
      }
      var cancelBtn = e.target.closest(".btn-cancel-edit");
      if (cancelBtn) {
        cancelEdit();
        return;
      }
      var confirmBtn = e.target.closest(".btn-confirm");
      if (confirmBtn) {
        confirmCase(parseInt(confirmBtn.getAttribute("data-id"), 10));
        return;
      }
      var deleteBtn = e.target.closest(".btn-delete-row");
      if (deleteBtn) {
        deleteCase(parseInt(deleteBtn.getAttribute("data-id"), 10));
        return;
      }
      var geoBtn = e.target.closest(".btn-toggle-geo");
      if (geoBtn) {
        toggleGeoAdjust(parseInt(geoBtn.getAttribute("data-id"), 10));
        return;
      }
      var startGeoBtn = e.target.closest(".btn-start-geo");
      if (startGeoBtn) {
        startGeoEdit(parseInt(startGeoBtn.getAttribute("data-id"), 10));
        return;
      }
      var editGeoBtn = e.target.closest(".btn-edit-geo");
      if (editGeoBtn) {
        startGeoEdit(parseInt(editGeoBtn.getAttribute("data-id"), 10));
        return;
      }
      var cancelGeoBtn = e.target.closest(".btn-cancel-geo");
      if (cancelGeoBtn) {
        cancelGeoEdit(parseInt(cancelGeoBtn.getAttribute("data-id"), 10));
        return;
      }
      var saveGeoBtn = e.target.closest(".btn-save-geo");
      if (saveGeoBtn) {
        var geoId = parseInt(saveGeoBtn.getAttribute("data-id"), 10);
        var coordInput = document.getElementById("geo-coord-input-" + geoId);
        saveGeoCoordinates(geoId, coordInput ? coordInput.value : "");
        return;
      }
      var fileLink = e.target.closest(".file-link");
      if (fileLink) {
        e.preventDefault();
        var fileCase = getCaseById(parseInt(fileLink.getAttribute("data-case-id"), 10));
        if (fileCase && fileCase._fileUrl) showSourcePreview(fileCase, false);
      }
    });

    // เลือกประเภทโรคติดต่อเองด้วยมือ (FEAT-INTAKE-11) — แก้ไข dropdown ได้เสมอ ไม่ว่าจะเคย
    // กด "ให้ AI ช่วยจัด" มาก่อนหรือไม่ (human-in-the-loop เดียวกับ FEAT-ANALYSIS-08)
    els.ocrTableBody.addEventListener("change", function (e) {
      var select = e.target.closest(".select-disease-type");
      if (!select) return;
      var c = getCaseById(parseInt(select.getAttribute("data-id"), 10));
      if (!c) return;
      c.diseaseId = select.value || null;
      c.diseaseName = select.value ? diseaseNameById(select.value) : null;
      c._diseaseFromOcr = false;
    });

    // Dropzone — mock drag/drop visual feedback only (no real file handling)
    if (els.dropzone) {
      ["dragenter", "dragover"].forEach(function (evt) {
        els.dropzone.addEventListener(evt, function (e) {
          e.preventDefault();
          els.dropzone.classList.add("dragover");
        });
      });
      ["dragleave", "drop"].forEach(function (evt) {
        els.dropzone.addEventListener(evt, function (e) {
          e.preventDefault();
          els.dropzone.classList.remove("dragover");
        });
      });
    }
  }

  function init() {
    renderUploadList();
    renderOCRTable();
    renderNotificationLog();
    renderSpotMap();
    initEvents();
    document.addEventListener("case-intake:ocr-result", function (e) {
      addCaseFromOCR(e.detail);
    });
    // รายชื่อโรคติดต่อจริงจาก 506Types (FEAT-INTAKE-11) — มาจาก case-intake-diagnose.js
    // (ไม่ใช้รายการโรคจาก Firestore 506Types อีกแล้ว — ใช้รหัสโรคตามแบบ รง.506 ที่กำหนดไว้ใน DISEASE_TYPES)
    // ผล "ให้ AI ช่วยจัด" ประเภทโรคติดต่อ (FEAT-INTAKE-11) — matched=true เติม dropdown ให้
    // อัตโนมัติ แต่ยังแก้ไขเองได้เสมอก่อนกดยืนยัน (advisory เท่านั้น)
    document.addEventListener("case-intake:diagnose-result", function (e) {
      var c = getCaseById(e.detail.id);
      if (!c) return;
      if (e.detail.loading) {
        c._diagnoseLoading = true;
        c._diagnoseError = null;
      } else {
        c._diagnoseLoading = false;
        if (e.detail.error) {
          // error ชั่วคราว (เรียกไม่สำเร็จ/timeout) ไม่ใช่ผลลัพธ์จาก AI จริง จึงไม่เก็บใน
          // c.aiSuggestion — เก็บแยกไว้แค่แสดงผลบนจอเท่านั้น
          c._diagnoseError = e.detail.error;
        } else {
          c._diagnoseError = null;
          // เก็บผลลัพธ์ล่าสุดจาก AI ไว้ที่ c.aiSuggestion (in-memory เท่านั้น หายเมื่อ reload
          // เพราะ Case Intake ยังไม่มี Firestore document ให้ persist จริง — ดู FEAT-INTAKE-11)
          c.aiSuggestion = { matched: e.detail.matched, diseaseId: e.detail.diseaseId || null, diseaseName: e.detail.diseaseName || null, reason: e.detail.reason || "" };
          // aiLog — ประวัติการเรียก AI ทุกครั้งที่สำเร็จ (ไม่รวม error ชั่วคราว) เก็บ input/output/
          // createdAt แบบ append-only เหมือน SURVEILLANCE_REPORT_506_AI_LOG แต่เป็น in-memory
          // array แทน Firestore subcollection เพราะเคสนี้ยังไม่มี document จริงให้ผูก
          if (!c.aiLog) c.aiLog = [];
          c.aiLog.push({
            input: { clinicalText: e.detail.clinicalText || "" },
            output: { matched: e.detail.matched, diseaseId: e.detail.diseaseId || null, diseaseName: e.detail.diseaseName || null, reason: e.detail.reason || "" },
            createdAt: new Date().toISOString()
          });
          if (e.detail.matched) {
            c.diseaseId = e.detail.diseaseId;
            c.diseaseName = e.detail.diseaseName;
          }
        }
      }
      renderOCRTable();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
