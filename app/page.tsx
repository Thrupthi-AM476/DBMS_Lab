"use client";

import { useEffect, useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface HelpRequest {
  id: number;
  student_name: string;
  message: string;
  status: "open" | "resolved";
  created_at: string;
}

interface RequestsResponse {
  source: "Redis" | "PostgreSQL";
  requests: HelpRequest[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Home() {
  // ---- Form state ----
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // ---- Request list state ----
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [source, setSource] = useState<"Redis" | "PostgreSQL" | "">("");
  const [loadingList, setLoadingList] = useState(false);

  // ---- View counter ----
  const [views, setViews] = useState<number | null>(null);

  // ---- Resolve state ----
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  // --------------------------------------------------------------------------
  // Increment view count on mount, then fetch requests
  // --------------------------------------------------------------------------
  const fetchRequests = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/requests");
      if (!res.ok) throw new Error("Failed to fetch requests");
      const data: RequestsResponse = await res.json();
      setRequests(data.requests);
      setSource(data.source);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    // Increment view counter on every page load / refresh
    fetch("/api/views", { method: "POST" })
      .then((r) => r.json())
      .then((d) => setViews(d.count))
      .catch(() => setViews(null));

    fetchRequests();
  }, [fetchRequests]);

  // --------------------------------------------------------------------------
  // Submit a new request
  // --------------------------------------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    const trimName = name.trim();
    const trimMsg = message.trim();

    if (!trimName || !trimMsg) {
      setFormError("Both Student Name and Help Request fields are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_name: trimName, message: trimMsg }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.error ?? "Something went wrong.");
        return;
      }

      setFormSuccess(`Request #${data.id} posted successfully!`);
      setName("");
      setMessage("");
      // Refresh list — cache was just invalidated on the server
      await fetchRequests();
    } catch (err) {
      setFormError("Network error. Please try again.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  // --------------------------------------------------------------------------
  // Resolve a request (bonus)
  // --------------------------------------------------------------------------
  async function handleResolve(id: number) {
    setResolvingId(id);
    try {
      const res = await fetch(`/api/requests/${id}`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error ?? "Could not resolve request.");
        return;
      }
      // Refresh list — cache was just invalidated on the server
      await fetchRequests();
    } catch (err) {
      alert("Network error. Please try again.");
      console.error(err);
    } finally {
      setResolvingId(null);
    }
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="container">
      {/* Header */}
      <h1>🎓 Campus Help Desk Board</h1>
      <p className="srn">@PES1UG24AM476</p>

      {/* View counter */}
      <div className="views-badge">
        👁 Board views:{" "}
        {views === null ? (
          <span style={{ color: "#a0aec0" }}>N/A (Redis unavailable)</span>
        ) : (
          <strong>{views}</strong>
        )}
      </div>

      {/* Post form */}
      <div className="card">
        <h2>Post a Help Request</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="student_name">Student Name</label>
            <input
              id="student_name"
              type="text"
              placeholder="e.g. Abhi"
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-required="true"
            />
          </div>

          <div className="form-group">
            <label htmlFor="message">Help Request</label>
            <textarea
              id="message"
              rows={3}
              placeholder="e.g. How do I reset my campus Wi-Fi password?"
              maxLength={200}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-required="true"
            />
          </div>

          {formError && <p className="error-msg" role="alert">{formError}</p>}
          {formSuccess && <p className="success-msg" role="status">{formSuccess}</p>}

          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Posting…" : "Post Request"}
          </button>
        </form>
      </div>

      {/* Request list */}
      <div className="card">
        <div className="source-row">
          <h2 style={{ marginBottom: 0 }}>Latest Requests</h2>
          {source && (
            <span
              className={`source-badge ${source === "Redis" ? "redis" : "postgres"}`}
              title={`Data served from ${source}`}
            >
              {source === "Redis" ? "⚡ Redis (cached)" : "🐘 PostgreSQL"}
            </span>
          )}
        </div>

        {loadingList ? (
          <p className="empty-msg">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="empty-msg">No requests yet. Be the first to post!</p>
        ) : (
          <ul className="request-list">
            {requests.map((req) => (
              <li
                key={req.id}
                className={`request-item${req.status === "resolved" ? " resolved" : ""}`}
              >
                <div className="request-meta">
                  <span className="student-name">{req.student_name}</span>
                  <span className="request-time">{formatDate(req.created_at)}</span>
                  <span className={`status-pill ${req.status}`}>
                    {req.status}
                  </span>
                </div>
                <p className="request-message">{req.message}</p>
                {req.status === "open" && (
                  <button
                    className="btn-resolve"
                    onClick={() => handleResolve(req.id)}
                    disabled={resolvingId === req.id}
                    aria-label={`Mark request #${req.id} as resolved`}
                  >
                    {resolvingId === req.id ? "Resolving…" : "✓ Resolve"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
