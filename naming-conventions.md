# Next.js Component Naming Conventions: Best Practices for File and Component Names

Are you building with Next.js and wondering about the best way to name your files? Let's cut to the chase and explore the recommended conventions that will make your codebase more maintainable.[1]

## TL;DR

- Use lowercase kebab-case for file names (user-profile.tsx)[1]
- Keep PascalCase for component names (function UserProfile())[1]
- Stay consistent across your project[1]
- Follow Next.js App Router conventions for folder names[1]

## Why Kebab-Case is the Way to Go

### Cross-Platform Compatibility

```
# Works everywhere
/components/user-profile.tsx

# Might cause issues
/components/UserProfile.tsx # Case sensitivity problems on Linux
```

### URL-Friendly Structure

```
// File: pages/blog-posts/[slug].tsx
// URL: /blog-posts/my-awesome-post
```

### Next.js App Router Alignment

```
app/
├── dashboard/ # /dashboard
│ ├── settings/ # /dashboard/settings
│ │ └── page.tsx
│ └── analytics/ # /dashboard/analytics
│ └── page.tsx
└── profile/ # /profile
    └── page.tsx
```

## Practical Implementation

### Component Files

```typescript
// user-profile.tsx
export default function UserProfile() {
  return (
    <div className="profile-container">
      <h1>User Profile</h1>
      {/* Component content */}
    </div>
  )
}

// Usage in other files
import UserProfile from './user-profile'
```

### Feature Organization

```
features/
├── auth/
│ ├── login-form.tsx
│ ├── auth-provider.tsx
│ └── auth-hooks.ts
└── dashboard/
    ├── data-table.tsx
    ├── chart-widget.tsx
    └── dashboard-utils.ts
```

### API Routes

```typescript
// app/api/user-data/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: 'Hello from API' })
}
```

### Common Pitfalls to Avoid

 Don't mix naming conventions:

```
components/
├── UserProfile.tsx # Inconsistent
├── data-table.tsx # Correct
└── NavigationBar.tsx # Inconsistent
```

 Do maintain consistency:

```
components/
├── user-profile.tsx
├── data-table.tsx
└── navigation-bar.tsx
```

### Quick Reference Guide

**File Names**

```
#  Good
data-table.tsx
user-profile.tsx
auth-provider.tsx

#  Avoid
DataTable.tsx
userProfile.tsx
auth_provider.tsx
```

**Component Names**

```typescript
//  Good
export default function DataTable() {
  // ...
}

//  Avoid
export default function dataTable() {
  // ...
}
```

## Why This Matters

**Routing Consistency:** Next.js uses file-based routing, making lowercase names crucial for URL predictability.[1]

**System Compatibility:** Prevents case-sensitivity issues between Windows and Linux.[1]

**Team Collaboration:** Makes code more predictable and easier to navigate.[1]

## Real-World Project Structure

```
src/
├── components/
│ ├── common/
│ │ ├── button.tsx
│ │ └── input.tsx
│ └── features/
│ ├── user-profile.tsx
│ └── data-table.tsx
├── hooks/
│ ├── use-auth.ts
│ └── use-theme.ts
├── utils/
│ ├── api-helpers.ts
│ └── date-formatters.ts
└── pages/
    ├── api/
    │ └── user-data.ts
    ├── blog/
    │ └── [slug].tsx
    └── index.tsx
```

### Quick Setup Tip

Add an .editorconfig file to enforce consistency:[1]

```ini
# .editorconfig
root = true

[*]
end_of_line = lf
insert_final_newline = true
charset = utf-8
indent_style = space
indent_size = 2

[*.{js,jsx,ts,tsx}]
trim_trailing_whitespace = true
```

## Conclusion

Following these naming conventions will help you build more maintainable Next.js applications. Remember: consistency is key, and kebab-case is your friend in the modern web development landscape.[1]

[1](https://dev.to/vikasparmar/nextjs-component-naming-conventions-best-practices-for-file-and-component-names-39o2)