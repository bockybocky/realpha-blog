# 規格：烘豆機實驗室（會動的烘豆機＋烘焙曲線模擬）

比照已上線的濃縮咖啡實驗室（`specs/espresso-machine-jixietu.md`、`public/espresso-machine.js`、`public/espresso-lab.js`、`scripts/build_espresso_machine.mjs`），做一台「側板拆掉、看得到滾筒和火」的商用小型滾筒式烘豆機，加上一個四條公式的烘焙模擬。**兩條線平行：M 線（機器圖）與 L 線（模擬＋實驗室互動），各改各的檔，只靠 §3 的介面接起來。**

工作資料夾：`D:/Temp/claude/roaster_jixietu/`（報告、預覽頁、截圖、備份都放這裡）。

## 0. 動手前要讀的東西
- 技能本體：`C:/Users/Charles/.claude/skills/jixietu/SKILL.md` 與 `references/craft.md`、`kit.md`、`motion.md`、`verify.md`（M 線必讀；L 線只需讀 §3）。
- 範本（照著抄結構，不要從零發明）：
  - M 線：`scripts/build_espresso_machine.mjs`（工具包匯入方式、預留繪製順序槽位、`--audit`、預覽頁、主題切換、`em-` 前綴樣式注入）、`scripts/test_espresso_machine.mjs`。
  - L 線：`public/espresso-lab.js`（滑桿、預設按鈕、兩張折線圖、hover、播放、`mount`／掛機器的方式）、`scripts/test_espresso_model.mjs`。
- 工具包已在 `scripts/vendor/jixietu/`（iso-kit／lathe／tube／audit），**不准改 vendor 裡的檔**。

## 1. objective
讀者拖四個滑桿（投豆溫度、火力、風門、出豆溫度），看到：①一台會跟著動的烘豆機；②豆溫曲線與升溫速度曲線；③轉折點、脫水結束、一爆、出豆的時間，發展時間比例，烘焙深淺。按「▶ 烘焙」把一整鍋（約 10–12 分鐘）壓縮成約 15 秒播放。
這是**教學模型，看方向不預測**；所有常數寫在檔頭一個 `PARAMS` 物件裡並附註解。

## 2. 模型（L 線實作，釘死形狀，常數由你校準到 §5 的目標）
時間步長 1 秒，從 t=0（投豆）跑到出豆或 1200 秒為止。
輸入：`charge`（投豆溫度，170–230°C，預設 200）、`power`（火力，20–100%，預設 70）、`airflow`（風門，0–100%，預設 50）、`drop`（出豆溫度，205–235°C，預設 215）。生豆起始 25°C、含水率 11%。

1. **加熱（集總式）**：`dB/dt = k·(Ta − B) − 蒸發吸熱 + 一爆放熱 − 一爆後吸熱`。
   - 熱風溫度 `Ta = a0 + a1·power − a2·(airflow − 50)`，再加上滾筒蓄熱：`+ (charge − 200)·c1·exp(−t/τd)` 加上一個與 charge 成正比、隨時間衰減的蓄熱項。
   - 傳熱係數 `k = k0·(0.85 + 0.3·airflow/100)`（風大傳熱稍快，但熱風溫度被拉低）。
2. **脫水**：豆溫 > 100°C 且含水率 > 0 時，蒸發吸熱與 `(B − 100)` 及剩餘水分成正比；水分隨之下降。豆溫到 160°C 記為「脫水結束」。
3. **一爆**：豆溫第一次 ≥ 196°C 記為一爆開始。之後約 60 秒內先有短暫放熱再有吸熱（水氣與二氧化碳釋放），整體效果是升溫速度在一爆後明顯下降；一爆開始後若升溫速度 ≤ 0 記「烘焙卡住」。
4. **探針讀數與烘焙深淺**：畫面上的豆溫是探針讀數 `P = B + (charge − B)·exp(−t/τp)`（τp≈25 秒），所以投豆後讀數先降後升，最低點＝**轉折點**。升溫速度 `ror` ＝探針讀數 30 秒視窗的斜率，單位 °C/分鐘。烘焙深淺由出豆時豆溫決定：<210 淺焙、210–219 中焙、220–227 中深焙、≥228 深焙；另給一個 0–1 的 `roast` 指數（從 150°C 起累積，出豆溫 205→0.15、235→1.0 左右），給機器畫豆子顏色用。

