// Cloud Functions — AI-DSRP (FEAT-INTAKE-05)
// extractCaseReport: รับไฟล์รายงานเคส (PDF/JPEG/PNG, base64) จากเจ้าหน้าที่ที่ login แล้ว
// ส่งให้ Claude Vision อ่าน แล้วคืนข้อมูลโครงสร้าง (JSON) ให้เจ้าหน้าที่ตรวจสอบต่อ
// (human-in-the-loop) — ดู DETAILED-DESIGN.md Flow 1 และ TECH-STACK.md หัวข้อ 4.5/4.7
//
// เรียก Claude ผ่าน OpenRouter API (ไม่ใช้ Anthropic SDK ตรง) — ยืนยันเปลี่ยน routing layer นี้
// 2026-09-14 (TECH-STACK.md หัวข้อ 4.7) เพราะผู้ใช้มีบัญชี/คีย์ OpenRouter อยู่แล้ว ยังไม่มีบัญชี
// Anthropic โดยตรง โมเดลที่เรียกยังเป็น Claude ตัวเดิม ไม่ได้เปลี่ยน vendor/คุณภาพ OCR แต่อย่างใด

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const OPENROUTER_API_KEY = defineSecret("OPENROUTER_API_KEY");
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "anthropic/claude-sonnet-5"; // ดู TECH-STACK.md หัวข้อ 4.7 — ยืนยัน slug จริงจากแคตตาล็อก OpenRouter แล้ว

// เรียก OpenRouter chat completions แบบ shared helper — ทุกฟังก์ชันในไฟล์นี้ใช้ร่วมกัน
// (OpenAI-compatible request/response format ตามเอกสาร openrouter.ai/docs)
async function callOpenRouter(apiKey, messages, options) {
  options = options || {};
  const body = { model: OPENROUTER_MODEL, messages: messages };
  if (options.maxTokens) body.max_tokens = options.maxTokens;
  if (options.tools) body.tools = options.tools;
  if (options.toolChoice) body.tool_choice = options.toolChoice;

  let res;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    throw new Error("เชื่อมต่อ OpenRouter ไม่สำเร็จ: " + err.message);
  }

  const data = await res.json().catch(function () { return null; });
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || ("OpenRouter HTTP " + res.status);
    throw new Error(msg);
  }
  return data;
}

// ดึงผลลัพธ์จาก forced tool-call ตัวแรกที่ชื่อตรงกับ toolName (คืน null ถ้าไม่มี/parse ไม่ได้)
function getToolCallArguments(data, toolName) {
  const message = data && data.choices && data.choices[0] && data.choices[0].message;
  const toolCalls = message && message.tool_calls;
  if (!toolCalls || !toolCalls.length) return null;
  const toolCall = toolCalls.find(function (tc) { return tc.function && tc.function.name === toolName; }) || toolCalls[0];
  try {
    return JSON.parse(toolCall.function.arguments);
  } catch (err) {
    return null;
  }
}

// ดึงข้อความล้วนจาก response ปกติ (ไม่มี tool-call)
function getTextContent(data) {
  const message = data && data.choices && data.choices[0] && data.choices[0].message;
  return (message && typeof message.content === "string") ? message.content : "";
}

const MAX_FILE_BYTES = 7 * 1024 * 1024; // ~7MB ไฟล์ต้นฉบับ (base64 พองขึ้น ~33% ต้องเหลือขอบใต้ payload limit ของ callable function)
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

