// EU/EEA country codes for GDPR detection
export const EU_EEA_COUNTRIES: readonly string[] = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE", // EU
  "IS", "LI", "NO", // EEA non-EU
  "GB", // UK GDPR (post-Brexit equivalent)
  "CH", // Switzerland (comparable framework)
] as const;

export interface GdprStatus {
  isEu: boolean;
  dataRegion: "EU" | "US" | "UNKNOWN";
  requiresConsent: boolean;
  requiresDeletion72h: boolean;
  audioRetentionDays: number;
}

/** Evaluate GDPR status from a user's stored country code or profile region. */
export function getGdprStatus(countryCode: string | null | undefined): GdprStatus {
  const isEu = !!countryCode && EU_EEA_COUNTRIES.includes(countryCode.toUpperCase());
  return {
    isEu,
    dataRegion: isEu ? "EU" : countryCode ? "US" : "UNKNOWN",
    requiresConsent: isEu,
    requiresDeletion72h: isEu,
    audioRetentionDays: isEu ? 30 : 365,
  };
}

/** Returns true if a UTC timestamp is older than the retention window. */
export function isAudioExpired(createdAt: string, retentionDays: number): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return new Date(createdAt) < cutoff;
}

export const GDPR_CONSENT_TEXT = `By creating an account you consent to Spear collecting and processing:
• Call recordings (stored for up to 30 days in EU data centers)
• Call transcripts and NEPQ analysis scores
• Your name, email address, and location
• Device and session information

You have the right to access, correct, and delete your data at any time from Account Settings → Privacy. Data is processed under legitimate interest for coaching purposes and will not be sold to third parties.`;

export const GDPR_DELETION_REQUEST_TEXT =
  "Your data deletion request has been received. All personal data will be purged within 72 hours per GDPR Article 17.";
