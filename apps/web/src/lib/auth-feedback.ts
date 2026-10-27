const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "L’adresse email ou le mot de passe est incorrect.",
  INVALID_PASSWORD: "L’adresse email ou le mot de passe est incorrect.",
  USER_NOT_FOUND: "L’adresse email ou le mot de passe est incorrect.",
  EMAIL_NOT_VERIFIED: "Vérifie ton adresse email pour pouvoir te connecter.",
  INVALID_EMAIL: "Cette adresse email n’est pas valide.",
  USER_ALREADY_EXISTS: "Cette adresse email est déjà utilisée. Connecte-toi ou réinitialise ton mot de passe.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Cette adresse email est déjà utilisée. Connecte-toi ou réinitialise ton mot de passe.",
  PASSWORD_TOO_SHORT: "Le mot de passe doit contenir au moins 8 caractères.",
  PASSWORD_TOO_LONG: "Ce mot de passe est trop long. Choisis-en un plus court.",
  INVALID_TOKEN: "Ce lien est invalide ou a expiré. Demande un nouveau lien.",
  TOKEN_EXPIRED: "Ce lien a expiré. Demande un nouveau lien.",
  TOO_MANY_REQUESTS: "Trop de tentatives. Patiente un instant avant de réessayer.",
  RATE_LIMIT_EXCEEDED: "Trop de tentatives. Patiente un instant avant de réessayer.",
};

export function authErrorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined;
}

export function authErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "status" in error && error.status === 429) return MESSAGES.TOO_MANY_REQUESTS!;
  return MESSAGES[authErrorCode(error) ?? ""] ?? fallback;
}

export function redirectAfterAuth(href: string) {
  window.location.assign(href);
}
