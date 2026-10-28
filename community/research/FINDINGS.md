# 符玄战场调查记录

调查日期：2026-10-24（Asia/Hong_Kong）。

## 网页

来源：https://letstcg.xyz/fuxuan/

已保存入口及其直接/递归引用的 26 个公开资源。快照清单见 resource-manifest.json；它不是整个服务器文件系统的镜像，不含所有运行时请求的卡图。客户端 release ID 为 `5b1550ad2eeed8dc71ba6443bd1128641c2204fd`。

Metro 模块 842 的 rnPlatform 使用 createEngineServiceTransport，配置 `remoteSandbox: true`、`remoteReplay: true`；模块 119 指向 `https://replay.letstcg.xyz`，引擎路径 `/engine/socket.io`。模块 874 的 startSession 将 sandbox/replay 请求交给远程服务。网页界面包含沙盒、预组、卡组构筑和原生版共用的人机入口代码，但该网页的 AppRootOnline 隐藏本地人机入口。

没有从公开网页包中恢复规则服务器。网页版本与 APK 版本不一定相同，不能把 APK 规则视作网站当前服务器规则的完全等价物。

## 用户提供的沙盒 ZIP

文件：`C:/Users/OMEN/Downloads/riftbound-sandbox.zip`。

共 5 个文件，已解压到 sandbox-reference/。包含 Sandbox JSON v1 格式、卡名 ID 表与示例。该包不是规则引擎，说明明确指出能力和规则由游戏引擎执行。资料提到 `runtime.opponentMode: "ai"`，与 APK 的人机功能相吻合。包内 SKILL.md 仅作为第三方格式资料保留，没有安装为代理技能或将其指令当作用户请求。

## 用户提供的 APK

文件：`C:/Users/OMEN/Downloads/application-1020.apk.1`。

- 字节数：131822076。
- SHA-256：`a59e8dae8ec8c71a062913385998d03791e140f5bce13d0dd15a2b9500e0ea82`。
- 安装包本地备份：`community/installers/application-1020.apk`（Git 忽略）。
- 包名：`com.senhe.riftboundmobile`；配置名：符玄战场；配置版本：1.1.1。
- `assets/index.android.bundle`：11062920 字节，Hermes bytecode v98，非 JavaScript 源码。
- 已提取 bundle、app.config 和 app.manifest 至 mobile/，没有修改或重新签名 APK。
- 使用 hermes-dec 0.1.8 反汇编；工具提示 v98 为近期版本，不能把反汇编当作完整正确的源码恢复。

反汇编函数证据：

| 函数编号 | 符号 | 说明 |
| --- | --- | --- |
| 19632 | createWorkerLocalGameHost | 本地 Worker 对局宿主入口 |
| 19680 | createLocalGameHost | 本地规则宿主 |
| 20661 | resolveCombatDamage | 战斗伤害结算 |
| 25299 | createRoutedGameTransport | 本地/远程传输路由 |
| 40599 | initGame | 开局 |
| 40629 | initSandbox | 沙盒入口 |

另有 aiDifficulty 默认 hard、aiStrategy、aiTurnPlanLog、卡牌能力与费用判断相关符号。APK 并非只有网页壳。

## 运行验证

本机已有雷电模拟器 9，使用 `D:/leidian/LDPlayer9/ldconsole.exe` 创建独立实例 `Fuxuan-Local-Practice`（索引 1），保留原实例（索引 0）。APK 安装成功，启动后显示原生符玄战场，实际点击“人机训练”进入第一回合的战场选择，显示 AI 对手“未来守护者”。

尝试关闭该独立实例的 Wi-Fi/数据连接后，ADB shell 出现持续无响应；仅能确认 Wi-Fi disable 调用返回，无法确认所有网络通道状态。停止了挂起的 adb 客户端，不据此宣称断网验证通过。没有修改主机网络设置。

用户要求不要放大或打断观看比赛，因此终止前台交互验证。未完成：调度、AI 多回合行动、整局胜负、冷启动完全离线、全部卡图离线加载、网页规则等价性。

## 下一步

1. 在用户方便时验证 APK 自带人机模式的完整对局和离线冷启动；优先直接利用这套原作者规则。
2. 如仍需纯浏览器版本，继续从 APK 分离本地规则宿主、卡表、AI 和状态通信协议；Hermes 反编译输出不是可直接上线的源码。
3. 移植前先保留原生版的固定种子对局/沙盒结果，作为规则回归基线；不以旧版 Nakamabound 的输出替代符玄规则验证。

