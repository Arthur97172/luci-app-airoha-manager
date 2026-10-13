'use strict';
'require view';
'require poll';
'require rpc';
'require ui';

var callNpuStatus = rpc.declare({ object: 'luci.airoha_manager', method: 'getStatus' });
var callTokenInfo = rpc.declare({ object: 'luci.airoha_manager', method: 'getTokenInfo' });
var callFrameEngine = rpc.declare({ object: 'luci.airoha_manager', method: 'getFrameEngine' });
var callGetVlanOffload = rpc.declare({ object: 'luci.airoha_manager', method: 'getVlanOffload' });
var callSetVlanOffload = rpc.declare({ object: 'luci.airoha_manager', method: 'setVlanOffload', params: ['enabled'] });
var callGetPppoeOffload = rpc.declare({ object: 'luci.airoha_manager', method: 'getPppoeOffload' });
var callSetPppoeOffload = rpc.declare({ object: 'luci.airoha_manager', method: 'setPppoeOffload', params: ['enabled'] });
var callGetFlowOffload = rpc.declare({ object: 'luci.airoha_manager', method: 'getFlowOffload' });
var callSetFlowOffload = rpc.declare({ object: 'luci.airoha_manager', method: 'setFlowOffload', params: ['enabled'] });
var callGetApModeOffload = rpc.declare({ object: 'luci.airoha_manager', method: 'getApModeOffload' });
var callSetApModeOffload = rpc.declare({ object: 'luci.airoha_manager', method: 'setApModeOffload', params: ['enabled'] });
var callGetDeviceMode = rpc.declare({ object: 'luci.airoha_manager', method: 'getDeviceMode' });

