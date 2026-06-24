import { deleteUser, getUser, listUsers, suspendUser } from "../../src/api/adminClient";

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;
beforeEach(() => jest.clearAllMocks());

function mockResponse(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

const TOKEN = "session-jwt";

function call(): [string, RequestInit] {
  return mockFetch.mock.calls[0] as [string, RequestInit];
}

describe("adminClient", () => {
  it("listUsers GETs /admin/users with the limit query + Bearer token", async () => {
    mockResponse({ users: [], total: 0, limit: 200, offset: 0 });
    const res = await listUsers(TOKEN, { limit: 200 });
    const [url, init] = call();
    expect(url).toContain("/api/v1/admin/users?limit=200");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(res.total).toBe(0);
  });

  it("suspendUser POSTs the suspend action", async () => {
    mockResponse({
      sub: "u1",
      email: null,
      created_at: "t",
      suspended: true,
      suspended_at: "t",
      device_count: 0,
    });
    const r = await suspendUser(TOKEN, "u1");
    const [url, init] = call();
    expect(url).toContain("/api/v1/admin/users/u1/suspend");
    expect(init.method).toBe("POST");
    expect(r.suspended).toBe(true);
  });

  it("deleteUser DELETEs and tolerates a 204", async () => {
    mockResponse(null, 204);
    await expect(deleteUser(TOKEN, "u1")).resolves.toBeUndefined();
    const [url, init] = call();
    expect(url).toContain("/api/v1/admin/users/u1");
    expect(init.method).toBe("DELETE");
  });

  it("getUser returns detail including devices", async () => {
    mockResponse({
      sub: "u1",
      email: "a@b.c",
      created_at: "t",
      suspended: false,
      suspended_at: null,
      device_count: 1,
      credentials: [],
      devices: [{ device_id: "d1", label: "Pixel", platform: "android", first_seen: "t", last_seen: "t" }],
    });
    const d = await getUser(TOKEN, "u1");
    expect(d.devices[0].device_id).toBe("d1");
    expect(d.device_count).toBe(1);
  });
});
