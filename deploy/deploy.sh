#!/usr/bin/env bash
# LankaLane production deploy — runs ON the DigitalOcean droplet.
# Called by .github/workflows/deploy.yml, or by hand:  bash /var/www/rent/deploy/deploy.sh
#
# Follows "Lankalane VPS Deployment Guide": build -> verify BUILD_ID -> copy
# static/public into standalone -> restart ONLY lankalane-frontend -> verify.
# MyBiz2Flow (ports 3000/8000) shares this VPS and is never touched.
set -Eeuo pipefail

# ── Settings (override with env vars if your server differs) ────────────────
APP_DIR="${APP_DIR:-/var/www/rent}"
BRANCH="${BRANCH:-main}"
PM2="${PM2:-/home/deploy/.npm-global/bin/pm2}"
FRONTEND_PM2_NAME="${FRONTEND_PM2_NAME:-lankalane-frontend}"
BACKEND_PM2_NAME="${BACKEND_PM2_NAME:-}"        # set only if the Laravel API runs under PM2
PHP_FPM_SERVICE="${PHP_FPM_SERVICE:-}"          # e.g. php8.3-fpm — reloaded via sudo if set
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
BACKEND_PORT="${BACKEND_PORT:-8001}"
PUBLIC_URL="${PUBLIC_URL:-https://lankalane.fahathamm.com}"
BUILD_MEMORY_MB="${BUILD_MEMORY_MB:-768}"        # low-RAM VPS: cap Node heap during build
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"

FRONTEND="$APP_DIR/frontend"
BACKEND="$APP_DIR/backend"
BACKUP="$APP_DIR/.deploy-backup/standalone"
LOG_DIR="$APP_DIR/.deploy-logs"
mkdir -p "$LOG_DIR" "$(dirname "$BACKUP")"
LOG="$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*"; exit 1; }

# Accepts 2xx/3xx (next-intl may redirect / to a locale).
http_ok() {
  local url=$1 tries=${2:-10} code
  for _ in $(seq "$tries"); do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" || true)
    if [[ "$code" =~ ^[23] ]]; then echo "  $url -> $code"; return 0; fi
    sleep 3
  done
  echo "  $url -> ${code:-no response}"; return 1
}

# ── One deploy at a time ────────────────────────────────────────────────────
exec 9>"$APP_DIR/.deploy.lock"
flock -n 9 || fail "Another deploy is already running."

cd "$APP_DIR"
PREV_COMMIT=$(git rev-parse HEAD)

# ── 1. Pull latest main ─────────────────────────────────────────────────────
step "Pulling $BRANCH"
git fetch --prune origin "$BRANCH"
if ! git diff --quiet || ! git diff --cached --quiet; then
  git status --short
  fail "Server has uncommitted changes to tracked files — resolve them before deploying."
fi
git checkout -q "$BRANCH"
git merge --ff-only "origin/$BRANCH" || fail "Server branch has diverged from origin/$BRANCH."
NEW_COMMIT=$(git rev-parse HEAD)
echo "  $PREV_COMMIT -> $NEW_COMMIT"
git log --oneline "$PREV_COMMIT..$NEW_COMMIT" | head -20 || true

# Not `| grep -q .`: grep exits on the first line, git gets SIGPIPE and pipefail turns a long
# change list into "no changes".
changed() { [[ -n "$(git diff --name-only "$PREV_COMMIT" "$NEW_COMMIT" -- "$@")" ]]; }
FORCE="${FORCE:-false}"   # FORCE=true redeploys both sides even if nothing changed

# ── 2. Backend ──────────────────────────────────────────────────────────────
if [[ "$FORCE" == true ]] || changed backend; then
  step "Backend: composer install"
  cd "$BACKEND"
  composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-progress

  if [[ "$RUN_MIGRATIONS" == true ]]; then
    step "Backend: migrations"
    php artisan migrate --force
  fi

  step "Backend: caches"
  php artisan optimize:clear
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache
  php artisan storage:link 2>/dev/null || true
  php artisan queue:restart || true

  if [[ -n "$PHP_FPM_SERVICE" ]]; then sudo systemctl reload "$PHP_FPM_SERVICE"; fi
  if [[ -n "$BACKEND_PM2_NAME" ]]; then "$PM2" restart "$BACKEND_PM2_NAME" --update-env; fi
else
  step "Backend: no changes — skipped"
fi

step "Backend: health check"
http_ok "http://127.0.0.1:$BACKEND_PORT/up" || fail "Backend /up is not healthy on port $BACKEND_PORT."

# ── 3. Frontend ─────────────────────────────────────────────────────────────
if [[ "$FORCE" == true ]] || changed frontend; then
  cd "$FRONTEND"

  step "Frontend: backing up current standalone build"
  rm -rf "$BACKUP"
  if [[ -d .next/standalone ]]; then cp -a .next/standalone "$BACKUP"; fi

  restore_previous() {
    echo "  Build/verify failed — restoring previous build"
    if [[ -d "$BACKUP" ]]; then
      mkdir -p .next && rm -rf .next/standalone && cp -a "$BACKUP" .next/standalone
      "$PM2" restart "$FRONTEND_PM2_NAME" --update-env || true
    fi
  }

  step "Frontend: npm install"
  if changed frontend/package.json || [[ ! -d node_modules ]]; then
    npm install --no-audit --no-fund
  else
    echo "  package.json unchanged — skipped"
  fi

  step "Frontend: build (heap ${BUILD_MEMORY_MB}MB)"
  free -h || true
  if ! NODE_OPTIONS="--max-old-space-size=$BUILD_MEMORY_MB" NEXT_TELEMETRY_DISABLED=1 npm run build; then
    restore_previous; fail "next build failed."
  fi

  step "Frontend: verify BUILD_ID"
  MAIN_ID=$(cat .next/BUILD_ID 2>/dev/null || true)
  SA_ID=$(cat .next/standalone/.next/BUILD_ID 2>/dev/null || true)
  echo "  main=$MAIN_ID standalone=$SA_ID"
  if [[ -z "$MAIN_ID" || "$MAIN_ID" != "$SA_ID" ]]; then
    restore_previous; fail "BUILD_ID mismatch."
  fi

  step "Frontend: copy static + public into standalone"
  mkdir -p .next/standalone/.next/static
  cp -a .next/static/. .next/standalone/.next/static/
  if [[ -d public ]]; then
    mkdir -p .next/standalone/public
    cp -a public/. .next/standalone/public/
  fi

  step "Frontend: restart $FRONTEND_PM2_NAME only"
  "$PM2" restart "$FRONTEND_PM2_NAME" --update-env
  "$PM2" save >/dev/null 2>&1 || true

  if ! http_ok "http://127.0.0.1:$FRONTEND_PORT"; then
    restore_previous; fail "Frontend not responding on port $FRONTEND_PORT after restart."
  fi
else
  step "Frontend: no changes — skipped"
fi

# ── 4. Final checks ─────────────────────────────────────────────────────────
step "Final checks"
"$PM2" describe "$FRONTEND_PM2_NAME" | grep -m1 -E 'status' || true
http_ok "http://127.0.0.1:$FRONTEND_PORT" 3 || fail "Frontend down."
http_ok "$PUBLIC_URL" 5                    || fail "Public site not reachable: $PUBLIC_URL"

# keep the last 20 logs
ls -1t "$LOG_DIR"/deploy-*.log | tail -n +21 | xargs -r rm -f

printf '\n\033[1;32m✔ Deployed %s\033[0m  (log: %s)\n' "$(git rev-parse --short HEAD)" "$LOG"
