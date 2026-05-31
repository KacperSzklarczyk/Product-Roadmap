import { apiClient } from "@/api/client";
import type {
  AiFixApplyResult,
  AiFixPreview,
  AskResult,
  ClassifyResult,
  Finding,
  FixApplyItem,
} from "@/types";

export async function reviewRoadmap(projectId: number): Promise<Finding[]> {
  const { data } = await apiClient.post<{ findings: Finding[] }>(
    `/projects/${projectId}/ai/review`,
  );
  return data.findings;
}

export async function askRoadmap(projectId: number, question: string): Promise<AskResult> {
  const { data } = await apiClient.post<AskResult>(
    `/projects/${projectId}/ai/ask`,
    { question },
  );
  return data;
}

export async function previewFix(
  projectId: number,
  finding: Finding,
): Promise<AiFixPreview> {
  const { data } = await apiClient.post<AiFixPreview>(
    `/projects/${projectId}/ai/fix`,
    finding,
  );
  return data;
}

export async function applyFix(
  projectId: number,
  changes: FixApplyItem[],
): Promise<AiFixApplyResult> {
  const { data } = await apiClient.post<AiFixApplyResult>(
    `/projects/${projectId}/ai/fix/apply`,
    { changes },
  );
  return data;
}

export async function classifySpecializations(
  projectId: number,
): Promise<ClassifyResult> {
  const { data } = await apiClient.post<ClassifyResult>(
    `/projects/${projectId}/ai/classify-specializations`,
  );
  return data;
}
