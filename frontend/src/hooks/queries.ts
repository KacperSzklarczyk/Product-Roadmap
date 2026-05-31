import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { getErrorMessage } from "@/api/client";
import * as aiApi from "@/api/ai";
import * as commentsApi from "@/api/comments";
import * as featuresApi from "@/api/features";
import * as membersApi from "@/api/members";
import * as milestonesApi from "@/api/milestones";
import * as projectsApi from "@/api/projects";
import * as teamApi from "@/api/team";
import type {
  EntityType,
  FeatureInput,
  FeatureReorderItem,
  Finding,
  FixApplyItem,
  MemberRole,
  MilestoneInput,
  ProjectInput,
  TeamCompositionInput,
} from "@/types";

// Query keys --------------------------------------------------------------
export const qk = {
  projects: ["projects"] as const,
  project: (id: number) => ["projects", id] as const,
  features: (pid: number) => ["projects", pid, "features"] as const,
  milestones: (pid: number) => ["projects", pid, "milestones"] as const,
  members: (pid: number) => ["projects", pid, "members"] as const,
  team: (pid: number) => ["projects", pid, "team"] as const,
  comments: (pid: number, type: EntityType, id: number) =>
    ["projects", pid, "comments", type, id] as const,
};

function useToastError() {
  return (error: unknown) => toast.error(getErrorMessage(error));
}

// Projects ----------------------------------------------------------------
export function useProjects() {
  return useQuery({ queryKey: qk.projects, queryFn: projectsApi.listProjects });
}

export function useProject(id: number) {
  return useQuery({
    queryKey: qk.project(id),
    queryFn: () => projectsApi.getProject(id),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: (payload: ProjectInput) => projectsApi.createProject(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects });
      toast.success("Project created");
    },
    onError,
  });
}

export function useUpdateProject(id: number) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: (payload: Partial<ProjectInput>) =>
      projectsApi.updateProject(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.project(id) });
      qc.invalidateQueries({ queryKey: qk.projects });
      toast.success("Project updated");
    },
    onError,
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: (id: number) => projectsApi.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects });
      toast.success("Project deleted");
    },
    onError,
  });
}

// Features ----------------------------------------------------------------
export function useFeatures(projectId: number) {
  return useQuery({
    queryKey: qk.features(projectId),
    queryFn: () => featuresApi.listFeatures(projectId),
  });
}

export function useCreateFeature(projectId: number) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: (payload: FeatureInput) =>
      featuresApi.createFeature(projectId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.features(projectId) });
      toast.success("Feature created");
    },
    onError,
  });
}

export function useUpdateFeature(projectId: number) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: ({
      featureId,
      payload,
    }: {
      featureId: number;
      payload: Partial<FeatureInput>;
    }) => featuresApi.updateFeature(projectId, featureId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.features(projectId) });
      toast.success("Feature updated");
    },
    onError,
  });
}

export function useDeleteFeature(projectId: number) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: (featureId: number) =>
      featuresApi.deleteFeature(projectId, featureId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.features(projectId) });
      toast.success("Feature deleted");
    },
    onError,
  });
}

export function useReorderFeatures(projectId: number) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: (items: FeatureReorderItem[]) =>
      featuresApi.reorderFeatures(projectId, items),
    onSuccess: (features) => {
      qc.setQueryData(qk.features(projectId), features);
      // Also invalidate so every other view (roadmap Gantt, AI panels) refetches
      // the authoritative server state — keeps board ↔ roadmap in sync.
      qc.invalidateQueries({ queryKey: qk.features(projectId) });
    },
    onError: (error) => {
      onError(error);
      qc.invalidateQueries({ queryKey: qk.features(projectId) });
    },
  });
}

export function useAiDraft(projectId: number) {
  const onError = useToastError();
  return useMutation({
    mutationFn: (text: string) => featuresApi.aiDraftFeatures(projectId, text),
    onError,
  });
}

export function useReviewRoadmap(projectId: number) {
  const onError = useToastError();
  return useMutation({
    mutationFn: () => aiApi.reviewRoadmap(projectId),
    onError,
  });
}

