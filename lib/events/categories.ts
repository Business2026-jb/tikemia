export type TikemiaCategory = {
  name: string;
  slug: string;
  description: string;
  icon: string;
};

export const TIKEMIA_EVENT_CATEGORIES = [
  {
    name: "Concerts",
    slug: "concerts",
    description:
      "Concerts live, artistes, groupes, orchestres et performances musicales.",
    icon: "Music2",
  },
  {
    name: "Festivals",
    slug: "festivals",
    description:
      "Festivals de musique, culture, gastronomie, cinéma et divertissement.",
    icon: "Sparkles",
  },
  {
    name: "Culture",
    slug: "culture",
    description:
      "Événements culturels, traditions, patrimoine et expressions artistiques.",
    icon: "Landmark",
  },
  {
    name: "Tourisme",
    slug: "tourisme",
    description:
      "Excursions, visites guidées, découvertes touristiques et expériences locales.",
    icon: "Map",
  },
  {
    name: "Spectacles",
    slug: "spectacles",
    description:
      "Spectacles vivants, performances artistiques et divertissements sur scène.",
    icon: "Drama",
  },
  {
    name: "Humour et stand-up",
    slug: "humour-stand-up",
    description:
      "One-man-shows, spectacles humoristiques et soirées stand-up.",
    icon: "Laugh",
  },
  {
    name: "Théâtre",
    slug: "theatre",
    description:
      "Pièces de théâtre, représentations dramatiques et spectacles scéniques.",
    icon: "Masks",
  },
  {
    name: "Cinéma et projections",
    slug: "cinema-projections",
    description:
      "Projections de films, avant-premières, documentaires et rencontres cinéma.",
    icon: "Clapperboard",
  },
  {
    name: "Conférences",
    slug: "conferences",
    description:
      "Conférences professionnelles, éducatives, scientifiques et publiques.",
    icon: "Presentation",
  },
  {
    name: "Formations",
    slug: "formations",
    description:
      "Formations professionnelles, ateliers pratiques, masterclass et séminaires.",
    icon: "GraduationCap",
  },
  {
    name: "Business et entrepreneuriat",
    slug: "business-entrepreneuriat",
    description:
      "Entrepreneuriat, commerce, investissement, leadership et développement professionnel.",
    icon: "BriefcaseBusiness",
  },
  {
    name: "Networking",
    slug: "networking",
    description:
      "Rencontres professionnelles, afterworks et événements de mise en relation.",
    icon: "Network",
  },
  {
    name: "Technologie et innovation",
    slug: "technologie-innovation",
    description:
      "Technologie, numérique, intelligence artificielle, innovation et startups.",
    icon: "Cpu",
  },
  {
    name: "Salons et expositions",
    slug: "salons-expositions",
    description:
      "Salons professionnels, foires, expositions commerciales et artistiques.",
    icon: "PanelsTopLeft",
  },
  {
    name: "Mode et défilés",
    slug: "mode-defiles",
    description:
      "Défilés de mode, fashion shows, créateurs, beauté et tendances.",
    icon: "Shirt",
  },
  {
    name: "Sport",
    slug: "sport",
    description:
      "Compétitions sportives, rencontres, tournois et événements multisports.",
    icon: "Trophy",
  },
  {
    name: "Football",
    slug: "football",
    description:
      "Matchs de football, tournois, championnats et événements liés au football.",
    icon: "Goal",
  },
  {
    name: "Basketball",
    slug: "basketball",
    description:
      "Matchs, tournois et compétitions de basketball.",
    icon: "CircleDot",
  },
  {
    name: "Course et marathon",
    slug: "course-marathon",
    description:
      "Marathons, courses populaires, trails et compétitions d’athlétisme.",
    icon: "PersonStanding",
  },
  {
    name: "Sports de combat",
    slug: "sports-combat",
    description:
      "Boxe, arts martiaux, lutte, MMA et autres sports de combat.",
    icon: "Swords",
  },
  {
    name: "Gastronomie",
    slug: "gastronomie",
    description:
      "Cuisine, dégustations, festivals culinaires, restaurants et expériences gastronomiques.",
    icon: "Utensils",
  },
  {
    name: "Soirées et nightlife",
    slug: "soirees-nightlife",
    description:
      "Soirées, clubs, DJ sets, soirées privées et événements nocturnes.",
    icon: "PartyPopper",
  },
  {
    name: "Afterwork",
    slug: "afterwork",
    description:
      "Rencontres détendues après le travail, échanges et divertissements.",
    icon: "Martini",
  },
  {
    name: "Gala et dîner",
    slug: "gala-diner",
    description:
      "Galas, dîners officiels, cérémonies et soirées de prestige.",
    icon: "ConciergeBell",
  },
  {
    name: "Mariages et célébrations",
    slug: "mariages-celebrations",
    description:
      "Mariages, fiançailles, anniversaires et grandes célébrations privées.",
    icon: "Heart",
  },
  {
    name: "Famille et enfants",
    slug: "famille-enfants",
    description:
      "Activités familiales, loisirs, animations et événements pour enfants.",
    icon: "Baby",
  },
  {
    name: "Jeunesse et étudiants",
    slug: "jeunesse-etudiants",
    description:
      "Événements scolaires, universitaires, jeunesse et vie étudiante.",
    icon: "School",
  },
  {
    name: "Religion et spiritualité",
    slug: "religion-spiritualite",
    description:
      "Concerts gospel, conférences religieuses, retraites et rassemblements spirituels.",
    icon: "Church",
  },
  {
    name: "Santé et bien-être",
    slug: "sante-bien-etre",
    description:
      "Santé, médecine, fitness, développement personnel et bien-être.",
    icon: "HeartPulse",
  },
  {
    name: "Associations et solidarité",
    slug: "associations-solidarite",
    description:
      "Événements associatifs, humanitaires, communautaires et collectes de fonds.",
    icon: "HandHeart",
  },
  {
    name: "Gaming et e-sport",
    slug: "gaming-esport",
    description:
      "Compétitions de jeux vidéo, gaming, e-sport et communautés numériques.",
    icon: "Gamepad2",
  },
  {
    name: "Arts et créativité",
    slug: "arts-creativite",
    description:
      "Peinture, photographie, danse, artisanat et ateliers créatifs.",
    icon: "Palette",
  },
  {
    name: "Danse",
    slug: "danse",
    description:
      "Spectacles, compétitions, cours et festivals de danse.",
    icon: "Music",
  },
  {
    name: "Politique et citoyenneté",
    slug: "politique-citoyennete",
    description:
      "Débats, rencontres citoyennes, forums publics et événements politiques.",
    icon: "Vote",
  },
  {
    name: "Transport et mobilité",
    slug: "transport-mobilite",
    description:
      "Voyages organisés, déplacements, mobilité et événements liés au transport.",
    icon: "BusFront",
  },
  {
    name: "Autres événements",
    slug: "autres-evenements",
    description:
      "Événements ne correspondant pas aux autres catégories proposées.",
    icon: "Shapes",
  },
] as const satisfies readonly TikemiaCategory[];

export type TikemiaCategorySlug =
  (typeof TIKEMIA_EVENT_CATEGORIES)[number]["slug"];

export function getTikemiaCategoryBySlug(
  slug: string,
): TikemiaCategory | undefined {
  const normalizedSlug = slug.trim().toLowerCase();

  return TIKEMIA_EVENT_CATEGORIES.find(
    (category) => category.slug === normalizedSlug,
  );
}

export function isTikemiaCategorySlug(
  value: string,
): value is TikemiaCategorySlug {
  return TIKEMIA_EVENT_CATEGORIES.some(
    (category) => category.slug === value,
  );
}