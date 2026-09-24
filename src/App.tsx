import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import type { Sample, SampleInput, Sequence, Stage } from "./types";
import { usePersistentState } from "./hooks/usePersistentState";
import { SEED_SAMPLES, SEED_SEQUENCES } from "./lib/seed";
import {
  arrangeSequence,
  averageTemperature,
  findMissing,
  membersOf,
  nextSampleId,
  nextSequenceId,
  reviewStages,
} from "./lib/domain";
import type { SupplementEdit } from "./components/SequenceView";
import { SamplesView } from "./components/SamplesView";
import { SequenceView } from "./components/SequenceView";
import { CasesView } from "./components/CasesView";
import { TemperatureChart } from "./components/TemperatureChart";

type TabKey = "samples" | "sequences" | "cases" | "chart";
type ToastKind = "ok" | "error";
interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "samples", label: "样本批次" },
  { key: "sequences", label: "虫龄序列" },
  { key: "cases", label: "案件关联" },
  { key: "chart", label: "温度曲线" },
];

/** 本地时区的 YYYY-MM-DDTHH:mm，保证和采样时间排序、显示一致 */
function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** 样本字段变更后：重排序列成员时间序，并按缺项刷新 待补/待复核 状态 */
function refreshSequences(sequences: Sequence[], samples: Sample[]): Sequence[] {
  const now = nowLocal();
  return sequences.map((seq) => {
    const members = membersOf(seq, samples);
    const sortedIds = [...members]
      .sort((a, b) => a.sampledAt.localeCompare(b.sampledAt))
      .map((m) => m.id);

    let status = seq.status;
    if (seq.status === "待补" || seq.status === "待复核") {
      status = findMissing(members).length ? "待补" : "待复核";
    }
    const orderChanged = sortedIds.join("|") !== seq.sampleIds.join("|");
    if (status !== seq.status || orderChanged) {
      return { ...seq, status, sampleIds: sortedIds, updatedAt: now };
    }
    return seq;
  });
}