/* ── Theme-adaptive CSS ── */
var themeCSS = '\
.soc-card{background:var(--soc-card-bg);border:1px solid var(--soc-border);border-radius:8px;padding:14px;transition:border-color .3s}\
.soc-card-accent{border-left-width:3px;border-left-style:solid}\
.soc-muted{color:var(--soc-muted)}\
.soc-text{color:var(--soc-text)}\
.soc-label{font-size:12px;line-height:1.4;color:var(--soc-muted)}\
.soc-bar-track{background:var(--soc-bar-track);border-radius:4px;overflow:hidden}\
.soc-pse-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}\
.soc-pse-cell{background:var(--soc-card-bg);border:1px solid var(--soc-border);border-radius:5px;padding:6px 8px;font-size:12px;line-height:1.4}\
.soc-band-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}\
.soc-gdm-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px}\
.soc-cdm-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:10px}\
.npu-dashboard{--npu-cyan:#00c8ff;--npu-green:#00cc44;--npu-amber:#f5a623;--npu-red:#d0021b;--airoha-font-ui:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif;--airoha-font-mono:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;font-family:var(--airoha-font-ui);font-size:13px;line-height:1.5;letter-spacing:0;color:var(--soc-text);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}\
.npu-dashboard h2{margin:0 0 14px;font-family:var(--airoha-font-ui);font-size:22px;line-height:1.3;font-weight:600;letter-spacing:0;color:var(--soc-text)}\
.npu-dashboard .cbi-button,.npu-dashboard .cbi-input-select,.npu-dashboard input{font-family:var(--airoha-font-ui);font-size:13px!important;line-height:1.4;letter-spacing:0}\
.npu-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:8px;margin:0 0 12px}\
.npu-summary-card{background:var(--soc-card-bg);border:1px solid var(--soc-border);border-left:3px solid var(--npu-summary-accent,var(--soc-border));border-radius:8px;padding:10px 14px;min-height:82px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;transition:border-color .3s}\
.npu-summary-title{font-size:11px;line-height:1.35;text-transform:uppercase;letter-spacing:0;color:var(--soc-muted);font-family:var(--airoha-font-ui);font-weight:600;margin-bottom:5px}\
.npu-summary-value{font-size:20px;line-height:1.15;font-family:var(--airoha-font-mono);font-variant-numeric:tabular-nums;font-weight:700}\
.npu-summary-sub{font-size:12px;line-height:1.4;color:var(--soc-muted);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.npu-section{background:var(--soc-card-bg);border:1px solid var(--soc-border);border-radius:8px;padding:14px;margin:12px 0!important}\
.npu-section>h3{font-size:16px;line-height:1.4;font-weight:600;letter-spacing:0;margin:0 0 12px;padding:0 0 8px;border-bottom:1px solid var(--soc-border);color:var(--soc-text)}\
.npu-section h4{font-size:14px;line-height:1.4;font-weight:600;letter-spacing:0;margin-top:14px!important;padding-top:12px;border-top:1px solid var(--soc-border)}\
.npu-details-table{margin:0}\
.cpu-panel-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}\
.cpu-panel-card{background:var(--soc-card-bg);border:1px solid var(--soc-border);border-left:3px solid var(--cpu-panel-accent,var(--soc-border));border-radius:8px;padding:11px 14px;min-width:0;min-height:96px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center}\
.cpu-panel-card.cpu-info{--cpu-panel-accent:#00c8ff}\
.cpu-panel-card.cpu-platform{--cpu-panel-accent:#a855f7}\
.cpu-panel-card.cpu-arch{--cpu-panel-accent:#f5a623}\
.cpu-panel-card.cpu-frequency{--cpu-panel-accent:#00cc44}\
.cpu-panel-title{font-size:11px;line-height:1.35;text-transform:uppercase;letter-spacing:0;color:var(--soc-muted);font-family:var(--airoha-font-ui);font-weight:600;margin-bottom:9px}\
.cpu-panel-body{color:var(--soc-text);font-size:13px;line-height:1.5}\
.cpu-info-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;line-height:1.5}\
.cpu-panel-value{font-weight:600;overflow-wrap:anywhere}\
.cpu-freq-scale{display:flex;align-items:center;gap:10px;width:100%}\
.cpu-freq-edge{font-family:var(--airoha-font-mono);font-size:12px;font-variant-numeric:tabular-nums;min-width:54px;text-align:center}\
.cpu-freq-track{flex:1;height:28px!important;min-width:0;max-width:none!important;position:relative;border-radius:6px!important}\
.cpu-freq-label{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--airoha-font-mono);font-variant-numeric:tabular-nums;font-weight:700;font-size:14px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.65)}\
.cpu-freq-fixed{font-family:var(--airoha-font-mono);font-variant-numeric:tabular-nums;font-weight:700;font-size:18px;line-height:1.3;color:var(--soc-text)}\
.npu-frame-wrap{margin-top:8px;border:1px solid var(--soc-border);border-radius:8px;padding:10px;background:var(--soc-card-bg)}\
.fe-cdm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:10px}\
.fe-wifi-band-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}\
.fe-cdm-grid>*,.fe-wifi-band-grid>*{min-width:0}\
.npu-frame-name{font-size:13px;line-height:1.35;font-weight:600}\
.npu-frame-row{font-size:12px;line-height:1.45}\
.npu-frame-status{font-size:10px;line-height:1.4;font-weight:600}\
.npu-subsection-title{font-size:13px;line-height:1.4;font-weight:600}\
.offload-row{display:flex;align-items:center;justify-content:space-evenly;flex-wrap:wrap;gap:12px;padding:10px 0}\
.offload-row{display:grid;grid-template-columns:repeat(4,minmax(175px,1fr));gap:8px;padding:0;margin:12px 0}\
.offload-item{background:var(--soc-card-bg);border:1px solid var(--soc-border);border-left:3px solid var(--soc-border);border-radius:12px;padding:11px 14px;min-width:0;min-height:58px;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px}\
.offload-item:has(.offload-on){border-left-color:var(--npu-green)}\
.offload-item:has(.offload-off){border-left-color:#6b7280}\
.offload-name{display:flex;align-items:center;gap:10px;min-width:0;font-size:13px;line-height:1.4;font-weight:500}\
.offload-name .soc-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.offload-dot{width:8px;height:8px;border-radius:50%;background:#9ca3af;flex:0 0 auto;transition:background .25s,box-shadow .25s}\
.offload-item:has(.offload-on) .offload-dot{background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.12)}\
.offload-controls{display:flex;align-items:center;justify-content:flex-end;gap:10px;min-width:128px}\
.npu-toggle{position:relative;display:inline-flex;width:52px;height:30px;flex:0 0 auto;cursor:pointer}\
.npu-toggle-input{position:absolute;width:1px;height:1px;opacity:0;margin:0}\
.npu-toggle-track{position:absolute;inset:0;border:1px solid #cbd5e1;border-radius:999px;background:#d7dce2;transition:background .25s,border-color .25s,box-shadow .25s}\
.npu-toggle-track:before{content:"";position:absolute;width:24px;height:24px;left:2px;top:2px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.24);transition:transform .25s}\
.npu-toggle-input:checked+.npu-toggle-track{background:#22c55e;border-color:#16a34a}\
.npu-toggle-input:checked+.npu-toggle-track:before{transform:translateX(22px)}\
.npu-toggle-input:focus-visible+.npu-toggle-track{box-shadow:0 0 0 3px rgba(0,200,255,.25)}\
.npu-toggle-input:disabled+.npu-toggle-track{opacity:.55;cursor:not-allowed}\
.offload-badge{font-size:12px;font-weight:600;line-height:1.4;letter-spacing:0;padding:0;border:0;background:transparent;font-family:var(--airoha-font-ui);display:inline-flex;align-items:center;white-space:nowrap}\
.offload-on{color:#16a34a}\
.offload-off{color:#6b7280}\
.offload-blocked{color:#f59e0b}\
@media(max-width:1050px){.npu-summary-grid{grid-template-columns:repeat(2,minmax(180px,1fr))}.offload-row{grid-template-columns:repeat(2,minmax(180px,1fr))}.cpu-panel-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}\
@media(max-width:640px){.npu-summary-grid,.offload-row,.fe-cdm-grid,.fe-wifi-band-grid,.cpu-panel-grid{grid-template-columns:1fr}.npu-section{padding:11px}.cpu-panel-card{padding:10px 12px}.cpu-freq-scale{gap:6px}.cpu-freq-edge{min-width:44px;font-size:10px}.offload-item{min-height:62px;padding:12px 14px}.offload-controls{min-width:132px}}\
';

function isDarkMode() {
	// Sample multiple elements to get a reliable reading
	var els = [document.body, document.querySelector('.main-content'), document.querySelector('#maincontent'), document.querySelector('.cbi-map')];
	for (var i = 0; i < els.length; i++) {
		if (!els[i]) continue;
		var bg = window.getComputedStyle(els[i]).backgroundColor;
		var m = bg.match(/\d+/g);
		if (m && m.length >= 3) {
			var a = m.length >= 4 ? parseFloat(m[3]) : 1;
			if (a < 0.1) continue; // transparent, skip
			var lum = (parseInt(m[0]) * 299 + parseInt(m[1]) * 587 + parseInt(m[2]) * 114) / 1000;
			return lum < 128;
		}
	}
	// Fallback: check if any known dark theme stylesheet is loaded
	var sheets = document.querySelectorAll('link[href*="dark"], link[href*="glass"]');
	return sheets.length > 0;
}

var _lastDarkMode = null;

