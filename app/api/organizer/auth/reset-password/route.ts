import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resetPasswordSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("L’adresse e-mail n’est pas valide.")
      .max(254, "L’adresse e-mail est trop longue."),

    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Le code doit contenir exactement 6 chiffres."),

    password: z
      .string()
      .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
      .max(128, "Le mot de passe est trop long.")
      .regex(
        /[a-z]/,
        "Le mot de passe doit contenir une lettre minuscule.",
      )
      .regex(
        /[A-Z]/,
        "Le mot de passe doit contenir une lettre majuscule.",
      )
      .regex(/\d/, "Le mot de passe doit contenir un chiffre."),

    passwordConfirmation: z.string(),
  })
  .refine(
    (data) => data.password === data.passwordConfirmation,
    {
      message: "Les deux mots de passe ne correspondent pas.",
      path: ["passwordConfirmation"],
    },
  );

type JsonResponseBody = {
  success: boolean;
  message: string;
  redirectTo?: string;
};

function jsonResponse(body: JsonResponseBody, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getIntegerEnvironmentValue(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsedValue = Number(value ?? fallback);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < minimum ||
    parsedValue > maximum
  ) {
    return fallback;
  }

  return parsedValue;
}

export async function POST(request: Request) {
  try {
    /*
     * 1. Lire les informations envoyées par la page.
     */
    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          message: "La requête envoyée n’est pas valide.",
        },
        400,
      );
    }

    /*
     * 2. Valider l’e-mail, le code et le nouveau mot de passe.
     */
    const validation = resetPasswordSchema.safeParse(requestBody);

    if (!validation.success) {
      return jsonResponse(
        {
          success: false,
          message:
            validation.error.issues[0]?.message ??
            "Vérifiez les informations renseignées.",
        },
        400,
      );
    }

    const { email, code, password } = validation.data;

    const maxAttempts = getIntegerEnvironmentValue(
      process.env.PASSWORD_RESET_MAX_ATTEMPTS,
      5,
      1,
      10,
    );

    const bcryptRounds = getIntegerEnvironmentValue(
      process.env.BCRYPT_SALT_ROUNDS,
      12,
      10,
      15,
    );

    /*
     * 3. Vérifier le compte organisateur.
     */
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || user.role !== "ORGANIZER") {
      return jsonResponse(
        {
          success: false,
          message:
            "Le code est incorrect, expiré ou ne correspond pas à ce compte.",
        },
        400,
      );
    }

    if (!user.isActive) {
      return jsonResponse(
        {
          success: false,
          message:
            "Ce compte est désactivé. Contactez l’assistance Tikemia.",
        },
        403,
      );
    }

    /*
     * 4. Rechercher le dernier code actif.
     */
    const passwordReset = await prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        email,
        status: "PENDING",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        codeHash: true,
        attempts: true,
        expiresAt: true,
      },
    });

    if (!passwordReset) {
      return jsonResponse(
        {
          success: false,
          message:
            "Aucun code actif n’a été trouvé. Demandez un nouveau code.",
        },
        400,
      );
    }

    /*
     * 5. Contrôler le nombre de tentatives.
     */
    if (passwordReset.attempts >= maxAttempts) {
      await prisma.passwordReset.update({
        where: {
          id: passwordReset.id,
        },
        data: {
          status: "EXPIRED",
        },
      });

      return jsonResponse(
        {
          success: false,
          message:
            "Le nombre maximal de tentatives est atteint. Demandez un nouveau code.",
        },
        429,
      );
    }

    /*
     * 6. Contrôler la date d’expiration.
     */
    if (passwordReset.expiresAt.getTime() <= Date.now()) {
      await prisma.passwordReset.update({
        where: {
          id: passwordReset.id,
        },
        data: {
          status: "EXPIRED",
        },
      });

      return jsonResponse(
        {
          success: false,
          message: "Ce code a expiré. Demandez un nouveau code.",
        },
        410,
      );
    }

    /*
     * 7. Comparer le code reçu avec son hash.
     */
    const codeIsValid = await compare(
      code,
      passwordReset.codeHash,
    );

    if (!codeIsValid) {
      const updatedReset = await prisma.passwordReset.update({
        where: {
          id: passwordReset.id,
        },
        data: {
          attempts: {
            increment: 1,
          },
        },
        select: {
          attempts: true,
        },
      });

      const attemptsRemaining = Math.max(
        maxAttempts - updatedReset.attempts,
        0,
      );

      if (attemptsRemaining === 0) {
        await prisma.passwordReset.update({
          where: {
            id: passwordReset.id,
          },
          data: {
            status: "EXPIRED",
          },
        });

        return jsonResponse(
          {
            success: false,
            message:
              "Le nombre maximal de tentatives est atteint. Demandez un nouveau code.",
          },
          429,
        );
      }

      return jsonResponse(
        {
          success: false,
          message: `Code incorrect. Il vous reste ${attemptsRemaining} tentative${
            attemptsRemaining > 1 ? "s" : ""
          }.`,
        },
        400,
      );
    }

    /*
     * 8. Hacher le nouveau mot de passe.
     */
    const passwordHash = await hash(password, bcryptRounds);
    const now = new Date();

    /*
     * 9. Modifier le mot de passe et sécuriser le compte.
     *
     * Toutes les opérations importantes sont réunies dans une transaction :
     * - modification du mot de passe ;
     * - utilisation définitive du code ;
     * - expiration des autres codes ;
     * - suppression des anciennes sessions.
     */
    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: {
          id: user.id,
        },
        data: {
          passwordHash,
        },
      });

      await transaction.passwordReset.update({
        where: {
          id: passwordReset.id,
        },
        data: {
          status: "USED",
          usedAt: now,
        },
      });

      await transaction.passwordReset.updateMany({
        where: {
          userId: user.id,
          id: {
            not: passwordReset.id,
          },
          status: "PENDING",
        },
        data: {
          status: "EXPIRED",
        },
      });

      /*
       * Toutes les anciennes sessions sont supprimées.
       * L’utilisateur devra se reconnecter avec son nouveau mot de passe.
       */
      await transaction.session.deleteMany({
        where: {
          userId: user.id,
        },
      });
    });

    /*
     * 10. Réponse envoyée à la page.
     */
    return jsonResponse(
      {
        success: true,
        message:
          "Votre mot de passe a été modifié avec succès.",
        redirectTo: "/organizer/login",
      },
      200,
    );
  } catch (error) {
    console.error(
      "[ORGANIZER_RESET_PASSWORD_ERROR]",
      error instanceof Error ? error.message : error,
    );

    return jsonResponse(
      {
        success: false,
        message:
          "Impossible de modifier votre mot de passe pour le moment. Réessayez.",
      },
      500,
    );
  }
}