import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { createClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";

import {
  createHash,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  PrismaPg,
} from "@prisma/adapter-pg";

import {
  PrismaClient,
} from "@/generated/prisma/client";

/* ==========================================================
   TIKEMIA — ESPACE COMPTE PUBLIC

   FICHIER :
   src/app/api/public/account/route.ts

   MÉTHODE :
   GET /api/public/account

   OBJECTIF :
   - Identifier le client connecté
   - Vérifier sa session PostgreSQL
   - Récupérer son profil
   - Calculer les achats payés
   - Calculer les montants dépensés
   - Compter les billets valables
   - Récupérer les billets non scannés
   - Récupérer les images des événements
   - Renvoyer les dates et les lieux

   RÈGLES DE SÉCURITÉ :
   - Session obligatoire
   - Cookie HttpOnly existant
   - Vérification du tokenHash
   - Session non révoquée
   - Session non expirée
   - Email vérifié
   - Compte actif et non bloqué
   - Rôle CLIENT obligatoire

   BILLETS :
   - Appartenant au client connecté
   - Commande payée
   - Statut VALID
   - Jamais scannés avec succès
   - Événement non annulé
   - Aucun billet transféré
   - Aucun billet remboursé

   MONTANTS :
   - BigInt dans Prisma
   - Chaînes dans la réponse JSON
   - Regroupement par devise
   - Aucune conversion fictive

   AUCUNE DONNÉE INVENTÉE.
   AUCUN NOUVEAU MODÈLE PRISMA.
   AUCUN MENU SUPPLÉMENTAIRE.
========================================================== */

/* ==========================================================
   CONFIGURATION
========================================================== */

const SESSION_COOKIE =
  "tikemia_session";

const DEFAULT_PAGE_SIZE = 24;

const MAX_PAGE_SIZE = 100;

const MAX_PAGE_NUMBER = 10000;

const RESPONSE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate",

  "X-Content-Type-Options":
    "nosniff",

  "Vary": "Cookie",
};

/* ==========================================================
   TYPES PUBLICS
========================================================== */

type PublicMoney = {
  amountMinor: string;
  currency: string;
};

type PublicProfile = {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phoneE164: string | null;
  countryCode: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
};

type PublicTicket = {
  id: string;
  number: string;
  status: "VALID";
  issuedAt: string;

  event: {
    id: string;
    slug: string;
    title: string;
    imageUrl: string | null;
    category: string;
    timeZone: string;

    venue: {
      name: string;
      address: string;
      city: string;
      country: string;
    } | null;
  };

  schedule: {
    id: string;
    startsAt: string;
    endsAt: string | null;
    label: string | null;
  } | null;

  ticketCategory: {
    id: string;
    name: string;
  };

  order: {
    id: string;
    reference: string;
    currency: string;
    paidAt: string | null;
  };
};

type PublicAccountStatistics = {
  validTickets: number;
  totalPurchases: number;
  spentByCurrency: PublicMoney[];
};

/* ==========================================================
   PRISMA 7 — CLIENT EXISTANT

   Réutilise la configuration présente
   dans les API publiques TIKEMIA.
========================================================== */

const prismaGlobal =
  globalThis as typeof globalThis & {
    tikemiaPrisma?: PrismaClient;
  };

function getPrisma(): PrismaClient {
  if (prismaGlobal.tikemiaPrisma) {
    return prismaGlobal.tikemiaPrisma;
  }

  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL_NOT_CONFIGURED"
    );
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  const client = new PrismaClient({
    adapter,
  });

  prismaGlobal.tikemiaPrisma = client;

  return client;
}

/* ==========================================================
   RÉPONSES HTTP
========================================================== */

