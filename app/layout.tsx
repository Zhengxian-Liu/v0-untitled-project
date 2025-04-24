import type React from "react"
import type { Metadata } from "next"
import localFont from 'next/font/local'
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

const inter = localFont({
  src: [
    { path: '../public/fonts/inter/Inter-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/inter/Inter-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../public/fonts/inter/Inter-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../public/fonts/inter/Inter-Bold.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-inter'
})

export const metadata: Metadata = {
  title: "PromptCraft",
  description: "Internal tool for localization translators to create, test, and evaluate AI translation prompts",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
