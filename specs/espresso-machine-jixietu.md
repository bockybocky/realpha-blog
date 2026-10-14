# 規格：用 jixietu（anatomy）技能重畫濃縮咖啡機（Hero 級）

## 0. 背景與要讀的東西（動手前全部讀完）
- 技能本體：`C:/Users/Charles/.claude/skills/jixietu/SKILL.md`，以及 `references/craft.md`、`references/kit.md`、`references/motion.md`、`references/verify.md`。
- 最接近的範例：`examples/arcade-cabinet/`（側板拆掉的剖面機器、車床零件、管線、會動零件在預留的繪製順序槽位裡重畫、`--audit`）。結構參考 `examples/dial-indicator/build.mjs`（最小）。錶針與讀數參考 `examples/test-rig/`。
- 目前上線的舊版：`public/espresso-machine.js`（由 `scripts/build_espresso_machine.mjs` 產生，只用了自己縮小的 4.6KB 工具包 `scripts/vendor/anatomy-iso-kit.mjs`，約 21 個零件）。這次**改用技能附的完整工具包**：`kit/iso-kit.mjs`、`kit/lathe.mjs`、`kit/tube.mjs`、`kit/audit.mjs`、`scripts/inline-kit.mjs`。
- 驅動它的程式：`public/espresso-lab.js` 第 315–330 行（mount）與第 714–728 行（update 的 payload）。**這支不准改。**

## 1. objective
畫一台「側板拆掉、看得到內部」的 E61 沖煮頭家用半自動義式咖啡機，等角立體，Hero 級（80–150 個零件），品質要到技能範例 test-rig／arcade-cabinet 的水準：每顆螺絲、接縫、倒角、刻度、管線接頭都要有。
物件本身就是解釋：讀者拖實驗室的滑桿，機器上對應零件跟著動，畫面上每個數字都取自同一次 `update(state)`。

### 會動的零件 ↔ 輸入（一對一，不准多也不准少）
| 輸入 | 零件 | 怎麼動 |
|---|---|---|
| `grind`（研磨度，約 180–420 微米） | 機身左邊的小磨豆機：上方有刻度環的調整環（滾花） | 調整環上的指示點轉到 `grind` 對應角度（線性，最細到最粗轉約 270°） |
| `grind`＋`channel` | 把手（沖煮把手）粉碗剖面裡的咖啡粉顆粒 | 顆粒大小與間距隨 grind 變（細＝小而密、粗＝大而疏）；`channel > 0.3` 時粉餅出現 1–2 道裂縫，`channel` 越大越明顯 |
| `temp`（水溫，約 86–97°C） | 鍋爐（車床做的橫向圓筒，剖開看得到內部的加熱管）＋機身正面的溫控小螢幕 | 螢幕數字＝`temp` 一位小數加 °C；加熱管的強調色透明度隨 temp 線性變（只用透明度） |
| `pressure`（壓力，約 6–12 bar） | 機身正面的圓形壓力錶（0–16 bar 刻度，8–10 bar 綠區） | 錶針角度與 pressure 成線性 |
| `flow`、`t`、`shotTime` | 沖煮頭下方流下的咖啡液柱 | 只有 `0 < t < shotTime` 時顯示；寬度隨 flow；`t >= shotTime` 時收掉 |
| `t`、`shotTime` | E61 沖煮頭上的拉桿 | `0 < t < shotTime` 時拉桿在「萃取中」位置，否則回原位 |
| `cup` | 滴水盤上的電子秤＋杯子 | 秤的小螢幕＝`cup` 一位小數加 g；杯中液面高度＝`cup / 40` 的比例（最多到杯緣下一點） |
| `zone` | 卡片右下即時讀數 | 讀數一行：`93.0°C · 9.0 bar · 36.0 g`，`zone` 不需要畫在機器上（不准為了用它硬加零件） |