function injectCSS() {
	var el = document.getElementById('soc-theme-css');
	if (!el) { el = document.createElement('style'); el.id = 'soc-theme-css'; document.head.appendChild(el); }

	var dark = isDarkMode();
	if (dark === _lastDarkMode) return;
	_lastDarkMode = dark;

	var vars = dark
		? ':root{--soc-card-bg:#1e1e1e;--soc-border:#333;--soc-muted:#999;--soc-text:#e0e0e0;--soc-bar-track:#333}'
		: ':root{--soc-card-bg:#fff;--soc-border:#d0d0d0;--soc-muted:#666;--soc-text:#222;--soc-bar-track:#e0e0e0}';
	el.textContent = themeCSS + vars;
}

/* ── Helpers ── */
var bandInfo = [
	{ name: '2.4 GHz', accent: '#ff9800' },
	{ name: '5 GHz', accent: '#2196f3' },
	{ name: '6 GHz', accent: '#9c27b0' }
];

var psePortMap = [
	{ name: 'CDM1', label: 'CPU DMA 1',   color: '#607d8b' },
	{ name: 'GDM1', label: 'Switch 1G',   color: '#ff9800' },
	{ name: 'GDM2', label: 'WAN 10G',     color: '#4caf50' },
	{ name: 'GDM3', label: 'GDM3',        color: '#607d8b' },
	{ name: 'PPE1', label: 'PPE Eng 1',   color: '#2196f3' },
	{ name: 'CDM2', label: 'CPU DMA 2',   color: '#607d8b' },
	{ name: 'CDM3', label: 'CDM3',        color: '#607d8b' },
	{ name: 'CDM4', label: 'WDMA WiFi',   color: '#9c27b0' },
	{ name: 'PPE2', label: 'PPE Eng 2',   color: '#2196f3' },
	{ name: 'GDM4', label: 'LAN2 10G',    color: '#4caf50' }
];

function fmtFreq(khz) { return (!khz || khz === 0) ? 'N/A' : (khz / 1000).toFixed(0) + ' MHz'; }
function fmtK(n) {
	if (!n || n === 0) return '0';
	if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
	if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
	return n.toString();
}

function calcTotalMem(regions) {
	var t = 0;
	(regions || []).forEach(function(r) {
		var m = (r.size || '').match(/(\d+)\s*(KiB|MiB|GiB)/i);
		if (m) { var s = parseInt(m[1]); var u = m[2][0].toUpperCase(); t += u === 'G' ? s*1048576 : u === 'M' ? s*1024 : s; }
	});
	return t >= 1024 ? (t/1024).toFixed(0)+' MiB' : t+' KiB';
}

function tokenHealth(c, s) {
	if (!s) return { text: 'N/A', color: '#888' };
	var p = c/s*100;
	return p < 50 ? { text:_('Healthy'), color:'#4caf50' } : p < 80 ? { text:_('Warning'), color:'#ff9800' } : { text:_('Critical'), color:'#f44336' };
}

function getBandStats(ti, b) {
	var c = Array.isArray(ti.station_counts) ? ti.station_counts : [];
	for (var i=0;i<c.length;i++) if (c[i].band===b) return c[i];
	return { band:b, count:0, tx_packets:0, tx_retries:0 };
}

function getTxQueue(ti, b) {
	var q = Array.isArray(ti.tx_queues) ? ti.tx_queues : [];
	for (var i=0;i<q.length;i++) if (q[i].band===b) return q[i];
	return null;
}

function bandHealth(s) {
	if (!s || s.count===0) return { text:_('No clients'), color:'#888' };
	if (!s.tx_packets) return { text:_('Idle'), color:'#888' };
	var r = s.tx_retries/(s.tx_packets+s.tx_retries);
	return r>0.5 ? {text:_('Poor'),color:'#f44336'} : r>0.2 ? {text:_('Fair'),color:'#ff9800'} : {text:_('Good'),color:'#4caf50'};
}

function retryPct(s) {
	if (!s || !s.tx_packets) return '-';
	return (s.tx_retries/(s.tx_packets+s.tx_retries)*100).toFixed(1)+'%';
}

function isEnabled(value) {
	return value === true || value === 1 || value === '1';
}

function isBridgeOffloadBlocked(mode) {
	mode = mode || {};
	return isEnabled(mode.bridge_offload_blocked);
}

function npuSummaryData(st) {
	st = st || {};
	var active = isEnabled(st.npu_loaded);
	var clock = st.npu_clock ? Math.round(st.npu_clock / 1000000) : 0;
	var bound = st.offload_bound || 0;
	var total = st.offload_total || 0;
	var mem = Array.isArray(st.memory_regions) ? st.memory_regions : [];

	return [
		{ id: 'npu-summary-status', title: _('NPU Status'), value: active ? _('Activated') : _('Not Activated'), sub: active ? (st.npu_device || _('NPU device ready')) : _('Driver unavailable'), color: active ? '#00c8ff' : '#6b7280' },
		{ id: 'npu-summary-clock', title: _('NPU Clock / Cores'), value: clock ? clock + ' MHz' : 'N/A', sub: _('%d cores').format(st.npu_cores || 0), color: '#00cc44' },
		{ id: 'npu-summary-flows', title: _('Offload Statistics'), value: bound + ' / ' + total, sub: _('Bound / total PPE flows'), color: total > 0 ? '#00c8ff' : '#6b7280' },
		{ id: 'npu-summary-memory', title: _('Reserved Memory'), value: calcTotalMem(mem), sub: _('%d memory regions').format(mem.length), color: '#7c3aed' }
	];
}

