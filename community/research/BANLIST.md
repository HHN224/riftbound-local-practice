# 标准构筑禁卡与 AI 替代

来源：[Riot Rules Hub](https://playriftbound.com/en-us/rules-hub/)（2026-10-29 核对，禁卡列表最后更新 2026-09-18）、[9 月公告](https://playriftbound.com/en-us/news/announcements/september-ban-list-updates-effective-september-18-2026/)。适用 Standard Constructed 1v1；不把仅限 2v2 的易大师传奇禁令套到 1v1。

| 禁卡 | 本地名称 |
| --- | --- |
| Called Shot | 预判攻势 |
| Ekko, Recurrent | 艾克（OGN·110，不是所有艾克） |
| Draven, Vanquisher | 德莱文（SFD·020，不是所有德莱文） |
| Fight or Flight | 战或逃 |
| Scrapheap | 废料堆 |
| Stealthy Pursuer | 隐秘追踪者 |
| Stacked Deck | 卡牌骗术 |
| The Arena’s Greatest | 荣耀竞技场 |
| Aspirant’s Climb | 攀圣长阶 |
| Dreaming Tree | 幻梦之树 |
| Obelisk of Power | 力量方尖碑 |
| Reaver’s Row | 劫掠船巷 |

`public/local/banlist.json` 保留普通版与其他印次的模板编号映射，判定不只按中文英雄名，也不只按普通版完整 ID。`deck-legality.cjs` 由浏览器和 Node 服务共用。检查所有构筑区，包含备牌和战场；保留用户非法旧表以便修正，不静默删牌。Sandbox 仍用于实验规则，清楚显示标准构筑禁用标签。

31 套原预置中 10 套含禁卡。替代只发生在本次人机开局，不覆盖旧条目或用户的牌表：

| 旧 AI 卡组 | 替代 |
| --- | --- |
| Zed / Jinx Tech | 劫 · 洛杉矶合法替代（Egoist，总排名 330） |
| Pyke Reanimate、Empower Pyke | 派克 · 洛杉矶合法替代（C4lcioSF，总排名 113） |
| 6th - JIN、5th - lаmbyseries 新加坡表 | 凯南 · 洛杉矶合法替代（DSG AwesumRosum，总排名 13） |
| Kha’Zix [Post Singapore]、Khazix | 卡兹克 · 洛杉矶合法替代（Cuoemrei，总排名 20） |
| Teemo Kharox Control | 既有合法提莫预置 |
| melatonin | 梅尔 · 洛杉矶合法替代（DSG Alanzq，总排名 480） |
| Draven | 德莱文 · 洛杉矶合法替代（I Missed My Q，总排名 204） |

六套新替代表均取自 [Riot 官方洛杉矶完整卡表](https://playriftbound.com/en-us/news/organizedplay/los-angeles-top-decks/)，每套为该英雄同场最佳表，但**不是全部八强卡表**；原名次如表所列。它们保留完整 39+英雄、12 符文、3 战场、10 备牌。凯南传奇在本地为 VEN·155（其他印次 VEN·197），英雄 VEN·113；不会将副传奇或别的卡组主牌中出现的凯南误当成传奇。合法替代池位于 `ai-legal-decks.json`，与个人推荐池分开；只额外将用户要求的凯南加入个人列表。

截至本轮，原八套推荐加新增凯南九套均未命中禁卡表。用户自己保存/编辑的版本按当前浏览器实际内容实时扫描，含禁卡时在“我的卡组”明确列名。静态仓库无法替用户检查另一浏览器未导出的自建内容。禁卡快照更新与整个规则引擎更新是两件事，后者仍为原 APK 版本。
