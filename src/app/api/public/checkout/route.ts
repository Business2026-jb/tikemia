import { createClient } from "@supabase/supabase-js";
import { getPlatformPrisma } from "@/lib/payments/fulfillment";
import { getPublicPaymentMethods } from "@/lib/payments/methods";
import { unstable_rethrow } from "next/navigation";

import {
  createHmac,
  createHash,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";



import {
  PrismaClient,
} from "@/generated/prisma/client";

import {
  parsePhoneNumberFromString,
} from "libphonenumber-js";

/*
  TIKEMIA — CHECKOUT PUBLIC

  GET  : Commande + moyens de paiement
  POST : Enregistrer les coordonnées

  Tous les moyens sont fournis
  exclusivement par TIKEMIA Pay.

  Aucun agrégateur direct.
  Aucun opérateur codé en dur.
  Aucun paiement simulé.
*/

const CHECKOUT_CONTEXT =
  "tikemia:checkout-authorization:v1";

const CHECKOUT_VALIDITY_MS =
  30 * 60 * 1000;

const MAX_BODY_BYTES = 4096;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TOKEN_REGEX = /^[0-9a-f]{64}$/i;

type Locale = "fr" | "en";
type CheckoutType = "tickets" | "donation";

type CheckoutInput = {
  type?: unknown;
  orderId?: unknown;
  donationId?: unknown;
  checkoutToken?: unknown;
  countryCode?: unknown;
  email?: unknown;
  phoneE164?: unknown;
  locale?: unknown;
};

type Resource = {
  type: CheckoutType;
  id: string;
  createdAt: Date;
  subtotal: bigint;
  fee: bigint;
  total: bigint;
  currency: string;
  email: string | null;
  phoneE164: string | null;
  item: Record<string, unknown>;
};

type PaymentMethod = {
  id: string;
  name: string;
  type: string;
  logoUrl: string | null;
  description: string | null;
};

type CountryResult = {
  countryCode: string | null;
  source: "selected" | "ip" | "unknown";
};

const MESSAGES = {
  fr: {
    invalid: "Demande invalide.",
    unauthorized: "Commande non autorisée.",
    unavailable: "Service indisponible.",
    invalidAmount: "Montant invalide.",
    invalidEmail: "Email invalide.",
    invalidPhone: "Téléphone invalide.",
    locked: "Paiement déjà commencé.",
  },

  en: {
    invalid: "Invalid request.",
    unauthorized: "Unauthorized checkout.",
    unavailable: "Service unavailable.",
    invalidAmount: "Invalid amount.",
    invalidEmail: "Invalid email.",
    invalidPhone: "Invalid phone number.",
    locked: "Payment already started.",
  },
} as const;

type ErrorCode = keyof typeof MESSAGES.fr;

/* ============================================
   PRISMA
============================================ */



function getPrisma(): PrismaClient { return getPlatformPrisma(); }

/* ============================================
   RÉPONSES
============================================ */

function respond(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control":
        "private, no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
    },
  });
}

function fail(
  locale: Locale,
  code: ErrorCode,
  status: number
) {
  return respond(
    {
      success: false,
      code,
      message: MESSAGES[locale][code],
    },
    status
  );
}

/* ============================================
   VALIDATIONS
============================================ */

function readLocale(value: unknown): Locale {
  return value === "en" ? "en" : "fr";
}

function readType(
  value: unknown
): CheckoutType | null {
  return value === "tickets" ||
    value === "donation"
    ? value
    : null;
}

function readResourceId(
  type: CheckoutType,
  input: CheckoutInput
): string | null {
  const id =
    type === "tickets"
      ? input.orderId
      : input.donationId;

  return typeof id === "string" &&
    UUID_REGEX.test(id)
    ? id
    : null;
}

function normalizeEmail(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();

  return (
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    ? email
    : null;
}

function normalizePhone(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const phone = parsePhoneNumberFromString(
      value.trim()
    );

    return phone?.isValid()
      ? phone.number
      : null;
  } catch {
    return null;
  }
}

