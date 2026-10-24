# Level-based Vocab Flashcards

**Status:** Draft v1 · **Date:** 2026-10-24 · **Owner:** Stan Hammon

---

## 1. Purpose

A mobile-first web app (PWA) for quizzing yourself on vocabulary with flip-style flashcards. Words come from CSV lists organized into numbered sections (levels). The user chooses a language, then a **minimum and maximum level**, and quizzes on words drawn from that range.

It is built for a small group of people the owner knows. Anyone can quiz without an account. Signing in reuses **SafeOrder accounts** and adds synced progress.

---

## 2. Decisions Summary

| Area | Decision |
|---|---|
| Relationship to SafeOrder | Separate app and repo; **same Supabase project** for sign-in, so the same email and 6-digit code work |
| Access | Public. Anyone can quiz without logging in; signing in adds saved progress |
| Languages | Chosen on first launch; options come from the CSV files bundled in `data/` (Spanish now, German soon) |
| Word list maintenance | CSVs are bundled into the build from the local `data/` folder; to add or update a language, drop in the file and redeploy. **The word lists are never committed to git** (§3.4) |
| Level | = CSV `section number` (Spanish: 1–303); shown with its `section title` |
| Level selector | Two-handle range slider **plus** editable min/max number fields, labeled e.g. "150 – Right Now" |
| Card direction | User picks: foreign → English, English → foreign, or mixed (random per card) |
| Answer mode | Flip and self-grade: **Got it** / **Missed** |
| Card selection | User picks: **Shuffled deck (default)**, pure random, weighted toward misses, spaced repetition |
| Duplicate words | Each CSV row is its own card (e.g. "salir" appears once per section, with that section's meaning) |
| Translations | Short translation is the main answer; full translation is shown on reveal when it differs |
| Session length | User picks 10 / **20 (default)** / 50 / all in range, or endless; fixed-length sessions end with a summary |
| Anonymous progress | Kept on the device only (needed for weighted and SRS modes); **not** merged into an account on sign-in |
| Signed-in extras | Per-word stats, session history, saved settings, starred list, all synced and kept **per language** |
| Per-direction tracking | Got it / Missed history is kept separately for each direction (foreign → English vs English → foreign) (§6.2) |
| Extras | Text-to-speech, installable PWA + offline, desktop keyboard shortcuts, browse/search the word list |
| Text-to-speech | Browser Web Speech API. Spanish uses a Latin American voice (`es-MX`, falling back to `es-US`, then any `es`); German uses `de-DE` |
| Sign-in email | Supabase email template changed to neutral wording that works for both apps |
| Visual identity | Its own look, distinct from SafeOrder |
| Stack | React + Vite + TypeScript PWA, Tailwind, Supabase. Same toolchain as SafeOrder (npm, oxlint, vitest) |
| Repo | **Public** GitHub repo `stanhammon/level-based-vocab-flashcards`, code only, with no real word lists |
| Hosting | Vercel project `level-based-vocab-flashcards`, **deployed from the local machine with the Vercel CLI** (`vercel --prod`), not through GitHub auto-deploys |
| Discoverability | Not indexed: `noindex` meta tag, `X-Robots-Tag` header, and a `robots.txt` that disallows everything |
| Local folder | `C:\Users\stan_\WebDev\level_based_vocab_flashcards` |

---

## 3. Word Data

### 3.1 CSV format
Each language is one CSV in `data/`, UTF-8 (a BOM is allowed), with five columns in this order:

| Column | Example | Notes |
|---|---|---|
| `<language> word` | `quieres` | The header names the language: `spanish word`, `german word` |
| `english translation (short)` | `do you want, (you) want` | Main answer on the card |
| `english translation (full)` | `do you want, want, you, (you) want, (you) love` | Shown on reveal if different from short |
| `section number` | `1` | Positive integer = level |
| `section title` | `Cafe` | Titles can repeat across sections (e.g. "Sports" is both 13 and 174) |

The current Spanish file (source: `C:\Users\stan_\Documents\Spanish_vocab_improved.csv`, copied to `data/spanish.csv`) has 7,158 rows, 303 sections and 15–30 words per section. Short and full translations differ on 1,808 rows, and the longest full translation is about 1,400 characters.

### 3.2 Build step
A script (`scripts/build-data.ts`, run before `vite build` and `vite dev`) does the following:
1. Reads every `data/*.csv`.
2. Validates rows: all five columns present, an integer section number, and no duplicate `(section, word)` pair. A bad row **fails the build** and reports the file and line number, so a broken CSV never ships.
3. Writes `public/data/<lang>.json` (compact arrays) and `public/data/languages.json`, a manifest listing each language's name, code, TTS locale, word count, section range and section titles.

The language name comes from the first header (`spanish word` → Spanish). A small config map (`src/lib/languages.ts`) assigns the code and TTS locale: `spanish → es / es-MX`, `german → de / de-DE`. An unknown language still works, with TTS turned off, and the build prints a warning.

### 3.3 Card identity
Card ID = `<lang>:<section>:<word>` (e.g. `es:1:quieres`). This is stable when translations are edited. If a word is renamed or moved to another section, its old stats are orphaned, which is acceptable. Orphaned rows are ignored, never shown.

### 3.4 Keeping word lists out of the public repo
The real word lists come from a third-party course, so the repo is public but the lists are not in it:
- `.gitignore` excludes `data/*.csv` **and** the generated `public/data/` folder, because the generated JSON contains the same words.
- A committed `data/sample/sample.csv` holds about 20 original rows in the same format, written for this repo and not copied from the course. When `data/` has no real CSVs, the build step uses the sample, so a fresh clone still runs.
- Deploys run `vercel --prod` from the local folder. The Vercel CLI uploads local files, including the gitignored CSVs, and builds on Vercel. The Vercel project is **not** connected to the GitHub repo; if it were, a push would deploy the sample data.
- A `.vercelignore` that does *not* list `data/` makes sure the CSVs are uploaded, because Vercel otherwise falls back to `.gitignore`.
- A check before each commit (a pre-commit hook plus a CI check) fails if any non-sample CSV or `public/data/*.json` is staged.
- The repo's README and docs don't name the course or its source.

---

## 4. Users & Accounts

### 4.1 Anonymous use
Everything in the quiz works without signing in. Device-only storage (localStorage, wrapped in try/catch) holds:
- the last language and session settings,
- per-word stats for the weighted and SRS modes, kept per direction (§6.2).

If storage is unavailable (e.g. a private window), the app still works with defaults and without per-word history.

### 4.2 Signing in
- Same flow as SafeOrder: enter an email, receive a 6-digit code (or magic link) through the shared Supabase project and Brevo SMTP, then enter the code.
- A user who already has a SafeOrder account signs in with the same email. A new email creates a new Supabase account. Signups are already open in that project.
- SafeOrder's `handle_new_user` trigger also creates a `profiles` row for flashcard-only users. That is harmless: they would only see SafeOrder's onboarding if they ever opened SafeOrder.
- Sessions do **not** carry over between the two sites (different domains), so each app is signed into separately.
- On sign-in, device-only stats stay on the device and are not uploaded. From then on, the account's synced data is used.

### 4.3 Shared Supabase setup (one-time)
- Add the Vercel URL and `http://localhost:5173` to Auth → URL Configuration → Redirect URLs.
- Change the email templates (Magic Link / OTP) to neutral wording, e.g. subject "Your sign-in code", body "Your sign-in code is {{ .Token }}" plus the link. **This also changes SafeOrder's emails.**

---

## 5. Data Model (Supabase)

The tables live in the shared project's `public` schema with an `fc_` prefix, so they are clearly separate from SafeOrder's tables. Every table has RLS: a user can read and write only their own rows (`user_id = auth.uid()`). No flashcard table references SafeOrder tables.

```sql
fc_settings (
  user_id uuid pk references auth.users(id) on delete cascade,
  last_language text,
  prefs jsonb not null default '{}',   -- per-language: {es: {min, max, direction, selection, length}, ...}
  updated_at timestamptz not null default now()
)

fc_word_stats (
  user_id uuid references auth.users(id) on delete cascade,
  card_id text,                        -- 'es:1:quieres'
  direction text check (direction in ('forward', 'reverse')),  -- forward = foreign word shown
  language text not null,
  seen int not null default 0,
  correct int not null default 0,
  missed int not null default 0,
  streak int not null default 0,       -- consecutive Got it
  box smallint not null default 0,     -- Leitner box 0–5
  due_at timestamptz,                  -- SRS next review
  last_seen_at timestamptz,
  primary key (user_id, card_id, direction)
)

fc_starred (
  user_id uuid references auth.users(id) on delete cascade,
  card_id text,
  language text not null,
  starred_at timestamptz not null default now(),
  primary key (user_id, card_id)
)

fc_sessions (
  id uuid pk default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language text not null,
  min_level int not null, max_level int not null,
  direction text not null, selection text not null,
  planned_length int,                  -- null = endless
  shown int not null, correct int not null, missed int not null,
  started_at timestamptz not null, ended_at timestamptz not null
)
```

**Migrations:** the SQL lives in this repo under `supabase/sql/` as idempotent scripts and is applied to the shared project with the SQL editor or `psql`. It is not applied with `supabase db push`, because the migration history belongs to SafeOrder's repo. Mixing two repos' histories would make `db push` fail.

**Writes:** grades are batched. Stats are upserted at most every few seconds and at the end of a session, with a queue in IndexedDB so offline grades sync when the connection returns.

---

## 6. Quiz Behavior

### 6.1 Setup screen
1. **Language** (first launch, or when switching from the header). It lists the languages in the manifest, each with its word count.
2. **Levels:** the range slider and the min/max number fields stay in sync. Each end is labeled with the section number and title. If min > max, the two values are swapped. The screen shows a live count, "312 words in range", and Start is disabled when the count is 0.
3. **Direction:** Spanish → English · English → Spanish · Mixed.
4. **Selection mode:** Shuffled deck (default) · Random · Weighted toward misses · Spaced repetition.
5. **Length:** 10 · 20 (default) · 50 · All in range · Endless.
6. **Starred only** toggle (signed-in users with at least one starred card in range).

Settings are remembered per language: in the account when signed in, otherwise on the device.

### 6.2 Per-direction tracking
Got it / Missed results are tracked **separately for each direction** (decided 2026-10-24). Knowing that *encantada* means "nice to meet you" is a different skill from producing *encantada* when shown "nice to meet you".
- Every per-word record is keyed by card **and** direction: `forward` (foreign word shown) or `reverse` (English shown). That covers seen, correct, missed, streak, Leitner box and due date. It applies on the device (anonymous) and in the account (signed in).
- A **Mixed** session records each card under the direction it was actually shown in.
- Weighted and SRS modes read the stats for the direction being quizzed. In a Mixed session, each card's direction is picked first, then that direction's stats decide how likely the card is or whether it's due.
- **Starred** words are per word, not per direction: one star covers both.
- Progress views (most-missed words, accuracy) show the two directions separately. A Mixed session's summary also splits its score by direction.

### 6.3 Selection modes
- **Shuffled deck:** a Fisher–Yates shuffle of all cards in range. Each card appears once before any repeats; the deck reshuffles when exhausted (endless mode).
- **Random:** uniform random from the cards in range. Never the same card twice in a row.
- **Weighted toward misses:** weight = `1 + 4 × missed / max(seen, 1)`, plus a bonus of `+1` for unseen cards. Never the same card twice in a row.
- **Spaced repetition (Leitner):** boxes 0–5 with intervals 0 d, 1 d, 3 d, 7 d, 14 d, 30 d. **Got it** moves a card up one box; **Missed** resets it to box 0, and the card is shown again later in the same session. A session shows due cards first (most overdue first), then fills with unseen cards in section order. When nothing is due and no unseen cards remain, the app says "Nothing due in this range" and offers a shuffled session instead.

Fixed lengths cap the number of cards shown. "All in range" equals the deck size; in SRS mode it means all due cards plus unseen ones.

### 6.4 Card
- **Front:** the prompt word (foreign or English, depending on direction), a speaker button when the foreign word is on that side, a star button (signed in), and progress ("7 / 20" and the current score).
- **Tap, Space, or a Flip button** reveals the back, which shows:
  - the answer in large type,
  - the full translation in smaller type (only when it differs from the short one), clamped to a few lines with "Show more" for long entries,
  - section number and title,
  - a speaker button for the foreign word.
- **Grade:** **Missed** / **Got it** buttons appear only after the flip. Grading advances to the next card.
- **Undo** last grade (one level), in case of a mis-tap.

### 6.5 Session summary
Fixed-length sessions end on a summary: score, percentage, the list of missed words (with translations and speaker buttons), and buttons for **Drill missed words**, **Same settings again**, and **Change settings**. Endless sessions show the same summary when you press **End**.

### 6.6 Keyboard shortcuts (desktop)
`Space`/`Enter` flip · `→` or `G` Got it · `←` or `M` Missed · `S` speak · `*` star · `Z` undo · `Esc` end session.

---

## 7. Other Screens

- **Browse:** the sections of the current language, grouped and searchable. Search covers the foreign word and both translations, and ignores accents and case (e.g. "cafe" matches "café"). Each word row has a speaker button, a star button (signed in), and stats (signed in). A section can be started directly as a quiz (min = max = that section).
- **Progress** (signed in): session history, accuracy over time, most-missed words, and the starred list, each filtered to the current language. Starred words can be drilled from here.
- **Account:** sign in/out, current email, and a "Reset progress for <language>" action (with confirmation).

---

## 8. Technical Architecture

- **Stack:** Vite + React + TypeScript, Tailwind v4, React Router, TanStack Query, `@supabase/supabase-js`, `vite-plugin-pwa`, `idb-keyval`, `minisearch` (browse search). Same versions as SafeOrder where they overlap.
- **Env:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, the same values as SafeOrder's.
- **Code layout:** `src/app` (router, layout), `src/features/{setup,quiz,browse,progress,auth}`, `src/lib` (selection algorithms, storage, supabase, tts, languages). The selection algorithms are pure functions with vitest coverage.
- **Offline (PWA):** precache the app shell and all `public/data/*.json` (Spanish is roughly 600 KB raw and much smaller gzipped). Quizzing works fully offline. Signed-in grades queue locally and sync later. Sign-in itself requires a connection.
- **TTS:** `speechSynthesis` with the language's locale. If no matching voice is installed, the speaker buttons are hidden instead of reading the word with the wrong accent.
- **Visual identity:** its own palette, typography and app icon, distinct from SafeOrder. Light and dark modes. A direction is proposed with a quick mockup at the start of Milestone 1, for approval.

---

## 9. Edge Cases

- The range contains fewer cards than the session length: the session uses all of them, and the length picker shows the actual count.
- A language's CSV changes while a user has stats: matching card IDs keep their stats; others start fresh (§3.3).
- A language is removed from `data/`: its stats stay in the database but the language disappears from the picker.
- The same email is used on several devices at once: stats use last-write-wins per card, with counters merged by taking the larger `seen`/`correct`/`missed` values, so concurrent sessions don't lose counts.
- Very long full translations are clamped on the card (§6.4).

---

## 10. Non-Goals (v1)

- Typed answers or multiple choice (answer mode is flip and self-grade only).
- In-app CSV upload or editing words in the app.
- User-added personal cards.
- Merging anonymous device progress into an account.
- Leaderboards or sharing between users.
- Native languages other than English.

---

## 11. Milestones

1. **Core quiz (anonymous):** scaffold, visual direction, CSV build step with the sample fallback and the guards in §3.4, language picker, level range selector, direction, flip cards, shuffled deck, session lengths and summary, device-stored settings, noindex. Public GitHub repo; deployed to Vercel with the CLI.
2. **Accounts:** shared-Supabase sign-in, `fc_` tables and RLS, synced settings, per-word stats, session history, starred words, Progress screen, neutral email template.
3. **Selection modes:** random, weighted toward misses, Leitner SRS, for both device and account storage.
4. **Extras:** text-to-speech, keyboard shortcuts, Browse/search, PWA install and offline queue.
5. **German:** add the German CSV once it is ready (no code changes expected beyond the language config entry).

---

## 12. Acceptance Criteria (key flows)

- A first-time visitor picks Spanish, sets levels 1–10, and starts a 20-card shuffled session with no login. No card repeats, and a summary appears after card 20.
- Setting min = 150 and max = 150 shows only "Right Now" words.
- A SafeOrder user signs in with their existing email and code, and their settings and stats then follow them to another device.
- Adding `data/german.csv` and running `vercel --prod` makes German appear in the language picker with no other changes.
- A fresh clone of the GitHub repo contains no real word data, and it builds and runs with the sample list.
- The live site has a `noindex` header, and `robots.txt` disallows everything.
- With the network off, an installed app still runs a full session; signed-in grades sync after reconnecting.

---

## 13. Open Questions

- Visual direction: to be proposed with a mockup at the start of Milestone 1.
- German CSV: confirm it uses the same five columns (`german word`, …).
