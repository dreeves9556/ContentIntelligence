import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface User extends DefaultUser {
    role: "USER" | "ADMIN";
    plan: "CALENDAR_ONLY" | "CREATOR" | "PRO";
  }

  interface Session {
    user: {
      id: string;
      role: "USER" | "ADMIN";
      plan: "CALENDAR_ONLY" | "CREATOR" | "PRO";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "USER" | "ADMIN";
    plan?: "CALENDAR_ONLY" | "CREATOR" | "PRO";
  }
}
