import type { Stage } from "../types";

/** 发育阶段的前进次序，rank 只允许不减 */
export const STAGE_RANK: Record<Stage, number> = {
  卵: 0,
  幼虫: 1,
  蛹: 2,
  成虫: 3,
};

export const EXPOSURE_STAGES = [
  "新鲜期",
  "肿胀期",
  "腐烂期",
  "后腐烂期",
  "白骨化期",
];

export const PRESERVATIONS = [
  "75%乙醇浸泡",
  "无水乙醇浸泡",
  "低温冷冻(-20℃)",
  "透气管干燥保存",
  "干燥针插",
  "福尔马林固定",
];

export const KNOWN_SPECIES = [
  "大头金蝇 Chrysomya megacephala",
  "丝光绿蝇 Lucilia sericata",
  "家蝇 Musca domestica",
  "黑尾黑麻蝇 Helicophagella melanura",
  "厚环黑蝇 Ophyra capensis",
];

export const CASE_COLORS = [
  "#365314",
  "#a16207",
  "#dc2626",
  "#2563eb",
  "#7c3aed",
  "#0891b2",
];

export const STAGE_COLORS: Record<Stage, string> = {
  卵: "#0e7490",
  幼虫: "#a16207",
  蛹: "#6d28d9",
  成虫: "#365314",
};
