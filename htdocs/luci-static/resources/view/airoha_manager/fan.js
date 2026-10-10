'use strict';
'require dom';
'require form';
'require poll';
'require rpc';
'require uci';
'require view';

var callFanStatus = rpc.declare({
	object: 'luci.airoha_manager',
	method: 'getFanStatus'
});

var callGetAllCurves = rpc.declare({
	object: 'luci.airoha_manager',
	method: 'getAllCurves'
});

var HISTORY_WINDOW_MS = 2 * 60 * 1000;
var TIME_GRID_INTERVAL_MS = 10 * 1000;
var TIME_LABEL_INTERVAL_MS = 30 * 1000;
var VALUE_GRID_DIVISIONS = 4;
var HISTORY_STORAGE_KEY = 'airoha-fancontrol-history-v1';
var history = [];

var themeCSS = '\
.fan-dashboard{--fan-blue:#00c8ff;--fan-green:#00cc44;--fan-amber:#f5a623;--fan-red:#d0021b;--airoha-font-ui:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif;--airoha-font-mono:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;font-family:var(--airoha-font-ui);font-size:13px;line-height:1.5;letter-spacing:0;color:var(--fan-text);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}\
.fan-dashboard h2{margin:0 0 14px;font-family:var(--airoha-font-ui);font-size:22px;line-height:1.3;font-weight:600;letter-spacing:0;color:var(--fan-text)}\
.fan-dashboard .cbi-button,.fan-dashboard .cbi-input-select,.fan-dashboard input{font-family:var(--airoha-font-ui);font-size:13px!important;line-height:1.4;letter-spacing:0}\
.fan-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:8px;margin:0 0 12px}\
.fan-summary-card,.fan-panel,.fan-chart-card,.fan-temp-card{background:var(--fan-card-bg);border:1px solid var(--fan-border);border-radius:8px;box-sizing:border-box}\
.fan-summary-card{border-left:3px solid var(--fan-accent,var(--fan-border));padding:10px 14px;min-height:82px;display:flex;flex-direction:column;justify-content:center}\
.fan-card-title{font-size:11px;line-height:1.35;text-transform:uppercase;letter-spacing:0;color:var(--fan-muted);font-family:var(--airoha-font-ui);font-weight:600;margin-bottom:5px}\
.fan-card-value{font-size:20px;line-height:1.15;font-family:var(--airoha-font-mono);font-variant-numeric:tabular-nums;font-weight:700;color:var(--fan-accent,var(--fan-text))}\
.fan-card-sub{font-size:12px;line-height:1.4;color:var(--fan-muted);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.fan-panel{padding:14px;margin:12px 0}\
.fan-panel-title{font-size:16px;line-height:1.4;font-weight:600;letter-spacing:0;color:var(--fan-text);padding:0 0 8px;margin:0 0 12px;border-bottom:1px solid var(--fan-border)}\
.fan-chart-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}\
.fan-chart-card{border-left:3px solid var(--fan-chart-accent,var(--fan-border));padding:10px 12px;min-width:0}\
.fan-chart-value{font-size:20px;font-family:var(--airoha-font-mono);font-variant-numeric:tabular-nums;font-weight:700;line-height:1.15;color:var(--fan-text)}\
.fan-chart-canvas{display:block;width:100%;height:120px;margin-top:8px;color:var(--fan-muted);background:color-mix(in srgb,var(--fan-card-bg) 88%,var(--fan-border));border:1px solid var(--fan-border);border-radius:6px}\
.fan-temp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}\
.fan-temp-group{min-width:0}\
.fan-temp-group-title{font-size:11px;line-height:1.35;text-transform:uppercase;letter-spacing:0;color:var(--fan-muted);font-family:var(--airoha-font-ui);font-weight:600;margin:0 0 8px}\
.fan-temp-list{display:grid;gap:7px}\
.fan-temp-card{border-left:3px solid var(--fan-temp-accent,var(--fan-border));padding:8px 10px;min-width:0}\
.fan-temp-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:6px}\
.fan-temp-label{font-size:13px;line-height:1.4;color:var(--fan-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.fan-temp-value{font-family:var(--airoha-font-mono);font-size:16px;font-variant-numeric:tabular-nums;font-weight:700;color:var(--fan-temp-accent);white-space:nowrap}\
.fan-temp-track{height:18px!important;min-height:18px;border-radius:999px;overflow:hidden;background:var(--fan-track)}\
.fan-temp-fill{height:100%;border-radius:inherit;background:var(--fan-temp-accent);transition:width .3s,background .3s}\
@media(max-width:1050px){.fan-summary-grid{grid-template-columns:repeat(2,minmax(160px,1fr))}.fan-chart-grid{grid-template-columns:1fr}}\
@media(max-width:640px){.fan-summary-grid,.fan-temp-grid{grid-template-columns:1fr}.fan-panel{padding:11px}.fan-summary-card{min-height:74px}.fan-chart-canvas{height:112px}}\
';

