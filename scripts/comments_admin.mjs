import { loadRows, setCommentHidden } from './comments.mjs';

const [command, id] = process.argv.slice(2);

if (command === 'list') {
	const rows = await loadRows(new URL('../data/comments.jsonl', import.meta.url));
	for (const row of rows) console.log(`${row.hidden ? 'hidden' : 'visible'}\t${row.id}\t${row.createdAt}\t${row.path}\t${row.name}\t${row.body.replace(/\s+/g, ' ').slice(0, 120)}`);
} else if ((command === 'hide' || command === 'unhide') && id) {
	const changed = await setCommentHidden(id, command === 'hide');
	if (!changed) {
		console.error(`Comment not found: ${id}`);
		process.exitCode = 1;
	} else console.log(`${command}d ${id}`);
} else {
	console.error('Usage: node scripts/comments_admin.mjs list | hide <id> | unhide <id>');
	process.exitCode = 1;
}
