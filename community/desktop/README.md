# Windows 免安装单文件发布

发布文件为 `riftbound-local-practice-win-x64.exe`，包含本地网页、卡图、音效、原 Hermes 规则宿主、隔离后的规则运行副本、对应的 Visual C++ 本地运行库，以及官方 Windows x64 Node.js 24.15.0。普通玩家无需安装 Node.js、npm 依赖或模拟器。

双击后首次释放到 `%LOCALAPPDATA%/RiftboundLocalPractice/releases/<内容哈希>/`，启动后台服务并打开系统浏览器的 `http://127.0.0.1:4174/fuxuan/`。后续运行复用已释放文件和健康服务。关闭浏览器不停止后台服务；与源码版一致，卡组保存在该浏览器该地址的本地存储，刷新会结束当前对局。更新前先结束对局并关闭旧后台服务，新版重新启动后生效。使用已有健康的 4174 服务时不会替换它。

当前启动器没有代码签名。成品只上传 GitHub Releases，不提交进 Git 历史。源码仍位于仓库，第三方捕获文件保持原样；发布包内包含 Node.js 及 Hermes 依赖许可、来源和版本限制说明。

## 构建

在 Windows x64 源码目录运行 `npm run build:desktop`。需要开发机安装 Node.js、Git、Visual Studio C++ 工具与 release x64 VC143 CRT 可再发行文件，以及 Windows .NET Framework 4.x C# 编译器；玩家运行时不需要编译器。构建脚本从 Node.js 官方发布校验表验证运行时 SHA-256，并附上对应 Node.js LICENSE；用 vswhere 定位 VC143 CRT，校验微软签名后附带运行库和说明。可用 `-VcRedistDirectory` 指定安装中的 release CRT 目录。编译使用微软随 .NET Framework 提供的 `csc.exe`，资源解压使用其 ZIP 库。

输出到忽略的 `dist/`：单文件 EXE、`SHA256SUMS.txt` 与构建元数据。构建只收集当前 `community/` 运行文件，不含 `original/`、旧 Git 历史、测试结果、APK 安装包或开发依赖。规则运行副本由原始 APK 校验后生成，未改写规则/AI 函数。

## 后台验证

运行 `npm run test:desktop`，会使用独立的 4181 端口、`dist/smoke-*` 目录启动 EXE，移除环境中的 Node.js PATH，验证首次释放、启动与重复启动；不打开浏览器窗口。可用 `FUXUAN_PORT` 指定其他测试端口。其后以同一端口执行卡组、Sandbox 和完整人机浏览器回归。测试后台服务需在检查完毕后按可执行文件路径和监听端口识别并停止。

启动器额外支持 `--no-browser`（只启动服务）和 `--extract-only`（只释放文件）。`FUXUAN_DESKTOP_HOME` 可为测试指定独立释放目录。正式使用请保持默认端口与浏览器，以便沿用个人卡组。
