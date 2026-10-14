# 規格：義式濃縮調整實驗室（lab demo `espresso`）

## 1. objective
在部落格實驗室加一個互動 demo：讀者拖三個滑桿（研磨度、水溫、壓力），即時看到
①萃取率曲線 ②流速曲線 ③酸苦平衡圖，外加一句診斷建議。中英雙語、純前端、零外部套件、零網路請求。

## 2. files（只准動這些，其他一律不碰）
- 新增 `public/espresso-lab.js`：模型純函式＋掛載介面（IIFE，同 `public/sweetvox.js` 寫法）。
- 新增 `scripts/test_espresso_model.mjs`：node 跑的自檢。
- 修改 `src/content.config.ts`：lab 集合 `demo: z.enum([...])` 尾端加 `'espresso'`。
- 修改 `src/components/LabDemo.astro`：Props 型別加 `'espresso'`；加一個分支
  `demo === 'espresso' ? (<div data-lab-demo="espresso" data-lang={lang} class="demo-frame tool" aria-label={title}><script src="/espresso-lab.js" defer></script></div>)`，
  放在 `sweetvox` 分支前面。樣式全寫在 espresso-lab.js 自己注入的 `<style>`（加 class 前綴 `es-`），不改 LabDemo.astro 的 `<style>`。
- 修改 `src/components/SourceDisclosure.astro`：Props 型別加 `'espresso'`（順便補 `'sweetvox'`），`sources` 加 `'espresso'` 一段 15–25 行的核心公式摘錄（就是下方模型那幾行，含中文註解）。
- 禁改 `public/lab-demos.js`、禁 `git` 任何指令、禁跑 `npm run build`（我會跑）。

## 3. interfaces
`espresso-lab.js` 必須：
- `window.EspressoLab = { model, VERSION }`；並且 `if (typeof module !== 'undefined') module.exports = { model }`，讓 node 能 require。
- `window.mountEspresso(el)`；檔尾自動 `document.querySelectorAll('[data-lab-demo="espresso"]').forEach(mountEspresso)`（等 DOMContentLoaded 或 readyState 已完成）。
- 語言看 `el.dataset.lang`（`'en'` 或其他＝繁中）。所有介面字串兩套。

### 模型 `model({ grind, temp, pressure })`（固定：粉量 18 g、目標出杯 36 g、預浸 4 秒）
- grind：研磨粒徑 µm，滑桿 180–450，預設 300，步進 10（標籤：細 ← → 粗）
- temp：水溫 °C，86–96，預設 93，步進 0.5
- pressure：壓力 bar，6–11，預設 9，步進 0.5
```
// 壓力超過 9 bar 粉餅被壓得更密，多出的壓力只有一部分變成流速
Peff = pressure <= 9 ? pressure : 9 + (pressure - 9) * 0.35
// 達西定律簡化：流速 ∝ 粒徑平方 × 壓力
flow = 1.45 * (grind / 300) ** 2 * (Peff / 9)          // g/s，穩定段流速
shotTime = 4 + 36 / flow                                 // 秒（含預浸）
// 萃取：越細表面積越大、越熱溶得越快，接觸越久越接近上限
rate = 0.0447 * (300 / grind) * Math.exp(0.045 * (temp - 93))
EYmax = 28
EY(t) = EYmax * (1 - Math.exp(-rate * t))               // t 為秒
ey = EY(shotTime)                                         // 萃取率 %
tds = ey * 18 / 36                                        // 濃度 %
// 通道效應：太細又太高壓，水會鑽出裂縫，一邊過萃一邊沒萃到
channel = clamp((240 - grind) / 60, 0, 1) * clamp((pressure - 8.5) / 2.5, 0, 1)   // 0–1
eyEff = ey * (1 - 0.15 * channel)
// 酸苦：-1 = 很酸，0 = 平衡，+1 = 很苦；溫度高會額外偏苦
balance = clamp((eyEff - 20) / 4 + (temp - 93) * 0.06, -1, 1)
taste = {
  sour:   clamp(0.5 - balance * 0.6 + channel * 0.3, 0, 1),
  sweet:  clamp(1 - Math.abs(eyEff - 20) / 4 - channel * 0.4, 0, 1),
  bitter: clamp(0.5 + balance * 0.6 + channel * 0.3, 0, 1),
  body:   clamp((tds - 7) / 5, 0, 1)
}
zone = eyEff < 18 ? 'under' : eyEff > 22 ? 'over' : 'ideal'
```
回傳 `{ flow, shotTime, ey: eyEff, tds, channel, balance, taste, zone, curve }`；
`curve` = 從 0 到 shotTime 每 0.5 秒一點 `{ t, ey, flow, cup }`：
預浸 0–4 秒 flow 從 0 線性升到 0.3；4 秒後 6 秒內線性升到 `flow`；其後每秒 +1.2%（粉餅被沖開）。
`cup` = flow 對時間積分（克）；`ey` 用 EY(t)×(1−0.15×channel)。shotTime 改成 cup 第一次達到 36 g 的時間（以曲線為準，覆蓋上面的估算），ey/tds/balance 用這個時間重算。

