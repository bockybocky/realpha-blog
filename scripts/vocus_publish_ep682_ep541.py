# -*- coding: utf-8 -*-
"""股癌 EP682 ／ 財報狗 EP541 兩篇心得 → 方格子（lexical JSON + vocus HTML）。

用法：python vocus_publish_ep682_ep541.py [gooaye-ep682|caibaogou-ep541] [--publish]
草稿與封面由 vocus_prep_ep682_ep541.py 準備（articleId / imgUrl 存在 vocus_ids.json）。
節點與 API 慣例沿用 vocus_publish_gooaye_ep681.py。
"""
import json, math, sys, datetime, re, os
import urllib.request

SP = r'D:\Temp\claude\C--Users-Charles\09bc9574-f278-41fb-8634-8a571e39c551\scratchpad'
TOK = open(os.path.join(SP, 'vocus_token.txt'), encoding='utf-8').read().strip()
IDS = json.load(open(os.path.join(SP, 'vocus_ids.json'), encoding='utf-8'))
CATEGORY = {'_id': '5a978e00fd897800016874cc', 'title': '投資理財', 'score': 0}
BLOG = 'https://blog.getrealpha.com'

DISCLAIMER_GOOAYE = ('本文為個人聽 Podcast 後的教育性心得與反思，非節目官方內容，也不構成任何個股買賣建議、'
                     '不提供目標價、不針對當期標的。文中提及之公司僅為節目內容或概念說明之脈絡。'
                     '投資有風險，任何決策請自行研究判斷或諮詢合格的專業人士。')
DISCLAIMER_CBG = ('本文為個人聽 Podcast 後的教育性心得與反思，非財報狗官方內容，也不構成任何個股買賣建議、'
                  '不提供目標價、不針對當期標的。文中提及之公司僅為節目內容或概念說明之脈絡，'
                  '相關技術時程與數字為節目所述，未經獨立查證。'
                  '投資有風險，任何決策請自行研究判斷或諮詢合格的專業人士。')

