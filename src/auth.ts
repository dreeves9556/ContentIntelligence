import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { prisma } from "./lib/prisma";
import { checkRateLimit, recordFailedAttempt, clearRateLimit, formatRetryTime } from "./lib/rate-limiter";

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Remember Me", type: "text" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const rateLimitKey = `login:${email.toLowerCase()}`;

        const rateCheck = checkRateLimit(rateLimitKey, LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_MS);
        if (!rateCheck.allowed) {
          throw new Error(`Too many login attempts. Try again in ${formatRetryTime(rateCheck.retryAfterMs!)}.`);
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          recordFailedAttempt(rateLimitKey, LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_MS);
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          recordFailedAttempt(rateLimitKey, LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_MS);
          return null;
        }

        clearRateLimit(rateLimitKey);

        const rememberMe = credentials?.rememberMe === "true";
        const sessionExpiry = Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          plan: user.plan,
          sessionExpiry,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.plan = (user as { plan?: string }).plan as "CALENDAR_ONLY" | "CREATOR" | "PRO" | undefined;
        token.sessionExpiry = (user as { sessionExpiry?: number }).sessionExpiry;
        token.tokenVersion = (user as { tokenVersion?: number }).tokenVersion;
      }

      if (account?.provider && account.access_token) {
        token[`${account.provider}_access_token`] = account.access_token;
      }

      // Always refresh role/plan/tokenVersion from DB so changes take effect immediately
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, plan: true, tokenVersion: true },
          });
          if (dbUser) {
            // Invalidate token if tokenVersion has changed (e.g. password reset)
            if (token.tokenVersion !== undefined && dbUser.tokenVersion !== token.tokenVersion) {
              return { ...token, id: undefined, sessionExpiry: 0 } as typeof token;
            }
            token.role = dbUser.role;
            token.plan = dbUser.plan;
            token.tokenVersion = dbUser.tokenVersion;
          }
        } catch {
          // silently fail — keep existing token values
        }
      }

      return token;
    },
    session({ session, token }) {
      if (token) {
        const sessionExpiry = token.sessionExpiry as number | undefined;
        const isExpired = sessionExpiry ? Date.now() > sessionExpiry : false;

        if (isExpired) {
          return {
            ...session,
            user: { ...session.user, id: undefined as unknown as string },
          } as typeof session;
        }

        session.user.id = token.id as string;
        session.user.role = token.role as "USER" | "ADMIN";
        session.user.plan = (token.plan ?? "CREATOR") as "CALENDAR_ONLY" | "CREATOR" | "PRO";
        (session.user as { sessionExpiry?: number }).sessionExpiry = sessionExpiry;
      }
      return session;
    },
  },
});
