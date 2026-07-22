import "server-only";
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const fromName = process.env.MAIL_FROM_NAME ?? "Tikemia";
const fromEmail = process.env.MAIL_FROM_EMAIL;

if (!resendApiKey) {
  throw new Error("RESEND_API_KEY est absente.");
}

if (!fromEmail) {
  throw new Error("MAIL_FROM_EMAIL est absente.");
}

export const resend = new Resend(resendApiKey);

type VerificationEmailParams = {
  to: string;
  firstName: string;
  code: string;
};

export async function sendOrganizerVerificationEmail({
  to,
  firstName,
  code,
}: VerificationEmailParams) {
  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject: "Confirmez votre compte organisateur Tikemia",
    text: `Bonjour ${firstName}, votre code de confirmation Tikemia est ${code}. Il expire dans 10 minutes.`,
    html: `
      <div style="margin:0;background:#05090c;padding:32px 16px;font-family:Arial,sans-serif;color:#ffffff;">
        <div style="max-width:560px;margin:auto;border:1px solid #1f2933;border-radius:18px;background:#0b1217;overflow:hidden;">
          <div style="padding:26px 30px;border-bottom:1px solid #1f2933;">
            <strong style="font-size:24px;">TIKEMIA</strong>
          </div>

          <div style="padding:32px 30px;">
            <h1 style="margin:0 0 18px;font-size:24px;">
              Confirmez votre adresse e-mail
            </h1>

            <p style="margin:0 0 22px;color:#c4cbd1;line-height:1.7;">
              Bonjour ${firstName}, utilisez ce code pour finaliser la création
              de votre compte organisateur Tikemia.
            </p>

            <div style="padding:20px;text-align:center;border:1px solid #22c55e;border-radius:14px;background:#071d12;">
              <span style="font-size:34px;font-weight:800;letter-spacing:9px;color:#a3e635;">
                ${code}
              </span>
            </div>

            <p style="margin:22px 0 0;color:#8f9aa4;font-size:14px;line-height:1.6;">
              Ce code expire dans 10 minutes. Ne le partagez avec personne.
            </p>
          </div>
        </div>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Échec de l’envoi de l’e-mail : ${error.message}`);
  }

  return data;
}