ARTICLES = {
'gooaye-ep682': {
 'title': '聽股癌 EP682：一場找不到利空的下殺，該怎麼讀',
 'abstract': ('股癌 EP682 的核心觀察：這波急殺找不到明確的總經或產業利空，比較像四五月過熱後的估值修正。'
              '我加上三個延伸——為什麼「報價不漲」不等於「獲利轉差」、機械訊號和股價敘事背離時該信哪一邊，'
              '以及均線當停損跟當選股訊號是兩件事。'),
 'tags': ['股癌', '估值修正', '風險管理'],
 'blocks': [
  ('img',),
  ('poem_lines', ['行到水窮處，', '坐看雲起時。', '—— 王維《終南別業》（唐）']),
  ('p_italic', '這是我聽股癌 EP682（2026-07-25 上架）的個人聽後心得，不是逐字稿、也不是節目官方內容。想聽完整脈絡請直接支持原節目。以下是節目給我的啟發，加上我自己的整理。'),
  ('h3', '這集在講什麼'),
  ('p', '一句話：**這波急殺，找不到人負責。**'),
  ('p', '平常大盤重挫，事後總能指認一個兇手——升息、財報爆雷、地緣衝突。但這一次翻遍總經和產業，找不到明確利空。主委的定位很直接：這比較像四、五月過熱之後的估值修正，跟去年三月那次同源。修正的力道確實兇，一些設備和板材股被殺到本益比剩不到十倍。'),
  ('p', '他形容這種行情像在玩魂系遊戲——你不會死於一個明確的失誤，你死於無數次「還可以再撐一下」。所以處方不是找答案，是降低交易頻率、把現金水位拉高，並且承認一件事：當好財報、好基本面的股票依然被無差別拋售時，就不該再執著用基本面解釋股價。'),
  ('h3', '摘要重點'),
  ('ul', [
   '**急殺是估值修正，不是基本面轉折。** 找不到總經或產業利空，就不要硬編一個。四五月漲太多，現在還回去。',
   '**AI 軟體的成本結構跟過去的軟體不一樣。** 傳統軟體是寫一次賣一萬次，邊際成本趨近於零；現在的模型每一次推論都在燒 token 運算成本。在算力大幅降價之前，企業端得先承受毛利被擠壓。',
   '**雲端巨頭的資本支出是生存戰，不是選配。** 主委的比喻是玩大富翁買地——現在不砸錢圈算力，未來就沒有話語權。用「花太多錢」去看 CSP 的資本支出，可能看錯了問題。',
   '**記憶體第四季報價預期收斂到持平。** 推測是暴利水準引來政府側目而踩了煞車。提醒是：市場很可能因為「報價不漲」而錯殺，但原廠實際上仍在極高毛利的狀態。（**發布後查核補註**：這是節目的少數派判讀。同期外部賣方共識仍預期第四季合約價續漲、只是幅度收斂——例如六月底有大型券商估第四季還有三到四成的季增。「持平」與「續漲但減速」差距很大，別把單一來源的判讀當成已定案的事實。）',
   '**電子零組件的基本面沒有改變。** 功率元件、被動元件、載板這幾條供應鏈，市場報價依然在漲，近期重挫純粹是被大盤環境拖累。',
   '**節目脈絡裡點到的公司**：Google 的財報和雲端數字證明 AI 是能賺錢的；Apple 靠終端黏著度處在不必立刻硬拼底層模型的位階；Tesla 的實體 AI 與機器人屬於需要信仰的長線賽道；德州儀器的財報指出資料中心需求全面復甦並開始調漲價格；Palantir 因為專做高門檻法遵專案而幾乎沒有競品。這些都只是節目內容的轉述脈絡。',
   '**操作面的兩句話**：一，看不懂就少做，抱現金也是策略，無差別下殺時頻繁換股容易兩面挨巴掌。二，用技術面設防呆停損，等型態重新站回主要均線再說。',
  ]),
  ('h3', '延伸想法'),
  ('p', '**一、市場交易的是變化率，不是水位。**'),
  ('p', '記憶體那段是這集最值得咀嚼的地方。報價從「猛漲」變成「持平」，聽起來像壞消息；但原廠的毛利率並沒有從高處掉下來，只是不再往上加速。市場的定價機制對「二階導數」極度敏感——不是賺多少，是比上一季多賺多少。'),
  ('p', '這帶出一個很實用的判讀習慣：當你看到一則新聞讓你直覺不安時，先問自己「這是水位變差了，還是只是變好的速度慢下來？」兩者對股價的短期影響可能一樣兇，但對持有邏輯的意義完全不同。前者要重新檢查論點，後者只是要重新檢查你的持有期限。'),
  ('p', '**二、當可查證的機械訊號和股價敘事打架時，我選擇先相信可查證的那一邊。**'),
  ('p', '這集有個很漂亮的對照組：零組件的市場報價還在漲、德州儀器直接在財報裡說資料中心需求全面復甦而且開始漲價——這些是可以查、可以追、有第三方紀錄的機械事實。而股價在跌。'),
  ('p', '我這半年一直在練的一件事，就是把「可查證的數字」和「我對盤面的印象」分開放。印象是最容易被最近三天的紅綠棒污染的東西；報價、營收、財報的措辭則不會因為你昨天賠錢而改變。這不代表機械訊號能告訴你什麼時候會漲——它不能——但它能告訴你「基本面是否真的變了」，而這正是你在下殺中最需要、也最容易搞錯的判斷。'),
  ('p', '分開放之後，決策會變得比較誠實：如果數字沒變、只是價格變了，那你面對的是一個「要不要忍受波動」的問題，而不是一個「論點是不是錯了」的問題。這兩個問題該用完全不同的方式處理。'),
  ('p', '**三、均線當停損工具，和均線當進場訊號，是兩件事。**'),
  ('p', '節目建議在這種行情用均線設防呆停損。我想特別把這件事講清楚，因為我自己做過相反方向的驗證，結論看起來會跟節目衝突，但其實不衝突。'),
  ('p_cta', [('我測過均線交叉當作買賣訊號的效果，結論是沒有可交易的優勢（完整過程寫在', None),
             ('這裡', BLOG + '/blog/proving-ma-crosses-dont-work'),
             ('）。但這不代表均線沒有用途——它測的是「均線能不能預測未來報酬」，答案是不能；而防呆停損要的根本不是預測能力，是一條你事前就答應自己會遵守的線。它的價值在於把「我再撐一下」這個念頭從決策流程裡移除，跟它有沒有預測力完全無關。', None)]),
  ('p', '一個工具沒有預測力，不代表它沒有紀律價值。把這兩件事混在一起，就會犯兩種相反的錯：一種是拿均線去選股（以為它能預測），另一種是因為聽說均線沒用就連停損紀律都不要了。'),
  ('h3', '一句誠實邊界'),
  ('p', '這集的操作建議是「降低頻率、抱現金、等站回均線」。這類建議有一個結構性的特徵：**它在事後永遠看起來是對的**。市場繼續跌，你慶幸自己空手；市場反彈，你會說站回均線我就進場了。它幾乎無法被證偽。'),
  ('p', '我不是說這建議不好——在看不懂的行情裡減少動作，確實是勝率最高的一招。我只是提醒自己：凡是無法被證偽的建議，都不該拿來當作「我有在做決策」的證據。真正的決策需要一個事前寫下來、事後會被打臉的判準。少做、多等，是很好的執行紀律，但它本身不是判斷。'),
  ('h3', '可以參考的資料'),
  ('p_cta', [('原節目：《股癌 Gooaye》EP682（2026-07-25），各大 podcast 平台。上一集的心得寫在', None),
             ('這裡', BLOG + '/blog/gooaye-ep681-fundamentals-vs-price'),
             ('。', None)]),
  ('p_italic', DISCLAIMER_GOOAYE),
 ]},

'caibaogou-ep541': {
 'title': '財報狗 EP541 聽後心得：晶片變大之後，圓形晶圓開始不划算了',
 'abstract': ('聽財報狗 EP541 談面板級封裝的心得：AI 晶片體積暴增，讓「在圓形晶圓上切方形晶片」的面積浪費'
              '從小問題變成大問題。我整理技術脈絡與三大陣營佈局，並加上三個延伸——真正的門檻是翹曲、'
              '玻璃載板一石二鳥代表什麼、以及「2029 年才有貢獻」該怎麼用。'),
 'tags': ['財報狗', '先進封裝', '半導體'],
 'blocks': [
  ('img',),
  ('poem_lines', ['不以規矩，', '不能成方圓。', '—— 孟子《離婁上》（戰國）']),
  ('p_italic', '這是我聽財報狗 EP541（2026-07-26 上架，產業解析：面板級封裝 PLP 展望與競爭格局）的個人心得，不是逐字稿、也不是節目官方內容。想聽完整內容請直接支持原節目。'),
  ('h3', '這集在講什麼（一句話）'),
  ('p', '**幾何學終於開始收錢了。**'),
  ('p', '晶圓是圓的，晶片是方的。在圓形上切方形，邊角一定會浪費——這件事從半導體誕生就存在，過去沒人在意，因為晶片小，浪費的邊角也小。但 AI 改變了尺寸。當單顆晶片的封裝面積膨脹到光罩的數倍大，圓形載體的浪費就從「小數點後的損耗」變成「一半的產能」。'),
  ('p', '節目給的算式很有畫面：以目前這一代五點五倍光罩大小的 AI 晶片來算，一片十二吋晶圓大約只能切出九顆，面積利用率大概只有五成八——超過四成的面積是空的。於是自然的解法出現了：既然要放方形的東西，就換方形的載體，而且把它做大。這就是面板級封裝。'),
  ('h3', '摘要重點'),
  ('ul', [
   '**驅動力來自晶片變大，不是技術變好。** 面板級封裝不是「比晶圓級更高級」，這集特別澄清了這個誤解——「級」是分類不是等級。它現在才紅，純粹是因為晶片大到讓圓形載體不划算了。',
   '**真正的門檻叫翹曲。** 封裝要疊很多種材料，每種材料的熱脹冷縮係數不同。面積一大、又反覆進出高溫製程，整片板子就會變形，後續曝光的線路和通孔對不準。尺寸放大帶來的效益是線性的，翹曲帶來的難度不是。',
   '**圓形時代的製程工具在方形上會水土不服。** 塗布靠旋轉離心力讓厚度均勻，這招在方形上四角必然不均；電鍍時電荷也會集中在四個角。很多看起來只是「換個形狀」的事，實際上要重做一整套製程。',
   '**玻璃載板同時解兩個問題。** 玻璃的熱脹冷縮係數極低，可以壓住翹曲；同時用玻璃取代現行的有機樹脂材料，還能降低高頻訊號在傳遞過程的損耗。',
   '**三個陣營，三種節奏。** 面板廠帶著搬運大尺寸玻璃與薄膜塗布的老經驗，從對線寬要求較低的中低階切入，已經進入量產；封測廠佈局最久，節目提到有廠商從二〇一八年左右就投入，今年針對五百乘五百毫米的大尺寸產線大舉擴產，也有從三百乘三百毫米起步的；晶圓代工則主攻難度最高的高階，一邊研究把現有中介層製程搬到方形工作台並評估玻璃載板，一邊有廠商選了更激進的路線，想直接跳過現有中介層體系押注玻璃。',
   '**高階的錢在很後面。** 節目的估計是，高階面板級封裝大約要到二〇二九年前後才會有比較明顯的營收貢獻。',
  ]),
  ('h3', '延伸想法'),
  ('p', '**一、當一個產業的瓶頸從「性能」變成「幾何」，通常代表它進入了新的階段。**'),
  ('p', '過去二十年，半導體的敘事主軸都是線寬——把電晶體做小。這集講的東西完全不在那條軸上：它談的是形狀、面積利用率、材料的熱脹冷縮。當一個成熟產業開始為了幾何學重做基礎設施，代表原本那條主軸的空間變小了，價值正在往旁邊移動。'),
  ('p', '這對找瓶頸的人是個很有用的訊號。瓶頸不會永遠待在同一層——當所有人都盯著先進製程時，卡住產出的可能已經變成「怎麼把方的東西放平」。而後面這種問題，通常由完全不同的一群公司來解。'),
  ('p', '**二、玻璃同時解決兩個問題，這件事的意義比它聽起來大。**'),
  ('p', '一個新材料如果只解決一個問題，導入速度取決於那個問題有多痛；如果同時解決兩個原本不相干的問題（防翹曲、降訊號損耗），那導入的動機就會來自兩個不同的部門，阻力小得多。這種「一石二鳥」的材料替代，歷史上普遍比市場預期快。'),
  ('p', '但我會提醒自己踩一下煞車：採用意願快，不等於量產爬坡快。決定節奏的永遠是良率，而良率是最不容易從外部觀察、也最容易被公司樂觀描述的東西。所以合理的追蹤方式不是聽誰宣布了什麼，是看實際的資本支出有沒有真的落地、產線尺寸有沒有真的往上跳。'),
  ('p', '**三、「二〇二九年才有明顯貢獻」這種數字，是敘事的燃料，不是持有期限。**'),
  ('p', '半導體的技術時程表有個特性：它幾乎每一輪都會被修改，而且兩個方向都會。這不是因為誰在說謊，是因為在良率跨過門檻之前，時程本來就是估的。'),
  ('p', '問題在於市場會提前很多年交易這件事。一個二〇二九年才會貢獻營收的題材，二〇二六年就能推動股價——中間這三年，你持有的不是業績，是**時程沒有被延後**這個假設。這是我覺得這集最值得警惕的地方：不是「不能買趨勢」，而是要清楚自己買的到底是已經在收錢的中低階量產，還是還在實驗室裡的高階承諾。這兩者在新聞稿裡看起來很像，在財報上完全不同。'),
  ('h3', '一點心境'),
  ('p', '我越來越覺得，產業研究裡最有價值的不是「知道有這個趨勢」，而是「知道這個趨勢現在走到第幾步」。'),
  ('p', '面板級封裝就是很典型的例子。它同時是一個已經在量產出貨的生意（中低階）、一個正在試產的工程問題（高階），和一個還在選路線的材料賭注（玻璃）。這三件事共用同一個名詞，但風險屬性天差地別。市場討論時常常混在一起講，於是「這家有做面板級封裝」聽起來像一句話，實際上可能意味著三種完全不同的東西。'),
  ('p', '把一個熱門名詞拆回它的實際階段，大概是我目前覺得投資研究裡最划算的一件笨功夫。'),
  ('h3', '可以參考的資料'),
  ('p_cta', [('原節目：《財報狗投資實驗室》EP541（2026-07-26），各大 podcast 平台。前一篇財報狗心得寫在', None),
             ('這裡', BLOG + '/blog/caibaogou-ep539-upstream-chokepoint'),
             ('。想深入技術細節，可搜尋 panel level packaging、warpage、CTE mismatch、glass substrate 這幾個關鍵字。', None)]),
  ('p_italic', DISCLAIMER_CBG),
 ]},

'macromicro-ep208': {
 'title': '聽財經M平方 EP208：分清楚「長料」和「短料」，才知道 AI 循環走到哪',
 'abstract': ('財經M平方 After Meeting EP208 把下半年的砍單風險拆成長料與短料兩層：長料被砍只是製造業循環的波動，'
              '短料被砍才是大週期反轉。加上台積電庫存連兩季上升的雙義性，以及為什麼 Kimi K3 這次沒有引爆 DeepSeek 時刻。'),
 'tags': ['財經M平方', '庫存循環', '總經'],
 'blocks': [
  ('img',),
  ('poem_lines', ['橫看成嶺側成峰，', '遠近高低各不同。', '—— 蘇軾《題西林壁》（宋）']),
  ('p_italic', '這是聽財經M平方 After Meeting EP208（2026-07-26 上架，《修估值後財報季登場，AI 的市場考驗開始》）的個人心得，不是逐字稿、也不是節目官方內容。想聽完整內容請直接支持原節目。'),
  ('h3', '這集在講什麼'),
  ('p', '七月初開始的那一波估值修正，修到七月二十號左右看起來告一段落，市場正要交棒給財報季，讓基本面說話——結果美伊衝突又把油價拉起來。所以這集談的是一個交接時刻：**焦點從「預期」走向「驗證」**。'),
  ('p', '但真正值得寫下來的不是行情回顧，是研究團隊給的一把尺。他們把下半年的風險拆成三層，而且刻意分清楚哪些是「會讓循環波動」的，哪些是「會讓循環反轉」的。這個區分，比任何多空結論都有用。'),
  ('h3', '摘要重點'),
  ('ul', [
   '**總經目前還撐得住。** 油價因為地緣衝突回到八十美元以上、一度逼近九十，而且美國原油庫存已經低於二〇一八年以來七月同期的最低水準，正好又碰上夏季用油旺季。但六月消費數據異常強勁（零售銷售年增超過六%），六月的通膨則低於預期，核心商品與扣除房租的服務通膨都是負貢獻——不是變慢，是衰退。這給了地緣風險一些緩衝空間。',
   '**消費數據有失真，要記得扣掉。** 節目點出強勁的消費有一部分來自世界盃：對比五、六月的信用卡消費，增幅幾乎集中在主辦城市。排除主辦城市後其他城市大致持平。這種主動扣噪音的習慣，是這個節目最值得學的地方。',
   '**南韓那一段是活的槓桿教材。** 場外信貸借錢買股，再拿這筆錢去買槓桿型 ETF，然後還開融資——槓上加槓再加槓。下跌時就是三重壓力同時收縮。而政府為了防止散戶受傷做的一系列動作（調高保證金、限制槓桿商品、七月升息），反而把賣壓推得更大。韓股從高點下來跌了將近兩成——這是節目七月二十四日錄製、市場剛止穩時的口徑；若改以最大回落計，韓國大盤自六月中的高點一度回落約三成，七月單月更是有紀錄以來最差的月線。',
   '**台積電法說全數超前，股價卻跟著供應鏈一起跌。** 市場擔心的是先進製程量產初期對毛利率的壓力，財測也提到 N2 爬坡可能稀釋三到四個百分點。節目的判讀是這屬於短期擔心，因為 N3 需求強勁有機會抵銷，而且公司強調「客戶成功」的定價策略，本來就不會像記憶體廠那樣激進漲價。',
   '**真正被忽略的訊號是台積電庫存連續兩季上升。** 市場討論還很少。因為現在製造業處在「主動補庫存」階段，庫存上升可以解讀成訂單搶進；但下一步就是「被動補庫存」，那代表高檔轉弱。同一個數字，兩種意思。',
   '**下半年的三個風險，兩短一長。** 第一，資料中心缺電缺地造成晶片交付遞延、供應鏈庫存堆積，觀察哨是伺服器組裝廠的庫存，一旦大量堆積就可能由下往上砍「長料」。第二，消費性與車用需求疲軟——今年只有高階機種在撐、中國補貼退場、車市更弱，終端面對上游漲價又轉嫁不動時，會回頭砍單。第三，也是最大的：如果 AI 應用推進的速度追不上效能膨脹的速度，最後就是資本支出下修，連「短料」都被砍。節目把第三個風險的觀察窗口放在二〇二八到二〇三〇年。',
   '**Kimi K3 這次沒有引爆恐慌，原因值得記下來。** 它的評測水準已經接近最前沿的模型，價格卻只有三成左右。但它「便宜」不代表「小」：兩點八兆參數，光模型權重就要約 1.4TB 記憶體，塞不進單機，必須用機櫃等級的硬體，而且權重拆在多顆晶片上同時運算，非常吃通訊頻寬。所以模型變便宜，硬體需求反而更硬。',
   '**AI 五層蛋糕的利潤在重新分配。** 節目的框架是能源、晶片、模型、基建、應用五層。開源模型壓縮的是「模型層」的定價權與估值溢價，但價格下降釋放出來的利潤會流向應用層（能用更多 token）與基建層（模型免費，跑模型的基礎設施在收錢）。某一層受損，往往是另一層受益。',
  ]),
  ('h3', '延伸想法'),
  ('p', '**一、「長料 vs 短料」是這集送的最好用的一把尺。**'),
  ('p', '大多數關於 AI 的多空爭論之所以吵不出結果，是因為雙方講的根本不是同一件事。有人說「庫存要爆了」，有人說「需求還很強」，兩邊可能都對——只要把料件分成兩種就講得通：普通零組件（長料）已經開始堆積，而真正緊缺的關鍵料（短料）還沒鬆動。'),
  ('p', '這把尺的價值在於它給了**觀察順序**，而不是結論。先看伺服器組裝廠的庫存有沒有大量堆積，再看終端品牌轉嫁得動漲價與否，最後才看資本支出指引有沒有真的下修。前兩者鬆動只代表循環波動，第三個鬆動才代表趨勢轉向。一個能排序的框架，比十個看多看空的口號有用。'),
  ('p', '**二、庫存數字本身沒有方向，它需要一個配對變數。**'),
  ('p_cta', [('台積電庫存連兩季上升，在主動補庫存階段是好消息，在被動補庫存階段是壞消息。所以單看庫存永遠得不到答案——你必須同時知道需求端在做什麼。這跟', None),
             ('前一篇聽股癌的心得', BLOG + '/blog/gooaye-ep682-no-bad-news-selloff'),
             ('裡寫的「市場交易的是變化率不是水位」其實是同一個毛病的兩種形狀：一個數字要有意義，得先知道它跟哪個變數配對。', None)]),
  ('p', '實務上這代表一件事：看到任何單一指標翻轉就下結論，八成會錯。庫存、毛利率、資本支出，這些數字都至少有兩種讀法，決定讀法的是它旁邊那個變數。所以真正該建立的不是指標清單，是「指標配對表」。'),
  ('p', '**三、模型變便宜對硬體是利多還是利空，取決於模型變大還是變小。**'),
  ('p', '這是這集最漂亮的一段推論。二〇二五年初那次恐慌的隱含邏輯是「模型變便宜，所以不需要那麼多算力」。但這次的便宜是靠架構效率換來的，模型本身反而更大——權重一點四 TB，單機塞不下，只能上機櫃，而且多晶片協同運算還額外吃網路頻寬。'),
  ('p', '所以判準不是價格，是**權重塞不塞得進單一節點**。這條判準的好處是它可證偽、可查證：模型參數量與權重大小是公開資訊，不需要猜測誰的敘事比較動聽。下次再有「便宜模型衝擊硬體」的說法出現，先問這個問題，大概就能過濾掉一半的雜訊。'),
  ('h3', '一句誠實邊界'),
  ('p', '這集把最大風險的觀察窗口放在二〇二八到二〇三〇年。必須誠實指出：**這種時程的預測，在短期內幾乎不可能被證偽**。它不會錯，因為時間還沒到；而等時間到了，路線圖早就改過好幾版。'),
  ('p', '這不代表它沒有價值，但價值的形式要放對——它適合當**觀察哨**，不適合當部位理由。差別在於：觀察哨的用法是「如果 A 和 B 同時出現，我就重新檢查持有邏輯」，而部位理由的用法是「因為二〇二九年會怎樣，所以我現在買（或賣）」。前者可以隨新資訊修正，後者會讓你在中間那幾年反覆折磨自己。長線的宏觀預測最常見的誤用，就是被拿去解釋短線的部位。'),
  ('h3', '可以參考的資料'),
  ('p_cta', [('原節目：《財經M平方 After Meeting》EP208（2026-07-26），YouTube 與各大 podcast 平台。同一週的另一篇心得寫在', None),
             ('這裡', BLOG + '/blog/caibaogou-ep541-panel-level-packaging'),
             ('。', None)]),
  ('p_italic', '本文為個人聽 Podcast 後的教育性心得與反思，非財經M平方官方內容，也不構成任何個股買賣建議、不提供目標價、不針對當期標的。文中提及之公司與數字僅為節目內容之脈絡轉述，未經獨立查證。投資有風險，任何決策請自行研究判斷或諮詢合格的專業人士。'),
 ]},
}

