import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
  X,
  Zap,
  Menu,
} from "lucide-react";
const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
type User = { id: string; name: string; email: string; avatar?: string };
type Email = {
  id: string;
  recipient: string;
  subject: string;
  scheduled_at: string;
  sent_at?: string;
  status: string;
  sender_email?: string;
  error?: string;
};
function App() {
  const [user, setUser] = useState<User | null>(null),
    [emails, setEmails] = useState<Email[]>([]),
    [tab, setTab] = useState<"scheduled" | "sent">("scheduled"),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState(""),
    [compose, setCompose] = useState(false),
    [toast, setToast] = useState(""),
    [mobile, setMobile] = useState(false),
    [queue, setQueue] = useState<any>(null);
  const [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [startAt, setStartAt] = useState(() =>
      new Date(Date.now() + 60000).toISOString().slice(0, 16),
    ),
    [delay, setDelay] = useState("2000"),
    [hourly, setHourly] = useState("100"),
    [leads, setLeads] = useState<string[]>([]),
    [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const fetchMe = async () => {
    try {
      const r = await fetch(`${API}/auth/me`, { credentials: "include" });
      const d = await r.json();
      setUser(d.user || null);
    } catch {}
    setLoading(false);
  };
  const fetchEmails = async () => {
    try {
      const r = await fetch(`${API}/api/emails`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setEmails(d.emails || []);
      }
    } catch {}
  };
  const fetchQueue = async () => {
    try {
      const r = await fetch(`${API}/api/emails/queue`, {
        credentials: "include",
      });
      if (r.ok) setQueue(await r.json());
    } catch {}
  };
  useEffect(() => {
    fetchMe();
  }, []);
  useEffect(() => {
    if (user) {
      fetchEmails();
      fetchQueue();
      const id = setInterval(() => {
        fetchEmails();
        fetchQueue();
      }, 5000);
      return () => clearInterval(id);
    }
  }, [user]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const visible = useMemo(
    () =>
      emails
        .filter((e) =>
          tab === "scheduled"
            ? ["scheduled", "processing"].includes(e.status)
            : ["sent", "failed"].includes(e.status),
        )
        .filter((e) =>
          `${e.recipient} ${e.subject} ${e.status}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        ),
    [emails, tab, query],
  );
  const parseFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const found = [
        ...new Set(
          (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map(
            (x) => x.toLowerCase(),
          ),
        ),
      ];
      setLeads(found);
      setFileName(f.name);
      setToast(`${found.length} unique email addresses detected`);
    };
    reader.readAsText(f);
  };
  const schedule = async () => {
    if (!subject.trim() || !body.trim() || !leads.length) {
      setToast("Add a subject, message, and at least one email address.");
      return;
    }
    const dt = new Date(startAt);
    if (Number.isNaN(dt.getTime()) || dt.getTime() <= Date.now()) {
      setToast("Choose a future start time.");
      return;
    }
    try {
      const r = await fetch(`${API}/api/emails/schedule`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: leads,
          subject,
          body,
          startAt: dt.toISOString(),
          delayMs: Number(delay),
          hourlyLimit: Number(hourly),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to schedule");
      setToast(
        `${d.created} email${d.created === 1 ? "" : "s"} scheduled successfully`,
      );
      setCompose(false);
      setLeads([]);
      setFileName("");
      setSubject("");
      setBody("");
      await fetchEmails();
      setTab("scheduled");
    } catch (e) {
      setToast(
        e instanceof Error ? e.message : "Could not connect to backend.",
      );
    }
  };
  const logout = async () => {
    await fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    setEmails([]);
  };
  if (loading)
    return (
      <div className="loading-screen">
        <div className="logo-mark">
          <Mail size={23} />
        </div>
        <span>Loading workspace…</span>
      </div>
    );
  if (!user)
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="brand">
            <div className="logo-mark">
              <Mail size={23} />
            </div>
            <span>reachinbox</span>
          </div>
          <div className="login-illustration">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="mail-art">
              <Mail size={50} />
            </div>
            <div className="float-card fc-one">
              <Check size={14} /> Sequence scheduled
            </div>
            <div className="float-card fc-two">
              <Zap size={14} /> Smart delivery
            </div>
          </div>
          <p className="eyebrow">EMAIL OUTREACH, SIMPLIFIED</p>
          <h1>
            Every email.
            <br />
            <span>Right on time.</span>
          </h1>
          <p className="login-copy">
            Plan your outreach, automate delivery, and keep every conversation
            moving — all from one calm workspace.
          </p>
          <a className="google-button" href={`${API}/auth/google`}>
            <GoogleIcon /> Continue with Google <ArrowUpRight size={17} />
          </a>
          <p className="login-foot">
            <ShieldCheck size={14} /> Secure sign-in · Your data stays yours
          </p>
          <div className="login-bottom">
            Built for thoughtful outreach <span>✳</span>
          </div>
        </div>
        <div className="login-side-note">
          LESS MANUAL WORK. MORE REAL CONVERSATIONS.
        </div>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="logo-mark">
            <Mail size={21} />
          </div>
          <span>reachinbox</span>
          <button className="mobile-close" onClick={() => setMobile(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="workspace-label">
          WORKSPACE <ChevronDown size={13} />
        </div>
        <div className="workspace-card">
          <div className="workspace-avatar">
            {user.name?.slice(0, 1) || "R"}
          </div>
          <div>
            <strong>{user.name}</strong>
            <small>Personal workspace</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <button className="nav-item active">
          <LayoutDashboard size={18} /> Dashboard
        </button>
        <button
          className="nav-item"
          onClick={() => {
            setTab("scheduled");
            setMobile(false);
          }}
        >
          <CalendarClock size={18} /> Scheduled emails{" "}
          <span className="nav-count">
            {
              emails.filter((e) =>
                ["scheduled", "processing"].includes(e.status),
              ).length
            }
          </span>
        </button>
        <button
          className="nav-item"
          onClick={() => {
            setTab("sent");
            setMobile(false);
          }}
        >
          <Send size={18} /> Sent emails
        </button>
        <button
          className="nav-item"
          onClick={() => window.open(`${API}/admin/queues`, "_blank")}
        >
          <Activity size={18} /> Queue monitor{" "}
          <ArrowUpRight size={13} className="nav-external" />
        </button>
        <div className="nav-caption nav-caption-tools">PREFERENCES</div>
        <button
          className="nav-item"
          onClick={() => (window.location.href = `${API}/auth/slack`)}
        >
          <Zap size={18} /> Connect Slack <span className="beta-pill">NEW</span>
        </button>
        <button
          className="nav-item"
          onClick={() =>
            setToast(
              "Settings are managed through your environment configuration.",
            )
          }
        >
          <Settings size={18} /> Settings
        </button>
        <div className="sidebar-bottom">
          <div className="plan-card">
            <div className="plan-top">
              <span className="plan-icon">
                <Zap size={15} />
              </span>
              <span className="plan-tag">DEMO WORKSPACE</span>
            </div>
            <strong>Your outreach, in sync.</strong>
            <p>Jobs are safely queued and ready when you are.</p>
            <div className="plan-meter">
              <span />
            </div>
            <small>Queue refreshes every 5 seconds</small>
          </div>
          <div className="sidebar-user">
            <div className="avatar-small">
              {user.avatar ? <img src={user.avatar} /> : user.name?.slice(0, 1)}
            </div>
            <div className="sidebar-user-text">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
            <button className="icon-button" title="Log out" onClick={logout}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobile(true)}>
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>Dashboard</strong>
          </div>
          <div className="top-actions">
            <div className="live-pill">
              <span className="live-dot" /> System operational
            </div>
            <button className="top-avatar" title={user.email}>
              {user.avatar ? <img src={user.avatar} /> : user.name?.slice(0, 1)}
            </button>
            <button className="logout-button" onClick={logout}>
              <LogOut size={15} /> Logout
            </button>
          </div>
        </header>
        <main className="content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" /> YOUR OUTREACH COMMAND CENTER
              </div>
              <h1>
                Good to see you, {user.name?.split(" ")[0] || "there"}{" "}
                <span className="wave">✳</span>
              </h1>
              <p className="subheading">
                A little less busywork. A lot more getting things done.
              </p>
            </div>
            <button className="primary-button" onClick={() => setCompose(true)}>
              <Plus size={18} /> Compose new email
            </button>
          </div>
          <div className="stats-grid">
            <Stat
              icon={<CalendarClock size={18} />}
              label="Scheduled"
              value={
                emails.filter((e) =>
                  ["scheduled", "processing"].includes(e.status),
                ).length
              }
              note="Ready for delivery"
              tone="purple"
            />
            <Stat
              icon={<Send size={18} />}
              label="Emails sent"
              value={emails.filter((e) => e.status === "sent").length}
              note="Successfully delivered to test SMTP"
              tone="green"
            />
            <Stat
              icon={<Inbox size={18} />}
              label="Failed"
              value={emails.filter((e) => e.status === "failed").length}
              note="Need a quick look"
              tone="orange"
            />
            <Stat
              icon={<Activity size={18} />}
              label="Queue waiting"
              value={queue?.counts?.waiting ?? "—"}
              note={`${queue?.counts?.active ?? 0} currently processing`}
              tone="blue"
            />
          </div>
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Email activity</h2>
                <p>Keep track of every message, from scheduled to sent.</p>
              </div>
              <div className="panel-controls">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    placeholder="Search emails..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button onClick={() => setQuery("")}>
                      <X size={13} />
                    </button>
                  )}
                </div>
                <button
                  className="filter-button"
                  onClick={() => {
                    fetchEmails();
                    fetchQueue();
                    setToast("Dashboard refreshed");
                  }}
                >
                  <SlidersHorizontal size={15} /> Refresh
                </button>
              </div>
            </div>
            <div className="tabs">
              <button
                className={tab === "scheduled" ? "tab active-tab" : "tab"}
                onClick={() => setTab("scheduled")}
              >
                <CalendarClock size={16} /> Scheduled emails{" "}
                <span>
                  {
                    emails.filter((e) =>
                      ["scheduled", "processing"].includes(e.status),
                    ).length
                  }
                </span>
              </button>
              <button
                className={tab === "sent" ? "tab active-tab" : "tab"}
                onClick={() => setTab("sent")}
              >
                <Send size={16} /> Sent emails{" "}
                <span>
                  {
                    emails.filter((e) => ["sent", "failed"].includes(e.status))
                      .length
                  }
                </span>
              </button>
              <div className="table-meta">
                <span className="live-dot" /> Live updates
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input type="checkbox" aria-label="Select all" />
                    </th>
                    <th>RECIPIENT</th>
                    <th>SUBJECT & MESSAGE</th>
                    <th>{tab === "scheduled" ? "SCHEDULED FOR" : "SENT AT"}</th>
                    <th>STATUS</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${e.recipient}`}
                        />
                      </td>
                      <td>
                        <div className="recipient-cell">
                          <div className="recipient-avatar">
                            {e.recipient.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <strong>{e.recipient}</strong>
                            <small>{e.sender_email || "Email recipient"}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="subject-cell">
                          <strong>{e.subject}</strong>
                          <small>{e.error || "Email sequence message"}</small>
                        </div>
                      </td>
                      <td>
                        <div className="date-cell">
                          <strong>
                            {formatDate(
                              tab === "scheduled"
                                ? e.scheduled_at
                                : e.sent_at || e.scheduled_at,
                            )}
                          </strong>
                          <small>
                            {formatTime(
                              tab === "scheduled"
                                ? e.scheduled_at
                                : e.sent_at || e.scheduled_at,
                            )}
                          </small>
                        </div>
                      </td>
                      <td>
                        <Status status={e.status} />
                      </td>
                      <td>
                        <button
                          className="row-menu"
                          title="Email details"
                          onClick={() =>
                            setToast(e.error || `Email ID: ${e.id}`)
                          }
                        >
                          ···
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visible.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">
                    {tab === "scheduled" ? (
                      <CalendarClock size={25} />
                    ) : (
                      <Send size={25} />
                    )}
                  </div>
                  <h3>
                    {query
                      ? "No matching emails"
                      : tab === "scheduled"
                        ? "Nothing in the queue just yet"
                        : "Your sent folder is quiet"}
                  </h3>
                  <p>
                    {query
                      ? "Try another search term."
                      : tab === "scheduled"
                        ? "Compose an email and schedule it for the perfect moment. Your upcoming sends will show up here."
                        : "Once your scheduled emails are processed, you’ll find their history here."}
                  </p>
                  {!query && tab === "scheduled" && (
                    <button
                      className="secondary-button"
                      onClick={() => setCompose(true)}
                    >
                      <Plus size={16} /> Schedule your first email
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="panel-footer">
              <span>
                Showing <strong>{visible.length}</strong> of{" "}
                <strong>{emails.length}</strong> emails
              </span>
              <div className="pagination">
                <button disabled>
                  <ChevronLeft size={16} />
                </button>
                <span>1</span>
                <button disabled>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
          <div className="bottom-note">
            <div className="note-icon">
              <ShieldCheck size={17} />
            </div>
            <div>
              <strong>Reliability is built in.</strong>
              <span>
                Jobs persist in Redis and Postgres, even when your server
                restarts.
              </span>
            </div>
            <button
              onClick={() => window.open(`${API}/admin/queues`, "_blank")}
            >
              View queue <ArrowUpRight size={14} />
            </button>
          </div>
          <footer>
            © 2026 ReachInbox Scheduler{" "}
            <span>
              Made for meaningful conversations{" "}
              <span className="footer-star">✳</span>
            </span>
          </footer>
        </main>
      </div>
      {compose && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCompose(false);
          }}
        >
          <section className="compose-modal">
            <div className="modal-head">
              <div>
                <div className="modal-icon">
                  <Mail size={20} />
                </div>
                <h2>Compose new email</h2>
                <p>
                  Set up your message and let the scheduler handle the rest.
                </p>
              </div>
              <button className="icon-button" onClick={() => setCompose(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <label className="field-label">
                EMAIL SUBJECT
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="A quick idea for your team..."
                />
              </label>
              <label className="field-label">
                MESSAGE BODY
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Hi there,\n\nI wanted to reach out because..."
                  rows={5}
                />
              </label>
              <div className="field-label">
                RECIPIENTS{" "}
                <span className="label-optional">CSV or TXT file</span>
              </div>
              <button
                className={`upload-zone ${leads.length ? "upload-done" : ""}`}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  hidden
                  type="file"
                  accept=".csv,.txt,text/plain,text/csv"
                  onChange={(e) =>
                    e.target.files?.[0] && parseFile(e.target.files[0])
                  }
                />
                <div className="upload-icon">
                  {leads.length ? (
                    <Check size={22} />
                  ) : (
                    <UploadCloud size={22} />
                  )}
                </div>
                <strong>{fileName || "Click to upload your lead list"}</strong>
                <span>
                  {leads.length
                    ? `${leads.length} unique email address${leads.length === 1 ? "" : "es"} detected`
                    : "CSV or TXT · Email addresses are detected automatically"}
                </span>
                {leads.length > 0 && (
                  <span className="file-chip">
                    <FileText size={13} />
                    {fileName}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLeads([]);
                        setFileName("");
                      }}
                    >
                      <X size={13} />
                    </button>
                  </span>
                )}
              </button>
              {leads.length > 0 && (
                <div className="lead-preview">
                  {leads.slice(0, 3).map((x) => (
                    <span key={x}>{x}</span>
                  ))}
                  {leads.length > 3 && <span>+{leads.length - 3} more</span>}
                </div>
              )}
              <div className="settings-divider">
                <span>DELIVERY SETTINGS</span>
              </div>
              <label className="field-label">
                START SENDING AT
                <input
                  type="datetime-local"
                  value={startAt}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setStartAt(e.target.value)}
                />
                <small>All times use your browser’s local timezone.</small>
              </label>
              <div className="field-grid">
                <label className="field-label">
                  DELAY BETWEEN EMAILS{" "}
                  <div className="input-with-suffix">
                    <input
                      type="number"
                      min="0"
                      max="86400000"
                      value={delay}
                      onChange={(e) => setDelay(e.target.value)}
                    />
                    <span>ms</span>
                  </div>
                  <small>Minimum spacing per send</small>
                </label>
                <label className="field-label">
                  HOURLY SENDER LIMIT
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={hourly}
                    onChange={(e) => setHourly(e.target.value)}
                  />
                  <small>Emails per sender per hour</small>
                </label>
              </div>
              <div className="compose-info">
                <Clock3 size={16} />
                <span>
                  Estimated first send:{" "}
                  <strong>
                    {formatDate(new Date(startAt).toISOString())} at{" "}
                    {formatTime(new Date(startAt).toISOString())}
                  </strong>
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <span>
                {leads.length} recipient{leads.length === 1 ? "" : "s"} selected
              </span>
              <button
                className="secondary-button"
                onClick={() => setCompose(false)}
              >
                Cancel
              </button>
              <button className="primary-button" onClick={schedule}>
                <CalendarClock size={16} /> Schedule emails
              </button>
            </div>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast">
          <div className="toast-check">
            <Check size={15} />
          </div>
          {toast}
          <button onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {mobile && (
        <div className="mobile-shade" onClick={() => setMobile(false)} />
      )}
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  note: string;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className={`stat-icon ${tone}`}>{icon}</span>
        <span className="stat-label">{label}</span>
        <span className="stat-dots">···</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">
        <span className={`tiny-dot ${tone}`} />
        {note}
      </div>
    </div>
  );
}
function Status({ status }: { status: string }) {
  const s =
    status === "processing"
      ? "processing"
      : status === "scheduled"
        ? "scheduled"
        : status === "sent"
          ? "sent"
          : "failed";
  return (
    <span className={`status-pill ${s}`}>
      <span />
      {s === "processing"
        ? "Processing"
        : s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}
function formatDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}
function formatTime(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 38.08 46.98 31.97 46.98 24.55z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
export default App;
