import { apiClient } from "@/api/client";
import type {
  Feature,
  FeatureDraft,
  FeatureInput,
  FeatureReorderItem,
} from "@/types";

export async function listFeatures(projectId: number): Promise<Feature[]> {
  const { data } = await apiClient.get<Feature[]>(
    `/projects/${projectId}/features`,
  );
  return data;
}

export async function createFeature(
  projectId: number,
  payload: FeatureInput,
): Promise<Feature> {
  const { data } = await apiClient.post<Feature>(
    `/projects/${projectId}/features`,
    payload,
  );
  return data;
}

export async function updateFeature(
  projectId: number,
  featureId: number,
  payload: Partial<FeatureInput>,
): Promise<Feature> {
  const { data } = await apiClient.patch<Feature>(
    `/projects/${projectId}/features/${featureId}`,
    payload,
  );
  return data;
}

export async function deleteFeature(
  projectId: number,
  featureId: number,
): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/features/${featureId}`);
}

export async function reorderFeatures(
  projectId: number,
  items: FeatureReorderItem[],
): Promise<Feature[]> {
  const { data } = await apiClient.post<Feature[]>(
    `/projects/${projectId}/features/reorder`,
    { items },
  );
  return data;
}

export async function aiDraftFeatures(
  projectId: number,
  text: string,
): Promise<FeatureDraft[]> {
  const { data } = await apiClient.post<{ drafts: FeatureDraft[] }>(
    `/projects/${projectId}/features/ai-draft`,
    { text },
  );
  return data.drafts;
}
