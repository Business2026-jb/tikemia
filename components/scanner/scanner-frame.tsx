"use client";

import {
  Focus,
  ScanLine,
} from "lucide-react";

type ScannerFrameProps = Readonly<{
  active: boolean;
  processing: boolean;
}>;

export default function ScannerFrame({
  active,
  processing,
}: ScannerFrameProps) {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      >
        {/*
         * Assombrissement très léger autour de la zone de lecture.
         *
         * On garde suffisamment de visibilité pour que l'agent
         * puisse facilement positionner le billet devant la caméra.
         */}
        <div className="absolute inset-0 bg-black/25" />

        {/*
         * Zone principale de lecture.
         *
         * Responsive :
         * - mobile : utilise une grande partie de la largeur
         * - tablette / desktop : taille maximale maîtrisée
         */}
        <div className="relative h-[min(72vw,340px)] w-[min(72vw,340px)] sm:h-[min(58vw,360px)] sm:w-[min(58vw,360px)]">
          {/*
           * Fond transparent au centre.
           *
           * Cela renforce visuellement la zone dans laquelle
           * le QR doit être présenté.
           */}
          <div className="absolute inset-0 rounded-[30px] border border-white/[0.05] bg-white/[0.015]" />

          {/*
           * Coins du viseur.
           */}
          <span
            className={[
              "absolute left-0 top-0",
              "h-14 w-14",
              "rounded-tl-[28px]",
              "border-l-[4px] border-t-[4px]",
              processing
                ? "border-amber-300"
                : "border-lime-400",
              "transition-colors duration-200",
              "drop-shadow-[0_0_10px_rgba(163,230,53,0.45)]",
            ].join(" ")}
          />

          <span
            className={[
              "absolute right-0 top-0",
              "h-14 w-14",
              "rounded-tr-[28px]",
              "border-r-[4px] border-t-[4px]",
              processing
                ? "border-amber-300"
                : "border-lime-400",
              "transition-colors duration-200",
              "drop-shadow-[0_0_10px_rgba(163,230,53,0.45)]",
            ].join(" ")}
          />

          <span
            className={[
              "absolute bottom-0 left-0",
              "h-14 w-14",
              "rounded-bl-[28px]",
              "border-b-[4px] border-l-[4px]",
              processing
                ? "border-amber-300"
                : "border-lime-400",
              "transition-colors duration-200",
              "drop-shadow-[0_0_10px_rgba(163,230,53,0.45)]",
            ].join(" ")}
          />

          <span
            className={[
              "absolute bottom-0 right-0",
              "h-14 w-14",
              "rounded-br-[28px]",
              "border-b-[4px] border-r-[4px]",
              processing
                ? "border-amber-300"
                : "border-lime-400",
              "transition-colors duration-200",
              "drop-shadow-[0_0_10px_rgba(163,230,53,0.45)]",
            ].join(" ")}
          />

          {/*
           * LIGNE LASER MOBILE
           *
           * Elle monte et descend en permanence tant que
           * la caméra est active.
           *
           * Elle ne s'arrête PAS pendant la vérification
           * d'un billet.
           */}
          {active ? (
            <div className="absolute inset-x-5 inset-y-6 overflow-hidden rounded-[24px]">
              <span
                className={[
                  "tikemia-scanner-laser",
                  "absolute left-0 right-0",
                  "h-[2px]",
                  processing
                    ? "bg-gradient-to-r from-transparent via-amber-300 to-transparent"
                    : "bg-gradient-to-r from-transparent via-lime-300 to-transparent",
                  processing
                    ? "shadow-[0_0_18px_rgba(252,211,77,0.95)]"
                    : "shadow-[0_0_18px_rgba(163,230,53,0.95)]",
                ].join(" ")}
              >
                {/*
                 * Halo lumineux sous le laser.
                 */}
                <span
                  className={[
                    "absolute inset-x-8 -top-3",
                    "h-7",
                    "blur-xl",
                    processing
                      ? "bg-amber-300/15"
                      : "bg-lime-400/15",
                  ].join(" ")}
                />
              </span>
            </div>
          ) : null}

          {/*
           * Petit repère central.
           *
           * Il reste discret pour ne jamais gêner la lecture du QR.
           */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Focus
              className={[
                "h-7 w-7",
                processing
                  ? "text-amber-200/30"
                  : "text-white/25",
                "transition-colors duration-200",
              ].join(" ")}
            />
          </div>

          {/*
           * État de vérification.
           *
           * On n'affiche plus un gros bloc au centre qui masque
           * la caméra. L'agent doit pouvoir préparer immédiatement
           * le billet suivant.
           */}
          {processing ? (
            <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
              <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-amber-300/25 bg-black/70 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-amber-200 backdrop-blur-md">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-amber-300" />

                Vérification
              </div>
            </div>
          ) : null}

          {/*
           * Icône scanner sous le viseur.
           */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
            <div
              className={[
                "flex h-7 w-7 items-center justify-center",
                "rounded-lg",
                "border",
                processing
                  ? "border-amber-300/25 bg-amber-300/[0.08] text-amber-300"
                  : "border-lime-400/20 bg-lime-400/[0.07] text-lime-400",
                "transition-colors duration-200",
              ].join(" ")}
            >
              <ScanLine className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/*
       * Animation locale.
       *
       * Aucun changement nécessaire dans globals.css.
       *
       * La ligne part du haut, descend jusqu'en bas,
       * puis revient vers le haut.
       */}
      <style jsx>{`
        @keyframes tikemiaScannerLaser {
          0% {
            top: 4%;
            opacity: 0.55;
          }

          8% {
            opacity: 1;
          }

          48% {
            top: 94%;
            opacity: 1;
          }

          50% {
            top: 94%;
            opacity: 0.85;
          }

          92% {
            opacity: 1;
          }

          100% {
            top: 4%;
            opacity: 0.55;
          }
        }

        .tikemia-scanner-laser {
          animation:
            tikemiaScannerLaser
            2.15s
            ease-in-out
            infinite;
          will-change:
            top,
            opacity;
        }

        @media (
          prefers-reduced-motion:
            reduce
        ) {
          .tikemia-scanner-laser {
            animation-duration:
              4s;
          }
        }
      `}</style>
    </>
  );
}