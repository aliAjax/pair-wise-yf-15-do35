import { useMemo, useState } from "react";
import "./styles.css";
import { useStore } from "./store";
import SamplesView from "./components/SamplesView";
import SequencesView from "./components/SequencesView";
import CasesView from "./components/CasesView";

type Tab = "samples" | "sequences" | "cases";

const TABS: { key: Tab; label: string }[] = [
  { key: "samples", label: "样本批次" },
  { key: "sequences", label: "虫龄序列编排" },
  { key: "cases", label: "案件关联" },
];

function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>("sequences");

  const metrics = useMemo(() => {
    const { samples, sequences } = store.state;
    const pendingSamples = samples.filter((s) => s.temperature === null || !s.location.trim() || !s.preservation.trim()).length;
    const temps = samples.map((s) => s.temperature).filter((t): t is number => t !== null);
    const avg = temps.length ? `${(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)}℃` : "—";
    const pendingSeq = sequences.filter((q) => q.status === "pending" || q.status === "returned").length;
    return [
      { label: "样本总数", value: String(samples.length) },
      { label: "平均温度", value: avg },
      { label: "虫龄序列", value: String(sequences.length) },
      { label: "待补/退回", value: String(pendingSeq + pendingSamples) },
    ];
  }, [store.state]);

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62003 · 源提示词5 · Port 62003</p>
        <h1>法医昆虫学样本记录</h1>
        <span>
          虫龄序列编排：鉴定人挑出同案至少两枚样本，按采样时间排列；虫种不同或时间相同即拒绝并说明原因。虫种一致时补齐地点、温度、保存方式后送入复核，
          缺一项存为待补，原样本不删除。复核按 卵→幼虫→蛹→成虫 前进，出现倒退即退回并保留上次结果。
          全部数据保存在本地浏览器，重开页面可接着处理。
        </span>
      </section>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "tab-on" : ""} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
        <button className="reset-btn" onClick={() => {
          if (window.confirm("重置为演示数据？当前本地记录将被覆盖。")) store.resetAll();
        }}>
          重置本地数据
        </button>
      </nav>

      {tab === "samples" && <SamplesView store={store} />}
      {tab === "sequences" && <SequencesView store={store} />}
      {tab === "cases" && <CasesView store={store} />}

      <footer className="foot">
        数据存储于 localStorage（key: forensic-entomology-records-v1），刷新或重开页面后继续处理。
      </footer>
    </main>
  );
}

export default App;
