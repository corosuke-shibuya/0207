import { TypeAxes } from "@/lib/deep-dive/types";

export type PersonPreset = {
  id: string;
  label: string;
  description: string;
  axes: TypeAxes;
};

export const PERSON_PRESETS: PersonPreset[] = [
  {
    id: "politics-driven",
    label: "評価・ポジション型（社内政治型）",
    description: "正しさより「見え方・味方・上の評価」を重視。",
    axes: {
      priority: "politics",
      directness: "indirect",
      verbosity: "long",
      emphasis: "emotional",
      stance: "defensive",
      decisionSpeed: "slow",
    },
  },
  {
    id: "logic-driven",
    label: "正しさ・論理型（ロジック型）",
    description: "感情より「筋が通るか／矛盾がないか」を重視。",
    axes: {
      priority: "logic",
      directness: "direct",
      verbosity: "long",
      emphasis: "logical",
      stance: "defensive",
      decisionSpeed: "slow",
    },
  },
  {
    id: "risk-averse",
    label: "リスク回避・炎上恐怖型（保守型）",
    description: "成果より「責任回避・前例・監査耐性」を重視。",
    axes: {
      priority: "risk",
      directness: "indirect",
      verbosity: "long",
      emphasis: "logical",
      stance: "defensive",
      decisionSpeed: "slow",
    },
  },
  {
    id: "outcome-focused",
    label: "成果・数字型（成果最重視型）",
    description: "納得より「インパクト・締切・KPI達成」を重視。",
    axes: {
      priority: "outcome",
      directness: "direct",
      verbosity: "short",
      emphasis: "logical",
      stance: "cooperative",
      decisionSpeed: "fast",
    },
  },
  {
    id: "speed-decision",
    label: "スピード・決断型（即断型）",
    description: "正確さより「早く決めて進める／後で直す」を重視。",
    axes: {
      priority: "speed",
      directness: "direct",
      verbosity: "short",
      emphasis: "logical",
      stance: "cooperative",
      decisionSpeed: "fast",
    },
  },
  {
    id: "harmony-consensus",
    label: "合意・調和型（関係性型）",
    description: "結論より「空気・衝突回避・全員合意」を重視。",
    axes: {
      priority: "harmony",
      directness: "indirect",
      verbosity: "long",
      emphasis: "emotional",
      stance: "cooperative",
      decisionSpeed: "slow",
    },
  },
];

export const DEFAULT_AXES: TypeAxes = PERSON_PRESETS[0].axes;
