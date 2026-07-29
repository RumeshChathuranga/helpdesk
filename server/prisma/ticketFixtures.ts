import type { TicketCategory, TicketStatus } from "@prisma/client";

export type TicketFixture = {
  externalMessageId: string;
  subject: string;
  body: string;
  status: TicketStatus;
  category: TicketCategory;
  fromEmail: string;
  fromName: string | null;
  createdAt: Date;
};

const STATUSES: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

const SCENARIOS: Array<{
  subject: string;
  body: string;
  category: TicketCategory;
  fromName: string;
  fromEmail: string;
}> = [
  // ── Account access ──────────────────────────────────────────────────────
  {
    subject: "Cannot reset my UoM account password",
    body: "The password reset page keeps saying my new password does not meet the policy, but I copied it from the guidelines. Tried three times already.",
    category: "ACCOUNT_ACCESS",
    fromName: "Kavindu Thennakoon",
    fromEmail: "kavindut.22@cse.mrt.ac.lk",
  },
  {
    subject: "Account locked after multiple failed logins",
    body: "I mistyped my password a few times this morning and now the portal says my account is locked. Need it unlocked as soon as possible.",
    category: "ACCOUNT_ACCESS",
    fromName: "Nimesha Silva",
    fromEmail: "nimeshas.21@ent.mrt.ac.lk",
  },
  {
    subject: "New account activation for postgraduate registration",
    body: "I was admitted to the MSc programme last week and still cannot log in to any university system. Registration closes on Friday.",
    category: "ACCOUNT_ACCESS",
    fromName: "Ruwan Jayasuriya",
    fromEmail: "ruwanj.24@civil.mrt.ac.lk",
  },
  {
    subject: "OTP not received during password reset",
    body: "The password reset flow says an OTP was sent to my mobile number but nothing has arrived after 20 minutes.",
    category: "ACCOUNT_ACCESS",
    fromName: "Dilani Fernando",
    fromEmail: "dilanif@uom.lk",
  },
  {
    subject: "Account still shows old department after transfer",
    body: "I transferred from the Civil department to Mechanical last month but my UoM account still lists the old department in the directory.",
    category: "ACCOUNT_ACCESS",
    fromName: "Prasad Wickramasinghe",
    fromEmail: "prasadw@mech.mrt.ac.lk",
  },
  {
    subject: "Need an account created for a visiting lecturer",
    body: "We have a visiting lecturer joining for the semester and need a UoM account with email and Moodle access set up before Monday.",
    category: "ACCOUNT_ACCESS",
    fromName: "Department Coordinator",
    fromEmail: "coord.elect@uom.lk",
  },

  // ── Email ────────────────────────────────────────────────────────────────
  {
    subject: "Cannot configure UoM email on iPhone Mail app",
    body: "Followed the sync instructions on the CITeS site but the Mail app keeps rejecting my credentials with a server error.",
    category: "EMAIL",
    fromName: "Sanduni Perera",
    fromEmail: "sandunip.23@is.mrt.ac.lk",
  },
  {
    subject: "Mailing list subscription request for department list",
    body: "Could you add three new lecturers to the departmental staff mailing list? Names and emails are in the attached form.",
    category: "EMAIL",
    fromName: "Admin Officer",
    fromEmail: "admin.arch@uom.lk",
  },
  {
    subject: "Need the standard email signature template",
    body: "New to the department and would like the official CITeS signature block for outgoing correspondence.",
    category: "EMAIL",
    fromName: "Dr. Anjali Wickramasinghe",
    fromEmail: "anjaliw@cse.mrt.ac.lk",
  },
  {
    subject: "WebMail login shows a blank page",
    body: "WebMail loads the login form but after entering my credentials the page goes blank instead of opening the inbox.",
    category: "EMAIL",
    fromName: "Tharindu Rathnayake",
    fromEmail: "tharindur.20@mat.mrt.ac.lk",
  },
  {
    subject: "Emails to external addresses bouncing",
    body: "Messages I send to gmail.com and yahoo.com addresses are bouncing back with a relay error since yesterday afternoon.",
    category: "EMAIL",
    fromName: "Registrar's Office",
    fromEmail: "registrar@uom.lk",
  },

  // ── Network ──────────────────────────────────────────────────────────────
  {
    subject: "VPN client will not install on Windows 11",
    body: "The VPN installer from the CITeS support page fails partway through with error 1603. I need VPN access to reach the library databases from home.",
    category: "NETWORK",
    fromName: "Chamara Bandara",
    fromEmail: "chamarab@elect.mrt.ac.lk",
  },
  {
    subject: "DNS request for a new departmental subdomain",
    body: "We would like a subdomain set up for our new research group website, pointing to our lab server's IP address.",
    category: "NETWORK",
    fromName: "Systems Engineer",
    fromEmail: "sysadmin.chem@uom.lk",
  },
  {
    subject: "IP phone not registering",
    body: "The desk phone in room EE204 shows unregistered on the display and has had no dial tone since the weekend.",
    category: "NETWORK",
    fromName: "Office Assistant",
    fromEmail: "office.elect@uom.lk",
  },
  {
    subject: "Proxy server blocking an academic journal site",
    body: "Trying to access a paper through the external proxy but it returns access denied even though the journal is in our subscription list.",
    category: "NETWORK",
    fromName: "Ishara Gunasekara",
    fromEmail: "isharag.22@bio.mrt.ac.lk",
  },

  // ── Wi-Fi / eduroam ──────────────────────────────────────────────────────
  {
    subject: "eduroam not connecting in the library",
    body: "My laptop connects to eduroam everywhere else on campus but keeps failing authentication on the third floor of the library.",
    category: "WIFI_EDUROAM",
    fromName: "Sachini Perera",
    fromEmail: "sachinip.22@cse.mrt.ac.lk",
  },
  {
    subject: "Wi-Fi drops every few minutes in the hostel",
    body: "eduroam disconnects roughly every ten minutes in my hostel room and I have to forget and reconnect each time.",
    category: "WIFI_EDUROAM",
    fromName: "Dinuka Wijesinghe",
    fromEmail: "dinukaw.23@mech.mrt.ac.lk",
  },
  {
    subject: "eduroam certificate error on Android",
    body: "My phone shows a certificate could not be verified warning whenever I try to join eduroam on campus.",
    category: "WIFI_EDUROAM",
    fromName: "Amaya Rodrigo",
    fromEmail: "amayar.21@civil.mrt.ac.lk",
  },
  {
    subject: "No Wi-Fi signal in the new lab building",
    body: "The new structures lab building does not seem to have any eduroam coverage yet. Staff and students there have no connectivity.",
    category: "WIFI_EDUROAM",
    fromName: "Lab Coordinator",
    fromEmail: "labcoord.civil@uom.lk",
  },
  {
    subject: "eduroam works on phone but not laptop",
    body: "eduroam connects fine on my phone but my laptop just keeps asking for credentials and never actually connects.",
    category: "WIFI_EDUROAM",
    fromName: "Buddhika Senanayake",
    fromEmail: "buddhikas.20@mat.mrt.ac.lk",
  },

  // ── LMS (Moodle) ─────────────────────────────────────────────────────────
  {
    subject: "Moodle quiz submission failed during the mid-semester test",
    body: "I clicked submit at the end of the timed quiz and got a session expired error. The quiz now shows as not attempted.",
    category: "LMS_MOODLE",
    fromName: "Yasas Kodithuwakku",
    fromEmail: "yasask.22@cse.mrt.ac.lk",
  },
  {
    subject: "Cannot enrol in a module on Moodle",
    body: "The enrolment key I was given for the elective module is not being accepted by Moodle.",
    category: "LMS_MOODLE",
    fromName: "Hasini Madushanka",
    fromEmail: "hasinim.23@ent.mrt.ac.lk",
  },
  {
    subject: "Moodle course content not visible",
    body: "My timetable shows I am registered for the module but the Moodle course page says I do not have access.",
    category: "LMS_MOODLE",
    fromName: "Kasun Abeywardena",
    fromEmail: "kasuna.21@elect.mrt.ac.lk",
  },
  {
    subject: "Assignment upload fails with a file size error",
    body: "Moodle rejects my assignment PDF as too large even though it is under the stated 20MB limit.",
    category: "LMS_MOODLE",
    fromName: "Nadeesha Ranasinghe",
    fromEmail: "nadeeshar.22@bio.mrt.ac.lk",
  },
  {
    subject: "Moodle password reset is separate from my UoM account",
    body: "I reset my main UoM password but Moodle still asks for the old one. Are the two logins linked or separate?",
    category: "LMS_MOODLE",
    fromName: "Oshadha Perera",
    fromEmail: "oshadhap.24@mine.mrt.ac.lk",
  },
  {
    subject: "Lecturer cannot add students to a Moodle course",
    body: "I am trying to manually enrol a few late-registered students into my Moodle course but the enrol button does nothing.",
    category: "LMS_MOODLE",
    fromName: "Dr. Malinda Gunawardena",
    fromEmail: "malindag@cse.mrt.ac.lk",
  },

  // ── LearnOrg / MIS ───────────────────────────────────────────────────────
  {
    subject: "Exam results not showing in LearnOrg",
    body: "Results for last semester's modules were released according to the notice but my LearnOrg profile still shows pending for two subjects.",
    category: "LEARNORG_MIS",
    fromName: "Thilina Wickramasuriya",
    fromEmail: "thilinaw.21@is.mrt.ac.lk",
  },
  {
    subject: "Postgraduate registration module error",
    body: "The MIS postgraduate registration page throws an internal error whenever I try to confirm my module selections.",
    category: "LEARNORG_MIS",
    fromName: "Sewwandi Karunaratne",
    fromEmail: "sewwandik.24@town.mrt.ac.lk",
  },
  {
    subject: "SRC module shows the wrong semester",
    body: "The Student Record module is still displaying last semester's data for our batch even after the new semester started.",
    category: "LEARNORG_MIS",
    fromName: "Senior Assistant Registrar",
    fromEmail: "src@uom.lk",
  },
  {
    subject: "Repeat student missing from the marks sheet",
    body: "A repeat-registered student in our module does not appear on the LearnOrg marks sheet even though they sat the exam.",
    category: "LEARNORG_MIS",
    fromName: "Examinations Branch",
    fromEmail: "exams@uom.lk",
  },

  // ── ERP / DMS ────────────────────────────────────────────────────────────
  {
    subject: "Purchase requisition stuck in DMS approval",
    body: "A lab equipment requisition has been sitting at the department head approval step in DMS for over a week with no notification sent.",
    category: "ERP_DMS",
    fromName: "Finance Officer",
    fromEmail: "finance@uom.lk",
  },
  {
    subject: "ERP leave application not submitting",
    body: "I filled in my annual leave request in the ERP system but the submit button just spins and nothing is saved.",
    category: "ERP_DMS",
    fromName: "Administrative Assistant",
    fromEmail: "admin.mech@uom.lk",
  },
  {
    subject: "DMS document upload fails",
    body: "Trying to attach a scanned approval letter to a DMS workflow but the upload fails every time at around 90 percent.",
    category: "ERP_DMS",
    fromName: "Procurement Officer",
    fromEmail: "procurement@uom.lk",
  },
  {
    subject: "ERP payroll slip not generated",
    body: "This month's payroll slip has not appeared in the ERP self-service portal, unlike previous months.",
    category: "ERP_DMS",
    fromName: "HR Division",
    fromEmail: "hr@uom.lk",
  },

  // ── Software & licensing ────────────────────────────────────────────────
  {
    subject: "MATLAB campus licence server unreachable",
    body: "MATLAB reports it cannot reach the licence server from any of the machines in the Electrical department lab.",
    category: "SOFTWARE_LICENSING",
    fromName: "Lab Technician",
    fromEmail: "labtech.elect@uom.lk",
  },
  {
    subject: "Need Office 365 academic activation",
    body: "I am unable to activate the free Office 365 subscription with my UoM email — it says the account is not eligible.",
    category: "SOFTWARE_LICENSING",
    fromName: "Chathumi Wijeratne",
    fromEmail: "chathumiw.23@arch.mrt.ac.lk",
  },
  {
    subject: "SPSS licence expired for research lab",
    body: "The SPSS installation in our postgraduate research lab says the licence expired, blocking a group of students from their analysis work.",
    category: "SOFTWARE_LICENSING",
    fromName: "Research Coordinator",
    fromEmail: "research.mat@uom.lk",
  },
  {
    subject: "AutoCAD licence request for final year project",
    body: "Our final year design group needs AutoCAD licensed on three lab computers for the remainder of the semester.",
    category: "SOFTWARE_LICENSING",
    fromName: "Ishan Ratnayake",
    fromEmail: "ishanr.20@civil.mrt.ac.lk",
  },

  // ── Zoom & conferencing ──────────────────────────────────────────────────
  {
    subject: "Zoom licence for a departmental webinar",
    body: "We are hosting a public webinar with around 300 attendees next month and need a licensed Zoom account that supports that capacity.",
    category: "ZOOM_CONFERENCING",
    fromName: "Department Coordinator",
    fromEmail: "coord.mech@uom.lk",
  },
  {
    subject: "Zoom meeting recording not saving",
    body: "Recorded yesterday's lecture on Zoom but the recording never appeared in the cloud recordings list.",
    category: "ZOOM_CONFERENCING",
    fromName: "Dr. Roshan de Silva",
    fromEmail: "roshand@elect.mrt.ac.lk",
  },
  {
    subject: "Cannot host a meeting longer than 40 minutes",
    body: "My Zoom account keeps cutting meetings off at 40 minutes even though I was told staff accounts are unrestricted.",
    category: "ZOOM_CONFERENCING",
    fromName: "Teaching Assistant",
    fromEmail: "ta.cse@uom.lk",
  },
  {
    subject: "Zoom link not working for an online lecture",
    body: "The Zoom link posted on Moodle for today's lecture gives an invalid meeting ID error.",
    category: "ZOOM_CONFERENCING",
    fromName: "Vindya Perera",
    fromEmail: "vindyap.22@qs.mrt.ac.lk",
  },

  // ── Web hosting ──────────────────────────────────────────────────────────
  {
    subject: "Department website not updating",
    body: "We uploaded new staff photos and a new notice to the departmental website last week but the live site still shows the old content.",
    category: "WEB_HOSTING",
    fromName: "Web Editor",
    fromEmail: "webedit.arch@uom.lk",
  },
  {
    subject: "Personal academic page is down",
    body: "My staff profile page has been returning a 500 error for two days, and students say they cannot reach my publications list.",
    category: "WEB_HOSTING",
    fromName: "Prof. Manoj Ratnayake",
    fromEmail: "manojr@civil.mrt.ac.lk",
  },
  {
    subject: "SSL certificate expired on faculty site",
    body: "Browsers are showing a not secure warning for the faculty website, it looks like the SSL certificate has expired.",
    category: "WEB_HOSTING",
    fromName: "Faculty Office",
    fromEmail: "office.eng@uom.lk",
  },

  // ── Hardware ─────────────────────────────────────────────────────────────
  {
    subject: "Lab printer offline",
    body: "The shared printer in the third floor computer lab has shown offline on every machine since yesterday's power outage.",
    category: "HARDWARE",
    fromName: "Lab Assistant",
    fromEmail: "labassist.cse@uom.lk",
  },
  {
    subject: "Projector not working in lecture hall",
    body: "The projector in New Lecture Hall 3 will not turn on and lectures are having to be rescheduled to another room.",
    category: "HARDWARE",
    fromName: "Facilities Officer",
    fromEmail: "facilities@uom.lk",
  },
  {
    subject: "Desktop computer will not boot in the computer lab",
    body: "One of the workstations in the Level 2 computer lab shows a black screen with no boot activity after the weekend maintenance.",
    category: "HARDWARE",
    fromName: "Computer Lab Supervisor",
    fromEmail: "labsupervisor@uom.lk",
  },

  // ── Other ────────────────────────────────────────────────────────────────
  {
    subject: "General inquiry about IT services available to students",
    body: "I am a new student and would like to know what IT services and software are available to me through the university.",
    category: "OTHER",
    fromName: "Yohan Dissanayake",
    fromEmail: "yohand.25@is.mrt.ac.lk",
  },
  {
    subject: "Feedback about help desk response time",
    body: "Just wanted to note that my last ticket took quite a while to get a first response — flagging it in case it is useful feedback.",
    category: "OTHER",
    fromName: "Staff Member",
    fromEmail: "feedback@uom.lk",
  },
];

export function buildTicketFixtures(count = 100): TicketFixture[] {
  const now = Date.now();
  const fixtures: TicketFixture[] = [];

  for (let i = 0; i < count; i++) {
    const scenario = SCENARIOS[i % SCENARIOS.length]!;
    const status = STATUSES[i % STATUSES.length]!;
    const dayOffset = i * 6 * 60 * 60 * 1000 + (i % 7) * 45 * 60 * 1000;
    const suffix = i >= SCENARIOS.length ? ` (#${i + 1})` : "";

    fixtures.push({
      externalMessageId: `seed-demo-${String(i + 1).padStart(3, "0")}`,
      subject: `${scenario.subject}${suffix}`,
      body: scenario.body,
      status,
      category: scenario.category,
      fromEmail: scenario.fromEmail,
      fromName: i % 12 === 0 ? null : scenario.fromName,
      createdAt: new Date(now - dayOffset),
    });
  }

  return fixtures;
}
