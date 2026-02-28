"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pickContextNoteIds } from "@/lib/deep-dive/context";
import { generateCoachingBundle } from "@/lib/deep-dive/coach";
import { PERSON_PRESETS } from "@/lib/deep-dive/person-presets";
import {
  attachArtifact,
  createNote,
  createPerson,
  createSession,
  deleteAllData,
  exportAllData,
  upsertUserProfile,
} from "@/lib/deep-dive/store";
import { SessionKind, TypeAxes } from "@/lib/deep-dive/types";

export async function createNoteAction(formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();

  if (!body) {
    return;
  }

  await createNote(body.slice(0, 600), []);
  revalidatePath("/deep-dive");
  revalidatePath("/deep-dive/timeline");
}

export async function createPersonAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return;
  }

  const role = String(formData.get("role") ?? "").trim();
  const relationship = String(formData.get("relationship") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();
  const presetId = String(formData.get("presetId") ?? "");
  const preset = PERSON_PRESETS.find((row) => row.id === presetId);

  await createPerson({ name, role, relationship, memo, typeAxes: preset?.axes });
  revalidatePath("/deep-dive/people");
}

export async function runCoachingAction(formData: FormData) {
  const kind = String(formData.get("kind") ?? "PRE") as SessionKind;
  const personId = String(formData.get("personId") ?? "").trim();
  const inputText = String(formData.get("inputText") ?? "").trim();
  const goal = String(formData.get("goal") ?? "").trim();

  if (!personId || !inputText) {
    return;
  }

  const contextNoteIds = await pickContextNoteIds(inputText, kind, personId);
  const session = await createSession({
    kind,
    personId,
    inputText,
    goal,
    contextNoteIds,
  });

  const generated = await generateCoachingBundle({
    kind,
    personId,
    inputText,
    goal,
    contextNoteIds,
  });

  await attachArtifact(session.id, generated.payload, generated.model);
  revalidatePath("/deep-dive/coach");
  redirect(`/deep-dive/sessions/${session.id}`);
}

export async function exportAllDataAction() {
  return JSON.stringify(await exportAllData(), null, 2);
}

export async function deleteAllDataAction() {
  await deleteAllData();
  revalidatePath("/deep-dive");
  redirect("/deep-dive");
}

function pickAxis<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed.includes(value as T) ? value : fallback) as T;
}

export async function upsertUserProfileAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return;
  }

  const axes: TypeAxes = {
    priority: pickAxis(
      String(formData.get("priority") ?? ""),
      ["politics", "logic", "risk", "outcome", "speed", "harmony"] as const,
      "logic",
    ),
    directness: pickAxis(String(formData.get("directness") ?? ""), ["direct", "indirect"] as const, "direct"),
    verbosity: pickAxis(String(formData.get("verbosity") ?? ""), ["short", "long"] as const, "short"),
    emphasis: pickAxis(String(formData.get("emphasis") ?? ""), ["emotional", "logical"] as const, "logical"),
    stance: pickAxis(String(formData.get("stance") ?? ""), ["defensive", "cooperative"] as const, "cooperative"),
    decisionSpeed: pickAxis(String(formData.get("decisionSpeed") ?? ""), ["fast", "slow"] as const, "fast"),
  };

  const memo = String(formData.get("memo") ?? "").trim();

  await upsertUserProfile({
    name,
    memo,
    typeAxes: axes,
  });
  revalidatePath("/deep-dive/profile");
  revalidatePath("/deep-dive/coach");
  redirect("/deep-dive/profile?saved=1");
}
