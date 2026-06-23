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
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={status === "loading"}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
        style={{ background: "#c8952a", color: "#0a0a0a" }}
      >
        <RefreshCw className={`h-4 w-4 ${status === "loading" ? "animate-spin" : ""}`} />
        {status === "loading" ? "Syncing…" : "Sync Analytics"}
      </button>
      {status === "success" && (
        <span className="flex items-center gap-1.5 text-sm text-green-400">
          <CheckCircle className="h-4 w-4" />
          {message}
        </span>
      )}
      {status === "error" && (
        <span className="flex items-center gap-1.5 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          {message}
        </span>
      )}
    </div>
  );
}
