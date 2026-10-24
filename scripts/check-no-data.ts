/**
 * Fails if word-list data is tracked (or, with --staged, about to be
 * committed). Run by the pre-commit hook and CI (SPEC §3.4).
 */
import { execFileSync } from 'node:child_process'

const staged = process.argv.includes('--staged')
const args = staged ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR'] : ['ls-files']
const files = execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean)

const blocked = files.filter(
  (f) => (/\.csv$/i.test(f) && !f.startsWith('data/sample/')) || f.startsWith('public/data/'),
)
if (blocked.length > 0) {
  console.error('Word-list data must not be committed (SPEC §3.4):')
  for (const f of blocked) console.error(`  ${f}`)
  console.error(staged ? 'Unstage with: git restore --staged <file>' : 'Remove with: git rm --cached <file>')
  process.exit(1)
}
