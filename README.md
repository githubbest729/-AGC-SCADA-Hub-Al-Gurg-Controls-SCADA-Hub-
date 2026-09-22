# AGC SCADA Hub

**Al Gurg Controls SCADA Hub** — a Progressive Web App (PWA) built for SCADA Engineers at **Al Gurg Automation and Controls**, Dubai, UAE.

Track project requirements and stakeholders, build costing sheets for the estimation team, and run a cross-functional execution board — all from one offline-capable app you can install on your phone, tablet, or laptop for site work.

---

## ✨ Features

### 1. Dashboard
At-a-glance view of open requirements, blocked items, execution task counts by phase, saved costing sheets, and total estimated project value.

### 2. Requirements & Stakeholder Matrix
Log project requirements, assign stakeholders (Project Managers, Control System Engineers, Clients, Estimation Team), track priority and delivery status, and filter/search across all logged items.

### 3. Cost Estimation Engine
Build a Bill of Quantities (BOQ) with categories like PLCs, SCADA tags, I/O modules, network switches, HMI panels, and cabling. Add engineering hours at an hourly rate, apply contingency % and margin %, and generate a full costing sheet total — ready to hand to the estimation team. Save multiple costing sheets and print/export to PDF via your browser's print dialog.

### 4. Execution Board (Kanban)
Drag-and-drop (or use the ◀ ▶ arrows on mobile) tasks across five phases: **Design → Programming → FAT → Commissioning → SAT**. Assign an owner and team to each task for cross-functional collaboration.

### 5. Offline-First
All data is saved to your browser's `localStorage` — no backend, no database, no internet connection required after the first load. A service worker caches the entire app shell so it keeps working on-site with poor or no connectivity. An offline banner lets you know when you've lost connection (the app keeps working regardless).

### 6. Data Export
Export all your data (requirements, costing sheets, tasks) as a single JSON file at any time for backup or transfer to another device.

---

## 🛠 Tech Stack

Pure **vanilla HTML, CSS, and JavaScript** — no frameworks, no build step, no bundler. This keeps the app lightweight, fast to load on mobile data, and easy to maintain or extend.

---

## 📁 Repository Structure

```text
agc-scada-hub/
├── .github/
│   └── workflows/
│       └── deploy.yml       # Auto-deploys to GitHub Pages on push to main
├── icons/
│   ├── icon-192x192.png     # PWA install icon
│   └── icon-512x512.png     # PWA install icon (large)
├── .gitignore
├── index.html                # App shell + tabbed navigation
├── LICENSE                   # MIT License
├── manifest.json             # PWA manifest (installability)
├── package.json
├── README.md
├── service-worker.js         # Offline caching
├── app.js                    # All application logic
└── style.css                 # Industrial automation theme
```

---

## 🚀 Getting Started (Local Development)

No build tools required. Just serve the folder over HTTP (service workers require HTTP/HTTPS, not `file://`):

```bash
npm run start
# or simply:
npx serve .
```

Then open the printed local URL (e.g. `http://localhost:5173`) in your browser.

---

## ☁️ Deploying to GitHub Pages

This repo ships with a ready-to-go GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically deploys the site on every push to `main`.

1. Create a new GitHub repository and push this code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of AGC SCADA Hub"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```
2. In your repository on GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions** (one-time setup).
3. Push to `main` — the **Deploy AGC SCADA Hub to GitHub Pages** workflow will run automatically and publish the app to:
   ```text
   https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
   ```
4. Open that URL on your phone or desktop and use your browser's **"Install App" / "Add to Home Screen"** option to install it like a native app.

---

## 📱 Installing as an App

- **Android (Chrome):** Open the site → tap the **⋮** menu → **Install app**.
- **iOS (Safari):** Open the site → tap **Share** → **Add to Home Screen**.
- **Desktop (Chrome/Edge):** Open the site → click the **install icon** in the address bar.

Once installed, the app opens full-screen and works offline using the cached app shell.

---

## 🔒 Data & Privacy

All data entered into AGC SCADA Hub (requirements, costing sheets, execution tasks) is stored **only on your local device** via `localStorage`. Nothing is sent to a server. Use the **Export** button in the header to back up your data as a JSON file, or to move it to another device.

To reset the app, go to **⚙ Settings → Clear All Local Data**.

---

## 🏢 About

**Al Gurg Automation and Controls**
Al Ittihad Road (Dubai-Sharjah Road), Al Khabisi Area, Deira
PO Box 25490, Dubai, UAE

---

## 📄 License

MIT — see [LICENSE](LICENSE).
