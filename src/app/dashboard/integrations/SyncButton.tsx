"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { syncAnalytics } from "./actions";

export default function SyncButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSync = async () => {
    setStatus("loading");
    setMessage("");
    try {
      const result = await syncAnalytics();
      if (result.success) {
        setStatus("success");
        setMessage(`Synced ${result.synced} post${result.synced === 1 ? "" : "s"}`);
      } else {
        setStatus("error");
        setMessage(result.message ?? "No connected accounts to sync");
      }
    } catch {
      setStatus("error");
      setMessage("Sync failed — check your connection");
    } finally {
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  return (
    <div className="flex flex-row-reverse items-center gap-3">
      <button
        onClick={handleSync}
        disabled={status === "loading"}
        className="flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 bg-accent-primary text-white hover:bg-accent-primary/90"
      >
        <RefreshCw className={`h-4 w-4 ${status === "loading" ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline">{status === "loading" ? "Syncing…" : "Sync Analytics"}</span>
      </button>
      {status === "success" && (
        <span className="flex items-center gap-1.5 text-sm text-green-400">
          <CheckCircle className="h-4 w-4" />
          <span className="hidden sm:inline">{message}</span>
        </span>
      )}
      {status === "error" && (
        <span className="flex items-center gap-1.5 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span className="hidden sm:inline">{message}</span>
        </span>
      )}
    </div>
  );
}
