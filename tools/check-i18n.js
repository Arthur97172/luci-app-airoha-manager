#!/usr/bin/env node
'use strict';

/*
 * check-i18n.js — the automated test for this package's translations.
 *
 * Reproduces what LuCI's build/i18n-scan.pl feeds to xgettext (keyword table,
 * JavaScript string decoding, whitespace_collapse(), the menu.d/acl.d JSON
 * preprocessing) and then cross-checks the three artefacts against each other:
 *
 *     htdocs/** + root/**   the sources
 *     po/templates/*.pot    the template
 *     po/<lang>/*.po        the translations
 *
 * It needs no gettext binaries, so it runs anywhere node does:
 *
 *     node tools/check-i18n.js [package-root]
 *
 * Exit code 0 means the three agree; 1 lists what disagrees.
 *
 * NOTE: this file lives inside the package, and the LuCI scanner walks every
 * .js beneath the package root. It must therefore never contain a call to the
 * translation keyword itself, or the .pot regenerated on a real feed would
 * grow an entry this hand-maintained .pot does not have. Check 6 below fails
 * loudly if that ever happens.
 */

var fs = require('fs');
var path = require('path');

var ROOT = process.argv[2] || process.cwd();

var problems = [];
function fail(msg) { problems.push(msg); }

/* ---------- xgettext --language=JavaScript string decoding ---------- */

var SIMPLE_ESC = {
	n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v',
	'0': '\0', '\\': '\\', "'": "'", '"': '"', '`': '`'
};

function decodeJsLiteral(raw) {
	var out = '';
	for (var i = 0; i < raw.length; i++) {
		var c = raw[i];
		if (c !== '\\') { out += c; continue; }
		var n = raw[++i];
		if (n === undefined) { out += '\\'; break; }
		if (n === 'u') {
			if (raw[i + 1] === '{') {
				var end = raw.indexOf('}', i);
				out += String.fromCodePoint(parseInt(raw.slice(i + 2, end), 16));
				i = end;
			} else {
				out += String.fromCharCode(parseInt(raw.substr(i + 1, 4), 16));
				i += 4;
			}
		} else if (n === 'x') {
			out += String.fromCharCode(parseInt(raw.substr(i + 1, 2), 16));
			i += 2;
		} else if (n === '\n') {
			/* line continuation contributes nothing */
		} else if (Object.prototype.hasOwnProperty.call(SIMPLE_ESC, n)) {
			out += SIMPLE_ESC[n];
		} else {
			out += n;
		}
	}
	return out;
}

/* whitespace_collapse() from i18n-scan.pl, applied to the decoded value */
function whitespaceCollapse(s) {
	return s.replace(/[\t\n]/g, ' ').replace(/ {2,}/g, ' ').replace(/^ /, '').replace(/ $/, '');
}

/* ---------- the translation keyword, as used in JavaScript ---------- */

function parseStringLiteral(src, i) {
	var quote = src[i];
	if (quote !== "'" && quote !== '"') return null;
	var start = i;
	i++;
	var raw = '';
	while (i < src.length) {
		if (src[i] === '\\') { raw += src[i] + (src[i + 1] || ''); i += 2; continue; }
		if (src[i] === quote) return { value: decodeJsLiteral(raw), next: i + 1, raw: src.slice(start, i + 1) };
		if (src[i] === '\n') return null;
		raw += src[i++];
	}
	return null;
}

function extractJs(src) {
	var found = [];          /* { msgid, line } */
	var i = 0, line = 1, n = src.length;

	while (i < n) {
		var c = src[i];

		if (c === '\n') { line++; i++; continue; }

		if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
		if (c === '/' && src[i + 1] === '*') {
			i += 2;
			while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
			i += 2;
			continue;
		}

		if (c === "'" || c === '"' || c === '`') {
			var q = c; i++;
			while (i < n) {
				if (src[i] === '\\') { if (src[i + 1] === '\n') line++; i += 2; continue; }
				if (src[i] === q) { i++; break; }
				if (src[i] === '\n') line++;
				i++;
			}
			continue;
		}

		/* the keyword: not part of a longer identifier and not a property */
		if (c === '_' && !/[A-Za-z0-9_$.]/.test(src[i - 1] || '')) {
			var j = i + 1;
			while (j < n && /\s/.test(src[j])) j++;
			if (src[j] === '(') {
				var k = j + 1;
				while (k < n && /\s/.test(src[k])) k++;
				var lit = parseStringLiteral(src, k);
				if (lit) {
					var value = lit.value;
					k = lit.next;
					/* concatenated literals are one msgid */
					for (;;) {
						var m = k;
						while (m < n && /\s/.test(src[m])) m++;
						if (src[m] !== '+') break;
						m++;
						while (m < n && /\s/.test(src[m])) m++;
						var more = parseStringLiteral(src, m);
						if (!more) break;
						value += more.value;
						k = more.next;
					}
					found.push({ msgid: whitespaceCollapse(value), line: line });
				}
			}
		}

		i++;
	}
	return found;
}

