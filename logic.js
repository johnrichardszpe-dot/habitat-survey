/* Habitat Survey - pure helpers shared by the app and the node tests (no DOM).
   Sources for every threshold are listed in README.md and the About screen. */
(function (root) {
  'use strict';
  var VERSION = '0.1.0';
  function num(x) { if (x == null || x === '') return null; x = +String(x).trim().replace(',', '.'); return isFinite(x) ? x : null; }
  function r1(x) { return x == null ? null : Math.round(x * 10) / 10; }

  // ---- trees ----
  // DBH (diameter at breast height, 1.3 m) from girth: diameter = circumference / pi. Both in cm.
  function dbhFromCirc(circCm) { var c = num(circCm); return c == null || c <= 0 ? null : r1(c / Math.PI); }
  function circFromDbh(dbhCm) { var d = num(dbhCm); return d == null || d <= 0 ? null : r1(d * Math.PI); }
  function treeDbh(f) { if (!f) return null; return f.dbhMode === 'diam' ? (num(f.dbhIn) > 0 ? r1(num(f.dbhIn)) : null) : dbhFromCirc(f.dbhIn); }
  // Hollow entrance size classes (smallest entrance width): small < 5 cm, medium 5-10 cm, large > 10 cm.
  var HOLLOW_CLASSES = ['hs', 'hm', 'hl'];
  function hollowTotal(f) { return HOLLOW_CLASSES.reduce(function (s, k) { var n = num(f && f[k]); return s + (n > 0 ? Math.floor(n) : 0); }, 0); }

  // WA black cockatoo DBH check (indicative only).
  // EPBC Act referral guidelines for three threatened black cockatoo species (DSEWPaC 2012): breeding habitat =
  //   trees of species known to support breeding with a suitable hollow OR DBH to develop one:
  //   "For most tree species, suitable DBH is 500 mm. For salmon gum and wandoo, suitable DBH is 300 mm."
  // Referral guideline for 3 WA threatened black cockatoo species (DAWE 2022): suitable nest hollows are only
  //   found in live trees with DBH >= 500 mm; trees 300-500 mm DBH may develop a nest hollow in future.
  var COCKY = { mmMost: 500, mmSGW: 300, mmFuture: 300 };
  function cockatooCheck(dbhCm, group) {
    var d = num(dbhCm); if (d == null || d <= 0) return null;
    var mm = Math.round(d * 10), sgw = group === 'sgw';
    if (sgw) return mm >= COCKY.mmSGW ? { level: 'meets', mm: mm, threshold: 300 } : { level: 'below', mm: mm, threshold: 300 };
    if (mm >= COCKY.mmMost) return { level: 'meets', mm: mm, threshold: 500 };
    if (mm >= COCKY.mmFuture) return { level: 'future', mm: mm, threshold: 500 };
    return { level: 'below', mm: mm, threshold: 500 };
  }
  // WA bounding box (rough) - used only to pre-tick the helper.
  function inWA(lat, lon) { return lat != null && lon != null && lat <= -13.5 && lat >= -35.3 && lon >= 112.8 && lon <= 129.01; }

  // ---- area ----
  function perHa(count, areaHa) { var a = num(areaHa), c = num(count); return a > 0 && c != null ? Math.round(c / a * 100) / 100 : null; }
  function plotHa(lenM, widM) { var l = num(lenM), w = num(widM); return l > 0 && w > 0 ? l * w / 10000 : null; }
  function circleHa(radiusM) { var r = num(radiusM); return r > 0 ? Math.PI * r * r / 10000 : null; }

  // ---- geo ----
  var D2R = Math.PI / 180, R2D = 180 / Math.PI, EARTH = 6371008.8;
  function haversine(a, b) {
    var p1 = a.lat * D2R, p2 = b.lat * D2R, dp = (b.lat - a.lat) * D2R, dl = (b.lon - a.lon) * D2R;
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  // Track length: ignore fixes worse than maxAcc and steps shorter than minStep (GPS jitter while standing).
  function trackDistance(pts, maxAcc, minStep) {
    maxAcc = maxAcc || 50; minStep = minStep || 5; var d = 0, last = null;
    (pts || []).forEach(function (p) {
      if (p.acc != null && p.acc > maxAcc) return;
      if (!last) { last = p; return; }
      var s = haversine(last, p); if (s >= minStep) { d += s; last = p; }
    });
    return Math.round(d);
  }
  // Local flat x/y in metres (east, north) from an origin - fine for a survey area of a few km.
  function toXY(o, p) { return { x: (p.lon - o.lon) * D2R * EARTH * Math.cos(o.lat * D2R), y: (p.lat - o.lat) * D2R * EARTH }; }
  function walkSeconds(s, nowMs) {
    var t = 0; (s.segs || []).forEach(function (g) { t += (Date.parse(g.end) - Date.parse(g.start)) / 1000; });
    if (s.walkStart) t += ((nowMs || Date.now()) - Date.parse(s.walkStart)) / 1000;
    return Math.max(0, Math.round(t));
  }
  function hms(sec) { sec = Math.round(sec || 0); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + pad(m) : m) + ':' + pad(s); }

  // Rounding ("generalising") coordinates for sensitive records. step in degrees, e.g. 0.01.
  function decimals(step) { var s = String(step); return s.indexOf('.') < 0 ? 0 : s.split('.')[1].length; }
  function roundCoord(v, step) {
    var x = num(v); if (x == null) return null; if (!step) return x;
    var d = decimals(step); return +(Math.round(x / step) * step).toFixed(d);
  }
  // Extra uncertainty from rounding: half-diagonal of the grid cell, in metres (rounded up).
  function roundingUncertainty(lat, step) {
    if (!step) return 0; var dy = step / 2 * D2R * EARTH, dx = step / 2 * D2R * EARTH * Math.cos(lat * D2R);
    return Math.ceil(Math.sqrt(dx * dx + dy * dy));
  }

  // ---- compass (same as sibling apps) ----
  function norm360(d) { d = d % 360; return d < 0 ? d + 360 : d; }
  function cameraHeading(alpha, beta, gamma) {
    var a = alpha * D2R, b = beta * D2R, g = gamma * D2R;
    var ca = Math.cos(a), sa = Math.sin(a), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
    var east = -(ca * sg + sa * sb * cg), north = ca * sb * cg - sa * sg;
    if (Math.abs(east) < 1e-9 && Math.abs(north) < 1e-9) return null;
    return norm360(Math.atan2(east, north) * R2D);
  }
  var DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  function compassWord(deg) { return deg == null ? '' : DIRS[Math.round(norm360(deg) / 45) % 8]; }

  // ---- dates ----
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function offs(t) { var o = -t.getTimezoneOffset(), s = o >= 0 ? '+' : '-'; o = Math.abs(o); return s + pad(Math.floor(o / 60)) + ':' + pad(o % 60); }
  function localStamp(iso) { var t = new Date(iso); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()) + ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes()); }
  // ISO 8601 with the phone's UTC offset, as Darwin Core eventDate recommends.
  function isoLocal(iso) { var t = new Date(iso); return localStamp(iso).replace(' ', 'T') + ':' + pad(t.getSeconds()) + offs(t); }

  // ---- CSV ----
  // RFC 4180 quoting + spreadsheet formula-injection guard: text starting with = + - @ tab or CR gets a leading '
  // (plain numbers such as -31.95 are left alone).
  function csvCell(v) {
    if (v == null) return ''; if (typeof v === 'number') return isFinite(v) ? String(v) : '';
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    var s = String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^[-+]?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(s)) s = "'" + s;
    return /[",\r\n]|^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(cols, rows) { return [cols].concat(rows.map(function (r) { return cols.map(function (c) { return r[c]; }); })).map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n'; }

  // ---- record helpers ----
  var TYPES = ['tree', 'log', 'nest', 'sighting', 'sign', 'threat'];
  function names(r) { var f = r.f || {}; return { common: (f.common || '').trim(), sci: (f.sci || '').trim() }; }
  function isOccurrence(r) { var n = names(r); return (r.type === 'sighting' || r.type === 'sign' || r.type === 'nest') && !!(n.common || n.sci); }
  function shouldRound(r, opts) { return !!(opts && opts.step) && (opts.scope === 'all' || (opts.scope !== 'none' && r.sensitive)); }
  function place(r, opts) {
    if (r.lat == null) return { lat: null, lon: null, unc: null, rounded: false };
    var acc = r.acc != null ? Math.max(1, Math.ceil(r.acc)) : null;
    if (!shouldRound(r, opts)) return { lat: r.lat, lon: r.lon, unc: acc, rounded: false };
    return { lat: roundCoord(r.lat, opts.step), lon: roundCoord(r.lon, opts.step), unc: (acc || 30) + roundingUncertainty(r.lat, opts.step), rounded: true };
  }
  function byTime(a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; }
  function remarks(r, L) {
    var f = r.f || {}, p = [];
    if (r.type === 'sign') p.push((L.signWord || 'Sign') + ': ' + (L.sign && L.sign[f.kind] || f.kind || ''));
    if (r.type === 'nest') p.push((L.nestWord || 'Nest') + ': ' + (L.nest && L.nest[f.kind] || f.kind || '') + (f.status ? ', ' + (L.nestStatus && L.nestStatus[f.status] || f.status) : '') + (num(f.height) != null ? ', ' + num(f.height) + ' m up' : ''));
    if (f.heard) p.push(L.heardOnly || 'heard only');
    if (r.notes) p.push(r.notes);
    return p.join('. ');
  }

  // Simple Darwin Core occurrence rows (sightings, signs and nests that have a name).
  var DWC_COLS = ['occurrenceID', 'basisOfRecord', 'occurrenceStatus', 'scientificName', 'vernacularName', 'individualCount', 'behavior',
    'eventDate', 'eventID', 'samplingProtocol', 'samplingEffort', 'decimalLatitude', 'decimalLongitude', 'geodeticDatum', 'coordinateUncertaintyInMeters',
    'dataGeneralizations', 'locality', 'recordedBy', 'occurrenceRemarks', 'associatedMedia'];
  function dwcRows(db, opts, L) {
    opts = opts || {}; L = L || {}; var sv = {}; (db.surveys || []).forEach(function (s) { sv[s.id] = s; });
    return (db.records || []).filter(function (r) { return isOccurrence(r) && sv[r.surveyId] && (!opts.surveyId || r.surveyId === opts.surveyId); }).sort(byTime).map(function (r) {
      var s = sv[r.surveyId], f = r.f || {}, n = names(r), pl = place(r, opts), np = (db.photos || []).filter(function (p) { return p.recordId === r.id; }).length;
      var cnt = num(f.count);
      return {
        occurrenceID: 'habitat-survey:' + r.id, basisOfRecord: 'HumanObservation', occurrenceStatus: 'present',
        scientificName: n.sci, vernacularName: n.common, individualCount: r.type === 'sighting' && cnt > 0 ? Math.round(cnt) : null,
        behavior: r.type === 'sighting' ? (L.behaviour && L.behaviour[f.behaviour]) || f.behaviour || '' : '',
        eventDate: isoLocal(r.t), eventID: 'habitat-survey:' + s.id, samplingProtocol: (L.method && L.method[s.method]) || s.method || '',
        samplingEffort: s.segs && s.segs.length ? Math.max(1, Math.ceil(walkSeconds(s) / 60)) + ' min' : '',
        decimalLatitude: pl.lat, decimalLongitude: pl.lon, geodeticDatum: pl.lat == null ? '' : 'WGS84', coordinateUncertaintyInMeters: pl.unc,
        dataGeneralizations: pl.rounded ? 'Coordinates rounded to ' + opts.step + ' degrees' : '', locality: s.name || '', recordedBy: s.observer || '',
        occurrenceRemarks: remarks(r, L), associatedMedia: np ? np + ' photo(s) kept by observer' : ''
      };
    });
  }

  var GEN_COLS = ['survey', 'survey_date', 'record_id', 'type', 'date_local', 'latitude', 'longitude', 'accuracy_m', 'coords_rounded', 'sensitive',
    'common_name', 'scientific_name', 'count', 'behaviour', 'heard_only', 'tree_species', 'dbh_cm', 'circumference_cm', 'tree_status',
    'hollows_small', 'hollows_medium', 'hollows_large', 'hollows_total', 'cockatoo_dbh_check', 'log_diameter_cm', 'log_length_m', 'log_hollow',
    'kind', 'nest_height_m', 'nest_status', 'severity', 'photos', 'photo_bearings', 'notes'];
  function generalRows(db, opts, L) {
    opts = opts || {}; L = L || {}; var sv = {}; (db.surveys || []).forEach(function (s) { sv[s.id] = s; });
    return (db.records || []).filter(function (r) { return sv[r.surveyId] && (!opts.surveyId || r.surveyId === opts.surveyId); }).sort(byTime).map(function (r) {
      var s = sv[r.surveyId], f = r.f || {}, pl = place(r, opts), ph = (db.photos || []).filter(function (p) { return p.recordId === r.id; });
      var tree = r.type === 'tree', d = tree ? treeDbh(f) : null, ck = tree && s.wa ? cockatooCheck(d, f.group) : null;
      var kindMap = L[r.type] || {};
      return {
        survey: s.name, survey_date: localStamp(s.created).slice(0, 10), record_id: r.id, type: (L.types && L.types[r.type]) || r.type, date_local: localStamp(r.t),
        latitude: pl.lat, longitude: pl.lon, accuracy_m: pl.unc, coords_rounded: pl.rounded, sensitive: !!r.sensitive,
        common_name: f.common || '', scientific_name: f.sci || '', count: num(f.count), behaviour: (L.behaviour && L.behaviour[f.behaviour]) || f.behaviour || '', heard_only: f.heard ? true : '',
        tree_species: tree ? f.species || '' : '', dbh_cm: d, circumference_cm: tree ? circFromDbh(d) : null, tree_status: tree ? ((L.status && L.status[f.status]) || f.status || '') : '',
        hollows_small: tree ? num(f.hs) : null, hollows_medium: tree ? num(f.hm) : null, hollows_large: tree ? num(f.hl) : null, hollows_total: tree ? hollowTotal(f) : null,
        cockatoo_dbh_check: ck ? ck.level + ' (' + ck.mm + ' mm vs ' + ck.threshold + ' mm)' : '',
        log_diameter_cm: r.type === 'log' ? num(f.diam) : null, log_length_m: r.type === 'log' ? num(f.len) : null, log_hollow: r.type === 'log' ? !!f.hollow : '',
        kind: f.kind ? (kindMap[f.kind] || f.kind) : '', nest_height_m: r.type === 'nest' ? num(f.height) : null, nest_status: r.type === 'nest' ? ((L.nestStatus && L.nestStatus[f.status]) || f.status || '') : '',
        severity: r.type === 'threat' ? ((L.severity && L.severity[f.severity]) || f.severity || '') : '',
        photos: ph.length || null, photo_bearings: ph.filter(function (p) { return p.bearing != null; }).map(function (p) { return p.bearing; }).join(' '), notes: r.notes || ''
      };
    });
  }

  // ---- survey summary ----
  function summary(db, surveyId) {
    var s = (db.surveys || []).filter(function (x) { return x.id === surveyId; })[0]; if (!s) return null;
    var recs = (db.records || []).filter(function (r) { return r.surveyId === surveyId; });
    var o = { counts: {}, trees: 0, stags: 0, hollowTrees: 0, hollows: { hs: 0, hm: 0, hl: 0 }, hollowsTotal: 0, cocky: 0, logs: 0, logLen: 0, species: [], threats: {}, records: recs.length };
    TYPES.forEach(function (k) { o.counts[k] = 0; });
    var sp = {};
    recs.forEach(function (r) {
      var f = r.f || {}; o.counts[r.type] = (o.counts[r.type] || 0) + 1;
      if (r.type === 'tree') {
        o.trees++; if (f.status === 'dead') o.stags++;
        var h = hollowTotal(f); if (h) o.hollowTrees++;
        HOLLOW_CLASSES.forEach(function (k) { var n = num(f[k]); if (n > 0) o.hollows[k] += Math.floor(n); }); o.hollowsTotal += h;
        var ck = cockatooCheck(treeDbh(f), f.group); if (ck && ck.level === 'meets') o.cocky++;
      }
      if (r.type === 'log') { o.logs++; var len = num(f.len); if (len > 0) o.logLen += len; }
      if (r.type === 'threat') o.threats[f.kind || 'other'] = (o.threats[f.kind || 'other'] || 0) + 1;
      if (isOccurrence(r)) {
        var n = names(r), key = (n.sci || n.common).toLowerCase();
        var e = sp[key] || (sp[key] = { common: n.common, sci: n.sci, records: 0, count: 0 });
        e.records++; if (!e.common && n.common) e.common = n.common; var c = num(f.count); if (r.type === 'sighting') e.count += c > 0 ? Math.round(c) : 1;
      }
    });
    o.logLen = Math.round(o.logLen * 10) / 10;
    o.species = Object.keys(sp).map(function (k) { return sp[k]; }).sort(function (a, b) { return (a.common || a.sci).localeCompare(b.common || b.sci); });
    o.area = num(s.area) > 0 ? num(s.area) : null;
    o.treesHa = perHa(o.trees, o.area); o.hollowTreesHa = perHa(o.hollowTrees, o.area); o.stagsHa = perHa(o.stags, o.area); o.logLenHa = perHa(o.logLen, o.area);
    o.walkSec = walkSeconds(s); o.distance = trackDistance(s.track);
    o.condition = conditionScore(s.cond);
    return o;
  }
  // Very simplified site condition score (0-10). Inspired by - but NOT - Habitat Hectares or Bushland Condition Monitoring.
  var COND_ITEMS = ['canopy', 'under', 'weeds', 'logs', 'bigtrees'];
  function conditionScore(c) {
    if (!c) return null; var t = 0, n = 0;
    COND_ITEMS.forEach(function (k) { var v = num(c[k]); if (v != null && v >= 0 && v <= 2) { t += v; n++; } });
    return n === COND_ITEMS.length ? t : null;
  }

  var api = { VERSION: VERSION, num: num, dbhFromCirc: dbhFromCirc, circFromDbh: circFromDbh, treeDbh: treeDbh, hollowTotal: hollowTotal, HOLLOW_CLASSES: HOLLOW_CLASSES,
    COCKY: COCKY, cockatooCheck: cockatooCheck, inWA: inWA, perHa: perHa, plotHa: plotHa, circleHa: circleHa, haversine: haversine, trackDistance: trackDistance,
    toXY: toXY, walkSeconds: walkSeconds, hms: hms, roundCoord: roundCoord, roundingUncertainty: roundingUncertainty, norm360: norm360, cameraHeading: cameraHeading,
    compassWord: compassWord, localStamp: localStamp, isoLocal: isoLocal, csvCell: csvCell, toCSV: toCSV, TYPES: TYPES, isOccurrence: isOccurrence, place: place,
    DWC_COLS: DWC_COLS, dwcRows: dwcRows, GEN_COLS: GEN_COLS, generalRows: generalRows, summary: summary, COND_ITEMS: COND_ITEMS, conditionScore: conditionScore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HS = api;
})(this);
