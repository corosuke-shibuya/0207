export type SessionKind = "PRE" | "POST";

export type TypeAxes = {
  priority: "politics" | "logic" | "risk" | "outcome" | "speed" | "harmony";
  directness: "direct" | "indirect";
  verbosity: "short" | "long";
  emphasis: "emotional" | "logical";
  stance: "defensive" | "cooperative";
  decisionSpeed: "fast" | "slow";
};

export type Note = {
  id: string;
  userId: string;
  body: string;
  tags: string[];
  createdAt: string;
};

export type Person = {
  id: string;
  userId: string;
  name: string;
  role?: string;
  relationship?: string;
  typeAxes: TypeAxes;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type Strategy = {
  goal: string;
  principles: string[];
  do: string[];
  dont: string[];
  structure: string[];
};

export type Draft = {
  tone: string;
  message: string;
  why_it_works: string;
  risks: string;
};

export type ExpectedReaction = {
  reaction: string;
  how_to_respond: string;
};

export type Postmortem = {
  what_happened: string;
  hypotheses: string[];
  next_time_plan: string[];
  micro_skill: string[];
};

export type SparringTurn = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type SparringSummary = {
  learned_points: string[];
  next_actions: string[];
  risk_watch: string[];
  generatedAt?: string;
};

export type SparringMode = "PRE_REFLECT" | "PRE_STRATEGY" | "FACILITATION";

export type SparringState = {
  scenario: string;
  goal?: string;
  mode?: SparringMode;
  turns: SparringTurn[];
  analysis_summary?: string;
  recommendations?: string[];
  follow_up_question?: string;
  goal_progress?: "low" | "mid" | "high";
  next_options?: string[];
  risk_note?: string;
  summary?: SparringSummary;
};

export type AdoptedDraft = {
  tone: string;
  message: string;
  updatedAt: string;
};

export type ArtifactPayload = {
  strategy?: Strategy;
  drafts?: Draft[];
  expected_reactions?: ExpectedReaction[];
  postmortem?: Postmortem;
  assumptions?: string[];
  adopted_draft?: AdoptedDraft;
  sparring?: SparringState;
};

export type Artifact = {
  id: string;
  sessionId: string;
  type: "STRATEGY_BUNDLE" | "POSTMORTEM_BUNDLE";
  payload: ArtifactPayload;
  model: string;
  estimatedCost?: number;
  createdAt: string;
};

export type CoachingSession = {
  id: string;
  userId: string;
  personId: string;
  kind: SessionKind;
  goal?: string;
  inputText: string;
  createdAt: string;
  artifactId?: string;
  contextNoteIds: string[];
};

export type CoachRequest = {
  kind: SessionKind;
  personId: string;
  inputText: string;
  goal?: string;
  contextNoteIds?: string[];
};
