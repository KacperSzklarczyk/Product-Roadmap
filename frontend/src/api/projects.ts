import { apiClient } from "@/api/client";
import type { Project, ProjectInput } from "@/types";

export async function listProjects(): Promise<Project[]> {
  const { data } = await apiClient.get<Project[]>("/projects");
  return data;
}

export async function getProject(id: number): Promise<Project> {
  const { data } = await apiClient.get<Project>(`/projects/${id}`);
  return data;
}

export async function createProject(payload: ProjectInput): Promise<Project> {
  const { data } = await apiClient.post<Project>("/projects", payload);
  return data;
}

export async function updateProject(
  id: number,
  payload: Partial<ProjectInput>,
): Promise<Project> {
  const { data } = await apiClient.patch<Project>(`/projects/${id}`, payload);
  return data;
}

export async function deleteProject(id: number): Promise<void> {
  await apiClient.delete(`/projects/${id}`);
}
