import { type CSSProperties } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { type CardResponse } from "@workspace/api-client-react";
import { GaugeArc } from "./Dashboard";
import { type RecentEntry } from "./Sidebar";

type Tone = RecentEntry["tone"];

const TONE: Record<Tone, string> = {
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  red: "bg-red-500/10 text-red-400 border-red-500/20",
};

// Score-card gradient, derived from the risk band instead of a hardcoded style.
const CARD_STYLE: Record<Tone, CSSProperties> = {
  emerald: {
    backgroundImage:
      "radial-gradient(circle at 0% 0%, rgba(16,185,129,0.35) 0%, transparent 55%), linear-gradient(135deg, #064e3b, #047857)",
  },
  amber: {
    backgroundImage:
      "radial-gradient(circle at 100% 0%, rgba(245,158,11,0.35) 0%, transparent 55%), linear-gradient(135deg, #78350f, #b45309)",
  },
  red: {
    backgroundImage:
      "radial-gradient(ellipse at 50% 50%, rgba(239,68,68,0.3) 0%, transparent 70%), linear-gradient(135deg, #7f1d1d, #b91c1c)",
  },
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Map the engine's risk band to a UI tone. */
export function toneForBand(band: string): Tone {
  if (band === "Low Risk") return "emerald";
  if (band === "Moderate Risk") return "amber";
  return "red";
}

/** "2024-03" → "Mar"; falls back to the raw label. */
function formatMonth(m: string): string {
  const idx = Number(m.split("-")[1]) - 1;
  return idx >= 0 && idx < 12 ? MONTH_NAMES[idx] : m;
}

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

export default function ScoreCard({ card }: { card: CardResponse }) {
  const tone = toneForBand(card.rating_band);
  const forecastData = card.forecast.months.map((m, i) => ({
    month: formatMonth(m),
    value: card.forecast.projected_net_surplus[i] ?? 0,
  }));

  return (
    <motion.div
      key={card.msme_id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="max-w-5xl mx-auto space-y-6"
    >
      {/* Summary header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <div className="text-xs font-mono text-white/40">SakshamScore assessment</div>
          <h2 className="font-bebas text-4xl text-white tracking-wide leading-none">{card.msme_id}</h2>
          <div className="text-sm text-muted-foreground mt-1">{card.rating_band}</div>
        </div>
        <div
          className="rounded-xl px-5 py-3 border border-white/10 shadow-2xl shrink-0"
          style={CARD_STYLE[tone]}
        >
          <div className="font-mono text-2xl font-bold tracking-widest text-white/90">
            SCORE: {card.overall_score}
            <span className="text-base text-white/50">/100</span>
          </div>
          <div className="font-mono text-[10px] tracking-widest text-white/70 mt-1">
            ID: {card.msme_id}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Gauge + rating + capacity */}
        <div className="space-y-5">
          <Panel title="Overall Assessment" className="flex flex-col items-center">
            <GaugeArc score={card.overall_score} />
            <div className={`mt-4 px-3 py-1 text-sm font-semibold rounded-full border ${TONE[tone]}`}>
              {card.rating_band}
            </div>
          </Panel>

          <Panel>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-white/50">Confidence Level</span>
              <span className={`text-sm font-semibold ${confidenceColor(card.confidence.level)}`}>
                {card.confidence.level}
              </span>
            </div>
            <div className="text-xs text-white/70">Raise by: {card.confidence.raise_by}</div>
          </Panel>

          <Panel>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-white/50">Sustainable EMI</span>
              <span className="text-sm font-semibold text-emerald-400">
                ₹{card.repayment.sustainable_emi.toLocaleString("en-IN")}/mo
              </span>
            </div>
            <div className="text-xs text-white/70">{card.repayment.basis}</div>
          </Panel>
        </div>

        {/* Pillar breakdown */}
        <Panel title="Pillar Breakdown">
          <div className="space-y-4">
            {card.pillars.map((pillar) => (
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
          <Panel title="6-Month Net Surplus (₹)">
            <div className="h-[150px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="assessScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 12 }} />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15,15,25,0.9)",
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "#10b981" }}
                    formatter={(v: number | string) => [
                      `₹${Number(v).toLocaleString("en-IN")}`,
                      "Net surplus",
                    ]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#assessScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel
            title="Cross-Source Consistency"
            className={card.flags.consistency_alert ? "!bg-red-950/30 !border-red-500/30" : "!bg-emerald-950/20 !border-emerald-500/20"}
          >
            <div className="flex gap-3">
              <AlertTriangle
                className={`w-5 h-5 shrink-0 ${card.flags.consistency_alert ? "text-red-500" : "text-emerald-500"}`}
              />
              <div>
                <div className={`text-sm font-semibold ${card.flags.consistency_alert ? "text-red-400" : "text-emerald-400"}`}>
                  {card.flags.consistency_alert ? "Consistency Alert" : "Signals Consistent"}
                </div>
                <div className="text-xs text-white/60 mt-1">{card.flags.detail}</div>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <p className="text-[11px] text-white/30 text-center pt-2">
        Reason codes are coefficient × feature contributions — not SHAP. Scored on synthetic MSME data.
      </p>
    </motion.div>
  );
}
