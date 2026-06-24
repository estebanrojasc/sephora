import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { countUsers } from "@/lib/repositories/users";

export async function GET() {
  const session = await getSession();
  let totalAdmins = 0;
  try {
    totalAdmins = await countUsers();
  } catch {
    totalAdmins = 0;
  }
  if (!session) {
    return NextResponse.json({ user: null, totalAdmins });
  }
  return NextResponse.json({
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
    },
    totalAdmins,
  });
}
