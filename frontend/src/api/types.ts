// TypeScript interfaces matching backend Pydantic schemas

export type UUID = string

export interface User {
  id: UUID
  email: string
  role: 'admin' | 'user'
  is_active: boolean
  is_verified: boolean
  deleted_at: string | null
}

export interface ServiceAccount {
  id: UUID
  name: string
  domain: string | null
  username: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ServiceAccountCreate {
  name: string
  domain?: string
  username: string
  password: string
}

export interface ServiceAccountUpdate {
  name?: string
  domain?: string
  username?: string
  password?: string
}

export type TransferAdapter = 'rclone' | 'globus' | 'rsync'

export interface Instrument {
  id: UUID
  name: string
  description: string | null
  location: string | null
  pid: string | null
  cifs_host: string
  cifs_share: string
  cifs_base_path: string | null
  service_account_id: UUID | null
  transfer_adapter: TransferAdapter
  transfer_config: Record<string, unknown> | null
  enabled: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface InstrumentCreate {
  name: string
  description?: string
  location?: string
  pid?: string
  cifs_host: string
  cifs_share: string
  cifs_base_path?: string
  service_account_id?: UUID
  transfer_adapter?: TransferAdapter
  transfer_config?: Record<string, unknown>
  enabled?: boolean
}

export interface InstrumentUpdate {
  name?: string
  description?: string
  location?: string
  pid?: string
  cifs_host?: string
  cifs_share?: string
  cifs_base_path?: string
  service_account_id?: UUID
  transfer_adapter?: TransferAdapter
  transfer_config?: Record<string, unknown>
  enabled?: boolean
}

export type StorageType = 'posix' | 's3' | 'cifs' | 'nfs'

export interface S3Config {
  bucket: string
  region: string
  endpoint_url?: string
  access_key_id: string
  secret_access_key: string
}

export interface CIFSConfig {
  host: string
  share: string
  domain?: string
  username: string
  password: string
}

export interface NFSConfig {
  host: string
  export_path: string
  mount_options?: string
}

export type ConnectionConfig = S3Config | CIFSConfig | NFSConfig | Record<string, unknown>

export interface StorageLocation {
  id: UUID
  name: string
  type: StorageType
  connection_config: ConnectionConfig | null
  base_path: string
  enabled: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface StorageLocationCreate {
  name: string
  type: StorageType
  connection_config?: ConnectionConfig
  base_path: string
  enabled?: boolean
}

export interface StorageLocationUpdate {
  name?: string
  type?: StorageType
  connection_config?: ConnectionConfig
  base_path?: string
  enabled?: boolean
}

export interface HarvestSchedule {
  id: UUID
  instrument_id: UUID
  default_storage_location_id: UUID
  cron_expression: string
  prefect_deployment_id: string | null
  enabled: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface HarvestScheduleCreate {
  instrument_id: UUID
  default_storage_location_id: UUID
  cron_expression: string
  enabled?: boolean
}

export interface HarvestScheduleUpdate {
  instrument_id?: UUID
  default_storage_location_id?: UUID
  cron_expression?: string
  enabled?: boolean
}

export type HookTrigger = 'pre_transfer' | 'post_transfer'
export type HookImplementation = 'builtin' | 'python_script' | 'http_webhook'

export interface BuiltinHook {
  name: string
  display_name: string
  description: string
  trigger: 'pre' | 'post' | 'both'
  config_schema: Record<string, unknown>
}

export interface HookConfig {
  id: UUID
  name: string
  description: string | null
  trigger: HookTrigger
  implementation: HookImplementation
  builtin_name: string | null
  script_path: string | null
  webhook_url: string | null
  config: Record<string, unknown> | null
  instrument_id: UUID | null
  priority: number
  enabled: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface HookConfigCreate {
  name: string
  description?: string
  trigger: HookTrigger
  implementation: HookImplementation
  builtin_name?: string
  script_path?: string
  webhook_url?: string
  config?: Record<string, unknown>
  instrument_id?: UUID
  priority?: number
  enabled?: boolean
}

export interface HookConfigUpdate {
  name?: string
  description?: string
  trigger?: HookTrigger
  implementation?: HookImplementation
  builtin_name?: string
  script_path?: string
  webhook_url?: string
  config?: Record<string, unknown>
  instrument_id?: UUID
  priority?: number
  enabled?: boolean
}

export type PersistentIdType = 'ark' | 'doi' | 'handle'

export interface FileRecord {
  id: UUID
  persistent_id: string
  persistent_id_type: PersistentIdType
  instrument_id: UUID
  source_path: string
  filename: string
  size_bytes: number | null
  source_mtime: string | null
  xxhash: string | null
  sha256: string | null
  first_discovered_at: string
  metadata_: Record<string, unknown> | null
  owner_id: UUID | null
}

export type TransferStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'

export interface FileTransfer {
  id: UUID
  file_id: UUID
  storage_location_id: UUID
  destination_path: string | null
  transfer_adapter: TransferAdapter
  status: TransferStatus
  bytes_transferred: number | null
  source_checksum: string | null
  dest_checksum: string | null
  checksum_verified: boolean | null
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  prefect_flow_run_id: string | null
}

export interface Project {
  id: UUID
  name: string
  description: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ProjectCreate {
  name: string
  description?: string
}

export interface ProjectUpdate {
  name?: string
  description?: string
}

export interface ProjectMember {
  id: UUID
  project_id: UUID
  member_type: 'user' | 'group'
  member_id: UUID
}

export interface ProjectMemberAdd {
  member_type: 'user' | 'group'
  member_id: UUID
}

export interface Group {
  id: UUID
  name: string
  description: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface GroupCreate {
  name: string
  description?: string
}

export interface GroupUpdate {
  name?: string
  description?: string
}

export interface GroupMember {
  group_id: UUID
  user_id: UUID
}

export interface GroupMemberAdd {
  user_id: UUID
}

// Auth types
export interface LoginCredentials {
  username: string // fastapi-users uses "username" for email in OAuth2 form
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface UserCreate {
  email: string
  password: string
  role?: 'admin' | 'user'
}

export interface UserUpdate {
  email?: string
  password?: string
  role?: 'admin' | 'user'
  is_active?: boolean
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
}

// Health check
export interface HealthResponse {
  status: string
}

// Instrument requests
export type InstrumentRequestStatus = 'pending' | 'approved' | 'rejected'

export interface InstrumentRequestRecord {
  id: UUID
  requester_id: UUID
  requester_email: string | null
  name: string
  location: string
  harvest_frequency: string
  description: string | null
  justification: string
  status: InstrumentRequestStatus
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export interface InstrumentRequestCreate {
  name: string
  location: string
  harvest_frequency: string
  description?: string
  justification: string
}

export interface InstrumentRequestUpdate {
  status: InstrumentRequestStatus
  admin_notes?: string
}

// Notifications
export interface NotificationRecord {
  id: UUID
  recipient_id: UUID
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  dismissed_at: string | null
  created_at: string
}

export interface UnreadCount {
  count: number
}

// Audit log
export type AuditAction = 'create' | 'update' | 'delete' | 'restore'

export interface AuditLogEntry {
  id: UUID
  entity_type: string
  entity_id: UUID
  action: AuditAction
  actor_id: UUID | null
  actor_email: string
  changes: Record<string, { before: unknown; after: unknown }> | null
  created_at: string
}
