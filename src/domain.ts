import { InstarSequence, Sample, Stage, STAGES } from "./types";

/** 按采样时间升序排列 */
export function sortBySampledAt<T extends { sampledAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sampledAt.localeCompare(b.sampledAt));
}

/** 地点、温度、保存方式三项的缺项检查，返回缺失字段中文名 */
export function missingFields(s: Sample): string[] {
  const missing: string[] = [];
  if (!s.location.trim()) missing.push("地点");
  if (s.temperature === null || Number.isNaN(s.temperature)) missing.push("温度");
  if (!s.preservation.trim()) missing.push("保存方式");
  return missing;
}

export function stageRank(stage: Stage): number {
  return STAGES.indexOf(stage);
}

/**
 * 编排前置检查（至少两枚、虫种一致、采样时间互不相同）。
 * 通过返回 null，否则返回拒绝原因。
 */
export function checkSelection(samples: Sample[]): string | null {
  if (samples.length < 2) {
    return `同案至少需要两枚样本，当前仅 ${samples.length} 枚`;
  }
  const speciesSet = new Set(samples.map((s) => s.species.trim()));
  if (speciesSet.size > 1) {
    return `虫种不同，拒绝编排：${[...speciesSet].join(" / ")}`;
  }
  if (!samples.every((s) => s.species.trim())) {
    return "存在未填写昆虫种类的样本，拒绝编排";
  }
  const times = samples.map((s) => s.sampledAt);
  if (new Set(times).size !== times.length) {
    return "存在采样时间相同的样本，无法确定先后顺序，拒绝编排";
  }
  return null;
}

/**
 * 复核：发育阶段必须沿 卵→幼虫→蛹→成虫 前进，允许同阶段停留（虫龄内部递进）。
 * 出现倒退（rank 下降）即退回；返回 null 表示通过，否则返回倒退描述。
 */
export function checkProgression(samples: Sample[]): string | null {
  const ordered = sortBySampledAt(samples);
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    if (stageRank(cur.stage) < stageRank(prev.stage)) {
      return `发育阶段倒退：${prev.id}（${prev.stage}，${prev.sampledAt.replace("T", " ")}）→ ${cur.id}（${cur.stage}，${cur.sampledAt.replace("T", " ")}）`;
    }
  }
  return null;
}

/** 序列上所有样本的待补字段是否齐全（原样本可被持续补录） */
export function sequenceMissing(samples: Sample[]): string[] {
  const set = new Set<string>();
  samples.forEach((s) => missingFields(s).forEach((m) => set.add(m)));
  return [...set];
}

/** 用当前样本数据重新计算序列的待补项与状态（原样本补齐后自动解除"待补"） */
export function refreshSequence(seq: InstarSequence, samplesById: Map<string, Sample>): InstarSequence {
  if (seq.status === "rejected" || seq.status === "approved") return seq;
  const members = seq.sampleIds
    .map((id) => samplesById.get(id))
    .filter((s): s is Sample => Boolean(s));
  if (members.length === 0) return seq;

  const missing = sequenceMissing(members);
  const next: InstarSequence = { ...seq, missing };

  if (seq.status === "pending" && missing.length === 0) {
    return { ...next, status: "review", reason: "资料已补齐，送入复核", updatedAt: new Date().toISOString() };
  }
  return next;
}
