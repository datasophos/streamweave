# API Reference

All resource endpoints require JWT authentication. Admin role is required for management operations (creating/updating/deleting instruments, schedules, hooks, etc.).

## Authentication

### Register

```
POST /auth/register
```

```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### Login

```
POST /auth/jwt/login
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=securepassword
```

Returns:

```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

Use the token in subsequent requests:

```
Authorization: Bearer <access_token>
```

---

## Instruments

| Method | Endpoint | Description | Role |
|---|---|---|---|
| GET | `/api/instruments` | List all instruments | Admin |
| GET | `/api/instruments/{id}` | Get instrument details | Admin |
| POST | `/api/instruments` | Create instrument | Admin |
| PATCH | `/api/instruments/{id}` | Update instrument | Admin |
| DELETE | `/api/instruments/{id}` | Delete instrument | Admin |

---

## Storage Locations

| Method | Endpoint | Description | Role |
|---|---|---|---|
| GET | `/api/storage-locations` | List storage locations | Admin |
| GET | `/api/storage-locations/{id}` | Get storage location | Admin |
| POST | `/api/storage-locations` | Create storage location | Admin |
| PATCH | `/api/storage-locations/{id}` | Update storage location | Admin |
| DELETE | `/api/storage-locations/{id}` | Delete storage location | Admin |

---

## Service Accounts

| Method | Endpoint | Description | Role |
|---|---|---|---|
| GET | `/api/service-accounts` | List service accounts | Admin |
| GET | `/api/service-accounts/{id}` | Get service account | Admin |
| POST | `/api/service-accounts` | Create service account | Admin |
| PATCH | `/api/service-accounts/{id}` | Update service account | Admin |
| DELETE | `/api/service-accounts/{id}` | Delete service account | Admin |

---

## Harvest Schedules

| Method | Endpoint | Description | Role |
|---|---|---|---|
| GET | `/api/schedules` | List schedules | Admin |
| GET | `/api/schedules/{id}` | Get schedule | Admin |
| POST | `/api/schedules` | Create schedule (+ Prefect deployment) | Admin |
| PATCH | `/api/schedules/{id}` | Update schedule (+ sync to Prefect) | Admin |
| DELETE | `/api/schedules/{id}` | Delete schedule (+ Prefect deployment) | Admin |
| POST | `/api/schedules/{id}/trigger` | Trigger manual harvest | Admin |

Trigger response:

```json
{
  "flow_run_id": "87ff496c-000e-4401-8371-7fa5d6fafdb1",
  "schedule_id": "abc123..."
}
```

---

## Hooks

| Method | Endpoint | Description | Role |
|---|---|---|---|
| GET | `/api/hooks` | List hook configurations | Admin |
| GET | `/api/hooks/{id}` | Get hook | Admin |
| POST | `/api/hooks` | Create hook | Admin |
| PATCH | `/api/hooks/{id}` | Update hook | Admin |
| DELETE | `/api/hooks/{id}` | Delete hook | Admin |

---

## Files

| Method | Endpoint | Description | Role |
|---|---|---|---|
| GET | `/api/files` | List file records | Any authenticated user |
| GET | `/api/files/{id}` | Get file record | Any authenticated user |
| GET | `/api/files?instrument_id={id}` | Filter by instrument | Any authenticated user |

!!! note
    Regular users only see files for instruments they have access to via `UserInstrumentAccess`.

File record fields:

| Field | Description |
|---|---|
| `persistent_id` | Unique ARK identifier (e.g., `ark:/99999/fk4...`) |
| `persistent_id_type` | Identifier type (`ark`) |
| `source_path` | Original path on the instrument |
| `filename` | File name |
| `xxhash` | xxHash checksum |
| `first_discovered_at` | Timestamp of first discovery |
| `metadata_` | Enriched metadata from post-transfer hooks |

---

## Transfers

| Method | Endpoint | Description | Role |
|---|---|---|---|
| GET | `/api/transfers` | List transfer records | Any authenticated user |
| GET | `/api/transfers/{id}` | Get transfer record | Any authenticated user |
| GET | `/api/transfers?file_id={id}` | Filter by file | Any authenticated user |

!!! note
    Regular users only see transfers for files on instruments they have access to.

Transfer record fields:

| Field | Description |
|---|---|
| `status` | `completed`, `skipped`, `failed` |
| `destination_path` | Where the file was written |
| `bytes_transferred` | File size in bytes |
| `dest_checksum` | xxHash of the transferred file |
| `checksum_verified` | Whether source and dest checksums match |
| `started_at` | Transfer start timestamp |
| `completed_at` | Transfer completion timestamp |

---

## Health Check

```
GET /health
```

```json
{"status": "ok"}
```

---

## Interactive Docs

When the API is running, visit `http://localhost:8000/docs` for the auto-generated Swagger UI with interactive request/response examples.
