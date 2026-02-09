import { TypeAxes } from "@/lib/deep-dive/types";

export type PersonPreset = {
  id: string;
  label: string;
  description: string;
  axes: TypeAxes;
};

export const PERSON_PRESETS: PersonPreset[] = [
  {
    id: "result-driver",
    label: "成果ドリブン",
    description: "結論と進捗を短く。判断材料は最小で十分。",
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
    id: "care-builder",
    label: "関係重視",
    description: "配慮と意図の共有を先に置くと通りやすい。",
    axes: {
      priority: "relationship",
      directness: "indirect",
      verbosity: "long",
      emphasis: "emotional",
      stance: "cooperative",
      decisionSpeed: "slow",
    },
  },
  {
    id: "detail-first",
    label: "正確性重視",
    description: "定義と前提をそろえてから提案する。",
    axes: {
      priority: "accuracy",
      directness: "direct",
      verbosity: "long",
      emphasis: "logical",
      stance: "defensive",
      decisionSpeed: "slow",
    },
  },
  {
    id: "speed-first",
    label: "スピード重視",
    description: "選択肢を絞って決めやすくする。",
    axes: {
      priority: "speed",
      directness: "direct",
      verbosity: "short",
      emphasis: "logical",
      stance: "cooperative",
      decisionSpeed: "fast",
    },
  },
];

export const DEFAULT_AXES: TypeAxes = PERSON_PRESETS[0].axes;
