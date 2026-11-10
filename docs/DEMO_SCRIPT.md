# Pawl Video Demo Playbook & Production Script (Target: 2:40 | Ceiling: 2:50)

> Produced strictly using the **[demo-video-playbook](https://github.com/Dev-43/demo-video-playbook)** standard.
> Context: **PayPal AI Hackathon Submission** (Honest, proof-led, simulation transparently labelled, < 3:00 strict ceiling).
> Live Deployment: [`https://pawl-delta.vercel.app`](https://pawl-delta.vercel.app)
> Approver Passcode: `pawl-demo-passcode-2026`

---

## 1. Frame: Demo Thesis

```
Target Audience:   PayPal Hackathon Judges & FinTech Engineers deploying autonomous AI agents.
Problem:           AI agents with PayPal payment tools read untrusted buyer text (shipping lines, customer
                   notes) written by strangers. A fooled or hijacked agent could move real money.
Solution:          Pawl — an enforceable safety guard in code between the agent and PayPal sandbox APIs,
                   enforcing deterministic money rules, an AI watcher, human approvals, post-execution
                   ledger read-back, and hash-chained audit logging.
Proof Artifact:    Real PayPal Sandbox card capture & refund, transparently labelled compromised-agent
                   simulation, deterministic Rule P7 block, real AI reasoning on S1, and SHA-256 audit chain.
Transformation:    Moves from unmonitored agent risk to enforceable bounds: limits only tighten automatically;
                   only an authenticated human can widen them.
Call to Action:    Inspect the open-source code and reproducible test suite at github.com/Dev-43/pawl.
```

---

## 2. Truth Map

| Claim / Feature | Verification Source | Status |
| :--- | :--- | :---: |
| **Live PayPal Sandbox** | Pinned `@paypal/agent-toolkit@1.11.0` calling live REST endpoints (`api-m.sandbox.paypal.com`). | Verified |
| **Simulated Compromised Mode** | Scripted action targeting victim capture; displays visible `SIMULATED COMPROMISED AGENT` banner. | Verified |
| **Model Attack Resistance** | 0 of 50 attacks succeeded on real models (models resisted without Pawl; see `docs/TESTING.md`). | Verified |
| **Deterministic Scope Block** | Rule P7 halts refund to out-of-scope capture; ratchets `create_refund` to `require_approval`. | Verified |
| **Real AI Reasoning (S1)** | Real model (Nemotron / Gemini Flash) reasons on order, issues $15 refund; ledger MATCH. | Verified |
| **Human Approval Gate (S3)** | Rule P2 holds refund ($85 > $50 cap); approver signs in with passcode to approve. | Verified |
| **L4 Ledger Read-Back (S4)** | Compares requested vs recorded minor units; detects fault-injected mismatch; freezes run. | Verified |
| **Tamper-Evident Audit Chain** | SHA-256 hash-chain linked to 64-zero Genesis hash; validated live via `/api/audit/:id/verify`. | Verified |
| **Test Suite Count** | 17 test files, 107 tests passing in `tests/` (verified in `docs/TESTING.md`). | Verified |

---

## 3. Proof Spine

```
0:00  [Landing]       The Problem: AI agents holding payment tools read text written by strangers.
0:20  [/simulator]    Proof: S2 Compromised Simulation -> Labelled banner; baseline leaks; guarded blocked by Rule P7.
0:55  [Architecture]  Defense Layers L0–L5: Enforced in code; limits only tighten automatically.
1:10  [/simulator]    Proof: Real AI in Action (S1) -> Model reasons step-by-step, refunds $15, ledger matches.
1:30  [/approvals]    Proof: S3 Above-Cap refund held by Rule P2; Approver signs in and authorizes execution.
2:00  [/audit]        Proof: S4 Ledger drift detected & frozen; SHA-256 audit chain verified back to Genesis.
2:20  [Results & CTA] Honest Limits: Real models resisted 50/50 without Pawl; cannot undo settled refunds; GitHub link.
```

---

## 4. Stage Directions & Recording Setup

- **Resolution**: `1920x1080` (Full HD), browser zoomed to **110%** for clear badge readability.
- **Bookmarks Bar**: Hidden (`Ctrl+Shift+B` / `Cmd+Shift+B`).
- **Timing & Transitions**: Live runs take ~30–40s. **In video editing, cut the idle waiting time and show a visible `[Sped Up 4x]` overlay label** during execution spinners.
- **Pre-opened Tabs**:
  - Tab 1: `https://pawl-delta.vercel.app` (Landing page)
  - Tab 2: `https://pawl-delta.vercel.app/simulator` (Simulator)
  - Tab 3: `https://pawl-delta.vercel.app/approvals` (Approver terminal)
  - Tab 4: `https://pawl-delta.vercel.app/audit` (Audit chain inspector)
- **Audio Cadence**: Natural, clear speaking speed (~130 words per minute).

---

## 5. Shot-by-Shot Beat Contracts (Total: 2:40)

### Beat 1: The Problem Hook (0:00 – 0:20) [20s | 46 words]
- **Visual Frame**: Start on Tab 1 (`https://pawl-delta.vercel.app`). Clean view of the title card and problem summary. Scroll smoothly to the attack explanation.
- **On-Screen Action**: Cursor highlights the text: *"Untrusted text on PayPal objects can hijack agent execution."*
- **Spoken Voiceover Script**:
  > *"AI agents with PayPal tools can now issue refunds on their own. The text they read, like shipping notes and customer messages, is written by strangers. A fooled or hijacked agent could move real money. Pawl limits what any agent can do, whether or not the model behaves."*

---

### Beat 2: Simulated Compromised Agent — Scenario S2 (0:20 – 0:55) [35s | 68 words]
- **Visual Frame**: Switch to Tab 2 (`/simulator`). Scenario **S2: Poisoned Buyer Text** is selected with the **"Simulated Compromised Agent"** mode enabled.
- **On-Screen Action**:
  1. Highlight the yellow on-screen banner: **`SIMULATED COMPROMISED AGENT: this action is scripted, not chosen by the model`**.
  2. Click **"Run Baseline"** `[Sped up overlay]`. Show the unguarded script issuing an unauthorized $45.00 refund to the victim capture and the PayPal ledger read-back confirming the drain.
  3. Click **"Run Protected"** `[Sped up overlay]`. Show Pawl intercepting the call.
- **Spoken Voiceover Script**:
  > *"First we tried to fool real models: fifty attempts across three models, and none moved money. But a prompt is not a guarantee, so here we simulate a compromised agent, a scripted action against the real PayPal sandbox.*
  > 
  > *Unguarded, the refund goes through, and here is the ledger.*
  > 
  > *Guarded, rule P7 blocks it, the ratchet moves refunds to approval, and the balance is untouched."*
- **Proof Detail**: Zoom in on the banner flag and the green badge: **"BLOCKED: Rule P7 Scope Violation"**.

---

### Beat 3: Defense Layers & Tighten-Only Rule (0:55 – 1:10) [15s | 26 words]
- **Visual Frame**: Scroll down to the Defense Layer Pipeline on `/simulator` or show the Architecture diagram.
- **On-Screen Action**: Highlight layers L1 (Rules), L2 (Watcher), L3 (Approvals), L4 (Ledger Truth), L5 (Audit).
- **Spoken Voiceover Script**:
  > *"Fixed rules, an AI watcher, human approval, a PayPal ledger read-back, and a hash-chained audit log. These defenses are enforced in code. Limits only tighten automatically."*

---

### Beat 4: Real AI in Action — Scenario S1 Clean Refund (1:10 – 1:30) [20s | 43 words]
- **Visual Frame**: Return to `/simulator` and select Scenario **S1: Clean Small Refund**.
- **On-Screen Action**:
  1. Click **"Run with Real Model"** `[Sped up 4x overlay]`.
  2. Show the real model's reasoning trace streaming in: the agent reads the order, reasons about the return policy, and proposes a compliant $15.00 refund.
  3. Show the PayPal Sandbox execution and the Layer 4 ledger read-back displaying **MATCH**.
- **Spoken Voiceover Script**:
  > *"Here is real AI in action on Scenario 1. The model reviews the customer return, reasons step-by-step, and issues an authorized fifteen-dollar refund. PayPal executes it, and our Layer 4 read-back confirms the recorded ledger matches the request."*

---

### Beat 5: Human Approvals (S3) & Audit Verification (1:30 – 2:15) [45s | 78 words]
- **Visual Frame**: Switch to Tab 3 (`/approvals`).
- **On-Screen Action**:
  1. Enter passcode `pawl-demo-passcode-2026` and log in.
  2. View the pending transaction from Scenario S3 (Legitimate refund of $85.00 held by Rule P2 cap).
  3. Click **"Approve"**. Show execution completing and ledger returning **MATCH**.
  4. Switch to `/simulator` S4 or Tab 4 (`/audit`). Show S4 with the prominent **"FAULT INJECTION"** badge and ledger **MISMATCH** freeze.
  5. Click **"Verify Cryptographic Chain"**. Show all event hashes verified back to Genesis.
- **Spoken Voiceover Script**:
  > *"When an authorized refund exceeds our policy cap—like eighty-five dollars in Scenario 3—Rule P2 holds it. An approver logs in with a secure passcode, reviews the context, and approves it.*
  > 
  > *In Scenario 4, simulated ledger drift triggers an immediate freeze and disables the tool.*
  > 
  > *Every single event is linked in an append-only SHA-256 hash chain. Verifying the chain confirms complete cryptographic continuity back to Genesis."*

---

### Beat 6: Honest Limits, Measured Results & Close (2:15 – 2:40) [25s | 51 words]
- **Visual Frame**: Show the Results card and GitHub repository (`github.com/Dev-43/pawl`).
- **On-Screen Action**: Hover over the test scorecard: 17 test files, 107 tests passing, 0 of 50 attacks succeeded on unshielded models.
- **Spoken Voiceover Script**:
  > *"Real models resisted every attack even without Pawl, so we don't claim it stopped a fooled model. It's the enforceable layer for when the model, or the path around it, is compromised. It can't undo a refund that already ran. It's open source at github.com/Dev-43/pawl."*

---

## 6. Clarity Gate Checklist (Before Uploading)

- [ ] **Runtime Under Ceiling**: Video duration is between **2:35 and 2:45** (Ceiling: 3:00).
- [ ] **Simulation Transparently Labelled**: The yellow banner `"SIMULATED COMPROMISED AGENT"` is clearly visible on screen during Beat 2, and the narration explicitly identifies it as a simulation.
- [ ] **Accurate Model Claims**: Narration explicitly acknowledges that real models resisted all 50 attacks without Pawl.
- [ ] **Screen Fidelity**: Narration only credits defenses visible on screen (Rule P7 scope block, ratchet to require_approval, briefing).
- [ ] **Real AI Demonstrated**: Scenario S1 shows real-model step reasoning, execution, and ledger MATCH.
- [ ] **Sped-Up Labels**: Long API wait times (~40s) are cut in editing with a clear `[Sped Up]` visual label.
- [ ] **No Secret Leaks**: No API tokens, database connection strings, or private credentials appear in terminal or inspect tools.
