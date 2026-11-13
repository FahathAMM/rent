# Automated release: push → review → merge → deploy

```
 your PC                    GitHub                                   DigitalOcean (/var/www/rent)
 ─────────                  ──────                                   ────────────────────────────
 .\ship.ps1  ──push──►  PR dev/* → main
                         ├─ CI: Backend (Laravel tests, MySQL)
                         └─ CI: Frontend (lint + next build)
                         all green ─► auto-merge into main
                                         └─ Deploy workflow ──SSH──►  deploy/deploy.sh
                                                                      1. git pull main (fast-forward only)
                                                                      2. backend: composer, migrate, caches, /up check
                                                                      3. frontend: build, BUILD_ID check, copy static,
                                                                         restart lankalane-frontend ONLY, port 3001 check
                                                                      4. public HTTPS check
                                                                      on frontend failure → previous build restored
```

Only steps that changed are run: a backend-only change skips the frontend build.
MyBiz2Flow (ports 3000/8000) is never restarted.

---

## One-time setup (≈15 min)

### 1. Server (SSH in as root or your sudo user)

```bash
# a) The deploy user owns the app and can pull from GitHub without a password
sudo chown -R deploy:deploy /var/www/rent
sudo -u deploy -H ssh-keygen -t ed25519 -f /home/deploy/.ssh/github_deploy -N ""
sudo -u deploy -H cat /home/deploy/.ssh/github_deploy.pub
#   → GitHub repo → Settings → Deploy keys → Add (read-only), paste the key
sudo -u deploy -H bash -c 'cat >> ~/.ssh/config <<EOF
Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
EOF'
cd /var/www/rent
sudo -u deploy git remote set-url origin git@github.com:FahathAMM/rent.git
sudo -u deploy git fetch origin && sudo -u deploy git checkout main

# b) A key GitHub Actions uses to SSH in as deploy
sudo -u deploy -H ssh-keygen -t ed25519 -f /home/deploy/.ssh/gh_actions -N ""
sudo -u deploy -H bash -c 'cat ~/.ssh/gh_actions.pub >> ~/.ssh/authorized_keys'
sudo cat /home/deploy/.ssh/gh_actions        # ← private key, copy for step 2

# c) Dry run by hand once (FORCE=true deploys both sides)
sudo -u deploy -H env FORCE=true bash /var/www/rent/deploy/deploy.sh
```

If `git status` on the server shows modified tracked files, commit or discard them first.
The script refuses to deploy over local edits.

If PHP runs with `opcache.validate_timestamps=0`, add `PHP_FPM_SERVICE=php8.3-fpm` (see “Settings” below)
and allow it in sudoers:
`deploy ALL=NOPASSWD: /bin/systemctl reload php8.3-fpm`.

### 2. GitHub → repo **Settings → Secrets and variables → Actions**

| Secret        | Value                                       |
|---------------|---------------------------------------------|
| `DO_HOST`     | droplet IP                                  |
| `DO_USER`     | `deploy`                                    |
| `DO_SSH_KEY`  | the private key printed in step 1b          |
| `DO_PORT`     | only if SSH isn't on 22                     |

### 3. GitHub → **Settings → General**: tick **Allow auto-merge**

### 4. GitHub → **Settings → Branches → Add rule** for `main`
- ✅ Require a pull request before merging (set required approvals to **0** for fully automatic, or **1** if you want to approve each release yourself)
- ✅ Require status checks to pass → add **Backend (Laravel tests)** and **Frontend (lint + build)**
  (they appear in the list after CI has run once)

### 5. On your PC: install GitHub CLI once → `winget install GitHub.cli`, then `gh auth login`

---

## Daily use (from `D:\rent_vehicle`, on your `dev/fahath` branch)

```powershell
.\ship.ps1 -Message "Add booking filter" -Wait
```
That commits, merges latest main, pushes, opens or updates the PR, and enables auto-merge.
With `-Wait` it then watches CI, the merge and the production deploy until the site is live.
Without `-Wait` it returns straight away and everything continues on GitHub.

Other handy commands:
```powershell
gh run list --workflow deploy.yml          # recent deploys
gh run view --log-failed                   # why the last one failed
gh workflow run deploy.yml                 # redeploy main manually
```
Logs on the server: `/var/www/rent/.deploy-logs/`.

### Rolling back
Revert the bad commit on a branch and ship it (`git revert <sha>` → `.\ship.ps1`).
A frontend build that fails during deploy is rolled back automatically. Database migrations are **not** rolled back automatically.

### Settings (env vars for deploy.sh)
`BRANCH`, `PM2`, `FRONTEND_PM2_NAME`, `BACKEND_PM2_NAME`, `PHP_FPM_SERVICE`, `FRONTEND_PORT` (3001),
`BACKEND_PORT` (8001), `PUBLIC_URL`, `BUILD_MEMORY_MB` (768), `RUN_MIGRATIONS` (true), `FORCE`.
To change one for every automated deploy, put it in front of `bash /tmp/lankalane-deploy.sh` in
`.github/workflows/deploy.yml`, e.g. `PHP_FPM_SERVICE=php8.3-fpm bash /tmp/lankalane-deploy.sh`.

### Optional: auto-merge PRs opened on github.com too
`ship.ps1` turns auto-merge on by itself. For PRs you open in the browser, create a fine-grained token
(Contents + Pull requests: write, this repo only). Save it as secret `AUTOMERGE_TOKEN`, then add a
repository **variable** `AUTOMERGE_ENABLED` = `true`.
