import { Settings, Bell, Shield, Mail, Database } from "lucide-react";

export const metadata = {
  title: "Admin Settings",
};

export default function AdminSettingsPage() {
  const settingsSections = [
    {
      title: "General",
      icon: Settings,
      description: "Platform name, branding, and default preferences",
      status: "active",
    },
    {
      title: "Notifications",
      icon: Bell,
      description: "Email alerts, system notifications, and client alerts",
      status: "coming_soon",
    },
    {
      title: "Security",
      icon: Shield,
      description: "Password policies, session management, and access logs",
      status: "coming_soon",
    },
    {
      title: "Email Templates",
      icon: Mail,
      description: "Client invitation emails and system notifications",
      status: "coming_soon",
    },
    {
      title: "Database",
      icon: Database,
      description: "Backups, data retention, and maintenance windows",
      status: "coming_soon",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#e8e8e8]" style={{ fontFamily: "var(--font-playfair)" }}>
          Settings
        </h1>
        <p className="text-[#787878] mt-1">
          Configure your admin preferences and platform settings
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.title}
              className="bg-[#111111] rounded-lg p-6 border border-[#1a1a1a] hover:border-[#c8952a]/30 transition-colors group cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[#1a1a1a] rounded-lg group-hover:bg-[#c8952a]/10 transition-colors">
                  <Icon className="h-6 w-6 text-[#787878] group-hover:text-[#c8952a] transition-colors" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-[#e8e8e8]">{section.title}</h3>
                    {section.status === "coming_soon" && (
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-[#2a2a2a] text-[#787878] rounded-full">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#787878]">{section.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Card */}
      <div className="bg-[#c8952a]/5 rounded-lg p-6 border border-[#c8952a]/20">
        <h3 className="font-semibold text-[#c8952a] mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
          Admin Control Center
        </h3>
        <p className="text-sm text-[#787878]">
          This is your command center for managing the Core OS platform. More settings and configuration options will be available here soon.
        </p>
      </div>
    </div>
  );
}