function renderNpuSummary(st) {
	var cards = npuSummaryData(st).map(function(card) {
		return E('div', { 'id': card.id, 'class': 'npu-summary-card', 'style': '--npu-summary-accent:' + card.color }, [
			E('div', { 'class': 'npu-summary-title' }, card.title),
			E('div', { 'class': 'npu-summary-value', 'style': 'color:' + card.color }, card.value),
			E('div', { 'class': 'npu-summary-sub' }, card.sub)
		]);
	});
	return E('div', { 'class': 'npu-summary-grid', 'id': 'npu-summary-grid' }, cards);
}

function updateNpuSummary(st) {
	npuSummaryData(st).forEach(function(card) {
		var el = document.getElementById(card.id);
		if (!el) return;
		el.style.setProperty('--npu-summary-accent', card.color);
		var value = el.querySelector('.npu-summary-value');
		var sub = el.querySelector('.npu-summary-sub');
		if (value) { value.textContent = card.value; value.style.color = card.color; }
		if (sub) sub.textContent = card.sub;
	});
}

/* ── Mini Band Chip (compact for FE diagram) ── */
function renderBandChip(band, txQ, stats) {
	var info = bandInfo[band] || { name: _('Band %d').format(band), accent: '#888' };
	var id = 'band-'+band;
	var h = bandHealth(stats);
	var type = txQ ? txQ.type : '?';
	var rp = retryPct(stats);

	return E('div', { 'id': id, 'style': 'background:var(--soc-card-bg);border:1px solid var(--soc-border);border-left:2px solid '+info.accent+';border-radius:6px;padding:10px 12px' }, [
		E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px' }, [
			E('span', { 'class': 'soc-text npu-frame-name' }, info.name),
			E('span', { 'class': 'npu-frame-status', 'style': 'background:'+(type==='npu'?'#1565c0':'#666')+';color:#fff;padding:1px 6px;border-radius:3px' }, type.toUpperCase())
		]),
		E('div', { 'class': 'npu-frame-row', 'style': 'display:flex;justify-content:space-between;align-items:center' }, [
			E('div', { 'id': id+'-health', 'style': 'display:flex;align-items:center;gap:4px' }, [
				E('span', { 'style': 'width:7px;height:7px;border-radius:50%;background:'+h.color+';display:inline-block' }),
				E('span', { 'style': 'color:'+h.color+';font-weight:500' }, h.text)
			]),
			E('span', { 'id': id+'-clients', 'class': 'soc-muted' }, _('%d sta').format(stats.count)),
			(stats.tx_packets > 0) ? E('span', { 'id': id+'-retries', 'class': 'soc-muted' }, rp) : E('span')
		])
	]);
}

function updateBandChip(band, stats) {
	var id = 'band-'+band, h = bandHealth(stats);
	var el = document.getElementById(id+'-health');
	if (el) { el.innerHTML = ''; el.appendChild(E('span',{'style':'width:6px;height:6px;border-radius:50%;background:'+h.color+';display:inline-block'})); el.appendChild(E('span',{'style':'color:'+h.color+';font-weight:500'},h.text)); }
	var cl = document.getElementById(id+'-clients');
	if (cl) cl.textContent = _('%d sta').format(stats.count);
	var re = document.getElementById(id+'-retries');
	if (re) { var rp2 = retryPct(stats); re.textContent = rp2; }
}

