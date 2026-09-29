import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";

import authConfig from "@/auth.config";
import { isEmailVerificationEnabled } from "@/lib/email/config";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/validate-email";

const FOURTEEN_DAYS_SECONDS = 14 * 24 * 60 * 60;
const ONE_DAY_SECONDS = 24 * 60 * 60;

/** Bcrypt hash of a dummy password used for constant-time credential checks. */
const DUMMY_PASSWORD_HASH =
  "$2b$12$snrd7BOi543ToZaxt/RCVuZ3dR8L4gVDbd/Tw97B4qAi3rpGSEKBO";

export const { handlers, auth, signIn } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: FOURTEEN_DAYS_SECONDS,
    updateAge: ONE_DAY_SECONDS,
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    GitHub,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const normalizedEmail = normalizeEmail(email);

        const user = await prisma.user.findFirst({
          where: { email: { equals: normalizedEmail, mode: "insensitive" } },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            password: true,
          },
        });

        const passwordHash = user?.password ?? DUMMY_PASSWORD_HASH;
        const isValid = await bcrypt.compare(password, passwordHash);

        if (!user?.password || !isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "credentials" && user.id && isEmailVerificationEnabled()) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { emailVerified: true },
        });

        if (!dbUser?.emailVerified) {
          return "/sign-in?error=email_not_verified";
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { isPro: true, sessionVersion: true },
        });

        if (!dbUser) {
          return null;
        }

        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
        token.isPro = dbUser.isPro;
        token.sessionVersion = dbUser.sessionVersion;
        return token;
      }

      if (!token.sub) {
        return token;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { isPro: true, sessionVersion: true },
      });

      if (!dbUser) {
        return null;
      }

      if (
        token.sessionVersion !== undefined &&
        token.sessionVersion !== dbUser.sessionVersion
      ) {
        return null;
      }

      token.isPro = dbUser.isPro;
      token.sessionVersion = dbUser.sessionVersion;

      return token;
    },
    async session({ session, token }) {
      if (!token.sub) {
        return session;
      }

      if (session.user) {
        session.user.id = token.sub;
        session.user.name = (token.name as string | null | undefined) ?? session.user.name;
        session.user.email = (token.email as string | null | undefined) ?? session.user.email;
        session.user.image = (token.picture as string | null | undefined) ?? session.user.image;
        session.user.isPro = (token.isPro as boolean | undefined) ?? false;
      }

      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (account?.provider === "github" && user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
      }
    },
  },
});
