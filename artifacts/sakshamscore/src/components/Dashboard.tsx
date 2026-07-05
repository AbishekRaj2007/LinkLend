import { useState, useEffect, useMemo as useReactMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  ServerCrash,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { useMsmeIds, useScorecards, useMemo as useMemoQuery } from "../lib/api";
import type { RatingBand, Scorecard } from "../lib/scorecard";

// How many MSMEs to surface in the assessment carousel.
const CAROUSEL_SIZE = 6;

function bandStyle(band: RatingBand): React.CSSProperties {
  switch (band) {
    case "Low Risk":
      return {
        backgroundImage:
          "radial-gradient(circle at 0% 0%, rgba(16,185,129,0.4) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(5,150,105,0.4) 0%, transparent 50%), linear-gradient(135deg, #064e3b, #047857)",
      };
    case "Moderate Risk":
      return {
        backgroundImage:
          "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.35) 0%, transparent 60%), linear-gradient(135deg, #78350f, #b45309)",
      };
    case "High Risk":
      return {
        backgroundImage:
          "radial-gradient(ellipse at 50% 50%, rgba(239,68,68,0.3) 0%, transparent 70%), linear-gradient(135deg, #7f1d1d, #b91c1c)",
      };
  }
}

function scoreColor(score: number): string {
  if (score >= 75) return "#10b981";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function bandAccent(band: RatingBand): string {
  if (band === "Low Risk") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (band === "Moderate Risk") return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  return "text-red-400 bg-red-500/10 border-red-500/20";
}

function GaugeArc({ score }: { score: number }) {
  const radius = 60;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-40 h-24 flex flex-col items-center justify-end">
      <svg className="absolute top-0 left-0 w-full h-full overflow-visible">
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <path d="M 20 96 A 60 60 0 0 1 140 96" fill="none" stroke="#262626" strokeWidth="12" strokeLinecap="round" />
        <motion.path
          d="M 20 96 A 60 60 0 0 1 140 96"
          fill="none"
          stroke="url(#scoreGradient)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="flex flex-col items-center mt-8">
        <span className="text-4xl font-bold font-mono text-white">{score}</span>
        <span className="text-xs text-muted-foreground uppercase tracking-wider">/ 100</span>
      </div>
    </div>
  );
}

function MemoBlock({ msmeId }: { msmeId: string }) {
  const { data, isLoading } = useMemoQuery(msmeId);
  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
      <div className="text-xs text-white/50 uppercase tracking-wider mb-2">AI Credit Memo</div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-white/50">
          <Loader2 className="w-3 h-3 animate-spin" /> Generating…
        </div>
      ) : (
        <p className="text-xs text-white/70 leading-relaxed">{data?.memo}</p>
      )}
    </div>
  );
}

