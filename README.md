# riftbound-local-practice

符玄战场本地练牌版。使用社区网页界面，在本机执行用户提供 APK 内的原规则和 AI，支持人机对战、Sandbox、卡组构筑、个人卡组保存和切换。

## 启动

普通玩家可从 [GitHub Releases](https://github.com/HHN224/riftbound-local-practice/releases/latest) 下载 `riftbound-local-practice-win-x64.exe`，双击即可运行，无需安装 Node.js 或克隆仓库。首次运行释放文件到用户目录，然后打开系统浏览器；不需要管理员权限。详细打包方式见 [桌面发布说明](community/desktop/README.md)。

目前支持 **Windows x64、Node.js 20 或更新版本**。克隆仓库后双击 `启动符玄战场.cmd`，或在仓库根目录运行：

```powershell
npm start
```

打开 <http://127.0.0.1:4174/fuxuan/>，点击「人机对战」。运行不需要模拟器、远程规则服务器或 npm 依赖；卡图、音效和 Windows Hermes 宿主已包含在仓库中。

仅启动后台服务、不打开浏览器：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File community/Start-Local.ps1 -NoBrowser
```

## 使用

- 首页底部「我的卡组」打开独立收藏页，可导入、保存、搜索、编辑和备份；点击「使用这套卡组」返回首页开局。
- 已预置奥恩洛杉矶八强、内瑟斯与杰斯同英雄最佳、雷克塞 CCS 冠军、第五弹艾克萨城 Nexus 第 5 名，以及沙皇洛杉矶季军、狮子狗洛杉矶冠军、薇古丝成都全国赛亚军，及凯南洛杉矶第 13 名，共九套完整赛事构筑，并保留来源与名次。
- 鼠标悬停卡面放大；右键或按 `I` 固定查看，`Esc` 关闭。每块战场有「查看效果」按钮。
- 桌布插画不触发传奇预览，选框跟随卡面横置；AI 计算出牌时显示「对手正在思考」。
- 卡组存于当前浏览器。换浏览器前可导出全部备份；刷新或关闭网页会结束当前对局。

标准构筑已接入官方禁卡表（2026-09-18 生效，2026-10-29 核对）。含禁卡的个人卡组保留并标注不可用；AI 自动改用同英雄合法牌表。详见 [禁卡与 AI 替代说明](community/research/BANLIST.md)。

## 开发与检查

基础检查不需要额外依赖：

```powershell
npm run verify
npm test
```

浏览器回归需要安装开发依赖和 Microsoft Edge。先启动本地服务，再运行：

```powershell
npm ci
npm run test:decks
npm run test:readability
npm run test:feedback
npm run test:browser
```

测试在隔离的后台浏览器运行，卡组和对局不写入日常浏览器配置。

## 文件与说明

运行文件集中在 `community/`：`engine/` 是 Windows 宿主，`mobile/` 和 `upstream/` 保存原始捕获文件，`public/` 包含资源与独立适配层，`scripts/` 提供启动、构建和验证工具。`generated/` 为启动时生成的规则运行副本，不进入 Git。

| 文档 | 内容 |
| --- | --- |
| [START-HERE.md](START-HERE.md) | 使用、保存卡组与快捷键 |
| [BUILD.md](community/engine/BUILD.md) | Hermes 宿主构建及运行方式 |
| [VALIDATION.md](community/research/VALIDATION.md) | 已验证范围和限制 |
| [RECOMMENDED-DECKS.md](community/research/RECOMMENDED-DECKS.md) | 预置卡表来源 |
| [PLAY-GUIDE.md](community/research/PLAY-GUIDE.md) | 奥恩、狗头、挖掘机起手与打法速查 |
| [FINDINGS.md](community/research/FINDINGS.md) | 原始调查与版本证据 |

## 来源与版本

界面来自 [符玄战场](https://letstcg.xyz/fuxuan/)，规则与 AI 来自用户提供的 APK 1020（配置版本 1.1.1、界面版本 1.0.1）。本地 Hermes 执行原规则模块；验证范围不代表与网站当前远程规则版本完全一致。在线对战、教程、回放导入和断点续局暂未接入。

这是非官方个人练牌适配。Riftbound、卡牌名称与美术归相应权利人所有；社区代码保留原作者权利。Hermes 和依赖的许可证见 [engine/licenses/](community/engine/licenses/)。本仓库未为第三方捕获内容重新授予开源许可。

发布历史只包含当前符玄本地版。退役的 Nakamabound 项目与原工作区提交留在本机归档，不包含在 GitHub 的 `main` 中。
