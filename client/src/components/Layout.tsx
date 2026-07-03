import { Outlet, NavLink, useNavigate } from "react-router";
import { authClient } from "@/lib/auth-client";

export function Layout() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();

  async function handleSignOut() {
    await authClient.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <aside className="w-60 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <span className="text-xl font-extrabold text-black tracking-tight">Helpdesk</span>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          <NavItem to="/dashboard">Dashboard</NavItem>
          <NavItem to="/tickets">Tickets</NavItem>
          {session?.user?.role === "ADMIN" && (
            <NavItem to="/users">Users</NavItem>
          )}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4 justify-end">
          {session?.user.name && (
            <span className="text-sm text-black font-semibold">
              {session.user.name}
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-500 hover:text-black transition-colors"
          >
            Sign out
          </button>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
          isActive
            ? "bg-gray-100 text-black"
            : "text-gray-500 hover:bg-gray-100 hover:text-black"
        }`
      }
    >
      {children}
    </NavLink>
  );
}
