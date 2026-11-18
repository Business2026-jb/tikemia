import { connection } from "next/server";

import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";

import {
  getCountryCallingCode,
  isSupportedCountry,
  type CountryCode,
} from "libphonenumber-js";

/* ============================================
   TIKEMIA — API GÉOLOCALISATION

   Route : GET /api/geo

   Fonctionnement :
   - Détection du pays depuis l'IP
   - Indicatif téléphonique international
   - Noms du pays en français et anglais
   - Aucun stockage d'adresse IP
   - Pas de base de données nécessaire
   - Compatible Next.js App Router

   La détection est une suggestion.
   L'utilisateur peut modifier son pays.
============================================ */


/* ============================================
   TYPES
============================================ */

type GeoSource =
  | "vercel"
  | "cloudflare"
  | "ip"
  | "unavailable";

type GeoResult = {
  success: boolean;
  countryCode: string | null;
  countryName: string | null;
  countryNameEn: string | null;
  dialCode: string | null;
  source: GeoSource;
};

/* ============================================
   RÉPONSE PAR DÉFAUT
============================================ */

const EMPTY_RESULT: GeoResult = {
  success: false,
  countryCode: null,
  countryName: null,
  countryNameEn: null,
  dialCode: null,
  source: "unavailable",
};

/* ============================================
   EN-TÊTES DE SÉCURITÉ
============================================ */

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

/* ============================================
   NORMALISATION DU PAYS
============================================ */

function normalizeCountryCode(
  value: unknown
): CountryCode | null {
  if (typeof value !== "string") {
    return null;
  }

  const country = value.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(country)) {
    return null;
  }

  if (!isSupportedCountry(country)) {
    return null;
  }

  return country as CountryCode;
}

/* ============================================
   CONSTRUCTION DU RÉSULTAT
============================================ */

function buildGeoResult(
  countryValue: unknown,
  source: GeoSource
): GeoResult {
  const countryCode = normalizeCountryCode(
    countryValue
  );

  if (!countryCode) {
    return EMPTY_RESULT;
  }

  try {
    const frenchNames = new Intl.DisplayNames(
      ["fr"],
      { type: "region" }
    );

    const englishNames = new Intl.DisplayNames(
      ["en"],
      { type: "region" }
    );

    const dialCode =
      getCountryCallingCode(countryCode);

    return {
      success: true,
      countryCode,
      countryName:
        frenchNames.of(countryCode) ?? countryCode,
      countryNameEn:
        englishNames.of(countryCode) ?? countryCode,
      dialCode: `+${dialCode}`,
      source,
    };
  } catch {
    return EMPTY_RESULT;
  }
}

/* ============================================
   VÉRIFICATION IP PUBLIQUE
============================================ */

function isPublicIP(value: string): boolean {
  const version = isIP(value);

  if (version === 0) {
    return false;
  }

  if (version === 4) {
    const parts = value.split(".").map(Number);

    const [a, b, c] = parts;

    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)
    ) {
      return false;
    }

    return true;
  }

  const lower = value.toLowerCase();

  if (
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    /^fe[89ab]/.test(lower) ||
    lower.startsWith("ff") ||
    lower.startsWith("2001:db8:")
  ) {
    return false;
  }

  // Les adresses IPv4 encapsulées ne sont
  // pas utilisées pour la géolocalisation.
  if (lower.includes(".")) {
    return false;
  }

  return true;
}

/* ============================================
   RÉCUPÉRATION DE L'IP

   Les en-têtes forwarded sont acceptés
   uniquement si le reverse proxy est
   configuré pour les contrôler.
============================================ */

function getTrustedClientIP(
  request: NextRequest
): string | null {
  const trustedProxy =
    process.env.TIKEMIA_TRUST_PROXY === "true";

  if (!trustedProxy) {
    return null;
  }

  const forwarded = request.headers.get(
    "x-forwarded-for"
  );

  if (!forwarded) {
    return null;
  }

  const firstIP = forwarded
    .split(",")[0]
    ?.trim();

  if (!firstIP || !isPublicIP(firstIP)) {
    return null;
  }

  return firstIP;
}

/* ============================================
   GÉOLOCALISATION EXTERNE

   Utilisée uniquement lorsqu'une IP
   publique fiable est disponible.

   Pour la production commerciale,
   vérifier la licence du fournisseur.
============================================ */

async function lookupCountryFromIP(
  ip: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}`,
      {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(3500),
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();

    if (
      typeof data !== "object" ||
      data === null
    ) {
      return null;
    }

    const result = data as {
      success?: unknown;
      country_code?: unknown;
    };

    if (result.success !== true) {
      return null;
    }

    return typeof result.country_code === "string"
      ? result.country_code
      : null;
  } catch {
    return null;
  }
}

/* ============================================
   ROUTE PRINCIPALE GET /api/geo
============================================ */

export async function GET(request: NextRequest) {
  await connection();
  try {
    // 1. Géolocalisation fournie par Vercel.
    // À utiliser uniquement dans cet environnement.

    if (process.env.VERCEL === "1") {
      const country = request.headers.get(
        "x-vercel-ip-country"
      );

      const result = buildGeoResult(
        country,
        "vercel"
      );

      if (result.success) {
        return NextResponse.json(result, {
          headers: RESPONSE_HEADERS,
        });
      }
    }

    // 2. Géolocalisation fournie par Cloudflare.
    // Le proxy doit retirer les en-têtes
    // envoyés directement par les visiteurs.

    if (
      process.env.TIKEMIA_TRUST_CLOUDFLARE ===
      "true"
    ) {
      const country = request.headers.get(
        "cf-ipcountry"
      );

      const result = buildGeoResult(
        country,
        "cloudflare"
      );

      if (result.success) {
        return NextResponse.json(result, {
          headers: RESPONSE_HEADERS,
        });
      }
    }

    // 3. Recherche par IP publique.
    // Nécessite un proxy explicitement fiable.

    const clientIP = getTrustedClientIP(request);

    if (clientIP) {
      const detectedCountry =
        await lookupCountryFromIP(clientIP);

      const result = buildGeoResult(
        detectedCountry,
        "ip"
      );

      if (result.success) {
        return NextResponse.json(result, {
          headers: RESPONSE_HEADERS,
        });
      }
    }

    // 4. Aucun pays détecté.
    // Le formulaire proposera le choix manuel.

    return NextResponse.json(
      EMPTY_RESULT,
      {
        status: 200,
        headers: RESPONSE_HEADERS,
      }
    );
  } catch {
    // La panne de géolocalisation ne bloque
    // jamais l'inscription d'un organisateur.

    return NextResponse.json(
      EMPTY_RESULT,
      {
        status: 200,
        headers: RESPONSE_HEADERS,
      }
    );
  }
}
