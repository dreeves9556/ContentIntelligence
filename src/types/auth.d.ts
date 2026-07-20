import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface User extends DefaultUser {
    role: "USER" | "TEAM_ADMIN" | "ADMIN";
    plan: "CALENDAR_ONLY" | "CREATOR" | "PRO";
    accountStatus: string;
  }

  interface Session {
    user: {
      id: string;
      role: "USER" | "TEAM_ADMIN" | "ADMIN";
      plan: "CALENDAR_ONLY" | "CREATOR" | "PRO";
      accountStatus: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "USER" | "TEAM_ADMIN" | "ADMIN";
    plan?: "CALENDAR_ONLY" | "CREATOR" | "PRO";
    accountStatus?: string;
    sessionExpiry?: number;
    tokenVersion?: number;
  }
}
