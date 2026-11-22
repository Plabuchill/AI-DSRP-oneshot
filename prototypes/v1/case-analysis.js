/* =========================================================
   AI Disease Surveillance & Response Platform
   Case Analysis — แผนที่กลุ่มเคส / ร่างรายงาน / อสม. chatbot (จำลอง)
   (separate script from script.js and case-intake.js: own DOM/state)
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     เคสจริงจากชีตทะเบียนผู้ป่วย (sheet-cases.js โหลด + จัดกลุ่มให้ แล้วส่งมาทาง
     "aidsrp:cases-ready") — จัดกลุ่มด้วยกฎ: โรคเดียวกัน บ้านห่างกัน ≤100 ม.
     เริ่มป่วยห่างกัน ≤14 วัน (เชื่อมต่อกันเป็นทอด) กลุ่มต้องมีอย่างน้อย 2 ราย
     สถานะ "ยืนยันกลุ่ม" เก็บในแท็บ "กลุ่มเคส" ของชีต (key = Cluster ID)
     --------------------------------------------------------- */
  var CASES = [];      // { id, clusterId(เลข id ของกลุ่ม|null), caseId, patientName, village, onset, disease, lat, lng }
  var CLUSTERS = [];   // { id, clusterId, name, disease, subdistrict, color, status, confirmedAtLabel, maxDistanceM, firstOnset, lastOnset }
  var loadInfo = { loading: true, error: null, windowDays: 28, excludedNoOnset: 0 };
  var UNCLUSTERED_COLOR = "#B3A996";

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
    arr.forEach(function (v) { if (v && out.indexOf(v) === -1) out.push(v); });
    return out;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------------------------------------------------------
     Thai date/time formatting
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
    return date ? date.getDate() + " " + THAI_MONTHS[date.getMonth()] + " " + (date.getFullYear() + 543) : "-";
  }

  function onsetRangeLabel(cluster) {
    return cluster.firstOnset.getTime() === cluster.lastOnset.getTime()
      ? formatThaiDate(cluster.firstOnset)
      : formatThaiDate(cluster.firstOnset) + " – " + formatThaiDate(cluster.lastOnset);
  }

  function daySpan(cluster) {
    return Math.round((cluster.lastOnset - cluster.firstOnset) / 86400000);
  }

  function criteriaLabel(cluster) {
    return "บ้านห่างกันสูงสุด " + cluster.maxDistanceM + " ม. · เริ่มป่วยห่างกัน " + daySpan(cluster) + " วัน";
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
     รับเคส/กลุ่มจาก sheet-cases.js -> แปลงเป็นโครงที่หน้าใช้ (id ตัวเลขสำหรับปุ่ม/ซูม)
     --------------------------------------------------------- */
  function applyCases(detail) {
    var confirmedByKey = {};
    (detail.state && detail.state.clusters || []).forEach(function (s) {
      if (s.status === "ยืนยันแล้ว") confirmedByKey[s.clusterId] = s.updatedAt || "";
    });
    CLUSTERS = detail.clusters.map(function (cl, i) {
      var confirmedAt = confirmedByKey[cl.clusterId];
      return {
        id: i + 1, clusterId: cl.clusterId, name: cl.name, disease: cl.disease, subdistrict: cl.subdistrict,
        color: cl.color, maxDistanceM: cl.maxDistanceM, firstOnset: cl.firstOnset, lastOnset: cl.lastOnset,
        status: confirmedAt !== undefined ? "confirmed" : "pending",
        confirmedAtLabel: confirmedAt || ""
      };
    });
    var idByKey = {};
    CLUSTERS.forEach(function (cl) { idByKey[cl.clusterId] = cl.id; });
    CASES = detail.cases.map(function (c, i) {
      return {
        id: i + 1, clusterId: c.clusterId ? idByKey[c.clusterId] : null, caseId: c.caseId,
        patientName: c.patientName, village: c.community || ("ต." + c.subdistrict),
        onset: c.onset, disease: c.diseaseId ? c.diseaseId + " " + c.diseaseName : "-",
        lat: c.home ? c.home.lat : null, lng: c.home ? c.home.lng : null
      };
    });
    loadInfo = { loading: false, error: detail.error, windowDays: detail.windowDays, excludedNoOnset: detail.excludedNoOnset };
    renderAll();
  }

  function renderAll() {
    renderClusterMap();
    renderClusterList();
    renderReportControls();
  }

  /* ---------------------------------------------------------
     Render: Case Cluster Map — แผนที่จริงด้วย Leaflet + OpenStreetMap
     วงกลมสีต่อกลุ่มครอบเคสในกลุ่ม เส้นทึบ = ยืนยันแล้ว เส้นประ = รอยืนยัน
     เคสเดี่ยว (ไม่เข้าเกณฑ์กลุ่ม) แสดงเป็นหมุดสีเทา
     --------------------------------------------------------- */
  // ขอบเขตกลุ่ม = วงกลมรอบจุดกึ่งกลางของเคสในกลุ่ม รัศมีถึงเคสที่ไกลที่สุด + ระยะเผื่อ (เมตร)
  var CLUSTER_PADDING_M = 150;
  var clusterMap = null;
  var clusterBounds = {};

  function casePopup(c, clusterName) {
    return "<strong>" + escapeHtml(c.patientName) + "</strong> (" + escapeHtml(c.caseId) + ")<br>" +
      escapeHtml(c.village) + "<br>เริ่มป่วย " + formatThaiDate(c.onset) + "<br>" +
      escapeHtml(c.disease) + "<br>" + escapeHtml(clusterName) + "<br>" +
      c.lat.toFixed(4) + ", " + c.lng.toFixed(4);
  }

  function drawClusterMap() {
    if (!clusterMap) clusterMap = window.AidsrpMap.create(els.clusterMapWrap);
    if (!clusterMap) return;
    clusterMap.layer.clearLayers();
    clusterBounds = {};

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
          "<strong>" + escapeHtml(cluster.name) + "</strong><br>" + cases.length + " ราย &middot; " +
          (cluster.status === "confirmed" ? "ยืนยันแล้ว" : "รอยืนยัน")
        )
        .addTo(clusterMap.layer);

      cases.forEach(function (c) {
        L.circleMarker([c.lat, c.lng], { radius: 6, color: "#FFFFFF", weight: 2, fillColor: cluster.color, fillOpacity: 1 })
          .bindTooltip(escapeHtml(c.patientName.split(" ")[0]), { direction: "top", offset: [0, -6] })
          .bindPopup(casePopup(c, cluster.name))
          .addTo(clusterMap.layer);
        allPoints.push([c.lat, c.lng]);
      });
    });

    CASES.forEach(function (c) {
      if (c.clusterId || c.lat == null) return;
      L.circleMarker([c.lat, c.lng], { radius: 5, color: "#FFFFFF", weight: 2, fillColor: UNCLUSTERED_COLOR, fillOpacity: 1 })
        .bindTooltip(escapeHtml(c.patientName.split(" ")[0]), { direction: "top", offset: [0, -6] })
        .bindPopup(casePopup(c, "เคสเดี่ยว (ไม่เข้าเกณฑ์กลุ่ม)"))
        .addTo(clusterMap.layer);
      allPoints.push([c.lat, c.lng]);
    });

    window.AidsrpMap.fit(clusterMap.map, allPoints);
  }

  // คลิกชื่อกลุ่มในคำอธิบายสี -> ซูมไปที่กลุ่มนั้น
  function zoomToCluster(id) {
    if (clusterMap && clusterBounds[id]) clusterMap.map.fitBounds(clusterBounds[id], { padding: [30, 30] });
  }

  function windowLabel() {
    return loadInfo.windowDays ? "เริ่มป่วยใน " + loadInfo.windowDays + " วันล่าสุด" : "ทุกช่วงเวลา";
  }

  function renderClusterMap() {
    drawClusterMap();
    if (loadInfo.loading) {
      els.clusterMapSubtitle.textContent = "กำลังโหลดเคสจาก Google Sheet...";
    } else if (loadInfo.error) {
      els.clusterMapSubtitle.textContent = loadInfo.error;
    } else {
      var single = CASES.filter(function (c) { return !c.clusterId; }).length;
      var noCoords = CASES.filter(function (c) { return c.lat == null; }).length;
      els.clusterMapSubtitle.textContent = "เคส " + CASES.length + " ราย (" + windowLabel() + ") · จัดได้ " + CLUSTERS.length +
        " กลุ่ม · เคสเดี่ยว " + single + " ราย" + (noCoords ? " · ไม่มีพิกัด " + noCoords + " ราย (ไม่แสดงบนแผนที่)" : "");
    }

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
    if (CASES.some(function (c) { return !c.clusterId && c.lat != null; })) {
      var single = document.createElement("div");
      single.className = "region-legend-item";
      single.innerHTML = '<span class="cluster-swatch" style="background:' + UNCLUSTERED_COLOR + '"></span>เคสเดี่ยว';
      els.clusterMapLegend.appendChild(single);
    }
  }

  /* ---------------------------------------------------------
     Render: Cluster list (เกณฑ์จัดกลุ่ม + ปุ่มยืนยัน)
     --------------------------------------------------------- */
  function renderClusterList() {
    var confirmedCount = CLUSTERS.filter(function (c) { return c.status === "confirmed"; }).length;
    els.clusterListSubtitle.textContent = loadInfo.loading ? "กำลังโหลด..." :
      "ยืนยันแล้ว " + confirmedCount + " จาก " + CLUSTERS.length + " กลุ่ม · เกณฑ์: โรคเดียวกัน บ้านห่างกันไม่เกิน " +
      window.AidsrpCases.CLUSTER_RADIUS_M + " ม. เริ่มป่วยห่างกันไม่เกิน " + window.AidsrpCases.CLUSTER_DAYS + " วัน";

    els.clusterList.innerHTML = "";
    if (!loadInfo.loading && !CLUSTERS.length) {
      els.clusterList.innerHTML = '<p class="body-secondary">' +
        (loadInfo.error ? escapeHtml(loadInfo.error) : "ยังไม่พบกลุ่มเคสที่เข้าเกณฑ์ใน" + windowLabel()) + "</p>";
      return;
    }
    CLUSTERS.forEach(function (cluster) {
      var cases = getClusterCases(cluster.id);
      var villages = uniq(cases.map(function (c) { return c.village; }));

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
          "<span>" + cases.length + " ราย &middot; " + escapeHtml(cluster.clusterId) + "</span>" +
          "<span>ช่วงวันเริ่มป่วย: " + onsetRangeLabel(cluster) + " &middot; พื้นที่: " + escapeHtml(villages.join(", ")) + "</span>" +
          "<span>" + escapeHtml(criteriaLabel(cluster)) + "</span>" +
        "</div>" +
        '<div class="cluster-actions">' +
          (cluster.status === "confirmed"
            ? '<span class="body-secondary">ยืนยันเมื่อ ' + escapeHtml(cluster.confirmedAtLabel || "") + "</span>"
            : cluster.saving
              ? '<span class="body-secondary">กำลังบันทึกลงชีต...</span>'
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
      option.textContent = cluster.name + " (" + getClusterCases(cluster.id).length + " ราย)";
      els.reportClusterSelect.appendChild(option);
    });

    // Keep the previously selected cluster selected if it is still confirmed.
    if (previousValue && confirmed.some(function (c) { return String(c.id) === previousValue; })) {
      els.reportClusterSelect.value = previousValue;
    }
    els.btnGenerateReport.disabled = false;
  }

  /* ---------------------------------------------------------
     Draft report generation — ข้อความตามแม่แบบจากเคสจริงในกลุ่ม
     (ยังไม่ใช่ AI ร่างแบบอิสระ)
     --------------------------------------------------------- */
  function buildReportText(cluster) {
    var cases = getClusterCases(cluster.id);
    var villages = uniq(cases.map(function (c) { return c.village; }));

    var caseListText = cases.map(function (c, i) {
      return (i + 1) + ". " + c.patientName + " (" + c.caseId + ") — " + c.village + " — เริ่มป่วย " + formatThaiDate(c.onset) + " — " + c.disease;
    }).join("\n");

    var lines = [
      "รายงานการสอบสวนโรคเบื้องต้น (ร่างโดยระบบ)",
      "สร้างเมื่อ: " + formatThaiDateTime(new Date()),
      "",
      "กลุ่มเคส: " + cluster.name + " (" + cluster.clusterId + ")",
      "เกณฑ์จัดกลุ่ม: โรคเดียวกัน บ้านห่างกันไม่เกิน " + window.AidsrpCases.CLUSTER_RADIUS_M + " เมตร และเริ่มป่วยห่างกันไม่เกิน " +
        window.AidsrpCases.CLUSTER_DAYS + " วัน (" + criteriaLabel(cluster) + ")",
      "โรค/ภาวะที่พบ: " + cluster.disease,
      "พื้นที่: " + (cluster.subdistrict ? "ต." + cluster.subdistrict : "-"),
      "หมู่บ้าน/ชุมชนที่เกี่ยวข้อง: " + villages.join(", "),
      "จำนวนผู้ป่วยในกลุ่ม: " + cases.length + " ราย",
      "ช่วงวันเริ่มป่วย: " + onsetRangeLabel(cluster),
      "",
      "รายชื่อผู้ป่วยในกลุ่ม:",
      caseListText,
      "",
      "ข้อเสนอแนะเบื้องต้น: ทีมสอบสวนโรคควรลงพื้นที่ตรวจสอบแหล่งแพร่เชื้อร่วมของกลุ่มนี้ ค้นหาผู้ป่วยเพิ่มเติมในรัศมี 100 เมตรรอบบ้านผู้ป่วย และพิจารณามาตรการควบคุมโรคให้เหมาะกับชนิดของโรค",
      "",
      "หมายเหตุ: ร่างนี้สร้างจากข้อมูลเคสในทะเบียนผู้ป่วย (Google Sheet) โปรดตรวจสอบความถูกต้องและปรับแก้ก่อนนำเสนอผู้บริหาร"
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
     Cluster confirmation — บันทึกลงแท็บ "กลุ่มเคส" ก่อน แล้วค่อยแสดงว่ายืนยันแล้ว
     --------------------------------------------------------- */
  function confirmCluster(id) {
    var cluster = getClusterById(id);
    if (!cluster || cluster.status === "confirmed" || cluster.saving) return;
    var cases = getClusterCases(cluster.id);
    cluster.saving = true;
    renderClusterList();
    document.dispatchEvent(new CustomEvent("aidsrp:save-state", { detail: {
      tab: "clusters", requestId: "cluster:" + cluster.clusterId,
      records: [{
        clusterId: cluster.clusterId, name: cluster.name, disease: cluster.disease, subdistrict: cluster.subdistrict,
        caseCount: String(cases.length), caseIds: cases.map(function (c) { return c.caseId; }).join(", "), status: "ยืนยันแล้ว"
      }]
    } }));
  }

  document.addEventListener("aidsrp:state-saved", function (e) {
    var d = e.detail || {};
    if (String(d.requestId || "").indexOf("cluster:") !== 0) return;
    var key = d.requestId.slice("cluster:".length);
    CLUSTERS.forEach(function (cluster) {
      if (cluster.clusterId !== key) return;
      cluster.saving = false;
      if (d.ok) {
        cluster.status = "confirmed";
        cluster.confirmedAtLabel = formatThaiDateTime(new Date());
      } else {
        alert("บันทึกการยืนยันกลุ่มลงชีตไม่สำเร็จ: " + (d.error || ""));
      }
    });
    renderAll();
  });

  document.addEventListener("aidsrp:cases-loading", function () {
    loadInfo.loading = true;
    renderClusterMap();
    renderClusterList();
  });
  document.addEventListener("aidsrp:cases-ready", function (e) { applyCases(e.detail); });

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
    // เคสจริงมาจาก sheet-cases.js — ถ้าโหลดเสร็จก่อนหน้านี้ใช้ผลล่าสุดเลย ไม่งั้นแสดงสถานะกำลังโหลด
    if (window.AidsrpCases && window.AidsrpCases.last) applyCases(window.AidsrpCases.last);
    else renderAll();
    renderChat();
    initEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
