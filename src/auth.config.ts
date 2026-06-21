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
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isOnAdmin = nextUrl.pathname.startsWith("/onboarding/admin");

      if (isOnDashboard || isOnAdmin) {
        if (isLoggedIn) return true;
        return false;
      }

      return true;
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
      clientId: process.env.AUTH_TIKTOK_ID,
      clientSecret: process.env.AUTH_TIKTOK_SECRET,
    }),
  ],
} satisfies NextAuthConfig;