const EXTRACT_TOOL = {
  type: "function",
  function: {
    name: "extract_case_report",
    description: "บันทึกข้อมูลที่ดึงได้จากเอกสารรายงานผู้ป่วยเฝ้าระวังโรคที่แนบมา",
    parameters: {
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
  }
};

const EXTRACTION_PROMPT =
  "นี่คือเอกสารรายงานผู้ป่วยเฝ้าระวังโรค อาจเป็นแบบฟอร์มพิมพ์หรือเขียนมือภาษาไทยผสมกัน " +
  "ช่วยดึงข้อมูลตาม tool ที่กำหนดให้ครบเท่าที่อ่านได้ " +
  "ถ้าฟิลด์ใดอ่านไม่ออกหรือไม่มีในเอกสารให้เว้นว่างไว้ ห้ามเดา/สร้างข้อมูลที่ไม่มีในเอกสารขึ้นมาเอง";

exports.extractCaseReport = onCall({ secrets: [OPENROUTER_API_KEY] }, async (request) => {
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

  // OpenRouter ใช้ content block คนละแบบกับไฟล์รูป/PDF (ดู TECH-STACK.md 4.7 — "file" type
  // สำหรับ PDF ตาม openrouter.ai/docs/features/multimodal/pdfs, "image_url" สำหรับรูปภาพ)
  const documentBlock = mimeType === "application/pdf"
    ? { type: "file", file: { filename: fileName || "document.pdf", file_data: "data:" + mimeType + ";base64," + fileBase64 } }
    : { type: "image_url", image_url: { url: "data:" + mimeType + ";base64," + fileBase64 } };

  let data;
  try {
    data = await callOpenRouter(OPENROUTER_API_KEY.value(), [
      {
        role: "user",
        content: [documentBlock, { type: "text", text: EXTRACTION_PROMPT }]
      }
    ], {
      maxTokens: 1024,
      tools: [EXTRACT_TOOL],
      toolChoice: { type: "function", function: { name: "extract_case_report" } }
    });
  } catch (err) {
    throw new HttpsError("internal", "เรียก OCR ไม่สำเร็จ: " + err.message);
  }

  const fields = getToolCallArguments(data, "extract_case_report");
  if (!fields) {
    throw new HttpsError("internal", "ไม่สามารถดึงข้อมูลจากเอกสารได้ กรุณาตรวจสอบว่าไฟล์ชัดเจน หรือกรอกข้อมูลด้วยมือแทน");
  }

  return { fields: fields, fileName: fileName || null };
});

// assistCaseReview (FEAT-INTAKE-10) — รับข้อมูลที่ OCR ดึงได้แล้วของ 1 เคส (ข้อความล้วน
// ไม่ใช่ไฟล์) ให้ Claude ช่วยตรวจสอบความสมเหตุสมผลก่อนเจ้าหน้าที่กดยืนยัน — เป็น advisory
// เท่านั้น ไม่แก้ข้อมูลอัตโนมัติ (human-in-the-loop เหมือน flow อื่นในระบบ)

const REVIEW_TOOL = {
  type: "function",
  function: {
    name: "review_case_consistency",
    description: "บันทึกผลการตรวจสอบความสมเหตุสมผลของข้อมูลเคสผู้ป่วยเฝ้าระวังโรค",
    parameters: {
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
  }
};

const REVIEW_PROMPT =
  "นี่คือข้อมูลเคสผู้ป่วยเฝ้าระวังโรคที่ดึงมาจาก OCR/กรอกด้วยมือ ช่วยตรวจสอบความสมเหตุสมผลภายในของข้อมูล " +
  "เช่น รูปแบบ HN ผิดปกติไหม, ที่อยู่ (ตำบล/อำเภอ/จังหวัด) ดูสอดคล้องกันไหม, วันที่เริ่มป่วยดูสมเหตุสมผลไหม " +
  "(ไม่ใช่วันที่ในอนาคต/รูปแบบแปลกๆ), ชื่อโรค/ผลตรวจที่ระบุเป็นคำศัพท์ทางการแพทย์ที่มีอยู่จริงไหม " +
  "นี่เป็นการช่วยจับจุดที่อาจเป็นความผิดพลาดจาก OCR/การเขียนมือเท่านั้น ไม่ใช่การยืนยันข้อเท็จจริงกับฐานข้อมูลภายนอก " +
  "บันทึกผลผ่าน tool ที่กำหนด:\n\n";

exports.assistCaseReview = onCall({ secrets: [OPENROUTER_API_KEY] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "ต้องเข้าสู่ระบบก่อนใช้งานฟังก์ชันนี้");
  }

  const fields = (request.data && request.data.fields) || null;
  if (!fields || typeof fields !== "object") {
    throw new HttpsError("invalid-argument", "ไม่พบข้อมูลเคสที่จะตรวจสอบ");
  }

  let data;
  try {
    data = await callOpenRouter(OPENROUTER_API_KEY.value(), [
      { role: "user", content: REVIEW_PROMPT + JSON.stringify(fields, null, 2) }
    ], {
      maxTokens: 1024,
      tools: [REVIEW_TOOL],
      toolChoice: { type: "function", function: { name: "review_case_consistency" } }
    });
  } catch (err) {
    throw new HttpsError("internal", "เรียก AI ไม่สำเร็จ: " + err.message);
  }

  const result = getToolCallArguments(data, "review_case_consistency");
  if (!result) {
    throw new HttpsError("internal", "ไม่สามารถประมวลผลได้ กรุณาลองใหม่อีกครั้ง");
  }

  return result;
});

// suggestDiseaseType (FEAT-ANALYSIS-08, FEAT-INTAKE-11) — วิเคราะห์ข้อความที่เกี่ยวกับโรค
// แล้วเสนอ "โรคติดต่อ" ที่ตรงที่สุด — ต้องเป็นค่าที่มีอยู่จริงใน collection "506Types" เท่านั้น
// (ตรวจสอบซ้ำฝั่ง server เสมอ ไม่เชื่อผลจากโมเดลเฉยๆ) เป็น advisory: ผู้ใช้แก้ไข dropdown เองได้
// เสมอ และถ้าเรียกไม่สำเร็จ/จัดหมวดหมู่ไม่ได้ ก็ไม่แตะค่าเดิม ไม่บล็อกการบันทึกด้วยมือ
// รองรับ 2 รูปแบบ input: { title, reason } จากฟอร์ม รง.506 เดิม (FEAT-ANALYSIS-08) หรือ
// { clinicalText } จาก Case Intake OCR Review (FEAT-INTAKE-11) — เลือกอย่างใดอย่างหนึ่งก็พอ

