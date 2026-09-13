// Cloud Functions — AI-DSRP (FEAT-INTAKE-05)
// extractCaseReport: รับไฟล์รายงานเคส (PDF/JPEG/PNG, base64) จากเจ้าหน้าที่ที่ login แล้ว
// ส่งให้ Claude Vision (Anthropic) อ่าน แล้วคืนข้อมูลโครงสร้าง (JSON) ให้เจ้าหน้าที่ตรวจสอบต่อ
// (human-in-the-loop) — ดู DETAILED-DESIGN.md Flow 1 และ TECH-STACK.md หัวข้อ 4.5

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const Anthropic = require("@anthropic-ai/sdk");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

const MAX_FILE_BYTES = 7 * 1024 * 1024; // ~7MB ไฟล์ต้นฉบับ (base64 พองขึ้น ~33% ต้องเหลือขอบใต้ payload limit ของ callable function)
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

const EXTRACT_TOOL = {
  name: "extract_case_report",
  description: "บันทึกข้อมูลที่ดึงได้จากเอกสารรายงานผู้ป่วยเฝ้าระวังโรคที่แนบมา",
  input_schema: {
    type: "object",
    properties: {
      patientName: { type: "string", description: "ชื่อ-นามสกุลผู้ป่วย ตามที่ปรากฏในเอกสาร" },
      hn: { type: "string", description: "หมายเลข HN (Hospital Number)" },
      houseNo: { type: "string", description: "บ้านเลขที่" },
      villageNo: { type: "string", description: "หมู่ที่" },
      village: { type: "string", description: "ชื่อหมู่บ้าน" },
      subdistrict: { type: "string", description: "ตำบล" },
      district: { type: "string", description: "อำเภอ" },
      province: { type: "string", description: "จังหวัด" },
      onsetDate: { type: "string", description: "วันที่เริ่มป่วย ตามรูปแบบที่ปรากฏในเอกสาร (ไม่ต้องแปลงรูปแบบ)" },
      labResult: { type: "string", description: "ผลตรวจทางห้องปฏิบัติการ/การวินิจฉัยโรค" }
    },
    required: ["patientName", "hn"]
  }
};

const EXTRACTION_PROMPT =
  "นี่คือเอกสารรายงานผู้ป่วยเฝ้าระวังโรค อาจเป็นแบบฟอร์มพิมพ์หรือเขียนมือภาษาไทยผสมกัน " +
  "ช่วยดึงข้อมูลตาม tool ที่กำหนดให้ครบเท่าที่อ่านได้ " +
  "ถ้าฟิลด์ใดอ่านไม่ออกหรือไม่มีในเอกสารให้เว้นว่างไว้ ห้ามเดา/สร้างข้อมูลที่ไม่มีในเอกสารขึ้นมาเอง";

exports.extractCaseReport = onCall({ secrets: [ANTHROPIC_API_KEY] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "ต้องเข้าสู่ระบบก่อนใช้งานฟังก์ชันนี้");
  }

  const { fileBase64, mimeType, fileName } = request.data || {};

  if (!fileBase64 || typeof fileBase64 !== "string") {
    throw new HttpsError("invalid-argument", "ไม่พบไฟล์ที่จะประมวลผล");
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new HttpsError("invalid-argument", "รองรับเฉพาะไฟล์ PDF, JPEG, PNG เท่านั้น");
  }
  const approxBytes = fileBase64.length * 0.75;
  if (approxBytes > MAX_FILE_BYTES) {
    throw new HttpsError("invalid-argument", "ไฟล์ใหญ่เกินไป (จำกัดไม่เกิน 7MB)");
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

  const documentBlock = mimeType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: mimeType, data: fileBase64 } }
    : { type: "image", source: { type: "base64", media_type: mimeType, data: fileBase64 } };

  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "extract_case_report" },
      messages: [
        {
          role: "user",
          content: [documentBlock, { type: "text", text: EXTRACTION_PROMPT }]
        }
      ]
    });
  } catch (err) {
    throw new HttpsError("internal", "เรียก OCR ไม่สำเร็จ: " + err.message);
  }

  const toolUse = response.content.find(function (block) { return block.type === "tool_use"; });
  if (!toolUse) {
    throw new HttpsError("internal", "ไม่สามารถดึงข้อมูลจากเอกสารได้ กรุณาตรวจสอบว่าไฟล์ชัดเจน หรือกรอกข้อมูลด้วยมือแทน");
  }

  return { fields: toolUse.input, fileName: fileName || null };
});

