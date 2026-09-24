import { useMemo, useState } from "react";
import type { Sample, SampleInput, Sequence, Stage } from "../types";
import { Modal } from "./Modal";
import { SampleForm } from "./SampleForm";
import { formatTime } from "../lib/domain";
import { STAGE_COLORS } from "../lib/constants";

interface SampleDetailProps {
  sample: Sample;
  sequences: Sequence[];
  onClose: () => void;
  onSave: (id: string, input: SampleInput) => string | null;
}

export function SampleDetail({
  sample,
  sequences,
  onClose,
  onSave,
}: SampleDetailProps) {
  const [editing, setEditing] = useState(false);
  const linked = useMemo(
    () => sequences.filter((seq) => seq.sampleIds.includes(sample.id)),
    [sequences, sample.id]
  );

  return (
    <Modal
      title={sample.id}
      subtitle={`案件 ${sample.caseId} · 原始样本不会被删除或丢失`}
      onClose={onClose}
    >
      {editing ? (
        <SampleForm
          submitLabel="保存修改"
          initial={{
            caseId: sample.caseId,
            location: sample.location,
            temperature: sample.temperature,
            exposureStage: sample.exposureStage,
            species: sample.species,
            stage: sample.stage,
            sampledAt: sample.sampledAt,
            preservation: sample.preservation,
            note: sample.note,
          }}
          onCancel={() => setEditing(false)}
          onSubmit={(input) => {
            const err = onSave(sample.id, input);
            if (!err) setEditing(false);
            return err;
          }}
        />
      ) : (
        <div className="detail-body">
          <div
            className="stage-banner"
            style={{
              background: STAGE_COLORS[sample.stage as Stage],
            }}
          >
            <span>{sample.stage}</span>
            <b>{sample.species || "（未填写虫种）"}</b>
          </div>
          <dl className="detail-grid">
            <div>
              <dt>采样时间</dt>
              <dd>{formatTime(sample.sampledAt)}</dd>
            </div>
            <div>
              <dt>尸体暴露阶段</dt>
              <dd>{sample.exposureStage || "—"}</dd>
            </div>
            <div>
              <dt>采样地点</dt>
              <dd>{sample.location || "—"}</dd>
            </div>
            <div>
              <dt>环境温度</dt>
              <dd>{sample.temperature == null ? "—" : `${sample.temperature} ℃`}</dd>
            </div>
            <div>
              <dt>保存方式</dt>
              <dd>{sample.preservation || "—"}</dd>
            </div>
            <div>
              <dt>入库时间</dt>
              <dd>{formatTime(sample.createdAt)}</dd>
            </div>
            <div className="span-2">
              <dt>鉴定备注</dt>
              <dd>{sample.note || "—"}</dd>
            </div>
          </dl>

          <div className="linked-seqs">
            <p>关联虫龄序列</p>
            {linked.length ? (
              <ul>
                {linked.map((seq) => (
                  <li key={seq.id}>
                    <b>{seq.id}</b>
                    <span className={`status-tag status-${seq.status}`}>
                      {seq.status}
                    </span>
                    <em>{seq.species}</em>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">暂未编入任何虫龄序列</p>
            )}
          </div>

          <div className="modal-actions">
            <button onClick={onClose}>关闭</button>
            <button className="primary" onClick={() => setEditing(true)}>
              编辑样本
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
