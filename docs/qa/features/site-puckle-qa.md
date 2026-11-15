# Puckle Website & Membership — Manual QA Checklist

**120 practical checks | iPhone-first | Phases 1–7 and approved refinements**  
**Prepared:** 15 November 2026  
**Scope:** Puckle public website, Join, teacher/interested journeys, login and recovery UI, tuition enquiries, registration welcome, onboarding, parental approval, public-publishing feedback, and existing-account compatibility.

> **How to use this:** These checks prioritise *what a person can see, understand and operate*, plus a small number of end-to-end smoke tests. Automated tests already cover many security, concurrency and data-integrity edge cases. You do **not** need to repeat every backend test by hand.
>
> Work through the main learner journey first. Use a separate fresh test registration when necessary. Mark a check **N/A** if the relevant fixture or route is not available; do not change the production database to make a test possible.

## Test setup and important limits

- **Last reported iPhone test server:** `http://192.168.1.38:4181` (use only if it is still running and reachable). For Join: `http://192.168.1.38:4181/join`.
- **Disposable review server command (Mac, repository):** `npm run dev:phase2 -- --info-cards --lan`.
- **Project directory:** `/Users/peterdomokos/projects/step-visuals`.
- **Fixture accounts reported by the project:** `young`, `young2` (under 16), `phase2`, `other`, and `unapproved`; test password `local-test-only`. Confirm which fixtures are seeded by the currently running runner.
- **Verification codes, parent links, and simulated email texts:** run `tail -f /Users/peterdomokos/projects/step-visuals/phase2-test-results/phone-review.log` in a Mac Terminal. Look for the newest code or `Phone link`. `Ctrl+C` stops following the log.
- **Real email is not enabled in this review environment.** A code or parent link appearing in the local log, **not** in Gmail/Outlook, is expected. Real inbox delivery belongs to later Phase 8 configuration and testing.
- **Newly created accounts in the disposable environment are separate from the 11 existing real accounts.** Do not alter real Atlas data just to perform these checks.
- **Public publishing:** the `unapproved` fixture is for greyed-out Public behaviour. An approved fixture such as `phase2` is for the ordinary available Public option. If a fixture differs, have the coding agent confirm its local permissions.
- **Parent approval does not yet enforce Group Experience entry.** This project implements the approval records and UI; Group runtime enforcement is separate work.
- **Tester notes:** For any issue, record the checklist ID, page, account/age scenario, what you tapped, expected versus actual result, and a screenshot or short screen recording. Label visual/UI issues separately from broken journeys.

**Outcome key:** `[ ]` not tested · `[x]` passed · `N/A` not applicable · `FAIL` note issue below item.

---

## A. Test environment, sign-in states and first impressions (001–010)

- [ ] **001. Reach the app on iPhone:** The test URL opens over Wi-Fi without switching to a different server or showing a connection error.
- [ ] **002. Confirm disposable context:** The review server and fixture accounts are the local test setup, not the live Atlas-backed website.
- [ ] **003. Fresh signed-out visit:** Opening the Puckle homepage while signed out looks correct and does not unexpectedly open an authenticated app screen.
- [ ] **004. Recognisable branding:** Page title, logo, headings and primary calls to action all clearly say Puckle where expected.
- [ ] **005. Header at phone width:** The header/navigation is readable, does not overlap page content, and is easy to operate with a thumb.
- [ ] **006. Join entry point:** The header's **Join** action reaches the correct Join page directly, without an unnecessary intermediate chooser.
- [ ] **007. Tuition entry point:** **Request a free session** reaches or scrolls to the existing tuition enquiry form, not the Join form.
- [ ] **008. Join-to-tuition navigation:** From Join, you can reach the tuition journey without hunting through the homepage.
- [ ] **009. Tuition-to-Join navigation:** From the tuition area, you can find Join easily, without confusing a tuition enquiry with account registration.
- [ ] **010. General feel:** Initial loading, scrolling, font rendering and tap feedback feel polished rather than like a development form.

## B. Public Puckle website and information pages (011–020)

