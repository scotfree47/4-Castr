# 4Castr Glassmorphism Design System

## Apple Glass Aesthetic - Complete Styling Reference

This guide provides the exact styling patterns used across 4Castr for consistent "Apple Glass" appearance.

---

## Core Glassmorphism Pattern

### Base Card Component
```tsx
<Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
```

**Breakdown:**
- `bg-background/40` - 40% opacity background (semi-transparent)
- `backdrop-blur-xl` - Strong blur effect (16px blur in Tailwind)
- `border-border/40` - 40% opacity border
- `shadow-lg` - Large shadow for depth

### Hover State Enhancement
```tsx
<Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg hover:border-primary/50 transition-colors">
```

**Adds:**
- `hover:border-primary/50` - Border highlights on hover
- `transition-colors` - Smooth color transitions

---

## Component-Specific Patterns

### 1. **Trading Windows Cards** (Primary Pattern)

**Container Card:**
```tsx
className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg"
```

**Individual Window Cards:**
```tsx
className="rounded-xl border backdrop-blur-lg p-4 transition-all hover:scale-[1.02] hover:shadow-xl bg-green-500/5 text-green-400 border-green-500/30 shadow-green-500/10"
```

**Color Variants:**
- **High Probability:** `bg-green-500/5 text-green-400 border-green-500/30 shadow-green-500/10`
- **Moderate:** `bg-blue-500/5 text-blue-400 border-blue-500/30 shadow-blue-500/10`
- **Avoid:** `bg-gray-500/5 text-gray-400 border-gray-500/30 shadow-gray-500/10`
- **Extreme Volatility:** `bg-orange-500/5 text-orange-400 border-orange-500/30 shadow-orange-500/10`

**Interaction:**
- `hover:scale-[1.02]` - Subtle zoom on hover
- `hover:shadow-xl` - Enhanced shadow on hover
- `transition-all` - Smooth transitions

---

### 2. **Alert Preferences Card**

**Main Card:**
```tsx
className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg hover:border-primary/50 transition-colors"
```

**Inner Sections:**
```tsx
className="p-4 rounded-lg bg-background/20 border border-border/40"
```

**With Hover:**
```tsx
className="p-4 rounded-lg bg-background/20 border border-border/40 hover:bg-background/30 transition-colors"
```

---

### 3. **Calendar Trading Windows**

**Main Card:**
```tsx
className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg"
```

**Symbol Summary Cards:**
```tsx
className="p-4 rounded-lg border backdrop-blur-lg bg-background/20 hover:bg-background/30 transition-colors"
```

---

### 4. **Charts with Gann Visualization**

**Chart Container Card:**
```tsx
className="@container/card hover:border-primary/50 transition-colors"
```

**Note:** Charts use default Card styling but can be enhanced with glassmorphism if needed.

---

## Opacity Scale Reference

| Opacity | Tailwind Class | Use Case |
|---------|----------------|----------|
| 5% | `/5` | Very subtle tint for colored sections |
| 10% | `/10` | Subtle shadow/glow effects |
| 20% | `/20` | Inner section backgrounds |
| 30% | `/30` | Border accents, hover states |
| 40% | `/40` | Main card backgrounds, borders |
| 50% | `/50` | Emphasized hover borders |

---

## Backdrop Blur Levels

| Class | Blur Amount | Use Case |
|-------|-------------|----------|
| `backdrop-blur-sm` | 4px | Subtle blur |
| `backdrop-blur` | 8px | Standard blur |
| `backdrop-blur-lg` | 12px | Strong blur for inner cards |
| `backdrop-blur-xl` | 16px | **Primary** - Main card blur |
| `backdrop-blur-2xl` | 24px | Extra strong (rarely used) |

**Recommendation:** Use `backdrop-blur-xl` for all main cards, `backdrop-blur-lg` for nested elements.

---

## Complete Component Template