const SUGGEST_DISEASE_TOOL = {
  type: "function",
  function: {
    name: "suggest_disease_type",
    description: "บันทึกผลการเลือกโรคติดต่อที่เหมาะสมที่สุดจากลิสต์ที่มีอยู่จริงเท่านั้น",
    parameters: {
      type: "object",
      properties: {
        matched: { type: "boolean", description: "true ถ้าเลือกโรคที่ตรงได้จากลิสต์ที่ให้มา, false ถ้าไม่มีโรคไหนตรงเลย (จัดหมวดหมู่ไม่ได้)" },
        diseaseId: { type: "string", description: "id ของโรคที่เลือก ต้องตรงกับ id ในลิสต์ที่ให้มาเป๊ะ (ว่างไว้ถ้า matched=false)" },
        reason: { type: "string", description: "เหตุผลสั้นๆ ที่เลือก/ไม่เลือก" }
      },
      required: ["matched", "reason"]
    }
  }
};

exports.suggestDiseaseType = onCall({ secrets: [OPENROUTER_API_KEY] }, async (request) => {
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

  const typesListText = types.map(function (t) { return "- " + t.id + ": " + t.name; }).join("\n");
  const contextText = hasClinicalText
    ? "ข้อมูลเคสผู้ป่วย (จาก OCR/กรอกด้วยมือ): " + clinicalText.trim()
    : "หัวเรื่องรายงาน: " + (title || "-") + "\nเหตุผล: " + (reason || "-");
  const prompt =
    "นี่คือรายชื่อโรคติดต่อที่มีอยู่จริงในระบบ (ต้องเลือกจากลิสต์นี้เท่านั้น ห้ามสร้างชื่อ/id ใหม่ขึ้นมาเอง):\n" +
    typesListText +
    "\n\n" + contextText +
    "\n\nช่วยเลือกโรคติดต่อที่ตรงที่สุดจากลิสต์ด้านบน ถ้าไม่มีโรคไหนตรงเลยให้ตอบว่าจัดหมวดหมู่ไม่ได้ (matched=false) บันทึกผลผ่าน tool ที่กำหนด";

  let data;
  try {
    data = await callOpenRouter(OPENROUTER_API_KEY.value(), [
      { role: "user", content: prompt }
    ], {
      maxTokens: 512,
      tools: [SUGGEST_DISEASE_TOOL],
      toolChoice: { type: "function", function: { name: "suggest_disease_type" } }
    });
  } catch (err) {
    throw new HttpsError("internal", "เรียก AI ไม่สำเร็จ: " + err.message);
  }

  const result = getToolCallArguments(data, "suggest_disease_type");
  if (!result) {
    throw new HttpsError("internal", "ไม่สามารถประมวลผลได้ กรุณาลองใหม่อีกครั้ง");
  }

  // ⭐ ตรวจสอบซ้ำฝั่ง server ว่า diseaseId ที่โมเดลเลือกมามีอยู่จริงในลิสต์ที่ดึงจาก Firestore
  // จริงๆ — ไม่เชื่อผลจาก tool-call เฉยๆ เพราะ prompt สั่งได้แต่ไม่ค้ำประกันว่าโมเดลจะทำตามเป๊ะเสมอ
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

exports.summarizeDiseaseTrend = onCall({ secrets: [OPENROUTER_API_KEY] }, async (request) => {
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

  const prompt =
    "โรคติดต่อ: " + diseaseName + "\n" +
    "ช่วงเวลา: " + windowStart + " ถึง " + windowEnd + " (7 วัน)\n" +
    "จำนวนรายงาน รง.506 ของโรคนี้ในช่วงเวลาดังกล่าว: " + inWindowCount + " รายการ\n\n" +
    "ช่วยเขียนสรุปสั้นๆ (2-3 ประโยค) ให้ผู้บริหาร (Manager) อ่านประกอบการพิจารณาอนุมัติรายงานนี้ " +
    "บอกจำนวนที่พบและช่วงเวลา ถ้าจำนวนดูมาก/น้อยผิดปกติให้ตั้งข้อสังเกตสั้นๆ " +
    "(ไม่ต้องฟันธงว่าเป็นการระบาดจริงหรือไม่ เพราะเป็นแค่การนับข้อมูลในระบบ ไม่ใช่การวิเคราะห์ทางระบาดวิทยาเต็มรูปแบบ) " +
    "ตอบเป็นข้อความล้วน ไม่ต้องมี markdown";

  let data;
  try {
    data = await callOpenRouter(OPENROUTER_API_KEY.value(), [
      { role: "user", content: prompt }
    ], { maxTokens: 300 });
  } catch (err) {
    throw new HttpsError("internal", "เรียก AI ไม่สำเร็จ: " + err.message);
  }

  const rawText = getTextContent(data).trim();
  const summaryText = rawText
    ? rawText
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
