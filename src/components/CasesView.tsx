import { useMemo } from "react";
import type { Sample, Sequence } from "../types";
import { averageTemperature, formatTime } from "../lib/domain";
import { STAGE_COLORS } from "../lib/constants";

interface CasesViewProps {
  samples: Sample[];
  sequences: Sequence[];
  onOpenSequence: (seqId: string) => void;
}

export function CasesView({ samples, sequences, onOpenSequence }: CasesViewProps) {
  const cases = useMemo(() => {
    const map = new Map<
      string,
      {
        caseId: string;
        samples: Sample[];
        sequences: Sequence[];
        species: Set<string>;
      }
    >();
    for (const s of samples) {
      const entry = map.get(s.caseId) ?? {
        caseId: s.caseId,
        samples: [],
        sequences: [],
        species: new Set<string>(),
      };
      entry.samples.push(s);
      if (s.species.trim()) entry.species.add(s.species.trim());
      map.set(s.caseId, entry);
    }
    for (const seq of sequences) {
      map.get(seq.caseId)?.sequences.push(seq);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.caseId.localeCompare(b.caseId)
    );
  }, [samples, sequences]);

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>案件样本关联</p>
          <h2>案件（{cases.length}）</h2>
        </div>
      </div>
      <div className="case-grid">
        {cases.map((c) => {
          const avg = averageTemperature(c.samples);
          const withTemp = c.samples.filter((s) => s.temperature !== null);
          return (
            <article key={c.caseId} className="case-card">
              <header>
                <h3>{c.caseId}</h3>
                <span className="case-stat">
                  {c.samples.length} 枚样本 · 平均 {avg == null ? "—" : `${avg}℃`}
                </span>
              </header>
              <p className="case-species">
                涉及虫种：
                {c.species.size ? Array.from(c.species).join("、") : "（未记录）"}
              </p>

              <div className="case-sub">
                <p>关联虫龄序列</p>
                {c.sequences.length ? (
                  <ul className="case-seq-list">
                    {c.sequences.map((seq) => (
                      <li key={seq.id}>
                        <button
                          className="ghost-btn"
                          onClick={() => onOpenSequence(seq.id)}
                        >
                          {seq.id}
                        </button>
                        <span className={`status-tag status-${seq.status}`}>
                          {seq.status}
                        </span>
                        <em>{seq.species}</em>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">尚未编排虫龄序列</p>
                )}
              </div>

              <div className="case-sub">
                <p>样本时间线</p>
                <ol className="case-timeline">
                  {[...c.samples]
                    .sort((a, b) => a.sampledAt.localeCompare(b.sampledAt))
                    .map((s) => (
                      <li key={s.id}>
                        <time>{formatTime(s.sampledAt)}</time>
                        <span
                          className="stage-dot"
                          style={{ background: STAGE_COLORS[s.stage] }}
                          title={s.stage}
                        />
                        <b>{s.id}</b>
                        <span className="muted">
                          {withTemp.includes(s) ? `${s.temperature}℃` : "缺温度"}
                        </span>
                      </li>
                    ))}
                </ol>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
