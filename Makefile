# This is free software, licensed under the GNU General Public License v3.

include $(TOPDIR)/rules.mk

LUCI_NAME:=luci-app-airoha-manager
PKG_VERSION:=1.0.0
# 版本约定：每次提交 PKG_RELEASE +1（1.0.0-r1 ~ r9）；
# 达到 r10 时 PKG_VERSION 末位 +1（1.0.0 -> 1.0.1），PKG_RELEASE 重置为 1。
#
# PKG_VERSION is written out above rather than read from a ./VERSION file, so
# "PKG_VERSION 末位 +1" means editing that line and setting this one back to 1.
PKG_RELEASE:=3
PKG_LICENSE:=GPL-3.0-only
PKG_LICENSE_FILES:=LICENSE

# LUCI_MAINTAINER, not PKG_MAINTAINER: luci.mk defines Package/$(PKG_NAME) with
# MAINTAINER:=$(LUCI_MAINTAINER), and that block is evaluated after
# Package/Default's MAINTAINER:=$(PKG_MAINTAINER), so it wins. A PKG_MAINTAINER
# line here would be inert — the field would read "OpenWrt LuCI community".
LUCI_MAINTAINER:=Arthur97172 <Arthur97172@users.noreply.github.com>

LUCI_TITLE:=LuCI Airoha Manager
LUCI_DESCRIPTION:=Airoha management centre for AN7581/W1700K class devices. Combines \
	three pages behind one menu entry: NPU status (NPU/CPU clock, frame engine and \
	hardware offload controls), FlowSense (PPE flow monitoring, WiFi and Ethernet \
	health, conflict alerts) and Fan Control (temperature and fan speed monitoring \
	with automatic or manual speed curves).

# The union of the three dependency sets the merged applications declared.
#
# +luci-base      every JS view in this package needs it: view, form, uci, rpc,
#                 poll and dom all come from luci-base's htdocs.
# +kmod-br-netfilter backs the bridge-nf-* sysctls the VLAN/PPPoE offload toggles
#                 write (bridge-nf-call-iptables, bridge-nf-filter-vlan-tagged,
#                 bridge-nf-filter-pppoe-tagged). Those live under
#                 /proc/sys/net/bridge/, which only exists once br_netfilter is
#                 loaded — the backend modprobes it before writing.
# +luci-compat    carried over from luci-app-airoha-fancontrol, which declared it.
#                 The merged views are all client-side JS and resolve every
#                 module from luci-base, so nothing here needs luci-compat; it is
#                 kept because dropping a declared dependency is a behaviour
#                 change this merge has no reason to make.
#
# @TARGET_airoha restricts the package to the airoha target. The RPC backend
# reads Airoha-specific MMIO through /dev/mem (0x1fa2xxxx PLL, 0x1fb5xxxx
# PSE/GDM/CDM), the airoha-npu platform driver and the NCT7802 fan controller,
# so it is meaningless elsewhere. luci.mk assigns this verbatim to DEPENDS, and
# OpenWrt resolves it against CONFIG_TARGET_airoha, hiding the package on every
# other target.
LUCI_DEPENDS:=+luci-base +kmod-br-netfilter +luci-compat @TARGET_airoha

# Everything below is defined BEFORE luci.mk is included, and there is
# deliberately no install block at all.
#
# luci.mk ends with $(eval $(call BuildPackage,...)), and package-pack.mk expands
# Package/<name>/install there with a single "$" — so the install commands are
# baked into the recipe at include time. An install block written after the
# include is never expanded: it is dead code, silently ignored.
#
# conffiles/postinst/prerm are read by package-pack.mk's BuildPackVariable with
# an `ifdef` that is likewise evaluated at include time, so they too have to come
# before the include — otherwise /etc/config/fan and /etc/config/npu-monitor are
# not registered as conffiles (the fan mode and the ping target are reset on
# every upgrade) and the services are never stopped on removal.
#
# The recipe that actually runs is luci.mk's own: htdocs/ is copied to $(HTDOCS)
# and root/ to / with a mode-preserving `cp -pR`. File modes in the package
# therefore come from this source tree, so anything under root/ that has to be
# executable must be committed as 100755 -- and, because apk never revisits the
# mode of an /etc file whose content already matches the one being installed, a
# mode that was once wrong stays wrong on a device that already has the file.
# root/etc/uci-defaults/ carries the repair for that; see the script itself.

define Package/$(LUCI_NAME)/conffiles
/etc/config/fan
/etc/config/npu-monitor
endef

define Package/$(LUCI_NAME)/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0

# A device that already carries one of the three packages this one replaces can
# still hold a non-executable /etc/init.d file from a release that shipped it
# mode 664: apk treats /etc as a configuration directory, so it keeps a file
# whose content already matches the packaged copy and never corrects its mode.
# default_postinst in lib/functions.sh enables and starts every /etc/init.d/
# file the package installs, and fails there with "Permission denied" on each
# such install. root/etc/uci-defaults/ makes the same repair earlier, before
# that loop; this repeats it for the paths where that did not run.
chmod 0755 /etc/init.d/fan /etc/init.d/npu-jitter \
	/usr/libexec/npu-jitter-daemon \
	/usr/libexec/rpcd/luci.airoha_manager 2>/dev/null

# Enable and start the fan service
/etc/init.d/fan enable 2>/dev/null
/etc/init.d/fan start 2>/dev/null

# Disable and stop the conflicting airoha_fan service if present
if [ -f /etc/init.d/airoha_fan ]; then
	/etc/init.d/airoha_fan stop 2>/dev/null
	/etc/init.d/airoha_fan disable 2>/dev/null
fi

# Enable and start the npu-jitter service
/etc/init.d/npu-jitter enable 2>/dev/null
/etc/init.d/npu-jitter start 2>/dev/null

# Bridge acceleration is opt-in through the NPU page. Remove defaults from
# earlier builds so only firewall hardware flow offload is enabled by default.
rm -f /etc/sysctl.d/10-bridge-offload.conf /etc/sysctl.d/99-bridge-offload.conf

# Reload rpcd to register the new luci.airoha_manager backend
/etc/init.d/rpcd reload 2>/dev/null

# Clear LuCI cache so the new menu entries are picked up
rm -f /tmp/luci-indexcache.*
rm -rf /tmp/luci-modulecache/

exit 0
endef

define Package/$(LUCI_NAME)/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0

# Stop and disable the fan service
/etc/init.d/fan stop 2>/dev/null
/etc/init.d/fan disable 2>/dev/null

# Stop and disable the npu-jitter service
/etc/init.d/npu-jitter stop 2>/dev/null
/etc/init.d/npu-jitter disable 2>/dev/null

# Reload rpcd to unregister the luci.airoha_manager backend
/etc/init.d/rpcd reload 2>/dev/null

exit 0
endef

# Placed last so the conffiles/postinst/prerm blocks above are visible to
# BuildPackage's BuildPackVariable guard. luci.mk ends by calling
# `$(eval $(call BuildPackage,$(PKG_NAME)))` itself, once per
# LUCI_BUILD_PACKAGES entry; calling it again here would re-eval the package
# definitions a second time.
include $(TOPDIR)/feeds/luci/luci.mk
