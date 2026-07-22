import "server-only";

import { sendEmail } from "@/lib/mail/send-email";

type SendOrganizerPasswordResetEmailParams = {
  to: string;
  firstName: string;
  code: string;
  passwordResetId: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPasswordResetTtlMinutes(): number {
  const value = Number(
    process.env.PASSWORD_RESET_CODE_TTL_MINUTES ?? "10",
  );

  if (!Number.isInteger(value) || value < 1 || value > 60) {
    return 10;
  }

  return value;
}

export async function sendOrganizerPasswordResetEmail({
  to,
  firstName,
  code,
  passwordResetId,
}: SendOrganizerPasswordResetEmailParams) {
  const cleanEmail = to.trim().toLowerCase();
  const cleanFirstName = firstName.trim();
  const cleanCode = code.trim();
  const cleanPasswordResetId = passwordResetId.trim();
  const ttlMinutes = getPasswordResetTtlMinutes();

  if (!cleanEmail) {
    throw new Error("L’adresse e-mail du destinataire est manquante.");
  }

  if (!cleanFirstName) {
    throw new Error("Le prénom du destinataire est manquant.");
  }

  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error(
      "Le code de réinitialisation doit contenir exactement 6 chiffres.",
    );
  }

  if (!cleanPasswordResetId) {
    throw new Error(
      "L’identifiant de réinitialisation est manquant.",
    );
  }

  const safeFirstName = escapeHtml(cleanFirstName);
  const safeCode = escapeHtml(cleanCode);

  return sendEmail({
    category: "security",
    to: cleanEmail,
    subject: "Réinitialisez votre mot de passe Tikemia",

    text: [
      `Bonjour ${cleanFirstName},`,
      "",
      "Une demande de réinitialisation du mot de passe de votre compte organisateur Tikemia a été effectuée.",
      "",
      `Votre code de réinitialisation est : ${cleanCode}`,
      "",
      `Ce code expire dans ${ttlMinutes} minutes.`,
      "Ne communiquez ce code à personne.",
      "",
      "Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.",
    ].join("\n"),

    idempotencyKey: `organizer-password-reset-${cleanPasswordResetId}`,

    html: `
      <!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />
          <title>Réinitialisation du mot de passe Tikemia</title>
        </head>

        <body
          style="
            margin:0;
            padding:0;
            background:#030709;
            font-family:Arial,Helvetica,sans-serif;
            color:#ffffff;
          "
        >
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="width:100%;background:#030709;"
          >
            <tr>
              <td align="center" style="padding:32px 16px;">
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    width:100%;
                    max-width:560px;
                    background:#081015;
                    border:1px solid #1f2933;
                    border-radius:20px;
                    overflow:hidden;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding:26px 30px;
                        border-bottom:1px solid #1f2933;
                      "
                    >
                      <div
                        style="
                          font-size:24px;
                          font-weight:900;
                          letter-spacing:1px;
                          color:#ffffff;
                        "
                      >
                        TIKEMIA
                      </div>

                      <div
                        style="
                          margin-top:5px;
                          font-size:12px;
                          color:#a3e635;
                        "
                      >
                        Sécurité du compte organisateur
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:32px 30px;">
                      <h1
                        style="
                          margin:0;
                          font-size:26px;
                          line-height:1.25;
                          color:#ffffff;
                        "
                      >
                        Réinitialisez votre mot de passe
                      </h1>

                      <p
                        style="
                          margin:18px 0 0;
                          font-size:15px;
                          line-height:1.7;
                          color:#c4cbd1;
                        "
                      >
                        Bonjour ${safeFirstName}, utilisez le code
                        ci-dessous pour créer un nouveau mot de passe
                        pour votre compte organisateur.
                      </p>

                      <div
                        style="
                          margin:26px 0;
                          padding:22px 16px;
                          text-align:center;
                          background:#071d12;
                          border:1px solid #22c55e;
                          border-radius:14px;
                        "
                      >
                        <span
                          style="
                            display:inline-block;
                            font-size:34px;
                            line-height:1;
                            font-weight:900;
                            letter-spacing:9px;
                            color:#a3e635;
                          "
                        >
                          ${safeCode}
                        </span>
                      </div>

                      <p
                        style="
                          margin:0;
                          font-size:14px;
                          line-height:1.7;
                          color:#8f9aa4;
                        "
                      >
                        Ce code expire dans ${ttlMinutes} minutes.
                        Ne le communiquez à personne.
                      </p>

                      <div
                        style="
                          margin-top:26px;
                          padding-top:22px;
                          border-top:1px solid #1f2933;
                        "
                      >
                        <p
                          style="
                            margin:0;
                            font-size:12px;
                            line-height:1.7;
                            color:#68737d;
                          "
                        >
                          Si vous n’avez pas demandé la modification de
                          votre mot de passe, ignorez cet e-mail. Votre
                          compte restera inchangé.
                        </p>
                      </div>
                    </td>
                  </tr>
                </table>

                <p
                  style="
                    margin:18px 0 0;
                    font-size:12px;
                    color:#59636c;
                  "
                >
                  © ${new Date().getFullYear()} Tikemia. Tous droits
                  réservés.
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });
}