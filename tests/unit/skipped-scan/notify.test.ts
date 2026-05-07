import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const markMock = vi.fn().mockResolvedValue(undefined);
const shouldSendMock = vi.fn().mockResolvedValue(true);
const sendEmailMock = vi.fn().mockResolvedValue({ success: true });

// Supabase chain: from('profiles').select('email, first_name').eq('id', userId).maybeSingle()
const maybeSingleMock = vi
  .fn()
  .mockResolvedValue({ data: { email: "u@example.com", first_name: "Alex" }, error: null });
const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock("../../../netlify/functions/utils/skipped-scan", () => ({
  markScheduledScanSkipped: markMock,
}));
vi.mock("../../../netlify/functions/utils/email-throttle", () => ({
  shouldSendEmail: shouldSendMock,
}));
vi.mock("../../../netlify/functions/utils/email", () => ({
  sendEmail: sendEmailMock,
}));
vi.mock("../../../netlify/functions/utils/supabase-admin", () => ({
  supabaseAdmin: { from: fromMock },
}));

const ENV_TOKEN = "test-internal-token";
const ORIGINAL = process.env.INTERNAL_API_TOKEN;

describe("credits-skipped-scan-notify", () => {
  beforeEach(() => {
    process.env.INTERNAL_API_TOKEN = ENV_TOKEN;
    vi.clearAllMocks();
    shouldSendMock.mockResolvedValue(true);
    maybeSingleMock.mockResolvedValue({
      data: { email: "u@example.com", first_name: "Alex" },
      error: null,
    });
  });

  it("401 without auth", async () => {
    const mod = await import(
      "../../../netlify/functions/credits-skipped-scan-notify"
    );
    const result = await mod.handler!(
      { httpMethod: "POST", headers: {}, body: "{}" } as never,
      {} as never,
      () => undefined,
    );
    expect((result as { statusCode: number }).statusCode).toBe(401);
  });

  it("405 on GET", async () => {
    const mod = await import(
      "../../../netlify/functions/credits-skipped-scan-notify"
    );
    const result = await mod.handler!(
      {
        httpMethod: "GET",
        headers: { authorization: `Bearer ${ENV_TOKEN}` },
      } as never,
      {} as never,
      () => undefined,
    );
    expect((result as { statusCode: number }).statusCode).toBe(405);
  });

  it("200 marks skipped + sends email when throttle allows", async () => {
    shouldSendMock.mockResolvedValueOnce(true);
    const mod = await import(
      "../../../netlify/functions/credits-skipped-scan-notify"
    );
    const result = await mod.handler!(
      {
        httpMethod: "POST",
        headers: { authorization: `Bearer ${ENV_TOKEN}` },
        body: JSON.stringify({
          userId: "u1",
          appName: "LABS",
          requiredCredits: 50,
          availableCredits: 8,
        }),
      } as never,
      {} as never,
      () => undefined,
    );
    expect((result as { statusCode: number }).statusCode).toBe(200);
    expect(markMock).toHaveBeenCalledWith("u1");
    expect(sendEmailMock).toHaveBeenCalled();
  });

  it("200 marks skipped but skips email when throttled", async () => {
    shouldSendMock.mockResolvedValueOnce(false);
    const mod = await import(
      "../../../netlify/functions/credits-skipped-scan-notify"
    );
    const result = await mod.handler!(
      {
        httpMethod: "POST",
        headers: { authorization: `Bearer ${ENV_TOKEN}` },
        body: JSON.stringify({
          userId: "u1",
          appName: "LABS",
          requiredCredits: 50,
          availableCredits: 8,
        }),
      } as never,
      {} as never,
      () => undefined,
    );
    expect((result as { statusCode: number }).statusCode).toBe(200);
    expect(markMock).toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

// Restore env at module teardown.
afterAll(() => {
  if (ORIGINAL === undefined) {
    delete process.env.INTERNAL_API_TOKEN;
  } else {
    process.env.INTERNAL_API_TOKEN = ORIGINAL;
  }
});
