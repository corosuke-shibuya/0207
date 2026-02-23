import { prisma } from "@/lib/prisma";
import { getServerSessionSafe, isGoogleAuthEnabled } from "@/lib/auth";
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
} from "@/lib/deep-dive/types";
import {
  memoryAttachArtifact,
  memoryAdoptDraftForSession,
  memoryCreateNote,
  memoryCreatePerson,
  memoryCreateSession,
  memoryDeleteAllData,
  memoryExportAllData,
  memoryGetPerson,
  memoryGetSessionDetail,
  memoryListNotes,
  memoryListPeople,
  memoryListSessions,
  memorySetSparringSummary,
  memoryListRecentSparringSnapshots,
  memoryUpsertSparringSession,
} from "@/lib/deep-dive/memory-store";

const DEMO_EMAIL = "deepdive-demo@example.com";
const AUTH_REQUIRED_ERROR = "AUTH_REQUIRED";

function hasPrismaConnection() {
  return Boolean(process.env.DATABASE_URL);
}

function toIso(value: Date) {
  return value.toISOString();
}

async function ensureUserIdByEmail(email?: string | null, name?: string | null) {
  const normalizedEmail = email?.toLowerCase().trim() || DEMO_EMAIL;
  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: { name: name || undefined },
    create: { email: normalizedEmail, name: name || "Deep Dive Demo" },
    select: { id: true },
  });
  return user.id;
}

async function getCurrentUserId() {
  const session = await getServerSessionSafe();
  if (isGoogleAuthEnabled() && !session?.user?.email) {
    throw new Error(AUTH_REQUIRED_ERROR);
  }
  return ensureUserIdByEmail(session?.user?.email, session?.user?.name);
}

async function withPersistence<T>(prismaWork: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  if (!hasPrismaConnection()) {
    return fallback();
  }

  try {
    return await prismaWork();
  } catch (error) {
    if (error instanceof Error && error.message === AUTH_REQUIRED_ERROR) {
      throw error;
    }
    return fallback();
  }
}

export async function listNotes(limit = 40): Promise<Note[]> {
  return withPersistence(async () => {
    const userId = await getCurrentUserId();

    const rows = await prisma.note.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      body: row.body,
      tags: row.tags,
      createdAt: toIso(row.createdAt),
    }));
  }, () => memoryListNotes(limit));
}

export async function createNote(body: string, tags: string[]): Promise<Note> {
  return withPersistence(async () => {
    const userId = await getCurrentUserId();
    const row = await prisma.note.create({
      data: {
        userId,
        body: body.trim(),
        tags,
      },
    });

    return {
      id: row.id,
      userId: row.userId,
      body: row.body,
      tags: row.tags,
      createdAt: toIso(row.createdAt),
    };
  }, () => memoryCreateNote(body, tags));
}

export async function listPeople(): Promise<Person[]> {
  return withPersistence(async () => {
    const userId = await getCurrentUserId();

    const rows = await prisma.person.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      role: row.role ?? undefined,
      relationship: row.relationship ?? undefined,
      memo: row.memo ?? undefined,
      typeAxes: row.typeAxes as TypeAxes,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    }));
  }, () => memoryListPeople());
}

export async function getPerson(personId: string): Promise<Person | undefined> {
  return withPersistence(async () => {
    const userId = await getCurrentUserId();
    const row = await prisma.person.findFirst({
      where: { id: personId, userId },
    });
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      role: row.role ?? undefined,
      relationship: row.relationship ?? undefined,
      memo: row.memo ?? undefined,
      typeAxes: row.typeAxes as TypeAxes,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }, () => memoryGetPerson(personId));
}

export async function createPerson(input: {
  name: string;
  role?: string;
  relationship?: string;
  memo?: string;
  typeAxes?: TypeAxes;
}): Promise<Person> {
  return withPersistence(async () => {
    const userId = await getCurrentUserId();
    const row = await prisma.person.create({
      data: {
        userId,
        name: input.name.trim(),
        role: input.role?.trim() || null,
        relationship: input.relationship?.trim() || null,
        memo: input.memo?.trim() || null,
        typeAxes: input.typeAxes ?? DEFAULT_AXES,
      },
    });

    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      role: row.role ?? undefined,
      relationship: row.relationship ?? undefined,
      memo: row.memo ?? undefined,
      typeAxes: row.typeAxes as TypeAxes,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }, () => memoryCreatePerson(input));
}

