/**
 * ============================================================
 * TIKEMIA - CONFIGURATION GLOBALE
 * ============================================================
 */

function required(name: string): string {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }

  return value;
}

function optional(name: string, defaultValue = ""): string {
  return process.env[name] ?? defaultValue;
}

export const config = {
  app: {
    name: optional("APP_NAME", "Tikemia"),
    env: optional("APP_ENV", "development"),
    url: required("APP_URL"),
  },

  database: {
    url: required("DATABASE_URL"),
    directUrl: optional("DIRECT_URL"),
  },

  resend: {
    apiKey: required("RESEND_API_KEY"),
  },

  mail: {
    verification: required("MAIL_FROM_VERIFICATION"),
    tickets: required("MAIL_FROM_TICKETS"),
    payments: required("MAIL_FROM_PAYMENTS"),
    organizers: required("MAIL_FROM_ORGANIZERS"),
    security: required("MAIL_FROM_SECURITY"),
    support: required("MAIL_FROM_SUPPORT"),
    replyTo: required("MAIL_REPLY_TO_SUPPORT"),
  },

  auth: {
    sessionCookie: optional(
      "SESSION_COOKIE_NAME",
      "tikemia_session"
    ),

    sessionSecret: required("SESSION_SECRET"),

    verificationCodeTtlMinutes: Number(
      optional("EMAIL_VERIFICATION_CODE_TTL_MINUTES", "10")
    ),

    verificationMaxAttempts: Number(
      optional("EMAIL_VERIFICATION_MAX_ATTEMPTS", "5")
    ),

    verificationResendDelaySeconds: Number(
      optional("EMAIL_VERIFICATION_RESEND_DELAY_SECONDS", "60")
    ),

    bcryptSaltRounds: Number(
      optional("BCRYPT_SALT_ROUNDS", "12")
    ),
  },
} as const;

export default config;