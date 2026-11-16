export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/",
    "/publications/:path*",
    "/changes/:path*",
    "/reports/:path*",
    "/settings/:path*",
  ],
};
