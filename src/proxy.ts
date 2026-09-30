import { NextResponse } from "next/server";

import { auth } from "@/auth";

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isAuthPage =
    pathname === "/sign-in" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";
  const isDashboard = pathname.startsWith("/dashboard");
  const isProfile = pathname === "/profile";
  const isSettings = pathname === "/settings";
  const isItems = pathname.startsWith("/items");
  const isCollections = pathname.startsWith("/collections");
  const isFavorites = pathname.startsWith("/favorites");
  const isUpgrade = pathname === "/upgrade";
  const isTrash = pathname === "/trash";

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  if (
    (isDashboard ||
      isProfile ||
      isSettings ||
      isItems ||
      isCollections ||
      isFavorites ||
      isUpgrade ||
      isTrash) &&
    !isLoggedIn
  ) {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    signInUrl.searchParams.set(
      "callbackUrl",
      `${req.nextUrl.pathname}${req.nextUrl.search}`,
    );

    return NextResponse.redirect(signInUrl);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(
    "x-pathname",
    `${req.nextUrl.pathname}${req.nextUrl.search}`,
  );

  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/sign-in",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/profile",
    "/settings",
    "/items",
    "/items/:path*",
    "/collections",
    "/collections/:path*",
    "/favorites",
    "/favorites/:path*",
    "/upgrade",
    "/trash",
  ],
};