function normalizeCountry(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z]{2}$/.test(value)
  ) {
    return null;
  }

  const code = value.toUpperCase();

  if (code === "XX" || code === "ZZ") {
    return null;
  }

  try {
    const name = new Intl.DisplayNames(
      ["en"],
      { type: "region" }
    ).of(code);

    return name && name !== code
      ? code
      : null;
  } catch {
    return null;
  }
}

function detectCountry(
  request: NextRequest,
  selected: unknown
): CountryResult {
  const manual = normalizeCountry(selected);

  if (manual) {
    return {
      countryCode: manual,
      source: "selected",
    };
  }

  /*
    Ces en-têtes doivent provenir
    du proxy d'hébergement fiable.

    Ne pas accepter un en-tête pays
    arbitraire d'un client si le
    serveur est directement exposé.
  */

  for (const header of [
    "x-vercel-ip-country",
    "cf-ipcountry",
  ]) {
    const country = normalizeCountry(
      request.headers.get(header)
    );

    if (country) {
      return {
        countryCode: country,
        source: "ip",
      };
    }
  }

  return {
    countryCode: null,
    source: "unknown",
  };
}

function validOrigin(request: NextRequest) {
  if (
    request.headers.get("sec-fetch-site") ===
    "cross-site"
  ) {
    return false;
  }

  const origin = request.headers.get("origin");

  return !origin ||
    origin === request.nextUrl.origin;
}

/* ============================================
   FRAIS

   Billets : 2 %
   Dons : 1 %

   Calcul en unités mineures.
============================================ */

function calculateFee(
  amount: bigint,
  basisPoints: bigint
): bigint {
  if (amount <= 0n) {
    throw new Error("INVALID_AMOUNT");
  }

  return (
    amount * basisPoints + 5000n
  ) / 10000n;
}

/* ============================================
   IMAGES PUBLIQUES
============================================ */

async function publicImage(
  value: string | null | undefined,
  bucket: string
): Promise<string | null> {
  if (!value) return null;

  const source = value.trim();
  if (/^[a-zA-Z0-9_/-]+\.(?:jpe?g|png|webp)$/i.test(source) && !source.startsWith("/") && !source.split("/").includes("..")) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    try {
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000), cache: "no-store" }) } });
      const { data, error } = await client.storage.from(bucket).createSignedUrl(source, 300);
      return error ? null : data.signedUrl;
    } catch { return null; }
  }

  if (
    source.startsWith("/") &&
    !source.startsWith("//") &&
    !source.includes("\\") &&
    !/[\u0000-\u001f]/.test(source)
  ) {
    return source;
  }

  try {
    const url = new URL(source);

    return url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/* ============================================
   AUTORISATION CHECKOUT

   Compatible avec checkout/pay.

   Le jeton doit être généré par
   le système qui crée la commande.
============================================ */

function checkoutSecret(): string {
  const secret =
    process.env.TIKEMIA_CHECKOUT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("CHECKOUT_SECRET_MISSING");
  }

  return secret;
}

function createCheckoutToken(
  resource: Resource
): string {
  const hmac = createHmac(
    "sha256",
    checkoutSecret()
  );

  const parts = [
    CHECKOUT_CONTEXT,
    resource.type,
    resource.id,
    resource.total.toString(),
    resource.currency,
    resource.createdAt.toISOString(),
  ];

  for (const part of parts) {
    hmac.update(part);
    hmac.update("\0");
  }

  return hmac.digest("hex");
}

function verifyCheckoutToken(
  token: unknown,
  resource: Resource
): boolean {
  if (
    typeof token !== "string" ||
    !TOKEN_REGEX.test(token)
  ) {
    return false;
  }

  if (
    Date.now() >
    resource.createdAt.getTime() +
      CHECKOUT_VALIDITY_MS
  ) {
    return false;
  }

  const expected = createCheckoutToken(resource);

  return timingSafeEqual(
    Buffer.from(token, "hex"),
    Buffer.from(expected, "hex")
  );
}

/* ============================================
   LECTURE DES BILLETS / DONS

   Aucun montant provenant du client.
============================================ */