export function useAskRoadmap(projectId: number) {
  const onError = useToastError();
  return useMutation({
    mutationFn: (question: string) => aiApi.askRoadmap(projectId, question),
    onError,
  });
}

export function useFixPreview(projectId: number) {
  const onError = useToastError();
  return useMutation({
    // Preview only — proposes changes without touching the database.
    mutationFn: (finding: Finding) => aiApi.previewFix(projectId, finding),
    onError,
  });
}

export function useFixApply(projectId: number) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    // Applies an accepted subset (or the inverse, for revert). The AI may have
    // moved features between buckets / changed milestones — refresh so the board,
    // Gantt, and AI panels all reflect the applied edits.
    mutationFn: (changes: FixApplyItem[]) => aiApi.applyFix(projectId, changes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.features(projectId) });
      qc.invalidateQueries({ queryKey: qk.milestones(projectId) });
    },
    onError,
  });
}

// Team composition --------------------------------------------------------
export function useTeam(projectId: number) {
  return useQuery({
    queryKey: qk.team(projectId),
    queryFn: () => teamApi.getTeam(projectId),
  });
}

export function useUpdateTeam(projectId: number) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: (payload: TeamCompositionInput) =>
      teamApi.updateTeam(projectId, payload),
    onSuccess: (team) => {
      qc.setQueryData(qk.team(projectId), team);
      toast.success("Team & sprints saved");
    },
    onError,
  });
}

// Milestones --------------------------------------------------------------
export function useMilestones(projectId: number) {
  return useQuery({
    queryKey: qk.milestones(projectId),
    queryFn: () => milestonesApi.listMilestones(projectId),
  });
}

export function useCreateMilestone(projectId: number) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: (payload: MilestoneInput) =>
      milestonesApi.createMilestone(projectId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.milestones(projectId) });
      toast.success("Milestone created");
    },
    onError,
  });
}

export function useUpdateMilestone(projectId: number) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: ({
      milestoneId,
      payload,
    }: {
      milestoneId: number;
      payload: Partial<MilestoneInput>;
    }) => milestonesApi.updateMilestone(projectId, milestoneId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.milestones(projectId) });
      toast.success("Milestone updated");
    },
    onError,
  });
}

export function useDeleteMilestone(projectId: number) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: (milestoneId: number) =>
      milestonesApi.deleteMilestone(projectId, milestoneId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.milestones(projectId) });
      toast.success("Milestone deleted");
    },
    onError,
  });
}

// Members -----------------------------------------------------------------
export function useMembers(projectId: number) {
  return useQuery({
    queryKey: qk.members(projectId),
    queryFn: () => membersApi.listMembers(projectId),
  });
}

export function useAddMember(projectId: number) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: MemberRole }) =>
      membersApi.addMember(projectId, email, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members(projectId) });
      toast.success("Member added");
    },
    onError,
  });
}

export function useUpdateMemberRole(projectId: number) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: number; role: MemberRole }) =>
      membersApi.updateMemberRole(projectId, memberId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members(projectId) });
      toast.success("Role updated");
    },
    onError,
  });
}

export function useRemoveMember(projectId: number) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: (memberId: number) =>
      membersApi.removeMember(projectId, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members(projectId) });
      toast.success("Member removed");
    },
    onError,
  });
}

// Comments ----------------------------------------------------------------
export function useComments(
  projectId: number,
  entityType: EntityType,
  entityId: number,
) {
  return useQuery({
    queryKey: qk.comments(projectId, entityType, entityId),
    queryFn: () => commentsApi.listComments(projectId, entityType, entityId),
    enabled: entityId > 0,
  });
}

export function useCreateComment(
  projectId: number,
  entityType: EntityType,
  entityId: number,
) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: (body: string) =>
      commentsApi.createComment(projectId, entityType, entityId, body),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: qk.comments(projectId, entityType, entityId),
      });
    },
    onError,
  });
}

export function useDeleteComment(
  projectId: number,
  entityType: EntityType,
  entityId: number,
) {
  const qc = useQueryClient();
  const onError = useToastError();
  return useMutation({
    mutationFn: (commentId: number) =>
      commentsApi.deleteComment(projectId, commentId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: qk.comments(projectId, entityType, entityId),
      });
    },
    onError,
  });
}