- [ ] **011. Homepage hierarchy:** It is immediately clear that Puckle helps people learn maths and what the main next action is.
- [ ] **012. Maths proposition:** Text about maths learning, the app and tuition is understandable to a Leaving Cert student.
- [ ] **013. Tuition proposition:** The offer of an initial free 20–30-minute session is clear without implying instant booking.
- [ ] **014. Primary actions:** Join and tuition actions are distinguishable; the page does not make the same action appear under contradictory labels.
- [ ] **015. Internal links:** Main navigation links go to the expected sections/pages without dead ends or unexplained redirects.
- [ ] **016. About page:** Puckle's purpose and voice feel appropriate, with no stray Strat17/Switchplay branding in unrelated copy.
- [ ] **017. Contact page:** Contact details or contact method are easy to find, and the wording makes clear when an enquiry is more appropriate than Join.
- [ ] **018. Privacy page:** It is reachable from the public website and readable on an iPhone without sideways scrolling.
- [ ] **019. Shared-account explanation:** Where relevant, the privacy wording explicitly names Puckle, Switchplay and Strat17 and is understandable to a parent.
- [ ] **020. Footer and small links:** Contact, About, Privacy and any other visible footer links remain tappable and correctly spaced at phone width.

## C. Join page — student form and field usability (021–030)

- [ ] **021. Join layout:** `/join` opens with **I'm here to learn** selected by default; the three choices are understandable.
- [ ] **022. Choice switching:** Switching learner ↔ teacher ↔ interested feels smooth and preserves reasonable in-progress entries.
- [ ] **023. Student first name:** Name field, label, keyboard and validation feel natural; it is obvious what name to enter.
- [ ] **024. Username guidance:** Username constraints are easy to understand and a mistaken entry produces useful feedback.
- [ ] **025. Password guidance:** The 12-character minimum is understandable, and typing/pasting a longer password is comfortable on the phone.
- [ ] **026. Email field:** Email keyboard and autofill behave sensibly; the field does not autocorrect or unexpectedly alter the address.
- [ ] **027. Mobile field:** Mobile is visible on the learner form, optional when email is present, and the country-code picker works on iPhone.
- [ ] **028. DOB fields:** Separate day/month/year inputs fit comfortably and are not fiddly with the numeric keyboard.
- [ ] **029. Course choices:** Leaving Cert, Junior Cycle, GCSE, A-level, Other and Don't know are clearly presented and easy to select.
- [ ] **030. A-level Level rule:** Selecting **A-level** hides the Level field entirely; switching back restores the relevant Level choice without confusing stale values.

## D. Student registration, verification and completion (031–040)

- [ ] **031. Leaving Cert level:** Leaving Cert exposes appropriate Higher/Ordinary choices; the default and selection are visually clear.
- [ ] **032. Under-13 feedback:** Enter an obviously under-13 DOB and check that the user-facing explanation is clear and not intimidating.
- [ ] **033. Under-16 copy:** For a 13–15-year-old, the private-learning/guardian wording feels reassuring and age-appropriate.
- [ ] **034. Validation recovery:** After correcting a missing/invalid field, previously entered valid fields remain intact.
- [ ] **035. Continue to verification:** The transition from completed student details to the six-digit code step feels deliberate and understandable.
- [ ] **036. Find the code locally:** The newest six-digit code is easy to identify in the Mac review log and matches the registration attempt.
- [ ] **037. Enter or paste code:** Six-digit entry, paste, keyboard focus and error feedback all feel comfortable on the iPhone.
- [ ] **038. Resend experience:** The resend timer and wording tell the user what to do without appearing broken or trapping them.
- [ ] **039. Registration success cover:** The full-screen Puckle welcome enters smoothly, stays readable around five seconds, exits smoothly, and does not flash the old form or half-loaded My Decks.
- [ ] **040. Open Puckle / arrival:** The skip button works; otherwise the transition ends naturally at **My Decks**, with the new account signed in and no unexpected extra login.

## E. Teacher, Interested and no-email journeys (041–050)

