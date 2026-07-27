import {
  redirect,
} from "next/navigation";

import {
  getClientSession,
  type ClientSessionData,
} from "@/lib/client/auth/get-client-session";

function normalizeRedirectPath(
  redirectTo:
    | string
    | undefined,
): string {
  if (
    !redirectTo ||
    !redirectTo.startsWith(
      "/",
    ) ||
    redirectTo.startsWith(
      "//",
    )
  ) {
    return "/account/tickets";
  }

  return redirectTo;
}

export async function requireClient(
  redirectTo =
    "/account/tickets",
): Promise<ClientSessionData> {
  const session =
    await getClientSession();

  if (!session) {
    const safeRedirectTo =
      normalizeRedirectPath(
        redirectTo,
      );

    redirect(
      `/login?redirect=${encodeURIComponent(
        safeRedirectTo,
      )}`,
    );
  }

  return session;
}