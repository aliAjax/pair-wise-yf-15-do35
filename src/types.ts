// 法医昆虫学样本记录 —— 领域类型

export const STAGES = ["卵", "幼虫", "蛹", "成虫"] as const;
export type Stage = (typeof STAGES)[number];

/** 虫龄序列的状态机：待补 → 待复核 → 已通过 / 已退回（可重新送审） */
export type SequenceStatus = "待补" | "待复核" | "已通过" | "已退回";

/** 单枚样本（原始记录，序列只能引用、补充，不能删除或丢失） */
export interface Sample {
  id: string; // 样本编号，如 CASE-042-A
  caseId: string; // 案件编号，如 CASE-042
  location: string; // 采样地点
  temperature: number | null; // 环境温度 ℃
  exposureStage: string; // 尸体暴露阶段
  species: string; // 昆虫种类
  stage: Stage; // 发育阶段
  sampledAt: string; // 采样时间，YYYY-MM-DDTHH:mm
  preservation: string; // 保存方式
  note: string; // 鉴定备注
  createdAt: string;
}

/** 一次复核留下的结果快照（退回时也会记录，但不覆盖上次通过结果） */
export interface ReviewSnapshot {
  at: string;
  passed: boolean;
  stages: Stage[]; // 复核时各成员（按时间序）的发育阶段
  reason?: string; // 倒退退回时的说明
}

/** 虫龄序列：同一案件、同一虫种、按采样时间严格排序的样本链 */
export interface Sequence {
  id: string;
  caseId: string;
  species: string;
  sampleIds: string[]; // 始终按 sampledAt 升序
  status: SequenceStatus;
  createdAt: string;
  updatedAt: string;
  history: ReviewSnapshot[];
}

export interface SampleInput {
  id?: string;
  caseId: string;
  location: string;
  temperature: number | null;
  exposureStage: string;
  species: string;
  stage: Stage;
  sampledAt: string;
  preservation: string;
  note: string;
}