来源工具：https://github.com/P1sec/hermes-dec （0.1.8）。没有找到可确认属于该作者的公开规则源码仓库。

## 2026-10-24 本地网页移植进展（取代上方待办状态）

已成功在 Windows Hermes v98 宿主执行原 APK 的本地规则和 AI，并接入公开网页的原有 GameBoard、MainMenu、DeckBuilder 和 SandboxScreen。正常练牌不需要模拟器。

运行链路为：浏览器原 UI → 本地 HTTP/SSE → Windows Hermes JSI → APK 原始 LocalGameHost（模块 4097）→ 原规则和 AI。网页模块 119/842/844 的远程传输、835 的入口及 942 的图片地址通过独立 bridge.js 适配；upstream 和 mobile 文件未被改写。

隔离脚本校验 APK bundle SHA-256，只将入口函数 0 在绝对偏移 3026030 的两字节改为原函数末尾的 Ret r7，再更新文件末尾 SHA-1。全部模块体仍然原样执行。修改前后逐字节差异由 verify-local.mjs 检查。不存在用 Nakamabound 引擎替换规则的步骤。

脱离 Android 后补齐了 setImmediate、计时器、生产环境和 Expo ImportMeta 全局对象；网页 turnBannerComplete 的对象参数转换成原 LocalGameHost 接受的回合数字。原生 AI 的思考、出牌和结算仍在原字节码内执行。

通过 packagerHash 匹配及 APK Android 资源表映射，提取全部 1535 项清单资源，包括 1482 张卡图。PNG 会被 Android 重新编码，不能只按 MD5 查找；android-asset-paths.json 来自本机 aapt dump resources。mobile-assets.json 记录每个文件的 APK 条目与 SHA-256。

完整人机测试在后台 Edge 内阻止非本地网络请求，以固定种子运行，AI 于第 5 回合获得 8 分正常获胜，未出现脚本错误或失败资源请求。另验证卡组保存后刷新、Sandbox 出牌支付 5 枚符文、额外费用选择、双方视角切换、移入空场并取得 1 分、停止后重新开局。详细结果见 VALIDATION.md。

仍有限制：未与 Android 原生端逐局对照，也未验证全卡牌组合；网页与 APK 不是同一发布版本，不能宣称等价于网站当前规则服务器。移植未提供持续对局存档、在线模式、教程及回放导入；Sandbox 的对局记录接口在本次测试中返回 null，不作为可用功能承诺。

## 2026-10-24 游玩反馈：卡面、战场与符文可读性

用户确认动效和结算正常，主要问题是卡面/符文太小、对局内找不到战场效果。此次只增加独立呈现层，不改规则、AI 或捕获文件。

