// Book-authoring types — mirror the backend StructuredTOC shape
// (pipeline/toc_structurer.py) and the POST /structure request/response.

export interface TopicNode {
  title: string;
  subtopics: string[];
  prerequisites: string[];
}

export interface SubjectNode {
  subject_label: string;
  units: TopicNode[];
}

export interface StructuredTOC {
  subjects: SubjectNode[];
}

export interface StructureRequest {
  request_id: string;
  raw_toc: string;
  grade?: number;
  api_key: string;
  model?: string;
}

export interface StructureResponse {
  job_id: string;
  status: "queued";
}

// The /structure job result polled from the shared /jobs/{id} endpoint.
export type StructureJobStatus = "queued" | "running" | "done" | "failed";

export interface StructureJobResponse {
  job_id: string;
  status: StructureJobStatus;
  result?: StructuredTOC;
  error?: string;
}

// A book persisted on the device (local-first, per ADR-003 D1).
export interface Book {
  id: string;
  title: string;
  toc: StructuredTOC;
  createdAt: string;
  updatedAt: string;
}

// Lightweight index entry for the books list (no full TOC).
export interface BookMeta {
  id: string;
  title: string;
  subjectCount: number;
  unitCount: number;
  updatedAt: string;
}
