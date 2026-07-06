(() => {
	async function copyText(button) {
		const container = button.closest('pre, .source-panel');
		const code = container?.querySelector('code');
		const text = code?.innerText?.trimEnd() ?? '';
		if (!text) return;

		try {
			await navigator.clipboard.writeText(text);
			const original = button.textContent;
			button.textContent = button.dataset.copiedLabel || 'Copied';
			button.dataset.copied = 'true';
			window.setTimeout(() => {
				button.textContent = original || 'Copy';
				delete button.dataset.copied;
			}, 1400);
		} catch {
			button.textContent = button.dataset.errorLabel || 'Copy failed';
		}
	}

	document.addEventListener('click', (event) => {
		const button = event.target.closest('[data-copy-code]');
		if (button) void copyText(button);
	});
})();