`state` 欄位：`{ grind, temp, pressure, flow, cup, t, shotTime, channel, zone }`。缺欄位時用合理預設（300 / 93 / 9 / 1.45 / 36 / shotTime / 25 / 0 / 'ok'），不准拋錯。

### 零件清單（至少照這份做，可以加，不能少；每個零件都要坐在另一個零件上）
- **底座**：機身底板、四顆橡膠腳、底板倒角、底板接縫槽、四角螺絲、銘牌（刻三條字線）、底板前緣刻度條。
- **機身**：不鏽鋼機身外殼（右側板拆掉，看得到內部；左側板留著）、頂部溫杯盤與四根護欄、前面板（接縫、四角螺絲）、背板散熱槽（封閉長孔）、電源開關與指示燈、側板螺絲、機身內部的隔板與固定鍋爐的兩個托架。
- **水路**：後方透明水箱（看得到水位線與刻度）、水箱蓋與握把、吸水管、震動幫浦（車床圓柱，兩端接頭）、幫浦固定橡膠座與束帶、幫浦到鍋爐的管線（有接頭、束帶）、鍋爐到沖煮頭的管線、過壓閥（車床小閥）、壓力錶的取壓細管。
- **鍋爐**：車床橫向圓筒、兩端封頭、法蘭與螺栓圈、剖開後看得到的加熱管（U 形或螺旋）、溫度探棒與它的線、隔熱墊、安全溫控開關。
- **沖煮**：E61 沖煮頭（車床，有散熱鰭片）、拉桿與它的球頭、沖煮把手（把手套、握把、粉碗、雙出口）、粉碗剖面（金屬濾杯壁、粉餅顆粒、粉餅上方的分水網）。
- **蒸氣**：蒸氣管（彎管、球形關節、噴嘴）、蒸氣旋鈕（滾花）、熱水旋鈕。
- **滴水盤**：抽屜式滴水盤、有長槽的格柵、浮標水位窗。
- **秤與杯**：電子秤（小螢幕、兩個按鍵）、杯子（車床杯身、把手、杯底）、杯中液面。
- **磨豆機**（在機身左邊的底座延伸上）：豆倉（透明，裡面有咖啡豆點）、豆倉蓋、刻度調整環（滾花＋刻度＋指示點）、機身、出粉口、粉槽。
- **儀表**：壓力錶（錶框、刻度、綠區、錶針、中心螺帽）、溫控小螢幕（凹進面板、有邊框）。
- **主角**：粉餅剖面是唯一用 `lit` 強調的零件（讀者要看的地方）。咖啡液、液柱、杯中液面、加熱管發熱用強調色 `#d97706`（這是「顏色本身就是主題」的例外，只准用在咖啡與熱）。

### 卡片
- 用工具包的 `plateHtml` 樣式（或等價結構）：左上 `Fig 1`，右上標題（繁中「義式咖啡機，打開來看」／英文「An espresso machine, opened up」），左下提示（繁中「拖下面的滑桿，機器跟著動」／英文「Drag the sliders below; the machine follows」），右下即時讀數。
- 卡片下方圖例 4–6 個（工具包的 keys），標出：粉餅、鍋爐、壓力錶、磨豆機調整環、秤（繁中／英文兩套）。**畫面裡不准有引線標籤**（技能規則：字留在卡片外，最多一個刻在機器上的小字，例如銘牌）。
- 一句真實的說明文字（caption）放卡片下：繁中「粉越細、水越熱，萃取越多；壓力錶和秤上的數字，就是下方圖表同一瞬間的值。」英文對應翻譯。

