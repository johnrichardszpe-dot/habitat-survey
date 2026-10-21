/* Habitat Survey - all user-facing text. To translate: copy STRINGS.en to e.g. STRINGS.fr and translate the values. */
var STRINGS = {
  en: {
    appName: 'Habitat Survey', tagline: 'Free, offline habitat & wildlife-sign surveys',
    back: '‹ Back', save: 'Save', saved: 'Saved', del: 'Delete', cancel: 'Cancel', close: 'Close', edit: 'Edit', copy: 'Copy', copied: 'Copied',
    newSurvey: '+ New survey', surveys: 'Your surveys', noSurveys: 'No surveys yet. Tap “New survey” to start.',
    exportAll: 'Export / backup', restore: 'Restore backup', about: 'About & sources', badFile: 'That is not a Habitat Survey backup file.',
    restored: 'Restored {n} items', nothing: 'Nothing to export yet', exported: 'Saved {f}', storageWarn: 'Could not save on this phone (private mode?). Export often.',
    sensitiveNote: '<b>Protect wildlife:</b> do not post exact locations of nests, hollows or threatened species publicly. Use “round coordinates” when you export, and send precise records only to your state agency or a trusted data portal.',
    // survey form
    surveyName: 'Survey / site name', surveyNameEg: 'e.g. Creek reserve, north end', observer: 'Your name (optional, goes in exports as recordedBy)',
    methodQ: 'How are you surveying?', area: 'Area searched (hectares, optional)', areaHelp: 'Needed for “per hectare” results. Quick picks:',
    areaPicks: [['0.1', '50 × 20 m plot (0.1 ha)'], ['0.25', '50 × 50 m (0.25 ha)'], ['1', '100 × 100 m (1 ha)'], ['2', '2 ha (bird 20-min search)']],
    waHelper: 'Western Australia: show the black cockatoo tree-size helper', notes: 'Notes', surveyNotesEg: 'Weather, who came, anything else',
    condTitle: 'Quick site condition score (optional, simplified)',
    condHelp: 'A very simple 0–10 score to compare the same site over time. Inspired by Habitat Hectares and Bushland Condition Monitoring but <b>it is not either method</b> and cannot be compared with their scores.',
    condItems: { canopy: 'Native trees / canopy', under: 'Native shrubs, grasses & ground plants', weeds: 'Weeds (less is better)', logs: 'Fallen logs & leaf litter', bigtrees: 'Big old trees & hollows' },
    condOpts: { canopy: ['Absent or very sparse', 'Patchy', 'Close to natural'], under: ['Mostly gone', 'Some, patchy', 'Many types, healthy'], weeds: ['Weeds dominate (>50 %)', 'Some weeds (5–50 %)', 'Few or none (<5 %)'], logs: ['None', 'A few', 'Plenty'], bigtrees: ['None', 'One or two', 'Several'] },
    condResult: 'Condition score: {s} / 10', condNone: 'not scored',
    // survey page
    walk: 'Walk', startWalk: '▶ Start walk', stopWalk: '■ Stop walk', walking: 'Walking…', walkTime: 'Time', walkDist: 'Distance (GPS track)',
    trackOn: 'Record my GPS track (a point every 15 s)', trackPts: '{n} track points', trackHelp: 'Keep the screen on while walking — most phones stop GPS when the screen is off.',
    addRecord: 'Tap to record', records: 'Records ({n})', noRecords: 'Nothing recorded yet.', summaryMap: 'Summary & map', share: 'Share summary', exportThis: 'Export this survey',
    editSurvey: 'Edit survey', delSurvey: 'Delete survey', confirmDelSurvey: 'Delete this survey, all its records and photos? This cannot be undone.', confirmDel: 'Delete this record and its photos?',
    // record form
    gps: 'Location', gpsWait: 'Getting GPS…', gpsGot: 'GPS ±{acc} m', gpsFail: 'No GPS. Check location is on, or save without it.', gpsAgain: 'Update GPS', gpsKeep: 'Location saved ±{acc} m',
    noGps: 'no GPS', openMap: 'map', photos: 'Photos', addPhoto: '📷 Add photo', photoSaved: 'Photo saved', sensitive: 'Sensitive — threatened species, nest or hollow in use (round coordinates on export)',
    common: 'Common name', commonEg: 'e.g. Carnaby’s Cockatoo', sci: 'Scientific name (optional)', sciEg: 'e.g. Zanda latirostris', count: 'How many?', behaviour: 'What was it doing?', heard: 'Heard only (not seen)',
    treeSpecies: 'Tree species (optional)', treeSpeciesEg: 'e.g. Marri, River Red Gum, Oak', dbh: 'Trunk size at chest height (1.3 m)', dbhCirc: 'Around the trunk (circumference, cm)', dbhDiam: 'Diameter (cm)',
    dbhHelp: 'Wrap a tape around the trunk at 1.3 m above the ground (uphill side). The app works out diameter = circumference ÷ π.', dbhIs: 'DBH = {d} cm',
    treeStatus: 'Tree is', hollows: 'Hollows you can see (count by entrance size)', hollowHelp: 'Look at the trunk and branches from all sides. Count openings that look deeper than they are wide.',
    hs: 'Small (< 5 cm)', hm: 'Medium (5–10 cm)', hl: 'Large (> 10 cm)', useSigns: 'Signs of use (chew marks, scratches, feathers, droppings at a hollow)',
    cockyTitle: 'WA black cockatoo tree-size check (indicative)', cockyGroup: 'Tree type', cockyGroups: { other: 'Most trees (jarrah, marri, tuart, karri, etc.)', sgw: 'Salmon gum or wandoo' },
    cocky: {
      meets: '✔ DBH {mm} mm meets the {th} mm size in the Commonwealth guidelines for <b>potential black cockatoo breeding trees</b>.',
      future: '◐ DBH {mm} mm: below 500 mm, but trees of 300–500 mm DBH can develop nest hollows in future (2022 guideline).',
      below: '✗ DBH {mm} mm is below the {th} mm guideline size.'
    },
    cockyNote: 'Indicative only — not a survey to EPBC standard. Size alone does not make a breeding tree: species, range, hollows and use matter. Sources: DSEWPaC 2012; DAWE 2022 (see About).',
    logDiam: 'Diameter at the thick end (cm)', logLen: 'Length (m)', logHollow: 'Log is hollow', logHelp: 'Usually only logs at least 10 cm across and 0.5 m long are counted.',
    nestKind: 'Nest type', nestHeight: 'Height above ground (m, estimate)', nestStatus: 'Is it in use?', nestWho: 'Whose nest? (if known)',
    signKind: 'What did you find?', signWho: 'Which animal? (if known)', threatKind: 'Threat', severity: 'How bad?',
    // summary
    sumTitle: 'Summary', byType: 'Records by type', treesTotal: 'Habitat trees', stags: 'Dead trees (stags)', hollowTrees: 'Trees with hollows', hollowsTotal: 'Hollows (small / medium / large)',
    cockyCount: 'Trees meeting the black cockatoo DBH size', logsTotal: 'Logs (total length)', perHa: '{v} per ha', needArea: 'Enter the area searched to see per-hectare numbers.',
    speciesList: 'Species & animal signs', noSpecies: 'No named species yet.', threatsList: 'Threats', map: 'Map (no internet needed)',
    mapHelp: 'Points are drawn relative to where you started. North is up. The line is your GPS track.', noPoints: 'No GPS points yet.', scale: '{m} m',
    sumHead: 'Habitat Survey: {name} ({date})', sumWalk: 'Walk: {time}, {dist} m', sumArea: 'Area: {a} ha',
    sumFoot: 'Exact locations of sensitive records are not included.',
    // export
    exportTitle: 'Export', exportScope: 'Round coordinates (protects sensitive sites)', round: { 0: 'Exact (no rounding)', '0.001': '0.001° (about 100 m)', '0.01': '0.01° (about 1 km)', '0.1': '0.1° (about 10 km)' },
    roundWho: 'Round which records?', roundScope: { sensitive: 'Only records marked sensitive', all: 'All records', none: 'None' },
    dwc: 'Species records CSV (Darwin Core)', dwcHelp: 'For Atlas of Living Australia, iNaturalist-style or other biodiversity tools. Sightings, signs and nests that have a name. Check names and data before uploading.',
    gen: 'All records CSV (spreadsheet)', backup: 'Full backup (JSON)', backupPhotos: 'Include photos in the backup? (bigger file)', restoreHelp: 'Restore adds the backup to this phone; it does not delete anything.',
    // photo
    takePhoto: 'Take photo', pickPhoto: 'Choose from gallery', noCamera: 'Camera not available - choose a photo instead.', facing: 'Facing {b}° {w}', noCompass: 'No compass',
    // types and lists
    types: { tree: 'Habitat tree', log: 'Log / fallen wood', nest: 'Nest', sighting: 'Wildlife seen / heard', sign: 'Animal sign', threat: 'Threat' },
    typeIcons: { tree: '🌳', log: '🪵', nest: '🪺', sighting: '🐦', sign: '🐾', threat: '⚠️' },
    status: { alive: 'Alive', dead: 'Dead (stag)' },
    behaviour: { '': '—', feeding: 'Feeding', perched: 'Perched / resting', flying: 'Flying over', calling: 'Calling / singing', breeding: 'Breeding / at nest', roosting: 'Roosting', moving: 'Moving on ground', dead: 'Dead (roadkill etc.)', other: 'Other' },
    nest: { cup: 'Cup nest', platform: 'Stick platform', hollow: 'In a tree hollow', ground: 'On the ground', burrow: 'Burrow', mound: 'Mound', drey: 'Possum drey / ball nest', other: 'Other' },
    nestStatus: { '': 'Not sure', active: 'Active (eggs, young or adult sitting)', old: 'Old / empty' },
    sign: { scat: 'Scat / droppings', track: 'Tracks / footprints', digging: 'Diggings / scratchings', feathers: 'Feathers', chew: 'Chewed nuts, cones or bark', scratch: 'Scratches on a tree', burrow: 'Burrow / den', bones: 'Bones / remains', other: 'Other' },
    threat: { weeds: 'Weeds', feral: 'Feral animal sign (fox, cat, rabbit, pig…)', erosion: 'Erosion', rubbish: 'Rubbish / dumping', dieback: 'Dieback / dying plants', fire: 'Recent fire', clearing: 'Clearing / damage', other: 'Other' },
    severity: { low: 'Small / minor', med: 'Medium', high: 'Large / severe' },
    method: { incidental: 'Incidental / casual (whatever I come across)', area: 'Area search (I searched a set area)', point: 'Point count (stand still for a set time)', transect: 'Transect walk (along a set line)' },
    signWord: 'Sign', nestWord: 'Nest', heardOnly: 'heard only',
    version: 'Version {v}',
    howToText: '<ol><li><b>New survey</b>: name the site, pick how you are surveying, and enter the area if you searched a set area.</li><li><b>Start walk</b> (optional) to time your search and record a GPS track.</li><li>When you find something, tap a big button — <b>Habitat tree, Log, Nest, Wildlife, Sign or Threat</b>. GPS is taken automatically; fill in what you know and add a photo.</li><li><b>Stop walk</b>, then open <b>Summary & map</b>: totals, hollows, trees per hectare, species list and a map of your points.</li><li><b>Share</b> a text summary, or <b>Export</b> CSV / backup. Round coordinates for sensitive records.</li></ol>',
    aboutText: '<p><b>Habitat Survey</b> is a free app for simple habitat and wildlife-sign surveys by landcare groups, landholders, rangers, volunteers and schools — anywhere in the world. It works offline after the first load, has no account, no server and no adverts. Your data stays on your phone until you export it.</p><p>Made by <b>John Richards</b>.</p>',
    limitsTitle: 'Honest limits',
    limitsText: '<ul><li>This is a simple field notebook, <b>not</b> a formal survey method. Results are not a Habitat Hectares, BAM, Bushland Condition Monitoring or EPBC-standard survey.</li><li>The black cockatoo check only compares trunk size with the published guideline numbers. Real breeding value needs an expert: tree species, range, hollow size, height, orientation and evidence of use.</li><li>Ground counts of hollows usually miss some (and sometimes count false hollows); compare like with like.</li><li>Phone GPS is often ±5–20 m, worse under thick canopy. Track recording may stop if the screen turns off.</li><li>Species names are free text — check them before you upload anywhere. The app does not identify species.</li><li>Data lives only on this phone. Clearing browser data deletes it — export a backup often.</li></ul>',
    sourcesTitle: 'Methods & sources',
    sourcesText: '<ul>' +
      '<li>Black cockatoo tree size: <a href="https://www.agriculture.gov.au/sites/default/files/documents/referral-guidelines-wa-black-cockatoo.pdf">DSEWPaC (2012) EPBC Act referral guidelines for three threatened black cockatoo species</a> — breeding habitat: suitable DBH 500 mm for most tree species, 300 mm for salmon gum and wandoo; and <a href="https://www.dcceew.gov.au/environment/epbc/publications/referral-guideline-3-wa-threatened-black-cockatoo-species-2022">DAWE (2022) Referral guideline for 3 WA threatened black cockatoo species</a> — suitable nest hollows only in live trees ≥500 mm DBH; trees 300–500 mm may develop hollows in future.</li>' +
      '<li>Hollow-bearing trees and logs: <a href="https://data.nsw.gov.au/data/dataset/eba20049-ce63-47df-ac2b-34ef0353b35b/resource/d83efb88-7fb7-4d6b-9069-ec507adc10e8/download/d01878773-methodology-plot-layout-summary.pdf">NSW Biodiversity Assessment Method plot summary</a> (hollow entrance ≥5 cm and ≥1 m above ground; logs ≥10 cm diameter and ≥0.5 m long) and <a href="https://www.nespthreatenedspecies.edu.au/media/x1yndczo/1-1-1-tree-hollow-abundance-in-tropical-savannas-reseearch-findings-factsheet.pdf">NESP Threatened Species Hub factsheet on tree hollows</a> (entrance size classes small &lt;5 cm, medium 5–10 cm, large &gt;10 cm).</li>' +
      '<li>Condition ideas: Parkes D, Newell G, Cheal D (2003) Assessing the quality of native vegetation: the “habitat hectares” approach. <i>Ecological Management & Restoration</i> 4: S29–S38; Nature Conservation Society of South Australia, Bushland Condition Monitoring manual.</li>' +
      '<li>Bird counts: BirdLife Australia Birdata (2-ha 20-minute search, area and incidental searches); eBird (stationary, travelling and incidental checklists).</li>' +
      '<li>Data fields: <a href="https://dwc.tdwg.org/terms/">Darwin Core terms (TDWG)</a>; <a href="https://support.ala.org.au/support/solutions/articles/6000261427-sharing-a-dataset-with-the-ala">Atlas of Living Australia: sharing a dataset</a> (occurrenceID, basisOfRecord, scientificName, decimalLatitude/Longitude, geodeticDatum, coordinateUncertaintyInMeters, eventDate); <a href="https://www.inaturalist.org/pages/help">iNaturalist help</a>.</li>' +
      '<li>Sensitive species: Chapman AD (2020) <a href="https://doi.org/10.15468/doc-5jp4-5g10"><i>Current Best Practices for Generalizing Sensitive Species Occurrence Data</i></a>, GBIF Secretariat.</li></ul>'
  }
};
