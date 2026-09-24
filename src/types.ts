// 法医昆虫学样本记录 —— 数据模型

/** 发育阶段：卵 → 幼虫 → 蛹 → 成虫，顺序即发育前进方向 */
export const STAGES = ["卵", "幼虫", "蛹", "成虫"] as const;
export type Stage = (typeof STAGES)[number];

/** 虫龄序列编排 / 复核状态 */
export type SequenceStatus =
  | "rejected" // 编排被拒绝（虫种不同 / 采样时间相同 / 不足两枚）
  | "pending" // 已建成但地点、温度、保存方式有缺项，待补
  | "review" // 资料齐全，已送入复核
  | "returned" // 复核时阶段出现倒退，退回，保留上次复核结果
  | "approved"; // 复核通过（阶段只前进不后退）

export const STATUS_LABEL: Record<SequenceStatus, string> = {
  rejected: "已拒绝",
  pending: "待补",
  review: "复核中",
  returned: "已退回",
  approved: "复核通过",
};

/** 单条昆虫样本（原样本，任何操作都不删除） */
export interface Sample {
  id: string;
  caseId: string; // 案件编号，CASE-042 等
  location: string; // 采样地点
  temperature: number | null; // 环境温度 ℃
  exposureStage: string; // 尸体暴露阶段
  species: string; // 昆虫种类
  stage: Stage; // 发育阶段
  sampledAt: string; // 采样时间，ISO 字符串（datetime-local 可解析）
  preservation: string; // 保存方式
  note: string; // 鉴定备注
}

export interface ReviewLog {
  at: string; // 复核时间
  action: "submit" | "return" | "approve";
  detail: string;
  /** 提交复核时的阶段快照（样本ID → 阶段），用于保留"上次结果" */
  snapshot: Record<string, Stage>;
}

/** 虫龄序列 */
export interface InstarSequence {
  id: string;
  caseId: string;
  species: string;
  sampleIds: string[]; // 按采样时间升序
  status: SequenceStatus;
  reason: string; // 拒绝原因 / 缺项提示 / 复核结论
  missing: string[]; // 待补字段（地点 / 温度 / 保存方式）
  createdAt: string;
  updatedAt: string;
  /** 上次复核结果快照（退回时保留，便于对照） */
  lastReview?: ReviewLog;
  history: ReviewLog[];
}

/** 编排被拒绝的留痕（重开仍可查看拒绝原因） */
export interface RejectionRecord {
  id: string;
  caseId: string;
  sampleIds: string[];
  reason: string;
  at: string;
}

export interface AppState {
  samples: Sample[];
  sequences: InstarSequence[];
  rejections: RejectionRecord[];
  seqCounter: number;
  sampleCounter: number;
}
