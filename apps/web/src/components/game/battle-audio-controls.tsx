import { Volume2, VolumeX } from "lucide-react";

export function BattleAudioControls({ enabled, volume, toggle, setVolume }: {
  enabled: boolean;
  volume: number;
  toggle: () => void;
  setVolume: (volume: number) => void;
}) {
  return (
    <div className="battle-audio-controls" role="group" aria-label="Son du combat">
      <button
        type="button"
        className="icon-button"
        aria-label={enabled ? "Couper le son du combat" : "Activer le son du combat"}
        title={enabled ? "Couper le son du combat" : "Activer le son du combat"}
        aria-pressed={enabled}
        onClick={toggle}
      >
        {enabled && volume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(volume * 100)}
        aria-label="Volume du combat"
        aria-valuetext={`${Math.round(volume * 100)} %`}
        disabled={!enabled}
        onChange={(event) => setVolume(Number(event.target.value) / 100)}
      />
    </div>
  );
}