/* ── Frame Engine Diagram (with WiFi bands, NPU, PPE flows) ── */
function renderFeDiagram(fe, ti, st) {
	if (!fe || fe.error) return E('div', { 'class': 'soc-muted' }, _('devmem not available on this build'));
	ti = ti || {}; st = st || {};

	var ports = Array.isArray(fe.pse_ports) ? fe.pse_ports : [];

	// Helper: GDM card
	function gdmCard(key, name, label, color, pse) {
		var d = fe[key] || {};
		var active = d.tx > 0 || d.rx > 0;
		return E('div', { 'class': 'soc-card soc-card-accent', 'style': 'border-left-color:'+color + (active?';border-color:'+color:'') }, [
			E('div', { 'style': 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px' }, [
				E('span', { 'class': 'npu-frame-name', 'style': 'color:'+color }, name),
				E('span', { 'class': 'soc-label' }, pse)
			]),
			E('div', { 'class': 'soc-label', 'style': 'margin-bottom:6px' }, label),
			E('div', { 'class': 'npu-frame-row', 'style': 'display:grid;grid-template-columns:auto 1fr;gap:2px 10px' }, [
				E('span', { 'class': 'soc-muted' }, 'TX'), E('span', { 'class': 'soc-text', 'style': 'text-align:right' }, fmtK(d.tx)),
				E('span', { 'class': 'soc-muted' }, 'RX'), E('span', { 'class': 'soc-text', 'style': 'text-align:right' }, fmtK(d.rx))
			].concat(d.tx_drop > 0 ? [
				E('span', { 'style': 'color:#f44336' }, _('TX Drop')), E('span', { 'style': 'color:#f44336;text-align:right' }, fmtK(d.tx_drop))
			] : []).concat(d.rx_drop > 0 ? [
				E('span', { 'style': 'color:#f44336' }, _('RX Drop')), E('span', { 'style': 'color:#f44336;text-align:right' }, fmtK(d.rx_drop))
			] : []))
		]);
	}

	// Helper: CDM offload bar
	function cdmCard(key, name, label, pse) {
		var d = fe[key] || {};
		var total = (d.rx_cpu||0) + (d.rx_hwf||0);
		var pct = total > 0 ? ((d.rx_hwf/total)*100).toFixed(1) : '0.0';
		var barCol = total===0 ? 'var(--soc-border)' : parseFloat(pct)>80 ? '#4caf50' : parseFloat(pct)>50 ? '#ff9800' : '#f44336';
		return E('div', { 'class': 'soc-card' }, [
			E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px' }, [
				E('span', { 'class': 'npu-frame-name', 'style': 'color:#607d8b' }, name+' '+pse),
				E('span', { 'class': 'soc-label' }, label)
			]),
			E('div', { 'class': 'soc-text npu-frame-row', 'style': 'margin-bottom:4px' }, _('HW Offload') + ': ' + pct + '%'),
			E('div', { 'class': 'soc-bar-track', 'style': 'height:6px' }, [
				E('div', { 'style': 'background:'+barCol+';height:100%;width:'+pct+'%;transition:width .5s;border-radius:4px' })
			]),
			E('div', { 'class': 'npu-frame-row', 'style': 'display:flex;justify-content:space-between;margin-top:4px' }, [
				E('span', { 'class': 'soc-muted' }, 'CPU: '+fmtK(d.rx_cpu||0)),
				E('span', { 'class': 'soc-muted' }, 'HWF: '+fmtK(d.rx_hwf||0)),
				E('span', { 'class': 'soc-muted' }, 'TX: '+fmtK(d.tx||0))
			])
		]);
	}

	// WiFi band chips for CDM4
	var bandChips = [];
	for (var b = 0; b < 3; b++) bandChips.push(renderBandChip(b, getTxQueue(ti, b), getBandStats(ti, b)));

	// CDM4/WDMA + WiFi bands grouped
	var p7 = ports[7] || { iq: 0, oq: 0, drops: 0 };
	var cdm4WiFi = E('div', { 'class': 'soc-card soc-card-accent', 'style': 'border-left-color:#9c27b0' }, [
		E('div', { 'style': 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px' }, [
			E('span', { 'class': 'npu-frame-name', 'style': 'color:#9c27b0' }, 'CDM4 / WDMA'),
			E('span', { 'class': 'soc-label' }, 'P7 WiFi DMA')
		]),
		E('div', { 'class': 'npu-frame-row', 'style': 'display:flex;gap:12px;margin-bottom:8px' }, [
			E('span', { 'class': 'soc-muted' }, 'IQ '+p7.iq),
			E('span', { 'class': 'soc-muted' }, 'OQ '+p7.oq),
			p7.drops > 0 ? E('span', { 'style': 'color:#f44336' }, _('Drop') + ' ' + fmtK(p7.drops)) : null
		].filter(Boolean)),
		// WiFi bands inside
		E('div', { 'class': 'fe-wifi-band-grid' }, bandChips)
	]);

	// NPU indicator
	var npuActive = st.npu_loaded;
	var npuCard = E('div', { 'class': 'soc-card', 'style': 'border-color:'+(npuActive?'#00bcd4':'var(--soc-border)') }, [
		E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px' }, [
			E('span', { 'class': 'npu-frame-name', 'style': 'color:#00bcd4' }, 'NPU'),
			E('span', { 'class': 'npu-frame-status', 'style': 'background:'+(npuActive?'#00695c':'#666')+';color:#fff;padding:1px 7px;border-radius:3px' }, npuActive ? _('ACTIVE') : _('OFF'))
		]),
		E('div', { 'class': 'soc-label', 'style': 'margin-bottom:4px' }, _('8x RISC-V via PCIe RAM')),
		E('div', { 'class': 'npu-frame-row' }, [
			E('span', { 'class': 'soc-muted' }, _('Manages:') + ' '),
			E('span', { 'class': 'soc-text' }, _('PPE init, WDMA rings, flow stats'))
		])
	]);

	// PPE engines with flow count
	var ppeCard = E('div', { 'class': 'soc-card', 'style': 'border-color:#2196f3' }, [
		E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px' }, [
			E('span', { 'class': 'npu-frame-name', 'style': 'color:#2196f3' }, _('PPE Engines')),
			E('span', { 'class': 'soc-label' }, 'P4 + P8')
		]),
		E('div', { 'class': 'npu-frame-row', 'style': 'display:flex;gap:16px' }, [
			E('span', {}, [
				E('span', { 'class': 'soc-muted' }, _('Bound') + ' '),
				E('span', { 'class': 'soc-text', 'style': 'font-weight:bold', 'id': 'fe-ppe-bound' }, (st.offload_bound||0).toString())
			]),
			E('span', {}, [
				E('span', { 'class': 'soc-muted' }, _('Total') + ' '),
				E('span', { 'class': 'soc-text', 'id': 'fe-ppe-total' }, (st.offload_total||0).toString())
			])
		])
	]);

	// PSE buffer
	var pseT = (fe.pse_used||0)+(fe.pse_free||0);
	var pseP = pseT>0 ? ((fe.pse_used/pseT)*100).toFixed(1) : '0';
	var pseCol = parseFloat(pseP)>80?'#f44336':parseFloat(pseP)>50?'#ff9800':'#4caf50';

	// PSE port cells (skip P7 since it's shown in CDM4/WiFi section)
	var portCells = ports.filter(function(p){ return p.port !== 7; }).map(function(p) {
		var info = psePortMap[p.port] || { name:'P'+p.port, label:'?', color:'#666' };
		var drop = p.drops > 0;
		return E('div', { 'class': 'soc-pse-cell', 'style': drop ? 'border-color:#f44336' : '' }, [
			E('div', { 'class': 'npu-frame-row', 'style': 'font-weight:600;color:'+info.color }, 'P'+p.port+' '+info.name),
			E('div', { 'class': 'npu-frame-row', 'style': 'display:flex;gap:8px;margin-top:2px' }, [
				E('span', { 'class': 'soc-muted' }, 'IQ '+p.iq),
				E('span', { 'class': 'soc-muted' }, 'OQ '+p.oq),
				drop ? E('span', { 'style': 'color:#f44336' }, fmtK(p.drops)) : null
			].filter(Boolean))
		]);
	});

	return E('div', { 'id': 'fe-diagram' }, [
		// PSE buffer bar
		E('div', { 'class': 'soc-card', 'style': 'margin-bottom:10px' }, [
			E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px' }, [
				E('span', { 'class': 'soc-text npu-frame-name' }, _('PSE Shared Buffer')),
				E('span', { 'class': 'soc-muted npu-frame-row' }, _('%d used / %d free').format(fe.pse_used||0, fe.pse_free||0) + ' (' + pseP + '%)')
			]),
			E('div', { 'class': 'soc-bar-track', 'style': 'height:8px' }, [
				E('div', { 'style': 'background:'+pseCol+';height:100%;width:'+pseP+'%;border-radius:4px;transition:width .5s' })
			])
		]),
		// Row 1: GDM ports
		E('div', { 'class': 'soc-gdm-grid' }, [
			gdmCard('gdm1', 'GDM1', _('Internal Switch (1G LAN3/4)'), '#ff9800', 'P1'),
			gdmCard('gdm2', 'GDM2', _('WAN (USXGMII 10G)'), '#4caf50', 'P2'),
			gdmCard('gdm4', 'GDM4', _('LAN2 (USXGMII 10G)'), '#4caf50', 'P9')
		]),
		// Row 2: CDM1/CDM2 (CPU) + CDM4/WiFi
		E('div', { 'class': 'fe-cdm-grid' }, [
			cdmCard('cdm1', 'CDM1', 'CPU DMA 1', 'P0'),
			cdmCard('cdm2', 'CDM2', 'CPU DMA 2', 'P5'),
			cdm4WiFi
		]),
		// Row 3: PPE + NPU
		E('div', { 'style': 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px' }, [
			ppeCard,
			npuCard
		]),
		// PSE port grid
		E('div', { 'class': 'soc-text npu-subsection-title', 'style': 'margin-bottom:6px' }, _('PSE Port Queue Status')),
		E('div', { 'class': 'soc-pse-grid' }, portCells)
	]);
}

