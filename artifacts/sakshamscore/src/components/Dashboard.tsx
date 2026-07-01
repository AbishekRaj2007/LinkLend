import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, AlertTriangle, ArrowLeft, ArrowRight, ActivitySquare } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

const CARDS = [
  {
    id: "MSME-7892",
    score: 72,
    status: "Moderate Risk",
    valid: "07/26",
    style: { backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 10px, transparent 10px, transparent 20px), linear-gradient(135deg, #064e3b, #047857)" }
  },
  {
    id: "MSME-4521",
    score: 85,
    status: "Low Risk",
    valid: "12/26",
    style: { backgroundImage: "radial-gradient(circle at 0% 0%, rgba(59, 130, 246, 0.4) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(37, 99, 235, 0.4) 0%, transparent 50%), linear-gradient(135deg, #1e3a8a, #1d4ed8)" }
  },
  {
    id: "MSME-3310",
    score: 58,
    status: "High Risk",
    valid: "03/27",
    style: { backgroundImage: "radial-gradient(ellipse at 50% 50%, rgba(168, 85, 247, 0.3) 0%, transparent 70%), linear-gradient(135deg, #581c87, #7e22ce)" }
  },
];

const MOCK_DATA = {
  msme_id: "MSME-7892",
  overall_score: 72,
  rating_band: "Moderate Risk",
  pillars: [
    { name: "Cashflow Health", score: 65, reasons: ["Volatile cashflow in last 3 months", "Strong runway"] },
    { name: "GST Compliance", score: 80, reasons: ["Consistent filer", "3-year track record"] },
    { name: "UPI Footprint", score: 78, reasons: ["High transaction frequency", "Diverse merchant categories"] },
    { name: "Bureau Health", score: 55, reasons: ["Thin file", "No adverse marks"] },
    { name: "Business Vintage", score: 72, reasons: ["4+ years active", "Stable industry"] }
  ],
  confidence: { level: "Medium", raise_by: "One more GST cycle" },
  repayment: { sustainable_emi: 45000, basis: "Projected minimum monthly net surplus" },
  flags: { consistency_alert: true, detail: "GST turnover significantly exceeds UPI inflows" },
  forecast: [
    { month: "Jan", score: 68 }, { month: "Feb", score: 70 },
    { month: "Mar", score: 69 }, { month: "Apr", score: 72 },
    { month: "May", score: 74 }, { month: "Jun", score: 72 }
  ]
};

function GaugeArc({ score }: { score: number }) {
  const radius = 60;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  let color = "#ef4444";
  if (score >= 60) color = "#f59e0b";
  if (score >= 75) color = "#10b981";

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
        <path
          d="M 20 96 A 60 60 0 0 1 140 96"
          fill="none"
          stroke="#262626"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <motion.path
          d="M 20 96 A 60 60 0 0 1 140 96"
          fill="none"
          stroke="url(#scoreGradient)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <div className="flex flex-col items-center mt-8">
        <span className="text-4xl font-bold font-mono text-white">{score}</span>
        <span className="text-xs text-muted-foreground uppercase tracking-wider">/ 100</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"assess" | "portfolio">("assess");

  const nextCard = () => {
    setActiveIndex((prev) => (prev + 1) % CARDS.length);
    setIsExpanded(false);
  };

  const prevCard = () => {
    setActiveIndex((prev) => (prev - 1 + CARDS.length) % CARDS.length);
    setIsExpanded(false);
  };

  const centerCard = CARDS[activeIndex];

  return (
    <div className="w-full min-h-screen pb-20">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          <span className="font-bebas text-2xl tracking-wide text-white">SAKSHAMSCORE</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="bg-primary hover:bg-primary/90 text-white px-5 py-1.5 rounded-full text-sm font-semibold tracking-wide transition-colors">
            Approve / Reject
          </button>
        </div>
      </nav>

      {/* Floating Download Report */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-40 bg-white text-black p-4 rounded-xl shadow-2xl flex flex-col items-center gap-4 hidden md:flex">
        <div className="font-bebas text-xl [writing-mode:vertical-lr] rotate-180 tracking-widest">
          DOWNLOAD REPORT
        </div>
        <div className="w-12 h-12 bg-black/10 rounded grid grid-cols-3 grid-rows-3 gap-0.5 p-1">
          {[...Array(9)].map((_, i) => (
            <div key={i} className={`bg-black ${i % 2 === 0 ? 'opacity-100' : 'opacity-20'}`} />
          ))}
        </div>
      </div>

      <main className="pt-32 px-6 max-w-6xl mx-auto flex flex-col items-center">
        {/* Hero Section */}
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

        {/* Carousel */}
        <div className="relative w-full max-w-4xl h-[320px] flex items-center justify-center perspective-[1000px] mb-12">
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
              {CARDS.map((card, idx) => {
                let offset = idx - activeIndex;
                if (offset < -1) offset += CARDS.length;
                if (offset > 1) offset -= CARDS.length;

                const isCenter = offset === 0;
                const zIndex = isCenter ? 10 : 5;
                const scale = isCenter ? 1 : 0.82;
                const opacity = isCenter ? 1 : 0.55;
                const rotateY = isCenter ? 0 : offset > 0 ? -18 : 18;
                const x = isCenter ? 0 : offset > 0 ? 180 : -180;
                const z = isCenter ? 0 : -60;

                if (Math.abs(offset) > 1) return null; // Only show 3 cards

                return (
                  <motion.div
                    key={card.id}
                    className={`absolute w-full h-full rounded-2xl p-6 flex flex-col justify-between cursor-pointer border border-white/10 shadow-2xl ${card.gradient}`}
                    style={{ zIndex, transformStyle: "preserve-3d" }}
                    initial={false}
                    animate={{
                      scale, opacity, rotateY, x, z,
                      boxShadow: isCenter ? "0 25px 50px -12px rgba(0,0,0,0.8), 0 0 40px rgba(16, 185, 129, 0.2)" : "none"
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    onClick={() => {
                      if (isCenter) setIsExpanded(!isExpanded);
                      else if (offset > 0) nextCard();
                      else prevCard();
                    }}
                  >
                    {/* Card Content */}
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-8 rounded border border-white/30 flex flex-col justify-evenly p-1">
                        <div className="h-0.5 bg-white/50 w-full" />
                        <div className="h-0.5 bg-white/50 w-full" />
                        <div className="h-0.5 bg-white/50 w-full" />
                      </div>
                      <span className="text-[10px] font-bold tracking-widest bg-black/40 px-2 py-1 rounded">
                        {card.status.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="text-center my-4">
                      <div className="font-mono text-3xl font-bold tracking-widest text-white/90">
                        SCORE: {card.score}<span className="text-xl text-white/50">/100</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-end">
                      <div className="font-mono text-sm text-white/70">ID: {card.id}</div>
                      <div className="font-mono text-sm text-white/70">VALID: {card.valid}</div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="absolute -bottom-8 flex gap-3">
            {CARDS.map((_, idx) => (
              <div key={idx} className={`w-2 h-2 rounded-full ${idx === activeIndex ? 'bg-primary' : 'bg-white/20'}`} />
            ))}
          </div>
        </div>

        {/* Expanded Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="w-full max-w-4xl overflow-hidden rounded-xl border border-white/10 bg-[#0f0f19]/85 backdrop-blur-xl shadow-2xl"
            >
              <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Section 1: Gauge */}
                <div className="flex flex-col items-center justify-center p-6 bg-white/5 rounded-lg border border-white/5">
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-6">Overall Assessment</h3>
                  <GaugeArc score={MOCK_DATA.overall_score} />
                  <div className="mt-4 px-3 py-1 bg-amber-500/10 text-amber-500 text-sm font-semibold rounded-full border border-amber-500/20">
                    {MOCK_DATA.rating_band}
                  </div>
                </div>

                {/* Section 2: Pillar Breakdown */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Pillar Breakdown</h3>
                  {MOCK_DATA.pillars.map((pillar) => {
                    let color = "bg-red-500";
                    if (pillar.score >= 60) color = "bg-amber-500";
                    if (pillar.score >= 75) color = "bg-emerald-500";

                    return (
                      <div key={pillar.name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-white/80">{pillar.name}</span>
                          <span className="font-mono font-bold">{pillar.score}</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            className={`h-full ${color}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pillar.score}%` }}
                            transition={{ duration: 1, delay: 0.2 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Section 3: Alerts & Insights */}
                <div className="space-y-4">
                  {MOCK_DATA.flags.consistency_alert && (
                    <div className="p-4 rounded-lg bg-red-950/30 border border-red-500/30 flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                      <div>
                        <div className="text-sm font-semibold text-red-400">Consistency Alert</div>
                        <div className="text-xs text-white/60 mt-1">{MOCK_DATA.flags.detail}</div>
                      </div>
                    </div>
                  )}
                  
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/50">Confidence Level</span>
                      <span className="text-sm font-semibold text-amber-400">{MOCK_DATA.confidence.level}</span>
                    </div>
                    <div className="text-xs text-white/70">Raise by: {MOCK_DATA.confidence.raise_by}</div>
                  </div>

                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/50">Sustainable EMI</span>
                      <span className="text-sm font-semibold text-emerald-400">₹{MOCK_DATA.repayment.sustainable_emi.toLocaleString()}/mo</span>
                    </div>
                    <div className="text-xs text-white/70">{MOCK_DATA.repayment.basis}</div>
                  </div>
                </div>

                {/* Section 4: Forecast Chart */}
                <div className="p-6 bg-white/5 rounded-lg border border-white/5 flex flex-col">
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">6-Month Projection</h3>
                  <div className="flex-1 min-h-[150px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={MOCK_DATA.forecast}>
                        <defs>
                          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                        <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(15,15,25,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                          itemStyle={{ color: '#10b981' }}
                        />
                        <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
