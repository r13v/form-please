/** One published JavaScript entry with its dist name and source module. */
export type PackageEntry = { readonly name: string; readonly source: string }

export function packageEntries(): PackageEntry[]
