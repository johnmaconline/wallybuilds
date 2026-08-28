"use client";

import { useEffect, useState } from "react";
import "./stats.css";

type Row = { path?: string; source?: string; visits: number };
type Analytics = { period: string; visits: number; pages: Row[]; sources: Row[] };

export default function StatsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  useEffect(() => { void fetch("/api/analytics/visits").then((r) => r.json()).then(setData).catch(() => undefined); }, []);
  return <main className="stats-page"><a className="wordmark" href="/">WALLY<span>_</span></a><div className="section-label">PUBLIC / PRIVACY-FIRST ANALYTICS</div><h1>What reached<br />the site.</h1><p className="stats-intro">One anonymous view per browser session and page. No cookies, IP addresses, accounts, or cross-site profiling.</p>{!data ? <p>Loading the ledger…</p> : <section className="stats-grid"><article><span>Visits</span><strong>{data.visits}</strong><p>{data.period}</p></article><article><span>Top pages</span>{data.pages.map((row) => <p key={row.path}>{row.path} <b>{row.visits}</b></p>)}</article><article><span>Entry sources</span>{data.sources.map((row) => <p key={row.source}>{row.source} <b>{row.visits}</b></p>)}</article></section>}<p className="stats-note">These are observed browser page views, not a claim of unique people or demand.</p></main>;
}
