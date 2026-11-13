# Lankalane VPS Deployment Guide

## 1. Server Details

- Domain: https://lankalane.fahathamm.com
- Project: /var/www/rent
- Frontend: /var/www/rent/frontend
- Backend: /var/www/rent/backend
- Frontend port: 3001
- Backend port: 8001
- PM2 process: lankalane-frontend
- Nginx config: /etc/nginx/sites-available/lankalane
- Enabled config: /etc/nginx/sites-enabled/lankalane

**Important:** MyBiz2Flow shares this VPS. Keep its frontend on port 3000 and backend on port 8000 unchanged. Never use `pm2 restart all`.

## 2. Normal Deployment After Frontend Changes

### Step 1 — Go to the frontend directory

```bash
cd /var/www/rent/frontend
```

### Step 2 — Build the production app

```bash
npm run build
```

Wait for the build to finish successfully. If it fails, fix the error before restarting PM2.

### Step 3 — Verify the build IDs

```bash
cat .next/BUILD_ID
cat .next/standalone/.next/BUILD_ID
```

The two IDs should match. If the standalone ID is missing or different, investigate before restarting.

### Step 4 — Copy static assets to standalone output

```bash
mkdir -p .next/standalone/.next/static
cp -a .next/static/. .next/standalone/.next/static/

if [ -d public ]; then
  mkdir -p .next/standalone/public
  cp -a public/. .next/standalone/public/
fi
```

This ensures the standalone deployment contains Next.js static chunks and public assets such as images.

### Step 5 — Restart only Lankalane frontend

```bash
sudo -u deploy -H /home/deploy/.npm-global/bin/pm2 restart lankalane-frontend
```

Do not restart or delete other PM2 processes.

### Step 6 — Check PM2 status

```bash
sudo -u deploy -H /home/deploy/.npm-global/bin/pm2 status
```

Confirm `lankalane-frontend` is `online`.

### Step 7 — Test frontend and public website

```bash
curl -I http://127.0.0.1:3001
curl -I https://lankalane.fahathamm.com
```

A `200 OK` response is expected for the homepage. Other routes may return different valid status codes depending on authentication or route behavior.

### Step 8 — Hard refresh the browser

Press `Ctrl + Shift + R` in Chrome, or test in an Incognito window.

Check the latest UI, images, login, API requests, and browser Console/Network errors.

## 3. Create a Separate Nginx Site

### Step 1 — Create the site configuration

Replace `example.com` and the port with values for the new site.

```bash
sudo nano /etc/nginx/sites-available/example.com
```

Add the appropriate HTTP/HTTPS server blocks, domain names, proxy settings, and certificate paths. Save with `Ctrl + O`, press `Enter`, then exit with `Ctrl + X`.

### Step 2 — Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/example.com /etc/nginx/sites-enabled/example.com
```

If the symlink already exists, do not create it again. Check enabled sites with:

```bash
ls -l /etc/nginx/sites-enabled/
```

### Step 3 — Test Nginx configuration

```bash
sudo nginx -t
```

Continue only if the configuration test succeeds. If it fails, fix the reported issue first.

### Step 4 — Reload Nginx

```bash
sudo systemctl reload nginx
```

### Step 5 — Verify Nginx and the domain

```bash
sudo systemctl status nginx --no-pager
curl -I https://example.com
```

Confirm the DNS record points to the correct server and that HTTPS certificates are configured for the domain.

## 4. Troubleshooting

### Frontend logs

```bash
sudo -u deploy -H /home/deploy/.npm-global/bin/pm2 logs lankalane-frontend --lines 100
```

### Nginx errors

```bash
sudo tail -n 100 /var/log/nginx/error.log
```

### Memory usage

```bash
free -h
```

This VPS has limited memory. Avoid repeated builds if the build is being killed for lack of RAM.

### Build succeeds but old UI remains

1. Confirm the latest code is actually on the VPS.
2. Run `npm run build` and confirm it succeeds.
3. Verify both build IDs match.
4. Copy `.next/static` and `public` into `.next/standalone`.
5. Restart only `lankalane-frontend`.
6. Check PM2 logs and hard-refresh the browser.

pm2 status
pm2 delete 3

============ old ================
cd /var/www/rent/frontend
mkdir -p .next/standalone/frontend/.next/static
cp -a .next/static/. .next/standalone/frontend/.next/static/
if [ -d public ]; then
    cp -a public/. .next/standalone/frontend/
fi
ls -lah .next/standalone/frontend/.next/static
pm2 restart lankalane-frontend --update-env



============ new ================

# First, create another 1 GB swap file:
sudo fallocate -l 1G /swapfile3
sudo chmod 600 /swapfile3
sudo mkswap /swapfile3
sudo swapon /swapfile3

# Stop the other frontend temporarily:
pm2 stop mybiz2flow-frontend

NODE_OPTIONS="--max-old-space-size=768" npm run build
pm2 restart mybiz2flow-frontend


cd /var/www/rent/frontend
mkdir -p .next/standalone/.next/static
cp -a .next/static/. .next/standalone/.next/static/

if [ -d public ]; then
    mkdir -p .next/standalone/public
    cp -a public/. .next/standalone/public/
fi

ls -lah .next/standalone/.next/static/css/
pm2 restart lankalane-frontend

frontend/
└── .next/
    └── standalone/
        ├── server.js
        ├── package.json
        ├── node_modules/
        ├── public/
        └── .next/
            ├── BUILD_ID
            └── static/
                ├── css/
                ├── chunks/
                └── media/
                
============ end new ==============


Check current RAM and swap
============================
free -h
swapon --show



### ChunkLoadError or missing images

Check that `.next/standalone/.next/static` contains the generated chunks and `.next/standalone/public` contains public assets. Then inspect browser Network errors and PM2 logs.

## 5. Final Deployment Checklist

- [ ] Latest code is present on the VPS.
- [ ] `npm run build` completed successfully.
- [ ] Main and standalone BUILD_ID values match.
- [ ] Static assets copied to standalone output.
- [ ] `lankalane-frontend` restarted and is online.
- [ ] Frontend port 3001 responds as expected.
- [ ] Public HTTPS website responds as expected.
- [ ] Latest UI and images are visible.
- [ ] Login and API requests work.
- [ ] MyBiz2Flow on ports 3000 and 8000 remains untouched.

**Normal workflow:** Build → Copy assets → Restart Lankalane only → Verify PM2 → Test local frontend → Test HTTPS website.