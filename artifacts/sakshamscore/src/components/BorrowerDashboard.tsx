import { AlertTriangle, Loader2, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useMe,
  useLogout,
  useGetMyScorecard,
  getMeQueryKey,
} from "@workspace/api-client-react";
import { extractErrorMessage } from "../lib/errors";
import ScoreCard from "./ScoreCard";

export default function BorrowerDashboard() {
  const { data: meData } = useMe();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();
  const { data: card, isLoading, isError, error } = useGetMyScorecard();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    queryClient.removeQueries({ queryKey: getMeQueryKey() });
  };

  return (
    <div className="h-[100dvh] flex flex-col">
      <header className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div>
          <h1 className="font-bebas text-2xl tracking-wide text-white">
            {meData?.user.name ?? "My SakshamScore"}
          </h1>
          {meData?.user.msme_id && (
            <div className="text-xs font-mono text-white/40">{meData.user.msme_id}</div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors px-4 py-1.5 rounded-full border border-white/10 hover:bg-white/5"
        >
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-white/50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <div className="font-bebas text-2xl tracking-wide text-white/70">
              Loading your SakshamScore…
            </div>
          </div>
        ) : isError ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center text-white/40 px-6">
            <AlertTriangle className="w-10 h-10 text-red-500" />
            <div className="font-bebas text-3xl tracking-wide text-white/60">
              Couldn't load your scorecard
            </div>
            <div className="text-sm max-w-sm">
              {extractErrorMessage(error, "Something went wrong. Please try again.")}
            </div>
          </div>
        ) : (
          card && <ScoreCard card={card} />
        )}
      </main>
    </div>
  );
}