輸出（`model(input)` 回傳）：`curve`（每秒 `{t, bean, ror, phase}`，`phase` ∈ `'drying'|'maillard'|'development'|'cooling'`）、`turning {t, temp}`、`dryEnd`、`firstCrack`、`dropTime`、`dtr`（(dropTime − firstCrack)/dropTime）、`level`、`roast`、`warnings`（陣列，可能值：`'stall'` 卡住、`'underdev'` 發展時間比例 < 15%、`'overdev'` > 25%、`'never'` 1200 秒內到不了出豆溫度、`'scorch'` 投豆溫度 ≥ 225 且火力 ≥ 85 時豆表可能焦）。

## 3. 介面（兩線共同合約，釘死）
```js
window.RoasterMachine = {
  mount(container, { lang }) -> { update(state) },   // lang === 'en' 用英文，其他一律繁中
  VERSION                                             // '1.0.0'
}
```
`state` 欄位（缺欄位用括號裡的預設，不准拋錯）：
| 欄位 | 意義 | 預設 |
|---|---|---|
| `t` | 目前秒數（0＝投豆前一刻；播放中遞增） | 0 |
| `power` | 火力 0–100 | 70 |
| `airflow` | 風門 0–100 | 50 |
| `bean` | 探針豆溫 °C | 200 |
| `ror` | 升溫速度 °C/分 | 0 |
| `roast` | 0–1 烘焙指數 | 0 |
| `phase` | `'idle'|'drying'|'maillard'|'development'|'cooling'` | `'idle'` |
| `crack` | 0–1，一爆熱鬧程度（一爆開始後 60 秒內 >0） | 0 |
| `elapsed` | 顯示用 `m:ss` 字串 | `'0:00'` |

L 線在每次滑桿變動與播放的每一幀呼叫 `machine.update(state)`；靜止時送 `t = dropTime`、`phase = 'cooling'` 的最後一幀（讀者一打開就看到烘好的狀態）。

## 4. M 線：機器（Grok）
### 會動的零件 ↔ 輸入（一對一，不准多也不准少）
| 輸入 | 零件 | 怎麼動 |
|---|---|---|
| `t`、`phase` | 滾筒前蓋上的攪拌葉片（從觀察窗看得到）與滾筒端蓋的輻條 | 角度＝`t × 360/0.9`（每 0.9 秒一圈，約每分鐘 67 轉；一般滾筒每分鐘 60–75 轉）；`idle` 不轉 |
| `power` | 滾筒下方瓦斯燃燒器的火焰（剖面看得到） | 火焰高度與 power 線性；強調色 `#d97706` 透明度隨 power |
| `airflow` | 機身側面風門拉桿 | 拉桿角度與 airflow 線性（0→全關、100→全開，轉約 60°） |
| `bean`、`ror`、`elapsed` | 控制面板上的兩個小螢幕 | 一個顯示 `bean` 一位小數加 °C，一個顯示 `ror` 一位小數加 °C/分；面板角落小字 `elapsed` |
| `roast`、`phase` | 觀察窗裡的豆子（**唯一的 `lit` 主角**） | 顏色由生豆綠 `#9aa86a` → 黃 → 肉桂 → 棕 → 深棕 `#3b2416` 隨 roast 內插；`cooling` 時觀察窗裡的豆子隱藏 |
| `phase === 'cooling'` | 前方冷卻盤裡的豆子＋冷卻盤攪拌臂 | 冷卻階段豆子出現在冷卻盤（顏色同 roast）、攪拌臂轉動；其他階段冷卻盤是空的、臂不動 |
| `phase === 'idle'` | 頂部入豆斗裡的生豆 | 只有 idle 時入豆斗裡有生豆，其他階段是空的 |
| `crack` | 排氣管口的幾縷煙／觀察窗旁的小爆裂點 | 透明度＝crack |

