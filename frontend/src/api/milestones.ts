import { apiClient } from "@/api/client";
import type { Milestone, MilestoneInput } from "@/types";

export async function listMilestones(projectId: number): Promise<Milestone[]> {
  const { data } = await apiClient.get<Milestone[]>(
    `/projects/${projectId}/milestones`,
  );
  return data;
}

export async function createMilestone(
  projectId: number,
  payload: MilestoneInput,
): Promise<Milestone> {
  const { data } = await apiClient.post<Milestone>(
    `/projects/${projectId}/milestones`,
    payload,
  );
  return data;
}

export async function updateMilestone(
  projectId: number,
  milestoneId: number,
  payload: Partial<MilestoneInput>,
): Promise<Milestone> {
  const { data } = await apiClient.patch<Milestone>(
    `/projects/${projectId}/milestones/${milestoneId}`,
    payload,
  );
  return data;
}

export async function deleteMilestone(
  projectId: number,
  milestoneId: number,
): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/milestones/${milestoneId}`);
}