## 4. constraints（介面）
- 版面：上方三個滑桿（每個旁邊即時顯示數值＋單位），三個預設按鈕：「太酸（萃取不足）」=grind 380/temp 89/pressure 9、「平衡」=300/93/9、「太苦（過萃）」=210/95.5/10.5，再一個「重設」。
- 數字列四格：萃取率 %、流速 g/s、萃取時間 秒、濃度 %（萃取率旁標「理想 18–22%」）。
- 圖一「萃取率隨時間」：純 SVG（viewBox 寬 640），x=時間 0 到 max(60, 無條件進位到 10 的倍數的 shotTime) 秒、y=萃取率 0–28%；18–22% 畫淡色帶；曲線畫到 shotTime，終點畫圓點並標數值；shotTime 處畫垂直虛線標「停止」。
- 圖二「流速與杯中重量」：同 x 軸；左軸流速 0–4 g/s（實線），右軸杯重 0–40 g（另一色虛線），36 g 畫水平參考線。
- 圖三「酸苦平衡」：橫向量尺，左端「酸」右端「苦」，中間 1/3 標「甜區」，指針放在 balance；下方四條橫條：酸／甜／苦／醇厚（0–1）。
- 一句診斷（`role="status" aria-live="polite"`）：under→「偏酸、萃取不足：試著研磨調細一點，或水溫提高 1–2 度。」；over→「偏苦、過度萃取：試著研磨調粗一點，或水溫降低 1–2 度。」；ideal→「落在理想區間，酸甜苦平衡。」；channel>0.3 另加一句「粉太細又壓太大，水可能鑽出裂縫（通道效應），同一杯會又酸又苦。」英文版對應翻譯。
- 底部小字：「這是簡化的教學模型，用來看方向，不是精準預測；實際還要看豆子、烘焙度與機器。」（英文同義）
- 配色只用 CSS 變數 `var(--accent)`、`var(--muted)`、`var(--line)`、`var(--text)`、`var(--paper)`，第二色固定 `#d97706`；深色模式靠變數自動跟。手機寬 360px 不能水平捲動（SVG 用 width:100%）。
- 拖滑桿用 `input` 事件即時重畫；不用 canvas、不用外部函式庫。
- 繁中字串禁簡體字。

## 5. verification（你必須跑完並貼結果）
1. `node scripts/test_espresso_model.mjs` 全過，至少斷言：
   - 預設 300/93/9：shotTime 在 25–32 秒、ey 在 19–21.5、zone='ideal'。
   - 太酸預設：zone='under'，balance<0。
   - 太苦預設：zone='over'，balance>0，channel>0.3。
   - grind 越細 flow 越小（單調）；temp 越高 ey 越高（單調）；pressure 從 9 到 11，flow 增幅小於 6→8 的增幅。
   - curve 最後一點 cup ≥ 36 且 < 37.5。
2. `node -e "require('./public/espresso-lab.js')"` 不報錯（DOM 不存在時不能炸）。
3. `node -e "const s=require('fs').readFileSync('src/content.config.ts','utf8');if(!s.includes(\"'espresso'\"))process.exit(1)"` 回 0。

## 6. 追加：接咖啡機解剖圖（另一條線在做 `public/espresso-machine.js`，你不要寫它）
- LabDemo.astro 的 espresso 分支改成先載 `<script src="/espresso-machine.js" defer></script>` 再載 `/espresso-lab.js`。
- mount 時在滑桿上方建 `<div class="es-machine"></div>`；若 `window.EspressoMachine` 存在就
  `const m = window.EspressoMachine.mount(div, { lang })`，不存在就隱藏這個 div（不能報錯）。
- 每次重算後呼叫 `m.update({ grind, temp, pressure, flow, cup: 36, t: shotTime, shotTime, channel, zone })`——值全取自同一次 model() 結果。
- 加一個「▶ 萃取」按鈕：用 requestAnimationFrame 在 3 秒內把 t 從 0 播到 shotTime，每格從 curve 內插取 `{flow, cup, ey}`，
  同時更新機器（update 的 flow/cup/t 用當格值）、圖一圖二上的移動游標點、數字列的「萃取時間」與「杯重」。播放中拖滑桿就停止播放並回到終點狀態。
- 驗收追加：`node scripts/test_espresso_model.mjs` 另斷言 curve 內插函式在 t=shotTime 回傳 cup≈36（誤差 0.5 內）。
