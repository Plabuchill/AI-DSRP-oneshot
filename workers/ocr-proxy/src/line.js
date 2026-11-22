// LINE OA — แจ้งเตือนทีมสอบสวนโรค (SRRT) เข้ากลุ่ม LINE ของแต่ละทีม (ขั้น "AI Dispatch" ในผังงาน)
//
// /line/webhook  (LINE เรียก)  ตรวจลายเซ็น X-Line-Signature ด้วย LINE_CHANNEL_SECRET แล้ว:
//   - พิมพ์ "ผูกทีม 1" (1-5) ในกลุ่มที่เชิญ LINE OA เข้าไป -> จำว่ากลุ่มนี้คือทีมสอบสวนโรค เขต 1
//   - "ยกเลิกผูกทีม" -> เลิกจำกลุ่มนี้, "ทีมนี้" -> ตอบว่ากลุ่มนี้ผูกกับทีมไหน
// /line/notify   (หน้าเว็บเรียก ต้องล็อกอิน Firebase) ส่งข้อความแจ้งเคสใหม่เข้ากลุ่มของทีม
// /line/status   (หน้าเว็บเรียก ต้องล็อกอิน Firebase) ทีมไหนผูกกลุ่มแล้วบ้าง
//
// ข้อความไม่ระบุตัวผู้ป่วย (PDPA): Case ID, โรค, พื้นที่ (ตำบล/ชุมชน), วันเริ่มป่วย, ลิงก์ Google Maps, ลิงก์เข้าเว็บ ai-dsrp
// (ชื่อ/เลขบัตร/ที่อยู่เต็มดูได้ในเว็บหลังล็อกอินเท่านั้น) — ข้อความประกอบที่ Worker จากช่องที่กำหนด ไม่รับข้อความอิสระจากหน้าเว็บ
//
// Secret: LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN (npx wrangler secret put ...)
// KV: LINE_GROUPS (team:<n> -> groupId, group:<groupId> -> n)

export const TEAM_COUNT = 5;
const WEB_URL = "https://ai-dsrp.web.app/case-analysis.html";

function teamName(n) { return "ทีมสอบสวนโรค เขต " + n; }

async function verifySignature(body, signature, secret) {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode.apply(null, new Uint8Array(mac)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

async function lineApi(env, path, payload) {
  const res = await fetch("https://api.line.me/v2/bot/message/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.LINE_CHANNEL_ACCESS_TOKEN },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text().catch(function () { return ""; });
    throw new Error("LINE ตอบกลับผิดพลาด (" + res.status + ") " + text.slice(0, 200));
  }
}

function reply(env, replyToken, text) {
  return lineApi(env, "reply", { replyToken: replyToken, messages: [{ type: "text", text: text }] });
}

// คำสั่งในกลุ่ม — เลขทีมรับทั้งเลขอารบิกและเลขไทย
function parseCommand(text) {
  const t = String(text || "").trim().replace(/[๐-๙]/g, function (d) { return String(d.charCodeAt(0) - 0x0E50); });
  let m = t.match(/^ผูกทีม\s*(\d+)$/);
  if (m) return { cmd: "bind", team: parseInt(m[1], 10) };
  if (/^ยกเลิกผูกทีม$/.test(t)) return { cmd: "unbind" };
  if (/^ทีมนี้$/.test(t)) return { cmd: "which" };
  return null;
}

export async function handleLineWebhook(request, env) {
  const body = await request.text();
  if (!(await verifySignature(body, request.headers.get("X-Line-Signature"), env.LINE_CHANNEL_SECRET))) {
    return new Response("invalid signature", { status: 401 });
  }
  let payload;
  try { payload = JSON.parse(body); } catch (e) { return new Response("bad request", { status: 400 }); }

  for (const ev of payload.events || []) {
    const groupId = ev.source && ev.source.type === "group" ? ev.source.groupId : null;
    try {
      if (ev.type === "join" && groupId) {
        await reply(env, ev.replyToken, "สวัสดีครับ AI-DSRP พร้อมแจ้งเตือนเคสใหม่\nพิมพ์ \"ผูกทีม 1\" ถึง \"ผูกทีม " + TEAM_COUNT + "\" เพื่อระบุว่ากลุ่มนี้คือทีมสอบสวนโรคเขตไหน");
        continue;
      }
      if (ev.type !== "message" || !ev.message || ev.message.type !== "text") continue;
      const c = parseCommand(ev.message.text);
      if (!c) continue;
      if (!groupId) { await reply(env, ev.replyToken, "คำสั่งนี้ใช้ได้ในกลุ่ม LINE ของทีมเท่านั้น"); continue; }

      const current = await env.LINE_GROUPS.get("group:" + groupId);
      if (c.cmd === "which") {
        await reply(env, ev.replyToken, current ? "กลุ่มนี้ผูกกับ " + teamName(current) + " แล้ว" : "กลุ่มนี้ยังไม่ได้ผูกกับทีมใด");
      } else if (c.cmd === "unbind") {
        if (current) {
          await env.LINE_GROUPS.delete("team:" + current);
          await env.LINE_GROUPS.delete("group:" + groupId);
        }
        await reply(env, ev.replyToken, current ? "ยกเลิกการผูกกับ " + teamName(current) + " แล้ว" : "กลุ่มนี้ยังไม่ได้ผูกกับทีมใด");
      } else if (c.cmd === "bind") {
        if (c.team < 1 || c.team > TEAM_COUNT) { await reply(env, ev.replyToken, "เลขทีมต้องอยู่ระหว่าง 1-" + TEAM_COUNT); continue; }
        if (current && current !== String(c.team)) await env.LINE_GROUPS.delete("team:" + current);
        const previousGroup = await env.LINE_GROUPS.get("team:" + c.team);
        if (previousGroup && previousGroup !== groupId) await env.LINE_GROUPS.delete("group:" + previousGroup);
        await env.LINE_GROUPS.put("team:" + c.team, groupId);
        await env.LINE_GROUPS.put("group:" + groupId, String(c.team));
        await reply(env, ev.replyToken, "ผูกกลุ่มนี้กับ " + teamName(c.team) + " แล้ว — เคสใหม่ในพื้นที่ของทีมจะแจ้งเข้ากลุ่มนี้" +
          (previousGroup && previousGroup !== groupId ? "\n(กลุ่มที่เคยผูกกับทีมนี้ก่อนหน้าจะไม่ได้รับแจ้งอีก)" : ""));
      }
    } catch (err) {
      console.log("line webhook error", err.message); // ไม่ log เนื้อหาข้อความ
    }
  }
  return new Response("ok");
}

function text(v, max) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max); }

