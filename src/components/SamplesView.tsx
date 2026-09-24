import { useMemo, useState } from "react";
import type { Sample, SampleInput, Sequence, Stage } from "../types";
import { Modal } from "./Modal";
import { SampleForm } from "./SampleForm";
import { SampleDetail } from "./SampleDetail";
import { averageTemperature, formatTime } from "../lib/domain";
import { STAGE_COLORS } from "../lib/constants";

interface SamplesViewProps {
  samples: Sample[];
  sequences: Sequence[];
  stageFilter: Stage | "全部";
  onStageFilter: (stage: Stage | "全部") => void;
  onAdd: (input: SampleInput) => string | null;
  onSave: (id: string, input: SampleInput) => string | null;
  onOpenSequence: (seqId: string) => void;
}

export function SamplesView({
  samples,
  sequences,
  stageFilter,
  onStageFilter,
  onAdd,
  onSave,
  onOpenSequence,
}: SamplesViewProps) {
  const [caseFilter, setCaseFilter] = useState<string>("全部");
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const caseIds = useMemo(
    () => Array.from(new Set(samples.map((s) => s.caseId))).sort(),
    [samples]
  );

  const filtered = useMemo(
    () =>
      samples
        .filter((s) => (caseFilter === "全部" ? true : s.caseId === caseFilter))
        .filter((s) => (stageFilter === "全部" ? true : s.stage === stageFilter))
        .sort((a, b) => b.sampledAt.localeCompare(a.sampledAt)),
    [samples, caseFilter, stageFilter]
  );

  const detail = detailId ? samples.find((s) => s.id === detailId) ?? null : null;

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>样本批次列表</p>
          <h2>样本记录（{filtered.length}）</h2>
        </div>
        <button className="primary" onClick={() => setShowForm(true)}>
          + 新增样本
        </button>
      </div>

      <div className="filter-bar">
        <div className="chips">
          <button
            className={stageFilter === "全部" ? "chip-active" : ""}
            onClick={() => onStageFilter("全部")}
          >
            全部阶段
          </button>
          {(["卵", "幼虫", "蛹", "成虫"] as Stage[]).map((stage) => (
            <button
              key={stage}
              className={stageFilter === stage ? "chip-active" : ""}
              style={
                stageFilter === stage
                  ? { borderColor: STAGE_COLORS[stage], background: `${STAGE_COLORS[stage]}14` }
                  : undefined
              }
              onClick={() => onStageFilter(stage)}
            >
              {stage}
            </button>
          ))}
        </div>
        <select
          className="case-select"
          value={caseFilter}
          onChange={(e) => setCaseFilter(e.target.value)}
        >
          <option value="全部">全部案件</option>
          {caseIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>

      <div className="sample-table">
        <div className="sample-row sample-row-head">
          <span>样本编号</span>
          <span>案件</span>
          <span>采样时间</span>
          <span>虫种 / 阶段</span>
          <span>地点 · 温度 · 保存</span>
          <span>所属序列</span>
        </div>
        {filtered.map((s) => {
          const linked = sequences.filter((q) => q.sampleIds.includes(s.id));
          return (
            <div
              key={s.id}
              className="sample-row sample-row-clickable"
              onClick={() => setDetailId(s.id)}
            >
              <span className="cell-id">{s.id}</span>
              <span>{s.caseId}</span>
              <span>{formatTime(s.sampledAt)}</span>
              <span>
                <b>{s.species || "（缺虫种）"}</b>
                <span
                  className="stage-pill"
                  style={{
                    color: STAGE_COLORS[s.stage],
                    borderColor: STAGE_COLORS[s.stage],
                  }}
                >
                  {s.stage}
                </span>
              </span>
              <span className="cell-sub">
                {s.location || <i className="missing">缺地点</i>} ·{" "}
                {s.temperature == null ? (
                  <i className="missing">缺温度</i>
                ) : (
                  `${s.temperature}℃`
                )}{" "}
                · {s.preservation || <i className="missing">缺保存方式</i>}
              </span>
              <span onClick={(e) => e.stopPropagation()}>
                {linked.length ? (
                  <span className="seq-links">
                    {linked.map((q) => (
                      <button
                        key={q.id}
                        className={`mini-tag status-${q.status}`}
                        onClick={() => onOpenSequence(q.id)}
                        title={`${q.id} · ${q.status}`}
                      >
                        {q.id}
                      </button>
                    ))}
                  </span>
                ) : (
                  <span className="muted">未编排</span>
                )}
              </span>
            </div>
          );
        })}
        {!filtered.length && (
          <p className="empty-hint">当前筛选条件下没有样本。</p>
        )}
      </div>

      <p className="list-foot">
        共 {samples.length} 枚样本；当前批次平均温度{" "}
        <b>
          {averageTemperature(filtered) == null
            ? "—"
            : `${averageTemperature(filtered)} ℃`}
        </b>
      </p>

      {showForm ? (
        <Modal
          title="新增样本"
          subtitle="原始样本独立入库；编入虫龄序列后也不会被删除或覆盖"
          onClose={() => setShowForm(false)}
        >
          <SampleForm
            submitLabel="保存样本"
            onCancel={() => setShowForm(false)}
            onSubmit={(input) => {
              const err = onAdd(input);
              if (!err) setShowForm(false);
              return err;
            }}
          />
        </Modal>
      ) : null}

      {detail ? (
        <SampleDetail
          sample={detail}
          sequences={sequences}
          onClose={() => setDetailId(null)}
          onSave={onSave}
        />
      ) : null}
    </section>
  );
}
