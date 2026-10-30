# design-plan.md

MAZ Plumbing and General Services design plan. Step 1.13 of phases-plan.md. Owner approves in step 1.15.
Locked decisions win over any style advice: all white, black text, navy buttons, Lucide icons, radius 8 and 16 only, weights 400 and 600, no gradients, glows, emojis or single side colored borders.

---
## WHAT THE DESIGN IS FOR
---

- Subject: booking and paying for home services in the Philippines.
- Users: customers (households, small businesses), providers (hands on workers, often on a phone in the field), admin (owner's team at a desk and on a phone).
- Main job: make it clear what happens next, who has to act, and how much money moves.
- Conditions: small and mid range phones, bright light, slow networks, some users who need large text.

---
## IDEA: EVERY SCREEN STARTS WITH THE NEXT STEP
---

This is the one memorable thing. Everything else stays quiet.

Each booking, offer, job and queue item opens with one plain sentence that says where things stand and who acts next. Examples:
- "Waiting for Ana to answer. 24 minutes left."
- "Pay the 50 percent deposit to confirm your booking."
- "Your balance is due. Pay in the app or in cash to the owner."
- "Ready for a foreman. Pick one from the list."

Rules for the sentence:
- Sentence case, active voice, under 100 characters.
- Names the person who must act. If it is the viewer, it says "You".
- Sits directly under the header, above all details, in the large text token.
- One button at most sits beside it: the primary action.
- Error and empty states use the same slot.

---
## PALETTE (6 named values)
---

Final hex values are set in step 1.16 and checked in step 1.17. Contrast targets: text 4.5 to 1, borders and buttons 3 to 1.

| Name | Value | Use |
|---|---|---|
| Paper | #FFFFFF | Page, cards, inputs |
| Ink | #1A1A1A | Body text and headings |
| Navy | #1B2B5B | Primary button, links, focus ring, active tab |
| Navy deep | #101D40 | Primary button hover and pressed |
| Gray text | #595959 | Secondary text |
| Gray line | #8A8A8A | Input borders and icons (3 to 1). Light dividers use #E5E5E5 and carry no meaning |

Status colors (always paired with a Lucide icon and a word, never color alone):
- Success #1E6B3A
- Warning #8A5A00
- Error #B3261E

No tint, gradient or shadow decoration. One shadow token is allowed for modals and menus only.

---
## TYPE
---

- One family: Atkinson Hyperlegible Next. It was drawn for legibility, which suits the font size setting, bright light and small screens. Fallback if it is not available through next/font: Public Sans.
- Weights: 400 and 600 only.
- Numbers use tabular figures so peso amounts line up in tables and summaries.
- Peso format: P20,000. Right aligned in tables.
- Three size tokens in rem: small, body, large. The large token carries the next step sentence and screen titles.
- Four user levels scale the root size: Small 87.5 percent, Medium 100 percent, Large 112.5 percent, Extra large 125 percent. Everything is in rem, so layouts reflow and nothing is cropped.
- Line length stays under 70 characters. Body line height 1.5.
- No all caps labels, no eyebrow labels above headings, no single word accents in headlines.
- Text logo placeholder: "MAZ Plumbing and General Services" in the large token at weight 600. Swap for the vector logo in Phase 16.

---
## LAYOUT RULES
---

- Mobile first. One column. Content width up to 40rem on desktop for forms and lists. Admin tables use the full width.
- Spacing on an 8 px grid, 4 px for tight gaps. Radius 8 for buttons, inputs and chips. Radius 16 for cards and modals.
- Cards have a 1 px border on all four sides in Gray line light divider. No shadow.
- Lists use full width rows with a light neutral divider between them. Dividers are never colored.
- Tap targets at least 2.75rem high. Primary button full width on phones, placed above the secondary.
- Left aligned text everywhere. Numbers right aligned in tables.
- Header height is one token and is identical on every page. Logo left, one role specific control right.
- Steppers are used only where the content is a real sequence: sign up, booking, quote, signature. Their numbers carry meaning.
- Motion: only in response to a tap (open, expand, confirm). Respect reduced motion. No entrance animations.
- Status chips show an icon and a word. Never only a color.

---
## WIREFRAMES
---

### 1. Public (sign up, log in, Terms)

```
+----------------------------------+
| MAZ Plumbing and General Services                  Log in |
+----------------------------------+
| Book trusted home services       |
| near you.                        |
|                                  |
| [ Book a service ]  (primary)    |
| [ Become a provider ] (secondary)|
|                                  |
| How it works                     |
|  1 Tell us what you need         |
|  2 Pick a provider               |
|  3 Pay the deposit               |
|  4 Sign when the job is done     |
+----------------------------------+
| Terms   Privacy   Cancellation   |
+----------------------------------+
```
The four steps are a real sequence, so numbers are allowed here.

### 2. Customer (mobile)

```
+----------------------------------+
| MAZ Plumbing and General Services                  [Aa]   |
+----------------------------------+
| Waiting for Ana to answer.       |
| 24 minutes left.                 |
|                                  |
| Aircon cleaning                  |
| Sat 24 Oct, 9:00 AM              |
| Pasig City                       |
|  +----------------------------+  |
|  | Deposit  P1,000 (50%)      |  |
|  | Balance  P1,000            |  |
|  +----------------------------+  |
| [ Message Ana ]                  |
+----------------------------------+
| Home | Bookings | Chat | Settings|
+----------------------------------+
```

### 3. Customer picks a provider (normal jobs)

```
+----------------------------------+
| < Back                           |
+----------------------------------+
| Pick who should do the job.      |
|                                  |
| (o) Ana R.        Best match     |
|     4.8 rating  2.1 km  63 jobs  |
|     Reliable  P1,200 per day     |
| ( ) Ben T.                       |
|     4.6 rating  3.4 km  41 jobs  |
|     Reliable  P1,000 per day     |
| ( ) ...                          |
|                                  |
| [x] If declined, offer to the    |
|     next best automatically      |
| [ Send request to Ana ] (primary)|
+----------------------------------+
```
"Best match" is a word chip with an icon and a one line reason when opened. No contact details are shown.

### 4. Provider (mobile)

```
+----------------------------------+
| MAZ Plumbing and General Services                  [Aa]   |
+----------------------------------+
| You have a new offer.            |
| Answer in 24 minutes.            |
|                                  |
| Aircon cleaning, Pasig City      |
| 2.1 km away  Sat 24 Oct, 9 AM    |
| Daily rate P1,200                |
|                                  |
| [ Accept ]  (primary)            |
| [ Decline ] (secondary)          |
+----------------------------------+
| Offers | Jobs | Chat | Earnings  |
+----------------------------------+
```
Job day screen: next step sentence ("Check in when you arrive."), one large primary button (On my way, Check in, Close the day), photo and receipt upload below.

### 5. Admin (desktop)

```
+-----------------------------------------------------------+
| MAZ Plumbing and General Services   Needs action (12)   Bookings   Users   Applications  |
+-----------------------------------------------------------+
| 5 jobs need a foreman.                                    |
|                                                           |
| Queue: [Foreman assignment v]   Search [____]             |
| +-------------------------------------------------------+ |
| | Job      Customer   Area      Quote        Waiting    | |
| | #1042    L. Cruz    Taguig   P120,000      2 h        | |
| | #1039    M. Reyes   Pasig     P95,000      1 d        | |
| +-------------------------------------------------------+ |
| Rows per page [20 v]   1 to 20 of 38    < 1 2 >           |
+-----------------------------------------------------------+
```
Admin on a phone: bottom bar with 4 items plus More. Tables turn into stacked rows with the key value first.

### 6. Foreman assignment (admin) and foreman view (customer)

```
Admin                               Customer
+-----------------------------+     +-----------------------------+
| Pick a foreman for #1042.   |     | Your foreman is Ben T.      |
| Ranked list (same score)    |     | 4.6 rating, 41 jobs         |
| ( ) Ben T.  4.6  3.4 km     |     | [ Ask for a change ]        |
| ( ) Ana R.  4.8  2.1 km     |     |   (reason required)         |
| [ Send offer to Ben ]       |     +-----------------------------+
+-----------------------------+
```

---
## BASE COMPONENT STATES (step 1.21)
---

Every component has: default, hover, focus (navy ring, 2 px, offset 2 px), pressed, loading, success, error, empty where it applies, disabled. A disabled primary button always shows what is missing next to it.

Built in step 1.21 (src/components/ui). X means built. A dash means the state does not apply to that component.

| Component | Default | Hover | Focus | Pressed | Loading | Success | Error | Empty | Disabled |
|---|---|---|---|---|---|---|---|---|---|
| Button | X | X | X | X | X | - | - | - | X (with reason) |
| Input | X | X | X | - | X | X | X | - | X |
| Select | X | X | X | - | - | X | X | - | X |
| Checkbox | X | X | X | - | - | - | X | - | X |
| Radio group | X | X | X | - | - | - | X | - | X |
| Modal | X | - | X | - | X (footer button) | - | X | - | - |
| Toast | X | X (dismiss) | X | - | - | X | X | - | - |
| Table | X | - | X (scroll area) | - | X | - | X | X | - |
| List | X | X | X | X | X | - | X | X | X |
| Stepper | X | - | - | - | - | X (completed step) | X (needs attention) | - | - |
| Empty state | X | - | - | - | - | - | - | X | - |
| File upload | X | X | X | - | X (progress) | X (file name) | X | - | X |

Rules used when building:
- Status is an icon (Lucide) plus text, with a hidden label for screen readers. Never color alone.
- Disabled controls use the light divider color as a neutral surface. The reason sits next to a disabled primary button.
- Only the two radius tokens are used. Round radio buttons use the 16 px token on a 24 px box.
- Select, dialog and file input are the browser's own elements, styled with tokens, so phones and screen readers behave as expected.
- Toasts: success and note close after 5 seconds. Warnings and errors stay until dismissed. Maximum 3 on screen.
- Table is for 5 or more rows, List for fewer. Neither sits inside a card.
- The Toast provider joins the root layout in step 1.20, when the shells exist. Toast offset above a bottom tab bar is the --toast-offset-bottom token.
- Raw values are only allowed in tokens.css. The one exception is the media query width (40rem), because CSS variables do not work in media queries. Step 1.22 must allow it.

---
## BUTTON RULES (step 1.18, confirmed by owner 2026-10-17)
---

- Primary: navy, white text. Hover and pressed use navy deep.
- Secondary: white, black text and border. Hover is navy with white text.
- One primary button per screen or group.
- On phones the primary is full width and sits above the secondary.
- Minimum height is the tap target token (2.75rem).
- A disabled primary button shows next to it what is missing.
- A button label says what it does ("Pay deposit", not "Submit") and keeps its name through the flow.

---
## REVIEW AGAINST THE BRIEF AND AGAINST TEMPLATE DEFAULTS
---

Checked on 2026-10-17:
- Locked look kept: white, near black text, navy buttons, radius 8 and 16, weights 400 and 600, Lucide only.
- Not used: cream and terracotta, dark mode with an acid accent, broadsheet columns, identical shadow cards, gradient washes, caps eyebrow labels, middle dot meta strings, a spaced em dash in labels, arrows on buttons, monospace data labels.
- Changed during review:
  - Dropped a light blue status tint. Status now uses icon plus word on white.
  - Dropped numbered markers on cards. Numbers appear only in real sequences (sign up, booking, signature, "how it works").
  - Dropped a tinted near black. Ink is a neutral #1A1A1A.
- Where the design is distinctive: the next step sentence at the top of every screen, and the consistent use of "who acts next" language across all three roles.
- Tailwind is not used. Tokens are CSS variables so a check script can flag raw values (step 1.22).

---
## COPY RULES
---

- Sentence case. Plain words. Say "Pay deposit", not "Submit".
- A button keeps its name through the flow. "Send request" gives a toast "Request sent".
- Errors say what went wrong and how to fix it. They do not apologize.
- Empty screens say what to do: "No bookings yet. Book a service."
- Money always shows the peso sign and the split (deposit, balance).

---
## FOR OWNER APPROVAL (step 1.15)
---

1. Is the next step sentence idea right for all three roles?
2. Are the palette and the font (Atkinson Hyperlegible Next) fine?
3. Are the six wireframes close to what you picture?
4. Anything to add or remove before tokens (1.16) and components are built?
