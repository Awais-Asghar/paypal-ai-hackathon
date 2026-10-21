# Rules

These rules are binding for every AI agent (Claude Code or any other) and every collaborator working in this repository. They override convenience, speed and default tool behavior. When in doubt, stop and ask the owner.

"Permission" means explicit approval from the repository owner **in the current conversation, for that specific action**. Approval for one push, delete or publish doesn't carry over to the next one.

## 1. Git and GitHub

1. **Never `git push`** to any remote, branch or tag without permission. That includes `git push --force`, pushing tags, and tools that push for you (for example `gh repo sync`, or `gh pr create` that pushes a branch).
2. **Never rewrite published history:** no force-push, no rebasing or amending commits that are already on the remote.
3. Local commits are allowed for finished, working changes. Say so after each one (hash and message). Never commit secrets (see §3).
4. **Never create, rename, archive, delete or change the visibility of a GitHub repository**, and never edit its settings, collaborators, secrets or Actions, without permission.
5. Never open, close or comment on issues or pull requests (in this repo or any other) without permission.
6. Work on a feature branch for larger changes. Don't merge into `main` without telling the owner.

## 2. Deleting and destructive actions

1. **Never delete anything without permission.** That covers files, folders, branches, stashes, tags, sandbox accounts, PayPal apps, webhooks, cloud resources and database data.
2. Commands that count as deletion and need permission:
   - `rm`, `Remove-Item`, `del`, `rmdir`
   - `git rm`, `git clean`, `git reset --hard`, `git checkout -- <file>`, `git restore` on uncommitted work
   - `git branch -D`, `git stash drop` / `clear`
   - `DROP` / `TRUNCATE` SQL
   - dropping or recreating containers or volumes with data
3. **Don't overwrite or wholesale-rewrite** an existing file you didn't create in the current task without asking first. Prefer targeted edits.
4. Before any destructive action, show exactly what will be affected and wait for a yes.
5. Temporary files belong in a scratch directory outside the repo, or in a git-ignored folder.

## 3. Secrets and credentials

1. **Never commit** `.env` files, PayPal client secrets, access tokens, API keys (LLM, Channel3, Render, etc.), cookies, or sandbox account passwords.
2. Secrets live in `.env` (git-ignored). Keep `.env.example` up to date with placeholder values only.
3. The PayPal **client ID** may appear in frontend code. The **client secret** is server-side only, always.
4. Never print secrets in logs, terminal output, screenshots, the demo video or chat messages.
5. If a secret is committed by mistake: stop, tell the owner immediately, and treat the secret as compromised (rotate it). Don't try to quietly fix it with a force-push.

## 4. Money and environments

1. **Sandbox only.** Never use live PayPal credentials, live endpoints (`api-m.paypal.com`) or real money.
2. Never sign up for paid services, start paid plans, or spend beyond free tiers or credits without permission.
3. Don't create accounts or submit personal data (email, phone, name) to third-party services on the owner's behalf without permission.

## 5. Publishing and external communication

Everything below needs permission first:
- Submitting or editing the Devpost entry
- Uploading or publishing the demo video
- Posting on Discord or social media
- Sending emails
- Deploying publicly (Render, Vercel, etc.)
- Sharing links or artifacts

## 6. Hackathon compliance

1. PayPal and AI must both be **central** to the product. Don't ship a cosmetic PayPal button.
2. All code must be original work created during the submission period (from Oct 1, 2026) or clearly attributed open source used within its license.
3. Keep an open-source **LICENSE** file at the repo root. It must show in the GitHub About section.
4. The repo must contain everything needed to run the project, plus complete setup instructions and test credentials or sandbox logins for judges (sandbox only).
5. The demo video stays **under 3 minutes**, runs on YouTube, contains no third-party trademarks or copyrighted music without permission, and is in English.
6. Respect each third-party API's terms (Channel3, AG Grid trial license, Bryntum trial, etc.).

## 7. Working style

1. Read [CLAUDE.md](CLAUDE.md), [ARCHITECTURE.md](ARCHITECTURE.md) and this file before starting work.
2. Ask when requirements are ambiguous instead of guessing on anything hard to undo.
3. Report outcomes honestly. If tests fail or a step was skipped, say so.
4. Adding project dependencies is allowed. Mention each new dependency and why. Don't install global system tools without asking.
