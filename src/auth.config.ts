import type { NextAuthConfig } from "next-auth";
import Facebook from "next-auth/providers/facebook";
import TikTok from "next-auth/providers/tiktok";

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
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isOnOnboardingAdmin = nextUrl.pathname.startsWith("/onboarding/admin");
      const isOnAdmin = nextUrl.pathname.startsWith("/admin");

      if (isOnAdmin) {
        if (!isLoggedIn) return Response.redirect(new URL("/login", nextUrl));
        if (userRole !== "ADMIN") return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }

      if (isOnDashboard || isOnOnboardingAdmin) {
        if (isLoggedIn) return true;
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
        session.user.role = token.role as "USER" | "ADMIN";
      }
      return session;
    },
  },
  providers: [
    Facebook({
      clientId: process.env.META_CLIENT_ID,
      clientSecret: process.env.META_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "public_profile",
        },
      },
    }),
    TikTok({
      clientId: process.env.TIKTOK_CLIENT_KEY,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    }),
  ],
} satisfies NextAuthConfig;
