export const ADMIN_SESSION_COOKIE_NAME =
  process.env.ADMIN_SESSION_COOKIE_NAME?.trim() ||
  "tikemia_admin_session";

const configuredSessionMaxAge = Number(
  process.env.ADMIN_SESSION_MAX_AGE ?? 60 * 60 * 8,
);

export const ADMIN_SESSION_MAX_AGE =
  Number.isFinite(configuredSessionMaxAge) &&
  configuredSessionMaxAge > 0
    ? configuredSessionMaxAge
    : 60 * 60 * 8;