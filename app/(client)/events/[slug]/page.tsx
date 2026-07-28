import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import ClientEventDetailCheckout from "@/components/client/events/detail/client-event-detail-checkout";
import { getCurrentClient } from "@/lib/client/get-current-client";
import {
  getClientEventDetail,
  GetClientEventDetailError,
} from "@/lib/client/get-client-event-detail";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ClientEventDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.APP_URL?.trim() ||
  "https://tikemia.com";

const getEventDetail = cache(
  async (slug: string) => {
    try {
      return await getClientEventDetail({
        slug,
      });
    } catch (error) {
      if (
        error instanceof GetClientEventDetailError &&
        error.status === 400
      ) {
        return null;
      }

      throw error;
    }
  },
);

function buildDescription({
  shortDescription,
  description,
}: {
  shortDescription: string | null;
  description: string;
}): string {
  const value =
    shortDescription?.trim() ||
    description
      .replace(/\s+/g, " ")
      .trim();

  return (
    value.slice(0, 180) ||
    "Découvrez cet événement et réservez vos billets sur Tikemia."
  );
}

function buildAbsoluteUrl(
  path: string,
): string {
  try {
    return new URL(
      path,
      APP_URL,
    ).toString();
  } catch {
    return path;
  }
}

export async function generateMetadata({
  params,
}: ClientEventDetailPageProps): Promise<Metadata> {
  const { slug } =
    await params;

  const result =
    await getEventDetail(
      slug,
    );

  if (!result) {
    return {
      title:
        "Événement introuvable",

      description:
        "Cet événement n’est pas disponible sur Tikemia.",

      robots: {
        index:
          false,

        follow:
          false,

        noarchive:
          true,
      },
    };
  }

  const { event } =
    result;

  const description =
    buildDescription({
      shortDescription:
        event.shortDescription,

      description:
        event.description,
    });

  const canonicalPath =
    `/events/${event.slug}`;

  const socialImage =
    event.coverImage ||
    event.images[0]?.publicUrl ||
    "/imageclient.png";

  return {
    title:
      event.title,

    description,

    keywords: [
      event.title,
      event.category?.name,
      event.venueName,
      event.city,
      event.country,
      "Tikemia",
      "billetterie",
      "billets événement",
    ].filter(
      (
        value,
      ): value is string =>
        Boolean(
          value,
        ),
    ),

    alternates: {
      canonical:
        canonicalPath,
    },

    openGraph: {
      type:
        "website",

      locale:
        "fr_FR",

      url:
        canonicalPath,

      siteName:
        "Tikemia",

      title:
        event.title,

      description,

      images: [
        {
          url:
            socialImage,

          alt:
            event.title,
        },
      ],
    },

    twitter: {
      card:
        "summary_large_image",

      title:
        event.title,

      description,

      images: [
        {
          url:
            socialImage,

          alt:
            event.title,
        },
      ],
    },

    robots: {
      index:
        true,

      follow:
        true,

      googleBot: {
        index:
          true,

        follow:
          true,

        "max-image-preview":
          "large",

        "max-snippet":
          -1,

        "max-video-preview":
          -1,
      },
    },
  };
}

export default async function ClientEventDetailPage({
  params,
}: ClientEventDetailPageProps) {
  const { slug } =
    await params;

  const [
    result,
    currentClient,
  ] =
    await Promise.all([
      getEventDetail(
        slug,
      ),

      getCurrentClient(),
    ]);

  if (!result) {
    notFound();
  }

  const { event } =
    result;

  const eventUrl =
    buildAbsoluteUrl(
      `/events/${event.slug}`,
    );

  const eventImage =
    event.coverImage ||
    event.images[0]?.publicUrl ||
    buildAbsoluteUrl(
      "/imageclient.png",
    );

  const eventDescription =
    buildDescription({
      shortDescription:
        event.shortDescription,

      description:
        event.description,
    });

  const structuredData = {
    "@context":
      "https://schema.org",

    "@type":
      "Event",

    name:
      event.title,

    description:
      eventDescription,

    url:
      eventUrl,

    image: [
      buildAbsoluteUrl(
        eventImage,
      ),
    ],

    startDate:
      event.startsAt,

    ...(event.endsAt
      ? {
          endDate:
            event.endsAt,
        }
      : {}),

    eventStatus:
      "https://schema.org/EventScheduled",

    eventAttendanceMode:
      "https://schema.org/OfflineEventAttendanceMode",

    location: {
      "@type":
        "Place",

      name:
        event.venueName,

      address: {
        "@type":
          "PostalAddress",

        streetAddress:
          event.address,

        addressLocality:
          event.city,

        addressCountry:
          event.countryCode ||
          event.country,
      },

      ...(event.latitude !== null &&
      event.longitude !== null
        ? {
            geo: {
              "@type":
                "GeoCoordinates",

              latitude:
                event.latitude,

              longitude:
                event.longitude,
            },
          }
        : {}),
    },

    organizer: {
      "@type":
        "Organization",

      name:
        event.organizer.displayName,

      ...(event.organizer.logo
        ? {
            logo:
              buildAbsoluteUrl(
                event.organizer.logo,
              ),
          }
        : {}),
    },

    ...(event.ticketTypes.length > 0
      ? {
          offers:
            event.ticketTypes.map(
              (
                ticketType,
              ) => ({
                "@type":
                  "Offer",

                name:
                  ticketType.name,

                price:
                  ticketType.price,

                priceCurrency:
                  ticketType.currency,

                availability:
                  ticketType.canPurchase
                    ? "https://schema.org/InStock"
                    : "https://schema.org/SoldOut",

                url:
                  eventUrl,

                ...(ticketType.saleStartsAt
                  ? {
                      validFrom:
                        ticketType.saleStartsAt,
                    }
                  : {}),
              }),
            ),
        }
      : {}),
  };

  const checkoutClient =
    currentClient
      ? {
          id:
            currentClient.id,

          firstName:
            currentClient.firstName,

          lastName:
            currentClient.lastName,

          email:
            currentClient.email,

          phone:
            currentClient.phone,

          countryCode:
            currentClient.countryCode,
        }
      : null;

  return (
    <div className="w-full max-w-none self-stretch">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html:
            JSON.stringify(
              structuredData,
            ).replace(
              /</g,
              "\\u003c",
            ),
        }}
      />

      <ClientEventDetailCheckout
        event={
          event
        }
        currentClient={
          checkoutClient
        }
      />
    </div>
  );
}