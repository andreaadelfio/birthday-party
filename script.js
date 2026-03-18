const eventDetails = {
  hostName: "Matteo",
  eventName: "Birthday Night",
  isoDate: "2026-07-30T19:30:00+02:00",
  displayDate: "Thursday, July 30, 2026",
  displayTime: "7:30 PM until late",
  rsvpDeadline: "July 4, 2026",
  durationHours: 6,
  venueName: "Ficarazzi",
  cityLabel: "Ficarazzi",
  address: "Via Example 24, Ficarazzi, Italy",
  contactEmail: "and.adelfio@gmail.com"
};

const starterGroups = [
  { slug: "default", name: "Default" },
  { slug: "triestini", name: "Triestini" },
  { slug: "palermitani", name: "Palermitani" },
  { slug: "munichers", name: "Munichers" }
];

const supabaseConfig = window.SUPABASE_CONFIG ?? null;

const eventDate = new Date(eventDetails.isoDate);

const countdownTargets = {
  days: document.getElementById("days"),
  hours: document.getElementById("hours"),
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds")
};

const form = document.getElementById("rsvp-form");
const status = document.getElementById("form-status");
const submitButton = form?.querySelector('button[type="submit"]') || null;
const groupSelect = document.getElementById("group-slug");
const groupModeInputs = document.querySelectorAll('input[name="group_mode"]');
const newGroupField = document.querySelector("[data-new-group-field]");
const newGroupInput = form?.querySelector('input[name="new_group_name"]') || null;
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelectorAll(".site-nav a");
const siteHeader = document.querySelector(".site-header");
const musicForm = document.getElementById("music-form");
const musicStatus = document.getElementById("music-status");
const musicBoard = document.getElementById("music-board");
const musicEmpty = document.getElementById("music-empty");
const musicRefreshButtons = document.querySelectorAll("[data-refresh-music]");
const musicSubmitButton =
  musicForm?.querySelector('button[type="submit"]') || null;
const musicToggleButton = document.getElementById("playAudio");
const musicAudio = document.getElementById("myAudio");
const musicStageTargets = [
  { node: document.getElementById("lego1"), className: "anim1play" },
  { node: document.getElementById("lego2"), className: "anim2play" },
  { node: document.getElementById("lego3"), className: "anim3play" },
  { node: document.getElementById("drums"), className: "anim4play" },
  { node: document.getElementById("piano"), className: "anim5play" }
];

let musicStageActive = false;

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

