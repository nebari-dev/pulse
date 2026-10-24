import type { ReactNode } from 'react';
import { REPO_URL } from '@/components/Header';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSummary } from '@/hooks/useSummary';
import { formatDate } from '@/lib/format';
import { SOURCE_LABEL, type Source, type Summary } from '@/lib/summary';

interface Row {
  name: string;
  counts: ReactNode;
  history: ReactNode;
  /** Download sources only: when the data begins, from summary.json. */
  source?: Source;
}

const DOWNLOADS: Row[] = [
  {
    name: SOURCE_LABEL.quay,
    source: 'quay',
    counts:
      'Pulls of each image and OCI Helm chart under quay.io/nebari. Charts are told apart by /charts/ in the path.',
    history:
      'Quay keeps about 90 days; Pulse keeps every day it has seen since.',
  },
  {
    name: SOURCE_LABEL.pypi,
    source: 'pypi',
    counts:
      'Package downloads from PyPI, via pypistats, mirrors excluded. Also the Python version and operating system the installer reported.',
    history:
      'pypistats keeps about 180 days. A day appears once it is complete, so PyPI runs a day behind.',
  },
  {
    name: SOURCE_LABEL.conda,
    source: 'conda',
    counts:
      'Downloads of each package file on anaconda.org. The upstream number is a running total; Pulse snapshots it daily and counts the change.',
    history:
      'Only from the first snapshot on: counts before Pulse started are in the upstream total, not in the daily numbers.',
  },
  {
    name: SOURCE_LABEL.github_releases,
    source: 'github_releases',
    counts:
      'Downloads of each release asset (binaries, archives). A running total like conda-forge, snapshotted daily.',
    history: 'Only from the first snapshot on, as for conda-forge.',
  },
];

const REPOS: Row[] = [
  {
    name: 'Repo health',
    counts:
      'Stars, forks, watchers, open issues and pull requests, and pull requests merged and issues opened or closed in the last 30 days.',
    history:
      'A snapshot per day from when Pulse started. A value GitHub did not return shows as a dash, not zero.',
  },
  {
    name: 'Releases',
    counts: 'Every GitHub release: tag, publish date, prerelease or not.',
    history: 'Complete, from GitHub.',
  },
  {
    name: 'Stars',
    counts: 'Total stars over time.',
    history:
      "Back to each repo's first star, from each star's timestamp. Stars later removed are not in the history.",
  },
  {
    name: 'Contributors',
    counts:
      "Commit authors on each repo's default branch, by GitHub login or email; bots excluded.",
    history: 'Complete history of the default branch.',
  },
  {
    name: 'Traffic',
    counts:
      'Page views and git clones, total and unique per day. Clones include CI checkouts and mirrors.',
    history:
      'GitHub keeps 14 days; Pulse keeps every day since. Needs push access to the repo, so some repos have none.',
  },
];

const DOCS: Row[] = [
  {
    name: 'Visits and page views',
    counts:
      'HTML page views to browsers on each documentation site, at the Cloudflare edge, so cookie consent and ad blockers do not hide them. A visit is a page view not preceded by another from the same visitor in 30 minutes. Bots excluded.',
    history: 'Daily; the last 30 days are refetched each run.',
  },
  {
    name: 'Top pages',
    counts: 'Page views per path over the last 7 days, top 200 per site.',
    history: 'Only the latest snapshot is shown.',
  },
];

const READING: Array<[string, ReactNode]> = [
  [
    'Missing is not zero',
    "A dashed line on a chart marks where a source's data begins. Before it, that source was not collected, so its band is missing rather than empty.",
  ],
  [
    'Incomplete days',
    'The shaded tail of a chart covers days not every source has reported yet (PyPI runs a day behind), and weeks that have not ended. They read low until the next collection.',
  ],
  [
    'Spike days',
    'Yellow dots mark days more than three standard deviations above the trailing four-week average, at least three times that average and at least 50. Usually CI loops or mirrors. They stay in the totals.',
  ],
  [
    'Helm charts',
    'Chart pulls are mostly GitOps controllers re-fetching on a timer, not installs, so the Downloads page starts with them unchecked.',
  ],
  [
    'Changes vs. previous period',
    'A tile compares the period with the one before it, and shows no change until a full previous period has been collected.',
  ],
];

/** The first date each download source has data for. */
function countsFrom(summary: Summary): Partial<Record<Source, string>> {
  const from: Partial<Record<Source, string>> = {};
  for (const p of summary.products) {
    for (const g of p.groups) {
      const first = g.series[0]?.date;
      const prev = from[g.source];
      if (first && (!prev || first < prev)) from[g.source] = first;
    }
  }
  return from;
}

function SourceTable({
  title,
  rows,
  from,
}: {
  title: string;
  rows: Row[];
  from?: Partial<Record<Source, string>>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table aria-label={title}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Source</TableHead>
              <TableHead>What it counts</TableHead>
              <TableHead>History</TableHead>
              {from && <TableHead className="w-36">Data from</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.name}>
                <TableCell className="align-top font-medium">
                  {r.name}
                </TableCell>
                <TableCell className="whitespace-normal align-top">
                  {r.counts}
                </TableCell>
                <TableCell className="whitespace-normal align-top text-muted-foreground">
                  {r.history}
                </TableCell>
                {from && (
                  <TableCell className="align-top tabular-nums">
                    {r.source && from[r.source]
                      ? formatDate(from[r.source] as string, true)
                      : '—'}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * Where every number on the dashboard comes from and how to read the charts.
 * Linked from the header and from every chart's info popover.
 */
function Sources() {
  const { data } = useSummary();
  const from = data ? countsFrom(data) : {};
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Data sources"
        description="Where every number comes from, how much history each source has, and how to read the charts. Pulse collects once a day at 06:20 UTC; all dates are UTC."
      />

      <Card>
        <CardHeader>
          <CardTitle>Reading the charts</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[12rem_1fr]">
            {READING.map(([term, text]) => (
              <div key={term} className="contents">
                <dt className="font-medium">{term}</dt>
                <dd className="text-muted-foreground">{text}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <SourceTable title="Downloads" rows={DOWNLOADS} from={from} />
      <SourceTable title="GitHub repositories" rows={REPOS} />
      <SourceTable title="Documentation sites" rows={DOCS} />

      <p className="text-muted-foreground text-sm">
        Only public data is collected. History that upstream keeps for a limited
        time exists here only because Pulse snapshots it daily. The collector
        and the raw data are{' '}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          on GitHub
        </a>
        .
      </p>
    </div>
  );
}

export default Sources;
