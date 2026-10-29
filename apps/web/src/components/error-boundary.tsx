import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, RotateCcw } from "lucide-react";

export default function ErrorBoundary({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <main className="relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden bg-[#10281f] px-6 py-12 text-center text-[#f5efde] [font-family:'Avenir_Next',Avenir,'Segoe_UI',sans-serif]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <img
          src="/art/play-lobby.webp"
          alt=""
          width={1672}
          height={941}
          fetchPriority="high"
          className="h-full w-full object-cover object-[center_40%]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,#10281f66,#10281fe6_75%),linear-gradient(0deg,#10281f,#10281f33)]" />
      </div>

      <div className="relative flex w-full max-w-xl flex-col items-center">
        <div
          aria-hidden="true"
          className="pointer-events-none relative mb-5 flex h-52 w-full items-center justify-center select-none sm:h-64"
        >
          <div className="absolute size-44 rounded-full border border-[#dfbf7d]/20 bg-[#dfbf7d]/5 sm:size-56" />
          <div className="absolute inset-x-[20%] inset-y-[10%] rounded-full bg-[#dfbf7d]/15 blur-3xl" />
          <img
            src="/art/characters/gnome.webp"
            alt=""
            width={512}
            height={512}
            className="relative h-56 w-56 object-contain drop-shadow-[0_12px_32px_#0d211b] sm:h-72 sm:w-72"
          />
        </div>

        <p className="mb-4 flex items-center gap-3 text-[10px] font-semibold tracking-[0.24em] text-[#dfbf7d] uppercase">
          <span aria-hidden="true" className="h-px w-8 bg-[#dfbf7d]/50" />
          Erreur inattendue
          <span aria-hidden="true" className="h-px w-8 bg-[#dfbf7d]/50" />
        </p>
        <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          Un rouage s’est grippé.
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-7 text-[#c3d0bc]">
          Une erreur a interrompu ton aventure. Réessaie dans un instant ou
          retrouve le chemin de l’accueil.
        </p>

        <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            className="inline-flex min-h-12 items-center justify-center gap-3 rounded-md border border-[#f0d39a] bg-[#e3c58a] px-6 py-3 text-sm font-semibold text-[#263d30] shadow-[inset_0_0_0_3px_#fff6df20] transition-colors hover:bg-[#edd4a2] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#dfbf7d]"
            onClick={() => {
              reset();
              router.invalidate();
            }}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Réessayer
          </button>
          <Link
            to="/"
            className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-md border border-[#dfbf7d]/40 bg-[#10281f]/40 px-6 py-3 text-sm font-medium text-[#f5efde] transition-colors hover:border-[#dfbf7d]/70 hover:bg-[#dfbf7d]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#dfbf7d]"
          >
            <ArrowLeft
              size={16}
              aria-hidden="true"
              className="motion-safe:transition-transform motion-safe:group-hover:-translate-x-1"
            />
            Retour à l’accueil
          </Link>
        </div>

        {import.meta.env.DEV && error instanceof Error && (
          <details className="mt-8 w-full max-w-lg rounded-md border border-[#dfbf7d]/20 bg-[#0d211b]/70 text-left">
            <summary className="cursor-pointer rounded-md px-4 py-3 text-xs font-medium text-[#c3d0bc] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#dfbf7d]">
              Détails de l’erreur
            </summary>
            <pre className="max-h-40 overflow-auto border-t border-[#dfbf7d]/20 p-4 text-xs leading-6 whitespace-pre-wrap text-[#e7c4a3] [overflow-wrap:anywhere]">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </main>
  );
}
