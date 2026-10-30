import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfiguration } from "@/lib/config/environment.server";
import type { Database } from "@/types/database";
import { publicBookingConfig } from "@/lib/public-booking/config";
import {
  mintVisitor,
  verifyVisitor,
  visitorCookie,
} from "@/lib/public-booking/visitor";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const noCache = () => {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  };
  const redirectToLogin = () => {
    const redirect = NextResponse.redirect(new URL("/ingresar", request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    response = redirect;
    return noCache();
  };
  const privateRoute =
    request.nextUrl.pathname.startsWith("/panel") ||
    request.nextUrl.pathname.startsWith("/admin");
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith("/b/") ||
    pathname === "/reserva" ||
    pathname === "/tarjeta" ||
    pathname.startsWith("/api/loyalty/") ||
    pathname.startsWith("/api/public-booking/")
  ) {
    const config = publicBookingConfig();
    if (
      config &&
      !verifyVisitor(request.cookies.get(visitorCookie)?.value, config.secret)
    ) {
      const value = mintVisitor(config.secret);
      request.cookies.set(visitorCookie, value);
      response = NextResponse.next({ request });
      response.cookies.set(visitorCookie, value, {
        httpOnly: true,
        sameSite: "lax",
        secure: config.secure,
        path: "/",
        maxAge: 7 * 86400,
      });
    }
    return noCache();
  }
  const configuration = getSupabaseConfiguration();
  if (!configuration) return privateRoute ? redirectToLogin() : noCache();
  const supabase = createServerClient<Database>(
    configuration.url,
    configuration.key,
    {
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(configuration.appUrl).protocol === "https:",
        path: "/",
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          const previousCookies = response.cookies.getAll();
          response = NextResponse.next({ request });
          previousCookies.forEach((cookie) => response.cookies.set(cookie));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );
  // El proxy mantiene cookies; cada página/acción verifica identidad y permisos otra vez.
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (privateRoute && (error || !data?.claims)) return redirectToLogin();
  } catch {
    if (privateRoute) return redirectToLogin();
  }
  return noCache();
}

export const config = {
  matcher: [
    "/panel/:path*",
    "/admin/:path*",
    "/ingresar",
    "/registro",
    "/auth/:path*",
    "/invitacion",
    "/b/:path*",
    "/reserva",
    "/tarjeta",
    "/api/loyalty/:path*",
    "/api/public-booking/:path*",
  ],
};
