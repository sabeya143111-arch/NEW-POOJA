# MIR Renamer (web)

Static site. PDF reading, OCR (Tesseract.js) and renaming all run in the browser,
so no server code is needed and the PDFs are never uploaded.

Files: index.html, detect.js

## Deploy on Vercel
Option A - command line (needs Node.js):
    npm i -g vercel
    cd mir-renamer-web
    vercel          # log in, accept the defaults (no build command, no framework)
    vercel --prod   # gives you the final public link

Option B - website:
    Put this folder in a GitHub repo, then vercel.com > Add New > Project > Import the repo > Deploy.

## Settings
Status codes are at the top of the script in index.html:
    const STATUS = ["A", "AN", "R"];   // box 1, box 2, box 3

## Notes
- First page load downloads the OCR engine (about 10 MB), so the first scan is slower.
- The site loads libraries from public CDNs, so it needs internet access.
- Anyone with the link can open it. In Vercel you can turn on Deployment Protection
  (Project Settings) if you want it limited to your team.
