// The per-account allowance cards are rendered on two pages: the Usage page
// owns them, and the Dashboard repeats them above the traffic panel. Keeping
// one implementation here is what stops the two from drifting apart -- the
// quota window order, the account name trimming and the reset formatting are
// all facts about the router's reports, not about either page.
import type { Ref } from "react";
import { ArrowUpRight, CircleAlert, Coins, Gauge } from "lucide-react";
import { Badge, Button, EmptyState, PanelSkeleton, SkeletonBlock } from "../components";
import { compactNumber, formatDateTime, metricValue, remainingPercent } from "../lib";
import type { RouterControlApi, UsageMetric } from "../types";

// Only the fields the cards need, so any source list with this shape can feed
// them without importing the Usage page's full source record.
export interface AccountAllowanceSource {
  id: string;
  kind: "aggregate" | "subscription" | "provider";
  name: string;
  metrics: UsageMetric[];
  lastUsedAt?: string | null;
  dashboardUrl?: string;
  // The router's report state for this connection: "available" when the rows
  // above came back from the account, "unavailable" when the account's own
  // usage API failed, and the states that never produce a card at all
  // ("local-only", "not-configured", "disabled").
  accountStatus?: string;
  // Why the account report failed, and what this router measured for the same
  // account on its own. Both are only read when the report produced no rows.
  message?: string;
  last24hTokens?: number | null;
}

export interface AccountAllowanceRow {
  id: string;
  source: AccountAllowanceSource;
  metric: UsageMetric;
}

// One card per connected account: its quota windows top to bottom, then any
// balances, with the plan named once underneath. Splitting an account across a
// card per window made the same plan repeat and put two windows of one account
// in different columns of the grid.
export interface AccountAllowanceCard {
  id: string;
  source: AccountAllowanceSource;
  windows: AccountAllowanceRow[];
  balances: AccountAllowanceRow[];
  plan?: string;
  // Set when the account is connected but its own usage report failed. The card
  // keeps its seat in the grid and names the failure, because dropping it is
  // what makes a failed request read as an account that disappeared.
  failure?: string;
}

// The order windows are listed in, top to bottom, for every account. A window
// the router does not recognise keeps its reported position after these.
const WINDOW_ORDER = ["5-hour limit", "Weekly limit", "Monthly limit"];

function windowRank(metric: UsageMetric): number {
  const index = WINDOW_ORDER.indexOf(metric.label || "");
  return index === -1 ? WINDOW_ORDER.length : index;
}