function populateEventContent() {
  setText("[data-display-date]", eventDetails.displayDate);
  setText("[data-display-time]", eventDetails.displayTime);
  setText("[data-rsvp-deadline]", eventDetails.rsvpDeadline);
  setText("[data-venue-name]", eventDetails.venueName);
  setText("[data-city-label]", eventDetails.cityLabel);
  setText("[data-address]", eventDetails.address);
  setText("[data-contact-email]", eventDetails.contactEmail);

  document.querySelectorAll("time[data-display-date]").forEach((node) => {
    node.dateTime = eventDetails.isoDate;
  });

  document.querySelectorAll("[data-contact-link]").forEach((link) => {
    link.href = `mailto:${eventDetails.contactEmail}`;
  });

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    eventDetails.address
  )}`;

  document.querySelectorAll("[data-map-link]").forEach((link) => {
    link.href = mapUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
  });
}

function formatGuestAttendance(guestsCount) {
  const count = Number(guestsCount);

  if (!Number.isFinite(count) || count <= 0) {
    return "To be confirmed";
  }

  if (count === 1) {
    return "Just you";
  }

  return `You + ${count - 1}`;
}

function buildThankYouUrl({ firstName, groupName, guestsCount, savedMode }) {
  const thankYouUrl = new URL("thank-you.html", window.location.href);

  if (firstName) {
    thankYouUrl.searchParams.set("name", firstName);
  }

  if (groupName) {
    thankYouUrl.searchParams.set("group", groupName);
  }

  if (Number.isFinite(guestsCount) && guestsCount > 0) {
    thankYouUrl.searchParams.set("guests", String(guestsCount));
  }

  if (savedMode) {
    thankYouUrl.searchParams.set("mode", savedMode);
  }

  return thankYouUrl.toString();
}

function populateThankYouPage() {
  const thankYouPage = document.querySelector("[data-thank-you-page]");

  if (!thankYouPage) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const firstName = String(params.get("name") || "friend").trim() || "friend";
  const savedMode = params.get("mode") === "updated" ? "updated" : "saved";
  const groupName =
    String(params.get("group") || "To be confirmed").trim() || "To be confirmed";
  const guestsLabel = formatGuestAttendance(params.get("guests"));
  const thankYouCopy =
    savedMode === "updated"
      ? "Your registration was updated successfully. Everything is synced for the party."
      : "Your registration is saved successfully. You are officially on the list for the party.";

  setText("[data-thank-you-name]", firstName);
  setText("[data-thank-you-mode]", savedMode);
  setText("[data-thank-you-group]", groupName);
  setText("[data-thank-you-guests]", guestsLabel);
  setText("[data-thank-you-copy]", thankYouCopy);
}

function updateCountdown() {
  if (!countdownTargets.days || Number.isNaN(eventDate.getTime())) {
    return;
  }

  const now = new Date();
  const difference = eventDate.getTime() - now.getTime();

  if (difference <= 0) {
    countdownTargets.days.textContent = "00";
    countdownTargets.hours.textContent = "00";
    countdownTargets.minutes.textContent = "00";
    countdownTargets.seconds.textContent = "00";
    return;
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((difference / (1000 * 60)) % 60);
  const seconds = Math.floor((difference / 1000) % 60);

  countdownTargets.days.textContent = String(days).padStart(2, "0");
  countdownTargets.hours.textContent = String(hours).padStart(2, "0");
  countdownTargets.minutes.textContent = String(minutes).padStart(2, "0");
  countdownTargets.seconds.textContent = String(seconds).padStart(2, "0");
}

function toICSDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeICS(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function slugifyFilePart(text) {
  const slug = String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "birthday";
}

function getCalendarMeta() {
  const hostName =
    eventDetails.hostName?.trim() ||
    document.querySelector("h1 [data-host-name]")?.textContent.trim() ||
    document.querySelector("footer [data-host-name]")?.textContent.trim() ||
    "Birthday";

  const eventName =
    eventDetails.eventName?.trim() ||
    document.querySelector("h1 [data-event-name]")?.textContent.trim() ||
    document.querySelector("footer [data-event-name]")?.textContent.trim() ||
    "Birthday Night";

  return { hostName, eventName };
}

function downloadCalendarInvite() {
  if (Number.isNaN(eventDate.getTime())) {
    return;
  }

  const { hostName, eventName } = getCalendarMeta();
  const endDate = new Date(
    eventDate.getTime() + eventDetails.durationHours * 60 * 60 * 1000
  );
  const fileStem = slugifyFilePart(hostName);
  const eventSlug = slugifyFilePart(`${hostName}-${eventName}`);

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//Birthday Night//EN",
    "BEGIN:VEVENT",
    `UID:${eventSlug}-${toICSDate(eventDate)}@birthday-night`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(eventDate)}`,
    `DTEND:${toICSDate(endDate)}`,
    `SUMMARY:${escapeICS(`${hostName}'s ${eventName}`)}`,
    `LOCATION:${escapeICS(eventDetails.address)}`,
    `DESCRIPTION:${escapeICS(
      `Join ${hostName} for a birthday celebration at ${eventDetails.venueName}.`
    )}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileStem}-birthday.ics`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function syncHeaderState() {
  siteHeader?.classList.toggle("is-scrolled", window.scrollY > 24);
}

function closeNav() {
  document.body.classList.remove("nav-open");
  navToggle?.setAttribute("aria-expanded", "false");
}

function setupNavigation() {
  navToggle?.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", closeNav);
  });

  window.addEventListener("scroll", syncHeaderState, { passive: true });
  syncHeaderState();
}

