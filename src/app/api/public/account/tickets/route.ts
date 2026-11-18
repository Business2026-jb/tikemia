import { regenerateTicketQr } from "@/lib/tickets/qr";
import { generateTicketPdf, loadStoredEventImage } from "@/lib/tickets/pdf";
import { createClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";

import { createHash } from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";

/* ==========================================================
   TIKEMIA — API PUBLIQUE MES BILLETS

   FICHIER :
   src/app/api/public/account/tickets/route.ts

   ROUTE :
   GET /api/public/account/tickets

   PARAMÈTRES :
   - page : numéro de page
   - limit : nombre de billets
   - q : recherche par événement
   - filter : all | upcoming

   FONCTIONNALITÉS :
   - Session client obligatoire
   - Recherche dans les billets du client
   - Filtre avant pagination
   - Statistiques globales
   - Prochain événement réel
   - Billets valables non scannés
   - Photos et informations événements
   - Catégorie du billet
   - Actualisation sans cache

   SÉCURITÉ :
   - Vérification du cookie HttpOnly
   - Vérification de la session PostgreSQL
   - Vérification du propriétaire
   - Vérification de la commande payée
   - Aucun QR code exposé
   - Aucun PDF privé exposé
   - Aucun accès aux billets d'autrui

   AUCUN NOUVEAU MODÈLE PRISMA.
   AUCUN NOUVEAU FICHIER.
========================================================== */

const SESSION_COOKIE = "tikemia_session";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 100;
const MAX_PAGE = 10000;
const MAX_SEARCH_LENGTH = 120;

const RESPONSE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff",
  "Vary": "Cookie",
};

type FilterMode = "all" | "upcoming";

