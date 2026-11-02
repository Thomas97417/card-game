import type { FoundryTool, FoundryGolemId } from "@sylve/game/foundry";

type IconProps = { size?: number; className?: string };
export function FoundryGolemIcon({ golem, size=48, className='' }:IconProps & {golem:FoundryGolemId}) {
  return <img className={`foundry-item-icon foundry-golem-icon ${className}`} src={`/art/foundry/golems/${golem}-v1.webp`} width={size} height={size} style={{width:size,height:size}} alt="" aria-hidden="true" draggable={false} />;
}

export function FoundryShardIcon({ size = 20, className = "" }: IconProps) {
  return <img className={`foundry-item-icon foundry-shard-icon ${className}`} src="/art/foundry/icons/shards-v1.webp" width={size} height={size} style={{ width: size, height: size }} alt="" aria-hidden="true" draggable={false} />;
}

export function FoundryToolIcon({ tool, size = 40, className = "" }: IconProps & { tool: FoundryTool }) {
  return <img className={`foundry-item-icon foundry-hammer-icon ${className}`} src={`/art/foundry/icons/${tool}-v1.webp`} width={size} height={size} style={{ width: size, height: size }} alt="" aria-hidden="true" draggable={false} />;
}
