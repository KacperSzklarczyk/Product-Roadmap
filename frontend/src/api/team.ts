import { apiClient } from "@/api/client";
import type { TeamComposition, TeamCompositionInput } from "@/types";

export async function getTeam(projectId: number): Promise<TeamComposition> {
  const { data } = await apiClient.get<TeamComposition>(`/projects/${projectId}/team`);
  return data;
}

export async function updateTeam(
  projectId: number,
  payload: TeamCompositionInput,
): Promise<TeamComposition> {
  const { data } = await apiClient.put<TeamComposition>(
    `/projects/${projectId}/team`,
    payload,
  );
  return data;
}
