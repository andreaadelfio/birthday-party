const eventDetails = {
  isoDate: "2026-07-30T19:30:00+02:00",
  displayDate: "Thursday, July 30, 2026",
  displayTime: "7:30 PM until late",
  durationHours: 6,
  venueName: "Ficarazzi",
  address: "Via Example 24, Rome, Italy",
  contactEmail: "and.adelfio@gmail.com"
};

const eventDateElement = document.querySelector("time[data-display-date]");
const contactLink = document.querySelector("[data-contact-link]");
const countdownTargets = {
  days: document.getElementById("days"),
  hours: document.getElementById("hours"),
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds")
};
const form = document.getElementById("rsvp-form");
const status = document.getElementById("form-status");
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelectorAll(".site-nav a");
const siteHeader = document.querySelector(".site-header");

const hostName =
  document.querySelector(".hero [data-host-name]")?.textContent.trim() || "Host";
const eventName =
  document.querySelector(".hero [data-event-name]")?.textContent.trim() || "Event";
const displayDate = eventDetails.displayDate;
const displayTime = eventDetails.displayTime;
const eventDate = new Date(eventDetails.isoDate);
const eventDurationHours = eventDetails.durationHours;
const venueName = eventDetails.venueName;
const address = eventDetails.address;
const contactEmail = eventDetails.contactEmail;

document.querySelectorAll("[data-display-date]").forEach((node) => {
  node.textContent = displayDate;
});

document.querySelectorAll("[data-display-time]").forEach((node) => {
  node.textContent = displayTime;
});

if (eventDateElement) {
  eventDateElement.dateTime = eventDetails.isoDate;
}

document.querySelectorAll("[data-venue-name]").forEach((node) => {
  node.textContent = venueName;
});

document.querySelectorAll("[data-address]").forEach((node) => {
  node.textContent = address;
});

document.querySelectorAll("[data-contact-email]").forEach((node) => {
  node.textContent = contactEmail;
});

if (contactLink) {
  contactLink.href = `mailto:${contactEmail}`;
}

const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  address
)}`;

document.querySelectorAll("[data-map-link]").forEach((link) => {
  link.href = mapUrl;
  link.target = "_blank";
  link.rel = "noreferrer";
});

function updateCountdown() {
  if (!eventDate || Number.isNaN(eventDate.getTime())) {
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

if (countdownTargets.days && eventDate && !Number.isNaN(eventDate.getTime())) {
  updateCountdown();
  window.setInterval(updateCountdown, 1000);
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

function downloadCalendarInvite() {
  if (!eventDate || Number.isNaN(eventDate.getTime())) {
    return;
  }

  const endDate = new Date(
    eventDate.getTime() + eventDurationHours * 60 * 60 * 1000
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
    `SUMMARY:${escapeICS(`${hostName}'s ${eventName}`)}`,
    `LOCATION:${escapeICS(address)}`,
    `DESCRIPTION:${escapeICS(
      `Join ${hostName} for a birthday celebration at ${venueName}.`
    )}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${hostName.toLowerCase().replace(/\s+/g, "-")}-birthday.ics`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

document.querySelectorAll("[data-download-ics]").forEach((button) => {
  button.addEventListener("click", downloadCalendarInvite);
});

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

    if (!contactEmail) {
      status.textContent = "Add a contact email in the HTML first.";
      return;
    }

    const subject = `RSVP for ${hostName}'s ${eventName}`;
    const body = [
      `Hi ${hostName},`,
      "",
      `I'd love to join your party.`,
      `Name: ${name}`,
      `Email: ${email}`,
      `Guests: ${guests}`,
      `Message: ${notes || "No additional notes"}`,
      "",
      `See you on ${displayDate}.`
    ].join("\n");

    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    status.textContent =
      "Your email app should open with a ready-to-send RSVP message.";
    form.reset();
  });
}

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