type TicketView = {
  id: string;
  number: string;
  status: "VALID";
  unitPriceMinor: string;
  currency: string;
  qrImageUrl?: string;
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

/* ==========================================================
   CLIENT PRISMA

   Même configuration que les autres
   API d'authentification publiques.
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
  return NextResponse.json(await resolveAccountMedia(body), {
    status,
    headers: RESPONSE_HEADERS,
  });
}

function unauthorized() {
  return respond(
    {
      success: false,
      code: "UNAUTHORIZED",
      message:
        "Veuillez vous connecter pour consulter vos billets.",
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
        "Votre compte ne permet pas actuellement cet accès.",
    },
    403
  );
}

/* ==========================================================
   COOKIE DE SESSION

   La connexion crée un token
   cryptographiquement aléatoire.

   Seule son empreinte SHA-256
   est stockée dans PostgreSQL.
========================================================== */

function getSessionHash(
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
   VALIDATION DES PARAMÈTRES
========================================================== */

function readPositiveInteger(
  value: string | null,
  defaultValue: number,
  maximum: number
): number {
  if (
    !value ||
    !/^\d+$/.test(value)
  ) {
    return defaultValue;
  }

  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 1
  ) {
    return defaultValue;
  }

  return Math.min(number, maximum);
}

function readFilter(
  value: string | null
): FilterMode {
  return value === "upcoming"
    ? "upcoming"
    : "all";
}

function readSearch(
  value: string | null
): string {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}

/* ==========================================================
   URL PUBLIQUE DES IMAGES

   Les clés privées de stockage ne
   doivent jamais être transformées
   arbitrairement en liens publics.

   Si le média est représenté par
   une URL publique, elle peut être
   directement affichée.

   Sinon, l'API renvoie null.

   Le mécanisme de médias existant
   pourra résoudre les clés privées.
========================================================== */

function publicImageUrl(
  value: string | null | undefined
): string | null {
  if (
    !value ||
    !value.trim()
  ) {
    return null;
  }

  const source = value.trim();

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
   VALIDITÉ TEMPORELLE

   L'événement peut avoir plusieurs
   séances.

   Une séance avec date de fin :
   valable jusqu'à cette date.

   Une séance sans date de fin :
   valable tant que son heure de
   début n'est pas passée.

   Cela évite de conserver dans la
   liste des billets d'événements
   manifestement terminés.

   Les événements sans séance
   future ou active sont exclus.

   La politique exacte d'expiration
   pourra être alignée sur les règles
   métier de la billetterie existante.
========================================================== */

function activeScheduleWhere(
  now: Date
): Prisma.EventScheduleWhereInput {
  return {
    OR: [
      {
        endsAt: {
          gt: now,
        },
      },
      {
        endsAt: null,
        startsAt: {
          gte: now,
        },
      },
    ],
  };
}

/* ==========================================================
   CONDITIONS COMMUNES DES BILLETS

   L'utilisateur doit être propriétaire.

   Aucun rattachement par téléphone
   ou par email non vérifié ici.

   Les achats invités doivent avoir
   été rattachés au compte lors de
   la vérification de l'email.

   Statut obligatoire : VALID.

   Les scans VALID sont exclus même
   si un autre traitement n'a pas
   encore renseigné usedAt.

   Les commandes partiellement
   remboursées sont possibles si
   le billet concerné reste VALID.
========================================================== */

function validTicketsWhere(
  userId: string,
  now: Date
): Prisma.TicketWhereInput {
  const activeSchedule =
    activeScheduleWhere(now);

  return {
    ownerId: userId,

    status: "VALID",

    usedAt: null,

    scans: {
      none: {
        result: "VALID",
      },
    },

    order: {
      is: {

        status: {
          in: [
            "PAID",
            "PARTIALLY_REFUNDED",
          ],
        },

        paidAt: {
          not: null,
        },
      },
    },

    event: {
      is: {
        status: "PUBLISHED",
      },
    },

    OR: [
      {
        scheduleId: {
          not: null,
        },

        schedule: {
          is: activeSchedule,
        },
      },
      {
        scheduleId: null,

        event: {
          is: {
            schedules: {
              some: activeSchedule,
            },
          },
        },
      },
    ],
  };
}

/* ==========================================================
   FILTRE « À VENIR »

   Le filtre s'applique à la base
   de données avant la pagination.

   Si le billet est lié à une
   séance précise, on utilise
   cette séance.

   Sinon, on recherche une séance
   future de l'événement.
========================================================== */

function upcomingTicketsWhere(
  now: Date
): Prisma.TicketWhereInput {
  return {
    OR: [
      {
        scheduleId: {
          not: null,
        },

        schedule: {
          is: {
            startsAt: {
              gte: now,
            },
          },
        },
      },
      {
        scheduleId: null,

        event: {
          is: {
            schedules: {
              some: {
                startsAt: {
                  gte: now,
                },
              },
            },
          },
        },
      },
    ],
  };
}

/* ==========================================================
   RECHERCHE ET FILTRE

   - q : titre de l'événement
   - upcoming : événements à venir

   L'ensemble des critères est
   appliqué AVANT count et findMany.
========================================================== */

function filteredTicketsWhere(
  base: Prisma.TicketWhereInput,
  query: string,
  filter: FilterMode,
  now: Date
): Prisma.TicketWhereInput {
  const conditions:
    Prisma.TicketWhereInput[] = [
      base,
    ];

  if (query) {
    conditions.push({
      event: {
        is: {
          title: {
            contains: query,
            mode: "insensitive",
          },
        },
      },
    });
  }

  if (filter === "upcoming") {
    conditions.push(
      upcomingTicketsWhere(now)
    );
  }

  return {
    AND: conditions,
  };
}

/* ==========================================================
   GET /api/public/account/tickets
========================================================== */

export async function GET(
  request: NextRequest
) {
  try {
    /* ======================================================
       1. SESSION OBLIGATOIRE
    ====================================================== */

    const tokenHash =
      getSessionHash(request);

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

          expiresAt: true,
          revokedAt: true,

          user: {
            select: {
              id: true,
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

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt <= now
    ) {
      return unauthorized();
    }

    /* ======================================================
       2. VÉRIFICATION DU COMPTE
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

    /* ======================================================
       3. PARAMÈTRES
    ====================================================== */

    const params =
      request.nextUrl.searchParams;

    const page =
      readPositiveInteger(
        params.get("page"),
        1,
        MAX_PAGE
      );

    const limit =
      readPositiveInteger(
        params.get("limit"),
        DEFAULT_LIMIT,
        MAX_LIMIT
      );

    const query =
      readSearch(
        params.get("q")
      );

    const filter =
      readFilter(
        params.get("filter")
      );

    const focusedTicketId = params.get("ticket")?.trim() ?? "";
    if (focusedTicketId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(focusedTicketId)) return respond({ success: false, code: "INVALID_TICKET" }, 400);

    if (focusedTicketId && params.get("download") === "pdf") {
      const owned = await prisma.ticket.findFirst({ where: { id: focusedTicketId, ownerId: user.id, status: "VALID", order: { status: "PAID" } }, select: { id: true } });
      if (!owned) return respond({ success: false, code: "TICKET_NOT_FOUND" }, 404);
      const pdf = await generateTicketPdf(owned.id, { loadEventImage: loadStoredEventImage });
      return new NextResponse(new Uint8Array(pdf.buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pdf.filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    }
    const skip =
      (page - 1) * limit;

    /* ======================================================
       4. CRITÈRES GLOBAUX

       Ces critères déterminent
       l'ensemble des billets valables
       appartenant au client.

       Les statistiques ne dépendent
       ni de la recherche ni du filtre.
    ====================================================== */

    const baseWhere =
      validTicketsWhere(
        user.id,
        now
      );

    /* ======================================================
       5. CRITÈRES DE RECHERCHE

       La pagination s'applique
       uniquement après filtrage.
    ====================================================== */

    const listWhere =
      filteredTicketsWhere(
        baseWhere,
        query,
        filter,
        now
      );

    if (focusedTicketId) listWhere.id = focusedTicketId;

    /* ======================================================
       6. CHARGEMENT DES DONNÉES

       Exécuté sur PostgreSQL.

       - Nombre global de billets
       - Nombre global d'achats
       - Nombre de résultats filtrés
       - Prochaine séance réelle
       - Billets paginés

       Aucun compteur fictif.
    ====================================================== */

    const [
      validTicketCount,
      totalPurchases,
      filteredCount,
      nextSchedule,
      tickets,
    ] = await Promise.all([

      /* ==============================================
         BILLETS DISPONIBLES
      ============================================== */

      prisma.ticket.count({
        where: baseWhere,
      }),

      /* ==============================================
         ACHATS TOTAUX

         Nombre de commandes payées.

         Une commande reste un achat,
         même lorsqu'elle contient
         plusieurs billets.
      ============================================== */

      prisma.order.count({
        where: {
          buyerId: user.id,

          status: {
            in: [
              "PAID",
              "PARTIALLY_REFUNDED",
            ],
          },

          paidAt: {
            not: null,
          },
        },
      }),

      /* ==============================================
         NOMBRE DE RÉSULTATS FILTRÉS

         Utilisé pour une pagination
         exacte sur toute la base.
      ============================================== */

      prisma.ticket.count({
        where: listWhere,
      }),

      /* ==============================================
         PROCHAIN ÉVÉNEMENT

         Recherche de la première
         séance future correspondant
         à un billet encore valable
         du client.

         Indépendant de la recherche
         et de la page affichée.
      ============================================== */

      prisma.eventSchedule.findFirst({
        where: {
          startsAt: {
            gte: now,
          },

          OR: [
            {
              tickets: {
                some: baseWhere,
              },
            },
            {
              event: {
                is: {
                  tickets: {
                    some: {
                      AND: [
                        baseWhere,
                        {
                          scheduleId: null,
                        },
                      ],
                    },
                  },
                },
              },
            },
          ],
        },

        orderBy: [
          {
            startsAt: "asc",
          },
          {
            id: "asc",
          },
        ],

        select: {
          startsAt: true,

          event: {
            select: {
              timeZone: true,
            },
          },
        },
      }),

      /* ==============================================
         LISTE DES BILLETS

         Un résultat = un billet.

         Même lorsqu'un client achète
         trois billets du même événement,
         les trois billets possèdent
         leurs propres identifiants.

         La liste n'expose jamais :
         - qrTokenHash
         - pdfStorageKey
         - Token de session
      ============================================== */

      prisma.ticket.findMany({
        where: listWhere,

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
          orderLine: { select: { unitPrice: true, currency: true, categoryName: true } },

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
              slug: true,
              title: true,
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
       7. TRANSFORMER LES DONNÉES

       Les dates sont transmises
       au format ISO.

       La page PC/mobile les affiche
       dans le fuseau de l'événement.

       Aucune photo inventée.

       Aucun QR code.
    ====================================================== */

    const publicTickets: TicketView[] =
      tickets.map((ticket) => {
        const primaryImage =
          ticket.event.images[0] ?? null;

        return {
          id: ticket.id,

          number: ticket.number,

          status: "VALID",

          issuedAt:
            ticket.issuedAt.toISOString(),

          event: {
            id:
              ticket.event.id,

            slug:
              ticket.event.slug,

            title:
              ticket.event.title,

            category:
              ticket.event.category,

            timeZone:
              ticket.event.timeZone,

            imageUrl:
              publicImageUrl(
                primaryImage?.storageKey
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

          unitPriceMinor: ticket.orderLine.unitPrice.toString(),
          currency: ticket.orderLine.currency,
          ticketCategory: {
            id:
              ticket.category.id,

            name:
              ticket.orderLine.categoryName,
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

    if (focusedTicketId) {
      const item = publicTickets.find(item => item.id === focusedTicketId);
      if (item) Object.assign(item, { qrImageUrl: (await regenerateTicketQr(item.id)).imageDataUrl });
    }

    /* ======================================================
       8. STATISTIQUES GLOBALES

       Même lorsque l'utilisateur
       effectue une recherche, les
       statistiques restent celles
       de l'ensemble de son compte.

       Le prochain événement est
       calculé sur l'ensemble des
       billets disponibles.
    ====================================================== */

    const statistics = {
      validTickets:
        validTicketCount,

      totalPurchases,

      nextEventAt:
        nextSchedule
          ?.startsAt.toISOString() ??
        null,

      nextEventTimeZone:
        nextSchedule
          ?.event.timeZone ??
        null,
    };

    /* ======================================================
       9. PAGINATION
    ====================================================== */

    const totalPages =
      Math.ceil(
        filteredCount / limit
      );

    const pagination = {
      page,

      limit,

      total:
        filteredCount,

      totalPages,

      hasNextPage:
        page < totalPages,

      hasPreviousPage:
        page > 1,

      filter,

      query,
    };

    /* ======================================================
       10. RÉPONSE FINALE

       Compatible avec :
       src/app/(public)/account/tickets/page.tsx

       Les données sont relues dans
       PostgreSQL à chaque requête.

       Pas de cache utilisateur.

       La page peut rafraîchir les
       résultats toutes les 10 secondes.
    ====================================================== */

    return respond(
      {
        success: true,

        generatedAt:
          new Date().toISOString(),

        data: {
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
       11. ERREUR SERVEUR

       Aucune donnée sensible exposée
       au navigateur.

       Ne jamais transmettre :
       - DATABASE_URL
       - Cookie de session
       - Token de session
       - qrTokenHash
       - pdfStorageKey
       - Informations d'autres clients
    ====================================================== */

    console.error(
      "[TIKEMIA_PUBLIC_ACCOUNT_TICKETS_ERROR]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return respond(
      {
        success: false,

        code:
          "TICKETS_UNAVAILABLE",

        message:
          "Impossible de charger vos billets pour le moment.",
      },
      503
    );
  }
}

/* ==========================================================
   FIN DE L'API

   GET UNIQUEMENT.

   AUCUN QR CODE RÉVÉLÉ.

   AUCUN BILLET D'AUTRUI ACCESSIBLE.

   RECHERCHE, FILTRE ET PAGINATION
   EFFECTUÉS SUR POSTGRESQL.
========================================================== */

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
