#!/bin/bash
# Test harness for luci-app-airoha-manager.
#
#   bash tools/test.sh
#
# Covers the merged package as it will be built:
#
#   layout   file modes, the Makefile's include-time blocks, no dead install
#   backend  shell syntax, the inlined hardware helpers, every advertised method
#   views    syntax, no hardcoded Chinese, one rpcd object
#   menu     menu.d/acl.d parse, every view path exists, every granted method
#            is one the backend actually declares
#   i18n     .pot/.po/source agree, every msgid is translated, po2lmo compiles
#   artifact the .apk the SDK produced, when there is one
#
# The three defects the merge had to fix and that must not come back:
#   F1  the dead Package/.../install block and the 664 file modes
#   F2  the fatal "." of a nonexistent airoha-common.sh, and the three helpers
#       that used to come from it
#   F3  conffiles/postinst/prerm defined after "include luci.mk"
set -uo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$SRC/root/usr/libexec/rpcd/luci.airoha_manager"
MAKEFILE="$SRC/Makefile"
VIEWS="$SRC/htdocs/luci-static/resources/view/airoha_manager"
SDK="${SDK:-/home/arthur/owrt/openwrt-sdk-airoha-an7581_gcc-14.4.0_musl.Linux-x86_64}"
WORK="$(mktemp -d /tmp/airoha-mgr-test.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

pass=0; fail=0; skip=0
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; [ $# -gt 1 ] && printf '        %s\n' "$2"; fail=$((fail+1)); }
skip_() { printf '  \033[33mSKIP\033[0m  %s\n' "$1"; skip=$((skip+1)); }
chk()  { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "expected [$2] got [$3]"; fi; }
head_() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

is_json() { python3 -c 'import json,sys
try:
    json.loads(sys.stdin.read())
except Exception:
    sys.exit(1)' 2>/dev/null; }

jq_() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)" 2>/dev/null; }

# --------------------------------------------------------------------------
head_ "Layout: file modes"

for f in root/etc/init.d/fan \
         root/etc/init.d/npu-jitter \
         root/usr/libexec/npu-jitter-daemon \
         root/usr/libexec/rpcd/luci.airoha_manager \
         root/etc/uci-defaults/30-luci-app-airoha-manager; do
	chk "$f is 755" "755" "$(stat -c '%a' "$SRC/$f" 2>/dev/null)"
done

for f in LICENSE Makefile \
         root/etc/config/fan \
         root/etc/config/npu-monitor \
         root/lib/upgrade/keep.d/luci-app-airoha-manager \
         root/usr/share/luci/menu.d/luci-app-airoha-manager.json \
         root/usr/share/rpcd/acl.d/luci-app-airoha-manager.json \
         htdocs/luci-static/resources/view/airoha_manager/npu.js \
         htdocs/luci-static/resources/view/airoha_manager/flowsense.js \
         htdocs/luci-static/resources/view/airoha_manager/fan_status.js \
         htdocs/luci-static/resources/view/airoha_manager/fan_settings.js \
         po/templates/luci-app-airoha-manager.pot \
         po/zh_Hans/luci-app-airoha-manager.po \
         tools/check-i18n.js; do
	chk "$f is 644" "644" "$(stat -c '%a' "$SRC/$f" 2>/dev/null)"
done

# The token file must never reach the repository.
if [ -f "$SRC/CLAUDE.MD" ] && ! grep -qx 'CLAUDE.MD' "$SRC/.gitignore" 2>/dev/null; then
	bad "CLAUDE.MD is gitignored"
else
	ok "CLAUDE.MD is gitignored"
fi

# --------------------------------------------------------------------------
head_ "Makefile: include-time blocks"

if grep -q 'Package/\$(LUCI_NAME)/install' "$MAKEFILE"; then
	bad "no Package/\$(LUCI_NAME)/install block in Makefile"
else
	ok "no Package/\$(LUCI_NAME)/install block in Makefile"
fi

inc=$(grep -n '^include \$(TOPDIR)/feeds/luci/luci.mk' "$MAKEFILE" | cut -d: -f1)
chk "exactly one include of luci.mk" "1" "$(grep -c '^include \$(TOPDIR)/feeds/luci/luci.mk' "$MAKEFILE")"
chk "luci.mk is the last include" "1" "$(grep -n '^include ' "$MAKEFILE" | tail -1 | cut -d: -f1 | grep -qx "$inc" && echo 1 || echo 0)"

for blk in conffiles postinst prerm; do
	ln=$(grep -n "^define Package/\$(LUCI_NAME)/$blk\$" "$MAKEFILE" | cut -d: -f1)
	if [ -z "$ln" ]; then
		bad "Package/\$(LUCI_NAME)/$blk is defined"
	elif [ "$ln" -lt "$inc" ]; then
		ok "Package/\$(LUCI_NAME)/$blk (line $ln) precedes include (line $inc)"
	else
		bad "Package/\$(LUCI_NAME)/$blk precedes include" "block at $ln, include at $inc"
	fi
done

for key in 'LUCI_NAME:=luci-app-airoha-manager' 'PKG_VERSION:=1.0.1' 'PKG_LICENSE:=GPL-3.0-only' \
           'PKG_LICENSE_FILES:=LICENSE'; do
	if grep -qxF "$key" "$MAKEFILE"; then ok "Makefile declares $key"
	else bad "Makefile declares $key"; fi
done

# PKG_RELEASE is incremented by every commit, so pinning a value here would
# fail the suite on each one. Check the shape the convention calls for instead:
# a single digit, since r10 rolls over into PKG_VERSION and resets this to 1.
rel=$(sed -n 's/^PKG_RELEASE:=\(.*\)$/\1/p' "$MAKEFILE")
case "$rel" in
[1-9]) ok "Makefile declares PKG_RELEASE:=$rel (1-9; r10 rolls into PKG_VERSION)" ;;
*)     bad "PKG_RELEASE is a single digit 1-9" "got '$rel'" ;;
esac

