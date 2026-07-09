# CompTIA Cloud+ (CV0-004) Mock Exam Simulator

A free, Pearson VUE–style mock exam simulator for the **CompTIA Cloud+ CV0-004** certification, built as a static site (no backend, no build step, no tracking).

👉 **Live demo:** https://irfanzulkifle.github.io/cloud-plus-mock/

## Features

- **Realistic exam experience** — one question per screen, countdown timer (90 min, matching the real exam), question navigator grid, flag-for-review, and end-of-exam review before submitting.
- **310 practice questions** across all 6 CV0-004 domains, with single- and multi-select items.
- **Per-option explanations** — every answer choice has a plain-language explanation of why it's right or wrong, shown in the review screens.
- **Domain practice mode** — filter the question bank by CV0-004 domain (Cloud Architecture, Deployment, Operations, Security, DevOps Fundamentals, Troubleshooting).
- **Study mode** — no timer; pick an answer and get **instant correct/wrong feedback plus the explanation** for both your choice and the correct answer.
- **Review Incorrect** — after a mock exam, review every question you got wrong or left blank, with the correct answer and reasoning.
- **Review All** — full walkthrough of every question (correct answers + explanations), so you learn the *why* even when you guessed right.
- **Modern, minimal UI** — clean monospace design, light/dark theme toggle (remembered across sessions), fully mobile-friendly with big tap targets and a bottom-docked navigator on phones.
- **Keyboard driven** — `A`–`F` / `1`–`9` select, `↑`/`↓` move between options, `←`/`→` change question, `Enter` choose, `F` flag.

## How to use

Just open the [live site](https://irfanzulkifle.github.io/cloud-plus-mock/). No install, no account.

### Run locally

The app is plain static files. Any static server works:

```bash
# from the repo root
python3 -m http.server 8000
# then open http://localhost:8000/
```

Or open `index.html` directly in a browser (the multi-file version), or use the self-contained `cloud-plus-mock-exam.html` (everything inlined — handy for offline use or sharing).

## Project structure

| File | Purpose |
|------|---------|
| `index.html` | Multi-file app shell (loads `styles.css`, `app.js`, `data.js`) |
| `styles.css` | All styling (design tokens, themes, responsive layout) |
| `app.js` | Exam logic, navigation, timer, study-mode feedback, review screens |
| `data.js` | Question bank (310 questions: stem, options, answer, explanations, domain) |
| `cloud-plus-mock-exam.html` | Self-contained single-file build (data + CSS + JS inlined) |

## A note on accuracy

Questions are derived from a third-party practice-question PDF and the official CompTIA Cloud+ CV0-004 Exam Objectives. Domain tags are inferred from the objectives (the source PDF does not label questions by domain). Explanations are generated for study purposes and are not an official CompTIA answer key. Always cross-check against official material when preparing.

Two PBQ-style items (HOTSPOT/SIMULATION) from the source were excluded because they have no text answers.

If you spot a wrong answer, a misclassified domain, or a misleading explanation, please open an issue — accuracy matters for everyone using this to study.

## Contributing

Pull requests are welcome — especially corrections to answers, explanations, or domain mappings. Open an issue first to discuss substantial changes.

## License

MIT — see [LICENSE](./LICENSE).

---

*This project is not affiliated with or endorsed by CompTIA. CompTIA® and Cloud+® are trademarks of CompTIA.*
