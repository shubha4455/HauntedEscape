const apiBaseUrl = import.meta.env.VITE_API_URL
  || (import.meta.env.DEV ? "http://localhost:3001/api" : "");

async function request(path, { token, ...options } = {}) {
  if (!apiBaseUrl) {
    throw new Error("Account service is not configured for this website.");
  }

  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Cannot reach the account service. Please try again later.");
  }

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "The account request failed.");
  }

  return body;
}

export function registerAccount({ email, displayName, password }) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, displayName, password }),
  });
}

export function loginAccount({ email, password }) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getAccount(token) {
  return request("/account", { token });
}

export function saveEscape(token, remainingSeconds) {
  return request("/account/escapes", {
    method: "POST",
    token,
    body: JSON.stringify({ remainingSeconds }),
  });
}
