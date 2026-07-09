# Question Images (source code blocks)

Images here are the original exam-question code blocks / screenshots that were
dropped during PDF extraction (the PDF stored them as non-selectable regions).

## Naming convention

Name each file by its question number:

    q16.png
    q24.jpg
    q103.png

The filename `q<number>` tells the build which question the image belongs to.
Multiple images for one question: `q16a.png`, `q16b.png`, etc.

## How it's used

These images are OCR'd (Tesseract) and the extracted code is restored into the
matching question's `stem` in `data.js`. They are NOT loaded by the app at
runtime — the text ends up inline in `data.js`, so they don't bloat the
deployed site. They're kept here only as the source of truth / audit trail.

Note: anything pushed to this repo is public on GitHub Pages. These are just
exam question snippets, so that's fine — but don't put anything sensitive here.
