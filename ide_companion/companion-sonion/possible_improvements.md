# Companion Animation & Behavior System

This document defines **MVP 3** for the VS Code Companion extension.

It upgrades companions from static draggable objects into **reactive, behavior-driven animated entities**.

Transform companions from:

> interactive sprites

into:

> reactive digital pets with animation states and behaviors

---

# New Core Features

## 1. Animation States

Companions can switch between multiple states:

* `idle`
* `dragging`
* `hovered`
* `typing`
* `reacting`
* `sleeping`

Each state can have:

* different GIF / WebM asset
* or CSS animation variation

---

## 2. Idle Detection

Detect when the user is inactive.

### Behavior:

* After X seconds of no mouse/keyboard input → companion enters `idle`
* After longer inactivity → enters `sleeping`
* Any interaction wakes companion back to `active`

---

## 3. Typing Reactions

Companions react when the user is typing in the editor.

### Behavior examples:

* start typing → companion becomes `typing`
* stop typing → return to `idle`
* rapid typing → `excited` or `alert` state

---

## 4. Custom Behaviors

User-defined or rule-based reactions.

Examples:

* If file type is `.ts` → companion wears "coding mode"
* If error detected → companion becomes "worried"
* If idle too long → companion sleeps
* If mouse hovers frequently → companion becomes "curious"

---

# Architecture Upgrade (MVP 3)

```
extension.ts
   ↓
CompanionBehaviorEngine   ← NEW (MVP 3 core)
   ↓
CompanionManager
   ↓
CompanionPanel (renderer)
   ↓
Webview (state + animations)
```

---

# NEW FILE — Behavior Engine

## `CompanionBehaviorEngine.ts`

This is the heart of MVP 3.

```ts
import { CompanionManager } from './CompanionManager';

export class CompanionBehaviorEngine {

    private idleTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor(private manager: CompanionManager) {}

    onUserActivity() {
        this.manager.getAll().forEach(c => {
            this.setState(c.id, 'active');
        });
    }

    onTyping() {
        this.manager.getAll().forEach(c => {
            this.setState(c.id, 'typing');
        });
    }

    startIdleDetection() {
        setInterval(() => {
            this.manager.getAll().forEach(c => {
                this.setState(c.id, 'idle');
            });
        }, 5000);
    }

    setState(id: string, state: string) {
        this.manager.update(id, { state: state as any });
    }
}
```

---

# NEW DATA MODEL UPDATE

## Companion.ts (UPDATED)

Add animation state support:

```ts
export interface Companion {
    id: string;
    x: number;
    y: number;
    size: number;
    assetPath: string;
    locked: boolean;

    // MVP 3 additions
    state: 'idle' | 'active' | 'dragging' | 'typing' | 'sleeping' | 'reacting';
    behaviorProfile?: string;
}
```

---

# COMPANION PANEL UPGRADES

## State-driven rendering

In `CompanionPanel.ts` webview:

```js
function getAsset(companion) {
    switch(companion.state) {
        case 'typing': return companion.typingAsset || companion.assetPath;
        case 'idle': return companion.idleAsset || companion.assetPath;
        case 'sleeping': return companion.sleepAsset || companion.assetPath;
        default: return companion.assetPath;
    }
}
```

---

## Render change

```js
img.src = getAsset(c);
```

---

# IDLE DETECTION SYSTEM

## In extension.ts

Listen for editor activity:

```ts
vscode.workspace.onDidChangeTextDocument(() => {
    behaviorEngine.onTyping();
});

vscode.window.onDidChangeTextEditorSelection(() => {
    behaviorEngine.onUserActivity();
});
```

---

# IDLE TIMER LOGIC

Inside BehaviorEngine:

* reset timer on activity
* if no activity → idle state
* extended inactivity → sleeping state

---

# CUSTOM BEHAVIORS SYSTEM

## Behavior profiles

```ts
export interface BehaviorProfile {
    name: string;
    rules: Array<{
        event: string;
        state: string;
        condition?: string;
    }>;
}
```

---

## Example profile

```json
{
    "name": "coder-pet",
    "rules": [
        { "event": "typing", "state": "typing" },
        { "event": "idle", "state": "sleeping" },
        { "event": "error", "state": "reacting" }
    ]
}
```

---

# EVENT SYSTEM (NEW CORE LAYER)

MVP 3 introduces a unified event bus:

Events:

* `typing`
* `idle`
* `mousemove`
* `dragstart`
* `dragend`
* `error`

---

# FULL MVP 3 FLOW

```
User types
   ↓
VS Code event triggers
   ↓
BehaviorEngine updates state
   ↓
CompanionManager updates data
   ↓
Webview re-renders
   ↓
GIF/state changes visually
```

---

# MVP 3 RESULT

After implementation:

✔ companions react to typing
✔ companions go idle/sleep automatically
✔ companions support multiple animation states
✔ behavior rules system exists
✔ foundation for AI-like personality system

---

# MVP 3 OUTCOME

You now evolve from:

> interactive UI system

to

> reactive behavioral simulation engine inside VS Code

---

# NEXT STEP (MVP 4 IDEA)

Potential upgrades:

* personality system (moods, stats)
* learning behaviors
* sound effects
* AI-driven reactions
* multiple companion interactions
