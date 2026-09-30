import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteObjectsByPrefix } from "@/lib/r2/storage";
import {
  checkAccountDeletionRateLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit";
import { cancelSubscriptionIfActive } from "@/lib/stripe/subscription";

const deleteAccountSchema = z.object({
  password: z.string().optional(),
  confirmation: z.literal("DELETE"),
});

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkAccountDeletionRateLimit(session.user.id);

  if (!rateLimit.success) {
    return rateLimitedResponse(rateLimit);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = deleteAccountSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Type DELETE to confirm account deletion" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, stripeSubscriptionId: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.password) {
    if (!parsed.data.password) {
      return NextResponse.json(
        { error: "Current password is required to delete your account" },
        { status: 400 },
      );
    }

    const passwordValid = await bcrypt.compare(parsed.data.password, user.password);

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 },
      );
    }
  }

  if (user.stripeSubscriptionId) {
    try {
      await cancelSubscriptionIfActive(user.stripeSubscriptionId);
    } catch (error) {
      const alreadyGone =
        error instanceof Stripe.errors.StripeError &&
        error.code === "resource_missing";

      if (!alreadyGone) {
        console.error("Failed to cancel Stripe subscription:", error);
        return NextResponse.json(
          {
            error:
              "We could not cancel your subscription. Please try again or contact support before deleting your account.",
          },
          { status: 502 },
        );
      }
    }
  }

  const userId = session.user.id;

  await prisma.user.delete({
    where: { id: userId },
  });

  try {
    await deleteObjectsByPrefix(`users/${userId}/`);
  } catch (error) {
    console.error("Failed to delete user files from R2:", error);
  }

  return NextResponse.json({ success: true });
}
