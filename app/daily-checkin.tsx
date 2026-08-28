"use client";

import { useEffect, useState } from "react";

const slug = "2026-08-28-10-minute-self-check-for-daily-tasks";
function record(eventType: "tool_opened" | "checkin_started" | "checkin_completed") {
  return fetch("/api/experiments/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, eventType }) }).catch(() => undefined);
}
export function DailyCheckin() {
  const [tasks, setTasks] = useState(["", "", "", "", ""]);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { void record("tool_opened"); }, []);
  const completed = tasks.filter(Boolean).length;
  function update(index: number, value: string) { if (!started) { setStarted(true); void record("checkin_started"); } const next = [...tasks]; next[index] = value; setTasks(next); }
  function finish() { if (completed === 5 && !done) { setDone(true); void record("checkin_completed"); } }
  return <section className="checkin-page"><a href="/">← Wally Builds</a><div className="section-label">LIVE TEST / NO LOGIN / NO SAVED TASKS</div><h1>A 10-minute<br />founder check-in.</h1><p>Write five small tasks. Nothing you type leaves this page. Wally only records anonymous aggregate use of the tool.</p><div className="checkin-progress"><span style={{ width: `${completed * 20}%` }} /></div><div className="checkin-count">{completed} / 5 tasks named</div>{tasks.map((task, index) => <label className="task-input" key={index}><span>{String(index + 1).padStart(2, "0")}</span><input value={task} onChange={(event) => update(index, event.target.value)} placeholder="A task you can finish today" /></label>)}<button className="checkin-finish" disabled={completed !== 5 || done} onClick={finish}>{done ? "Check-in recorded" : "Finish check-in"}</button><p className="checkin-note">This is an early live test, not proof of demand. Wally reads aggregate opens, starts, and completions—never task text or identity.</p></section>;
}