// assistCaseReview (FEAT-INTAKE-10) — รับข้อมูลที่ OCR ดึงได้แล้วของ 1 เคส (ข้อความล้วน
// ไม่ใช่ไฟล์) ให้ Claude ช่วยตรวจสอบความสมเหตุสมผลก่อนเจ้าหน้าที่กดยืนยัน — เป็น advisory
// เท่านั้น ไม่แก้ข้อมูลอัตโนมัติ (human-in-the-loop เหมือน flow อื่นในระบบ)

const REVIEW_TOOL = {
  name: "review_case_consistency",
  description: "บันทึกผลการตรวจสอบความสมเหตุสมผลของข้อมูลเคสผู้ป่วยเฝ้าระวังโรค",
  input_schema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["ok", "concern"], description: "'ok' ถ้าข้อมูลดูสมเหตุสมผลทั้งหมด, 'concern' ถ้ามีจุดที่น่าสงสัย" },
      notes: {
        type: "array",
        description: "รายการจุดที่น่าสงสัย (ว่างได้ถ้า status = 'ok')",
        items: {
          type: "object",
          properties: {
            field: { type: "string", description: "ชื่อ field ที่น่าสงสัย เช่น 'hn', 'subdistrict', 'onsetDate', 'labResult'" },
            issue: { type: "string", description: "อธิบายสั้นๆ ว่าน่าสงสัยตรงไหน" }
          },
          required: ["field", "issue"]
        }
      }
    },
    required: ["status", "notes"]
  }
};

const REVIEW_PROMPT =
  "นี่คือข้อมูลเคสผู้ป่วยเฝ้าระวังโรคที่ดึงมาจาก OCR/กรอกด้วยมือ ช่วยตรวจสอบความสมเหตุสมผลภายในของข้อมูล " +
  "เช่น รูปแบบ HN ผิดปกติไหม, ที่อยู่ (ตำบล/อำเภอ/จังหวัด) ดูสอดคล้องกันไหม, วันที่เริ่มป่วยดูสมเหตุสมผลไหม " +
  "(ไม่ใช่วันที่ในอนาคต/รูปแบบแปลกๆ), ชื่อโรค/ผลตรวจที่ระบุเป็นคำศัพท์ทางการแพทย์ที่มีอยู่จริงไหม " +
  "นี่เป็นการช่วยจับจุดที่อาจเป็นความผิดพลาดจาก OCR/การเขียนมือเท่านั้น ไม่ใช่การยืนยันข้อเท็จจริงกับฐานข้อมูลภายนอก " +
  "บันทึกผลผ่าน tool ที่กำหนด:\n\n";

exports.assistCaseReview = onCall({ secrets: [ANTHROPIC_API_KEY] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "ต้องเข้าสู่ระบบก่อนใช้งานฟังก์ชันนี้");
  }

  const fields = (request.data && request.data.fields) || null;
  if (!fields || typeof fields !== "object") {
    throw new HttpsError("invalid-argument", "ไม่พบข้อมูลเคสที่จะตรวจสอบ");
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      tools: [REVIEW_TOOL],
      tool_choice: { type: "tool", name: "review_case_consistency" },
      messages: [
        { role: "user", content: REVIEW_PROMPT + JSON.stringify(fields, null, 2) }
      ]
    });
  } catch (err) {
    throw new HttpsError("internal", "เรียก AI ไม่สำเร็จ: " + err.message);
  }

  const toolUse = response.content.find(function (block) { return block.type === "tool_use"; });
  if (!toolUse) {
    throw new HttpsError("internal", "ไม่สามารถประมวลผลได้ กรุณาลองใหม่อีกครั้ง");
  }

  return toolUse.input;
});

