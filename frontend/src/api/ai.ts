import { apiClient } from "@/api/client";
import type { Finding } from "@/types";

export async function reviewRoadmap(projectId: number): Promise<Finding[]> {
  const { data } = await apiClient.post<{ findings: Finding[] }>(
    `/projects/${projectId}/ai/review`,
  );
  return data.findings;
}

export async function askRoadmap(projectId: number, question: string): Promise<string> {
  const { data } = await apiClient.post<{ answer: string }>(
    `/projects/${projectId}/ai/ask`,
    { question },
  );
  return data.answer;
}
