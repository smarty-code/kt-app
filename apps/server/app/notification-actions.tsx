"use client";

export function DeleteNotificationButton({ id, windowId }: { id: string; windowId: string }) {
  return (
    <form action="/api/notifications/remove" method="post">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="window" value={windowId} />
      <button type="submit" className="text-button">
        Delete
      </button>
    </form>
  );
}

export function DeleteNotificationBatch({
  scope,
  windowId,
  label,
}: {
  scope: "window" | "all";
  windowId: string;
  label: string;
}) {
  return (
    <form
      action="/api/notifications/remove"
      method="post"
      onSubmit={(event) => {
        const message =
          scope === "all"
            ? "Delete every notification stored on the server?"
            : "Delete the notifications shown for this time range?";
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="window" value={windowId} />
      <button type="submit" className={scope === "all" ? "text-button danger" : "text-button"}>
        {label}
      </button>
    </form>
  );
}
