import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ClientEventDetailCheckout from "@/components/client/events/detail/client-event-detail-checkout";
import { getClientEventDetail } from "@/lib/client/get-client-event-detail";

export const dynamic = "force-dynamic";

type ClientEventDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ClientEventDetailPageProps): Promise<Metadata> {
  const { slug } = await params;

  const result = await getClientEventDetail({ slug }).catch(() => null);

  if (!result) {
    return {
      title: "Événement introuvable",
      description: "Cet événement n’est pas disponible sur Tikemia.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const { event } = result;
  const description =
    event.shortDescription ||
    event.description.replace(/\s+/g, " ").trim().slice(0, 180);
  const socialImage = event.coverImage || "/imageclient.png";

  return {
    title: event.title,
    description,
    alternates: {
      canonical: `/events/${event.slug}`,
    },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      url: `/events/${event.slug}`,
      siteName: "Tikemia",
      title: event.title,
      description,
      images: [
        {
          url: socialImage,
          alt: event.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      images: [
        {
          url: socialImage,
          alt: event.title,
        },
      ],
    },
  };
}

export default async function ClientEventDetailPage({
  params,
}: ClientEventDetailPageProps) {
  const { slug } = await params;

  const result = await getClientEventDetail({ slug }).catch(() => null);

  if (!result) {
    notFound();
  }

  return <ClientEventDetailCheckout event={result.event} />;
}