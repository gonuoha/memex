import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  ActiveSubscriptionError,
  createCheckoutSession,
} from "@/lib/stripe/subscription";

const bodySchema = z.object({
  period: z.enum(["monthly", "yearly"]),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid billing period" }, { status: 400 });
  }

  try {
    const url = await createCheckoutSession(
      session.user.id,
      session.user.email,
      parsed.data.period,
    );

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof ActiveSubscriptionError) {
      return NextResponse.json(
        {
          error:
            "You already have an active Pro subscription. Manage billing in settings.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
