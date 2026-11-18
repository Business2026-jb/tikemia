
/**
 * TIKEMIA — CONTRATS COMMUNS DES PAIEMENTS
 *
 * src/lib/payments/types.ts
 *
 * Paiement direct depuis le checkout TIKEMIA.
 * Compatible avec plusieurs prestataires.
 * Aucun secret API ne doit être exposé au client.
 */

/* =========================================================
   IDENTIFIANTS
========================================================= */

export type PaymentProviderCode =
  | "fedapay"
  | "cinetpay"
  | "stripe"
  | (string & {});

export type PaymentEnvironment =
  | "sandbox"
  | "live";

export type PaymentMethodCategory =
  | "mobile_money"
  | "card"
  | "bank_transfer"
  | "wallet"
  | "other";

export type PaymentChannel =
  | "web"
  | "mobile_web";

export type CheckoutType =
  | "ticket"
  | "donation";

export type CountryCode = string;
export type CurrencyCode = string;

export type OrderId = string;
export type PaymentId = string;
export type TicketId = string;
export type EventId = string;
export type DonationId = string;
export type UserId = string;

/**
 * Date ISO 8601 UTC.
 * Exemple : 2026-11-17T16:30:00.000Z
 */
export type ISODateString = string;

/**
 * Montants JSON représentés en unités mineures.
 *
 * Exemples :
 * XOF 5000 = "5000"
 * EUR 12,50 = "1250"
 *
 * Ne pas utiliser de float pour les calculs.
 */
export type MinorAmount = string;

/* =========================================================
   STATUTS
========================================================= */

export type PaymentStatus =
  | "created"
  | "pending"
  | "requires_action"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired"
  | "refunded"
  | "partially_refunded";

export type OrderStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "fulfilling"
  | "fulfilled"
  | "cancelled"
  | "expired"
  | "refund_pending"
  | "refunded"
  | "partially_refunded";

export type TicketStatus =
  | "pending"
  | "valid"
  | "used"
  | "cancelled"
  | "refunded"
  | "transferred";

export type DonationStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "refunded";

export type DeliveryStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed";

export type ProviderPaymentStatus =
  | "pending"
  | "successful"
  | "failed"
  | "cancelled"
  | "unknown";

export type PaymentVerificationStatus =
  | "unverified"
  | "verified"
  | "rejected";

export type PaymentUiStatus =
  | "idle"
  | "loading_methods"
  | "ready"
  | "submitting"
  | "awaiting_customer"
  | "confirming"
  | "confirmed"
  | "error";

/* =========================================================
   MONTANTS
========================================================= */

export interface PaymentMoney {
  currency: CurrencyCode;

  /**
   * Montant entier sous forme de chaîne.
   */
  amountMinor: MinorAmount;

  /**
   * Nombre de décimales ISO de la devise.
   */
  exponent: number;
}

export interface CheckoutTotals {
  subtotal: PaymentMoney;
  fees: PaymentMoney;
  total: PaymentMoney;
}

/* =========================================================
   PAYS ET DEVISES
========================================================= */

export interface PaymentCountry {
  code: CountryCode;
  name: string;
  dialCode?: string;
  enabled: boolean;
}

export interface PaymentCurrency {
  code: CurrencyCode;
  name: string;
  symbol?: string;
  exponent: number;
  enabled: boolean;
}

/* =========================================================
   MOYENS DE PAIEMENT
========================================================= */

export interface PaymentMethod {
  /**
   * Identifiant public stable.
   * Exemple : fedapay_bj_mtn
   */
  id: string;

  /**
   * Code utilisé par le prestataire.
   */
  code: string;

  /**
   * Texte visible au client.
   */
  name: string;

  category: PaymentMethodCategory;

  /**
   * Ressource visuelle autorisée.
   * Ne jamais inventer une URL de logo.
   */
  logoUrl: string | null;

  /**
   * Prestataire utilisé uniquement côté serveur.
   * Ne pas sérialiser ce champ vers le checkout public.
   */
  provider: PaymentProviderCode;

  countries: CountryCode[];
  currencies: CurrencyCode[];

  enabled: boolean;

  /**
   * Le prestataire accepte-t-il réellement
   * cette méthode dans cette configuration ?
   */
  verified: boolean;

  /**
   * Disponible dans le mode d'intégration choisi.
   */
  supportedInCheckout: boolean;

  /**
   * Une authentification externe peut être
   * nécessaire, notamment pour les cartes.
   */
  mayRequireExternalAuthentication: boolean;

