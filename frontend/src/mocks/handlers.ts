import { http, HttpResponse } from 'msw'
import type {
  HookConfig,
  Instrument,
  FileRecord,
  FileTransfer,
  StorageLocation,
  HarvestSchedule,
  ServiceAccount,
  User,
} from '@/api/types'

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

export const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-uuid-1',
  email: 'user@test.com',
  role: 'user',
  is_active: true,
  is_verified: true,
  ...overrides,
})

export const makeAdminUser = (overrides: Partial<User> = {}): User =>
  makeUser({ id: 'admin-uuid-1', email: 'admin@test.com', role: 'admin', ...overrides })

export const makeServiceAccount = (overrides: Partial<ServiceAccount> = {}): ServiceAccount => ({
  id: 'sa-uuid-1',
  name: 'Lab SA',
  domain: null,
  username: 'labuser',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

export const makeInstrument = (overrides: Partial<Instrument> = {}): Instrument => ({
  id: 'inst-uuid-1',
  name: 'Bruker NMR',
  description: null,
  location: 'Lab 3B',
  pid: null,
  cifs_host: '192.168.1.100',
  cifs_share: 'data',
  cifs_base_path: null,
  service_account_id: null,
  transfer_adapter: 'rclone',
  transfer_config: null,
  enabled: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

export const makeStorageLocation = (overrides: Partial<StorageLocation> = {}): StorageLocation => ({
  id: 'storage-uuid-1',
  name: 'Archive',
  type: 'posix',
  connection_config: null,
  base_path: '/storage/archive',
  enabled: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

export const makeSchedule = (overrides: Partial<HarvestSchedule> = {}): HarvestSchedule => ({
  id: 'sched-uuid-1',
  instrument_id: 'inst-uuid-1',
  default_storage_location_id: 'storage-uuid-1',
  cron_expression: '0 * * * *',
  prefect_deployment_id: null,
  enabled: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

export const makeHookConfig = (overrides: Partial<HookConfig> = {}): HookConfig => ({
  id: 'hook-uuid-1',
  name: 'Test Hook',
  description: null,
  trigger: 'post_transfer',
  implementation: 'builtin',
  builtin_name: 'access_assignment',
  script_path: null,
  webhook_url: null,
  instrument_id: null,
  priority: 0,
  enabled: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

export const makeFileRecord = (overrides: Partial<FileRecord> = {}): FileRecord => ({
  id: 'file-uuid-1',
  persistent_id: 'ark:/99999/fk4test001',
  persistent_id_type: 'ark',
  instrument_id: 'inst-uuid-1',
  source_path: '/data/nmr/2026/sample1.raw',
  filename: 'sample1.raw',
  size_bytes: 1048576,
  source_mtime: '2026-01-15T10:00:00Z',
  xxhash: null,
  sha256: null,
  first_discovered_at: '2026-01-15T11:00:00Z',
  metadata_: null,
  owner_id: 'user-uuid-1',
  ...overrides,
})

export const makeTransfer = (overrides: Partial<FileTransfer> = {}): FileTransfer => ({
  id: 'xfer-uuid-1',
  file_id: 'file-uuid-1',
  storage_location_id: 'storage-uuid-1',
  destination_path: '/archive/nmr/sample1.raw',
  transfer_adapter: 'rclone',
  status: 'completed',
  bytes_transferred: 1048576,
  source_checksum: 'abc123',
  dest_checksum: 'abc123',
  checksum_verified: true,
  started_at: '2026-01-15T11:01:00Z',
  completed_at: '2026-01-15T11:02:00Z',
  error_message: null,
  prefect_flow_run_id: null,
  ...overrides,
})

// ---------------------------------------------------------------------------
// Base URL — must match apiClient.defaults.baseURL set in test/setup.ts
// MSW v2 Node mode requires ABSOLUTE URLs in handlers (relative paths only
// work in browser environments).
// ---------------------------------------------------------------------------

export const TEST_BASE = 'http://localhost'

// ---------------------------------------------------------------------------
// Default handlers — happy-path responses; override per-test with server.use()
// ---------------------------------------------------------------------------

export const handlers = [
  // Auth
  http.post(`${TEST_BASE}/auth/jwt/login`, () =>
    HttpResponse.json({ access_token: 'test-token', token_type: 'bearer' })
  ),
  http.post(`${TEST_BASE}/auth/jwt/logout`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${TEST_BASE}/users/me`, () => HttpResponse.json(makeUser())),

  // Admin users list
  http.get(`${TEST_BASE}/api/admin/users`, () => HttpResponse.json([makeUser(), makeAdminUser()])),

  // Instruments
  http.get(`${TEST_BASE}/api/instruments`, () => HttpResponse.json([makeInstrument()])),
  http.post(`${TEST_BASE}/api/instruments`, () =>
    HttpResponse.json(makeInstrument(), { status: 201 })
  ),
  http.patch(`${TEST_BASE}/api/instruments/:id`, ({ params }) =>
    HttpResponse.json(makeInstrument({ id: params.id as string }))
  ),
  http.delete(`${TEST_BASE}/api/instruments/:id`, () => new HttpResponse(null, { status: 204 })),

  // Service Accounts
  http.get(`${TEST_BASE}/api/service-accounts`, () => HttpResponse.json([makeServiceAccount()])),
  http.post(`${TEST_BASE}/api/service-accounts`, () =>
    HttpResponse.json(makeServiceAccount(), { status: 201 })
  ),
  http.delete(
    `${TEST_BASE}/api/service-accounts/:id`,
    () => new HttpResponse(null, { status: 204 })
  ),

  // Storage
  http.get(`${TEST_BASE}/api/storage-locations`, () => HttpResponse.json([makeStorageLocation()])),
  http.post(`${TEST_BASE}/api/storage-locations`, () =>
    HttpResponse.json(makeStorageLocation(), { status: 201 })
  ),
  http.patch(`${TEST_BASE}/api/storage-locations/:id`, ({ params }) =>
    HttpResponse.json(makeStorageLocation({ id: params.id as string }))
  ),
  http.delete(
    `${TEST_BASE}/api/storage-locations/:id`,
    () => new HttpResponse(null, { status: 204 })
  ),

  // Schedules
  http.get(`${TEST_BASE}/api/schedules`, () => HttpResponse.json([makeSchedule()])),
  http.post(`${TEST_BASE}/api/schedules`, () => HttpResponse.json(makeSchedule(), { status: 201 })),
  http.patch(`${TEST_BASE}/api/schedules/:id`, ({ params }) =>
    HttpResponse.json(makeSchedule({ id: params.id as string }))
  ),
  http.delete(`${TEST_BASE}/api/schedules/:id`, () => new HttpResponse(null, { status: 204 })),

  // Hooks
  http.get(`${TEST_BASE}/api/hooks`, () => HttpResponse.json([makeHookConfig()])),
  http.post(`${TEST_BASE}/api/hooks`, () => HttpResponse.json(makeHookConfig(), { status: 201 })),
  http.patch(`${TEST_BASE}/api/hooks/:id`, ({ params }) =>
    HttpResponse.json(makeHookConfig({ id: params.id as string }))
  ),
  http.delete(`${TEST_BASE}/api/hooks/:id`, () => new HttpResponse(null, { status: 204 })),

  // User CRUD (register + fastapi-users /users/:id)
  http.post(`${TEST_BASE}/auth/register`, () => HttpResponse.json(makeUser(), { status: 201 })),
  http.patch(`${TEST_BASE}/users/:id`, ({ params }) =>
    HttpResponse.json(makeUser({ id: params.id as string }))
  ),
  http.delete(`${TEST_BASE}/users/:id`, () => new HttpResponse(null, { status: 204 })),

  // Files
  http.get(`${TEST_BASE}/api/files`, () => HttpResponse.json([makeFileRecord()])),

  // Transfers
  http.get(`${TEST_BASE}/api/transfers`, () => HttpResponse.json([makeTransfer()])),

  // Health
  http.get(`${TEST_BASE}/health`, () => HttpResponse.json({ status: 'ok' })),
]
