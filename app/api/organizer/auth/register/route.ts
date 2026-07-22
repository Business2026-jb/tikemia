import { randomInt } from "node:crypto";

import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { sendOrganizerVerificationEmail } from "@/lib/mail/send-verification-email";
import { prisma } from "@/lib/prisma";

/**
 * Cette route utilise bcrypt et node:crypto.
 * Elle doit donc s’exécuter dans l’environnement Node.js.
 */
export const runtime = "nodejs";

/**
 * Empêche toute mise en cache de cette route d’authentification.
 */
export const dynamic = "force-dynamic";

const COUNTRIES = {
  BJ: {
    name: "Bénin",
    dialCode: "+229",
  },
  NG: {
    name: "Nigeria",
    dialCode: "+234",
  },
  CI: {
    name: "Côte d’Ivoire",
    dialCode: "+225",
  },
  CM: {
    name: "Cameroun",
    dialCode: "+237",
  },
  GA: {
    name: "Gabon",
    dialCode: "+241",
  },
  GH: {
    name: "Ghana",
    dialCode: "+233",
  },
  TG: {
    name: "Togo",
    dialCode: "+228",
  },
  FR: {
    name: "France",
    dialCode: "+33",
  },
  BE: {
    name: "Belgique",
    dialCode: "+32",
  },
  IT: {
    name: "Italie",
    dialCode: "+39",
  },
  NE: {
    name: "Niger",
    dialCode: "+227",
  },
  ML: {
    name: "Mali",
    dialCode: "+223",
  },
  SN: {
    name: "Sénégal",
    dialCode: "+221",
  },
} as const;

type CountryCode = keyof typeof COUNTRIES;

const countryCodes = Object.keys(COUNTRIES) as [
  CountryCode,
  ...CountryCode[],
];

const registerSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "Le prénom doit contenir au moins 2 caractères.")
    .max(60, "Le prénom est trop long."),

  lastName: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(60, "Le nom est trop long."),

  country: z.string().trim(),

  countryCode: z.enum(countryCodes),

  dialCode: z.string().trim(),

  phone: z
    .string()
    .trim()
    .min(6, "Le numéro de téléphone est trop court.")
    .max(20, "Le numéro de téléphone est trop long."),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("L’adresse e-mail n’est pas valide.")
    .max(254, "L’adresse e-mail est trop longue."),

  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
    .max(128, "Le mot de passe est trop long.")
    .regex(/[a-z]/, "Le mot de passe doit contenir une minuscule.")
    .regex(/[A-Z]/, "Le mot de passe doit contenir une majuscule.")
    .regex(/[0-9]/, "Le mot de passe doit contenir un chiffre."),
});

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function cleanName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLocalPhone(value: string): string {
  return value.replace(/\D/g, "");
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function POST(request: Request) {
  let createdUserId: string | null = null;

  try {
    /**
     * 1. Lire le JSON envoyé par la page d’inscription.
     */
    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch {
      return jsonError("La requête envoyée n’est pas valide.", 400);
    }

    /**
     * 2. Valider toutes les données reçues.
     */
    const validation = registerSchema.safeParse(requestBody);

    if (!validation.success) {
      const firstIssue = validation.error.issues[0];

      return jsonError(
        firstIssue?.message ?? "Vérifiez les informations renseignées.",
        400,
      );
    }

    const data = validation.data;
    const officialCountry = COUNTRIES[data.countryCode];

    /**
     * Le nom du pays et l’indicatif sont recalculés côté serveur.
     * Nous ne faisons jamais confiance uniquement aux valeurs du navigateur.
     */
    if (
      data.country !== officialCountry.name ||
      data.dialCode !== officialCountry.dialCode
    ) {
      return jsonError("Le pays ou l’indicatif sélectionné est invalide.", 400);
    }

    const firstName = cleanName(data.firstName);
    const lastName = cleanName(data.lastName);
    const email = data.email.toLowerCase();
    const localPhone = normalizeLocalPhone(data.phone);

    if (localPhone.length < 6 || localPhone.length > 15) {
      return jsonError("Le numéro de téléphone n’est pas valide.", 400);
    }

    const completePhone = `${officialCountry.dialCode}${localPhone}`;

    /**
     * 3. Vérifier les doublons.
     */
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          {
            email,
          },
          {
            phone: completePhone,
          },
        ],
      },
      select: {
        email: true,
        phone: true,
      },
    });

    if (existingUser?.email === email) {
      return jsonError(
        "Un compte existe déjà avec cette adresse e-mail.",
        409,
      );
    }

    if (existingUser?.phone === completePhone) {
      return jsonError(
        "Un compte existe déjà avec ce numéro de téléphone.",
        409,
      );
    }

    /**
     * 4. Sécuriser le mot de passe et le code de confirmation.
     */
    const bcryptRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? "12");
    const verificationTtlMinutes = Number(
      process.env.EMAIL_VERIFICATION_CODE_TTL_MINUTES ?? "10",
    );

    if (
      !Number.isInteger(bcryptRounds) ||
      bcryptRounds < 10 ||
      bcryptRounds > 15
    ) {
      throw new Error("Configuration BCRYPT_SALT_ROUNDS invalide.");
    }

    if (
      !Number.isInteger(verificationTtlMinutes) ||
      verificationTtlMinutes < 1 ||
      verificationTtlMinutes > 60
    ) {
      throw new Error(
        "Configuration EMAIL_VERIFICATION_CODE_TTL_MINUTES invalide.",
      );
    }

    const verificationCode = randomInt(100000, 1000000).toString();

    const [passwordHash, codeHash] = await Promise.all([
      hash(data.password, bcryptRounds),
      hash(verificationCode, bcryptRounds),
    ]);

    const expiresAt = new Date(
      Date.now() + verificationTtlMinutes * 60 * 1000,
    );

    /**
     * 5. Créer l’utilisateur, son profil organisateur et son code.
     *
     * Toutes les écritures sont regroupées dans une transaction :
     * en cas d’échec d’une opération, aucune création partielle ne reste.
     */
    const registration = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          firstName,
          lastName,
          email,
          phone: completePhone,
          country: officialCountry.name,
          countryCode: data.countryCode,
          dialCode: officialCountry.dialCode,
          passwordHash,
          role: "ORGANIZER",
          emailVerified: false,
          isActive: true,

          organizerProfile: {
            create: {},
          },
        },
        select: {
          id: true,
          firstName: true,
          email: true,
        },
      });

      const verification = await transaction.emailVerification.create({
        data: {
          userId: user.id,
          email: user.email,
          codeHash,
          status: "PENDING",
          attempts: 0,
          expiresAt,
        },
        select: {
          id: true,
        },
      });

      return {
        user,
        verification,
      };
    });

    createdUserId = registration.user.id;

    /**
     * 6. Envoyer le code de validation avec Resend.
     */
    try {
      await sendOrganizerVerificationEmail({
        to: registration.user.email,
        firstName: registration.user.firstName,
        code: verificationCode,
        verificationId: registration.verification.id,
      });
    } catch (mailError) {
      console.error(
        "[ORGANIZER_REGISTER_EMAIL_ERROR]",
        mailError instanceof Error ? mailError.message : mailError,
      );

      /**
       * Si aucun e-mail n’a pu être envoyé, nous supprimons l’inscription
       * incomplète. Les relations sont supprimées grâce à onDelete: Cascade.
       * L’utilisateur pourra alors recommencer proprement.
       */
      await prisma.user.delete({
        where: {
          id: registration.user.id,
        },
      });

      createdUserId = null;

      return jsonError(
        "Le code de confirmation n’a pas pu être envoyé. Réessayez dans quelques instants.",
        503,
      );
    }

    /**
     * 7. Réponse envoyée à la page d’inscription.
     *
     * Le code de confirmation n’est jamais renvoyé au navigateur.
     */
    return NextResponse.json(
      {
        success: true,
        message: "Votre code de confirmation a été envoyé par e-mail.",
        email,
        nextStep: "/organizer/verify-email",
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    /**
     * Protection supplémentaire en cas de doublon créé simultanément
     * par deux requêtes différentes.
     */
    if (isPrismaUniqueConstraintError(error)) {
      return jsonError(
        "Un compte existe déjà avec cette adresse e-mail ou ce numéro.",
        409,
      );
    }

    console.error(
      "[ORGANIZER_REGISTER_ERROR]",
      error instanceof Error ? error.message : error,
    );

    /**
     * Nettoyage éventuel si une erreur survient après la création.
     */
    if (createdUserId) {
      try {
        await prisma.user.delete({
          where: {
            id: createdUserId,
          },
        });
      } catch (cleanupError) {
        console.error(
          "[ORGANIZER_REGISTER_CLEANUP_ERROR]",
          cleanupError instanceof Error
            ? cleanupError.message
            : cleanupError,
        );
      }
    }

    return jsonError(
      "Impossible de créer votre compte pour le moment. Réessayez.",
      500,
    );
  }
}