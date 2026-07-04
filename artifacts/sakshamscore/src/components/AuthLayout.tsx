import type { ReactNode } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";

// Fluid "aurora" gradient for the decorative left panel — layered radial
// blobs over near-black, echoing the vibrant card textures used elsewhere
// in the app (Dashboard carousel).
const auroraStyle = {
  backgroundColor: "#0a0812",
  backgroundImage: [
    "radial-gradient(120% 80% at 15% 20%, rgba(139,92,246,0.55) 0%, transparent 50%)",
    "radial-gradient(100% 70% at 72% 30%, rgba(59,130,246,0.45) 0%, transparent 55%)",
    "radial-gradient(90% 60% at 88% 28%, rgba(249,115,22,0.40) 0%, transparent 50%)",
    "radial-gradient(120% 90% at 35% 88%, rgba(236,72,153,0.42) 0%, transparent 55%)",
    "radial-gradient(80% 60% at 60% 62%, rgba(16,185,129,0.22) 0%, transparent 55%)",
  ].join(", "),
} as const;

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full grid md:grid-cols-2 bg-background">
      {/* Decorative panel — full-height, edge to edge */}
      <div
        className="relative hidden md:flex flex-col justify-between p-12 overflow-hidden"
        style={auroraStyle}
      >
        {/* darken bottom for tagline legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />

        <Link
          href="/"
          className="relative z-10 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-black/60 transition-colors"
          aria-label="Home"
        >
          <Activity className="w-6 h-6 text-primary" />
        </Link>

        <h2 className="relative z-10 font-bebas text-6xl lg:text-7xl leading-[0.9] tracking-wide text-white">
          Empowering
          <br />
          <span className="text-white/80">India&apos;s</span>{" "}
          <span className="text-primary">MSMEs</span>
        </h2>
      </div>

      {/* Form panel — full-height, centered content */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex items-center justify-center p-6 md:p-10 overflow-y-auto"
      >
        <div className="w-full max-w-sm">{children}</div>
      </motion.div>
    </div>
  );
}