/* ── CPU Frequency ── */
function freqBarState(hw, min, max, pll, gov) {
	var pll_khz = (pll || 0) * 1000;
	// No cpufreq policy on this firmware — the BL31 AVS call behind the CPU
	// clock answers 0, so cpufreq-dt registers nothing. The hardware PLL read
	// is then the only frequency there is, and there is no range to scale
	// against.
	if (!max) return { freq: (!hw && pll_khz > 0) ? pll_khz : (hw || 0), max: 0, oc: false };
	var oc = gov==='performance' && pll>0 && pll_khz>max;
	return { freq: oc ? pll_khz : Math.min(hw,max), max: oc ? pll_khz : max, oc: oc };
}

function renderFreqBar(hw, min, max, pll, gov) {
	var s = freqBarState(hw,min,max,pll,gov);
	// Without a range a bar would only suggest a scalability this firmware does
	// not have, so the reading is shown as a plain value instead.
	if (!s.max)
		return E('span', { 'id':'cpu-freq-text', 'class':'cpu-freq-fixed' }, s.freq ? fmtFreq(s.freq) : 'N/A');
	var pct = Math.round(((s.freq-min)/(s.max-min))*100);
	pct = Math.max(0,Math.min(100,pct));
	var bg = s.oc ? 'linear-gradient(90deg,#e65100,#ff9800)' : 'linear-gradient(90deg,#2e7d32,#66bb6a)';
	var label = s.oc ? _('%s MHz (OC)').format(pll) : fmtFreq(s.freq);

	return E('div', { 'id':'cpu-freq-bar-wrap', 'class':'cpu-freq-scale' }, [
		E('span', { 'class':'soc-muted cpu-freq-edge' }, fmtFreq(min)),
		E('div', { 'class':'soc-bar-track cpu-freq-track' }, [
			E('div', { 'id':'cpu-freq-fill', 'style':'background:'+bg+';height:100%;border-radius:4px;width:'+pct+'%;transition:width .5s' }),
			E('span', { 'id':'cpu-freq-text', 'class':'cpu-freq-label' }, label)
		]),
		E('span', { 'id':'cpu-freq-max-label', 'class':'soc-muted cpu-freq-edge' }, fmtFreq(s.max))
	]);
}

function updateFreqBar(hw, min, max, pll, gov) {
	var s = freqBarState(hw,min,max,pll,gov);
	var el = document.getElementById('cpu-freq-text'), fl = document.getElementById('cpu-freq-fill'), ml = document.getElementById('cpu-freq-max-label');
	if (el) el.textContent = s.oc ? _('%s MHz (OC)').format(pll) : fmtFreq(s.freq);
	if (fl && s.max>0) { var pct=Math.max(0,Math.min(100,Math.round(((s.freq-min)/(s.max-min))*100))); fl.style.width=pct+'%'; fl.style.background=s.oc?'linear-gradient(90deg,#e65100,#ff9800)':'linear-gradient(90deg,#2e7d32,#66bb6a)'; }
	if (ml) ml.textContent = fmtFreq(s.max);
}

function offloadBadgeState(enabled, blocked) {
	enabled = isEnabled(enabled);
	blocked = isEnabled(blocked);

	if (blocked && enabled)
		return { cls: 'offload-blocked', text: _('Turn off') };
	if (blocked)
		return { cls: 'offload-blocked', text: _('Disabled in router mode') };

	return enabled
		? { cls: 'offload-on', text: _('Enabled') }
		: { cls: 'offload-off', text: _('Disabled') };
}

