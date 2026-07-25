"use client";

import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Images,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import type {
  ClientEventDetail,
} from "@/lib/client/get-client-event-detail";

export type ClientEventGalleryProps = {
  event: ClientEventDetail;

  initialImageIndex?: number;

  priority?: boolean;
  showThumbnails?: boolean;
  showCounter?: boolean;

  className?: string;
};

type GalleryImage = {
  id: string;
  publicUrl: string;
  isCover: boolean;
  position: number;
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

function normalizeInitialIndex({
  value,
  total,
}: {
  value: number | undefined;
  total: number;
}): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    total <= 0
  ) {
    return 0;
  }

  return Math.min(
    Math.max(
      value,
      0,
    ),
    total - 1,
  );
}

function buildGalleryImages(
  event: ClientEventDetail,
): GalleryImage[] {
  const images =
    new Map<
      string,
      GalleryImage
    >();

  for (
    const image of event.images
  ) {
    const publicUrl =
      image.publicUrl.trim();

    if (
      !publicUrl
    ) {
      continue;
    }

    images.set(
      publicUrl,
      {
        id:
          image.id,

        publicUrl,

        isCover:
          image.isCover,

        position:
          image.position,
      },
    );
  }

  const coverImage =
    event.coverImage?.trim();

  if (
    coverImage &&
    !images.has(
      coverImage,
    )
  ) {
    images.set(
      coverImage,
      {
        id:
          "event-cover",

        publicUrl:
          coverImage,

        isCover:
          true,

        position:
          -1,
      },
    );
  }

  return Array.from(
    images.values(),
  ).sort(
    (
      first,
      second,
    ) => {
      if (
        first.isCover !==
        second.isCover
      ) {
        return first.isCover
          ? -1
          : 1;
      }

      return (
        first.position -
        second.position
      );
    },
  );
}

function EventImageFallback() {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(132,204,22,0.2),transparent_32%),radial-gradient(circle_at_85%_15%,rgba(249,115,22,0.18),transparent_34%),linear-gradient(145deg,#101c20,#05090c_65%)]">
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-neutral-600">
          <Images
            aria-hidden="true"
            className="h-6 w-6"
          />
        </span>

        <p className="mt-3 text-xs font-bold text-neutral-600">
          Image indisponible
        </p>
      </div>
    </div>
  );
}

export default function ClientEventGallery({
  event,

  initialImageIndex = 0,

  priority = true,
  showThumbnails = true,
  showCounter = true,

  className,
}: ClientEventGalleryProps) {
  const galleryImages =
    useMemo(
      () =>
        buildGalleryImages(
          event,
        ),
      [
        event,
      ],
    );

  const [
    activeIndex,
    setActiveIndex,
  ] =
    useState(
      normalizeInitialIndex({
        value:
          initialImageIndex,

        total:
          galleryImages.length,
      }),
    );

  const activeImage =
    galleryImages[
      activeIndex
    ] ??
    null;

  const hasMultipleImages =
    galleryImages.length >
    1;

  function showPrevious(): void {
    if (
      !hasMultipleImages
    ) {
      return;
    }

    setActiveIndex(
      (
        current,
      ) =>
        current === 0
          ? galleryImages.length -
            1
          : current - 1,
    );
  }

  function showNext(): void {
    if (
      !hasMultipleImages
    ) {
      return;
    }

    setActiveIndex(
      (
        current,
      ) =>
        current ===
        galleryImages.length -
          1
          ? 0
          : current + 1,
    );
  }

  return (
    <section
      aria-label={`Galerie de l’événement ${event.title}`}
      className={cn(
        "w-full min-w-0",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#071014] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="relative aspect-[4/3] w-full sm:aspect-[16/10] lg:aspect-[16/9]">
          {activeImage ? (
            <Image
              key={
                activeImage.id
              }
              src={
                activeImage.publicUrl
              }
              alt={`${event.title} — image ${activeIndex + 1}`}
              fill
              priority={
                priority &&
                activeIndex ===
                  0
              }
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 70vw"
              className="object-cover"
            />
          ) : (
            <EventImageFallback />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15" />

          {showCounter &&
            galleryImages.length >
              0 && (
            <span className="absolute bottom-3 right-3 inline-flex h-8 items-center rounded-full border border-white/15 bg-black/45 px-3 text-[11px] font-black text-white backdrop-blur-md">
              {activeIndex + 1} /{" "}
              {
                galleryImages.length
              }
            </span>
          )}

          {hasMultipleImages && (
            <>
              <button
                type="button"
                onClick={
                  showPrevious
                }
                aria-label="Afficher l’image précédente"
                className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white outline-none backdrop-blur-md transition hover:bg-black/65 active:scale-95 focus-visible:ring-2 focus-visible:ring-lime-400/70"
              >
                <ChevronLeft
                  aria-hidden="true"
                  className="h-5 w-5"
                />
              </button>

              <button
                type="button"
                onClick={
                  showNext
                }
                aria-label="Afficher l’image suivante"
                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white outline-none backdrop-blur-md transition hover:bg-black/65 active:scale-95 focus-visible:ring-2 focus-visible:ring-lime-400/70"
              >
                <ChevronRight
                  aria-hidden="true"
                  className="h-5 w-5"
                />
              </button>
            </>
          )}
        </div>
      </div>

      {showThumbnails &&
        hasMultipleImages && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {galleryImages.map(
            (
              image,
              index,
            ) => {
              const active =
                index ===
                activeIndex;

              return (
                <button
                  key={
                    image.id
                  }
                  type="button"
                  onClick={() =>
                    setActiveIndex(
                      index,
                    )
                  }
                  aria-label={`Afficher l’image ${index + 1}`}
                  aria-pressed={
                    active
                  }
                  className={cn(
                    "relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-lime-400/70 sm:h-20 sm:w-28",
                    active
                      ? "border-lime-400"
                      : "border-white/[0.08] opacity-65 hover:opacity-100",
                  )}
                >
                  <Image
                    src={
                      image.publicUrl
                    }
                    alt=""
                    fill
                    sizes="112px"
                    className="object-cover"
                  />

                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-lime-400/[0.08]"
                    />
                  )}
                </button>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}