function setupRevealAnimation() {
  const revealItems = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function createSupabaseClient() {
  if (!window.supabase?.createClient) {
    return null;
  }

  if (
    !supabaseConfig?.url ||
    !supabaseConfig?.publishableKey ||
    supabaseConfig.publishableKey.startsWith("PASTE_")
  ) {
    return null;
  }

  const { createClient } = window.supabase;

  return createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

function setFormStatus(message, tone = "muted") {
  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset.tone = tone;
}

function setFormBusy(isBusy) {
  if (!submitButton) {
    return;
  }

  submitButton.disabled = isBusy;
  submitButton.textContent = isBusy ? "Saving..." : "Save registration";
}

function renderGroupOptions(groups) {
  if (!groupSelect) {
    return;
  }

  groupSelect.innerHTML = groups
    .map(
      (group) =>
        `<option value="${group.slug}">${group.name}</option>`
    )
    .join("");

  groupSelect.value = "default";
}

function syncGroupMode() {
  if (!groupModeInputs.length || !newGroupField || !newGroupInput || !groupSelect) {
    return;
  }

  const selectedMode =
    document.querySelector('input[name="group_mode"]:checked')?.value || "existing";
  const isCreatingGroup = selectedMode === "create";

  newGroupField.hidden = !isCreatingGroup;
  newGroupInput.required = isCreatingGroup;
  newGroupInput.disabled = !isCreatingGroup;
  groupSelect.disabled = isCreatingGroup;

  if (!isCreatingGroup) {
    newGroupInput.value = "";
  }
}

async function fetchGuestGroups(client) {
  if (!client) {
    return starterGroups;
  }

  const { data, error } = await client
    .from("guest_groups")
    .select("name, slug")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    setFormStatus(
      "Could not load groups from Supabase yet. Apply the SQL schema first, then refresh.",
      "warning"
    );
    return starterGroups;
  }

  return data?.length ? data : starterGroups;
}

function resolveSupabaseError(error) {
  const message = String(error?.message || error || "").trim();

  if (!message) {
    return "Something went wrong while saving the registration.";
  }

  if (/relation .* does not exist|function .* does not exist/i.test(message)) {
    return "Supabase is reachable, but the database schema is missing. Run the SQL file in the Supabase SQL editor first.";
  }

  if (/row-level security|permission denied|42501/i.test(message)) {
    return "Supabase rejected the request. Check the grants, RLS policies, and RPC function in the SQL setup file.";
  }

  if (/invalid api key|jwt|apikey/i.test(message)) {
    return "The Supabase publishable key looks invalid. Update supabase-config.js with the correct public key.";
  }

  if (/failed to fetch|networkerror|fetch/i.test(message)) {
    return "The page could not reach Supabase. Check the project URL, key, and network access.";
  }

  return message;
}

function setMusicStatus(message, tone = "muted") {
  if (!musicStatus) {
    return;
  }

  musicStatus.textContent = message;
  musicStatus.dataset.tone = tone;
}

function setMusicBusy(isBusy) {
  if (!musicSubmitButton) {
    return;
  }

  musicSubmitButton.disabled = isBusy;
  musicSubmitButton.textContent = isBusy
    ? "Saving profile..."
    : "Save music profile";
}

function parseTagInput(text) {
  return String(text || "")
    .split(/[,;\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function collectMusicValues(formData, fieldName, extraFieldName) {
  return uniqueValues([
    ...formData.getAll(fieldName).map((value) => String(value || "")),
    ...parseTagInput(formData.get(extraFieldName))
  ]);
}

function escapeHTML(text) {
  return String(text ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function renderChips(values, fallback) {
  const items = uniqueValues(values);

  if (!items.length) {
    return `<span class="music-chip music-chip-muted">${escapeHTML(fallback)}</span>`;
  }

  return items
    .map((value) => `<span class="music-chip">${escapeHTML(value)}</span>`)
    .join("");
}

function renderMusicProfiles(profiles) {
  if (!musicBoard) {
    return;
  }

  if (!profiles.length) {
    musicBoard.innerHTML = "";

    if (musicEmpty) {
      musicEmpty.hidden = false;
      musicEmpty.textContent =
        "No music profiles yet. Be the first person to claim a spot on the jam board.";
    }
    return;
  }

  musicBoard.innerHTML = profiles
    .map((profile) => {
      const availability = String(profile.availability_notes || "").trim();
      const sessionWish = String(profile.performance_notes || "").trim();

      return `
        <article class="music-card">
          <h3>${escapeHTML(profile.full_name || "Guest musician")}</h3>
          <div class="music-card-block">
            <span class="music-card-label">Instruments</span>
            <div class="music-chip-list">${renderChips(profile.instruments, "Open")}</div>
          </div>
          <div class="music-card-block">
            <span class="music-card-label">Styles</span>
            <div class="music-chip-list">${renderChips(profile.styles, "Flexible")}</div>
          </div>
          <div class="music-card-block">
            <span class="music-card-label">Genres</span>
            <div class="music-chip-list">${renderChips(profile.genres, "Mixed")}</div>
          </div>
          <div class="music-card-block">
            <span class="music-card-label">Looking for</span>
            <div class="music-chip-list">${renderChips(profile.collaboration_modes, "Open session")}</div>
          </div>
          ${
            availability
              ? `<div class="music-card-block"><span class="music-card-label">Availability</span><p class="music-card-note">${escapeHTML(availability)}</p></div>`
              : ""
          }
          ${
            sessionWish
              ? `<div class="music-card-block"><span class="music-card-label">Session note</span><p class="music-card-note">${escapeHTML(sessionWish)}</p></div>`
              : ""
          }
        </article>
      `;
    })
    .join("");

  if (musicEmpty) {
    musicEmpty.hidden = true;
  }
}

async function refreshMusicBoard(client) {
  if (!musicBoard) {
    return;
  }

  if (!client) {
    musicBoard.innerHTML = "";

    if (musicEmpty) {
      musicEmpty.hidden = false;
      musicEmpty.textContent =
        "Add your Supabase publishable key in supabase-config.js to load the music board.";
    }
    return;
  }

  const { data, error } = await client.rpc("list_music_profiles");

  if (error) {
    throw error;
  }

  renderMusicProfiles(Array.isArray(data) ? data : []);
}

function setMusicStageState(isActive) {
  musicStageActive = isActive;

  musicStageTargets.forEach(({ node, className }) => {
    node?.classList.toggle(className, isActive);
  });

  if (!musicToggleButton) {
    return;
  }

  musicToggleButton.textContent = isActive ? "Pause the groove" : "Start the groove";
  musicToggleButton.setAttribute("aria-pressed", String(isActive));
}

function toggleMusicStagePlayback() {
  const nextState = !musicStageActive;
  setMusicStageState(nextState);

  if (!musicAudio) {
    return;
  }

  if (nextState) {
    const playAttempt = musicAudio.play();

    playAttempt?.catch(() => {
      setMusicStatus(
        "The animation started, but audio playback was blocked by the browser.",
        "warning"
      );
    });
    return;
  }

  musicAudio.pause();
}

function setupMusicStage() {
  if (!musicToggleButton && !musicAudio) {
    return;
  }

  try {
    if (musicAudio) {
      musicAudio.currentTime = 7;
    }
  } catch (_error) {
    // Ignore browsers that block seeking before metadata is ready.
  }

  musicAudio?.addEventListener("ended", () => {
    setMusicStageState(false);

    try {
      musicAudio.currentTime = 7;
    } catch (_error) {
      // Ignore browsers that delay seeking until metadata is loaded.
    }
  });

  musicToggleButton?.addEventListener("click", toggleMusicStagePlayback);
  setMusicStageState(false);
  window.togglePlay = toggleMusicStagePlayback;
}

async function setupMusicPage() {
  if (!musicForm && !musicBoard && !musicToggleButton) {
    return;
  }

  setupMusicStage();

  const client = createSupabaseClient();

  musicRefreshButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await refreshMusicBoard(client);
      } catch (error) {
        setMusicStatus(resolveSupabaseError(error), "error");
      }
    });
  });

  if (musicBoard) {
    try {
      await refreshMusicBoard(client);
    } catch (error) {
      setMusicStatus(resolveSupabaseError(error), "error");
    }
  }

  if (!musicForm || !musicStatus) {
    return;
  }

  if (!client) {
    setMusicStatus(
      "Add your Supabase publishable key in supabase-config.js to save music profiles.",
      "warning"
    );

    if (musicSubmitButton) {
      musicSubmitButton.disabled = true;
    }
    return;
  }

  if (musicStatus.dataset.tone !== "error") {
    setMusicStatus(
      "Choose at least one instrument, one style, and one genre to join the board.",
      "muted"
    );
  }

  musicForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(musicForm);
    const firstName = String(formData.get("name") || "").trim();
    const surname = String(formData.get("surname") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const instruments = collectMusicValues(
      formData,
      "instruments",
      "other_instruments"
    );
    const styles = collectMusicValues(formData, "styles", "other_styles");
    const genres = collectMusicValues(formData, "genres", "other_genres");
    const collaborationModes = uniqueValues(
      formData.getAll("collaboration_modes").map((value) => String(value || ""))
    );
    const availabilityNotes = String(formData.get("availability_notes") || "").trim();
    const performanceNotes = String(formData.get("performance_notes") || "").trim();

    if (!firstName || !surname || !email) {
      setMusicStatus("Name, surname, and email are required.", "error");
      return;
    }

    if (!instruments.length || !styles.length || !genres.length) {
      setMusicStatus(
        "Select at least one instrument, one style, and one genre.",
        "error"
      );
      return;
    }

    setMusicBusy(true);
    setMusicStatus("Saving music profile to Supabase...", "muted");

    const { data, error } = await client.rpc("save_music_profile", {
      p_name: firstName,
      p_surname: surname,
      p_email: email,
      p_instruments: instruments,
      p_styles: styles,
      p_genres: genres,
      p_collaboration_modes: collaborationModes,
      p_availability_notes: availabilityNotes || null,
      p_performance_notes: performanceNotes || null
    });

    if (error) {
      setMusicBusy(false);
      setMusicStatus(resolveSupabaseError(error), "error");
      return;
    }

    const savedProfile = Array.isArray(data) ? data[0] : data;
    const savedMode = savedProfile?.saved_mode === "updated" ? "updated" : "saved";

    musicForm.reset();
    setMusicBusy(false);
    setMusicStatus(`Music profile ${savedMode}.`, "success");

    try {
      await refreshMusicBoard(client);
    } catch (refreshError) {
      setMusicStatus(resolveSupabaseError(refreshError), "warning");
    }
  });
}