- [ ] **041. Teacher form:** Selecting **I'm a teacher** produces a recognisable teacher journey, not an ordinary student form relabelled.
- [ ] **042. Teacher details:** Name, username, email, password and mobile fields are clear; mandatory DOB, course and level are not demanded.
- [ ] **043. Teacher introduction:** The optional introduction is clearly optional, readable and comfortable for a longer answer.
- [ ] **044. Teacher completion:** A teacher registration finishes with an appropriate confirmation and normal access, not student-only onboarding language.
- [ ] **045. Interested purpose:** Selecting **I'm interested in Puckle** clearly offers **occasional updates**, not an app account or a general contact form.
- [ ] **046. Interested consent design:** There is no redundant updates checkbox; the explanation and **Keep me updated** button make the intended subscription clear.
- [ ] **047. Interested optional reason:** **What brings you to Puckle?** is optional, easy to use and not framed as a mandatory questionnaire.
- [ ] **048. Interested confirmation:** After submission, the message accurately says the visitor requested updates; it does not imply they joined the app.
- [ ] **049. No-email option:** **Don't have an email address?** is visible in all three choices; switching to it clearly explains a follow-up request rather than account creation.
- [ ] **050. Mobile-only request:** Credential fields disappear, mobile becomes required, and the success text makes clear that the founder will follow up rather than immediately activating an account. For Interested, mobile-only is not described as marketing-SMS consent.

## F. Login, password recovery and returning users (051–060)

- [ ] **051. Login page:** The Puckle branding and login wording look correct on iPhone.
- [ ] **052. Existing test account:** A seeded account signs in without odd flashes, redirects or blank screens.
- [ ] **053. Error feedback:** A mistyped password gives useful, non-technical feedback that can be corrected without re-entering everything.
- [ ] **054. Forgot password link:** The link is easy to see and reaches the intended password-recovery page.
- [ ] **055. Recovery form layout:** Email entry, submit action and return-to-sign-in navigation are clear and fit above the keyboard.
- [ ] **056. Neutral request feedback:** A recovery request shows a calm confirmation that does not publicly identify whether an account exists.
- [ ] **057. Recovery action page:** If a captured reset link is available, its page is readable, password inputs are usable, and it never looks like a parent-approval screen.
- [ ] **058. Logout:** Signing out returns to an appropriate signed-out view, with no stale member-only overlay left behind.
- [ ] **059. Return sign-in:** Signing back in feels normal and does not replay the one-time *registration* confirmation.
- [ ] **060. Legacy account:** An existing account created before Puckle Join can still access My Decks and previous learning content without being forced through a new registration form.

## G. First welcome, onboarding and normal app use (061–070)

- [ ] **061. Distinct welcomes:** The six-second *registration confirmation* and later *onboarding welcome* feel like two intentional moments rather than a confusing duplicate.
- [ ] **062. Full onboarding welcome:** A genuinely new learner sees the expected welcome on eligible `/decks` or `/library` screens.
- [ ] **063. Welcome tone:** Copy feels welcoming to a 14–19-year-old student and is neither corporate nor patronising.
- [ ] **064. Request a free session:** The action opens the existing tuition form and does not claim to book anything automatically.
- [ ] **065. Explore Puckle:** The action dismisses onboarding and leaves the learner at a sensible place to explore.
- [ ] **066. No unwanted interruption:** Once the learner has begun using the app, delayed onboarding content does not suddenly cover an active task; any quiet launcher is subtle.
- [ ] **067. Right routes only:** Onboarding is not unexpectedly shown on Creator, progress or unrelated screens.
- [ ] **068. Overlay coexistence:** A full-screen media viewer, app modal or expanded Deck introduction is not obscured by onboarding.
- [ ] **069. Learning gestures:** Opening a Deck, moving between Cards, flipping a Card, scrolling and opening personal content still feel normal.
- [ ] **070. Return visits:** After acknowledging the full welcome, reload and navigate again; it should not continually restart or block normal use.

## H. Under-16 guardian request and reminders (071–080)