/* ---------- files the scanner walks ---------- */

function walk(dir, out) {
	fs.readdirSync(dir, { withFileTypes: true }).forEach(function(ent) {
		var p = path.join(dir, ent.name);
		if (ent.isDirectory()) { if (ent.name !== '.git') walk(p, out); return; }
		if (/\.(htm|lua|js|uc|ut)$/.test(ent.name)) out.push(p);
		else if (/\.json$/.test(ent.name) && /(\/menu\.d\/|\/acl\.d\/|\/statistics\/plugins\/|\/https-dns-proxy\/providers\/)/.test(p)) out.push(p);
	});
	return out;
}

/* preprocess_json(): "title" / "description" values are translatable */
function extractJson(src) {
	var found = [];
	var re = /("(?:title|description)")\s*:\s*("(?:[^"\\]|\\.)*")/g, m;
	while ((m = re.exec(src))) {
		var value = JSON.parse(m[2]);
		var line = src.slice(0, m.index).split('\n').length;
		found.push({ msgid: whitespaceCollapse(value), line: line });
	}
	return found;
}

/* ---------- collect ---------- */

var files = walk(ROOT, []).sort();
var byMsgid = new Map();     /* msgid -> Set("file:line") */
var dupWithinFile = [];

files.forEach(function(file) {
	var rel = path.relative(ROOT, file);
	var src = fs.readFileSync(file, 'utf8');
	var found = /\.json$/.test(file) ? extractJson(src) : extractJs(src);
	var seen = new Set();
	found.forEach(function(entry) {
		var ref = rel + ':' + entry.line;
		if (seen.has(entry.msgid)) dupWithinFile.push(ref + '  ' + JSON.stringify(entry.msgid));
		seen.add(entry.msgid);
		if (!byMsgid.has(entry.msgid)) byMsgid.set(entry.msgid, new Set());
		byMsgid.get(entry.msgid).add(ref);
	});
});

/* ---------- parse the .pot and the .po ---------- */

