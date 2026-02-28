import { DEFAULT_AXES } from "@/lib/deep-dive/person-presets";
import {
  Artifact,
  ArtifactPayload,
  CoachingSession,
  Note,
  Person,
  SparringSummary,
  SessionKind,
  TypeAxes,
  UserProfile,
} from "@/lib/deep-dive/types";

const DEMO_USER_ID = "demo-user";

type StoreShape = {
  notes: Note[];
  people: Person[];
  sessions: CoachingSession[];
  artifacts: Artifact[];
  userProfile: UserProfile | null;
};

declare global {
  var __deepDiveStore: StoreShape | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function initialStore(): StoreShape {
  const seedPerson: Person = {
    id: generateId("person"),
    userId: DEMO_USER_ID,
    name: "山田さん",
    role: "PM",
    relationship: "同僚",
    typeAxes: DEFAULT_AXES,
    memo: "判断が速い。先に結論が欲しいタイプ。",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const seedNote: Note = {
    id: generateId("note"),
    userId: DEMO_USER_ID,
    body: "仕様相談で背景説明が長くなり、結論が後ろ倒しになった。",
    tags: ["会議", "伝え方"],
    createdAt: nowIso(),
  };

  return {
    notes: [seedNote],
    people: [seedPerson],
    sessions: [],
    artifacts: [],
    userProfile: null,
  };
}

function store(): StoreShape {
  if (!globalThis.__deepDiveStore) {
    globalThis.__deepDiveStore = initialStore();
  }
  return globalThis.__deepDiveStore;
}

export function memoryListNotes(limit = 40): Note[] {
  return store().notes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export function memoryCreateNote(body: string, tags: string[]): Note {
  const item: Note = {
    id: generateId("note"),
    userId: DEMO_USER_ID,
    body: body.trim(),
    tags,
    createdAt: nowIso(),
  };
  store().notes.unshift(item);
  return item;
}

export function memoryListPeople(): Person[] {
  return store().people.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function memoryGetPerson(personId: string): Person | undefined {
  return store().people.find((person) => person.id === personId);
}

export function memoryCreatePerson(input: {
  name: string;
  role?: string;
  relationship?: string;
  memo?: string;
  typeAxes?: TypeAxes;
}): Person {
  const item: Person = {
    id: generateId("person"),
    userId: DEMO_USER_ID,
    name: input.name.trim(),
    role: input.role?.trim() || undefined,
    relationship: input.relationship?.trim() || undefined,
    memo: input.memo?.trim() || undefined,
    typeAxes: input.typeAxes ?? DEFAULT_AXES,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  store().people.unshift(item);
  return item;
}

export function memoryCreateSession(input: {
  kind: SessionKind;
  personId: string;
  inputText: string;
  goal?: string;
  contextNoteIds: string[];
}): CoachingSession {
  const session: CoachingSession = {
    id: generateId("session"),
    userId: DEMO_USER_ID,
    personId: input.personId,
    kind: input.kind,
    inputText: input.inputText,
    goal: input.goal?.trim() || undefined,
    createdAt: nowIso(),
    contextNoteIds: input.contextNoteIds,
  };
  store().sessions.unshift(session);
  return session;
}

export function memoryAttachArtifact(sessionId: string, payload: ArtifactPayload, model: string): Artifact {
  const session = store().sessions.find((row) => row.id === sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const artifact: Artifact = {
    id: generateId("artifact"),
    sessionId,
    type: session.kind === "PRE" ? "STRATEGY_BUNDLE" : "POSTMORTEM_BUNDLE",
    payload,
    model,
    createdAt: nowIso(),
  };

  session.artifactId = artifact.id;
  store().artifacts.unshift(artifact);
  return artifact;
}

export function memoryListSessions(): CoachingSession[] {
  return store().sessions.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function memoryGetSessionDetail(sessionId: string) {
  const session = store().sessions.find((row) => row.id === sessionId);
  if (!session) {
    return null;
  }

  const artifact = session.artifactId
    ? store().artifacts.find((row) => row.id === session.artifactId)
    : undefined;

  const person = memoryGetPerson(session.personId);

  const contextNotes = store().notes.filter((note) => session.contextNoteIds.includes(note.id));

  return { session, artifact, person, contextNotes };
}

export function memoryExportAllData() {
  return {
    exportedAt: nowIso(),
    notes: store().notes,
    people: store().people,
    sessions: store().sessions,
    artifacts: store().artifacts,
    userProfile: store().userProfile,
  };
}

export function memoryDeleteAllData() {
  globalThis.__deepDiveStore = {
    notes: [],
    people: [],
    sessions: [],
    artifacts: [],
    userProfile: null,
  };
}

export function memoryGetUserProfile(): UserProfile | null {
  return store().userProfile;
}

export function memoryUpsertUserProfile(input: {
  name: string;
  memo?: string;
  typeAxes: TypeAxes;
}): UserProfile {
  const current = store().userProfile;
  const next: UserProfile = {
    id: current?.id ?? generateId("profile"),
    userId: DEMO_USER_ID,
    name: input.name.trim(),
    typeAxes: input.typeAxes,
    memo: input.memo?.trim() ?? "",
    createdAt: current?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
  store().userProfile = next;
  return next;
}

export function memoryAdoptDraftForSession(sessionId: string, tone: string, message: string) {
  const session = store().sessions.find((row) => row.id === sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const artifact = session.artifactId
    ? store().artifacts.find((row) => row.id === session.artifactId)
    : undefined;
  if (!artifact) {
    throw new Error("Artifact not found");
  }

  artifact.payload = {
    ...artifact.payload,
    adopted_draft: {
      tone,
      message,
      updatedAt: nowIso(),
    },
  };

  return artifact.payload;
}

export function memoryUpsertSparringSession(input: {
  sessionId?: string;
  personId?: string;
  goal?: string;
  scenario: string;
  mode: "PRE_REFLECT" | "PRE_STRATEGY" | "FACILITATION";
  contextNoteIds: string[];
  turns: { role: "user" | "assistant"; content: string }[];
  analysisSummary: string;
  recommendations: string[];
  userPattern: string;
  followUpQuestion: string;
  goalProgress: "low" | "mid" | "high";
  nextOptions: string[];
  riskNote: string;
}) {
  const existing = input.sessionId
    ? store().sessions.find((row) => row.id === input.sessionId)
    : undefined;

  if (!existing) {
    const resolvedPersonId = input.personId || "__none__";
    const session = memoryCreateSession({
      kind: "PRE",
      personId: resolvedPersonId,
      inputText: input.scenario,
      goal: input.goal,
      contextNoteIds: input.contextNoteIds,
    });

    const payload: ArtifactPayload = {
      sparring: {
        scenario: input.scenario,
        goal: input.goal,
        mode: input.mode,
        turns: input.turns.map((turn) => ({ ...turn, createdAt: nowIso() })),
        analysis_summary: input.analysisSummary,
        recommendations: input.recommendations,
        user_pattern: input.userPattern,
        follow_up_question: input.followUpQuestion,
        goal_progress: input.goalProgress,
        next_options: input.nextOptions,
        risk_note: input.riskNote,
      },
    };

    memoryAttachArtifact(session.id, payload, "sparring-local");
    return { sessionId: session.id };
  }

  const artifact = existing.artifactId
    ? store().artifacts.find((row) => row.id === existing.artifactId)
    : undefined;
  if (!artifact) {
    throw new Error("Artifact not found");
  }

  artifact.payload = {
    ...artifact.payload,
    sparring: {
      scenario: input.scenario,
      goal: input.goal,
      mode: input.mode,
      turns: input.turns.map((turn) => ({ ...turn, createdAt: nowIso() })),
      analysis_summary: input.analysisSummary,
      recommendations: input.recommendations,
      user_pattern: input.userPattern,
      follow_up_question: input.followUpQuestion,
      goal_progress: input.goalProgress,
      next_options: input.nextOptions,
      risk_note: input.riskNote,
    },
  };

  return { sessionId: existing.id };
}

export function memorySetSparringSummary(sessionId: string, summary: SparringSummary) {
  const session = store().sessions.find((row) => row.id === sessionId);
  if (!session) {
    throw new Error("Session not found");
  }
  const artifact = session.artifactId
    ? store().artifacts.find((row) => row.id === session.artifactId)
    : undefined;
  if (!artifact) {
    throw new Error("Artifact not found");
  }
  const sparring = artifact.payload.sparring;
  if (!sparring) {
    throw new Error("Sparring data not found");
  }

  artifact.payload = {
    ...artifact.payload,
    sparring: {
      ...sparring,
      summary: {
        ...summary,
        generatedAt: nowIso(),
      },
    },
  };

  return artifact.payload.sparring?.summary;
}

export function memoryListRecentSparringSnapshots(personId: string, limit = 3) {
  return store()
    .sessions
    .filter((session) => session.personId === personId)
    .map((session) => {
      const artifact = session.artifactId
        ? store().artifacts.find((row) => row.id === session.artifactId)
        : undefined;
      const sparring = artifact?.payload.sparring;
      if (!sparring || sparring.turns.length === 0) {
        return null;
      }
      const lastUser = [...sparring.turns].reverse().find((turn) => turn.role === "user")?.content ?? "";
      const lastAssistant = [...sparring.turns].reverse().find((turn) => turn.role === "assistant")?.content ?? "";
      return {
        sessionId: session.id,
        createdAt: session.createdAt,
        goal: sparring.goal,
        scenario: sparring.scenario,
        lastUser,
        lastAssistant,
        riskNote: sparring.risk_note,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