export async function createSession(input: {
  kind: SessionKind;
  personId: string;
  inputText: string;
  goal?: string;
  contextNoteIds: string[];
}): Promise<CoachingSession> {
  return withPersistence(async () => {
    const userId = await getCurrentUserId();
    const person = await prisma.person.findFirst({
      where: { id: input.personId, userId },
      select: { id: true },
    });
    if (!person) {
      throw new Error("Person not found");
    }
    const row = await prisma.coachingSession.create({
      data: {
        userId,
        personId: input.personId,
        kind: input.kind,
        goal: input.goal?.trim() || null,
        inputText: input.inputText,
        status: "COMPLETED",
        contextNotes: {
          create: input.contextNoteIds.map((noteId) => ({ noteId })),
        },
      },
      include: { contextNotes: true },
    });

    const createdSession: CoachingSession = {
      id: row.id,
      userId: row.userId,
      personId: row.personId,
      kind: row.kind,
      goal: row.goal ?? undefined,
      inputText: row.inputText,
      createdAt: toIso(row.createdAt),
      contextNoteIds: row.contextNotes.map((ctx) => ctx.noteId),
    };
    return createdSession;
  }, () => memoryCreateSession(input));
}

export async function attachArtifact(sessionId: string, payload: ArtifactPayload, model: string): Promise<Artifact> {
  return withPersistence(async () => {
    const userId = await getCurrentUserId();
    const session = await prisma.coachingSession.findUnique({
      where: { id: sessionId },
      select: { kind: true, userId: true },
    });

    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    const row = await prisma.artifact.create({
      data: {
        sessionId,
        type: session.kind === "PRE" ? "STRATEGY_BUNDLE" : "POSTMORTEM_BUNDLE",
        payload,
        model,
      },
    });

    return {
      id: row.id,
      sessionId: row.sessionId,
      type: row.type,
      payload: row.payload as ArtifactPayload,
      model: row.model,
      estimatedCost: row.estimatedCost ?? undefined,
      createdAt: toIso(row.createdAt),
    };
  }, () => memoryAttachArtifact(sessionId, payload, model));
}

export async function listSessions(): Promise<CoachingSession[]> {
  return withPersistence(async () => {
    const userId = await getCurrentUserId();

    const rows = await prisma.coachingSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        contextNotes: true,
        artifacts: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      personId: row.personId,
      kind: row.kind,
      goal: row.goal ?? undefined,
      inputText: row.inputText,
      createdAt: toIso(row.createdAt),
      artifactId: row.artifacts[0]?.id,
      contextNoteIds: row.contextNotes.map((ctx) => ctx.noteId),
    }));
  }, () => memoryListSessions());
}

