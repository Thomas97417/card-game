import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-full flex-col items-center justify-center overflow-hidden bg-[#10281f] px-6 py-12 text-center text-[#f5efde] [font-family:'Avenir_Next',Avenir,'Segoe_UI',sans-serif]">
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
          className="pointer-events-none relative mb-5 flex h-52 w-full max-w-[340px] items-center justify-center select-none sm:h-64 sm:max-w-[420px]"
        >
          <span className="flex gap-[0.5em] font-serif text-[10.5rem] leading-none tracking-[-0.06em] text-[#e1c183]/40 sm:text-[14rem]">
            <span>4</span>
            <span>4</span>
          </span>
          <div className="absolute inset-x-[20%] inset-y-[10%] rounded-full bg-[#7edbce]/15 blur-3xl" />
          <img
            src="/art/characters/wisp.webp"
            alt=""
            width={512}
            height={512}
            className="absolute -bottom-4 left-1/2 h-56 w-56 -translate-x-1/2 object-contain drop-shadow-[0_12px_32px_#0d211b] sm:-bottom-5 sm:h-72 sm:w-72"
          />
        </div>

        <p className="mb-4 flex items-center gap-3 text-[10px] font-semibold tracking-[0.24em] text-[#dfbf7d] uppercase">
          <span aria-hidden="true" className="h-px w-8 bg-[#dfbf7d]/50" />
          <span>
            <span className="sr-only">Erreur 404 — </span>
            Page introuvable
          </span>
          <span aria-hidden="true" className="h-px w-8 bg-[#dfbf7d]/50" />
        </p>
        <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          Tu as quitté le sentier.
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-7 text-[#c3d0bc]">
          Cette page semble s’être égarée dans la forêt. Laisse ce feu follet te
          guider vers l’accueil.
        </p>
        <Link
          to="/"
          className="group mt-8 inline-flex min-h-12 items-center justify-center gap-3 rounded-md border border-[#f0d39a] bg-[#e3c58a] px-6 py-3 text-sm font-semibold text-[#263d30] shadow-[inset_0_0_0_3px_#fff6df20] transition-colors hover:bg-[#edd4a2] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#dfbf7d]"
        >
          <ArrowLeft
            size={16}
            aria-hidden="true"
            className="motion-safe:transition-transform motion-safe:group-hover:-translate-x-1"
          />
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}
