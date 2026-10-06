import { useTranslation } from 'react-i18next';
import { useAppData } from '../data/AppData';
import { useSettingsStore } from '../state/settings';
import { Select } from './ui/Select';

export interface ProfileSelectProps {
  label?: string;
  onChange?: (profileId: string) => void;
  className?: string;
  id?: string;
}

export function ProfileSelect({
  label,
  onChange,
  className,
  id = 'profile-select',
}: ProfileSelectProps) {
  const { profiles } = useAppData();
  const { i18n, t } = useTranslation('profiles');
  const activeProfileId = useSettingsStore((state) => state.activeProfileId);
  const setActiveProfileId = useSettingsStore((state) => state.setActiveProfileId);

  const lang = i18n.language?.startsWith('pl') ? 'pl' : 'en';

  const presets = profiles.filter((p) => p.isPreset);
  const custom = profiles.filter((p) => !p.isPreset);

  const options = [
    ...presets.map((p) => ({
      value: p.id,
      label: p.name[lang] || p.name.en,
    })),
    ...custom.map((p) => ({
      value: p.id,
      label: `${p.name[lang] || p.name.en} ${lang === 'pl' ? '(własny)' : '(custom)'}`,
    })),
  ];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setActiveProfileId(val);
    if (onChange) {
      onChange(val);
    }
  };

  return (
    <Select
      id={id}
      label={label ?? t('selectLabel', 'Usage Profile')}
      value={activeProfileId}
      onChange={handleChange}
      options={options}
      className={className}
    />
  );
}
