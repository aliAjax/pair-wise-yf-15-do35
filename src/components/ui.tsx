import { ReactNode, useEffect } from "react";
import { SequenceStatus, Stage, STAGES, STATUS_LABEL } from "../types";

const STATUS_COLORS: Record<SequenceStatus, string> = {
  rejected: "#dc2626",
  pending: "#a16207",
  review: "#2563eb",
  returned: "#dc2626",
  approved: "#365314",
};

const STAGE_COLORS: Record<Stage, string> = {
  卵: "#0e7490",
  幼虫: "#a16207",
  蛹: "#7c3aed",
  成虫: "#365314",
};

export function StatusBadge({ status }: { status: SequenceStatus }) {
  return (
    <span className="badge" style={{ background: `${STATUS_COLORS[status]}1a`, color: STATUS_COLORS[status] }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function StageTag({ stage }: { stage: Stage }) {
  return (
    <span className="stage-tag" style={{ background: `${STAGE_COLORS[stage]}1a`, color: STAGE_COLORS[stage] }}>
      {stage}
    </span>
  );
}

export function StageStepper({ stage }: { stage: Stage }) {
  const rank = STAGES.indexOf(stage);
  return (
    <span className="stepper" title={`发育位置：${stage}`}>
      {STAGES.map((s, i) => (
        <i key={s} className={i <= rank ? "on" : ""} style={i <= rank ? { background: STAGE_COLORS[s] } : undefined} />
      ))}
    </span>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-mask" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}

export function fmtTime(iso: string): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}
