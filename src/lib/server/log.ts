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

/** Longest string value written to a log line; longer values are cut. */
const MAX_VALUE_LENGTH = 200;

function clamp(value: Scalar): Scalar {
  return typeof value === "string" && value.length > MAX_VALUE_LENGTH
    ? value.slice(0, MAX_VALUE_LENGTH)
    : value;
}

type HttpFields = Pick<LogFields, "route" | "method" | "status" | "latencyMs">;

/** Cloud Logging's `httpRequest` object for request events; undefined for anything else. */
function httpRequestOf({ route, method, status, latencyMs }: HttpFields) {
  if (route === undefined && status === undefined) return undefined;
  return {
    requestMethod: method,
    requestUrl: route,
    status,
    latency: latencyMs === undefined ? undefined : `${(latencyMs / 1000).toFixed(3)}s`,
  };
}

/** Builds the Cloud Logging JSON payload (severity, message, httpRequest, extras). */
export function formatLog(fields: LogFields, now: Date = new Date()): string {
  const { severity, message, route, method, status, latencyMs, requestId, ...rest } = fields;
  const extras = Object.fromEntries(
    Object.entries(rest).map(([key, value]) => [key, clamp(value)]),
  );
  return JSON.stringify({
    severity,
    message: clamp(message),
    time: now.toISOString(),
    httpRequest: httpRequestOf({ route, method, status, latencyMs }),
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
