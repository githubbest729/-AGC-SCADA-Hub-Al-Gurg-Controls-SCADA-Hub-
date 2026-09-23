# AGC SCADA Hub

**Al Gurg Controls SCADA Hub** — a Progressive Web App (PWA) built for SCADA Engineers at **Al Gurg Automation and Controls**, Dubai, UAE.

Track project requirements and stakeholders, build professional costing sheets, manage execution across Design → Programming → FAT → Commissioning → SAT, maintain a full I/O & Tag database, and generate Control Narratives / FDS documents — all from one offline-capable app you can install on your phone, tablet, or laptop for site work.

---

## ✨ Features (2026 Edition)

### 1. Dashboard
At-a-glance view of open requirements, blocked items, execution task counts by phase, saved costing sheets, and total estimated project value (AED/USD).

### 2. Requirements & Stakeholder Matrix
Log project requirements, assign stakeholders (Project Managers, Control System Engineers, Clients, Estimation Team, IT/OT), track priority and delivery status, and filter/search across all logged items. Generate PDF reports.

### 3. I/O & Tag Database
Full professional I/O list with:
- Signal Type (AI / AO / DI / DO)
- PLC Address
- HMI Screen mapping
- Alarm Priority
- Import / Export CSV
- Automatic tag count summary + recommended SCADA license tier

### 4. Cost Estimation Engine
Build a complete Bill of Quantities (BOQ) using a realistic 2026 UAE hardware & software catalog:
- PLC CPUs (Siemens, Rockwell, Schneider)
- I/O modules, HMIs, servers, network switches, UPS
- SCADA software licenses (WinCC, Ignition, Wonderware, FactoryTalk)
- Engineering rates by phase (Design, Programming, FAT, SAT, Commissioning, Site Supervision)
- Contingency % + Margin %
- Save multiple costing sheets and export to CSV / PDF

### 5. Execution Board (Kanban)
Drag-and-drop (or use ◀ ▶ arrows on mobile) tasks across five phases:  
**Design → Programming → FAT → Commissioning → SAT**  
Assign owners, due dates, and priorities. Sync buttons for ClickUp and n8n (demo-ready).

### 6. FAT / SAT Delivery Protocol
Track Factory and Site Acceptance Testing sign-offs for stakeholders. Export professional sign-off PDFs.

### 7. Control Narrative / FDS
Write and manage Functional Design Specifications with structured sections:
- Project Overview
- System Architecture
- Control Philosophy
- Sequence of Operations
- Alarm Philosophy
- HMI Design Guidelines
- FAT/SAT Criteria  
Export clean, branded PDFs.

### 8. Cross-Functional Site Punchlist
Log Mechanical, Electrical, and IT/OT site snags. Status tracking + one-click “Share to WhatsApp” for subcontractors.

### 9. Offline-First (IndexedDB)
All data is stored locally using **IndexedDB** (with localStorage fallback) for robust offline performance on site. A service worker caches the entire app shell so it keeps working with poor or no connectivity.

### 10. Data Export & Backup
Export the entire database (requirements, tags, costing sheets, tasks, punchlist, FDS) as a single JSON file at any time for backup or transfer to another device.

---

## 🛠 Tech Stack

- Pure **vanilla HTML, CSS, and JavaScript** (ES6+)
- **IndexedDB** for offline data persistence
- Service Worker for offline caching
- No frameworks, no build step, no bundler

This keeps the app lightweight, fast on mobile data, and easy to maintain or extend.

---

## 📁 Repository Structure

```text
agc-scada-hub/
├── .github/workflows/
│   └── deploy.yml              # Auto-deploys to GitHub Pages
├── data/
│   ├── boq-catalog.json        # 2026 UAE hardware & engineering rates
│   └── sample-project.json     # Realistic Al Ain WTP sample data
├── icons/
│   ├── icon-192x192.png
│   ├── icon-512x512.png
│   └── og-image.png
├── scripts/
│   ├── api.js
│   ├── db.js                   # IndexedDB data layer
│   ├── export.js
│   ├── pdf-generator.js
│   ├── punchlist.js
│   ├── io-tags.js              # I/O & Tag Database module
│   ├── execution-board.js
│   └── fds.js                  # Control Narrative / FDS module
├── index.html
├── app.js                      # Main application logic
├── style.css
├── service-worker.js
├── manifest.json
├── package.json
├── LICENSE
└── README.md
```

---

## 🚀 Getting Started (Local Development)

No build tools required. Just serve the folder over HTTP (service workers require HTTP/HTTPS):

```bash
npx serve .
```

Then open the printed local URL (e.g. `http://localhost:3000`) in your browser.

---

## ☁️ Deploying to GitHub Pages

This repo includes a ready-to-go GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically deploys on every push to `main`.

1. Push your code to the `main` branch.
2. In the repository go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The app will be published at:

```
https://githubbest729.github.io/-AGC-SCADA-Hub-Al-Gurg-Controls-SCADA-Hub-/
```

---

## 📱 Installing as an App

- **Android (Chrome):** Open the site → ⋮ menu → **Install app**
- **iOS (Safari):** Share → **Add to Home Screen**
- **Desktop (Chrome/Edge):** Click the install icon in the address bar

Once installed, the app opens full-screen and works fully offline.

---

## 🔒 Data & Privacy

All data (requirements, I/O tags, costing sheets, execution tasks, punchlist, FDS documents) is stored **only on your local device** using **IndexedDB**.  
Nothing is sent to any server.

Use the **Export** button in the header to download a full JSON backup at any time.

To reset the app: **⚙ Settings → Clear All Local Data**.

---

## 🏢 About

**Al Gurg Automation and Controls**  
Al Ittihad Road (Dubai-Sharjah Road), Al Khabisi Area, Deira  
PO Box 25490, Dubai, UAE

---

## 📄 License

MIT — see [LICENSE](LICENSE).
