[English](README.en.md) | **简体中文**

# Airoha管理中心

`luci-app-airoha-manager` 是面向 Airoha AN7581 / W1700K 一类设备的 LuCI 管理应用。它把原先三个独立的应用 —— `luci-app-airoha-npu`、`luci-app-airoha-flowsense`、`luci-app-airoha-fancontrol` —— 合并为一个软件包、一个菜单入口，位于 **状态 → Airoha管理中心**。

界面语言自动跟随 LuCI：LuCI 为英文时显示英文，为简体中文时显示简体中文。中文界面由独立的语言包 `luci-i18n-airoha-manager-zh-cn` 提供，可单独编译、单独安装。

## 功能简介

三个标签页共用一个 rpcd 后端 `luci.airoha_manager`（共 34 个方法），因此只需要一条 ACL 授权、一份硬件访问代码。

### 一、NPU状态

- **NPU 时钟与核心**：8× RISC-V 核心（经 PCIe RAM）的 NPU 频率与就绪状态
- **CPU 信息与调频**：当前频率、最高频率设置，调频策略可在内核提供的列表中切换（performance / powersave / ondemand / conservative / schedutil / userspace 等）
- **帧引擎**：PPE 引擎状态、PPE 初始化 / WDMA 环 / 流统计
- **PSE**：共享缓冲占用、各端口队列状态
- **保留内存**：各内存区域占用
- **硬件卸载开关**（点击即可启停）：硬件流卸载、VLAN 标签卸载、PPPoE 透传卸载、AP 模式加速
- **工作模式识别**：自动判别路由模式 / AP 模式，AP 模式下会提示哪些卸载项建议关闭

### 二、流程传感器

- **PPE 流监控表**：已绑定 / 未绑定表项、索引、原始流与转换后流
- **卸载统计与实时趋势**
- **WiFi 状态**：各频段（2.4 / 5 / 6 GHz）客户端数量与信号强度
- **以太网状态**：WAN（USXGMII 10G）、LAN2（USXGMII 10G）、内置交换机（1G LAN3/4）、10G PHY
- **网桥统计**：丢包增量
- **WAN 健康度与抖动**：由 `npu-jitter` 服务在后台持续测量，Ping 目标可点击修改（默认 `223.5.5.5`）
- **冲突告警**：检测会互相干扰的配置组合并给出提示
- **NPU 路径 / CPU 路径示意图**，每 5 秒实时刷新

### 三、风扇控制

- **实时温度**：CPU、主板
- **风扇转速与 PWM 输出**
- **控制模式**：自动（跟随曲线）/ 手动（固定转速）
- **曲线预设**：静音 / 均衡 / 性能 / 自定义
- **自定义曲线编辑器**：定义 5 个温度/PWM 点，曲线预览随输入实时更新
- 需要设备具备 NCT7802 硬件监控芯片，否则该页会显示"驱动不可用"

## 环境要求

- OpenWrt（使用 apk 包管理器的快照版本）
- Airoha 目标平台（`@TARGET_airoha`，即 AN7581 / W1700K 一类设备）
- 依赖 `luci-base`、`kmod-br-netfilter`、`luci-compat`，由软件包自动安装
- 风扇控制页需要 NCT7802 硬件监控芯片

## 安装方法

### 方式一：apk 安装（推荐）

把编译好的 `.apk` 传到设备上（例如 `/tmp`），然后执行：

```sh
apk add --allow-untrusted luci-app-airoha-manager-*.apk
apk add --allow-untrusted luci-i18n-airoha-manager-zh-cn-*.apk
```

第二条是简体中文语言包，只有需要中文界面时才安装；使用英文界面只需第一条。

安装完成后，菜单会出现在 **状态 → Airoha管理中心**。postinst 会自动启用并启动 `fan` 与 `npu-jitter` 两个服务、重载 rpcd，并清理 LuCI 缓存。若菜单没有立即出现，刷新页面或重新登录即可。

### 方式二：从源码编译

使用 OpenWrt SDK（`openwrt-sdk-airoha-an7581_gcc-14.4.0_musl.Linux-x86_64`）：

```sh
bash tools/build.sh /path/to/openwrt-sdk-airoha-an7581_gcc-14.4.0_musl.Linux-x86_64
```

脚本会把本仓库软链接进 SDK 的 `package/` 目录，启用 `CONFIG_PACKAGE_luci-app-airoha-manager=m`，然后编译主包与中文语言包，产物位于 `bin/packages/<架构>/base/`。

> `luci-i18n-*` 在 `luci.mk` 中被声明为 `HIDDEN`，其 kconfig 符号没有 prompt，写进 `.config` 会在下一次 kconfig 运行时被静默丢弃；而设置 `CONFIG_LUCI_LANG_zh_Hans` 又会连带打开其他所有已选 LuCI 应用的中文翻译。因此脚本是在 make 命令行上传该符号，只影响本次调用。

## 目录结构

```
Makefile                                          包定义
htdocs/luci-static/resources/view/airoha_manager/ 三个页面 npu.js / flowsense.js / fan.js
po/templates/                                     .pot 模板
po/zh_Hans/                                       简体中文翻译
root/etc/init.d/fan                               风扇服务
root/etc/init.d/npu-jitter                        抖动测量服务
root/usr/libexec/npu-jitter-daemon                抖动测量守护进程
root/usr/libexec/rpcd/luci.airoha_manager         rpcd 后端（34 个方法）
root/usr/share/luci/menu.d/                       菜单定义
root/usr/share/rpcd/acl.d/                        权限定义
root/etc/config/                                  默认配置 fan / npu-monitor
root/etc/uci-defaults/                            安装后修复可执行文件权限
root/lib/upgrade/keep.d/                          卸载/升级时保留的 sysctl 配置
tools/build.sh                                    构建脚本
tools/test.sh                                     测试脚本
tools/check-i18n.js                               翻译一致性检查
```

## 版本约定

每次提交 `PKG_RELEASE` +1（`1.0.0-r1` ~ `r9`）；达到 `r10` 时 `PKG_VERSION` 末位 +1（`1.0.0` → `1.0.1`），`PKG_RELEASE` 重置为 `1`。

## 测试

```sh
bash tools/test.sh
```

覆盖包布局与文件权限、Makefile 的 include 时序、后端 helper 行为与全部 34 个方法、三个前端页面、菜单与 ACL 定义、翻译目录一致性，并对实际构建出的 `.apk` 做解包校验。

## 许可证

GPL-3.0-only，详见 [LICENSE](LICENSE)。
