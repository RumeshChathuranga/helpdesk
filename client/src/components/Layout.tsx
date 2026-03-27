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
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-60 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <span className="text-xl font-bold text-brand-700">Helpdesk</span>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          <NavItem to="/dashboard">Dashboard</NavItem>
          <NavItem to="/tickets">Tickets</NavItem>
          <NavItem to="/users">Users</NavItem>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4 justify-end">
          {session?.user.name && (
            <span className="text-sm text-gray-700 font-medium">
              {session.user.name}
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
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
        `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? "bg-brand-50 text-brand-700"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`
      }
    >
      {children}
    </NavLink>
  );
}
