const AUTH_ERRORS: Record<string, string> = {
  INVALID_PASSWORD: "Le mot de passe actuel est incorrect.",
  INVALID_EMAIL: "Cette adresse e-mail n’est pas valide.",
  PASSWORD_TOO_SHORT: "Le mot de passe doit contenir au moins 8 caractères.",
  PASSWORD_TOO_LONG: "Le mot de passe est trop long.",
  USER_ALREADY_EXISTS: "Cette adresse e-mail est déjà utilisée.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Cette adresse e-mail est déjà utilisée.",
  EMAIL_CAN_NOT_BE_UPDATED: "Cette adresse e-mail ne peut pas être modifiée.",
  SESSION_EXPIRED: "Ta session a expiré. Reconnecte-toi pour continuer.",
  SESSION_NOT_FRESH: "Reconnecte-toi avant d’effectuer cette modification.",
  UNAUTHORIZED: "Reconnecte-toi pour effectuer cette modification.",
};

export function settingsError(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return AUTH_ERRORS[error.code] ?? fallback;
  }
  return fallback;
}