var _statusDarkMode = null;

function isStatusDarkMode() {
	var els = [document.body, document.querySelector('.main-content'), document.querySelector('#maincontent'), document.querySelector('.cbi-map')];
	for (var i = 0; i < els.length; i++) {
		if (!els[i]) continue;
		var rgb = window.getComputedStyle(els[i]).backgroundColor.match(/\d+/g);
		if (!rgb || rgb.length < 3) continue;
		var luminance = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
		return luminance < 128;
	}
	return document.querySelectorAll('link[href*="dark"],link[href*="glass"]').length > 0;
}

function injectStatusCSS() {
	var el = document.getElementById('fan-theme-css');
	if (!el) {
		el = document.createElement('style');
		el.id = 'fan-theme-css';
		document.head.appendChild(el);
	}
	var dark = isStatusDarkMode();
	if (dark === _statusDarkMode) return;
	_statusDarkMode = dark;
	el.textContent = themeCSS + (dark
		? ':root{--fan-card-bg:#1e1e1e;--fan-border:#333;--fan-muted:#a3a3a3;--fan-text:#ececec;--fan-track:#333}'
		: ':root{--fan-card-bg:#fff;--fan-border:#d0d0d0;--fan-muted:#666;--fan-text:#222;--fan-track:#e7e7e7}');
}

function tempColor(temp) {
	if (temp <= 40) return '#00cc44';
	if (temp <= 55) return '#f5a623';
	if (temp <= 70) return '#f97316';
	return '#d0021b';
}

function restoreHistory() {
	try {
		var saved = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
		var cutoff = Date.now() - HISTORY_WINDOW_MS;
		if (!Array.isArray(saved)) return;
		history = saved.filter(function(sample) {
			return sample && typeof sample.time === 'number' && sample.time >= cutoff &&
				typeof sample.temperature === 'number' && typeof sample.pwm === 'number' && typeof sample.rpm === 'number';
		});
	} catch (e) {
		history = [];
	}
}

function persistHistory() {
	try {
		window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
	} catch (e) {
		/* Local storage is optional; keep the live chart working when it is unavailable. */
	}
}

function modeInfo(uciMode) {
	return uciMode === 'manual'
		? { value: _('Manual'), sub: _('Fixed PWM output'), color: '#f5a623' }
		: { value: _('Automatic'), sub: _('Following fan curve'), color: '#00c8ff' };
}

function presetInfo(uciMode, preset) {
	if (uciMode === 'manual') return { value: _('Manual'), sub: _('Curve is paused'), color: '#6b7280' };
	var labels = { quiet: _('Quiet'), balanced: _('Balanced'), performance: _('Performance'), custom: _('Custom') };
	var descriptions = { quiet: _('Low noise priority'), balanced: _('Noise and cooling balanced'), performance: _('Cooling priority'), custom: _('Custom temperature curve') };
	return { value: labels[preset] || labels.balanced, sub: descriptions[preset] || descriptions.balanced, color: '#00cc44' };
}

function summaryData(status) {
	var mode = modeInfo(status.uci_mode);
	var preset = presetInfo(status.uci_mode, status.uci_preset);
	return [
		{ id: 'fan-summary-rpm', title: _('Fan Speed'), value: (status.fan_rpm || 0) + ' RPM', sub: (status.fan_percentage || 0) + '% ' + _('PWM output'), color: '#00c8ff' },
		{ id: 'fan-summary-pwm', title: 'PWM', value: (status.fan_pwm || 0) + ' / 255', sub: (status.fan_percentage || 0) + '%', color: '#00cc44' },
		{ id: 'fan-summary-mode', title: _('Control Mode'), value: mode.value, sub: mode.sub, color: mode.color },
		{ id: 'fan-summary-preset', title: _('Fan Curve Preset'), value: preset.value, sub: preset.sub, color: preset.color }
	];
}

function renderSummary(status) {
	return E('div', { 'class': 'fan-summary-grid' }, summaryData(status).map(function(card) {
		return E('div', { 'id': card.id, 'class': 'fan-summary-card', 'style': '--fan-accent:' + card.color }, [
			E('div', { 'class': 'fan-card-title' }, card.title),
			E('div', { 'class': 'fan-card-value' }, card.value),
			E('div', { 'class': 'fan-card-sub' }, card.sub)
		]);
	}));
}

function updateSummary(status) {
	summaryData(status).forEach(function(card) {
		var el = document.getElementById(card.id);
		if (!el) return;
		el.style.setProperty('--fan-accent', card.color);
		var value = el.querySelector('.fan-card-value');
		var sub = el.querySelector('.fan-card-sub');
		if (value) value.textContent = card.value;
		if (sub) sub.textContent = card.sub;
	});
}

