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
  CASES.forEach(function (c) {
    c._originalMapX = c.mapX;
    c._originalMapY = c.mapY;
    c._editingGeo = false;
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

  // ประเภทโรคติดต่อจริงจาก Firestore (506Types) — เติมโดย case-intake-diagnose.js ผ่าน
  // CustomEvent "case-intake:disease-types" (FEAT-INTAKE-11) เพราะไฟล์นี้เป็น classic script
  // ไม่ใช่ module จึงอ่าน Firestore เองไม่ได้ ว่างไว้ก่อนจนกว่าจะโหลดเสร็จ
  var DISEASE_TYPES = [];

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
  function geoCellHtml(c) {
    // Currently entering/editing manual coordinates — takes priority over
    // both the "not adjusted yet" and "already adjusted" display states.
    if (c._editingGeo) {
      var latVal = (c.latitude !== undefined && c.latitude !== null) ? c.latitude : "";
      var lngVal = (c.longitude !== undefined && c.longitude !== null) ? c.longitude : "";
      return (
        '<div class="geo-cell">' +
          '<span class="geo-note">กรอกพิกัดจากอุปกรณ์ GPS/แผนที่ภายนอก</span>' +
          '<div class="edit-field-row">' +
            '<input type="number" step="0.0001" class="input-inline input-inline-geo" id="geo-lat-input-' + c.id + '" placeholder="13.7563" aria-label="ละติจูด" value="' + escapeHtml(latVal) + '">' +
            '<input type="number" step="0.0001" class="input-inline input-inline-geo" id="geo-lng-input-' + c.id + '" placeholder="100.5018" aria-label="ลองจิจูด" value="' + escapeHtml(lngVal) + '">' +
          "</div>" +
          '<div class="row-actions">' +
            '<button type="button" class="btn btn-primary btn-sm btn-save-geo" data-id="' + c.id + '">บันทึกพิกัด</button>' +
            '<button type="button" class="btn btn-outline btn-sm btn-cancel-geo" data-id="' + c.id + '">ยกเลิก</button>' +
          "</div>" +
        "</div>"
      );
    }

    if (c.geoAdjusted) {
      return (
        '<div class="geo-cell">' +
          '<span class="badge badge-adjusted">ปรับพิกัดด้วยมือแล้ว</span>' +
          '<span class="geo-note">' + c.latitude.toFixed(4) + ", " + c.longitude.toFixed(4) + "</span>" +
          '<div class="row-actions">' +
            '<button type="button" class="btn btn-outline btn-sm btn-edit-geo" data-id="' + c.id + '">แก้ไข</button>' +
            '<button type="button" class="btn btn-outline btn-sm btn-toggle-geo" data-id="' + c.id + '">เลิกทำ</button>' +
          "</div>" +
        "</div>"
      );
    }

    if (c.geoAccuracy === "high") {
      return (
        '<div class="geo-cell">' +
          '<span class="geo-note">พิกัดแม่นยำสูง</span>' +
          '<button type="button" class="btn btn-outline btn-sm btn-start-geo" data-id="' + c.id + '">ปรับพิกัดด้วยมือ</button>' +
        "</div>"
      );
    }

    return (
      '<div class="geo-cell">' +
        '<span class="badge badge-flag">พิกัดแม่นยำต่ำ</span>' +
        '<button type="button" class="btn btn-outline btn-sm btn-start-geo" data-id="' + c.id + '">ปรับพิกัดด้วยมือ</button>' +
      "</div>"
    );
  }

  // ผล "ให้ AI ช่วยตรวจสอบ" (FEAT-INTAKE-10) — สร้าง HTML ของปุ่ม + ผลลัพธ์ (ถ้ามี)
  // ใช้เฉพาะแถว "รอตรวจสอบ" ที่ไม่ได้อยู่ในโหมดแก้ไข
  function assistReviewHtml(c) {
    var fieldsForAssist = {
      patientName: c.patientName, hn: c.hn, houseNo: c.houseNo, villageNo: c.villageNo,
      village: c.village, subdistrict: c.subdistrict, district: c.district, province: c.province,
      onsetDate: c.onsetDate, labResult: c.labResult
    };
    var fieldsJson = escapeHtml(JSON.stringify(fieldsForAssist));
    var btnLabel = c._assistLoading ? "กำลังตรวจสอบ..." : "ให้ AI ช่วยตรวจสอบ";
    var btnHtml =
      '<button type="button" class="btn btn-outline btn-sm btn-assist-review" data-id="' + c.id + '" data-fields="' + fieldsJson + '"' +
      (c._assistLoading ? " disabled" : "") + ">" + btnLabel + "</button>";

    var resultHtml = "";
    if (c._assistResult) {
      if (c._assistResult.error) {
        resultHtml = '<div class="assist-result assist-result-error">' + escapeHtml(c._assistResult.error) + "</div>";
      } else if (c._assistResult.status === "ok") {
        resultHtml = '<div class="assist-result assist-result-ok">' + ICON_CHECK + "AI: ข้อมูลดูสมเหตุสมผล</div>";
      } else {
        var notesHtml = (c._assistResult.notes || []).map(function (n) {
          return "<li><strong>" + escapeHtml(n.field) + ":</strong> " + escapeHtml(n.issue) + "</li>";
        }).join("");
        resultHtml = '<div class="assist-result assist-result-concern">AI พบจุดที่น่าสงสัย:<ul>' + notesHtml + "</ul></div>";
      }
    }

    return '<div class="row-actions" style="margin-top:6px;">' + btnHtml + "</div>" + resultHtml;
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
      "</div>" +
      assistReviewHtml(c)
    );
  }

  /* -- Editable cells: ชื่อ-สกุล/HN, ที่อยู่/ตำบล-หมู่บ้าน, วันป่วย, ผลตรวจ.
     Each renders either plain text (default) or inline <input> fields
     (when the row is the one currently being edited). -- */
  function nameCellHtml(c, editing) {
    if (editing) {
      return (
        '<div class="edit-field-group">' +
          '<input type="text" class="input-inline" data-field="patientName" value="' + escapeHtml(c.patientName) + '" placeholder="ชื่อ-สกุล" aria-label="ชื่อ-สกุล">' +
          '<input type="text" class="input-inline" data-field="hn" value="' + escapeHtml(c.hn) + '" placeholder="HN" aria-label="HN">' +
        "</div>"
      );
    }
    return '<span class="cell-primary">' + escapeHtml(c.patientName) + '</span><span class="cell-secondary">' + escapeHtml(c.hn) + "</span>";
  }

  function addressCellHtml(c, editing) {
    if (editing) {
      return (
        '<div class="edit-field-group">' +
          '<div class="edit-field-row">' +
            '<input type="text" class="input-inline input-inline-xs" data-field="houseNo" value="' + escapeHtml(c.houseNo) + '" placeholder="เลขที่" aria-label="บ้านเลขที่">' +
            '<input type="text" class="input-inline input-inline-xs" data-field="villageNo" value="' + escapeHtml(c.villageNo) + '" placeholder="หมู่" aria-label="หมู่ที่">' +
            '<input type="text" class="input-inline" data-field="village" value="' + escapeHtml(c.village) + '" placeholder="ชื่อหมู่บ้าน" aria-label="ชื่อหมู่บ้าน">' +
          "</div>" +
          '<input type="text" class="input-inline" data-field="subdistrict" value="' + escapeHtml(c.subdistrict) + '" placeholder="ตำบล" aria-label="ตำบล">' +
          '<span class="cell-secondary edit-hint">อ.' + escapeHtml(c.district) + " จ." + escapeHtml(c.province) + " &middot; ทีมรับผิดชอบจะปรับอัตโนมัติเมื่อบันทึก ถ้าตำบลตรงกับพื้นที่ที่ระบบรู้จัก</span>" +
        "</div>"
      );
    }
    return (
      '<span class="cell-primary">บ้านเลขที่ ' + escapeHtml(c.houseNo) + " หมู่ " + escapeHtml(c.villageNo) + " " + escapeHtml(c.village) + "</span>" +
      '<span class="cell-secondary">ต.' + escapeHtml(c.subdistrict) + " อ." + escapeHtml(c.district) + " จ." + escapeHtml(c.province) + "</span>" +
      '<span class="cell-secondary">ทีมรับผิดชอบ: ' + TEAMS[c.zone] + "</span>"
    );
  }

  function onsetCellHtml(c, editing) {
    if (editing) {
      return '<input type="text" class="input-inline" data-field="onsetDate" value="' + escapeHtml(c.onsetDate) + '" placeholder="วันป่วย" aria-label="วันป่วย">';
    }
    return escapeHtml(c.onsetDate);
  }

  function labResultCellHtml(c, editing) {
    if (editing) {
      return '<input type="text" class="input-inline" data-field="labResult" value="' + escapeHtml(c.labResult) + '" placeholder="ผลตรวจ" aria-label="ผลตรวจ">';
    }
    return escapeHtml(c.labResult);
  }

  // ประเภทโรคติดต่อ (FEAT-INTAKE-11) — dropdown ผูกกับ 506Types จริง + ปุ่ม "ให้ AI ช่วยจัด"
  // ที่ส่งค่า "ผลตรวจ" ของแถวนี้ไปให้ suggestDiseaseType วิเคราะห์ เป็น advisory เท่านั้น
  // เจ้าหน้าที่เลือก/แก้ไข dropdown เองได้เสมอ ไม่ persist ลง Firestore (Case Intake ยังไม่มี
  // backing จริงสำหรับเคส — ดู FEAT-INTAKE-11 ใน FEATURE-LIST.md)
  function diseaseCellHtml(c) {
    if (c.status === "confirmed") {
      return '<span class="cell-primary">' + (c.diseaseName ? escapeHtml(c.diseaseName) : "-") + "</span>";
    }

    var optionsHtml = '<option value="">-- เลือกประเภทโรคติดต่อ --</option>' +
      DISEASE_TYPES.map(function (t) {
        var selected = (c.diseaseId === t.id) ? " selected" : "";
        return '<option value="' + escapeHtml(t.id) + '"' + selected + '>' + escapeHtml(t.name) + "</option>";
      }).join("");

    var selectHtml =
      '<select class="input-inline select-disease-type" data-id="' + c.id + '"' + (DISEASE_TYPES.length === 0 ? " disabled" : "") + ">" +
        optionsHtml +
      "</select>";

    var diagnoseDisabled = c._diagnoseLoading || !c.labResult;
    var btnLabel = c._diagnoseLoading ? "กำลังวิเคราะห์..." : "ให้ AI ช่วยจัด";
    var btnHtml =
      '<button type="button" class="btn btn-outline btn-sm btn-ai-diagnose" data-id="' + c.id + '" data-text="' + escapeHtml(c.labResult || "") + '"' +
      (diagnoseDisabled ? " disabled" : "") + ">" + btnLabel + "</button>";

    var resultHtml = "";
    if (c._diagnoseError) {
      resultHtml = '<div class="assist-result assist-result-error">' + escapeHtml(c._diagnoseError) + "</div>";
    } else if (c.aiSuggestion) {
      if (c.aiSuggestion.matched) {
        // ข้อความให้ตรงกับ label มาตรฐานเดียวกับ new-506-request.js (FEAT-ANALYSIS-08)
        resultHtml = '<div class="assist-result assist-result-ok">' + ICON_CHECK + "ข้อเสนอจาก AI — โปรดตรวจสอบก่อนยืนยัน: " + escapeHtml(c.aiSuggestion.diseaseName) +
          (c.aiSuggestion.reason ? " (" + escapeHtml(c.aiSuggestion.reason) + ")" : "") + "</div>";
      } else {
        resultHtml = '<div class="assist-result assist-result-concern">AI จัดหมวดหมู่ให้ไม่ได้' +
          (c.aiSuggestion.reason ? ": " + escapeHtml(c.aiSuggestion.reason) : "") + " กรุณาเลือกเอง</div>";
      }
    }

    return '<div class="geo-cell">' + selectHtml + btnHtml + "</div>" + resultHtml;
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
          '<a class="file-link" href="#" data-file="' + c.fileName + '" title="เปิดไฟล์ต้นฉบับใน Google Drive (จำลอง)">' +
            ICON_FILE + "ไฟล์ต้นฉบับ" +
          "</a>" +
        "</td>" +
        "<td>" + nameCellHtml(c, editing) + "</td>" +
        "<td>" + addressCellHtml(c, editing) + "</td>" +
        "<td>" + onsetCellHtml(c, editing) + "</td>" +
        "<td>" + labResultCellHtml(c, editing) + "</td>" +
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
      parts.push("<title>" + c.patientName + " (" + c.hn + ") — ต." + c.subdistrict + " อ." + c.district + " จ." + c.province + " · " + TEAMS[c.zone] + " · " + statusLabel + "</title>");
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
  // ปุ่ม "ยืนยัน" (.btn-confirm) เท่านั้น — ห้าม AI (case-intake-diagnose.js/case-intake-upload.js/
  // case-intake-assist.js) เรียก confirmCase() หรือแก้ c.status ตรงๆ เด็ดขาด ต้องรอคนกดยืนยันเสมอ
  function confirmCase(id) {
    var c = getCaseById(id);
    if (!c || c.status === "confirmed") return;

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
    c.latitude = undefined;
    c.longitude = undefined;
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
  function saveGeoCoordinates(id, lat, lng) {
    var c = getCaseById(id);
    if (!c) return;

    lat = parseFloat(lat);
    lng = parseFloat(lng);

    if (isNaN(lat) || isNaN(lng) || lat < 5.5 || lat > 21 || lng < 97 || lng > 106) {
      alert("กรุณากรอกละติจูดในช่วง 5.5–21 และลองจิจูดในช่วง 97–106 (พิกัดภายในประเทศไทย)");
      return;
    }

    c.latitude = lat;
    c.longitude = lng;
    var mapX = ((lng - 97) / (106 - 97)) * 100;
    var mapY = ((21 - lat) / (21 - 5.5)) * 100;
    c.mapX = Math.max(0, Math.min(100, mapX));
    c.mapY = Math.max(0, Math.min(100, mapY));
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
    var subdistrict = fields.subdistrict || "";
    var nextId = CASES.reduce(function (max, c) { return Math.max(max, c.id); }, 0) + 1;
    var now = new Date();

    var newCase = {
      id: nextId,
      fileName: detail.fileName,
      fileType: detail.fileType,
      fileSize: detail.fileSize,
      uploadedLabel: formatThaiDateTime(now),
      patientName: fields.patientName || "",
      hn: fields.hn || "",
      houseNo: fields.houseNo || "",
      villageNo: fields.villageNo || "",
      village: fields.village || "",
      subdistrict: subdistrict,
      district: fields.district || "",
      province: fields.province || "",
      onsetDate: fields.onsetDate || "",
      labResult: fields.labResult || "",
      diseaseId: null,
      diseaseName: null,
      // ตำบลไม่ตรงกับพื้นที่ที่ระบบรู้จัก (mock) -> เข้าทีมสอบสวนโรค เขต 1 เป็นค่าเริ่มต้นไปก่อน
      zone: SUBDISTRICT_TEAM_MAP.hasOwnProperty(subdistrict) ? SUBDISTRICT_TEAM_MAP[subdistrict] : 1,
      geoAccuracy: "low",
      geoAdjusted: false,
      status: "pending",
      mapX: 50, mapY: 50
    };
    newCase._originalMapX = newCase.mapX;
    newCase._originalMapY = newCase.mapY;
    newCase._editingGeo = false;

    CASES.unshift(newCase);
    renderUploadList();
    renderOCRTable();
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
    var newSubdistrict = null;
    inputs.forEach(function (input) {
      var field = input.getAttribute("data-field");
      var value = input.value.trim();
      c[field] = value;
      if (field === "subdistrict") newSubdistrict = value;
    });

    // Auto-route: if the corrected subdistrict matches a known area, reassign
    // the responsible team. Unknown subdistrict values keep the current team.
    if (newSubdistrict && SUBDISTRICT_TEAM_MAP.hasOwnProperty(newSubdistrict)) {
      c.zone = SUBDISTRICT_TEAM_MAP[newSubdistrict];
    }

    editingId = null;
    renderOCRTable();
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
        var latInput = document.getElementById("geo-lat-input-" + geoId);
        var lngInput = document.getElementById("geo-lng-input-" + geoId);
        saveGeoCoordinates(geoId, latInput ? latInput.value : "", lngInput ? lngInput.value : "");
        return;
      }
      var fileLink = e.target.closest(".file-link");
      if (fileLink) {
        e.preventDefault();
      }
    });

    // เลือกประเภทโรคติดต่อเองด้วยมือ (FEAT-INTAKE-11) — แก้ไข dropdown ได้เสมอ ไม่ว่าจะเคย
    // กด "ให้ AI ช่วยจัด" มาก่อนหรือไม่ (human-in-the-loop เดียวกับ FEAT-ANALYSIS-08)
    els.ocrTableBody.addEventListener("change", function (e) {
      var select = e.target.closest(".select-disease-type");
      if (!select) return;
      var c = getCaseById(parseInt(select.getAttribute("data-id"), 10));
      if (!c) return;
      var option = select.options[select.selectedIndex];
      c.diseaseId = select.value || null;
      c.diseaseName = select.value ? option.textContent : null;
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
    document.addEventListener("case-intake:assist-result", function (e) {
      var c = getCaseById(e.detail.id);
      if (!c) return;
      if (e.detail.loading) {
        c._assistLoading = true;
      } else {
        c._assistLoading = false;
        c._assistResult = e.detail.error
          ? { error: e.detail.error }
          : { status: e.detail.status, notes: e.detail.notes };
      }
      renderOCRTable();
    });
    // รายชื่อโรคติดต่อจริงจาก 506Types (FEAT-INTAKE-11) — มาจาก case-intake-diagnose.js
    document.addEventListener("case-intake:disease-types", function (e) {
      DISEASE_TYPES = e.detail.types || [];
      renderOCRTable();
    });
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
