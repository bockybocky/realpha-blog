// 有聲文章：src/data/audio.json（scripts/audio_manifest.mjs 產生）為主，frontmatter 的 audio／audioDuration／audioBytes 為手動覆寫。
// 用 fs 讀而不是 import：檔案不存在或壞掉只當作沒有音檔，build 不會失敗（同 popular.ts）。
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type AudioInfo = { src: string; bytes: number | null; seconds: number | null };
type ManifestEntry = { src: string; bytes?: number | null; seconds?: number | null };
type Manifest = Record<string, ManifestEntry>;
type AudioFields = { slug: string; lang: string; audio?: string; audioDuration?: number; audioBytes?: number };

let cached: Manifest | undefined;

export function readAudioManifest(): Manifest {
	if (cached) return cached;
	try {
		const raw = JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'audio.json'), 'utf8'));
		cached = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
	} catch {
		cached = {};
	}
	return cached!;
}

/** 中文版 key＝slug；英文版 key＝slug.en（英文頁只認英文音檔） */
export const audioKey = (slug: string, lang: string) => (lang === 'en' ? `${slug}.en` : slug);

export function resolveAudio(data: AudioFields, manifest: Manifest = readAudioManifest()): AudioInfo | null {
	const entry = manifest[audioKey(data.slug, data.lang)];
	const src = data.audio ?? entry?.src;
	if (!src) return null;
	// frontmatter 換了檔案時，audio.json 量的是另一個檔，大小與時長不能沿用
	const same = entry && entry.src === src ? entry : undefined;
	let bytes = data.audioBytes ?? same?.bytes ?? null;
	const seconds = data.audioDuration ?? same?.seconds ?? null;
	if (bytes === null && src.startsWith('/')) {
		try {
			bytes = statSync(join(process.cwd(), 'public', src)).size;
		} catch {
			// 站外網址或檔案不在本機：大小留空
		}
	}
	return { src, bytes, seconds };
}

export function formatDuration(seconds: number | null | undefined): string | null {
	if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return null;
	const s = Math.round(seconds);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = String(s % 60).padStart(2, '0');
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