# ---------- helpers（沿用 ep681） ----------
def parse_runs(text):
    parts = re.split(r'\*\*(.+?)\*\*', text)
    runs = []
    for i, seg in enumerate(parts):
        if seg == '':
            continue
        runs.append((seg, 1 if i % 2 == 1 else 0))
    return runs


def t_node(text, fmt=0):
    return {'detail': 0, 'format': fmt, 'mode': 'normal', 'style': '',
            'text': text, 'type': 'text', 'version': 1}


def para(children):
    return {'children': children, 'direction': 'ltr', 'format': '', 'indent': 0,
            'type': 'paragraph', 'version': 1, 'textFormat': 0, 'textStyle': ''}


def heading(text):
    return {'children': [t_node(text)], 'direction': 'ltr', 'format': '', 'indent': 0,
            'type': 'vocus-heading', 'version': 1, 'tag': 'h3'}


def image_node(url, w, h):
    return {'type': 'image', 'version': 1, 'format': '', 'src': url, 'position': 'center',
            'width': w, 'height': h, 'source': None,
            'captionObj': {'root': {'children': [], 'direction': None, 'format': '',
                                    'indent': 0, 'type': 'root', 'version': 1}}}


def link_node(text, url):
    return {'children': [t_node(text)], 'direction': 'ltr', 'format': '', 'indent': 0,
            'type': 'link', 'version': 1, 'rel': None, 'target': None, 'title': None, 'url': url}


