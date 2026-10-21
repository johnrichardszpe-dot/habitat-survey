/* Habitat Survey - UI. All data in IndexedDB on this phone only. */
(function () {
  'use strict';
  var VERSION = HS.VERSION;
  var lang = (navigator.language || 'en').slice(0, 2); if (!STRINGS[lang]) lang = 'en';
  var L = STRINGS[lang];
  function t(k, v) {
    var s = L[k] != null ? L[k] : STRINGS.en[k]; if (s == null) s = k;
    if (v && typeof s === 'string') Object.keys(v).forEach(function (n) { s = s.split('{' + n + '}').join(v[n]); });
    return s;
  }
  function tt(k, sub) { var o = t(k); return (o && o[sub] != null) ? o[sub] : sub; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  var main = $('main');
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function toast(msg) { var e = $('toast'); e.textContent = msg; e.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { e.hidden = true; }, 2600); }
  function mapURL(r) { return 'https://www.openstreetmap.org/?mlat=' + r.lat + '&mlon=' + r.lon + '#map=18/' + r.lat + '/' + r.lon; }
  var COLORS = { tree: '#2e7d32', log: '#8d5a2b', nest: '#c77800', sighting: '#1565c0', sign: '#6a1b9a', threat: '#c62828' };

  // ---------- storage ----------
  var STORES = ['surveys', 'records', 'photos'], DB = { surveys: [], records: [], photos: [] }, idb = null;
  function openDB() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('no idb'));
      var q = indexedDB.open('habitat-survey', 1);
      q.onupgradeneeded = function () { STORES.forEach(function (s) { if (!q.result.objectStoreNames.contains(s)) q.result.createObjectStore(s, { keyPath: 'id' }); }); };
      q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); };
    });
  }
  function tx(store, mode, fn) {
    return new Promise(function (res, rej) {
      if (!idb) return res();
      var x = idb.transaction(store, mode), r = fn(x.objectStore(store));
      x.oncomplete = function () { res(r && r.result); }; x.onerror = function () { rej(x.error); };
    });
  }
  function put(store, obj) {
    var arr = DB[store], i = arr.findIndex(function (o) { return o.id === obj.id; });
    if (i >= 0) arr[i] = obj; else arr.push(obj);
    return tx(store, 'readwrite', function (s) { s.put(obj); }).catch(function () { toast(t('storageWarn')); });
  }
  function del(store, id) { DB[store] = DB[store].filter(function (o) { return o.id !== id; }); return tx(store, 'readwrite', function (s) { s.delete(id); }); }
  function loadAll() { return Promise.all(STORES.map(function (s) { return tx(s, 'readonly', function (st) { return st.getAll(); }).then(function (r) { DB[s] = r || []; }); })); }
  function get(store, id) { return DB[store].filter(function (o) { return o.id === id; })[0]; }
  function recsOf(sid) { return DB.records.filter(function (r) { return r.surveyId === sid; }).sort(function (a, b) { return a.t < b.t ? 1 : -1; }); }
  function photosOf(rid) { return DB.photos.filter(function (p) { return p.recordId === rid; }); }
  function delRecord(r) { photosOf(r.id).forEach(function (p) { del('photos', p.id); }); return del('records', r.id); }

  // ---------- sensors ----------
  var heading = null, gotAbs = false, compassOn = false;
  function onOrient(e, abs) {
    if (e.webkitCompassHeading != null) { heading = HS.norm360(e.webkitCompassHeading); if (window.onHeading) window.onHeading(); return; }
    var a = e.alpha; if (a == null || (!abs && !e.absolute)) return;
    var h = HS.cameraHeading(a, e.beta || 0, e.gamma || 0); if (h == null) h = HS.norm360(360 - a);
    heading = h; if (window.onHeading) window.onHeading();
  }
  function startCompass() {
    if (compassOn) return; compassOn = true;
    var go = function () {
      if ('ondeviceorientationabsolute' in window) addEventListener('deviceorientationabsolute', function (e) { gotAbs = true; onOrient(e, true); });
      addEventListener('deviceorientation', function (e) { if (!gotAbs) onOrient(e, false); });
    };
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(go, go);
    else go();
  }
  var gpsWatch = null;
  function stopGps() { if (gpsWatch != null && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatch); gpsWatch = null; }
  function bestGps(cb, fail) {
    stopGps(); if (!navigator.geolocation) return fail();
    var best = null, t0 = Date.now(), my;
    function got(p) {
      if (gpsWatch !== my) return;
      if (!best || p.coords.accuracy <= best.acc || Date.now() - t0 > 60000) best = { lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy * 10) / 10 };
      cb(best);
    }
    my = gpsWatch = navigator.geolocation.watchPosition(got, function () { if (!best) fail(); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    // quick first fix (at most 5 s old) while the watch waits for a fresh one
    navigator.geolocation.getCurrentPosition(got, function () {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
  }
  // Walk / track: runs independently of the screen being shown.
  var walk = { sid: null, watch: null, lastSave: 0, lock: null };
  function stopTrack() { if (walk.watch != null && navigator.geolocation) navigator.geolocation.clearWatch(walk.watch); walk.watch = null; if (walk.lock) { walk.lock.release().catch(function () {}); walk.lock = null; } }
  function startTrack(s) {
    stopTrack(); walk.sid = s.id;
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { walk.lock = l; }, function () {});
    if (!s.trackOn || !navigator.geolocation) return;
    walk.watch = navigator.geolocation.watchPosition(function (p) {
      var now = Date.now(); if (now - walk.lastSave < 15000) return; walk.lastSave = now;
      var cur = get('surveys', walk.sid); if (!cur || !cur.walkStart) return stopTrack();
      cur.track = cur.track || []; cur.track.push({ lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy), t: new Date(now).toISOString() });
      put('surveys', cur); if (window.onTrack) window.onTrack();
    }, function () {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 60000 });
  }
  document.addEventListener('visibilitychange', function () {
    var s = walk.sid && get('surveys', walk.sid);
    if (document.visibilityState === 'visible' && s && s.walkStart && !walk.lock && navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { walk.lock = l; }, function () {});
    if (document.visibilityState === 'visible' && walk.lock && walk.lock.released) walk.lock = null;
  });

  // ---------- files ----------
  function download(name, blob) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
    toast(t('exported', { f: name }));
  }
  function stamp() { return HS.localStamp(new Date().toISOString()).slice(0, 10); }
  function slug(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30); }
  function blobToData(b) { return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.readAsDataURL(b); }); }
  function dataToBlob(d) { return fetch(d).then(function (r) { return r.blob(); }); }
  function exportSheet(sid) {
    var s = sid && get('surveys', sid), base = 'habitat-survey' + (s ? '-' + slug(s.name) : '') + '-' + stamp();
    var anySens = DB.records.some(function (r) { return r.sensitive && (!sid || r.surveyId === sid); });
    sheet('<h2>' + t('exportTitle') + (s ? ': ' + esc(s.name) : '') + '</h2><p class="small">' + t('sensitiveNote') + '</p>' +
      '<label class="lbl">' + t('exportScope') + '<select id="eStep">' + ['0', '0.001', '0.01', '0.1'].map(function (k) { return '<option value="' + k + '"' + (k === '0.01' ? ' selected' : '') + '>' + esc(tt('round', k)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="lbl">' + t('roundWho') + '<select id="eScope">' + ['sensitive', 'all', 'none'].map(function (k) { return '<option value="' + k + '"' + (k === (anySens ? 'sensitive' : 'none') ? ' selected' : '') + '>' + esc(tt('roundScope', k)) + '</option>'; }).join('') + '</select></label>' +
      '<button class="go" id="eDwc">' + t('dwc') + '</button><p class="small">' + t('dwcHelp') + '</p><button class="go" id="eGen">' + t('gen') + '</button>' +
      '<button id="eJson">' + t('backup') + '</button><button data-close>' + t('close') + '</button>', function () {
      function opts() { var st = +$('eStep').value; return { step: st || 0, scope: st ? $('eScope').value : 'none', surveyId: sid }; }
      $('eDwc').onclick = function () { var rows = HS.dwcRows(DB, opts(), L); if (!rows.length) return toast(t('nothing')); download(base + '-darwin-core.csv', new Blob(['\ufeff' + HS.toCSV(HS.DWC_COLS, rows)], { type: 'text/csv' })); };
      $('eGen').onclick = function () { var rows = HS.generalRows(DB, opts(), L); if (!rows.length) return toast(t('nothing')); download(base + '-records.csv', new Blob(['\ufeff' + HS.toCSV(HS.GEN_COLS, rows)], { type: 'text/csv' })); };
      $('eJson').onclick = function () { backup(sid, base); };
    });
  }
  function backup(sid, base) {
    var sv = DB.surveys.filter(function (s) { return !sid || s.id === sid; }); if (!sv.length) return toast(t('nothing'));
    var ids = {}; sv.forEach(function (s) { ids[s.id] = 1; });
    var recs = DB.records.filter(function (r) { return ids[r.surveyId]; }), rids = {}; recs.forEach(function (r) { rids[r.id] = 1; });
    var ph = DB.photos.filter(function (p) { return rids[p.recordId]; });
    var withPhotos = ph.length && confirm(t('backupPhotos'));
    (withPhotos ? Promise.all(ph.map(function (p) { return blobToData(p.blob).then(function (d) { var c = Object.assign({}, p); delete c.blob; c.data = d; return c; }); })) : Promise.resolve([])).then(function (photos) {
      var o = { app: 'habitat-survey', version: VERSION, exported: new Date().toISOString(), surveys: sv, records: recs, photos: photos };
      download(base + '-backup.json', new Blob([JSON.stringify(o)], { type: 'application/json' }));
    });
  }
  function restore(file) {
    var r = new FileReader();
    r.onload = function () {
      var o; try { o = JSON.parse(r.result); } catch (e) { o = null; }
      if (!o || o.app !== 'habitat-survey') return toast(t('badFile'));
      var n = 0, jobs = [];
      ['surveys', 'records'].forEach(function (s) { (o[s] || []).forEach(function (x) { if (x && x.id) { n++; jobs.push(put(s, x)); } }); });
      (o.photos || []).forEach(function (p) { if (!p || !p.data) return; n++; jobs.push(dataToBlob(p.data).then(function (b) { var c = Object.assign({}, p); delete c.data; c.blob = b; return put('photos', c); })); });
      Promise.all(jobs).then(function () { toast(t('restored', { n: n })); render(); });
    };
    r.readAsText(file);
  }
  function recName(r) {
    var f = r.f || {};
    if (r.type === 'tree') { var d = HS.treeDbh(f); return (f.species || tt('types', 'tree')) + (d ? ', DBH ' + d + ' cm' : '') + (f.status === 'dead' ? ', ' + tt('status', 'dead') : '') + (HS.hollowTotal(f) ? ', ' + HS.hollowTotal(f) + ' hollows' : ''); }
    if (r.type === 'log') return tt('types', 'log') + (f.diam ? ' ' + f.diam + ' cm' : '') + (f.len ? ' × ' + f.len + ' m' : '') + (f.hollow ? ', hollow' : '');
    if (r.type === 'sighting') return (f.common || f.sci || tt('types', 'sighting')) + (f.count ? ' × ' + f.count : '') + (f.behaviour ? ', ' + tt('behaviour', f.behaviour).toLowerCase() : '');
    if (r.type === 'sign') return tt('sign', f.kind || 'other') + (f.common || f.sci ? ' — ' + (f.common || f.sci) : '');
    if (r.type === 'nest') return tt('nest', f.kind || 'other') + (f.common || f.sci ? ' — ' + (f.common || f.sci) : '');
    if (r.type === 'threat') return tt('threat', f.kind || 'other') + (f.severity ? ' (' + tt('severity', f.severity).toLowerCase() + ')' : '');
    return r.type;
  }
  function summaryText(s) {
    var o = HS.summary(DB, s.id), L2 = [t('sumHead', { name: s.name, date: HS.localStamp(s.created).slice(0, 10) })];
    if (o.walkSec) L2.push(t('sumWalk', { time: HS.hms(o.walkSec), dist: o.distance }));
    if (o.area) L2.push(t('sumArea', { a: o.area }));
    L2.push(HS.TYPES.filter(function (k) { return o.counts[k]; }).map(function (k) { return tt('types', k) + ': ' + o.counts[k]; }).join(', '));
    if (o.trees) L2.push(t('treesTotal') + ': ' + o.trees + (o.treesHa != null ? ' (' + t('perHa', { v: o.treesHa }) + ')' : '') + '; ' + t('stags') + ': ' + o.stags + '; ' + t('hollowsTotal') + ': ' + o.hollows.hs + ' / ' + o.hollows.hm + ' / ' + o.hollows.hl);
    if (s.wa && o.trees) L2.push(t('cockyCount') + ': ' + o.cocky);
    if (o.logs) L2.push(t('logsTotal') + ': ' + o.logLen + ' m');
    if (o.species.length) L2.push(t('speciesList') + ': ' + o.species.map(function (e) { return (e.common || e.sci) + (e.count ? ' ×' + e.count : ''); }).join(', '));
    var th = Object.keys(o.threats); if (th.length) L2.push(t('threatsList') + ': ' + th.map(function (k) { return tt('threat', k) + ' ×' + o.threats[k]; }).join(', '));
    if (o.condition != null) L2.push(t('condResult', { s: o.condition }));
    L2.push(t('sumFoot')); L2.push('— ' + t('appName') + ' (free) ' + location.href.split('#')[0]);
    return L2.join('\n');
  }
  function shareSummary(s) {
    var txt = summaryText(s);
    sheet('<h2>' + esc(t('share')) + '</h2><textarea id="sumTxt" rows="12" readonly>' + esc(txt) + '</textarea><button class="go" id="cp">' + t('copy') + '</button>' +
      (navigator.share ? '<button id="shr">' + t('share') + '</button>' : '') + '<button data-close>' + t('close') + '</button>', function () {
      $('cp').onclick = function () { $('sumTxt').select(); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast(t('copied')); }, function () { document.execCommand('copy'); toast(t('copied')); }); };
      if ($('shr')) $('shr').onclick = function () { navigator.share({ title: t('appName'), text: txt }).catch(function () {}); };
    });
  }
  function sheet(html, init) {
    var s = $('sheet'); s.innerHTML = '<div class="panel">' + html + '</div>'; s.hidden = false;
    s.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = closeSheet; }); if (init) init(s);
  }
  function closeSheet() { $('sheet').hidden = true; $('sheet').innerHTML = ''; }

  // ---------- views ----------
  var cleanup = null;
  function go(h) { location.hash = h; }
  function render() {
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    stopGps(); window.onHeading = null; window.onTrack = null; closeSheet();
    var h = location.hash.replace(/^#\/?/, '').split('/'), v = h[0] || '', id = h[1];
    document.body.className = 'v-' + (v || 'home'); scrollTo(0, 0);
    if (v === 'survey' && get('surveys', id)) viewSurvey(get('surveys', id));
    else if (v === 'edit') viewSurveyEdit(id === 'new' ? null : get('surveys', id));
    else if (v === 'new' && get('surveys', id) && HS.TYPES.indexOf(h[2]) >= 0) viewRecord(null, get('surveys', id), h[2]);
    else if (v === 'rec' && get('records', id)) viewRecord(get('records', id));
    else if (v === 'photo' && get('records', id)) viewPhoto(get('records', id));
    else if (v === 'sum' && get('surveys', id)) viewSummary(get('surveys', id));
    else if (v === 'about') viewAbout();
    else viewHome();
  }
  function top(title, backTo) {
    return '<header class="bar">' + (backTo != null ? '<a class="back" href="#' + backTo + '">' + t('back') + '</a>' : '<img class="logo" src="icons/icon-192.png" alt="">') +
      '<h1>' + esc(title) + '</h1></header>';
  }
  function sel(name, map, cur, keys) { return '<select name="' + name + '">' + (keys || Object.keys(map)).map(function (k) { return '<option value="' + esc(k) + '"' + (k === (cur || '') ? ' selected' : '') + '>' + esc(map[k]) + '</option>'; }).join('') + '</select>'; }
  function radios(name, map, cur) { return '<div class="seg">' + Object.keys(map).map(function (k) { return '<label><input type="radio" name="' + name + '" value="' + k + '"' + (k === cur ? ' checked' : '') + '><span>' + esc(map[k]) + '</span></label>'; }).join('') + '</div>'; }

  function viewHome() {
    var h = top(t('appName')) + '<p class="lead">' + t('tagline') + '</p><a class="btn go big" href="#edit/new">' + t('newSurvey') + '</a><h2>' + t('surveys') + '</h2>';
    var list = DB.surveys.slice().sort(function (a, b) { return a.created < b.created ? 1 : -1; });
    if (!list.length) h += '<p class="empty">' + t('noSurveys') + '</p>';
    list.forEach(function (s) {
      var n = recsOf(s.id).length;
      h += '<a class="item" href="#survey/' + s.id + '"><b>' + esc(s.name) + (s.walkStart ? ' <span class="chip live">' + t('walking') + '</span>' : '') + '</b><span>' + HS.localStamp(s.created).slice(0, 10) + ' · ' + n + ' records</span></a>';
    });
    h += '<div class="card warn">' + t('sensitiveNote') + '</div><div class="row"><button id="bExp">' + t('exportAll') + '</button><button id="bRes">' + t('restore') + '</button></div>' +
      '<input type="file" id="fRes" accept=".json,application/json" hidden><a class="btn" href="#about">' + t('about') + '</a><p class="small center">' + t('version', { v: VERSION }) + ' · John Richards</p>';
    main.innerHTML = h;
    $('bExp').onclick = function () { exportSheet(null); };
    $('bRes').onclick = function () { $('fRes').click(); }; $('fRes').onchange = function () { if (this.files[0]) restore(this.files[0]); };
  }

  function viewSurveyEdit(s) {
    var isNew = !s; s = s || { id: uid(), created: new Date().toISOString(), method: 'incidental', segs: [], track: [], trackOn: true, cond: {} };
    var h = top(isNew ? t('newSurvey').replace('+ ', '') : t('editSurvey'), isNew ? '' : 'survey/' + s.id) + '<form id="f" class="form">' +
      '<label>' + t('surveyName') + '<input name="name" required maxlength="80" placeholder="' + esc(t('surveyNameEg')) + '" value="' + esc(s.name || '') + '"></label>' +
      '<label>' + t('observer') + '<input name="observer" maxlength="80" value="' + esc(s.observer || '') + '"></label>' +
      '<label>' + t('methodQ') + sel('method', t('method'), s.method) + '</label>' +
      '<label>' + t('area') + '<input name="area" inputmode="decimal" value="' + esc(s.area || '') + '"></label><p class="small">' + t('areaHelp') + '</p><div class="picks">' +
      t('areaPicks').map(function (p) { return '<button type="button" class="btn small" data-a="' + p[0] + '">' + esc(p[1]) + '</button>'; }).join('') + '</div>' +
      '<label class="opt"><input type="checkbox" name="wa"' + (s.wa ? ' checked' : '') + '> ' + t('waHelper') + '</label>' +
      '<label>' + t('notes') + '<textarea name="notes" rows="2" placeholder="' + esc(t('surveyNotesEg')) + '">' + esc(s.notes || '') + '</textarea></label>' +
      '<details' + (HS.conditionScore(s.cond) != null ? ' open' : '') + '><summary>' + t('condTitle') + '</summary><p class="small">' + t('condHelp') + '</p>' +
      HS.COND_ITEMS.map(function (k) { var o = { '': '—' }; tt('condOpts', k).forEach(function (x, i) { o[i] = i + ' – ' + x; }); return '<label>' + esc(tt('condItems', k)) + sel('c_' + k, o, s.cond && s.cond[k] != null ? String(s.cond[k]) : '', [''].concat(['0', '1', '2'])) + '</label>'; }).join('') +
      '</details><button class="go big" type="submit">' + t('save') + '</button>' + (isNew ? '' : '<button type="button" class="bad" id="bDel">' + t('delSurvey') + '</button>') + '</form>';
    main.innerHTML = h;
    var f = $('f');
    main.querySelectorAll('[data-a]').forEach(function (b) { b.onclick = function () { f.area.value = b.dataset.a; }; });
    if (isNew && navigator.geolocation) navigator.geolocation.getCurrentPosition(function (p) { if (HS.inWA(p.coords.latitude, p.coords.longitude) && f.wa) f.wa.checked = true; }, function () {}, { maximumAge: 600000, timeout: 15000 });
    f.onsubmit = function (e) {
      e.preventDefault();
      s.name = f.name.value.trim() || 'Survey'; s.observer = f.observer.value.trim(); s.method = f.method.value; s.area = f.area.value.trim(); s.wa = f.wa.checked; s.notes = f.notes.value;
      s.cond = {}; HS.COND_ITEMS.forEach(function (k) { var v = f['c_' + k].value; if (v !== '') s.cond[k] = +v; });
      put('surveys', s).then(function () { go('survey/' + s.id); });
    };
    if ($('bDel')) $('bDel').onclick = function () {
      if (!confirm(t('confirmDelSurvey'))) return; if (walk.sid === s.id) stopTrack();
      recsOf(s.id).forEach(delRecord); del('surveys', s.id).then(function () { go(''); });
    };
  }

  function viewSurvey(s) {
    var rs = recsOf(s.id);
    var h = top(s.name, '') +
      '<div class="card walk"><div class="wrow"><div><small>' + t('walkTime') + '</small><b id="wt">' + HS.hms(HS.walkSeconds(s)) + '</b></div><div><small>' + t('walkDist') + '</small><b id="wd">' + HS.trackDistance(s.track) + ' m</b></div></div>' +
      '<button class="' + (s.walkStart ? 'bad' : 'go') + '" id="bWalk">' + (s.walkStart ? t('stopWalk') : t('startWalk')) + '</button>' +
      '<label class="opt"><input type="checkbox" id="cTrack"' + (s.trackOn ? ' checked' : '') + '> ' + t('trackOn') + '</label><p class="small"><span id="tpn">' + t('trackPts', { n: (s.track || []).length }) + '</span> · ' + t('trackHelp') + '</p></div>' +
      '<h2>' + t('addRecord') + '</h2><div class="types">' + HS.TYPES.map(function (k) { return '<a class="tbtn" style="--c:' + COLORS[k] + '" href="#new/' + s.id + '/' + k + '"><i>' + tt('typeIcons', k) + '</i>' + esc(tt('types', k)) + '</a>'; }).join('') + '</div>' +
      '<h2>' + t('records', { n: rs.length }) + '</h2>' + (rs.length ? '' : '<p class="empty">' + t('noRecords') + '</p>') +
      rs.map(function (r) {
        return '<div class="item rec" style="--c:' + COLORS[r.type] + '"><a href="#rec/' + r.id + '"><b>' + tt('typeIcons', r.type) + ' ' + esc(recName(r)) + (r.sensitive ? ' 🔒' : '') + '</b><span>' + HS.localStamp(r.t).slice(11) + ' · ' +
          (r.lat != null ? '±' + Math.round(r.acc) + ' m' : t('noGps')) + (photosOf(r.id).length ? ' · 📷' + photosOf(r.id).length : '') + '</span></a>' +
          (r.lat != null ? '<a class="maplink" target="_blank" rel="noopener" href="' + mapURL(r) + '">' + t('openMap') + '</a>' : '') + '</div>';
      }).join('') +
      '<a class="btn go" href="#sum/' + s.id + '">' + t('summaryMap') + '</a><div class="row"><button id="bShare">' + t('share') + '</button><button id="bExp">' + t('exportThis') + '</button></div><a class="btn" href="#edit/' + s.id + '">' + t('editSurvey') + '</a>';
    main.innerHTML = h;
    var tick = setInterval(function () { var c = get('surveys', s.id); if (c && $('wt')) $('wt').textContent = HS.hms(HS.walkSeconds(c)); }, 1000);
    cleanup = function () { clearInterval(tick); };
    window.onTrack = function () { var c = get('surveys', s.id); if (!c || !$('wd')) return; $('wd').textContent = HS.trackDistance(c.track) + ' m'; $('tpn').textContent = t('trackPts', { n: c.track.length }); };
    $('bWalk').onclick = function () {
      if (s.walkStart) { s.segs = (s.segs || []).concat([{ start: s.walkStart, end: new Date().toISOString() }]); s.walkStart = null; stopTrack(); }
      else { DB.surveys.forEach(function (o) { if (o.walkStart && o.id !== s.id) { o.segs = (o.segs || []).concat([{ start: o.walkStart, end: new Date().toISOString() }]); o.walkStart = null; put('surveys', o); } }); s.walkStart = new Date().toISOString(); walk.lastSave = 0; startTrack(s); }
      put('surveys', s).then(render);
    };
    $('cTrack').onchange = function () { s.trackOn = this.checked; put('surveys', s); if (s.walkStart) startTrack(s); };
    $('bShare').onclick = function () { shareSummary(s); };
    $('bExp').onclick = function () { exportSheet(s.id); };
  }

  function viewRecord(r, s, type) {
    var isNew = !r;
    if (isNew) r = { id: uid(), surveyId: s.id, type: type, t: new Date().toISOString(), lat: null, lon: null, acc: null, f: type === 'tree' ? { dbhMode: 'circ', status: 'alive', group: 'other' } : type === 'sighting' ? { count: 1 } : {}, notes: '', sensitive: false };
    s = s || get('surveys', r.surveyId); var f0 = r.f, ty = r.type;
    var h = top(tt('typeIcons', ty) + ' ' + tt('types', ty), 'survey/' + s.id) + '<form id="f" class="form">' +
      '<div class="card gps"><b>' + t('gps') + '</b> <span id="gpsTxt">' + (r.lat != null ? t('gpsKeep', { acc: Math.round(r.acc) }) + ' (' + r.lat + ', ' + r.lon + ')' : t('gpsWait')) + '</span>' + (isNew ? '' : '<button type="button" class="btn small" id="bGps">' + t('gpsAgain') + '</button>') + '</div>';
    function txt(name, label, ph, mode) { return '<label>' + label + '<input name="' + name + '"' + (mode ? ' inputmode="' + mode + '"' : '') + ' placeholder="' + esc(ph || '') + '" value="' + esc(f0[name] == null ? '' : f0[name]) + '"></label>'; }
    function names(lab) { return txt('common', lab || t('common'), t('commonEg')) + txt('sci', t('sci'), t('sciEg')); }
    if (ty === 'tree') {
      h += txt('species', t('treeSpecies'), t('treeSpeciesEg')) + '<fieldset><legend>' + t('dbh') + '</legend>' + radios('dbhMode', { circ: t('dbhCirc'), diam: t('dbhDiam') }, f0.dbhMode) +
        '<input name="dbhIn" id="dbhIn" inputmode="decimal" value="' + esc(f0.dbhIn || '') + '"><p class="hint" id="dbhOut"></p><p class="small">' + t('dbhHelp') + '</p></fieldset>' +
        '<fieldset><legend>' + t('treeStatus') + '</legend>' + radios('status', t('status'), f0.status) + '</fieldset>' +
        '<fieldset><legend>' + t('hollows') + '</legend><div class="hol">' + HS.HOLLOW_CLASSES.map(function (k) { return '<label>' + t(k) + '<div class="step"><button type="button" data-m="' + k + '">−</button><input name="' + k + '" inputmode="numeric" value="' + esc(f0[k] || 0) + '"><button type="button" data-p="' + k + '">+</button></div></label>'; }).join('') +
        '</div><p class="small">' + t('hollowHelp') + '</p><label class="opt"><input type="checkbox" name="used"' + (f0.used ? ' checked' : '') + '> ' + t('useSigns') + '</label></fieldset>';
      if (s.wa) h += '<fieldset class="cocky"><legend>' + t('cockyTitle') + '</legend>' + radios('group', t('cockyGroups'), f0.group || 'other') + '<p id="cky" class="hint"></p><p class="small">' + t('cockyNote') + '</p></fieldset>';
    } else if (ty === 'log') {
      h += txt('diam', t('logDiam'), '', 'decimal') + txt('len', t('logLen'), '', 'decimal') + '<label class="opt"><input type="checkbox" name="hollow"' + (f0.hollow ? ' checked' : '') + '> ' + t('logHollow') + '</label><p class="small">' + t('logHelp') + '</p>';
    } else if (ty === 'nest') {
      h += '<label>' + t('nestKind') + sel('kind', t('nest'), f0.kind) + '</label>' + txt('height', t('nestHeight'), '', 'decimal') + '<label>' + t('nestStatus') + sel('status', t('nestStatus'), f0.status) + '</label>' + names(t('nestWho'));
    } else if (ty === 'sighting') {
      h += names() + '<label>' + t('count') + '<div class="step"><button type="button" data-m="count">−</button><input name="count" inputmode="numeric" value="' + esc(f0.count == null ? 1 : f0.count) + '"><button type="button" data-p="count">+</button></div></label>' +
        '<label>' + t('behaviour') + sel('behaviour', t('behaviour'), f0.behaviour) + '</label><label class="opt"><input type="checkbox" name="heard"' + (f0.heard ? ' checked' : '') + '> ' + t('heard') + '</label>';
    } else if (ty === 'sign') {
      h += '<label>' + t('signKind') + sel('kind', t('sign'), f0.kind) + '</label>' + names(t('signWho'));
    } else if (ty === 'threat') {
      h += '<label>' + t('threatKind') + sel('kind', t('threat'), f0.kind) + '</label><label>' + t('severity') + sel('severity', t('severity'), f0.severity || 'med') + '</label>';
    }
    h += '<label>' + t('notes') + '<textarea name="notes" rows="2">' + esc(r.notes || '') + '</textarea></label>' +
      '<label class="opt sens"><input type="checkbox" name="sensitive"' + (r.sensitive ? ' checked' : '') + '> ' + t('sensitive') + '</label>' +
      '<div class="thumbs" id="th"></div><button type="button" id="bPhoto">' + t('addPhoto') + '</button>' +
      '<button class="go big" type="submit">' + t('save') + '</button>' + (isNew ? '' : '<button type="button" class="bad" id="bDel">' + t('del') + '</button>') + '</form>';
    main.innerHTML = h;
    var f = $('f'), urls = [];
    $('th').innerHTML = photosOf(r.id).map(function (p) { var u = URL.createObjectURL(p.blob); urls.push(u); return '<figure><img src="' + u + '" alt=""><figcaption>' + (p.bearing != null ? p.bearing + '° ' + HS.compassWord(p.bearing) : '') + '</figcaption></figure>'; }).join('');
    cleanup = function () { urls.forEach(URL.revokeObjectURL); };
    function gps() {
      bestGps(function (b) { r.lat = b.lat; r.lon = b.lon; r.acc = b.acc; if ($('gpsTxt')) $('gpsTxt').textContent = t('gpsGot', { acc: Math.round(b.acc) }) + ' (' + b.lat + ', ' + b.lon + ')'; },
        function () { if ($('gpsTxt')) $('gpsTxt').textContent = t('gpsFail'); });
    }
    if (isNew) gps(); if ($('bGps')) $('bGps').onclick = gps;
    main.querySelectorAll('[data-p],[data-m]').forEach(function (b) {
      b.onclick = function () { var k = b.dataset.p || b.dataset.m, i = f[k], v = (parseInt(i.value, 10) || 0) + (b.dataset.p ? 1 : -1); i.value = Math.max(0, v); i.dispatchEvent(new Event('input')); };
    });
    function upd() {
      if (ty !== 'tree') return;
      var mode = (f.querySelector('[name=dbhMode]:checked') || {}).value || 'circ', d = HS.treeDbh({ dbhMode: mode, dbhIn: f.dbhIn.value });
      $('dbhOut').textContent = d ? (mode === 'circ' ? t('dbhIs', { d: d }) : 'Circumference = ' + HS.circFromDbh(d) + ' cm') : '';
      if ($('cky')) { var g = (f.querySelector('[name=group]:checked') || {}).value, c = HS.cockatooCheck(d, g); $('cky').innerHTML = c ? t('cocky')[c.level].replace('{mm}', c.mm).replace('{th}', c.threshold) : ''; $('cky').className = 'hint ck-' + (c ? c.level : ''); }
    }
    f.addEventListener('input', upd); f.addEventListener('change', upd); upd();
    function collect() {
      var o = {};
      Array.prototype.forEach.call(f.elements, function (el) {
        if (!el.name || el.name === 'notes' || el.name === 'sensitive') return;
        if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; } else if (el.type === 'checkbox') o[el.name] = el.checked; else o[el.name] = el.value.trim();
      });
      r.f = o; r.notes = f.notes.value.trim(); r.sensitive = f.sensitive.checked; return put('records', r);
    }
    f.onsubmit = function (e) { e.preventDefault(); stopGps(); collect().then(function () { toast(t('saved')); go('survey/' + s.id); }); };
    $('bPhoto').onclick = function () { stopGps(); collect().then(function () { go('photo/' + r.id); }); };
    if ($('bDel')) $('bDel').onclick = function () { if (confirm(t('confirmDel'))) delRecord(r).then(function () { go('survey/' + s.id); }); };
  }

  function compress(src, w, h) {
    var max = 1280, k = Math.min(1, max / Math.max(w, h)), cv = document.createElement('canvas');
    cv.width = Math.round(w * k); cv.height = Math.round(h * k); cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
    return new Promise(function (res) { cv.toBlob(function (b) { res({ blob: b, w: cv.width, h: cv.height }); }, 'image/jpeg', 0.7); });
  }
  function viewPhoto(r) {
    var stream = null, back = '#rec/' + r.id;
    main.innerHTML = '<div class="cam"><video id="vid" playsinline muted autoplay></video>' +
      '<div class="camtop"><a class="back" href="' + back + '">' + t('back') + '</a><span>' + esc(tt('types', r.type)) + '</span><span id="hd">' + t('noCompass') + '</span></div>' +
      '<div class="cambot"><button class="go big" id="snap">' + t('takePhoto') + '</button><button id="pick">' + t('pickPhoto') + '</button>' +
      '<input type="file" id="file" accept="image/*" capture="environment" hidden></div></div>';
    document.body.className = 'v-photo';
    cleanup = function () { if (stream) stream.getTracks().forEach(function (tr) { tr.stop(); }); };
    startCompass();
    window.onHeading = function () { if (heading != null && $('hd')) $('hd').textContent = t('facing', { b: Math.round(heading), w: HS.compassWord(heading) }); };
    function saveBlob(x) {
      var o = { id: uid(), recordId: r.id, date: new Date().toISOString(), bearing: heading == null ? null : Math.round(heading), w: x.w, h: x.h, blob: x.blob };
      put('photos', o).then(function () { toast(t('photoSaved')); location.hash = back; });
    }
    var vid = $('vid');
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
        .then(function (st) { stream = st; vid.srcObject = st; }, function () { toast(t('noCamera')); });
    } else toast(t('noCamera'));
    $('snap').onclick = function () { if (!stream || !vid.videoWidth) return $('file').click(); compress(vid, vid.videoWidth, vid.videoHeight).then(saveBlob); };
    $('pick').onclick = function () { $('file').click(); };
    $('file').onchange = function () {
      var fl = this.files[0]; if (!fl) return;
      var img = new Image(), u = URL.createObjectURL(fl);
      img.onload = function () { compress(img, img.naturalWidth, img.naturalHeight).then(function (x) { URL.revokeObjectURL(u); saveBlob(x); }); };
      img.src = u;
    };
  }

  function drawMap(cv, s, recs) {
    var W = cv.clientWidth || 340, H = Math.round(W * 0.9), dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
    var c = cv.getContext('2d'); c.scale(dpr, dpr); c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, W, H);
    var tr = (s.track || []).filter(function (p) { return p.acc == null || p.acc <= 50; }), pts = recs.filter(function (r) { return r.lat != null; });
    var all = tr.concat(pts); if (!all.length) { c.fillStyle = '#666'; c.font = '15px sans-serif'; c.fillText(t('noPoints'), 16, 30); return false; }
    var o = tr[0] || pts.slice().sort(function (a, b) { return a.t < b.t ? -1 : 1; })[0];
    var xy = all.map(function (p) { return HS.toXY(o, p); }), minX = 0, maxX = 0, minY = 0, maxY = 0;
    xy.forEach(function (p) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    var span = Math.max(maxX - minX, maxY - minY, 40), pad = 28, k = (Math.min(W, H) - 2 * pad) / span;
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    function X(p) { return W / 2 + (p.x - cx) * k; } function Y(p) { return H / 2 - (p.y - cy) * k; }
    // grid + scale bar
    var nice = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000], bar = nice.filter(function (m) { return m * k <= W / 3; }).pop() || 5;
    c.strokeStyle = '#e3dccb'; c.lineWidth = 1;
    for (var gx = W / 2 - Math.ceil(W / 2 / (bar * k)) * bar * k; gx < W; gx += bar * k) { c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, H); c.stroke(); }
    for (var gy = H / 2 - Math.ceil(H / 2 / (bar * k)) * bar * k; gy < H; gy += bar * k) { c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.stroke(); }
    c.fillStyle = '#333'; c.fillRect(12, H - 16, bar * k, 4); c.font = '13px sans-serif'; c.fillText(t('scale', { m: bar >= 1000 ? bar / 1000 + ' k' : bar }), 12, H - 22);
    c.beginPath(); c.moveTo(W - 20, 12); c.lineTo(W - 27, 30); c.lineTo(W - 13, 30); c.closePath(); c.fill(); c.fillText('N', W - 24, 44);
    if (tr.length > 1) { c.strokeStyle = '#555'; c.setLineDash([5, 4]); c.lineWidth = 2; c.beginPath(); tr.forEach(function (p, i) { var q = HS.toXY(o, p); i ? c.lineTo(X(q), Y(q)) : c.moveTo(X(q), Y(q)); }); c.stroke(); c.setLineDash([]); }
    var st = HS.toXY(o, o); c.fillStyle = '#000'; c.beginPath(); c.arc(X(st), Y(st), 5, 0, 7); c.fill(); c.fillText('Start', X(st) + 7, Y(st) - 6);
    pts.forEach(function (r) {
      var q = HS.toXY(o, r), x = X(q), y = Y(q); c.fillStyle = COLORS[r.type]; c.strokeStyle = '#fff'; c.lineWidth = 2;
      c.beginPath(); if (r.type === 'tree') c.arc(x, y, 7, 0, 7); else if (r.type === 'threat') { c.moveTo(x, y - 8); c.lineTo(x + 8, y + 6); c.lineTo(x - 8, y + 6); c.closePath(); } else c.rect(x - 6, y - 6, 12, 12);
      c.fill(); c.stroke();
    });
    return true;
  }
  function viewSummary(s) {
    var o = HS.summary(DB, s.id), recs = recsOf(s.id);
    function row(a, b) { return '<tr><td>' + a + '</td><td><b>' + b + '</b></td></tr>'; }
    function ha(v) { return v != null ? ' <span class="small">(' + t('perHa', { v: v }) + ')</span>' : ''; }
    var h = top(t('sumTitle') + ': ' + s.name, 'survey/' + s.id) +
      '<div class="card"><table class="lt">' + (o.walkSec ? row(t('walkTime'), HS.hms(o.walkSec)) + row(t('walkDist'), o.distance + ' m') : '') + (o.area ? row(t('area').split(' (')[0], o.area + ' ha') : '') +
      HS.TYPES.map(function (k) { return row(tt('typeIcons', k) + ' ' + tt('types', k), o.counts[k]); }).join('') + '</table></div>' +
      '<div class="card"><h3>' + tt('typeIcons', 'tree') + ' ' + t('treesTotal') + '</h3><table class="lt">' + row(t('treesTotal'), o.trees + ha(o.treesHa)) + row(t('stags'), o.stags + ha(o.stagsHa)) + row(t('hollowTrees'), o.hollowTrees + ha(o.hollowTreesHa)) +
      row(t('hollowsTotal'), o.hollowsTotal + ' <span class="small">(' + o.hollows.hs + ' / ' + o.hollows.hm + ' / ' + o.hollows.hl + ')</span>') + (s.wa ? row(t('cockyCount') + ' *', o.cocky) : '') + row(t('logsTotal'), o.logLen + ' m' + ha(o.logLenHa)) + '</table>' +
      (o.area ? '' : '<p class="small">' + t('needArea') + '</p>') + (s.wa ? '<p class="small">* ' + t('cockyNote') + '</p>' : '') + (o.condition != null ? '<p><b>' + t('condResult', { s: o.condition }) + '</b></p><p class="small">' + t('condHelp') + '</p>' : '') + '</div>' +
      '<div class="card"><h3>' + t('speciesList') + '</h3>' + (o.species.length ? '<ul>' + o.species.map(function (e) { return '<li><b>' + esc(e.common || e.sci) + '</b>' + (e.common && e.sci ? ' <i>' + esc(e.sci) + '</i>' : '') + ' — ' + e.records + ' rec.' + (e.count ? ', ' + e.count + ' seen' : '') + '</li>'; }).join('') + '</ul>' : '<p class="empty">' + t('noSpecies') + '</p>') +
      (Object.keys(o.threats).length ? '<h3>' + t('threatsList') + '</h3><ul>' + Object.keys(o.threats).map(function (k) { return '<li>' + esc(tt('threat', k)) + ' × ' + o.threats[k] + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
      '<div class="card"><h3>' + t('map') + '</h3><canvas id="map" class="map"></canvas><p class="legend">' + HS.TYPES.map(function (k) { return '<span><i style="background:' + COLORS[k] + '" class="' + k + '"></i>' + esc(tt('types', k)) + '</span>'; }).join('') + '</p><p class="small">' + t('mapHelp') + '</p></div>' +
      '<div class="row"><button id="bShare">' + t('share') + '</button><button id="bExp">' + t('exportThis') + '</button></div>';
    main.innerHTML = h;
    drawMap($('map'), s, recs);
    $('bShare').onclick = function () { shareSummary(s); }; $('bExp').onclick = function () { exportSheet(s.id); };
  }

  function viewAbout() {
    main.innerHTML = top(t('about'), '') + '<div class="card">' + t('aboutText') + '</div><div class="card"><h3>How to use</h3>' + t('howToText') + '</div>' +
      '<div class="card warn">' + t('sensitiveNote') + '</div><div class="card"><h3>' + t('limitsTitle') + '</h3>' + t('limitsText') + '</div>' +
      '<div class="card"><h3>' + t('sourcesTitle') + '</h3>' + t('sourcesText') + '</div>' +
      '<p class="small center">' + t('version', { v: VERSION }) + ' · <a href="https://github.com/johnrichardszpe-dot/habitat-survey">GitHub</a></p>';
  }

  // ---------- start ----------
  window.addEventListener('hashchange', render);
  $('sheet').addEventListener('click', function (e) { if (e.target.id === 'sheet') closeSheet(); });
  openDB().then(function (d) { idb = d; return loadAll(); }).catch(function () { toast(t('storageWarn')); }).then(function () {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    var w = DB.surveys.filter(function (s) { return s.walkStart; })[0]; if (w) startTrack(w);
    render();
  });
  if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  window.HSApp = { DB: DB, version: VERSION, summaryText: summaryText };
})();
