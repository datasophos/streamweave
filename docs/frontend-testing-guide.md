# Streamweave Frontend — Manual Testing Guide

This guide walks through testing the full stack end-to-end in a local dev environment: Docker Compose for the backend services, and either the Vite dev server or the production Nginx build for the frontend.

---

## 1. Prerequisites

- Docker Desktop running
- `docker compose` v2 available (`docker compose version`)
- Node 22+ and npm (for running the Vite dev server outside Docker)
- A terminal in the repo root: `streamweave/`

---

## 2. Start the stack

### Option A — Dev mode (hot-reload, faster iteration)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Services started:

| Service | URL |
|---|---|
| Frontend (Vite dev) | http://localhost:3000 |
| API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Prefect UI | http://localhost:4200 |
| PostgreSQL | localhost:5432 |

### Option B — Production build (Nginx)

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend (Nginx) | http://localhost |
| API | http://localhost:8000 |
| Prefect UI | http://localhost:4200 |

> Wait until `api` logs `Application startup complete` before proceeding. The first run runs Alembic migrations, which takes a few seconds.

---

## 3. Create the first admin user

The registration endpoint is open, but admin creation requires running the script against the running API container.

```bash
docker compose exec api python scripts/create-admin.py \
  --email admin@example.com \
  --password adminpass1
```

Expected output:
```
Admin user created: admin@example.com (id=<uuid>)
```

---

## 4. Authentication

### 4.1 Sign in as admin

