import { getUserProfile, listPeople, listSessions } from "@/lib/deep-dive/store";
import { SparringClient } from "@/app/deep-dive/coach/sparring-client";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const [people, sessions, userProfile] = await Promise.all([listPeople(), listSessions(), getUserProfile()]);
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

  return <SparringClient people={people} recentSessions={recentSessions} hasUserProfile={Boolean(userProfile)} />;
}