  /**
   * Ordre de présentation.
   */
  displayOrder: number;
}

/**
 * Version publique.
 *
 * Aucun nom de prestataire, identifiant
 * de connexion ou secret n'est exposé.
 */
export type PublicPaymentMethod = Pick<
  PaymentMethod,
  | "id"
  | "name"
  | "category"
  | "logoUrl"
  | "mayRequireExternalAuthentication"
  | "displayOrder"
>;

export interface PaymentMethodAvailability {
  method: PaymentMethod;
  available: boolean;
  checkedAt: ISODateString;

  reason?:
    | "country_unsupported"
    | "currency_unsupported"
    | "method_disabled"
    | "provider_unavailable"
    | "not_verified"
    | "unsupported_checkout"
    | "amount_unsupported";
}

export interface PaymentMethodsQuery {
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  checkoutType: CheckoutType;
}

export interface PaymentMethodsResponse {
  success: true;

  countryCode: CountryCode;
  currencyCode: CurrencyCode;

  methods: PublicPaymentMethod[];

  checkedAt: ISODateString;
}

/* =========================================================
   IDENTITÉ CLIENT
========================================================= */

export interface CheckoutCustomer {
  email: string;

  phone: string;

  countryCode: CountryCode;

  /**
   * Identifiant du compte connecté,
   * lorsqu'il existe.
   *
   * Ne jamais le croire sur parole
   * lorsqu'il provient du navigateur.
   */
  userId?: UserId | null;
}

export interface PublicCheckoutCustomer {
  email: string;
  phone: string;
  countryCode: CountryCode;
}

/* =========================================================
   COMMANDE
========================================================= */

export interface CheckoutItem {
  id: string;
  eventId: EventId;

  ticketCategoryId: string;

  ticketCategoryName: string;

  quantity: number;

  unitPrice: PaymentMoney;
}

export interface CheckoutOrder {
  id: OrderId;

  type: CheckoutType;

  status: OrderStatus;

  customer: CheckoutCustomer;

  items: CheckoutItem[];

  totals: CheckoutTotals;

  createdAt: ISODateString;
  updatedAt: ISODateString;

  expiresAt: ISODateString | null;
}

export interface CheckoutOrderSummary {
  id: OrderId;
  type: CheckoutType;
  status: OrderStatus;

  eventName?: string;

  itemCount: number;

  totals: CheckoutTotals;
}

/* =========================================================
   DEMANDE DE PAIEMENT
========================================================= */

export interface CreatePaymentRequest {
  /**
   * Référence de commande existante.
   *
   * Le serveur doit retrouver et recalculer
   * la commande avant de payer.
   */
  orderId: OrderId;

  /**
   * Identifiant public d'une méthode.
   */
  paymentMethodId: string;

  customer: PublicCheckoutCustomer;

  /**
   * Jeton d'idempotence propre à la demande.
   */
  idempotencyKey: string;
}

/**
 * Les montants et le prestataire ne figurent
 * pas dans CreatePaymentRequest.
 *
 * Le serveur les détermine depuis la commande
 * et sa configuration de paiement.
 */

/* =========================================================
   ACTIONS CLIENT
========================================================= */

export type PaymentNextAction =
  | {
      type: "none";
    }
  | {
      type: "display_instructions";
      message: string;
    }
  | {
      type: "mobile_money_prompt";
      message: string;
    }
  | {
      type: "embedded_checkout";
      publicKey: string;
      environment: PaymentEnvironment;
      transactionId: number;
    }
  | {
      type: "redirect";
      url: string;
    };

/**
 * La redirection reste possible lorsque
 * le prestataire ou la banque l'exige.
 *
 * Pour les méthodes compatibles, TIKEMIA
 * conserve le parcours dans /checkout.
 */

export interface CreatePaymentResponse {
  success: true;

  paymentId: PaymentId;
  orderId: OrderId;

  status: PaymentStatus;

  nextAction: PaymentNextAction;

  createdAt: ISODateString;
}

/* =========================================================
   TRANSACTION INTERNE
========================================================= */

export interface PaymentTransaction {
  id: PaymentId;

  orderId: OrderId;

  provider: PaymentProviderCode;
  environment: PaymentEnvironment;

  paymentMethodId: string;

  providerTransactionId: string | null;

  idempotencyKey: string;

  amount: PaymentMoney;

  status: PaymentStatus;

  verificationStatus: PaymentVerificationStatus;

  /**
   * Données limitées et non sensibles.
   */
  providerReference: string | null;

  failureCode: string | null;

