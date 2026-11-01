import type { FoundryTool } from "@sylve/game/foundry";

type IconProps = { size?: number; className?: string };

export function FoundryShardIcon({ size = 20, className = "" }: IconProps) {
  return <img className={`foundry-item-icon foundry-shard-icon ${className}`} src="/art/foundry/icons/shards-v1.webp" width={size} height={size} style={{ width: size, height: size }} alt="" aria-hidden="true" draggable={false} />;
}

export function FoundryToolIcon({ tool, size = 40, className = "" }: IconProps & { tool: FoundryTool }) {
  return <img className={`foundry-item-icon foundry-hammer-icon ${className}`} src={`/art/foundry/icons/${tool}-v1.webp`} width={size} height={size} style={{ width: size, height: size }} alt="" aria-hidden="true" draggable={false} />;
}