function ExpandedPanel({ sc }: { sc: Scorecard }) {
  const forecastData = sc.repayment.forecast.projected.map((v, i) => ({
    month: `M${i + 1}`,
    value: Math.round(v / 1000), // ₹ thousands
  }));

  return (
    <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Gauge */}
      <div className="flex flex-col items-center justify-center p-6 bg-white/5 rounded-lg border border-white/5">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-6">
          Overall Assessment · {sc.msmeId}
        </h3>
        <GaugeArc score={sc.overallScore} />
        <div className={`mt-4 px-3 py-1 text-sm font-semibold rounded-full border ${bandAccent(sc.ratingBand)}`}>
          {sc.ratingBand}
        </div>
        {sc.reasons.length > 0 && (
          <div className="mt-4 w-full space-y-1">
            <div className="text-[11px] text-white/40 uppercase tracking-wider">Key adverse factors</div>
            {sc.reasons.map((r) => (
              <div key={r.feature} className="flex items-center gap-1.5 text-xs text-red-300/80">
                <TrendingDown className="w-3 h-3 shrink-0" />
                {r.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pillars */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Pillar Breakdown</h3>
        {sc.pillars.map((pillar) => (
          <div key={pillar.id} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-white/80">
                {pillar.label}
                <span className="text-white/30 ml-1">· {Math.round(pillar.weight * 100)}%</span>
              </span>
              <span className="font-mono font-bold">{pillar.subScore}</span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full"
                style={{ backgroundColor: scoreColor(pillar.subScore) }}
                initial={{ width: 0 }}
                animate={{ width: `${pillar.subScore}%` }}
                transition={{ duration: 0.8, delay: 0.1 }}
              />
            </div>
            {pillar.reasons[0] && (
              <div className="flex items-center gap-1 text-[11px] text-white/40">
                {pillar.reasons[0].direction === "positive" ? (
                  <TrendingUp className="w-3 h-3 text-emerald-500/70" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-500/70" />
                )}
                {pillar.reasons[0].label}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Alerts & insights */}
      <div className="space-y-4">
        {sc.flags.consistencyAlert && (
          <div className="p-4 rounded-lg bg-red-950/30 border border-red-500/30 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-red-400">Consistency Alert</div>
              <div className="text-xs text-white/60 mt-1">{sc.flags.detail}</div>
            </div>
          </div>
        )}

        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-white/50">Confidence Level</span>
            <span className="text-sm font-semibold text-amber-400">
              {sc.confidence.level}
              <span className="text-white/30 ml-1">({sc.confidence.coverageScore})</span>
            </span>
          </div>
          <div className="text-xs text-white/70">
            {sc.confidence.raiseBy ?? "Full data coverage — no gaps to close."}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-white/50">Sustainable EMI</span>
            <span className="text-sm font-semibold text-emerald-400">
              ₹{sc.repayment.sustainableEmi.toLocaleString("en-IN")}/mo
            </span>
          </div>
          <div className="text-xs text-white/70">40% of projected worst-month net surplus</div>
        </div>
      </div>

      {/* Forecast + memo */}
      <div className="space-y-4">
        <div className="p-6 bg-white/5 rounded-lg border border-white/5 flex flex-col">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
            6-Month Net-Inflow Projection (₹k)
          </h3>
          <div className="flex-1 min-h-[120px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 12 }} />
                <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "rgba(15,15,25,0.9)", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  itemStyle={{ color: "#10b981" }}
                />
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <MemoBlock msmeId={sc.msmeId} />
      </div>
    </div>
  );
}

function PortfolioPanel({ scorecards }: { scorecards: Scorecard[] }) {
  if (scorecards.length === 0) return null;
  const avg = Math.round(scorecards.reduce((s, c) => s + c.overallScore, 0) / scorecards.length);
  const bands: Record<RatingBand, number> = { "Low Risk": 0, "Moderate Risk": 0, "High Risk": 0 };
  for (const c of scorecards) bands[c.ratingBand]++;
  const alerts = scorecards.filter((c) => c.flags.consistencyAlert).length;

  const stat = (label: string, value: string | number, accent = "text-white") => (
    <div className="p-5 rounded-lg bg-white/5 border border-white/10 flex flex-col gap-1">
      <span className="text-xs text-white/50 uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-bold font-mono ${accent}`}>{value}</span>
    </div>
  );

  const avgAccent =
    avg >= 75 ? "text-emerald-400" : avg >= 60 ? "text-amber-400" : "text-red-400";

  return (
    <div className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-3 gap-4">
      {stat("Sample size", scorecards.length)}
      {stat("Avg score", avg, avgAccent)}
      {stat("Consistency alerts", alerts, "text-red-400")}
      {stat("Low risk", bands["Low Risk"], "text-emerald-400")}
      {stat("Moderate risk", bands["Moderate Risk"], "text-amber-400")}
      {stat("High risk", bands["High Risk"], "text-red-400")}
    </div>
  );
}

export default function Dashboard() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"assess" | "portfolio">("assess");

  const idsQuery = useMsmeIds();
  const carouselIds = useReactMemo(
    () => (idsQuery.data ?? []).slice(0, CAROUSEL_SIZE),
    [idsQuery.data],
  );
  const scorecardQueries = useScorecards(carouselIds);
  const scorecards = scorecardQueries
    .map((q) => q.data)
    .filter((c): c is Scorecard => !!c);

  const nextCard = () => {
    setActiveIndex((prev) => (prev + 1) % Math.max(carouselIds.length, 1));
    setIsExpanded(false);
  };
  const prevCard = () => {
    setActiveIndex((prev) => (prev - 1 + carouselIds.length) % Math.max(carouselIds.length, 1));
    setIsExpanded(false);
  };

  useEffect(() => {
    if (isExpanded || carouselIds.length === 0) return;
    const timer = setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % carouselIds.length);
    }, 5000);
    return () => clearTimeout(timer);
  }, [activeIndex, isExpanded, carouselIds.length]);

  const activeScorecard = scorecardQueries[activeIndex]?.data ?? null;

  return (
    <div className="w-full min-h-screen pb-20">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          <span className="font-bebas text-2xl tracking-wide text-white">SAKSHAMSCORE</span>
        </div>
        <button className="bg-primary hover:bg-primary/90 text-white px-5 py-1.5 rounded-full text-sm font-semibold tracking-wide transition-colors">
          Approve / Reject
        </button>
      </nav>

      <main className="pt-32 px-6 max-w-6xl mx-auto flex flex-col items-center">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="font-bebas text-[clamp(4rem,10vw,8rem)] leading-none text-white tracking-wider">
            EMPOWERING MSMEs
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto text-sm md:text-base">
            Unified Assessment Framework for NTC/NTB enterprises using alternate data.
          </p>

          <div className="mt-8 inline-flex items-center p-1 bg-white/5 rounded-full border border-white/10 relative">
            <div className="relative z-10 flex">
              <button
                onClick={() => setActiveTab("assess")}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === "assess" ? "text-black" : "text-white/70 hover:text-white"}`}
              >
                Assess MSME
              </button>
              <button
                onClick={() => setActiveTab("portfolio")}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === "portfolio" ? "text-black" : "text-white/70 hover:text-white"}`}
              >
                Portfolio Analytics
              </button>
            </div>
            <motion.div
              className="absolute top-1 bottom-1 w-1/2 bg-white rounded-full z-0"
              initial={false}
              animate={{ left: activeTab === "assess" ? "4px" : "calc(50% - 4px)" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          </div>
        </div>

        {/* API unreachable / loading states */}
        {idsQuery.isError && (
          <div className="w-full max-w-2xl p-6 rounded-xl border border-red-500/30 bg-red-950/20 flex gap-4 items-start mb-8">
            <ServerCrash className="w-6 h-6 text-red-400 shrink-0" />
            <div className="text-sm text-white/70">
              <div className="font-semibold text-red-400 mb-1">Can't reach the scoring API</div>
              Start it with <code className="bg-black/40 px-1 rounded">pnpm run dev:api</code> (needs a
              seeded Postgres — see the README). The dev server proxies{" "}
              <code className="bg-black/40 px-1 rounded">/api</code> to port 5000.
            </div>
          </div>
        )}
        {idsQuery.isLoading && (
          <div className="flex items-center gap-2 text-white/50 mb-8">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading MSMEs…
          </div>
        )}

        {/* Assess tab */}
        {activeTab === "assess" && carouselIds.length > 0 && (
          <>
            <div className="relative w-full max-w-4xl h-[320px] flex items-center justify-center perspective-[1000px] mt-6 mb-12">
              <div className="absolute left-0 z-20">
                <button onClick={prevCard} className="p-3 rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
              <div className="absolute right-0 z-20">
                <button onClick={nextCard} className="p-3 rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors">
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              <div className="relative w-[380px] h-[240px] flex items-center justify-center">
                <AnimatePresence initial={false}>
                  {carouselIds.map((id, idx) => {
                    let offset = idx - activeIndex;
                    if (offset < -1) offset += carouselIds.length;
                    if (offset > 1) offset -= carouselIds.length;
                    if (Math.abs(offset) > 1) return null;

                    const isCenter = offset === 0;
                    const card = scorecardQueries[idx]?.data ?? null;
                    const band: RatingBand = card?.ratingBand ?? "Moderate Risk";

                    return (
                      <motion.div
                        key={id}
                        className="absolute w-full h-full rounded-2xl p-6 flex flex-col justify-between cursor-pointer border border-white/10 shadow-2xl"
                        style={{ ...bandStyle(band), zIndex: isCenter ? 10 : 5, transformStyle: "preserve-3d" }}
                        initial={false}
                        animate={{
                          scale: isCenter ? 1 : 0.82,
                          opacity: isCenter ? 1 : 0.55,
                          rotateY: isCenter ? 0 : offset > 0 ? -18 : 18,
                          x: isCenter ? 0 : offset > 0 ? 180 : -180,
                          z: isCenter ? 0 : -60,
                          boxShadow: isCenter
                            ? "0 25px 50px -12px rgba(0,0,0,0.8), 0 0 40px rgba(16, 185, 129, 0.2)"
                            : "none",
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        onClick={() => {
                          if (isCenter) setIsExpanded((v) => !v);
                          else if (offset > 0) nextCard();
                          else prevCard();
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="w-10 h-8 rounded border border-white/30 flex flex-col justify-evenly p-1">
                            <div className="h-0.5 bg-white/50 w-full" />
                            <div className="h-0.5 bg-white/50 w-full" />
                            <div className="h-0.5 bg-white/50 w-full" />
                          </div>
                          <span className="text-[10px] font-bold tracking-widest bg-black/40 px-2 py-1 rounded">
                            {(card?.ratingBand ?? "…").toUpperCase()}
                          </span>
                        </div>
                        <div className="text-center my-4">
                          <div className="font-mono text-3xl font-bold tracking-widest text-white/90">
                            {card ? (
                              <>
                                SCORE: {card.overallScore}
                                <span className="text-xl text-white/50">/100</span>
                              </>
                            ) : (
                              <Loader2 className="w-6 h-6 animate-spin inline" />
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-end">
                          <div className="font-mono text-sm text-white/70">ID: {id}</div>
                          {card && (
                            <div className="font-mono text-xs text-white/60">conf: {card.confidence.level}</div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              <div className="absolute -bottom-8 flex gap-3">
                {carouselIds.map((id, idx) => (
                  <div key={id} className={`w-2 h-2 rounded-full ${idx === activeIndex ? "bg-primary" : "bg-white/20"}`} />
                ))}
              </div>
            </div>

            <p className="text-xs text-white/40 mb-4 -mt-4">Click the centre card to expand the full scorecard.</p>

            <AnimatePresence>
              {isExpanded && activeScorecard && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="w-full max-w-4xl overflow-hidden rounded-xl border border-white/10 bg-[#0f0f19]/85 backdrop-blur-xl shadow-2xl"
                >
                  <ExpandedPanel sc={activeScorecard} />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Portfolio tab */}
        {activeTab === "portfolio" && (
          <div className="mt-6 w-full flex flex-col items-center gap-4">
            {scorecards.length === 0 ? (
              <div className="flex items-center gap-2 text-white/50">
                <Loader2 className="w-5 h-5 animate-spin" /> Aggregating portfolio…
              </div>
            ) : (
              <PortfolioPanel scorecards={scorecards} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
