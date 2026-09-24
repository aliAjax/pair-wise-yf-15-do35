import { useMemo, useState } from "react";
import { Sample, Stage } from "../types";
import { Store } from "../store";
import { sortBySampledAt, stageRank } from "../domain";
import { EmptyState, StageTag, StatusBadge, fmtTime } from "./ui";
import TemperatureChart from "./TemperatureChart";

export default function CasesView({ store }: { store: Store }) {
  const { state } = store;
  const caseIds = useMemo(() => Array.from(new Set(state.samples.map((s) => s.caseId))).sort(), [state.samples]);
  const [active, setActive] = useState(caseIds[0] ?? "");
  const caseId = caseIds.includes(active) ? active : caseIds[0] ?? "";

  const samples = useMemo(
    () => sortBySampledAt(state.samples.filter((s) => s.caseId === caseId)),
    [state.samples, caseId]
  );
  const sequences = state.sequences.filter((q) => q.caseId === caseId);
  const rejections = state.rejections.filter((r) => r.caseId === caseId);

  const stageSet = useMemo(() => {
    const set = new Set<Stage>();
    samples.forEach((s) => set.add(s.stage));
    return set;
  }, [samples]);

  const temps = samples.map((s) => s.temperature).filter((t): t is number => t !== null);
  const avgTemp = temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : "—";
  const progressRank = samples.reduce((mx, s) => Math.max(mx, stageRank(s.stage)), -1);

  return (
    <div className="cases-view">
      <div className="case-tabs">
        {caseIds.map((id) => (
          <button key={id} className={id === caseId ? "chip-on" : ""} onClick={() => setActive(id)}>
            {id}
          </button>
        ))}
      </div>

      {caseId === "" ? (
        <section className="panel">
          <EmptyState text="暂无案件" />
        </section>
      ) : (
        <>
          <section className="metrics">
            <article className="mini-metric">
              <small>关联样本</small>
              <strong>{samples.length}</strong>
            </article>
            <article className="mini-metric">
              <small>虫龄序列</small>
              <strong>{sequences.length}</strong>
            </article>
            <article className="mini-metric">
              <small>平均温度</small>
              <strong>{avgTemp}℃</strong>
            </article>
            <article className="mini-metric">
              <small>最高发育阶段</small>
              <strong>{progressRank >= 0 ? (["卵", "幼虫", "蛹", "成虫"] as const)[progressRank] : "—"}</strong>
            </article>
          </section>

          <section className="panel">
            <div className="heading">
              <div>
                <p>案件样本关联</p>
                <h2>{caseId}</h2>
              </div>
              <span className="muted">涉及发育阶段：{[...stageSet].join(" / ") || "—"}</span>
            </div>
            <div className="case-links">
              {samples.map((s) => (
                <div key={s.id} className="case-link-row">
                  <StageTag stage={s.stage} />
                  <span className="pick-id">{s.id}</span>
                  <b>{s.species}</b>
                  <small>{s.location || "地点待补"}</small>
                  <time>{fmtTime(s.sampledAt)}</time>
                  <small>{s.exposureStage || "暴露阶段未填"}</small>
                  {s.note && <small className="muted">备注：{s.note}</small>}
                </div>
              ))}
            </div>
          </section>

          <TemperatureChart samples={samples} />

          <section className="panel">
            <div className="heading">
              <div>
                <p>序列与拒绝记录</p>
                <h2>本案编排结果</h2>
              </div>
            </div>
            {sequences.length === 0 && rejections.length === 0 ? (
              <EmptyState text="本案暂无虫龄序列" />
            ) : (
              <ul className="case-seq-list">
                {sequences.map((q) => (
                  <li key={q.id}>
                    <StatusBadge status={q.status} />
                    <b>{q.id}</b>
                    <span>{q.species}</span>
                    <small className="muted">{q.sampleIds.length} 枚</small>
                    <span className={q.status === "approved" ? "ok-line inline" : "muted"}>{q.reason}</span>
                  </li>
                ))}
                {rejections.map((r) => (
                  <li key={r.id}>
                    <StatusBadge status="rejected" />
                    <b>{r.id}</b>
                    <span>{r.sampleIds.join(" + ")}</span>
                    <span className="warn-line inline">{r.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