function createTempGauge(label, temp, id) {
	var color = tempColor(temp);
	var percentage = Math.min(100, Math.max(3, temp));
	return E('div', { 'id': id, 'class': 'fan-temp-card', 'style': '--fan-temp-accent:' + color }, [
		E('div', { 'class': 'fan-temp-row' }, [
			E('span', { 'class': 'fan-temp-label' }, label),
			E('span', { 'class': 'fan-temp-value' }, temp + '\u00b0C')
		]),
		E('div', { 'class': 'fan-temp-track' }, [
			E('div', { 'class': 'fan-temp-fill', 'style': 'width:' + percentage + '%' })
		])
	]);
}

function updateGauge(id, temp) {
	var card = document.getElementById(id);
	if (!card) return;
	var color = tempColor(temp);
	var value = card.querySelector('.fan-temp-value');
	var fill = card.querySelector('.fan-temp-fill');
	card.style.setProperty('--fan-temp-accent', color);
	if (value) value.textContent = temp + '\u00b0C';
	if (fill) fill.style.width = Math.min(100, Math.max(3, temp)) + '%';
}

function appendHistory(status) {
	var now = Date.now();
	history.push({ time: now, temperature: status.temp_board || 0, pwm: status.fan_pwm || 0, rpm: status.fan_rpm || 0 });
	while (history.length && history[0].time < now - HISTORY_WINDOW_MS) history.shift();
	persistHistory();
}

function chartScale(hist, key, minMax, step) {
	var maximum = minMax;
	for (var i = 0; i < hist.length; i++) if (hist[i][key] != null) maximum = Math.max(maximum, hist[i][key]);
	return Math.ceil(maximum / step) * step;
}

function drawChart(canvas, hist, key, options) {
	if (!canvas || !hist.length) return;
	var style = getComputedStyle(canvas);
	var width = Math.max(canvas.clientWidth, 1);
	var height = Math.max(canvas.clientHeight, 1);
	var dpr = Math.min(window.devicePixelRatio || 1, 2);
	var ctx = canvas.getContext('2d');
	var pad = { left: 31, right: 6, top: 7, bottom: 16 };
	var plotW = Math.max(width - pad.left - pad.right, 1);
	var plotH = Math.max(height - pad.top - pad.bottom, 1);
	var plotB = pad.top + plotH;
	var now = hist[hist.length - 1].time;
	var start = now - HISTORY_WINDOW_MS;
	var maximum = chartScale(hist, key, options.minMax, options.step);
	var labelColor = style.color || '#666';

	canvas.width = Math.round(width * dpr);
	canvas.height = Math.round(height * dpr);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, width, height);
	ctx.strokeStyle = 'rgba(127,127,127,.24)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	for (var e = 0; e <= HISTORY_WINDOW_MS; e += TIME_GRID_INTERVAL_MS) {
		var gx = pad.left + plotW * e / HISTORY_WINDOW_MS;
		ctx.moveTo(gx, pad.top);
		ctx.lineTo(gx, plotB);
	}
	for (var d = 0; d <= VALUE_GRID_DIVISIONS; d++) {
		var gy = pad.top + plotH * d / VALUE_GRID_DIVISIONS;
		ctx.moveTo(pad.left, gy);
		ctx.lineTo(pad.left + plotW, gy);
	}
	ctx.stroke();

	ctx.fillStyle = labelColor;
	ctx.font = '10px system-ui, sans-serif';
	ctx.textAlign = 'right';
	ctx.textBaseline = 'top';
	ctx.fillText(options.format(maximum), pad.left - 4, pad.top - 1);
	ctx.textBaseline = 'middle';
	ctx.fillText(options.format(maximum / 2), pad.left - 4, pad.top + plotH / 2);
	ctx.textBaseline = 'bottom';
	ctx.fillText(options.format(0), pad.left - 4, plotB + 1);
	for (var t = 0; t <= HISTORY_WINDOW_MS; t += TIME_LABEL_INTERVAL_MS) {
		var lx = pad.left + plotW * t / HISTORY_WINDOW_MS;
		var remaining = (HISTORY_WINDOW_MS - t) / 1000;
		ctx.textAlign = t === 0 ? 'left' : t === HISTORY_WINDOW_MS ? 'right' : 'center';
		ctx.fillText(remaining ? '-' + remaining + 's' : '0', lx, height);
	}

	function point(sample) {
		return { x: pad.left + (sample.time - start) / HISTORY_WINDOW_MS * plotW, y: plotB - (sample[key] || 0) / maximum * plotH };
	}
	ctx.beginPath();
	ctx.moveTo(point(hist[0]).x, plotB);
	for (var i = 0; i < hist.length; i++) { var fillPoint = point(hist[i]); ctx.lineTo(fillPoint.x, fillPoint.y); }
	ctx.lineTo(point(hist[hist.length - 1]).x, plotB);
	ctx.closePath();
	ctx.fillStyle = options.fillColor;
	ctx.fill();
	ctx.beginPath();
	for (var j = 0; j < hist.length; j++) {
		var linePoint = point(hist[j]);
		j === 0 ? ctx.moveTo(linePoint.x, linePoint.y) : ctx.lineTo(linePoint.x, linePoint.y);
	}
	ctx.strokeStyle = options.lineColor;
	ctx.lineWidth = 1.7;
	ctx.stroke();
}

