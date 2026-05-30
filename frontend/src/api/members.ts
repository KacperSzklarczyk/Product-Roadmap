import { apiClient } from "@/api/client";
import type { Member, MemberRole } from "@/types";

export async function listMembers(projectId: number): Promise<Member[]> {
  const { data } = await apiClient.get<Member[]>(
    `/projects/${projectId}/members`,
  );
  return data;
}

export async function addMember(
  projectId: number,
  email: string,
  role: MemberRole,
): Promise<Member> {
  const { data } = await apiClient.post<Member>(
    `/projects/${projectId}/members`,
    { email, role },
  );
  return data;
}

export async function updateMemberRole(
  projectId: number,
  memberId: number,
  role: MemberRole,
): Promise<Member> {
  const { data } = await apiClient.patch<Member>(
    `/projects/${projectId}/members/${memberId}`,
    { role },
  );
  return data;
}

export async function removeMember(
  projectId: number,
  memberId: number,
): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/members/${memberId}`);
}
