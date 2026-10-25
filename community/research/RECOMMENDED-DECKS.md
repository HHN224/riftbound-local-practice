# 个人练牌列表的推荐卡组

导入文件：`community/public/local/recommended-decks.json`。奥恩和内瑟斯来自 [Riot 官方洛杉矶区域资格赛卡表](https://playriftbound.com/en-us/news/organizedplay/los-angeles-top-decks/)（2026-09-30 发布，2026-10-24 读取）；雷克塞来自主办方公布的 [CCS 第 6 期冠军卡表](https://topdeck.gg/deck/ccs-sunday-5000-riftbound-event-6/7unCv71a0PeXL6aWkXG4tKn3nXl1)。没有自行改动赛事构筑或添加副传奇。打法见 [PLAY-GUIDE.md](PLAY-GUIDE.md)。

| 个人列表名称 | 选手与实际成绩 | 传奇 / 英雄 | 符文 |
| --- | --- | --- | --- |
| 奥恩 · 洛杉矶八强 · 装备引擎 | MICE TheManLand，总排名第 8 | 山隐之焰 `SFD·189/221` / 奥恩 `SFD·058/221` | 翠意 8 / 灵光 4 |
| 内瑟斯 · 洛杉矶同英雄最佳 · 跳费控制 | Niguel，同英雄最佳，总排名第 142 | 沙漠死神 `VEN·145` / 内瑟斯 `VEN·046` | 翠意 6 / 灵光 6 |
| 雷克塞 · CCS 第6期冠军 · 征服续航 | Nick Berkhout - Icemayne，2026-10-11，58 人，总排名第 1 | 虚空遁地兽 `SFD·187/221` / 雷克塞 `SFD·029/221` | 炽烈 7 / 序理 5 |
| 杰斯 · 洛杉矶同英雄最佳 · 龙蛋极光 | ASC Brandon，同英雄第 1 / 153，总排名第 42 | 未来守护者 `VEN·149` / 杰斯 `VEN·068` | 摧破 8 / 灵光 4 |
| 艾克 · 萨城Nexus第5 · 回手控制 | Big Nonsense，64 人，3 轮瑞士轮，3-0-0，总排名第 5 | 时间刺客 `RAD·139/167` / 艾克 `RAD·061/167` | 炽烈 6 / 灵光 6 |

每套均为英雄 1 + 其余主牌 39、符文 12、战场 3、备牌 10。`sourceCards` 保留赛事原文卡名和张数，`source` 保留选手、赛事、名次和来源链接。内瑟斯的 Best-Of 是该英雄的最高排名，不是整场赛事八强。

英文卡名通过 [Riftcodex 卡牌数据 API](https://api.riftcodex.com/cards) 的 `riftbound_id` 对应本地捕获卡表，再选相同卡号的普通版本；没有根据中文同名英雄猜测印次。卡牌效果与实际运行继续使用已保留的 APK 规则和网页卡表。列表不依赖在线接口，启动后全部从本地 JSON 导入。

奥恩、内瑟斯、雷克塞、杰斯均为第五弹之前的赛事构筑。第五弹 Radiance 在 2026-10-23 发售，未将这些旧环境卡表标为新环境最强。来源：[官方系列说明](https://playriftbound.com/en-us/news/announcements/the-radiance-overview/)。

杰斯取自上方同一篇 Riot 官方洛杉矶卡表，保留 ASC Brandon 的 39 张主牌和完整备牌，不将同英雄最佳写成赛事八强。

艾克以主办方 [TopDeck 提交卡表](https://topdeck.gg/deck/ldxp-sacramento-nexus-night-constructed/62F3hDMI9RgPK2Pl1QLP4PInc6q1) 为准；[RiftDecks 记录](https://riftdecks.com/riftbound-metagame/deck-ekko-boy-who-shattered-time-336846) 交叉确认名次及完整张数。这是 Nexus Night 的 3 轮瑞士轮第 5 名，不是大型区域赛八强。TopDeck 卡表页显示 Oct 23，RiftDecks 列表记 2026-10-24；本地来源字段沿用主办方 Oct 23，不将日期差异隐藏。获取日期为 2026-10-25。

既有英文 API 快照未包含第五弹，因此艾克相关新卡单独按普通版卡号核对：传奇 `RAD-139`、Ingenious `RAD-061`、Revolutionary `RAD-021`、Chronobreak `RAD-140`；另有 Bilgewater Tracker `RAD-003`、Riptide Mage `RAD-058`、The Empyrean `RAD-060`，分别与本地中文卡面对应。来源：[Riftwatch 艾克卡表及卡号](https://riftwatch.gg/decks/radiance/ekko-borrowed-time/)、[另一艾克卡表的 Revolutionary 卡号](https://riftwatch.gg/decks/radiance/ekko-power-loop/)、[Bilgewater Tracker](https://hextechanalytics.com/cards/rad-003-167)、[Riptide Mage](https://www.wegeektogether.com/pages/riftbound-card/riptide-mage)、[The Empyrean](https://riftbound.gg/cards/rad-060-the-empyrean/)。这些辅助页面仅用于卡号映射，没有把它们的理论构筑替换进赛事卡表。未采用浏览器提取代理返回的错误图片编号，也未加入已禁用的旧艾克 Recurrent。

验证范围：全部本地卡号存在；套牌数量与作者重复张数/副传奇检查通过；五套均可通过人机赛前流程进入原规则宿主的行动阶段。未逐张验证全部配合，也不是与 Android 原生端同种子对照的等价性证明。

首次加载个人列表时，在当前浏览器中各导入一次。用户之后编辑、重命名、移出列表或刷新时，不会被初始推荐数据覆盖或重新加回。用户修改构筑后，以用户保存的副本为准。