  createdAt: ISODateString;
  updatedAt: ISODateString;
  paidAt: ISODateString | null;
}

/* =========================================================
   CONTRAT DES CONNECTEURS
========================================================= */

export interface ProviderPaymentRequest {
  paymentId: PaymentId;

  orderId: OrderId;

  amount: PaymentMoney;

  paymentMethodCode: string;

  customer: PublicCheckoutCustomer;

  idempotencyKey: string;

  description: string;

  /**
   * Références internes non sensibles.
   */
  metadata: Record<string, string>;
}

export interface ProviderPaymentResult {
  providerTransactionId: string;

  providerReference: string | null;

  status: ProviderPaymentStatus;

  nextAction: PaymentNextAction;

  createdAt?: ISODateString;
}

export interface ProviderPaymentVerification {
  providerTransactionId: string;

  providerReference: string | null;

  status: ProviderPaymentStatus;

  amount: PaymentMoney;

  verifiedAt: ISODateString;

  /**
   * Identifie le résultat comme obtenu
   * auprès d'une source PSP authentifiée.
   */
  source:
    | "authenticated_api"
    | "verified_webhook";
}

export interface PaymentProviderAdapter {
  readonly code: PaymentProviderCode;

  readonly environment: PaymentEnvironment;

  createPayment(
    request: ProviderPaymentRequest
  ): Promise<ProviderPaymentResult>;

  getPayment(
    providerTransactionId: string
  ): Promise<ProviderPaymentVerification>;
}

/* =========================================================
   ÉTAT DU PAIEMENT POUR LE CHECKOUT
========================================================= */

export interface PaymentStatusQuery {
  paymentId: PaymentId;
}

export interface PublicPaymentStatus {
  paymentId: PaymentId;

  orderId: OrderId;

  paymentStatus: PaymentStatus;

  orderStatus: OrderStatus;

  /**
   * Toujours false avant confirmation
   * financière officielle.
   */
  confirmed: boolean;

  ticketsReady: boolean;

  ticketCount: number;

  emailDeliveryStatus:
    | DeliveryStatus
    | null;

  updatedAt: ISODateString;
}

export interface PaymentStatusResponse {
  success: true;
  data: PublicPaymentStatus;
}

/* =========================================================
   ÉVÉNEMENTS WEBHOOK
========================================================= */

export type PaymentWebhookEventType =
  | "payment.pending"
  | "payment.succeeded"
  | "payment.failed"
  | "payment.cancelled"
  | "payment.refunded"
  | "payment.updated";

export interface VerifiedPaymentWebhook {
  id: string;

  provider: PaymentProviderCode;

  eventType: PaymentWebhookEventType;

  providerTransactionId: string;

  providerReference: string | null;

  receivedAt: ISODateString;

  /**
   * L'authenticité doit avoir été vérifiée
   * avant de construire cet objet.
   */
  authenticated: true;
}

export type WebhookProcessingStatus =
  | "received"
  | "processing"
  | "processed"
  | "ignored"
  | "failed";

export interface PaymentWebhookRecord {
  id: string;

  provider: PaymentProviderCode;

  providerEventId: string;

  eventType: PaymentWebhookEventType;

  status: WebhookProcessingStatus;

  receivedAt: ISODateString;

  processedAt: ISODateString | null;
}

/* =========================================================
   CONFIRMATION FINANCIÈRE
========================================================= */

export interface ConfirmedPayment {
  paymentId: PaymentId;

  orderId: OrderId;

  provider: PaymentProviderCode;

  providerTransactionId: string;

  amount: PaymentMoney;

  confirmedAt: ISODateString;

  verification:
    ProviderPaymentVerification;
}

/* =========================================================
   ÉVÉNEMENT ET BILLETS
========================================================= */

export interface TicketEventSnapshot {
  eventId: EventId;

  eventName: string;

  /**
   * Image de l'événement autorisée
   * pour le rendu du billet.
   */
  imageUrl: string | null;

  startsAt: ISODateString;

  timezone: string;

  venueName: string | null;

  venueAddress: string | null;
}

export interface TicketHolder {
  /**
   * Une seule valeur est affichée
   * sur le billet :
   *
   * - email ;
   * - ou téléphone.
   */
  type: "email" | "phone";

  value: string;
}

export interface ElectronicTicket {
  id: TicketId;

  orderId: OrderId;

  eventId: EventId;

  reference: string;

  categoryName: string;

  event: TicketEventSnapshot;

  holder: TicketHolder;

