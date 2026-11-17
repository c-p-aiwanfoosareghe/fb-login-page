const alertBox = document.getElementById("alert");
const loggedOut = document.getElementById("loggedOut");
const loggedIn = document.getElementById("loggedIn");

const params = new URLSearchParams(location.search);
if (params.get("error")) {
  alertBox.textContent = params.get("error");
  alertBox.hidden = false;
}
if (params.get("logged_in") || params.get("error")) {
  history.replaceState({}, "", location.pathname);
}

function showUser(user) {
  loggedOut.hidden = true;
  loggedIn.hidden = false;
  document.getElementById("userName").textContent = user.name;
  document.getElementById("userEmail").textContent = user.email || "No email permission granted";
  document.getElementById("userId").textContent = user.id;
  const avatar = document.getElementById("avatar");
  if (user.picture) {
    avatar.src = user.picture;
    avatar.style.visibility = "visible";
  } else {
    avatar.style.visibility = "hidden";
  }
}

async function load() {
  const res = await fetch("/api/me");
  if (res.ok) showUser(await res.json());
}

document.getElementById("logout").addEventListener("click", async () => {
  await fetch("/auth/logout", { method: "POST" });
  location.reload();
});

load();
