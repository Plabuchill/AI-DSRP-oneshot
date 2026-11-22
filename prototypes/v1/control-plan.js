/* =========================================================
   AI Disease Surveillance & Response Platform
   Control Plan — mock approval-request drafting / control workplan
   drafting (separate script: own DOM/state, no cross-page import;
   area names are kept consistent with case-analysis.js/case-intake.js
   mock data but not read from their live state, per BUILD-PLAN.md
   assumption for รอบ 4)

   รอบ 10 (2026-08-20): the workplan schedule table now has one row
   per currently-selected (area+location) pool item (not a fixed set
   of 4 team rows), with a user-editable team <select> per row (any
   team can be assigned to any number of rows). Rows are grouped by
   assigned team (1->4) first, then sorted soonest->latest by date+
   time within the same team. See getOrCreateWorkplanEntry(),
   getSortedWorkplanRows(), sortWorkplanRows() below.

   รอบ 12 (2026-08-20): each area/mock case now has a patientName
   (shown in the area-selection checklist) and a caseFoundDate
   ("Day 0" anchor). The workplan row date is no longer a free-form
   day/month/ปี(พ.ศ.) select trio — it's a single Day 0/1/7 <select>
   (dayOffset) added to the row's area.caseFoundDate, per the
   standard dengue vector-control spraying schedule. Also added:
   a "พิมพ์เป็น PDF" button (window.print(), shown once the approval
   request has been sent) and the two panels' HTML order in
   control-plan.html was swapped (workplan panel first).

   รอบ 13 (2026-08-21): the patient's name is now each case's primary
   heading everywhere (area-selection card, workplan table, approval
   document); the old "select home AND/OR work via checkbox" model
   (selectedKeys) is gone — every case is always in the plan, and each
   case's card instead has a 2-button tab pair to pick exactly ONE
   active location ("ชุมชน (ที่อยู่)" | "ชุมชน (ที่ทำงาน)") at a time,
   tracked in activeLocTypeByAreaId. Home locations gained real
   editable address/houseNo text inputs (previously just a static
   "ที่อยู่ (บ้าน)" label); work locations' name field is now editable
   too (previously static mock text). See getSelectedPool(),
   buildAreaGroup()/buildAreaFieldsHtml() below.

   รอบ 16 (2026-08-21): a case can now have BOTH locations active at
   once (some cases need vector control at home AND at work/school).
   activeLocTypeByAreaId (single string per case) was replaced with
   activeLocTypesByAreaId (array of 1-2 strings per case); the same
   2 tab buttons now toggle membership in that array instead of
   exclusive-selecting, and buildAreaGroup() renders one labeled
   field block per active location when there are 2. getSelectedPool()
   now returns one pool item per active location (so a case with both
   active contributes 2 items, e.g. keys "1-home" and "1-work").

   รอบ 17 (2026-08-21): the workplan schedule table gained a "สถานะ
   พ่นแล้ว" Day 0/1/7 checkbox group per row (state: sprayDoneByKey,
   keyed by the same pool-item `key` as workplanEntryByKey — so a
   case's home and work locations track spraying completion
   independently). Rows fully done (all 3 days checked) are filtered
   out of both the rendered table and buildWorkplanText() — see
   isSprayFullyDone(), renderWorkplanSchedule() below. This only
   affects the workplan schedule table, not the approval-request
   area-selection list/mini-map.

   รอบ 18 (2026-08-21): each AREAS[i] now has a mock sourceFile
   filename (fresh mock, same naming convention as case-intake.js's
   CASES[].fileName but not read from that page's live state — see
   the AREAS comment below). A ".file-link" (reusing case-intake.js's
   .file-link CSS class + ICON_FILE SVG markup, copied into this file
   as its own ICON_FILE constant — no cross-file import) is rendered
   once per case, right after the patientName heading, in
   buildAreaGroup() only (not in the workplan table or mini-map, per
   BUILD-PLAN.md รอบ 18 scope). Clicking it just preventDefault()s,
   same mock behaviour as case-intake.js.
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     Mock areas eligible for chemical spraying / vector control —
     names/context align with the confirmed clusters in
     case-analysis.js (ต.หนองบัว, ต.บ้านเป็ด) and the dengue case
     seeded in case-intake.js (ต.เกาะแก้ว), kept as a fresh mock
     dataset here rather than importing cross-page state.

     รอบ 9 (2026-08-20): each area now has 2 selectable locations —
     "home" (ที่อยู่/บ้านผู้ป่วย) and "work" (สถานที่ทำงาน/เรียน) —
     each with its own fictional coordinate (lat/lng inside the stated
     area, not a real household — shown on the OpenStreetMap mini-map) and
     baseHouseholdsAt100m: a mock household-density figure at a
     100m radius, used to scale the "households affected" number
     as (radius/100)^2 when the user picks a wider radius. Home
     locations' baseHouseholdsAt100m is back-calculated so that,
     at each area's original default radius, the household count
     matches the figure hardcoded before this round (86/54/40/48).

     รอบ 18 (2026-08-21): each area also has a `sourceFile` — a fresh
     mock original-document filename (PDF/JPEG scan from the
     hospital), named with the same convention as case-intake.js's
     CASES[].fileName ("{หน่วยงาน}_{บริบท}_{เลข}.{pdf|jpg}"). This is
     a brand-new mock value per BUILD-PLAN.md รอบ 18 — it is NOT
     matched 1:1 against any CASES[] entry in case-intake.js (patient
     names/areas across the two files were never designed to line up
     — see the file-level comment above); it just gives each case
     here a plausible "ไฟล์ต้นฉบับ" link for UX continuity.
     --------------------------------------------------------- */
  // Mock "Day 0" anchor (วันพบเคส) per area, used by the workplan
  // schedule's Day 0/1/7 <select> (รอบ 12) — a fixed number of days
  // before "today" (varied per area for realism), normalized to
  // midnight so date-only arithmetic (+0/+1/+7 days) stays exact.
  function daysAgo(n) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
  }

  /* ---------------------------------------------------------
     เคสจริงจากชีตทะเบียนผู้ป่วย — sheet-cases.js โหลด/จัดกลุ่มแล้วส่งมาทาง
     "aidsrp:cases-ready" (applyCases() ด้านล่างแปลงเป็น AREAS)
     หนึ่งเคส = หนึ่ง area, ตำแหน่ง "home" จากพิกัด/ที่อยู่บ้าน, "work" มีเมื่อทะเบียนมี
     สถานที่ทำงาน/เรียนหรือพิกัดที่ทำงาน — ค่าที่เลือกในหน้า (ตำแหน่งที่ใช้, รัศมี, ชนิดน้ำมัน,
     ทีม/วัน/เวลา, พ่นแล้ว Day 0/1/7) บันทึกลงแท็บ "แผนควบคุมโรค" (key = Case ID:ตำแหน่ง)
     --------------------------------------------------------- */
  var AREAS = [];
  var loadInfo = { loading: true, error: null, windowDays: 28 };
  // จำนวนหลังคาเรือนต่อรัศมี 100 ม. (ค่าประมาณคงที่ — ทะเบียนยังไม่มีข้อมูลความหนาแน่นบ้านจริง)
  var HOUSEHOLDS_PER_100M_ESTIMATE = 40;

  var RADIUS_OPTIONS = [100, 150, 200];

  // BUILD-PLAN.md รอบ 23: fuel/chemical type per (area+location) — matches
  // DATA-MODEL.md enum(gasoline, diesel, lubricant, chemical, other) for
  // APPROVAL_REQUEST_CASE.fuel_type. Rendered as one <select> per location
  // field block (see buildAreaFieldsHtml()), aggregated into the ☑/☐
  // checkboxes of buildApprovalText() below.
  var FUEL_TYPE_OPTIONS = [
    { value: "gasoline", label: "น้ำมันเบนซิน/แก๊สโซฮอล์" },
    { value: "diesel", label: "น้ำมันดีเซล" },
    { value: "lubricant", label: "น้ำมันหล่อลื่น" },
    { value: "chemical", label: "น้ำยาเคมี" },
    { value: "other", label: "อื่นๆ" }
  ];

  // รอบ 13 (2026-08-21): every mock case is always part of the plan now —
  // there is no more include/exclude selection. Instead each case (area)
  // has an active-location "tab" set — "home" (ที่อยู่/บ้าน) and/or "work"
  // (สถานที่ทำงาน/เรียน) — defaulting to just "home" to match the previous
  // default preselect.
  //
  // รอบ 16 (2026-08-21): a case can have BOTH locations active at once (it
  // used to be exactly one, exclusive) — so this is now an array of 1-2
  // location-type strings per case, not a single string. getSelectedPool()
  // below returns one pool item per active location, so it can return more
  // than AREAS.length items when any case has 2 active locations. Order is
  // normalized via LOC_TYPE_ORDER (home always listed/rendered before work)
  // regardless of which tab the user toggled on first.
  var LOC_TYPE_ORDER = ["home", "work"];
  var activeLocTypesByAreaId = {};

  // radius chosen per (area+location) key — lazily defaulted from
  // location.defaultRadius the first time a key is read.
  var radiusByKey = {};

  // BUILD-PLAN.md รอบ 23: fuel/chemical type chosen per (area+location)
  // key — same lazy-default caching pattern as radiusByKey above, keyed
  // by the same getLocationKey() string, so a location's chosen type
  // survives toggling its tab off/on and page re-renders. Matches the
  // DATA-MODEL.md enum(gasoline, diesel, lubricant, chemical, other) for
  // APPROVAL_REQUEST_CASE.fuel_type; default "diesel" per BUILD-PLAN.md
  // assumption (ensures the pool always has >=1 type selected).
  var fuelTypeByKey = {};

  function getFuelTypeForKey(key) {
    if (fuelTypeByKey[key] === undefined) fuelTypeByKey[key] = "diesel";
    return fuelTypeByKey[key];
  }

  function getAreaById(id) {
    for (var i = 0; i < AREAS.length; i++) {
      if (AREAS[i].id === id) return AREAS[i];
    }
    return null;
  }

  function getLocationKey(areaId, locType) {
    return areaId + "-" + locType;
  }

  function findLocation(areaId, locType) {
    var area = getAreaById(areaId);
    if (!area) return null;
    for (var i = 0; i < area.locations.length; i++) {
      if (area.locations[i].type === locType) return area.locations[i];
    }
    return null;
  }

  function getRadiusForKey(key, loc) {
    if (radiusByKey[key] === undefined) radiusByKey[key] = loc.defaultRadius || 100;
    return radiusByKey[key];
  }

  function computeHouseholds(loc, radius) {
    return Math.round(loc.baseHouseholdsAt100m * Math.pow(radius / 100, 2));
  }

  /* ---------------------------------------------------------
     Pool of every case's currently-active location(s) (home and/or
     work, per activeLocTypesByAreaId), each with the radius/household
     figures resolved from current state. At least AREAS.length items
     (one per case) — more when a case has both locations active
     (รอบ 16) — there is no more empty-selection state. Shared by both
     the approval-draft panel and the workplan schedule table below.
     --------------------------------------------------------- */
  function getSelectedPool() {
    var pool = [];
    AREAS.forEach(function (area) {
      var activeTypes = activeLocTypesByAreaId[area.id] || ["home"];
      LOC_TYPE_ORDER.filter(function (t) { return activeTypes.indexOf(t) !== -1; }).forEach(function (locType) {
        var loc = findLocation(area.id, locType);
        if (!loc) return;
        var key = getLocationKey(area.id, loc.type);
        var radius = getRadiusForKey(key, loc);
        pool.push({
          key: key,
          area: area,
          loc: loc,
          radius: radius,
          households: computeHouseholds(loc, radius),
          fuelType: getFuelTypeForKey(key)
        });
      });
    });
    return pool;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // รอบ 13: home locations now describe the real editable address+house
  // number fields instead of the generic "ที่อยู่ (บ้าน)" label; work
  // locations still describe the editable "name" field.
  function locDescriptor(loc) {
    return loc.type === "home"
      ? ("ที่อยู่: " + loc.address + (loc.houseNo ? " เลขที่ " + loc.houseNo : ""))
      : ("ที่ทำงาน/เรียน: " + loc.name);
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

  function formatThaiDate(date) {
    var d = date.getDate();
    var m = THAI_MONTHS[date.getMonth()];
    var y = date.getFullYear() + 543;
    return d + " " + m + " " + y;
  }

  // Format the Thai date for a workplan row's "Day 0/1/7" <select>
  // (รอบ 12) — the row no longer stores its own day/month/year; the
  // actual calendar date is derived from the row's area.caseFoundDate
  // (mock "วันพบเคส") plus the chosen dayOffset (0, 1, or 7 days).
  function formatThaiDateFromOffset(caseFoundDate, dayOffset) {
    var offset = parseInt(dayOffset, 10);
    var d = new Date(caseFoundDate.getFullYear(), caseFoundDate.getMonth(), caseFoundDate.getDate() + offset);
    return formatThaiDate(d);
  }

  /* ---------------------------------------------------------
     รอบ 14: workplan date filter — lets the user pick a single
     calendar date and see which rows' computed Day 0/1/7 date falls
     on it. All helpers below only compare year/month/day (never the
     row's hour/minute).

     รอบ 15: the filter's input changed from a native <input
     type="date"> to a วัน/เดือน/ปี พ.ศ. <select> trio (#workplan-
     date-filter-day/-month/-year — see els below), since the native
     picker rendered/accepted dates per browser/OS locale, not
     guaranteed Thai. Because a <select> always has *some* option
     selected (unlike an empty date input), "ล้างตัวกรอง" can no
     longer represent "no date chosen" by clearing the control's
     value — instead a separate workplanDateFilterActive flag tracks
     whether the filter is currently "on" (see getWorkplanFilterDate()
     below and the button handlers in initEvents()).
     --------------------------------------------------------- */

  // Whether the due-date filter is currently active (รอบ 15, replacing
  // the รอบ 14 "input has a value" check, since the day/month/year
  // <select> trio always has some value selected). Starts true so the
  // default-to-today filter is immediately useful on page load (matches
  // รอบ 14's original default behaviour).
  var workplanDateFilterActive = true;

  function sameYMD(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  // A row's actual calendar date (year/month/day only, ignoring hour/
  // minute) — same base+offset arithmetic as formatThaiDateFromOffset(),
  // kept separate since callers here need a Date object, not text.
  function scheduleDateOnly(entry, poolItem) {
    var base = poolItem.area.caseFoundDate;
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + parseInt(entry.dayOffset, 10));
  }

  // Current filter value as a Date (null when workplanDateFilterActive
  // is false, i.e. "ล้างตัวกรอง" was pressed) — read fresh every render
  // so it always reflects whatever the user currently has selected in
  // the day/month/year <select> trio (รอบ 15).
  function getWorkplanFilterDate() {
    if (!workplanDateFilterActive) return null;
    var day = parseInt(els.workplanDateFilterDay.value, 10);
    var month = parseInt(els.workplanDateFilterMonth.value, 10); // 0-11
    var year = parseInt(els.workplanDateFilterYear.value, 10); // ค.ศ. (stored value; +543 only when displayed)
    return new Date(year, month, day);
  }

  /* ---------------------------------------------------------
     24-hour time <select> options — guarantees a 24h display
     regardless of browser/OS locale (native <input type="time">
     can render an AM/PM picker on some locales).
     --------------------------------------------------------- */
  var HOUR_OPTIONS = [];
  for (var _h = 0; _h < 24; _h++) HOUR_OPTIONS.push(pad2(_h));
  var MINUTE_OPTIONS = ["00", "15", "30", "45"];

  /* ---------------------------------------------------------
     วัน/เดือน/ปี พ.ศ. <select> option lists for the workplan due-date
     filter (รอบ 15) — day 01-31 (fixed range regardless of month, same
     simplification as รอบ 10's original day/month/year trio); month
     reuses THAI_MONTHS (values 0-11); year spans "this year" (ค.ศ.,
     read at page load) through +2 years ahead, displayed as พ.ศ.
     (+543) only — see populateWorkplanDateFilterSelects() below.
     --------------------------------------------------------- */
  var WP_DAY_OPTIONS = [];
  for (var _d = 1; _d <= 31; _d++) WP_DAY_OPTIONS.push(pad2(_d));

  var WP_YEAR_OPTIONS = (function () {
    var years = [];
    var startYear = new Date().getFullYear();
    for (var i = 0; i <= 2; i++) years.push(startYear + i);
    return years;
  })();

  // "Day 0/1/7" <select> options for the workplan schedule table (รอบ 12)
  // — standard dengue vector-control spraying schedule: spray on the day
  // the case is found (Day 0), follow up the next day (Day 1), and once
  // more on Day 7. Values are day offsets added to the row's area's mock
  // caseFoundDate (see formatThaiDateFromOffset()/scheduleTimestamp()).
  var DAY_OFFSET_OPTIONS = [
    { value: 0, label: "Day 0 (วันพบเคส)" },
    { value: 1, label: "Day 1" },
    { value: 7, label: "Day 7" }
  ];

  var TEAM_OPTIONS = [1, 2, 3, 4];

  var ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"></path><path d="M22 2 15 22l-4-9-9-4 20-7Z"></path></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>';

  // รอบ 18: same document icon markup as case-intake.js's ICON_FILE —
  // copied here as this file's own constant (no cross-file import, per
  // BUILD-PLAN.md รอบ 18 scope/this file's existing no-shared-state
  // convention).
  var ICON_FILE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6l1 4H8l1-4Z"></path><path d="M6 6h12l1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L6 6Z"></path></svg>';

  /* ---------------------------------------------------------
     DOM refs
     --------------------------------------------------------- */
  var els = {
    areaSelectList: document.getElementById("area-select-list"),
    areaSelectSummary: document.getElementById("area-select-summary"),
    miniMapWrap: document.getElementById("control-plan-mini-map-wrap"),
    btnGenerateApproval: document.getElementById("btn-generate-approval"),
    approvalTextarea: document.getElementById("approval-textarea"),
    btnSendApproval: document.getElementById("btn-send-approval"),
    btnMockApprove: document.getElementById("btn-mock-approve"),
    btnMockReject: document.getElementById("btn-mock-reject"),
    btnPrintApproval: document.getElementById("btn-print-approval"),
    approvalPrintView: document.getElementById("approval-print-view"),
    approvalStatus: document.getElementById("approval-status"),
    btnGenerateWorkplan: document.getElementById("btn-generate-workplan"),
    workplanTextarea: document.getElementById("workplan-textarea"),
    btnConfirmWorkplan: document.getElementById("btn-confirm-workplan"),
    workplanStatus: document.getElementById("workplan-status"),
    workplanScheduleBody: document.getElementById("workplan-schedule-body"),
    workplanDateFilterDay: document.getElementById("workplan-date-filter-day"),
    workplanDateFilterMonth: document.getElementById("workplan-date-filter-month"),
    workplanDateFilterYear: document.getElementById("workplan-date-filter-year"),
    btnWorkplanDateToday: document.getElementById("btn-workplan-date-today"),
    btnWorkplanDateClear: document.getElementById("btn-workplan-date-clear"),
    workplanDueSummary: document.getElementById("workplan-due-summary"),
    workplanHiddenNote: document.getElementById("workplan-hidden-note")
  };

  /* ---------------------------------------------------------
     Control workplan schedule state (รอบ 10, dates reworked รอบ 12,
     selection model reworked รอบ 13, multi-location-per-case reworked
     รอบ 16) — one row per pool item (one per case, per
     activeLocTypesByAreaId/getSelectedPool() above — 2 rows for a case
     with both locations active), keyed by the same `key` used by
     radiusByKey above, instead of the old "4 fixed teamId rows" model.
     Each entry holds its own editable {assignedTeamId, dayOffset, hour,
     minute} and is created lazily the first time its key is seen (and
     never deleted when the user switches a case's active tab away from
     it — matches the radiusByKey caching pattern already used
     elsewhere in this file, so switching back restores its previous
     schedule).

     รอบ 12: the row's calendar date is no longer stored directly as
     {day, month, year} — instead `dayOffset` ("0" | "1" | "7", stored
     as a string like hour/minute) is added to the row's own
     poolItem.area.caseFoundDate (mock "วันพบเคส" per area) to derive
     the actual Thai date, matching the standard dengue Day 0/1/7
     spraying schedule. See formatThaiDateFromOffset()/
     scheduleTimestamp() below — both now need the row's poolItem
     (for its area.caseFoundDate), not just the entry.
     --------------------------------------------------------- */
  var workplanEntryByKey = {};

  function getOrCreateWorkplanEntry(key, indexInPool) {
    if (!workplanEntryByKey[key]) {
      workplanEntryByKey[key] = {
        assignedTeamId: (indexInPool % 4) + 1, // round-robin 1->4 by selection order
        dayOffset: "0", // "0" | "1" | "7" — Day 0 (วันพบเคส) by default
        hour: indexInPool % 2 === 0 ? "08" : "09",
        minute: "00"
      };
    }
    return workplanEntryByKey[key];
  }

  /* ---------------------------------------------------------
     รอบ 17: "สถานะพ่นแล้ว" (spray-completed) state — separate from
     workplanEntryByKey above, which tracks the *upcoming* scheduled
     spray (team/day/time), not whether each Day 0/1/7 has actually
     been sprayed yet. Keyed by the same pool-item `key` (e.g.
     "1-home" / "1-work") so a case's home and work locations track
     completion independently (รอบ 16 note in BUILD-PLAN.md). Default
     is false for all 3 days; never deleted when a row is hidden or a
     case's active-location tab is toggled off, so re-enabling a
     location later restores its previous spray-completion state.
     --------------------------------------------------------- */
  var sprayDoneByKey = {};

  function getOrCreateSprayDone(key) {
    if (!sprayDoneByKey[key]) {
      sprayDoneByKey[key] = { 0: false, 1: false, 7: false };
    }
    return sprayDoneByKey[key];
  }

  // A row is fully done (and should be hidden from the workplan table /
  // buildWorkplanText()) once all 3 days are checked off.
  function isSprayFullyDone(sprayDone) {
    return !!(sprayDone && sprayDone[0] && sprayDone[1] && sprayDone[7]);
  }

  // Needs poolItem (not just entry) so it can read poolItem.area.caseFoundDate
  // — the Day 0 anchor that dayOffset is added to.
  function scheduleTimestamp(entry, poolItem) {
    var base = poolItem.area.caseFoundDate;
    return new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + parseInt(entry.dayOffset, 10),
      parseInt(entry.hour, 10),
      parseInt(entry.minute, 10)
    ).getTime();
  }

  // Two-level sort: group by assigned team (1->4) first, then by
  // date+time (soonest -> latest) within the same team.
  function sortWorkplanRows(rows) {
    rows.sort(function (a, b) {
      if (a.entry.assignedTeamId !== b.entry.assignedTeamId) {
        return a.entry.assignedTeamId - b.entry.assignedTeamId;
      }
      return scheduleTimestamp(a.entry, a.poolItem) - scheduleTimestamp(b.entry, b.poolItem);
    });
    return rows;
  }

  // Builds the current {poolItem, entry, sprayDone} rows (one per selected
  // area+location), lazily creating any missing schedule entry / spray-done
  // record, then sorts them per sortWorkplanRows(). Shared by the table
  // renderer and buildWorkplanText() so both always agree on row order —
  // includes every row (done or not); callers that only want rows still
  // needing action must filter with isSprayFullyDone() themselves (รอบ 17).
  function getSortedWorkplanRows() {
    var pool = getSelectedPool();
    var rows = pool.map(function (item, i) {
      return {
        poolItem: item,
        entry: getOrCreateWorkplanEntry(item.key, i),
        sprayDone: getOrCreateSprayDone(item.key)
      };
    });
    return sortWorkplanRows(rows);
  }

  /* ---------------------------------------------------------
     Render: workplan schedule table, grouped by team (1->4) then
     sorted soonest -> latest within a team — team <select>, Day
     0/1/7 <select> (รอบ 12, replacing the day/month/ปี(พ.ศ.) select
     trio), 24h hour/minute <select> pair, and (รอบ 17) a "สถานะพ่นแล้ว"
     Day 0/1/7 checkbox group, all reuse .input-inline/native checkbox
     per DESIGN.md Input/Form guideline
     --------------------------------------------------------- */
  function buildWorkplanRowEl(poolItem, entry, isDue, sprayDone) {
    var rowLabel = escapeHtml(poolItem.area.patientName) + " — " + escapeHtml(locDescriptor(poolItem.loc));

    var teamOptionsHtml = TEAM_OPTIONS.map(function (t) {
      return '<option value="' + t + '"' + (t === entry.assignedTeamId ? " selected" : "") + '>ทีมพ่น ' + t + '</option>';
    }).join("");

    var dayOffsetOptionsHtml = DAY_OFFSET_OPTIONS.map(function (opt) {
      return '<option value="' + opt.value + '"' + (String(opt.value) === entry.dayOffset ? " selected" : "") + '>' + escapeHtml(opt.label) + '</option>';
    }).join("");
    var dayOffsetDateText = formatThaiDateFromOffset(poolItem.area.caseFoundDate, entry.dayOffset);

    var hourOptionsHtml = HOUR_OPTIONS.map(function (h) {
      return '<option value="' + h + '"' + (h === entry.hour ? " selected" : "") + '>' + h + '</option>';
    }).join("");
    var minuteOptionsHtml = MINUTE_OPTIONS.map(function (m) {
      return '<option value="' + m + '"' + (m === entry.minute ? " selected" : "") + '>' + m + '</option>';
    }).join("");

    var areaCellHtml =
      '<span class="cell-primary">' + escapeHtml(poolItem.area.patientName) + '</span>' +
      '<span class="cell-secondary">' + escapeHtml(locDescriptor(poolItem.loc)) + ' &middot; ' + poolItem.households + ' หลังคาเรือน (รัศมี ' + poolItem.radius + ' ม.) &middot; ' + escapeHtml(poolItem.area.clusterRef) + '</span>';

    // รอบ 14: "ครบกำหนด" badge, appended right after the computed date
    // text, only when this row's date matches the #workplan-date-filter
    // value — reuses .badge/.badge-warning (no new badge tone added).
    var dueBadgeHtml = isDue ? ' <span class="badge badge-warning">ครบกำหนด</span>' : "";

    // รอบ 17: 3 independent Day 0/1/7 "พ่นแล้ว" checkboxes — plain native
    // checkboxes (no new component), each labeled and bound to
    // sprayDoneByKey[poolItem.key][day] via data-field="sprayDone" +
    // data-day so the delegated change handler in initEvents() can tell
    // them apart from the team/dayOffset/hour/minute <select>s above.
    var sprayDoneHtml = [0, 1, 7].map(function (dayNum) {
      var checkedAttr = sprayDone && sprayDone[dayNum] ? " checked" : "";
      return (
        '<label class="spray-done-item">' +
          '<input type="checkbox" data-field="sprayDone" data-day="' + dayNum + '"' + checkedAttr + ' aria-label="พ่นแล้ว Day ' + dayNum + ' — ' + rowLabel + '">' +
          '<span>Day ' + dayNum + '</span>' +
        '</label>'
      );
    }).join("");

    var tr = document.createElement("tr");
    tr.setAttribute("data-key", poolItem.key);
    if (isDue) tr.className = "row-due-selected";
    tr.innerHTML =
      "<td><select class=\"input-inline\" data-field=\"team\" aria-label=\"ทีมพ่นที่รับผิดชอบ " + rowLabel + "\">" + teamOptionsHtml + "</select></td>" +
      "<td>" + areaCellHtml + "</td>" +
      "<td>" +
        "<select class=\"input-inline select-day-offset\" data-field=\"dayOffset\" aria-label=\"วันพ่น (Day 0/1/7) " + rowLabel + "\">" + dayOffsetOptionsHtml + "</select>" +
        "<span class=\"cell-secondary\">" + escapeHtml(dayOffsetDateText) + dueBadgeHtml + "</span>" +
      "</td>" +
      "<td><span class=\"time-select-group\">" +
        "<select class=\"input-inline select-hm\" data-field=\"hour\" aria-label=\"ชั่วโมงเริ่มปฏิบัติงาน (24 ชม.) " + rowLabel + "\">" + hourOptionsHtml + "</select>" +
        "<span class=\"time-select-sep\">:</span>" +
        "<select class=\"input-inline select-hm\" data-field=\"minute\" aria-label=\"นาทีเริ่มปฏิบัติงาน " + rowLabel + "\">" + minuteOptionsHtml + "</select>" +
      "</span></td>" +
      "<td><span class=\"spray-done-group\">" + sprayDoneHtml + "</span></td>";
    return tr;
  }

  // รอบ 14: renders #workplan-due-summary right below the date-filter
  // bar — text content depends on the filter state (see BUILD-PLAN.md
  // รอบ 14 ข้อ 2): no date chosen -> no message at all; date chosen but
  // nobody due -> "ไม่มีเคส..."; date chosen with matches -> named list.
  function renderWorkplanDueSummary(filterDate, dueList) {
    if (filterDate === null) {
      els.workplanDueSummary.textContent = "";
      return;
    }
    if (dueList.length === 0) {
      els.workplanDueSummary.textContent = "ไม่มีเคสครบกำหนดพ่นในวันที่เลือก";
      return;
    }
    var namesText = dueList.map(function (d) {
      return escapeHtml(d.patientName) + " (ทีมพ่น " + d.teamId + ")";
    }).join(", ");
    els.workplanDueSummary.innerHTML =
      "วันที่ " + escapeHtml(formatThaiDate(filterDate)) + " มีเคสครบกำหนดพ่น " + dueList.length + " ราย: " + namesText;
  }

  // รอบ 17: reports how many rows are currently hidden from the table
  // because they've been marked "พ่นแล้ว" for all of Day 0/1/7 — shown
  // regardless of whether the due-date filter above is active, so users
  // always know some rows aren't being displayed rather than assuming
  // there's simply nothing left to do.
  function renderWorkplanHiddenNote(hiddenCount) {
    els.workplanHiddenNote.textContent = hiddenCount > 0
      ? "(ซ่อน " + hiddenCount + " รายการที่พ่นครบ Day 0/1/7 แล้ว)"
      : "";
  }

  // Fills the day/month/year <select> option lists once at startup
  // (รอบ 15) — the options themselves never change during the session,
  // only which option is selected (see setWorkplanDateFilterSelects()).
  function populateWorkplanDateFilterSelects() {
    els.workplanDateFilterDay.innerHTML = WP_DAY_OPTIONS.map(function (d) {
      return '<option value="' + d + '">' + d + '</option>';
    }).join("");
    els.workplanDateFilterMonth.innerHTML = THAI_MONTHS.map(function (m, i) {
      return '<option value="' + i + '">' + escapeHtml(m) + '</option>';
    }).join("");
    els.workplanDateFilterYear.innerHTML = WP_YEAR_OPTIONS.map(function (y) {
      return '<option value="' + y + '">' + (y + 543) + '</option>'; // display พ.ศ., store ค.ศ.
    }).join("");
  }

  // Sets all 3 <select>s to match a given Date (used for the initial
  // "default to today" and the "วันนี้" button, รอบ 15).
  function setWorkplanDateFilterSelects(date) {
    els.workplanDateFilterDay.value = pad2(date.getDate());
    els.workplanDateFilterMonth.value = String(date.getMonth());
    els.workplanDateFilterYear.value = String(date.getFullYear());
  }

  // รอบ 17: rows that are fully "พ่นแล้ว" (Day 0/1/7 all checked) are
  // filtered out of the rendered table entirely — this filter runs after
  // team-grouping/sorting so the remaining rows keep their existing order.
  function renderWorkplanSchedule() {
    var allRows = getSortedWorkplanRows();
    var visibleRows = allRows.filter(function (row) { return !isSprayFullyDone(row.sprayDone); });
    var hiddenCount = allRows.length - visibleRows.length;
    var filterDate = getWorkplanFilterDate();
    var dueList = [];

    els.workplanScheduleBody.innerHTML = "";

    if (visibleRows.length === 0) {
      var emptyTr = document.createElement("tr");
      emptyTr.innerHTML = '<td colspan="5" class="table-empty-note">ทุกรายการพ่นควบคุมโรคครบ Day 0/1/7 แล้ว ไม่มีรายการที่ต้องดำเนินการเพิ่มเติม</td>';
      els.workplanScheduleBody.appendChild(emptyTr);
    } else {
      visibleRows.forEach(function (row) {
        var isDue = filterDate !== null && sameYMD(scheduleDateOnly(row.entry, row.poolItem), filterDate);
        if (isDue) {
          dueList.push({ patientName: row.poolItem.area.patientName, teamId: row.entry.assignedTeamId });
        }
        els.workplanScheduleBody.appendChild(buildWorkplanRowEl(row.poolItem, row.entry, isDue, row.sprayDone));
      });
    }

    renderWorkplanDueSummary(filterDate, dueList);
    renderWorkplanHiddenNote(hiddenCount);
  }

  /* ---------------------------------------------------------
     Approval request state machine: draft -> sent (รออนุมัติ) -> approved
     | rejected (BUILD-PLAN.md รอบ 23 — "rejected" added as a second
     terminal state alongside "approved", mutually exclusive with it)
     --------------------------------------------------------- */
  var approvalState = "draft"; // "draft" | "sent" | "approved" | "rejected"
  var approvalSentAtLabel = "";
  var approvalApprovedAtLabel = "";
  var approvalRejectedAtLabel = ""; // BUILD-PLAN.md รอบ 23

  /* ---------------------------------------------------------
     Render: mini-map — แผนที่จริง OpenStreetMap (osm-map.js) แสดง
     เฉพาะ (พื้นที่+ตำแหน่ง) ที่เลือกอยู่ พร้อมวงรัศมีพ่นจริงเป็นเมตร
     ตามรัศมีที่เลือกต่อรายการ
     --------------------------------------------------------- */
  var miniMap = null;
  var miniMapSelectionKey = null;

  function renderMiniMap(pool) {
    if (!miniMap) miniMap = window.AidsrpMap.create(els.miniMapWrap);
    if (!miniMap) return;
    miniMap.layer.clearLayers();

    var points = [];
    pool.forEach(function (item) {
      if (typeof item.loc.lat !== "number" || typeof item.loc.lng !== "number") return; // ไม่มีพิกัด -> ไม่ปักหมุด
      var isHome = item.loc.type === "home";
      var color = isHome ? "#8A9A5B" : "#7A6A53"; // secondary = home, primary = work/school, matches .pin-normal/.pin-adjusted
      var latlng = [item.loc.lat, item.loc.lng];
      L.circle(latlng, { radius: item.radius, color: color, weight: 1.5, fillColor: color, fillOpacity: 0.14 }).addTo(miniMap.layer);
      L.circleMarker(latlng, { radius: 6, color: "#FFFFFF", weight: 2, fillColor: color, fillOpacity: 1 })
        .bindTooltip((isHome ? "บ้าน" : "ที่ทำงาน/เรียน") + " · " + escapeHtml(item.area.patientName), { direction: "top", offset: [0, -6] })
        .bindPopup(
          "<strong>" + escapeHtml(item.area.patientName) + "</strong><br>" + escapeHtml(locDescriptor(item.loc)) +
          "<br>รัศมี " + item.radius + " ม. &middot; " + item.households + " หลังคาเรือน (ประมาณ)<br>" +
          item.loc.lat.toFixed(4) + ", " + item.loc.lng.toFixed(4)
        )
        .addTo(miniMap.layer);
      points.push(latlng);
    });

    // ซูมใหม่เฉพาะเมื่อชุดตำแหน่งที่เลือกเปลี่ยน — เปลี่ยนรัศมี/ชนิดน้ำมันไม่กระโดดมุมมอง
    var key = pool.map(function (item) { return item.area.id + ":" + item.loc.type; }).join(",");
    if (key !== miniMapSelectionKey) {
      window.AidsrpMap.fit(miniMap.map, points, 16);
      miniMapSelectionKey = key;
      renderMiniMapZoomButtons(pool, points);
    }
  }

  // พื้นที่อยู่คนละจังหวัด มุมมองรวมจึงซูมออกกว้าง — ปุ่มใต้แผนที่ซูมไปทีละพื้นที่ (ตำแหน่งที่เลือกของเคสนั้น)
  function renderMiniMapZoomButtons(pool, allPoints) {
    var bar = document.getElementById("control-plan-mini-map-zoom");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "control-plan-mini-map-zoom";
      bar.className = "map-zoom-bar";
      els.miniMapWrap.parentNode.insertBefore(bar, els.miniMapWrap.nextSibling);
    }
    var byArea = {};
    pool.forEach(function (item) {
      if (!byArea[item.area.id]) byArea[item.area.id] = { area: item.area, items: [] };
      byArea[item.area.id].items.push(item);
    });
    bar.innerHTML = '<span class="body-secondary">ซูมไปที่:</span>';
    var addButton = function (label, onClick) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-outline btn-sm";
      btn.textContent = label;
      btn.addEventListener("click", onClick);
      bar.appendChild(btn);
    };
    Object.keys(byArea).forEach(function (id) {
      var group = byArea[id];
      addButton(group.area.name, function () {
        var bounds = null;
        group.items.forEach(function (item) {
          if (typeof item.loc.lat !== "number") return;
          var b = L.latLng(item.loc.lat, item.loc.lng).toBounds(item.radius * 2);
          bounds = bounds ? bounds.extend(b) : b;
        });
        if (bounds) miniMap.map.fitBounds(bounds, { padding: [30, 30] });
      });
    });
    if (Object.keys(byArea).length > 1) {
      addButton("ทั้งหมด", function () { window.AidsrpMap.fit(miniMap.map, allPoints, 16); });
    }
  }

  /* ---------------------------------------------------------
     Render: area/location selection list + running summary +
     mini-map (รอบ 13 rewrite, toggle behaviour updated รอบ 16).
     Each case's card is headed by the patient's name; a 2-button
     tab pair ("ชุมชน (ที่อยู่)" / "ชุมชน (ที่ทำงาน)") toggles which
     location(s) are active per case (activeLocTypesByAreaId — 1 or
     both at once) — the fields shown below the tabs change to
     match: address+house-no text inputs for "home", a single
     workplace/school-name text input for "work" — both cases
     followed by the same radius <select> (100/150/200 m) driving a
     live household estimate = baseHouseholdsAt100m * (radius/100)^2.
     When both locations are active, each gets its own labeled field
     block (own address/name + own radius + own household count —
     never shared). All text inputs are directly editable (not
     read-only mock text) and sync back into AREAS[i].locations[j]
     immediately on "input".
     --------------------------------------------------------- */
  function buildAreaFieldsHtml(area, loc) {
    var key = getLocationKey(area.id, loc.type);
    var radius = getRadiusForKey(key, loc);
    var households = computeHouseholds(loc, radius);
    var fuelType = getFuelTypeForKey(key);

    var radiusOptionsHtml = RADIUS_OPTIONS.map(function (r) {
      return '<option value="' + r + '"' + (r === radius ? " selected" : "") + '>' + r + " เมตร</option>";
    }).join("");

    var fuelTypeOptionsHtml = FUEL_TYPE_OPTIONS.map(function (opt) {
      return '<option value="' + opt.value + '"' + (opt.value === fuelType ? " selected" : "") + '>' + escapeHtml(opt.label) + '</option>';
    }).join("");

    var fieldsHtml = loc.type === "home"
      ? (
          '<div class="area-select-field-row">' +
            '<label class="area-select-field-label">ที่อยู่' +
              '<input type="text" class="input-inline" data-area-id="' + area.id + '" data-loc-type="home" data-field="address" value="' + escapeHtml(loc.address) + '" aria-label="ที่อยู่ &mdash; ' + escapeHtml(area.patientName) + '">' +
            '</label>' +
            '<label class="area-select-field-label field-houseno">เลขที่' +
              '<input type="text" class="input-inline" data-area-id="' + area.id + '" data-loc-type="home" data-field="houseNo" value="' + escapeHtml(loc.houseNo) + '" aria-label="เลขที่บ้าน &mdash; ' + escapeHtml(area.patientName) + '">' +
            '</label>' +
          '</div>'
        )
      : (
          '<div class="area-select-field-row">' +
            '<label class="area-select-field-label">สถานที่ทำงาน/เรียน' +
              '<input type="text" class="input-inline" data-area-id="' + area.id + '" data-loc-type="work" data-field="name" value="' + escapeHtml(loc.name) + '" aria-label="สถานที่ทำงาน/เรียน &mdash; ' + escapeHtml(area.patientName) + '">' +
            '</label>' +
          '</div>'
        );

    return (
      '<div class="area-select-fields">' +
        fieldsHtml +
        '<div class="area-select-controls">' +
          '<label class="area-select-radius-label">รัศมี ' +
            '<select class="input-inline input-inline-sm radius-select" data-area-id="' + area.id + '" data-loc-type="' + loc.type + '" aria-label="รัศมีที่ต้องพ่น &mdash; ' + escapeHtml(area.patientName) + '">' + radiusOptionsHtml + '</select>' +
          '</label>' +
          '<label class="area-select-radius-label">ชนิดน้ำมัน/น้ำยาเคมี ' +
            '<select class="input-inline input-inline-md fuel-type-select" data-area-id="' + area.id + '" data-loc-type="' + loc.type + '" aria-label="ชนิดน้ำมัน/น้ำยาเคมี &mdash; ' + escapeHtml(area.patientName) + '">' + fuelTypeOptionsHtml + '</select>' +
          '</label>' +
          '<span class="area-select-meta"><span>' + households + ' หลังคาเรือน (ประมาณจากรัศมีที่เลือก)</span></span>' +
        '</div>' +
      '</div>'
    );
  }

  // รอบ 16: the 2 tab buttons are now independent on/off toggles (not an
  // exclusive pair) — both can show active at once. When 2 locations are
  // active, the field block from buildAreaFieldsHtml() is rendered once
  // per active location (in home-then-work order), each preceded by a
  // sub-heading so the two stay visually distinct; with only 1 active
  // (the common case) it renders exactly as รอบ 13 did, with no heading.
  function buildAreaGroup(area) {
    var activeTypes = activeLocTypesByAreaId[area.id] || ["home"];
    var homeActive = activeTypes.indexOf("home") !== -1;
    var workActive = activeTypes.indexOf("work") !== -1;

    var tabHomeClass = "btn btn-sm loc-tab-btn " + (homeActive ? "btn-primary" : "btn-outline");
    var tabWorkClass = "btn btn-sm loc-tab-btn " + (workActive ? "btn-primary" : "btn-outline");

    var orderedActiveTypes = LOC_TYPE_ORDER.filter(function (t) { return activeTypes.indexOf(t) !== -1; });
    var showSubHeadings = orderedActiveTypes.length > 1;
    var subHeadingText = { home: "ชุมชน (ที่อยู่)", work: "ชุมชน (ที่ทำงาน)" };

    var fieldSectionsHtml = orderedActiveTypes.map(function (locType) {
      var loc = findLocation(area.id, locType);
      var headingHtml = showSubHeadings
        ? '<div class="area-select-subheading">' + escapeHtml(subHeadingText[locType]) + '</div>'
        : "";
      return headingHtml + buildAreaFieldsHtml(area, loc);
    }).join("");

    // รอบ 18: "ไฟล์ต้นฉบับ" link right after the patientName heading —
    // reuses .file-link + ICON_FILE from case-intake.js's pattern
    // exactly (href="#", mock preventDefault() on click — see the
    // .file-link click handler in initEvents() below).
    var fileLinkHtml = area.sourceUrl
      ? '<a class="file-link" href="' + escapeHtml(area.sourceUrl) + '" target="_blank" rel="noopener" title="เปิดไฟล์ต้นฉบับใน Google Drive">' +
          ICON_FILE + "ไฟล์ต้นฉบับ" + '</a>'
      : '<span class="body-secondary">' + escapeHtml(area.caseId) + '</span>';
    var hasWork = !!findLocation(area.id, "work");

    return (
      '<div class="area-select-group">' +
        '<div class="area-select-group-head">' +
          '<span class="area-select-name-group">' +
            '<span class="area-select-name">' + escapeHtml(area.patientName) + '</span>' +
            fileLinkHtml +
          '</span>' +
          '<span class="badge badge-' + (area.riskLevel === "สูง" ? "warning" : "neutral") + '">ความเสี่ยง' + escapeHtml(area.riskLevel) + '</span>' +
        '</div>' +
        '<div class="area-select-group-meta">' + escapeHtml(area.name) + ' &middot; ' + escapeHtml(area.clusterRef) + '</div>' +
        '<div class="loc-tab-group" role="group" aria-label="เลือกสถานที่ควบคุมโรคของ ' + escapeHtml(area.patientName) + ' (เลือกได้มากกว่า 1 แห่ง)">' +
          '<button type="button" class="' + tabHomeClass + '" data-area-id="' + area.id + '" data-loc-type="home" aria-pressed="' + homeActive + '">ชุมชน (ที่อยู่)</button>' +
          (hasWork
            ? '<button type="button" class="' + tabWorkClass + '" data-area-id="' + area.id + '" data-loc-type="work" aria-pressed="' + workActive + '">ชุมชน (ที่ทำงาน)</button>'
            : '<button type="button" class="btn btn-sm btn-outline" disabled title="ทะเบียนยังไม่มีสถานที่ทำงาน/เรียนของเคสนี้">ชุมชน (ที่ทำงาน)</button>') +
        '</div>' +
        fieldSectionsHtml +
      '</div>'
    );
  }

  function renderAreaList() {
    if (!AREAS.length) {
      els.areaSelectList.innerHTML = '<p class="body-secondary">' + escapeHtml(loadInfo.loading
        ? "กำลังโหลดเคสจาก Google Sheet..."
        : (loadInfo.error || "ไม่มีเคสที่เริ่มป่วยในช่วงเวลาที่เลือก")) + "</p>";
    } else {
      els.areaSelectList.innerHTML = AREAS.map(buildAreaGroup).join("");
    }

    var pool = getSelectedPool();
    var totalHouseholds = pool.reduce(function (sum, item) { return sum + item.households; }, 0);
    // รอบ 16: pool.length can now exceed AREAS.length when a case has both
    // "home" and "work" active at once, so the summary counts "จุดควบคุมโรค"
    // (control-plan sites/pool items) alongside the underlying case count.
    els.areaSelectSummary.textContent =
      "ทุกเคสอยู่ในแผนเสมอ — ทั้งหมด " + pool.length + " จุดควบคุมโรค (จาก " + AREAS.length + " เคส) · รวม " + totalHouseholds + " หลังคาเรือน (ประมาณ)";

    // รอบ 13: every case is always in the plan, so the pool is never
    // empty — the "สร้างร่างเอกสาร" button no longer needs to be
    // disabled based on pool.length.
    els.btnGenerateApproval.disabled = false;

    renderMiniMap(pool);
  }

  /* ---------------------------------------------------------
     Approval document generation — mirrors the real municipal
     paper form "บันทึกขออนุมัติจัดซื้อน้ำมันเชื้อเพลิง/แก๊ส"
     (ตัวอย่างจริงที่ผู้ใช้ให้มา 2026-08-20 รอบ 11) field-for-field,
     filled in from the selected (area+location+radius) pool's
     real computed mock data. App state (draft/sent/approved) is
     tracked separately via approvalState — this text only mirrors
     the paper form's blank signature lines, it isn't wired to them.
     --------------------------------------------------------- */
  var ULV_UNIT_SETS = ["022/023", "024/025", "026/027"];

  function buildApprovalText(pool) {
    var totalHouseholds = pool.reduce(function (sum, item) { return sum + item.households; }, 0);
    var ulvUnits = ULV_UNIT_SETS[(pool.length - 1) % ULV_UNIT_SETS.length];

    // Mock fuel-liter estimate: no real consumption data exists in this
    // prototype, so scale a plausible figure off the households/areas
    // covered — same "mock, needs human review" spirit as the rest of
    // this AI-drafted document.
    var dieselLiters = Math.max(10, Math.round(totalHouseholds * 0.5));
    var gasoholLiters = Math.max(5, pool.length * 5);
    var lubricantLiters = Math.max(2, pool.length * 2);

    // BUILD-PLAN.md รอบ 23: aggregate each pool item's chosen fuelType
    // (enum(gasoline, diesel, lubricant, chemical, other) — DATA-MODEL.md)
    // into a ☑/☐ mark per checkbox line below, instead of the old
    // always-☑-diesel/gasohol/lubricant + always-☐-other. The real paper
    // form has no separate "น้ำยาเคมี" box, so "chemical" is folded into
    // the "อื่นๆ" line together with "other" (per BUILD-PLAN.md note).
    var hasGasoline = pool.some(function (item) { return item.fuelType === "gasoline"; });
    var hasDiesel = pool.some(function (item) { return item.fuelType === "diesel"; });
    var hasLubricant = pool.some(function (item) { return item.fuelType === "lubricant"; });
    var hasOther = pool.some(function (item) { return item.fuelType === "chemical" || item.fuelType === "other"; });

    var markDiesel = hasDiesel ? "☑" : "☐";
    var markGasohol = hasGasoline ? "☑" : "☐";
    var markLubricant = hasLubricant ? "☑" : "☐";
    var markOther = hasOther ? "☑" : "☐";

    var siteListText = pool.map(function (item, i) {
      return (i + 1) + ". " + item.area.patientName + " — " + locDescriptor(item.loc) + " (" + item.households + " หลังคาเรือน, รัศมี " + item.radius + " ม.)";
    }).join("\n");

    var lines = [
      "บิลที่ ..................................................",
      "เล่มที่/เลขที่ .......................................",
      "",
      "บันทึกขออนุมัติจัดซื้อน้ำมันเชื้อเพลิง/แก๊ส",
      "",
      "ส่วนราชการ เทศบาล กองการแพทย์ งานเวชกรรมสังคม",
      "ที่ ......................../.......................... ลงวันที่ " + formatThaiDate(new Date()),
      "เรื่อง ขออนุมัติจัดซื้อน้ำมันเชื้อเพลิงและหล่อลื่น โดยเฉพาะเจาะจง",
      "เรียน ผู้อำนวยการกองการแพทย์",
      "",
      "ข้าพเจ้า .................................................... พนักงานพ่นเคมี",
      "☑ หมอกควัน/ULV หมายเลข " + ulvUnits,
      "",
      "ได้ออกปฏิบัติงานพ่นเคมี หมอกควัน/ULV ครั้งที่ .......... ในการควบคุมการแพร่ระบาดของโรคไข้เลือดออก",
      "วันที่ " + formatThaiDate(new Date()) + " จำนวน " + pool.length + " แห่ง ณ",
      siteListText,
      "",
      "ขออนุมัติเบิกจ่ายน้ำมันเชื้อเพลิง ดังนี้",
      markDiesel + " ดีเซล        จำนวน " + dieselLiters + " ลิตร        " + markGasohol + " แก๊สโซฮอล์ 95   จำนวน " + gasoholLiters + " ลิตร",
      markLubricant + " น้ำมันหล่อลื่น   จำนวน " + lubricantLiters + " ลิตร        " + markOther + " อื่นๆ ....................... จำนวน ......... ลิตร",
      "",
      "จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ",
      "",
      "ลงชื่อ.................................................... พนักงานทีมพ่นเคมี",
      "(....................................................)",
      "",
      "ลงชื่อ.................................................... หัวหน้างาน",
      "(....................................................)",
      "",
      "ผู้อนุมัติ",
      "☐ ดีเซล        จำนวน ......... ลิตร        ☐ แก๊สโซฮอล์ 95   จำนวน ......... ลิตร",
      "☐ น้ำมันหล่อลื่น   จำนวน ......... ลิตร        ☐ อื่นๆ ....................... จำนวน ......... ลิตร",
      "ลงชื่อ.................................................... ผู้อนุมัติ",
      "(....................................................)",
      "",
      "กรรมการตรวจรับพัสดุ",
      "ได้ตรวจสอบปริมาณครบถ้วน ถูกต้องเรียบร้อยแล้ว",
      "ลงชื่อ.................................................... เจ้าหน้าที่ตรวจรับวัสดุเชื้อเพลิง",
      "(....................................................)",
      "",
      "หมายเหตุ: ร่างเอกสารนี้สร้างโดยระบบ AI ตามแบบฟอร์มจริงของหน่วยงาน จากพื้นที่/ตำแหน่งและรัศมีที่เลือกไว้ในระบบ (พิกัดในระบบต้นแบบเป็นข้อมูลสมมุติ; จำนวนน้ำมันเป็นตัวเลขประมาณการ) โปรดตรวจสอบความถูกต้อง กรอกช่องว่าง และลงนามจริงก่อนยื่นขออนุมัติ"
    ];
    return lines.join("\n");
  }

  // Keeps the hidden #approval-print-view <pre> (รอบ 12) in sync with the
  // editable textarea, so window.print() (triggered from "พิมพ์เป็น PDF")
  // always prints the latest text the user sees/edited — a plain <pre>
  // instead of the <textarea> itself so print output isn't clipped to a
  // scrollable box. Uses textContent (not innerHTML) so no HTML-escaping
  // is needed for arbitrary user-edited text.
  function syncApprovalPrintView() {
    if (els.approvalPrintView) els.approvalPrintView.textContent = els.approvalTextarea.value;
  }

  function generateApproval() {
    var pool = getSelectedPool(); // at least AREAS.length items (one per case, more if a case has both locations active — รอบ 16)

    els.approvalTextarea.value = buildApprovalText(pool);
    syncApprovalPrintView();
    approvalState = "draft";
    els.btnSendApproval.disabled = false;
    els.btnMockApprove.style.display = "none";
    els.btnMockReject.style.display = "none";
    els.btnPrintApproval.style.display = "none";
    els.approvalStatus.innerHTML = "";
  }

  function sendApproval() {
    var text = els.approvalTextarea.value.trim();
    if (!text) return;

    approvalState = "sent";
    approvalSentAtLabel = formatThaiDateTime(new Date());
    els.approvalStatus.innerHTML = '<span class="badge badge-warning">รออนุมัติ &middot; ส่งเมื่อ ' + escapeHtml(approvalSentAtLabel) + "</span>";
    els.btnSendApproval.disabled = true;
    els.btnMockApprove.style.display = "";
    els.btnMockReject.style.display = "";
    els.btnPrintApproval.style.display = "";
    syncApprovalPrintView();
  }

  function mockApprove() {
    if (approvalState !== "sent") return;

    approvalState = "approved";
    approvalApprovedAtLabel = formatThaiDateTime(new Date());
    els.approvalStatus.innerHTML = '<span class="badge badge-confirmed">' + ICON_CHECK + "อนุมัติแล้ว &middot; " + escapeHtml(approvalApprovedAtLabel) + "</span>";
    els.btnMockApprove.style.display = "none";
    els.btnMockReject.style.display = "none";
  }

  // BUILD-PLAN.md รอบ 23: "ไม่อนุมัติ" — terminal state alongside "approved"
  // above (mutually exclusive: reaching one hides both action buttons, same
  // as mockApprove() does). Only reachable from "sent", matching the state
  // machine note above the approvalState declaration.
  function mockReject() {
    if (approvalState !== "sent") return;

    approvalState = "rejected";
    approvalRejectedAtLabel = formatThaiDateTime(new Date());
    els.approvalStatus.innerHTML = '<span class="badge badge-danger">ไม่อนุมัติแล้ว &middot; ' + escapeHtml(approvalRejectedAtLabel) + "</span>";
    els.btnMockReject.style.display = "none";
    els.btnMockApprove.style.display = "none";
  }

  // "พิมพ์เป็น PDF" (รอบ 12) — no PDF library involved; this just opens
  // the browser's native print dialog (users choose "Save as PDF" as
  // the print destination there), styled via the @media print rules in
  // styles.css that hide everything except #approval-print-view.
  function printApproval() {
    syncApprovalPrintView();
    window.print();
  }

  /* ---------------------------------------------------------
     Control workplan generation — template text filled in with
     mock spray-team assignments/dates/steps (not free-form AI
     generation, see BUILD-PLAN.md assumption)
     --------------------------------------------------------- */
  function buildWorkplanText() {
    // Group by team (1->4), sorted soonest -> latest within each team —
    // matches the table's current row order (รอบ 10). รอบ 17: excludes
    // rows already fully "พ่นแล้ว" (Day 0/1/7 all checked), matching
    // exactly what's currently visible in #workplan-schedule-table.
    var rows = getSortedWorkplanRows().filter(function (row) { return !isSprayFullyDone(row.sprayDone); });

    var assignmentLines = rows.length > 0
      ? rows.map(function (row, i) {
          var poolItem = row.poolItem;
          var entry = row.entry;
          var areaText = poolItem.area.patientName + " — " + locDescriptor(poolItem.loc) + " (" + poolItem.households + " หลังคาเรือน, รัศมี " + poolItem.radius + " ม.)";
          var whenText = "ปฏิบัติงาน Day " + entry.dayOffset + " (" + formatThaiDateFromOffset(poolItem.area.caseFoundDate, entry.dayOffset) + ") เวลา " + entry.hour + ":" + entry.minute + " น.";
          return (i + 1) + ". ทีมพ่น " + entry.assignedTeamId + " — รับผิดชอบ " + areaText + " — " + whenText;
        })
      : ["(ไม่มีรายการที่ต้องปฏิบัติงาน — ทุกรายการพ่นควบคุมโรคครบ Day 0/1/7 แล้ว)"];

    var lines = [
      "แผนปฏิบัติงานควบคุมโรค (ร่างโดยระบบ AI)",
      "สร้างเมื่อ: " + formatThaiDateTime(new Date()),
      "",
      "การมอบหมายทีม:"
    ].concat(assignmentLines).concat([
      "",
      "ขั้นตอนปฏิบัติงาน:",
      "1. ประชุมทีมและตรวจสอบอุปกรณ์/น้ำยาเคมีก่อนออกปฏิบัติงาน 07:30 น.",
      "2. แจ้ง อสม./ผู้นำชุมชนในพื้นที่ล่วงหน้า 1 วัน ให้เตรียมเปิดบ้านรับทีมพ่น",
      "3. พ่นสารเคมีกำจัดยุงลายภายในและรอบบ้านตามรัศมีที่กำหนด เริ่มจากตำแหน่งผู้ป่วยออกไปยังรอบนอก",
      "4. สำรวจและทำลายแหล่งเพาะพันธุ์ลูกน้ำยุงลาย (ภาชนะขังน้ำ) ควบคู่กับการพ่นสารเคมี",
      "5. บันทึกภาพถ่ายหน้าบ้าน/สถานที่ที่พ่นแล้วทุกจุด พร้อมพิกัดและเวลา เพื่อใช้ตรวจสอบย้อนหลัง",
      "6. รายงานผลความคืบหน้าผ่านหน้า Field Tracking ทุก 2 ชั่วโมงระหว่างปฏิบัติงาน",
      "",
      "มาตรการป้องกันทีมปฏิบัติงาน:",
      "- สวมอุปกรณ์ป้องกันส่วนบุคคล (PPE): หน้ากาก แว่นตา ถุงมือ เสื้อแขนยาว ตลอดการพ่นสารเคมี",
      "- หลีกเลี่ยงการพ่นสารเคมีในบริเวณที่มีอาหาร/แหล่งน้ำดื่มโดยไม่ปิดคลุมป้องกันก่อน",
      "- พักดื่มน้ำและล้างมือทุก 1 ชั่วโมง งดสูบบุหรี่ระหว่างพ่นสารเคมี",
      "",
      "หมายเหตุ: ร่างแผนนี้สร้างโดยระบบ AI จากพื้นที่/ตำแหน่งที่เลือกไว้ในระบบ โปรดตรวจสอบความถูกต้องและปรับแก้ให้เหมาะกับสถานการณ์จริงก่อนใช้งาน"
    ]);
    return lines.join("\n");
  }

  function generateWorkplan() {
    els.workplanTextarea.value = buildWorkplanText();
    els.btnConfirmWorkplan.disabled = false;
    els.workplanStatus.innerHTML = "";
  }

  function confirmWorkplan() {
    var text = els.workplanTextarea.value.trim();
    if (!text) return;

    els.workplanStatus.innerHTML = '<span class="badge badge-confirmed">' + ICON_CHECK + "ยืนยันใช้แผนนี้แล้ว &middot; " + formatThaiDateTime(new Date()) + "</span>";

    // รอบ 20: once the workplan is confirmed, carry the user straight on
    // to the next step (drafting the fuel/chemical approval request)
    // instead of leaving them to scroll down and find it themselves.
    var approvalPanel = document.getElementById("control-plan-approval-panel");
    if (approvalPanel) approvalPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------------------------------------------------------
     Event wiring
     --------------------------------------------------------- */
  function initEvents() {
    // Tab click (รอบ 16: independent on/off toggle, not exclusive-select) —
    // clicking a tab that's NOT active adds it to that case's active-location
    // set (so both "home" and "work" can be active together); clicking a tab
    // that IS active removes it, but only if the other location is also
    // active (a case must always keep at least 1 active location — clicking
    // the sole remaining active tab is a no-op). Re-renders the whole list
    // (fields shown depend on the active set) plus the workplan table/
    // mini-map that read from the same pool.
    // รอบ 18: "ไฟล์ต้นฉบับ" link click — mock only, same behaviour as
    // case-intake.js's .file-link handler (no real file to open in this
    // static prototype).
    els.areaSelectList.addEventListener("click", function (e) {
      var fileLink = e.target.closest(".file-link");
      if (fileLink && fileLink.getAttribute("href") === "#") {
        e.preventDefault();
      }
    });

    els.areaSelectList.addEventListener("click", function (e) {
      var tabBtn = e.target.closest(".loc-tab-btn");
      if (!tabBtn) return;
      var areaId = parseInt(tabBtn.getAttribute("data-area-id"), 10);
      var locType = tabBtn.getAttribute("data-loc-type");
      var activeTypes = activeLocTypesByAreaId[areaId] || ["home"];
      var idx = activeTypes.indexOf(locType);
      if (idx === -1) {
        activeTypes = activeTypes.concat([locType]);
      } else if (activeTypes.length > 1) {
        activeTypes = activeTypes.filter(function (t) { return t !== locType; });
      } // else: sole remaining active tab — no-op, keep at least 1 active
      activeLocTypesByAreaId[areaId] = activeTypes;
      renderAreaList();
      renderWorkplanSchedule();
      schedulePersist(areaId);
    });

    // Address / house-no / workplace-name text inputs — sync straight into
    // AREAS[i].locations[j] on every keystroke (no separate save step).
    // Deliberately does NOT re-render #area-select-list itself (that would
    // rebuild the input's innerHTML and steal focus/caret mid-typing) —
    // only the mini-map/workplan table, which live in separate containers,
    // are refreshed so their location-detail text stays in sync live.
    els.areaSelectList.addEventListener("input", function (e) {
      var fieldInput = e.target.closest("input[data-field]");
      if (!fieldInput) return;
      var areaId = parseInt(fieldInput.getAttribute("data-area-id"), 10);
      var locType = fieldInput.getAttribute("data-loc-type");
      var field = fieldInput.getAttribute("data-field"); // "address" | "houseNo" | "name"
      var loc = findLocation(areaId, locType);
      if (!loc) return;
      loc[field] = fieldInput.value;
      renderMiniMap(getSelectedPool());
      renderWorkplanSchedule();
      schedulePersist(areaId);
    });

    els.areaSelectList.addEventListener("change", function (e) {
      var radiusSelect = e.target.closest("select.radius-select");
      if (radiusSelect) {
        var rKey = getLocationKey(parseInt(radiusSelect.getAttribute("data-area-id"), 10), radiusSelect.getAttribute("data-loc-type"));
        radiusByKey[rKey] = parseInt(radiusSelect.value, 10);
        renderAreaList();
        renderWorkplanSchedule();
        schedulePersist(parseInt(radiusSelect.getAttribute("data-area-id"), 10));
        return;
      }

      var fuelTypeSelect = e.target.closest("select.fuel-type-select");
      if (fuelTypeSelect) {
        var fKey = getLocationKey(parseInt(fuelTypeSelect.getAttribute("data-area-id"), 10), fuelTypeSelect.getAttribute("data-loc-type"));
        fuelTypeByKey[fKey] = fuelTypeSelect.value;
        schedulePersist(parseInt(fuelTypeSelect.getAttribute("data-area-id"), 10));
        // No full renderAreaList()/renderWorkplanSchedule() needed — fuel
        // type doesn't affect the mini-map, household count, or workplan
        // table, only the aggregated ☑/☐ checkboxes computed at
        // buildApprovalText() generation time (from the pool's current
        // fuelType, read fresh via getSelectedPool() there).
        return;
      }
    });

    els.workplanScheduleBody.addEventListener("change", function (e) {
      var input = e.target.closest("[data-field]");
      if (!input) return;
      var tr = input.closest("tr[data-key]");
      if (!tr) return;
      var key = tr.getAttribute("data-key");
      var field = input.getAttribute("data-field"); // "team" | "dayOffset" | "hour" | "minute" | "sprayDone"

      // รอบ 17: "สถานะพ่นแล้ว" Day 0/1/7 checkboxes update sprayDoneByKey
      // (separate from workplanEntryByKey below) — re-rendering afterwards
      // may hide this row entirely if all 3 days are now checked.
      if (field === "sprayDone") {
        var sprayDone = getOrCreateSprayDone(key);
        var day = input.getAttribute("data-day");
        sprayDone[day] = input.checked;
        renderWorkplanSchedule();
        schedulePersist(parseInt(key, 10));
        return;
      }

      var entry = workplanEntryByKey[key];
      if (!entry) return;
      if (field === "team") {
        entry.assignedTeamId = parseInt(input.value, 10);
      } else {
        entry[field] = input.value; // dayOffset ("0"/"1"/"7") and hour/minute all stay as plain strings
      }
      renderWorkplanSchedule(); // re-sorts (team asc, then soonest -> latest) and re-renders the whole table
      schedulePersist(parseInt(key, 10));
    });

    // รอบ 14: date filter bar above the workplan table — every change
    // just re-runs renderWorkplanSchedule(), which already re-reads the
    // filter value on every call (see getWorkplanFilterDate() above), so
    // rows/badges/summary all stay in sync without any extra state.
    // รอบ 15: the native date input is now a day/month/year <select>
    // trio — changing any one of the 3 (re-)activates the filter (a
    // select always has some value chosen, so "active" is tracked
    // separately via workplanDateFilterActive rather than an empty
    // input value).
    [els.workplanDateFilterDay, els.workplanDateFilterMonth, els.workplanDateFilterYear].forEach(function (sel) {
      sel.addEventListener("change", function () {
        workplanDateFilterActive = true;
        renderWorkplanSchedule();
      });
    });
    els.btnWorkplanDateToday.addEventListener("click", function () {
      setWorkplanDateFilterSelects(new Date());
      workplanDateFilterActive = true;
      renderWorkplanSchedule();
    });
    els.btnWorkplanDateClear.addEventListener("click", function () {
      workplanDateFilterActive = false;
      renderWorkplanSchedule();
    });

    els.btnGenerateApproval.addEventListener("click", generateApproval);
    els.btnSendApproval.addEventListener("click", sendApproval);
    els.btnMockApprove.addEventListener("click", mockApprove);
    els.btnMockReject.addEventListener("click", mockReject);
    els.btnPrintApproval.addEventListener("click", printApproval);
    els.approvalTextarea.addEventListener("input", syncApprovalPrintView);
    els.btnGenerateWorkplan.addEventListener("click", generateWorkplan);
    els.btnConfirmWorkplan.addEventListener("click", confirmWorkplan);
  }

  /* ---------------------------------------------------------
     เคสจริง -> AREAS + คืนค่าที่เคยเลือกจากแท็บ "แผนควบคุมโรค"
     --------------------------------------------------------- */
  function startOfDay(d) {
    var x = new Date(d.getTime());
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function applyCases(detail) {
    var clusterByKey = {};
    detail.clusters.forEach(function (cl) { clusterByKey[cl.clusterId] = cl; });
    var confirmed = {};
    (detail.state && detail.state.clusters || []).forEach(function (s) { if (s.status === "ยืนยันแล้ว") confirmed[s.clusterId] = true; });
    var planByKey = {};
    (detail.state && detail.state.controlPlan || []).forEach(function (r) { planByKey[r.planKey] = r; });

    AREAS = detail.cases.map(function (c, i) {
      var cl = c.clusterId ? clusterByKey[c.clusterId] : null;
      var locations = [{
        type: "home", label: "ที่อยู่ (บ้าน)", address: c.address || ("ต." + c.subdistrict), houseNo: "",
        lat: c.home ? c.home.lat : null, lng: c.home ? c.home.lng : null,
        baseHouseholdsAt100m: HOUSEHOLDS_PER_100M_ESTIMATE, defaultRadius: 100
      }];
      if (c.workplace || c.work) {
        locations.push({
          type: "work", label: "สถานที่ทำงาน/เรียน", name: c.workplace || "สถานที่ทำงาน/เรียน",
          lat: c.work ? c.work.lat : null, lng: c.work ? c.work.lng : null,
          baseHouseholdsAt100m: HOUSEHOLDS_PER_100M_ESTIMATE, defaultRadius: 100
        });
      }
      return {
        id: i + 1, caseId: c.caseId,
        name: ((c.community ? c.community + " " : "") + (c.subdistrict ? "ต." + c.subdistrict : "")).trim() || c.address || "-",
        clusterRef: cl ? cl.name + (confirmed[cl.clusterId] ? " (ยืนยันแล้ว)" : " (รอยืนยัน)") : "เคสเดี่ยว",
        riskLevel: cl ? "สูง" : "ปานกลาง",
        patientName: c.patientName,
        caseFoundDate: startOfDay(c.found || c.onset),
        sourceFile: c.caseId, sourceUrl: /^https:\/\//.test(c.fileUrl) ? c.fileUrl : "",
        locations: locations
      };
    });

    activeLocTypesByAreaId = {}; radiusByKey = {}; fuelTypeByKey = {}; workplanEntryByKey = {}; sprayDoneByKey = {};
    AREAS.forEach(function (area) {
      var active = [];
      area.locations.forEach(function (loc) {
        var saved = planByKey[area.caseId + ":" + loc.type];
        var key = getLocationKey(area.id, loc.type);
        if (!saved) { if (loc.type === "home") active.push("home"); return; }
        if (saved.active === "Y") active.push(loc.type);
        if (saved.radius) radiusByKey[key] = parseInt(saved.radius, 10) || 100;
        if (saved.fuelType) fuelTypeByKey[key] = saved.fuelType;
        if (saved.place) { if (loc.type === "home") loc.address = saved.place; else loc.name = saved.place; }
        if (saved.team) {
          var t = String(saved.time || "08:00").split(":");
          workplanEntryByKey[key] = { assignedTeamId: parseInt(saved.team, 10) || 1, dayOffset: saved.dayOffset || "0", hour: t[0] || "08", minute: t[1] || "00" };
        }
        sprayDoneByKey[key] = { 0: saved.day0Done === "Y", 1: saved.day1Done === "Y", 7: saved.day7Done === "Y" };
      });
      activeLocTypesByAreaId[area.id] = active.length ? active : ["home"];
    });

    loadInfo = { loading: false, error: detail.error, windowDays: detail.windowDays };
    renderAreaList();
    renderWorkplanSchedule();
  }

  // บันทึกค่าที่เลือกของเคส (ทุกตำแหน่ง) ลงแท็บ "แผนควบคุมโรค" — รวบคำขอที่เกิดติดกันภายใน 0.8 วินาที
  var persistTimers = {};
  function schedulePersist(areaId) {
    if (!areaId) return;
    clearTimeout(persistTimers[areaId]);
    persistTimers[areaId] = setTimeout(function () { persistArea(areaId); }, 800);
  }

  function persistArea(areaId) {
    var area = getAreaById(areaId);
    if (!area) return;
    var active = activeLocTypesByAreaId[area.id] || ["home"];
    var records = area.locations.map(function (loc) {
      var key = getLocationKey(area.id, loc.type);
      var entry = workplanEntryByKey[key];
      var done = sprayDoneByKey[key] || {};
      return {
        planKey: area.caseId + ":" + loc.type, caseId: area.caseId, patientName: area.patientName,
        locType: loc.type === "home" ? "บ้าน" : "ที่ทำงาน/เรียน",
        place: loc.type === "home" ? loc.address : loc.name,
        active: active.indexOf(loc.type) !== -1 ? "Y" : "N",
        radius: String(getRadiusForKey(key, loc)), fuelType: getFuelTypeForKey(key),
        team: entry ? String(entry.assignedTeamId) : "", dayOffset: entry ? entry.dayOffset : "",
        time: entry ? entry.hour + ":" + entry.minute : "",
        day0Done: done[0] ? "Y" : "", day1Done: done[1] ? "Y" : "", day7Done: done[7] ? "Y" : ""
      };
    });
    setPlanSaveStatus("กำลังบันทึกแผนลงชีต...", false);
    document.dispatchEvent(new CustomEvent("aidsrp:save-state", { detail: { tab: "controlPlan", records: records, requestId: "plan:" + area.caseId } }));
  }

  function setPlanSaveStatus(text, isError) {
    var el = document.getElementById("plan-save-status");
    if (!el) return;
    el.textContent = text;
    el.className = "body-secondary" + (isError ? " upload-ocr-status-error" : "");
  }

  document.addEventListener("aidsrp:state-saved", function (e) {
    var d = e.detail || {};
    if (String(d.requestId || "").indexOf("plan:") !== 0) return;
    setPlanSaveStatus(d.ok ? "บันทึกแผนลงชีตแล้ว " + formatThaiDateTime(new Date()) : "บันทึกแผนลงชีตไม่สำเร็จ: " + (d.error || ""), !d.ok);
  });
  document.addEventListener("aidsrp:cases-loading", function () {
    loadInfo.loading = true;
    AREAS = [];
    renderAreaList();
    renderWorkplanSchedule();
  });
  document.addEventListener("aidsrp:cases-ready", function (e) { applyCases(e.detail); });

  function init() {
    // รอบ 14: default the date filter to today so the highlight/summary
    // are immediately useful on page load (per BUILD-PLAN.md assumption).
    // รอบ 15: populate the day/month/year <select> option lists first,
    // then set them to today (workplanDateFilterActive already defaults
    // to true above).
    populateWorkplanDateFilterSelects();
    setWorkplanDateFilterSelects(new Date());
    if (window.AidsrpCases && window.AidsrpCases.last) {
      applyCases(window.AidsrpCases.last);
    } else {
      renderAreaList();
      renderWorkplanSchedule();
    }
    initEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