# --------------------------------------------------------------------------
head_ "Backend: structure and syntax"

if grep -n '^\s*\.\s*/usr/libexec/rpcd/airoha-common\.sh' "$BACKEND"; then
	bad "backend does not source airoha-common.sh"
else
	ok "backend does not source airoha-common.sh"
fi

chk "backend sources exactly one file (/lib/functions.sh)" "1" "$(grep -c '^\s*\. ' "$BACKEND")"

for fn in _devmem_read _run_with_deadline _run_hardware_with_deadline; do
	if grep -q "^$fn()" "$BACKEND"; then ok "$fn is defined in the backend"
	else bad "$fn is defined in the backend"; fi
done

# Every helper the three originals sourced from airoha-common.sh must now be
# inlined, or the pages go blank again. The header comment explains that
# history and is allowed to name the file; no executable line may.
refs=$(grep -v '^[[:space:]]*#' "$BACKEND" | grep -c 'airoha-common')
chk "no executable reference to airoha-common.sh" "0" "$refs"

for f in "$BACKEND" \
         "$SRC/root/etc/init.d/fan" \
         "$SRC/root/etc/init.d/npu-jitter" \
         "$SRC/root/usr/libexec/npu-jitter-daemon" \
         "$SRC/root/etc/uci-defaults/30-luci-app-airoha-manager"; do
	if dash -n "$f" 2>/dev/null; then ok "dash -n $(basename "$f")"; else bad "dash -n $(basename "$f")"; fi
	if busybox ash -n "$f" 2>/dev/null; then ok "ash -n $(basename "$f")"; else bad "ash -n $(basename "$f")"; fi
done

# --------------------------------------------------------------------------
# Helper unit tests. The helper block is extracted from the real backend so the
# tests exercise the shipped code rather than a copy of it.
head_ "Backend: helper behaviour"

