import { useMemo, useState } from "react";
import type { Sample, Sequence, Stage } from "../types";
import {
  arrangeSequence,
  findMissing,
  formatDateTime,
  formatTime,
  isFieldEmpty,
  lastPassed,
  lastSnapshot,
  membersOf,
  REQUIRED_FIELDS,
  reviewStages,
} from "../lib/domain";
import { STAGE_COLORS } from "../lib/constants";

export interface SupplementEdit {
  location: string;
  temperature: string;
  preservation: string;
}

interface SequenceViewProps {
  samples: Sample[];
  sequences: Sequence[];
  highlightId: string | null;
  onCreate: (sampleIds: string[]) => string | null;
  onSaveSupplement: (seqId: string, edits: Record<string, SupplementEdit>) => string | null;
  onReview: (seqId: string, stages: Stage[]) => string | null;
}

export function SequenceView({
  samples,
  sequences,
  highlightId,
  onCreate,
  onSaveSupplement,
  onReview,
}: SequenceViewProps) {
  const [caseFilter, setCaseFilter] = useState("全部");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [createError, setCreateError] = useState<string | null>(null);

  const caseIds = useMemo(
    () => Array.from(new Set(samples.map((s) => s.caseId))).sort(),
    [samples]
  );

  const selectable = useMemo(
    () =>
      samples
        .filter((s) => caseFilter === "全部" || s.caseId === caseFilter)
        .sort((a, b) => a.sampledAt.localeCompare(b.sampledAt)),
    [samples, caseFilter]
  );

  const pickedSamples = useMemo(
    () =>
      Array.from(picked)
        .map((id) => samples.find((s) => s.id === id))
        .filter((s): s is Sample => Boolean(s)),
    [picked, samples]
  );

  // 实时按编排规则预检（同案、同种、时间不同），让拒绝原因在提交前可见
  const precheck = useMemo(
    () => (pickedSamples.length ? arrangeSequence(pickedSamples) : null),
    [pickedSamples]
  );

  const toggle = (id: string) => {
    setCreateError(null);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitCreate = () => {
    const result = arrangeSequence(pickedSamples);
    if (!result.ok) {
      setCreateError(result.reason);
      return;
    }
    const err = onCreate(result.members.map((m) => m.id));
    if (err) {
      setCreateError(err);
      return;
    }
    setPicked(new Set());
    setCreateError(null);
  };

  const sortedSequences = useMemo(
    () =>
      [...sequences].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [sequences]
  );

  return (
    <div className="seq-layout">
      <section className="panel seq-compose">
        <div className="heading">
          <div>
            <p>虫龄序列编排</p>
            <h2>挑出同案样本</h2>
          </div>
        </div>
        <p className="rule-note">
          规则：至少两枚同案样本，虫种须一致，按采样时间排列；虫种不同或采样时间相同将拒绝编排。
        </p>
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

        <div className="pick-list">
          {selectable.map((s) => (
            <label
              key={s.id}
              className={picked.has(s.id) ? "pick-item picked" : "pick-item"}
            >
              <input
                type="checkbox"
                checked={picked.has(s.id)}
                onChange={() => toggle(s.id)}
              />
              <span className="pick-id">{s.id}</span>
              <span
                className="stage-pill"
                style={{ color: STAGE_COLORS[s.stage], borderColor: STAGE_COLORS[s.stage] }}
              >
                {s.stage}
              </span>
              <span className="pick-species">{s.species}</span>
              <span className="pick-time">{formatTime(s.sampledAt)}</span>
            </label>
          ))}
          {!selectable.length && <p className="empty-hint">该案件下暂无样本。</p>}
        </div>

        {pickedSamples.length > 0 ? (
          <div className="precheck">
            {precheck?.ok ? (
              <div className="alert alert-ok">
                预检通过，时间序为：
                {precheck.members.map((m, i) => (
                  <span key={m.id} className="chain-node">
                    {i + 1}. {m.id}（{m.stage} · {formatTime(m.sampledAt)}）
                  </span>
                ))}
              </div>
            ) : (
              <div className="alert alert-error">{precheck?.reason}</div>
            )}
          </div>
        ) : null}
        {createError ? (
          <div className="alert alert-error">{createError}</div>
        ) : null}

        <button
          className="primary wide-btn"
          disabled={pickedSamples.length < 2 || !precheck?.ok}
          onClick={submitCreate}
        >
          编排虫龄序列（已选 {pickedSamples.length} 枚）
        </button>
      </section>

      <section className="panel seq-list">
        <div className="heading">
          <div>
            <p>序列复核工作台</p>
            <h2>虫龄序列（{sequences.length}）</h2>
          </div>
        </div>
        <div className="seq-cards">
          {sortedSequences.map((seq) => (
            <SequenceCard
              key={seq.id}
              seq={seq}
              samples={samples}
              highlighted={seq.id === highlightId}
              onSaveSupplement={onSaveSupplement}
              onReview={onReview}
            />
          ))}
          {!sortedSequences.length && (
            <p className="empty-hint">
              还没有虫龄序列，请从左侧挑出同案同种样本进行编排。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

interface SequenceCardProps {
  seq: Sequence;
  samples: Sample[];
  highlighted: boolean;
  onSaveSupplement: SequenceViewProps["onSaveSupplement"];
  onReview: SequenceViewProps["onReview"];
}

function SequenceCard({
  seq,
  samples,
  highlighted,
  onSaveSupplement,
  onReview,
}: SequenceCardProps) {
  const members = useMemo(() => membersOf(seq, samples), [seq, samples]);
  const missing = useMemo(() => findMissing(members), [members]);

  const [showHistory, setShowHistory] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewStagesDraft, setReviewStagesDraft] = useState<Stage[]>(
    () => members.map((m) => m.stage)
  );
  const [reviewMsg, setReviewMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [supplement, setSupplement] = useState<Record<string, SupplementEdit>>(
    () => Object.fromEntries(members.map((m) => [m.id, {
      location: m.location,
      temperature: m.temperature == null ? "" : String(m.temperature),
      preservation: m.preservation,
    }]))
  );
  const [supplementMsg, setSupplementMsg] = useState<string | null>(null);

  const passed = lastPassed(seq);
  const lastSnap = lastSnapshot(seq);

  const setStageAt = (index: number, stage: Stage) =>
    setReviewStagesDraft((prev) => prev.map((s, i) => (i === index ? stage : s)));

  const openReview = () => {
    setReviewStagesDraft(members.map((m) => m.stage));
    setReviewMsg(null);
    setReviewOpen(true);
  };

  const submitReview = () => {
    const verdict = reviewStages(reviewStagesDraft);
    if (!verdict.passed) {
      // 退回原因本地也校验一次，与应用层保持一致
      setReviewMsg({ ok: false, text: verdict.reason });
      onReview(seq.id, reviewStagesDraft);
      return;
    }
    const err = onReview(seq.id, reviewStagesDraft);
    if (err) {
      setReviewMsg({ ok: false, text: err });
      return;
    }
    setReviewMsg({ ok: true, text: "复核通过：阶段沿 卵 → 幼虫 → 蛹 → 成虫 单调前进。" });
    setReviewOpen(false);
  };

  const saveSupplement = () => {
    const err = onSaveSupplement(seq.id, supplement);
    setSupplementMsg(err ?? "已补齐并送入复核，原样本记录保持不变。");
    if (!err) setSupplementMsg("已补齐并送入复核，原样本记录保持不变。");
  };

  const rejectedSnap =
    seq.status === "已退回" && lastSnap && !lastSnap.passed ? lastSnap : null;

  return (
    <article
      data-seq-id={seq.id}
      className={highlighted ? "seq-card seq-card-hi" : "seq-card"}
    >
      <header className="seq-head">
        <div>
          <h3>
            {seq.id}
            <span className={`status-tag status-${seq.status}`}>{seq.status}</span>
          </h3>
          <p>
            {seq.caseId} · {seq.species} · {members.length} 枚 · 更新于{" "}
            {formatDateTime(seq.updatedAt)}
          </p>
        </div>
        <button
          className="ghost-btn"
          onClick={() => setShowHistory((v) => !v)}
        >
          {showHistory ? "收起复核记录" : `复核记录(${seq.history.length})`}
        </button>
      </header>

      <ol className="member-chain">
        {members.map((m, i) => (
          <li key={m.id}>
            <span className="chain-index">{i + 1}</span>
            <div className="member-info">
              <b>{m.id}</b>
              <span
                className="stage-pill"
                style={{ color: STAGE_COLORS[m.stage], borderColor: STAGE_COLORS[m.stage] }}
              >
                {m.stage}
              </span>
              <em>{formatTime(m.sampledAt)}</em>
              <span className="muted">
                {m.location || <i className="missing">缺地点</i>} ·{" "}
                {m.temperature == null ? (
                  <i className="missing">缺温度</i>
                ) : (
                  `${m.temperature}℃`
                )}{" "}
                · {m.preservation || <i className="missing">缺保存方式</i>}
              </span>
            </div>
          </li>
        ))}
      </ol>

      {/* 待补：补齐地点 / 温度 / 保存方式后才送复核，原样本保留 */}
      {seq.status === "待补" ? (
        <div className="supplement-box">
          <div className="alert alert-warn">
            存为待补：以下必填项有缺失（{missing.map((x) => `${x.sampleId}·${x.label}`).join("；")}
            ）。补齐后送入复核；原始样本不会丢失。
          </div>
          {members.map((m) => {
            const draft = supplement[m.id];
            return (
              <div className="supplement-row" key={m.id}>
                <b>{m.id}</b>
                {REQUIRED_FIELDS.map((field) => {
                  const empty = isFieldEmpty(m, field.key);
                  return (
                    <label key={field.key} className={empty ? "missing-field" : ""}>
                      <span>
                        {field.label}
                        {empty ? " *待补" : ""}
                      </span>
                      {field.key === "temperature" ? (
                        <input
                          type="number"
                          step="0.1"
                          value={draft.temperature}
                          placeholder="℃"
                          onChange={(e) =>
                            setSupplement((prev) => ({
                              ...prev,
                              [m.id]: { ...prev[m.id], temperature: e.target.value },
                            }))
                          }
                        />
                      ) : (
                        <input
                          value={draft[field.key as "location" | "preservation"]}
                          onChange={(e) =>
                            setSupplement((prev) => ({
                              ...prev,
                              [m.id]: {
                                ...prev[m.id],
                                [field.key]: e.target.value,
                              },
                            }))
                          }
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            );
          })}
          {supplementMsg ? (
            <div className={supplementMsg.startsWith("已补齐") ? "alert alert-ok" : "alert alert-error"}>
              {supplementMsg}
            </div>
          ) : null}
          <button className="primary" onClick={saveSupplement}>
            补齐并送入复核
          </button>
        </div>
      ) : null}

      {/* 已退回：展示退回原因与保留的上次通过结果，可修正后重新送审 */}
      {rejectedSnap ? (
        <div className="alert alert-error">
          上次复核已退回：{rejectedSnap.reason}
          {passed ? "；已保留上次通过结果，可在下方查看。" : ""}
        </div>
      ) : null}
      {passed ? (
        <div className="alert alert-ok">
          上次通过结果（{formatDateTime(passed.at)}）：
          {passed.stages.map((st, i) => (
            <span key={i} className="chain-node">
              {members[i]?.id ?? `#${i + 1}`} → {st}
            </span>
          ))}
        </div>
      ) : null}

      {/* 复核操作：待复核直接审；已通过可重开；已退回修正后重新送审 */}
      {seq.status !== "待补" ? (
        reviewOpen ? (
          <div className="review-box">
            <p className="review-hint">
              逐项核对发育阶段（允许同阶段并列），提交后系统检查 卵 → 幼虫 → 蛹 → 成虫 是否出现倒退：
            </p>
            {members.map((m, i) => (
              <div className="review-row" key={m.id}>
                <b>
                  {i + 1}. {m.id}
                </b>
                <em>{formatTime(m.sampledAt)}</em>
                <select
                  value={reviewStagesDraft[i] ?? m.stage}
                  onChange={(e) => setStageAt(i, e.target.value as Stage)}
                >
                  {(["卵", "幼虫", "蛹", "成虫"] as Stage[]).map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {reviewMsg ? (
              <div className={reviewMsg.ok ? "alert alert-ok" : "alert alert-error"}>
                {reviewMsg.text}
              </div>
            ) : null}
            <div className="inline-actions">
              <button onClick={() => setReviewOpen(false)}>收起</button>
              <button className="primary" onClick={submitReview}>
                提交复核
              </button>
            </div>
          </div>
        ) : (
          <div className="inline-actions">
            <button className="primary" onClick={openReview}>
              {seq.status === "已退回"
                ? "修正阶段并重新送审"
                : seq.status === "已通过"
                ? "重新打开复核"
                : "开始复核"}
            </button>
          </div>
        )
      ) : null}

      {showHistory ? (
        <div className="history-box">
          {seq.history.length ? (
            seq.history.map((snap, i) => (
              <div key={i} className={snap.passed ? "history-item ok" : "history-item bad"}>
                <span className={`status-tag ${snap.passed ? "status-已通过" : "status-已退回"}`}>
                  {snap.passed ? "通过" : "退回"}
                </span>
                <time>{formatDateTime(snap.at)}</time>
                <span className="history-chain">
                  {snap.stages.map((st, j) => (
                    <span key={j}>
                      {members[j]?.id ?? `#${j + 1}`}:{st}
                      {j < snap.stages.length - 1 ? " → " : ""}
                    </span>
                  ))}
                </span>
                {snap.reason ? <p className="history-reason">{snap.reason}</p> : null}
              </div>
            ))
          ) : (
            <p className="muted">尚无复核记录。</p>
          )}
        </div>
      ) : null}
    </article>
  );
}
