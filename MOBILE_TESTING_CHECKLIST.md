# iOS/Mobile Testing Checklist for Glassmorphism

## 📱 Testing Environment

**Devices to Test:**
- iPhone (iOS Safari) - Primary target
- iPad (iOS Safari)
- Android Chrome (optional - for broader coverage)

**Browser:** Safari on iOS (primary), Chrome on Android (secondary)

---

## ✅ Glassmorphism Rendering Tests

### 1. **Trading Windows - Multi-Symbol** (`/1watchlist`)

**Visual Checks:**
- [ ] Main card has frosted glass effect (backdrop blur visible)
- [ ] Summary stats cards have subtle transparency
- [ ] Window cards show color-coded backgrounds (green/blue/orange)
- [ ] Border opacity is correct (~40% visible)
- [ ] Shadow effects render properly

**Interaction Tests:**
- [ ] Touch tap on window cards registers
- [ ] Active state (touch feedback) works
- [ ] Scroll performance is smooth
- [ ] No white flashing during scroll

**Expected Result:**
```
Semi-transparent card with blurred background showing
content behind it with a frosted glass appearance
```

---

### 2. **Alert Preferences** (`/1watchlist` - scroll down)

**Visual Checks:**
- [ ] Main card has glassmorphism effect
- [ ] Inner sections (toggle containers) have layered transparency
- [ ] Switch components are visible and accessible
- [ ] Hover states change to active states on mobile

**Interaction Tests:**
- [ ] Toggles respond to touch
- [ ] Switches animate smoothly
- [ ] No delay in state changes
- [ ] LocalStorage persists across page refreshes

**Expected Result:**
```
Nested glassmorphism layers with darker inner
sections maintaining blur effect
```

---

### 3. **Trading Windows Calendar** (`/3calendar`)

**Visual Checks:**
- [ ] Chart container has glass effect
- [ ] Bi-scaling chart renders correctly
- [ ] Symbol summary cards are semi-transparent
- [ ] Category/timeframe selectors work on mobile
- [ ] Chart touches/swipes work properly

**Interaction Tests:**
- [ ] Select dropdowns open properly
- [ ] Chart is zoomable/scrollable (if applicable)
- [ ] Symbol cards respond to touch
- [ ] Landscape orientation works

**Expected Result:**
```
Full-width responsive chart with glassmorphism
card wrapper, readable on mobile screen
```

---

### 4. **Gann Visualization Toggle** (`/2charts`)

**Visual Checks:**
- [ ] G9 button is tappable
- [ ] Gann levels render as dashed lines
- [ ] Reference line labels are readable
- [ ] Chart scales properly on mobile
- [ ] Line chart doesn't have touch lag

**Interaction Tests:**
- [ ] G9 toggle responds immediately
- [ ] Chart pan/zoom works (if enabled)
- [ ] Category tabs are tappable
- [ ] Ticker dropdown works on mobile

**Expected Result:**
```
Clean chart with optional Gann overlay,
responsive controls accessible via touch
```

---

## 🔍 iOS Safari Specific Tests

### Backdrop-Filter Support
- [ ] Main cards show blur (not just transparency)
- [ ] Blur renders behind card content
- [ ] No performance degradation with multiple blur layers

**If blur doesn't work:**
1. Check `-webkit-backdrop-filter` in DevTools
2. Verify iOS version (requires iOS 9+)
3. Test on actual device (not just simulator)

### Safari Rendering Issues
- [ ] No white background flashes
- [ ] Shadows render correctly
- [ ] Border-radius clips properly
- [ ] No color banding in gradients

---

## 🎨 Dark/Light Mode Tests

**Switch theme in browser settings:**
- [ ] Glassmorphism adapts to light mode
- [ ] Glassmorphism adapts to dark mode
- [ ] Contrast is sufficient in both modes
- [ ] Colors remain vibrant in both themes

---

## ⚡ Performance Checks

### Scroll Performance
- [ ] 60 FPS during scroll (use Chrome DevTools FPS meter if available)
- [ ] No lag when scrolling past glassmorphism cards
- [ ] Blur doesn't cause frame drops
- [ ] Touch events respond immediately

### Memory Usage
- [ ] Page loads in under 3 seconds
- [ ] No memory warnings in Safari
- [ ] Multiple cards don't cause slowdown
- [ ] Background monitor doesn't affect performance

---

## 📐 Responsive Layout Tests

### Portrait Orientation
- [ ] Cards stack vertically
- [ ] Full width on small screens
- [ ] Readable text sizes
- [ ] Proper padding/margins

### Landscape Orientation
- [ ] Charts utilize horizontal space
- [ ] Grid layouts adapt (e.g., 2-column where applicable)
- [ ] No horizontal overflow
- [ ] Touch targets remain accessible

### Different Screen Sizes
- [ ] iPhone SE (small - 375px width)
- [ ] iPhone 14 Pro (standard - 393px width)
- [ ] iPhone 14 Pro Max (large - 430px width)
- [ ] iPad (tablet - 768px+ width)

---

## 🔔 Notification Tests (iOS)

### Permission Request
- [ ] Browser asks for notification permission
- [ ] Permission dialog shows 4Castr branding
- [ ] Allow/Deny options work correctly

### Notification Display
- [ ] Icon displays correctly
- [ ] Title and body text are readable
- [ ] Clicking notification opens /1watchlist
- [ ] Notification auto-closes after 10 seconds

### Background Monitor
- [ ] Notifications appear even when tab is in background
- [ ] No duplicate notifications
- [ ] Respects user preferences (high prob only, etc.)

---

## 🐛 Common iOS Issues & Fixes

### Issue: Blur doesn't render
**Fix:** Ensure `-webkit-backdrop-filter` is present:
```css
.card {
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
```

### Issue: Touch doesn't work on hover elements
**Fix:** Add active state instead of hover:
```tsx
className="active:scale-[0.98] transition-transform"
```

### Issue: White flash during scroll
**Fix:** Add background color to card:
```tsx
className="bg-background/40"
```

### Issue: Notch overlap (iPhone X+)
**Fix:** Add safe area padding:
```tsx
className="px-6 pt-safe pb-safe"
```

---

## 📝 Test Report Template

```markdown
## Mobile Test Report - [Date]

**Device:** iPhone 14 Pro, iOS 17.2
**Browser:** Safari

### Glassmorphism Rendering
- ✅ Trading Windows: Blur works, colors vibrant
- ✅ Alert Preferences: Nested layers render correctly
- ✅ Calendar: Chart responsive, cards transparent
- ⚠️ Gann Chart: Minor label overlap on small screen

### Performance
- FPS: 60 (smooth)
- Load time: 2.1s
- Memory: Normal

### Issues Found
1. [Issue description]
   - Impact: High/Medium/Low
   - Fix needed: Yes/No

### Recommendations
- [Any suggested improvements]
```

---

## 🚀 Quick Test URLs

**Development:**
- http://localhost:3000/1watchlist
- http://localhost:3000/2charts
- http://localhost:3000/3calendar

**Production:**
- [Your Vercel URL]/1watchlist
- [Your Vercel URL]/2charts
- [Your Vercel URL]/3calendar

---

## ✨ Success Criteria

All tests pass when:
- ✅ Glassmorphism renders correctly on iOS Safari
- ✅ Touch interactions are responsive
- ✅ No performance issues during scroll
- ✅ Dark/light mode both work
- ✅ Notifications permission + display work
- ✅ Responsive on all tested screen sizes

---

**Testing Priority:** High
**Estimated Time:** 30-45 minutes for complete checklist
**Recommended Frequency:** After each major UI update
