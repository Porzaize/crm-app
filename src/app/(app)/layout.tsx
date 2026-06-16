import { requireSession } from "@/lib/auth";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="app-shell">
      <Topbar
        displayName={session.displayName}
        username={session.username}
        role={session.role}
        permissions={session.permissions}
      />
      <div className="app-body">
        <Sidebar permissions={session.permissions} />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
