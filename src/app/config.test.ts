import { describe, expect, it } from 'vitest';
import { newIssueUrl } from './config';

describe('config utilities', () => {
  describe('newIssueUrl', () => {
    it('returns null when REPO_URL / repoUrl is empty', () => {
      expect(
        newIssueUrl(
          {
            template: 'outdated-data.yml',
            title: 'Outdated plan',
            body: 'Claude Pro needs update',
          },
          '',
        ),
      ).toBeNull();
    });

    it('returns formatted issue URL with URL-encoded parameters when repoUrl is provided', () => {
      const url = newIssueUrl(
        {
          template: 'outdated-data.yml',
          title: '[Outdated Data] Subscription plan: claude-pro',
          body: 'Current price: $20/mo\nUpdated price: $22/mo',
        },
        'https://github.com/example/token-price-analyzer',
      );

      expect(url).not.toBeNull();
      expect(url).toContain('https://github.com/example/token-price-analyzer/issues/new?');
      expect(url).toContain('template=outdated-data.yml');
      expect(url).toContain('title=%5BOutdated+Data%5D+Subscription+plan%3A+claude-pro');
      expect(url).toContain('body=Current+price%3A+%2420%2Fmo%0AUpdated+price%3A+%2422%2Fmo');
    });

    it('handles trailing slash in repoUrl correctly', () => {
      const url = newIssueUrl(
        {
          template: 'bug_report.yml',
          title: 'Bug',
          body: 'Details',
        },
        'https://github.com/example/token-price-analyzer/',
      );

      expect(url).toBe(
        'https://github.com/example/token-price-analyzer/issues/new?template=bug_report.yml&title=Bug&body=Details',
      );
    });
  });
});
