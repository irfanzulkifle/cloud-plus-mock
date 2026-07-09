# Security Policy

## Supported Versions

This is a static, client-side-only web app (no backend, no user accounts, no data collection). The latest version on the `main` branch is the only supported version.

## Reporting a Vulnerability

If you discover a security issue, please **open a GitHub Issue** on this repository describing:

- What the issue is and where (file / screen / behavior)
- Steps to reproduce
- Potential impact

There is no production backend or user data to compromise, but we still want the app to be safe for everyone who uses it to study.

## Scope notes

- The site loads fonts from Google Fonts over HTTPS. A strict Content-Security-Policy is set in the page `<head>` (see `index.html`).
- No secrets, API keys, or credentials are stored in this repository.
- The question bank and explanations are study material, not official CompTIA content. Report factual errors (wrong answers, misclassified domains) as normal Issues — those are accuracy bugs, not security issues.
