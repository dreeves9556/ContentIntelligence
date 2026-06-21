"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Sparkles, User, Mail, Shield, LogOut, Save, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name);
    }
  }, [session?.user?.name]);

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (response.ok) {
        await update();
        setMessage("Profile updated successfully");
        setIsEditing(false);
      } else {
        setMessage("Failed to update profile");
      }
    } catch {
      setMessage("An error occurred");
    } finally {
      setIsSaving(false);
    }
  }

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : session?.user?.email?.[0].toUpperCase() || "U";

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
          Profile
        </h1>
        <p className="text-text-muted" style={{ fontFamily: "var(--font-dm-sans)" }}>
          Manage your account settings
        </p>
      </div>

      <div className="bg-background-card rounded-xl p-8 border border-background-secondary">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            {session?.user?.image ? (
              <img src={session.user.image} alt={session.user.name || "Profile"} className="h-24 w-24 rounded-full object-cover border-2 border-accent-primary" />
            ) : (
              <div className="h-24 w-24 rounded-full bg-accent-primary/20 flex items-center justify-center text-2xl font-bold text-accent-primary border-2 border-accent-primary">
                {initials}
              </div>
            )}
            <button className="absolute bottom-0 right-0 p-2 bg-background-secondary rounded-full border border-background-primary hover:bg-background-primary transition-colors">
              <Camera className="h-4 w-4 text-text-muted" />
            </button>
          </div>
          <h2 className="text-xl font-semibold text-white mb-1" style={{ fontFamily: "var(--font-playfair)" }}>
            {session?.user?.name || "Anonymous"}
          </h2>
          <p className="text-text-muted text-sm">{session?.user?.email}</p>
          <span className="mt-2 px-3 py-1 bg-accent-primary/10 text-accent-primary text-xs rounded-full uppercase tracking-wider">
            {session?.user?.role || "User"}
          </span>
        </div>
      </div>

      <div className="bg-background-card rounded-xl p-6 border border-background-secondary">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white" style={{ fontFamily: "var(--font-playfair)" }}>
            Profile Information
          </h3>
          <Button variant="outline" size="sm" onClick={() => isEditing ? handleSave() : setIsEditing(true)} disabled={isSaving} className="border-accent-primary text-accent-primary hover:bg-accent-primary/10">
            {isSaving ? "Saving..." : isEditing ? <><Save className="h-4 w-4 mr-2" />Save</> : "Edit"}
          </Button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-md text-sm ${message.includes("success") ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            {message}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary flex items-center gap-2">
              <User className="h-4 w-4 text-text-muted" />Display Name
            </label>
            {isEditing ? (
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 bg-background-secondary border border-background-secondary rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50" placeholder="Your name" />
            ) : (
              <p className="text-text-primary py-2">{session?.user?.name || "Not set"}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary flex items-center gap-2">
              <Mail className="h-4 w-4 text-text-muted" />Email Address
            </label>
            <p className="text-text-primary py-2">{session?.user?.email}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary flex items-center gap-2">
              <Shield className="h-4 w-4 text-text-muted" />Account Role
            </label>
            <p className="text-text-primary py-2">{session?.user?.role || "User"}</p>
          </div>
        </div>
      </div>

      <div className="bg-background-card rounded-xl p-6 border border-background-secondary">
        <h3 className="text-lg font-semibold text-white mb-4" style={{ fontFamily: "var(--font-playfair)" }}>
          Account Actions
        </h3>
        <Button variant="outline" onClick={handleLogout} className="w-full sm:w-auto border-red-500/50 text-red-400 hover:bg-red-500/10">
          <LogOut className="h-4 w-4 mr-2" />Sign Out
        </Button>
      </div>
    </div>
  );
}
