import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Search,
  Loader2,
  ScanLine,
  BarChart3,
  ClipboardCheck,
  FileText,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useMe,
  useLogout,
  useAssess,
  getMeQueryKey,
  type CardResponse,
} from "@workspace/api-client-react";
import { extractErrorMessage } from "../lib/errors";
import Sidebar, { type Page, type RecentEntry } from "./Sidebar";
import ScoreCard, { toneForBand } from "./ScoreCard";

// A few valid seeded MSME IDs (dataset is MSME-000001 … MSME-002000, see
// api-server/src/data/store.ts). These drive the "Try a sample" chips.
const SAMPLE_IDS = ["MSME-000001", "MSME-000500", "MSME-001000"] as const;

const PAGE_TITLE: Record<Page, string> = {
  assess: "Assess an MSME",
  portfolio: "Portfolio",
  approvals: "Approvals",
  reports: "Reports",
};

const COMING_SOON: Record<Exclude<Page, "assess">, { icon: typeof BarChart3; title: string; body: string }> = {
  portfolio: {
    icon: BarChart3,
    title: "Portfolio view — Gate B",
    body: "Score distribution and sector concentration across the full MSME book, from the live /portfolio endpoint.",
  },
  approvals: {
    icon: ClipboardCheck,
    title: "Approval queue",
    body: "A dedicated queue for MSMEs awaiting a lending decision, backed by the same Approve / Reject action on each assessment.",
  },
  reports: {
    icon: FileText,
    title: "Report exports",
    body: "Structured report generation building on today's assessment — CSV / PDF credit memos with reason codes.",
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
  const [current, setCurrent] = useState<CardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  // Cached from the ProtectedRoute wrapper's own useMe() call — no extra
  // network request, react-query dedupes on the shared query key.
  const { data: meData } = useMe();
  const logoutMutation = useLogout();
  const assessMutation = useAssess();
  const queryClient = useQueryClient();

  const loading = assessMutation.isPending;

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    queryClient.removeQueries({ queryKey: getMeQueryKey() });
    onBack?.();
  };

  const pushRecent = (c: CardResponse) => {
    setRecents((prev) => [
      {
        msme_id: c.msme_id,
        name: c.msme_id,
        score: c.overall_score,
        tone: toneForBand(c.rating_band),
      },
      ...prev.filter((r) => r.msme_id !== c.msme_id),
    ].slice(0, 8));
  };

  const assess = (rawId: string) => {
    const id = rawId.trim().toUpperCase();
    setError(null);
    if (!id) return;
    setQuery(id);
    assessMutation.mutate(
      { data: { msme_id: id } },
      {
        onSuccess: (card) => {
          setCurrent(card);
          pushRecent(card);
        },
        onError: (err) => {
          setCurrent(null);
          setError(extractErrorMessage(err, `No record found for ${id}.`));
        },
      },
    );
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
                      placeholder="e.g. MSME-000001"
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
                    {SAMPLE_IDS.map((id) => (
                      <button
                        key={id}
                        onClick={() => assess(id)}
                        className={`font-mono text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          current?.msme_id === id
                            ? "bg-white text-black border-white"
                            : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="mt-auto p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-red-300">
                    {error} Try a sample above.
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
                      <div className="text-xs">Vitality · Cashflow · Compliance · Banking · Obligations</div>
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
                    <ScoreCard card={current} />
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
