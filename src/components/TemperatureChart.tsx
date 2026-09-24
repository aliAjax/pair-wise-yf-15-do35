import { useMemo, useState } from "react";
import type { Sample } from "../types";
import { CASE_COLORS } from "../lib/constants";
import { formatTime } from "../lib/domain";

interface TemperatureChartProps {
  samples: Sample[];
}

const W = 880;
const H = 300;
const PAD_L = 52;
const PAD_R = 18;
const PAD_T = 24;
const PAD_B = 64;

export function TemperatureChart({ samples }: TemperatureChartProps) {
  const caseIds = useMemo(
    () => Array.from(new Set(samples.map((s) => s.caseId))).sort(),
    [samples]
  );
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const isOn = (id: string) => enabled[id] ?? true;
  const toggleCase = (id: string) =>
    setEnabled((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));

  const series = useMemo(
    () =>
      caseIds
        .filter((id) => isOn(id))
        .map((id) => ({
          caseId: id,
          points: samples
            .filter((s) => s.caseId === id && s.temperature !== null)
            .sort((a, b) => a.sampledAt.localeCompare(b.sampledAt)),
        }))
        .filter((s) => s.points.length > 0),
    [caseIds, samples, enabled]
  );

  const { xOf, yOf, minT, maxT, allTimes, ticks } = useMemo(() => {
    const allPts = series.flatMap((s) => s.points);
    const temps = allPts.map((s) => s.temperature as number);
    const minData = temps.length ? Math.min(...temps) : 0;
    const maxData = temps.length ? Math.max(...temps) : 40;
    const pad = temps.length ? Math.max(1.5, (maxData - minData) * 0.2) : 5;
    const minT = Math.floor(minData - pad);
    const maxT = Math.ceil(maxData + pad);
    const allTimes = Array.from(new Set(allPts.map((s) => s.sampledAt))).sort();
    const xOf = (t: string) => {
      if (allTimes.length === 1) return PAD_L + (W - PAD_L - PAD_R) / 2;
      const idx = allTimes.indexOf(t);
      return (
        PAD_L +
        (idx * (W - PAD_L - PAD_R)) / (allTimes.length - 1 || 1)
      );
    };
    const yOf = (t: number) =>
      PAD_T +
      ((maxT - t) * (H - PAD_T - PAD_B)) / (maxT - minT || 1);
    const tickCount = 5;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
      Math.round((minT + ((maxT - minT) * i) / tickCount) * 10) / 10
    );
    return { xOf, yOf, minT, maxT, allTimes, ticks };
  }, [series]);

  const colorOf = (id: string) =>
    CASE_COLORS[caseIds.indexOf(id) % CASE_COLORS.length];

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>环境温度记录图</p>
          <h2>温度曲线（按采样时间）</h2>
        </div>
        <div className="legend">
          {caseIds.map((id) => (
            <button
              key={id}
              className={isOn(id) ? "legend-item" : "legend-item legend-off"}
              onClick={() => toggleCase(id)}
            >
              <i style={{ background: colorOf(id) }} />
              {id}
            </button>
          ))}
        </div>
      </div>

      {series.length === 0 || allTimes.length === 0 ? (
        <p className="empty-hint">
          暂无可绘制的温度记录（请在样本详情或待补序列中补齐环境温度）。
        </p>
      ) : (
        <div className="chart-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={yOf(t)}
                  y2={yOf(t)}
                  className="grid-line"
                />
                <text x={PAD_L - 8} y={yOf(t) + 4} textAnchor="end" className="axis-text">
                  {t}℃
                </text>
              </g>
            ))}

            {allTimes.map((t, i) => (
              <text
                key={t}
                x={xOf(t)}
                y={H - PAD_B + 18}
                textAnchor={allTimes.length > 6 ? "end" : "middle"}
                transform={
                  allTimes.length > 6
                    ? `rotate(-38 ${xOf(t)} ${H - PAD_B + 18})`
                    : undefined
                }
                className="axis-text axis-time"
              >
                {formatTime(t).slice(5)}
              </text>
            ))}

            {series.map((s) => {
              const color = colorOf(s.caseId);
              const d = s.points
                .map(
                  (p, i) =>
                    `${i === 0 ? "M" : "L"} ${xOf(p.sampledAt)} ${yOf(
                      p.temperature as number
                    )}`
                )
                .join(" ");
              return (
                <g key={s.caseId}>
                  <path d={d} fill="none" stroke={color} strokeWidth={2.4} />
                  {s.points.map((p) => (
                    <g key={p.id}>
                      <circle
                        cx={xOf(p.sampledAt)}
                        cy={yOf(p.temperature as number)}
                        r={4}
                        fill="#fff"
                        stroke={color}
                        strokeWidth={2}
                      >
                        <title>
                          {p.id}（{p.caseId}） · {formatTime(p.sampledAt)} ·{" "}
                          {p.temperature}℃
                        </title>
                      </circle>
                    </g>
                  ))}
                </g>
              );
            })}
          </svg>
          <p className="chart-note muted">
            纵轴 {minT}–{maxT}℃；点击右上角图例可显示/隐藏案件曲线；鼠标悬停数据点查看样本编号。
          </p>
        </div>
      )}
    </section>
  );
}
