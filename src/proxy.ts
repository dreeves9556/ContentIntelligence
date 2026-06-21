import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth(() => {
  return;
});

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/admin", "/admin/:path*"],
};
