// OCR เอกสารรายงานผู้ป่วยในเบราว์เซอร์ (FEAT-INTAKE-05, ทางเลือกฟรี) — ไม่ใช้ Cloud Function/Blaze/คีย์ AI
// อ่านไฟล์บนเครื่องผู้ใช้ด้วย Tesseract.js (ภาษาไทย+อังกฤษ) ไฟล์/ข้อมูลผู้ป่วยไม่ถูกส่งออกนอกเครื่อง
// PDF แปลงเป็นรูปด้วย pdf.js ก่อน แล้วแยกช่องข้อมูลจากข้อความด้วย parseCaseReportText()
// Tesseract อ่านลายมือไทยได้ไม่ดี — ผลลัพธ์ต้องให้เจ้าหน้าที่ตรวจ/แก้ในตาราง OCR Review เสมอ (human-in-the-loop)

const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js";
const PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
const MAX_PDF_PAGES = 3;
const PDF_RENDER_SCALE = 2.5;

const THAI = "\\u0E00-\\u0E7F";
const NUM = "[\\d\\u0E50-\\u0E59]";

// label -> ช่องข้อมูล
const LABELS = [
  { key: "patientName", words: ["ชื่อ-สกุล", "ชื่อ-นามสกุล", "ชื่อผู้ป่วย", "ชื่อสกุล", "ชื่อ"] },
  { key: "nationalId", words: ["เลขประจำตัวประชาชน", "เลขบัตรประชาชน", "เลขประชาชน", "บัตรประชาชน", "CID"] },
  { key: "hn", words: ["HN", "H.N.", "เลขที่ผู้ป่วย", "เลขประจำตัวผู้ป่วย"] },
  { key: "address", words: ["ที่อยู่ขณะป่วย", "ที่อยู่ขณะเริ่มป่วย", "ที่อยู่ปัจจุบัน", "ที่อยู่", "ที่พักอาศัย"] },
  { key: "houseNo", words: ["บ้านเลขที่"] },
  { key: "villageNo", words: ["หมู่ที่", "หมู่"] },
  { key: "village", words: ["หมู่บ้าน", "ชุมชน", "บ้าน"] },
  { key: "subdistrict", words: ["ตำบล", "แขวง", "ต."] },
  { key: "district", words: ["อำเภอ", "เขต", "อ."] },
  { key: "province", words: ["จังหวัด", "จ."] },
  { key: "onsetDate", words: ["วันที่เริ่มป่วย", "วันเริ่มป่วย", "เริ่มป่วย", "วันที่ป่วย"] },
  { key: "labResult", words: ["ผลการตรวจ", "ผลตรวจ", "ผลแลป", "ผลlab", "การวินิจฉัย", "วินิจฉัย", "โรค"] }
];

// วรรณยุกต์/สระบน-ล่าง/ทัณฑฆาต — Tesseract มักทำหาย/สลับ (เช่น "เลขที่"->"เลขที", "ที่"->"ทิ")
// จึงจับคู่ label บนข้อความที่ตัดตัวอักษรเหล่านี้ออก (folded) แล้วแปลงตำแหน่งกลับไปตัดค่าจากข้อความเดิม
const FOLD_CHARS = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/;

function foldWithMap(s) {
  let folded = "";
  const map = [];
  for (let i = 0; i < s.length; i++) {
    if (FOLD_CHARS.test(s[i])) continue;
    folded += s[i];
    map.push(i);
  }
  return { folded: folded, map: map };
}

