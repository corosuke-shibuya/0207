import { getUserProfile, listPeople, listSessionSummaries } from "@/lib/deep-dive/store";
import { SparringClient } from "@/app/deep-dive/coach/sparring-client";

type Props = {
  searchParams: Promise<{ personId?: string; scenario?: string; mode?: string }>;
};

export default async function CoachPage({ searchParams }: Props) {
  const params = await searchParams;
  const [people, sessions, userProfile] = await Promise.all([listPeople(), listSessionSummaries(20), getUserProfile()]);
  const recentSessions = sessions.slice(0, 20).map((session) => {
    const person = people.find((row) => row.id === session.personId);
    return {
      id: session.id,
      kind: session.kind,
      personName: person?.name ?? "相手未設定",
      inputText: session.inputText,
      createdAt: session.createdAt,
    };
  });
  const initialMode = params.mode === "PRE_REFLECT" || params.mode === "FACILITATION" ? params.mode : "PRE_STRATEGY";

  return (
    <SparringClient
      people={people}
      recentSessions={recentSessions}
      hasUserProfile={Boolean(userProfile)}
      initialPersonId={params.personId ?? ""}
      initialScenario={params.scenario ?? ""}
      initialMode={initialMode}
    />
  );
}
