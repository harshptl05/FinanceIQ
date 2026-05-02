'use client';

import { Loader2 } from 'lucide-react';

export function CardSpinner({ height = 200 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center text-gray-400"
      style={{ height }}
    >
      <Loader2 className="w-5 h-5 animate-spin" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-10 px-4">
      <p className="font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
        {description}
      </p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