def list_node(items):
    children = []
    for i, item in enumerate(items):
        children.append({'children': [t_node(txt, fmt) for txt, fmt in parse_runs(item)],
                         'direction': 'ltr', 'format': '', 'indent': 0,
                         'type': 'listitem', 'version': 1, 'value': i + 1})
    return {'children': children, 'direction': 'ltr', 'format': '', 'indent': 0,
            'type': 'list', 'version': 1, 'listType': 'bullet', 'start': 1, 'tag': 'ul'}


def build(art, meta):
    lex, html, plain = [], [], []
    for b in art['blocks']:
        kind = b[0]
        if kind == 'img':
            lex.append(image_node(meta['imgUrl'], meta['w'], meta['h']))
            html.append(f'<figure class="image"><img src="{meta["imgUrl"]}" '
                        f'width="{meta["w"]}" height="{meta["h"]}"></figure>')
        elif kind == 'poem_lines':
            kids = []
            for i, line in enumerate(b[1]):
                if i:
                    kids.append({'type': 'linebreak', 'version': 1})
                kids.append(t_node(line, 2))
            lex.append(para(kids))
            html.append('<p>' + '<br>'.join(f'<em>{l}</em>' for l in b[1]) + '</p>')
            plain.extend(b[1])
        elif kind == 'p':
            lex.append(para([t_node(s, f) for s, f in parse_runs(b[1])]))
            html.append('<p>' + runs_html(b[1]) + '</p>')
            plain.append(b[1].replace('**', ''))
        elif kind == 'p_italic':
            lex.append(para([t_node(s, 2) for s, _ in parse_runs(b[1])]))
            html.append('<p><em>' + runs_html(b[1]) + '</em></p>')
            plain.append(b[1].replace('**', ''))
        elif kind == 'p_cta':
            kids, chunks = [], []
            for text, url in b[1]:
                if url is None:
                    kids.append(t_node(text))
                    chunks.append(runs_html(text))
                else:
                    kids.append(link_node(text, url))
                    chunks.append(f'<a href="{url}" target="_blank" rel="noopener">{text}</a>')
                plain.append(text)
            lex.append(para(kids))
            html.append('<p>' + ''.join(chunks) + '</p>')
        elif kind == 'h3':
            lex.append(heading(b[1]))
            html.append(f'<h3>{b[1]}</h3>')
            plain.append(b[1])
        elif kind == 'ul':
            lex.append(list_node(b[1]))
            html.append('<ul>' + ''.join(f'<li>{runs_html(i)}</li>' for i in b[1]) + '</ul>')
            plain.extend(i.replace('**', '') for i in b[1])
    return lex, ''.join(html), len(''.join(plain))


