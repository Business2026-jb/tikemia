"use client";

import {
  BadgeDollarSign,
  Globe2,
  Mail,
  Megaphone,
  MessageCircle,
  Radio,
  Search,
  Share2,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

import type {
  AdminMarketingCampaignListItem,
} from "@/lib/admin/marketing/get-admin-marketing-campaigns";

type MarketingChannel =
  AdminMarketingCampaignListItem["channel"];

const FALLBACK = {
  label: "Autre",
  className:
    "border-neutral-400/20 bg-neutral-400/[0.08] text-neutral-300",
  icon: Radio,
};

const CONFIG: Partial<
  Record<
    MarketingChannel,
    {
      label: string;
      className: string;
      icon: LucideIcon;
    }
  >
> = {
  DIRECT: {
    label: "Direct",
    className:
      "border-neutral-400/20 bg-neutral-400/[0.08] text-neutral-300",
    icon: Radio,
  },

  FACEBOOK: {
    label: "Facebook",
    className:
      "border-sky-400/20 bg-sky-400/[0.08] text-sky-300",
    icon: Share2,
  },

  INSTAGRAM: {
    label: "Instagram",
    className:
      "border-fuchsia-400/20 bg-fuchsia-400/[0.08] text-fuchsia-300",
    icon: Share2,
  },

  TIKTOK: {
    label: "TikTok",
    className:
      "border-neutral-400/20 bg-neutral-400/[0.08] text-neutral-300",
    icon: Smartphone,
  },

  WHATSAPP: {
    label: "WhatsApp",
    className:
      "border-green-400/20 bg-green-400/[0.08] text-green-300",
    icon: MessageCircle,
  },

  EMAIL: {
    label: "E-mail",
    className:
      "border-sky-400/20 bg-sky-400/[0.08] text-sky-300",
    icon: Mail,
  },

  GOOGLE: {
    label: "Google",
    className:
      "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",
    icon: Search,
  },

  TELEGRAM: {
    label: "Telegram",
    className:
      "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300",
    icon: MessageCircle,
  },

  LINKEDIN: {
    label: "LinkedIn",
    className:
      "border-sky-400/20 bg-sky-400/[0.08] text-sky-300",
    icon: Share2,
  },

  INFLUENCER: {
    label: "Influenceur",
    className:
      "border-violet-400/20 bg-violet-400/[0.08] text-violet-300",
    icon: Megaphone,
  },

  PARTNER: {
    label: "Partenaire",
    className:
      "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",
    icon: Share2,
  },

  AFFILIATE: {
    label: "Affiliation",
    className:
      "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300",
    icon: BadgeDollarSign,
  },

  QR_CODE: {
    label: "QR Code",
    className:
      "border-violet-400/20 bg-violet-400/[0.08] text-violet-300",
    icon: Smartphone,
  },

  OTHER: {
    label: "Autre",
    className:
      "border-neutral-400/20 bg-neutral-400/[0.08] text-neutral-300",
    icon: Globe2,
  },
};

export default function MarketingChannelBadge({
  channel,
}: {
  channel: MarketingChannel;
}) {
  const config =
    CONFIG[channel] ??
    FALLBACK;

  const Icon =
    config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${config.className}`}
    >
      <Icon
        className="h-3.5 w-3.5"
        aria-hidden="true"
      />

      {config.label}
    </span>
  );
}