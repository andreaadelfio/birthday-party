// Central event settings: update these values to personalize the whole page quickly.
const partyConfig = {
  hostName: "TED",
  eventName: "Birthday Night",
  eventTagline: "Big-stage energy. Birthday-level joy.",
  isoDate: "2026-07-30T19:30:00+02:00",
  displayDate: "Friday, July 30, 2026",
  displayTime: "7:30 PM until late",
  venueName: "My garden",
  address: "Via Example !!! 24, Ficarazzi, Italy",
  cityLabel: "Ficarazzi",
  rsvpDeadline: "July 4, 2026",
  contactEmail: "and.adelfio@gmail.com",
  mapQuery: "Via Example 24, Ficarazzi, Italy",
  eventDurationHours: 6,
  backgroundImages: {
    hero: {
      url: "",
      position: "center center"
    },
    countdown: {
      url: "",
      position: "center center"
    },
    venue: {
      url: "",
      position: "center center"
    }
  }
};

const textBindings = [
  ["[data-host-name]", partyConfig.hostName],
  ["[data-event-name]", partyConfig.eventName],
  ["[data-display-date]", partyConfig.displayDate],
  ["[data-display-time]", partyConfig.displayTime],
  ["[data-venue-name]", partyConfig.venueName],
  ["[data-address]", partyConfig.address],
  ["[data-city-label]", partyConfig.cityLabel],
  ["[data-rsvp-deadline]", partyConfig.rsvpDeadline],
  ["[data-contact-email]", partyConfig.contactEmail]
];

textBindings.forEach(([selector, value]) => {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
});

const hostInitial = document.querySelector("[data-host-initial]");
if (hostInitial) {
  hostInitial.textContent = partyConfig.hostName.charAt(0).toUpperCase();
}

document.title = `${partyConfig.hostName}'s ${partyConfig.eventName}`;

function escapeCssUrl(url) {
  return String(url).replace(/["\\]/g, "\\$&");
}

function applyBackgroundImage(sectionName, config) {
  if (!config || !config.url) {
    return;
  }

  document.documentElement.style.setProperty(
    `--${sectionName}-bg-image`,
    `url("${escapeCssUrl(config.url)}")`
  );

  if (config.position) {
    document.documentElement.style.setProperty(
      `--${sectionName}-bg-position`,
      config.position
    );
  }
}

applyBackgroundImage("hero", partyConfig.backgroundImages.hero);
applyBackgroundImage("countdown", partyConfig.backgroundImages.countdown);
applyBackgroundImage("venue", partyConfig.backgroundImages.venue);

const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  partyConfig.mapQuery
)}`;

document.querySelectorAll("[data-map-link]").forEach((link) => {
  link.href = mapUrl;
  link.target = "_blank";
  link.rel = "noreferrer";
});

const contactLink = document.querySelector("[data-contact-link]");
if (contactLink) {
  contactLink.href = `mailto:${partyConfig.contactEmail}`;
}

const countdownTargets = {
  days: document.getElementById("days"),
  hours: document.getElementById("hours"),
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds")
};

const eventDate = new Date(partyConfig.isoDate);

function updateCountdown() {
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

updateCountdown();
window.setInterval(updateCountdown, 1000);

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

function downloadCalendarInvite() {
  const endDate = new Date(
    eventDate.getTime() + partyConfig.eventDurationHours * 60 * 60 * 1000
  );

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Birthday Night//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@birthday-night`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(eventDate)}`,
    `DTEND:${toICSDate(endDate)}`,
    `SUMMARY:${escapeICS(`${partyConfig.hostName}'s ${partyConfig.eventName}`)}`,
    `LOCATION:${escapeICS(partyConfig.address)}`,
    `DESCRIPTION:${escapeICS(
      `Join ${partyConfig.hostName} for a birthday celebration at ${partyConfig.venueName}.`
    )}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${partyConfig.hostName.toLowerCase()}-birthday.ics`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

document.querySelectorAll("[data-download-ics]").forEach((button) => {
  button.addEventListener("click", downloadCalendarInvite);
});

const form = document.getElementById("rsvp-form");
const status = document.getElementById("form-status");

if (form && status) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const guests = String(formData.get("guests") || "1");
    const notes = String(formData.get("notes") || "").trim();

    if (!name || !email) {
      status.textContent = "Please fill in your name and email first.";
      return;
    }

    const subject = `RSVP for ${partyConfig.hostName}'s ${partyConfig.eventName}`;
    const body = [
      `Hi ${partyConfig.hostName},`,
      "",
      `I'd love to join your party.`,
      `Name: ${name}`,
      `Email: ${email}`,
      `Guests: ${guests}`,
      `Message: ${notes || "No additional notes"}`,
      "",
      `See you on ${partyConfig.displayDate}.`
    ].join("\n");

    window.location.href = `mailto:${partyConfig.contactEmail}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    status.textContent =
      "Your email app should open with a ready-to-send RSVP message.";
    form.reset();
  });
}

const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelectorAll(".site-nav a");
const siteHeader = document.querySelector(".site-header");

function syncHeaderState() {
  siteHeader?.classList.toggle("is-scrolled", window.scrollY > 24);
}

function closeNav() {
  document.body.classList.remove("nav-open");
  navToggle?.setAttribute("aria-expanded", "false");
}

navToggle?.addEventListener("click", () => {
  const isOpen = document.body.classList.toggle("nav-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

navLinks.forEach((link) => {
  link.addEventListener("click", closeNav);
});

window.addEventListener("scroll", syncHeaderState, { passive: true });
syncHeaderState();

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
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
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}