function chartCard(label, valueText, canvasId, color) {
	return E('div', { 'class': 'fan-chart-card', 'style': '--fan-chart-accent:' + color }, [
		E('div', { 'class': 'fan-card-title' }, label),
		E('div', { 'id': canvasId + '-val', 'class': 'fan-chart-value' }, valueText),
		E('canvas', { 'id': canvasId, 'class': 'fan-chart-canvas' })
	]);
}

function drawAllCharts() {
	if (!history.length) return;
	drawChart(document.getElementById('fc-temp'), history, 'temperature', { minMax: 40, step: 20, lineColor: '#f97316', fillColor: 'rgba(249,115,22,.16)', format: function(value) { return value + '\u00b0'; } });
	drawChart(document.getElementById('fc-pwm'), history, 'pwm', { minMax: 100, step: 50, lineColor: '#00c8ff', fillColor: 'rgba(0,200,255,.14)', format: function(value) { return String(value); } });
	drawChart(document.getElementById('fc-rpm'), history, 'rpm', { minMax: 1000, step: 500, lineColor: '#00cc44', fillColor: 'rgba(0,204,68,.14)', format: function(value) { return String(value); } });
}

function temperatureGroup(title, entries) {
	return E('div', { 'class': 'fan-temp-group' }, [
		E('div', { 'class': 'fan-temp-group-title' }, title),
		E('div', { 'class': 'fan-temp-list' }, entries)
	]);
}

