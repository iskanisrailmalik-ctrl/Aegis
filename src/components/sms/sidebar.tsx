"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  Receipt,
  Inbox,
  Landmark,
  Target,
  Brain,
  FileText,
  Settings as SettingsIcon,
  MessageSquareText,
  Menu,
  X,
  ShieldCheck,
  Repeat2,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewKey =
  | "dashboard"
  | "transactions"
  | "inbox"
  | "loans"
  | "budgets"
  | "recurring"
  | "analytics"
  | "intelligence"
  | "documents"
  | "security"
  | "settings";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function Sidebar({
  activeView,
  onViewChange,
  badges,
  online,
  actionButtons,
}: {
  activeView: ViewKey;
  onViewChange: (v: ViewKey) => void;
  badges: Partial<Record<ViewKey, number>>;
  online: boolean;
  actionButtons?: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: NavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: "transactions", label: "Transactions", icon: <Receipt className="h-4 w-4" />, badge: badges.transactions },
    { key: "inbox", label: "SMS Inbox", icon: <Inbox className="h-4 w-4" />, badge: badges.inbox },
    { key: "loans", label: "Loans & EMIs", icon: <Landmark className="h-4 w-4" />, badge: badges.loans },
    { key: "budgets", label: "Budgets & Goals", icon: <Target className="h-4 w-4" /> },
    { key: "recurring", label: "Recurring", icon: <Repeat2 className="h-4 w-4" />, badge: badges.recurring },
    { key: "analytics", label: "Analytics", icon: <BarChart3 className="h-4 w-4" /> },
    { key: "intelligence", label: "Ask AI", icon: <Brain className="h-4 w-4" /> },
    { key: "documents", label: "Documents", icon: <FileText className="h-4 w-4" />, badge: badges.documents },
    { key: "security", label: "Security", icon: <ShieldCheck className="h-4 w-4" />, badge: badges.security },
    { key: "settings", label: "Settings", icon: <SettingsIcon className="h-4 w-4" /> },
  ];

  const handleNav = (key: ViewKey) => {
    onViewChange(key);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile top bar with hamburger + action buttons */}
      <div className="sticky top-0 z-50 flex items-center gap-2 border-b bg-background/95 backdrop-blur-md px-3 py-2 supports-[backdrop-filter]:bg-background/70 lg:hidden safe-top">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Aegis Logo" className="h-7 w-7 object-contain drop-shadow-sm" />
          <span className="text-sm font-semibold">Aegis</span>
        </div>
        {actionButtons && (
          <div className="ml-auto flex items-center gap-1">
            {actionButtons}
          </div>
        )}
        {!actionButtons && (
          <div className="ml-auto flex items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                online ? "bg-emerald-500" : "bg-amber-500"
              )}
            />
          </div>
        )}
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] border-r bg-background shadow-xl animate-fade-in safe-top safe-bottom">
            <SidebarContent
              navItems={navItems}
              activeView={activeView}
              onViewChange={handleNav}
              online={online}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-sidebar lg:flex lg:flex-col safe-top">
        <SidebarContent
          navItems={navItems}
          activeView={activeView}
          onViewChange={handleNav}
          online={online}
        />
      </aside>
    </>
  );
}

function SidebarContent({
  navItems,
  activeView,
  onViewChange,
  online,
}: {
  navItems: NavItem[];
  activeView: ViewKey;
  onViewChange: (v: ViewKey) => void;
  online: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b px-5 py-4">
        <img src="/logo.png" alt="Aegis Logo" className="h-9 w-9 object-contain drop-shadow-sm" />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold leading-tight">
            Aegis
          </h1>
          <p className="text-[10px] text-muted-foreground">SMS Finance Tracker</p>
        </div>
      </div>

      {/* Nav items */}
      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onViewChange(item.key)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                activeView === item.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {item.icon}
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <Badge
                  variant={activeView === item.key ? "secondary" : "outline"}
                  className="h-4 min-w-4 shrink-0 px-1 text-[9px]"
                >
                  {item.badge}
                </Badge>
              )}
            </button>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t px-4 pt-3 pb-6 safe-bottom">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />
          <span className="truncate">Your SMS never leaves your device</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              online ? "bg-emerald-500" : "bg-amber-500"
            )}
          />
          <span className="text-[9px] text-muted-foreground">
            {online ? "Online" : "Offline — fully functional"}
          </span>
        </div>
      </div>
    </div>
  );
}