1. Navigate to the frontend URL (http://localhost:3000 or http://localhost).
2. You should be redirected to `/login`.
3. Enter:
   - **Email:** `admin@example.com`
   - **Password:** `adminpass1`
4. Click **Sign in**.

**Expected:** Redirected to the Dashboard. The nav bar shows all admin links: Dashboard, Instruments, Storage, Schedules, Hooks, Users. The header shows "Streamweave".

### 4.2 Bad credentials

1. Sign out (if needed) and go back to `/login`.
2. Enter a wrong password.
3. Click **Sign in**.

**Expected:** An inline red error box appears. It should show `LOGIN_BAD_CREDENTIALS` (the raw string from the API) or "Invalid credentials." — not a generic browser error.

### 4.3 Unauthenticated redirect

1. Sign out (clear localStorage or use an incognito window).
2. Navigate directly to `http://localhost:3000/admin/instruments`.

**Expected:** Redirected to `/login` immediately (no flash of content).

### 4.4 Session persistence

1. Sign in, then hard-refresh the page (Cmd+Shift+R / Ctrl+Shift+R).

**Expected:** Still logged in; no redirect to `/login`.

---

## 5. Dashboard

Navigate to `/` (Dashboard).

### 5.1 System health badge

**Expected:** A "Healthy" green badge next to "System status:". The badge polls every 30 seconds — confirm by watching it stay green.

### 5.2 Stats cards

With no data yet, the stat cards show `—` or `0` for files/transfers. **Expected:** No crash; placeholders render gracefully.

### 5.3 No-transfers state

**Expected:** The "Recent Transfers" section shows "No transfers yet." in muted text.

---

## 6. Admin — Instruments

Navigate to **Instruments** (`/admin/instruments`).

### 6.1 Create a service account

Before creating an instrument you need a CIFS service account (optional but realistic).

1. Click **New Service Account**.
2. Fill in:
   - **Name:** `Lab SA`
   - **Username:** `labuser`
   - **Password:** `labpassword`
3. Click **Save**.

**Expected:** Modal closes; the Service Accounts table shows the new row with name, username, and a creation date.

### 6.2 Create an instrument

1. Click **New Instrument**.
2. Fill in:
   - **Name:** `Bruker NMR`
   - **CIFS Host:** `192.168.1.100`
   - **CIFS Share:** `nmr-data`
   - **Service Account:** select "Lab SA" from the dropdown
3. Click **Save**.

**Expected:** Modal closes; the Instruments table shows a row with name, host, share, service account name, and an "Enabled" badge.

### 6.3 Edit an instrument

1. Click **Edit** on the Bruker NMR row.
2. Change **Name** to `Bruker NMR 500`.
3. Click **Save**.

**Expected:** Modal closes; the table row updates to "Bruker NMR 500".

### 6.4 Validation — missing required fields

1. Click **New Instrument**.
2. Leave **Name**, **CIFS Host**, and **CIFS Share** blank.
3. Click **Save**.

**Expected:** Browser native validation prevents submission (the fields are `required`); no API call is made.

### 6.5 Cancel / Escape closes modal

1. Click **New Instrument**, then click **Cancel**.
   **Expected:** Modal disappears.
2. Click **New Instrument** again, then press **Escape**.
   **Expected:** Modal disappears.

### 6.6 Delete an instrument

1. Click **Delete** on any instrument row.

**Expected:** A browser `confirm()` dialog appears with the instrument name in the message. Clicking **Cancel** closes it with no change. Clicking **OK** removes the row.

---

## 7. Admin — Storage Locations

Navigate to **Storage** (`/admin/storage`).

### 7.1 Create a POSIX storage location

1. Click **New Storage Location**.
2. Fill in:
   - **Name:** `Local Archive`
   - **Type:** `posix`
   - **Base Path:** `/storage/archive`
3. Click **Save**.

**Expected:** Row appears in the table with name, type badge, and base path.

### 7.2 Create an S3 storage location

1. Click **New Storage Location**.
2. Fill in:
   - **Name:** `S3 Bucket`
   - **Type:** `s3`
   - **Base Path:** `my-bucket/data`
3. Click **Save**.

**Expected:** Second row appears; type badge shows "s3".

### 7.3 Edit a storage location

1. Click **Edit** on "Local Archive".
2. Change **Base Path** to `/storage/archive2`.
3. Click **Save**.

**Expected:** Table row updates in-place.

---

## 8. Admin — Harvest Schedules

Navigate to **Schedules** (`/admin/schedules`).

### 8.1 Create a schedule

1. Click **New Schedule**.
2. Fill in:
   - **Instrument:** select "Bruker NMR 500" (or whichever exists)
   - **Default Storage:** select "Local Archive"
   - **Cron Expression:** `0 * * * *` (hourly)
3. Click **Save**.

**Expected:** Row appears in the table showing instrument name, storage name, cron expression, and an "Enabled" badge. The "Prefect Deployment" column shows `—` (not yet synced to Prefect).

### 8.2 Edit a schedule

1. Click **Edit** on the schedule.
2. Change the **Cron Expression** to `0 2 * * *` (2 AM daily).
3. Click **Save**.

**Expected:** Row updates.

---

## 9. Admin — Hooks

Navigate to **Hooks** (`/admin/hooks`).

### 9.1 Create a post-transfer webhook hook

1. Click **New Hook**.
2. Fill in:
   - **Name:** `Notify NEMO`
   - **Trigger:** `post_transfer`
   - **Implementation:** `http_webhook`
   - **Webhook URL:** `http://nemo.example.com/webhook`
3. Click **Save**.

**Expected:** Row appears in the hooks table.

### 9.2 Create a global hook vs. instrument-scoped hook

1. Create a hook with no instrument selected — it should appear with "Global" or `—` in the Instrument column.
2. Create a second hook with an instrument selected.

**Expected:** Both appear; the instrument-scoped hook shows the instrument name.

---

## 10. Admin — User Management

Navigate to **Users** (`/admin/users`).

### 10.1 View users

**Expected:** A table shows at least the admin account you created, with email, role badge ("admin"), and active status.

### 10.2 Create a regular user

1. Click **New User**.
2. Fill in:
   - **Email:** `researcher@example.com`
   - **Password:** `researchpass1`
   - **Role:** `user`
3. Click **Save**.

**Expected:** New row appears with role "user" and active status.

### 10.3 Promote a user to admin

1. Click **Edit Role** on the researcher row.
2. Change **Role** to `admin`.
3. Click **Save**.

**Expected:** Badge in the table updates to "admin".

### 10.4 Cannot delete yourself

1. Locate your own admin account row.

**Expected:** The Delete button is disabled or absent for your own account.

---

## 11. Role-based access — non-admin user

### 11.1 Sign in as the regular user

1. Sign out (top-right or clear `access_token` from localStorage).
2. Sign in as `researcher@example.com` / `researchpass1`.

**Expected:**
- Nav bar shows: Dashboard, My Files, Transfers, Request Instrument.
- Admin links (Instruments, Storage, Schedules, Hooks, Users) are **not visible**.

### 11.2 Direct URL access to admin page

1. While logged in as the researcher, navigate to `http://localhost:3000/admin/instruments`.

**Expected:** Redirected to `/` (Dashboard), not an error page.

---

## 12. User — My Files

Navigate to **My Files** (`/files`).

With no harvests run yet, the table is empty.

**Expected:** "No files found." message (or an empty table state), not a crash.

If you have seeded data (see section 15), rows appear with filename, instrument name, persistent ID (ARK), size, and a discovered date.

### 12.1 Search / filter

1. Type part of a filename in the search box.

**Expected:** The table filters in real-time (client-side) or re-queries. Only matching rows remain visible.

---

## 13. User — Transfers

Navigate to **Transfers** (`/transfers`).

**Expected:** Transfer history table with columns: file, storage location, status badge, bytes, started, completed.

Status badges should be color-coded:
- **completed** → green
- **failed** → red
- **in_progress** → blue
- **pending** → yellow

---

## 14. User — Instrument Request

Navigate to **Request Instrument** (`/request`).

**Expected:** A form where a user can describe an instrument they want harvested. Submitting it should succeed (or show a relevant message if the endpoint isn't implemented for Milestone 3).

---

## 15. Optional — seed simlab data

If you have the simulated lab running:

```bash
# Start the simlab containers (Samba shares)
docker compose -f simlab/docker-compose.simlab.yml up -d

# Seed instruments/storage/schedules into the DB
docker compose exec api python /app/../simlab/seed.py
```

Then navigate to Instruments — three simulated instruments should appear (microscope-01, spectrometer-01, xray-diffraction-01) with their CIFS configs pre-filled.

---

## 16. API docs cross-check

While the frontend is under test, keep `http://localhost:8000/docs` open in another tab. You can use Swagger UI to:

- Confirm the JWT token is accepted (click **Authorize**, paste your `access_token`)
- Inspect raw request/response payloads for any operation that behaves unexpectedly in the UI
- Manually create edge-case data (e.g. a transfer with status `failed`) to verify the UI renders it correctly

---

## 17. Quick smoke-test checklist

Use this as a final pass before declaring the frontend working:

| # | Check | Pass? |
|---|---|---|
| 1 | `/login` renders email + password fields and Sign in button | |
| 2 | Wrong credentials shows inline error, not a blank page | |
| 3 | Correct credentials navigates to Dashboard | |
| 4 | Hard refresh keeps session alive | |
| 5 | Dashboard shows "Healthy" badge | |
| 6 | Admin nav links visible when admin; hidden when regular user | |
| 7 | `/admin/instruments` blocked for non-admin (redirects to `/`) | |
| 8 | Create instrument → row appears in table | |
| 9 | Edit instrument → row updates | |
| 10 | Delete instrument → confirm dialog → row removed | |
| 11 | Escape key closes any open modal | |
| 12 | Create storage location → row appears | |
| 13 | Create schedule → row appears | |
| 14 | Create user → row appears in Users table | |
| 15 | My Files page renders without error (even when empty) | |
| 16 | Transfers page renders status badges correctly | |
| 17 | No console errors in browser DevTools (F12) | |
