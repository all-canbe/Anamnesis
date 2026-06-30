import { getRecords } from "@/lib/content";
import { OrchestrationClient } from "./client-page";

export default async function OrchestrationPage() {
  const records = await getRecords();

  return (
    <div className="orchestration-view">
      <OrchestrationClient records={records} />
    </div>
  );
}