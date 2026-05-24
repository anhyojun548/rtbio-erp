import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listSettings,
  updateSetting,
  bulkUpdateSettings,
} from "@/lib/actions/tenant-setting";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const result = await listSettings();
  return Response.json(result);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // 빈 또는 invalid JSON
  }

  // 일괄 업데이트 모드
  if (Array.isArray(body.items)) {
    const res = await bulkUpdateSettings({ items: body.items });
    if (!res.ok) {
      return Response.json(
        {
          ok: false,
          error: res.error,
          fieldErrors: res.fieldErrors,
        },
        { status: 400 }
      );
    }
    return Response.json(res.data);
  }

  // 단일 업데이트 모드
  if (body.key !== undefined) {
    const res = await updateSetting({ key: body.key, value: body.value });
    if (!res.ok) {
      return Response.json(
        {
          ok: false,
          error: res.error,
          fieldErrors: res.fieldErrors,
        },
        { status: 400 }
      );
    }
    return Response.json(res.data);
  }

  // key 또는 items 모두 없는 경우
  return Response.json(
    { ok: false, error: "key 또는 items 필요" },
    { status: 400 }
  );
}
