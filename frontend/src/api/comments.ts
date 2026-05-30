import { apiClient } from "@/api/client";
import type { Comment, EntityType } from "@/types";

export async function listComments(
  projectId: number,
  entityType: EntityType,
  entityId: number,
): Promise<Comment[]> {
  const { data } = await apiClient.get<Comment[]>(
    `/projects/${projectId}/comments`,
    { params: { entity_type: entityType, entity_id: entityId } },
  );
  return data;
}

export async function createComment(
  projectId: number,
  entityType: EntityType,
  entityId: number,
  body: string,
): Promise<Comment> {
  const { data } = await apiClient.post<Comment>(
    `/projects/${projectId}/comments`,
    { entity_type: entityType, entity_id: entityId, body },
  );
  return data;
}

export async function deleteComment(
  projectId: number,
  commentId: number,
): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/comments/${commentId}`);
}
