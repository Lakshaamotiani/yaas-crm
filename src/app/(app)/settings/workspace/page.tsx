"use client";

import * as React from "react";
import { toast } from "sonner";
import { Lock, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useActions, useProfiles, useTemplates } from "@/lib/store";
import { useIsAdmin, AdminOnly } from "@/lib/roles";
import { cn, initials } from "@/lib/utils";
import { ScriptLibrary } from "@/components/workspace/script-library";
import { StringList } from "@/components/workspace/string-list";
import { OptionList } from "@/components/workspace/option-list";
import { EmailTemplateList } from "@/components/workspace/email-template-list";
import { SourceLabels } from "@/components/workspace/source-labels";
import { PipelineStagesEditor } from "@/components/workspace/pipeline-stages-editor";
import { SampleDataPanel } from "@/components/workspace/sample-data-panel";
import { WorkspaceDataPanel } from "@/components/workspace/workspace-data-panel";
import { TeamManagement } from "@/components/team/team-management";

export default function WorkspaceSettingsPage() {
  const team = useProfiles();
  const templates = useTemplates();
  const actions = useActions();
  const isAdmin = useIsAdmin();

  return (
    <div className="max-w-3xl space-y-8">
      <Header />

      {!isAdmin ? (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted/40 px-3.5 py-2.5 text-[12px] text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>
            You're viewing workspace settings as a <strong className="text-foreground">rep</strong> —
            only admins can edit these. Ask an admin to make changes.
          </span>
        </div>
      ) : null}

      <Tabs defaultValue="general">
        {/* Horizontal scroll on narrow viewports — five tabs blow past 375px */}
        <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="script">Sales scripts</TabsTrigger>
            <TabsTrigger value="dropdowns">Dropdowns</TabsTrigger>
            <TabsTrigger value="email">Email templates</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general" className="mt-4 space-y-6">
          <ReadOnlyWrap locked={!isAdmin}>
            <Section title="Workspace" description="Shared settings for the YAAS Sales CRM team.">
              <Card className="space-y-2 p-5">
                <p className="text-[13px] text-muted-foreground">YAAS Sales CRM</p>
                <p className="text-[12px] text-muted-foreground/60">Additional workspace settings coming soon.</p>
              </Card>
            </Section>
          </ReadOnlyWrap>

          <AdminOnly>
            <Section
              title="Demo data"
              description="One-click sample catalog for screenshots, walk-throughs, or first-load demos."
            >
              <SampleDataPanel />
            </Section>

            <Section
              title="Backup & data"
              description="Export a full backup, restore from one, or clear the workspace."
            >
              <WorkspaceDataPanel />
            </Section>
          </AdminOnly>
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4 space-y-6">
          <ReadOnlyWrap locked={!isAdmin}>
            <Section
              title="Pipeline stages"
              description="Add, rename, recolour, reorder, or remove the stages of your deal pipeline. The role (Open / Won / Lost) — not the name — drives dashboard analytics, so renaming is always safe."
            >
              <Card className="p-5">
                <PipelineStagesEditor />
              </Card>
            </Section>
          </ReadOnlyWrap>
        </TabsContent>

        <TabsContent value="script" className="mt-4 space-y-3">
          <ReadOnlyWrap locked={!isAdmin}>
            <Section
              title="Sales scripts"
              description="Reusable scripts powering the live call mode. Each script is a sequence of typed blocks: capture / say-this / discovery / math / pitch. Tokens auto-substitute across blocks."
            >
              <ScriptLibrary />
            </Section>
          </ReadOnlyWrap>
        </TabsContent>

        <TabsContent value="dropdowns" className="mt-4 space-y-6"><ReadOnlyWrap locked={!isAdmin}>
          <Section title="Tag vocabulary" description="Suggested tags shown when tagging a lead.">
            <Card className="p-5">
              <StringList
                value={templates.tagVocabulary}
                onChange={(tagVocabulary) => actions.updateTemplates({ tagVocabulary })}
                placeholder="Tag (e.g. high-intent)"
              />
            </Card>
          </Section>

          <Section title="Timeline options" description="Used in qualification when asking 'when do you want to start?'">
            <Card className="p-5">
              <OptionList
                value={templates.timelineOptions}
                onChange={(timelineOptions) => actions.updateTemplates({ timelineOptions })}
              />
            </Card>
          </Section>

          <Section title="Current editor options" description="What the lead is currently using for editing.">
            <Card className="p-5">
              <OptionList
                value={templates.currentEditorOptions}
                onChange={(currentEditorOptions) => actions.updateTemplates({ currentEditorOptions })}
              />
            </Card>
          </Section>

          <Section title="Service interest suggestions" description="Autocomplete options on the New Lead form.">
            <Card className="p-5">
              <StringList
                value={templates.serviceInterests}
                onChange={(serviceInterests) => actions.updateTemplates({ serviceInterests })}
                placeholder="Long-form YouTube"
              />
            </Card>
          </Section>

          <Section title="Lead source labels" description="Customize how the source enum is displayed.">
            <Card className="p-5">
              <SourceLabels
                value={templates.sourceLabels}
                onChange={(sourceLabels) => actions.updateTemplates({ sourceLabels })}
              />
            </Card>
          </Section>
          </ReadOnlyWrap>
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <ReadOnlyWrap locked={!isAdmin}>
            <Section
              title="Email templates"
              description="Quick-send templates that appear in the Send Email popover on the lead detail."
            >
              <Card className="p-5">
                <EmailTemplateList
                  value={templates.emailTemplates}
                  onChange={(emailTemplates) => actions.updateTemplates({ emailTemplates })}
                />
              </Card>
            </Section>
          </ReadOnlyWrap>
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <TeamManagement />
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between border-t pt-4">
        <AdminOnly fallback={<span />}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              actions.resetTemplates();
              toast.success("Templates reset to defaults");
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset templates to defaults
          </Button>
        </AdminOnly>
        <p className="text-[11px] text-muted-foreground">
          {isAdmin ? "Changes save automatically." : "Read-only — admin access required to edit."}
        </p>
      </div>
    </div>
  );
}

/**
 * Wraps a chunk of editable settings UI. When `locked`, all interactive
 * children are disabled via `pointer-events-none` and visually muted, so
 * reps see the same content as admins but can't change anything.
 */
function ReadOnlyWrap({ locked, children }: { locked: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(locked && "pointer-events-none select-none opacity-60")}
      aria-disabled={locked || undefined}
    >
      {children}
    </div>
  );
}

function Header() {
  return (
    <div className="space-y-1">
      <h1 className="text-lg font-semibold tracking-tight">Workspace</h1>
      <p className="text-sm text-muted-foreground">
        Edit shared settings, sales script, dropdown menus, and email templates.
      </p>
    </div>
  );
}

function Section({
  title, description, children,
}: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
