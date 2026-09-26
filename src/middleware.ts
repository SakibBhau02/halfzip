import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const path = req.nextUrl.pathname;
    const role = req.nextauth.token?.role;

    // Admin area
    if (path.startsWith("/admin")) {
      if (path === "/admin/login") return NextResponse.next();
      if (role !== "ADMIN") {
        return NextResponse.redirect(new URL("/admin/login", req.url));
      }
    }

    // Supplier area
    if (path.startsWith("/supplier")) {
      if (path === "/supplier/login") return NextResponse.next();
      if (role !== "SUPPLIER") {
        return NextResponse.redirect(new URL("/supplier/login", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        // Public login pages are always allowed
        if (path === "/admin/login" || path === "/supplier/login") return true;
        // Protected areas require a token (role enforced in middleware above)
        if (path.startsWith("/admin") || path.startsWith("/supplier")) {
          return !!token;
        }
        return true;
      },
    },
    pages: { signIn: "/admin/login" },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/supplier/:path*"],
};
