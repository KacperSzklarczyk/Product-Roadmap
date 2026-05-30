import { apiClient } from "@/api/client";

/** Download the project's features as a CSV file via a browser blob download. */
export async function downloadFeaturesCsv(projectId: number): Promise<void> {
  const response = await apiClient.get(
    `/projects/${projectId}/export/features.csv`,
    { responseType: "blob" },
  );
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `project_${projectId}_features.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
