// ── Database entity types ─────────────────────────────────────────────────────

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer'
export type PlanName = 'free' | 'starter' | 'professional' | 'business' | 'enterprise'
export type FileCategory = 'document' | 'image' | 'video' | 'audio' | 'archive'
export type FileType = 'pdf' | 'docx' | 'xlsx' | 'txt' | 'png' | 'jpg' | 'mp4' | 'mp3'
export type DocumentStatus = 'processing' | 'ready' | 'error'
export type AppSessionStatus = 'pending' | 'processing' | 'completed' | 'error'
export type AgentRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type TriggerType = 'user' | 'automation' | 'api' | 'webhook'

export interface User {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  logo_url: string | null
  plan_id: string | null
  industry: string
  settings: Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role_id: string
  invited_by: string | null
  joined_at: string | null
  created_at: string
  // joined relations
  user?: Pick<User, 'id' | 'email' | 'name' | 'avatar_url'>
  role?: Role
}

export interface Role {
  id: string
  workspace_id: string | null
  name: UserRole
  permissions: string[]
  is_system: boolean
  created_at: string
}

export interface Plan {
  id: string
  name: PlanName
  price_monthly: number
  price_yearly: number
  max_users: number
  max_documents: number
  max_ai_calls_month: number
  max_storage_gb: number
  features: Record<string, boolean>
  is_active: boolean
}

export interface Document {
  id: string
  workspace_id: string
  uploaded_by: string
  file_name: string
  file_url: string
  file_type: FileType
  file_size_bytes: number | null
  status: DocumentStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface App {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  category: string | null
  version: string
  input_schema: Record<string, unknown>
  output_schema: Record<string, unknown>
  is_active: boolean
  is_builtin: boolean
  source_type: 'official' | 'community' | 'third_party'
  created_at: string
}

export interface AppSession {
  id: string
  workspace_id: string
  app_id: string
  user_id: string
  agent_run_id: string | null
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  status: AppSessionStatus
  model_id: string | null
  tokens_input: number
  tokens_output: number
  cost_usd: number
  duration_ms: number | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ── API response types ────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: ApiError | null
  meta: {
    request_id: string
    timestamp: string
  }
}

export interface ApiError {
  code: string
  message: string
  field?: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
  }
}

// ── App-specific input/output schemas ────────────────────────────────────────

export interface EmailAssistantInput {
  original_email: string
  tone: 'professional' | 'friendly' | 'short' | 'detailed'
}

export interface EmailAssistantOutput {
  reply: string
  tone_used: string
}

export interface TicketAssistantInput {
  customer_description: string
}

export interface TicketAssistantOutput {
  issue_summary: string
  model: string
  serial_number: string
  problem_category: string
  suggested_next_step: string
  required_photos: string[]
  technician_notes: string
}

export interface ReportGeneratorInput {
  repair_notes: string
  language?: 'zh' | 'en'
}

export interface ReportGeneratorOutput {
  problem_found: string
  diagnosis: string
  repair_performed: string
  parts_used: string
  final_status: string
  full_report: string
}

export interface KnowledgeBaseInput {
  question: string
  top_k?: number
}

export interface KnowledgeBaseOutput {
  answer: string
  sources: Array<{
    document_id: string
    file_name: string
    page: number | null
    excerpt: string
  }>
}