- [ ] **071. Optional request:** The 13–15-year-old welcome offers guardian approval as optional, while **Explore Puckle** remains available without it.
- [ ] **072. Guardian wording:** The text explains *why* a parent/guardian might be asked, without suggesting ordinary private learning is forbidden.
- [ ] **073. Guardian email input:** Field placement, keyboard, error wording and send button are comfortable on the phone, without zooming or clipping.
- [ ] **074. Request feedback:** After requesting approval, the student sees understandable feedback and does not mistake it for approval already granted.
- [ ] **075. Dismiss or skip:** Skipping the guardian request leaves the student able to use private learning immediately.
- [ ] **076. Setup reminder:** A small bottom-left reminder is visible when appropriate but does not cover important Deck or Card controls.
- [ ] **077. Pending reminder:** After a request, the wording clearly communicates **pending** and makes the available resend action understandable.
- [ ] **078. Declined/withdrawn wording:** If using prepared fixtures, both statuses are described truthfully and the ask-again action feels appropriate rather than pressuring.
- [ ] **079. Dismissal persistence:** Dismissing the reminder keeps it away during navigation and reloads in that browser session; it does not unexpectedly affect another signed-in account.
- [ ] **080. Ineligible states:** An approved child or a user aged 16+ does not see an inappropriate guardian reminder; unknown-DOB accounts are not presented as verified minors.

## I. Parent/guardian email text, approval and withdrawal (081–090)

- [ ] **081. Request email wording:** Read the captured parent request email in the log. Does it clearly identify the child, the purpose and the action being requested?
- [ ] **082. Parent link on iPhone:** Open a `Phone link` captured in the log; the parent action page opens cleanly without requiring a Puckle login.
- [ ] **083. Shared scope:** The explanation clearly says what Group Experiences involve and that the approval applies across **Puckle, Switchplay and Strat17**.
- [ ] **084. No tuition confusion:** The parent is not led to believe this approves live tuition, paid lessons, unrestricted publishing or unrelated activities.
- [ ] **085. Guardian declaration:** The **I am this student's parent or legal guardian** checkbox and its wording are clear, proportionate and unchecked initially.
- [ ] **086. Decision controls:** **Approve** and **Decline** are clearly different actions with appropriately comfortable tap targets and visual emphasis.
- [ ] **087. Decision confirmation:** After choosing one action, the confirmation plainly explains the outcome, without leaving a misleading active decision button.
- [ ] **088. Withdrawal email/link:** Read the captured post-approval withdrawal message and open its link; the purpose and destination are obvious.
- [ ] **089. Withdraw screen:** The confirmation declaration and **Withdraw approval** action communicate the consequences clearly, without accidental one-tap withdrawal.
- [ ] **090. Link problems:** If a prepared expired/replaced link is available, its message is reassuring and the **Email me a new link** action is understandable. Do not spend time fabricating expiry cases manually.

## J. Tuition enquiry — public and signed-in journeys (091–100)

- [ ] **091. Visitor tuition form:** Signed out, the existing form and parent/student/adult choice remain understandable; no account is required.
- [ ] **092. Parent asking for a child:** The parent enquiry reads naturally and asks for the right student's and guardian's contact details.
- [ ] **093. Student under 18:** Guardian-contact requirements are clearly explained and do not sound accusatory or overly legalistic.
- [ ] **094. Adult visitor:** The adult path does not require irrelevant parent details and feels quick to fill in.
- [ ] **095. Signed-in under-18 student:** The Student/Adult/Parent selector disappears when the saved DOB is known; only appropriate student information is prefilled, not mislabelled guardian details.
- [ ] **096. Signed-in adult student:** Saved name, email and mobile are prefilled where available, with an obvious ability to edit them.
- [ ] **097. Non-student / unknown DOB:** An account without the relevant student context sees a sensible fallback to the normal enquiry choices.
- [ ] **098. Form recovery:** Validation or a correction does not erase a long message or other valid information typed into the form.
- [ ] **099. Submission confirmation:** The success message says Puckle will follow up personally about the free session, not that a booking already exists.
- [ ] **100. Founder notification content:** Where a local captured alert is available, the submitted enquiry details are readable and sufficient to follow up, without confusing the applicant with a newly created member.

## K. Card, Deck and Info Card visibility/publishing UX (101–110)