## 2. files（只准動這些）
- 改寫 `scripts/build_espresso_machine.mjs`：Node 跑。工具包**已經整套複製好**在 `scripts/vendor/jixietu/`（iso-kit／lathe／tube／audit，含 LICENSE 與 SOURCE.txt），一律從這裡相對路徑匯入，**不准改 vendor 裡的檔**。瀏覽器要的 CSS 從 `iso-kit.mjs` 的 `ISO_CSS` 取。產出 `public/espresso-machine.js`。
  - 支援 `--audit`：跑 `A.auditOrExit(R, P)`。
  - 另外寫兩個預覽頁到 `D:/Temp/claude/espresso_jixietu/preview.html`（深色）與 `preview-light.html`（淺色），頁面載入 `public/espresso-machine.js` 的同一份內容並 mount 一次，給固定 state（300/93/9/1.45/18/12/25/0）。驗收截圖用。
- 改寫 `public/espresso-machine.js`（產物，進版控）。內嵌：工具包裡瀏覽器需要的部分（`kitScript()` 或只內嵌需要的 CSS）、靜態 SVG 字串、會動零件的程式。
- 改寫 `scripts/test_espresso_machine.mjs`。
- 刪除 `scripts/vendor/anatomy-iso-kit.mjs`（舊的縮小工具包；主對話已確認只有舊的 build 腳本 import 它）。
- 新增工作檔只准放在 `D:/Temp/claude/espresso_jixietu/` 底下。
- **禁改其他任何檔**（特別是 `public/espresso-lab.js`、`src/` 底下全部）。**禁任何 git 指令**（不准 stash／checkout／restore／reset／add／commit）。禁 `npm run build`。

## 3. interfaces（介面合約，釘死，不准改）
```js
window.EspressoMachine = {
  mount(container, { lang }) -> { update(state) },   // lang === 'en' 用英文，其他一律繁中
  VERSION                                             // 字串，改成 '2.0.0'
}
```
- `mount` 在 container 裡插入整張卡片（外層 `div.iso`，裡面 SVG），回傳 `{ update }`。同一頁 mount 兩次不能互相干擾（id 要加前綴或不用 id）。
- **主題跟部落格走**：部落格深色模式是 `document.documentElement.classList.contains('dark')`。沒有 `dark` 時外層加 `data-theme="light"`，有就拿掉；用 `MutationObserver` 監聽 `<html>` 的 class 變化即時切換。
- 卡片要和部落格頁面融在一起：在外層把 `--anatomy-card` 與 `--anatomy-page` 設成 `var(--paper, <工具包原值>)`（`--anatomy-paper` 維持工具包原值，因為零件的實心填色靠它跟陰影配對；若改了會讓零件變透明感就不要改）。容器 `.es-machine` 只有 `min-height:0`，卡片寬度要 100% 自己撐開。
- 樣式注入一次 `<style>`（id 檢查防重複），工具包 CSS 全部限定在 `.iso` 底下（工具包本來就是）；自己加的 class 用 `em-` 前綴。不准影響頁面其他元素。
- `update` 只改屬性（transform／opacity／d／textContent／display），不重建整張 SVG；一秒 60 次要順。會動的零件在建置時就預留它在繪製順序裡的位置（照 arcade-cabinet 的做法），不准畫在全部東西最上面而穿過前面的零件。
- 畫面上每個數字（溫度、壓力錶數值、秤的克數、右下讀數）直接取自傳入 state 的同一欄位，禁另算、禁平滑落後、禁動畫補間。錶針與調整環也是直接設角度，不加彈簧（因為實驗室自己會用 requestAnimationFrame 播放）。
- `prefers-reduced-motion` 不需要另外處理（這張圖自己不跑動畫）；不要加閒置巡覽動畫（滑桿由實驗室控制）。
- `if (typeof module !== 'undefined' && module.exports) module.exports = { ... }`；沒有 DOM 時載入不能炸。

