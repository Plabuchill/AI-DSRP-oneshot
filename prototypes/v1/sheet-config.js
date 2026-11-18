// ตั้งค่า Google Sheet ที่เก็บเคสที่ยืนยันแล้วจากหน้า Case Intake (FEAT-INTAKE-06)
// CASE_SHEET_URL = URL ของ Apps Script web app (ลงท้าย /exec) หลัง deploy apps-script/case-sheet/Code.gs
//   เว้นว่าง = ปิดการบันทึกลงชีต (หน้า Case Intake ทำงานแบบเดิม ข้อมูลอยู่ในหน้าเว็บอย่างเดียว)
// CASE_SHEET_VIEW_URL = ลิงก์เปิดตัว Google Sheet (ไม่บังคับ) แสดงเป็นปุ่ม "เปิด Google Sheet"
// ทั้งสองค่าไม่ใช่ secret — สคริปต์ฝั่งชีตรับเฉพาะผู้ที่ล็อกอินเว็บ ai-dsrp และตัวชีตแชร์ตามสิทธิ์ Google ปกติ
export const CASE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzrPoYSJAaSLKFtWMFuXYdefuP5ni0u5vSTgUX93m3S6umdf-vZFaO4Gxr6zfbUedaY/exec";
export const CASE_SHEET_VIEW_URL = "";