async function respond(
  body: Record<string, unknown>,
  status = 200
) {
  const response = NextResponse.json(await resolveAccountMedia(body), { status, headers: RESPONSE_HEADERS });
  if (status === 401 || status === 403) response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

function unauthorized() {
  return respond(
    {
      success: false,
      code: "UNAUTHORIZED",
      message:
        "Veuillez vous connecter pour accéder à votre compte.",
    },
    401
  );
}

function forbidden() {
  return respond(
    {
      success: false,
      code: "ACCOUNT_UNAVAILABLE",
      message:
        "Votre espace personnel est indisponible.",
    },
    403
  );
}

/* ==========================================================
   VALIDATION SESSION

   La connexion utilise un token
   aléatoire envoyé au navigateur.

   Seule son empreinte SHA-256
   est conservée en base.

   Le cookie n'est jamais retourné
   dans les données JSON.
========================================================== */

function readSessionHash(
  request: NextRequest
): string | null {
  const token =
    request.cookies.get(
      SESSION_COOKIE
    )?.value;

  if (
    !token ||
    !/^[a-f0-9]{64}$/i.test(token)
  ) {
    return null;
  }

  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

/* ==========================================================
   PAGINATION

   Exemple :
   /api/public/account?page=1&limit=24

   Les statistiques restent globales,
   même lorsque les billets sont paginés.
========================================================== */

function positiveInteger(
  input: string | null,
  fallback: number,
  maximum: number
): number {
  if (
    !input ||
    !/^\d+$/.test(input)
  ) {
    return fallback;
  }

  const number = Number(input);

  if (
    !Number.isSafeInteger(number) ||
    number < 1
  ) {
    return fallback;
  }

  return Math.min(number, maximum);
}

/* ==========================================================
   IMAGES

   Les clés de stockage privées ne
   doivent pas être transformées en
   fausses URL publiques.

   Une URL HTTPS ou un chemin public
   existant peut être renvoyé.

   Les autres références restent null
   tant que le système de médias
   existant ne les a pas résolues.
========================================================== */

function publicImageUrl(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const source = value.trim();

  if (!source) {
    return null;
  }

  if (
    source.startsWith("/") &&
    !source.startsWith("//") &&
    !source.includes("\\") &&
    !/[\u0000-\u001f]/.test(source)
  ) {
    return source;
  }

  if (/^[a-zA-Z0-9_/-]+\.(?:jpe?g|png|webp)$/i.test(source) && !source.split("/").includes("..")) return source;

  try {
    const url = new URL(source);

    if (url.protocol === "https:") {
      return url.toString();
    }

    if (
      process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      (
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1"
      )
    ) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

/* ==========================================================
   GET — ESPACE MON COMPTE
========================================================== */

export async function GET(
  request: NextRequest
) {
  try {
    /* ======================================================
       1. RÉCUPÉRER LA SESSION
    ====================================================== */

    const tokenHash =
      readSessionHash(request);

    if (!tokenHash) {
      return unauthorized();
    }

    const prisma = getPrisma();

    const now = new Date();

    const session =
      await prisma.session.findUnique({
        where: {
          tokenHash,
        },

        select: {
          id: true,
          revokedAt: true,
          expiresAt: true,

          user: {
            select: {
              id: true,
              fullName: true,
              firstName: true,
              lastName: true,

              email: true,
              phoneE164: true,
              countryCode: true,
              avatarStorageKey: true,

              emailVerifiedAt: true,

              isActive: true,
              isBlocked: true,

              roles: {
                where: {
                  role: "CLIENT",
                },

                select: {
                  role: true,
                },
              },
            },
          },
        },
      });

    /* ======================================================
       2. CONTRÔLE DE LA SESSION

       Révocation :
       après déconnexion ou changement
       du mot de passe.

       Expiration :
       la session n'est plus valable.
    ====================================================== */

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt <= now
    ) {
      return unauthorized();
    }

    /* ======================================================
       3. CONTRÔLE DU CLIENT

       Ne pas permettre à un utilisateur
       suspendu ou non vérifié d'accéder
       à cet espace.
    ====================================================== */

    const user = session.user;

    if (
      !user.isActive ||
      user.isBlocked ||
      !user.emailVerifiedAt ||
      user.roles.length === 0
    ) {
      return forbidden();
    }

    if (request.nextUrl.searchParams.get("session") === "1") return respond({ success: true, expiresAt: session.expiresAt.toISOString() });

    /* ======================================================
       4. PAGINATION
    ====================================================== */

    const params =
      request.nextUrl.searchParams;

    const page = positiveInteger(
      params.get("page"),
      1,
      MAX_PAGE_NUMBER
    );

    const limit = positiveInteger(
      params.get("limit"),
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );

    const skip =
      (page - 1) * limit;

    /* ======================================================
       5. CONDITIONS DES BILLETS VALIDES

       Un billet doit :
       - Appartenir au client connecté
       - Être encore VALID
       - Ne pas être marqué utilisé
       - Appartenir à une commande payée
       - Ne pas dépendre d'un événement
         annulé, suspendu ou archivé

       Les billets utilisés disparaissent
       automatiquement de la requête.

       On ne se fie jamais à un simple
       email ou téléphone dans l'URL.
    ====================================================== */

    const ticketWhere = {
      ownerId: user.id,

      status: "VALID" as const,

      usedAt: null,

      order: {
        is: {

          status: {
            in: [
              "PAID" as const,
              "PARTIALLY_REFUNDED" as const,
            ],
          },
        },
      },

      event: {
        is: {
          status: "PUBLISHED" as const,
        },
      },
    };

    /* ======================================================
       6. LECTURE DES DONNÉES RÉELLES

       Requêtes parallèles :
       - Nombre de billets valables
       - Nombre d'achats payés
       - Montants payés par devise
       - Liste paginée des billets

       Les montants ne sont pas
       mélangés entre devises.
    ====================================================== */

    const [
      validTicketCount,
      totalPurchases,
      totalsByCurrency,
      tickets,
    ] = await Promise.all([

      /* NOMBRE DE BILLETS VALIDES */

      prisma.ticket.count({
        where: ticketWhere,
      }),

      /* NOMBRE DE COMMANDES PAYÉES */

      prisma.order.count({
        where: {
          buyerId: user.id,
          status: "PAID",
          paidAt: {
            not: null,
          },
        },
      }),

      /* SOMMES PAYÉES PAR DEVISE */

      prisma.order.groupBy({
        by: ["currency"],

        where: {
          buyerId: user.id,
          status: "PAID",
          paidAt: {
            not: null,
          },
        },

        _sum: {
          total: true,
        },
      }),

      /* BILLETS VALIDES ET NON UTILISÉS */

      prisma.ticket.findMany({
        where: ticketWhere,

        skip,
        take: limit,

        orderBy: [
          {
            issuedAt: "desc",
          },
          {
            id: "desc",
          },
        ],

        select: {
          id: true,
          number: true,
          status: true,
          issuedAt: true,

          category: {
            select: {
              id: true,
              name: true,
            },
          },

          schedule: {
            select: {
              id: true,
              startsAt: true,
              endsAt: true,
              label: true,
            },
          },

          order: {
            select: {
              id: true,
              reference: true,
              currency: true,
              paidAt: true,
            },
          },

          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              category: true,
              timeZone: true,

              images: {
                take: 1,

                orderBy: [
                  {
                    isPrimary: "desc",
                  },
                  {
                    position: "asc",
                  },
                  {
                    createdAt: "asc",
                  },
                ],

                select: {
                  storageKey: true,
                },
              },

              venue: {
                select: {
                  name: true,
                  address: true,
                  city: true,
                  country: true,
                },
              },
            },
          },
        },
      }),
    ]);

    /* ======================================================
       7. PROFIL PUBLIC DU CLIENT

       L'email et le téléphone affichés
       sont ceux du compte authentifié.

       Pas ceux fournis dans la requête.
    ====================================================== */

    const name =
      user.fullName.trim() ||
      [
        user.firstName,
        user.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

    const profile: PublicProfile = {
      id: user.id,

      name,

      firstName: user.firstName,

      lastName: user.lastName,

      email: user.email,

      phoneE164: user.phoneE164,

      countryCode: user.countryCode,

      avatarUrl: publicImageUrl(
        user.avatarStorageKey
      ),

      emailVerified: true,
    };

    /* ======================================================
       8. MONTANTS DÉPENSÉS

       Uniquement commandes entièrement
       payées et non remboursées.

       Chaque devise est conservée.

       Exemples :
       - XOF : montant en FCFA
       - EUR : montant en centimes
       - USD : montant en cents

       Ne jamais additionner des
       devises différentes.
    ====================================================== */

    const spentByCurrency: PublicMoney[] =
      totalsByCurrency
        .map((item) => ({
          amountMinor:
            (
              item._sum.total ?? 0n
            ).toString(),

          currency:
            item.currency,
        }))
        .sort((a, b) =>
          a.currency.localeCompare(
            b.currency
          )
        );

    /* ======================================================
       9. STATISTIQUES
    ====================================================== */

    const statistics:
      PublicAccountStatistics = {
        validTickets:
          validTicketCount,

        totalPurchases,

        spentByCurrency,
      };

    /* ======================================================
       10. PRÉSENTATION DES BILLETS

       Informations :
       - Identifiant interne
       - Numéro public du billet
       - Statut
       - Titre de l'événement
       - Image de l'événement
       - Date de la séance
       - Lieu
       - Catégorie
       - Commande

       Les éléments suivants restent
       privés et ne sont pas renvoyés :
       - qrTokenHash
       - pdfStorageKey
       - Données d'autres utilisateurs
       - Données bancaires
    ====================================================== */

    const publicTickets: PublicTicket[] =
      tickets.map((ticket) => {

        const image =
          ticket.event.images[0] ??
          null;

        return {
          id: ticket.id,

          number: ticket.number,

          status: "VALID",

          issuedAt:
            ticket.issuedAt.toISOString(),

          event: {
            id: ticket.event.id,

            slug: ticket.event.slug,

            title: ticket.event.title,

            category:
              ticket.event.category,

            timeZone:
              ticket.event.timeZone,

            imageUrl:
              publicImageUrl(
                image?.storageKey
              ),

            venue:
              ticket.event.venue
                ? {
                    name:
                      ticket.event.venue.name,

                    address:
                      ticket.event.venue.address,

                    city:
                      ticket.event.venue.city,

                    country:
                      ticket.event.venue.country,
                  }
                : null,
          },

          schedule:
            ticket.schedule
              ? {
                  id:
                    ticket.schedule.id,

                  startsAt:
                    ticket.schedule.startsAt
                      .toISOString(),

                  endsAt:
                    ticket.schedule.endsAt
                      ?.toISOString() ??
                    null,

                  label:
                    ticket.schedule.label,
                }
              : null,

          ticketCategory: {
            id:
              ticket.category.id,

            name:
              ticket.category.name,
          },

          order: {
            id:
              ticket.order.id,

            reference:
              ticket.order.reference,

            currency:
              ticket.order.currency,

            paidAt:
              ticket.order.paidAt
                ?.toISOString() ??
              null,
          },
        };
      });

    /* ======================================================
       11. PAGINATION

       Les statistiques représentent
       l'ensemble du compte.

       La pagination concerne
       uniquement la liste des billets.
    ====================================================== */

    const totalPages =
      Math.ceil(
        validTicketCount / limit
      );

    const pagination = {
      page,
      limit,

      total:
        validTicketCount,

      totalPages,

      hasNextPage:
        page < totalPages,

      hasPreviousPage:
        page > 1,
    };

    /* ======================================================
       12. RÉPONSE

       Les données sont lues en base
       à chaque requête.

       Aucun cache HTTP.

       La page frontend peut rafraîchir
       automatiquement les données
       après un scan de billet.
    ====================================================== */

    return respond(
      {
        success: true,

        generatedAt:
          new Date().toISOString(),

        data: {
          profile,

          statistics,

          tickets:
            publicTickets,

          pagination,
        },
      },
      200
    );

  } catch (error) {
    unstable_rethrow(error);
    /* ======================================================
       13. ERREUR SERVEUR

       Ne jamais transmettre :
       - Token de session
       - Empreinte de token
       - DATABASE_URL
       - Informations internes Prisma
       - Stack technique
    ====================================================== */

    console.error(
      "[TIKEMIA_PUBLIC_ACCOUNT_ERROR]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return respond(
      {
        success: false,

        code:
          "ACCOUNT_UNAVAILABLE",

        message:
          "Impossible de charger votre espace personnel pour le moment.",
      },
      503
    );
  }
}

async function resolveAccountMedia<T>(body: T): Promise<T> {
  const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const entries: Array<{ record: Record<string, unknown>; field: string; path: string; bucket: string }> = [];
  function collect(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(collect); return; }
    const record = value as Record<string, unknown>;
    for (const [field, child] of Object.entries(record)) {
      if (["imageUrl", "avatarUrl"].includes(field) && typeof child === "string" && /^[a-zA-Z0-9_/-]+\.(?:jpe?g|png|webp)$/i.test(child) && !child.startsWith("/") && !child.split("/").includes("..")) {
        entries.push({ record, field, path: child, bucket: field === "avatarUrl" ? process.env.SUPABASE_AVATAR_BUCKET || "profile-avatars" : process.env.SUPABASE_EVENT_BUCKET || "event-images" });
        record[field] = null;
      } else if (child && typeof child === "object") collect(child);
    }
  }
  collect(body);
  if (!base || !secret || !entries.length) return body;
  const client = createClient(base, secret, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) }) } });
  await Promise.all([...new Set(entries.map(item => item.bucket))].map(async bucket => {
    const paths = [...new Set(entries.filter(item => item.bucket === bucket).map(item => item.path))];
    try {
      const { data, error } = await client.storage.from(bucket).createSignedUrls(paths, 300);
      if (!error && data) for (const item of entries) if (item.bucket === bucket) item.record[item.field] = data.find(file => file.path === item.path)?.signedUrl ?? null;
    } catch { /* Keep an unavailable image isolated from the account data. */ }
  }));
  return body;
}

function validAccountOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return request.headers.get("sec-fetch-site") !== "cross-site" && (!origin || origin === getTrustedRequestOrigin(request));
}
export async function DELETE(request: NextRequest) {
  if (!validAccountOrigin(request)) return respond({ success: false, message: "Forbidden" }, 403);
  try {
    const tokenHash = readSessionHash(request);
    if (tokenHash) await getPrisma().session.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
    const response = await respond({ success: true });
    response.cookies.set("tikemia_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch (error) { unstable_rethrow(error); return respond({ success: false, message: "Service indisponible." }, 503); }
}
export async function PATCH(request: NextRequest) {
  if (!validAccountOrigin(request)) return respond({ success: false, message: "Forbidden" }, 403);
  try {
    const tokenHash = readSessionHash(request);
    if (!tokenHash) return unauthorized();
    const prisma = getPrisma();
    const session = await prisma.session.findUnique({ where: { tokenHash }, select: { userId: true, revokedAt: true, expiresAt: true, user: { select: { isActive: true, isBlocked: true, emailVerifiedAt: true, roles: { where: { role: "CLIENT" }, select: { role: true } } } } } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive || session.user.isBlocked || !session.user.emailVerifiedAt || !session.user.roles.length) return unauthorized();
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 4096) return respond({ success: false, message: "Demande invalide." }, 413);
    let body: unknown; try { body = JSON.parse(text); } catch { return respond({ success: false, message: "Demande invalide." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return respond({ success: false, message: "Demande invalide." }, 400);
    const input = body as Record<string, unknown>;
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const rawPhone = typeof input.phoneE164 === "string" ? input.phoneE164.trim() : "";
    const phone = rawPhone ? parsePhoneNumberFromString(rawPhone) : null;
    if (!name || name.length > 120 || /[\u0000-\u001f]/.test(name) || (rawPhone && !phone?.isValid())) return respond({ success: false, message: "V\u00e9rifiez le nom et le num\u00e9ro international." }, 400);
    await prisma.user.update({ where: { id: session.userId }, data: { fullName: name, phoneE164: phone?.number ?? null, countryCode: phone?.country ?? null } });
    return respond({ success: true });
  } catch (error) { unstable_rethrow(error); return respond({ success: false, message: "Service indisponible." }, 503); }
}
