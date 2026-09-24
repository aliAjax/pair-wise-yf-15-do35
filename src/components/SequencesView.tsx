import { useMemo, useState } from "react";
import { InstarSequence, ReviewLog, Sample } from "../types";
import { Store } from "../store";
import { sequenceMissing, sortBySampledAt, stageRank } from "../domain";
import { EmptyState, StatusBadge, StageTag, fmtTime } from "./ui";

export default function SequencesView({ store }: { store: Store }) {
  const { state, createSequence, reviewSequence } = store;
  const caseIds = useMemo(() => Array.from(new Set(state.samples.map((s) => s.caseId))).sort(), [state.samples]);
  const [caseId, setCaseId] = useState(caseIds[0] ?? "");
  const [picked, setPicked] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const caseSamples = useMemo(
    () => sortBySampledAt(state.samples.filter((s) => s.caseId === caseId)),
    [state.samples, caseId]
  );

  function pickCase(id: string) {
    setCaseId(id);
    setPicked([]);
    setFeedback(null);
  }

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /** 鉴定人挑出样本 → 先按采样时间排列（预览即最终顺序）→ 提交编排 */
  function submit() {
    const res = createSequence(caseId, picked);
    setFeedback({ ok: res.ok, text: res.reason });
    if (res.ok) setPicked([]);
  }

  const pickedOrdered = useMemo(
    () => sortBySampledAt(picked.map((id) => caseSamples.find((s) => s.id === id)).filter((s): s is Sample => Boolean(s))),
    [picked, caseSamples]
  );

  return (
    <div className="seq-view">
      <section className="panel">
        <div className="heading">
          <div>
            <p>虫龄序列编排</p>
            <h2>鉴定人挑选同案样本</h2>
          </div>
        </div>

        <div className="case-tabs">
          {caseIds.map((id) => (
            <button key={id} className={id === caseId ? "chip-on" : ""} onClick={() => pickCase(id)}>
              {id}
            </button>
          ))}
        </div>

        <p className="rule-hint">
          规则：至少两枚同案样本，按采样时间排列；<b>虫种不同</b>或<b>采样时间相同</b>将拒绝编排并说明原因；
          虫种一致时补齐地点、温度、保存方式后送入复核，缺一项存为待补。原样本始终保留。
        </p>

        <div className="pick-list">
          {caseSamples.map((s) => (
            <label key={s.id} className={`pick-row ${picked.includes(s.id) ? "picked" : ""}`}>
              <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} />
              <StageTag stage={s.stage} />
              <span className="pick-id">{s.id}</span>
              <b>{s.species}</b>
              <small>{fmtTime(s.sampledAt)}</small>
              <small className="muted">
                {s.location || "地点待补"} · {s.temperature === null ? "温度待补" : `${s.temperature}℃`} ·{" "}
                {s.preservation || "保存待补"}
              </small>
            </label>
          ))}
          {caseSamples.length === 0 && <EmptyState text="该案件暂无样本" />}
        </div>

        {pickedOrdered.length > 0 && (
          <div className="order-preview">
            <h4>按采样时间排列（{pickedOrdered.length} 枚）</h4>
            <ol>
              {pickedOrdered.map((s, i) => (
                <li key={s.id}>
                  <span className="order-no">{i + 1}</span>
                  <StageTag stage={s.stage} />
                  <span className="pick-id">{s.id}</span>
                  <b>{s.species}</b>
                  <time>{fmtTime(s.sampledAt)}</time>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="form-actions">
          <button className="primary" onClick={submit} disabled={picked.length === 0}>
            编排虫龄序列（{picked.length}）
          </button>
          {feedback && <span className={feedback.ok ? "ok-line inline" : "warn-line inline"}>{feedback.text}</span>}
        </div>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>序列与复核</p>
            <h2>虫龄序列工作台</h2>
          </div>
        </div>
        <div className="seq-cards">
          {state.sequences.map((seq) => (
            <SequenceCard key={seq.id} seq={seq} store={store} onReview={() => reviewSequence(seq.id)} />
          ))}
          {state.sequences.length === 0 && <EmptyState text="还没有虫龄序列，先在上方挑样本编排" />}
        </div>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>拒绝留痕</p>
            <h2>编排被拒绝的记录</h2>
          </div>
        </div>
        {state.rejections.length === 0 ? (
          <EmptyState text="暂无拒绝记录" />
        ) : (
          <ul className="reject-list">
            {state.rejections.map((r) => (
              <li key={r.id}>
                <StatusBadge status="rejected" />
                <b>{r.id}</b>
                <span className="muted">{r.caseId}</span>
                <span>{r.sampleIds.join(" + ")}</span>
                <span className="warn-line inline">{r.reason}</span>
                <time>{fmtTime(r.at)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SequenceCard({ seq, store, onReview }: { seq: InstarSequence; store: Store; onReview: () => void }) {
  const { state } = store;
  const [showHistory, setShowHistory] = useState(false);

  const members = sortBySampledAt(
    seq.sampleIds.map((id) => state.samples.find((s) => s.id === id)).filter((s): s is Sample => Boolean(s))
  );
  const liveMissing = useMemo(() => sequenceMissing(members), [members]);
  const lost = seq.sampleIds.filter((id) => !state.samples.some((s) => s.id === id));

  return (
    <article className={`seq-card status-${seq.status}`}>
      <header>
        <div>
          <h3>
            {seq.id} <span className="muted">{seq.caseId} · {seq.species}</span>
          </h3>
          <small>{members.length} 枚样本 · 建立于 {fmtTime(seq.createdAt)} · 更新 {fmtTime(seq.updatedAt)}</small>
        </div>
        <StatusBadge status={seq.status} />
      </header>

      <ProgressionBar members={members} lastSnapshot={seq.lastReview?.snapshot} returned={seq.status === "returned"} />

      <ul className="seq-members">
        {members.map((s, i) => {
          const prev = members[i - 1];
          const regression = prev && stageRank(s.stage) < stageRank(prev.stage);
          const snapStage = seq.lastReview?.snapshot[s.id];
          const changedSinceLast = snapStage && snapStage !== s.stage;
          return (
            <li key={s.id}>
              <span className="order-no">{i + 1}</span>
              <StageTag stage={s.stage} />
              <span className="pick-id">{s.id}</span>
              <time>{fmtTime(s.sampledAt)}</time>
              <small className="muted">
                {s.location || "地点待补"} · {s.temperature === null ? "温度待补" : `${s.temperature}℃`} ·{" "}
                {s.preservation || "保存待补"}
              </small>
              {regression && <span className="warn-line inline">倒退！</span>}
              {changedSinceLast && <span className="changed-flag">阶段自上次复核后已改为{s.stage}</span>}
            </li>
          );
        })}
      </ul>

      <p className={seq.status === "approved" ? "ok-line" : seq.status === "returned" || seq.status === "rejected" ? "warn-line" : "muted"}>
        {seq.reason}
      </p>

      {(seq.status === "pending" || liveMissing.length > 0) && liveMissing.length > 0 && (
        <p className="warn-line">当前待补项：{liveMissing.join("、")}。请到样本详情卡片补录，补齐后自动送入复核。</p>
      )}
      {lost.length > 0 && <p className="warn-line">以下样本在记录中缺失（原样本未删除，仅可能未加载）：{lost.join("、")}</p>}

      <div className="seq-actions">
        {(seq.status === "review" || seq.status === "returned") && (
          <button className="primary" onClick={onReview}>
            {seq.status === "returned" ? "修正后重新复核" : "执行复核"}
          </button>
        )}
        {seq.status === "pending" && (
          <button className="primary" onClick={onReview} title="若已在样本卡片补齐资料，可由此立即重新检查">
            重新检查资料
          </button>
        )}
        <button onClick={() => setShowHistory((v) => !v)}>{showHistory ? "收起复核记录" : "查看复核记录"}</button>
      </div>

      {showHistory && <ReviewHistory history={seq.history} />}
    </article>
  );
}

/** 发育阶段前进条：卵→幼虫→蛹→成虫，倒退位置标红 */
function ProgressionBar({
  members,
  lastSnapshot,
  returned,
}: {
  members: Sample[];
  lastSnapshot?: Record<string, Sample["stage"]>;
  returned: boolean;
}) {
  return (
    <div className={`progression ${returned ? "is-returned" : ""}`}>
      {members.map((s, i) => {
        const prev = members[i - 1];
        const regression = prev && stageRank(s.stage) < stageRank(prev.stage);
        const arrow = i > 0 ? (regression ? "↩" : "→") : "";
        const snap = lastSnapshot?.[s.id];
        return (
          <span key={s.id} className={`prog-step ${regression ? "regression" : ""}`}>
            {i > 0 && <i className="prog-arrow">{arrow}</i>}
            <span className="prog-node">
              <StageTag stage={s.stage} />
              <small>{s.id}</small>
            </span>
            {snap && snap !== s.stage && (
              <small className="snap-note">
                上次：{snap}
              </small>
            )}
          </span>
        );
      })}
    </div>
  );
}

function ReviewHistory({ history }: { history: ReviewLog[] }) {
  return (
    <ol className="history">
      {history.map((log, i) => (
        <li key={i} className={`hist-${log.action}`}>
          <span className="hist-action">
            {log.action === "submit" ? "送入复核" : log.action === "return" ? "退回（保留上次结果）" : "复核通过"}
          </span>
          <time>{fmtTime(log.at)}</time>
          <p>{log.detail}</p>
          <p className="muted">阶段快照：{Object.entries(log.snapshot).map(([id, st]) => `${id}=${st}`).join("，")}</p>
        </li>
      ))}
    </ol>
  );
}
