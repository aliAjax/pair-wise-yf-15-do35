import { useMemo, useState } from "react";
import { Sample, Stage, STAGES } from "../types";
import { sortBySampledAt } from "../domain";
import { EmptyState } from "./ui";

const STAGE_COLORS: Record<Stage, string> = {
  卵: "#0e7490",
  幼虫: "#a16207",
  蛹: "#7c3aed",
  成虫: "#365314",
};

export default function TemperatureChart({ samples }: { samples: Sample[] }) {
  const [stageFilter, setStageFilter] = useState<Stage | "全部">("全部");

  const points = useMemo(() => {
    const list = sortBySampledAt(
      samples.filter((s) => s.temperature !== null && (stageFilter === "全部" || s.stage === stageFilter))
    );
    return list.map((s) => ({ sample: s, t: s.temperature as number, at: s.sampledAt }));
  }, [samples, stageFilter]);

  const W = 920;
  const H = 260;
  const PAD_L = 48;
  const PAD_R = 18;
  const PAD_T = 20;
  const PAD_B = 44;

  const temps = points.map((p) => p.t);
  const tMin = temps.length ? Math.floor(Math.min(...temps) - 2) : 0;
  const tMax = temps.length ? Math.ceil(Math.max(...temps) + 2) : 40;
  const span = Math.max(1, tMax - tMin);

  const x = (i: number) =>
    points.length <= 1 ? PAD_L + (W - PAD_L - PAD_R) / 2 : PAD_L + (i * (W - PAD_L - PAD_R)) / (points.length - 1);
  const y = (t: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - (t - tMin) / span);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.t).toFixed(1)}`).join(" ");
  const area = points.length
    ? `${path} L ${x(points.length - 1).toFixed(1)} ${H - PAD_B} L ${x(0).toFixed(1)} ${H - PAD_B} Z`
    : "";
  const gridLines = 4;

  return (
    <section className="panel chart-panel">
      <div className="heading">
        <div>
          <p>温度记录图</p>
          <h2>采样环境温度曲线（随采样时间）</h2>
        </div>
        <div className="chips">
          <button className={stageFilter === "全部" ? "chip-on" : ""} onClick={() => setStageFilter("全部")}>
            全部阶段
          </button>
          {STAGES.map((st) => (
            <button key={st} className={stageFilter === st ? "chip-on" : ""} onClick={() => setStageFilter(st)}>
              {st}
            </button>
          ))}
        </div>
      </div>

      {points.length === 0 ? (
        <EmptyState text="暂无可绘制的温度记录（样本缺温度或被阶段筛选排除）" />
      ) : (
        <div className="chart-scroll">
          <svg viewBox={`0 0 ${W} ${H}`} className="temp-chart" role="img" aria-label="环境温度随采样时间变化曲线">
            {Array.from({ length: gridLines + 1 }).map((_, i) => {
              const val = tMin + (span * i) / gridLines;
              const yy = y(val);
              return (
                <g key={i}>
                  <line x1={PAD_L} x2={W - PAD_R} y1={yy} y2={yy} className="grid-line" />
                  <text x={PAD_L - 8} y={yy + 4} textAnchor="end" className="axis-label">
                    {val.toFixed(0)}℃
                  </text>
                </g>
              );
            })}

            <path d={area} className="temp-area" />
            <path d={path} className="temp-line" />

            {points.map((p, i) => (
              <g key={p.sample.id}>
                <circle cx={x(i)} cy={y(p.t)} r={6} fill={STAGE_COLORS[p.sample.stage]} stroke="#fff" strokeWidth={2}>
                  <title>
                    {p.sample.id} · {p.sample.stage} · {p.t}℃ · {p.at.replace("T", " ").slice(0, 16)}
                  </title>
                </circle>
                <text x={x(i)} y={y(p.t) - 12} textAnchor="middle" className="temp-label">
                  {p.t}℃
                </text>
                <text x={x(i)} y={H - PAD_B + 18} textAnchor="middle" className="axis-label">
                  {p.at.replace("T", " ").slice(5, 10)}
                </text>
                <text x={x(i)} y={H - PAD_B + 34} textAnchor="middle" className="axis-label">
                  {p.at.replace("T", " ").slice(11, 16)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}

      <div className="legend">
        {STAGES.map((st) => (
          <span key={st} className="legend-item">
            <i style={{ background: STAGE_COLORS[st] }} />
            {st}
          </span>
        ))}
      </div>
    </section>
  );
}
