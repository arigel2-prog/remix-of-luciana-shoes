import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="flex items-center gap-2 p-4 border-b border-border md:hidden">
            <SidebarTrigger />
          </div>
          <div className="p-6 md:p-8">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
