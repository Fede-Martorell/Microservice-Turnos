"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cardCookie } from "./schema";
export async function closeLoyaltyCard() {
  (await cookies()).set(cardCookie, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/tarjeta",
    maxAge: 0,
  });
  redirect("/tarjeta");
}