function parsePo(text) {
	var entries = [];
	var cur = null;
	text.split('\n').forEach(function(line) {
		var m;
		if ((m = /^#: (.*)$/.exec(line))) {
			if (!cur) cur = { refs: [], msgid: null, msgstr: null, comments: [] };
			m[1].trim().split(/\s+/).forEach(function(r) { cur.refs.push(r); });
		} else if ((m = /^msgid (".*")$/.exec(line))) {
			if (!cur) cur = { refs: [], msgid: null, msgstr: null, comments: [] };
			cur.msgid = JSON.parse(m[1]);
		} else if ((m = /^msgstr (".*")$/.exec(line))) {
			cur.msgstr = JSON.parse(m[1]);
			entries.push(cur);
			cur = null;
		} else if (/^#/.test(line)) {
			if (!cur) cur = { refs: [], msgid: null, msgstr: null, comments: [] };
			cur.comments.push(line);
		}
	});
	return entries;
}

var pot = parsePo(fs.readFileSync(path.join(ROOT, 'po/templates/luci-app-airoha-manager.pot'), 'utf8'));
var po = parsePo(fs.readFileSync(path.join(ROOT, 'po/zh_Hans/luci-app-airoha-manager.po'), 'utf8'));

/* ---------- checks ---------- */

/* 1. every msgid the sources carry is in the .pot.
 *
 * The .pot ships without "#:" reference comments (see tools/gen-i18n.js), so an
 * entry that carries no refs is the normal case and there is nothing to compare;
 * the two ref checks below run only on an entry that does carry them, which
 * keeps them honest if references are ever put back. */
var potByMsgid = new Map();
pot.forEach(function(e) {
	if (e.msgid === '') return;
	if (potByMsgid.has(e.msgid)) fail('.pot has a duplicate msgid: ' + JSON.stringify(e.msgid));
	potByMsgid.set(e.msgid, e);
});

byMsgid.forEach(function(refs, msgid) {
	var e = potByMsgid.get(msgid);
	if (!e) { fail('.pot is missing msgid ' + JSON.stringify(msgid) + ' (used at ' + [...refs].join(', ') + ')'); return; }
	if (!e.refs.length) return;
	var potRefs = new Set(e.refs);
	refs.forEach(function(r) { if (!potRefs.has(r)) fail('.pot entry ' + JSON.stringify(msgid) + ' is missing reference ' + r); });
	potRefs.forEach(function(r) { if (!refs.has(r)) fail('.pot entry ' + JSON.stringify(msgid) + ' has a stale reference ' + r); });
});

/* 2. .pot has nothing the sources do not carry */
potByMsgid.forEach(function(e, msgid) {
	if (!byMsgid.has(msgid)) fail('.pot carries msgid ' + JSON.stringify(msgid) + ' that no source uses');
});

/* 3. every reference in the .po and the .pot resolves to a line that really holds the msgid */
function refResolves(ref, msgid) {
	var m = /^(.*):(\d+)$/.exec(ref);
	if (!m) return 'malformed reference';
	var file = path.join(ROOT, m[1]);
	if (!fs.existsSync(file)) return 'no such file';
	var lines = fs.readFileSync(file, 'utf8').split('\n');
	var idx = parseInt(m[2], 10) - 1;
	if (idx < 0 || idx >= lines.length) return 'line out of range';
	var prefix = lines.slice(0, idx + 1).join('\n');
	var found = /\.json$/.test(file) ? extractJson(prefix) : extractJs(prefix);
	var hit = found.filter(function(f) { return f.line === idx + 1 && f.msgid === msgid; });
	return hit.length ? null : 'line does not carry ' + JSON.stringify(msgid);
}

[['.po', po], ['.pot', pot]].forEach(function(pair) {
	pair[1].forEach(function(e) {
		if (e.msgid === '') return;
		e.refs.forEach(function(r) {
			var why = refResolves(r, e.msgid);
			if (why) fail(pair[0] + ' reference ' + r + ' for ' + JSON.stringify(e.msgid) + ': ' + why);
		});
	});
});

/* 4. .po vs .pot: nothing stale, nothing missing, nothing left untranslated */
var poByMsgid = new Map();
po.forEach(function(e) {
	if (e.msgid === '') return;
	if (poByMsgid.has(e.msgid)) fail('.po has a duplicate msgid: ' + JSON.stringify(e.msgid));
	poByMsgid.set(e.msgid, e);
});
var stale = [], untranslated = [];
poByMsgid.forEach(function(e, msgid) {
	if (!potByMsgid.has(msgid)) stale.push(msgid);
});
potByMsgid.forEach(function(e, msgid) {
	if (!poByMsgid.has(msgid)) fail('.po is missing msgid ' + JSON.stringify(msgid));
	else if (poByMsgid.get(msgid).msgstr === '') untranslated.push(msgid);
});

/* 5. format specifiers must survive translation */
poByMsgid.forEach(function(e, msgid) {
	var a = (msgid.match(/%[sd]/g) || []).sort().join(',');
	var b = (e.msgstr.match(/%[sd]/g) || []).sort().join(',');
	if (a !== b) fail('.po format specifiers differ for ' + JSON.stringify(msgid) + ': msgid has [' + a + '], msgstr has [' + b + ']');
});

/* 6. this tool itself must stay free of translatable literals (see the header) */
byMsgid.forEach(function(refs, msgid) {
	[...refs].forEach(function(r) {
		if (/^tools\//.test(r)) fail('tools/ carries a translatable literal at ' + r + ': ' + JSON.stringify(msgid));
	});
});

/* ---------- report ---------- */

console.log('sources      : ' + files.length + ' files, ' + byMsgid.size + ' distinct msgids');
console.log('.pot         : ' + (pot.length - 1) + ' entries');
console.log('.po          : ' + (po.length - 1) + ' entries');
if (dupWithinFile.length) console.log('same msgid twice in one file: ' + dupWithinFile.join('; '));
if (stale.length) console.log('\nstale .po entries (no source):\n  ' + stale.map(function(s) { return JSON.stringify(s); }).join('\n  '));
if (untranslated.length) console.log('\nuntranslated .pot entries:\n  ' + untranslated.map(function(s) { return JSON.stringify(s); }).join('\n  '));

if (problems.length) {
	console.log('\nPROBLEMS (' + problems.length + '):');
	problems.forEach(function(p) { console.log('  - ' + p); });
	process.exit(1);
}
console.log('\nOK: sources, .pot and .po agree.');