### Full Trading Card Example
```tsx
<Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
  <CardHeader>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <CardTitle>Title</CardTitle>
      </div>
      <Badge variant="outline">Label</Badge>
    </div>
    <CardDescription>Description text</CardDescription>
  </CardHeader>

  <CardContent className="space-y-4">
    {/* Inner card with glassmorphism */}
    <div className="p-4 rounded-lg bg-background/20 border border-border/40 hover:bg-background/30 transition-colors">
      <p className="text-sm">Content</p>
    </div>

    {/* Colored accent card */}
    <div className="rounded-xl border backdrop-blur-lg p-4 transition-all hover:scale-[1.02] hover:shadow-xl bg-blue-500/5 text-blue-400 border-blue-500/30 shadow-blue-500/10">
      <p className="text-sm">Highlighted content</p>
    </div>
  </CardContent>
</Card>
```

---

## Mobile Optimization (iOS/Safari)

### Critical for iOS Safari:
1. **Use `-webkit-backdrop-filter` fallback** (automatically handled by Tailwind)
2. **Test on actual device** - Simulators may not render blur correctly
3. **Performance considerations:**
   - Limit nested blur effects (max 2 levels deep)
   - Avoid animating blur itself
   - Use `will-change` sparingly

### iOS-Specific Enhancements:
```tsx
// Add to critical glassmorphism cards
className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg [-webkit-backdrop-filter:blur(16px)]"
```

### Touch Interaction:
Replace `hover:` with `active:` for mobile-friendly states:
```tsx
// Desktop: hover:scale-[1.02]
// Mobile-friendly: active:scale-[0.98] transition-transform
className="active:scale-[0.98] transition-transform"
```

---

## Performance Best Practices

### ✅ DO:
- Use backdrop-blur on container cards
- Limit to 2-3 levels of blur nesting
- Combine with low opacity backgrounds (`/20`, `/40`)
- Use `transition-colors` for smooth state changes
- Test on actual iOS devices

### ❌ DON'T:
- Apply backdrop-blur to every element
- Animate blur values (causes jank)
- Use blur on large scrolling areas
- Stack more than 3 blur layers
- Use full opacity with blur (defeats purpose)

---

## Quick Migration Checklist

To update an existing component to glassmorphism:

1. **Replace Card className:**
   ```tsx
   // Before
   <Card>

   // After
   <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg">
   ```

2. **Update inner sections:**
   ```tsx
   // Before
   <div className="p-4 rounded-lg bg-muted">

   // After
   <div className="p-4 rounded-lg bg-background/20 border border-border/40">
   ```

3. **Add hover states:**
   ```tsx
   // Add to interactive elements
   className="hover:bg-background/30 transition-colors"
   ```

4. **Color-coded sections (if applicable):**
   ```tsx
   // Add colored variants
   className="bg-green-500/5 text-green-400 border-green-500/30"
   ```

5. **Test on mobile:**
   - Check Safari iOS
   - Verify blur renders correctly
   - Test touch interactions

---

## Example Components Using This System

1. **Multi-Symbol Trading Windows** - `/src/app/(dashboard)/1watchlist/components/multi-symbol-trading-windows.tsx`
2. **Alert Preferences** - `/src/components/alert-preferences.tsx`
3. **Trading Windows Calendar** - `/src/app/(dashboard)/3calendar/components/trading-windows-calendar.tsx`
4. **Trading Windows (Single)** - `/src/app/(dashboard)/1watchlist/components/trading-windows.tsx`

---

## Dark/Light Mode Compatibility

The glassmorphism system automatically adapts to theme:
- `bg-background` uses CSS variable `hsl(var(--background))`
- `border-border` uses CSS variable `hsl(var(--border))`
- Opacity modifiers (`/40`) work in both themes

No theme-specific styles needed!

---

## Accessibility Notes

- Ensure sufficient contrast with semi-transparent backgrounds
- Use semantic HTML even with visual effects
- Maintain focus indicators on interactive elements
- Test with screen readers (blur doesn't affect them)

---

**Last Updated:** January 24, 2026
**Design System Version:** 1.0
**Primary Reference:** Multi-Symbol Trading Windows component
