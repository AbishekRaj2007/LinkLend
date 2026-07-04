import { useState, type CSSProperties, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  AlertTriangle,
  Search,
  Loader2,
  ScanLine,
  BarChart3,
  ClipboardCheck,
  FileText,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { useQueryClient } from "@tanstack/react-query";
import { useMe, useLogout, getMeQueryKey } from "@workspace/api-client-react";
import { GaugeArc } from "./Dashboard";
import Sidebar, { type Page, type RecentEntry } from "./Sidebar";

interface Pillar {
  name: string;
  score: number;
  reasons: string[];
}

interface Profile {
  msme_id: string;
  name: string;
  sector: string;
  overall_score: number;
  rating_band: string;
  tone: "emerald" | "amber" | "red";
  cardStyle: CSSProperties;
  pillars: Pillar[];
  confidence: { level: string; raise_by: string };
  repayment: { sustainable_emi: number; basis: string };
  flags: { consistency_alert: boolean; detail: string };
  forecast: { month: string; score: number }[];
}

// Mock profiles — same hardcoded-data pattern as the landing shell.
// These become the target for the real /assess API (Gate 6).
const PROFILES: Record<string, Profile> = {
  "MSME-7892": {
    msme_id: "MSME-7892",
    name: "Sharma Textiles",
    sector: "Apparel Manufacturing",
    overall_score: 72,
    rating_band: "Moderate Risk",
    tone: "amber",
    cardStyle: {
      backgroundImage:
        "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 10px, transparent 10px, transparent 20px), linear-gradient(135deg, #064e3b, #047857)",
    },
    pillars: [
      { name: "Cashflow Health", score: 65, reasons: ["Volatile cashflow in last 3 months", "Strong runway"] },
      { name: "GST Compliance", score: 80, reasons: ["Consistent filer", "3-year track record"] },
      { name: "UPI Footprint", score: 78, reasons: ["High transaction frequency", "Diverse merchant categories"] },
      { name: "Bureau Health", score: 55, reasons: ["Thin file", "No adverse marks"] },
      { name: "Business Vintage", score: 72, reasons: ["4+ years active", "Stable industry"] },
    ],
    confidence: { level: "Medium", raise_by: "One more GST cycle" },
    repayment: { sustainable_emi: 45000, basis: "Projected minimum monthly net surplus" },
    flags: { consistency_alert: true, detail: "GST turnover significantly exceeds UPI inflows" },
    forecast: [
      { month: "Jan", score: 68 }, { month: "Feb", score: 70 },
      { month: "Mar", score: 69 }, { month: "Apr", score: 72 },
      { month: "May", score: 74 }, { month: "Jun", score: 72 },
    ],
  },
  "MSME-4521": {
    msme_id: "MSME-4521",
    name: "Verdant Organics",
    sector: "Agri-Processing",
    overall_score: 85,
    rating_band: "Low Risk",
    tone: "emerald",
    cardStyle: {
      backgroundImage:
        "radial-gradient(circle at 0% 0%, rgba(59, 130, 246, 0.4) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(37, 99, 235, 0.4) 0%, transparent 50%), linear-gradient(135deg, #1e3a8a, #1d4ed8)",
    },
    pillars: [
      { name: "Cashflow Health", score: 88, reasons: ["Stable, growing inflows", "Low month-on-month variance"] },
      { name: "GST Compliance", score: 90, reasons: ["Never late", "5-year clean history"] },
      { name: "UPI Footprint", score: 84, reasons: ["Dense repeat-customer base", "Wide geographic spread"] },
      { name: "Bureau Health", score: 82, reasons: ["Healthy mix", "On-time servicing"] },
      { name: "Business Vintage", score: 80, reasons: ["7+ years active", "Counter-seasonal resilience"] },
    ],
    confidence: { level: "High", raise_by: "Profile already strong — maintain filing cadence" },
    repayment: { sustainable_emi: 128000, basis: "Projected minimum monthly net surplus" },
    flags: { consistency_alert: false, detail: "Cross-source signals are consistent" },
    forecast: [
      { month: "Jan", score: 80 }, { month: "Feb", score: 82 },
      { month: "Mar", score: 83 }, { month: "Apr", score: 84 },
      { month: "May", score: 86 }, { month: "Jun", score: 85 },
    ],
  },
  "MSME-3310": {
    msme_id: "MSME-3310",
    name: "Nova Kirana Mart",
    sector: "Retail Trade",
    overall_score: 58,
    rating_band: "High Risk",
    tone: "red",
    cardStyle: {
      backgroundImage:
        "radial-gradient(ellipse at 50% 50%, rgba(168, 85, 247, 0.3) 0%, transparent 70%), linear-gradient(135deg, #581c87, #7e22ce)",
    },
    pillars: [
      { name: "Cashflow Health", score: 45, reasons: ["Frequent negative-balance days", "Short runway"] },
      { name: "GST Compliance", score: 60, reasons: ["Occasional late filing", "Under 2-year history"] },
      { name: "UPI Footprint", score: 66, reasons: ["Moderate volume", "Concentrated in few merchants"] },
      { name: "Bureau Health", score: 40, reasons: ["Thin, young file", "One recent enquiry cluster"] },
      { name: "Business Vintage", score: 62, reasons: ["Under 3 years active", "Competitive local market"] },
    ],
    confidence: { level: "Low", raise_by: "6 months of consistent bank + GST data" },
    repayment: { sustainable_emi: 16000, basis: "Projected minimum monthly net surplus" },
    flags: { consistency_alert: true, detail: "Frequent cashflow dips against a thin, young credit file" },
    forecast: [
      { month: "Jan", score: 60 }, { month: "Feb", score: 56 },
      { month: "Mar", score: 58 }, { month: "Apr", score: 54 },
      { month: "May", score: 57 }, { month: "Jun", score: 58 },
    ],
  },
};

const TONE: Record<Profile["tone"], string> = {
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  red: "bg-red-500/10 text-red-400 border-red-500/20",
};

function pillarColor(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function confidenceColor(level: string): string {
  if (level === "High") return "text-emerald-400";
  if (level === "Low") return "text-red-400";
  return "text-amber-400";
}

function Panel({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-5 bg-white/5 rounded-xl border border-white/10 ${className}`}>
      {title && (
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
}

const PAGE_TITLE: Record<Page, string> = {
  assess: "Assess an MSME",
  portfolio: "Portfolio",
  approvals: "Approvals",
  reports: "Reports",
};

const COMING_SOON: Record<Exclude<Page, "assess">, { icon: typeof BarChart3; title: string; body: string }> = {
  portfolio: {
    icon: BarChart3,
    title: "Portfolio view — Gate 7",
    body: "Score distribution and sector concentration across the full MSME book, once the real scoring pipeline (Gates 1–6) is producing live data.",
  },
  approvals: {
    icon: ClipboardCheck,
    title: "Approval queue",
    body: "A dedicated queue for MSMEs awaiting a lending decision, backed by the same Approve / Reject action already on each assessment.",
  },
  reports: {
    icon: FileText,
    title: "Report exports",
    body: "Structured report generation building on today's Download Report action — CSV/PDF export once the API is wired up.",
  },
};

function ComingSoonPage({ page }: { page: Exclude<Page, "assess"> }) {
  const { icon: Icon, title, body } = COMING_SOON[page];
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-center text-white/40 px-6">
      <Icon className="w-10 h-10" />
      <div className="font-bebas text-3xl tracking-wide text-white/60">{title}</div>
      <div className="text-sm max-w-sm">{body}</div>
    </div>
  );
}

interface AssessmentViewProps {
  page: Page;
  onNavigate: (page: Page) => void;
  onBack?: () => void;
}

export default function AssessmentView({
  page,
  onNavigate,
  onBack,
}: AssessmentViewProps) {
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentEntry[]>([
    { msme_id: "MSME-4521", name: "Verdant Organics", score: 85, tone: "emerald" },
    { msme_id: "MSME-3310", name: "Nova Kirana Mart", score: 58, tone: "red" },
  ]);

  // Cached from the ProtectedRoute wrapper's own useMe() call — no extra
  // network request, react-query dedupes on the shared query key.
  const { data: meData } = useMe();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    queryClient.removeQueries({ queryKey: getMeQueryKey() });
    onBack?.();
  };

  const pushRecent = (p: Profile) => {
    setRecents((prev) => [
      { msme_id: p.msme_id, name: p.name, score: p.overall_score, tone: p.tone },
      ...prev.filter((r) => r.msme_id !== p.msme_id),
    ].slice(0, 8));
  };

  const assess = (rawId: string) => {
    const id = rawId.trim().toUpperCase();
    setError(null);
    if (!id) return;
    const profile = PROFILES[id];
    if (!profile) {
      setCurrent(null);
      setError(id);
      return;
    }
    setQuery(id);
    setLoading(true);
    // Simulated assessment latency — replaced by the real /assess call in Gate 6.
    setTimeout(() => {
      setCurrent(profile);
      setLoading(false);
      pushRecent(profile);
    }, 900);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    assess(query);
  };

  const handleNewAssessment = () => {
    onNavigate("assess");
    setQuery("");
    setCurrent(null);
    setError(null);
  };

  const handleSelectRecent = (msmeId: string) => {
    onNavigate("assess");
    assess(msmeId);
  };

  return (
    <div className="h-[100dvh] flex">
      <Sidebar
        activePage={page}
        onNavigate={onNavigate}
        onNewAssessment={handleNewAssessment}
        recents={recents}
        onSelectRecent={handleSelectRecent}
        activeMsmeId={current?.msme_id}
        user={meData?.user}
        onLogout={handleLogout}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <header className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h1 className="font-bebas text-2xl tracking-wide text-white">{PAGE_TITLE[page]}</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors px-4 py-1.5 rounded-full border border-white/10 hover:bg-white/5"
            >
              <ArrowLeft className="w-4 h-4" /> Home
            </button>
            {page === "assess" && current && (
              <button className="bg-primary hover:bg-primary/90 text-white px-5 py-1.5 rounded-full text-sm font-semibold tracking-wide transition-colors">
                Approve / Reject
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 min-h-0">
          {page !== "assess" ? (
            <ComingSoonPage page={page} />
          ) : (
            <div className="h-full flex flex-col md:flex-row">
              {/* Left console */}
              <aside className="w-full md:w-[340px] shrink-0 border-b md:border-b-0 md:border-r border-white/5 p-6 md:p-8 flex flex-col gap-6">
                <div>
                  <p className="text-muted-foreground text-sm">
                    Enter an MSME ID to generate a SakshamScore from alternate data.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="e.g. MSME-7892"
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm font-mono text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white px-6 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-colors"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                    {loading ? "Assessing…" : "Assess"}
                  </button>
                </form>

                <div>
                  <div className="text-xs uppercase tracking-wider text-white/40 mb-2">Try a sample</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(PROFILES).map((p) => (
                      <button
                        key={p.msme_id}
                        onClick={() => assess(p.msme_id)}
                        className={`font-mono text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          current?.msme_id === p.msme_id
                            ? "bg-white text-black border-white"
                            : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {p.msme_id}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="mt-auto p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-red-300">
                    No record found for <span className="font-mono">{error}</span>. Try a sample above.
                  </div>
                )}
              </aside>

              {/* Result pane */}
              <main className="flex-1 min-w-0 overflow-y-auto p-6 md:p-8">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col items-center justify-center gap-4 text-white/50"
                    >
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <div className="font-bebas text-2xl tracking-wide text-white/70">Analyzing alternate data…</div>
                      <div className="text-xs">Cashflow · GST · UPI · Bureau · Vintage</div>
                    </motion.div>
                  ) : !current ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col items-center justify-center gap-3 text-center text-white/40"
                    >
                      <ScanLine className="w-10 h-10" />
                      <div className="font-bebas text-3xl tracking-wide text-white/60">No assessment yet</div>
                      <div className="text-sm max-w-xs">
                        Enter an MSME ID or pick a sample to generate its SakshamScore.
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={current.msme_id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.3 }}
                      className="max-w-5xl mx-auto space-y-6"
                    >
                      {/* Summary header */}
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                        <div>
                          <div className="text-xs font-mono text-white/40">{current.msme_id}</div>
                          <h2 className="font-bebas text-4xl text-white tracking-wide leading-none">{current.name}</h2>
                          <div className="text-sm text-muted-foreground mt-1">{current.sector}</div>
                        </div>
                        <div
                          className="rounded-xl px-5 py-3 border border-white/10 shadow-2xl shrink-0"
                          style={current.cardStyle}
                        >
                          <div className="font-mono text-2xl font-bold tracking-widest text-white/90">
                            SCORE: {current.overall_score}
                            <span className="text-base text-white/50">/100</span>
                          </div>
                          <div className="font-mono text-[10px] tracking-widest text-white/70 mt-1">
                            ID: {current.msme_id}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* Gauge + rating + capacity */}
                        <div className="space-y-5">
                          <Panel title="Overall Assessment" className="flex flex-col items-center">
                            <GaugeArc score={current.overall_score} />
                            <div className={`mt-4 px-3 py-1 text-sm font-semibold rounded-full border ${TONE[current.tone]}`}>
                              {current.rating_band}
                            </div>
                          </Panel>

                          <Panel>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-white/50">Confidence Level</span>
                              <span className={`text-sm font-semibold ${confidenceColor(current.confidence.level)}`}>
                                {current.confidence.level}
                              </span>
                            </div>
                            <div className="text-xs text-white/70">Raise by: {current.confidence.raise_by}</div>
                          </Panel>

                          <Panel>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-white/50">Sustainable EMI</span>
                              <span className="text-sm font-semibold text-emerald-400">
                                ₹{current.repayment.sustainable_emi.toLocaleString("en-IN")}/mo
                              </span>
                            </div>
                            <div className="text-xs text-white/70">{current.repayment.basis}</div>
                          </Panel>
                        </div>

                        {/* Pillar breakdown */}
                        <Panel title="Pillar Breakdown">
                          <div className="space-y-4">
                            {current.pillars.map((pillar) => (
                              <div key={pillar.name} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-white/80">{pillar.name}</span>
                                  <span className="font-mono font-bold">{pillar.score}</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                  <motion.div
                                    className={`h-full ${pillarColor(pillar.score)}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pillar.score}%` }}
                                    transition={{ duration: 1, delay: 0.2 }}
                                  />
                                </div>
                                <div className="text-[11px] text-white/40">{pillar.reasons.join(" · ")}</div>
                              </div>
                            ))}
                          </div>
                        </Panel>

                        {/* Forecast + alert */}
                        <div className="space-y-5">
                          <Panel title="6-Month Projection">
                            <div className="h-[150px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={current.forecast}>
                                  <defs>
                                    <linearGradient id="assessScore" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 12 }} />
                                  <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                                  <Tooltip
                                    contentStyle={{
                                      backgroundColor: "rgba(15,15,25,0.9)",
                                      borderColor: "rgba(255,255,255,0.1)",
                                      borderRadius: "8px",
                                    }}
                                    itemStyle={{ color: "#10b981" }}
                                  />
                                  <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#assessScore)" />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </Panel>

                          <Panel
                            title="Cross-Source Consistency"
                            className={current.flags.consistency_alert ? "!bg-red-950/30 !border-red-500/30" : "!bg-emerald-950/20 !border-emerald-500/20"}
                          >
                            <div className="flex gap-3">
                              <AlertTriangle
                                className={`w-5 h-5 shrink-0 ${current.flags.consistency_alert ? "text-red-500" : "text-emerald-500"}`}
                              />
                              <div>
                                <div className={`text-sm font-semibold ${current.flags.consistency_alert ? "text-red-400" : "text-emerald-400"}`}>
                                  {current.flags.consistency_alert ? "Consistency Alert" : "Signals Consistent"}
                                </div>
                                <div className="text-xs text-white/60 mt-1">{current.flags.detail}</div>
                              </div>
                            </div>
                          </Panel>
                        </div>
                      </div>

                      <p className="text-[11px] text-white/30 text-center pt-2">
                        Reason codes shown are coefficient × feature contributions — not SHAP. Demo data.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </main>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