var settingsCSS = '\
.fan-settings{--fan-blue:#00c8ff;--fan-green:#00cc44;--fan-amber:#f5a623;--fan-red:#d0021b;max-width:1180px;margin:0 auto;padding-bottom:20px}\
.fan-settings .cbi-map-descr{position:relative;margin:0 0 16px;padding:15px 18px 15px 20px;border:1px solid var(--fan-border);border-left:4px solid var(--fan-blue);border-radius:10px;background:linear-gradient(135deg,var(--fan-card-bg),var(--fan-input-bg));box-shadow:0 5px 18px var(--fan-shadow);color:var(--fan-muted);font-size:12px;line-height:1.6}\
.fan-settings .cbi-section{position:relative;background:var(--fan-card-bg);border:1px solid var(--fan-border);border-radius:12px;padding:18px;margin:14px 0!important;box-sizing:border-box;box-shadow:0 5px 18px var(--fan-shadow);overflow:hidden}\
.fan-settings .cbi-section>h3{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:700;letter-spacing:.2px;margin:0 0 14px;padding:0 0 12px;border-bottom:1px solid var(--fan-border);color:var(--fan-text)}\
.fan-settings .cbi-section>h3:before{content:"";display:block;width:5px;height:20px;border-radius:99px;background:linear-gradient(180deg,var(--fan-blue),var(--fan-green));box-shadow:0 0 12px rgba(0,200,255,.25)}\
.fan-settings .fan-curve-section>h3:before{background:linear-gradient(180deg,#a855f7,#f97316);box-shadow:0 0 12px rgba(168,85,247,.25)}\
.fan-settings .cbi-section-descr{color:var(--fan-muted);font-size:12px;line-height:1.6;margin:-4px 0 12px}\
.fan-settings .cbi-value{display:grid;grid-template-columns:minmax(180px,.72fr) minmax(260px,1.28fr);align-items:center;gap:16px;border-bottom:1px solid var(--fan-border);padding:12px 0;margin:0}\
.fan-settings .cbi-value:last-child{border-bottom:0}\
.fan-settings .cbi-value-title{color:var(--fan-text);font-size:13px;font-weight:600;line-height:1.35}\
.fan-settings .cbi-value-description{display:block;color:var(--fan-muted);font-size:11px;font-weight:400;line-height:1.45;margin-top:5px}\
.fan-settings .cbi-value-field{min-width:0}\
.fan-settings .cbi-value-field input,.fan-settings .cbi-value-field select{width:100%;box-sizing:border-box;min-height:38px;padding:8px 11px;border:1px solid var(--fan-border);border-radius:7px;background:var(--fan-input-bg);color:var(--fan-text);font-size:13px;transition:border-color .18s,box-shadow .18s,background .18s}\
.fan-settings .cbi-value-field input:hover,.fan-settings .cbi-value-field select:hover{border-color:var(--fan-blue)}\
.fan-settings .cbi-value-field input:focus,.fan-settings .cbi-value-field select:focus{border-color:var(--fan-blue);background:var(--fan-card-bg);box-shadow:0 0 0 3px rgba(0,200,255,.14);outline:0}\
.fan-settings .cbi-value-field input[type=number]{font-family:monospace;font-weight:700}\
.fan-settings .fan-control-section{background:linear-gradient(145deg,var(--fan-card-bg),var(--fan-input-bg))}\
.fan-settings .fan-control-section [data-name="_curve_graph"]{display:block;padding:14px 0 0;margin-top:4px;border-top:1px solid var(--fan-border)}\
.fan-settings .fan-control-section [data-name="_curve_graph"] .cbi-value-title{margin-bottom:8px}\
.fan-settings .fan-control-section [data-name="_curve_graph"] .cbi-value-field{width:100%}\
.fan-curve-wrap{max-width:none;border:1px solid var(--fan-border);border-left:4px solid var(--fan-blue);border-radius:10px;padding:12px;background:linear-gradient(145deg,var(--fan-input-bg),var(--fan-card-bg));box-shadow:inset 0 0 0 1px rgba(0,200,255,.06)}\
.fan-curve-canvas{display:block;width:100%;height:320px;background:var(--fan-canvas-bg);border:1px solid var(--fan-border);border-radius:7px;box-sizing:border-box}\
.fan-settings .fan-curve-section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px}\
.fan-settings .fan-curve-section>h3,.fan-settings .fan-curve-section>.cbi-section-descr{grid-column:1/-1}\
.fan-settings .fan-curve-section .cbi-value{display:flex!important;flex-direction:column!important;align-items:stretch;gap:8px;width:100%;box-sizing:border-box;padding:14px;border:1px solid var(--fan-border);border-left:3px solid var(--fan-amber);border-radius:9px;background:var(--fan-input-bg);box-shadow:0 2px 8px var(--fan-shadow)}\
.fan-settings .fan-curve-section .cbi-value[data-name$="_pwm"]{border-left-color:var(--fan-blue)}\
.fan-settings .fan-curve-section .cbi-value .cbi-value-title{display:block!important;flex:none!important;float:none!important;width:auto!important;position:static;clear:both;margin:0!important;line-height:1.4;white-space:normal}\
.fan-settings .fan-curve-section .cbi-value .cbi-value-field{display:block!important;flex:none!important;width:100%;position:static;clear:both;margin:0!important}\
.fan-settings .cbi-button{border-radius:7px;font-weight:600;transition:transform .18s,box-shadow .18s}\
.fan-settings .cbi-button:hover{transform:translateY(-1px);box-shadow:0 4px 12px var(--fan-shadow)}\
@media(max-width:760px){.fan-settings .fan-curve-section{grid-template-columns:1fr}.fan-settings .fan-curve-section>h3,.fan-settings .fan-curve-section>.cbi-section-descr{grid-column:auto}}\
@media(max-width:640px){.fan-settings{padding-bottom:12px}.fan-settings .cbi-section{padding:13px;margin:11px 0!important}.fan-settings .cbi-value{display:block;padding:11px 0}.fan-settings .cbi-value-title{display:block;margin-bottom:7px}.fan-settings .cbi-value-field{margin-left:0!important}.fan-settings .fan-curve-section .cbi-value{padding:12px}.fan-curve-canvas{height:250px}}\
';

var _settingsDarkMode = null;