// suggestDiseaseType (FEAT-ANALYSIS-08, FEAT-INTAKE-11) — วิเคราะห์ข้อความที่เกี่ยวกับโรค
// แล้วเสนอ "โรคติดต่อ" ที่ตรงที่สุด — ต้องเป็นค่าที่มีอยู่จริงใน collection "506Types" เท่านั้น
// (ตรวจสอบซ้ำฝั่ง server เสมอ ไม่เชื่อผลจากโมเดลเฉยๆ) เป็น advisory: ผู้ใช้แก้ไข dropdown เองได้
// เสมอ และถ้าเรียกไม่สำเร็จ/จัดหมวดหมู่ไม่ได้ ก็ไม่แตะค่าเดิม ไม่บล็อกการบันทึกด้วยมือ
// รองรับ 2 รูปแบบ input: { title, reason } จากฟอร์ม รง.506 เดิม (FEAT-ANALYSIS-08) หรือ
// { clinicalText } จาก Case Intake OCR Review (FEAT-INTAKE-11) — เลือกอย่างใดอย่างหนึ่งก็พอ

const SUGGEST_DISEASE_TOOL = {
  name: "suggest_disease_type",
  description: "บันทึกผลการเลือกโรคติดต่อที่เหมาะสมที่สุดจากลิสต์ที่มีอยู่จริงเท่านั้น",
  input_schema: {
    type: "object",
    properties: {
      matched: { type: "boolean", description: "true ถ้าเลือกโรคที่ตรงได้จากลิสต์ที่ให้มา, false ถ้าไม่มีโรคไหนตรงเลย (จัดหมวดหมู่ไม่ได้)" },
      diseaseId: { type: "string", description: "id ของโรคที่เลือก ต้องตรงกับ id ในลิสต์ที่ให้มาเป๊ะ (ว่างไว้ถ้า matched=false)" },
      reason: { type: "string", description: "เหตุผลสั้นๆ ที่เลือก/ไม่เลือก" }
    },
    required: ["matched", "reason"]
  }
};

