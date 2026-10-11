'use strict';
'require form';
'require rpc';
'require uci';
'require view';

var callGetAllCurves = rpc.declare({
	object: 'luci.airoha_manager',
	method: 'getAllCurves'
});

var settingsCSS = '\
.fan-settings{--fan-blue:#00c8ff;--fan-green:#00cc44;--fan-amber:#f5a623;--fan-red:#d0021b;padding-bottom:20px}\
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
/* A control-mode row is a two-column grid: label in column one, control in column two. The Curve Preview row below is a full-width block, so the two selects began a third of the way across and read as centred under a chart that spans the whole row. Give the label and the field one full-width row each -- the shape the preview row already has -- and let row-gap supply the gap the grid used to. The row itself keeps display:grid: switching it to block from here would tie with the .hidden rule themes ship and, this sheet being appended to head last, win, leaving depends() rows visible. */\
.fan-settings .fan-control-section .cbi-value>.cbi-value-title,.fan-settings .fan-control-section .cbi-value>.cbi-value-field{grid-column:1/-1}\
.fan-settings .fan-control-section .cbi-value>.cbi-value-field{width:100%}\
.fan-settings .fan-control-section .cbi-value{row-gap:8px}\
.fan-settings .fan-control-section [data-name="_curve_graph"]{display:block;padding:14px 0 0;margin-top:4px;border-top:1px solid var(--fan-border)}\
.fan-settings .fan-control-section [data-name="_curve_graph"] .cbi-value-title{margin-bottom:8px}\
/* Themes right-align the label against its field. With the label on a full-width row of its own that pushes the text to the far right, so pin both to the start of the line, level with the preview label. */\
.fan-settings .fan-control-section .cbi-value-title,.fan-settings .fan-control-section .cbi-value-field{text-align:left}\
.fan-curve-wrap{max-width:none;border:1px solid var(--fan-border);border-left:4px solid var(--fan-blue);border-radius:10px;padding:12px;background:linear-gradient(145deg,var(--fan-input-bg),var(--fan-card-bg));box-shadow:inset 0 0 0 1px rgba(0,200,255,.06)}\
.fan-curve-canvas{display:block;width:100%;height:362px;background:var(--fan-canvas-bg);border:1px solid var(--fan-border);border-radius:7px;box-sizing:border-box}\
.fan-settings .fan-curve-section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px}\
.fan-settings .fan-curve-section>h3,.fan-settings .fan-curve-section>.cbi-section-descr{grid-column:1/-1}\
.fan-settings .fan-curve-section .cbi-value{display:flex!important;flex-direction:column!important;align-items:stretch;gap:8px;width:100%;box-sizing:border-box;padding:14px;border:1px solid var(--fan-border);border-left:3px solid var(--fan-amber);border-radius:9px;background:var(--fan-input-bg);box-shadow:0 2px 8px var(--fan-shadow)}\
.fan-settings .fan-curve-section .cbi-value[data-name$="_pwm"]{border-left-color:var(--fan-blue)}\
.fan-settings .fan-curve-section .cbi-value .cbi-value-title{display:block!important;flex:none!important;float:none!important;width:auto!important;position:static;clear:both;margin:0!important;line-height:1.4;white-space:normal}\
.fan-settings .fan-curve-section .cbi-value .cbi-value-field{display:block!important;flex:none!important;width:100%;position:static;clear:both;margin:0!important}\
.fan-settings .cbi-button{border-radius:7px;font-weight:600;transition:transform .18s,box-shadow .18s}\
.fan-settings .cbi-button:hover{transform:translateY(-1px);box-shadow:0 4px 12px var(--fan-shadow)}\
@media(max-width:760px){.fan-settings .fan-curve-section{grid-template-columns:1fr}.fan-settings .fan-curve-section>h3,.fan-settings .fan-curve-section>.cbi-section-descr{grid-column:auto}}\
@media(max-width:640px){.fan-settings{padding-bottom:12px}.fan-settings .cbi-section{padding:13px;margin:11px 0!important}.fan-settings .cbi-value{display:block;padding:11px 0}.fan-settings .cbi-value-title{display:block;margin-bottom:7px}.fan-settings .cbi-value-field{margin-left:0!important}.fan-settings .fan-curve-section .cbi-value{padding:12px}.fan-curve-canvas{height:280px}}\
/* depends() hides an option by putting the hidden class on its .cbi-value row. The grid rule above and the flex rule further up outrank the .hidden rule several themes ship -- the flex rule even carries !important -- so a depends()-hidden row would stay on screen. Restate the rule here, last in the sheet and with the same weight as the flex rule, so the class alone decides what is visible. */\
.fan-settings .cbi-value.hidden{display:none!important}\
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
	/* The axis tops out at 300 rather than the 255 the hardware takes: the top
	   of the scale is headroom, and six 50-unit bands put a round number on
	   every gridline. The canvas heights in settingsCSS are sized to keep the
	   pixels-per-unit the 255 scale had, so the curve does not shrink as the
	   axis grows: 362px carries 280px of plot for 300 units where 320px
	   carried 238px for 255, and 280px carries 198px where 250px carried 168px
	   (the nearest whole pixel to that rate). Scale and heights move together:
	   change one and the curve stops sitting on the gridlines. */
	var pwmMax = 300;
	var pwmStep = 50;
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
	for (var p = 0; p <= pwmMax; p += pwmStep) {
		var y = height - padding - (p / pwmMax) * (height - 2 * padding);
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
	ctx.fillText(_('Temperature (°C)'), width / 2, height - 5);
	ctx.save();
	ctx.translate(12, height / 2);
	ctx.rotate(-Math.PI / 2);
	ctx.fillText(_('PWM (0-300)'), 0, 0);
	ctx.restore();

	ctx.fillStyle = muted;
	ctx.font = '9px sans-serif';
	ctx.textAlign = 'center';
	for (var t = 0; t <= 100; t += 20) {
		ctx.fillText(t, padding + (t / 100) * (width - 2 * padding), height - padding + 13);
	}
	ctx.textAlign = 'right';
	for (var p = 0; p <= pwmMax; p += pwmStep) {
		ctx.fillText(p, padding - 4, height - padding - (p / pwmMax) * (height - 2 * padding) + 4);
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
			var py = height - padding - (pt.pwm / pwmMax) * (height - 2 * padding);
			idx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
		});
		ctx.stroke();
		if (dots) {
			ctx.fillStyle = color;
			points.forEach(function(pt) {
				var px = padding + (pt.temp / 100) * (width - 2 * padding);
				var py = height - padding - (pt.pwm / pwmMax) * (height - 2 * padding);
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

	/* The legend is one row of colour chips across the top of the plot, above
	   the gridlines: one entry per preset, plus the preview entry while a
	   custom curve is being edited. The labels are translated and the canvas is
	   as wide as the panel, so their widths are measured and the row is laid
	   out from the middle of the plot area, closing the gaps and then shrinking
	   the font when the panel is too narrow to hold it at the usual size. */
	var legend = Object.keys(colors).map(function(preset) {
		return {
			color: colors[preset],
			label: { quiet: _('Quiet'), balanced: _('Balanced'), performance: _('Performance'), custom: _('Custom') }[preset] || preset,
			dim: preset !== activePreset
		};
	});
	if (customPreview)
		legend.push({ color: '#ff6600', label: _('Preview'), dim: false });

	var chip = 12, chipGap = 4;
	var rowGap = 18, rowFont = 10;
	var legendY = 15;
	var avail = width - 2 * padding;

	/* Measured with an identity transform, so the widths come back in the same
	   units as the coordinates below instead of scaled by devicePixelRatio. */
	function measureRow(gap, size) {
		var widths = legend.map(function(item) {
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.font = size + 'px sans-serif';
			var w = ctx.measureText(item.label).width;
			ctx.restore();
			return w;
		});
		var total = 0;
		widths.forEach(function(w, idx) { total += (idx ? gap : 0) + chip + chipGap + w; });
		return { widths: widths, total: total };
	}

	var row = measureRow(rowGap, rowFont);
	while (rowGap > 4 && row.total > avail) {
		rowGap -= 2;
		row = measureRow(rowGap, rowFont);
	}
	while (rowFont > 8 && row.total > avail) {
		rowFont -= 1;
		row = measureRow(rowGap, rowFont);
	}

	ctx.font = rowFont + 'px sans-serif';
	ctx.textAlign = 'left';
	var legendX = padding + Math.max(0, (avail - row.total) / 2);
	legend.forEach(function(item, idx) {
		ctx.globalAlpha = item.dim ? 0.5 : 1;
		ctx.fillStyle = item.color;
		ctx.fillRect(legendX, legendY, chip, chip);
		ctx.globalAlpha = 1;
		ctx.fillStyle = text;
		ctx.fillText(item.label, legendX + chip + chipGap, legendY + (chip + rowFont) / 2 - 1);
		legendX += chip + chipGap + row.widths[idx] + rowGap;
	});
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

/* Everything that has to be redone whenever LuCI rebuilds the form markup:
   the two section class names the stylesheet keys off, and -- inside the
   curve section -- the editor toggle, the canvas and the listeners that
   keep the two in step. Save and Reset both rebuild the map children in
   place without running render() again, so this runs a second time, from
   the handlers at the bottom of this file, against freshly built nodes. */
function decorateSettings(mapNode, curves) {
	mapNode.classList.add('fan-settings');
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
			/* The editor follows the preset alone. Choosing Custom has to
			   reveal it whichever mode is selected, so there is no mode
			   test in this condition. */
			var visible = getCurrentPreset() === 'custom';
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
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('fan'),
			L.resolveDefault(callGetAllCurves(), {})
		]);
	},

	render: function(data) {
		var self = this;
		var curves = data[1] || {};

		injectSettingsCSS();

		var m, s, o;

		m = new form.Map('fan');

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

		/* Deliberately no depends() on the chart: it has to stay on screen for
		   both modes and for every preset, so it is the one row here that never
		   hides. Giving it depends('mode','auto') hid it in manual mode. */
		o = s.option(form.DummyValue, '_curve_graph', _('Curve Preview'));
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
			self.mapNode = mapNode;
			self.curves = curves;
			decorateSettings(mapNode, curves);
			return mapNode;
		});
	},

	/* view.handleSave() runs Map.save(), whose chain ends in renderContents(),
	   and view.handleReset() runs Map.reset(), which is renderContents()
	   itself. Both replace the map children, taking the class names, the
	   canvas and every listener decorateSettings() installed with them --
	   including the toggle that hides the editor, which is why the editor
	   used to surface while Save & Apply re-rendered the form. Put the
	   decoration back on the new nodes once the re-render has settled. */
	handleSave: function(ev) {
		var self = this;
		return Promise.resolve(this.super('handleSave', [ ev ])).then(function() {
			if (self.mapNode) decorateSettings(self.mapNode, self.curves);
		});
	},

	handleReset: function(ev) {
		var self = this;
		return Promise.resolve(this.super('handleReset', [ ev ])).then(function() {
			if (self.mapNode) decorateSettings(self.mapNode, self.curves);
		});
	}
});