// ข้อความแจ้งเคส — ประกอบจากช่องที่กำหนดเท่านั้น (ไม่มีชื่อ/เลขบัตร/ที่อยู่เต็ม)
export function buildCaseMessage(b) {
  const coords = text(b.coords, 40).match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{2,3}\.\d+)$/);
  const lines = [
    (b.update ? "🔄 อัปเดตข้อมูลเคส" : "🚨 เคสใหม่") + " — " + teamName(b.teamId),
    "Case ID: " + text(b.caseId, 40),
    "โรค: " + (text(b.disease, 80) || "-"),
    "พื้นที่: " + (text(b.area, 120) || "-"),
    "วันเริ่มป่วย: " + (text(b.onsetDate, 20) || "-")
  ];
  if (coords) lines.push("แผนที่: https://www.google.com/maps?q=" + coords[1] + "," + coords[2]);
  lines.push("รายละเอียด (ต้องล็อกอิน): " + WEB_URL);
  lines.push("กรุณาลงพื้นที่สอบสวนโรคภายใน 24 ชั่วโมง");
  return lines.join("\n");
}

// คำขอจากหน้าเว็บ (ผ่าน CORS + Firebase auth ใน index.js แล้ว)
export async function handleLineApi(path, body, env) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return { status: 500, body: { error: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN" } };
  if (path === "/line/status") {
    const teams = {};
    for (let n = 1; n <= TEAM_COUNT; n++) teams[n] = !!(await env.LINE_GROUPS.get("team:" + n));
    return { status: 200, body: { ok: true, teams: teams } };
  }
  if (path === "/line/notify") {
    const teamId = parseInt(body.teamId, 10);
    if (!(teamId >= 1 && teamId <= TEAM_COUNT)) return { status: 400, body: { error: "ไม่ได้ระบุทีมที่รับผิดชอบ" } };
    if (!text(body.caseId, 40)) return { status: 400, body: { error: "ไม่มี Case ID" } };
    const groupId = await env.LINE_GROUPS.get("team:" + teamId);
    if (!groupId) return { status: 409, body: { error: teamName(teamId) + " ยังไม่ได้ผูกกลุ่ม LINE (พิมพ์ \"ผูกทีม " + teamId + "\" ในกลุ่มของทีม)" } };
    await lineApi(env, "push", { to: groupId, messages: [{ type: "text", text: buildCaseMessage(Object.assign({}, body, { teamId: teamId })) }] });
    return { status: 200, body: { ok: true, teamId: teamId } };
  }
  return { status: 404, body: { error: "ไม่พบ " + path } };
}
