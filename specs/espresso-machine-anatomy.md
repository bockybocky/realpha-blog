# 規格：義式咖啡機解剖圖（anatomy 風格，接進 lab demo `espresso`）

## 1. objective
照 `C:/Users/Charles/dev/anatomy-ref`（MIT，wheresryan22/anatomy）的範例風格，畫一台**等角立體、會動的義式咖啡機剖面圖**，
放在實驗室 demo 最上方。原則「物件本身就是解釋」：讀者拖滑桿時，機器上對應的零件跟著動——
- 水箱 → **鍋爐**（水溫）：鍋爐上的溫度計刻度與數字跟 temp；溫度越高鍋爐發熱線越亮（只用透明度，不加特效）。
- **幫浦＋壓力錶**（壓力）：錶針角度＝pressure（0–12 bar 刻度，8–10 標綠區），錶面數字同值。
- **沖煮頭＋把手＋粉餅剖面**（研磨度）：粉餅剖面畫一排顆粒，顆粒半徑隨 grind 變（細＝小而密、粗＝大而疏）；channel>0.3 時粉餅上畫 1–2 道裂縫線。
- **咖啡液流＋杯子**（流速）：液流線寬隨 flow；杯中液面高度＝cup 克數 / 40；杯旁標「NN.N g」。
參考範例先讀 `examples/dial-indicator/build.mjs`（結構最小）、`examples/turning-dial/live.js`（會動的部分怎麼接）、`kit/iso-kit.mjs`、`references/kit.md`、`references/craft.md`。

## 2. files（只准動這些）
- 新增 `scripts/vendor/anatomy-iso-kit.mjs`：從 anatomy-ref 複製需要的 kit（檔頭保留 MIT 授權與出處 commit e6600ff）。
- 新增 `scripts/build_espresso_machine.mjs`：node 跑，用 kit 產出靜態 SVG，寫成 `public/espresso-machine.js`（把 SVG 字串內嵌進去＋會動部分的程式）。要能重跑、輸出一致。
- 新增 `public/espresso-machine.js`（產物，也要進版控）。
- 新增 `scripts/test_espresso_machine.mjs`：見驗收。
- 禁改其他任何檔；禁 git 任何指令；禁 `npm run build`。另一條線同時在寫 `public/espresso-lab.js`、`src/components/*`、`src/content.config.ts`，不要碰。

## 3. interfaces（介面合約，釘死）
```js
window.EspressoMachine = {
  mount(container, { lang }) -> { update(state) },   // lang: 'en' 或其他＝繁中
  VERSION
}
// state 全部由 espresso-lab.js 的同一次 model() 結果給，同一瞬間同一來源：
state = { grind, temp, pressure, flow, cup, t, shotTime, channel, zone }
```
- `mount` 在 container 裡插入 `<svg viewBox="0 0 640 400" width="100%" role="img" aria-label="...">`，回傳物件。
- `update` 只改屬性（transform／opacity／d／textContent），不重建整張 SVG；一秒呼叫 60 次也要順。
- **畫面上每個數字（溫度、壓力、杯重）都直接取自 state 同一欄位、同一次呼叫**，禁另算、禁平滑落後（anatomy「同源讀數」守則）。
- 零件標籤（繁中／英文兩套）：水箱／鍋爐／幫浦／壓力錶／沖煮頭／粉餅／杯子；Water tank／Boiler／Pump／Gauge／Group head／Puck／Cup。標籤用細引線指到零件。
- `if (typeof module !== 'undefined') module.exports = { ... }`，沒有 DOM 時 require 不能炸。

## 4. constraints
- 純 SVG＋原生 JS，零外部套件、零網路請求、不用 canvas／WebGL。產物檔 ≤ 120KB。
- 配色：kit 的明暗色調改用 CSS 變數 `var(--text)`、`var(--muted)`、`var(--line)`、`var(--paper)`、`var(--accent)`，咖啡液與鍋爐發熱用 `#d97706`，部落格深淺色模式自動跟。樣式寫在注入的 `<style>`，class 加 `em-` 前綴。
- 零件數量 15–30 個就好（不是 anatomy 的 40 個門檻），重點是比喻一對一：每個會動的零件對應一個滑桿或一個結果。
- 手機寬 360px 時標籤不可互相重疊（太擠就縮字或省略次要標籤）。
- 繁中字串禁簡體。
- 每個特效問「刪掉它解釋還成立嗎」，成立就刪。

## 5. verification（跑完貼結果）
1. `node scripts/build_espresso_machine.mjs` 成功，重跑兩次產物 `sha256` 相同。
2. `node scripts/test_espresso_machine.mjs` 全過，至少：用最小假 DOM（或 jsdom 若已裝；沒裝就自己寫極簡 stub，不准新裝套件）呼叫 mount＋update：
   - pressure 9 與 11 時錶針 transform 角度不同，且角度與 pressure 成線性。
   - 溫度、壓力、杯重三個文字節點內容＝傳入 state 的值（格式化後）。
   - cup 0 與 36 時液面高度不同；grind 200 與 400 時顆粒半徑不同。
   - channel 0.1 時裂縫隱藏、0.5 時顯示。
3. `node -e "require('./public/espresso-machine.js')"` 不報錯；`wc -c public/espresso-machine.js` ≤ 122880。
4. 不准用替身形狀讓測試通過（測的節點必須是畫面上真的看得到的那些）。