function renderOffloadBadge(enabled, id, blocked) {
	var state = offloadBadgeState(enabled, blocked);
	return E('span', {
		'id': id,
		'class': 'offload-badge ' + state.cls
	}, state.text);
}

function updateOffloadControl(selectId, badgeId, enabled, blocked) {
	enabled = isEnabled(enabled);
	blocked = isEnabled(blocked);

	var sel = document.getElementById(selectId);
	if (sel) {
		sel.setAttribute('data-blocked', blocked ? '1' : '0');
		if (!sel.matches(':focus'))
			sel.checked = enabled;
		sel.disabled = blocked && !enabled;
	}

	var b = document.getElementById(badgeId);
	if (b) {
		var state = offloadBadgeState(enabled, blocked);
		b.className = 'offload-badge ' + state.cls;
		b.textContent = state.text;
	}

	var label = sel ? sel.closest('label') : null;
	if (label)
		label.title = blocked
			? (enabled ? _('Recommended to turn off in router mode') : _('Router mode uses hardware flow offloading'))
			: (enabled ? _('Click to disable') : _('Click to enable'));
}

function renderOffloadSelect(enabled, id, callFn, badgeId, blocked) {
	enabled = isEnabled(enabled);
	blocked = isEnabled(blocked);
	var toggle = E('input', {
		'id': id,
		'type': 'checkbox',
		'class': 'npu-toggle-input',
		'change': function(ev) {
			var val = ev.target.checked ? 1 : 0;
			var currentBlocked = ev.target.getAttribute('data-blocked') === '1';
			if (currentBlocked && val === 1) {
				ev.target.checked = false;
				ui.addNotification(null, E('p', {}, _('In router mode, use hardware flow offloading only')), 'warning');
				return;
			}
			ev.target.disabled = true;
			callFn(val).then(function(r) {
				ev.target.disabled = false;
				if (r && r.error) {
					ev.target.checked = !val;
					ui.addNotification(null, E('p', {}, _('Error:') + ' ' + r.error), 'error');
				} else {
					updateOffloadControl(id, badgeId, val, currentBlocked);
				}
			}).catch(function() {
				ev.target.checked = !val;
				ev.target.disabled = false;
			});
		}
	});
	toggle.checked = enabled;
	toggle.disabled = blocked && !enabled;
	toggle.setAttribute('data-blocked', blocked ? '1' : '0');
	return E('div', { 'class': 'offload-controls' }, [
		E('label', {
			'class': 'npu-toggle',
			'title': blocked
				? (enabled ? _('Recommended to turn off in router mode') : _('Router mode uses hardware flow offloading'))
				: (enabled ? _('Click to disable') : _('Click to enable'))
		}, [
			toggle,
			E('span', { 'class': 'npu-toggle-track' })
		]),
		renderOffloadBadge(enabled, badgeId, blocked)
	]);
}

/* ── Reusable CPU info builders (used by initial render AND live updates) ── */
function buildCpuInfoContent(st) {
	var out = [];
	if (st.cpu_model) {
		out.push(E('span',{'style':'font-weight:600'}, st.cpu_model));
		out.push(E('span',{'style':'color:#999'}, '·'));
	}
	out.push(E('span',{}, _('%d cores').format(st.cpu_count||0)));
	return out;
}