function foldLabel(word) {
  return Array.from(word).filter(function (ch) { return !FOLD_CHARS.test(ch); }).join("");
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function labelPattern(word) {
  const w = foldLabel(word);
  const flexible = Array.from(w).map(escapeRegex).join("\\s*");
  const shortOrLatin = w.length <= 2 || !/[\u0E00-\u0E7F]/.test(w[0]);
  // label ตัวย่อ/ภาษาอังกฤษต้องไม่ติดกับตัวอักษรข้างหน้า (กัน "ต." ไปจับกลางคำ)
  const guard = shortOrLatin ? "(?<![" + THAI + "A-Za-z])" : "";
  return guard + flexible + "\\s*[:\\uFF1A]?";
}

// Tesseract ไทยบางครั้งแทรกช่องว่างทุกตัวอักษร ("ส ม ช า ย") — รวมกลับเมื่อมี token สั้น 1-2 ตัวอักษรติดกัน ≥4
function joinSpacedThai(v) {
  return v.replace(/(?:^|\s)((?:[\u0E00-\u0E7F]{1,2}\s+){3,}[\u0E00-\u0E7F]{1,2})(?=\s|$)/g, function (m, g) {
    return (m.charAt(0) === " " ? " " : "") + g.replace(/\s+/g, "");
  });
}

function cleanValue(v) {
  return joinSpacedThai(v)
    .replace(/^[\s:\uFF1A.\-_\u2013\u2014|]+/, "")
    .replace(/[\s:\uFF1A.\-_\u2013\u2014|]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toArabicDigits(s) {
  return s.replace(/[\u0E50-\u0E59]/g, function (d) { return String(d.charCodeAt(0) - 0x0E50); });
}

// ข้อความอ่านออกจริงไหม: มีตัวอักษรไทย/อังกฤษพอ และไม่ใช่สัญลักษณ์ปนเกินครึ่ง
function isReadable(value, minLetters) {
  const letters = (String(value || "").match(/[\u0E01-\u0E39\u0E40-\u0E4C]|[A-Za-z]/g) || []).length;
  const visible = String(value || "").replace(/\s/g, "").length;
  return letters >= minLetters && letters / Math.max(visible, 1) >= 0.6;
}

// แยกช่องข้อมูลจากข้อความ OCR — เป็นฟังก์ชันล้วน ทดสอบแยกได้ (ไม่แตะ DOM)
export function parseCaseReportText(rawText) {
  // Tesseract ไทยมักคืนสระอำเป็น นิคหิต+สระา (U+0E4D U+0E32) แยกตัว — รวมกลับเป็นสระอำ (U+0E33)
  const text = String(rawText || "").replace(/\r/g, "").replace(/\u0E4D\u0E32/g, "\u0E33");
  const fields = {
    patientName: "", nationalId: "", hn: "", address: "", houseNo: "", villageNo: "", village: "",
    subdistrict: "", district: "", province: "", onsetDate: "", labResult: "", coordinates: ""
  };
  let addressOpen = false; // บรรทัดถัดไปที่ไม่มี label ถือเป็นส่วนต่อของที่อยู่

  text.split("\n").forEach(function (line) {
    if (!line.trim()) return;
    const fm = foldWithMap(line);
    const hits = [];
    LABELS.forEach(function (l) {
      l.words.forEach(function (w) {
        const re = new RegExp(labelPattern(w), "gi");
        let m;
        while ((m = re.exec(fm.folded)) !== null) {
          if (m[0].length === 0) { re.lastIndex++; continue; }
          const start = fm.map[m.index];
          const end = fm.map[m.index + m[0].length - 1] + 1;
          hits.push({ key: l.key, word: w, start: start, end: end });
        }
      });
    });
    // บรรทัด "ชื่อบิดา/มารดา/ผู้ปกครอง/ผู้รายงาน" ไม่ใช่ชื่อผู้ป่วย — ตัด label ชื่อออกจากบรรทัดนั้น
    if (/บิดา|มารดา|ผู้ปกครอง|ผู้รายงาน/.test(line)) {
      for (let k = hits.length - 1; k >= 0; k--) if (hits[k].key === "patientName") hits.splice(k, 1);
    }
    // เก็บ label ที่ยาวกว่า/เริ่มก่อนเมื่อทับกัน (เช่น "ชื่อ-สกุล" ชนะ "ชื่อ", "บ้านเลขที่" ชนะ "บ้าน")
    hits.sort(function (a, b) { return a.start - b.start || (b.end - b.start) - (a.end - a.start); });
    const picked = [];
    hits.forEach(function (h) {
      const last = picked[picked.length - 1];
      if (last && h.start < last.end) return;
      picked.push(h);
    });
    if (picked.length === 0) {
      if (addressOpen && fields.address) fields.address = cleanValue(fields.address + " " + line);
      return;
    }
    addressOpen = false;
    picked.forEach(function (h, i) {
      if (fields[h.key]) return; // เจอ label เดิมซ้ำ ใช้ค่าแรก
      // ที่อยู่เอาทั้งบรรทัด (รวม ต./อ./จ. ที่อยู่ในบรรทัดเดียวกัน)
      const stop = h.key === "address" ? line.length : (i + 1 < picked.length ? picked[i + 1].start : line.length);
      let value = cleanValue(line.slice(h.end, stop));
      if (value && h.key === "village" && h.word === "บ้าน") value = "บ้าน" + value;
      if (value) fields[h.key] = value;
      if (h.key === "address" && value) addressOpen = true;
    });
  });

  fields.hn = (fields.hn.match(/[A-Za-z0-9\u0E50-\u0E59][A-Za-z0-9\u0E50-\u0E59\-\/.]*/) || [""])[0].replace(/[.\-\/]+$/, "");
  fields.villageNo = (fields.villageNo.match(new RegExp(NUM + "+")) || [""])[0];
  fields.houseNo = (fields.houseNo.match(new RegExp(NUM + "[\\d\\u0E50-\\u0E59\\/\\-]*")) || [""])[0];

  // ค่าที่ OCR อ่านเป็นขยะ (ลายมือ) ให้ทิ้งเป็นค่าว่าง ดีกว่าเดาใส่ให้เจ้าหน้าที่เข้าใจผิด
  if (!isReadable(fields.patientName, 4)) fields.patientName = "";
  if (!isReadable(fields.address, 6)) fields.address = "";

  // เลขประจำตัวประชาชน 13 หลัก — ใช้ค่าจาก label ก่อน ไม่เจอค่อยหาจากทั้งข้อความ (รูปแบบ x-xxxx-xxxxx-xx-x)
  const digitsText = toArabicDigits(text);
  const idFromLabel = toArabicDigits(fields.nationalId).replace(/\D/g, "");
  const idMatch = digitsText.match(/(?<!\d)\d[\s-]?\d{4}[\s-]?\d{5}[\s-]?\d{2}[\s-]?\d(?!\d)/);
  fields.nationalId = idFromLabel.length === 13 ? idFromLabel : (idMatch ? idMatch[0].replace(/\D/g, "") : idFromLabel);

  // พิกัด "ละติจูด, ลองจิจูด" ถ้ามีในเอกสาร (เช่น 19.8963, 99.8280) — ฟอร์ม รง.506 มาตรฐานไม่มีช่องนี้ ส่วนใหญ่จึงเว้นว่างให้กรอกเอง
  const coordMatch = digitsText.match(/(?<!\d)(\d{1,2}\.\d{3,})\s*[,;\/]?\s*(\d{2,3}\.\d{3,})(?!\d)/);
  fields.coordinates = coordMatch ? coordMatch[1] + ", " + coordMatch[2] : "";

  // ที่อยู่: ถ้าไม่เจอ label "ที่อยู่" ให้ประกอบจากช่อง บ้านเลขที่/หมู่/หมู่บ้าน/ตำบล/อำเภอ/จังหวัด
  if (!fields.address) {
    fields.address = [
      fields.houseNo && "บ้านเลขที่ " + fields.houseNo,
      fields.villageNo && "หมู่ " + fields.villageNo,
      fields.village,
      fields.subdistrict && "ต." + fields.subdistrict,
      fields.district && "อ." + fields.district,
      fields.province && "จ." + fields.province
    ].filter(Boolean).join(" ");
  }

  // วันที่เริ่มป่วย: รูปแบบ 15/08/2569 หรือ 19 ส.ค. 2569 — คงรูปแบบตามเอกสาร แปลงเฉพาะเลขไทยเป็นเลขอารบิก
  const dateRe = new RegExp(NUM + "{1,2}\\s*(?:[\\/\\-.]\\s*" + NUM + "{1,2}\\s*[\\/\\-.]|\\s*[" + THAI + ".]{2,12}\\s*)\\s*" + NUM + "{2,4}");
  const dateMatch = fields.onsetDate.match(dateRe);
  fields.onsetDate = dateMatch ? toArabicDigits(cleanValue(dateMatch[0])) : "";

  return fields;
}

let tesseractWorkerPromise = null;
let progressListener = null;

function getWorker() {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = import(TESSERACT_URL).then(function (mod) {
      const Tesseract = mod.default || mod;
      return Tesseract.createWorker("tha+eng", 1, {
        logger: function (m) { if (progressListener) progressListener(m); }
      });
    }).catch(function (err) {
      tesseractWorkerPromise = null;
      throw new Error("โหลดโมดูล OCR ไม่สำเร็จ (ต้องมีอินเทอร์เน็ตครั้งแรก): " + (err && err.message ? err.message : err));
    });
  }
  return tesseractWorkerPromise;
}

async function pdfToCanvases(file) {
  const pdfjs = await import(PDFJS_URL);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: data }).promise;
  const canvases = [];
  const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
}

