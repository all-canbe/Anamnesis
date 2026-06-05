import { getFilteredRecords } from "@/lib/content";
import { RecordsClient } from "./records-client";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ category?: string; page?: string }> }) {
  const params = await searchParams;
  const category = params.category || "all";
  const page = parseInt(params.page || "1", 10);
  const allRecords = getFilteredRecords(category === "all" ? undefined : category);
  const PER_PAGE = 5;
  const totalPages = Math.ceil(allRecords.length / PER_PAGE);
  const pageRecords = allRecords.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="page-view" id="records-view">
      <RecordsClient
        records={pageRecords}
        currentCategory={category}
        currentPage={page}
        totalPages={totalPages}
      />
    </div>
  );
}