export async function getSessionDetail(sessionId: string) {
  return withPersistence(async () => {
    const userId = await getCurrentUserId();
    const session = await prisma.coachingSession.findUnique({
      where: { id: sessionId },
      include: {
        person: true,
        contextNotes: { include: { note: true } },
        artifacts: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!session || session.userId !== userId) {
      return null;
    }

    const mappedSession: CoachingSession = {
      id: session.id,
      userId: session.userId,
      personId: session.personId,
      kind: session.kind,
      goal: session.goal ?? undefined,
      inputText: session.inputText,
      createdAt: toIso(session.createdAt),
      artifactId: session.artifacts[0]?.id,
      contextNoteIds: session.contextNotes.map((ctx) => ctx.noteId),
    };

    const person: Person = {
      id: session.person.id,
      userId: session.person.userId,
      name: session.person.name,
      role: session.person.role ?? undefined,
      relationship: session.person.relationship ?? undefined,
      typeAxes: session.person.typeAxes as TypeAxes,
      memo: session.person.memo ?? undefined,
      createdAt: toIso(session.person.createdAt),
      updatedAt: toIso(session.person.updatedAt),
    };

    const artifact = session.artifacts[0]
      ? {
          id: session.artifacts[0].id,
          sessionId: session.artifacts[0].sessionId,
          type: session.artifacts[0].type,
          payload: session.artifacts[0].payload as ArtifactPayload,
          model: session.artifacts[0].model,
          estimatedCost: session.artifacts[0].estimatedCost ?? undefined,
          createdAt: toIso(session.artifacts[0].createdAt),
        }
      : undefined;

    const contextNotes: Note[] = session.contextNotes.map((ctx) => ({
      id: ctx.note.id,
      userId: ctx.note.userId,
      body: ctx.note.body,
      tags: ctx.note.tags,
      createdAt: toIso(ctx.note.createdAt),
    }));

    return { session: mappedSession, artifact, person, contextNotes };
  }, () => memoryGetSessionDetail(sessionId));
}

export async function exportAllData(): Promise<{
  exportedAt: string;
  notes: Note[];
  people: Person[];
  sessions: CoachingSession[];
  artifacts: Artifact[];
}> {
  return withPersistence(async () => {
    const userId = await getCurrentUserId();
    const [notes, people, sessions, artifacts] = await Promise.all([
      listNotes(500),
      listPeople(),
      listSessions(),
      prisma.artifact.findMany({
        where: {
          session: {
            userId,
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const exportedArtifacts: Artifact[] = artifacts.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      type: row.type,
      payload: row.payload as ArtifactPayload,
      model: row.model,
      estimatedCost: row.estimatedCost ?? undefined,
      createdAt: toIso(row.createdAt),
    }));

    return {
      exportedAt: new Date().toISOString(),
      notes,
      people,
      sessions,
      artifacts: exportedArtifacts,
    };
  }, () => memoryExportAllData());
}

export async function deleteAllData() {
  return withPersistence(async () => {
    const userId = await getCurrentUserId();

    await prisma.$transaction([
      prisma.artifact.deleteMany({ where: { session: { userId } } }),
      prisma.sessionContextNote.deleteMany({ where: { session: { userId } } }),
      prisma.coachingSession.deleteMany({ where: { userId } }),
      prisma.note.deleteMany({ where: { userId } }),
      prisma.person.deleteMany({ where: { userId } }),
    ]);
  }, () => memoryDeleteAllData());
}

export async function adoptDraftForSession(sessionId: string, tone: string, message: string) {
  return withPersistence(async () => {
    const userId = await getCurrentUserId();
    const session = await prisma.coachingSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    const artifact = await prisma.artifact.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
    });
    if (!artifact) {
      throw new Error("Artifact not found");
    }

    const nextPayload: ArtifactPayload = {
      ...(artifact.payload as ArtifactPayload),
      adopted_draft: {
        tone,
        message,
        updatedAt: new Date().toISOString(),
      },
    };

    await prisma.artifact.update({
      where: { id: artifact.id },
      data: { payload: nextPayload },
    });

    return nextPayload;
  }, () => memoryAdoptDraftForSession(sessionId, tone, message));
}

export async function upsertSparringSession(input: {
  sessionId?: string;
  personId?: string;
  goal?: string;
  scenario: string;
  mode: "PRE_REFLECT" | "PRE_STRATEGY" | "FACILITATION";
  contextNoteIds: string[];
  turns: { role: "user" | "assistant"; content: string }[];
  analysisSummary: string;
  recommendations: string[];
  followUpQuestion: string;
  goalProgress: "low" | "mid" | "high";
  nextOptions: string[];
  riskNote: string;
}) {
  return withPersistence(async () => {
    const userId = await getCurrentUserId();
    let resolvedPersonId = input.personId;
    if (resolvedPersonId) {
      const person = await prisma.person.findFirst({
        where: { id: resolvedPersonId, userId },
        select: { id: true },
      });
      if (!person) {
        resolvedPersonId = undefined;
      }
    }
    if (!resolvedPersonId) {
      const fallbackPerson = await prisma.person.findFirst({
        where: { userId, name: "なし（未登録）", role: "未設定" },
        select: { id: true },
      });
      if (fallbackPerson) {
        resolvedPersonId = fallbackPerson.id;
      } else {
        const createdFallback = await prisma.person.create({
          data: {
            userId,
            name: "なし（未登録）",
            role: "未設定",
            relationship: "未設定",
            typeAxes: {
              priority: "logic",
              directness: "direct",
              verbosity: "short",
              emphasis: "logical",
              stance: "cooperative",
              decisionSpeed: "fast",
            },
            memo: "相談対象を未選択で実行したセッションの保存先",
          },
          select: { id: true },
        });
        resolvedPersonId = createdFallback.id;
      }
    }
    if (!resolvedPersonId) {
      throw new Error("Person not resolved");
    }

    let sessionId = input.sessionId;
    if (!sessionId) {
      const created = await prisma.coachingSession.create({
        data: {
          userId,
          personId: resolvedPersonId,
          kind: "PRE",
          goal: input.goal?.trim() || null,
          inputText: input.scenario,
          status: "COMPLETED",
          contextNotes: {
            create: input.contextNoteIds.map((noteId) => ({ noteId })),
          },
        },
      });
      sessionId = created.id;

      await prisma.artifact.create({
        data: {
          sessionId,
          type: "STRATEGY_BUNDLE",
          model: "sparring-session",
          payload: {
            sparring: {
              scenario: input.scenario,
              goal: input.goal,
              mode: input.mode,
              turns: input.turns.map((turn) => ({
                ...turn,
                createdAt: new Date().toISOString(),
              })),
              analysis_summary: input.analysisSummary,
              recommendations: input.recommendations,
              follow_up_question: input.followUpQuestion,
              goal_progress: input.goalProgress,
              next_options: input.nextOptions,
              risk_note: input.riskNote,
            },
          },
        },
      });

      return { sessionId };
    }

    const session = await prisma.coachingSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) {
      throw new Error("Session not found");
    }

    const artifact = await prisma.artifact.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
    });
    if (!artifact) {
      throw new Error("Artifact not found");
    }

    await prisma.artifact.update({
      where: { id: artifact.id },
      data: {
        payload: {
          ...(artifact.payload as ArtifactPayload),
          sparring: {
            scenario: input.scenario,
            goal: input.goal,
            mode: input.mode,
            turns: input.turns.map((turn) => ({
              ...turn,
              createdAt: new Date().toISOString(),
            })),
            analysis_summary: input.analysisSummary,
            recommendations: input.recommendations,
            follow_up_question: input.followUpQuestion,
            goal_progress: input.goalProgress,
            next_options: input.nextOptions,
            risk_note: input.riskNote,
          },
        },
      },
    });

    return { sessionId };
  }, () => memoryUpsertSparringSession(input));
}