sed -n '/^# --- Hardware access helpers/,/^# Copy debugfs counters/p' "$BACKEND" | sed '$d' > "$WORK/helpers.sh"
if [ -s "$WORK/helpers.sh" ]; then
	ok "extracted helper block ($(wc -l < "$WORK/helpers.sh") lines)"
else
	bad "extracted helper block"
fi

# Two PATHs. bin-full is prepended to the real PATH, so everything works and
# timeout(1) is found. bin-notimeout replaces PATH entirely and holds only the
# handful of utilities the helpers need, so timeout(1) is genuinely absent and
# the watchdog branch is the one that runs.
mkdir -p "$WORK/bin-full" "$WORK/bin-notimeout"
printf '#!/bin/sh\necho 0x1FA202B4\n' > "$WORK/bin-full/devmem"
chmod 755 "$WORK/bin-full/devmem"
cp "$WORK/bin-full/devmem" "$WORK/bin-notimeout/devmem"
for b in sleep cat rm true; do
	ln -sf "$(command -v $b)" "$WORK/bin-notimeout/$b" || bad "no $b on host"
done

# busybox is a single binary; "$sh -c" cannot express "busybox ash", so wrap it.
printf '#!/bin/sh\nexec busybox ash "$@"\n' > "$WORK/ash"
chmod 755 "$WORK/ash"
PATH_FULL="$WORK/bin-full:$PATH"
PATH_NOTIMEOUT="$WORK/bin-notimeout"

run_suite() { # run_suite <shell> <path> <label>
	local sh="$1" path="$2" label="$3" out st ref
	printf '  -- %s --\n' "$label"
	rm -f /tmp/luci-airoha-manager.*.out

	# _devmem_read must return exactly what a direct devmem call returns, width
	# argument and all. Under busybox ash devmem is an applet, so it shadows the
	# PATH stub and both sides fail the same way; that is still the contract
	# under test.
	ref=$("$sh" -c "PATH=$path; devmem 0x1fa202b4 32 2>/dev/null")
	out=$("$sh" -c "PATH=$path; . $WORK/helpers.sh; _devmem_read 0x1fa202b4")
	chk "$label _devmem_read mirrors a direct devmem call" "$ref" "$out"

	# Unavailable: silent failure, so callers can test with [ -n "$value" ].
	"$sh" -c "PATH=/nonexistent; . $WORK/helpers.sh; _devmem_read 0x1fa202b4" >"$WORK/o" 2>&1
	st=$?
	if [ "$st" -ne 0 ]; then ok "$label _devmem_read unavailable -> nonzero ($st)"
	else bad "$label _devmem_read unavailable -> nonzero" "got 0"; fi
	chk "$label _devmem_read unavailable -> no output" "" "$(cat "$WORK/o")"

	# deadline: command finishes in time
	"$sh" -c "PATH=$path; . $WORK/helpers.sh; _run_with_deadline 5 tag true" >/dev/null 2>&1
	chk "$label _run_with_deadline fast -> exit 0" "0" "$?"

	# deadline: command overruns
	"$sh" -c "PATH=$path; . $WORK/helpers.sh; _run_with_deadline 1 tag sleep 30" >/dev/null 2>&1
	st=$?
	if [ "$st" -ne 0 ]; then ok "$label _run_with_deadline overrun -> nonzero ($st)"
	else bad "$label _run_with_deadline overrun -> nonzero" "got 0"; fi

	# deadline: output passes through
	out=$("$sh" -c "PATH=$path; . $WORK/helpers.sh; _run_with_deadline 5 tag echo hello")
	chk "$label _run_with_deadline passes stdout" "hello" "$out"

	# hardware deadline: function completes
	out=$("$sh" -c "PATH=$path; . $WORK/helpers.sh; f() { printf '{\"a\":1}'; }; _run_hardware_with_deadline 5 t f")
	st=$?
	chk "$label _run_hardware_with_deadline fast -> exit 0" "0" "$st"
	chk "$label _run_hardware_with_deadline fast -> stdout" '{"a":1}' "$out"

	# hardware deadline: function overruns -> no partial JSON, nonzero
	out=$("$sh" -c "PATH=$path; . $WORK/helpers.sh; f() { printf '{\"a\":'; sleep 30; printf '1}'; }; _run_hardware_with_deadline 1 t f" 2>/dev/null)
	st=$?
	if [ "$st" -ne 0 ]; then ok "$label _run_hardware_with_deadline overrun -> nonzero ($st)"
	else bad "$label _run_hardware_with_deadline overrun -> nonzero" "got 0"; fi
	chk "$label _run_hardware_with_deadline overrun -> no partial output" "" "$out"

	# hardware deadline: function fails -> nonzero, no output
	out=$("$sh" -c "PATH=$path; . $WORK/helpers.sh; f() { printf '{\"a\":1}'; return 3; }; _run_hardware_with_deadline 5 t f" 2>/dev/null)
	st=$?
	if [ "$st" -ne 0 ]; then ok "$label _run_hardware_with_deadline failure -> nonzero ($st)"
	else bad "$label _run_hardware_with_deadline failure -> nonzero" "got 0"; fi
	chk "$label _run_hardware_with_deadline failure -> no output" "" "$out"

	# no leftover temp files
	left=$(find /tmp -maxdepth 1 -name 'luci-airoha-manager.*.out' 2>/dev/null | wc -l)
	chk "$label no leftover temp files" "0" "$left"
}

