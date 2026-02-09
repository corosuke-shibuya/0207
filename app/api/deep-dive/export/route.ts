import { NextResponse } from "next/server";
import { exportAllData } from "@/lib/deep-dive/store";

export async function GET() {
  const body = await exportAllData();
  return NextResponse.json(body, {
    headers: {
      "Content-Disposition": `attachment; filename="deep-dive-export-${Date.now()}.json"`,
    },
  });
}
