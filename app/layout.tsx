import type React from "react"
import type { Metadata } from "next"
import localFont from 'next/font/local'
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/lib/authContext"

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
  description: "供本地化译员创建、测试和评估 AI 翻译提示的内部工具",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className={inter.variable} suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            {children}
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
