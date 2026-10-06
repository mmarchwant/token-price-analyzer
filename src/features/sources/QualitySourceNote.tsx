import { useTranslation } from 'react-i18next';

export interface QualitySourceNoteProps {
  className?: string;
}

export function QualitySourceNote({ className = '' }: QualitySourceNoteProps) {
  const { t } = useTranslation('sources');

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 ${className}`}
    >
      <span>{t('qualityNote.prefix', 'Quality metrics sourced from')}</span>
      <a
        href="https://artificialanalysis.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        Artificial Analysis
      </a>
    </span>
  );
}
