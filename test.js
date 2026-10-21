/* node test.js - unit tests for logic.js */
process.env.TZ = 'Australia/Perth';
var H = require('./logic.js'), assert = require('assert'), n = 0;
function t(name, fn) { fn(); n++; console.log('ok', name); }
var near = function (a, b, e) { assert(Math.abs(a - b) <= (e || 1e-9), a + ' != ' + b); };

t('DBH from circumference', function () {
  near(H.dbhFromCirc(157.1), 50.0); near(H.dbhFromCirc('94.25'), 30.0); near(H.dbhFromCirc('62,8'), 20.0);
  assert.strictEqual(H.dbhFromCirc(0), null); assert.strictEqual(H.dbhFromCirc(''), null); assert.strictEqual(H.dbhFromCirc('abc'), null);
  near(H.treeDbh({ dbhMode: 'diam', dbhIn: '48' }), 48); near(H.treeDbh({ dbhMode: 'circ', dbhIn: 314.16 }), 100);
  near(H.circFromDbh(50), 157.1);
});
t('hollows', function () { assert.strictEqual(H.hollowTotal({ hs: '2', hm: 1, hl: '', x: 9 }), 3); assert.strictEqual(H.hollowTotal({ hs: -1, hl: 2.7 }), 2); });
t('black cockatoo DBH thresholds (500 mm most; 300 mm salmon gum / wandoo; 300-500 future)', function () {
  assert.strictEqual(H.cockatooCheck(50, 'other').level, 'meets');      // exactly 500 mm
  assert.strictEqual(H.cockatooCheck(49.9, 'other').level, 'future');
  assert.strictEqual(H.cockatooCheck(30, 'other').level, 'future');
  assert.strictEqual(H.cockatooCheck(29.9, 'other').level, 'below');
  assert.strictEqual(H.cockatooCheck(30, 'sgw').level, 'meets');
  assert.strictEqual(H.cockatooCheck(29.9, 'sgw').level, 'below');
  assert.strictEqual(H.cockatooCheck(H.dbhFromCirc(157.1), 'other').mm, 500);
  assert.strictEqual(H.cockatooCheck(null, 'other'), null);
  assert(H.inWA(-31.95, 115.86)); assert(!H.inWA(-33.87, 151.21));
});
t('per hectare + plot areas', function () {
  assert.strictEqual(H.perHa(7, 0.1), 70); assert.strictEqual(H.perHa(3, 2), 1.5); assert.strictEqual(H.perHa(3, 0), null); assert.strictEqual(H.perHa(3, ''), null);
  near(H.plotHa(50, 20), 0.1); near(H.circleHa(56.42), 1, 1e-3);
});
t('distance + track', function () {
  near(H.haversine({ lat: -32, lon: 116 }, { lat: -32.001, lon: 116 }), 111.2, 0.2);
  var pts = [{ lat: -32, lon: 116, acc: 5 }, { lat: -32.00001, lon: 116, acc: 5 }, { lat: -32.001, lon: 116, acc: 5 }, { lat: -32.5, lon: 116, acc: 500 }, { lat: -32.002, lon: 116, acc: 8 }];
  near(H.trackDistance(pts), 222, 1);
  var o = H.toXY({ lat: -32, lon: 116 }, { lat: -32, lon: 116.001 }); near(o.x, 94.4, 0.3); near(o.y, 0);
  assert.strictEqual(H.walkSeconds({ segs: [{ start: '2026-01-01T00:00:00Z', end: '2026-01-01T00:10:00Z' }], walkStart: '2026-01-01T01:00:00Z' }, Date.parse('2026-01-01T01:00:30Z')), 630);
  assert.strictEqual(H.hms(3725), '1:02:05'); assert.strictEqual(H.hms(65), '1:05');
});
t('coordinate rounding', function () {
  assert.strictEqual(H.roundCoord(-31.95234, 0.01), -31.95); assert.strictEqual(H.roundCoord(115.8667, 0.01), 115.87);
  assert.strictEqual(H.roundCoord(-31.955, 0.1), -32); assert.strictEqual(H.roundCoord(1.23456, 0.001), 1.235); assert.strictEqual(H.roundCoord(1.23456, 0), 1.23456);
  assert.strictEqual(H.roundCoord(0.29, 0.1), 0.3);  // no 0.30000000000000004
  var u = H.roundingUncertainty(-32, 0.01); assert(u > 700 && u < 760, u);
});
t('CSV escaping + formula-injection guard', function () {
  assert.strictEqual(H.csvCell('a,b'), '"a,b"'); assert.strictEqual(H.csvCell('say "hi"'), '"say ""hi"""'); assert.strictEqual(H.csvCell('l1\nl2'), '"l1\nl2"');
  assert.strictEqual(H.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"'); assert.strictEqual(H.csvCell('+61 400'), "'+61 400");
  assert.strictEqual(H.csvCell('@SUM(A1)'), "'@SUM(A1)"); assert.strictEqual(H.csvCell('-cmd'), "'-cmd"); assert.strictEqual(H.csvCell('\tx'), "'\tx");
  assert.strictEqual(H.csvCell(-31.95), '-31.95'); assert.strictEqual(H.csvCell('-31.95'), '-31.95'); assert.strictEqual(H.csvCell(null), ''); assert.strictEqual(H.csvCell(true), 'yes');
  assert.strictEqual(H.toCSV(['a', 'b'], [{ a: 1, b: 'x,y' }]), 'a,b\r\n1,"x,y"\r\n');
});
var db = {
  surveys: [{ id: 's1', name: 'Creek, east', observer: 'Jo', method: 'area', area: '0.5', wa: true, created: '2026-10-21T01:00:00Z', segs: [{ start: '2026-10-21T01:00:00Z', end: '2026-10-21T01:30:00Z' }], track: [] }],
  records: [
    { id: 'r1', surveyId: 's1', type: 'sighting', t: '2026-10-21T01:05:00Z', lat: -31.952345, lon: 115.861234, acc: 6.4, f: { common: "Carnaby's Cockatoo", sci: 'Zanda latirostris', count: '12', behaviour: 'feeding' }, notes: '=bad()', sensitive: true },
    { id: 'r2', surveyId: 's1', type: 'tree', t: '2026-10-21T01:10:00Z', lat: -31.9525, lon: 115.8615, acc: 8, f: { species: 'Marri', dbhMode: 'circ', dbhIn: '170', status: 'alive', hs: 2, hm: 1, hl: 1 } },
    { id: 'r3', surveyId: 's1', type: 'tree', t: '2026-10-21T01:12:00Z', lat: -31.9526, lon: 115.8616, acc: 8, f: { species: 'Wandoo', group: 'sgw', dbhMode: 'diam', dbhIn: '35', status: 'dead' } },
    { id: 'r4', surveyId: 's1', type: 'sign', t: '2026-10-21T01:15:00Z', lat: -31.9527, lon: 115.8617, acc: 12, f: { kind: 'scat', common: 'Western Grey Kangaroo' } },
    { id: 'r5', surveyId: 's1', type: 'sign', t: '2026-10-21T01:16:00Z', lat: -31.9527, lon: 115.8617, acc: 12, f: { kind: 'digging' } },
    { id: 'r6', surveyId: 's1', type: 'log', t: '2026-10-21T01:17:00Z', lat: -31.9528, lon: 115.8618, acc: 9, f: { diam: '25', len: '4.5', hollow: true } },
    { id: 'r7', surveyId: 's1', type: 'threat', t: '2026-10-21T01:18:00Z', lat: null, lon: null, acc: null, f: { kind: 'weeds', severity: 'high' } }],
  photos: [{ id: 'p1', recordId: 'r1', bearing: 270 }]
};
t('Darwin Core mapping', function () {
  var rows = H.dwcRows(db, { step: 0.01, scope: 'sensitive' });
  assert.strictEqual(rows.length, 2); // sighting + named sign; unnamed sign, trees, logs, threats are not occurrences
  var a = rows[0];
  assert.strictEqual(a.basisOfRecord, 'HumanObservation'); assert.strictEqual(a.scientificName, 'Zanda latirostris'); assert.strictEqual(a.vernacularName, "Carnaby's Cockatoo");
  assert.strictEqual(a.individualCount, 12); assert.strictEqual(a.eventDate, '2026-10-21T09:05:00+08:00'); assert.strictEqual(a.occurrenceID, 'habitat-survey:r1');
  assert.strictEqual(a.decimalLatitude, -31.95); assert.strictEqual(a.decimalLongitude, 115.86); assert(a.coordinateUncertaintyInMeters > 700); assert(/rounded/.test(a.dataGeneralizations));
  assert.strictEqual(a.geodeticDatum, 'WGS84'); assert.strictEqual(a.samplingEffort, '30 min'); assert.strictEqual(a.recordedBy, 'Jo');
  var b = rows[1]; assert.strictEqual(b.decimalLatitude, -31.9527); assert.strictEqual(b.coordinateUncertaintyInMeters, 12); assert.strictEqual(b.individualCount, null); assert(/scat/.test(b.occurrenceRemarks));
  var none = H.dwcRows(db, { step: 0.01, scope: 'none' }); assert.strictEqual(none[0].decimalLatitude, -31.952345); assert.strictEqual(none[0].coordinateUncertaintyInMeters, 7);
  var all = H.dwcRows(db, { step: 0.1, scope: 'all' }); assert.strictEqual(all[1].decimalLatitude, -32);
  var csv = H.toCSV(H.DWC_COLS, rows); assert(csv.indexOf("'=bad()") > 0); assert.strictEqual(csv.split('\r\n')[0].split(',').length, H.DWC_COLS.length);
});
t('general rows', function () {
  var g = H.generalRows(db, {}); assert.strictEqual(g.length, 7);
  var tr = g.filter(function (r) { return r.record_id === 'r2'; })[0];
  near(tr.dbh_cm, 54.1); assert.strictEqual(tr.hollows_total, 4); assert(/^meets/.test(tr.cockatoo_dbh_check));
  assert.strictEqual(g[0].photo_bearings, '270');
});
t('survey summary', function () {
  var s = H.summary(db, 's1');
  assert.strictEqual(s.trees, 2); assert.strictEqual(s.stags, 1); assert.strictEqual(s.hollowsTotal, 4); assert.strictEqual(s.hollowTrees, 1);
  assert.strictEqual(s.treesHa, 4); assert.strictEqual(s.cocky, 2); assert.strictEqual(s.logLen, 4.5); assert.strictEqual(s.logLenHa, 9);
  assert.strictEqual(s.species.length, 2); assert.strictEqual(s.species[0].count, 12); assert.strictEqual(s.counts.sign, 2); assert.strictEqual(s.threats.weeds, 1);
  assert.strictEqual(s.walkSec, 1800);
  assert.strictEqual(H.conditionScore({ canopy: 2, under: 1, weeds: 0, logs: 2, bigtrees: 1 }), 6); assert.strictEqual(H.conditionScore({ canopy: 2 }), null);
});
console.log(n + ' test groups passed');
