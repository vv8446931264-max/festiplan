/** Cloud Logging severities FestiPlan emits. */
export type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

type Scalar = string | number | boolean | undefined;

/**
 * One structured log event. Only operational metadata belongs here — never user text
 * (briefs, questions, cities, titles), edit keys or plan contents.
 */
export type LogFields = {
  severity: Severity;
  message: string;
  route?: string;
  method?: string;
  status?: number;
  latencyMs?: number;
  requestId?: string;
  [extra: string]: Scalar;
};

const MAX_VALUE = 200;

function clamp(value: Scalar): Scalar {
  return typeof value === "string" && value.length > MAX_VALUE ? value.slice(0, MAX_VALUE) : value;
}

/** Builds the Cloud Logging JSON payload (severity, message, httpRequest, extras). */
export function formatLog(fields: LogFields, now: Date = new Date()): string {
  const { severity, message, route, method, status, latencyMs, requestId, ...rest } = fields;
  const extras = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, clamp(v)]));
  const httpRequest =
    route !== undefined || status !== undefined
      ? {
          requestMethod: method,
          requestUrl: route,
          status,
          latency: latencyMs === undefined ? undefined : `${(latencyMs / 1000).toFixed(3)}s`,
        }
      : undefined;
  return JSON.stringify({
    severity,
    message: clamp(message),
    time: now.toISOString(),
    httpRequest,
    requestId,
    latencyMs,
    ...extras,
  });
}

/**
 * Writes one JSON line to stdout, which Cloud Run forwards to Cloud Logging.
 * Silent under `NODE_ENV=test` unless a sink is passed.
 */
export function logEvent(fields: LogFields, sink?: (line: string) => void): void {
  if (!sink && process.env.NODE_ENV === "test") return;
  const line = formatLog(fields);
  if (sink) sink(line);
  else process.stdout.write(`${line}\n`);
}
