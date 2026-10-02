import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const DEMO_USER_ID = "user-demo";
const DEMO_EMAIL = "demo@memex.io";

const systemItemTypes = [
  { id: "type-snippet", name: "snippet", icon: "Code", color: "#4DA3E8", kind: "code" },
  { id: "type-prompt", name: "prompt", icon: "Sparkles", color: "#9B8AFB", kind: "markdown" },
  { id: "type-command", name: "command", icon: "Terminal", color: "#E8944A", kind: "code" },
  { id: "type-note", name: "note", icon: "StickyNote", color: "#D4B84A", kind: "markdown" },
  { id: "type-file", name: "file", icon: "File", color: "#7B8A9A", kind: "file" },
  { id: "type-image", name: "image", icon: "Image", color: "#D46BA8", kind: "image" },
  { id: "type-link", name: "link", icon: "Link", color: "#3DB88A", kind: "link" },
] as const;

const collections = [
  {
    id: "coll-react-patterns",
    name: "React Patterns",
    description: "Reusable React patterns and hooks",
    isFavorite: true,
  },
  {
    id: "coll-ai-workflows",
    name: "AI Workflows",
    description: "AI prompts and workflow automations",
    isFavorite: true,
  },
  {
    id: "coll-devops",
    name: "DevOps",
    description: "Infrastructure and deployment resources",
    isFavorite: false,
  },
  {
    id: "coll-terminal-commands",
    name: "Terminal Commands",
    description: "Useful shell commands for everyday development",
    isFavorite: false,
  },
  {
    id: "coll-design-resources",
    name: "Design Resources",
    description: "UI/UX resources and references",
    isFavorite: false,
  },
] as const;

type SeedItem = {
  id: string;
  title: string;
  contentType: "text" | "file";
  typeId: string;
  collectionId: string;
  content?: string;
  url?: string;
  description?: string;
  language?: string;
  isPinned?: boolean;
};

