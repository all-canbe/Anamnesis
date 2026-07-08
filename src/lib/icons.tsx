import * as H from "@heroicons/react/24/outline";
import {
  Code2 as LucideCode2,
  Server as LucideServer,
  BrainCircuit as LucideBrainCircuit,
  BookOpen as LucideBookOpen,
  Container as LucideContainer,
  Palette as LucidePalette,
} from "lucide-react";

type IconProps = { size?: number; className?: string };

function ic(C: any) {
  return ({ size = 18, className, ...props }: IconProps) =>
    <C className={className} style={{ width: size, height: size }} {...props} />;
}

// ─── All Heroicons linear-style exports ───
export const MenuIcon = ic(H.Bars3Icon);
export const ChevronRightIcon = ic(H.ChevronRightIcon);
export const ChevronLeftIcon = ic(H.ChevronLeftIcon);
export const CloseIcon = ic(H.XMarkIcon);
export const FolderIcon = ic(H.FolderIcon);
export const FolderOpenIcon = ic(H.FolderOpenIcon);
export const FileIcon = ic(H.DocumentIcon);
export const SettingsIcon = ic(H.Cog6ToothIcon);
export const SearchIcon = ic(H.MagnifyingGlassIcon);
export const DownloadIcon = ic(H.ArrowDownTrayIcon);
export const UploadIcon = ic(H.ArrowUpTrayIcon);
export const TrashIcon = ic(H.TrashIcon);
export const CopyIcon = ic(H.ClipboardDocumentIcon);
export const LinkIcon = ic(H.LinkIcon);
export const EditIcon = ic(H.PencilIcon);
export const PlusIcon = ic(H.PlusIcon);
export const CheckIcon = ic(H.CheckIcon);
export const SuccessIcon = ic(H.CheckCircleIcon);
export const WarningIcon = ic(H.ExclamationTriangleIcon);
export const ErrorIcon = ic(H.XCircleIcon);
export const LoaderIcon = ic(H.ArrowPathIcon);
export const SunIcon = ic(H.SunIcon);
export const MoonIcon = ic(H.MoonIcon);
export const MonitorIcon = ic(H.ComputerDesktopIcon);
export const BotIcon = ic(H.CpuChipIcon);
export const UserIcon = ic(H.UserIcon);
export const ToolIcon = ic(H.WrenchScrewdriverIcon);
export const ArticleIcon = ic(H.DocumentTextIcon);
export const ImageIcon = ic(H.PhotoIcon);
export const TagIcon = ic(H.TagIcon);
export const ClockIcon = ic(H.ClockIcon);
export const SortIcon = ic(H.BarsArrowUpIcon);
export const EmptyIcon = ic(H.InboxIcon);
export const RSSIcon = ic(H.RssIcon);
export const GlobeIcon = ic(H.GlobeAltIcon);
export const AttachmentIcon = ic(H.PaperClipIcon);
export const TestIcon = ic(H.BeakerIcon);
export const ArrowLeftIcon = ic(H.ArrowLeftIcon);
export const ArrowRightIcon = ic(H.ArrowRightIcon);
export const ArrowUpIcon = ic(H.ArrowUpIcon);
export const ArrowDownIcon = ic(H.ArrowDownIcon);
export const PinIcon = ic(H.MapPinIcon);
export const BookOpenIcon = ic(H.BookOpenIcon);
export const CodeIcon = ic(H.CodeBracketIcon);
export const StarIcon = ic(H.StarIcon);
export const HomeIcon = ic(H.HomeIcon);
export const RocketIcon = ic(H.RocketLaunchIcon);
export const TargetIcon = ic(H.ChartPieIcon);
export const PaintIcon = ic(H.PaintBrushIcon);
export const DatabaseIcon = ic(H.CircleStackIcon);
export const CloudIcon = ic(H.CloudIcon);
export const SparklesIcon = ic(H.SparklesIcon);
export const InfoIcon = ic(H.InformationCircleIcon);

// ─── Category Icons (Lucide) ───

type CategoryIconProps = IconProps & { category: string };

export function CategoryIcon({ category, size = 18 }: CategoryIconProps) {
  switch (category) {
    case "frontend": return <LucideCode2 size={size} strokeWidth={1.8} />;
    case "backend": return <LucideServer size={size} strokeWidth={1.8} />;
    case "ai": return <LucideBrainCircuit size={size} strokeWidth={1.8} />;
    case "reading": return <LucideBookOpen size={size} strokeWidth={1.8} />;
    case "devops": return <LucideContainer size={size} strokeWidth={1.8} />;
    case "design": return <LucidePalette size={size} strokeWidth={1.8} />;
    default: return <FileIcon size={size} />;
  }
}

/** Return SVG path string for inline thumbnail rendering */
export function getCategorySvgPath(category: string): string {
  switch (category) {
    case "frontend": return "M18 16l4-4-4-4 M6 8l-4 4 4 4 M14.5 4l-5 16";
    case "backend": return "M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Z M2 14a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4Z M6 6h.01 M6 16h.01";
    case "ai": return "M12 4.5a2.5 2.5 0 0 0-4.96-.46 2.5 2.5 0 0 0-1.98 3 2.5 2.5 0 0 0-1.32 4.3 2.5 2.5 0 0 0 1.5 6.66h6.51a2.5 2.5 0 0 0 2.34-1.64 2.5 2.5 0 0 0 1.98-3 2.5 2.5 0 0 0 1.32-4.3 2.5 2.5 0 0 0-.5-5.84 2.5 2.5 0 0 0-4.96-.46Z M12 4.5 8 8 M12 4.5l4 3.5 M12 13v5 M9 18h6";
    case "reading": return "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z";
    case "devops": return "M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.3-.9.9-.9 1.5v6.6c0 .6.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z M2 10l10 5.8 M12 22V15.8 M22 10l-10 5.8";
    case "design": return "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.4-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.7.5-1.3 1.2-1.5.6-.2 1-.8 1-1.5 0-1.2-1.2-2.3-2.8-2.3-2.5 0-4.4 2-4.4 4.5 0 2.5 2 4.5 4.5 4.5 M7.5 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M15.5 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z";
    default: return "M18 16l4-4-4-4 M6 8l-4 4 4 4 M14.5 4l-5 16";
  }
}