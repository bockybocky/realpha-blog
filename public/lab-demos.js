(() => {
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	function mountCanvasWaves(canvas) {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		let width = 0;
		let height = 0;
		let frame = 0;
		let raf = 0;

		function resize() {
			const rect = canvas.getBoundingClientRect();
			const scale = window.devicePixelRatio || 1;
			width = rect.width;
			height = rect.height;
			canvas.width = Math.max(1, Math.floor(width * scale));
			canvas.height = Math.max(1, Math.floor(height * scale));
			ctx.setTransform(scale, 0, 0, scale, 0, 0);
		}

		function draw() {
			ctx.clearRect(0, 0, width, height);
			const gradient = ctx.createLinearGradient(0, 0, width, height);
			gradient.addColorStop(0, '#1f7a5c');
			gradient.addColorStop(1, '#8aa39b');
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, width, height);

			for (let layer = 0; layer < 4; layer += 1) {
				ctx.beginPath();
				const yBase = height * (0.28 + layer * 0.14);
				const amplitude = 16 + layer * 7;
				for (let x = 0; x <= width; x += 8) {
					const y =
						yBase +
						Math.sin(x * 0.018 + frame * 0.025 + layer * 1.7) * amplitude +
						Math.cos(x * 0.011 - frame * 0.018) * 9;
					if (x === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.strokeStyle = `rgba(255, 255, 255, ${0.26 + layer * 0.08})`;
				ctx.lineWidth = 1.5 + layer * 0.45;
				ctx.stroke();
			}

			for (let i = 0; i < 42; i += 1) {
				const x = ((i * 89 + frame * (0.22 + (i % 5) * 0.06)) % (width + 48)) - 24;
				const y = height * (0.18 + ((i * 37) % 70) / 100);
				ctx.beginPath();
				ctx.arc(x, y, 1.2 + (i % 4) * 0.45, 0, Math.PI * 2);
				ctx.fillStyle = 'rgba(255,255,255,0.52)';
				ctx.fill();
			}

			frame += reduceMotion ? 0 : 1;
			raf = window.requestAnimationFrame(draw);
		}

		resize();
		draw();
		window.addEventListener('resize', resize);
		canvas.addEventListener('astro:unmount', () => {
			window.cancelAnimationFrame(raf);
			window.removeEventListener('resize', resize);
		});
	}

	function mountLineChart(mount) {
		const data = [18, 22, 19, 28, 34, 31, 42, 39, 48, 51, 47, 58];
		const svg = mount.querySelector('svg');
		const tooltip = mount.querySelector('[data-chart-tooltip]');
		if (!svg || !tooltip) return;

		const width = 720;
		const height = 360;
		const pad = 36;
		const max = Math.max(...data);
		const min = Math.min(...data);
		const points = data.map((value, index) => {
			const x = pad + (index / (data.length - 1)) * (width - pad * 2);
			const y = height - pad - ((value - min) / (max - min)) * (height - pad * 2);
			return { x, y, value, label: `M${index + 1}` };
		});
		const ns = 'http://www.w3.org/2000/svg';
		const path = points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');

		svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
		svg.innerHTML = `
			<path d="M${pad},${height - pad}H${width - pad}" class="chart-axis"></path>
			<path d="M${pad},${pad}V${height - pad}" class="chart-axis"></path>
			<path d="${path}" class="chart-line"></path>
		`;

		const active = document.createElementNS(ns, 'circle');
		active.setAttribute('r', '7');
		active.setAttribute('class', 'chart-active');
		svg.append(active);

		function setActive(point) {
			active.setAttribute('cx', point.x);
			active.setAttribute('cy', point.y);
			tooltip.textContent = `${point.label}: ${point.value}`;
			tooltip.style.left = `${(point.x / width) * 100}%`;
			tooltip.style.top = `${(point.y / height) * 100}%`;
		}

		function onPointerMove(event) {
			const rect = svg.getBoundingClientRect();
			const x = ((event.clientX - rect.left) / rect.width) * width;
			const nearest = points.reduce((best, point) =>
				Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best,
			);
			setActive(nearest);
		}

		setActive(points.at(-1));
		svg.addEventListener('pointermove', onPointerMove);
		svg.addEventListener('pointerleave', () => setActive(points.at(-1)));
	}

	document.querySelectorAll('[data-lab-demo="canvas-waves"]').forEach(mountCanvasWaves);
	document.querySelectorAll('[data-lab-demo="line-chart"]').forEach(mountLineChart);
})();

/* ── 量價拆解器 ──────────────────────────────────────────
   營收成長 = (1+量成長)(1+價成長) - 1
   給了營收與量，反解價：價成長 = (1+營收)/(1+量) - 1
   讀者輸入自己看到的數字，當場知道那個成長是賣得多、還是只是變貴。 */
function mountPriceVolume(mount) {
	const rev = mount.querySelector('[data-pv="rev"]');
	const vol = mount.querySelector('[data-pv="vol"]');
	const out = mount.querySelector('[data-pv="out"]');
	const barVol = mount.querySelector('[data-pv="bar-vol"]');
	const barPrice = mount.querySelector('[data-pv="bar-price"]');
	if (!rev || !vol || !out) return;

	function render() {
		const r = Number(rev.value) / 100;
		const v = Number(vol.value) / 100;
		if (!Number.isFinite(r) || !Number.isFinite(v) || v <= -1) {
			out.textContent = '請輸入合理的數字（出貨量成長不能是 -100% 以下）。';
			return;
		}
		const p = (1 + r) / (1 + v) - 1;
		const pv = v * 100;
		const pp = p * 100;
		// 用同一把尺畫兩段：以「量與價之中較大的絕對值」當滿格，
		// 兩段各自照自己的大小佔比例。0% 就是真的畫成 0 寬，不會被另一段吃掉。
		const scale = Math.max(Math.abs(pv), Math.abs(pp), 1);
		if (barVol) {
			barVol.style.width = `${(Math.abs(pv) / scale) * 50}%`;
			barVol.dataset.neg = pv < 0 ? '1' : '0';
			barVol.textContent = Math.abs(pv) >= 6 ? `量 ${pv.toFixed(0)}%` : '';
		}
		if (barPrice) {
			barPrice.style.width = `${(Math.abs(pp) / scale) * 50}%`;
			barPrice.dataset.neg = pp < 0 ? '1' : '0';
			barPrice.textContent = Math.abs(pp) >= 6 ? `價 ${pp.toFixed(0)}%` : '';
		}

		const verdict =
			Math.abs(pv) < 0.05 && Math.abs(pp) < 0.05
				? '幾乎沒動。'
				: pv > 0 && pp > 0
					? '量價齊揚——賣得比較多，而且賣得比較貴。'
					: pv > 0 && pp <= 0
						? '真的多賣了。價格還跌了，是量在推。'
						: pv <= 0 && pp > 0
							? '賣的東西沒有變多，是變貴了。這種成長要小心，它可能只是通膨換了件衣服。'
							: '量價齊跌，成長是負的。';
		out.innerHTML =
			`出貨量貢獻 <b>${pv.toFixed(1)}%</b>　價格貢獻 <b>${pp.toFixed(1)}%</b><br>${verdict}`;
	}

	[rev, vol].forEach((el) => el.addEventListener('input', render));
	render();
}
document.querySelectorAll('[data-lab-demo="price-volume"]').forEach(mountPriceVolume);

/* ── 槓桿波動損耗計算器 ──────────────────────────────────
   兩倍槓桿追蹤的是「每日報酬的兩倍」，不是「期間報酬的兩倍」。
   把每天的漲跌逐日相乘，就會看到指數回到原點、槓桿產品回不去。 */
function mountLeverageDecay(mount) {
	const seq = mount.querySelector('[data-ld="seq"]');
	const mult = mount.querySelector('[data-ld="mult"]');
	const out = mount.querySelector('[data-ld="out"]');
	const bars = mount.querySelector('[data-ld="bars"]');
	if (!seq || !out) return;

	function render() {
		const parts = String(seq.value)
			.split(/[,，\s]+/)
			.filter(Boolean)
			.map(Number);
		const k = Number(mult && mult.value) || 2;
		if (!parts.length || parts.some((n) => !Number.isFinite(n) || n <= -100)) {
			out.textContent = '請輸入每天的漲跌百分比，用逗號分開，例如：-20, 25';
			return;
		}
		let index = 100;
		let lev = 100;
		parts.forEach((pct) => {
			const r = pct / 100;
			index *= 1 + r;
			lev *= 1 + k * r;          // 槓桿吃的是「當天」報酬的 k 倍
		});
		const gap = lev - index;
		if (bars) {
			// 兩根柱子從 0 起算時，100 跟 90 看起來幾乎一樣高。
			// 所以把「少掉的那一塊」單獨畫成缺口，讓差距本身變成看得見的形狀。
			const top = Math.max(index, lev, 100);
			const pct = (v) => (Math.max(v, 0) / top) * 100;
			const shortfall = index - lev;                 // 槓桿比指數少了多少
			const gapPct = pct(shortfall);
			const gapBlock = shortfall > 0.05
				? `<span class="ld-gap" style="height:${gapPct}%">${gapPct >= 9 ? '少了 ' + shortfall.toFixed(1) : ''}</span>`
				: '';
			bars.innerHTML =
				`<div class="ld-bar"><span style="height:${pct(index)}%"></span><em>指數 ${index.toFixed(1)}</em></div>` +
				`<div class="ld-bar ld-lev">${gapBlock}<span style="height:${pct(lev)}%"></span>` +
				`<em>${k}倍 ${lev.toFixed(1)}</em></div>`;
		}
		const verdict =
			Math.abs(index - 100) < 0.5 && lev < 99.5
				? `指數繞了一圈回到原點，${k} 倍槓桿卻少了 ${(100 - lev).toFixed(1)}。它扣的不是費用，是波動本身。`
				: gap < 0
					? `${k} 倍槓桿比指數少了 ${Math.abs(gap).toFixed(1)}——期間震盪愈大，差距愈大。`
					: `這段期間單向走，槓桿還沒被波動咬到；一旦來回震盪就會開始損耗。`;
		out.innerHTML =
			`起點都是 100。指數走完是 <b>${index.toFixed(1)}</b>，${k} 倍槓桿是 <b>${lev.toFixed(1)}</b>。<br>${verdict}`;
	}

	[seq, mult].forEach((el) => el && el.addEventListener('input', render));
	render();
}
document.querySelectorAll('[data-lab-demo="leverage-decay"]').forEach(mountLeverageDecay);

/* ── 倖存者偏誤示範器 ─────────────────────────────────────
   資料來自自建的美股資料庫：1990 年起，存活 3,925 檔、已下市 8,562 檔。
   多數回測工具只有「現在還活著」那一半，等於把 68.6% 的公司從歷史上刪掉。 */
function mountSurvivorship(mount) {
	const raw = mount.querySelector('[data-sv="data"]');
	if (!raw) return;
	const D = JSON.parse(raw.textContent);
	const grid = mount.querySelector('[data-sv="grid"]');
	const toggle = mount.querySelector('[data-sv="toggle"]');
	const stat = mount.querySelector('[data-sv="stat"]');
	const years = mount.querySelector('[data-sv="years"]');
	const total = D.active_count + D.delisted_count;
	const CELLS = 200;                                   // 一格代表約 62 家
	const per = total / CELLS;
	const deadCells = Math.round(D.delisted_count / per);

	// 一格一格畫：灰＝活著，暗＝已消失
	if (grid) {
		let html = '';
		for (let i = 0; i < CELLS; i += 1) {
			html += `<i class="${i < deadCells ? 'sv-dead' : 'sv-alive'}"></i>`;
		}
		grid.innerHTML = html;
	}

	// 逐年下市家數的長條（用 SVG 畫，不依賴 CSS 佈局）
	if (years) {
		const rows = D.by_year;
		const max = Math.max(...rows.map((r) => r.n));
		const W = 720, H = 130, PAD = 22;                  // PAD 留給年份標籤
		const bw = W / rows.length;
		let bars = '', labs = '';
		rows.forEach((r, i) => {
			const h = Math.max(2, ((r.n / max) * (H - PAD)));
			const x = i * bw;
			bars += `<rect x="${(x + bw * 0.12).toFixed(1)}" y="${(H - PAD - h).toFixed(1)}" `
				+ `width="${(bw * 0.76).toFixed(1)}" height="${h.toFixed(1)}" fill="currentColor" opacity="0.55">`
				+ `<title>${r.year} 年 ${r.n} 家消失</title></rect>`;
			if (r.year % 5 === 0) {
				labs += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" font-size="11" `
					+ `text-anchor="middle" fill="currentColor" opacity="0.6">${r.year}</text>`;
			}
		});
		years.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" `
			+ `aria-label="每一年消失的公司家數，1997 到 2001 年最高">`
			+ bars + labs
			+ `<line x1="0" y1="${H - PAD}" x2="${W}" y2="${H - PAD}" stroke="currentColor" `
			+ `stroke-width="1" opacity="0.25"/></svg>`;
	}

	function render() {
		const survOnly = toggle && toggle.checked;      // 打勾＝只看還活著的
		if (grid) grid.dataset.mode = survOnly ? 'alive' : 'all';
		stat.innerHTML = survOnly
			? `你看到的是 <b>${D.active_count.toLocaleString()}</b> 家——只有現在還活著的。<br>` +
			  `另外 <b>${D.delisted_count.toLocaleString()}</b> 家從畫面上消失了，也會從你的回測裡消失。`
			: `1990 年以來一共 <b>${total.toLocaleString()}</b> 家。其中 <b>${D.delisted_count.toLocaleString()}</b> 家已經下市，` +
			  `佔 <b>${((D.delisted_count / total) * 100).toFixed(1)}%</b>。<br>` +
			  `下市最密集的是 1997 到 2001 年，每年 350 到 458 家。`;
	}

	if (toggle) toggle.addEventListener('change', render);
	render();
}

document.querySelectorAll('[data-lab-demo="survivorship"]').forEach(mountSurvivorship);