run_suite dash "$PATH_FULL" "dash, timeout(1) present"
run_suite "$WORK/ash" "$PATH_FULL" "ash, timeout(1) present"
run_suite dash "$PATH_NOTIMEOUT" "dash, no timeout(1) (watchdog path)"
run_suite "$WORK/ash" "$PATH_NOTIMEOUT" "ash, no timeout(1) (watchdog path)"

# --------------------------------------------------------------------------
# End-to-end: run the actual backend. /lib/functions.sh is device-only and the
# backend references nothing from it, so it is stubbed; that one path is the
# only edit, and it is not the line under test.
head_ "Backend: end-to-end"

mkdir -p "$WORK/root/lib"
: > "$WORK/root/lib/functions.sh"
sed "s#^\. /lib/functions\.sh\$#. $WORK/root/lib/functions.sh#" "$BACKEND" > "$WORK/root/backend"
chmod 755 "$WORK/root/backend"
chk "only /lib/functions.sh was rewritten" "2" "$(diff "$BACKEND" "$WORK/root/backend" | grep -c '^[<>]')"

rm -f /tmp/luci-airoha-manager.*.json /tmp/luci-airoha-manager.*.json.lock

run_backend() { # run_backend <args...>
	PATH="$PATH_FULL" timeout 30 "$WORK/root/backend" "$@" </dev/null 2>/dev/null
}

out=$(run_backend list)
chk "list -> exit 0" "0" "$?"
if printf '%s' "$out" | is_json; then ok "list -> valid JSON"; else bad "list -> valid JSON" "$out"; fi

nmethods=$(printf '%s' "$out" | jq_ 'len(d)')
chk "list -> 34 methods" "34" "$nmethods"

# Every method the list advertises must be dispatchable and must emit JSON.
methods=$(printf '%s' "$out" | jq_ '" ".join(d)')
for m in $methods; do
	o=$(run_backend call "$m"); st=$?
	if [ "$st" -ne 0 ]; then
		bad "call $m -> exit 0" "got $st"
	elif printf '%s' "$o" | is_json; then
		ok "call $m -> valid JSON"
	else
		bad "call $m -> valid JSON" "$o"
	fi
done