async function readResource(
  prisma: PrismaClient,
  type: CheckoutType,
  id: string
): Promise<Resource | null> {
  if (type === "tickets") {
    const context = await prisma.appSetting.findUnique({ where: { key: "checkout:order:" + id }, select: { value: true } });
    const scheduleId = context?.value && typeof context.value === "object" && !Array.isArray(context.value) && typeof context.value.scheduleId === "string" ? context.value.scheduleId : null;
    const order =
      await prisma.order.findUnique({
        where: { id },

        select: {
          id: true,
          status: true,
          guestEmail: true,
          guestPhoneE164: true,
          currency: true,
          subtotal: true,
          serviceFee: true,
          total: true,
          createdAt: true,

          lines: {
            select: {
              id: true,
              quantity: true,
              categoryName: true,
              eventTitle: true,
              unitPrice: true,
              subtotal: true,
              currency: true,

              event: {
                select: {
                  id: true,
                  slug: true,
                  title: true,
                  status: true,
                  timeZone: true,

                  venue: {
                    select: {
                      name: true,
                      address: true,
                      city: true,
                      country: true,
                    },
                  },

                  images: {
                    take: 1,
                    orderBy: [
                      { isPrimary: "desc" },
                      { position: "asc" },
                    ],
                    select: {
                      storageKey: true,
                    },
                  },

                  schedules: {
                    where: scheduleId ? { id: scheduleId } : undefined,
                    take: 1,
                    orderBy: {
                      startsAt: "asc",
                    },
                    select: {
                      startsAt: true,
                      endsAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!order || order.status !== "PENDING") {
      return null;
    }

    const subtotal = order.lines.reduce(
      (sum, line) => {
        if (
          line.quantity <= 0 ||
          line.unitPrice < 0n ||
          line.currency !== order.currency ||
          line.subtotal !==
            line.unitPrice * BigInt(line.quantity) ||
          line.event.status !== "PUBLISHED"
        ) {
          throw new Error("INVALID_AMOUNT");
        }

        return sum + line.subtotal;
      },
      0n
    );

    if (
      order.lines.length === 0 ||
      subtotal !== order.subtotal
    ) {
      throw new Error("INVALID_AMOUNT");
    }

    const fee = calculateFee(subtotal, 200n);

    if (
      order.serviceFee !== fee ||
      order.total !== subtotal + fee
    ) {
      throw new Error("INVALID_AMOUNT");
    }

    return {
      type,
      id: order.id,
      createdAt: order.createdAt,
      subtotal,
      fee,
      total: order.total,
      currency: order.currency,
      email: order.guestEmail || null,
      phoneE164: order.guestPhoneE164,

      item: {
        type: "tickets",

        lines: await Promise.all(order.lines.map(async (line) => ({
          id: line.id,
          title: line.eventTitle,
          category: line.categoryName,
          quantity: line.quantity,

          unitPriceMinor:
            line.unitPrice.toString(),

          subtotalMinor:
            line.subtotal.toString(),

          event: {
            id: line.event.id,
            slug: line.event.slug,
            title: line.event.title,
            timeZone: line.event.timeZone,

            imageUrl: await publicImage(
              line.event.images[0]?.storageKey, process.env.SUPABASE_EVENT_BUCKET || "event-images"
            ),

            startsAt:
              line.event.schedules[0]
                ?.startsAt.toISOString() ?? null,

            venue: line.event.venue,
          },
        }))),
      },
    };
  }

  const donation =
    await prisma.donation.findUnique({
      where: { id },

      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        donorEmail: true,
        donorPhoneE164: true,
        createdAt: true,

        campaign: {
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            closedAt: true,
            city: true,
            country: true,

            images: {
              take: 1,
              orderBy: [
                { isPrimary: "desc" },
                { position: "asc" },
              ],
              select: {
                storageKey: true,
              },
            },
          },
        },
      },
    });

  if (
    !donation ||
    donation.status !== "PENDING" ||
    donation.campaign.status !== "PUBLISHED" ||
    (
      donation.campaign.closedAt &&
      donation.campaign.closedAt <= new Date()
    )
  ) {
    return null;
  }

  const fee = calculateFee(
    donation.amount,
    100n
  );

  return {
    type,
    id: donation.id,
    createdAt: donation.createdAt,
    subtotal: donation.amount,
    fee,
    total: donation.amount + fee,
    currency: donation.currency,
    email: donation.donorEmail,
    phoneE164: donation.donorPhoneE164,

    item: {
      type: "donation",

      campaign: {
        id: donation.campaign.id,
        slug: donation.campaign.slug,
        title: donation.campaign.title,
        city: donation.campaign.city,
        country: donation.campaign.country,

        imageUrl: await publicImage(
          donation.campaign.images[0]?.storageKey, process.env.SUPABASE_CAMPAIGN_BUCKET || "campaign-images"
        ),
      },
    },
  };
}

/* ============================================
   TIKEMIA PAY — CONNEXION UNIQUE

   Même variable TIKEMIA_PAY_API_URL
   que checkout/pay.

   Contrat prévu :

   GET TIKEMIA_PAY_API_URL
     ?countryCode=BJ
     &currency=XOF
     &amountMinor=10000
     &type=tickets

   POST TIKEMIA_PAY_API_URL
     pour initier le paiement.

   TIKEMIA Pay décide seul quels
   agrégateurs sont utilisés.
============================================ */

async function fetchPaymentMethods(args: { countryCode: string; currency: string; amount: bigint; type: CheckoutType }): Promise<PaymentMethod[]> {
  const result = await getPublicPaymentMethods({ countryCode: args.countryCode, currencyCode: args.currency, amountMinor: args.amount.toString(), checkoutType: args.type === "tickets" ? "ticket" : "donation" });
  return result.methods.map(method => ({ id: method.id, name: method.name, type: method.category, logoUrl: method.logoUrl, description: null }));
}

async function handleCheckout(
  request: NextRequest,
  input: CheckoutInput,
  updateContact: boolean
) {
  const locale = readLocale(input.locale);
  const type = readType(input.type);

  if (!type) {
    return fail(locale, "invalid", 400);
  }

  const id = readResourceId(type, input);

  if (!id) {
    return fail(locale, "invalid", 400);
  }

  const prisma = getPrisma();

  let resource = await readResource(
    prisma,
    type,
    id
  );

  if (!resource) {
    return fail(
      locale,
      "unauthorized",
      403
    );
  }

  if (
    !verifyCheckoutToken(
      input.checkoutToken,
      resource
    )
  ) {
    return fail(
      locale,
      "unauthorized",
      403
    );
  }

  /* ----------------------------------------
     COORDONNÉES CLIENT
  ---------------------------------------- */

  if (updateContact) {
    const email =
      normalizeEmail(input.email);

    const phone =
      normalizePhone(input.phoneE164);

    if (!email) {
      return fail(
        locale,
        "invalidEmail",
        400
      );
    }

    if (!phone) {
      return fail(
        locale,
        "invalidPhone",
        400
      );
    }

    /*
      Le verrou empêche les changements
      de coordonnées après le démarrage
      d'une tentative de paiement.
    */

    const currentResource = resource;
    const updated =
      await prisma.$transaction(
        async (tx) => {
          if (type === "tickets") {
            await tx.$queryRaw`
              SELECT "id"
              FROM "Order"
              WHERE "id" = ${id}::uuid
              FOR UPDATE
            `;
          } else {
            await tx.$queryRaw`
              SELECT "id"
              FROM "Donation"
              WHERE "id" = ${id}::uuid
              FOR UPDATE
            `;
          }

          const activePayments =
            await tx.payment.count({
              where:
                type === "tickets"
                  ? {
                      orderId: id,
                      status: {
                        in: [
                          "INITIATED",
                          "PENDING",
                          "SUCCEEDED",
                        ],
                      },
                    }
                  : {
                      donationId: id,
                      status: {
                        in: [
                          "INITIATED",
                          "PENDING",
                          "SUCCEEDED",
                        ],
                      },
                    },
            });

          if (activePayments > 0) {
            return false;
          }

          if (type === "tickets") {
            const changed =
              await tx.order.updateMany({
                where: {
                  id,
                  status: "PENDING",
                  total: currentResource.total,
                },

                data: {
                  guestEmail: email,
                  guestPhoneE164: phone,
                },
              });

            return changed.count === 1;
          }

          const changed =
            await tx.donation.updateMany({
              where: {
                id,
                status: "PENDING",
                amount: currentResource.subtotal,
              },

              data: {
                donorEmail: email,
                donorPhoneE164: phone,
              },
            });

          return changed.count === 1;
        },
        {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 10000,
        }
      );

    if (!updated) {
      return fail(locale, "locked", 409);
    }

    resource = {
      ...resource,
      email,
      phoneE164: phone,
    };
  }

  /* ----------------------------------------
     PAYS ET DEVISE
  ---------------------------------------- */

  const country = detectCountry(
    request,
    input.countryCode
  );

  /*
    La devise ne change jamais.
    Elle vient du montant enregistré.
  */

  let paymentMethods: PaymentMethod[] = [];
  let methodsAvailable = false;

  {
    try {
      paymentMethods =
        await fetchPaymentMethods({
          countryCode: country.countryCode ?? "",
          currency: resource.currency,
          amount: resource.total,
          type: resource.type,
        });

      methodsAvailable = true;
    } catch (error) {
    unstable_rethrow(error);
      console.error(
        "[TIKEMIA_PAY_METHODS]",
        error instanceof Error
          ? error.name
          : "UNKNOWN_ERROR"
      );
    }
  }

  return respond({
    success: true,

    generatedAt:
      new Date().toISOString(),

    data: {
      type: resource.type,

      orderId:
        resource.type === "tickets"
          ? resource.id
          : null,

      donationId:
        resource.type === "donation"
          ? resource.id
          : null,

      checkoutToken:
        input.checkoutToken,

      item: resource.item,

      customer: {
        email: resource.email,
        phoneE164: resource.phoneE164,
      },

      country: {
        code: country.countryCode,
        source: country.source,
      },

      currency: resource.currency,

      subtotalMinor:
        resource.subtotal.toString(),

      serviceFeeMinor:
        resource.fee.toString(),

      totalMinor:
        resource.total.toString(),

      serviceFeeBps:
        resource.type === "tickets"
          ? 200
          : 100,

      paymentMethods,
      methodsAvailable,

      canPay: Boolean(
        paymentMethods.length > 0 &&
        resource.email &&
        resource.phoneE164
      ),
    },
  });
}

/* ============================================
   GET — RÉCAPITULATIF
============================================ */

export async function GET(
  request: NextRequest
) {
  try {
    const params =
      request.nextUrl.searchParams;

    return await handleCheckout(
      request,
      {
        type: params.get("type"),
        orderId: params.get("orderId"),
        donationId: params.get("donationId"),
        checkoutToken:
          params.get("checkoutToken"),
        countryCode:
          params.get("countryCode"),
        locale: params.get("locale"),
      },
      false
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "[TIKEMIA_CHECKOUT_GET]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return respond(
      {
        success: false,
        code: "CHECKOUT_UNAVAILABLE",
      },
      503
    );
  }
}

/* ============================================
   POST — INFORMATIONS CLIENT

   Aucun débit ici.
============================================ */


async function createDonationCheckout(body: Record<string, unknown>) {
 if (typeof body.campaignId !== "string" || !UUID_REGEX.test(body.campaignId) || typeof body.requestId !== "string" || !UUID_REGEX.test(body.requestId) || typeof body.amountMinor !== "string" || !/^[1-9][0-9]{0,17}$/.test(body.amountMinor)) return respond({ success: false, code: "INVALID_AMOUNT" }, 400);
 checkoutSecret();
 const key = "checkout:donation:" + createHash("sha256").update(body.requestId).digest("hex"), fingerprint = JSON.stringify([body.campaignId, body.amountMinor]);
 const donation = await getPrisma().$transaction(async tx => {
 await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key},0))) AS checkout_lock`;
 const previous = await tx.appSetting.findUnique({ where: { key } });
 if (previous) { const value = previous.value as { fingerprint?: string; donationId?: string }; if (value.fingerprint !== fingerprint || !value.donationId) throw new Error("INVALID_SELECTION"); const existing = await tx.donation.findUnique({ where: { id: value.donationId } }); if (!existing || existing.status !== "PENDING" || Date.now() - existing.createdAt.getTime() >= CHECKOUT_VALIDITY_MS) throw new Error("CHECKOUT_EXPIRED"); return existing; }
 const campaign = await tx.campaign.findFirst({ where: { id: body.campaignId as string, status: "PUBLISHED", organization: { isActive: true } }, select: { id: true, currency: true, closedAt: true } });
 if (!campaign || (campaign.closedAt && campaign.closedAt <= new Date())) throw new Error("CAMPAIGN_UNAVAILABLE");
 const donation = await tx.donation.create({ data: { campaignId: campaign.id, reference: "TKD-" + randomUUID(), amount: BigInt(body.amountMinor as string), currency: campaign.currency } });
 await tx.appSetting.create({ data: { key, value: { fingerprint, donationId: donation.id } } }); return donation;
 }, { maxWait: 5000, timeout: 15000 });
 const fee = (donation.amount * 100n + 5000n) / 10000n;
 const token = createCheckoutToken({ type: "donation", id: donation.id, createdAt: donation.createdAt, subtotal: donation.amount, fee, total: donation.amount + fee, currency: donation.currency, email: donation.donorEmail ?? "", phoneE164: donation.donorPhoneE164, item: {} });
 return respond({ success: true, data: { checkoutUrl: "/checkout?" + new URLSearchParams({ type: "donation", donationId: donation.id, checkoutToken: token }).toString() } });
}

async function createTicketCheckout(body: Record<string, unknown>) {
 if(typeof body.eventId!=="string" || !UUID_REGEX.test(body.eventId) || typeof body.scheduleId!=="string" || !UUID_REGEX.test(body.scheduleId) || typeof body.requestId!=="string" || !UUID_REGEX.test(body.requestId) || !Array.isArray(body.items) || body.items.length<1 || body.items.length>20) return respond({success:false,code:"INVALID_SELECTION"},400);
 const items: {ticketCategoryId:string;quantity:number}[]=[];
 for(const item of body.items){if(!item || typeof item.ticketCategoryId!=="string" || !UUID_REGEX.test(item.ticketCategoryId) || !Number.isSafeInteger(item.quantity) || item.quantity<1 || item.quantity>20) return respond({success:false,code:"INVALID_SELECTION"},400);items.push({ticketCategoryId:item.ticketCategoryId,quantity:item.quantity});}
 items.sort((a,b)=>a.ticketCategoryId.localeCompare(b.ticketCategoryId));
 if(new Set(items.map(i=>i.ticketCategoryId)).size!==items.length)return respond({success:false,code:"INVALID_SELECTION"},400);
 checkoutSecret();
 const key="checkout:create:"+createHash("sha256").update(body.requestId).digest("hex");
 const fingerprint=JSON.stringify([body.eventId,body.scheduleId,items]);
 try {
 const order=await getPrisma().$transaction(async tx=>{
 await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key},0))) AS checkout_lock`;
 const previous=await tx.appSetting.findUnique({where:{key}});
 if(previous){const value=previous.value as {fingerprint?:string;orderId?:string};if(value.fingerprint!==fingerprint || !value.orderId)throw new Error("INVALID_SELECTION");const order=await tx.order.findUnique({where:{id:value.orderId}});if(!order || order.status!=="PENDING" || Date.now()-order.createdAt.getTime()>=CHECKOUT_VALIDITY_MS)throw new Error("CHECKOUT_EXPIRED");return order;}
 const event=await tx.event.findFirst({where:{id:body.eventId as string,status:"PUBLISHED",organization:{isActive:true}},select:{id:true,title:true,currency:true}});
 const schedule=await tx.eventSchedule.findFirst({where:{id:body.scheduleId as string,eventId:body.eventId as string,startsAt:{gt:new Date()}}});
 if(!event || !schedule)throw new Error("EVENT_UNAVAILABLE");
 const lines=[];let subtotal=0n;
 for(const item of items){
 await tx.$queryRaw`SELECT id FROM "TicketCategory" WHERE id=${item.ticketCategoryId}::uuid FOR UPDATE`;
 const category=await tx.ticketCategory.findFirst({where:{id:item.ticketCategoryId,eventId:event.id,isActive:true}});
 if(!category || category.currency!==event.currency || category.price<0n)throw new Error("INVALID_SELECTION");
 const sold=await tx.ticket.count({where:{ticketCategoryId:category.id,status:{notIn:["CANCELLED","REFUNDED","TRANSFERRED"]}}});
 const reserved=await tx.inventoryReservation.aggregate({where:{ticketCategoryId:category.id,status:"ACTIVE",expiresAt:{gt:new Date()}},_sum:{quantity:true}});
 if(sold+(reserved._sum.quantity??0)+item.quantity>category.capacity)throw new Error("TICKETS_UNAVAILABLE");
 const amount=category.price*BigInt(item.quantity);subtotal+=amount;
 lines.push({eventId:event.id,ticketCategoryId:category.id,categoryName:category.name,eventTitle:event.title,quantity:item.quantity,unitPrice:category.price,subtotal:amount,currency:event.currency});
 }
 const serviceFee=(subtotal*200n+5000n)/10000n;
 const order=await tx.order.create({data:{reference:"TKM-"+randomUUID(),guestEmail:"",currency:event.currency,subtotal,serviceFee,total:subtotal+serviceFee,serviceFeeBps:200,lines:{create:lines},reservations:{create:items.map(item=>({eventId:event.id,ticketCategoryId:item.ticketCategoryId,quantity:item.quantity,expiresAt:new Date(Date.now()+CHECKOUT_VALIDITY_MS)}))}}});
 await tx.appSetting.create({data:{key,value:{fingerprint,orderId:order.id,scheduleId:schedule.id}}});
 await tx.appSetting.create({data:{key:"checkout:order:"+order.id,value:{eventId:event.id,scheduleId:schedule.id}}});return order;
 },{maxWait:5000,timeout:15000});
 const token=createCheckoutToken({type:"tickets",id:order.id,createdAt:order.createdAt,subtotal:order.subtotal,fee:order.serviceFee,total:order.total,currency:order.currency,email:order.guestEmail,phoneE164:order.guestPhoneE164,item:{}});
 return respond({success:true,data:{checkoutUrl:"/checkout?"+new URLSearchParams({type:"tickets",orderId:order.id,checkoutToken:token}).toString()}});
 }catch(error){unstable_rethrow(error);if(error instanceof Error && ["INVALID_SELECTION","CHECKOUT_EXPIRED","EVENT_UNAVAILABLE","TICKETS_UNAVAILABLE"].includes(error.message))return respond({success:false,code:error.message},409);throw error;}
}

export async function POST(
  request: NextRequest
) {
  try {
    if (!validOrigin(request)) {
      return respond(
        {
          success: false,
          code: "INVALID_ORIGIN",
        },
        403
      );
    }

    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !contentType.toLowerCase()
        .startsWith("application/json")
    ) {
      return respond(
        {
          success: false,
          code: "INVALID_CONTENT_TYPE",
        },
        415
      );
    }

    const contentLength = Number(
      request.headers.get("content-length") ?? "0"
    );

    if (
      !Number.isFinite(contentLength) ||
      contentLength > MAX_BODY_BYTES
    ) {
      return respond(
        {
          success: false,
          code: "REQUEST_TOO_LARGE",
        },
        413
      );
    }

    const raw = await request.text();

    if (
      Buffer.byteLength(raw, "utf8") >
      MAX_BODY_BYTES
    ) {
      return respond(
        {
          success: false,
          code: "REQUEST_TOO_LARGE",
        },
        413
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(raw);
    } catch {
      return respond(
        {
          success: false,
          code: "INVALID_JSON",
        },
        400
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return respond(
        {
          success: false,
          code: "INVALID_REQUEST",
        },
        400
      );
    }

    if ("action" in body && body.action === "create-donation") return await createDonationCheckout(body as Record<string, unknown>);
    if ("action" in body && body.action === "create") return await createTicketCheckout(body as Record<string, unknown>);
    return await handleCheckout(
      request,
      body as CheckoutInput,
      true
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "[TIKEMIA_CHECKOUT_POST]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return respond(
      {
        success: false,
        code: "CHECKOUT_UNAVAILABLE",
      },
      503
    );
  }
}
