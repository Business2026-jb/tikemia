import {
  ExternalLink,
  MapPin,
  Navigation,
} from "lucide-react";

import type {
  ClientEventDetail,
} from "@/lib/client/get-client-event-detail";

export type ClientEventLocationProps = {
  event: ClientEventDetail;

  title?: string;
  mapHeight?: number;

  className?: string;
};

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes
    .filter(Boolean)
    .join(" ");
}

function buildAddress(
  event: ClientEventDetail,
): string {
  return [
    event.venueName,
    event.address,
    event.city,
    event.country,
  ]
    .map((value) =>
      value.trim(),
    )
    .filter(Boolean)
    .join(", ");
}

function buildGoogleMapsQuery(
  event: ClientEventDetail,
): string {
  if (
    event.latitude !== null &&
    event.longitude !== null
  ) {
    return `${event.latitude},${event.longitude}`;
  }

  return buildAddress(
    event,
  );
}

function buildGoogleMapsUrl(
  event: ClientEventDetail,
): string {
  const query =
    buildGoogleMapsQuery(
      event,
    );

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query,
  )}`;
}

function buildGoogleMapsEmbedUrl(
  event: ClientEventDetail,
): string {
  const query =
    buildGoogleMapsQuery(
      event,
    );

  const apiKey =
    process.env
      .NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY
      ?.trim();

  if (
    apiKey
  ) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(
      apiKey,
    )}&q=${encodeURIComponent(
      query,
    )}`;
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(
    query,
  )}&output=embed`;
}

export default function ClientEventLocation({
  event,

  title =
    "Lieu de l’événement",

  mapHeight = 360,

  className,
}: ClientEventLocationProps) {
  const fullAddress =
    buildAddress(
      event,
    );

  const googleMapsUrl =
    buildGoogleMapsUrl(
      event,
    );

  const googleMapsEmbedUrl =
    buildGoogleMapsEmbedUrl(
      event,
    );

  return (
    <section
      aria-labelledby="client-event-location-title"
      className={cn(
        "w-full overflow-hidden rounded-3xl border border-white/[0.08] bg-[#071014] shadow-[0_18px_50px_rgba(0,0,0,0.22)]",
        className,
      )}
    >
      <div className="flex flex-col gap-4 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 lg:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-500/20 bg-lime-500/[0.08] text-lime-300">
            <MapPin
              aria-hidden="true"
              className="h-4 w-4"
            />
          </span>

          <div className="min-w-0">
            <h2
              id="client-event-location-title"
              className="text-base font-black text-white sm:text-lg"
            >
              {title}
            </h2>

            <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500 sm:text-sm">
              {fullAddress}
            </p>
          </div>
        </div>

        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-lime-500/20 bg-lime-500/[0.07] px-4 text-xs font-black text-lime-300 outline-none transition hover:border-lime-500/30 hover:bg-lime-500/[0.12] focus-visible:ring-2 focus-visible:ring-lime-400/70 sm:self-auto"
        >
          Ouvrir dans Google Maps

          <ExternalLink
            aria-hidden="true"
            className="h-4 w-4"
          />
        </a>
      </div>

      <div className="relative bg-[#03070a]">
        <iframe
          title={`Carte du lieu : ${event.venueName}`}
          src={googleMapsEmbedUrl}
          width="100%"
          height={mapHeight}
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="block w-full border-0"
        />
      </div>

      <div className="grid gap-3 border-t border-white/[0.07] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5 lg:p-6">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">
            {event.venueName}
          </p>

          <p className="mt-1 text-xs leading-5 text-neutral-500 sm:text-sm">
            {[
              event.address,
              event.city,
              event.country,
            ]
              .map((value) =>
                value.trim(),
              )
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>

        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-black text-neutral-300 outline-none transition hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white focus-visible:ring-2 focus-visible:ring-lime-400/70"
        >
          <Navigation
            aria-hidden="true"
            className="h-4 w-4"
          />

          Itinéraire
        </a>
      </div>
    </section>
  );
}