# The three pages each need their own group of methods present.
for m in getOverview getPpeSummary getPpeEntries getFrameEngine getTokenInfo \
         getWifiStats getBridgeStats getConflictAlerts getEthStats getJitterResult \
         getFanStatus getFanCurve getAllCurves \
         setGovernor setMaxFreq setFanMode setManualPwm setFanPreset setCustomCurve; do
	if printf '%s' "$methods" | grep -qw "$m"; then ok "list advertises $m"
	else bad "list advertises $m"; fi
done

o=$(run_backend call noSuchMethod)
chk "call noSuchMethod -> error JSON" '{"error":"Invalid method"}' "$o"

# The decisive regression: with airoha-common.sh absent (it is, on this host),
# the backend must still register its methods. Before the fix it exited 2 here.
if [ ! -e /usr/libexec/rpcd/airoha-common.sh ]; then
	o=$(run_backend list)
	if printf '%s' "$o" | is_json; then
		ok "backend survives with airoha-common.sh absent"
	else
		bad "backend survives with airoha-common.sh absent" "$o"
	fi
fi

rm -f /tmp/luci-airoha-manager.*.json /tmp/luci-airoha-manager.*.json.lock

# --------------------------------------------------------------------------
head_ "Views: syntax and i18n hygiene"

for f in npu flowsense fan_status fan_settings; do
	if node --check "$VIEWS/$f.js" 2>/dev/null; then ok "node --check $f.js"
	else bad "node --check $f.js" "$(node --check "$VIEWS/$f.js" 2>&1 | head -3)"; fi

	cjk=$(grep -cP '[\x{4e00}-\x{9fff}]' "$VIEWS/$f.js" 2>/dev/null)
	chk "$f.js has no hardcoded Chinese" "0" "$cjk"

	# Every rpcd object a view declares must be the merged one; a leftover
	# luci.airoha_npu / luci.airoha_flowsense / luci.fan would 404 at runtime.
	bad_obj=$(grep -o "luci\.\(airoha_npu\|airoha_flowsense\|fan\)" "$VIEWS/$f.js" | sort -u | tr '\n' ' ')
	chk "$f.js declares only luci.airoha_manager" "" "$bad_obj"

	decl=$(grep -c 'luci\.airoha_manager' "$VIEWS/$f.js")
	if [ "$decl" -ge 1 ]; then ok "$f.js talks to luci.airoha_manager ($decl refs)"
	else bad "$f.js talks to luci.airoha_manager"; fi
done

# Splitting the Fan Control view must leave no orphan behind: the directory
# holds exactly the four views the menu names.
chk "view directory holds exactly 4 views" \
	"fan_settings.js fan_status.js flowsense.js npu.js" \
	"$(ls "$VIEWS" | sort | tr '\n' ' ' | sed 's/ $//')"

# --------------------------------------------------------------------------
head_ "Menu and ACL descriptors"

MENU="$SRC/root/usr/share/luci/menu.d/luci-app-airoha-manager.json"
ACL="$SRC/root/usr/share/rpcd/acl.d/luci-app-airoha-manager.json"

for f in "$MENU" "$ACL"; do
	if python3 -m json.tool "$f" >/dev/null 2>&1; then ok "$(basename "$f") parses"
	else bad "$(basename "$f") parses"; fi
done

# Every "view" action must resolve to a file that ships. A view path is
# relative to htdocs/luci-static/resources/view/.
for p in $(jq_ '" ".join(v["action"]["path"] for v in d.values() if v.get("action",{}).get("type")=="view")' < "$MENU"); do
	if [ -f "$SRC/htdocs/luci-static/resources/view/$p.js" ]; then ok "menu view $p exists"
	else bad "menu view $p exists"; fi
done

# Four view nodes: the two leaf tabs, and the two halves of Fan Control. The
# Fan Control node itself is a firstchild, so it carries no view.
chk "menu declares 4 views" "4" "$(jq_ 'sum(1 for v in d.values() if v.get("action",{}).get("type")=="view")' < "$MENU")"