export async function setSparringSummary(sessionId: string, summary: SparringSummary) {
  return withPersistence(async () => {
    const userId = await getCurrentUserId();
    const session = await prisma.coachingSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) {
      throw new Error("Session not found");
    }

    const artifact = await prisma.artifact.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
    });
    if (!artifact) {
      throw new Error("Artifact not found");
    }

    const payload = artifact.payload as ArtifactPayload;
    if (!payload.sparring) {
      throw new Error("Sparring data not found");
    }

    const nextPayload: ArtifactPayload = {
      ...payload,
      sparring: {
        ...payload.sparring,
        summary: {
          ...summary,
          generatedAt: new Date().toISOString(),
        },
      },
    };

    await prisma.artifact.update({
      where: { id: artifact.id },
      data: { payload: nextPayload },
    });

    return nextPayload.sparring?.summary;
  }, () => memorySetSparringSummary(sessionId, summary));
}

export type RecentSparringSnapshot = {
  sessionId: string;
  createdAt: string;
  goal?: string;
  scenario: string;
  lastUser: string;
  lastAssistant: string;
  riskNote?: string;
};

export async function listRecentSparringSnapshots(personId: string, limit = 3): Promise<RecentSparringSnapshot[]> {
  return withPersistence(async () => {
    const userId = await getCurrentUserId();
    const sessions = await prisma.coachingSession.findMany({
      where: { userId, personId },
      orderBy: { createdAt: "desc" },
      take: Math.max(limit * 2, limit),
      include: {
        artifacts: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { payload: true },
        },
      },
    });

    const snapshots: RecentSparringSnapshot[] = [];
    for (const session of sessions) {
      const payload = session.artifacts[0]?.payload as ArtifactPayload | undefined;
      const sparring = payload?.sparring;
      if (!sparring || sparring.turns.length === 0) {
        continue;
      }
      const lastUser = [...sparring.turns].reverse().find((turn) => turn.role === "user")?.content ?? "";
      const lastAssistant = [...sparring.turns].reverse().find((turn) => turn.role === "assistant")?.content ?? "";
      snapshots.push({
        sessionId: session.id,
        createdAt: toIso(session.createdAt),
        goal: sparring.goal,
        scenario: sparring.scenario,
        lastUser,
        lastAssistant,
        riskNote: sparring.risk_note,
      });
      if (snapshots.length >= limit) {
        break;
      }
    }

    return snapshots;
  }, () => memoryListRecentSparringSnapshots(personId, limit));
}
