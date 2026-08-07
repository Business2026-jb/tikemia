import "server-only";

import {
  ScannerAuthenticationError,
  ScannerAuthorizationError,
} from "@/lib/scanner/scanner-errors";
import {
  getScannerSession,
  type ScannerSession,
} from "@/lib/scanner/get-scanner-session";

export async function requireScanner():
  Promise<ScannerSession> {
  const session =
    await getScannerSession();

  if (!session) {
    throw new ScannerAuthenticationError(
      "Connectez-vous avec un compte organisateur Tikemia ou un compte scanner autorisé.",
    );
  }

  if (
    !session.user.isActive ||
    !session.user.emailVerified
  ) {
    throw new ScannerAuthorizationError(
      "Ce compte n’est pas autorisé à accéder au scanner Tikemia.",
      {
        userId:
          session.user.id,

        role:
          session.user.role,
      },
    );
  }

  if (
    session.user.role !==
      "ORGANIZER" &&
    session.user.role !==
      "SCANNER"
  ) {
    throw new ScannerAuthorizationError(
      "Ce compte ne possède pas un rôle autorisé pour le contrôle d’accès.",
      {
        userId:
          session.user.id,

        role:
          session.user.role,
      },
    );
  }

  return session;
}