exports.suggestDiseaseType = onCall({ secrets: [ANTHROPIC_API_KEY] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "ต้องเข้าสู่ระบบก่อนใช้งานฟังก์ชันนี้");
  }

  const { title, reason, clinicalText } = request.data || {};
  const hasLegacyInput = title || reason;
  const hasClinicalText = clinicalText && typeof clinicalText === "string" && clinicalText.trim();
  if (!hasLegacyInput && !hasClinicalText) {
    throw new HttpsError("invalid-argument", "ไม่พบข้อความที่จะวิเคราะห์");
  }

  const typesSnap = await db.collection("506Types").get();
  const types = typesSnap.docs.map(function (d) { return { id: d.id, name: d.data().name }; });
  if (types.length === 0) {
    return { matched: false, diseaseId: null, diseaseName: null, reason: "ไม่มีข้อมูลโรคติดต่อในระบบให้เลือก" };
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

  const typesListText = types.map(function (t) { return "- " + t.id + ": " + t.name; }).join("\n");
  const contextText = hasClinicalText
    ? "ข้อมูลเคสผู้ป่วย (จาก OCR/กรอกด้วยมือ): " + clinicalText.trim()
    : "หัวเรื่องรายงาน: " + (title || "-") + "\nเหตุผล: " + (reason || "-");
  const prompt =
    "นี่คือรายชื่อโรคติดต่อที่มีอยู่จริงในระบบ (ต้องเลือกจากลิสต์นี้เท่านั้น ห้ามสร้างชื่อ/id ใหม่ขึ้นมาเอง):\n" +
    typesListText +
    "\n\n" + contextText +
    "\n\nช่วยเลือกโรคติดต่อที่ตรงที่สุดจากลิสต์ด้านบน ถ้าไม่มีโรคไหนตรงเลยให้ตอบว่าจัดหมวดหมู่ไม่ได้ (matched=false) บันทึกผลผ่าน tool ที่กำหนด";

  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 512,
      tools: [SUGGEST_DISEASE_TOOL],
      tool_choice: { type: "tool", name: "suggest_disease_type" },
      messages: [{ role: "user", content: prompt }]
    });
  } catch (err) {
    throw new HttpsError("internal", "เรียก AI ไม่สำเร็จ: " + err.message);
  }

  const toolUse = response.content.find(function (block) { return block.type === "tool_use"; });
  if (!toolUse) {
    throw new HttpsError("internal", "ไม่สามารถประมวลผลได้ กรุณาลองใหม่อีกครั้ง");
  }

  const result = toolUse.input;

  // ⭐ ตรวจสอบซ้ำฝั่ง server ว่า diseaseId ที่โมเดลเลือกมามีอยู่จริงในลิสต์ที่ดึงจาก Firestore
  // จริงๆ — ไม่เชื่อผลจาก tool-use เฉยๆ เพราะ prompt สั่งได้แต่ไม่ค้ำประกันว่าโมเดลจะทำตามเป๊ะเสมอ
  const matchedType = result.matched ? types.find(function (t) { return t.id === result.diseaseId; }) : null;

  if (!matchedType) {
    return { matched: false, diseaseId: null, diseaseName: null, reason: result.reason || "ไม่พบโรคที่ตรงกับข้อมูลที่กรอก" };
  }

  return { matched: true, diseaseId: matchedType.id, diseaseName: matchedType.name, reason: result.reason || "" };
});

// summarizeDiseaseTrend (FEAT-ANALYSIS-09) — เฉพาะหน้ารายละเอียด รง.506 (Manager เท่านั้นที่เห็น
// ปุ่มฝั่ง UI — ดู ACL.md) นับจำนวนรายงาน 506Requests ที่เป็นโรคเดียวกัน ในช่วง 7 วันย้อนหลัง
// จาก startDate ของรายงานนี้ (รวมตัวมันเอง) แล้วให้ Claude เขียนสรุปสั้นๆ เขียนกลับเข้า
// field ใหม่ aiSummary/aiSummaryGeneratedAt ผ่าน Admin SDK (ดู DATA-MODEL.md)

