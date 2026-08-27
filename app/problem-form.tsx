"use client";

import { FormEvent, useState } from "react";

export function ProblemForm() {
  const [problem, setProblem] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ problem }),
    });
    setStatus(response.ok ? "sent" : "error");
    if (response.ok) setProblem("");
  }

  return <form className="problem-form" onSubmit={submit}>
    <label htmlFor="problem">What problem are you trying to solve?</label>
    <textarea id="problem" name="problem" value={problem} onChange={(event) => setProblem(event.target.value)} minLength={20} maxLength={1200} required placeholder="Describe the work that keeps being harder than it should be." />
    <div><button type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending…" : "Send anonymously"}</button><p aria-live="polite">{status === "sent" ? "Received. Wally will treat it as a lead, not proof." : status === "error" ? "That did not go through. Please try again." : "No name, email, account, cookies, or tracking. Entries are deleted after 90 days."}</p></div>
  </form>;
}