function App() {
  const [samples, setSamples] = usePersistentState<Sample[]>(
    "forensic-entomo:samples:v1",
    () => SEED_SAMPLES
  );
  const [sequences, setSequences] = usePersistentState<Sequence[]>(
    "forensic-entomo:sequences:v1",
    () => SEED_SEQUENCES
  );

  const [tab, setTab] = useState<TabKey>("samples");
  const [stageFilter, setStageFilter] = useState<Stage | "全部">("全部");
  const [highlightSeq, setHighlightSeq] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const pushToast = (kind: ToastKind, text: string) => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((prev) => [...prev, { id, kind, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5200);
  };

  // 从样本列表/案件页跳入某条序列：切页签并滚动定位
  const openSequence = (seqId: string) => {
    setHighlightSeq(seqId);
    setTab("sequences");
  };
  useEffect(() => {
    if (tab !== "sequences" || !highlightSeq) return;
    const timer = window.setTimeout(() => {
      document
        .querySelector(`[data-seq-id="${highlightSeq}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [tab, highlightSeq]);

  const validateSampleInput = (input: SampleInput): string | null => {
    if (!input.caseId.trim()) return "案件编号必填。";
    if (!input.sampledAt) return "采样时间必填，否则样本无法参与虫龄序列按时间排列。";
    if (!input.species.trim()) return "昆虫种类必填。";
    return null;
  };

  const addSample = (input: SampleInput): string | null => {
    const baseErr = validateSampleInput(input);
    if (baseErr) return baseErr;
    const id = input.id?.trim() || nextSampleId(input.caseId, samples);
    if (samples.some((s) => s.id === id)) {
      return `样本编号 ${id} 已存在。`;
    }
    const sample: Sample = {
      ...input,
      id,
      caseId: input.caseId,
      species: input.species,
      location: input.location,
      preservation: input.preservation,
      createdAt: nowLocal(),
    };
    const nextSamples = [...samples, sample];
    setSamples(nextSamples);
    setSequences(refreshSequences(sequences, nextSamples));
    pushToast("ok", `样本 ${id} 已入库，原始记录独立保存。`);
    return null;
  };

  const saveSample = (id: string, input: SampleInput): string | null => {
    const baseErr = validateSampleInput(input);
    if (baseErr) return baseErr;
    const current = samples.find((s) => s.id === id);
    if (!current) return `未找到样本 ${id}。`;

    const linked = sequences.filter((seq) => seq.sampleIds.includes(id));
    for (const seq of linked) {
      if (input.caseId !== seq.caseId) {
        return `${id} 已编入 ${seq.id}，不能改属其他案件；序列必须同案，请保持案件 ${seq.caseId}。`;
      }
      if (input.species.trim() !== seq.species) {
        return `${id} 已编入 ${seq.id}（虫种：${seq.species}），修改虫种会破坏序列一致性；如虫种鉴定有误，请在复核中备注，不允许直接改为其他虫种。`;
      }
      const collision = membersOf(seq, samples).some(
        (m) => m.id !== id && m.sampledAt === input.sampledAt
      );
      if (collision) {
        return `采样时间与 ${seq.id} 中其他成员相同；序列成员的采样时间必须互不相同，已阻止保存。`;
      }
    }

    const nextSamples = samples.map((s) =>
      s.id === id
        ? {
            ...s,
            ...input,
            id,
            species: input.species,
            caseId: input.caseId,
            location: input.location,
            preservation: input.preservation,
          }
        : s
    );
    setSamples(nextSamples);
    setSequences(refreshSequences(sequences, nextSamples));
    pushToast("ok", `样本 ${id} 已更新，序列缺项与时间序已联动刷新。`);
    return null;
  };

  const createSequence = (sampleIds: string[]): string | null => {
    const picked = sampleIds
      .map((sid) => samples.find((s) => s.id === sid))
      .filter((s): s is Sample => Boolean(s));
    const result = arrangeSequence(picked);
    if (!result.ok) return result.reason;

    const members = result.members;
    const missing = findMissing(members);
    const seq: Sequence = {
      id: nextSequenceId(sequences),
      caseId: members[0].caseId,
      species: members[0].species.trim(),
      sampleIds: members.map((m) => m.id),
      status: missing.length ? "待补" : "待复核",
      createdAt: nowLocal(),
      updatedAt: nowLocal(),
      history: [],
    };
    setSequences((prev) => [...prev, seq]);
    setHighlightSeq(seq.id);
    pushToast(
      "ok",
      missing.length
        ? `${seq.id} 已编排：${missing.length} 项地点/温度/保存方式缺失，存为待补，原样本保留。`
        : `${seq.id} 已编排并送入复核（${members.length} 枚，按采样时间升序）。`
    );
    return null;
  };

  const saveSupplement = (
    seqId: string,
    edits: Record<string, SupplementEdit>
  ): string | null => {
    const seq = sequences.find((q) => q.id === seqId);
    if (!seq) return `未找到序列 ${seqId}。`;
    const memberList = membersOf(seq, samples);

    const updated = memberList.map((m) => {
      const edit = edits[m.id];
      if (!edit) return m;
      const tempText = edit.temperature.trim();
      const temperature =
        tempText === "" ? null : Math.round(Number(tempText) * 10) / 10;
      return {
        ...m,
        location: edit.location.trim(),
        temperature: Number.isNaN(temperature as number) ? null : temperature,
        preservation: edit.preservation.trim(),
      };
    });

    const stillMissing = findMissing(updated);
    if (stillMissing.length) {
      return `仍有 ${stillMissing.length} 项未补齐：${stillMissing
        .map((x) => `${x.sampleId} 的${x.label}`)
        .join("；")}。补齐前只能保持待补状态。`;
    }

    const nextSamples = samples.map(
      (s) => updated.find((m) => m.id === s.id) ?? s
    );
    setSamples(nextSamples);
    setSequences((prev) =>
      prev.map((q) =>
        q.id === seqId
          ? { ...q, status: "待复核" as const, updatedAt: nowLocal() }
          : q
      )
    );
    pushToast("ok", `${seqId} 已补齐地点、温度与保存方式，送入复核；原样本记录仍保留。`);
    return null;
  };

  const reviewSequence = (seqId: string, stages: Stage[]): string | null => {
    const seq = sequences.find((q) => q.id === seqId);
    if (!seq) return `未找到序列 ${seqId}。`;
    const members = membersOf(seq, samples);
    if (stages.length !== members.length) return "复核阶段数与序列成员不一致。";

    const verdict = reviewStages(stages);
    const at = nowLocal();
    if (!verdict.passed) {
      // 倒退：序列退回，阶段不写回样本；上次通过结果保留在 history 中
      setSequences((prev) =>
        prev.map((q) =>
          q.id === seqId
            ? {
                ...q,
                status: "已退回" as const,
                updatedAt: at,
                history: [
                  ...q.history,
                  { at, passed: false, stages, reason: verdict.reason },
                ],
              }
            : q
        )
      );
      pushToast("error", `${seqId} 复核退回：发育阶段倒退，已保留上次通过结果（如有）。`);
      return verdict.reason;
    }

    // 通过：复核阶段写回各样本，序列标记已通过
    const stageOfSample = new Map<string, Stage>();
    members.forEach((m, i) => stageOfSample.set(m.id, stages[i]));
    const nextSamples = samples.map((s) =>
      stageOfSample.has(s.id) ? { ...s, stage: stageOfSample.get(s.id)! } : s
    );
    setSamples(nextSamples);
    setSequences((prev) =>
      prev.map((q) =>
        q.id === seqId
          ? {
              ...q,
              status: "已通过" as const,
              updatedAt: at,
              history: [...q.history, { at, passed: true, stages }],
            }
          : q
      )
    );
    pushToast("ok", `${seqId} 复核通过：阶段单调前进，结果已写回样本并保存。`);
    return null;
  };

  const resetDemo = () => {
    if (
      !window.confirm(
        "将清空当前本地数据并恢复演示样本/序列（含待补与倒退案例），确定继续？"
      )
    ) {
      return;
    }
    setSamples(SEED_SAMPLES);
    setSequences(SEED_SEQUENCES);
    setHighlightSeq(null);
    pushToast("ok", "已恢复演示数据。");
  };

  const avgTemp = useMemo(() => averageTemperature(samples), [samples]);
  const pendingCount = sequences.filter(
    (q) => q.status === "待补" || q.status === "待复核" || q.status === "已退回"
  ).length;

  return (
    <main className="app">
      <section className="hero compact">
        <p>hxyfront-62003 · 源提示词 5 · 法医昆虫学样本记录 · Port 62003</p>
        <h1>虫龄序列编排工作台</h1>
        <span>
          同案挑出 ≥2 枚样本按采样时间排列；虫种不同或时间相同拒绝编排。地点、温度、保存方式缺一存为待补（原样本保留），补齐后送复核；
          复核阶段沿 卵 → 幼虫 → 蛹 → 成虫 前进，倒退即退回并保留上次通过结果。数据保存在本地，重开可继续处理。
        </span>
        <div className="hero-actions">
          <button onClick={resetDemo}>恢复演示数据</button>
        </div>
      </section>

      <section className="metrics">
        <article>
          <small>样本批次</small>
          <strong>{samples.length}</strong>
        </article>
        <article>
          <small>平均温度</small>
          <strong>{avgTemp == null ? "—" : `${avgTemp}℃`}</strong>
        </article>
        <article>
          <small>虫龄序列</small>
          <strong>{sequences.length}</strong>
        </article>
        <article>
          <small>待处理（待补/待复核/退回）</small>
          <strong>{pendingCount}</strong>
        </article>
      </section>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "tab tab-active" : "tab"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "samples" ? (
        <SamplesView
          samples={samples}
          sequences={sequences}
          stageFilter={stageFilter}
          onStageFilter={setStageFilter}
          onAdd={addSample}
          onSave={saveSample}
          onOpenSequence={openSequence}
        />
      ) : null}
      {tab === "sequences" ? (
        <SequenceView
          samples={samples}
          sequences={sequences}
          highlightId={highlightSeq}
          onCreate={createSequence}
          onSaveSupplement={saveSupplement}
          onReview={reviewSequence}
        />
      ) : null}
      {tab === "cases" ? (
        <CasesView
          samples={samples}
          sequences={sequences}
          onOpenSequence={openSequence}
        />
      ) : null}
      {tab === "chart" ? <TemperatureChart samples={samples} /> : null}

      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </main>
  );
}

export default App;
