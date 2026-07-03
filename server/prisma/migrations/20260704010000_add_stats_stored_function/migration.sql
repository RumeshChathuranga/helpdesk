-- Create stored function for dashboard statistics
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

  -- 6. Chart data: last 30 days daily counts
  SELECT json_agg(row_to_json(d)) INTO v_chart_data
  FROM (
    SELECT 
      to_char(g.day, 'YYYY-MM-DD') as "date",
      COALESCE(COUNT(t.id), 0)::int as "count"
    FROM generate_series(
      CURRENT_DATE - INTERVAL '29 days',
      CURRENT_DATE,
      '1 day'::interval
    ) AS g(day)
    LEFT JOIN "Ticket" t ON DATE_TRUNC('day', t."createdAt") = g.day
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
