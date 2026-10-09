import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  NumberInput,
  Toggle,
  ErrorState,
} from '../../components/ui';
import { ShareButton } from '../../components/ShareButton';
import { CopyNameButton } from '../../components/ui/CopyNameButton';
import { useAppData } from '../../data/AppData';
import { useActiveProfile, useMoney } from '../../data/hooks';
import { useSettingsStore } from '../../state/settings';
import { UsageProfileSchema } from '../../domain/schemas';
import type { LocalizedText, QualityDimension, UsageProfile } from '../../domain/types';
import { profileSummary, referenceModels } from './profilePreview';
import { decodeProfile, encodeProfile } from './profileShare';
import { monthlyTasks } from '../../domain/pricing';

export default function ProfilesPage() {
  const { t, i18n } = useTranslation(['profiles', 'common']);
  const lang = (i18n.language || 'en').startsWith('pl') ? 'pl' : 'en';

  const { profiles, models } = useAppData();
  const activeProfile = useActiveProfile();
  const { fmt, fmtTokens, toUsd } = useMoney();

  const activeProfileId = useSettingsStore((state) => state.activeProfileId);
  const customProfiles = useSettingsStore((state) => state.customProfiles);
  const budgetSetting = useSettingsStore((state) => state.budget);
  const includeFreeModels = useSettingsStore((state) => state.includeFreeModels);
  const includeBatchOffers = useSettingsStore((state) => state.includeBatchOffers);

  const setActiveProfileId = useSettingsStore((state) => state.setActiveProfileId);
  const upsertCustomProfile = useSettingsStore((state) => state.upsertCustomProfile);
  const deleteCustomProfile = useSettingsStore((state) => state.deleteCustomProfile);

  const [searchParams, setSearchParams] = useSearchParams();
  const importParam = searchParams.get('import');

  // Derive imported profile directly from URL search parameter
  const { importedProfile, importError } = useMemo(() => {
    if (!importParam) {
      return { importedProfile: null, importError: null };
    }
    const decoded = decodeProfile(importParam);
    if (decoded.success) {
      return { importedProfile: decoded.profile, importError: null };
    }
    return { importedProfile: null, importError: decoded.error };
  }, [importParam]);

  const handleDismissImport = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('import');
        return next;
      },
      { replace: true },
    );
  };

  const handleConfirmImport = () => {
    if (importedProfile) {
      upsertCustomProfile(importedProfile);
      setActiveProfileId(importedProfile.id);
      setSelectedProfileId(importedProfile.id);
      setFormData(importedProfile);
      setErrors({});
    }
    handleDismissImport();
  };

  // Selected profile in editor list
  const [selectedProfileId, setSelectedProfileId] = useState<string>(activeProfileId);

  const selectedProfile = useMemo(() => {
    return profiles.find((p) => p.id === selectedProfileId) || activeProfile;
  }, [profiles, selectedProfileId, activeProfile]);

  // Form editing state
  const [formData, setFormData] = useState<UsageProfile>(selectedProfile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shareCopiedId, setShareCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Token Estimator state
  const [isEstimatorOpen, setIsEstimatorOpen] = useState<boolean>(false);
  const [promptText, setPromptText] = useState<string>('');
  const [responseText, setResponseText] = useState<string>('');

  const fieldIds = {
    name: 'profile-name',
    inputTokensPerTask: 'profile-input-tokens-per-task',
    outputTokensPerTask: 'profile-output-tokens-per-task',
    cachedInputShare: 'profile-cached-input-share',
    tasksPerDay: 'profile-tasks-per-day',
    workDaysPerMonth: 'profile-work-days-per-month',
    promptText: 'profile-estimator-prompt',
    responseText: 'profile-estimator-response',
  };

  const presetProfiles = useMemo(() => profiles.filter((p) => p.isPreset), [profiles]);

  const generateUniqueCustomId = (name: string, ignoreId?: string): string => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const baseId = slug ? `custom-${slug}` : 'custom-profile';

    let uniqueId = baseId;
    let counter = 2;
    const existingIds = new Set(customProfiles.filter((p) => p.id !== ignoreId).map((p) => p.id));

    while (existingIds.has(uniqueId)) {
      uniqueId = `${baseId}-${counter}`;
      counter++;
    }
    return uniqueId;
  };

  const handleSelectProfile = (profile: UsageProfile) => {
    setSelectedProfileId(profile.id);
    setFormData(profile);
    setErrors({});
  };

  const handleDuplicatePreset = (preset: UsageProfile) => {
    const duplicateNameStr = `${preset.name[lang] || preset.name.en} (Copy)`;
    const newId = generateUniqueCustomId(duplicateNameStr);

    const newProfile: UsageProfile = {
      ...preset,
      id: newId,
      name: {
        en: `${preset.name.en} (Copy)`,
        pl: `${preset.name.pl} (Kopia)`,
      },
      isPreset: false,
    };

    upsertCustomProfile(newProfile);
    setActiveProfileId(newId);
    setSelectedProfileId(newId);
    setFormData(newProfile);
    setErrors({});
  };

  const handleSaveForm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const nameText = typeof formData.name === 'string' ? formData.name : formData.name[lang];
    const newErrors: Record<string, string> = {};

    if (!nameText || !nameText.trim()) {
      newErrors['name'] = t('editor.errors.nameRequired');
    }
    if (formData.inputTokensPerTask <= 0) {
      newErrors['inputTokensPerTask'] = t('editor.errors.inputTokensMin');
    }
    if (formData.outputTokensPerTask <= 0) {
      newErrors['outputTokensPerTask'] = t('editor.errors.outputTokensMin');
    }
    if (formData.tasksPerDay <= 0) {
      newErrors['tasksPerDay'] = t('editor.errors.tasksPerDayMin');
    }
    if (formData.workDaysPerMonth < 1 || formData.workDaysPerMonth > 31) {
      newErrors['workDaysPerMonth'] = t('editor.errors.workDaysRange');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    const normalizedName: LocalizedText =
      typeof formData.name === 'string'
        ? { en: (formData.name as string).trim(), pl: (formData.name as string).trim() }
        : formData.name;

    const oldId = formData.id;
    const isOldCustom = oldId.startsWith('custom-');
    const profileId = generateUniqueCustomId(normalizedName.en, isOldCustom ? oldId : undefined);

    const profileToSave: UsageProfile = {
      ...formData,
      id: profileId,
      name: normalizedName,
      description:
        typeof formData.description === 'string'
          ? { en: formData.description, pl: formData.description }
          : formData.description,
      isPreset: false,
    };

    const parseResult = UsageProfileSchema.safeParse(profileToSave);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      setErrors({ form: firstIssue?.message || 'Invalid profile format' });
      return;
    }

    if (isOldCustom && oldId !== profileId) {
      deleteCustomProfile(oldId);
    }

    upsertCustomProfile(parseResult.data);
    setActiveProfileId(parseResult.data.id);
    setSelectedProfileId(parseResult.data.id);
    setFormData(parseResult.data);
  };

  const handleCancelForm = () => {
    setFormData(selectedProfile);
    setErrors({});
  };

  const handleShareProfile = (profile: UsageProfile) => {
    const encoded = encodeProfile(profile);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const shareUrl = `${origin}${pathname}#/profiles?import=${encoded}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setShareCopiedId(profile.id);
        setTimeout(() => setShareCopiedId(null), 2500);
      });
    }
  };

  const handleConfirmDelete = (id: string) => {
    deleteCustomProfile(id);
    setDeletingId(null);
    if (selectedProfileId === id) {
      const fallback = presetProfiles[0] || activeProfile;
      setSelectedProfileId(fallback.id);
      setFormData(fallback);
      setErrors({});
    }
  };

  // Live preview & reference models
  const totalMonthlyTasks = monthlyTasks(formData);
  const monthlyInputTokens = formData.inputTokensPerTask * totalMonthlyTasks;
  const monthlyOutputTokens = formData.outputTokensPerTask * totalMonthlyTasks;

  const previewReferences = useMemo(() => {
    return referenceModels(models, formData, {
      includeFreeModels,
      includeBatchOffers,
    });
  }, [models, formData, includeFreeModels, includeBatchOffers]);

  // Budget warning
  const userBudgetUsd = toUsd(budgetSetting.amount, budgetSetting.currency);
  const bestQualityMonthlyCost = previewReferences.bestQuality?.monthlyCostUsd;
  const showBudgetWarning =
    bestQualityMonthlyCost !== undefined && bestQualityMonthlyCost > userBudgetUsd;

  // Token Estimator calculations
  const estimatedInputTokens = Math.ceil(promptText.length / 4);
  const estimatedOutputTokens = Math.ceil(responseText.length / 4);

  const handleUseEstimatorNumbers = () => {
    setFormData((prev) => ({
      ...prev,
      inputTokensPerTask: estimatedInputTokens > 0 ? estimatedInputTokens : prev.inputTokensPerTask,
      outputTokensPerTask:
        estimatedOutputTokens > 0 ? estimatedOutputTokens : prev.outputTokensPerTask,
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} actions={<ShareButton />} />

      {/* Import Profile Confirmation or Error Banner */}
      {importedProfile && (
        <Card className="border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4">
            <div>
              <h4 className="font-bold text-indigo-900 dark:text-indigo-200">
                {t('import.cardTitle')}
              </h4>
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                {t('import.prompt', {
                  name: importedProfile.name[lang] || importedProfile.name.en,
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleConfirmImport}>
                {t('import.confirm')}
              </Button>
              <Button size="sm" variant="secondary" onClick={handleDismissImport}>
                {t('import.dismiss')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {importError && (
        <ErrorState
          title={t('import.errorTitle')}
          message={t('import.errorMsg', { error: importError })}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Profile List */}
        <div className="lg:col-span-5 space-y-6">
          {/* Presets Group */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle
                as="h3"
                className="text-sm font-semibold text-zinc-500 uppercase tracking-wider"
              >
                {t('groups.presets')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              {presetProfiles.map((p) => {
                const isActive = p.id === activeProfileId;
                const isSelected = p.id === selectedProfileId;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProfile(p)}
                    className={`group cursor-pointer rounded-lg p-3 transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        {p.name[lang] || p.name.en}
                      </div>
                      {isActive && <Badge variant="info">{t('badges.active')}</Badge>}
                    </div>

                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
                      {profileSummary(p)}
                    </div>

                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                      {!isActive && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveProfileId(p.id);
                          }}
                        >
                          {t('actions.setActive')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicatePreset(p);
                        }}
                      >
                        {t('actions.duplicate')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareProfile(p);
                        }}
                      >
                        {shareCopiedId === p.id ? t('actions.shareCopied') : t('actions.share')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Custom Profiles Group */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle
                as="h3"
                className="text-sm font-semibold text-zinc-500 uppercase tracking-wider"
              >
                {t('groups.custom')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1">
              {customProfiles.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500 dark:text-zinc-400 italic">
                  No custom profiles yet. Duplicate a preset or create one in the editor.
                </div>
              ) : (
                customProfiles.map((p) => {
                  const isActive = p.id === activeProfileId;
                  const isSelected = p.id === selectedProfileId;
                  const isDeleting = deletingId === p.id;
                  const nameText = p.name[lang] || p.name.en;

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProfile(p)}
                      className={`group cursor-pointer rounded-lg p-3 transition-colors ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800'
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                          {nameText}
                        </div>
                        {isActive && <Badge variant="info">{t('badges.active')}</Badge>}
                      </div>

                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
                        {profileSummary(p)}
                      </div>

                      {isDeleting ? (
                        <div
                          className="mt-2 p-2 bg-rose-50 dark:bg-rose-950/40 rounded-md border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-xs font-medium text-rose-800 dark:text-rose-200">
                            {t('deleteModal.title')}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleConfirmDelete(p.id)}
                            >
                              {t('deleteModal.confirm')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeletingId(null)}>
                              {t('deleteModal.cancel')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                          {!isActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveProfileId(p.id);
                              }}
                            >
                              {t('actions.setActive')}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectProfile(p);
                            }}
                          >
                            {t('actions.edit')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareProfile(p);
                            }}
                          >
                            {shareCopiedId === p.id ? t('actions.shareCopied') : t('actions.share')}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingId(p.id);
                            }}
                          >
                            {t('actions.delete')}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Editor & Live Preview Card */}
        <div className="lg:col-span-7 space-y-6">
          {/* Profile Editor Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle as="h2" className="text-lg">
                {formData.isPreset
                  ? t('editor.title')
                  : t('editor.editTitle', { name: formData.name[lang] || formData.name.en })}
              </CardTitle>
              {formData.isPreset && <Badge variant="neutral">{t('badges.preset')}</Badge>}
            </CardHeader>
            <CardContent className="space-y-5">
              {errors['form'] && (
                <div className="p-3 text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-800">
                  {errors['form']}
                </div>
              )}

              {/* Profile Name */}
              <div className="space-y-1.5">
                <label
                  htmlFor={fieldIds.name}
                  className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  {t('editor.nameLabel')}
                </label>
                <input
                  id={fieldIds.name}
                  type="text"
                  value={
                    typeof formData.name === 'string'
                      ? formData.name
                      : formData.name[lang] || formData.name.en
                  }
                  onChange={(e) => {
                    const newName = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      name: { en: newName, pl: newName },
                    }));
                  }}
                  placeholder={t('editor.namePlaceholder')}
                  aria-invalid={Boolean(errors['name'])}
                  aria-describedby={errors['name'] ? `${fieldIds.name}-error` : undefined}
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                {errors['name'] && (
                  <p id={`${fieldIds.name}-error`} className="text-xs text-rose-500">
                    {errors['name']}
                  </p>
                )}
              </div>

              {/* Token Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <NumberInput
                    id={fieldIds.inputTokensPerTask}
                    label={t('editor.inputTokensLabel')}
                    value={formData.inputTokensPerTask}
                    onChange={(val) =>
                      setFormData((prev) => ({ ...prev, inputTokensPerTask: val }))
                    }
                    min={0}
                    step={500}
                    aria-invalid={Boolean(errors['inputTokensPerTask'])}
                    aria-describedby={
                      errors['inputTokensPerTask']
                        ? `${fieldIds.inputTokensPerTask}-error`
                        : undefined
                    }
                  />
                  {errors['inputTokensPerTask'] && (
                    <p
                      id={`${fieldIds.inputTokensPerTask}-error`}
                      className="text-xs text-rose-500 mt-1"
                    >
                      {errors['inputTokensPerTask']}
                    </p>
                  )}
                </div>

                <div>
                  <NumberInput
                    id={fieldIds.outputTokensPerTask}
                    label={t('editor.outputTokensLabel')}
                    value={formData.outputTokensPerTask}
                    onChange={(val) =>
                      setFormData((prev) => ({ ...prev, outputTokensPerTask: val }))
                    }
                    min={0}
                    step={100}
                    aria-invalid={Boolean(errors['outputTokensPerTask'])}
                    aria-describedby={
                      errors['outputTokensPerTask']
                        ? `${fieldIds.outputTokensPerTask}-error`
                        : undefined
                    }
                  />
                  {errors['outputTokensPerTask'] && (
                    <p
                      id={`${fieldIds.outputTokensPerTask}-error`}
                      className="text-xs text-rose-500 mt-1"
                    >
                      {errors['outputTokensPerTask']}
                    </p>
                  )}
                </div>
              </div>

              {/* Cached Input Share Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={fieldIds.cachedInputShare}
                    className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                  >
                    {t('editor.cachedInputShareLabel', {
                      pct: Math.round(formData.cachedInputShare * 100),
                    })}
                  </label>
                </div>
                <input
                  id={fieldIds.cachedInputShare}
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(formData.cachedInputShare * 100)}
                  onChange={(e) => {
                    const pct = parseInt(e.target.value, 10) || 0;
                    setFormData((prev) => ({
                      ...prev,
                      cachedInputShare: pct / 100,
                    }));
                  }}
                  className="w-full accent-indigo-600 h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700"
                />
              </div>

              {/* Frequency Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <NumberInput
                    id={fieldIds.tasksPerDay}
                    label={t('editor.tasksPerDayLabel')}
                    value={formData.tasksPerDay}
                    onChange={(val) => setFormData((prev) => ({ ...prev, tasksPerDay: val }))}
                    min={0}
                    step={5}
                    aria-invalid={Boolean(errors['tasksPerDay'])}
                    aria-describedby={
                      errors['tasksPerDay'] ? `${fieldIds.tasksPerDay}-error` : undefined
                    }
                  />
                  {errors['tasksPerDay'] && (
                    <p id={`${fieldIds.tasksPerDay}-error`} className="text-xs text-rose-500 mt-1">
                      {errors['tasksPerDay']}
                    </p>
                  )}
                </div>

                <div>
                  <NumberInput
                    id={fieldIds.workDaysPerMonth}
                    label={t('editor.workDaysPerMonthLabel')}
                    value={formData.workDaysPerMonth}
                    onChange={(val) => setFormData((prev) => ({ ...prev, workDaysPerMonth: val }))}
                    min={1}
                    max={31}
                    step={1}
                    aria-invalid={Boolean(errors['workDaysPerMonth'])}
                    aria-describedby={
                      errors['workDaysPerMonth'] ? `${fieldIds.workDaysPerMonth}-error` : undefined
                    }
                  />
                  {errors['workDaysPerMonth'] && (
                    <p
                      id={`${fieldIds.workDaysPerMonth}-error`}
                      className="text-xs text-rose-500 mt-1"
                    >
                      {errors['workDaysPerMonth']}
                    </p>
                  )}
                </div>
              </div>

              {/* Quality Dimension Selector */}
              <div className="space-y-2">
                <span
                  id="profile-quality-dimension-label"
                  className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  {t('editor.qualityDimensionLabel')}
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="profile-quality-dimension-label"
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                >
                  {(['intelligence', 'coding', 'agentic'] as QualityDimension[]).map((dim) => {
                    const isSelected = formData.qualityDimension === dim;
                    return (
                      <button
                        key={dim}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setFormData((prev) => ({ ...prev, qualityDimension: dim }))}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 dark:border-indigo-500'
                            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                        }`}
                      >
                        <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                          {t(`editor.qualityDimensions.${dim}.label`)}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-tight">
                          {t(`editor.qualityDimensions.${dim}.description`)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Allow Batch API Toggle */}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <Toggle
                  checked={formData.allowBatch}
                  onChange={(checked) => setFormData((prev) => ({ ...prev, allowBatch: checked }))}
                  label={t('editor.allowBatchLabel')}
                  description={t('editor.allowBatchDesc')}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3">
                <Button variant="secondary" onClick={handleCancelForm}>
                  {t('actions.cancel')}
                </Button>
                <Button onClick={handleSaveForm}>
                  {formData.isPreset ? t('actions.create') : t('actions.save')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Token Estimator Helper (Collapsible) */}
          <Card>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle as="h3" className="text-base">
                  {t('estimator.title')}
                </CardTitle>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                  {t('estimator.subtitle')}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEstimatorOpen(!isEstimatorOpen)}
              >
                {isEstimatorOpen ? 'Hide' : 'Show'}
              </Button>
            </CardHeader>

            {isEstimatorOpen && (
              <CardContent className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor={fieldIds.promptText}
                    className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                  >
                    {t('estimator.promptLabel')}
                  </label>
                  <textarea
                    id={fieldIds.promptText}
                    rows={3}
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder={t('estimator.promptPlaceholder')}
                    className="block w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <p className="text-xs text-zinc-500 font-mono">
                    {t('estimator.estimatedInput', { count: estimatedInputTokens })}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor={fieldIds.responseText}
                    className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                  >
                    {t('estimator.responseLabel')}
                  </label>
                  <textarea
                    id={fieldIds.responseText}
                    rows={3}
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder={t('estimator.responsePlaceholder')}
                    className="block w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <p className="text-xs text-zinc-500 font-mono">
                    {t('estimator.estimatedOutput', { count: estimatedOutputTokens })}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <p className="text-[11px] text-zinc-400 italic">{t('estimator.disclaimer')}</p>
                  <Button
                    size="sm"
                    onClick={handleUseEstimatorNumbers}
                    disabled={!promptText && !responseText}
                  >
                    {t('estimator.useNumbers')}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Live Preview Card */}
          <Card className="border-indigo-200 dark:border-indigo-900 bg-indigo-50/20 dark:bg-indigo-950/10">
            <CardHeader className="py-4 border-b border-indigo-100 dark:border-indigo-900/50">
              <CardTitle as="h3" className="text-base text-indigo-950 dark:text-indigo-100">
                {t('preview.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Token & Task Totals */}
              <div className="grid grid-cols-2 gap-4 bg-white dark:bg-zinc-900 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div>
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {t('preview.monthlyTasks')}
                  </div>
                  <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {totalMonthlyTasks.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {t('preview.monthlyTokens')}
                  </div>
                  <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {fmtTokens(monthlyInputTokens + monthlyOutputTokens)}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                    {t('preview.tokensDetail', {
                      input: fmtTokens(monthlyInputTokens),
                      output: fmtTokens(monthlyOutputTokens),
                    })}
                  </div>
                </div>
              </div>

              {/* Reference Models Preview */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('preview.referenceModelsTitle')}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Best Quality */}
                  <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                        {t('preview.bestQuality')}
                      </span>
                      {previewReferences.bestQuality ? (
                        <>
                          <div className="mt-1 flex items-center gap-1">
                            <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {previewReferences.bestQuality.model.name}
                            </div>
                            <CopyNameButton
                              text={previewReferences.bestQuality.model.name}
                              ariaLabel={t('common:actions.copyModelName', {
                                name: previewReferences.bestQuality.model.name,
                              })}
                              copiedLabel={t('common:actions.modelNameCopied')}
                            />
                          </div>
                          <div className="text-xs text-zinc-500">
                            {previewReferences.bestQuality.model.providerName}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-zinc-400 mt-2">{t('preview.noModels')}</div>
                      )}
                    </div>
                    {previewReferences.bestQuality && (
                      <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {fmt(previewReferences.bestQuality.costPerTaskUsd)}
                          <span className="text-[11px] font-normal text-zinc-500 ml-1">
                            {t('preview.perTask')}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          {fmt(previewReferences.bestQuality.monthlyCostUsd)}
                          <span className="text-[10px] font-normal text-zinc-500 ml-0.5">
                            {t('preview.perMonth')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Best Value */}
                  <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                        {t('preview.bestValue')}
                      </span>
                      {previewReferences.bestValue ? (
                        <>
                          <div className="mt-1 flex items-center gap-1">
                            <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {previewReferences.bestValue.model.name}
                            </div>
                            <CopyNameButton
                              text={previewReferences.bestValue.model.name}
                              ariaLabel={t('common:actions.copyModelName', {
                                name: previewReferences.bestValue.model.name,
                              })}
                              copiedLabel={t('common:actions.modelNameCopied')}
                            />
                          </div>
                          <div className="text-xs text-zinc-500">
                            {previewReferences.bestValue.model.providerName}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-zinc-400 mt-2">{t('preview.noModels')}</div>
                      )}
                    </div>
                    {previewReferences.bestValue && (
                      <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {fmt(previewReferences.bestValue.costPerTaskUsd)}
                          <span className="text-[11px] font-normal text-zinc-500 ml-1">
                            {t('preview.perTask')}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {fmt(previewReferences.bestValue.monthlyCostUsd)}
                          <span className="text-[10px] font-normal text-zinc-500 ml-0.5">
                            {t('preview.perMonth')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cheapest Paid */}
                  <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        {t('preview.cheapestPaid')}
                      </span>
                      {previewReferences.cheapestPaid ? (
                        <>
                          <div className="mt-1 flex items-center gap-1">
                            <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {previewReferences.cheapestPaid.model.name}
                            </div>
                            <CopyNameButton
                              text={previewReferences.cheapestPaid.model.name}
                              ariaLabel={t('common:actions.copyModelName', {
                                name: previewReferences.cheapestPaid.model.name,
                              })}
                              copiedLabel={t('common:actions.modelNameCopied')}
                            />
                          </div>
                          <div className="text-xs text-zinc-500">
                            {previewReferences.cheapestPaid.model.providerName}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-zinc-400 mt-2">{t('preview.noModels')}</div>
                      )}
                    </div>
                    {previewReferences.cheapestPaid && (
                      <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {fmt(previewReferences.cheapestPaid.costPerTaskUsd)}
                          <span className="text-[11px] font-normal text-zinc-500 ml-1">
                            {t('preview.perTask')}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                          {fmt(previewReferences.cheapestPaid.monthlyCostUsd)}
                          <span className="text-[10px] font-normal text-zinc-500 ml-0.5">
                            {t('preview.perMonth')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Budget Warning Note */}
              {showBudgetWarning && bestQualityMonthlyCost !== undefined && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                  ⚠️{' '}
                  {t('preview.budgetWarning', {
                    cost: fmt(bestQualityMonthlyCost),
                    budget: fmt(userBudgetUsd),
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