- [ ] **101. Unapproved Card control:** In the `unapproved` fixture, **Public** stays visible but greyed out; **Private** is obviously usable.
- [ ] **102. Unapproved Deck control:** The same greyed-out/tappable Public treatment appears in Deck publication.
- [ ] **103. Unapproved Info Card control:** The same behaviour appears in Info Card publication, not a different-looking warning.
- [ ] **104. Immediate explanation:** Tapping greyed-out Public explains approval is required **before** attempting final Publish.
- [ ] **105. Dismiss with OK:** The explanation includes a clearly visible **OK** button and disappears fully when tapped.
- [ ] **106. Editing survives:** After dismissing the warning, Private remains selected, typed changes remain, and normal work can continue.
- [ ] **107. Approved account:** With a permitted test account, Public looks available and the existing normal publishing selection remains usable.
- [ ] **108. Server rejection feedback:** If a prepared revoked/stale-permission scenario exists, a final rejection can be dismissed without losing Card, Deck or Info Card edits; do not edit live permissions to create this case.
- [ ] **109. Copy refusal:** Where the fixture provides a clean public destination, an unapproved Copy shows a clear, closable message; the UI does not suggest a successful copy.
- [ ] **110. Private Copy / placement:** Copying to an allowed private destination, continuing editing, opening media and navigating Cards still feel normal after an error.

## L. Existing accounts, cross-site presentation and final mobile polish (111–120)

- [ ] **111. Existing account welcome:** A backfilled/legacy account does **not** receive a new-member registration welcome simply because its Puckle profile was added.
- [ ] **112. Existing content continuity:** Previously created Decks, Cards, Info Cards and learning progress display as expected after login.
- [ ] **113. Admin is not a teacher perk:** Peter's teacher category should not visibly imply extra teacher-only application permissions; normal access is shared.
- [ ] **114. Other site branding:** If accessible in your local setup, Switchplay/Strat17 public screens use their own names, not Puckle branding.
- [ ] **115. Other site isolation:** If accessible, Puckle's `/join` page and related signup journey are not offered as the Join experience on Switchplay/Strat17.
- [ ] **116. Rotation and safe areas:** Rotate to landscape and back; buttons, dialogs, bottom controls and input fields do not overlap the iPhone notch/home indicator.
- [ ] **117. Keyboard and scrolling:** While entering longer text and correcting errors, the keyboard never permanently conceals the active field, important feedback or action button.
- [ ] **118. Text scaling:** Increase iPhone text size (where supported) and check key labels, consent wording, dialogs and buttons remain readable without clipping.
- [ ] **119. Browser interruptions:** Briefly switch apps, return to Safari, refresh a non-submitted form and check that screens remain stable, with no unexpected logout or overlay replacing active work.
- [ ] **120. Overall finish:** Read the website as a prospective student, a teacher and a parent: does each route make sense, feel trustworthy and clearly state what happens next?

---

## What is **not** part of this manual pass

These are either already covered by automated tests or belong to later release work:

- Exhaustive duplicate-account races, transaction rollback, malformed JWT/capability input, request-rate limits and database guard concurrency.
- Inspecting or modifying production MongoDB account records by hand. The 11-account backfill was already applied and verified separately.
- Proving that a parental approval actually blocks/allows entry into a Group Experience. That enforcement belongs to the separate Group Experience project.
- Receiving real verification, recovery, founder or guardian emails in Gmail/Outlook. The disposable server captures them locally; **live Resend setup and inbox testing remain Phase 8 work**.
- Sending occasional update campaigns to Interested subscribers; the signup collects the request, but campaign delivery is not built here.
- A complete production launch, deployment, paid subscriptions or automatic tuition scheduling.

## Quick issue log

Copy one line for each issue:

| ID | Account / journey | Expected | Actual | Severity (blocker / annoying / polish) | Screenshot / video |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |
| | | | | | |

**Suggested review order:** A → C → D → G → H → I → J → E → F → K → B → L. Prioritise one complete student registration and one under-16 guardian journey; then review the shorter alternative forms and general polish.