/* ── Main View ── */
return view.extend({
	load: function() {
		// Progressive rendering: don't block on RPC calls, let the page render immediately
		return Promise.resolve([]);
	},

	render: function(data) {
		data = data || [];
		injectCSS();
		var st = data[0]||{}, ti = data[1]||{}, fe = data[2]||{};
		var vo = data[3]||{enabled:0}, ppo = data[4]||{enabled:0}, flo = data[5]||{enabled:0};
		var apo = data[6]||{enabled:0};
		var dm = data[7]||{};
		var bridgeBlocked = isBridgeOffloadBlocked(dm);
		var memR = Array.isArray(st.memory_regions) ? st.memory_regions : [];

		var view = E('div',{'class':'cbi-map npu-dashboard'},[

			// Basic information
			E('div',{'class':'cbi-section npu-section'},[
				E('h3',{},_('Basic Information')),
				E('div',{'class':'cpu-panel-grid'},[
					E('div',{'class':'cpu-panel-card cpu-info'},[
						E('div',{'class':'cpu-panel-title'},_('CPU Info')),
						E('div',{'id':'cpu-info-content','class':'cpu-panel-body cpu-info-line'},buildCpuInfoContent(st))
					]),
					E('div',{'class':'cpu-panel-card cpu-platform'},[
						E('div',{'class':'cpu-panel-title'},_('Platform')),
						E('div',{'id':'cpu-platform-content','class':'cpu-panel-body cpu-panel-value'},(st.cpu_platform||''))
					]),
					E('div',{'class':'cpu-panel-card cpu-arch'},[
						E('div',{'class':'cpu-panel-title'},_('Architecture')),
						E('div',{'id':'cpu-arch-content','class':'cpu-panel-body cpu-panel-value'},(st.cpu_arch||''))
					]),
					E('div',{'class':'cpu-panel-card cpu-frequency'},[
						E('div',{'class':'cpu-panel-title'},_('Current Frequency')),
						E('div',{'id':'cpu-freq-content','class':'cpu-panel-body'},renderFreqBar(st.cpu_hw_freq,st.cpu_min_freq,st.cpu_max_freq,st.pll_freq_mhz,st.cpu_governor))
					])
				])
			]),

			// NPU & Frame Engine (unified)
			E('div',{'class':'cbi-section npu-section'},[
				E('h3',{},_('NPU & Offload Engine')),
				renderNpuSummary(st),
				E('div',{'class':'offload-row'},[
				E('div',{'class':'offload-item'},[
					E('span',{'class':'offload-name'},[
						E('span',{'class':'offload-dot'}),
						E('span',{'class':'soc-text'},_('VLAN Tag Offload'))
					]),
					renderOffloadSelect(vo.enabled, 'vlan-offload-select', function(v){return callSetVlanOffload(v);}, 'vlan-offload-badge', bridgeBlocked)
				]),
				E('div',{'class':'offload-item'},[
					E('span',{'class':'offload-name'},[
						E('span',{'class':'offload-dot'}),
						E('span',{'class':'soc-text'},_('PPPoE Passthrough Offload'))
					]),
					renderOffloadSelect(ppo.enabled, 'pppoe-offload-select', function(v){return callSetPppoeOffload(v);}, 'pppoe-offload-badge', bridgeBlocked)
				]),
				E('div',{'class':'offload-item'},[
					E('span',{'class':'offload-name'},[
						E('span',{'class':'offload-dot'}),
						E('span',{'class':'soc-text'},_('Hardware Flow Offloading'))
					]),
					renderOffloadSelect(flo.enabled, 'flow-offload-select', function(v){return callSetFlowOffload(v);}, 'flow-offload-badge', false)
				]),
				E('div',{'class':'offload-item'},[
					E('span',{'class':'offload-name'},[
						E('span',{'class':'offload-dot'}),
						E('span',{'class':'soc-text'},_('AP Mode Acceleration'))
					]),
					renderOffloadSelect(apo.enabled, 'apmode-offload-select', function(v){return callSetApModeOffload(v);}, 'apmode-offload-badge', bridgeBlocked)
				])
			]),

				// Frame Engine diagram (includes WiFi bands, PPE flows, NPU indicator)
				E('div',{'style':'margin-top:12px'},[ E('h4',{'class':'soc-text','style':'margin-bottom:8px'},_('Frame Engine'))]),
				E('div',{'id':'fe-container','class':'npu-frame-wrap'}, renderFeDiagram(fe, ti, st))
			])
		]);

		// Data fetch + DOM update function — called immediately and via poll
		// Each RPC call is wrapped with .catch() so one failure doesn't block others
		function _safeCall(promise, fallback) {
			return promise.catch(function() { return fallback; });
		}

		var fetchData = L.bind(function() {
			return Promise.all([
				_safeCall(callNpuStatus(), {}),
				_safeCall(callTokenInfo(), {}),
				_safeCall(callFrameEngine(), {}),
				_safeCall(callGetVlanOffload(), {enabled:0}),
				_safeCall(callGetPppoeOffload(), {enabled:0}),
				_safeCall(callGetFlowOffload(), {enabled:0}),
				_safeCall(callGetApModeOffload(), {enabled:0}),
				_safeCall(callGetDeviceMode(), {bridge_offload_blocked:false})
			]).then(L.bind(function(d) {
				injectCSS();
				var st=d[0]||{}, ti=d[1]||{}, fe=d[2]||{};
				var vo=d[3]||{enabled:0}, ppo=d[4]||{enabled:0}, flo=d[5]||{enabled:0};
				var apo=d[6]||{enabled:0};
				var dm=d[7]||{};
				var bridgeBlocked = isBridgeOffloadBlocked(dm);
				updateNpuSummary(st);

				// CPU info — always re-render (just text spans, no user interaction)
				var ci = document.getElementById('cpu-info-content');
				if (ci) { ci.innerHTML = ''; buildCpuInfoContent(st).forEach(function(el) { if (el) ci.appendChild(el); }); }

				// Platform and architecture — fixed for the life of the boot, but
				// the first paint happens before the RPC answers, so fill them in.
				var cp = document.getElementById('cpu-platform-content');
				if (cp) cp.textContent = st.cpu_platform||'';
				var ca = document.getElementById('cpu-arch-content');
				if (ca) ca.textContent = st.cpu_arch||'';

				// Freq bar — update in-place if elements exist, otherwise re-render container
				var freqText = document.getElementById('cpu-freq-text');
				if (freqText) {
					updateFreqBar(st.cpu_hw_freq,st.cpu_min_freq,st.cpu_max_freq,st.pll_freq_mhz,st.cpu_governor);
				} else {
					var fc = document.getElementById('cpu-freq-content');
					if (fc) { fc.innerHTML = ''; fc.appendChild(renderFreqBar(st.cpu_hw_freq,st.cpu_min_freq,st.cpu_max_freq,st.pll_freq_mhz,st.cpu_governor)); }
				}

				updateOffloadControl('vlan-offload-select', 'vlan-offload-badge', vo.enabled, bridgeBlocked);
				updateOffloadControl('pppoe-offload-select', 'pppoe-offload-badge', ppo.enabled, bridgeBlocked);
				updateOffloadControl('flow-offload-select', 'flow-offload-badge', flo.enabled, false);
				updateOffloadControl('apmode-offload-select', 'apmode-offload-badge', apo.enabled, bridgeBlocked);

				var fcEl=document.getElementById('fe-container'); if(fcEl){fcEl.innerHTML='';fcEl.appendChild(renderFeDiagram(fe, ti, st));}

							},this)).catch(function(err) {
				console.error('[airoha_manager] fetchData error:', err);
			});
		}, this);

		// Fetch data immediately (page shows with defaults, then updates)
		fetchData();
		// Poll for periodic updates
		poll.add(fetchData, 5);

		return view;
	},

	handleSaveApply: null, handleSave: null, handleReset: null
});
