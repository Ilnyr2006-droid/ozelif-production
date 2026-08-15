# Repository Security Rules

This repository must never contain production secrets.

Never commit:
- `.env.admin`
- `.env.metabase`
- production `DATABASE_URL`
- PostgreSQL passwords
- `OPENAI_API_KEY`
- Telegram bot tokens
- webhook secrets
- admin/session secrets
- Metabase embed secrets
- SSH private keys
- database dumps
- production backups

Only example environment files with blank/fake values belong in Git.
Test files may use obviously fake localhost credentials.

If a secret is accidentally committed:
1. rotate the credential;
2. remove it from Git history;
3. do not rely only on deleting the current file.