# The three top-level tabs and the two Fan Control sub-tabs are counted
# separately: the direct children of the menu root, then the children one level
# below it. Fan Control itself is a firstchild node, so it carries no view.
chk "fan node is a firstchild" "firstchild" \
	"$(jq_ 'd["admin/services/airoha-manager/fan"]["action"]["type"]' < "$MENU")"

# The three top-level titles are the ones the spec fixes, in the order the menu
# shows them (the "order" field, not the node name).
chk "menu tab order and titles" \
	"NPU Status|FlowSense|Fan Control" \
	"$(jq_ '"|".join(d[k]["title"] for k in sorted([k for k in d if k.startswith("admin/services/airoha-manager/") and k.count("/") == 3], key=lambda k: d[k]["order"]))' < "$MENU")"

chk "fan sub-tab order and titles" \
	"Status|Settings" \
	"$(jq_ '"|".join(d[k]["title"] for k in sorted([k for k in d if k.startswith("admin/services/airoha-manager/fan/") and k.count("/") == 4], key=lambda k: d[k]["order"]))' < "$MENU")"

# The two sub-tabs must resolve to the two halves of the old single view.
chk "fan sub-tab view paths" \
	"airoha_manager/fan_status|airoha_manager/fan_settings" \
	"$(jq_ '"|".join(d[k]["action"]["path"] for k in sorted([k for k in d if k.startswith("admin/services/airoha-manager/fan/")], key=lambda k: d[k]["order"]))' < "$MENU")"

# Every method the ACL grants must be one the backend declares. A grant for a
# method that does not exist is a silently dead permission; a method with no
# grant is a 403 in the browser.
printf '%s' "$methods" | tr ' ' '\n' | sort > "$WORK/backend.methods"
{
	jq_ '" ".join(d["luci-app-airoha-manager"]["read"]["ubus"]["luci.airoha_manager"])' < "$ACL"
	jq_ '" ".join(d["luci-app-airoha-manager"]["write"]["ubus"]["luci.airoha_manager"])' < "$ACL"
} | tr ' ' '\n' | sort -u > "$WORK/acl.methods"

extra=$(comm -23 "$WORK/acl.methods" "$WORK/backend.methods" | tr '\n' ' ')
chk "ACL grants no method the backend lacks" "" "$extra"

ungranted=$(comm -13 "$WORK/acl.methods" "$WORK/backend.methods" | tr '\n' ' ')
chk "every backend method is granted read or write" "" "$ungranted"

chk "ACL registers both uci configs" "fan npu-monitor" \
	"$(jq_ '" ".join(sorted(d["luci-app-airoha-manager"]["read"]["uci"]))' < "$ACL")"

# --------------------------------------------------------------------------
head_ "i18n"

if node "$SRC/tools/check-i18n.js" > "$WORK/i18n.log" 2>&1; then
	ok "tools/check-i18n.js: sources, .pot and .po agree"
else
	bad "tools/check-i18n.js" "$(tail -5 "$WORK/i18n.log")"
fi

POT="$SRC/po/templates/luci-app-airoha-manager.pot"
PO="$SRC/po/zh_Hans/luci-app-airoha-manager.po"

npot=$(grep -c '^msgid "' "$POT"); npot=$((npot-1))   # minus the header entry
npo=$(grep -c '^msgid "' "$PO"); npo=$((npo-1))
chk ".pot entry count matches .po" "$npot" "$npo"

empty=$(grep -c '^msgstr ""$' "$PO"); empty=$((empty-1))  # minus the header
chk "every .po entry is translated" "0" "$empty"

