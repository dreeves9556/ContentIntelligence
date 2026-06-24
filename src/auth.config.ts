import type { NextAuthConfig } from "next-auth";

// Edge-safe config: no Prisma, no bcrypt.
// Credentials provider and all DB callbacks live in auth.ts (Node.js only).
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const userRole = (auth?.user as { role?: string })?.role;
      const sessionExpiry = (auth?.user as { sessionExpiry?: number } | undefined)?.sessionExpiry;
      const isExpired = sessionExpiry ? Date.now() > sessionExpiry : false;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isOnOnboarding = nextUrl.pathname.startsWith("/onboarding");
      const isOnAdmin = nextUrl.pathname.startsWith("/admin");

      if (isOnAdmin) {
        if (!isLoggedIn || isExpired) return Response.redirect(new URL("/login", nextUrl));
        if (userRole !== "ADMIN") return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }

      if (isOnDashboard || isOnOnboarding) {
        if (isLoggedIn && !isExpired) return true;
        return false;
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
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

        session.user.role = token.role as "USER" | "ADMIN";
        (session.user as { sessionExpiry?: number }).sessionExpiry = sessionExpiry;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
