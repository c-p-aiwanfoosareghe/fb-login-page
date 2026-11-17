import "dotenv/config";
import express from "express";
import cookieSession from "cookie-session";
import crypto from "node:crypto";

const {
  FB_APP_ID,
  FB_APP_SECRET,
  FB_REDIRECT_URI,
  SESSION_SECRET,
  FB_API_VERSION = "v27.0",
  PORT = 3000,
} = process.env;

for (const [key, value] of Object.entries({
  FB_APP_ID, FB_APP_SECRET, FB_REDIRECT_URI, SESSION_SECRET,
})) {
  if (!value) {
    console.error(`Missing required env var: ${key}. Copy .env.example to .env.`);
    process.exit(1);
  }
}

const app = express();
app.use(express.static("public"));
app.use(cookieSession({
  name: "fbsess",
  keys: [SESSION_SECRET],
  maxAge: 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
}));

// Step 1 — redirect the person to the Login Dialog
app.get("/auth/facebook", (req, res) => {
  // Anti-CSRF: compare this on the way back
  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: FB_APP_ID,
    redirect_uri: FB_REDIRECT_URI,
    state,
    response_type: "code",
    scope: "public_profile,email",
  });

    res.redirect(
    `https://www.facebook.com/${FB_API_VERSION}/dialog/oauth?${params}`
  );
});

// Step 2 — exchange the code for a token, server-side only
app.get("/auth/facebook/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error_description || error)}`);
  }

  if (!state || state !== req.session.oauthState) {
    return res.redirect("/?error=" + encodeURIComponent("State mismatch — possible CSRF."));
  }
  delete req.session.oauthState;

  try {
    const tokenParams = new URLSearchParams({
      client_id: FB_APP_ID,
      client_secret: FB_APP_SECRET, // never leaves the server
      redirect_uri: FB_REDIRECT_URI, // must equal the one used above
      code,
    });

    // Access token exchange
const tokenRes = await fetch(
  `https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token?${tokenParams}`
);

// Long-lived token exchange
const longRes = await fetch(
  `https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token?${longParams}`
);

// Debug token
const debugRes = await fetch(
  `https://graph.facebook.com/${FB_API_VERSION}/debug_token?${debugParams}`
);

// Fetch profile
const profileRes = await fetch(
  `https://graph.facebook.com/${FB_API_VERSION}/me?fields=id,name,email,picture&access_token=${accessToken}`
);

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData.error?.message || "Token exchange failed");

    // Optional but recommended: swap the short-lived token for a long-lived one
    const longParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: FB_APP_ID,
      client_secret: FB_APP_SECRET,
      fb_exchange_token: tokenData.access_token,
    });
    const longRes = await fetch(
      `[graph.facebook.com](https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token?${longParams})`
    );
    const longData = await longRes.json();
    const accessToken = longData.access_token || tokenData.access_token;

    // Verify the token belongs to our app before trusting the profile call
    const debugParams = new URLSearchParams({
      input_token: accessToken,
      access_token: `${FB_APP_ID}|${FB_APP_SECRET}`,
    });
    const debugRes = await fetch(
      `[graph.facebook.com](https://graph.facebook.com/${FB_API_VERSION}/debug_token?${debugParams})`
    );
    const debugData = await debugRes.json();
    if (debugData.data?.app_id !== FB_APP_ID) throw new Error("Token issued for another app");

    const profileRes = await fetch(
      `[graph.facebook.com](https://graph.facebook.com/${FB_API_VERSION}/me?fields=id,name,email,picture&access_token=${accessToken})`
    );
    const profile = await profileRes.json();
    if (!profileRes.ok) throw new Error(profile.error?.message || "Profile fetch failed");

    // In a real app you would upsert this into your user table and set your
    // own session id here, instead of keeping the FB token in the cookie.
    req.session.user = {
      id: profile.id,
      name: profile.name,
      email: profile.email || null,
      picture: profile.picture?.data?.url || null,
    };

    res.redirect("/?logged_in=1");
  } catch (err) {
    console.error(err);
    res.redirect("/?error=" + encodeURIComponent(err.message));
  }
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
  res.json(req.session.user);
});

app.post("/auth/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

// Required for public apps: deauthorize + data deletion callbacks.
// Point the App Dashboard URLs at these (or a real implementation).
app.post("/facebook/deauthorize", (req, res) => {
  // TODO: look up the signed_request payload and mark that user's token invalid.
  res.sendStatus(200);
});

app.post("/facebook/data-deletion", (req, res) => {
  const code = crypto.randomBytes(8).toString("hex");
  // TODO: actually delete the user's stored data, then return the status URL.
  res.json({
    url: `[your-domain.example](https://your-domain.example/deletion-status?id=${code})`,
    confirmation_code: code,
  });
});

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
  console.log(`Valid OAuth Redirect URI must be: ${FB_REDIRECT_URI}`);
});
