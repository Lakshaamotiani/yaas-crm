"use client";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function NotificationsSettingsPage() {
  const rows = [
    { id: "new_lead",     label: "New lead created", desc: "Whenever the YAAS form submits a new lead" },
    { id: "stage_change", label: "Stage advanced",   desc: "Pinned to your dashboard for 24h" },
    { id: "task_due",     label: "Task due today",   desc: "Morning digest at 9am" },
    { id: "deal_won",     label: "Deal won",         desc: "Celebrate in Slack #wins" },
  ];
  return (
    <div className="max-w-2xl space-y-2">
      <h2 className="text-sm font-semibold">Notifications</h2>
      <p className="text-xs text-muted-foreground">Choose what wakes you up.</p>
      <Card className="divide-y p-0">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0">
              <Label className="text-sm">{r.label}</Label>
              <div className="text-[11px] text-muted-foreground">{r.desc}</div>
            </div>
            <Switch defaultChecked className="ml-auto" />
          </div>
        ))}
      </Card>
    </div>
  );
}
