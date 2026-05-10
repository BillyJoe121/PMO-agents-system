import { FileSpreadsheet, FileText, Image, Presentation } from 'lucide-react';

export function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['xlsx', 'xls', 'csv'].includes(ext || '')) return <FileSpreadsheet size={15} className="text-neutral-900" strokeWidth={1.75} />;
  if (['pptx', 'ppt'].includes(ext || '')) return <Presentation size={15} className="text-neutral-700" strokeWidth={1.75} />;
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return <Image size={15} className="text-neutral-500" strokeWidth={1.75} />;
  return <FileText size={15} className="text-neutral-400" strokeWidth={1.75} />;
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
