import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// On-time delivery export — GET /deliveries/export?from=YYYY-MM-DD&to=YYYY-MM-DD&grace=15
//
// Returns a CSV (opens directly in Excel) with one row per completed delivery,
// comparing when the driver actually completed the stop against the stop's
// scheduled arrival time.
//
// Security: this lives under the (ops) route group, so proxy.ts already
// requires a signed-in user with a staff_access row before this ever runs —
// same boundary as every other ops page that reads via the admin client.
//
// Time zone: all dates/times are Eastern (America/New_York), matching the
// rest of the app — Routed only operates in the Marietta/Cobb County area.
//
// Scheduled time: uses the snapshot saved on the delivery when it was
// completed (migration 0007). Deliveries captured before that migration have
// no snapshot, so they fall back to the stop's CURRENT scheduled time, and
// the "Schedule Source" column says so.

const TZ = "America/New_York";
const PAGE_SIZE = 1000;

type ExportRow = {
  id: string;
  delivered_at: string | null;
  scheduled_time: string | null;
  driver_name: string | null;
  po_number: string | null;
  bol_number: string | null;
  photo_url: string | null;
  signature_url: string | null;
  route_stops: { store_name: string | null; address: string | null; sequence_order: number | null; scheduled_time: string | null } | null;
  routes: { name: string | null; client_name: string | null } | null;
  vehicles: { name: string | null } | null;
};

type EasternParts = { date: string; minutes: number; display: string };

const easternFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function toEastern(iso: string): EasternParts {
  const parts = easternFormatter.formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + minute,
    display: formatClock(hour, minute),
  };
}

function formatClock(hour: number, minute: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

// "HH:MM:SS" (Postgres time) -> minutes since midnight, or null.
function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isIsoDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function shiftDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Quote a CSV cell. Text cells that start with a formula character get a
// leading apostrophe so Excel shows them as text instead of running them
// (a PO number like "=HYPERLINK(...)" typed by a driver can't execute).
function csvText(value: string | null | undefined): string {
  let v = value ?? "";
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

function csvNumber(value: number | null): string {
  return value === null ? "" : String(value);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const today = toEastern(new Date().toISOString()).date;
  const toParam = params.get("to");
  const fromParam = params.get("from");
  let to = isIsoDate(toParam) ? toParam : today;
  let from = isIsoDate(fromParam) ? fromParam : shiftDate(to, -29);
  if (from > to) [from, to] = [to, from];

  const graceRaw = Number(params.get("grace"));
  const grace = Number.isFinite(graceRaw) && graceRaw >= 0 && graceRaw <= 240 ? Math.round(graceRaw) : 15;

  // Pull a slightly wider UTC window than asked for, then filter exactly on
  // the Eastern calendar date below — avoids hand-rolling DST offset math.
  const windowStart = `${shiftDate(from, -1)}T00:00:00Z`;
  const windowEnd = `${shiftDate(to, 2)}T00:00:00Z`;

  const supabase = createAdminClient();
  const rows: ExportRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("deliveries")
      .select(
        "id, delivered_at, scheduled_time, driver_name, po_number, bol_number, photo_url, signature_url, route_stops(store_name, address, sequence_order, scheduled_time), routes(name, client_name), vehicles(name)"
      )
      .eq("status", "delivered")
      .gte("delivered_at", windowStart)
      .lt("delivered_at", windowEnd)
      .order("delivered_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      return new Response(`Couldn't export deliveries: ${error.message}`, { status: 500 });
    }

    const page = (data ?? []) as unknown as ExportRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const header = [
    "Delivery Date",
    "Route",
    "Client",
    "Stop #",
    "Store",
    "Address",
    "Vehicle",
    "Driver",
    "PO Number",
    "BOL Number",
    "Scheduled Time",
    "Completed Time",
    "Minutes Late (negative = early)",
    `Result (grace ${grace} min)`,
    "Schedule Source",
    "Photo on File",
    "Signature on File",
    "Delivery ID",
  ];

  const lines: string[] = [header.map(csvText).join(",")];

  for (const r of rows) {
    if (!r.delivered_at) continue;
    const actual = toEastern(r.delivered_at);
    if (actual.date < from || actual.date > to) continue;

    const snapshotMinutes = timeToMinutes(r.scheduled_time);
    const currentMinutes = timeToMinutes(r.route_stops?.scheduled_time);
    const scheduledMinutes = snapshotMinutes ?? currentMinutes;

    let source = "No scheduled time set";
    if (snapshotMinutes !== null) source = "Captured at delivery";
    else if (currentMinutes !== null) source = "Stop's current schedule (delivery predates snapshot)";

    let minutesLate: number | null = null;
    let result = "No Schedule";
    let scheduledDisplay = "";
    if (scheduledMinutes !== null) {
      minutesLate = actual.minutes - scheduledMinutes;
      result = minutesLate > grace ? "Late" : "On Time";
      scheduledDisplay = formatClock(Math.floor(scheduledMinutes / 60), scheduledMinutes % 60);
    }

    lines.push(
      [
        csvText(actual.date),
        csvText(r.routes?.name),
        csvText(r.routes?.client_name),
        csvNumber(r.route_stops?.sequence_order ?? null),
        csvText(r.route_stops?.store_name),
        csvText(r.route_stops?.address),
        csvText(r.vehicles?.name),
        csvText(r.driver_name),
        csvText(r.po_number),
        csvText(r.bol_number),
        csvText(scheduledDisplay),
        csvText(actual.display),
        csvNumber(minutesLate),
        csvText(result),
        csvText(source),
        csvText(r.photo_url ? "Yes" : "No"),
        csvText(r.signature_url ? "Yes" : "No"),
        csvText(r.id),
      ].join(",")
    );
  }

  // Leading BOM so Excel reads the file as UTF-8; CRLF line endings for Excel.
  const body = "﻿" + lines.join("\r\n") + "\r\n";
  const filename = `routed-deliveries_${from}_to_${to}.csv`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
