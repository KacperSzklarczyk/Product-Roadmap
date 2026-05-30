import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ProjectLayout } from "@/layouts/ProjectLayout";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { BoardPage } from "@/pages/project/BoardPage";
import { RoadmapPage } from "@/pages/project/RoadmapPage";
import { TimelinePage } from "@/pages/project/TimelinePage";
import { SettingsPage } from "@/pages/project/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects/:projectId" element={<ProjectLayout />}>
          <Route index element={<Navigate to="board" replace />} />
          <Route path="board" element={<BoardPage />} />
          <Route path="roadmap" element={<RoadmapPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
