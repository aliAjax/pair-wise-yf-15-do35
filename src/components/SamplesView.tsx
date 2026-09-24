import { useMemo, useState } from "react";
import { Sample, Stage, STAGES } from "../types";
import { Store } from "../store";
import { missingFields } from "../domain";
import { EmptyState, Modal, StageStepper, StageTag, fmtTime } from "./ui";

const EMPTY_FORM = {
  caseId: "",
  location: "",
  temperature: "",
  exposureStage: "",
  species: "",
  stage: "幼虫" as Stage,
  sampledAt: "",
  preservation: "",
  note: "",
};

export default function SamplesView({ store }: { store: Store }) {
  const { state, addSample, updateSample } = store;
  const [stageFilter, setStageFilter] = useState<Stage | "全部">("全部");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [flash, setFlash] = useState<string | null>(null);

  const caseIds = useMemo(
    () => Array.from(new Set(state.samples.map((s) => s.caseId))).sort(),
    [state.samples]
  );

  const visible = useMemo(() => {
    const list = stageFilter === "全部" ? state.samples : state.samples.filter((s) => s.stage === stageFilter);
    return [...list].sort((a, b) => a.caseId.localeCompare(b.caseId) || a.sampledAt.localeCompare(b.sampledAt));
  }, [state.samples, stageFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Sample[]>();
    visible.forEach((s) => {
      const arr = map.get(s.caseId) ?? [];
      arr.push(s);
      map.set(s.caseId, arr);
    });
    return [...map.entries()];
  }, [visible]);

  const detail = detailId ? state.samples.find((s) => s.id === detailId) ?? null : null;

  function submitNew() {
    if (!form.caseId.trim() || !form.species.trim() || !form.sampledAt) {
      setFlash("案件编号、昆虫种类、采样时间为必填项");
      return;
    }
    const temp = form.temperature.trim() === "" ? null : Number(form.temperature);
    if (form.temperature.trim() !== "" && Number.isNaN(temp)) {
      setFlash("环境温度需为数字");
      return;
    }
    const created = addSample({
      caseId: form.caseId.trim().toUpperCase(),
      location: form.location.trim(),
      temperature: temp,
      exposureStage: form.exposureStage.trim(),
      species: form.species.trim(),
      stage: form.stage,
      sampledAt: form.sampledAt,
      preservation: form.preservation.trim(),
      note: form.note.trim(),
    });
    if (created) {
      setFlash(`样本 ${created.id} 已保存（原样本不会被删除）`);
      setForm({ ...EMPTY_FORM, caseId: form.caseId });
      window.setTimeout(() => setFlash(null), 2600);
    }
  }

  return (
    <div className="samples-view">
      <section className="panel">
        <div className="heading">
          <div>
            <p>样本批次列表</p>
            <h2>按案件分组的样本</h2>
          </div>
          <div className="chips">
            <button className={stageFilter === "全部" ? "chip-on" : ""} onClick={() => setStageFilter("全部")}>
              全部
            </button>
            {STAGES.map((st) => (
              <button key={st} className={stageFilter === st ? "chip-on" : ""} onClick={() => setStageFilter(st)}>
                {st}
              </button>
            ))}
          </div>
        </div>

        {grouped.length === 0 ? (
          <EmptyState text="当前筛选下没有样本" />
        ) : (
          <div className="batches">
            {grouped.map(([caseId, samples]) => (
              <article key={caseId} className="batch">
                <header>
                  <h3>{caseId}</h3>
                  <span>{samples.length} 枚样本</span>
                </header>
                <div className="sample-rows">
                  {samples.map((s) => {
                    const miss = missingFields(s);
                    return (
                      <button key={s.id} className="sample-row" onClick={() => setDetailId(s.id)}>
                        <span className="sample-id">{s.id}</span>
                        <StageTag stage={s.stage} />
                        <span className="sample-main">
                          <b>{s.species}</b>
                          <small>
                            {s.location || "地点待补"} · {s.temperature === null ? "温度待补" : `${s.temperature}℃`} ·{" "}
                            {s.preservation || "保存方式待补"}
                          </small>
                        </span>
                        <time>{fmtTime(s.sampledAt)}</time>
                        {miss.length > 0 && <span className="mini-warn">缺{miss.join("/")}</span>}
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>新增样本</p>
            <h2>采样登记</h2>
          </div>
        </div>
        {flash && <p className="flash">{flash}</p>}
        <div className="field-grid">
          <label>
            <span>案件编号 *</span>
            <input value={form.caseId} onChange={(e) => setForm({ ...form, caseId: e.target.value })} placeholder="如 CASE-042" />
          </label>
          <label>
            <span>采样时间 *</span>
            <input type="datetime-local" value={form.sampledAt} onChange={(e) => setForm({ ...form, sampledAt: e.target.value })} />
          </label>
          <label>
            <span>采样地点</span>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="如 室外草地" />
          </label>
          <label>
            <span>环境温度（℃）</span>
            <input
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: e.target.value })}
              placeholder="如 28.6"
              inputMode="decimal"
            />
          </label>
          <label>
            <span>尸体暴露阶段</span>
            <input
              value={form.exposureStage}
              onChange={(e) => setForm({ ...form, exposureStage: e.target.value })}
              placeholder="如 肿胀期"
            />
          </label>
          <label>
            <span>昆虫种类 *</span>
            <input value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })} placeholder="如 大头金蝇" />
          </label>
          <label>
            <span>发育阶段</span>
            <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })}>
              {STAGES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>保存方式</span>
            <input
              value={form.preservation}
              onChange={(e) => setForm({ ...form, preservation: e.target.value })}
              placeholder="如 75%乙醇保存"
            />
          </label>
          <label className="full">
            <span>鉴定备注</span>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="虫龄、复核要点等" />
          </label>
        </div>
        <div className="form-actions">
          <button className="primary" onClick={submitNew}>
            保存样本
          </button>
        </div>
      </section>

      {detail && <SampleDetail sample={detail} onClose={() => setDetailId(null)} onSave={updateSample} />}
    </div>
  );
}

function SampleDetail({
  sample,
  onClose,
  onSave,
}: {
  sample: Sample;
  onClose: () => void;
  onSave: Store["updateSample"];
}) {
  const [edit, setEdit] = useState<Sample>({ ...sample });
  const [saved, setSaved] = useState(false);
  const miss = missingFields(edit);

  function save() {
    onSave(edit.id, {
      location: edit.location.trim(),
      temperature: edit.temperature,
      preservation: edit.preservation.trim(),
      exposureStage: edit.exposureStage.trim(),
      species: edit.species.trim(),
      stage: edit.stage,
      sampledAt: edit.sampledAt,
      note: edit.note.trim(),
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Modal title={`样本详情 ${sample.id}`} onClose={onClose}>
      <div className="detail-card">
        <div className="detail-top">
          <StageTag stage={edit.stage} />
          <StageStepper stage={edit.stage} />
          <span className="muted">{sample.caseId}</span>
        </div>
        {miss.length > 0 ? (
          <p className="warn-line">资料缺项：{miss.join("、")}（含本样本的待补序列补齐后会自动送入复核）</p>
        ) : (
          <p className="ok-line">地点、温度、保存方式齐全</p>
        )}
        <div className="field-grid">
          <label>
            <span>采样地点</span>
            <input value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} />
          </label>
          <label>
            <span>环境温度（℃）</span>
            <input
              value={edit.temperature === null ? "" : String(edit.temperature)}
              onChange={(e) =>
                setEdit({ ...edit, temperature: e.target.value === "" ? null : Number(e.target.value) })
              }
              inputMode="decimal"
            />
          </label>
          <label>
            <span>尸体暴露阶段</span>
            <input value={edit.exposureStage} onChange={(e) => setEdit({ ...edit, exposureStage: e.target.value })} />
          </label>
          <label>
            <span>昆虫种类</span>
            <input value={edit.species} onChange={(e) => setEdit({ ...edit, species: e.target.value })} />
          </label>
          <label>
            <span>发育阶段</span>
            <select value={edit.stage} onChange={(e) => setEdit({ ...edit, stage: e.target.value as Stage })}>
              {STAGES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>采样时间</span>
            <input type="datetime-local" value={edit.sampledAt} onChange={(e) => setEdit({ ...edit, sampledAt: e.target.value })} />
          </label>
          <label className="full">
            <span>保存方式</span>
            <input value={edit.preservation} onChange={(e) => setEdit({ ...edit, preservation: e.target.value })} />
          </label>
          <label className="full">
            <span>鉴定备注</span>
            <textarea rows={2} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
          </label>
        </div>
        <div className="form-actions">
          <button className="primary" onClick={save}>
            保存修改（原样本保留）
          </button>
          {saved && <span className="ok-line inline">已保存</span>}
        </div>
      </div>
    </Modal>
  );
}