# The titles the spec fixes by name, plus the two Fan Control sub-tabs and the
# conflict-alert strings. The alerts matter because the rpcd backend composes
# them in English, so the scanner only ever sees them through the literals the
# FlowSense view now carries; pin the reported one end to end.
for pair in 'Airoha Manager|Airoha管理中心' 'NPU Status|NPU状态' \
            'FlowSense|流程传感器' 'Fan Control|风扇控制' \
            'Status|状态' 'Settings|设置' \
            'Ghost Shaper Active|CAKE 整形器被绕过' \
            'Physical Bottleneck|物理层瓶颈' \
            'NPU Bypass Detected|检测到 NPU 旁路' \
            'HW offload is enabled but ISP latency is high. Latency management may be skipped by hardware acceleration.|已启用硬件卸载，但 ISP 延迟偏高。硬件加速可能会跳过延迟管理。'; do
	id=${pair%%|*}; want=${pair##*|}
	got=$(python3 - "$PO" "$id" <<'PY'
import re, sys
po = open(sys.argv[1], encoding='utf-8').read().split('\n')
key = '"%s"' % sys.argv[2]
for i, l in enumerate(po):
    if l == 'msgid ' + key:
        m = re.match(r'^msgstr "(.*)"$', po[i+1])
        print(m.group(1) if m else '')
        break
PY
)
	chk "zh_Hans \"$id\" -> \"$want\"" "$want" "$got"
done

PO2LMO="$SDK/staging_dir/hostpkg/bin/po2lmo"
if [ -x "$PO2LMO" ]; then
	if "$PO2LMO" "$PO" "$WORK/zh-cn.lmo" >/dev/null 2>&1 && [ -s "$WORK/zh-cn.lmo" ]; then
		ok "po2lmo compiles the zh_Hans catalog ($(stat -c %s "$WORK/zh-cn.lmo") bytes)"
		if strings -e S "$WORK/zh-cn.lmo" | grep -q 'Airoha管理中心'; then
			ok "compiled catalog carries the translated menu title"
		else
			bad "compiled catalog carries the translated menu title"
		fi
	else
		bad "po2lmo compiles the zh_Hans catalog"
	fi
else
	skip_ "no po2lmo at $PO2LMO"
fi

# --------------------------------------------------------------------------
# Artifact: unpack the package the SDK actually produced and check what will
# land on the device. Skipped when the package has not been built.
head_ "Artifact: built package contents"

APKBIN="$SDK/staging_dir/host/bin/apk"
APK=$(ls "$SDK"/bin/packages/*/base/luci-app-airoha-manager-*.apk 2>/dev/null | head -1)
I18N=$(ls "$SDK"/bin/packages/*/base/luci-i18n-airoha-manager-zh-cn-*.apk 2>/dev/null | head -1)

if [ -z "$APK" ]; then
	skip_ "no built package (build it first)"
elif [ ! -x "$APKBIN" ]; then
	skip_ "no host apk tool at $APKBIN"
else
	ok "found $(basename "$APK")"
	EXT="$WORK/extract"
	mkdir -p "$EXT"
	"$APKBIN" --allow-untrusted extract --no-chown --destination "$EXT" "$APK" >/dev/null 2>&1

	for f in etc/init.d/fan etc/init.d/npu-jitter usr/libexec/npu-jitter-daemon \
	         usr/libexec/rpcd/luci.airoha_manager etc/uci-defaults/30-luci-app-airoha-manager; do
		chk "packaged $f is 755" "755" "$(stat -c '%a' "$EXT/$f" 2>/dev/null)"
	done
	for f in etc/config/fan etc/config/npu-monitor \
	         www/luci-static/resources/view/airoha_manager/npu.js \
	         www/luci-static/resources/view/airoha_manager/flowsense.js \
	         www/luci-static/resources/view/airoha_manager/fan_status.js \
	         www/luci-static/resources/view/airoha_manager/fan_settings.js; do
		chk "packaged $f is 644" "644" "$(stat -c '%a' "$EXT/$f" 2>/dev/null)"
	done

	cf="$EXT/lib/apk/packages/luci-app-airoha-manager.conffiles"
	for c in /etc/config/fan /etc/config/npu-monitor; do
		if [ -f "$cf" ] && grep -qx "$c" "$cf"; then ok "$c is registered as a conffile"
		else bad "$c is registered as a conffile" "$(cat "$cf" 2>/dev/null)"; fi
	done

	# postinst/prerm are folded into the generated maintainer scripts.
	dump=$("$APKBIN" adbdump "$APK" 2>/dev/null)
	for cmd in 'fan enable' 'fan start' 'npu-jitter enable' 'npu-jitter start' 'rpcd reload'; do
		if printf '%s' "$dump" | grep -q "$cmd"; then ok "post-install runs: $cmd"
		else bad "post-install runs: $cmd"; fi
	done
	if printf '%s' "$dump" | grep -q 'airoha_fan'; then
		ok "post-install disables the conflicting airoha_fan service"
	else
		bad "post-install disables the conflicting airoha_fan service"
	fi

	# The chmod must precede the first exec of the init scripts, or a device
	# upgrading from the broken build still fails with "Permission denied".
	line_chmod=$(printf '%s' "$dump" | grep -n 'chmod 0755 /etc/init.d/fan' | head -1 | cut -d: -f1)
	line_exec=$(printf '%s' "$dump" | grep -n 'fan enable' | head -1 | cut -d: -f1)
	if [ -n "$line_chmod" ] && [ -n "$line_exec" ] && [ "$line_chmod" -lt "$line_exec" ]; then
		ok "post-install chmods the four files before executing them"
	else
		bad "post-install chmods the four files before executing them" \
			"chmod at ${line_chmod:-none}, exec at ${line_exec:-none}"
	fi
	chmod_cmd=$(printf '%s' "$dump" | sed -n '/chmod 0755 \/etc\/init\.d\/fan/,/2>\/dev\/null/p')
	for f in /etc/init.d/fan /etc/init.d/npu-jitter /usr/libexec/npu-jitter-daemon \
	         /usr/libexec/rpcd/luci.airoha_manager; do
		if printf '%s' "$chmod_cmd" | grep -q -- "$f"; then ok "post-install chmod covers $f"
		else bad "post-install chmod covers $f"; fi
	done

	for cmd in 'fan stop' 'fan disable' 'npu-jitter stop' 'npu-jitter disable'; do
		if printf '%s' "$dump" | grep -q "$cmd"; then ok "pre-deinstall runs: $cmd"
		else bad "pre-deinstall runs: $cmd"; fi
	done

	dep=$(printf '%s' "$dump" | grep -A4 '^  depends:' | grep -c 'TARGET_airoha')
	chk "built package carries no @TARGET_airoha runtime dep (build-time only)" "0" "$dep"

	# The i18n package is built from po/ alone; luci.mk names it after the
	# LC alias, so the file must be luci-app-airoha-manager.zh-cn.lmo.
	if [ -z "$I18N" ]; then
		bad "luci-i18n-airoha-manager-zh-cn was built"
	else
		ok "found $(basename "$I18N")"
		IEXT="$WORK/i18n-extract"
		mkdir -p "$IEXT"
		"$APKBIN" --allow-untrusted extract --no-chown --destination "$IEXT" "$I18N" >/dev/null 2>&1
		lmo="$IEXT/usr/lib/lua/luci/i18n/luci-app-airoha-manager.zh-cn.lmo"
		if [ -s "$lmo" ]; then ok "i18n package ships luci-app-airoha-manager.zh-cn.lmo"
		else bad "i18n package ships luci-app-airoha-manager.zh-cn.lmo" "$(find "$IEXT" -type f | head)"; fi
	fi
fi

# --------------------------------------------------------------------------
head_ "Result"
printf '  %d passed, %d failed, %d skipped\n\n' "$pass" "$fail" "$skip"
[ "$fail" -eq 0 ]
