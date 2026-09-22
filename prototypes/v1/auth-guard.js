// Auth guard (FEAT-PLATFORM-02) — import ในทุกหน้ายกเว้น login.html
// หน้าที่: (1) เด้งกลับ login.html ถ้ายังไม่ login, (2) เติมชื่อ/สิทธิ์/อักษรย่อผู้ใช้ที่ login
// ลงบล็อก .rail-user ของ left rail, (3) ผูกปุ่ม "ออกจากระบบ" (#btn-logout) ให้ signOut แล้วเด้งกลับ
// login.html, (4) บล็อกการเข้าหน้าที่ role ปัจจุบันไม่มีสิทธิ์ตาม ACL.md แม้พิมพ์ URL ตรงๆ เอง
//
// ต้องมี element เหล่านี้ในหน้า (ตามโครง left rail มาตรฐานของ prototype v1):
//   .rail-user-name, .rail-user-role, .rail-user .avatar, #btn-logout

import { auth } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getCurrentUserProfile, getRoleCategory } from "./current-user.js";

// ตาม ACL.md: หน้าไหนบล็อก role category ไหนบ้าง (ไม่อยู่ในลิสต์ = เข้าได้ทุก role)
// - new-506-request.html: SRRT/Manager ยื่นได้ Director ยื่นไม่ได้
// - user-approval.html: อยู่นอกขอบเขตตาราง ACL.md (เฉพาะ รง.506) แต่ตามเจตนาฟีเจอร์ควรเป็น
//   Manager เท่านั้น จึงบล็อกทุก role category อื่นรวมถึง "unknown" (role แปลกที่เดาไม่ได้)
const BLOCKED_ROLES_BY_PAGE = {
  "new-506-request.html": ["director"],
  "user-approval.html": ["srrt", "director", "unknown"]
};

function currentPageName() {
  const path = window.location.pathname;
  return path.substring(path.lastIndexOf("/") + 1);
}

async function handleUser(user) {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const nameEl = document.querySelector(".rail-user-name");
  const roleEl = document.querySelector(".rail-user-role");
  const avatarEl = document.querySelector(".rail-user .avatar");

  try {
    const profile = await getCurrentUserProfile();
    if (profile) {
      if (nameEl) nameEl.textContent = profile.name;
      // ยังไม่มี role label ภาษาไทยที่เป็นทางการ — แสดง role ตรงๆ ไปก่อน (manager/team1/team3/director)
      if (roleEl) roleEl.textContent = profile.role;
      if (avatarEl) avatarEl.textContent = (profile.name || "").slice(0, 2);

      const blockedRoles = BLOCKED_ROLES_BY_PAGE[currentPageName()];
      if (blockedRoles && blockedRoles.indexOf(getRoleCategory(profile.role)) !== -1) {
        window.alert("คุณไม่มีสิทธิ์เข้าหน้านี้ตามบทบาทที่ได้รับ");
        window.location.href = "case-analysis.html";
        return;
      }
    } else {
      if (nameEl) nameEl.textContent = user.email;
      if (roleEl) roleEl.textContent = "-";
    }
  } catch (err) {
    if (nameEl) nameEl.textContent = user.email;
    if (roleEl) roleEl.textContent = "โหลดข้อมูลผู้ใช้ไม่สำเร็จ";
  }
}

// ทดสอบจริง (2026-09-22) พบว่า onAuthStateChanged ยิง callback แรกด้วย user=null ก่อน
// Firebase Auth restore session จาก persistence (IndexedDB) เสร็จจริง ทำให้ผู้ใช้ที่ login
// อยู่จริงถูกเด้งกลับ login.html ทั้งที่ไม่ควร — แก้ด้วย auth.authStateReady() (Firebase JS
// SDK v10.7+) ซึ่งเป็น API ที่ออกแบบมาเพื่อรอผลลัพธ์ auth state เริ่มต้นที่แน่นอนโดยเฉพาะ
// แทนการเชื่อ onAuthStateChanged ครั้งแรกตรงๆ — ส่วน onAuthStateChanged ยังคงฟังต่อสำหรับ
// การเปลี่ยนแปลงหลังจากนั้น (เช่น sign out จากแท็บอื่น/token หมดอายุ) แต่ข้ามการยิงครั้งแรกไป
// เพราะ authStateReady() จัดการรอบแรกให้แล้ว
let initialHandled = false;
auth.authStateReady().then(function () {
  initialHandled = true;
  handleUser(auth.currentUser);
});
onAuthStateChanged(auth, function (user) {
  if (!initialHandled) return;
  handleUser(user);
});

document.addEventListener("DOMContentLoaded", function () {
  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      signOut(auth).then(function () {
        window.location.href = "login.html";
      });
    });
  }
});
