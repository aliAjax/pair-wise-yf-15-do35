import { useState } from "react";
import type { SampleInput, Stage } from "../types";
import { EXPOSURE_STAGES, KNOWN_SPECIES, PRESERVATIONS } from "../lib/constants";

interface SampleFormProps {
  initial?: Partial<SampleInput>;
  submitLabel: string;
  onSubmit: (input: SampleInput) => string | null;
  onCancel: () => void;
}

const EMPTY: SampleInput = {
  caseId: "",
  location: "",
  temperature: null,
  exposureStage: EXPOSURE_STAGES[0],
  species: "",
  stage: "幼虫",
  sampledAt: "",
  preservation: "",
  note: "",
};

export function SampleForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: SampleFormProps) {
  const [form, setForm] = useState<SampleInput>({ ...EMPTY, ...initial });
  const [tempText, setTempText] = useState(
    initial?.temperature == null ? "" : String(initial.temperature)
  );
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof SampleInput>(key: K, val: SampleInput[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const submit = () => {
    const temp = tempText.trim() === "" ? null : Number(tempText);
    const payload: SampleInput = {
      ...form,
      caseId: form.caseId.trim().toUpperCase(),
      location: form.location.trim(),
      species: form.species.trim(),
      preservation: form.preservation.trim(),
      sampledAt: form.sampledAt,
      temperature:
        temp === null || Number.isNaN(temp) ? null : Math.round(temp * 10) / 10,
    };
    const err = onSubmit(payload);
    if (err) setError(err);
  };

  return (
    <div className="form-body">
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="field-grid">
        <label>
          <span>案件编号 *</span>
          <input
            value={form.caseId}
            placeholder="如 CASE-042"
            onChange={(e) => update("caseId", e.target.value)}
          />
        </label>
        <label>
          <span>采样时间 *</span>
          <input
            type="datetime-local"
            value={form.sampledAt}
            onChange={(e) => update("sampledAt", e.target.value)}
          />
        </label>
        <label className="span-2">
          <span>昆虫种类 *</span>
          <input
            list="known-species"
            value={form.species}
            placeholder="如 大头金蝇 Chrysomya megacephala"
            onChange={(e) => update("species", e.target.value)}
          />
          <datalist id="known-species">
            {KNOWN_SPECIES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label>
          <span>发育阶段 *</span>
          <select
            value={form.stage}
            onChange={(e) => update("stage", e.target.value as Stage)}
          >
            {(["卵", "幼虫", "蛹", "成虫"] as Stage[]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>尸体暴露阶段</span>
          <select
            value={form.exposureStage}
            onChange={(e) => update("exposureStage", e.target.value)}
          >
            {EXPOSURE_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>采样地点</span>
          <input
            value={form.location}
            placeholder="补入虫龄序列时为必填"
            onChange={(e) => update("location", e.target.value)}
          />
        </label>
        <label>
          <span>环境温度 ℃</span>
          <input
            type="number"
            step="0.1"
            value={tempText}
            placeholder="补入虫龄序列时为必填"
            onChange={(e) => setTempText(e.target.value)}
          />
        </label>
        <label className="span-2">
          <span>保存方式</span>
          <input
            list="preservations"
            value={form.preservation}
            placeholder="补入虫龄序列时为必填，如 75%乙醇浸泡"
            onChange={(e) => update("preservation", e.target.value)}
          />
          <datalist id="preservations">
            {PRESERVATIONS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <label className="span-2">
          <span>鉴定备注</span>
          <textarea
            rows={2}
            value={form.note}
            placeholder="虫龄判断依据、体长、复核存疑点等"
            onChange={(e) => update("note", e.target.value)}
          />
        </label>
      </div>
      <div className="modal-actions">
        <button onClick={onCancel}>取消</button>
        <button className="primary" onClick={submit}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
