// โหลดเคสจริงจากชีตทะเบียนผู้ป่วย + จัดกลุ่มเคส (cluster) + โหลด/บันทึกสถานะของหน้า (แท็บ "กลุ่มเคส"/"แผนควบคุมโรค")
// ใช้โดย case-analysis.js และ control-plan.js (classic script) — ส่งข้อมูลให้ทาง CustomEvent:
//   "aidsrp:cases-ready"  detail = { cases, clusters, state: { clusters, controlPlan }, windowDays, excludedNoOnset, error }
//   รับคำขอบันทึกทาง "aidsrp:save-state" { tab, records, requestId } -> ตอบกลับ "aidsrp:state-saved" { tab, requestId, ok, error }
// ผลล่าสุดเก็บไว้ที่ window.AidsrpCases.last ด้วย (เผื่อหน้า init หลัง event ถูกส่งไปแล้ว)
// ต้องโหลด register-fields.js (window.AidsrpRegister) ก่อนไฟล์นี้

import { callSheet, sheetEnabled } from "./sheet-client.js";

const REG = window.AidsrpRegister;

// เกณฑ์จัดกลุ่ม: โรคเดียวกัน บ้านห่างกันไม่เกิน 100 ม. และเริ่มป่วยห่างกันไม่เกิน 14 วัน (เชื่อมต่อกันเป็นทอดได้)
export const CLUSTER_RADIUS_M = 100;
export const CLUSTER_DAYS = 14;
const WINDOW_OPTIONS = [{ days: 28, label: "28 วันล่าสุด" }, { days: 56, label: "56 วันล่าสุด" },
  { days: 90, label: "90 วันล่าสุด" }, { days: 0, label: "ทั้งหมด" }];
// รหัสโรคไข้เลือดออก (DHF/DSS/DF) นับเป็นโรคเดียวกันเวลาจัดกลุ่ม
const DENGUE_CODES = ["26", "27", "66"];
const CLUSTER_COLORS = ["#8A9A5B", "#C9A66B", "#7A6A53", "#A0785A", "#5F7A8A", "#9A6B8A"];

let windowDays = 28;

function parseCoords(text) {
  const m = String(text || "").trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
  return isNaN(lat) || isNaN(lng) ? null : { lat: lat, lng: lng };
}

function distanceM(a, b) {
  const rad = Math.PI / 180, R = 6371000;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function daysBetween(a, b) { return Math.abs(Math.round((a - b) / 86400000)); }

export function diseaseGroupOf(diseaseId) {
  return DENGUE_CODES.indexOf(String(diseaseId)) !== -1 ? "dengue" : String(diseaseId || "");
}

function diseaseGroupLabel(c) {
  return diseaseGroupOf(c.diseaseId) === "dengue" ? "ไข้เลือดออก" : (c.diseaseName || ("รหัสโรค " + c.diseaseId));
}

// แถวจากชีต -> เคสที่หน้าเว็บใช้ (วันที่เป็น Date, พิกัดเป็นตัวเลข)
function toCase(row) {
  return {
    caseId: row.caseId,
    seq: row.seq,
    patientName: row.patientName || "",
    address: row.address || "",
    subdistrict: row.subdistrict || "",
    community: row.homeCommunity || "",
    workplace: row.workplace || "",
    home: parseCoords(row.homeCoords),
    work: parseCoords(row.workCoords),
    onset: REG.parseThaiDate(row.onsetDate),
    onsetDate: row.onsetDate || "",
    found: REG.parseThaiDate(row.foundDate) || REG.parseThaiDate(row.receivedDate),
    diseaseId: row.diseaseId || "",
    diseaseName: row.diseaseName || "",
    team: row.team || "",
    fileUrl: row.fileUrl || "",
    clusterId: null,
    row: row
  };
}

// single-linkage: เคสที่เข้าเกณฑ์กับเคสใดเคสหนึ่งในกลุ่ม = อยู่กลุ่มเดียวกัน — กลุ่มต้องมีอย่างน้อย 2 ราย
// Cluster ID = "CL-" + Case ID แรกสุดของกลุ่ม (เรียงตามวันเริ่มป่วย) ให้คงที่เมื่อมีเคสใหม่เข้ามาสมทบ
export function clusterCases(cases) {
  const parent = cases.map(function (_, i) { return i; });
  const find = function (i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let i = 0; i < cases.length; i++) {
    for (let j = i + 1; j < cases.length; j++) {
      const a = cases[i], b = cases[j];
      if (!a.home || !b.home || !a.onset || !b.onset) continue;
      if (diseaseGroupOf(a.diseaseId) !== diseaseGroupOf(b.diseaseId)) continue;
      if (daysBetween(a.onset, b.onset) > CLUSTER_DAYS) continue;
      if (distanceM(a.home, b.home) > CLUSTER_RADIUS_M) continue;
      parent[find(i)] = find(j);
    }
  }
  const groups = {};
  cases.forEach(function (c, i) { (groups[find(i)] = groups[find(i)] || []).push(c); });

  const clusters = Object.keys(groups).map(function (k) { return groups[k]; })
    .filter(function (members) { return members.length >= 2; })
    .map(function (members) {
      members.sort(function (a, b) { return (a.onset - b.onset) || String(a.caseId).localeCompare(String(b.caseId)); });
      let maxDist = 0;
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) maxDist = Math.max(maxDist, distanceM(members[i].home, members[j].home));
      }
      const counts = {};
      members.forEach(function (c) { if (c.subdistrict) counts[c.subdistrict] = (counts[c.subdistrict] || 0) + 1; });
      const subdistrict = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0] || "";
      return {
        clusterId: "CL-" + members[0].caseId,
        disease: diseaseGroupLabel(members[0]),
        subdistrict: subdistrict,
        name: "กลุ่ม" + diseaseGroupLabel(members[0]) + (subdistrict ? " ต." + subdistrict : ""),
        cases: members,
        maxDistanceM: Math.round(maxDist),
        firstOnset: members[0].onset,
        lastOnset: members[members.length - 1].onset
      };
    })
    .sort(function (a, b) { return b.lastOnset - a.lastOnset; });

  clusters.forEach(function (cl, i) {
    cl.color = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
    cl.cases.forEach(function (c) { c.clusterId = cl.clusterId; });
  });
  return clusters;
}

