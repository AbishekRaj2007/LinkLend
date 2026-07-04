import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Search,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  ScanLine,
  BarChart3,
  ClipboardCheck,
  FileText,
  CircleUser,
  ChevronsUpDown,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export type Page = "assess" | "portfolio" | "approvals" | "reports";

export interface RecentEntry {
  msme_id: string;
  name: string;
  score: number;
  tone: "emerald" | "amber" | "red";
}

// Shared sample data — used both as AssessmentView's initial recents and as
// decorative content on the pre-login Login/SignUp pages (same sidebar,
// rendered non-interactively there since there's no session yet).
export const SAMPLE_RECENTS: RecentEntry[] = [
  { msme_id: "MSME-4521", name: "Verdant Organics", score: 85, tone: "emerald" },
  { msme_id: "MSME-3310", name: "Nova Kirana Mart", score: 58, tone: "red" },
];

const NAV_ITEMS: { page: Page; label: string; icon: typeof ScanLine }[] = [
  { page: "assess", label: "Assess MSME", icon: ScanLine },
  { page: "portfolio", label: "Portfolio", icon: BarChart3 },
  { page: "approvals", label: "Approvals", icon: ClipboardCheck },
  { page: "reports", label: "Reports", icon: FileText },
];

const TONE_DOT: Record<RecentEntry["tone"], string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  onNewAssessment: () => void;
  recents: RecentEntry[];
  onSelectRecent: (msmeId: string) => void;
  activeMsmeId?: string;
  user?: { name: string; email: string };
  onLogout?: () => void;
}

export default function Sidebar({
  activePage,
  onNavigate,
  onNewAssessment,
  recents,
  onSelectRecent,
  activeMsmeId,
  user,
  onLogout,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 264 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="h-[100dvh] shrink-0 bg-[#0a0a0a] border-r border-white/5 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-4 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-6 h-6 text-primary shrink-0" />
          {!collapsed && (
            <span className="font-bebas text-xl tracking-wide text-white truncate">
              SAKSHAMSCORE
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!collapsed && (
            <button
              className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* New Assessment */}
      <div className="shrink-0 px-3 pb-3">
        <button
          onClick={onNewAssessment}
          className={`w-full flex items-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors font-medium text-sm ${
            collapsed ? "justify-center p-2.5" : "px-3 py-2.5"
          }`}
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!collapsed && <span>New Assessment</span>}
        </button>
      </div>

      {/* Primary nav */}
      <nav className="shrink-0 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ page, label, icon: Icon }) => {
          const isActive = page === activePage;
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className={`w-full flex items-center gap-3 rounded-lg text-sm transition-colors ${
                collapsed ? "justify-center p-2.5" : "px-3 py-2"
              } ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Recents */}
      {!collapsed && (
        <div className="flex-1 min-h-0 flex flex-col mt-6 px-3">
          <div className="text-xs font-medium uppercase tracking-wider text-white/30 px-3 mb-1.5">
            Recent Assessments
          </div>
          <div className="flex-1 overflow-y-auto space-y-0.5 pb-2">
            {recents.length === 0 && (
              <div className="px-3 py-2 text-xs text-white/30">No assessments yet</div>
            )}
            {recents.map((r) => (
              <button
                key={r.msme_id}
                onClick={() => onSelectRecent(r.msme_id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                  r.msme_id === activeMsmeId && activePage === "assess"
                    ? "bg-white/10"
                    : "hover:bg-white/5"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[r.tone]}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-white/80 truncate">{r.name}</span>
                  <span className="block text-[10px] font-mono text-white/35 truncate">{r.msme_id}</span>
                </span>
                <span className="text-xs font-mono text-white/40 shrink-0">{r.score}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {collapsed && <div className="flex-1" />}

      {/* Footer / user */}
      <div className="shrink-0 border-t border-white/5 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`w-full flex items-center gap-2 rounded-lg hover:bg-white/5 transition-colors ${
                collapsed ? "justify-center p-2" : "px-2 py-2"
              }`}
            >
              <CircleUser className="w-7 h-7 text-white/60 shrink-0" />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm text-white/85 truncate">
                      {user?.name ?? "…"}
                    </span>
                    <span className="block text-[11px] text-white/40 truncate">
                      {user?.email ?? ""}
                    </span>
                  </span>
                  <ChevronsUpDown className="w-3.5 h-3.5 text-white/30 shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-48">
            <DropdownMenuItem onClick={onLogout} className="gap-2">
              <LogOut className="w-4 h-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.aside>
  );
}
