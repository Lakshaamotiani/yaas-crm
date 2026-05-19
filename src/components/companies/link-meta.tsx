import {
  Globe, Youtube, Linkedin, Twitter, Instagram, Github,
  Music2, AtSign, MessageCircle, Link2,
} from "lucide-react";
import type { CompanyLinkType } from "@/lib/types";

export const LINK_TYPES: {
  id: CompanyLinkType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "website",   label: "Website",       icon: Globe },
  { id: "youtube",   label: "YouTube",       icon: Youtube },
  { id: "linkedin",  label: "LinkedIn",      icon: Linkedin },
  { id: "twitter",   label: "X / Twitter",   icon: Twitter },
  { id: "instagram", label: "Instagram",     icon: Instagram },
  { id: "tiktok",    label: "TikTok",        icon: Music2 },
  { id: "threads",   label: "Threads",       icon: AtSign },
  { id: "github",    label: "GitHub",        icon: Github },
  { id: "discord",   label: "Discord",       icon: MessageCircle },
  { id: "other",     label: "Other",         icon: Link2 },
];

export const LINK_META: Record<
  CompanyLinkType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = Object.fromEntries(
  LINK_TYPES.map((t) => [t.id, { label: t.label, icon: t.icon }]),
) as Record<CompanyLinkType, { label: string; icon: React.ComponentType<{ className?: string }> }>;