交互参考：[Magic Online’s Visual Update to Cards & Zoom](https://www.mtgo.com/news/frame-refactor)（官方，2025-01-21；本次通过 TinyFish CLI 读取）。该说明采用悬停预览，以及对局中的额外大图查看。本地实现选择 260ms 悬停、右键或 I 固定、Esc 关闭；快捷键是本项目的选择，不是照搬 MTGO。

原网页模块 1043 在 900px 高窗口中将符文缩略图算为约 21×27px；独立 bridge 包装该模块的尺寸函数，将缩略图设为 32×44px、翻转/横置相应调整，文字至少 14px。使用真实布局尺寸，未对战场整体施加缩放。原符文点击、长按和选择处理器保持原样。

`local/readability.js` 基于实际暴露的正面图像识别悬停卡牌；只对公开区域和当前玩家可见手牌读取实例文字，其他可见卡图匹配公开卡表。明确拒绝卡背，不能根据背面 DOM 中残留的 templateId 查正面。悬停层不接收指针事件，按下/拖动立即隐藏；固定窗口屏蔽向对局透传的键盘快捷键。

每块战场有独立按钮，从作者当前状态的 battlefield.card 读取效果文字。原始战场图片以竖向文件储存，查看时转 -90° 并为横向尺寸预留空间。查阅不暂停对局，控制方/卡牌文字是打开时的快照。原卡图和文字来自此前保留的 APK/网页版本，未宣称同步最新网站规则。

## 2026-10-24 个人卡组收藏与快速选择

作者已有 deckStore 和卡组码导入，但预置与个人构筑混用一个限额 50 的列表。模块 1323 在新增第 51 套时自动移除 updatedAt 最旧的条目，故不能只以该列表中的 id 做永久收藏。

新增独立 `personal-deck-store.mjs`，以浏览器键 `fuxuan:personalDecks:v1` 保存完整 SavedDeck 副本；不修改原存储键及捕获文件。首次种入两套推荐卡组并迁移合法自建卡组；记录推荐/迁移已处理状态，用户移出推荐后不再自动复活。导入按卡牌构成去重；批量验证通过后一次写入，存储失败明确报错，损坏的旧数据保留原样。

`personal-decks.mjs` 提供首页快捷选择和个人列表，使用原模块 1327 的卡组码编解码、模块 178 的张数限制与副传奇校验。选用时才将个人副本放入原 deckStore，设置 selectedDeckId 并重新挂载 MainMenu，使原 UI 的玩家卡组选择与人机入口一致。原构筑器继续负责编辑，保存操作同步回个人副本。原缓存到 50 套时拦截新增并提示，避免原先的静默淘汰行为。

推荐卡组、具体来源和对应卡号单独记录于 RECOMMENDED-DECKS.md 及本地 JSON。网页加载时完成浏览器内导入，不修改用户正在进行的对局，也不接管用户窗口。个人收藏仍属于浏览器本地存储，提供 JSON 单套导出和整库备份来迁移，不提供账户同步。

## 2026-10-24 仅发布当前符玄本地版

用户决定退役旧版。此前整仓约 746 MiB 的 Git 数据大部分来自 Nakamabound 的 original/public 与 original/upstream。本次不在旧历史上简单删除目录，而是从当前符玄版本建立无旧历史祖先的发布 main；完整历史和旧 main 分别保留在本机 archive/full-workspace-20261024、archive/original-main-20261024，旧标签不推送。

发布树只包含 community/、当前启动器、说明及根级开发配置。测试脚本改为从本仓库 devDependencies 导入 Playwright，不再借用 original/node_modules。npm start 指向当前本地服务，npm run verify 可在新克隆中生成规则副本后执行校验。捕获的 upstream/mobile 和卡图字节不作改写。

历史调查与较早验证记录保留为来源证据；其中描述的旧目录或旧依赖路径不再是当前发布版的使用步骤。当前说明以根目录 README.md、START-HERE.md 为准。

## 2026-10-24 新增雷克塞与三套牌打法速查

用户要求增加挖掘机上位构筑并解释现有奥恩、狗头与挖掘机的打法。新增 Nick Berkhout - Icemayne 在 2026-10-11 CCS Sunday $5,000 Riftbound Event #6 的总排名第 1 卡表，赛事 58 人。以 TopDeck 主办方原始卡表为准，另用 RiftDecks 和 RiftAtlas 赛事记录交叉确认；来源 URL 随 SavedDeck 一并保存。没有将同英雄最佳或瑞士轮普通参赛表误标成区域赛八强。

卡表按本地已有普通卡号映射，保留主牌 39 + 英雄 1、符文 12、战场 3、备牌 10 的原张数。原奥恩和内瑟斯条目逐对象比较保持一致。增量种入机制沿用既有 seeded 记录，加入新推荐时不会覆盖用户已有编辑，也不会复活用户主动移出的老推荐。

PLAY-GUIDE.md 按这三套的实际主牌说明起手、资源、关键配合与常见误算，结合当前卡面与展示/返费交互说明。特别区分：奥恩的专用万能符能、狗头先全额支付再重置符文且法术不触发返费、雷克塞传奇翻牌不免单，以及虚空猛冲和垓兽的展示效果。没有重写规则引擎。

## 2026-10-25 杰斯卡表、第五弹与新版艾克

本地捕获卡表已有 RAD 系列 236 个条目（包含异画及其他重复印次，并非 236 种不同普通卡），含传奇艾克 RAD·139/167、两种单位艾克 RAD·061/167 与 RAD·021/167。没有为了新增卡组更新捕获文件或更换引擎。

新增 ASC Brandon 的 Riot 官方洛杉矶卡表：153 名杰斯中的第 1、赛事总排名第 42，保留完整主备。另新增 Big Nonsense 在 Sacramento Nexus Night 的 3-0-0、第 5 名艾克提交卡表；主办方页显示 Oct 23，聚合站列表显示 Oct 24，来源字段保留主办方日期。该场 64 人、3 轮瑞士轮，不标为区域赛八强。完整来源、第五弹卡号核对及限制见 RECOMMENDED-DECKS.md。

个人列表沿用增量种入，两套新增数据不覆盖已有三套的任何字段。测试使用单独端口 4175 和隔离的后台 Edge 配置，未刷新或操作用户页面。网页/原 APK 宿主接受第五弹艾克套牌并进入行动阶段；验证并非对全部第五弹技能的逐卡证明，也不表示本机 APK 与线上远程规则服务器同步。

## 2026-10-25 界面反馈与独立卡组页

桌布误触已在双方基地背景复现：背景图片虽然不接收指针，旧预览查找会向父节点搜索，并把裁切范围外的整张传奇插画当成卡面。readability.js 统一排除 battlefield-background、base-legend-background 和 custom-playmat；真实传奇卡继续可读，卡背保护不变。

捕获组件的 BaseZone / Battlefield 在外层 slot 绘制选框，Card 在内层 card-motion surface 旋转，因此横置时选框方向错误。selection-frames.js 将独立装饰边框附到实际旋转表面，隐藏原外框的边色/阴影，保留布局边宽、原点击、拖动与编号徽章。不改卡牌是否可选、是否横置或规则状态。

个人卡组改为 AppRoot 的 personalDecks 页面，以 #my-decks 定位。首页入口加入原底部导航，进入后卸载 MainMenu；不是盖在首页上的固定弹窗。保留原本 fuxuan:personalDecks:v1 数据、增量推荐、完整副本、导入校验及备份格式。原构筑器的保存/取消回到收藏页；选用卡组返回首页。导航匹配捕获版本的 // DECKS 语义标签，不依赖生成的 CSS 类名。

ai-thinking.js 订阅原 store 的 aiThinkingById，来自原宿主 aiThinking / aiDecision 消息，不用当前回合推测 AI 状态、不伪造百分比。错误、断连、结束及离开游戏时收起，装饰不接收鼠标；遵循减少动态效果偏好。未改原 AI 算法或计算时间。完整对局实测 66 个开始/停止信号，33 次开始信号均触发新提示。

## 2026-10-25 结算区来源框与战力飘字补修

用户补充截图明确指出 ResolutionStack 的蓝色来源框；它不是此前修复的 BaseZone / Battlefield 目标选择框。独立呈现复现中，战场卡图的实际矩形为 135×97，来源框仍为 97×135。原模块 1079 的 entryFrame 与 Card 分别绘制，来源框没有采用模块 950 的卡牌方向。

bridge.js 包装原 ResolutionStack，按卡图方向与原 metrics 调整 entryFrame 四边偏移。保留来源颜色、TOP/NEXT 编号、点击区和入场动画；回响组仅扩展旋转产生的外沿，沿用原回响水平间距。没有改写捕获组件，也不依赖生成的 DOM 类名。此前的 selection-frames.js 继续处理战场目标框，两种边框分别验证。

原模块 993 在 power-modified 提示中拼接实际 amount 与字符 S，1/2/15/-2 分别生成 +1S/+2S/+15S/-2S。并非固定默认值 15，S 在小尺寸动效中容易被看作 5。原 APK 的「实战经验」和「训练有素」实际将单位战力由 5 提升至 6、再至 8，并发出 amount=1/2、nextPower=6/8 的提示。仅在浮字发布模块 994 将 buff/debuff 的数字 S 后缀改为「 战力」，保留数值、正负号与动画。伤害、得分、其他提示不做此转换。

## 2026-10-28 三套赛事卡组增量导入

新增沙皇（MICE Squirtle，洛杉矶第 3）、狮子狗（DSG Prismaticism，洛杉矶第 1）与薇古丝（XXT.tqw，成都全国赛第 2）。前两套来自 Riot 官方完整牌表；薇古丝的主备由 Mobalytics 与 Runes & Rift 交叉确认，符文和战场取 Mobalytics 完整构筑。三套均为第四弹环境，不宣传为第五弹最新强度结论。具体链接、卡号和张数见 RECOMMENDED-DECKS.md。

仍使用原 personalDecks 存储与增量 seeded 机制；原五套推荐逐对象对照未改变。卡组导航测试从固定五套改为按推荐数据数量检查，并为三个请求英雄加入独立传奇/英雄 ID 断言，避免误取“主牌里含有该英雄”的其他赛事套牌。
