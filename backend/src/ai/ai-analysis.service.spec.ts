import { ServiceUnavailableException } from '@nestjs/common';
import { AiAnalysisService } from './ai-analysis.service';

describe('AiAnalysisService - configuration externe', () => {
  const values: Record<string, string | undefined> = {};
  const config = { get: vi.fn((key: string) => values[key]) };
  const analyses = { find: vi.fn(), findOne: vi.fn(), create: vi.fn(), save: vi.fn() };
  const items = { existsBy: vi.fn(), findOne: vi.fn() };
  const connectors = { findOne: vi.fn() };
  const laboratories = { find: vi.fn() };
  const audit = { log: vi.fn() };
  const service = new AiAnalysisService(
    analyses as never,
    items as never,
    connectors as never,
    laboratories as never,
    config as never,
    audit as never,
  );

  beforeEach(() => {
    Object.keys(values).forEach((key) => delete values[key]);
    vi.clearAllMocks();
  });

  it('requires the selected provider key and both explicit external-processing switches', () => {
    values.OPENAI_API_KEY = 'test-key';
    values.AI_ENABLED = 'true';
    expect(service.isEnabled()).toBe(false);

    values.AI_ALLOW_EXTERNAL_PROCESSING = 'true';
    expect(service.isEnabled()).toBe(true);

    values.AI_AUTO_ANALYZE = 'true';
    expect(service.isAutoAnalysisEnabled()).toBe(true);

    values.AI_PROVIDER = 'gemini';
    expect(service.isEnabled()).toBe(false);
    values.GEMINI_API_KEY = 'gemini-test-key';
    expect(service.isEnabled()).toBe(true);

    values.AI_PROVIDER = 'claude';
    expect(service.isEnabled()).toBe(false);
    values.ANTHROPIC_API_KEY = 'claude-test-key';
    expect(service.isEnabled()).toBe(true);

    values.AI_PROVIDER = 'deepseek';
    expect(service.isEnabled()).toBe(false);
    values.DEEPSEEK_API_KEY = 'deepseek-test-key';
    expect(service.isEnabled()).toBe(true);

    values.AI_PROVIDER = 'unknown';
    expect(service.isEnabled()).toBe(false);
  });

  it('refuses analysis before loading content when external processing is disabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(service.analyze(42)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(items.findOne).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('supports automatic provider selection and comma-separated key pools', () => {
    values.AI_ENABLED = 'true';
    values.AI_ALLOW_EXTERNAL_PROCESSING = 'true';
    values.AI_PROVIDER = 'auto';
    values.AI_FALLBACK_PROVIDERS = 'gemini, claude, deepseek';
    values.GEMINI_API_KEYS = ' first-key, second-key, first-key ';
    expect(service.isEnabled()).toBe(true);
  });
});
