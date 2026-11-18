/* =========================================================
   AI Disease Surveillance & Response Platform
   Case Analysis — mock cluster map / draft report / อสม. chatbot
   (separate script from script.js and case-intake.js: own DOM/state)
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     Mock cases — already ingested/confirmed at intake (see
     case-intake.html pipeline). Pre-grouped into clusters here;
     grouping is NOT computed live (see BUILD-PLAN.md assumption:
     "Cluster ถูก pre-group ไว้ใน mock data ไม่ใช่ clustering algorithm จริง").
     lat/lng are fictional coordinates inside each cluster's stated area
     (not real households), shown on the OpenStreetMap cluster map.
     --------------------------------------------------------- */
  var CASES = [
    // Cluster 1 — dengue, ต.หนองบัว (pre-confirmed cluster on load)
    { id: 1, clusterId: 1, patientName: "ปราณี ทองศรี", hn: "HN-70211", village: "หมู่ 4 บ้านโนนสวรรค์", onsetDay: 15, disease: "ไข้เลือดออก (Dengue NS1) — Positive", lat: 16.4572, lng: 102.8188 },
    { id: 2, clusterId: 1, patientName: "สมชาย ใจตรง", hn: "HN-70235", village: "หมู่ 4 บ้านโนนสวรรค์", onsetDay: 16, disease: "ไข้เลือดออก (Dengue NS1) — Positive", lat: 16.4561, lng: 102.8203 },
    { id: 3, clusterId: 1, patientName: "บัวผัน ศรีสุข", hn: "HN-70298", village: "หมู่ 5 บ้านหนองบัวพัฒนา", onsetDay: 17, disease: "ไข้เลือดออก (Dengue NS1) — Positive", lat: 16.4538, lng: 102.8231 },
    { id: 4, clusterId: 1, patientName: "อนันต์ แก้วมณี (เด็กชาย)", hn: "HN-70310", village: "หมู่ 4 บ้านโนนสวรรค์", onsetDay: 19, disease: "ไข้เลือดออก (Dengue NS1) — Positive", lat: 16.4549, lng: 102.8179 },

    // Cluster 2 — HFMD, ต.บ้านเป็ด (pending confirmation)
    { id: 5, clusterId: 2, patientName: "กมลชนก อยู่ดี (เด็กหญิง)", hn: "HN-71002", village: "ศูนย์เด็กเล็กบ้านเป็ดใหม่", onsetDay: 12, disease: "มือ เท้า ปาก (HFMD) — Positive", lat: 16.4427, lng: 102.7861 },
    { id: 6, clusterId: 2, patientName: "ภูมิพัฒน์ วงศ์ทอง (เด็กชาย)", hn: "HN-71015", village: "ศูนย์เด็กเล็กบ้านเป็ดใหม่", onsetDay: 14, disease: "มือ เท้า ปาก (HFMD) — Positive", lat: 16.4421, lng: 102.7869 },
    { id: 7, clusterId: 2, patientName: "ศิริลักษณ์ บุญมา (เด็กหญิง)", hn: "HN-71030", village: "หมู่ 3 บ้านเป็ดใหม่", onsetDay: 16, disease: "มือ เท้า ปาก (HFMD) — Positive", lat: 16.4409, lng: 102.7848 },

    // Cluster 3 — food poisoning, ต.คลองใหญ่ (pending confirmation)
    { id: 8, clusterId: 3, patientName: "วิชัย รุ่งเรือง", hn: "HN-72110", village: "หมู่ 1 บ้านคลองใหญ่", onsetDay: 18, disease: "อาหารเป็นพิษ — ยืนยันทางคลินิก", lat: 12.9731, lng: 100.9063 },
    { id: 9, clusterId: 3, patientName: "อรุณี พรพิพัฒน์", hn: "HN-72125", village: "หมู่ 1 บ้านคลองใหญ่", onsetDay: 19, disease: "อาหารเป็นพิษ — ยืนยันทางคลินิก", lat: 12.9722, lng: 100.9071 }
  ];

  var CLUSTERS = [
    {
      id: 1,
      name: "กลุ่มไข้เลือดออก ต.หนองบัว",
      disease: "ไข้เลือดออก (Dengue Fever)",
      subdistrict: "หนองบัว",
      district: "เมือง",
      province: "ขอนแก่น",
      confidencePct: 92,
      closeContactsEstimate: 18,
      color: "#8A9A5B", // --color-secondary
      status: "confirmed",
      confirmedAtLabel: "20 ส.ค. 2569, 08:50 น."
    },
    {
      id: 2,
      name: "กลุ่มมือ เท้า ปาก ต.บ้านเป็ด",
      disease: "มือ เท้า ปาก (HFMD)",
      subdistrict: "บ้านเป็ด",
      district: "เมือง",
      province: "ขอนแก่น",
      confidencePct: 81,
      closeContactsEstimate: 12,
      color: "#C9A66B", // --color-accent
      status: "pending"
    },
    {
      id: 3,
      name: "กลุ่มอาหารเป็นพิษ ต.คลองใหญ่",
      disease: "อาหารเป็นพิษ (Food Poisoning)",
      subdistrict: "คลองใหญ่",
      district: "บางละมุง",
      province: "ชลบุรี",
      confidencePct: 68,
      closeContactsEstimate: 6,
      color: "#7A6A53", // --color-primary
      status: "pending"
    }
  ];

  function getClusterById(id) {
    for (var i = 0; i < CLUSTERS.length; i++) {
      if (CLUSTERS[i].id === id) return CLUSTERS[i];
    }
    return null;
  }

  function getClusterCases(clusterId) {
    return CASES.filter(function (c) { return c.clusterId === clusterId; });
  }

  function uniq(arr) {
    var out = [];
    arr.forEach(function (v) { if (out.indexOf(v) === -1) out.push(v); });
    return out;
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

  /* ---------------------------------------------------------
     Shared inline icons (thin-line, monochrome — matches DESIGN.md)
     --------------------------------------------------------- */
  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"></path><path d="M22 2 15 22l-4-9-9-4 20-7Z"></path></svg>';

  /* ---------------------------------------------------------
     DOM refs
     --------------------------------------------------------- */
  var els = {
    clusterMapSubtitle: document.getElementById("cluster-map-subtitle"),
    clusterMapWrap: document.getElementById("cluster-map-wrap"),
    clusterMapLegend: document.getElementById("cluster-map-legend"),
    clusterListSubtitle: document.getElementById("cluster-list-subtitle"),
    clusterList: document.getElementById("cluster-list"),
    reportClusterSelect: document.getElementById("report-cluster-select"),
    btnGenerateReport: document.getElementById("btn-generate-report"),
    reportTextarea: document.getElementById("report-textarea"),
    btnSendReport: document.getElementById("btn-send-report"),
    reportStatus: document.getElementById("report-status"),
    chatThread: document.getElementById("chat-thread"),
    btnChatNext: document.getElementById("btn-chat-next"),
    chatEndNote: document.getElementById("chat-end-note")
  };

  /* ---------------------------------------------------------
     Render: Case Cluster Map — แผนที่จริงด้วย Leaflet + OpenStreetMap
     (แบบเดียวกับ Spot Map ใน case-intake.js) วงกลมสีต่อกลุ่มครอบเคส
     ในกลุ่ม เส้นทึบ = ยืนยันแล้ว เส้นประ = รอยืนยัน
     --------------------------------------------------------- */
  // ขอบเขตกลุ่ม = วงกลมรอบจุดกึ่งกลางของเคสในกลุ่ม รัศมีถึงเคสที่ไกลที่สุด + ระยะเผื่อ (เมตร)
  var CLUSTER_PADDING_M = 150;
  var clusterMap = null;
  var clusterBounds = {};

  function drawClusterMap() {
    if (!clusterMap) clusterMap = window.AidsrpMap.create(els.clusterMapWrap);
    if (!clusterMap) return;
    clusterMap.layer.clearLayers();

    var allPoints = [];
    CLUSTERS.forEach(function (cluster) {
      var cases = getClusterCases(cluster.id);
      if (!cases.length) return;
      var center = L.latLng(
        cases.reduce(function (sum, c) { return sum + c.lat; }, 0) / cases.length,
        cases.reduce(function (sum, c) { return sum + c.lng; }, 0) / cases.length
      );
      var radius = cases.reduce(function (max, c) {
        return Math.max(max, center.distanceTo([c.lat, c.lng]));
      }, 0) + CLUSTER_PADDING_M;

      var ring = L.circle(center, {
        radius: radius, color: cluster.color, weight: 1.5, fillColor: cluster.color, fillOpacity: 0.14,
        dashArray: cluster.status === "confirmed" ? null : "6 5"
      }).addTo(clusterMap.layer);
      clusterBounds[cluster.id] = ring.getBounds();
      // ป้ายชื่อกลุ่มวางที่ขอบบนของวง ไม่ทับหมุดเคสด้านใน
      L.tooltip({ permanent: true, direction: "top", className: "cluster-map-label" })
        .setLatLng([clusterBounds[cluster.id].getNorth(), center.lng])
        .setContent(
          "<strong>" + escapeHtml(cluster.name) + "</strong><br>ความมั่นใจ AI " + cluster.confidencePct + "% &middot; " +
          (cluster.status === "confirmed" ? "ยืนยันแล้ว" : "รอยืนยัน")
        )
        .addTo(clusterMap.layer);

      cases.forEach(function (c) {
        L.circleMarker([c.lat, c.lng], { radius: 6, color: "#FFFFFF", weight: 2, fillColor: cluster.color, fillOpacity: 1 })
          .bindTooltip(escapeHtml(c.patientName.split(" ")[0]), { direction: "top", offset: [0, -6] })
          .bindPopup(
            "<strong>" + escapeHtml(c.patientName) + "</strong> (" + escapeHtml(c.hn) + ")<br>" +
            escapeHtml(c.village) + "<br>เริ่มป่วย " + c.onsetDay + " ส.ค. 2569<br>" +
            escapeHtml(c.disease) + "<br>" + escapeHtml(cluster.name) + "<br>" +
            c.lat.toFixed(4) + ", " + c.lng.toFixed(4)
          )
          .addTo(clusterMap.layer);
        allPoints.push([c.lat, c.lng]);
      });
    });

    window.AidsrpMap.fit(clusterMap.map, allPoints);
  }

  // คลิกชื่อกลุ่มในคำอธิบายสี -> ซูมไปที่กลุ่มนั้น (กลุ่มอยู่คนละจังหวัด มุมมองรวมจึงซูมออกกว้าง)
  function zoomToCluster(id) {
    if (clusterMap && clusterBounds[id]) clusterMap.map.fitBounds(clusterBounds[id], { padding: [30, 30] });
  }

  function renderClusterMap() {
    drawClusterMap();
    els.clusterMapSubtitle.textContent = "เคสที่เกี่ยวข้อง " + CASES.length + " ราย · จัดกลุ่มเป็น " + CLUSTERS.length + " กลุ่มโดย AI";

    els.clusterMapLegend.innerHTML = "";
    CLUSTERS.forEach(function (cluster) {
      var item = document.createElement("div");
      item.className = "region-legend-item cluster-legend-zoom";
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      item.title = "ซูมแผนที่ไปที่กลุ่มนี้";
      item.innerHTML = '<span class="cluster-swatch" style="background:' + cluster.color + '"></span>' + escapeHtml(cluster.name);
      item.addEventListener("click", function () { zoomToCluster(cluster.id); });
      item.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); zoomToCluster(cluster.id); }
      });
      els.clusterMapLegend.appendChild(item);
    });
  }

  /* ---------------------------------------------------------
     Render: Cluster list (confidence + confirm action)
     --------------------------------------------------------- */
  function renderClusterList() {
    var confirmedCount = CLUSTERS.filter(function (c) { return c.status === "confirmed"; }).length;
    els.clusterListSubtitle.textContent = "ยืนยันแล้ว " + confirmedCount + " จาก " + CLUSTERS.length + " กลุ่ม";

    els.clusterList.innerHTML = "";
    CLUSTERS.forEach(function (cluster) {
      var cases = getClusterCases(cluster.id);
      var villages = uniq(cases.map(function (c) { return c.village; }));
      var days = cases.map(function (c) { return c.onsetDay; }).sort(function (a, b) { return a - b; });
      var dateRangeLabel = days[0] === days[days.length - 1]
        ? (days[0] + " ส.ค. 2569")
        : (days[0] + "–" + days[days.length - 1] + " ส.ค. 2569");

      var item = document.createElement("div");
      item.className = "cluster-item";
      item.innerHTML =
        '<div class="cluster-item-top">' +
          '<span class="cluster-name"><span class="cluster-swatch" style="background:' + cluster.color + '"></span>' + escapeHtml(cluster.name) + "</span>" +
          (cluster.status === "confirmed"
            ? '<span class="badge badge-confirmed">' + ICON_CHECK + "ยืนยันแล้ว</span>"
            : "") +
        "</div>" +
        '<div class="cluster-meta">' +
          "<span>" + cases.length + " ราย &middot; ต." + escapeHtml(cluster.subdistrict) + " อ." + escapeHtml(cluster.district) + " จ." + escapeHtml(cluster.province) + "</span>" +
          "<span>ช่วงวันเริ่มป่วย: " + dateRangeLabel + " &middot; พื้นที่: " + escapeHtml(villages.join(", ")) + "</span>" +
        "</div>" +
        '<div class="cluster-confidence">' +
          '<span class="cluster-confidence-label">ความมั่นใจของ AI ในการจัดกลุ่ม: ' + cluster.confidencePct + '%</span>' +
          '<div class="cluster-confidence-bar"><div class="cluster-confidence-fill" style="width:' + cluster.confidencePct + '%;background:' + cluster.color + '"></div></div>' +
        "</div>" +
        '<div class="cluster-actions">' +
          (cluster.status === "confirmed"
            ? '<span class="body-secondary">ยืนยันเมื่อ ' + escapeHtml(cluster.confirmedAtLabel || "") + "</span>"
            : '<button type="button" class="btn btn-primary btn-sm btn-confirm-cluster" data-cluster-id="' + cluster.id + '">ยืนยัน cluster นี้</button>') +
        "</div>";
      els.clusterList.appendChild(item);
    });
  }

  /* ---------------------------------------------------------
     Render: Draft report cluster select (only confirmed clusters)
     --------------------------------------------------------- */
  function renderReportControls() {
    var confirmed = CLUSTERS.filter(function (c) { return c.status === "confirmed"; });
    var previousValue = els.reportClusterSelect.value;
    els.reportClusterSelect.innerHTML = "";

    if (confirmed.length === 0) {
      var opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "— ยังไม่มีกลุ่มเคสที่ยืนยันแล้ว —";
      els.reportClusterSelect.appendChild(opt);
      els.reportClusterSelect.disabled = true;
      els.btnGenerateReport.disabled = true;
      return;
    }

    els.reportClusterSelect.disabled = false;
    confirmed.forEach(function (cluster) {
      var option = document.createElement("option");
      option.value = String(cluster.id);
      option.textContent = cluster.name + " (ความมั่นใจ " + cluster.confidencePct + "%)";
      els.reportClusterSelect.appendChild(option);
    });

    // Keep the previously selected cluster selected if it is still confirmed.
    if (previousValue && confirmed.some(function (c) { return String(c.id) === previousValue; })) {
      els.reportClusterSelect.value = previousValue;
    }
    els.btnGenerateReport.disabled = false;
  }

  /* ---------------------------------------------------------
     Draft report generation — template text assembled from the
     selected cluster's real mock data (not free-form AI generation,
     see BUILD-PLAN.md assumption).
     --------------------------------------------------------- */
  function buildReportText(cluster) {
    var cases = getClusterCases(cluster.id);
    var days = cases.map(function (c) { return c.onsetDay; }).sort(function (a, b) { return a - b; });
    var dateRangeLabel = days[0] === days[days.length - 1]
      ? (days[0] + " ส.ค. 2569")
      : (days[0] + "–" + days[days.length - 1] + " ส.ค. 2569");
    var villages = uniq(cases.map(function (c) { return c.village; }));

    var caseListText = cases.map(function (c, i) {
      return (i + 1) + ". " + c.patientName + " (" + c.hn + ") — " + c.village + " — เริ่มป่วย " + c.onsetDay + " ส.ค. 2569 — " + c.disease;
    }).join("\n");

    var lines = [
      "รายงานการสอบสวนโรคเบื้องต้น (ร่างโดยระบบ AI)",
      "สร้างเมื่อ: " + formatThaiDateTime(new Date()),
      "",
      "กลุ่มเคส: " + cluster.name,
      "ระดับความมั่นใจของ AI ในการจัดกลุ่ม: " + cluster.confidencePct + "%",
      "โรค/ภาวะที่พบ: " + cluster.disease,
      "พื้นที่: ต." + cluster.subdistrict + " อ." + cluster.district + " จ." + cluster.province,
      "หมู่บ้าน/พื้นที่ที่เกี่ยวข้อง: " + villages.join(", "),
      "จำนวนผู้ป่วยในกลุ่ม: " + cases.length + " ราย",
      "ช่วงวันเริ่มป่วย: " + dateRangeLabel,
      "จำนวนผู้สัมผัสใกล้ชิดโดยประมาณ: " + cluster.closeContactsEstimate + " ราย",
      "",
      "รายชื่อผู้ป่วยในกลุ่ม:",
      caseListText,
      "",
      "ข้อเสนอแนะเบื้องต้น: ทีมสอบสวนโรคควรลงพื้นที่ตรวจสอบแหล่งแพร่เชื้อร่วมของกลุ่มนี้ ติดตามอาการผู้สัมผัสใกล้ชิดตามจำนวนประมาณข้างต้น และพิจารณามาตรการควบคุมโรคเบื้องต้นให้เหมาะกับชนิดของเชื้อที่ตรวจพบ",
      "",
      "หมายเหตุ: ร่างนี้สร้างโดยระบบ AI จากข้อมูลเคสที่ยืนยันแล้วในระบบ โปรดตรวจสอบความถูกต้องและปรับแก้ก่อนนำเสนอผู้บริหาร"
    ];
    return lines.join("\n");
  }

  function generateReport() {
    var clusterId = parseInt(els.reportClusterSelect.value, 10);
    var cluster = getClusterById(clusterId);
    if (!cluster || cluster.status !== "confirmed") return;

    els.reportTextarea.value = buildReportText(cluster);
    els.btnSendReport.disabled = false;
    els.reportStatus.innerHTML = "";
  }

  function sendReport() {
    var text = els.reportTextarea.value.trim();
    if (!text) return;

    els.reportStatus.innerHTML = '<span class="badge badge-confirmed">' + ICON_SEND + "ส่งแล้ว &middot; " + formatThaiDateTime(new Date()) + "</span>";
  }

  /* ---------------------------------------------------------
     Cluster confirmation action
     --------------------------------------------------------- */
  function confirmCluster(id) {
    var cluster = getClusterById(id);
    if (!cluster || cluster.status === "confirmed") return;

    cluster.status = "confirmed";
    cluster.confirmedAtLabel = formatThaiDateTime(new Date());

    renderClusterMap();
    renderClusterList();
    renderReportControls();
  }

  /* ---------------------------------------------------------
     อสม. coordination chatbot — fixed script, revealed one pair
     (bot + อสม. reply) at a time via "แสดงข้อความถัดไป" (step-through
     demo only, no free-text input; see BUILD-PLAN.md assumption).
     --------------------------------------------------------- */
  var CHAT_SCRIPT = [
    { from: "bot", sender: "ระบบ AI-DSRP", time: "20 ส.ค. 2569, 09:02 น.", text: "สวัสดีค่ะ พี่มาลี (อสม. ต.หนองบัว) ระบบตรวจพบกลุ่มผู้ป่วยไข้เลือดออกที่ยืนยันแล้วในพื้นที่ 4 ราย ขอนัดหมายลงพื้นที่สำรวจลูกน้ำยุงลายวันพฤหัสบดีนี้ เวลา 09:00 น. ได้หรือไม่คะ" },
    { from: "osm", sender: "อสม. มาลี", time: "20 ส.ค. 2569, 09:05 น.", text: "ได้ค่ะ พฤหัสบดีนี้ 09:00 น. ดิฉันจะเตรียมทีม อสม. ลูกบ้านไว้ 5 คน นัดพบที่ศาลาประชาคมหมู่ 4 นะคะ" },

    { from: "bot", sender: "ระบบ AI-DSRP", time: "20 ส.ค. 2569, 09:06 น.", text: "ขอบคุณค่ะ รบกวนแจ้งบ้านเรือนในหมู่ 4 บ้านโนนสวรรค์ และพื้นที่ใกล้เคียง ให้คว่ำหรือเทน้ำในภาชนะที่ไม่ใช้งานก่อนทีมลงพื้นที่ด้วยนะคะ" },
    { from: "osm", sender: "อสม. มาลี", time: "20 ส.ค. 2569, 09:10 น.", text: "รับทราบค่ะ จะประกาศเสียงตามสายในพื้นที่ให้ทันทีเลยค่ะ" },

    { from: "bot", sender: "ระบบ AI-DSRP", time: "20 ส.ค. 2569, 09:11 น.", text: "รบกวนอีกเรื่องค่ะ หากพบผู้มีอาการไข้สูง ปวดเมื่อยตัว หรือมีจุดเลือดออกใต้ผิวหนังเพิ่มเติมในพื้นที่ ช่วยแจ้งทีมสอบสวนโรค เขต 3 ผ่านไลน์กลุ่มได้ทันทีนะคะ" },
    { from: "osm", sender: "อสม. มาลี", time: "20 ส.ค. 2569, 09:14 น.", text: "ได้ค่ะ จะช่วยสอบถามอาการลูกบ้านเป็นพิเศษช่วงนี้ และแจ้งทันทีถ้าพบผู้ป่วยเพิ่มค่ะ" },

    { from: "bot", sender: "ระบบ AI-DSRP", time: "20 ส.ค. 2569, 09:15 น.", text: "ขอบคุณพี่มาลีมากค่ะ ทีมสอบสวนโรคจะโทรยืนยันรายละเอียดอีกครั้งก่อนถึงวันนัดหมาย 1 วันค่ะ" },
    { from: "osm", sender: "อสม. มาลี", time: "20 ส.ค. 2569, 09:16 น.", text: "ขอบคุณค่ะ แล้วพบกันวันพฤหัสบดีนี้ค่ะ" }
  ];

  var TOTAL_CHAT_PAIRS = CHAT_SCRIPT.length / 2;
  var revealedPairs = 1; // first pair visible by default, matching a live chat's opening greeting

  function renderChat() {
    var visibleCount = revealedPairs * 2;
    els.chatThread.innerHTML = "";

    CHAT_SCRIPT.slice(0, visibleCount).forEach(function (msg) {
      var row = document.createElement("div");
      row.className = "chat-row from-" + msg.from;
      row.innerHTML =
        '<span class="chat-sender">' + escapeHtml(msg.sender) + "</span>" +
        '<span class="chat-bubble">' + escapeHtml(msg.text) + "</span>" +
        '<span class="chat-timestamp">' + escapeHtml(msg.time) + "</span>";
      els.chatThread.appendChild(row);
    });

    var done = revealedPairs >= TOTAL_CHAT_PAIRS;
    els.btnChatNext.style.display = done ? "none" : "";
    els.chatEndNote.style.display = done ? "" : "none";
  }

  function showNextChatPair() {
    if (revealedPairs >= TOTAL_CHAT_PAIRS) return;
    revealedPairs += 1;
    renderChat();
  }

  /* ---------------------------------------------------------
     Event wiring
     --------------------------------------------------------- */
  function initEvents() {
    els.clusterList.addEventListener("click", function (e) {
      var btn = e.target.closest(".btn-confirm-cluster");
      if (btn) {
        confirmCluster(parseInt(btn.getAttribute("data-cluster-id"), 10));
      }
    });

    els.btnGenerateReport.addEventListener("click", generateReport);
    els.btnSendReport.addEventListener("click", sendReport);
    els.btnChatNext.addEventListener("click", showNextChatPair);
  }

  function init() {
    renderClusterMap();
    renderClusterList();
    renderReportControls();
    renderChat();
    initEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
