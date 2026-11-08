# Kuwait Zoo Responsive Firebase Site

The main public page is `zooinfo.html`. It keeps the population report, side controls, image download, print, live date/time, stats, and responsive mobile controls together. `index.html` redirects to the same public report.

## Firebase
- `admin-login.html` uses Firebase Email/Password Authentication.
- `zooinfo.html` is public/read-only by default. A signed-in admin can enable edit mode and save species population documents to Firestore.
- `firebase-config.js` contains public web-app configuration only.
- The report listens to the `species` collection and updates live. It shows built-in example population numbers until Firestore provides documents.

Make sure Firestore rules allow public reads and restrict writes to the admin UID. Never use public write rules or commit private service-account credentials.

## Hosting
Serve from an HTTPS host (GitHub Pages works). Enable Pages from `main` / root. Add the deployed host domain under Firebase Authentication's authorized domains. `html2canvas` is used for Download as Image.
