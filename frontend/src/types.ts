// Shared domain types mirroring the backend Pydantic schemas.

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface RegisterPayload extends Credentials {
  full_name?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// ---------------------------------------------------------------------------
// Domain enums (mirror backend CharEnumField values)
// ---------------------------------------------------------------------------
export type FeatureStatus = "backlog" | "in_progress" | "done";
export type RoadmapBucket = "now" | "next" | "later";
export type MilestoneStatus = "planned" | "in_progress" | "completed";
export type MemberRole = "owner" | "editor" | "viewer";
export type EntityType = "project" | "feature" | "milestone" | "member" | "comment";

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------
export interface Project {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  created_at: string;
  updated_at: string;
}

export interface Feature {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  status: FeatureStatus;
  roadmap_bucket: RoadmapBucket;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  position: number;
  rice_score: number;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  status: MilestoneStatus;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: number;
  project_id: number;
  role: MemberRole;
  user: User;
  created_at: string;
}

export interface Comment {
  id: number;
  project_id: number;
  entity_type: EntityType;
  entity_id: number;
  body: string;
  author: User;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------
export interface ProjectInput {
  name: string;
  description?: string | null;
}

export interface FeatureInput {
  title: string;
  description?: string | null;
  status?: FeatureStatus;
  roadmap_bucket?: RoadmapBucket;
  reach?: number;
  impact?: number;
  confidence?: number;
  effort?: number;
  position?: number;
}

export interface FeatureReorderItem {
  id: number;
  position: number;
  status?: FeatureStatus;
  roadmap_bucket?: RoadmapBucket;
}

export interface MilestoneInput {
  title: string;
  description?: string | null;
  due_date?: string | null;
  status?: MilestoneStatus;
}

export type FindingSeverity = "high" | "medium" | "low";

export interface Finding {
  severity: FindingSeverity;
  title: string;
  rationale: string;
  feature_ids: number[];
}

export interface AiFixResult {
  summary: string;
  changes: string[];
  updated_feature_ids: number[];
  updated_milestone_ids: number[];
}

export interface FeatureDraft {
  title: string;
  description: string | null;
  status: FeatureStatus;
  roadmap_bucket: RoadmapBucket;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
}
