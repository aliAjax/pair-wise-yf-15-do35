import { AppState, Sample } from "./types";
import { sortBySampledAt } from "./domain";

function s(
  id: string,
  caseId: string,
  location: string,
  temperature: number | null,
  exposureStage: string,
  species: string,
  stage: Sample["stage"],
  sampledAt: string,
  preservation: string,
  note: string
): Sample {
  return { id, caseId, location, temperature, exposureStage, species, stage, sampledAt, preservation, note };
}

/** 预置样本：覆盖齐全 / 缺项 / 不同虫种 / 相同时间 / 阶段倒退等场景 */
export const SEED_SAMPLES: Sample[] = [
  // CASE-042 大头金蝇的完整发育链
  s("SP-001", "CASE-042", "室外草地", 28.6, "新鲜期", "大头金蝇", "卵", "2026-09-12T08:30", "75%乙醇保存", "草丛根部卵块"),
  s("SP-002", "CASE-042", "室外草地", 29.1, "肿胀期", "大头金蝇", "幼虫", "2026-09-13T09:00", "75%乙醇保存", "一龄幼虫"),
  s("SP-003", "CASE-042", "阴影区域", 27.4, "肿胀期", "大头金蝇", "幼虫", "2026-09-14T10:20", "75%乙醇保存", "三龄幼虫"),
  s("SP-004", "CASE-042", "阴影区域", 26.8, "腐烂期", "大头金蝇", "蛹", "2026-09-16T15:40", "干燥冷藏", "蛹壳完整"),
  s("SP-005", "CASE-042", "室外草地", 25.9, "残骸期", "大头金蝇", "成虫", "2026-09-19T11:10", "针插标本", "羽化成虫"),
  // CASE-042 缺项样本（缺温度与保存方式）
  s("SP-006", "CASE-042", "水沟边缘", null, "肿胀期", "大头金蝇", "幼虫", "2026-09-14T18:00", "", "待补环境温度与保存方式"),
  // CASE-042 不同虫种 —— 与大头金蝇样本同选应被拒绝
  s("SP-007", "CASE-042", "室外草地", 28.2, "肿胀期", "丝光绿蝇", "幼虫", "2026-09-13T16:00", "75%乙醇保存", "种属待复核"),
  // CASE-042 时间相同 —— 与 SP-003 同选应被拒绝
  s("SP-008", "CASE-042", "阴影区域", 27.4, "肿胀期", "大头金蝇", "幼虫", "2026-09-14T10:20", "75%乙醇保存", "与 SP-003 同时采样"),
  // CASE-051 家蚕？不，尸食性——用 家蝇 场景
  s("SP-009", "CASE-051", "室内地板", 22.5, "新鲜期", "家蝇", "卵", "2026-09-10T14:00", "75%乙醇保存", "室内现场卵"),
  s("SP-010", "CASE-051", "室内地板", 23.0, "肿胀期", "家蝇", "幼虫", "2026-09-12T09:30", "75%乙醇保存", "二龄"),
  s("SP-011", "CASE-051", "窗台附近", 21.8, "腐烂期", "家蝇", "蛹", "2026-09-15T13:00", "干燥冷藏", ""),
  s("SP-012", "CASE-051", "窗台附近", 20.9, "残骸期", "家蝇", "成虫", "2026-09-18T10:00", "针插标本", "已拍照存档"),
  // CASE-051 阶段倒退样本：成虫 → 幼虫，复核应退回
  s("SP-013", "CASE-051", "室内地板", 22.1, "残骸期", "家蝇", "幼虫", "2026-09-19T09:00", "75%乙醇保存", "现场补采，阶段存疑"),
];

const now = new Date();
function iso(daysAgo: number, hhmm: string): string {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  // 与种子样本的本地无时区格式保持一致
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}`;
}

export function buildSeedState(): AppState {
  const idsA = ["SP-001", "SP-002", "SP-003", "SP-004", "SP-005"];
  const membersA = sortBySampledAt(idsA.map((id) => SEED_SAMPLES.find((x) => x.id === id)!));
  const snapshotA: Record<string, Sample["stage"]> = {};
  membersA.forEach((m) => {
    snapshotA[m.id] = m.stage;
  });

  const idsB = ["SP-009", "SP-010", "SP-011", "SP-013"];
  const membersB = sortBySampledAt(idsB.map((id) => SEED_SAMPLES.find((x) => x.id === id)!));
  const snapshotB: Record<string, Sample["stage"]> = {};
  membersB.forEach((m) => {
    snapshotB[m.id] = m.stage;
  });

  return {
    samples: SEED_SAMPLES,
    seqCounter: 2,
    sampleCounter: 13,
    rejections: [
      {
        id: "REJ-001",
        caseId: "CASE-042",
        sampleIds: ["SP-003", "SP-007"],
        reason: "虫种不同，拒绝编排：大头金蝇 / 丝光绿蝇",
        at: iso(2, "09:15"),
      },
    ],
    sequences: [
      {
        id: "SEQ-001",
        caseId: "CASE-042",
        species: "大头金蝇",
        sampleIds: membersA.map((m) => m.id),
        status: "approved",
        reason: "复核通过：发育阶段沿 卵→幼虫→蛹→成虫 正常前进",
        missing: [],
        createdAt: iso(3, "10:00"),
        updatedAt: iso(1, "16:20"),
        lastReview: { at: iso(1, "16:20"), action: "approve", detail: "阶段无倒退，复核通过", snapshot: snapshotA },
        history: [
          { at: iso(3, "10:00"), action: "submit", detail: "资料齐全，送入复核", snapshot: snapshotA },
          { at: iso(1, "16:20"), action: "approve", detail: "阶段无倒退，复核通过", snapshot: snapshotA },
        ],
      },
      {
        id: "SEQ-002",
        caseId: "CASE-051",
        species: "家蝇",
        sampleIds: membersB.map((m) => m.id),
        status: "returned",
        reason: "发育阶段倒退：SP-012（成虫）→ SP-013（幼虫），已退回并保留上次复核结果",
        missing: [],
        createdAt: iso(2, "11:30"),
        updatedAt: iso(1, "15:00"),
        lastReview: {
          at: iso(1, "15:00"),
          action: "return",
          detail: "发育阶段倒退：SP-012（成虫，2026-09-18 10:00）→ SP-013（幼虫，2026-09-19 09:00）",
          snapshot: snapshotB,
        },
        history: [
          { at: iso(2, "11:30"), action: "submit", detail: "资料齐全，送入复核", snapshot: snapshotB },
          {
            at: iso(1, "15:00"),
            action: "return",
            detail: "发育阶段倒退：SP-012（成虫，2026-09-18 10:00）→ SP-013（幼虫，2026-09-19 09:00）",
            snapshot: snapshotB,
          },
        ],
      },
    ],
  };
}
