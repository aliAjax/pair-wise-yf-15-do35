import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppState,
  InstarSequence,
  RejectionRecord,
  ReviewLog,
  Sample,
  SequenceStatus,
  Stage,
} from "./types";
import { buildSeedState } from "./seed";
import {
  checkProgression,
  checkSelection,
  refreshSequence,
  sequenceMissing,
  sortBySampledAt,
} from "./domain";

const STORAGE_KEY = "forensic-entomology-records-v1";

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (Array.isArray(parsed.samples) && Array.isArray(parsed.sequences)) {
        return parsed;
      }
    }
  } catch {
    // 数据损坏时回落到种子数据
  }
  return buildSeedState();
}

export interface CreateResult {
  ok: boolean;
  sequenceId?: string;
  reason: string;
}

export function useStore() {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const samplesById = useMemo(() => {
    const map = new Map<string, Sample>();
    state.samples.forEach((s) => map.set(s.id, s));
    return map;
  }, [state.samples]);

  /** 原样本补录 / 修正；同时刷新各序列的待补状态（原样本不删除） */
  const updateSample = useCallback((id: string, patch: Partial<Sample>) => {
    setState((prev) => {
      const samples = prev.samples.map((s) => (s.id === id ? { ...s, ...patch } : s));
      const map = new Map(samples.map((s) => [s.id, s]));
      const sequences = prev.sequences.map((seq) => refreshSequence(seq, map));
      return { ...prev, samples, sequences };
    });
  }, []);

  const addSample = useCallback(
    (data: Omit<Sample, "id">): Sample => {
      const n = state.sampleCounter + 1;
      const created: Sample = { ...data, id: `SP-${String(n).padStart(3, "0")}` };
      setState((prev) => ({ ...prev, samples: [...prev.samples, created], sampleCounter: Math.max(prev.sampleCounter, n) }));
      return created;
    },
    [state.sampleCounter]
  );

  /**
   * 编排虫龄序列：
   * 1. 先按采样时间排列；2. 虫种不同或时间相同（或不足两枚）→ 拒绝并留原因；
   * 3. 虫种一致且时间互异 → 检查地点/温度/保存方式，缺一项存为待补，齐全送入复核。
   * 原样本始终保留。
   */
  const createSequence = useCallback((caseId: string, sampleIds: string[]): CreateResult => {
    let result: CreateResult = { ok: false, reason: "" };
    setState((prev) => {
      const chosen = sampleIds
        .map((id) => prev.samples.find((s) => s.id === id))
        .filter((s): s is Sample => Boolean(s));
      const ordered = sortBySampledAt(chosen);

      const rejectReason = checkSelection(ordered);
      if (rejectReason) {
        const rejection: RejectionRecord = {
          id: `REJ-${String(prev.rejections.length + 1).padStart(3, "0")}`,
          caseId,
          sampleIds: ordered.map((s) => s.id),
          reason: rejectReason,
          at: new Date().toISOString(),
        };
        result = { ok: false, reason: rejectReason };
        return { ...prev, rejections: [rejection, ...prev.rejections] };
      }

      const n = prev.seqCounter + 1;
      const seqId = `SEQ-${String(n).padStart(3, "0")}`;
      const missing = sequenceMissing(ordered);
      const status: SequenceStatus = missing.length > 0 ? "pending" : "review";
      const snapshot: Record<string, Stage> = {};
      ordered.forEach((m) => {
        snapshot[m.id] = m.stage;
      });
      const nowIso = new Date().toISOString();
      const firstLog: ReviewLog =
        missing.length > 0
          ? {
              at: nowIso,
              action: "submit",
              detail: `序列已建立，缺 ${missing.join("、")}，存为待补`,
              snapshot,
            }
          : { at: nowIso, action: "submit", detail: "资料齐全，送入复核", snapshot };

      const seq: InstarSequence = {
        id: seqId,
        caseId,
        species: ordered[0].species.trim(),
        sampleIds: ordered.map((s) => s.id),
        status,
        reason:
          missing.length > 0
            ? `待补：${missing.join("、")}（补齐后自动送入复核）`
            : "资料齐全，已送入复核，等待发育阶段复核",
        missing,
        createdAt: nowIso,
        updatedAt: nowIso,
        history: [firstLog],
      };
      result = { ok: true, sequenceId: seqId, reason: seq.reason };
      return { ...prev, sequences: [seq, ...prev.sequences], seqCounter: n };
    });
    return result;
  }, []);

  /** 复核：阶段倒退则退回并保留上次结果；不倒退则通过 */
  const reviewSequence = useCallback((seqId: string) => {
    setState((prev) => {
      const seq = prev.sequences.find((x) => x.id === seqId);
      if (!seq || (seq.status !== "review" && seq.status !== "returned")) return prev;
      const members = sortBySampledAt(
        seq.sampleIds.map((id) => prev.samples.find((s) => s.id === id)).filter((s): s is Sample => Boolean(s))
      );
      const stillMissing = sequenceMissing(members);
      if (stillMissing.length > 0) {
        const nowIso = new Date().toISOString();
        return {
          ...prev,
          sequences: prev.sequences.map((x) =>
            x.id === seqId
              ? {
                  ...x,
                  status: "pending",
                  missing: stillMissing,
                  reason: `待补：${stillMissing.join("、")}（补齐后自动送入复核）`,
                  updatedAt: nowIso,
                }
              : x
          ),
        };
      }

      const snapshot: Record<string, Stage> = {};
      members.forEach((m) => {
        snapshot[m.id] = m.stage;
      });
      const nowIso = new Date().toISOString();
      const regression = checkProgression(members);

      if (regression) {
        const log: ReviewLog = { at: nowIso, action: "return", detail: regression, snapshot };
        return {
          ...prev,
          sequences: prev.sequences.map((x) =>
            x.id === seqId
              ? {
                  ...x,
                  status: "returned",
                  reason: `${regression}，已退回并保留上次复核结果`,
                  updatedAt: nowIso,
                  lastReview: log, // 保留上次结果
                  history: [...x.history, log],
                }
              : x
          ),
        };
      }

      const log: ReviewLog = { at: nowIso, action: "approve", detail: "阶段无倒退，复核通过", snapshot };
      return {
        ...prev,
        sequences: prev.sequences.map((x) =>
          x.id === seqId
            ? {
                ...x,
                status: "approved",
                reason: "复核通过：发育阶段沿 卵→幼虫→蛹→成虫 正常前进",
                updatedAt: nowIso,
                lastReview: log,
                history: [...x.history, log],
              }
            : x
        ),
      };
    });
  }, []);

  const resetAll = useCallback(() => {
    setState(buildSeedState());
  }, []);

  return {
    state,
    samplesById,
    addSample,
    updateSample,
    createSequence,
    reviewSequence,
    resetAll,
  };
}

export type Store = ReturnType<typeof useStore>;