// onProgress(message) รับข้อความสถานะภาษาไทยสำหรับแสดงผู้ใช้
export async function extractCaseReportLocal(file, onProgress) {
  const report = onProgress || function () {};
  report("กำลังโหลดโมดูล OCR ภาษาไทย (ครั้งแรกอาจใช้เวลาสักครู่)...");
  const worker = await getWorker();

  let inputs;
  if (file.type === "application/pdf") {
    report("กำลังแปลงหน้า PDF เป็นรูปภาพ...");
    inputs = await pdfToCanvases(file);
  } else {
    inputs = [file];
  }

  const texts = [];
  for (let i = 0; i < inputs.length; i++) {
    progressListener = function (m) {
      if (m.status === "recognizing text") {
        report("กำลังอ่านข้อความ" + (inputs.length > 1 ? " หน้า " + (i + 1) + "/" + inputs.length : "") + " " + Math.round((m.progress || 0) * 100) + "%");
      }
    };
    const result = await worker.recognize(inputs[i]);
    texts.push(result.data.text || "");
  }
  progressListener = null;

  const text = texts.join("\n");
  if (!text.replace(/\s/g, "")) {
    throw new Error("อ่านข้อความจากเอกสารไม่ได้ กรุณาตรวจสอบว่าไฟล์ชัดเจน หรือกรอกข้อมูลด้วยมือแทน");
  }
  return { fields: parseCaseReportText(text), text: text };
}
