#!/usr/bin/env node
'use strict';

/*
 * gen-i18n.js — regenerate .pot and .po from sources using the same
 * extraction logic as tools/check-i18n.js
 */

var fs = require('fs');
var path = require('path');

var ROOT = process.argv[2] || process.cwd();

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

function whitespaceCollapse(s) {
	return s.replace(/[\t\n]/g, ' ').replace(/ {2,}/g, ' ').replace(/^ /, '').replace(/ $/, '');
}

/* ---------- the translation keyword extraction ---------- */

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
	var found = [];
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

files.forEach(function(file) {
	var rel = path.relative(ROOT, file);
	var src = fs.readFileSync(file, 'utf8');
	var found = /\.json$/.test(file) ? extractJson(src) : extractJs(src);
	found.forEach(function(entry) {
		var ref = rel + ':' + entry.line;
		if (!byMsgid.has(entry.msgid)) byMsgid.set(entry.msgid, new Set());
		byMsgid.get(entry.msgid).add(ref);
	});
});

/* ---------- generate .pot ---------- */

var potLines = [];
potLines.push('# SOME DESCRIPTIVE TITLE.');
potLines.push('# Copyright (C) YEAR THE PACKAGE\'S COPYRIGHT HOLDER');
potLines.push('# This file is distributed under the same license as the PACKAGE package.');
potLines.push('# FIRST AUTHOR <EMAIL@ADDRESS>, YEAR.');
potLines.push('');
potLines.push('msgid ""');
potLines.push('msgstr ""');
potLines.push('"Project-Id-Version: luci-app-airoha-manager\\n"');
potLines.push('"Report-Msgid-Bugs-To: \\n"');
potLines.push('"POT-Creation-Date: ' + new Date().toISOString().replace('T', ' ').slice(0, 19) + '+0000\\n"');
potLines.push('"PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE\\n"');
potLines.push('"Last-Translator: FULL NAME <EMAIL@ADDRESS>\\n"');
potLines.push('"Language-Team: LANGUAGE <LL@li.org>\\n"');
potLines.push('"Language: \\n"');
potLines.push('"MIME-Version: 1.0\\n"');
potLines.push('"Content-Type: text/plain; charset=UTF-8\\n"');
potLines.push('"Content-Transfer-Encoding: 8bit\\n"');
potLines.push('');

var sortedMsgids = Array.from(byMsgid.keys()).sort();
sortedMsgids.forEach(function(msgid) {
	var refs = Array.from(byMsgid.get(msgid)).sort();
	potLines.push('#: ' + refs.join(' '));
	potLines.push('msgid ' + JSON.stringify(msgid));
	potLines.push('msgstr ""');
	potLines.push('');
});

var potPath = path.join(ROOT, 'po/templates/luci-app-airoha-manager.pot');
fs.writeFileSync(potPath, potLines.join('\n'), 'utf8');
console.log('Generated ' + potPath + ' with ' + sortedMsgids.length + ' entries');

/* ---------- generate .po (zh_Hans) ---------- */

var poPath = path.join(ROOT, 'po/zh_Hans/luci-app-airoha-manager.po');
var existingPo = fs.readFileSync(poPath, 'utf8');

/* Parse existing .po to keep translations */
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

var poEntries = parsePo(existingPo);
var poByMsgid = new Map();
poEntries.forEach(function(e) {
	if (e.msgid !== '') poByMsgid.set(e.msgid, e.msgstr);
});

/* Build new .po with updated refs, preserving translations */
var poLines = [];
poLines.push('# Chinese (Simplified) translation for luci-app-airoha-manager');
poLines.push('# Copyright (C) 2025 Arthur97172');
poLines.push('# This file is distributed under the same license as the luci-app-airoha-manager package.');
poLines.push('# Arthur97172 <Arthur97172@users.noreply.github.com>, 2025.');
poLines.push('');
poLines.push('msgid ""');
poLines.push('msgstr ""');
poLines.push('"Project-Id-Version: luci-app-airoha-manager\\n"');
poLines.push('"Report-Msgid-Bugs-To: \\n"');
poLines.push('"POT-Creation-Date: ' + new Date().toISOString().replace('T', ' ').slice(0, 19) + '+0000\\n"');
poLines.push('"PO-Revision-Date: ' + new Date().toISOString().replace('T', ' ').slice(0, 19) + '+0000\\n"');
poLines.push('"Last-Translator: Arthur97172 <Arthur97172@users.noreply.github.com>\\n"');
poLines.push('"Language-Team: Chinese (Simplified) <zh_CN@li.org>\\n"');
poLines.push('"Language: zh_Hans\\n"');
poLines.push('"MIME-Version: 1.0\\n"');
poLines.push('"Content-Type: text/plain; charset=UTF-8\\n"');
poLines.push('"Content-Transfer-Encoding: 8bit\\n"');
poLines.push('"Plural-Forms: nplurals=1; plural=0;\\n"');
poLines.push('');

sortedMsgids.forEach(function(msgid) {
	var refs = Array.from(byMsgid.get(msgid)).sort();
	var msgstr = poByMsgid.get(msgid) || '';
	poLines.push('#: ' + refs.join(' '));
	poLines.push('msgid ' + JSON.stringify(msgid));
	poLines.push('msgstr ' + JSON.stringify(msgstr));
	poLines.push('');
});

fs.writeFileSync(poPath, poLines.join('\n'), 'utf8');
console.log('Generated ' + poPath + ' with ' + sortedMsgids.length + ' entries');