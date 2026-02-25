# Simulated Laboratory

StreamWeave includes a simulated laboratory (simlab) for integration testing. It spins up three Samba/CIFS shares that mimic real scientific instruments.

## Instruments

| Container | Hostname | Share | Sample Data |
|---|---|---|---|
| `microscope-01` | `microscope-01` | `microscope` | CSV scan data organized by user/experiment |
| `spectrometer-01` | `spectrometer-01` | `spectrometer` | UV-Vis spectral data |
| `xray-diffraction-01` | `xray-diffraction-01` | `xrd` | X-ray diffraction patterns |

All shares use the credentials `labuser` / `labpass`.

## Start Simlab

```bash
cd simlab
docker compose -f docker-compose.simlab.yml up -d
```

Verify the shares are running:

```bash
docker compose -f docker-compose.simlab.yml ps
```

## Seed the Database

The seed script creates matching instrument configurations, storage locations, harvest schedules, and hooks:

```bash
cd simlab
DATABASE_URL=postgresql+asyncpg://streamweave:streamweave@localhost:5432/streamweave \
  python seed.py
```

This creates:

- **1 service account** (`simlab-service`) for all instruments
- **2 storage locations** — Archive Storage (`/storage/archive`) and Restricted Storage (`/storage/restricted`)
- **3 instruments** with CIFS connection details
- **3 harvest schedules** — every 15 minutes
- **2 hooks on the microscope:**
    - Pre-transfer file filter (excludes `*.tmp`, `*.lock`, `~$*`)
    - Post-transfer metadata enrichment (extracts `username` and `experiment` from paths)

## Sample Data Layout

The microscope sample data is organized to demonstrate the hook system:

```
microscope-01/sample_data/
├── jtaillon/
│   ├── experiment_001/
│   │   └── scan_01.csv
│   └── experiment_002/
│       └── scan_01.csv
└── mchen/
    └── experiment_003/
        └── scan_01.csv
```

After harvesting with the metadata enrichment hook, files will have metadata like:

```json
{
  "username": "jtaillon",
  "experiment": "experiment_001"
}
```

## Networking

Simlab containers run on a shared Docker network (`streamweave-simlab`) so the Prefect worker can resolve their hostnames for SMB transfers.

## Stop Simlab

```bash
cd simlab
docker compose -f docker-compose.simlab.yml down -v
```