  /**
   * Jeton opaque et aléatoire.
   *
   * Le QR code doit contenir une valeur
   * vérifiable sans exposer les secrets.
   */
  qrToken: string;

  status: TicketStatus;

  issuedAt: ISODateString;

  usedAt: ISODateString | null;

  transferredAt: ISODateString | null;

  transferredToEmail: string | null;
}

/* =========================================================
   MODÈLE VISUEL DU BILLET PDF
========================================================= */

export interface TicketPdfData {
  ticketId: TicketId;

  reference: string;

  eventName: string;

  eventImageUrl: string | null;

  dateLabel: string;

  timeLabel: string;

  holderLabel: string;

  holderValue: string;

  categoryName: string;

  qrPayload: string;

  statusLabel: string;

  singleScanLabel: string;

  footerLabel: string;
}

export interface GeneratedTicketPdf {
  ticketId: TicketId;

  fileName: string;

  contentType: "application/pdf";

  /**
   * Objet serveur uniquement.
   *
   * Ne pas transmettre un Buffer JSON
   * au navigateur.
   */
  content: Uint8Array;
}

/* =========================================================
   CONTRÔLE DU QR CODE
========================================================= */

export type TicketScanResultCode =
  | "valid"
  | "already_used"
  | "invalid"
  | "cancelled"
  | "refunded"
  | "transferred"
  | "wrong_event";

export interface TicketScanResult {
  ticketId: TicketId | null;

  code: TicketScanResultCode;

  accepted: boolean;

  scannedAt: ISODateString;

  eventId: EventId | null;
}

/* =========================================================
   LIVRAISON DES BILLETS
========================================================= */

export interface TicketDeliveryJob {
  id: string;

  orderId: OrderId;

  recipientEmail: string;

  ticketIds: TicketId[];

  status: DeliveryStatus;

  attempts: number;

  createdAt: ISODateString;

  nextAttemptAt: ISODateString | null;

  sentAt: ISODateString | null;
}

export interface TicketDeliveryResult {
  orderId: OrderId;

  ticketIds: TicketId[];

  status: DeliveryStatus;

  sentAt: ISODateString | null;
}

/* =========================================================
   DONATIONS / CAGNOTTES
========================================================= */

export interface DonationPaymentTarget {
  donationId: DonationId;

  fundraiserId: string;

  amount: PaymentMoney;

  donorEmail: string;

  donorPhone: string | null;
}

export interface ConfirmedDonation {
  donationId: DonationId;

  fundraiserId: string;

  orderId: OrderId;

  paymentId: PaymentId;

  amount: PaymentMoney;

  status: "confirmed";

  confirmedAt: ISODateString;
}

/* =========================================================
   EXÉCUTION APRÈS CONFIRMATION
========================================================= */

export type FulfillmentKind =
  | "tickets"
  | "donation";

export type FulfillmentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface FulfillmentRecord {
  id: string;

  orderId: OrderId;

  paymentId: PaymentId;

  kind: FulfillmentKind;

  status: FulfillmentStatus;

  createdAt: ISODateString;

  completedAt: ISODateString | null;
}

export interface TicketFulfillmentResult {
  kind: "tickets";

  orderId: OrderId;

  paymentId: PaymentId;

  status: FulfillmentStatus;

  ticketIds: TicketId[];

  deliveryStatus: DeliveryStatus;
}

export interface DonationFulfillmentResult {
  kind: "donation";

  orderId: OrderId;

  paymentId: PaymentId;

  status: FulfillmentStatus;

  donationId: DonationId;
}

export type FulfillmentResult =
  | TicketFulfillmentResult
  | DonationFulfillmentResult;

/* =========================================================
   ERREURS API
========================================================= */

export type PaymentErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_EMAIL"
  | "INVALID_PHONE"
  | "INVALID_AMOUNT"
  | "INVALID_CURRENCY"
  | "INVALID_COUNTRY"
  | "ORDER_NOT_FOUND"
  | "ORDER_EXPIRED"
  | "ORDER_ALREADY_PAID"
  | "ORDER_NOT_PAYABLE"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_METHOD_UNAVAILABLE"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_REJECTED"
  | "PAYMENT_PENDING"
  | "PAYMENT_FAILED"
  | "PAYMENT_NOT_CONFIRMED"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "PAYMENT_CURRENCY_MISMATCH"
  | "PAYMENT_REFERENCE_MISMATCH"
  | "INVALID_WEBHOOK_SIGNATURE"
  | "DUPLICATE_REQUEST"
  | "IDEMPOTENCY_CONFLICT"
  | "TICKETS_UNAVAILABLE"
  | "TICKET_DELIVERY_FAILED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface PaymentApiError {
  success: false;

  error: {
    code: PaymentErrorCode;

    message: string;

    retryable: boolean;
  };
}