function addDaysToIsoDate(isoDateStr, days) {
  const d = new Date(isoDateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

exports.summarizeDiseaseTrend = onCall({ secrets: [ANTHROPIC_API_KEY] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "ต้องเข้าสู่ระบบก่อนใช้งานฟังก์ชันนี้");
  }

  const { reportId } = request.data || {};
  if (!reportId || typeof reportId !== "string") {
    throw new HttpsError("invalid-argument", "ไม่พบรหัสรายงานที่จะสรุป");
  }

  const reportRef = db.collection("506Requests").doc(reportId);
  const reportSnap = await reportRef.get();
  if (!reportSnap.exists) {
    throw new HttpsError("not-found", "ไม่พบรายงาน รง.506 นี้");
  }

  const report = reportSnap.data();
  const diseaseId = report.diseaseId;
  const diseaseName = report.diseaseName;
  const startDate = report.startDate;

  if (!diseaseId || !startDate) {
    throw new HttpsError("failed-precondition", "รายงานนี้ไม่มีข้อมูลโรคติดต่อ/วันที่เริ่มต้นให้สรุป");
  }

  // ช่วง 7 วัน = [startDate - 6 วัน, startDate] (รวมวันที่ startDate เอง)
  const windowStart = addDaysToIsoDate(startDate, -6);
  const windowEnd = startDate;

  const sameDiseaseSnap = await db.collection("506Requests").where("diseaseId", "==", diseaseId).get();
  const inWindowCount = sameDiseaseSnap.docs.filter(function (d) {
    const s = d.data().startDate;
    return typeof s === "string" && s >= windowStart && s <= windowEnd;
  }).length;

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

  const prompt =
    "โรคติดต่อ: " + diseaseName + "\n" +
    "ช่วงเวลา: " + windowStart + " ถึง " + windowEnd + " (7 วัน)\n" +
    "จำนวนรายงาน รง.506 ของโรคนี้ในช่วงเวลาดังกล่าว: " + inWindowCount + " รายการ\n\n" +
    "ช่วยเขียนสรุปสั้นๆ (2-3 ประโยค) ให้ผู้บริหาร (Manager) อ่านประกอบการพิจารณาอนุมัติรายงานนี้ " +
    "บอกจำนวนที่พบและช่วงเวลา ถ้าจำนวนดูมาก/น้อยผิดปกติให้ตั้งข้อสังเกตสั้นๆ " +
    "(ไม่ต้องฟันธงว่าเป็นการระบาดจริงหรือไม่ เพราะเป็นแค่การนับข้อมูลในระบบ ไม่ใช่การวิเคราะห์ทางระบาดวิทยาเต็มรูปแบบ) " +
    "ตอบเป็นข้อความล้วน ไม่ต้องมี markdown";

  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }]
    });
  } catch (err) {
    throw new HttpsError("internal", "เรียก AI ไม่สำเร็จ: " + err.message);
  }

  const textBlock = response.content.find(function (block) { return block.type === "text"; });
  const summaryText = textBlock
    ? textBlock.text.trim()
    : ("พบรายงาน " + diseaseName + " จำนวน " + inWindowCount + " รายการ ในช่วง " + windowStart + " ถึง " + windowEnd);

  const generatedAt = new Date().toISOString();

  // ⚠️ ห้ามเพิ่ม field "status" เข้าไปใน object นี้เด็ดขาด — สถานะรอพิจารณา/ยืนยัน/ไม่ยืนยัน
  // เปลี่ยนได้เฉพาะตอนคนกดปุ่มยืนยัน/ไม่ยืนยันเท่านั้น (ดู 506-request-detail.js/decide()
  // และ Business rule ของ SURVEILLANCE_REPORT_506_AI_LOG ใน DATA-MODEL.md)
  try {
    await reportRef.update({ aiSummary: summaryText, aiSummaryGeneratedAt: generatedAt });
  } catch (err) {
    throw new HttpsError("internal", "เขียนสรุปกลับลงฐานข้อมูลไม่สำเร็จ: " + err.message);
  }

  // audit log แบบ append-only ใต้ subcollection ของรายงานนี้ (ดู DATA-MODEL.md
  // SURVEILLANCE_REPORT_506_AI_LOG) — ไม่กระทบ field status ใดๆ ทั้งสิ้น
  try {
    await reportRef.collection("aiLog").add({
      type: "disease-trend",
      input: { diseaseId: diseaseId, diseaseName: diseaseName, startDate: startDate, windowStart: windowStart, windowEnd: windowEnd },
      output: { summary: summaryText, count: inWindowCount },
      createdAt: generatedAt
    });
  } catch (err) {
    // ไม่ throw ต่อ — เขียน aiSummary สำเร็จแล้วถือว่าฟีเจอร์หลักทำงานได้ การเขียน log ล้มเหลว
    // ไม่ควรทำให้ Manager เห็น error ทั้งที่ได้สรุปไปดูแล้วจริง
    console.error("เขียน aiLog (disease-trend) ไม่สำเร็จ:", err.message);
  }

  return { aiSummary: summaryText, aiSummaryGeneratedAt: generatedAt, count: inWindowCount };
});
