import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Gem, Users, ShoppingCart, Plus, DollarSign, ClipboardCheck } from "lucide-react";
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
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Catalog", url: "/catalog", icon: Gem },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "New Order", url: "/orders/new", icon: Plus },
  { title: "Collections", url: "/collections", icon: DollarSign },
  { title: "Factory Check", url: "/factory-check", icon: ClipboardCheck },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-6 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3">
          <Gem className="h-8 w-8 text-sidebar-primary" />
          <div>
            <h1 className="font-display text-xl font-bold text-sidebar-foreground">Luciana</h1>
            <p className="text-xs text-sidebar-foreground/60 tracking-wider uppercase">Shoes</p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-xs">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    className="text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
