/* =========================================================
   AI Disease Surveillance & Response Platform
   Field Tracking — mock real-time spray-team tracking map / AI
   vision photo QC grid (separate script: own DOM/state, no
   cross-page import; team/zone names align with the mock areas
   in control-plan.js but are a fresh mock dataset here, per
   BUILD-PLAN.md assumption for รอบ 4)
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     Status order for "จำลองอัปเดตตำแหน่ง": ยังไม่ถึง -> กำลังพ่น -> พ่นแล้ว.
     Positions are fictional [lat, lng] inside each zone's stated area
     (not real GPS), shown on OpenStreetMap via osm-map.js.
     depot = starting/base position (หน่วยงานต้นสังกัด), zoneCenter =
     the planned spray zone's center, radiusM = zone radius in metres;
     the pin's current position moves from depot towards zoneCenter as
     status advances (mock, no real GPS log).
     --------------------------------------------------------- */
  var STATUS_ORDER = ["not_arrived", "spraying", "done"];
  var STATUS_LABEL = { not_arrived: "ยังไม่ถึงพื้นที่", spraying: "กำลังพ่น", done: "พ่นแล้ว" };
  var STATUS_BADGE_CLASS = { not_arrived: "badge-neutral", spraying: "badge-inprogress", done: "badge-success" };
  var STATUS_PIN_CLASS = { not_arrived: "pin-not-arrived", spraying: "pin-spraying", done: "pin-done" };

  var TEAMS = [
    {
      id: 1,
      name: "ทีมพ่น 1",
      zoneName: "ต.หนองบัว หมู่ 4 บ้านโนนสวรรค์",
      zoneColor: "#8A9A5B", // --color-secondary
      radiusM: 200,
      depot: [16.4478, 102.8330],
      zoneCenter: [16.4562, 102.8198],
      status: "spraying",
      lastUpdateLabel: "20 ส.ค. 2569, 09:20 น."
    },
    {
      id: 2,
      name: "ทีมพ่น 2",
      zoneName: "ต.หนองบัว หมู่ 5 บ้านหนองบัวพัฒนา",
      zoneColor: "#C9A66B", // --color-accent
      radiusM: 180,
      depot: [16.4478, 102.8330],
      zoneCenter: [16.4528, 102.8252],
      status: "not_arrived",
      lastUpdateLabel: "20 ส.ค. 2569, 08:45 น."
    },
    {
      id: 3,
      name: "ทีมพ่น 3",
      zoneName: "ต.บ้านเป็ด หมู่ 3 บ้านเป็ดใหม่ + ศูนย์เด็กเล็ก",
      zoneColor: "#7A6A53", // --color-primary
      radiusM: 200,
      depot: [16.4352, 102.7952],
      zoneCenter: [16.4419, 102.7859],
      status: "done",
      lastUpdateLabel: "19 ส.ค. 2569, 15:10 น."
    },
    {
      id: 4,
      name: "ทีมพ่น 4",
      zoneName: "ต.เกาะแก้ว หมู่ 5 บ้านหาดทราย",
      zoneColor: "#8A9A5B", // --color-secondary
      radiusM: 180,
      depot: [7.1902, 100.6048],
      zoneCenter: [7.1798, 100.5951],
      status: "not_arrived",
      lastUpdateLabel: "20 ส.ค. 2569, 08:50 น."
    }
  ];

  function getTeamById(id) {
    for (var i = 0; i < TEAMS.length; i++) {
      if (TEAMS[i].id === id) return TEAMS[i];
    }
    return null;
  }

  function currentPos(team) {
    if (team.status === "not_arrived") return team.depot;
    if (team.status === "done") return team.zoneCenter;
    return [(team.depot[0] + team.zoneCenter[0]) / 2, (team.depot[1] + team.zoneCenter[1]) / 2];
  }

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

  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>';
  var ICON_REFRESH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path></svg>';
  var ICON_CAMERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"></path><circle cx="12" cy="13" r="4"></circle></svg>';

  /* ---------------------------------------------------------
     Mock field photos — AI vision QC results (location/time match
     against the planned spray zone & workplan schedule). 6 pass,
     2 fail, matching BUILD-PLAN.md assumption ("รูปเป็น placeholder
     icon ไม่ใช่ไฟล์รูปจริง").
     --------------------------------------------------------- */
  var PHOTOS = [
    { id: 1, team: "ทีมพ่น 1", timeLabel: "20 ส.ค. 2569, 09:15 น.", area: "ต.หนองบัว หมู่ 4 บ้านโนนสวรรค์", locationMatch: true, timeMatch: true, manualChecked: false },
    { id: 2, team: "ทีมพ่น 1", timeLabel: "20 ส.ค. 2569, 09:42 น.", area: "ต.หนองบัว หมู่ 4 บ้านโนนสวรรค์", locationMatch: true, timeMatch: true, manualChecked: false },
    { id: 3, team: "ทีมพ่น 2", timeLabel: "20 ส.ค. 2569, 10:05 น.", area: "ต.หนองบัว หมู่ 5 บ้านหนองบัวพัฒนา", locationMatch: false, locationNote: "พิกัดภาพห่างจากขอบเขตพื้นที่ที่วางแผน ~850 เมตร", timeMatch: true, manualChecked: false },
    { id: 4, team: "ทีมพ่น 3", timeLabel: "19 ส.ค. 2569, 14:20 น.", area: "ต.บ้านเป็ด หมู่ 3 บ้านเป็ดใหม่", locationMatch: true, timeMatch: true, manualChecked: false },
    { id: 5, team: "ทีมพ่น 3", timeLabel: "19 ส.ค. 2569, 14:55 น.", area: "ต.บ้านเป็ด หมู่ 3 บ้านเป็ดใหม่", locationMatch: true, timeMatch: true, manualChecked: false },
    { id: 6, team: "ทีมพ่น 4", timeLabel: "20 ส.ค. 2569, 08:50 น.", area: "ต.เกาะแก้ว หมู่ 5 บ้านหาดทราย", locationMatch: true, timeMatch: false, timeNote: "ถ่ายก่อนเวลาปฏิบัติงานที่แจ้งไว้ประมาณ 40 นาที", manualChecked: false },
    { id: 7, team: "ทีมพ่น 4", timeLabel: "20 ส.ค. 2569, 09:30 น.", area: "ต.เกาะแก้ว หมู่ 5 บ้านหาดทราย", locationMatch: true, timeMatch: true, manualChecked: false },
    { id: 8, team: "ทีมพ่น 2", timeLabel: "20 ส.ค. 2569, 10:30 น.", area: "ต.หนองบัว หมู่ 5 บ้านหนองบัวพัฒนา", locationMatch: true, timeMatch: true, manualChecked: false }
  ];

  function getPhotoById(id) {
    for (var i = 0; i < PHOTOS.length; i++) {
      if (PHOTOS[i].id === id) return PHOTOS[i];
    }
    return null;
  }

  /* ---------------------------------------------------------
     DOM refs
     --------------------------------------------------------- */
  var els = {
    trackingMapSubtitle: document.getElementById("tracking-map-subtitle"),
    trackingMapWrap: document.getElementById("tracking-map-wrap"),
    teamListSubtitle: document.getElementById("team-list-subtitle"),
    teamList: document.getElementById("team-list"),
    photoGridSubtitle: document.getElementById("photo-grid-subtitle"),
    photoGrid: document.getElementById("photo-grid")
  };

  /* ---------------------------------------------------------
     Render: Real-time tracking map — แผนที่จริง OpenStreetMap
     (osm-map.js) วงเส้นประต่อโซนที่วางแผนพ่น + หมุดทีมตามสถานะ
     --------------------------------------------------------- */
  var PIN_COLORS = { not_arrived: "#B3A996", spraying: "#C9A66B", done: "#6B8E5A" };
  var trackingMap = null;

  function drawTrackingMap() {
    if (!trackingMap) trackingMap = window.AidsrpMap.create(els.trackingMapWrap);
    if (!trackingMap) return;
    trackingMap.layer.clearLayers();

    var points = [];
    TEAMS.forEach(function (team) {
      var zone = L.circle(team.zoneCenter, {
        radius: team.radiusM, color: team.zoneColor, weight: 1.5, fillColor: team.zoneColor, fillOpacity: 0.10, dashArray: "6 5"
      }).addTo(trackingMap.layer);
      // ป้ายโซนที่ขอบบนของวง ไม่ทับหมุดทีมด้านใน
      L.tooltip({ permanent: true, direction: "top", className: "cluster-map-label" })
        .setLatLng([zone.getBounds().getNorth(), team.zoneCenter[1]])
        .setContent("<strong>" + escapeHtml(team.name) + "</strong><br>" + escapeHtml(team.zoneName))
        .addTo(trackingMap.layer);

      var pos = currentPos(team);
      L.circleMarker(pos, { radius: 7, color: "#FFFFFF", weight: 2, fillColor: PIN_COLORS[team.status], fillOpacity: 1 })
        .bindTooltip(escapeHtml(team.name), { direction: "bottom", offset: [0, 6] })
        .bindPopup(
          "<strong>" + escapeHtml(team.name) + "</strong> — " + STATUS_LABEL[team.status] + "<br>" +
          escapeHtml(team.zoneName) + "<br>อัปเดตล่าสุด " + escapeHtml(team.lastUpdateLabel) + "<br>" +
          pos[0].toFixed(4) + ", " + pos[1].toFixed(4)
        )
        .addTo(trackingMap.layer);
      points.push(team.zoneCenter, team.depot);
    });
    return points;
  }

  // ทีมอยู่คนละจังหวัด มุมมองรวมจึงซูมออกกว้าง — ปุ่ม "ดูบนแผนที่" ในรายการทีมซูมไปที่ทีมนั้น
  function zoomToTeam(id) {
    var team = getTeamById(id);
    if (!team || !trackingMap) return;
    var bounds = L.latLng(team.zoneCenter).toBounds(team.radiusM * 2).extend(team.depot);
    trackingMap.map.fitBounds(bounds, { padding: [40, 40] });
    els.trackingMapWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  var trackingMapFitted = false;
  function renderTrackingMap() {
    var points = drawTrackingMap();
    // ซูมให้เห็นทุกทีมครั้งแรกเท่านั้น — อัปเดตสถานะทีมไม่เปลี่ยนมุมมองที่ผู้ใช้ซูมไว้
    if (points && !trackingMapFitted) {
      window.AidsrpMap.fit(trackingMap.map, points);
      trackingMapFitted = true;
    }
    var doneCount = TEAMS.filter(function (t) { return t.status === "done"; }).length;
    els.trackingMapSubtitle.textContent = TEAMS.length + " ทีม · พ่นแล้ว " + doneCount + " ทีม (จำลอง เนื่องจาก LINE ไม่มี continuous location API จริง)";
  }

  /* ---------------------------------------------------------
     Render: Team list (side panel — status + last update +
     "จำลองอัปเดตตำแหน่ง" action)
     --------------------------------------------------------- */
  function renderTeamList() {
    var doneCount = TEAMS.filter(function (t) { return t.status === "done"; }).length;
    els.teamListSubtitle.textContent = doneCount + " จาก " + TEAMS.length + " ทีมพ่นเสร็จแล้ว";

    els.teamList.innerHTML = "";
    TEAMS.forEach(function (team) {
      var item = document.createElement("div");
      item.className = "team-item";
      item.innerHTML =
        '<div class="team-item-top">' +
          '<span class="team-name">' + escapeHtml(team.name) + '</span>' +
          '<span class="badge ' + STATUS_BADGE_CLASS[team.status] + '">' + STATUS_LABEL[team.status] + '</span>' +
        '</div>' +
        '<div class="team-meta">' +
          '<span>พื้นที่รับผิดชอบ: ' + escapeHtml(team.zoneName) + '</span>' +
          '<span>อัปเดตล่าสุด: ' + escapeHtml(team.lastUpdateLabel) + '</span>' +
        '</div>' +
        '<div class="team-actions">' +
          '<button type="button" class="btn btn-outline btn-sm btn-zoom-team" data-team-id="' + team.id + '">ดูบนแผนที่</button>' +
          (team.status === "done"
            ? '<span class="confirmed-check">' + ICON_CHECK + 'ปฏิบัติงานเสร็จสิ้น</span>'
            : '<button type="button" class="btn btn-outline btn-sm btn-advance-status" data-team-id="' + team.id + '">' + ICON_REFRESH + 'จำลองอัปเดตตำแหน่ง</button>') +
        '</div>';
      els.teamList.appendChild(item);
    });
  }

  function advanceTeamStatus(id) {
    var team = getTeamById(id);
    if (!team) return;
    var idx = STATUS_ORDER.indexOf(team.status);
    if (idx === -1 || idx >= STATUS_ORDER.length - 1) return;

    team.status = STATUS_ORDER[idx + 1];
    team.lastUpdateLabel = formatThaiDateTime(new Date());

    renderTrackingMap();
    renderTeamList();
  }

  /* ---------------------------------------------------------
     Render: AI vision QC photo grid
     --------------------------------------------------------- */
  function matchBadgeHtml(isMatch, label) {
    return isMatch
      ? '<span class="badge badge-success">' + escapeHtml(label) + 'ตรง</span>'
      : '<span class="badge badge-warning">' + escapeHtml(label) + 'ไม่ตรง</span>';
  }

  function renderPhotoGrid() {
    var failCount = PHOTOS.filter(function (p) { return !p.locationMatch || !p.timeMatch; }).length;
    els.photoGridSubtitle.textContent = PHOTOS.length + " รูป · ผ่านการตรวจสอบอัตโนมัติ " + (PHOTOS.length - failCount) + " รูป · ต้องตรวจสอบเพิ่มเติม " + failCount + " รูป";

    els.photoGrid.innerHTML = "";
    PHOTOS.forEach(function (p) {
      var needsCheck = !p.locationMatch || !p.timeMatch;
      var card = document.createElement("div");
      card.className = "photo-card";

      var badgesHtml =
        matchBadgeHtml(p.locationMatch, "พิกัด") +
        (!p.locationMatch && p.locationNote ? '<span class="photo-card-badge-note">' + escapeHtml(p.locationNote) + '</span>' : "") +
        matchBadgeHtml(p.timeMatch, "เวลา") +
        (!p.timeMatch && p.timeNote ? '<span class="photo-card-badge-note">' + escapeHtml(p.timeNote) + '</span>' : "");

      var actionHtml = "";
      if (needsCheck) {
        actionHtml = p.manualChecked
          ? '<span class="badge badge-success">' + ICON_CHECK + 'ตรวจสอบแล้ว</span>'
          : '<button type="button" class="btn btn-outline btn-sm btn-manual-check" data-photo-id="' + p.id + '">ตรวจสอบด้วยมือ</button>';
      }

      card.innerHTML =
        '<div class="photo-card-thumb">' + ICON_CAMERA + '</div>' +
        '<div class="photo-card-body">' +
          '<span class="photo-card-team">' + escapeHtml(p.team) + '</span>' +
          '<span class="photo-card-meta">' +
            '<span>ถ่ายเมื่อ ' + escapeHtml(p.timeLabel) + '</span>' +
            '<span>พื้นที่ที่ควรพ่น: ' + escapeHtml(p.area) + '</span>' +
          '</span>' +
          '<span class="photo-card-badges">' + badgesHtml + '</span>' +
          (actionHtml ? '<span class="photo-card-actions">' + actionHtml + '</span>' : "") +
        '</div>';
      els.photoGrid.appendChild(card);
    });
  }

  function manualCheckPhoto(id) {
    var photo = getPhotoById(id);
    if (!photo || photo.manualChecked) return;
    photo.manualChecked = true;
    renderPhotoGrid();
  }

  /* ---------------------------------------------------------
     Event wiring
     --------------------------------------------------------- */
  function initEvents() {
    els.teamList.addEventListener("click", function (e) {
      var zoomBtn = e.target.closest(".btn-zoom-team");
      if (zoomBtn) {
        zoomToTeam(parseInt(zoomBtn.getAttribute("data-team-id"), 10));
        return;
      }
      var btn = e.target.closest(".btn-advance-status");
      if (btn) advanceTeamStatus(parseInt(btn.getAttribute("data-team-id"), 10));
    });

    els.photoGrid.addEventListener("click", function (e) {
      var btn = e.target.closest(".btn-manual-check");
      if (btn) manualCheckPhoto(parseInt(btn.getAttribute("data-photo-id"), 10));
    });
  }

  function init() {
    renderTrackingMap();
    renderTeamList();
    renderPhotoGrid();
    initEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
