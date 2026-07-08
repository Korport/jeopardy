# Jeopardy! — Azure VM Deployment

A real-time multiplayer Jeopardy-style trivia game. The host displays the board
on a big screen (or shares it in Teams); players join from their phones by
scanning a QR code or visiting the URL directly.

One Node.js server handles both the API/WebSocket layer and serves the built
React client. nginx sits in front on port 80 and proxies everything through.

---

## Architecture

```
Internet
   │
   ▼ port 80
 nginx  (Azure VM)
   │
   ▼ port 3001 (internal only)
 Node.js / Socket.io   (managed by PM2)
   │
   └── serves client/dist/  (built React app)
```

---

## First-Time Server Setup

### 1. SSH into your Azure VM

```bash
ssh azureuser@YOUR-VM-PUBLIC-IP
```

### 2. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should show v20.x
```

### 3. Install PM2

```bash
sudo npm install -g pm2
```

### 4. Clone the repo and build

```bash
cd ~
git clone https://github.com/Korport/jeopardy.git
cd jeopardy
npm run build
```

### 5. Start the app with PM2

```bash
pm2 start server/index.js --name jeopardy
pm2 save
pm2 startup   # copy and run the command it prints to enable auto-start on reboot
```

### 6. Install and configure nginx

```bash
sudo apt-get install -y nginx
sudo nano /etc/nginx/sites-available/jeopardy
```

Paste this config (replace `YOUR-VM-PUBLIC-IP` with your actual IP):

```nginx
server {
    listen 80;
    server_name YOUR-VM-PUBLIC-IP;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;

        # Required for Socket.io WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and start nginx:

```bash
sudo ln -s /etc/nginx/sites-available/jeopardy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 7. Open port 80 in Azure

In the Azure Portal:
1. Go to your VM → **Networking** → **Network Security Group**
2. Click **Add inbound port rule**
3. Set Destination port to `80`, Protocol `TCP`, Action `Allow`
4. Click **Add**

### 8. Access the app

Open a browser and go to:
```
http://YOUR-VM-PUBLIC-IP
```

---

## Deploying Updates (after pushing changes to GitHub)

Whenever you push new code to GitHub, SSH into the VM and run:

```bash
cd ~/jeopardy
git pull
npm run build
pm2 restart jeopardy
```

One-liner version you can paste quickly:

```bash
cd ~/jeopardy && git pull && npm run build && pm2 restart jeopardy
```

---

## Checking Server Status

```bash
pm2 status                  # is the app running?
pm2 logs jeopardy           # live logs (Ctrl+C to exit)
sudo systemctl status nginx # is nginx running?
```

If the app is down after a VM reboot:

```bash
pm2 start server/index.js --name jeopardy
sudo systemctl start nginx
```

---

## How to Play

### Host (Teams meeting or big screen)
1. Open `http://YOUR-VM-PUBLIC-IP` in your browser
2. Go to `/settings` to upload your CSV question file
3. Share the browser tab in Teams

### Players (phones)
- Scan the QR code displayed on the board, or
- Navigate to `http://YOUR-VM-PUBLIC-IP/join/SESSION-ID`
- Enter a name and tap **Join Game**

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
| Category | Column header shown on the board |
| Value | Integer (200, 400, 600, 800, 1000) |
| Question | The clue. Wrap in quotes if it contains commas. |
| Answer | Shown when host clicks Reveal Answer |
| DailyDouble | `true` or `false` — marks cell with ⭐, prompts for wager |

A `sample-questions.csv` with 25 ready-to-use questions is included.

---

## Optional: Add HTTPS

If you point a domain name at your VM's IP, you can get a free SSL cert:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Certbot edits your nginx config automatically and renews the cert on schedule.