function compositeRemaining(rows: AccountAllowanceRow[]): number | null {
  const values = rows
    .map((row) => remainingPercent(row.metric))
    .filter((value): value is number => value !== null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function recencyValue(value?: string | null): number {
  const at = Date.parse(value ?? "");
  return Number.isFinite(at) ? at : -1;
}

// "ChatGPT account · OpenAI + router fallback" is a data label, not a title:
// the card header names the account and the rest of the string is not a fact
// about the quota.
export function accountName(name: string): string {
  const [head] = name.split(" · ");
  return head?.trim() || name;
}

// The active source's card leads, then the rest by most recent use. Headroom
// breaks a tie, and accounts the router has never seen keep their reported
// order at the end.
export function buildAccountAllowanceCards(
  sources: AccountAllowanceSource[],
  activeSourceId?: string,
): AccountAllowanceCard[] {
  const candidates = activeSourceId
    ? [
        ...sources.filter((entry) => entry.id === activeSourceId && entry.kind !== "aggregate"),
        ...sources.filter((entry) => entry.id !== activeSourceId && entry.kind !== "aggregate"),
      ]
    : sources.filter((entry) => entry.kind !== "aggregate");
  const cards: AccountAllowanceCard[] = [];
  for (const entry of candidates) {
    const rows = entry.metrics.map((metric, index) => ({
      id: `${entry.id}-${metric.label || metric.kind}-${index}`,
      source: entry,
      metric,
    }));
    const windows = rows
      .filter((row) => row.metric.kind !== "balance")
      .sort((left, right) => windowRank(left.metric) - windowRank(right.metric));
    const balances = rows.filter((row) => row.metric.kind === "balance");
    // A connected account stays in the row even when its usage report fails:
    // one provider's own API answering 503 is a fact about that refresh, not a
    // reason to redraw the section as though the account were gone.
    const failure = !windows.length && !balances.length && entry.accountStatus === "unavailable"
      ? entry.message?.trim() || "The account usage report failed."
      : undefined;
    if (!windows.length && !balances.length && !failure) continue;
    // A plan belongs to the account rather than to one window, so it is lifted
    // out of the rows and named once beneath them. A single window still names
    // it once, under the row rather than inside it.
    const shared = windows[0]?.metric.detail;
    cards.push({
      id: entry.id,
      source: entry,
      windows,
      balances,
      plan: shared && windows.every((row) => row.metric.detail === shared)
        ? shared
        : undefined,
      failure,
    });
  }
  return cards
    .map((card, index) => ({
      card,
      index,
      usedAt: recencyValue(card.source.lastUsedAt),
      composite: compositeRemaining(card.windows.length ? card.windows : card.balances),
    }))
    .sort((left, right) => {
      if (left.usedAt !== right.usedAt) return right.usedAt - left.usedAt;
      if (left.composite === null || right.composite === null) {
        if (left.composite === right.composite) return left.index - right.index;
        return left.composite === null ? 1 : -1;
      }
      return right.composite - left.composite || left.index - right.index;
    })
    .map((entry) => entry.card);
}

export function AccountAllowanceList({
  cards,
  api,
  pending,
  emptyBody,
  focusedCardId,
  focusedRowId,
  rowRefId,
  rowRef,
}: {
  cards: AccountAllowanceCard[];
  api?: RouterControlApi;
  pending: boolean;
  emptyBody?: string;
  focusedCardId?: string;
  focusedRowId?: string;
  rowRefId?: string;
  rowRef?: Ref<HTMLDivElement>;
}) {
  if (!cards.length) {
    return pending
      ? <PanelSkeleton label="Loading account allowances" count={2} />
      : (
        <EmptyState
          icon={<Gauge size={20} />}
          title="No account meter available"
          body={emptyBody || "Local traffic remains available without estimating a quota."}
        />
      );
  }
  return (
    <div className="us-metric-stack">
      {cards.map((card) => (
        <article
          key={card.id}
          aria-label={card.source.name}
          className={`us-provider-card${focusedCardId && card.id === focusedCardId ? " is-navigation-focus" : ""}`}
        >
          <header className="us-provider-head">
            <span className="us-provider-name">{accountName(card.source.name)}</span>
            {/* The plan names the account, not a window or the footer, so it
                reads next to the account name. */}
            {card.plan ? <span className="us-provider-plan">{card.plan}</span> : null}
          </header>
          {card.windows.map((row) => (
            <MetricRow
              key={row.id}
              account={accountName(card.source.name)}
              metric={row.metric}
              showDetail={!card.plan}
              rowRef={row.id === rowRefId ? rowRef : undefined}
              navigationFocused={Boolean(focusedRowId) && row.id === focusedRowId}
            />
          ))}
          {card.balances.map((row) => (
            <MetricRow
              key={row.id}
              account={accountName(card.source.name)}
              metric={row.metric}
              showDetail
              rowRef={row.id === rowRefId ? rowRef : undefined}
              navigationFocused={Boolean(focusedRowId) && row.id === focusedRowId}
            />
          ))}
          {/* The account is connected and its card keeps its column, so the
              failed read is stated here rather than left as an empty card. */}
          {card.failure ? (
            <div
              role="group"
              aria-label={`${accountName(card.source.name)}, usage unavailable. ${card.failure}`}
              className="us-quota-row is-unavailable"
            >
              <div className="us-quota-head">
                <CircleAlert aria-hidden size={15} strokeWidth={1.7} />
                <strong>Usage unavailable</strong>
                <Badge tone="warning">Auto-retry</Badge>
              </div>
              <p className="us-quota-note is-detail">{card.failure}</p>
              {measuredTrafficNote(card.source.last24hTokens)}
            </div>
          ) : null}
          {card.source.dashboardUrl ? (
            <div className="us-provider-foot">
              {/* Each account's console link belongs to that account's card,
                  not to a list under the grid: the row a link opens is a claim
                  about that one connection. */}
              <Button
                variant="ghost"
                disabled={!api}
                onClick={() => api && void api.openExternal(card.source.dashboardUrl!)}
              >
                {accountName(card.source.name)} dashboard
                <ArrowUpRight aria-hidden size={13} strokeWidth={1.7} />
              </Button>
            </div>
          ) : null}
        </article>
      ))}
      {pending ? <SkeletonBlock className="us-loading-metric" /> : null}
    </div>
  );
}

// The router has this account's traffic in its own ledger even when the
// account's usage API cannot answer, so a failed card still names what the
// router measured for it.
function measuredTrafficNote(tokens: number | null | undefined) {
  const value = Number(tokens);
  if (!Number.isFinite(value) || value <= 0) return null;
  return (
    <p className="us-quota-note">
      {`Router traffic for the last 24 hours: ${compactNumber(value)} tokens`}
    </p>
  );
}

function MetricRow({ account, metric, showDetail, rowRef, navigationFocused = false }: {
  account: string;
  metric: UsageMetric;
  showDetail: boolean;
  rowRef?: Ref<HTMLDivElement>;
  navigationFocused?: boolean;
}) {
  const remaining = remainingPercent(metric);
  const tone = remaining !== null && remaining < 15
    ? "danger"
    : remaining !== null && remaining < 35
      ? "warning"
      : "neutral";
  const reset = metricResetAt(metric);
  const label = metric.label || (metric.kind === "balance" ? "Balance" : "Usage limit");
  const resetLabel = reset !== undefined
    ? `Resets ${formatDateTime(reset)} (${resetCountdown(reset)})`
    : "No reset reported";
  return (
    <div
      ref={rowRef}
      tabIndex={rowRef ? -1 : undefined}
      role="group"
      aria-label={`${account}, ${label}, ${metricValue(metric)}. ${resetLabel}`}
      className={`us-quota-row${navigationFocused ? " is-navigation-focus" : ""}`}
    >
      <div className="us-quota-head">
        {metric.kind === "balance"
          ? <Coins aria-hidden size={15} strokeWidth={1.7} />
          : <Gauge aria-hidden size={15} strokeWidth={1.7} />}
        <strong>{label}</strong>
        <Badge tone={tone}>{metricValue(metric)}</Badge>
      </div>
      {remaining !== null ? (
        <progress
          className={`us-quota-progress tone-${tone}`}
          max="100"
          value={remaining}
          aria-label={`${metric.label || "Quota"}: ${Math.round(remaining)} percent remaining`}
        />
      ) : null}
      {showDetail && metric.detail ? <p className="us-quota-note is-detail">{metric.detail}</p> : null}
      <p className="us-quota-note">
        {reset !== undefined ? (
          <time dateTime={dateTimeValue(reset)}>
            {resetLabel}
          </time>
        ) : "No reset reported"}
      </p>
    </div>
  );
}

export function metricResetAt(metric: UsageMetric): number | undefined {
  const reset = metric.resetAt ?? metric.resetsAt;
  return Number.isFinite(reset) ? reset : undefined;
}

function resetCountdown(value: number | string): string {
  const numeric = Number(value);
  const timestamp = Number.isFinite(numeric)
    ? (numeric < 10_000_000_000 ? numeric * 1_000 : numeric)
    : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "time unavailable";
  const remaining = timestamp - Date.now();
  if (remaining <= 0) return "refresh due";
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `in ${days}d ${hours % 24}h`;
}

function dateTimeValue(value: number | string): string {
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 10_000_000_000 ? numeric * 1_000 : numeric)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