def runs_html(text):
    out = []
    for seg, fmt in parse_runs(text):
        esc = seg.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        out.append(f'<strong>{esc}</strong>' if fmt == 1 else esc)
    return ''.join(out)


def api(method, path, body):
    r = urllib.request.Request('https://api.vocus.cc' + path, method=method,
        data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
        headers={'Authorization': f'Bearer {TOK}', 'Content-Type': 'application/json',
                 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://vocus.cc',
                 'Referer': 'https://vocus.cc/'})
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, resp.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', errors='replace')


def run(key, publish):
    art, meta = ARTICLES[key], IDS[key]
    aid = meta['articleId']
    lex, content_html, words = build(art, meta)
    lexical_obj = json.dumps({'root': {'children': lex, 'direction': 'ltr', 'format': '',
                                       'indent': 0, 'type': 'root', 'version': 1}},
                             ensure_ascii=False)
    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

    st, body = api('PATCH', f'/api/articles/{aid}/draft', {
        'title': art['title'], 'lexicalObj': lexical_obj, 'articleId': aid,
        'obj': '', 'draftType': 'pad', 'commandLogs': '[]', 'createdAt': now})
    print(f'[{key}] draft PATCH: {st} {body[:80]}')

    st, body = api('PATCH', f'/api/articles/{aid}', {
        'title': art['title'], 'content': content_html, 'contentConvertedAt': now,
        'catalog': '[]', 'showCatalog': True, 'wordsCount': words,
        'readingTime': max(1, math.ceil(words / 600)), 'abstract': art['abstract'],
        'thumbnailUrl': meta['imgUrl'], 'noThumbnailImage': False,
        'ogImageType': 'thumbnail', 'coverSource': 'upload',
        'tags': [{'title': t} for t in art['tags']], 'newCategory': CATEGORY,
        'isInvestment': True, 'setInvestment': True, 'adult': False,
        'lexicalObj': lexical_obj})
    print(f'[{key}] metadata PATCH: {st} {body[:80]}')

    r = urllib.request.Request(f'https://api.vocus.cc/api/article/{aid}',
        headers={'Authorization': f'Bearer {TOK}', 'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(r, timeout=30) as resp:
        a = json.loads(resp.read()).get('article', {})
    print(f"[{key}] readback: status={a.get('status')} cat={a.get('newCategory',{}).get('title')} "
          f"inv={a.get('isInvestment')} words={a.get('wordsCount')} thumb={str(a.get('thumbnailUrl'))[-20:]}")

    if publish:
        st, body = api('PATCH', f'/api/articles/{aid}/status/2', {'status': 2, 'showCatalog': True})
        print(f'[{key}] publish: {st} {body[:60] if body else "(204)"}')
        print(f'[{key}] url: https://vocus.cc/article/{aid}')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    keys = args or list(ARTICLES)
    for k in keys:
        run(k, '--publish' in sys.argv)
