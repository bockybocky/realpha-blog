// 驗證簿摘要數字（首頁窄帶用）。邏輯沿用舊首頁：只數非樣本卡、開獎日取未過期最早的 aging deadline。
import ledgerCards from '../data/ledger.json';

function taipeiYmd(date: Date) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Taipei',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(date);
	const get = (type: string) => parts.find((part) => part.type === type)?.value;
	return `${get('year')}-${get('month')}-${get('day')}`;
}

function ymdTime(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const [y, m, d] = value.split('-').map(Number);
	return Date.UTC(y, m - 1, d);
}

export function ledgerSummary(now = new Date()) {
	const today = taipeiYmd(now);
	const nonSample = (ledgerCards as any[]).filter((c) => !c.is_sample);
	// 開過獎＝verdict 裡有結算日（實際資料寫 hit / miss / undecidable，不是 'scored'）
	const scoredCount = nonSample.filter((c) => c?.verdict?.settled_at).length;
	const aging = nonSample
		.filter((c) => c.status === 'aging' && typeof c.deadline === 'string')
		.map((c) => c.deadline as string)
		.sort();
	const nextSettle = aging.find((d) => d >= today) ?? aging[0] ?? null;
	const t = nextSettle ? ymdTime(nextSettle) : null;
	const n = ymdTime(today);
	const nextSettleDays = t !== null && n !== null ? Math.ceil((t - n) / 86_400_000) : null;
	return { committed: nonSample.length, scoredCount, nextSettle, nextSettleDays };
}

export function formatYmd(value: string, locale: 'zh-TW' | 'en') {
	const t = ymdTime(value);
	if (t === null) return value;
	return new Intl.DateTimeFormat(locale === 'zh-TW' ? 'zh-TW' : 'en', { month: 'short', day: '2-digit', timeZone: 'UTC' }).format(new Date(t));
}
