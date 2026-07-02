import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Dashboard from "./components/Dashboard";
import AssessmentView from "./components/AssessmentView";

type View = "landing" | "assess";

function App() {
  const [view, setView] = useState<View>("landing");

  return (
    <div className="min-h-[100dvh] w-full text-foreground bg-background">
      <AnimatePresence mode="wait">
        {view === "landing" ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <Dashboard onGetStarted={() => setView("assess")} />
          </motion.div>
        ) : (
          <motion.div
            key="assess"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <AssessmentView onBack={() => setView("landing")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
