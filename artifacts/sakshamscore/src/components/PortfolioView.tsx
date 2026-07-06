import { Loader2, ServerCrash } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { useGetPortfolio, getGetPortfolioQueryKey } from "@workspace/api-client-react";
import { extractErrorMessage } from "../lib/errors";

/** Same 75/60 cutoffs as the engine's rating bands (emerald/amber/red). */
function scoreColor(score: number): string {
  if (score >= 75) return "#10b981";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-5 bg-white/5 rounded-xl border border-white/10 ${className}`}>
      {title && (
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-4">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="p-5 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-1 min-w-0">
      <span className="text-xs text-white/50 uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-bold font-mono truncate ${accent}`}>{value}</span>
    </div>
  );
}

export default function PortfolioView() {
  const { data, isLoading, isError, error } = useGetPortfolio({
    query: {
      queryKey: getGetPortfolioQueryKey(),
      // The full five-table pull behind /portfolio is cached server-side after
      // the first request per server process, but the first call itself can
      // take up to a minute — no need to refetch every time this tab reopens.
      staleTime: 5 * 60 * 1000,
    },
  });

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-white/50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <div className="font-bebas text-2xl tracking-wide text-white/70">
          Aggregating the full MSME book…
        </div>
        <div className="text-xs max-w-sm text-center">
          Scoring every MSME in the portfolio can take up to a minute on the
          first load; it's cached after that.
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center text-white/40 px-6">
        <ServerCrash className="w-10 h-10" />
        <div className="font-bebas text-3xl tracking-wide text-white/60">
          Couldn't load the portfolio
        </div>
        <div className="text-sm max-w-sm">
          {extractErrorMessage(error, "Something went wrong fetching /portfolio.")}
        </div>
      </div>
    );
  }

  const totalCount = data.scoreDistribution.reduce((s, b) => s + b.count, 0);
  const topSector = data.sectorConcentration[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-5xl mx-auto p-6 md:p-8 space-y-6"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="MSMEs assessed" value={totalCount} />
        <Stat
          label="Expected default rate"
          value={`${(data.expectedDefaultEstimate * 100).toFixed(1)}%`}
        />
        <Stat label="Sectors represented" value={data.sectorConcentration.length} />
        <Stat
          label="Top sector"
          value={topSector ? topSector.sector : "—"}
          accent="text-emerald-400"
        />
      </div>

      <Panel title="Score Distribution">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="bucket" axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 12 }} />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15,15,25,0.9)",
                  borderColor: "rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                }}
                formatter={(v: number | string) => [v, "MSMEs"]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.scoreDistribution.map((b) => (
                  // Bucket midpoint stands in for the band cutoff (e.g. "60-79" -> 70).
                  <Cell key={b.bucket} fill={scoreColor(Number(b.bucket.split("-")[1]))} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Sector Concentration">
        <div className="space-y-3">
          {data.sectorConcentration.map((s) => (
            <div key={s.sector} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-white/80 truncate capitalize">{s.sector}</div>
                <div className="text-[11px] text-white/40">{s.count} MSMEs</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="h-1.5 w-28 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.min(100, s.avgScore)}%`,
                      backgroundColor: scoreColor(s.avgScore),
                    }}
                  />
                </div>
                <span className="font-mono text-sm font-bold w-10 text-right">
                  {Math.round(s.avgScore)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </motion.div>
  );
}