export interface PaymentApiSuccess<T> {
  success: true;

  data: T;
}

export type PaymentApiResponse<T> =
  | PaymentApiSuccess<T>
  | PaymentApiError;

/* =========================================================
   CONFIGURATION DES PRESTATAIRES
========================================================= */

/**
 * Configuration serveur uniquement.
 *
 * Les clés sont conservées dans les
 * variables d'environnement ou un
 * stockage de secrets sécurisé.
 *
 * Ne jamais transmettre cet objet
 * aux composants React clients.
 */

export interface PaymentProviderConfig {
  code: PaymentProviderCode;

  environment: PaymentEnvironment;

  enabled: boolean;

  /**
   * URL racine officielle du PSP.
   */
  apiBaseUrl: string;

  /**
   * Secret serveur.
   */
  secretKey: string;

  /**
   * Secret de vérification des webhooks
   * lorsqu'il est fourni par le PSP.
   */
  webhookSecret?: string;
}

/* =========================================================
   SÉLECTION INTERNE DU PRESTATAIRE
========================================================= */

export interface PaymentRoute {
  connectionId?: string;
  provider: PaymentProviderCode;

  methodId: string;

  countryCode: CountryCode;

  currencyCode: CurrencyCode;

  environment: PaymentEnvironment;

  priority: number;

  enabled: boolean;
}

export interface PaymentSelection {
  method: PaymentMethod;

  route: PaymentRoute;

  checkedAt: ISODateString;
}

/* =========================================================
   ÉTAT DU COMPOSANT PC / MOBILE
========================================================= */

export interface CheckoutPaymentState {
  status: PaymentUiStatus;

  methods: PublicPaymentMethod[];

  selectedMethodId: string | null;

  paymentId: PaymentId | null;

  nextAction: PaymentNextAction | null;

  errorMessage: string | null;
}

/* =========================================================
   INTERFACE D'INTÉGRATION DU CHECKOUT
========================================================= */

export interface CheckoutPaymentProps {
  orderId: OrderId;

  countryCode: CountryCode;

  currencyCode: CurrencyCode;

  customerEmail: string;

  customerPhone: string;

  onPaymentConfirmed?: (
    payment: PublicPaymentStatus
  ) => void;

  onPaymentFailed?: (
    message: string
  ) => void;
}

/* =========================================================
   RÈGLES D'INTÉGRATION
========================================================= */

/**
 * 1. Aucun billet avant paiement confirmé.
 *
 * 2. Les montants sont recalculés côté serveur.
 *
 * 3. Une tentative possède une clé
 *    d'idempotence.
 *
 * 4. Un webhook doit être authentifié.
 *
 * 5. Le paiement doit être rapproché
 *    avec la commande, le montant
 *    et la devise attendus.
 *
 * 6. Une commande payée ne doit jamais
 *    générer deux fois ses billets.
 *
 * 7. Chaque billet possède un QR code
 *    unique à usage unique.
 *
 * 8. Les billets sont enregistrés avant
 *    le déclenchement de l'envoi email.
 *
 * 9. L'envoi email peut être réessayé
 *    sans recréer de billets.
 *
 * 10. Les achats invités peuvent être
 *     associés à un compte après
 *     vérification de son email.
 *
 * 11. Les opérations de paiement doivent
 *     continuer même si le navigateur
 *     du client est fermé.
 *
 * 12. Les secrets API et webhooks restent
 *     exclusivement côté serveur.
 *
 * 13. Le checkout public n'expose jamais
 *     les identifiants internes PSP.
 *
 * 14. La disponibilité d'une méthode
 *     dépend des capacités officiellement
 *     confirmées et de la configuration.
 *
 * 15. Certains paiements peuvent exiger
 *     une authentification externe.
 */

export interface PaymentCheckoutConnector {
 listMethods?(query: PaymentMethodsQuery & { amountMinor?: string }): Promise<PaymentSelection[]>;
 supportsMethod(code: string): boolean;
 initiate(connectionId: string | undefined, request: ProviderPaymentRequest, persistReference: (reference: string) => Promise<void>): Promise<PaymentNextAction>;
 verify(paymentId: string, reference: string, expected: PaymentMoney): Promise<ProviderPaymentVerification>;
 resume?(paymentId: string, reference: string): Promise<PaymentNextAction>;
}
