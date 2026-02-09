import { NextResponse } from "next/server";
import { deleteAllData } from "@/lib/deep-dive/store";

export async function POST() {
  await deleteAllData();
  return NextResponse.json({ ok: true });
}