### 零件清單（至少這些，可加不可少；每個零件都坐在另一個零件上）
- **底座與機架**：底板、四隻可調腳、機架立柱、側板（右側拆掉看得到內部）、四角螺絲、銘牌（刻三條字線）。
- **滾筒**：橫向車床圓筒（剖開看得到內部葉片）、前端蓋（輻條＋中心軸承）、後端驅動軸、皮帶輪與皮帶、馬達（車床圓柱＋散熱鰭片）。
- **前面板**：圓形觀察窗（玻璃框＋螺絲圈）、出豆門與把手、取樣勺插口（取樣勺插在裡面、有把手）。
- **加熱**：瓦斯燃燒器（一排火孔）、火焰、瓦斯管線（接頭、閥門旋鈕）、瓦斯壓力錶（刻度＋錶針，**錶針不動**，只是靜態零件）。
- **排氣**：滾筒後上方排氣管、風門與拉桿、旋風集塵桶（車床錐形桶＋出口小蓋）、煙囪。
- **入豆**：頂部入豆斗（車床錐形）、斗下閘門與小拉桿。
- **冷卻**：前方圓形冷卻盤（有孔的底網）、攪拌臂（兩到三支）、中心馬達座、出料小門。
- **控制面板**：兩個小螢幕（凹進面板、有邊框）、火力旋鈕、電源開關與指示燈。
- **主角**：觀察窗裡的豆子用 `lit`；火焰與發熱用 `#d97706`（只准用在火與熱）。

### 卡片
- `Fig 1`；標題 繁中「烘豆機，打開來看」／英文「A coffee roaster, opened up」；提示 繁中「拖下面的滑桿，機器跟著動」／英文「Drag the sliders below; the machine follows」；右下即時讀數一行：`203.4°C · 9.8°C/分 · 8:42`（英文 `°C/min`）。
- 圖例 4–6 個：觀察窗豆子、滾筒、火焰、風門、冷卻盤。畫面內不准引線標籤。
- 卡片下說明 繁中「火越大、風門越小，豆子升溫越快；觀察窗裡的豆色，就是下方曲線同一時刻的烘焙程度。」英文對應翻譯。

### M 線檔案（只准動這些）
- 新增 `scripts/build_roaster_machine.mjs`（產出 `public/roaster-machine.js`，支援 `--audit`；另寫預覽頁 `D:/Temp/claude/roaster_jixietu/preview.html`（深色）與 `preview-light.html`（淺色），固定 state：t=540、power=70、airflow=50、bean=203、ror=9.5、roast=0.45、phase='development'、crack=0.6）。
- 新增 `public/roaster-machine.js`（產物）、`scripts/test_roaster_machine.mjs`。
- 主題、樣式注入、`module.exports`、同頁 mount 兩次不互相干擾、`update` 只改屬性不重建 SVG——全部照 espresso 規格 §3 的做法（樣式前綴改 `rm-`）。
- 產物 ≤ 350KB（gzip ≤ 90KB）。相機仰角 24–34°，要同時看得到拆掉的側板內部（滾筒＋火）、正面觀察窗與控制面板、前方冷卻盤。卡片寬約 640。手機 360px 等比縮小不水平捲動。

