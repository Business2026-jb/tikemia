import "server-only";

import { sendEmail } from "@/lib/mail/send-email";

type SendOrganizerVerificationEmailParams = {
  to: string;
  firstName: string;
  code: string;
  verificationId: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getVerificationTtlMinutes(): number {
  const value = Number(
    process.env.EMAIL_VERIFICATION_CODE_TTL_MINUTES ?? "10",
  );

  if (!Number.isInteger(value) || value < 1 || value > 60) {
    return 10;
  }

  return value;
}

export async function sendOrganizerVerificationEmail({
  to,
  firstName,
  code,
  verificationId,
}: SendOrganizerVerificationEmailParams) {
  const cleanEmail = to.trim().toLowerCase();
  const cleanFirstName = firstName.trim();
  const cleanCode = code.trim();
  const cleanVerificationId = verificationId.trim();
  const ttlMinutes = getVerificationTtlMinutes();

  if (!cleanEmail) {
    throw new Error("L’adresse e-mail du destinataire est manquante.");
  }

  if (!cleanFirstName) {
    throw new Error("Le prénom du destinataire est manquant.");
  }

  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error(
      "Le code de confirmation doit contenir exactement 6 chiffres.",
    );
  }

  if (!cleanVerificationId) {
    throw new Error("L’identifiant de vérification est manquant.");
  }

  const safeFirstName = escapeHtml(cleanFirstName);
  const safeCode = escapeHtml(cleanCode);

  return sendEmail({
    category: "verification",
    to: cleanEmail,
    subject: "Confirmez votre compte organisateur Tikemia",

    text: [
      `Bonjour ${cleanFirstName},`,
      "",
      `Votre code de confirmation Tikemia est : ${cleanCode}`,
      "",
      `Ce code expire dans ${ttlMinutes} minutes.`,
      "Ne le communiquez à personne.",
    ].join("\n"),

    idempotencyKey: `organizer-verification-${cleanVerificationId}`,

    html: `
      <!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Confirmation du compte organisateur Tikemia</title>
        </head>

        <body style="margin:0;padding:0;background:#030709;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
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
                        Espace organisateur
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
                        Confirmez votre adresse e-mail
                      </h1>

                      <p
                        style="
                          margin:18px 0 0;
                          font-size:15px;
                          line-height:1.7;
                          color:#c4cbd1;
                        "
                      >
                        Bonjour ${safeFirstName}, utilisez le code ci-dessous
                        pour finaliser la création de votre compte organisateur.
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
                            line-height:1.6;
                            color:#68737d;
                          "
                        >
                          Vous recevez cet e-mail parce qu’une inscription
                          organisateur a été commencée avec cette adresse.
                          Si vous n’êtes pas à l’origine de cette demande,
                          ignorez simplement ce message.
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
                  © ${new Date().getFullYear()} Tikemia. Tous droits réservés.
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });
}