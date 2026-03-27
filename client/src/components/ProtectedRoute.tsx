import { Navigate, Outlet } from "react-router";
import { authClient } from "@/lib/auth-client";

export function ProtectedRoute() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