const items: SeedItem[] = [
  {
    id: "item-use-debounce",
    title: "useDebounce Hook",
    description: "Debounce a value to limit expensive updates",
    contentType: "text",
    typeId: "type-snippet",
    collectionId: "coll-react-patterns",
    language: "typescript",
    isPinned: true,
    content: `import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}`,
  },
  {
    id: "item-compound-components",
    title: "Compound Component Pattern",
    description: "Share implicit state across related components",
    contentType: "text",
    typeId: "type-snippet",
    collectionId: "coll-react-patterns",
    language: "typescript",
    content: `import { createContext, useContext, useState, type ReactNode } from "react";

const TabsContext = createContext<{ active: string; setActive: (id: string) => void } | null>(null);

export function Tabs({ children, defaultValue }: { children: ReactNode; defaultValue: string }) {
  const [active, setActive] = useState(defaultValue);
  return <TabsContext.Provider value={{ active, setActive }}>{children}</TabsContext.Provider>;
}

export function Tab({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tab must be used within Tabs");
  return ctx.active === id ? <div>{children}</div> : null;
}`,
  },
  {
    id: "item-clsx-utility",
    title: "cn Utility Function",
    description: "Merge Tailwind classes with clsx and tailwind-merge",
    contentType: "text",
    typeId: "type-snippet",
    collectionId: "coll-react-patterns",
    language: "typescript",
    content: `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}`,
  },
  {
    id: "item-code-review-prompt",
    title: "Code Review Prompt",
    description: "Structured review for pull requests",
    contentType: "text",
    typeId: "type-prompt",
    collectionId: "coll-ai-workflows",
    isPinned: true,
    content: `Review this code change as a senior engineer. Focus on:
1. Correctness and edge cases
2. Security risks
3. Performance concerns
4. Readability and maintainability
5. Test coverage gaps

Provide actionable feedback grouped by severity (critical, suggestion, nit).`,
  },
  {
    id: "item-docs-generation-prompt",
    title: "Documentation Generation",
    description: "Generate README and API docs from code",
    contentType: "text",
    typeId: "type-prompt",
    collectionId: "coll-ai-workflows",
    content: `Generate documentation for this module:
- One-paragraph overview
- Installation/setup steps
- Usage examples with code blocks
- Configuration options table
- Common pitfalls and troubleshooting

Use clear headings and keep examples runnable.`,
  },
  {
    id: "item-refactor-prompt",
    title: "Refactoring Assistance",
    description: "Improve structure without changing behavior",
    contentType: "text",
    typeId: "type-prompt",
    collectionId: "coll-ai-workflows",
    content: `Refactor this code to improve readability and maintainability.
Constraints:
- Preserve existing behavior and public API
- Prefer small, testable functions
- Add brief comments only for non-obvious logic
- Call out any risky assumptions`,
  },
  {
    id: "item-docker-compose",
    title: "Docker Compose for Next.js + Postgres",
    description: "Local dev stack with app and database services",
    contentType: "text",
    typeId: "type-snippet",
    collectionId: "coll-devops",
    language: "yaml",
    isPinned: true,
    content: `services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: memex
      POSTGRES_PASSWORD: memex
      POSTGRES_DB: memex
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://memex:memex@db:5432/memex
    depends_on:
      - db

volumes:
  pgdata:`,
  },
  {
    id: "item-deploy-script",
    title: "Production Deploy Script",
    description: "Build, migrate, and restart the app on the server",
    contentType: "text",
    typeId: "type-command",
    collectionId: "coll-devops",
    content: `git pull origin main && npm ci && npm run build && npx prisma migrate deploy && pm2 restart memex`,
  },
  {
    id: "item-docker-docs",
    title: "Docker Documentation",
    contentType: "text",
    typeId: "type-link",
    collectionId: "coll-devops",
    url: "https://docs.docker.com/",
  },
  {
    id: "item-github-actions-docs",
    title: "GitHub Actions Documentation",
    contentType: "text",
    typeId: "type-link",
    collectionId: "coll-devops",
    url: "https://docs.github.com/en/actions",
  },
  {
    id: "item-git-stash-pop",
    title: "Apply Latest Stash",
    contentType: "text",
    typeId: "type-command",
    collectionId: "coll-terminal-commands",
    content: "git stash pop",
  },
  {
    id: "item-docker-prune",
    title: "Clean Unused Docker Resources",
    contentType: "text",
    typeId: "type-command",
    collectionId: "coll-terminal-commands",
    content: "docker system prune -af --volumes",
  },
  {
    id: "item-kill-port",
    title: "Kill Process on Port",
    contentType: "text",
    typeId: "type-command",
    collectionId: "coll-terminal-commands",
    content: "lsof -ti :3000 | xargs kill -9",
  },
  {
    id: "item-npm-audit-fix",
    title: "Fix npm Vulnerabilities",
    contentType: "text",
    typeId: "type-command",
    collectionId: "coll-terminal-commands",
    content: "npm audit fix",
  },
  {
    id: "item-tailwind-docs",
    title: "Tailwind CSS Documentation",
    contentType: "text",
    typeId: "type-link",
    collectionId: "coll-design-resources",
    url: "https://tailwindcss.com/docs",
  },
  {
    id: "item-shadcn-ui",
    title: "shadcn/ui Components",
    contentType: "text",
    typeId: "type-link",
    collectionId: "coll-design-resources",
    url: "https://ui.shadcn.com/",
  },
  {
    id: "item-material-design",
    title: "Material Design 3",
    contentType: "text",
    typeId: "type-link",
    collectionId: "coll-design-resources",
    url: "https://m3.material.io/",
  },
  {
    id: "item-lucide-icons",
    title: "Lucide Icons",
    contentType: "text",
    typeId: "type-link",
    collectionId: "coll-design-resources",
    url: "https://lucide.dev/icons/",
  },
];

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_PRODUCTION_SEED !== "true"
  ) {
    throw new Error(
      "Refusing to seed production database. Set ALLOW_PRODUCTION_SEED=true to override.",
    );
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await bcrypt.hash("12345678", 12);

    await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      update: {
        name: "Demo User",
        password: passwordHash,
        isPro: true,
        emailVerified: new Date(),
      },
      create: {
        id: DEMO_USER_ID,
        email: DEMO_EMAIL,
        name: "Demo User",
        password: passwordHash,
        isPro: true,
        emailVerified: new Date(),
      },
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: DEMO_EMAIL },
    });

    for (const itemType of systemItemTypes) {
      await prisma.itemType.upsert({
        where: { id: itemType.id },
        update: {
          name: itemType.name,
          icon: itemType.icon,
          color: itemType.color,
          kind: itemType.kind,
          isSystem: true,
          userId: null,
        },
        create: {
          id: itemType.id,
          name: itemType.name,
          icon: itemType.icon,
          color: itemType.color,
          kind: itemType.kind,
          isSystem: true,
        },
      });
    }

    for (const collection of collections) {
      await prisma.collection.upsert({
        where: {
          userId_name: {
            userId: user.id,
            name: collection.name,
          },
        },
        update: {
          description: collection.description,
          isFavorite: collection.isFavorite,
        },
        create: {
          id: collection.id,
          name: collection.name,
          description: collection.description,
          isFavorite: collection.isFavorite,
          userId: user.id,
        },
      });
    }

    const seededCollections = await prisma.collection.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
    });
    const collectionIdByName = new Map(
      seededCollections.map((collection) => [collection.name, collection.id]),
    );

    for (const item of items) {
      const collectionName = collections.find(
        (collection) => collection.id === item.collectionId,
      )?.name;

      if (!collectionName) {
        throw new Error(`Unknown collection for item ${item.id}`);
      }

      const collectionId = collectionIdByName.get(collectionName);

      if (!collectionId) {
        throw new Error(`Collection not found for item ${item.id}`);
      }

      await prisma.item.upsert({
        where: { id: item.id },
        update: {
          title: item.title,
          contentType: item.contentType,
          content: item.content ?? null,
          url: item.url ?? null,
          description: item.description ?? null,
          language: item.language ?? null,
          typeId: item.typeId,
          userId: user.id,
          isPinned: item.isPinned ?? false,
        },
        create: {
          id: item.id,
          title: item.title,
          contentType: item.contentType,
          content: item.content ?? null,
          url: item.url ?? null,
          description: item.description ?? null,
          language: item.language ?? null,
          typeId: item.typeId,
          userId: user.id,
          isPinned: item.isPinned ?? false,
        },
      });

      await prisma.itemCollection.upsert({
        where: {
          itemId_collectionId: {
            itemId: item.id,
            collectionId,
          },
        },
        update: {},
        create: {
          itemId: item.id,
          collectionId,
        },
      });
    }

    console.log(`Seeded demo user (${DEMO_EMAIL})`);
    console.log(`Seeded ${systemItemTypes.length} system item types`);
    console.log(`Seeded ${collections.length} collections`);
    console.log(`Seeded ${items.length} items`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
