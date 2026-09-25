# Moving to a new email / new Claude account

The system itself does not belong to a Claude account. It lives in four
places you own, and each one logs in with an email. **Change the email on
each of them to the new one before you deactivate the old email** — otherwise
a password reset or a security code can lock you out.

## 1. Before deactivating the old email

Do these with the old email still working, one at a time, and check each
by logging out and back in with the new email.

| Service | What it holds | What to do |
|---|---|---|
| **GitHub** (account `skappop`) | The code, including this file | Settings → Emails: add the new email, verify it, make it **Primary**, then remove the old one. Keep the same GitHub account — the repository, and everything that points at it, stays as it is. Save new 2-factor recovery codes. |
| **Vercel** | The website | Account settings → change the email. The project and its settings (the Supabase keys, Bridge API key) stay. |
| **Supabase** | All patient records, logins, images | Account → change the email, or invite the new email to the organization as **Owner** first, then remove the old one. The project, data and keys do not change. |
| **Google** (Sheets import, if used) | The service account in Google Cloud | Add the new Google account as Owner of the Google Cloud project. |
| Anything else set up with the old email | e.g. Resend (low-stock email), a domain name, Cloudflare | Same idea: change the email in account settings. |

Nothing on the clinic PCs uses your email: the Dental Agent uses the Bridge
API key, and staff log in with their own accounts.

## 2. The new Claude account

1. Create it with the new email.
2. Open Claude Code on the web (claude.ai/code) and connect GitHub — log in
   as `skappop` and allow the Claude app on the `British-ProCare` repository.
3. Start a session on the repository. Claude reads `CLAUDE.md` automatically:
   that file is the project's memory — who the clinic is, how you like to
   work, why things were built the way they were, and what is still open.
   `tools/README.md` gives it the private test copy of the backend and all
   the tests used so far.
4. A good first message:

   > Read CLAUDE.md, README.md, migrations/README.md and tools/README.md.
   > Then start the local test stack and run the tests, and tell me in plain
   > words what the system does and what is still open.

   That brings the new session to where this one left off.

## 3. What does not carry over

Conversations do not move between Claude accounts. You can download the old
ones for your own records before closing the old account (claude.ai →
Settings → Privacy → Export data), but a new account cannot read them — which
is why everything important is written into the repository instead.

When something new is decided or built, ask Claude to update `CLAUDE.md`, so
the next session (on any account) knows it too.