function isSettingsDarkMode() {
	var els = [document.body, document.querySelector('.main-content'), document.querySelector('#maincontent'), document.querySelector('.cbi-map')];
	for (var i = 0; i < els.length; i++) {
		if (!els[i]) continue;
		var rgb = window.getComputedStyle(els[i]).backgroundColor.match(/\d+/g);
		if (!rgb || rgb.length < 3) continue;
		return (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000 < 128;
	}
	return document.querySelectorAll('link[href*="dark"],link[href*="glass"]').length > 0;
}

function injectSettingsCSS() {
	var el = document.getElementById('fan-settings-theme-css');
	if (!el) {
		el = document.createElement('style');
		el.id = 'fan-settings-theme-css';
		document.head.appendChild(el);
	}
	var dark = isSettingsDarkMode();
	if (dark === _settingsDarkMode) return;
	_settingsDarkMode = dark;
	el.textContent = settingsCSS + (dark
		? ':root{--fan-card-bg:#1e1e1e;--fan-canvas-bg:#191919;--fan-input-bg:#252525;--fan-border:#333;--fan-muted:#a3a3a3;--fan-text:#ececec;--fan-shadow:rgba(0,0,0,.24);--fan-grid:rgba(255,255,255,.14);--fan-axis:#b5b5b5}'
		: ':root{--fan-card-bg:#fff;--fan-canvas-bg:#fbfcfd;--fan-input-bg:#f7f9fb;--fan-border:#d0d0d0;--fan-muted:#666;--fan-text:#222;--fan-shadow:rgba(40,65,90,.08);--fan-grid:rgba(80,90,100,.18);--fan-axis:#555}');
}

function canvasColor(canvas, property, fallback) {
	return window.getComputedStyle(canvas).getPropertyValue(property).trim() || fallback;
}

function drawCurveCanvas(canvasId, curves, activePreset, customPreview) {
	var canvas = document.getElementById(canvasId);
	if (!canvas) return;
	var ctx = canvas.getContext('2d');
	var dpr = Math.min(window.devicePixelRatio || 1, 2);
	var cssW = canvas.clientWidth || 500;
	var cssH = canvas.clientHeight || 300;
	canvas.width = Math.round(cssW * dpr);
	canvas.height = Math.round(cssH * dpr);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	var width = cssW;
	var height = cssH;
	var padding = 40;
	var background = canvasColor(canvas, '--fan-canvas-bg', '#fbfcfd');
	var grid = canvasColor(canvas, '--fan-grid', 'rgba(80,90,100,.18)');
	var axis = canvasColor(canvas, '--fan-axis', '#555');
	var muted = canvasColor(canvas, '--fan-muted', '#666');
	var text = canvasColor(canvas, '--fan-text', '#222');

	ctx.fillStyle = background;
	ctx.fillRect(0, 0, width, height);

	ctx.strokeStyle = grid;
	ctx.lineWidth = 1;
	for (var t = 0; t <= 100; t += 10) {
		var x = padding + (t / 100) * (width - 2 * padding);
		ctx.beginPath(); ctx.moveTo(x, padding); ctx.lineTo(x, height - padding); ctx.stroke();
	}
	for (var p = 0; p <= 255; p += 51) {
		var y = height - padding - (p / 255) * (height - 2 * padding);
		ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke();
	}

	ctx.strokeStyle = axis;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(padding, padding);
	ctx.lineTo(padding, height - padding);
	ctx.lineTo(width - padding, height - padding);
	ctx.stroke();

	ctx.fillStyle = text;
	ctx.font = '11px sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText(_('Temperature (\u00B0C)'), width / 2, height - 5);
	ctx.save();
	ctx.translate(12, height / 2);
	ctx.rotate(-Math.PI / 2);
	ctx.fillText(_('PWM (0-255)'), 0, 0);
	ctx.restore();

	ctx.fillStyle = muted;
	ctx.font = '9px sans-serif';
	ctx.textAlign = 'center';
	for (var t = 0; t <= 100; t += 20) {
		ctx.fillText(t, padding + (t / 100) * (width - 2 * padding), height - padding + 13);
	}
	ctx.textAlign = 'right';
	for (var p = 0; p <= 255; p += 51) {
		ctx.fillText(p, padding - 4, height - padding - (p / 255) * (height - 2 * padding) + 4);
	}

	var colors = {
		'quiet': '#28a745',
		'balanced': '#007bff',
		'performance': '#dc3545',
		'custom': '#6f42c1'
	};

	function drawLine(points, color, alpha, lineW, dots) {
		if (!points || !points.length) return;
		ctx.strokeStyle = color;
		ctx.lineWidth = lineW || 1.5;
		ctx.globalAlpha = alpha != null ? alpha : 0.4;
		ctx.beginPath();
		points.forEach(function(pt, idx) {
			var px = padding + (pt.temp / 100) * (width - 2 * padding);
			var py = height - padding - (pt.pwm / 255) * (height - 2 * padding);
			idx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
		});
		ctx.stroke();
		if (dots) {
			ctx.fillStyle = color;
			points.forEach(function(pt) {
				var px = padding + (pt.temp / 100) * (width - 2 * padding);
				var py = height - padding - (pt.pwm / 255) * (height - 2 * padding);
				ctx.beginPath(); ctx.arc(px, py, 4, 0, 2 * Math.PI); ctx.fill();
			});
		}
		ctx.globalAlpha = 1;
	}

	Object.keys(curves).forEach(function(preset) {
		var isActive = preset === activePreset && !customPreview;
		drawLine(curves[preset], colors[preset], isActive ? 1 : 0.3, isActive ? 2.5 : 1, isActive);
	});

	if (customPreview) {
		drawLine(customPreview, '#ff6600', 1, 2.5, true);
	}

	var legendY = 15;
	Object.keys(colors).forEach(function(preset) {
		ctx.fillStyle = colors[preset];
		ctx.globalAlpha = preset === activePreset ? 1 : 0.5;
		ctx.fillRect(width - 100, legendY, 12, 12);
		ctx.globalAlpha = 1;
		ctx.fillStyle = text;
		ctx.font = '10px sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText({ quiet: _('Quiet'), balanced: _('Balanced'), performance: _('Performance'), custom: _('Custom') }[preset] || preset, width - 84, legendY + 10);
		legendY += 17;
	});
	if (customPreview) {
		ctx.fillStyle = '#ff6600';
		ctx.fillRect(width - 100, legendY, 12, 12);
		ctx.fillStyle = text;
		ctx.fillText(_('Preview'), width - 84, legendY + 10);
	}
}

function readCustomPoints() {
	var points = [];
	for (var i = 1; i <= 5; i++) {
		var tEl = document.querySelector('[data-name="point' + i + '_temp"] input');
		var pEl = document.querySelector('[data-name="point' + i + '_pwm"] input');
		var temp = tEl ? parseInt(tEl.value, 10) : 0;
		var pwm = pEl ? parseInt(pEl.value, 10) : 0;
		if (isNaN(temp)) temp = 0;
		if (isNaN(pwm)) pwm = 0;
		points.push({ temp: Math.min(100, Math.max(0, temp)), pwm: Math.min(255, Math.max(0, pwm)) });
	}
	return points;
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('fan'),
			L.resolveDefault(callGetAllCurves(), {}),
			L.resolveDefault(callFanStatus(), {})
		]);
	},

	render: function(data) {
		var curves = data[1] || {};
		var status = data[2] || {};

		/* Two independent stylesheets, one per half of the page. Both are keyed
		 * on their own <style> element and their own dark-mode memo, so a theme
		 * change repaints both. */
		injectStatusCSS();
		injectSettingsCSS();
		restoreHistory();

		var dashboard = E('div', { 'class': 'cbi-map fan-dashboard' }, [
			E('div', { 'class': 'cbi-map-descr' }, _('View real-time fan speed and system temperatures.')),
			renderSummary(status),
			E('div', { 'class': 'fan-panel' }, [
				E('div', { 'class': 'fan-panel-title' }, _('Real-time Trends')),
				E('div', { 'class': 'fan-chart-grid' }, [
					chartCard(_('Board Temperature'), (status.temp_board || 0) + '°C', 'fc-temp', '#f97316'),
					chartCard(_('Fan PWM'), (status.fan_pwm || 0) + ' / 255', 'fc-pwm', '#00c8ff'),
					chartCard(_('Fan Speed'), (status.fan_rpm || 0) + ' RPM', 'fc-rpm', '#00cc44')
				])
			]),
			E('div', { 'class': 'fan-panel' }, [
				E('div', { 'class': 'fan-panel-title' }, _('Temperatures')),
				E('div', { 'class': 'fan-temp-grid' }, [
					temperatureGroup(_('System'), [
						createTempGauge(_('CPU Temp'), status.temp_cpu || 0, 'temp-cpu'),
						createTempGauge(_('Board (Fan Curve)'), status.temp_board || 0, 'temp-board'),
						createTempGauge(_('10G PHY'), status.temp_phy1 || 0, 'temp-phy1'),
						createTempGauge(_('Switch PHY'), status.temp_phy2 || 0, 'temp-phy2')
					]),
					temperatureGroup(_('WiFi'), [
						createTempGauge(_('2.4 GHz Radio'), status.wifi_24g || 0, 'temp-wifi24g'),
						createTempGauge(_('5 GHz Radio'), status.wifi_5g || 0, 'temp-wifi5g'),
						createTempGauge(_('6 GHz Radio'), status.wifi_6g || 0, 'temp-wifi6g')
					])
				])
			])
		]);

		var fetchData = L.bind(function() {
			return callFanStatus().then(L.bind(function(current) {
				current = current || {};
				injectStatusCSS();
				updateSummary(current);
				updateGauge('temp-cpu', current.temp_cpu || 0);
				updateGauge('temp-board', current.temp_board || 0);
				updateGauge('temp-phy1', current.temp_phy1 || 0);
				updateGauge('temp-phy2', current.temp_phy2 || 0);
				updateGauge('temp-wifi24g', current.wifi_24g || 0);
				updateGauge('temp-wifi5g', current.wifi_5g || 0);
				updateGauge('temp-wifi6g', current.wifi_6g || 0);
				var values = [ ['fc-temp-val', (current.temp_board || 0) + '°C'], ['fc-pwm-val', (current.fan_pwm || 0) + ' / 255'], ['fc-rpm-val', (current.fan_rpm || 0) + ' RPM'] ];
				values.forEach(function(item) { var el = document.getElementById(item[0]); if (el) el.textContent = item[1]; });
				appendHistory(current);
				drawAllCharts();
			}, this));
		}, this);

		requestAnimationFrame(function() {
			drawAllCharts();
			fetchData();
		});
		poll.add(fetchData, 3);

		var m, s, o;

		m = new form.Map('fan', null,
			_('Configure fan control mode and speed curves.'));

		s = m.section(form.NamedSection, 'settings', 'fancontrol', _('Control Mode'));
		s.anonymous = true;

		o = s.option(form.ListValue, 'mode', _('Mode'));
		o.value('auto', _('Automatic (Follow Curve)'));
		o.value('manual', _('Manual (Fixed Speed)'));
		o.default = 'auto';

		o = s.option(form.Value, 'manual_pwm', _('Manual Fan Speed (PWM)'),
			_('Set a fixed PWM value (0-255). 0 = Off, 255 = Full Speed'));
		o.datatype = 'range(0,255)';
		o.default = '127';
		o.depends('mode', 'manual');
		o.rmempty = false;

		o = s.option(form.ListValue, 'curve_preset', _('Fan Curve Preset'));
		o.value('quiet', _('Quiet - Lower speeds, higher temps'));
		o.value('balanced', _('Balanced - Good mix of noise and cooling'));
		o.value('performance', _('Performance - Higher speeds, lower temps'));
		o.value('custom', _('Custom - Define your own curve'));
		o.default = 'balanced';
		o.depends('mode', 'auto');

		o = s.option(form.DummyValue, '_curve_graph', _('Curve Preview'));
		o.depends('mode', 'auto');
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<div class="fan-curve-wrap"><canvas id="curve-canvas" class="fan-curve-canvas"></canvas></div>';
		};

		s = m.section(form.NamedSection, 'custom', 'curve', _('Custom Curve Editor'),
			_('Define 5 temperature/PWM points. The curve preview updates live as you enter values.'));
		s.anonymous = true;
		s.addremove = false;

		var defaults = {
			point1_temp: 40, point1_pwm: 54,
			point2_temp: 50, point2_pwm: 69,
			point3_temp: 60, point3_pwm: 95,
			point4_temp: 70, point4_pwm: 199,
			point5_temp: 80, point5_pwm: 255
		};

		for (var i = 1; i <= 5; i++) {
			o = s.option(form.Value, 'point' + i + '_temp',
				_('Point %d Temperature (°C)').format(i));
			o.datatype = 'range(0,100)';
			o.default = String(defaults['point' + i + '_temp']);
			o.rmempty = false;

			o = s.option(form.Value, 'point' + i + '_pwm',
				_('Point %d PWM (0-255)').format(i));
			o.datatype = 'range(0,255)';
			o.default = String(defaults['point' + i + '_pwm']);
			o.rmempty = false;
		}

		return m.render().then(function(mapNode) {
			mapNode.classList.add('fan-settings');
			var intro = mapNode.querySelector('.cbi-map-descr');
			if (intro) intro.classList.add('fan-settings-intro');
			var sections = mapNode.querySelectorAll('.cbi-section');
			if (sections[0]) sections[0].classList.add('fan-control-section');
			if (sections[1]) sections[1].classList.add('fan-curve-section');
			requestAnimationFrame(function() {
				injectSettingsCSS();
				var presetSelect = mapNode.querySelector('[data-name="curve_preset"] select');
				var modeSelect = mapNode.querySelector('[data-name="mode"] select');
				var point1Marker = mapNode.querySelector('[data-name="point1_temp"]');
				var manualMarker = mapNode.querySelector('[data-name="manual_pwm"]');

				function getCurrentPreset() {
					return presetSelect ? presetSelect.value : uci.get('fan', 'settings', 'curve_preset') || 'balanced';
				}

				function getCurrentMode() {
					return modeSelect ? modeSelect.value : uci.get('fan', 'settings', 'mode') || 'auto';
				}

				function toggleCustomSection() {
					var visible = getCurrentMode() === 'auto' && getCurrentPreset() === 'custom';
					var manual = getCurrentMode() === 'manual';
					if (point1Marker) {
						var section = point1Marker.closest('.cbi-section');
						if (section) section.style.display = visible ? '' : 'none';
					}
					if (manualMarker) manualMarker.style.display = manual ? '' : 'none';
				}

				function redrawCanvas() {
					var preset = getCurrentPreset();
					if (preset === 'custom') {
						drawCurveCanvas('curve-canvas', curves, preset, readCustomPoints());
					} else {
						drawCurveCanvas('curve-canvas', curves, preset, null);
					}
				}

				redrawCanvas();
				toggleCustomSection();

				if (presetSelect) {
					presetSelect.addEventListener('change', function() {
						toggleCustomSection();
						setTimeout(redrawCanvas, 50);
					});
				}

				if (modeSelect) {
					modeSelect.addEventListener('change', function() {
						toggleCustomSection();
						setTimeout(redrawCanvas, 50);
					});
				}

				for (var i = 1; i <= 5; i++) {
					['_temp', '_pwm'].forEach(function(suffix) {
						var el = mapNode.querySelector('[data-name="point' + i + suffix + '"] input');
						if (el) el.addEventListener('input', redrawCanvas);
					});
				}
			});
			/* One wrapper holding both halves. The dashboard keeps its cbi-map
			 * class for the theme's spacing, but binds no widget instance, so
			 * the inherited handleSave/handleReset -- which walk every .cbi-map
			 * under #maincontent and call save/reset on it -- skip it and only
			 * the settings form is saved. Overriding those handlers, as the
			 * standalone dashboard view did, would leave this page with no
			 * footer buttons at all. */
			return E('div', {}, [ dashboard, mapNode ]);
		});
	}
});
