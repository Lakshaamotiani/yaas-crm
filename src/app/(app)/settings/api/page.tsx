"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function ApiSettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Inbound webhook (YAAS form)</h2>
        <p className="text-xs text-muted-foreground">
          POST new submissions to this endpoint and they'll appear as new leads.
        </p>
        <Card className="space-y-3 p-5">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Endpoint</Label>
            <Input readOnly value="https://crm.yaas.in/api/leads/inbound" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Secret</Label>
            <div className="flex gap-2">
              <Input readOnly value="••••••••••••" />
              <Button variant="outline">Rotate</Button>
            </div>
          </div>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Integrations</h2>
        <Card className="divide-y p-0">
          <Integration name="Gmail" desc="Sync threads to lead timeline" />
          <Integration name="Google Calendar" desc="Auto-create call activities" connected />
          <Integration name="Slack" desc="Pipeline notifications" />
          <Integration name="Stripe" desc="Sync MRR on closed-won" />
        </Card>
      </section>
    </div>
  );
}

function Integration({ name, desc, connected }: { name: string; desc: string; connected?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-[11px] font-semibold">
        {name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="text-sm">{name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{desc}</div>
      </div>
      {connected ? (
        <Badge variant="muted" className="ml-auto">Connected</Badge>
      ) : (
        <Switch className="ml-auto" />
      )}
    </div>
  );
}
