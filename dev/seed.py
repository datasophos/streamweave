#!/usr/bin/env python3
"""
Dev seed script — creates realistic example data via the StreamWeave API.

Designed to be idempotent: existing resources (matched by name) are skipped.
Run order matters: service accounts → storage → instruments → schedules → hooks.

Environment variables (all have defaults matching docker-compose.dev.yml):
  API_URL         http://api:8000
  ADMIN_EMAIL     admin@example.com
  ADMIN_PASSWORD  adminpassword
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

API_URL = os.environ.get("API_URL", "http://api:8000").rstrip("/")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "adminpassword")


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _request(method: str, path: str, body: dict | None = None, token: str | None = None) -> Any:
    url = f"{API_URL}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers: dict[str, str] = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            detail = json.loads(raw).get("detail", raw.decode())
        except Exception:
            detail = raw.decode()
        raise RuntimeError(f"{method} {path} → {exc.code}: {detail}") from exc


def login() -> str:
    url = f"{API_URL}/auth/jwt/login"
    form = urllib.parse.urlencode({"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).encode()
    req = urllib.request.Request(
        url, data=form, headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())["access_token"]


def wait_for_api(retries: int = 30, delay: float = 2.0) -> None:
    print(f"Waiting for API at {API_URL}/health …", flush=True)
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(f"{API_URL}/health", timeout=3) as resp:
                if resp.status == 200:
                    print("API is ready.", flush=True)
                    return
        except Exception:
            pass
        print(f"  attempt {attempt}/{retries} — retrying in {delay}s …", flush=True)
        time.sleep(delay)
    print("ERROR: API did not become healthy in time.", file=sys.stderr)
    sys.exit(1)


def create_if_absent(token: str, list_path: str, create_path: str, payload: dict, label: str) -> dict:
    """Create a resource only if no existing item has the same name."""
    existing = _request("GET", list_path, token=token)
    for item in existing:
        if item.get("name") == payload["name"]:
            print(f"  ⟳  {label} '{payload['name']}' already exists — skipping", flush=True)
            return item
    result = _request("POST", create_path, body=payload, token=token)
    print(f"  ✓  {label} '{payload['name']}' created", flush=True)
    return result


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

def seed(token: str) -> None:

    # ------------------------------------------------------------------
    # Service accounts (credentials instruments use to mount CIFS shares)
    # ------------------------------------------------------------------
    print("\n── Service accounts ──", flush=True)

    nmr_sa = create_if_absent(token, "/api/service-accounts", "/api/service-accounts", {
        "name": "Bruker NMR service account",
        "username": "devuser",
        "password": "devpass",
    }, "ServiceAccount")

    hplc_sa = create_if_absent(token, "/api/service-accounts", "/api/service-accounts", {
        "name": "Waters HPLC service account",
        "username": "devuser",
        "password": "devpass",
    }, "ServiceAccount")

    ms_sa = create_if_absent(token, "/api/service-accounts", "/api/service-accounts", {
        "name": "Thermo MS service account",
        "username": "devuser",
        "password": "devpass",
    }, "ServiceAccount")

    # ------------------------------------------------------------------
    # Storage locations
    # ------------------------------------------------------------------
    print("\n── Storage locations ──", flush=True)

    posix_store = create_if_absent(token, "/api/storage-locations", "/api/storage-locations", {
        "name": "Local POSIX archive",
        "type": "posix",
        "base_path": "/storage/posix-archive",
        "enabled": True,
    }, "StorageLocation")

    s3_store = create_if_absent(token, "/api/storage-locations", "/api/storage-locations", {
        "name": "S3 dev bucket",
        "type": "s3",
        "base_path": "instruments",
        "enabled": True,
        "connection_config": {
            "bucket": "instruments",
            "region": "us-east-1",
            "endpoint_url": "http://s3-dev:9000",
            "access_key_id": "devkey",
            "secret_access_key": "devsecret",
        },
    }, "StorageLocation")

    cifs_store = create_if_absent(token, "/api/storage-locations", "/api/storage-locations", {
        "name": "Samba archive share",
        "type": "cifs",
        "base_path": "/archive",
        "enabled": True,
        "connection_config": {
            "host": "samba-archive",
            "share": "archive",
            "username": "devuser",
            "password": "devpass",
        },
    }, "StorageLocation")

    # ------------------------------------------------------------------
    # Instruments  (all point at the Samba dev server as the data source)
    # ------------------------------------------------------------------
    print("\n── Instruments ──", flush=True)

    nmr = create_if_absent(token, "/api/instruments", "/api/instruments", {
        "name": "Bruker AVANCE III 600 MHz NMR",
        "description": "600 MHz solution NMR for small-molecule and protein characterization",
        "location": "Chemistry Building, Room 102",
        "cifs_host": "nmr-bruker",
        "cifs_share": "nmr",
        "cifs_base_path": "/",
        "service_account_id": str(nmr_sa["id"]),
        "transfer_adapter": "rclone",
        "enabled": True,
    }, "Instrument")

    hplc = create_if_absent(token, "/api/instruments", "/api/instruments", {
        "name": "Waters Acquity UPLC-MS",
        "description": "Ultra-performance liquid chromatography with mass spectrometry detection",
        "location": "Analytical Core, Room 210",
        "cifs_host": "hplc-waters",
        "cifs_share": "hplc",
        "cifs_base_path": "/",
        "service_account_id": str(hplc_sa["id"]),
        "transfer_adapter": "rclone",
        "enabled": True,
    }, "Instrument")

    ms = create_if_absent(token, "/api/instruments", "/api/instruments", {
        "name": "Thermo Orbitrap Exploris 480",
        "description": "High-resolution Orbitrap mass spectrometer for proteomics",
        "location": "Proteomics Core, Room 315",
        "cifs_host": "ms-orbitrap",
        "cifs_share": "ms",
        "cifs_base_path": "/",
        "service_account_id": str(ms_sa["id"]),
        "transfer_adapter": "rclone",
        "enabled": True,
    }, "Instrument")

    create_if_absent(token, "/api/instruments", "/api/instruments", {
        "name": "FEI Titan Themis 300 TEM",
        "description": "Aberration-corrected transmission electron microscope",
        "location": "Electron Microscopy Facility, Basement",
        "cifs_host": "tem-titan",
        "cifs_share": "tem",
        "cifs_base_path": "/",
        "transfer_adapter": "rclone",
        "enabled": False,   # offline for maintenance
    }, "Instrument")

    # ------------------------------------------------------------------
    # Harvest schedules
    # ------------------------------------------------------------------
    print("\n── Schedules ──", flush=True)

    def find_schedule(token: str, instrument_id: str, storage_id: str) -> dict | None:
        for s in _request("GET", "/api/schedules", token=token):
            if s["instrument_id"] == instrument_id and s["default_storage_location_id"] == storage_id:
                return s
        return None

    def create_schedule(token: str, instrument_id: str, storage_id: str, cron: str, name: str) -> None:
        if find_schedule(token, instrument_id, storage_id):
            print(f"  ⟳  Schedule for '{name}' already exists — skipping", flush=True)
            return
        _request("POST", "/api/schedules", token=token, body={
            "instrument_id": instrument_id,
            "default_storage_location_id": storage_id,
            "cron_expression": cron,
            "enabled": True,
        })
        print(f"  ✓  Schedule for '{name}' created ({cron})", flush=True)

    create_schedule(token, str(nmr["id"]), str(posix_store["id"]),  "0 * * * *",    "NMR → local POSIX (hourly)")
    create_schedule(token, str(nmr["id"]), str(s3_store["id"]),     "0 2 * * *",    "NMR → S3 (nightly)")
    create_schedule(token, str(hplc["id"]), str(posix_store["id"]), "*/30 * * * *", "HPLC → local POSIX (every 30 min)")
    create_schedule(token, str(ms["id"]),  str(cifs_store["id"]),   "0 */4 * * *",  "Orbitrap → CIFS (every 4 h)")

    # ------------------------------------------------------------------
    # Hooks
    # ------------------------------------------------------------------
    print("\n── Hooks ──", flush=True)

    create_if_absent(token, "/api/hooks", "/api/hooks", {
        "name": "Auto-assign file access on transfer",
        "description": "Grants the instrument owner read access to every transferred file",
        "trigger": "post_transfer",
        "implementation": "builtin",
        "builtin_name": "access_assignment",
        "priority": 0,
        "enabled": True,
    }, "Hook")

    create_if_absent(token, "/api/hooks", "/api/hooks", {
        "name": "NMR metadata enrichment",
        "description": "Extracts pulse programme, solvent, and nucleus from Bruker acqus files",
        "trigger": "post_transfer",
        "implementation": "builtin",
        "builtin_name": "metadata_enrichment",
        "instrument_id": str(nmr["id"]),
        "priority": 10,
        "enabled": True,
    }, "Hook")

    create_if_absent(token, "/api/hooks", "/api/hooks", {
        "name": "File size filter — skip temp files",
        "description": "Drops zero-byte and .tmp files before transfer",
        "trigger": "pre_transfer",
        "implementation": "builtin",
        "builtin_name": "file_filter",
        "config": {"min_size_bytes": 1, "exclude_patterns": ["*.tmp", "*.lock", "~*"]},
        "priority": 0,
        "enabled": True,
    }, "Hook")

    # ------------------------------------------------------------------
    # Regular (non-admin) users
    # ------------------------------------------------------------------
    print("\n── Users ──", flush=True)

    def create_user_if_absent(token: str, email: str, password: str, display: str) -> None:
        users = _request("GET", "/api/admin/users", token=token)
        if any(u["email"] == email for u in users):
            print(f"  ⟳  User '{email}' already exists — skipping", flush=True)
            return
        url = f"{API_URL}/auth/register"
        body = json.dumps({"email": email, "password": password}).encode()
        req = urllib.request.Request(
            url, data=body,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req) as resp:
                resp.read()
            print(f"  ✓  User '{email}' created", flush=True)
        except urllib.error.HTTPError as exc:
            raw = exc.read()
            print(f"  ✗  User '{email}' — {exc.code}: {raw.decode()[:120]}", flush=True)

    create_user_if_absent(token, "chemist@example.com",    "devpass123!", "Chemist")
    create_user_if_absent(token, "proteomics@example.com", "devpass123!", "Proteomics researcher")
    create_user_if_absent(token, "em-operator@example.com","devpass123!", "EM operator")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    wait_for_api()
    print("\nLogging in as admin …", flush=True)
    token = login()
    print("Seeding dev data …", flush=True)
    seed(token)
    print("\nDone. Dev environment is ready.", flush=True)