async function setupRegistrationForm() {
  if (!form || !status) {
    return;
  }

  const client = createSupabaseClient();

  groupModeInputs.forEach((input) => {
    input.addEventListener("change", syncGroupMode);
  });
  syncGroupMode();

  renderGroupOptions(await fetchGuestGroups(client));

  if (!client) {
    setFormStatus(
      "Add your Supabase publishable key in supabase-config.js to enable live registrations.",
      "warning"
    );
    if (submitButton) {
      submitButton.disabled = true;
    }
    return;
  }

  if (status.dataset.tone !== "warning") {
    setFormStatus(
      "Email is unique: submitting again with the same email updates the existing registration.",
      "muted"
    );
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const firstName = String(formData.get("name") || "").trim();
    const surname = String(formData.get("surname") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const guestsCount = Number(formData.get("guests") || 1);
    const notes = String(formData.get("notes") || "").trim();
    const groupMode = String(formData.get("group_mode") || "existing");
    const groupSlug = String(formData.get("group_slug") || "default");
    const newGroupName = String(formData.get("new_group_name") || "").trim();

    if (!firstName || !surname || !email) {
      setFormStatus("Name, surname, and email are required.", "error");
      return;
    }

    if (groupMode === "create" && !newGroupName) {
      setFormStatus("Write the name of the new group first.", "error");
      return;
    }

    setFormBusy(true);
    setFormStatus("Saving registration to Supabase...", "muted");

    const { data, error } = await client.rpc("register_guest", {
      p_name: firstName,
      p_surname: surname,
      p_email: email,
      p_guests_count: guestsCount,
      p_notes: notes || null,
      p_group_slug: groupMode === "existing" ? groupSlug : "default",
      p_new_group_name: groupMode === "create" ? newGroupName : null
    });

    if (error) {
      setFormBusy(false);
      setFormStatus(resolveSupabaseError(error), "error");
      return;
    }

    const savedRegistration = Array.isArray(data) ? data[0] : data;
    const savedMode = savedRegistration?.saved_mode === "updated" ? "updated" : "saved";
    const savedGroup = savedRegistration?.group_name
      ? ` in ${savedRegistration.group_name}`
      : "";
    const thankYouUrl = buildThankYouUrl({
      firstName,
      groupName:
        savedRegistration?.group_name ||
        (groupMode === "create"
          ? newGroupName
          : groupSelect?.selectedOptions?.[0]?.textContent.trim() || ""),
      guestsCount,
      savedMode
    });

    setFormBusy(false);
    setFormStatus(`Registration ${savedMode}${savedGroup}. Redirecting...`, "success");
    window.location.assign(thankYouUrl);
  });
}

populateEventContent();
populateThankYouPage();

document.querySelectorAll("[data-download-ics]").forEach((button) => {
  button.addEventListener("click", downloadCalendarInvite);
});

updateCountdown();
if (countdownTargets.days && !Number.isNaN(eventDate.getTime())) {
  window.setInterval(updateCountdown, 1000);
}

setupNavigation();
setupRevealAnimation();
setupRegistrationForm().catch((error) => {
  setFormStatus(resolveSupabaseError(error), "error");
});
setupMusicPage().catch((error) => {
  setMusicStatus(resolveSupabaseError(error), "error");
});
