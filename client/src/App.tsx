import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import * as Sentry from "@sentry/react";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TicketsPage } from "./pages/TicketsPage";
import { TicketDetailPage } from "./pages/TicketDetailPage";
import { UsersPage } from "./pages/UsersPage";
import { KnowledgePage } from "./pages/KnowledgePage";

const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes);

export function App() {
  return (
    <BrowserRouter>
      <SentryRoutes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route element={<AdminRoute />}>
              <Route path="/users" element={<UsersPage />} />
              <Route path="/knowledge" element={<KnowledgePage />} />
            </Route>
          </Route>
        </Route>
      </SentryRoutes>
    </BrowserRouter>
  );
}