function emit(detail) {
  window.AidsrpCases.last = detail;
  document.dispatchEvent(new CustomEvent("aidsrp:cases-ready", { detail: detail }));
}

async function load() {
  if (!sheetEnabled) {
    emit({ cases: [], clusters: [], state: { clusters: [], controlPlan: [] }, windowDays: windowDays, excludedNoOnset: 0,
      error: "ยังไม่ได้เชื่อมต่อ Google Sheet (ตั้งค่าที่ sheet-config.js)" });
    return;
  }
  document.dispatchEvent(new CustomEvent("aidsrp:cases-loading"));
  try {
    const [list, state] = await Promise.all([
      callSheet("list"),
      callSheet("state.list", { tabs: ["clusters", "controlPlan"] })
    ]);
    const all = (list.rows || []).filter(function (r) { return r.caseId; }).map(toCase);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const excludedNoOnset = all.filter(function (c) { return !c.onset; }).length;
    const cases = all.filter(function (c) {
      return c.onset && (!windowDays || daysBetween(today, c.onset) <= windowDays || c.onset > today);
    });
    const clusters = clusterCases(cases);
    emit({ cases: cases, clusters: clusters, state: state.tabs || { clusters: [], controlPlan: [] },
      windowDays: windowDays, excludedNoOnset: excludedNoOnset, error: null });
  } catch (err) {
    emit({ cases: [], clusters: [], state: { clusters: [], controlPlan: [] }, windowDays: windowDays, excludedNoOnset: 0,
      error: "โหลดเคสจาก Google Sheet ไม่สำเร็จ: " + err.message });
  }
}

document.addEventListener("aidsrp:save-state", async function (e) {
  const d = e.detail || {};
  let result;
  try {
    await callSheet("state.upsert", { tab: d.tab, records: d.records || [] });
    result = { tab: d.tab, requestId: d.requestId, ok: true };
  } catch (err) {
    result = { tab: d.tab, requestId: d.requestId, ok: false, error: err.message };
  }
  document.dispatchEvent(new CustomEvent("aidsrp:state-saved", { detail: result }));
});

document.addEventListener("aidsrp:reload-cases", load);

// ตัวเลือกช่วงเวลา (ถ้าหน้ามี <select id="case-window-select">) — ค่าเริ่มต้น 28 วันล่าสุด
function initWindowSelect() {
  const sel = document.getElementById("case-window-select");
  if (!sel) return;
  sel.innerHTML = WINDOW_OPTIONS.map(function (o) {
    return '<option value="' + o.days + '"' + (o.days === windowDays ? " selected" : "") + ">" + o.label + "</option>";
  }).join("");
  sel.addEventListener("change", function () { windowDays = parseInt(sel.value, 10) || 0; load(); });
}

window.AidsrpCases = { last: null, reload: load, CLUSTER_RADIUS_M: CLUSTER_RADIUS_M, CLUSTER_DAYS: CLUSTER_DAYS };

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () { initWindowSelect(); load(); });
} else {
  initWindowSelect();
  load();
}
