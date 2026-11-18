import { useMemo } from "react"

import { createTranslator, resolveHostLocale, useHostLocale } from "@vvd/sdk"

import en from "@/locales/en.json"

// UI text lives in src/locales, the vvd way. One hook for every component.
const CATALOGS = { en }

export function useT() {
  const { locale } = useHostLocale()
  return useMemo(
    () => createTranslator(resolveHostLocale({ locale, catalogs: CATALOGS, defaultLocale: "en" })),
    [locale],
  )
}
