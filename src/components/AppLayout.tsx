import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocation } from "react-router-dom";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/catalog": "Catalog",
  "/clients": "Clients",
  "/orders": "Orders",
  "/orders/new": "New Order",
  "/collections": "Collections",
  "/finance": "Finance",
  "/factory-check": "Factory Check",
  "/analytics": "AI Analytics",
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || "Luciana";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto flex flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-3 bg-card border-b border-border">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-primary" />
              <h2 className="font-display text-xl italic text-primary hidden sm:block">{pageTitle}</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-9 w-56 h-8 text-xs bg-secondary border-border focus:border-primary"
                />
              </div>
              <button className="relative p-2 text-muted-foreground hover:text-primary transition-colors">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
              </button>
              <div className="h-8 w-8 rounded-full border-2 border-primary bg-secondary flex items-center justify-center">
                <span className="text-xs font-sans font-medium text-primary">L</span>
              </div>
            </div>
          </header>

          <div className="p-6 md:p-8 flex-1">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
