"use client";

import { useEffect, useRef, useState } from "react";
import { clock, dateTime, dayKey, dayLabel, relativeTime } from "./format";
import { BellIcon, SearchIcon, TrashIcon, XIcon } from "./icons";
import { WINDOWS, type DeviceNotification, type WindowId } from "./types";
import { AppAvatar, Empty, Skeleton } from "./ui";

export type RemoveRequest = { id: string } | { ids: string[] } | { scope: "window" | "all" };

type Props = {
  ready: boolean;
  now: number;
  notes: DeviceNotification[];
  windowId: WindowId;
  onWindowChange: (id: WindowId) => void;
  busy: boolean;
  onRemove: (request: RemoveRequest) => void;
};

type Confirm = { title: string; body: string; action: string; request: RemoveRequest };

export function Notifications({ ready, now, notes, windowId, onWindowChange, busy, onRemove }: Props) {
  const [query, setQuery] = useState("");
  const [pickedApp, setApp] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const windowLong = WINDOWS.find((item) => item.id === windowId)?.long ?? "15 minutes";

  const counts = new Map<string, number>();
  for (const note of notes) counts.set(note.appName || "Unknown app", (counts.get(note.appName || "Unknown app") ?? 0) + 1);
  const appChips = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  // Drop the app filter once that app has no notifications left in range.
  const app = pickedApp && counts.has(pickedApp) ? pickedApp : null;

  const needle = query.trim().toLowerCase();
  const shown = notes.filter((note) => {
    if (app && (note.appName || "Unknown app") !== app) return false;
    if (!needle) return true;
    return [note.appName, note.title, note.text, note.subText].some((part) => part.toLowerCase().includes(needle));
  });
  const filtered = needle !== "" || app !== null;

  return (
    <div className="stack">
      <section className="card notes-toolbar">
        <div className="segmented" role="group" aria-label="Time range">
          {WINDOWS.map((item) => (
            <button key={item.id} type="button" aria-pressed={item.id === windowId} onClick={() => onWindowChange(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <label className="search">
          <SearchIcon size={18} />
          <input
            type="search"
            placeholder="Search notifications"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
              <XIcon size={16} />
            </button>
          ) : null}
        </label>
        {appChips.length > 1 ? (
          <div className="chips" role="group" aria-label="Filter by app">
            <button type="button" className="chip" aria-pressed={app === null} onClick={() => setApp(null)}>
              All <span>{notes.length}</span>
            </button>
            {appChips.map(([name, count]) => (
              <button
                key={name}
                type="button"
                className="chip"
                aria-pressed={app === name}
                onClick={() => setApp(app === name ? null : name)}
              >
                {name} <span>{count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <div className="notes-summary">
        <p>
          {ready ? (
            <>
              <strong>{shown.length}</strong>
              {filtered ? ` of ${notes.length}` : notes.length >= 50 ? "+" : ""} from the last {windowLong}
            </>
          ) : (
            "Loading…"
          )}
        </p>
        <div className="notes-actions">
          <button
            type="button"
            className="ghost-button"
            disabled={!ready || shown.length === 0 || busy}
            onClick={() =>
              setConfirm({
                title: filtered ? `Delete ${shown.length} shown?` : `Delete the last ${windowLong}?`,
                body: filtered
                  ? "Only the notifications matching your search and filter will be removed from the server."
                  : `Every notification from the last ${windowLong} will be removed from the server.`,
                action: "Delete",
                request: filtered ? { ids: shown.map((note) => note.id) } : { scope: "window" },
              })
            }
          >
            <TrashIcon size={16} /> Delete shown
          </button>
          <button
            type="button"
            className="ghost-button danger"
            disabled={!ready || busy}
            onClick={() =>
              setConfirm({
                title: "Delete all notifications?",
                body: "Every notification stored on the server will be removed, not just this range. This cannot be undone.",
                action: "Delete all",
                request: { scope: "all" },
              })
            }
          >
            Delete all
          </button>
        </div>
      </div>

      {!ready ? (
        <section className="card">
          <Skeleton lines={6} />
        </section>
      ) : shown.length === 0 ? (
        <section className="card">
          <Empty icon={<BellIcon />} title={filtered ? "No matches" : "All quiet"}>
            {filtered ? "Try a different search or app." : `No notifications in the last ${windowLong}.`}
          </Empty>
        </section>
      ) : (
        <ul className="note-list">
          {shown.map((note, index) => {
            const showDay = index === 0 || dayKey(shown[index - 1].postedAt) !== dayKey(note.postedAt);
            return (
              <li key={note.id}>
                {showDay ? <p className="timeline-day">{dayLabel(note.postedAt, now)}</p> : null}
                <article className="note card">
                  <AppAvatar name={note.appName || "?"} size={40} />
                  <div className="note-main">
                    <header className="note-top">
                      <strong>{note.appName || "Unknown app"}</strong>
                      {note.subText ? <span className="note-sub">{note.subText}</span> : null}
                      <time dateTime={new Date(note.postedAt).toISOString()} title={dateTime.format(note.postedAt)}>
                        {clock.format(note.postedAt)} · {relativeTime(note.postedAt, now)}
                      </time>
                    </header>
                    {note.title ? <p className="note-title">{note.title}</p> : null}
                    {note.text ? <p className="note-text">{note.text}</p> : null}
                    <span className={note.active ? "chip chip-live" : "chip"}>{note.active ? "Still on phone" : "Dismissed"}</span>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete notification from ${note.appName || "unknown app"}`}
                    disabled={busy}
                    onClick={() => onRemove({ id: note.id })}
                  >
                    <TrashIcon size={18} />
                  </button>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        confirm={confirm}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) onRemove(confirm.request);
          setConfirm(null);
        }}
      />
    </div>
  );
}

function ConfirmDialog({
  confirm,
  onCancel,
  onConfirm,
}: {
  confirm: Confirm | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (confirm && !dialog.open) dialog.showModal();
    if (!confirm && dialog.open) dialog.close();
  }, [confirm]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onCancel();
      }}
    >
      {confirm ? (
        <div className="dialog-body">
          <span className="dialog-icon">
            <TrashIcon />
          </span>
          <h2>{confirm.title}</h2>
          <p>{confirm.body}</p>
          <div className="dialog-actions">
            <button type="button" className="ghost-button" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="solid-button danger" onClick={onConfirm}>
              {confirm.action}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
