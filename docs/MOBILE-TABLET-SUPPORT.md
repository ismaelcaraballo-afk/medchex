# MedChex — Mobile & Tablet Support

**What this update does:** MedChex now works on phones, tablets, and computers. Before this, it was only designed for desktop screens. This document explains what changed and why it matters.

---

## Why This Matters for MedChex

MedChex is a drug interaction checker. The people who need it most — patients, caregivers, family members — are often checking medications on their phone at a pharmacy, or on a tablet at home. If the app only looks right on a laptop, we're cutting out the people we built it for.

---

## What Devices Are Now Supported

### Phones
Any modern smartphone — iPhone or Android. The app stacks everything in one column, makes the buttons large enough to tap with a finger, and fits the screen without zooming or sideways scrolling.

### iPads — Apple Tablets

Each iPad model has a different screen size, so each gets its own layout:

| iPad Model | Screen Size | What MedChex Does |
|------------|-------------|-------------------|
| **iPad Mini** (portrait) | Small tablet | Compact centered layout, large tap targets |
| **iPad** (plain, 10th gen) | Medium tablet | Wider layout, comfortable reading width |
| **iPad Air** | Same as iPad | Same as iPad — same size screen |
| **iPad Pro 11"** | Large tablet | More breathing room, larger inputs |
| **iPad Pro 13"** | Extra large | Two columns side by side — drug search on the left, results on the right |

When you flip any iPad sideways (landscape), the layout expands to use the extra width.

### Android Tablets

Android tablets vary a lot by manufacturer, but the app handles two main cases:

- **Touch mode** (finger on screen) — Bigger buttons and inputs so nothing is hard to tap
- **Samsung DeX / Keyboard mode** (mouse or trackpad connected) — Tighter, more precise hover effects, similar to using a laptop

---

## What "Two-Column Layout" Means

On larger tablets and screens, instead of scrolling down to see your results, the app splits into two panels side by side:

```
┌─────────────────────┬──────────────────────┐
│                     │                      │
│   Drug Search       │   Your Results       │
│   (type drugs here) │   (appear here)      │
│                     │                      │
└─────────────────────┴──────────────────────┘
```

This means less scrolling and a faster experience — you type on the left and read results on the right without moving your eyes much.

---

## What We Did NOT Change

- The app still works exactly the same — same drug lookups, same FDA data, same AI explanations
- Nothing about how the backend works changed
- The dark color scheme is the same
- All existing features are intact

---

## How to Test It

If you want to see how MedChex looks on a phone or tablet without having the device in hand:

1. Open MedChex in Chrome on your laptop
2. Right-click anywhere on the page → **Inspect**
3. Click the phone/tablet icon at the top of the panel that opens
4. Use the dropdown menu to pick a device (iPhone, iPad, Galaxy Tab, etc.)

You'll see the layout change in real time.

---

## Summary

This update makes MedChex accessible to the actual patients and caregivers who need it — wherever they are, whatever device they have. It was built to meet people where they are, not to require them to be at a desk.

---

*Update completed: March 2026*
*Technical implementation: Ismael Caraballo*
*Documentation: RRC*
