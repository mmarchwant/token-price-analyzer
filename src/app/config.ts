export const REPO_URL = import.meta.env.VITE_REPO_URL ?? '';

export interface NewIssueOptions {
  template: string;
  title: string;
  body: string;
}

export function newIssueUrl(options: NewIssueOptions, repoUrl: string = REPO_URL): string | null {
  if (!repoUrl) {
    return null;
  }
  const cleanRepoUrl = repoUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({
    template: options.template,
    title: options.title,
    body: options.body,
  });
  return `${cleanRepoUrl}/issues/new?${params.toString()}`;
}
