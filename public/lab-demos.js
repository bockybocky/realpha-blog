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
