import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Gem, Users, ShoppingCart, Plus, DollarSign, ClipboardCheck, TrendingUp, Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Catalog", url: "/catalog", icon: Gem },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "New Order", url: "/orders/new", icon: Plus },
  { title: "Collections", url: "/collections", icon: DollarSign },
  { title: "Finance", url: "/finance", icon: TrendingUp },
  { title: "Factory Check", url: "/factory-check", icon: ClipboardCheck },
  { title: "AI Analytics", url: "/analytics", icon: Sparkles },
];

function CrownIcon() {
  return (
    <svg viewBox="0 0 64 40" className="w-10 h-6 mx-auto" fill="none">
      <path
        d="M4 36L12 12L22 24L32 4L42 24L52 12L60 36H4Z"
        stroke="hsl(43 50% 54%)"
        strokeWidth="2"
        fill="hsl(43 50% 54% / 0.1)"
      />
      <circle cx="12" cy="10" r="2.5" fill="hsl(43 50% 54%)" />
      <circle cx="32" cy="2" r="2.5" fill="hsl(43 50% 54%)" />
      <circle cx="52" cy="10" r="2.5" fill="hsl(43 50% 54%)" />
      <line x1="4" y1="36" x2="60" y2="36" stroke="hsl(43 50% 54%)" strokeWidth="2" />
    </svg>
  );
}

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-6 border-b border-sidebar-border">
        <Link to="/" className="flex flex-col items-center gap-2">
          <CrownIcon />
          <h1 className="font-cinzel text-2xl text-sidebar-foreground tracking-[0.3em] mt-1">LUCIANA</h1>
          <p className="text-[10px] text-muted-foreground tracking-[0.25em] uppercase font-sans">
            Wholesale · Made in Spain
          </p>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground uppercase tracking-[0.2em] text-[11px] font-sans px-5">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`
                        relative text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/10 
                        transition-all duration-200 rounded-none mx-2
                        ${isActive
                          ? "text-primary bg-accent/10 border-l-2 border-primary"
                          : "border-l-2 border-transparent"
                        }
                      `}
                    >
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span className="font-sans text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-center">
          <span className="text-[11px] font-sans px-3 py-1.5 rounded-full bg-accent/10 text-primary border border-accent/20 tracking-wider uppercase">
            Fall / Winter 2026
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
