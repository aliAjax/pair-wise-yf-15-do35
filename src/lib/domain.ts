import type { ReviewSnapshot, Sample, Sequence, Stage } from "../types";
import { STAGE_RANK } from "./constants";

export type Arranged =
  | { ok: true; members: Sample[] }
  | { ok: false; reason: string };

/**
 * 虫龄序列编排规则（鉴定人发起）：
 * 1. 至少两枚样本，且必须同案；
 * 2. 虫种必须一致；
 * 3. 采样时间不得相同（无法判定先后）；
 * 4. 一律按采样时间升序排列。
 * 任一硬性条件不满足 → 拒绝并说明原因。
 */
export function arrangeSequence(selected: Sample[]): Arranged {
  if (selected.length < 2) {
    return {
      ok: false,
      reason: `至少需要挑出两枚同案样本，当前仅选择 ${selected.length} 枚，无法编排虫龄序列。`,
    };
  }

  const caseIds = Array.from(new Set(selected.map((s) => s.caseId.trim())));
  if (caseIds.length > 1) {
    return {
      ok: false,
      reason: `所选样本分属不同案件（${caseIds.join("、")}）；虫龄序列必须在同一案件内编排，拒绝编排。`,
    };
  }

  const speciesGroups = new Map<string, string[]>();
  for (const s of selected) {
    const key = s.species.trim();
    const list = speciesGroups.get(key) ?? [];
    list.push(s.id);
    speciesGroups.set(key, list);
  }
  if (speciesGroups.size > 1) {
    const detail = Array.from(speciesGroups.entries())
      .map(([species, ids]) => `${species}（${ids.join("、")}）`)
      .join(" vs ");
    return {
      ok: false,
      reason: `虫种不一致：${detail}；同一条虫龄序列只接受同一虫种，拒绝编排。`,
    };
  }

  const timeGroups = new Map<string, string[]>();
  for (const s of selected) {
    const list = timeGroups.get(s.sampledAt) ?? [];
    list.push(s.id);
    timeGroups.set(s.sampledAt, list);
  }
  for (const [time, ids] of timeGroups) {
    if (ids.length > 1) {
      return {
        ok: false,
        reason: `采样时间相同（${formatTime(time)}）：${ids.join(
          "、"
        )}；时间相同时无法确定虫龄先后，拒绝编排，请先核对采样时间。`,
      };
    }
  }

  const members = [...selected].sort((a, b) =>
    a.sampledAt.localeCompare(b.sampledAt)
  );
  return { ok: true, members };
}

/** 送入复核前必须补齐的字段：地点、温度、保存方式（一枚样本缺一项即存为待补） */
export const REQUIRED_FIELDS = [
  { key: "location", label: "采样地点" },
  { key: "temperature", label: "环境温度" },
  { key: "preservation", label: "保存方式" },
] as const;

export type MissingFieldKey = (typeof REQUIRED_FIELDS)[number]["key"];

export interface MissingItem {
  sampleId: string;
  key: MissingFieldKey;
  label: string;
}

export function isFieldEmpty(sample: Sample, key: MissingFieldKey): boolean {
  if (key === "temperature") {
    return sample.temperature === null || Number.isNaN(sample.temperature);
  }
  return String(sample[key] ?? "").trim() === "";
}

export function findMissing(members: Sample[]): MissingItem[] {
  const result: MissingItem[] = [];
  for (const sample of members) {
    for (const field of REQUIRED_FIELDS) {
      if (isFieldEmpty(sample, field.key)) {
        result.push({ sampleId: sample.id, key: field.key, label: field.label });
      }
    }
  }
  return result;
}

export type ReviewVerdict =
  | { passed: true }
  | { passed: false; reason: string };

/**
 * 复核规则：发育阶段只能按 卵 → 幼虫 → 蛹 → 成虫 前进。
 * 允许同阶段并列（如一龄/二龄/三龄幼虫多次采样），出现倒退即退回。
 */
export function reviewStages(stages: Stage[]): ReviewVerdict {
  for (let i = 1; i < stages.length; i += 1) {
    const prevRank = STAGE_RANK[stages[i - 1]];
    const curRank = STAGE_RANK[stages[i]];
    if (curRank < prevRank) {
      return {
        passed: false,
        reason: `第 ${i} 枚（${stages[i - 1]}）采样更早，第 ${
          i + 1
        } 枚却为「${stages[i]}」，发育阶段出现倒退；虫龄只能沿 卵 → 幼虫 → 蛹 → 成虫 前进，本次复核退回。`,
      };
    }
  }
  return { passed: true };
}

/** 取最近一次“通过”的复核结果 —— 退回后仍保留的上次结果 */
export function lastPassed(seq: Sequence): ReviewSnapshot | undefined {
  for (let i = seq.history.length - 1; i >= 0; i -= 1) {
    if (seq.history[i].passed) return seq.history[i];
  }
  return undefined;
}

export function lastSnapshot(seq: Sequence): ReviewSnapshot | undefined {
  return seq.history[seq.history.length - 1];
}

export function formatTime(iso: string): string {
  if (!iso) return "—";
  return iso.length >= 16 ? iso.slice(0, 16).replace("T", " ") : iso;
}

export function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatTime(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function averageTemperature(samples: Sample[]): number | null {
  const values = samples
    .map((s) => s.temperature)
    .filter((v): v is number => v !== null && !Number.isNaN(v));
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export function membersOf(seq: Sequence, samples: Sample[]): Sample[] {
  return seq.sampleIds
    .map((id) => samples.find((s) => s.id === id))
    .filter((s): s is Sample => Boolean(s));
}

export function nextSampleId(caseId: string, samples: Sample[]): string {
  let n = samples.filter((s) => s.caseId === caseId).length + 1;
  let id = `${caseId}-${String(n).padStart(2, "0")}`;
  const existing = new Set(samples.map((s) => s.id));
  while (existing.has(id)) {
    n += 1;
    id = `${caseId}-${String(n).padStart(2, "0")}`;
  }
  return id;
}

export function nextSequenceId(sequences: Sequence[]): string {
  const max = sequences.reduce((acc, seq) => {
    const m = /^SEQ-(\d+)$/.exec(seq.id);
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return `SEQ-${String(max + 1).padStart(3, "0")}`;
}
