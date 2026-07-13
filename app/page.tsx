import { getFilteredRecords, getPublicRecords, getPublicCategories, getCategories } from "@/lib/content";
import { RecordsClient } from "./records-client";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { redirect } from "next/navigation";

async function getUsernameFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("zhiyi_token")?.value;
  if (!token) return null;
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return null;
  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    return (payload.sub as string) || null;
  } catch { return null; }
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ category?: string; page?: string; mode?: string }> }) {
  const params = await searchParams;
  const category = params.category || "all";
  const page = parseInt(params.page || "1", 10);
  const isPublic = params.mode === "public";

  if (isPublic) {
    const allRecords = await getPublicRecords(category === "all" ? undefined : category);
    const categories = await getPublicCategories();
    const PER_PAGE = 5;
    const totalPages = Math.ceil(allRecords.length / PER_PAGE);
    const pageRecords = allRecords.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    return (
      <div className="page-view" id="records-view">
        <RecordsClient
          records={pageRecords}
          allRecords={allRecords}
          categories={categories}
          currentCategory={category}
          currentPage={page}
          totalPages={totalPages}
          listMode="public"
        />
      </div>
    );
  }

  // 未登录用户禁止访问私有列表
  const username = await getUsernameFromCookie();
  if (!username) {
    redirect("/?mode=public");
  }
  let allRecords;
  if (category === "public") {
    allRecords = await getPublicRecords();
  } else {
    allRecords = await getFilteredRecords(category === "all" ? undefined : category, username || undefined);
  }
  const categories = await getCategories(username || undefined);
  const PER_PAGE = 5;
  const totalPages = Math.ceil(allRecords.length / PER_PAGE);
  const pageRecords = allRecords.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="page-view" id="records-view">
      <RecordsClient
        records={pageRecords}
        allRecords={allRecords}
        categories={categories}
        currentCategory={category}
        currentPage={page}
        totalPages={totalPages}
        listMode="private"
      />
    </div>
  );
}
