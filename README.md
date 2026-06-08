# Jeopardy! — Internet Deployment (Railway)

This is the production-ready version of the Jeopardy app. One Node.js server
serves both the API/WebSocket layer and the built React client. Deploy it once
to Railway and share the URL in Teams — players join from their phones via the
same URL.

---

## Deploy to Railway (one-time setup, ~5 minutes)

### 1. Push this folder to GitHub

1. Create a new repository at github.com (can be private)
2. Open a terminal inside this folder (`jeopardy-deploy/`) and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Create a Railway project

1. Go to **railway.app** and sign in (GitHub login works)
2. Click **New Project → Deploy from GitHub repo**
3. Select your repo
4. Railway auto-detects the `railway.json` and runs:
   - **Build**: `npm run build` (installs deps, builds the React client)
   - **Start**: `node server/index.js`
5. Click **Generate Domain** in the Settings tab to get a public HTTPS URL
   (e.g. `https://jeopardy-abc123.up.railway.app`)

That's it. No environment variables needed.

---

## How to use over the internet

### Host (Teams meeting)
1. Open `https://your-app.up.railway.app` in your browser
2. Share that browser tab in Teams (share window/tab)
3. The QR code on the board points to your Railway URL automatically

### Players (phones)
- Scan the QR code on the board, OR
- Go to `https://your-app.up.railway.app/join/SESSION-ID` on their phone
- Enter their name and tap **Join Game**

### Upload questions
Go to `https://your-app.up.railway.app/settings` before the game to upload
your CSV file.

---

## Redeploying after changes

Push a new commit to GitHub — Railway auto-deploys:

```bash
git add .
git commit -m "Updated questions or fix"
git push
```

---

## CSV Format

```csv
Category,Value,Question,Answer,DailyDouble
Science,200,"What element has atomic number 79?","Gold",false
History,400,"This war ended in 1945","World War II",false
Science,600,"Speed of light in km/s","300000",true
```

| Column | Notes |
|--------|-------|
| Category | Column header on the board |
| Value | Integer (200, 400, 600, 800, 1000) |
| Question | The clue. Wrap in quotes if it contains commas. |
| Answer | Shown when host clicks Reveal Answer |
| DailyDouble | `true` or `false` |

A `sample-questions.csv` with 25 ready-to-use questions is included.

---

## Local development (optional)

If you want to run it locally while developing:

```bash
# Terminal 1 — server
cd server && npm install && npm run dev

# Terminal 2 — client
cd client && npm install && npm run dev
```

The `.env.development` file in `client/` already points the client at
`http://localhost:3001` for local dev.

---

## Architecture

```
jeopardy-deploy/
├── server/index.js      ← Express + Socket.io; serves client/dist in production
├── client/src/          ← React app (built to client/dist/ before deploy)
├── package.json         ← Root build + start scripts (used by Railway)
├── railway.json         ← Railway build/deploy config
└── .gitignore
```

Game state lives in server memory. Restarting the server (e.g., after a
redeploy) resets everything — upload your questions and start fresh each
session.
