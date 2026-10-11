**English** | [简体中文](README.md)

# Airoha Manager

`luci-app-airoha-manager` is a LuCI management application for Airoha AN7581 / W1700K class devices. It merges three previously separate applications — `luci-app-airoha-npu`, `luci-app-airoha-flowsense` and `luci-app-airoha-fancontrol` — into a single package behind a single menu entry, under **Services → Airoha Manager**.

The interface language follows LuCI: English when LuCI runs in English, Simplified Chinese when it runs in Simplified Chinese. The Chinese interface comes from the separate `luci-i18n-airoha-manager-zh-cn` translation package, which builds and installs on its own.

## Features

All three tabs share one rpcd backend, `luci.airoha_manager` (34 methods), so the package needs a single ACL grant and a single copy of the hardware access code.

### 1. NPU Status

- **NPU clock and cores**: clock and readiness of the 8× RISC-V NPU cores (via PCIe RAM)
- **CPU info and frequency scaling**: current frequency, maximum frequency, and a governor chosen from the list the kernel offers (performance / powersave / ondemand / conservative / schedutil / userspace and so on)
- **Frame engine**: PPE engine state, PPE initialisation / WDMA rings / flow statistics
- **PSE**: shared buffer occupancy and per-port queue status
- **Reserved memory**: occupancy per memory region
- **Hardware offload toggles**, switched on and off with a click: hardware flow offload, VLAN tag offload, PPPoE passthrough offload, AP mode acceleration
- **Operating mode detection**: distinguishes router mode from AP mode, and in AP mode points out which offloads are better turned off

### 2. FlowSense

- **PPE flow monitor**: bound and unbound entries, index, original and translated flows
- **Offload statistics and real-time trends**
- **WiFi status**: client count and signal strength per band (2.4 / 5 / 6 GHz)
- **Ethernet status**: WAN (USXGMII 10G), LAN2 (USXGMII 10G), internal switch (1G LAN3/4), 10G PHY
- **Bridge statistics**: drop deltas
- **WAN health and jitter**: measured continuously in the background by the `npu-jitter` service; the ping target is changed by clicking it (default `223.5.5.5`)
- **Conflict alerts**: detects configuration combinations that interfere with each other and reports them
- **NPU path / CPU path diagram**, refreshing live every 5 seconds

### 3. Fan Control

Split into two sub-tabs, **Status** and **Settings**.

**Status**

- **Real-time trends**: fan speed, PWM, control mode and curve preset as a four-card overview, above the board temperature / fan PWM / fan speed charts
- **Temperatures**: CPU, board, 10G PHY and switch PHY, plus the 2.4 / 5 / 6 GHz radios

**Settings**

- **Control mode**: automatic (follow the curve) or manual (fixed speed)
- **Curve presets**: Quiet / Balanced / Performance / Custom
- **Custom curve editor**: five temperature/PWM points, with the curve preview updating as you type

Requires an NCT7802 hardware monitoring chip; without one the page reports the driver as unavailable

## Requirements

- OpenWrt (a snapshot using the apk package manager)
- The Airoha target (`@TARGET_airoha`, i.e. AN7581 / W1700K class devices)
- `luci-base`, `kmod-br-netfilter` and `luci-compat`, pulled in automatically by the package
- An NCT7802 hardware monitoring chip for the Fan Control page

## Installation

### Option 1: install with apk (recommended)

Copy the built `.apk` files to the device (into `/tmp`, for example), then run:

```sh
apk add --allow-untrusted luci-app-airoha-manager-*.apk
apk add --allow-untrusted luci-i18n-airoha-manager-zh-cn-*.apk
```

The second package is the Simplified Chinese translation; install it only if you want a Chinese interface. The first one alone gives you English.

The menu entry then appears under **Services → Airoha Manager**. The post-install script enables and starts the `fan` and `npu-jitter` services, reloads rpcd and clears the LuCI caches. If the menu does not show up straight away, refresh the page or log in again.

### Option 2: build from source

Using the OpenWrt SDK (`openwrt-sdk-airoha-an7581_gcc-14.4.0_musl.Linux-x86_64`):

```sh
bash tools/build.sh /path/to/openwrt-sdk-airoha-an7581_gcc-14.4.0_musl.Linux-x86_64
```

The script links this repository into the SDK's `package/` directory, enables `CONFIG_PACKAGE_luci-app-airoha-manager=m`, then builds the main package and the Chinese translation. The artifacts land in `bin/packages/<arch>/base/`.

> `luci.mk` declares every `luci-i18n-*` package `HIDDEN`, so its kconfig symbol carries no prompt and a line written into `.config` is silently discarded on the next kconfig run; setting `CONFIG_LUCI_LANG_zh_Hans` instead would switch on the Chinese translation of every other selected LuCI application. The script therefore passes that one symbol on the make command line, where it affects this invocation only.

## Layout

```
Makefile                                          package definition
htdocs/luci-static/resources/view/airoha_manager/ the four views: npu.js / flowsense.js / fan_status.js / fan_settings.js
po/templates/                                     .pot template
po/zh_Hans/                                       Simplified Chinese translation
root/etc/init.d/fan                               fan service
root/etc/init.d/npu-jitter                        jitter measurement service
root/usr/libexec/npu-jitter-daemon                jitter measurement daemon
root/usr/libexec/rpcd/luci.airoha_manager         rpcd backend (34 methods)
root/usr/share/luci/menu.d/                       menu definition
root/usr/share/rpcd/acl.d/                        ACL definition
root/etc/config/                                  default configuration: fan / npu-monitor
root/etc/uci-defaults/                            repairs executable modes after install
root/lib/upgrade/keep.d/                          sysctl configuration kept across upgrades
tools/build.sh                                    build script
tools/test.sh                                     test script
tools/check-i18n.js                               translation consistency check
```

## Versioning

Each commit increments `PKG_RELEASE` (`1.0.0-r1` through `r9`). At `r10` the last digit of `PKG_VERSION` is incremented (`1.0.0` → `1.0.1`) and `PKG_RELEASE` resets to `1`.

## Tests

```sh
bash tools/test.sh
```

The suite covers the package layout and file modes, the Makefile's include ordering, the backend helpers and all 34 methods, the four views, the menu and ACL definitions and translation consistency — and it unpacks the `.apk` files that were actually built to check their contents.

## License

GPL-3.0-only. See [LICENSE](LICENSE).
