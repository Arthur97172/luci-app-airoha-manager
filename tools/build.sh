#!/bin/bash
# Build luci-app-airoha-manager with the local Airoha an7581 SDK and install
# nothing: the .apk files it produces are what a device takes with
#   apk add --allow-untrusted ./luci-app-airoha-manager-*.apk
#
#   bash tools/build.sh [sdk-dir]
#
# The package is linked into the SDK rather than copied, so the SDK always
# builds the tree in this repository. luci.mk's install recipe copies htdocs/
# and root/ only, so nothing else in the directory (CLAUDE.MD included) can
# reach the package.
set -uo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK="${1:-${SDK:-/home/arthur/owrt/openwrt-sdk-airoha-an7581_gcc-14.4.0_musl.Linux-x86_64}}"
PKG="luci-app-airoha-manager"
I18N="luci-i18n-airoha-manager-zh-cn"

[ -d "$SDK" ] || { echo "no SDK at $SDK" >&2; exit 1; }
[ -f "$SDK/feeds/luci/luci.mk" ] || { echo "no luci feed in $SDK" >&2; exit 1; }

echo "### [1/4] linking $PKG into the SDK"
ln -sfn "$SRC" "$SDK/package/$PKG"
ls -l "$SDK/package/$PKG"

cd "$SDK" || exit 1

echo "### [2/4] enabling the package"
grep -qxF "CONFIG_PACKAGE_${PKG}=m" .config || echo "CONFIG_PACKAGE_${PKG}=m" >> .config

echo "### [3/4] defconfig"
make defconfig >/dev/null 2>&1
if grep -q "CONFIG_PACKAGE_${PKG}=m" .config; then
	echo "    ok   CONFIG_PACKAGE_${PKG}=m"
else
	echo "    FAIL CONFIG_PACKAGE_${PKG} is not set after defconfig" >&2
	exit 1
fi

echo "### [4/4] compile"
# luci-i18n-* is not a prompted kconfig symbol: luci.mk declares every
# translation HIDDEN, so its Config.in entry is a bare "tristate" whose value
# kconfig derives from "default LUCI_LANG_zh_Hans||(ALL&&m)". A line written
# into .config for it is discarded on the next kconfig run, and setting
# LUCI_LANG_zh_Hans would turn on the zh-cn translation of every other selected
# LuCI application as well. Passing the single symbol on the command line
# overrides .config for this invocation and propagates to the package
# sub-make, so exactly this package's catalog is built.
make "package/${PKG}/compile" "CONFIG_PACKAGE_${I18N}=m" -j"$(nproc)" 2>&1 | tail -n 20

echo
echo "### artifacts"
find bin -type f \( -name "${PKG}-*.apk" -o -name "${I18N}-*.apk" \) -printf '%p  (%s bytes)\n' 2>/dev/null | sort
