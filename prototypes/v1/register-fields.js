/* =========================================================
   AI-DSRP — นิยามช่องตาม "ทะเบียนผู้ป่วย" ของหน่วยงาน (58 คอลัมน์ในชีต) + ตารางรหัสอ้างอิง
   ใช้ร่วมกันโดย case-intake.js (ฟอร์มใน OCR Review) และ case-intake-sheet.js (ฟอร์มแก้ไขจากตารางชีต)
   key ต้องตรงกับ key ใน apps-script/case-sheet/Code.gs — ชื่อ label ตรงกับหัวคอลัมน์ในชีต
   classic script (ไม่ใช่ module) → window.AidsrpRegister
   ========================================================= */
(function () {
  "use strict";

  /* ---------- ตารางรหัสอ้างอิง (จากชีตอ้างอิงของหน่วยงาน) ---------- */
  var SEX = [{ code: "1", name: "ชาย" }, { code: "2", name: "หญิง" }];

  var OCCUPATIONS = [
    "เกษตร", "ข้าราชการ", "รับจ้าง", "ค้าขาย", "งานบ้าน", "นักเรียน", "ทหารและตำรวจ", "ประมง", "ครู",
    "อื่นๆ", "ในปกครอง", "เลี้ยงสัตว์", "นักบวช", "อาชีพพิเศษ", "บุคลากรสาธารณสุข", "พนักงานราชการ", "พนักงานบริษัท"
  ].map(function (name, i) { return { code: String(i + 1), name: name }; });

  var HOSPITALS = [
    ["57010110", "รพ.เชียงรายประชานุเคราะห์"], ["57010120", "รพ.เกษมราษฎร์ศรีบุรินทร์"], ["57010130", "รพ.โอเวอร์บรุ๊ค"],
    ["57010140", "รพ.ค่ายเม็งรายมหาราช"], ["57010150", "รพ.ศูนย์การแพทย์มหาวิทยาลัยแม่ฟ้าหลวง"],
    ["57010170", "รพ.เชียงราย ราม"], ["57010180", "รพ.กรุงเทพเชียงราย"], ["57020100", "รพ.สมเด็จพระญาณสังวร"],
    ["57030100", "รพ.สมเด็จพระยุพราชเชียงของ"], ["57040100", "รพ.เทิง"], ["57050100", "รพ.พาน"], ["57060100", "รพ.ป่าแดด"],
    ["57070100", "รพ.แม่จัน"], ["57080100", "รพ.เชียงแสน"], ["57090100", "รพ.แม่สาย"], ["57100100", "รพ.แม่สรวย"],
    ["57110100", "รพ.เวียงป่าเป้า"], ["57120100", "รพ.พญาเม็งราย"], ["57130100", "รพ.เวียงแก่น"], ["57140100", "รพ.ขุนตาล"],
    ["57150100", "รพ.แม่ฟ้าหลวง"], ["57160100", "รพ.แม่ลาว"], ["57170100", "รพ.เวียงเชียงรุ้ง"], ["57180100", "รพ.ดอยหลวง"]
  ].map(function (h) { return { code: h[0], name: h[1] }; });

  var ILLNESS_CAUSES = [
    "รายใหม่ ไม่อยู่ในรัศมีเกิน 100 เมตรเดิม", "บ้านหลังเดียวกันกับผู้ป่วยเดิม", "ในรัศมี 100 เมตรของบ้านผู้ป่วยเดิม",
    "เริ่มป่วยจากนอกพื้นที่", "ป่วยจากทีทำงาน/เรียนที่เดียวกันกับผู้ป่วยไข้เลือดออก"
  ].map(function (name, i) { return { code: String(i + 1), name: name }; });

  // DX. ตามชีตอ้างอิง: รหัสโรคไข้เลือดออก -> ชื่อย่อ (โรคอื่นใช้ชื่อโรคเต็ม)
  var DX_SHORT = { "26": "DHF", "27": "DSS", "66": "DF" };

  function nameOf(list, code) {
    for (var i = 0; i < list.length; i++) if (list[i].code === String(code)) return list[i].name;
    return "";
  }
  function codeOf(list, name) {
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i].code;
    return "";
  }

  /* ---------- วันที่ไทย / สัปดาห์ระบาดวิทยา ---------- */
  var THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  var THAI_MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

  function pad2(n) { return n < 10 ? "0" + n : String(n); }

  // "15/07/2569" หรือ "14 ส.ค. 2569" -> Date (ค.ศ.), อ่านไม่ได้ -> null
  function parseThaiDate(text) {
    var t = String(text || "").trim();
    var d, m, y, match = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      d = +match[1]; m = +match[2] - 1; y = +match[3];
    } else {
      match = t.match(/^(\d{1,2})\s*(\S+?)\s*(\d{4})$/);
      if (!match || THAI_MONTHS_SHORT.indexOf(match[2]) === -1) return null;
      d = +match[1]; m = THAI_MONTHS_SHORT.indexOf(match[2]); y = +match[3];
    }
    if (y > 2400) y -= 543; // พ.ศ. -> ค.ศ.
    var date = new Date(y, m, d);
    return date.getMonth() === m && date.getDate() === d ? date : null;
  }

  function formatThaiShortDate(date) {
    return pad2(date.getDate()) + "/" + pad2(date.getMonth() + 1) + "/" + (date.getFullYear() + 543);
  }

  // สัปดาห์ระบาดวิทยา (แบบ MMWR): สัปดาห์เริ่มวันอาทิตย์ สัปดาห์ที่ 1 = สัปดาห์แรกที่มีวันในปีนั้นอย่างน้อย 4 วัน
  function epiWeekStart(year) {
    var dow = new Date(year, 0, 1).getDay();
    return new Date(year, 0, 1 - dow + (dow > 3 ? 7 : 0));
  }

  function epiWeek(date) {
    var y = date.getFullYear();
    var start = epiWeekStart(y);
    if (date < start) start = epiWeekStart(y - 1);
    else if (date >= epiWeekStart(y + 1)) start = epiWeekStart(y + 1);
    return Math.floor(Math.round((date - start) / 86400000) / 7) + 1;
  }

  // วันที่ในช่องทะเบียนให้อยู่รูป วว/ดด/ปปปป (พ.ศ.) เสมอ — อ่านไม่ได้คงข้อความเดิม
  function normalizeDate(text) {
    var d = parseThaiDate(text);
    return d ? formatThaiShortDate(d) : String(text || "").trim();
  }

  /* ---------- นิยามช่อง ----------
     main: ช่องที่มีอยู่แล้วในตาราง OCR Review (ฟอร์มรายละเอียดใน OCR Review ไม่แสดงซ้ำ)
     auto: ระบบคำนวณให้ (แสดงแบบอ่านอย่างเดียว) · system: ระบบใส่เอง ไม่ให้แก้ */
  var GROUPS = [
    { title: "ข้อมูลผู้ป่วย", fields: [
      { key: "seq", label: "ลำดับ", system: true },
      { key: "month", label: "เดือน", auto: true },
      { key: "epiWeek", label: "สัปดาห์ที่", auto: true },
      { key: "patientName", label: "ชื่อ-สกุล", main: true },
      { key: "nationalId", label: "เลขบัตร ปชช.", main: true },
      { key: "phone", label: "เบอร์โทร" },
      { key: "gender", label: "เพศ", type: "select", options: SEX },
      { key: "sexCode", label: "sex", auto: true },
      { key: "age", label: "อายุ", type: "number" },
      { key: "ageGroup", label: "กลุ่มอายุ", auto: true },
      { key: "occupation", label: "อาชีพ", type: "select", options: OCCUPATIONS },
      { key: "occupationCode", label: "OCCUPAT", auto: true },
      { key: "receivedDate", label: "วันที่รับแจ้ง", system: true }
    ] },
    { title: "ที่อยู่ / ที่ทำงาน", fields: [
      { key: "homeCoords", label: "พิกัด ละติจูด ลองติจูด (ที่อยู่)", main: true },
      { key: "homeCommunity", label: "ชุมชน (ที่อยู่)" },
      { key: "address", label: "ที่อยู่", main: true, wide: true },
      { key: "subdistrict", label: "ตำบล (ที่อยู่)", main: true },
      { key: "workCoords", label: "พิกัด ละติจูด ลองติจูด (ทำงาน)", placeholder: "เช่น 19.9071, 99.8325" },
      { key: "workCommunity", label: "ชุมชน (ที่ทำงาน)" },
      { key: "workplace", label: "สถานที่ทำงาน/เรียน" },
      { key: "workSubdistrict", label: "ตำบล (ทำงาน/เรียน)" }
    ] },
    { title: "การป่วย / การรักษา", fields: [
      { key: "onsetDate", label: "วันที่เริ่มป่วย", main: true, type: "date" },
      { key: "foundDate", label: "วันพบผู้ป่วย", type: "date" },
      { key: "hospital", label: "สถานที่รักษา", type: "select", options: HOSPITALS, wide: true },
      { key: "hospitalCode", label: "Hospi", auto: true },
      { key: "diseaseId", label: "รหัสโรค", main: true, type: "disease" },
      { key: "diseaseName", label: "DX.", auto: true },
      { key: "wbc", label: "WBC", type: "number" },
      { key: "hb", label: "Hb", type: "number" },
      { key: "hct", label: "Hct", type: "number" },
      { key: "plt", label: "Plt", type: "number" },
      { key: "causeCode", label: "สาเหตุการป่วย 14 วัน", type: "select", options: ILLNESS_CAUSES, showCode: true, wide: true },
      { key: "causeText", label: "ป่วยจาก", auto: true, wide: true }
    ] },
    { title: "การควบคุมโรค", fields: [
      { key: "controlSites", label: "ควบคุมโรค (แห่ง)", type: "number" },
      { key: "controlDate", label: "วันที่ควบคุมโรค", type: "date" },
      { key: "day0", label: "วันที่ 0", type: "date" }, { key: "hi0", label: "HI-0", type: "number" }, { key: "ci0", label: "CI-0", type: "number" },
      { key: "day1", label: "วันที่ 1", type: "date" }, { key: "hi1", label: "HI-1", type: "number" }, { key: "ci1", label: "CI-1", type: "number" },
      { key: "day3", label: "วันที่ 3", type: "date" }, { key: "hi3", label: "HI-3", type: "number" }, { key: "ci3", label: "CI-3", type: "number" },
      { key: "day7", label: "วันที่ 7", type: "date" }, { key: "hi7", label: "HI-7", type: "number" }, { key: "ci7", label: "CI-7", type: "number" },
      { key: "controlStandard", label: "มาตรฐานการควบคุมโรค (Day1)" },
      { key: "controlResult", label: "การควบคุมโรค", wide: true }
    ] },
    { title: "น้ำมัน / สารเคมี", fields: [
      { key: "diesel1", label: "1. ดีเซล (ลิตร)", type: "number" },
      { key: "gas1", label: "1. แก๊สฯ 95 (ลิตร)", type: "number" },
      { key: "chem1", label: "1. น้ำยาเคมี (ml)", type: "number" },
      { key: "diesel2", label: "2. ดีเซล (ลิตร)", type: "number" },
      { key: "gas2", label: "2. แก๊สฯ 95 (ลิตร)", type: "number" },
      { key: "chem2", label: "2. น้ำยาเคมี (ml)", type: "number" },
      { key: "dieselTotal", label: "รวมดีเซล (ลิตร)", auto: true },
      { key: "gasTotal", label: "รวมแก๊สฯ 95 (ลิตร)", auto: true },
      { key: "chemTotal", label: "รวมน้ำยาเคมี (ml)", auto: true }
    ] }
  ];

  var DATE_KEYS = [];
  GROUPS.forEach(function (g) { g.fields.forEach(function (f) { if (f.type === "date") DATE_KEYS.push(f.key); }); });

  // กลุ่มอายุตามสูตรในชีตของหน่วยงาน (IFS: <=4 "0-4", <=14 "05-14", ... <=110 "65 ปี ขึ้นไป")
  var AGE_GROUPS = [[4, "0-4"], [14, "05-14"], [24, "15-24"], [34, "25-34"], [44, "35-44"], [54, "45-54"], [64, "55-64"], [110, "65 ปี ขึ้นไป"]];
  function ageGroupOf(age) {
    var n = parseFloat(age);
    if (String(age == null ? "" : age).trim() === "" || isNaN(n)) return "";
    for (var i = 0; i < AGE_GROUPS.length; i++) if (n <= AGE_GROUPS[i][0]) return AGE_GROUPS[i][1];
    return "";
  }

  function sum(a, b) {
    var x = parseFloat(a), y = parseFloat(b);
    if (isNaN(x) && isNaN(y)) return "";
    return String(Math.round(((isNaN(x) ? 0 : x) + (isNaN(y) ? 0 : y)) * 100) / 100);
  }

  // คำนวณช่อง auto จากค่าที่กรอก — คืน object ใหม่ (ไม่แก้ของเดิม)
  function compute(values, diseaseNameById) {
    var v = Object.assign({}, values);
    DATE_KEYS.forEach(function (k) { if (v[k]) v[k] = normalizeDate(v[k]); });
    var onset = parseThaiDate(v.onsetDate);
    v.month = onset ? THAI_MONTHS_FULL[onset.getMonth()] : "";
    v.epiWeek = onset ? String(epiWeek(onset)) : "";
    v.sexCode = codeOf(SEX, v.gender);
    v.ageGroup = ageGroupOf(v.age);
    v.occupationCode = codeOf(OCCUPATIONS, v.occupation);
    v.hospitalCode = codeOf(HOSPITALS, v.hospital);
    v.causeText = nameOf(ILLNESS_CAUSES, v.causeCode);
    v.diseaseName = v.diseaseId ? (DX_SHORT[v.diseaseId] || (diseaseNameById ? diseaseNameById(v.diseaseId) : "")) : "";
    v.dieselTotal = sum(v.diesel1, v.diesel2);
    v.gasTotal = sum(v.gas1, v.gas2);
    v.chemTotal = sum(v.chem1, v.chem2);
    return v;
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ฟอร์มกรอกครบตามทะเบียน — opts.includeMain: แสดงช่องหลักด้วย (ฟอร์มแก้ไขจากชีต), opts.diseases: [{id,name}]
  function renderForm(values, opts) {
    opts = opts || {};
    var v = values || {};
    return '<div class="register-form">' + GROUPS.map(function (g) {
      var fields = g.fields.filter(function (f) { return opts.includeMain || !f.main; });
      return '<fieldset class="register-group"><legend>' + esc(g.title) + "</legend><div class=\"register-grid\">" +
        fields.map(function (f) {
          var id = "reg-" + (opts.idPrefix || "") + f.key;
          var input;
          if (f.auto || f.system) {
            input = '<input type="text" id="' + id + '" data-reg-auto="' + f.key + '" value="' + esc(v[f.key]) + '" readonly tabindex="-1">';
          } else if (f.type === "select" || f.type === "disease") {
            var options = f.type === "disease"
              ? (opts.diseases || []).map(function (d) { return { value: d.id, text: d.id + " " + d.name }; })
              : f.options.map(function (o) { return { value: f.showCode ? o.code : o.name, text: f.showCode ? o.code + " " + o.name : o.name }; });
            input = '<select id="' + id + '" data-reg="' + f.key + '"><option value="">-- เลือก --</option>' +
              options.map(function (o) {
                return '<option value="' + esc(o.value) + '"' + (String(v[f.key]) === o.value ? " selected" : "") + ">" + esc(o.text) + "</option>";
              }).join("") + "</select>";
          } else {
            var ph = f.placeholder || (f.type === "date" ? "วว/ดด/ปปปป (พ.ศ.)" : "");
            input = '<input type="text" id="' + id + '" data-reg="' + f.key + '" value="' + esc(v[f.key]) + '"' +
              (f.type === "number" ? ' inputmode="decimal"' : "") + (ph ? ' placeholder="' + esc(ph) + '"' : "") + ">";
          }
          return '<div class="form-field' + (f.wide ? " register-wide" : "") + (f.auto || f.system ? " register-auto" : "") + '">' +
            '<label for="' + id + '">' + esc(f.label) + (f.auto ? " (คำนวณให้)" : "") + "</label>" + input + "</div>";
        }).join("") + "</div></fieldset>";
    }).join("") + "</div>";
  }

  // อ่านค่าที่กรอกในฟอร์ม (เฉพาะช่องที่แก้ได้)
  function readForm(container) {
    var out = {};
    container.querySelectorAll("[data-reg]").forEach(function (el) { out[el.getAttribute("data-reg")] = el.value.trim(); });
    return out;
  }

  // ผูกการคำนวณสด: แก้ช่องไหน ช่อง auto อัปเดตทันที — base = ค่าเดิมของแถว (สำหรับช่องที่ไม่ได้อยู่ในฟอร์ม เช่น วันเริ่มป่วย)
  function bindCompute(container, base, diseaseNameById) {
    var update = function () {
      var v = compute(Object.assign({}, base || {}, readForm(container)), diseaseNameById);
      container.querySelectorAll("[data-reg-auto]").forEach(function (el) {
        var k = el.getAttribute("data-reg-auto");
        if (v[k] !== undefined && k !== "seq" && k !== "receivedDate") el.value = v[k];
      });
    };
    container.addEventListener("input", update);
    container.addEventListener("change", update);
    update();
    fitToScrollArea(container);
  }

  // แถวฟอร์มอยู่ในตารางกว้าง (.table-scroll) — ให้ฟอร์มกว้างเท่าส่วนที่มองเห็นของกล่องเลื่อน
  function fitToScrollArea(row) {
    var scroller = row.closest(".table-scroll");
    if (!scroller) return;
    var fit = function () { row.style.setProperty("--register-w", Math.max(scroller.clientWidth - 48, 260) + "px"); };
    fit();
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(fit).observe(scroller);
  }

  // key ทั้งหมดที่ผู้ใช้แก้ได้ (ไม่รวม auto/system) — ใช้ส่งไปชีตแบบเขียนทับทุกช่องจากฟอร์มแก้ไข
  var EDITABLE_KEYS = [];
  GROUPS.forEach(function (g) { g.fields.forEach(function (f) { if (!f.auto && !f.system) EDITABLE_KEYS.push(f.key); }); });

  window.AidsrpRegister = {
    SEX: SEX, OCCUPATIONS: OCCUPATIONS, HOSPITALS: HOSPITALS, ILLNESS_CAUSES: ILLNESS_CAUSES, GROUPS: GROUPS,
    EDITABLE_KEYS: EDITABLE_KEYS,
    parseThaiDate: parseThaiDate, formatThaiShortDate: formatThaiShortDate, epiWeek: epiWeek, normalizeDate: normalizeDate,
    compute: compute, ageGroupOf: ageGroupOf, renderForm: renderForm, readForm: readForm, bindCompute: bindCompute,
    codeOf: codeOf, nameOf: nameOf,
    diseases: [] // case-intake.js ใส่รายการโรค (DISEASE_TYPES) ให้ตอนโหลด
  };
})();
