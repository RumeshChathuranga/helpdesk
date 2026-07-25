-- Fix get_dashboard_stats(): the chart-data series counted ALL tickets
-- (including NEW/PROCESSING), while the stat cards' totalTickets excludes
-- them — the two disagreed for the same time period. Also replace
-- CURRENT_DATE (follows the DB session's TimeZone GUC) with an explicit
-- UTC boundary, since Ticket.createdAt is a timezone-less column that
-- Prisma always writes in UTC.
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json AS $$
DECLARE
  v_total_tickets int;
  v_open_tickets int;
  v_resolved_tickets int;
  v_ai_resolved_count int;
  v_ai_resolved_pct int;
  v_chart_data json;
BEGIN
  -- 1. Visible tickets (status not in NEW, PROCESSING)
  SELECT COUNT(*)::int INTO v_total_tickets
  FROM "Ticket"
  WHERE "status" NOT IN ('NEW', 'PROCESSING');

  -- 2. Open tickets
  SELECT COUNT(*)::int INTO v_open_tickets
  FROM "Ticket"
  WHERE "status" = 'OPEN';

  -- 3. Resolved tickets
  SELECT COUNT(*)::int INTO v_resolved_tickets
  FROM "Ticket"
  WHERE "status" = 'RESOLVED';

  -- 4. AI Resolved tickets (RESOLVED + at least one AI reply)
  SELECT COUNT(*)::int INTO v_ai_resolved_count
  FROM "Ticket" t
  WHERE t."status" = 'RESOLVED'
    AND EXISTS (
      SELECT 1 FROM "Reply" r
      WHERE r."ticketId" = t.id AND r."isAi" = true
    );

  -- 5. AI Success Rate Percentage
  IF v_resolved_tickets > 0 THEN
    v_ai_resolved_pct := ROUND((v_ai_resolved_count::float / v_resolved_tickets::float) * 100);
  ELSE
    v_ai_resolved_pct := 0;
  END IF;

  -- 6. Chart data: last 30 UTC days, counting only agent-visible tickets
  -- (matches v_total_tickets). Status filter lives in the JOIN's ON clause,
  -- not WHERE, so a day with zero visible tickets still appears as count: 0.
  SELECT json_agg(row_to_json(d)) INTO v_chart_data
  FROM (
    SELECT
      to_char(g.day, 'YYYY-MM-DD') as "date",
      COALESCE(COUNT(t.id), 0)::int as "count"
    FROM generate_series(
      DATE_TRUNC('day', now() AT TIME ZONE 'UTC') - INTERVAL '29 days',
      DATE_TRUNC('day', now() AT TIME ZONE 'UTC'),
      '1 day'::interval
    ) AS g(day)
    LEFT JOIN "Ticket" t
      ON DATE_TRUNC('day', t."createdAt") = g.day
      AND t."status" NOT IN ('NEW', 'PROCESSING')
    GROUP BY g.day
    ORDER BY g.day ASC
  ) d;

  -- Return everything as a JSON object
  RETURN json_build_object(
    'totalTickets', v_total_tickets,
    'openTickets', v_open_tickets,
    'resolvedTickets', v_resolved_tickets,
    'aiResolvedCount', v_ai_resolved_count,
    'aiResolvedPct', v_ai_resolved_pct,
    'chartData', COALESCE(v_chart_data, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql;
