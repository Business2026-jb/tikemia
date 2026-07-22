import "server-only";

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY?.trim();

if (!apiKey) {
  throw new Error("La variable RESEND_API_KEY est absente.");
}

export const resend = new Resend(apiKey);