## 4. constraints
- 純 SVG＋原生 JS，零外部套件、零網路請求、零 WebGL（這張不需要特效）。
- 產物 `public/espresso-machine.js` ≤ 350KB（gzip 後 ≤ 90KB）。超過就減少車床分段數或合併靜態路徑，不准砍零件清單裡的零件。
- 相機：方位角自己挑，讓「拆掉的右側板內部」＋「正面儀表」＋「沖煮頭下方的杯子」同時看得到（arcade-cabinet 的相機挑法），仰角 24–34°。卡片寬 640 左右。
- 手機寬 360px 時：整張圖等比縮小即可，不能水平捲動；卡片四角的字不可互相重疊（太擠就縮字）。
- 繁中字串禁簡體。
- 技能的工藝規則全部適用：實心不透明、四色陰影、只有一個 lit、線條一定結束在東西上、管線不穿過任何東西、交叉照真實深度、曲面平滑不出階梯、紋理結束在邊上或淡出、螺絲是小點加圈。

## 5. verification（跑完把結果原文貼回報告；任何一項沒過就繼續修，不准回報完成）
1. `node scripts/build_espresso_machine.mjs` 成功，重跑兩次 `public/espresso-machine.js` 的 sha256 相同。
2. `node scripts/build_espresso_machine.mjs --audit` 最後一行是 `audit passed`，每一個失敗計數都是 0。
3. 線條檢查：`node C:/Users/Charles/.claude/skills/jixietu/scripts/lines.mjs D:/Temp/claude/espresso_jixietu/preview.html --out D:/Temp/claude/espresso_jixietu/lines.png` 印出 `line ends: 0`；`preview-light.html` 同樣。
4. 截圖（用技能的 `scripts/capture.mjs`，產物都放 `D:/Temp/claude/espresso_jixietu/shots/`）：桌機深色、桌機淺色、手機 390 寬、以及至少 10 張 4 倍特寫（粉餅、壓力錶、溫控螢幕、鍋爐法蘭、管線每個接頭與交叉、沖煮頭、蒸氣管關節、磨豆機調整環、秤與杯、滴水盤格柵），深淺兩種主題都要。**每一張都要自己打開看**，看到線沒收尾、零件懸空、穿模、空白面、階梯狀陰影就修。報告裡列出每張檔名與看到什麼。
5. `node scripts/test_espresso_machine.mjs` 全過，至少測：
   - pressure 9 與 11 時錶針角度不同，且角度和 pressure 成線性（三點共線）。
   - temp、pressure、cup 三個顯示數字＝傳入值格式化後的字串；右下讀數同理。
   - grind 200 與 400 時：調整環角度不同；粉餅顆粒半徑不同。
   - channel 0.1 時裂縫看不到、0.5 時看得到。
   - cup 0 與 36 時杯中液面高度不同。
   - t=0、t=shotTime/2、t=shotTime 時液柱分別是 隱藏／顯示／隱藏，拉桿位置對應改變。
   - 缺欄位的 state 不拋錯。
   - 被測的節點必須是畫面上真的看得到的那些（不准用替身節點讓測試通過）。
6. 舊版的整合沒壞：`node -e "require('./public/espresso-machine.js')"` 不報錯；`grep -n "EspressoMachine" public/espresso-lab.js` 的呼叫方式和新介面相容。
7. 報告最後列：零件總數（solid 數與 path 數）、產物大小（原始／gzip）、哪些項目沒做到與原因。

## 6. 分段（每次派工只做其中一段，做完那段的驗收就停）
- **A 段**：靜態機器。零件清單全部畫完、卡片、圖例、說明、兩個預覽頁、`--audit` 到 `audit passed`、§5 第 1、2 項。會動零件先畫在固定 state 的位置，但建置時就要把它們放進預留的繪製順序槽位。
- **B 段**：會動零件接上 `update(state)`、主題切換、`VERSION='2.0.0'`、§5 第 5、6、7 項。
- **C 段**：主對話另派看圖的代理跑 §5 第 3、4 項，把問題清單寫到 `D:/Temp/claude/espresso_jixietu/review.md`，再派你照清單修（最多兩輪）。**你不用自己截圖看圖**；但每段結束時 `--audit` 與測試仍要全綠。
