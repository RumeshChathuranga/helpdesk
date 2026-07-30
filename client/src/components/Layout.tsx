import { Outlet, NavLink, useNavigate } from "react-router";
import { authClient } from "@/lib/auth-client";
import { LayoutDashboard, Ticket, Users, LogOut, ShieldAlert, Book } from "lucide-react";

export function Layout() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();

  async function handleSignOut() {
    await authClient.signOut();
    navigate("/login", { replace: true });
  }

  const userInitial = session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "U";

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-card border-r border-border flex flex-col z-20">
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-6 border-b border-border gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Ticket className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-wider uppercase font-mono text-foreground">
              Helpdesk
            </span>
            <span className="text-[10px] text-primary font-mono tracking-widest font-semibold uppercase -mt-0.5">
              AI Command
            </span>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          <NavItem to="/dashboard" icon={<LayoutDashboard className="w-4.5 h-4.5" />}>
            Dashboard
          </NavItem>
          <NavItem to="/tickets" icon={<Ticket className="w-4.5 h-4.5" />}>
            Tickets
          </NavItem>
          {session?.user?.role === "ADMIN" && (
            <>
              <NavItem to="/users" icon={<Users className="w-4.5 h-4.5" />}>
                Users
              </NavItem>
              <NavItem to="/knowledge" icon={<Book className="w-4.5 h-4.5" />}>
                Knowledge Base
              </NavItem>
            </>
          )}
        </nav>

        {/* Sidebar Footer */}
        {session?.user && (
          <div className="p-4 border-t border-border bg-background/30 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary font-mono text-sm">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {session.user.name}
              </p>
              <p className="text-[10px] text-muted-foreground truncate font-mono">
                {session.user.role}
              </p>
            </div>
          </div>
        )}
      </aside>

      {/* Main View Shell */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-card border-b border-border flex items-center px-6 justify-between z-10">
          <div className="flex items-center gap-2">
            {session?.user?.role === "ADMIN" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                <ShieldAlert className="w-3 h-3" /> Admin Mode
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-8 bg-background">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function NavItem({ to, icon, children }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? "bg-primary/10 text-primary border-l-2 border-primary rounded-l-none font-semibold"
            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
        }`
      }
    >
      {icon}
      <span>{children}</span>
    </NavLink>
  );
}

