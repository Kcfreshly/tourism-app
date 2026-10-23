import { minutes, time, type Item } from "./planner";

export type PlannerDrag =
  { kind: "item"; id: string } | { kind: "offer"; offerId: string; id: string };
export const snapMinutes = (value: number) => Math.round(value / 15) * 15;
export function resizedBlock(
  item: Item,
  edge: "start" | "end",
  delta: number,
): Item {
  const value = snapMinutes(
    minutes(edge === "start" ? item.startTime : item.endTime) + delta,
  );
  return {
    ...item,
    [edge === "start" ? "startTime" : "endTime"]: time(
      Math.max(0, Math.min(1425, value)),
    ),
  };
}