## 5. L 線：模擬與實驗室（Codex）
### L 線檔案（只准動這些）
- 新增 `public/roaster-lab.js`：照 `public/espresso-lab.js` 的結構。掛在 `div[data-lab-demo="roaster"]`（`data-lang` 決定語言）。
  - 上方掛機器（`window.RoasterMachine` 存在才掛，不存在照常運作）。
  - 四個滑桿（§2 的範圍與預設）；預設按鈕：「標準中焙」（預設值）、「淺焙」（drop 207）、「深焙」（drop 230）、「火太小」（power 35）、「投豆溫太高」（charge 228、power 90）、「重設」、「▶ 烘焙」。
  - 兩張圖：①探針豆溫曲線（標出轉折點、脫水結束、一爆、出豆四個點，背景淡色分出脫水／梅納／發展三段）；②升溫速度曲線。都有 hover。
  - 數字列：轉折點（時間與溫度）、一爆時間、出豆時間、發展時間比例、烘焙深淺、提醒（warnings 翻成白話：卡住＝「一爆後升溫停了，豆子容易烘出悶、平的味道」；發展不足＝「一爆後太快出豆，容易有青草味和尖酸」；發展過頭＝「一爆後拖太久，甜感被苦味蓋過」；到不了＝「火力不夠，20 分鐘內到不了出豆溫度」；焦＝「投豆溫度和火力都太高，豆子表面可能先焦」）。
  - 播放：一整鍋壓成約 15 秒，曲線與機器同步；`prefers-reduced-motion` 時不自動播放、按 ▶ 直接跳到結束。
  - 繁中與英文兩套字串；繁中禁簡體。
  - 模型函式另外掛 `window.RoasterModel = { model, PARAMS }`，並 `module.exports` 給測試用。
- 新增 `scripts/test_roaster_model.mjs`。

### L 線校準目標（寫成測試，全過才算完成）
1. 預設（200/70/50/215）：轉折點 0:50–1:40、溫度 80–110°C；脫水結束 4:00–5:30；一爆 8:00–10:00；出豆 9:45–12:00；發展時間比例 17%–24%；`level` = 中焙；warnings 為空。
2. 單調性：火力 50 → 一爆比預設晚至少 90 秒；火力 90 → 一爆比預設早。投豆溫 220 → 轉折點溫度比預設高。出豆 207 → 發展時間比例比預設低；出豆 230 → 比預設高，`level` = 深焙。
3. 預設按鈕「火太小」至少觸發 `stall` 或 `never` 其中之一；「投豆溫太高」觸發 `scorch`。
4. 升溫速度在一爆後 60 秒內的平均值 < 一爆前 60 秒的平均值（一爆後下降）。
5. 同樣輸入跑兩次結果完全相同（無亂數）。
6. 沒有 DOM 時 `require('./public/roaster-lab.js')` 不報錯。

## 6. 共同禁令
- 禁改任何其他檔（特別是 `src/` 底下、`public/espresso-*`、`scripts/vendor/`）。`src/` 的接線由主對話做。
- 禁任何 git 指令（stash／checkout／restore／reset／add／commit 全禁）。禁 `npm run build`。禁 qmd。
- 純 SVG＋原生 JS，零外部套件、零網路請求。

## 7. 驗收（報告貼指令輸出原文）
- M 線：`node scripts/build_roaster_machine.mjs` 兩次產物 sha256 相同；`--audit` 最後一行 `audit passed`；`node scripts/test_roaster_machine.mjs` 全過（至少測：火焰高度隨 power 線性三點共線、風門角度隨 airflow 不同、兩個螢幕與右下讀數＝傳入值格式化字串、roast 0 與 1 時觀察窗豆色不同、cooling 時冷卻盤有豆且觀察窗沒有、idle 時入豆斗有豆、t 不同時葉片角度不同、缺欄位不拋錯；被測節點必須是畫面上真的看得到的那些）。線條檢查 `node C:/Users/Charles/.claude/skills/jixietu/scripts/lines.mjs D:/Temp/claude/roaster_jixietu/preview.html --out D:/Temp/claude/roaster_jixietu/lines.png` 印 `line ends: 0`（淺色同樣）。報告寫 `D:/Temp/claude/roaster_jixietu/reportM.md`，最後一行 `M_DONE` 或 `M_FAIL: 原因`；列零件數（solid／path）、產物大小（原始／gzip）。
- L 線：`node scripts/test_roaster_model.mjs` 全過；報告寫 `D:/Temp/claude/roaster_jixietu/reportL.md`，貼預設值跑出來的轉折點／脫水結束／一爆／出豆／發展時間比例／深淺，以及五個預設按鈕各自的結果一行；最後一行 `L_DONE` 或 `L_FAIL: 原因`。
