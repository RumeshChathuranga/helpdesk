import { useQuery } from "@tanstack/react-query";
import { fetchDashboardStats, ticketKeys } from "@/lib/tickets";

export function useDashboardStats() {
  return useQuery({
    queryKey: ticketKeys.stats,
    queryFn: fetchDashboardStats,
  });
}
