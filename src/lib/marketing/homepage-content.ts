import type { LucideIcon } from "lucide-react";
import {
  Code,
  File,
  LayoutGrid,
  Search,
  Sparkles,
  Terminal,
} from "lucide-react";

import { MARKETING_CONTACT_EMAIL } from "@/lib/marketing/site";

export const SYSTEM_ITEM_TYPE_COLORS = {
  snippet: "#4DA3E8",
  prompt: "#9B8AFB",
  command: "#E8944A",
  note: "#D4B84A",
  file: "#7B8A9A",
  image: "#D46BA8",
  link: "#3DB88A",
} as const;

export type HomepageItemType = keyof typeof SYSTEM_ITEM_TYPE_COLORS;

export const HOMEPAGE_FEATURES: {
  type: HomepageItemType;
  title: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    type: "snippet",
    title: "Code Snippets",
    description:
      "Store syntax-highlighted snippets with language tags. Copy in one click.",
    icon: Code,
  },
  {
    type: "prompt",
    title: "AI Prompts",
    description:
      "Keep your best prompts organized with markdown preview and versioning.",
    icon: Sparkles,
  },
  {
    type: "link",
    title: "Instant Search",
    description:
      "Cmd+K to find anything — snippets, prompts, files, or collections instantly.",
    icon: Search,
  },
  {
    type: "command",
    title: "Commands",
    description:
      "Shell commands, git aliases, and docker one-liners — always at hand.",
    icon: Terminal,
  },
  {
    type: "file",
    title: "Files & Docs",
    description: "Upload PDFs, configs, and reference docs. Download anytime.",
    icon: File,
  },
  {
    type: "note",
    title: "Collections",
    description:
      "Group related items into collections. Favorite the ones you use daily.",
    icon: LayoutGrid,
  },
];

export const SOCIAL_PROOF = {
  eyebrow: "Built for developers who ship",
  logos: ["VS Code", "GitHub", "Notion", "Slack", "Terminal"],
  testimonials: [
    {
      quote: "I finally stopped losing snippets across five different apps.",
      author: "Alex M., Full-stack Engineer",
    },
    {
      quote: "Cmd+K search alone replaced my messy bookmarks folder.",
      author: "Jordan K., Backend Developer",
    },
  ],
} as const;

export const AI_CHECKLIST = [
  "Auto-generated tags from content",
  "Smart summaries for long notes",
  "Suggested collections for new items",
  "Natural language search",
] as const;

export const AI_DEMO_TAGS = ["typescript", "api", "fetch", "async"] as const;

export const DASHBOARD_MOCK_CARDS: {
  type: HomepageItemType;
  title: string;
  tag: string;
}[] = [
  { type: "snippet", title: "React useEffect hook", tag: "react" },
  { type: "prompt", title: "Code review prompt", tag: "ai" },
  { type: "command", title: "Docker cleanup", tag: "devops" },
  { type: "note", title: "API design notes", tag: "backend" },
  { type: "link", title: "Prisma docs", tag: "docs" },
  { type: "image", title: "Architecture diagram", tag: "design" },
];

export const PRICING_PLANS = {
  free: {
    name: "Free",
    monthlyPrice: "$0",
    yearlyPrice: "$0",
    period: "/forever",
    features: [
      "50 items",
      "3 collections",
      "All item types",
      "Global search",
      "Dark mode",
    ],
    cta: "Get Started",
    variant: "outline" as const,
  },
  pro: {
    name: "Pro",
    monthlyPrice: "$8",
    yearlyPrice: "$72",
    monthlyPeriod: "/month",
    yearlyPeriod: "/year",
    features: [
      "Unlimited items",
      "Unlimited collections",
      "File & image uploads",
      "AI tagging & summaries",
      "Natural language search",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    variant: "default" as const,
  },
};

export const FOOTER_LINKS = {
  product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
  ],
  company: [
    {
      label: "Contact",
      href: `mailto:${MARKETING_CONTACT_EMAIL}`,
    },
  ],
  legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
} as const;
