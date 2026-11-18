/* =========================================================
   AI-DSRP — แผนที่จริงด้วย Leaflet + OpenStreetMap (ใช้ร่วมกันทุกหน้าที่มีแผนที่)
   classic script (ไม่ใช่ module) เพราะไฟล์หน้าเป็น IIFE classic script ทั้งหมด
   ต้องโหลด Leaflet (leaflet.min.js/.css จาก cdnjs) ก่อนไฟล์นี้
   ใช้: var m = AidsrpMap.create(el); m.layer.clearLayers(); ... AidsrpMap.fit(m.map, points)
   ========================================================= */
(function () {
  "use strict";

  var THAILAND_CENTER = [13.5, 101];

  // สร้างแผนที่ในกล่อง el — คืน { map, layer } หรือ null ถ้าโหลด Leaflet ไม่ได้ (ไม่มีอินเทอร์เน็ต)
  function create(el) {
    if (typeof L === "undefined") {
      el.innerHTML = '<p class="body-secondary" style="padding:16px;">โหลดแผนที่ไม่ได้ (ต้องเชื่อมต่ออินเทอร์เน็ต)</p>';
      return null;
    }
    // ไม่ซูมด้วยลูกกลิ้งเมาส์ กันเผลอซูมระหว่างเลื่อนหน้า (ใช้ปุ่ม +/- แทน)
    var map = L.map(el, { scrollWheelZoom: false }).setView(THAILAND_CENTER, 5);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    var layer = L.layerGroup().addTo(map);
    // กรอบแผนที่เปลี่ยนขนาด (responsive/โหลด CSS ช้า) -> ให้ Leaflet คำนวณใหม่ ไม่งั้นจะเหลือพื้นที่เทาไม่มีแผนที่
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(function () { map.invalidateSize(); }).observe(el);
    }
    return { map: map, layer: layer };
  }

  // ซูมให้เห็นทุกจุด ([lat, lng] หรือ LatLngBounds) — จุดเดียวซูมระดับชุมชน, ไม่มีจุดคงมุมมองเดิม
  function fit(map, points, maxZoom) {
    maxZoom = maxZoom || 15;
    map.invalidateSize();
    if (!points || !points.length) return;
    if (points.length === 1) map.setView(points[0], maxZoom);
    else map.fitBounds(points, { padding: [40, 40], maxZoom: maxZoom });
  }

  window.AidsrpMap = { create: create, fit: fit };
})();
