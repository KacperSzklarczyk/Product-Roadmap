import { apiClient } from "@/api/client";
import type { AiFixResult, AskResult, Finding } from "@/types";

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

export async function fixFinding(
  projectId: number,
  finding: Finding,
): Promise<AiFixResult> {
  const { data } = await apiClient.post<AiFixResult>(
    `/projects/${projectId}/ai/fix`,
    finding,
  );
  return data;
}
