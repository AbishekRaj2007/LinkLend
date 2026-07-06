import {
  useQuery,
  useQueries,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { Scorecard, MemoResponse } from "./scorecard";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as T;
}

export function useMsmeIds(): UseQueryResult<string[]> {
  return useQuery({
    queryKey: ["msmeIds"],
    queryFn: async () => {
      const data = await getJson<{ msmeIds: string[] }>("/api/msmes");
      return data.msmeIds;
    },
    staleTime: Infinity,
  });
}

export function useScorecard(
  msmeId: string | null,
): UseQueryResult<Scorecard> {
  return useQuery({
    queryKey: ["scorecard", msmeId],
    queryFn: () => getJson<Scorecard>(`/api/msmes/${msmeId}/scorecard`),
    enabled: !!msmeId,
    staleTime: Infinity,
  });
}

/** Fetch several scorecards at once (used to populate the carousel). */
export function useScorecards(
  msmeIds: string[],
): UseQueryResult<Scorecard>[] {
  return useQueries({
    queries: msmeIds.map((id) => ({
      queryKey: ["scorecard", id],
      queryFn: () => getJson<Scorecard>(`/api/msmes/${id}/scorecard`),
      staleTime: Infinity,
    })),
  });
}

export function useMemo(msmeId: string | null): UseQueryResult<MemoResponse> {
  return useQuery({
    queryKey: ["memo", msmeId],
    queryFn: () => getJson<MemoResponse>(`/api/msmes/${msmeId}/memo`),
    enabled: !!msmeId,
    staleTime: Infinity,
  });
}
