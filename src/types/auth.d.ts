import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface User extends DefaultUser {
    role: "USER" | "TEAM_ADMIN" | "ADMIN";
    plan: "CALENDAR_ONLY" | "PRO";
    accountStatus: string;
    isBeta?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: "USER" | "TEAM_ADMIN" | "ADMIN";
      plan: "CALENDAR_ONLY" | "PRO";
      accountStatus: string;
      isBeta?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "USER" | "TEAM_ADMIN" | "ADMIN";
    plan?: "CALENDAR_ONLY" | "PRO";
    accountStatus?: string;
    internalTag?: string | null;
    sessionExpiry?: number;
    tokenVersion?: number;
  }
}
